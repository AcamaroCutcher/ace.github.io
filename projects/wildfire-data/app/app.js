/* Fire Archive 3D: case fires (static bundles built from the database) and live fires (NIFC, NASA GIBS).
   MapLibre GL 5 draws terrain, imagery, perimeters and detections; deck.gl draws the LiDAR point clouds. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isDark = () => document.documentElement.classList.contains('dark-mode');
const params = new URLSearchParams(location.search);
const WORKER = window.WF_WORKER || params.get('worker') || '';   // optional Cloudflare Worker for FIRMS points
const fmtDate = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
let toastT;
function toast(html, ms = 4500) { const t = $('toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function loading(on, frac) { $('loader').classList.toggle('show', on); if (frac != null) $('loadBar').style.width = Math.round(frac * 100) + '%'; }

/* ------------------------------------------------------------------ map */
const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';
const style = {
  version: 8,
  sources: {
    s2cloudless: { type: 'raster', tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256, maxzoom: 14,
      attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by EOX (Copernicus Sentinel data 2020)' },
    usgs: { type: 'raster', tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 16,
      attribution: 'USGS The National Map' },
    dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15,
      attribution: 'AWS Terrain Tiles (3DEP, SRTM, …)' },
    demhs: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15 },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#1b1c17' } },
    { id: 's2cloudless', type: 'raster', source: 's2cloudless', paint: { 'raster-saturation': -0.1 } },
    { id: 'usgs', type: 'raster', source: 'usgs', minzoom: 8, paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.06, 'raster-fade-duration': 200 } },
    { id: 'hillshade', type: 'hillshade', source: 'demhs', paint: { 'hillshade-exaggeration': 0.32, 'hillshade-shadow-color': '#2a1f12', 'hillshade-highlight-color': '#fff4dc', 'hillshade-accent-color': '#3a2f20', 'hillshade-illumination-direction': 315 } },
  ],
  terrain: { source: 'dem', exaggeration: 1.4 },
  sky: { 'sky-color': '#7fa9d6', 'horizon-color': '#efe2c8', 'fog-color': '#e8dcc4', 'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.35,
         'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 1, 12, 0] },
};
const map = new maplibregl.Map({
  container: 'map', style, center: [-121.2, 44.6], zoom: 6.2, pitch: 55, bearing: -15,
  maxPitch: 82, hash: false, attributionControl: { compact: true },
  dragRotate: true, pitchWithRotate: true, touchPitch: true, keyboard: true,
});
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
map.dragRotate.enable();
map.touchZoomRotate.enableRotation();
const overlay = new deck.MapboxOverlay({ interleaved: true, layers: [] });
map.addControl(overlay);

/* ------------------------------------------------------------------ state */
const S = { mode: 'archive', fire: null, manifest: null, bundle: null, t0: 0, t1: 1, T: 1, playing: false, speed: 1,
            lidar: {}, lidarPhase: '', exag: 1.4, liveList: [] };
const FIRES = 'fires/';

/* ------------------------------------------------------------------ fire layers (MapLibre) */
function emptyFC() { return { type: 'FeatureCollection', features: [] }; }
function addFireLayers() {
  map.addSource('perims', { type: 'geojson', data: emptyFC() });
  map.addSource('derived', { type: 'geojson', data: emptyFC() });
  map.addSource('hot', { type: 'geojson', data: emptyFC() });
  map.addSource('ign', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'derived-line', type: 'line', source: 'derived', layout: { visibility: 'none' },
    paint: { 'line-color': '#f2d64b', 'line-width': 1.6, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 } });
  map.addLayer({ id: 'perim-fill', type: 'fill', source: 'perims', paint: { 'fill-color': '#ff6b1a', 'fill-opacity': 0.10 } });
  map.addLayer({ id: 'perim-line', type: 'line', source: 'perims', paint: { 'line-color': '#ff6b1a', 'line-width': 2.2, 'line-opacity': 0.95 } });
  map.addLayer({ id: 'hot-glow', type: 'heatmap', source: 'hot', maxzoom: 13,
    paint: { 'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'frp'], 1], 0, 0.15, 50, 0.6, 300, 1],
             'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 1.4],
             'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 6, 6, 12, 40],
             'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, 'rgba(160,30,10,0.35)', 0.5, 'rgba(240,110,20,0.6)', 0.8, 'rgba(255,200,80,0.8)', 1, 'rgba(255,250,210,0.95)'],
             'heatmap-opacity': 0.85 } });
  map.addLayer({ id: 'hot', type: 'circle', source: 'hot', minzoom: 8,
    paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, 1.2, 12, 6, 15, 40],
             'circle-color': '#ffd27a', 'circle-opacity': 0.9, 'circle-stroke-width': 0, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'ign', type: 'circle', source: 'ign', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#ff3d2e', 'circle-stroke-width': 3 } });
  // live layers
  map.addSource('live-perims', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'live-fill', type: 'fill', source: 'live-perims', layout: { visibility: 'none' }, paint: { 'fill-color': '#ff6b1a', 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'live-line', type: 'line', source: 'live-perims', layout: { visibility: 'none' }, paint: { 'line-color': '#ff6b1a', 'line-width': 2 } });
  map.on('click', 'live-fill', (e) => { const p = e.features[0].properties; new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(`<b>${esc(p.name)}</b><br>${Math.round(p.acres).toLocaleString()} acres · ${p.contained ?? '?'}% contained<br><small>mapped ${fmtDate(p.t)}</small>`).addTo(map); });
  map.on('mouseenter', 'live-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'live-fill', () => { map.getCanvas().style.cursor = ''; });
}

function setTime(T) {
  S.T = T;
  const dt = (h) => ['-', T, ['*', h, 3600000]];
  // detections up to T, coloured by how long ago they were seen: white-hot now, through orange, to dark red
  map.setFilter('hot', ['<=', ['get', 't'], T]);
  map.setFilter('hot-glow', ['all', ['<=', ['get', 't'], T], ['>', ['get', 't'], ['-', T, 36 * 3600000]]]);
  map.setPaintProperty('hot', 'circle-color', ['interpolate', ['linear'], ['-', T, ['get', 't']],
    0, '#fff6d0', 3 * 3600e3, '#ffc04a', 14 * 3600e3, '#ff6b1a', 48 * 3600e3, '#c0301a', 7 * 86400e3, '#5a1a12']);
  map.setPaintProperty('hot', 'circle-opacity', ['interpolate', ['linear'], ['-', T, ['get', 't']], 0, 0.95, 7 * 86400e3, 0.55]);
  // the latest mapped perimeter at T, older ones faint
  map.setFilter('perim-line', ['<=', ['get', 't'], T]);
  map.setFilter('perim-fill', ['<=', ['get', 't'], T]);
  map.setPaintProperty('perim-line', 'line-opacity', ['case', ['==', ['get', 't'], latestAt(T)], 0.95, 0.25]);
  map.setPaintProperty('perim-fill', 'fill-opacity', ['case', ['==', ['get', 't'], latestAt(T)], 0.14, 0.0]);
  map.setFilter('derived-line', ['==', ['get', 't'], latestDerivedAt(T)]);
  $('tNow').textContent = fmtDate(T);
  $('scrub').value = Math.round(1000 * (T - S.t0) / Math.max(1, S.t1 - S.t0));
  drawChart();
}
function latestAt(T) { let b = -1; for (const f of S.perimFeats || []) if (f.properties.t <= T && f.properties.t > b) b = f.properties.t; return b; }
function latestDerivedAt(T) { let b = -1; for (const f of S.derivedFeats || []) if (f.properties.t <= T && f.properties.t > b) b = f.properties.t; return b; }

/* ------------------------------------------------------------------ case fires */
async function loadIndex() {
  const idx = await (await fetch(FIRES + 'index.json')).json();
  const lidarBadge = (l) => ({ 'pre,post': 'LiDAR before + after', pre: 'LiDAR before', post: 'LiDAR after' }[Object.keys(l).sort().reverse().join(',')] || '');
  $('fireList').innerHTML = idx.map((f) => `<button type="button" class="fire" data-slug="${f.slug}" data-tip="${esc(f.name)}|${esc(f.why)}">
      <b>${esc(f.name.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()))}</b><em>${lidarBadge(f.lidar)}</em>
      <span>${esc(f.where)} · ${f.discovered?.slice(0, 4)} · ${Math.round(f.acres).toLocaleString()} acres</span></button>`).join('');
  $('fireList').addEventListener('click', (e) => { const b = e.target.closest('.fire'); if (b) openFire(b.dataset.slug); });
  openFire(params.get('fire') && idx.some((f) => f.slug === params.get('fire')) ? params.get('fire') : idx[0].slug, true);
}

async function openFire(slug, first) {
  for (const b of document.querySelectorAll('#fireList .fire')) b.classList.toggle('on', b.dataset.slug === slug);
  loading(true, 0.1);
  const base = FIRES + slug + '/';
  const [m, b] = await Promise.all([fetch(base + 'manifest.json').then((r) => r.json()), fetch(base + 'bundle.json').then((r) => r.json())]);
  S.fire = slug; S.manifest = m; S.bundle = b; S.lidar = {};
  history.replaceState(null, '', '?fire=' + slug);
  // perimeters: mapped vs traced-from-detections
  const feats = b.perimeters.map((f) => ({ ...f, properties: { ...f.properties, t: Date.parse(f.properties.t) } }));
  S.perimFeats = feats.filter((f) => f.properties.source !== 'VIIRS_DERIVED');
  S.derivedFeats = feats.filter((f) => f.properties.source === 'VIIRS_DERIVED');
  map.getSource('perims').setData({ type: 'FeatureCollection', features: S.perimFeats });
  map.getSource('derived').setData({ type: 'FeatureCollection', features: S.derivedFeats });
  const cols = b.hotspot_columns;
  const iS = cols.indexOf('sensor'), iT = cols.indexOf('time'), iX = cols.indexOf('lon'), iY = cols.indexOf('lat'), iF = cols.indexOf('frp_mw'), iC = cols.indexOf('confidence');
  S.hot = b.hotspots.map((h) => ({ s: h[iS], t: Date.parse(h[iT]), x: h[iX], y: h[iY], f: h[iF], c: h[iC] }));
  map.getSource('hot').setData({ type: 'FeatureCollection', features: S.hot.map((h) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.x, h.y] }, properties: { t: h.t, frp: h.f, s: h.s } })) });
  const ig = b.event.ignition_est;
  map.getSource('ign').setData(ig ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: ig, properties: {} }] } : emptyFC());
  // time range: discovery (or first detection) to the last detection / perimeter
  // play from discovery to when 98 % of detections had happened (capped a few days after containment)
  const ts = S.hot.map((h) => h.t).sort((a, b2) => a - b2);
  const disc = Date.parse(m.discovered);
  S.t0 = Math.min(disc, ts[0] ?? disc) - 6 * 3600e3;
  const p98 = ts[Math.floor(ts.length * 0.98)] ?? disc + 86400e3;
  S.t1 = m.contained ? Math.min(p98, Date.parse(m.contained) + 5 * 86400e3) : p98;
  if (S.t1 <= S.t0) S.t1 = S.t0 + 86400e3;
  // final perimeters are sometimes dated by a later edit (years after the fire): show them at the end of the fire
  for (const f of S.perimFeats) if (f.properties.t > S.t1) f.properties.t = S.t1;
  map.getSource('perims').setData({ type: 'FeatureCollection', features: S.perimFeats });
  // few mapped perimeters (2020-21 fires) -> the progression traced from VIIRS is the best record of the spread
  const useDerived = S.perimFeats.length < 5 && S.derivedFeats.length > 0;
  document.querySelector('[data-l=derived]').checked = useDerived;
  map.setLayoutProperty('derived-line', 'visibility', useDerived ? 'visible' : 'none');
  buildChart();
  // raster overlays and LiDAR choices
  setupOverlays(m);
  S.front = await loadFront(m).catch(() => null);
  setupFront(m);
  const det = document.querySelector('[data-l=hotspots]');
  det.checked = !S.front;                               // the front replaces the dots; they stay one click away
  for (const id of ['hot', 'hot-glow']) map.setLayoutProperty(id, 'visibility', det.checked ? 'visible' : 'none');
  const lid = Object.keys(m.lidar).filter((k) => k !== 'diff');
  $('lidarSel').innerHTML = '<option value="">Off</option>' + lid.map((p) => `<option value="${p}">${p === 'pre' ? 'Before' : 'After'} ${m.lidar[p].year}, whole burn</option>`).join('')
    + (m.detail ? lid.filter((p) => m.detail[p]).map((p) => `<option value="detail_${p}">${p === 'pre' ? 'Before' : 'After'} ${m.lidar[p].year}, full detail 2.5 km</option>`).join('') : '');
  $('chmSel').innerHTML = '<option value="">Off</option>' + lid.map((p) => `<option value="chm_${p}">${p === 'pre' ? 'Height before' : 'Height after'} (${m.lidar[p].year})</option>`).join('') + (m.lidar.diff ? '<option value="chm_diff">Change (after − before)</option>' : '');
  $('imgSel').querySelectorAll('option').forEach((o) => { o.disabled = !!o.value && !m.files.includes(o.value + (o.value === 'dnbr' ? '.png' : '.jpg')); });
  renderInfo();
  const [w, s, e, n] = m.bounds;
  map.fitBounds([[w, s], [e, n]], { padding: pad(), pitch: 58, bearing: -20, duration: first ? 0 : 2200 });
  setPhase('during');
  if (first && params.get('t')) { stop(); setTime(Math.min(S.t1, Math.max(S.t0, Date.parse(params.get('t'))))); }   // shareable moment: ?t=2020-09-08T04:00Z
  if (first && params.get('cam')) {                    // shareable view: &cam=lon,lat,zoom,tilt,heading
    const [lon, lat, zoom, pitch, bearing] = params.get('cam').split(',').map(Number);
    map.jumpTo({ center: [lon, lat], zoom, pitch: pitch || 60, bearing: bearing || 0 });
  }
  loading(false);
}

/* ------------------------------------------------------------------ fire front */
// Reconstructed fire front, painted on a canvas draped over the terrain.
// arrival.png holds, for every cell of the burn, when the fire reached it (built from satellite
// detections and mapped perimeters by export/arrival.py). At time T each cell is coloured by how long
// ago it ignited: faint pre-heating ahead of the front, flickering flame at the front, embers that
// cool behind it, then charred ground.
const FRONT = {
  preheatH: 0.4,        // glow just ahead of the flames
  flameH: 1.1,          // flaming zone behind the leading edge
  emberH: 3.5,          // hours of glowing embers (longer where burn severity was high)
  raggedH: 0.6,         // how far noise shifts the arrival (hours): roughens the edge into fingers
};

function hash2(x, y) {                              // repeatable pseudo-random value in [0, 1)
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, scale) {                  // smooth noise in [0, 1)
  const gx = x / scale, gy = y / scale, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

async function loadFront(m) {
  if (!m.arrival || !m.files.includes('arrival.png')) return null;
  const img = new Image();
  img.src = FIRES + S.fire + '/arrival.png';
  await img.decode();
  const { nx, ny, unit_s } = m.arrival;
  const src = document.createElement('canvas'); src.width = nx; src.height = ny;
  const g = src.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, nx, ny).data;
  const t0 = Date.parse(m.arrival.t0);
  const arrival = new Float64Array(nx * ny).fill(NaN);   // ms since epoch, NaN = outside the burn
  const grain = new Float32Array(nx * ny);               // per-cell texture (ash, ember sparkle)
  for (let i = 0; i < nx * ny; i++) {
    if (px[i * 4 + 2] === 0) continue;
    const x = i % nx, y = (i / nx) | 0;
    const ragged = (valueNoise(x, y, 9) * 0.65 + valueNoise(x, y, 3) * 0.35 - 0.5) * 2 * FRONT.raggedH * 3600e3;
    arrival[i] = t0 + ((px[i * 4] << 8) | px[i * 4 + 1]) * unit_s * 1000 + ragged;
    grain[i] = valueNoise(x, y, 6) * 0.45 + valueNoise(x, y, 2) * 0.35 + hash2(x, y) * 0.2;
  }
  // burn severity (0 unburned … 1 high) from the dNBR classes, resampled onto the same grid
  const severity = new Float32Array(nx * ny).fill(0.6);
  if (m.files.includes('dnbr.png')) {
    try {
      const dn = new Image(); dn.src = FIRES + S.fire + '/dnbr.png'; await dn.decode();
      g.clearRect(0, 0, nx, ny); g.drawImage(dn, 0, 0, nx, ny);
      const d = g.getImageData(0, 0, nx, ny).data;
      for (let i = 0; i < nx * ny; i++) {
        if (d[i * 4 + 3] < 40) { severity[i] = 0.15; continue; }               // unburned / no change
        const r = d[i * 4], gr = d[i * 4 + 1], b = d[i * 4 + 2];
        severity[i] = gr > r ? 0.05 : Math.max(0.15, Math.min(1, (255 - gr) / 215 + (r < 200 ? 0.15 : 0) - b / 900));
      }
    } catch (e) { /* severity is optional */ }
  }
  const canvas = document.createElement('canvas'); canvas.width = nx; canvas.height = ny;
  return { nx, ny, arrival, grain, severity, canvas, ctx: canvas.getContext('2d'), image: new ImageData(nx, ny) };
}

function paintFront(T, now) {
  const F = S.front; if (!F) return;
  const { nx, ny, arrival, grain, severity, image } = F, out = new Uint32Array(image.data.buffer);
  const t = now / 1000, H = 3600e3;
  const pre = FRONT.preheatH * H, flame = FRONT.flameH * H;
  const rgba = (r, g, b, a) => (a << 24) | (Math.max(0, Math.min(255, b)) << 16) | (Math.max(0, Math.min(255, g)) << 8) | Math.max(0, Math.min(255, r));
  for (let i = 0; i < nx * ny; i++) {
    const a = arrival[i];
    if (!(a === a)) { out[i] = 0; continue; }                 // NaN: outside the burn
    const dt = T - a, sev = severity[i], gr = grain[i];
    if (dt < -pre) { out[i] = 0; continue; }                 // not reached yet
    if (dt < 0) {                                             // pre-heating glow ahead of the flames
      const k = 1 + dt / pre;
      out[i] = rgba(255, 130, 40, 90 * k * k);
      continue;
    }
    if (dt < flame) {                                         // flaming zone: white-yellow edge, orange then red behind
      const k = dt / flame;
      const flick = 0.7 + 0.3 * Math.sin(t * 9 + gr * 47 + (i % nx) * 0.61) * Math.sin(t * 5.7 + gr * 23 + ((i / nx) | 0) * 0.37);
      const hot = Math.max(0, 1 - k * 2.2);                   // the leading third is the hottest
      out[i] = rgba(255, (110 + 140 * hot + 40 * (1 - k)) * flick, (30 + 170 * hot * hot) * flick, 250 - 40 * k);
      continue;
    }
    const emberH = FRONT.emberH * H * (0.35 + 1.1 * sev);     // high-severity ground smoulders longer
    const charR = 120 - 95 * sev, charG = 95 - 75 * sev, charB = 70 - 55 * sev;   // scorched brown … black
    const charA = 70 + 165 * sev;
    const ash = (gr - 0.5) * 34;
    if (dt < flame + emberH) {                                // embers: patchy glow fading into the char
      const k = (dt - flame) / emberH;
      const glow = (1 - k) * (gr > 0.55 ? 1 : 0.25 + 0.5 * gr) * (0.8 + 0.2 * Math.sin(t * 2.3 + gr * 70));
      out[i] = rgba(charR + (230 - charR) * glow, charG + (70 - charG) * glow, charB + (15 - charB) * glow, charA + (235 - charA) * Math.min(1, glow * 1.4));
      continue;
    }
    out[i] = rgba(charR + ash, charG + ash, charB + ash * 0.8, charA);   // burned ground, by severity
  }
  F.ctx.putImageData(image, 0, 0);
}

function setupFront(m) {
  if (map.getLayer('front')) map.removeLayer('front');
  if (map.getSource('front')) map.removeSource('front');
  if (!S.front) return;
  const [w, s, e, n] = m.bounds;
  map.addSource('front', { type: 'canvas', canvas: S.front.canvas, coordinates: [[w, n], [e, n], [e, s], [w, s]], animate: true });
  map.addLayer({ id: 'front', type: 'raster', source: 'front',
    layout: { visibility: document.querySelector('[data-l=front]').checked ? 'visible' : 'none' },
    paint: { 'raster-opacity': 0.95, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, 'derived-line');
  paintFront(S.T, performance.now());
}

// flames keep flickering even when the replay is paused
(function frontLoop() {
  let last = 0;
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (!S.front || S.mode !== 'archive' || now - last < 50) return;
    if (!document.querySelector('[data-l=front]')?.checked) return;
    last = now; paintFront(S.T, now);
  };
  requestAnimationFrame(tick);
})();

function setupOverlays(m) {
  const [w, s, e, n] = m.bounds;
  const coords = [[w, n], [e, n], [e, s], [w, s]];
  for (const id of ['img', 'chm']) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }
  map.addSource('img', { type: 'image', url: FIRES + S.fire + '/' + (m.files.includes('s2_pre.jpg') ? 's2_pre.jpg' : m.files.find((f) => f.endsWith('.png'))), coordinates: coords });
  map.addLayer({ id: 'img', type: 'raster', source: 'img', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.92, 'raster-fade-duration': 0 } }, 'derived-line');
  map.addSource('chm', { type: 'image', url: FIRES + S.fire + '/' + (m.files.find((f) => f.startsWith('chm_')) || 's2_pre.jpg'), coordinates: coords });
  map.addLayer({ id: 'chm', type: 'raster', source: 'chm', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } }, 'derived-line');
  S.coords = coords;
}
function showImage(name) {
  $('imgSel').value = name;
  if (!name) { map.setLayoutProperty('img', 'visibility', 'none'); legend(); return; }
  map.getSource('img').updateImage({ url: FIRES + S.fire + '/' + name + (name === 'dnbr' ? '.png' : '.jpg'), coordinates: S.coords });
  map.setLayoutProperty('img', 'visibility', 'visible');
  map.setPaintProperty('img', 'raster-opacity', name === 'dnbr' ? 0.8 : 0.95);
  legend();
}
function showCHM(name) {
  $('chmSel').value = name;
  if (!name) { map.setLayoutProperty('chm', 'visibility', 'none'); legend(); return; }
  map.getSource('chm').updateImage({ url: FIRES + S.fire + '/' + name + '.png', coordinates: S.coords });
  map.setLayoutProperty('chm', 'visibility', 'visible');
  legend();
}

/* ------------------------------------------------------------------ LiDAR point clouds (deck.gl) */
const R = 6378137;
async function loadLidar(phase) {
  if (S.lidar[phase]) return S.lidar[phase];
  const m = S.manifest, detail = phase.startsWith('detail_');
  const ph = detail ? phase.slice(7) : phase;
  const L = detail ? m.detail[ph] : m.lidar[ph], b = detail ? m.detail.bounds_3857 : m.bounds_3857;
  loading(true, 0.05);
  const res = await fetch(FIRES + S.fire + `/lidar_${phase}.bin`);
  const total = +res.headers.get('content-length') || L.points * 8;
  const reader = res.body.getReader(); const chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; loading(true, got / total); }
  const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  const n = got / 8, dv = new DataView(buf.buffer);
  const pos = new Float32Array(n * 3), col = new Uint8Array(n * 4), z = new Float32Array(n);
  // positions are stored relative to the fire's centre (metres) so float32 keeps centimetre precision
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const lon0 = cx / R * 180 / Math.PI, lat0 = (2 * Math.atan(Math.exp(cy / R)) - Math.PI / 2) * 180 / Math.PI;
  const k = Math.cos(lat0 * Math.PI / 180);           // Web Mercator metres -> true metres near the fire
  for (let i = 0; i < n; i++) {
    const x = b[0] + dv.getUint16(i * 8, true) * L.sx, y = b[1] + dv.getUint16(i * 8 + 2, true) * L.sy;
    z[i] = dv.getUint16(i * 8 + 4, true) / 10 + L.zmin;
    pos[i * 3] = (x - cx) * k; pos[i * 3 + 1] = (y - cy) * k; pos[i * 3 + 2] = z[i];
    const cls = buf[i * 8 + 6], h = buf[i * 8 + 7];
    let r, g, bl;
    if (cls === 2) { r = 168; g = 146; bl = 112; }                       // ground: tan
    else if (cls === 9) { r = 70; g = 120; bl = 170; }                   // water
    else {                                                               // vegetation by height above ground
      const stops = [[0, 190, 176, 120], [2, 196, 204, 96], [8, 120, 176, 70], [20, 52, 140, 62], [40, 22, 96, 58], [65, 10, 66, 52]];
      let k = 1; while (k < stops.length - 1 && h > stops[k][0]) k++;
      const [h0, r0, g0, b0] = stops[k - 1], [h1, r1, g1, b1] = stops[k], u = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
      r = r0 + (r1 - r0) * u; g = g0 + (g1 - g0) * u; bl = b0 + (b1 - b0) * u;
    }
    col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = bl; col[i * 4 + 3] = 255;
  }
  loading(false);
  return (S.lidar[phase] = { n, pos, col, z, origin: [lon0, lat0] });
}
async function showLidar(phase) {
  $('lidarSel').value = phase;
  S.lidarPhase = phase;
  if (!phase) { overlay.setProps({ layers: [] }); legend(); return; }
  const d = await loadLidar(phase);
  const exag = S.exag;
  const zs = new Float32Array(d.pos);                   // apply the same vertical exaggeration as the terrain
  for (let i = 0; i < d.n; i++) zs[i * 3 + 2] = d.pos[i * 3 + 2] * exag;
  overlay.setProps({ layers: [new deck.PointCloudLayer({
    id: 'lidar-' + phase, data: { length: d.n, attributes: { getPosition: { value: zs, size: 3 }, getColor: { value: d.col, size: 4, normalized: true } } },
    coordinateSystem: deck.COORDINATE_SYSTEM.METER_OFFSETS, coordinateOrigin: [d.origin[0], d.origin[1], 0],
    pointSize: phase.startsWith('detail_') ? 1.8 : 1.6, sizeUnits: 'pixels', material: false, opacity: 1, parameters: { depthTest: true } })] });
  legend();
  const when = phase.endsWith('pre') ? 'before' : 'after';
  toast(phase.startsWith('detail_') ? `LiDAR ${when} the fire, full detail over 2.5 km: ${(d.n / 1e6).toFixed(1)} million points. Drag to orbit, right-drag to tilt.`
    : `LiDAR ${when} the fire, thinned over the whole burn: ${(d.n / 1e6).toFixed(1)} million points.`);
}

/* ------------------------------------------------------------------ phases, timeline, chart */
const PHASE_HINT = {
  before: 'The ground before the fire, from Sentinel-2. Drag to look around; switch on LiDAR in step 4 to see the forest in 3D.',
  during: 'The fire front, reconstructed from satellite passes and mapped perimeters: flames at the edge, embers behind, burned ground by severity. Press play, drag the slider, or step pass by pass with ⏮ ⏭.',
  after: 'Burn severity: green = unburned or regrowth, yellow → dark red = low → high severity, from images before and after.',
  canopy: 'Every LiDAR point in a 2.5 km tile, at true height: tan is ground, greens are vegetation by height. Right-drag to orbit.',
};
function setPhase(p) {
  for (const b of document.querySelectorAll('#phaseBtns button')) b.classList.toggle('on', b.dataset.phase === p);
  $('phaseHint').textContent = PHASE_HINT[p] || '';
  const m = S.manifest, has = (f) => m.files.includes(f);
  const lid = Object.keys(m.lidar).filter((k) => k !== 'diff');
  stop();
  if (p === 'before') {
    setTime(S.t0); showImage(has('s2_pre.jpg') ? 's2_pre' : ''); showCHM(''); showLidar('');
  } else if (p === 'after') {
    setTime(S.t1); showImage(has('dnbr.png') ? 'dnbr' : has('s2_post.jpg') ? 's2_post' : ''); showCHM(''); showLidar('');
  } else if (p === 'canopy') {
    // close-up on the burn with the LiDAR point cloud (after if we have it, else before)
    setTime(S.t1); showImage(''); showCHM('');
    const ph = lid.includes('pre') ? 'pre' : lid[0];
    if (m.detail && m.detail[ph]) {
      // true vertical scale for the canopy, so tree heights read correctly
      S.exag = 1; $('exag').value = 1; $('exagOut').textContent = '1.0×'; map.setTerrain({ source: 'dem', exaggeration: 1 });
      showLidar('detail_' + ph);
      const [w, s2, e, n] = m.detail.bounds;
      map.fitBounds([[w, s2], [e, n]], { pitch: 60, bearing: map.getBearing() + 30, padding: pad(), duration: 2600 });
    } else if (ph) showLidar(ph);
  } else {
    showImage(''); showCHM(''); showLidar(''); setTime(S.t0); play();
  }
}
function play() {
  if (S.playing) return stop();
  S.playing = true; $('play').textContent = '❚❚';
  if (S.T >= S.t1) S.T = S.t0;
  let last = performance.now();
  const span = S.t1 - S.t0, dur = 26000;                // whole fire in about 26 s at 1x
  const step = (now) => {
    if (!S.playing) return;
    const dt = now - last; last = now;
    let T = S.T + span * dt / dur * S.speed;
    if (T >= S.t1) { T = S.t1; stop(); }
    setTime(T);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function stop() { S.playing = false; $('play').textContent = '▶'; }

function passTimes() {
  // satellite passes: detections closer than 20 minutes apart belong to the same pass
  const ts = S.hot.map((h) => h.t).sort((a, b) => a - b), out = [];
  for (const t of ts) if (!out.length || t - out[out.length - 1] > 20 * 60e3) out.push(t);
  return out;
}
function stepPass(dir) {
  stop();
  const passes = S.passes || (S.passes = passTimes());
  const next = dir > 0 ? passes.find((t) => t > S.T + 60e3) : [...passes].reverse().find((t) => t < S.T - 60e3);
  if (next != null) setTime(Math.min(S.t1, Math.max(S.t0, next)));
}
function buildChart() {
  S.passes = null;
  // overpasses: detections per 30-minute bin; area: mapped perimeters
  const bins = new Map();
  for (const h of S.hot) { const k = Math.floor(h.t / 1800e3); bins.set(k, (bins.get(k) || 0) + 1); }
  S.bins = [...bins.entries()].map(([k, n]) => [k * 1800e3, n]).sort((a, b) => a[0] - b[0]);
  S.area = (S.perimFeats || []).map((f) => [f.properties.t, f.properties.acres]).sort((a, b) => a[0] - b[0]);
  S.traced = (S.derivedFeats || []).map((f) => [f.properties.t, f.properties.acres]).sort((a, b) => a[0] - b[0]);
}
function drawChart() {
  const cv = $('chart'), dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const x = (t) => (t - S.t0) / (S.t1 - S.t0) * w;
  const maxN = Math.max(1, ...S.bins.map((b) => b[1])), maxA = Math.max(1, ...S.area.map((a) => a[1]), ...S.traced.map((a) => a[1]), S.manifest.acres || 1);
  g.fillStyle = 'rgba(255,107,26,.75)';
  for (const [t, n] of S.bins) { if (t < S.t0 || t > S.t1) continue; const bh = Math.max(1, Math.sqrt(n / maxN) * (h - 6)); g.fillRect(x(t) - 1, h - bh, 2, bh); }
  g.strokeStyle = '#f2d64b'; g.lineWidth = 1.4; g.setLineDash([4, 3]); g.beginPath();
  S.traced.forEach(([t, a], i) => { const px = x(Math.min(t, S.t1)), py = h - 3 - a / maxA * (h - 8); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.stroke(); g.setLineDash([]);
  g.strokeStyle = isDark() ? '#a4ec6e' : '#3a7518'; g.lineWidth = 1.6; g.beginPath();
  S.area.forEach(([t, a], i) => { const px = x(t), py = h - 3 - a / maxA * (h - 8); i ? g.lineTo(px, py) : g.moveTo(px, py); g.fillStyle = g.strokeStyle; g.fillRect(px - 1.5, py - 1.5, 3, 3); });
  g.stroke();
  g.fillStyle = isDark() ? '#ece6d3' : '#1e1f17'; g.fillRect(x(S.T) - 0.5, 0, 1.5, h);
}

function renderInfo() {
  const m = S.manifest, b = S.bundle, e = b.event;
  const sensors = {};
  for (const h of S.hot) sensors[h.s] = (sensors[h.s] || 0) + 1;
  const lid = (p) => m.lidar[p] ? `${m.lidar[p].collection} (${m.lidar[p].year}): canopy mean ${m.lidar[p].chm_mean.toFixed(1)} m, 95th pct ${m.lidar[p].chm_p95.toFixed(0)} m` : '—';
  const diff = m.lidar.diff;
  $('info').innerHTML = `<h4>${esc(m.name)}</h4><p class="why">${esc(m.why)}</p>
    <dl>
      <dt>Discovered</dt><dd>${m.discovered}${m.contained ? ` · contained ${m.contained}` : ''}</dd>
      <dt>Size</dt><dd>${Math.round(m.acres).toLocaleString()} acres${e.cause ? ' · ' + esc(e.cause) : ''}</dd>
      <dt>Detections</dt><dd>${S.hot.length.toLocaleString()} linked: ${Object.entries(sensors).map(([k, v]) => `${k.replace('_', ' ')} ${v.toLocaleString()}`).join(', ')}</dd>
      <dt>Perimeters</dt><dd>${S.perimFeats.length} mapped${S.derivedFeats.length ? `, ${S.derivedFeats.length} traced from VIIRS` : ''}</dd>
      <dt>Ignition</dt><dd>${e.ignition_est_time ? 'first seen from orbit ' + fmtDate(Date.parse(e.ignition_est_time)) : '—'}</dd>
      <dt>LiDAR before</dt><dd>${lid('pre')}</dd>
      <dt>LiDAR after</dt><dd>${lid('post')}</dd>
      ${diff && diff.mean_change_inside_m != null ? `<dt>Canopy change</dt><dd>inside the burn ${diff.mean_change_inside_m.toFixed(1)} m, outside ${diff.mean_change_outside_m?.toFixed(1) ?? '—'} m (both epochs thinned to the same density)</dd>` : ''}
      <dt>Reading LiDAR</dt><dd>LiDAR records structure, including standing dead trees: after a crown fire the snags stay tall until they fall, so compare canopy height with burn severity (dNBR) rather than reading tall canopy as unburned.</dd>
      ${m.imagery?.pre ? `<dt>Sentinel-2</dt><dd>before ${m.imagery.pre.date}${m.imagery.post ? ', after ' + m.imagery.post.date : ''}</dd>` : ''}
    </dl>`;
}

function legend() {
  const parts = [];
  if (S.mode === 'archive' && S.front && document.querySelector('[data-l=front]').checked) parts.push('<div><i class="lg-ramp front"></i>flames → embers → burned</div>');
  if (S.mode === 'archive') parts.push('<div><i class="lg-ramp hot"></i>detections: just seen → days old</div><div><i class="lg-line"></i>mapped perimeter</div>');
  const img = $('imgSel').value, chm = $('chmSel').value;
  if (img === 'dnbr') parts.push('<div><i class="lg-ramp dnbr"></i>burn severity: low → high (dNBR)</div>');
  if (chm === 'chm_diff') parts.push('<div><i class="lg-ramp diff"></i>canopy lost ← → gained</div>');
  else if (chm) parts.push('<div><i class="lg-ramp chm"></i>canopy height 0 → 50 m</div>');
  if (S.lidarPhase) parts.push('<div><i class="lg-ramp pts"></i>LiDAR: ground · shrubs · trees 8 m · 20 m · 40 m+</div>');
  if (S.mode === 'live') parts.push('<div><i class="lg-dot viirs"></i>VIIRS fire pixel</div><div><i class="lg-line"></i>current perimeter</div>');
  $('legend').innerHTML = parts.join('');
}

/* ------------------------------------------------------------------ live mode */
async function loadLive() {
  const U = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query';
  const q = '?where=poly_GISAcres%3E%3D100&outFields=poly_IncidentName,poly_GISAcres,poly_PolygonDateTime,attr_POOState,attr_PercentContained&outSR=4326&f=geojson&geometryPrecision=5';
  try {
    const fc = await (await fetch(U + q)).json();
    for (const f of fc.features) { const p = f.properties; f.properties = { name: p.poly_IncidentName, acres: p.poly_GISAcres, t: p.poly_PolygonDateTime, state: (p.attr_POOState || '').replace('US-', ''), contained: p.attr_PercentContained }; }
    fc.features.sort((a, b) => b.properties.acres - a.properties.acres);
    map.getSource('live-perims').setData(fc);
    S.liveList = fc.features;
    $('liveList').innerHTML = fc.features.slice(0, 40).map((f, i) => `<button type="button" class="fire" data-i="${i}"><b>${esc(f.properties.name)}</b><span>${f.properties.state} · ${Math.round(f.properties.acres).toLocaleString()} acres · ${f.properties.contained ?? '?'}% contained</span><span>mapped ${fmtDate(f.properties.t)}</span></button>`).join('') || '<p class="sub">No active perimeters right now.</p>';
    $('liveNote').textContent = `${fc.features.length} fires of 100+ acres with a current perimeter (NIFC WFIGS), largest first.`;
  } catch (e) { $('liveList').innerHTML = '<p class="sub">Could not reach NIFC right now.</p>'; }
}
function liveLayers() {
  const day = $('liveDate').value;
  for (const id of ['viirs20', 'viirs21', 'goes']) { if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); }
  if (S.mode !== 'live') return;
  if ($('liveViirs').checked) {
    for (const [id, layer] of [['viirs20', 'VIIRS_NOAA20_Thermal_Anomalies_375m_All'], ['viirs21', 'VIIRS_NOAA21_Thermal_Anomalies_375m_All']]) {
      map.addSource(id, { type: 'raster', tiles: [`${GIBS_WMS}&LAYERS=${layer}&TIME=${day}`], tileSize: 256, attribution: 'NASA GIBS / FIRMS' });
      map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.95, 'raster-resampling': 'nearest' } }, 'live-fill');
    }
  }
  if ($('liveGoes').checked) {
    map.addSource('goes', { type: 'raster', tiles: [`${GIBS_WMS}&LAYERS=GOES-West_ABI_FireTemp,GOES-East_ABI_FireTemp`], tileSize: 256, attribution: 'NASA GIBS / NOAA GOES' });
    map.addLayer({ id: 'goes', type: 'raster', source: 'goes', paint: { 'raster-opacity': 0.8 } }, 'live-fill');
  }
  const vis = $('livePerims').checked ? 'visible' : 'none';
  map.setLayoutProperty('live-fill', 'visibility', vis); map.setLayoutProperty('live-line', 'visibility', vis);
}

function setMode(mode) {
  S.mode = mode; stop();
  for (const b of document.querySelectorAll('.modes button')) b.classList.toggle('on', b.dataset.mode === mode);
  $('pane-archive').classList.toggle('on', mode === 'archive'); $('pane-live').classList.toggle('on', mode === 'live');
  const arch = mode === 'archive' ? 'visible' : 'none';
  for (const id of ['perim-fill', 'perim-line', 'hot', 'hot-glow', 'ign']) map.setLayoutProperty(id, 'visibility', arch);
  if (map.getLayer('front')) map.setLayoutProperty('front', 'visibility', mode === 'archive' && document.querySelector('[data-l=front]').checked ? 'visible' : 'none');
  if (map.getLayer('img')) { map.setLayoutProperty('img', 'visibility', mode === 'archive' && $('imgSel').value ? 'visible' : 'none'); map.setLayoutProperty('chm', 'visibility', mode === 'archive' && $('chmSel').value ? 'visible' : 'none'); }
  if (mode === 'live') { overlay.setProps({ layers: [] }); if (!S.liveList.length) loadLive(); map.flyTo({ center: [-114, 42], zoom: 4.6, pitch: 30, bearing: 0, duration: 1800 }); }
  else if (S.lidarPhase) showLidar(S.lidarPhase);
  liveLayers(); legend();
}

/* ------------------------------------------------------------------ UI wiring */
function wire() {
  document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('phaseBtns').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPhase(b.dataset.phase); });
  $('play').addEventListener('click', play);
  $('speed').addEventListener('change', (e) => { S.speed = +e.target.value; });
  $('scrub').addEventListener('input', (e) => { stop(); setTime(S.t0 + (+e.target.value / 1000) * (S.t1 - S.t0)); });
  $('imgSel').addEventListener('change', (e) => showImage(e.target.value));
  $('chmSel').addEventListener('change', (e) => showCHM(e.target.value));
  $('lidarSel').addEventListener('change', (e) => showLidar(e.target.value));
  $('exag').addEventListener('input', (e) => {
    S.exag = +e.target.value; $('exagOut').textContent = S.exag.toFixed(1) + '×';
    map.setTerrain({ source: 'dem', exaggeration: S.exag });
    if (S.lidarPhase) { clearTimeout(wire.t); wire.t = setTimeout(() => showLidar(S.lidarPhase), 150); }
  });
  for (const cb of document.querySelectorAll('#layers input[type=checkbox]')) cb.addEventListener('change', () => {
    const on = cb.checked ? 'visible' : 'none', l = cb.dataset.l;
    if (l === 'hotspots') { map.setLayoutProperty('hot', 'visibility', on); map.setLayoutProperty('hot-glow', 'visibility', on); }
    if (l === 'front' && map.getLayer('front')) map.setLayoutProperty('front', 'visibility', on);
    if (l === 'front') legend();
    if (l === 'perims') { map.setLayoutProperty('perim-line', 'visibility', on); map.setLayoutProperty('perim-fill', 'visibility', on); }
    if (l === 'derived') map.setLayoutProperty('derived-line', 'visibility', on);
    if (l === 'ignition') map.setLayoutProperty('ign', 'visibility', on);
  });
  const today = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  $('liveDate').value = today; $('liveDate').max = new Date().toISOString().slice(0, 10);
  for (const id of ['liveViirs', 'liveGoes', 'livePerims', 'liveDate']) $(id).addEventListener('change', liveLayers);
  $('liveList').addEventListener('click', (e) => {
    const b = e.target.closest('.fire'); if (!b) return;
    const f = S.liveList[+b.dataset.i]; const bb = bbox(f.geometry);
    map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: pad(), pitch: 55, duration: 2000, maxZoom: 12 });
  });
  $('collapse').addEventListener('click', () => document.body.classList.add('collapsed'));
  $('reopen').addEventListener('click', () => document.body.classList.remove('collapsed'));
  $('themeBtn').addEventListener('click', () => {
    const d = !isDark(); document.documentElement.classList.toggle('dark-mode', d);
    try { localStorage.setItem('quake-viz-theme', d ? 'dark' : 'light'); } catch (e) { /* ignore */ }
    drawChart();
  });
  $('stepBack').addEventListener('click', () => stepPass(-1));
  $('stepFwd').addEventListener('click', () => stepPass(1));
  $('chart').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect(); stop();
    setTime(S.t0 + (e.clientX - r.left) / r.width * (S.t1 - S.t0));
  });
  wireCamera();
  wireTooltips();
  wireHelp();
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const actions = {
      ' ': play, ',': () => stepPass(-1), '.': () => stepPass(1),
      q: () => camStep('rotL'), e: () => camStep('rotR'), r: () => camStep('tiltUp'), f: () => camStep('tiltDown'),
      t: () => camStep('top'), v: () => camStep('persp'), n: () => camStep('north'), o: () => camStep('orbit'), Home: () => camStep('frame'),
      h: () => $('help').classList.toggle('open'), '\\': () => document.body.classList.toggle('collapsed'),
      Escape: () => $('help').classList.remove('open'),
    };
    if (actions[k]) { e.preventDefault(); actions[k](); }
  });
  addEventListener('resize', drawChart);
}
/* ------------------------------------------------------------------ camera dock */
// Every camera button does a smooth step on click, and keeps moving while held down.
const CAM_STEP = { rotL: { bearing: -22.5 }, rotR: { bearing: 22.5 }, tiltUp: { pitch: 12 }, tiltDown: { pitch: -12 }, zoomIn: { zoom: 0.7 }, zoomOut: { zoom: -0.7 } };
const CAM_RATE = { rotL: { bearing: -70 }, rotR: { bearing: 70 }, tiltUp: { pitch: 35 }, tiltDown: { pitch: -35 }, zoomIn: { zoom: 1.2 }, zoomOut: { zoom: -1.2 } };  // per second

function camStep(action) {
  stopOrbit(action === 'orbit');
  const d = CAM_STEP[action];
  if (d) {
    map.easeTo({ bearing: map.getBearing() + (d.bearing || 0), pitch: clampPitch(map.getPitch() + (d.pitch || 0)), zoom: map.getZoom() + (d.zoom || 0), duration: 450, easing: easeOut });
    return;
  }
  if (action === 'top') map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
  if (action === 'persp') map.easeTo({ pitch: 60, duration: 900 });
  if (action === 'north') map.easeTo({ bearing: 0, duration: 700 });
  if (action === 'orbit') toggleOrbit();
  if (action === 'frame') frameView();
}
const easeOut = (t) => 1 - (1 - t) ** 3;
const clampPitch = (p) => Math.max(0, Math.min(82, p));

function holdMove(action) {
  const rate = CAM_RATE[action]; if (!rate) return () => {};
  let last = performance.now(), live = true;
  const tick = (now) => {
    if (!live) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    map.jumpTo({ bearing: map.getBearing() + (rate.bearing || 0) * dt, pitch: clampPitch(map.getPitch() + (rate.pitch || 0) * dt), zoom: map.getZoom() + (rate.zoom || 0) * dt });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { live = false; };
}

let orbitOn = false;
function toggleOrbit() {
  orbitOn = !orbitOn;
  document.querySelector('[data-cam=orbit]').classList.toggle('on', orbitOn);
  if (!orbitOn) return;
  if (map.getPitch() < 35) map.easeTo({ pitch: 55, duration: 600 });
  let last = performance.now();
  const spin = (now) => {
    if (!orbitOn) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    map.setBearing(map.getBearing() + 9 * dt);       // a full circle in 40 s
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
}
function stopOrbit(keep) { if (orbitOn && !keep) toggleOrbit(); }

function frameView() {
  if (S.mode === 'live') return map.flyTo({ center: [-114, 42], zoom: 4.6, pitch: 30, bearing: 0, duration: 1600 });
  const [w, s, e, n] = S.manifest.bounds;
  map.fitBounds([[w, s], [e, n]], { padding: pad(), pitch: 55, bearing: -20, duration: 1600 });
}

function wireCamera() {
  for (const b of document.querySelectorAll('[data-cam]')) {
    const action = b.dataset.cam;
    let timer = null, stopHold = null;
    b.addEventListener('pointerdown', (e) => {
      if (!CAM_RATE[action]) return;
      e.preventDefault(); b.setPointerCapture(e.pointerId);
      timer = setTimeout(() => { timer = null; stopOrbit(); b.classList.add('held'); stopHold = holdMove(action); }, 220);
    });
    const release = () => {
      if (timer) { clearTimeout(timer); timer = null; camStep(action); }    // short press: one smooth step
      if (stopHold) { stopHold(); stopHold = null; b.classList.remove('held'); }
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('click', (e) => { if (!CAM_RATE[action] && e.detail !== -1) camStep(action); });
    b.addEventListener('keydown', (e) => { if (CAM_RATE[action] && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); camStep(action); } });
  }
  // the user grabbing the map stops the orbit
  for (const ev of ['mousedown', 'touchstart', 'wheel']) map.getCanvas().addEventListener(ev, () => stopOrbit(), { passive: true });
  const read = () => {
    const b = ((map.getBearing() % 360) + 360) % 360;
    $('needle').style.transform = `rotate(${-map.getBearing()}deg)`;
    $('camRead').innerHTML = `heading ${Math.round(b)}°<br>tilt ${Math.round(map.getPitch())}° · z${map.getZoom().toFixed(1)}`;
  };
  map.on('move', read); read();
}

/* ------------------------------------------------------------------ tooltips and help */
// Any element with data-tip="Title|Explanation" gets a tooltip on hover, keyboard focus or long-press.
function wireTooltips() {
  const tip = $('tip');
  let current = null, press = null;
  const show = (el) => {
    const [title, body] = el.dataset.tip.split('|');
    tip.innerHTML = `<b>${esc(title)}</b>${body ? esc(body) : ''}`;
    tip.classList.add('show');
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    if (r.left > innerWidth * 0.6) { x = r.left - tw - 10; y = r.top + r.height / 2 - th / 2; }   // dock: tooltip to the left
    tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, x)) + 'px';
    tip.style.top = Math.max(8, Math.min(innerHeight - th - 8, y)) + 'px';
    current = el;
  };
  const hide = () => { tip.classList.remove('show'); current = null; };
  document.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType === 'mouse') show(el); else if (!el && current) hide(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', (e) => {
    hide();
    const el = e.target.closest('[data-tip]');
    if (el && e.pointerType === 'touch') press = setTimeout(() => show(el), 500);
  });
  document.addEventListener('pointerup', () => { clearTimeout(press); if (current && document.activeElement !== current) setTimeout(hide, 1600); });
}

function wireHelp() {
  const help = $('help');
  $('helpBtn').addEventListener('click', () => help.classList.add('open'));
  $('helpClose').addEventListener('click', () => help.classList.remove('open'));
  help.addEventListener('click', (e) => { if (e.target === help) help.classList.remove('open'); });
  let seen = false;
  try { seen = localStorage.getItem('fa-help-seen') === '1'; localStorage.setItem('fa-help-seen', '1'); } catch (e) { /* storage unavailable */ }
  if (!seen && !params.has('nohelp')) setTimeout(() => help.classList.add('open'), 1200);
}

function pad() {   // keep the fire clear of the panel: left on desktop, bottom sheet on phones
  return window.innerWidth > 760 ? { left: 420, right: 40, top: 60, bottom: 60 } : { left: 20, right: 20, top: 40, bottom: Math.round(window.innerHeight * 0.55) };
}
function bbox(geom) {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = (c) => { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); };
  walk(geom.coordinates); return [w, s, e, n];
}

map.on('load', () => { addFireLayers(); wire(); legend(); loadIndex().catch((e) => { console.error(e); toast('Could not load the case fires.'); loading(false); }); });
})();
