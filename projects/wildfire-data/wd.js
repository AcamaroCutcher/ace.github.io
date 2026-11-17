// Fire Archive guide page: hero animation, satellite chart, overpass timeline, schema diagram,
// linking demo, model recipes and the 20 proposal questions.
import { noise3, tuner, reveal, theme, $, REDUCED, isDark } from './shared.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SENSOR_COLOR = { VIIRS_SNPP: '#ffb04a', VIIRS_NOAA20: '#ff6a1f', VIIRS_NOAA21: '#e0442f', MODIS_TERRA: '#5cc8ff', MODIS_AQUA: '#7d7bff', GOES: '#c08cff', FIRESAT: '#ffd84a' };

/* ------------------------------------------------------------------ hero: fire seen by satellite pixels */
function hero() {
  const cv = $('heroCanvas'); if (!cv) return;
  const g = cv.getContext('2d');
  let W, H, dpr, cell, nx, ny, fuel, state, age, seen, t = 0, pass = 0, sweep = -1, visible = true;
  const PASS_EVERY = 3.2;                              // seconds between overpasses
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 700 ? 8 : 11; nx = Math.ceil(W / cell); ny = Math.ceil(H / cell);
    fuel = new Float32Array(nx * ny); state = new Uint8Array(nx * ny); age = new Float32Array(nx * ny); seen = new Float32Array(nx * ny).fill(-1);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) fuel[j * nx + i] = 0.55 + 0.45 * noise3(i / 18, j / 18, 3.1);
    ignite();
  }
  function ignite() {
    state.fill(0); age.fill(0); seen.fill(-1); pass = 0; t = 0;
    for (const [fx, fy] of [[0.78, 0.42], [0.86, 0.72]]) {
      const i0 = Math.floor(nx * fx), j0 = Math.floor(ny * fy);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) state[(j0 + dj) * nx + i0 + di] = 1;
    }
  }
  const idx = (i, j) => j * nx + i;
  function step(dt) {
    // burning cells ignite neighbours; wind from the east-north-east pushes the fire west-south-west
    const next = state.slice();
    const wind = [-0.9, 0.35];
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = idx(i, j);
      if (state[k] === 1) { age[k] += dt; if (age[k] > 2.8) next[k] = 2; continue; }
      if (state[k] !== 0) continue;
      let p = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        if (state[idx(i - di, j - dj)] === 1) p += 0.05 * fuel[k] * (1 + 1.6 * Math.max(0, (di * wind[0] + dj * wind[1]) / Math.hypot(di, dj)));
      }
      if (p && Math.random() < p * dt * 6) next[k] = 1;
    }
    state = next;
  }
  function overpass() {
    pass++; sweep = 0;
    for (let k = 0; k < state.length; k++) if (state[k] === 1 && seen[k] < 0) seen[k] = pass;
  }
  function draw() {
    const dark = isDark();
    g.clearRect(0, 0, W, H);
    // contour-ish terrain
    g.strokeStyle = dark ? 'rgba(92,200,255,.10)' : 'rgba(26,111,168,.14)'; g.lineWidth = 1;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const v = fuel[idx(i, j)] * 10;
      if (Math.floor(v) !== Math.floor(fuel[idx(Math.min(nx - 1, i + 1), j)] * 10)) { g.beginPath(); g.moveTo((i + 1) * cell, j * cell); g.lineTo((i + 1) * cell, (j + 1) * cell); g.stroke(); }
      if (j + 1 < ny && Math.floor(v) !== Math.floor(fuel[idx(i, j + 1)] * 10)) { g.beginPath(); g.moveTo(i * cell, (j + 1) * cell); g.lineTo((i + 1) * cell, (j + 1) * cell); g.stroke(); }
    }
    // detected pixels, coloured by how many passes ago they were first seen
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const s = seen[idx(i, j)]; if (s < 0) continue;
      const ageP = pass - s;
      const c = ageP === 0 ? 'rgba(255,243,166,.95)' : ageP === 1 ? 'rgba(255,154,31,.85)' : ageP < 4 ? 'rgba(224,68,47,.65)' : (dark ? 'rgba(155,30,90,.45)' : 'rgba(155,30,90,.3)');
      g.fillStyle = c; g.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
    }
    // perimeter around everything detected so far (outline of the detected-cell mask)
    g.strokeStyle = dark ? 'rgba(255,122,26,.95)' : 'rgba(201,80,13,.95)'; g.lineWidth = 1.6; g.beginPath();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const on = seen[idx(i, j)] >= 0; if (!on) continue;
      if (i === 0 || seen[idx(i - 1, j)] < 0) { g.moveTo(i * cell, j * cell); g.lineTo(i * cell, (j + 1) * cell); }
      if (i === nx - 1 || seen[idx(i + 1, j)] < 0) { g.moveTo((i + 1) * cell, j * cell); g.lineTo((i + 1) * cell, (j + 1) * cell); }
      if (j === 0 || seen[idx(i, j - 1)] < 0) { g.moveTo(i * cell, j * cell); g.lineTo((i + 1) * cell, j * cell); }
      if (j === ny - 1 || seen[idx(i, j + 1)] < 0) { g.moveTo(i * cell, (j + 1) * cell); g.lineTo((i + 1) * cell, (j + 1) * cell); }
    }
    g.stroke();
    // the swath of the passing satellite
    if (sweep >= 0) {
      const y = sweep * (H + 200) - 100;
      const grd = g.createLinearGradient(0, y - 90, 0, y + 10);
      grd.addColorStop(0, 'rgba(92,200,255,0)'); grd.addColorStop(1, dark ? 'rgba(92,200,255,.22)' : 'rgba(26,111,168,.18)');
      g.fillStyle = grd; g.fillRect(0, y - 90, W, 100);
      g.fillStyle = dark ? 'rgba(92,200,255,.85)' : 'rgba(26,111,168,.85)'; g.fillRect(0, y, W, 1.5);
    }
    const hc = $('heroClock'); if (hc) hc.textContent = `pass ${String(pass).padStart(2, '0')} · t+${String(pass * 12).padStart(2, '0')} h`;
  }
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!REDUCED) { t += dt; acc += dt; step(dt); if (acc > PASS_EVERY) { acc = 0; overpass(); } if (sweep >= 0) { sweep += dt * 0.9; if (sweep > 1) sweep = -1; } }
    let burning = 0, total = 0; for (let k = 0; k < state.length; k++) { if (state[k]) total++; if (state[k] === 1) burning++; }
    if (total > state.length * 0.45 || (burning === 0 && t > 4)) ignite();
    draw();
  }
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv);
  layout(); addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 200); });
  if (REDUCED) { for (let k = 0; k < 400; k++) step(0.05); overpass(); }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ satellites */
const SATS = [
  { id: 'viirs', name: 'VIIRS (NOAA-20, NOAA-21)', kind: 'heat', res: 375, revisit: 12 * 60, label: 'VIIRS',
    what: '375 m fire detections from the I-bands (VJ114IMG / VJ214IMG, Collection 2), plus 750 m M-band products. Each detection carries brightness temperatures, fire radiative power (FRP), confidence (low / nominal / high) and day/night.',
    when: 'Each satellite passes about twice a day (around 1:30 and 13:30 local time). Near-real-time within 3 hours worldwide; in the US and Canada "real-time" within about 30 minutes and "ultra-real-time" within about a minute.',
    access: 'NASA FIRMS: API (free key, CSV), WMS/WFS, archive downloads. Map tiles via NASA GIBS.',
    note: 'Suomi-NPP stopped on 2 Nov 2026; its archive (2012–2026) stays and is in this database.' },
  { id: 'modis', name: 'MODIS (Terra, Aqua)', kind: 'heat', res: 1000, revisit: 12 * 60, label: 'MODIS',
    what: '1 km fire detections with a confidence percentage (0–100). The longest consistent record: Terra from 2000, Aqua from 2002.',
    when: 'Two satellites, each passing about twice a day. Near-real-time within about 3 hours.',
    access: 'NASA FIRMS (same API and archive as VIIRS).' },
  { id: 'goes', name: 'GOES-18 / GOES-19 ABI', kind: 'heat', res: 2000, revisit: 5, label: 'GOES',
    what: 'Geostationary: watches the same half of the planet continuously. The Fire / Hot Spot Characterization product gives fire power, temperature, area and a confidence mask on a 2 km grid.',
    when: 'Every 5 minutes over the US (every minute in "mesoscale" sectors). GOES-19 replaced GOES-16 as GOES-East on 7 April 2025; GOES-18 is GOES-West.',
    access: 'NOAA open data on AWS (buckets noaa-goes18, noaa-goes19), NetCDF, no key.' },
  { id: 'firesat', name: 'FireSat (Earth Fire Alliance)', kind: 'heat', res: 80, revisit: 12 * 60, revisitFuture: 20, label: 'FireSat',
    what: 'A constellation built for fire: six channels in five bands (red, near-infrared, shortwave, two mid-wave infrared, long-wave infrared), about 80 m pixels across a 1,500 km swath, able to detect fires as small as 5 × 5 m. Products: hotspots, perimeters, progression and fire power.',
    when: 'Three operational satellites launched on 7 July 2026, joining a 2025 test satellite: at least twice a day now, hourly by 2029, and every 20 minutes or less with the planned ~50 satellites.',
    access: 'Licensed by Earth Fire Alliance, a nonprofit (satellites built by Muon Space; Google Research and Google.org are partners). Early-adopter agencies now, including Oregon; non-commercial licences for academic users planned for 2027.',
    note: 'The database has a FireSat sensor row and an ingest adapter ready for when access opens.' },
  { id: 'landsat', name: 'Landsat 8/9 fire detections', kind: 'heat', res: 30, revisit: 8 * 1440, label: 'Landsat',
    what: '30 m active-fire detections from the Landsat 8 and 9 imagers, published by FIRMS for the US and Canada.',
    when: 'Every 8 days for a given place with both satellites, by day.', access: 'NASA FIRMS (LANDSAT_NRT).' },
  { id: 's2', name: 'Sentinel-2 (and Landsat imagery)', kind: 'change', res: 10, revisit: 5 * 1440, label: 'Sentinel-2',
    what: 'Optical imagery for before/after comparison. The near-infrared and shortwave-infrared bands give the Normalized Burn Ratio; the change between before and after (dNBR) maps burn severity.',
    when: 'About every 5 days. Clouds and smoke hide the ground, so the database stores several candidate scenes per phase.',
    access: 'Earth Search STAC (AWS, no key), Microsoft Planetary Computer (STAC + tile server).' },
  { id: 'airborne', name: 'Airborne infrared (NIROPS, FIRIS)', kind: 'heat', res: 5, revisit: 1440, label: 'Aircraft IR',
    what: 'Infrared scanners flown over large fires, usually at night, mapping the heat perimeter, intense and scattered heat and isolated spots. Many official perimeters are drawn from them.',
    when: 'Nightly on large incidents.', access: 'NIROPS data now needs an agency login; many products reach the public as WFIGS perimeters. California FIRIS perimeters are published as a public map layer.' },
  { id: 'lidar', name: 'USGS 3DEP airborne LiDAR', kind: 'structure', res: 1, revisit: 6 * 365 * 1440, label: '3DEP LiDAR',
    what: 'Laser point clouds from aircraft: ground, canopy height and structure at sub-metre detail. Two acquisitions on either side of a fire show exactly what burned.',
    when: 'Project by project, years apart. The database records each collection and which fires it covers before and after.',
    access: 'Entwine point tiles on AWS (usgs-lidar-public) and COPC on Planetary Computer: streamable, no key.' },
  { id: 'gedi', name: 'GEDI and ICESat-2', kind: 'structure', res: 25, revisit: 365 * 1440, label: 'GEDI / ICESat-2',
    what: 'Spaceborne LiDAR samples: GEDI footprints (~25 m) give canopy height, cover and biomass; ICESat-2 ATL08 gives canopy and terrain along tracks. Samples, not a map.',
    when: 'Scattered in space and time.', access: 'NASA Earthdata (login), so loaded by the pipeline.' },
];
const KIND_COL = { heat: '#ff7a1a', change: '#5cc8ff', structure: '#c08cff' };

function satChart() {
  const host = $('satChart'); if (!host) return;
  const Wd = 760, Ht = 380, L = 70, R = 24, T = 18, B = 52;
  const lx = (v) => L + (Math.log10(v) - Math.log10(0.5)) / (Math.log10(4000) - Math.log10(0.5)) * (Wd - L - R);
  const ly = (v) => T + (1 - (Math.log10(v) - Math.log10(2)) / (Math.log10(6 * 365 * 1440) - Math.log10(2))) * (Ht - T - B);
  const xt = [[1, '1 m'], [10, '10 m'], [100, '100 m'], [1000, '1 km']];
  const yt = [[5, '5 min'], [60, '1 h'], [1440, '1 day'], [7 * 1440, '1 week'], [365 * 1440, '1 year']];
  let svg = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Pixel size against revisit time for fire satellites">`;
  for (const [v, s] of xt) svg += `<line class="gl" x1="${lx(v)}" y1="${T}" x2="${lx(v)}" y2="${Ht - B}"/><text class="ax" x="${lx(v)}" y="${Ht - B + 18}" text-anchor="middle">${s}</text>`;
  for (const [v, s] of yt) svg += `<line class="gl" x1="${L}" y1="${ly(v)}" x2="${Wd - R}" y2="${ly(v)}"/><text class="ax" x="${L - 8}" y="${ly(v) + 4}" text-anchor="end">${s}</text>`;
  svg += `<text class="axt" x="${(L + Wd - R) / 2}" y="${Ht - 10}" text-anchor="middle">pixel size (smaller = sees smaller fires) →</text>`;
  svg += `<text class="axt" transform="translate(16 ${(T + Ht - B) / 2}) rotate(-90)" text-anchor="middle">← revisit (how often the same place is seen)</text>`;
  for (const s of SATS) {
    if (s.revisitFuture) svg += `<path class="fut" d="M${lx(s.res)} ${ly(s.revisit)} L${lx(s.res)} ${ly(s.revisitFuture) + 8}"/><circle class="futdot" cx="${lx(s.res)}" cy="${ly(s.revisitFuture)}" r="6"/><text class="lab dim" x="${lx(s.res) + 10}" y="${ly(s.revisitFuture) + 4}">FireSat, full constellation</text>`;
    svg += `<g class="sat" data-id="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}"><circle cx="${lx(s.res)}" cy="${ly(s.revisit)}" r="9" fill="${KIND_COL[s.kind]}"/><text class="lab" x="${lx(s.res) + 13}" y="${ly(s.revisit) + 4}">${s.label}</text></g>`;
  }
  svg += `<g class="leg" transform="translate(${Wd - R - 170} ${T + 6})">${Object.entries({ heat: 'heat (active fire)', change: 'change (imagery)', structure: 'structure (LiDAR)' }).map(([k, v], i) => `<circle cx="6" cy="${i * 18 + 6}" r="5" fill="${KIND_COL[k]}"/><text class="ax" x="16" y="${i * 18 + 10}">${v}</text>`).join('')}</g></svg>`;
  host.innerHTML = svg;
  const show = (id) => {
    const s = SATS.find((x) => x.id === id);
    for (const gEl of host.querySelectorAll('.sat')) gEl.classList.toggle('on', gEl.dataset.id === id);
    $('satCard').innerHTML = `<h4><i style="background:${KIND_COL[s.kind]}"></i>${esc(s.name)}</h4><dl><dt>What</dt><dd>${s.what}</dd><dt>How often</dt><dd>${s.when}</dd><dt>Access</dt><dd>${s.access}</dd>${s.note ? `<dt>Note</dt><dd>${s.note}</dd>` : ''}</dl>`;
  };
  host.addEventListener('click', (e) => { const gEl = e.target.closest('.sat'); if (gEl) show(gEl.dataset.id); });
  host.addEventListener('keydown', (e) => { const gEl = e.target.closest('.sat'); if (gEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(gEl.dataset.id); } });
  show('firesat');
  // cards for the heat sources
  $('satGrid').innerHTML = SATS.filter((s) => s.kind === 'heat').map((s) => `<div class="satbox"><b>${esc(s.name)}</b><span class="spec">${s.res >= 1000 ? s.res / 1000 + ' km' : s.res + ' m'} · ${s.revisit < 60 ? s.revisit + ' min' : s.revisit < 1440 ? Math.round(s.revisit / 60) + ' h' : Math.round(s.revisit / 1440) + ' d'}${s.revisitFuture ? ' → ' + s.revisitFuture + ' min' : ''}</span><p>${s.what}</p></div>`).join('');
}

/* ------------------------------------------------------------------ overpass timeline (real data) */
async function overpasses() {
  const host = $('overpass'); if (!host) return;
  const rows = await (await fetch('data/overpasses-or-2020-09.json')).json();
  const t0 = Date.parse('2020-09-07T19:00Z'), t1 = Date.parse('2020-09-10T19:00Z');
  const Wd = 900, Ht = 230, L = 40, R = 10, T = 14, B = 40;
  const x = (t) => L + (t - t0) / (t1 - t0) * (Wd - L - R);
  const max = Math.max(...rows.map((r) => r[2]));
  const y = (n) => (Ht - B) - Math.sqrt(n / max) * (Ht - B - T);
  let svg = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Fire detections over Oregon, 7 to 10 September 2020, by sensor">`;
  // night shading (local sunset ~19:30 PDT = 02:30 UTC, sunrise ~06:45 PDT = 13:45 UTC)
  for (let d = 0; d < 4; d++) {
    const a = Date.parse(`2020-09-0${7 + d}T02:30Z`) + 86400000 * 0, bb = Date.parse(`2020-09-0${7 + d}T13:45Z`);
    if (bb > t0 && a < t1) svg += `<rect class="night" x="${x(Math.max(a, t0))}" y="${T}" width="${x(Math.min(bb, t1)) - x(Math.max(a, t0))}" height="${Ht - B - T}"/>`;
  }
  for (let h = 0; h <= 72; h += 6) {
    const t = t0 + h * 3600e3, d = new Date(t - 7 * 3600e3);
    svg += `<line class="gl" x1="${x(t)}" y1="${T}" x2="${x(t)}" y2="${Ht - B}"/><text class="ax" x="${x(t)}" y="${Ht - B + 16}" text-anchor="middle">${d.getUTCHours() === 0 ? (d.getUTCMonth() + 1) + '/' + d.getUTCDate() : String(d.getUTCHours()).padStart(2, '0') + ':00'}</text>`;
  }
  for (const [code, ts, n, frp] of rows) {
    const t = Date.parse(ts), col = SENSOR_COLOR[code] || '#999';
    svg += `<rect class="ob" x="${x(t) - 3}" y="${y(n)}" width="6" height="${Ht - B - y(n)}" fill="${col}"><title>${code} · ${new Date(t - 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')} PDT · ${n.toLocaleString()} detections · ${Math.round(frp).toLocaleString()} MW</title></rect>`;
  }
  const leg = ['VIIRS_SNPP', 'VIIRS_NOAA20', 'MODIS_TERRA', 'MODIS_AQUA'];
  svg += leg.map((c, i) => `<g transform="translate(${L + 8 + i * 150} ${Ht - 8})"><rect width="10" height="10" y="-9" fill="${SENSOR_COLOR[c]}"/><text class="ax" x="15">${c.replace('_', ' ')}</text></g>`).join('');
  svg += `<text class="ax dim" x="${Wd - R}" y="${T + 10}" text-anchor="end">shaded = night</text></svg>`;
  host.innerHTML = svg;
}

/* ------------------------------------------------------------------ schema diagram */
const TABLES = {
  fire_event: { x: 300, y: 190, w: 205, cols: ['event_id PK', 'unique_fire_identifier', 'irwin_id · mtbs_id', 'name, incident_type → lk', 'cause_code → lk_cause', 'poo · ignition_est (point)', 'discovered … out_at', 'final_perimeter (multipolygon)', 'final_acres (computed)'],
    why: 'One row per incident, keyed by every ID other sources use (NIFC/IRWIN, MTBS) so anything can be joined. Keeps both the reported point of origin and an ignition point estimated from the earliest satellite detections.' },
  perimeter_obs: { x: 585, y: 40, w: 205, cols: ['event_id FK', 'observed_at', 'source (WFIGS, MTBS, FIRIS, FIRESAT, VIIRS_DERIVED…)', 'map_method', 'geom (multipolygon)', 'acres (computed)'],
    why: 'Every perimeter ever mapped for a fire, from any source. Ordered by time it is the fire\'s progression; perimeters can also be derived from cumulative VIIRS detections when none were mapped.' },
  hotspot: { x: 15, y: 30, w: 205, cols: ['hotspot_id, acq_time PK', 'sensor_id → sensor', 'latitude, longitude → geom', 'scan_km, track_km', 'brightness_k, frp_mw', 'confidence_raw / _pct / _class', 'data_version (SP, NRT, RT, URT)'],
    why: 'Every thermal detection from every satellite, partitioned by month. MODIS keeps its percentage, VIIRS its class; confidence_class puts both on the same three-step scale without inventing numbers.' },
  hotspot_event_link: { x: 15, y: 250, w: 205, cols: ['hotspot_id, acq_time → hotspot', 'event_id → fire_event', 'method', 'distance_m, dt_hours', 'score 0–1'],
    why: 'The table the old design was missing: which fire each detection belongs to, how that was decided and how sure we are. Built by the linking query (section 04).' },
  sensor: { x: 15, y: 420, w: 205, cols: ['sensor_id PK', 'platform, instrument', 'resolution_m', 'first_data, last_data', 'firms_source'],
    why: 'One row per instrument (VIIRS on NOAA-20, MODIS on Aqua, FireSat, GOES-19 …), so "which satellite saw this?" is a join.' },
  scene: { x: 585, y: 250, w: 205, cols: ['event_id FK', 'phase pre / during / post', 'sensor_id', 'acquired_at, cloud_pct', 'stac_item, assets (COG hrefs)'],
    why: 'Optical images before, during and after the fire, by reference: the database stores the STAC item and band URLs, not the pixels.' },
  raster_asset: { x: 585, y: 420, w: 205, cols: ['event_id FK', 'kind (dnbr, chm_diff, fbfm40, dem …)', 'source, vintage', 'href (COG)', 'res_m, stats'],
    why: 'Any raster tied to a fire: burn severity, canopy height before/after and the difference, LANDFIRE fuels, terrain.' },
  event_lidar: { x: 300, y: 440, w: 205, cols: ['event_id FK', 'collection_id FK', 'phase pre / post', 'days_from_fire', 'coverage_frac'],
    why: 'Which LiDAR collection covers which fire, before or after, and how much of the burn it covers.' },
  lidar_collection: { x: 300, y: 580, w: 205, cols: ['collection_id PK', 'name (3DEP work unit)', 'acquired_from/to', 'ept_url, copc_stac', 'points_per_m2, boundary'],
    why: 'All 2,284 USGS 3DEP collections with their outlines and streamable point-cloud URLs.' },
  weather_obs: { x: 585, y: 580, w: 205, cols: ['event_id FK', 'valid_at', 'source (HRRR, RTMA, ASOS)', 'wind_u/v, gust', 'temp_c, rh_pct'],
    why: 'Hourly weather over the fire: the wind is the strongest driver of spread.' },
  lookups: { x: 300, y: 20, w: 205, cols: ['lk_cause (13 causes)', 'lk_incident_type (13)', 'lk_complexity (Type 1–5)', 'lk_fuel_group', 'us_state, us_county (geometry)', 'agency'],
    why: 'Codes with their meanings, loaded from NIFC\'s own definitions; states and counties with outlines from the Census Bureau.' },
};
const EDGES = [['perimeter_obs', 'fire_event'], ['hotspot_event_link', 'fire_event'], ['hotspot_event_link', 'hotspot'], ['hotspot', 'sensor'],
  ['scene', 'fire_event'], ['raster_asset', 'fire_event'], ['event_lidar', 'fire_event'], ['event_lidar', 'lidar_collection'], ['weather_obs', 'fire_event'], ['lookups', 'fire_event']];
function erDiagram() {
  const host = $('erDiagram'); if (!host) return;
  const rh = 15, hh = 22;
  const box = (k) => { const t = TABLES[k]; return { ...t, h: hh + t.cols.length * rh + 8 }; };
  const center = (k) => { const b = box(k); return [b.x + b.w / 2, b.y + b.h / 2]; };
  let svg = '<svg viewBox="0 0 800 720" role="img" aria-label="Database schema diagram">';
  for (const [a, b] of EDGES) { const [x1, y1] = center(a), [x2, y2] = center(b); svg += `<line class="edge${a === 'hotspot_event_link' && b === 'hotspot' ? '' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
  { const [x1, y1] = center('hotspot'), [x2, y2] = center('fire_event'); svg += `<path class="edge st" d="M${x1} ${y1} Q ${(x1 + x2) / 2 + 40} ${(y1 + y2) / 2 - 60} ${x2} ${y2}"/><text class="ax" x="${(x1 + x2) / 2 + 30}" y="${(y1 + y2) / 2 - 38}">space + time</text>`; }
  for (const k of Object.keys(TABLES)) {
    const b = box(k);
    svg += `<g class="tbl-g${k === 'fire_event' ? ' core' : ''}" data-t="${k}" tabindex="0" role="button" aria-label="Table ${k}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4"/><rect class="hd" x="${b.x}" y="${b.y}" width="${b.w}" height="${hh}" rx="4"/><text class="tn" x="${b.x + 8}" y="${b.y + 15}">${k}</text>` +
      b.cols.map((c, i) => `<text class="tc" x="${b.x + 8}" y="${b.y + hh + 13 + i * rh}">${esc(c.length > 33 ? c.slice(0, 32) + '…' : c)}</text>`).join('') + '</g>';
  }
  host.innerHTML = svg + '</svg>';
  const show = (k) => {
    for (const gEl of host.querySelectorAll('.tbl-g')) gEl.classList.toggle('on', gEl.dataset.t === k);
    const t = TABLES[k];
    $('erInfo').innerHTML = `<h4>${k}</h4><p>${t.why}</p><ul class="cols">${t.cols.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ul>`;
  };
  host.addEventListener('click', (e) => { const gEl = e.target.closest('.tbl-g'); if (gEl) show(gEl.dataset.t); });
  host.addEventListener('keydown', (e) => { const gEl = e.target.closest('.tbl-g'); if (gEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(gEl.dataset.t); } });
  show('fire_event');
}

/* ------------------------------------------------------------------ linking demo (interactive) */
// The same rules as link_hotspots() in schema/60_link.sql, applied to one detection you can drag around.
//   1.0  inside a perimeter mapped within 12 h of the detection
//   0.8  inside the final perimeter
//   0.6 × (1 − d / 2 km)  within 2 km of the final perimeter
//   none farther away
const LINK = { finalPath: 'M150,90 C230,40 360,50 420,110 C470,160 450,250 360,280 C270,305 170,270 130,210 C105,170 110,120 150,90Z',
               dailyPath: 'M190,120 C250,90 330,100 360,140 C385,175 360,225 300,235 C240,245 190,215 175,180 C165,150 170,130 190,120Z',
               metresPerUnit: 20, bufferM: 2000, mappedAtHour: 14 };

function scoreDetection(x, y, hour, shapes) {
  const pt = new DOMPoint(x, y);
  const insideDaily = shapes.daily.isPointInFill(pt);
  const insideFinal = shapes.final.isPointInFill(pt);
  const sameTime = Math.abs(hour - LINK.mappedAtHour) <= 12;
  if (insideDaily && sameTime) return { score: 1.0, rule: 'inside a perimeter mapped within 12 hours', dist: 0 };
  if (insideFinal) return { score: 0.8, rule: 'inside the final perimeter', dist: 0 };
  const dist = distanceToPath(shapes.final, x, y) * LINK.metresPerUnit;
  if (dist <= LINK.bufferM) return { score: 0.6 * (1 - dist / LINK.bufferM), rule: `within 2 km of the perimeter (${Math.round(dist)} m away)`, dist };
  return { score: 0, rule: `${(dist / 1000).toFixed(1)} km from the perimeter: not linked to this fire`, dist };
}

function distanceToPath(path, x, y) {
  const len = path.getTotalLength();
  let best = Infinity;
  for (let s = 0; s <= len; s += 4) { const p = path.getPointAtLength(s); best = Math.min(best, Math.hypot(p.x - x, p.y - y)); }
  return best;
}

function linkDemo() {
  const host = $('linkDemo'); if (!host) return;
  host.innerHTML = `
    <svg viewBox="0 0 700 330" role="img" aria-label="Drag the detection to see how it would be scored">
      <path class="buf" d="${LINK.finalPath}" transform="translate(-30 -26) scale(1.12)"/>
      <path class="fin" id="lkFinal" d="${LINK.finalPath}"/>
      <path class="day" id="lkDaily" d="${LINK.dailyPath}"/>
      <text class="ax" x="500" y="66">2 km buffer</text>
      <text class="ax" x="476" y="128">final perimeter</text>
      <text class="ax" x="206" y="150">mapped 14:00</text>
      <g class="drag" id="lkDot" tabindex="0" role="slider" aria-label="Detection position (arrow keys move it)">
        <circle class="halo" r="16"/><rect x="-8" y="-8" width="16" height="16" class="px s1"/><text class="sc" y="-14" text-anchor="middle"></text>
      </g>
      <text class="ax dim" x="12" y="320">drag the square (a 375 m VIIRS pixel) · arrow keys work too</text>
    </svg>
    <div class="linkctl">
      <label for="lkHour">Seen at</label>
      <input type="range" id="lkHour" min="0" max="47" step="1" value="13" aria-label="Time the detection was seen" />
      <output id="lkHourOut"></output>
    </div>
    <div class="verdict" id="lkVerdict"></div>`;
  const svg = host.querySelector('svg'), dot = $('lkDot'), hour = $('lkHour');
  const shapes = { final: $('lkFinal'), daily: $('lkDaily') };
  let x = 300, y = 205;

  function render() {
    const h = +hour.value;
    const r = scoreDetection(x, y, h, shapes);
    dot.setAttribute('transform', `translate(${x} ${y})`);
    dot.querySelector('rect').setAttribute('class', `px ${r.score >= 1 ? 's1' : r.score >= 0.8 ? 's8' : r.score > 0 ? 's6' : 's0'}`);
    dot.querySelector('text').textContent = r.score ? r.score.toFixed(2) : '×';
    shapes.daily.classList.toggle('off', Math.abs(h - LINK.mappedAtHour) > 12);
    $('lkHourOut').textContent = `${h < 24 ? 'day 1' : 'day 2'} ${String(h % 24).padStart(2, '0')}:00`;
    $('lkVerdict').innerHTML = `<b style="color:${r.score ? 'var(--accent)' : 'var(--bad)'}">${r.score ? r.score.toFixed(2) : 'no link'}</b>${r.rule}.`;
  }
  function toSvg(e) { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; }
  let dragging = false;
  dot.addEventListener('pointerdown', (e) => { dragging = true; dot.setPointerCapture(e.pointerId); });
  dot.addEventListener('pointermove', (e) => { if (!dragging) return; [x, y] = toSvg(e); x = Math.max(10, Math.min(690, x)); y = Math.max(10, Math.min(305, y)); render(); });
  dot.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('click', (e) => { if (e.target.closest('#lkDot')) return; [x, y] = toSvg(e); render(); });
  dot.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 20 : 6, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); x += d[0]; y += d[1]; render(); }
  });
  hour.addEventListener('input', render);
  render();
}

/* ------------------------------------------------------------------ ML recipes */
const ML = {
  'CNN / ConvLSTM': {
    text: 'Rasterise each training pair onto the fire\'s own UTM grid (the event stores its zone). Inputs: burned mask at <i>t</i>, recent detections, fuels, terrain, wind. Label: burned mask at the next time. ConvLSTMs take a sequence of these.',
    code: `-- one row per training pair; inputs reference the perimeter at t, the label the perimeter at t_next
SELECT p.event_id, p.t, p.t_next, p.dt_hours,
       ST_AsBinary(ST_Transform(a.geom, e.utm_srid)) AS burned_t,
       ST_AsBinary(ST_Transform(b.geom, e.utm_srid)) AS burned_next,
       p.mean_wind_ms
FROM vw_training_pair p
JOIN fire_event e USING (event_id)
JOIN perimeter_obs a ON a.perimeter_id = p.perimeter_at_t
JOIN perimeter_obs b ON b.perimeter_id = p.perimeter_at_t_next
WHERE e.event_id = %(event)s;`,
    py: `import numpy as np, psycopg, shapely.wkb, rasterio.features as rf
from rasterio.transform import from_origin

def mask(wkb, transform, shape):
    return rf.rasterize([shapely.wkb.loads(bytes(wkb))], out_shape=shape, transform=transform).astype(np.float32)

grid = from_origin(x0, y0, 30, 30)                     # 30 m cells on the event's UTM grid
X = np.stack([mask(r['burned_t'], grid, shape), fuel, slope, wind_u, wind_v])
Y = mask(r['burned_next'], grid, shape)                # model learns P(burned at t_next | X)` },
  'Graph neural network': {
    text: 'Nodes are grid cells (or fuel patches); edges join neighbours and carry what drives spread between them: slope along the edge, how well the edge lines up with the wind, fuel on both ends. The label is which nodes burn by the next time.',
    code: `-- nodes: 375 m cells covering the fire, with what the database knows about each
WITH g AS (
  SELECT (ST_SquareGrid(375, ST_Transform(final_perimeter, utm_srid))).*
  FROM fire_event WHERE event_id = %(event)s
)
SELECT g.i, g.j, ST_AsText(ST_Centroid(g.geom)) AS xy,
       count(h.*) FILTER (WHERE h.acq_time <= %(t)s) AS detections_by_t,
       max(h.frp_mw) AS peak_frp
FROM g
LEFT JOIN hotspot h ON ST_Intersects(g.geom, ST_Transform(h.geom, (SELECT utm_srid FROM fire_event WHERE event_id = %(event)s)))
                   AND h.hotspot_id IN (SELECT hotspot_id FROM hotspot_event_link WHERE event_id = %(event)s)
GROUP BY g.i, g.j, g.geom;`,
    py: `import torch
from torch_geometric.data import Data

edge_index = neighbours(nodes)                       # 8-neighbour pairs (i -> j)
d = xy[edge_index[1]] - xy[edge_index[0]]
wind_align = (d @ wind_vec) / d.norm(dim=1)          # +1 downwind, -1 upwind
edge_attr = torch.stack([slope_along(edge_index), wind_align, fuel[edge_index[1]]], dim=1)
graph = Data(x=node_features, edge_index=edge_index, edge_attr=edge_attr, y=burned_next)` },
  'Neural ODE': {
    text: 'Treat the fire front (or the burned fraction of each cell) as a continuous state <i>z(t)</i> with <i>dz/dt = f<sub>θ</sub>(z, weather, fuel)</i>. The observations come at irregular times, so integrate between the real time stamps instead of resampling.',
    code: `-- the irregular time series of one fire: every observation time and its burned area
SELECT p.t, p.dt_hours, a.acres AS acres_t, p.kind, p.hotspots_since_prev, p.mean_wind_ms
FROM vw_training_pair p
JOIN perimeter_obs a ON a.perimeter_id = p.perimeter_at_t
WHERE p.event_id = %(event)s
ORDER BY p.t;`,
    py: `import torch
from torchdiffeq import odeint

class Spread(torch.nn.Module):
    def __init__(self, n):
        super().__init__(); self.f = torch.nn.Sequential(torch.nn.Linear(n + 3, 64), torch.nn.Tanh(), torch.nn.Linear(64, n))
    def forward(self, t, z):
        return self.f(torch.cat([z, forcing(t)], -1))   # forcing: wind u, v and RH interpolated at t

t_obs = torch.tensor(hours_since_ignition)            # irregular: overpasses + mapped perimeters
z_pred = odeint(Spread(n), z0, t_obs)                  # integrate between the real time stamps
loss = ((z_pred - z_obs) ** 2).mean()` },
};
function mlTabs() {
  const tabs = $('mlTabs'), pane = $('mlPane'); if (!tabs) return;
  const keys = Object.keys(ML);
  tabs.innerHTML = keys.map((k, i) => `<button type="button" data-k="${i}">${k}</button>`).join('');
  const show = (i) => {
    const m = ML[keys[i]];
    for (const b of tabs.children) b.classList.toggle('on', +b.dataset.k === i);
    pane.innerHTML = `<p>${m.text}</p><div class="codecap"><span>1 · Ask the database (SQL)</span></div><pre><code data-lang="sql">${esc(m.code)}</code></pre>
      <div class="codecap"><span>2 · Build the model input (Python)</span></div><pre><code data-lang="py">${esc(m.py)}</code></pre>`;
    decorateCode(pane);
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.k); });
  show(0);
}

/* ------------------------------------------------------------------ the 20 questions, with real results */
async function questions() {
  const host = $('qList'); if (!host) return;
  let data;
  try { data = await (await fetch('data/queries.json')).json(); } catch (e) { host.innerHTML = '<p class="sub">Results not generated yet.</p>'; return; }
  const filter = document.createElement('div');
  filter.className = 'qfilter';
  filter.innerHTML = `<button type="button" data-k="all" class="on">All 20</button><button type="button" data-k="b">Basic</button><button type="button" data-k="a">Advanced</button>
    <input type="search" placeholder="Search the questions (e.g. VIIRS, Oregon, acres)…" aria-label="Search the questions" />`;
  host.before(filter);
  host.innerHTML = data.map((q, i) => `<details class="q" data-kind="${q.id[0]}"><summary><span class="qn">${q.id.startsWith('b') ? 'Basic' : 'Advanced'} ${parseInt(q.id.slice(1), 10)}</span><span class="qt">${esc(q.question)}</span><span class="qr">${q.rows_total.toLocaleString()} row${q.rows_total === 1 ? '' : 's'}</span></summary>
    <pre><code>${esc(q.sql)}</code></pre>
    <div class="tbl-wrap"><table class="tbl small"><tr>${q.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${q.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></div>
    <p class="sub">${q.rows.length < q.rows_total ? `First ${q.rows.length} of ${q.rows_total.toLocaleString()} rows. ` : ''}Ran in ${q.ms.toLocaleString()} ms on the local database.</p></details>`).join('');
  let kind = 'all', text = '';
  const apply = () => { for (const d of host.children) d.hidden = !((kind === 'all' || d.dataset.kind === kind) && d.textContent.toLowerCase().includes(text)); };
  filter.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; kind = b.dataset.k; for (const x of filter.querySelectorAll('button')) x.classList.toggle('on', x === b); apply(); });
  filter.querySelector('input').addEventListener('input', (e) => { text = e.target.value.toLowerCase(); apply(); });
  decorateCode(host);
}

/* ------------------------------------------------------------------ legible code */
// A small highlighter for the SQL and Python on this page: keywords, functions, strings, numbers,
// comments and types each get a colour; every block gets line numbers and a copy button.
const SQL_KW = new Set('select from where join left right inner outer on using as and or not in is null distinct group by order having limit with union all case when then else end insert into values update set delete create table view function returns language begin return over partition between like ilike exists cross lateral desc asc true false filter coalesce interval'.split(' '));
const PY_KW = new Set('import from as def class return for in if else elif while with not and or is None True False lambda yield try except raise pass break continue'.split(' '));
const SQL_TY = new Set('bigint integer text timestamptz real numeric geometry geography boolean smallint jsonb'.split(' '));

function highlight(src, lang) {
  const kw = lang === 'py' ? PY_KW : SQL_KW;
  const comment = lang === 'py' ? /#.*$/ : /--.*$/;
  const tokens = /(\s+)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w.]*)|(.)/g;
  return src.split('\n').map((line) => {
    let code = line, tail = '';
    const c = line.match(comment);
    if (c && !/['"]/.test(line.slice(0, c.index).replace(/'[^']*'|"[^"]*"/g, ''))) { code = line.slice(0, c.index); tail = `<span class="tk-com">${esc(c[0])}</span>`; }
    const out = code.replace(tokens, (m, ws, str, num, word, other, offset, whole) => {
      if (ws) return ws;
      if (str) return `<span class="tk-str">${esc(str)}</span>`;
      if (num) return `<span class="tk-num">${num}</span>`;
      if (word) {
        const lw = word.toLowerCase();
        if (kw.has(lw)) return `<span class="tk-kw">${esc(word)}</span>`;
        if (lang !== 'py' && SQL_TY.has(lw)) return `<span class="tk-ty">${esc(word)}</span>`;
        if (whole[offset + word.length] === '(') return `<span class="tk-fn">${esc(word)}</span>`;
        return esc(word);
      }
      return esc(other);
    });
    return out + tail;
  });
}

function decorateCode(root = document) {
  for (const code of root.querySelectorAll('pre > code')) {
    if (code.dataset.done) continue;
    code.dataset.done = '1';
    const src = code.textContent.replace(/\n$/, '');
    const lang = code.dataset.lang || (/^\s*(import|from|def|class|#)/m.test(src) && !/\bselect\b/i.test(src) ? 'py' : /\b(select|create|insert|with)\b/i.test(src) ? 'sql' : 'sh');
    const lines = lang === 'sh' ? src.split('\n').map((l) => l.startsWith('#') ? `<span class="tk-com">${esc(l)}</span>` : esc(l).replace(/(#.*)$/, '<span class="tk-com">$1</span>'))
                                : highlight(src, lang);
    code.innerHTML = lines.map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join('\n');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy'; btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy this code');
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(src); btn.textContent = 'Copied'; btn.classList.add('ok'); }
      catch (e) { btn.textContent = 'Select & copy'; }
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1600);
    });
    code.parentElement.appendChild(btn);
  }
}

/* ------------------------------------------------------------------ stats and case fires */
async function stats() {
  let s;
  try { s = await (await fetch('data/stats.json')).json(); } catch (e) { return; }
  const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : n >= 1e4 ? Math.round(n / 1e3) + ' k' : n.toLocaleString();
  for (const el of document.querySelectorAll('[data-stat]')) if (s[el.dataset.stat] != null) el.textContent = fmt(s[el.dataset.stat]);
  const ls = $('linkStats');
  if (ls && s.links) {
    const tot = s.links.reduce((a, r) => a + r[1], 0);
    ls.innerHTML = `<h3>On the real archive</h3><div class="linkbars">${s.links.map(([m, n]) => `<div><span>${esc(m.replace(/_/g, ' '))}</span><b style="--w:${(100 * n / tot).toFixed(1)}%"></b><em>${n.toLocaleString()}</em></div>`).join('')}</div>
      <p class="sub">${tot.toLocaleString()} of ${s.hotspots.toLocaleString()} detections (${(100 * tot / s.hotspots).toFixed(1)} %) are linked to a fire. The rest are mostly agricultural and prescribed burns too small to get a perimeter, industrial heat sources and detections outside the US.</p>`;
  }
  const cc = $('caseCards');
  if (cc && s.cases) cc.innerHTML = s.cases.map((c) => `<a class="case" href="app/?fire=${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.where)} · ${esc(c.when)}</span><span>${Math.round(c.acres).toLocaleString()} acres · ${c.hotspots.toLocaleString()} detections · ${c.perimeters} perimeter${c.perimeters === 1 ? '' : 's'}</span><span class="lid">${esc(c.lidar)}</span><em>${esc(c.why)}</em></a>`).join('');
}

theme(); tuner(); reveal(); hero(); satChart(); overpasses(); erDiagram(); linkDemo(); mlTabs(); questions(); stats(); decorateCode();
