/*
 * Project 10: "The orphan tsunami of 1700".
 * Tsunami spread from the Cascadia rupture, using a simplified travel-time field: great-circle distance from the
 * rupture (the trench line) divided by a constant long-wave speed √(g·4000 m) ≈ 713 km/h.
 */
(function () {
  'use strict';

  var U = window.VizUtils, G = window.PNW_MAP, LAND = window.WORLD_LAND, $ = U.$, el = U.el;
  var V_KMH = Math.sqrt(9.81 * 4000) * 3.6, R_EARTH = 6371, RAD = Math.PI / 180, T_MAX = 13;
  // Earthquake about 9 pm local time, January 26, 1700 (05:00 UTC Jan 27). Japan local time shown as UTC+9.
  var QUAKE_CAS = { day: 26, hour: 21 }, QUAKE_JP = { day: 27, hour: 14 };

  var SITES = [
    { name: 'Kuwagasaki (Miyako)', lat: 39.64, lon: 141.96, label: true },
    { name: 'Otsuchi', lat: 39.36, lon: 141.9 },
    { name: 'Nakaminato', lat: 36.35, lon: 140.6, label: true },
    { name: 'Miho', lat: 35.0, lon: 138.52 },
    { name: 'Tanabe', lat: 33.73, lon: 135.38, label: true },
  ];

  // ---------------------------------------------------------------- travel-time field
  function hav(a, b) {
    var dl = (b[0] - a[0]) * RAD, dp = (b[1] - a[1]) * RAD;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  var TRENCH = G.regions.megathrust.trench, SRC = [];
  for (var i = 1; i < TRENCH.length; i++) for (var k = 0; k < 5; k++) {
    var f = k / 5; SRC.push([TRENCH[i - 1][0] + (TRENCH[i][0] - TRENCH[i - 1][0]) * f, TRENCH[i - 1][1] + (TRENCH[i][1] - TRENCH[i - 1][1]) * f]);
  }
  SRC.push(TRENCH[TRENCH.length - 1]);
  function hoursTo(lon, lat) {
    var best = Infinity;
    for (var j = 0; j < SRC.length; j++) { var d = hav(SRC[j], [lon, lat]); if (d < best) best = d; }
    return best / V_KMH;
  }
  var GRID = { lon0: 115, lat0: -10, step: 1, nx: 137, ny: 77 };   // 115°E … 251°E (109°W), 10°S … 66°N
  var FIELD = new Array(GRID.nx * GRID.ny);
  for (var y = 0; y < GRID.ny; y++) for (var x = 0; x < GRID.nx; x++) {
    var lon = GRID.lon0 + x * GRID.step, lat = GRID.lat0 + y * GRID.step;
    FIELD[y * GRID.nx + x] = hoursTo(lon > 180 ? lon - 360 : lon, lat);
  }
  SITES.forEach(function (s) { s.hours = hoursTo(s.lon, s.lat); });

  // ---------------------------------------------------------------- map
  var svg = d3.select('#pacific'), W = 960, H = 520, projection, path, R = {};
  function gridToLonLat(p) {
    var lon = GRID.lon0 + (p[0] - 0.5) * GRID.step, lat = GRID.lat0 + (p[1] - 0.5) * GRID.step;
    return [lon > 180 ? lon - 360 : lon, lat];
  }
  /** Planar path for d3.contours output (avoids spherical winding issues; rings never cross the map's seam). */
  function contourPath(multi, close) {
    return multi.coordinates.map(function (poly) {
      return poly.map(function (ring) {
        return 'M' + ring.map(function (p) { var q = projection(gridToLonLat(p)); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L') + (close ? 'Z' : '');
      }).join('');
    }).join('');
  }
  var contourGen = d3.contours().size([GRID.nx, GRID.ny]);
  var NEG_FIELD = FIELD.map(function (v) { return -v; });   // contours enclose values above a threshold, so negate
  var ISO_PATHS = [];                                       // hourly isochrones, built once after the projection exists

  function build() {
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    var box = { type: 'MultiPoint', coordinates: [[128, 18], [-118, 18], [128, 60], [-118, 60], [180, 62], [180, 14], [150, 64], [-150, 64]] };
    projection = d3.geoNaturalEarth1().rotate([170, 0]).fitExtent([[10, 10], [W - 10, H - 10]], box);
    path = d3.geoPath(projection);
    for (var hr = 1; hr <= T_MAX; hr++) ISO_PATHS[hr] = contourPath(contourGen.contour(NEG_FIELD, -hr), false);
    svg.append('path').datum({ type: 'Sphere' }).attr('d', path).style('fill', 'var(--map-water)');
    svg.append('path').datum(d3.geoGraticule10()).attr('d', path).style('fill', 'none').style('stroke', 'var(--grid)').style('stroke-width', 0.6);
    R.fill = svg.append('path').style('fill', 'var(--deep)').style('fill-opacity', 0.18).style('fill-rule', 'evenodd');
    R.iso = svg.append('g');
    R.front = svg.append('path').style('fill', 'none').style('stroke', 'var(--deep)').style('stroke-width', 2.5);
    svg.append('path').datum(LAND).attr('d', path).style('fill', 'var(--map-land)').style('stroke', 'var(--map-coast)').style('stroke-width', 0.7);
    var zone = G.regions.megathrust.zone.map(function (p) { return projection(p); });
    svg.append('path').attr('d', 'M' + zone.join('L') + 'Z').style('fill', 'var(--megathrust)').style('opacity', 0.75);
    var zoneWest = d3.min(zone, function (p) { return p[0]; }), zoneMid = d3.mean(zone, function (p) { return p[1]; });
    svg.append('text').attr('class', 'lab').attr('x', zoneWest - 12).attr('y', zoneMid).attr('text-anchor', 'end').text('Cascadia rupture');
    svg.append('text').attr('class', 'lab-s').attr('x', zoneWest - 12).attr('y', zoneMid + 16).attr('text-anchor', 'end').text('Jan 26, 1700');
    var jp = projection([140.2, 43.2]);
    svg.append('text').attr('class', 'lab').attr('x', jp[0] - 14).attr('y', jp[1]).attr('text-anchor', 'end').text('Japan');
    var po = projection([-172, 32]);
    svg.append('text').attr('class', 'lab-s').attr('x', po[0]).attr('y', po[1]).attr('text-anchor', 'middle').text('Pacific Ocean');

    R.sites = SITES.map(function (s) {
      var p = projection([s.lon, s.lat]), g = svg.append('g').attr('transform', 'translate(' + p[0] + ',' + p[1] + ')').attr('tabindex', 0)
        .attr('role', 'img').attr('aria-label', s.name);
      var ring = g.append('circle').attr('r', 0).style('fill', 'none').style('stroke', 'var(--deep)').style('stroke-width', 2);
      var dot = g.append('circle').attr('r', 4.5).style('stroke', 'var(--surface-1)').style('stroke-width', 1.5);
      if (s.label) g.append('text').attr('class', 'lab-s').attr('x', -9).attr('y', s.name === 'Tanabe' ? 14 : 4).attr('text-anchor', 'end').text(s.name.split(' (')[0]);
      g.on('pointerenter focus', function () { showTip(s, p); }).on('pointerleave blur', function () { $('map-tip').hidden = true; });
      return { s: s, ring: ring, dot: dot };
    });
  }

  function showTip(s, p) {
    var tip = $('map-tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', s.name));
    tip.appendChild(el('p', null, 'Model arrival: ' + s.hours.toFixed(1) + ' hours after the quake (' + clock(QUAKE_JP, s.hours) + ' local time).'));
    tip.appendChild(el('p', null, 'Japanese records describe the tsunami arriving around midnight, with no earthquake felt.'));
    tip.hidden = false;
    var frame = $('map-frame').getBoundingClientRect(), sx = frame.width / W;
    var left = p[0] * sx + 12; if (left + tip.offsetWidth > frame.width) left = p[0] * sx - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, p[1] * sx - 20) + 'px';
  }

  // ---------------------------------------------------------------- frame
  function clock(base, hours) {
    var total = base.hour * 60 + Math.round(hours * 60), day = base.day + Math.floor(total / 1440), mins = total % 1440;
    var h = Math.floor(mins / 60), m = mins % 60, ampm = h >= 12 ? 'pm' : 'am', h12 = h % 12 === 0 ? 12 : h % 12;
    return 'Jan ' + day + ', 1700, ' + h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }
  var state = { t: 0, playing: false, speed: 1.3, iso: true }, raf = null, last = 0;
  function render() {
    var t = state.t;
    if (t > 0.05) {
      var shape = contourGen.contour(NEG_FIELD, -t);   // region where travel time <= t
      R.fill.attr('d', contourPath(shape, true));
      R.front.attr('d', contourPath(shape, false));
    } else { R.fill.attr('d', null); R.front.attr('d', null); }
    R.iso.selectAll('*').remove();
    if (state.iso) {
      for (var hr = 1; hr <= Math.floor(t); hr++) {
        R.iso.append('path').attr('d', ISO_PATHS[hr]).style('fill', 'none').style('stroke', 'var(--deep)').style('stroke-width', 0.8).style('opacity', 0.6);
      }
    }
    R.sites.forEach(function (r) {
      var reached = t >= r.s.hours, dt = t - r.s.hours;
      r.dot.style('fill', reached ? 'var(--deep)' : 'var(--text-secondary)');
      r.ring.attr('r', reached && dt < 1.2 ? 5 + dt * 18 : 0).style('opacity', reached ? Math.max(0, 1 - dt / 1.2) : 0);
    });
    document.querySelectorAll('#arrivals li').forEach(function (li, idx) { li.classList.toggle('reached', t >= SITES[idx].hours); });
    $('clock-cas').textContent = clock(QUAKE_CAS, t);
    $('clock-jp').textContent = clock(QUAKE_JP, t);
    $('hours').value = t;
    $('hours-out').textContent = t.toFixed(1) + ' h';
    $('play-btn').textContent = state.playing ? '❚❚ Pause' : t >= T_MAX - 0.01 ? '↺ Replay' : '▶ Play';
    var n = SITES.filter(function (s) { return t >= s.hours; }).length;
    $('pacific').setAttribute('aria-label', t.toFixed(1) + ' hours after the earthquake. The tsunami has reached ' + n + ' of ' + SITES.length + ' Japanese towns.');
  }

  function play() {
    if (state.t >= T_MAX - 0.01) state.t = 0;
    state.playing = true; last = performance.now();
    cancelAnimationFrame(raf);
    function frame(now) {
      if (!state.playing) return;
      state.t = Math.min(T_MAX, state.t + (now - last) / 1000 * state.speed); last = now;
      if (state.t >= T_MAX) state.playing = false;
      render();
      if (state.playing) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    render();
  }
  function pause() { state.playing = false; cancelAnimationFrame(raf); render(); }

  // ---------------------------------------------------------------- detective clues
  function yr(y, m, d, h) { return y + (Date.UTC(y, m - 1, d, h || 0) - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)); }
  var CLUES = [
    { id: 'soil', title: 'Buried marsh soils', range: [1680, 1720],
      text: 'Coastal marshes suddenly dropped and were buried by tidal mud and tsunami sand. Radiocarbon dating of the dead plants: about 1680–1720.',
      verdict: 'Sometime between about <b>1680 and 1720</b>.' },
    { id: 'rings', title: 'Ghost-forest tree rings', range: [yr(1699, 9, 1), yr(1700, 4, 1)],
      text: 'Drowned red cedars grew their last ring in 1699 and died before growing in 1700. The quake struck in the winter of 1699–1700 (report p. 3).',
      verdict: 'In the <b>winter of 1699–1700</b>.' },
    { id: 'japan', title: 'Japanese tsunami records', range: [yr(1700, 1, 27, 4), yr(1700, 1, 27, 6)],
      text: 'A tsunami with no felt earthquake reached Japan around midnight on January 27–28, 1700. Subtract ~10 hours of travel across the Pacific.',
      verdict: '<b>January 26, 1700, about 9 pm</b> Pacific time, the date the report gives.' },
    { id: 'oral', title: 'Indigenous oral histories', range: null,
      text: 'Stories from Native peoples of the coast tell of a great shaking and flooding on a winter night (Ludwin et al., 2005). They agree with the other clues.',
      verdict: null },
  ];
  var active = {};
  function buildClues() {
    var wrap = $('clues');
    CLUES.forEach(function (c, i) {
      var b = el('button', 'clue'); b.type = 'button'; b.dataset.clue = c.id;
      b.appendChild(el('span', 'k-step', 'Clue ' + (i + 1)));
      b.appendChild(el('span', 'k-title', c.title));
      b.appendChild(el('span', 'k-text', c.text));
      b.addEventListener('click', function () { active[c.id] = !active[c.id]; renderClues(); });
      wrap.appendChild(b);
    });
  }
  function renderClues() {
    document.querySelectorAll('.clue').forEach(function (b) { b.setAttribute('aria-pressed', String(!!active[b.dataset.clue])); });
    var on = CLUES.filter(function (c) { return active[c.id] && c.range; });
    var lo = on.length ? d3.max(on, function (c) { return c.range[0]; }) : 1650, hi = on.length ? d3.min(on, function (c) { return c.range[1]; }) : 1750;
    var pad = Math.max((hi - lo) * 0.6, 0.004);
    var domain = on.length ? [lo - pad, hi + pad] : [1650, 1750];

    var wrap = $('window-wrap'), root = d3.select('#window-chart');
    var Wc = wrap.clientWidth || 800, Hc = 70 + CLUES.filter(function (c) { return c.range; }).length * 30;
    root.attr('width', Wc).attr('height', Hc).attr('viewBox', '0 0 ' + Wc + ' ' + Hc);
    var x = d3.scaleLinear(domain, [20, Wc - 20]);
    root.selectAll('*').remove();
    var span = domain[1] - domain[0];
    var ticks = span > 20 ? x.ticks(6).map(function (v) { return [v, String(Math.round(v))]; })
      : span > 0.3 ? [[1699 + 0.75, 'Oct 1699'], [1700, 'Jan 1700'], [1700.25, 'Apr 1700']].filter(function (t) { return t[0] > domain[0] && t[0] < domain[1]; })
      // Fully zoomed in: label in Pacific time (UTC−8), matching the verdict's "about 9 pm"
      : [[yr(1700, 1, 26, 8), 'Jan 26 (Pacific time)'], [yr(1700, 1, 26, 20), 'noon'], [yr(1700, 1, 27, 5), '9 pm'], [yr(1700, 1, 27, 8), 'Jan 27']]
        .filter(function (t) { return t[0] > domain[0] && t[0] < domain[1]; });
    ticks.forEach(function (t) {
      root.append('line').attr('x1', x(t[0])).attr('x2', x(t[0])).attr('y1', 20).attr('y2', Hc - 24).style('stroke', 'var(--grid)');
      root.append('text').attr('x', x(t[0])).attr('y', Hc - 8).attr('text-anchor', 'middle').style('fill', 'var(--text-muted)').style('font-size', '12px').text(t[1]);
    });
    CLUES.filter(function (c) { return c.range; }).forEach(function (c, i) {
      var cy = 24 + i * 30, a = Math.max(domain[0], c.range[0]), b = Math.min(domain[1], c.range[1]);
      root.append('text').attr('x', 20).attr('y', cy + 10).style('fill', active[c.id] ? 'var(--text-primary)' : 'var(--text-muted)').style('font-size', '12px')
        .text(c.title + (active[c.id] ? '' : ' (not yet used)'));
      if (!active[c.id] || b <= a) return;
      root.append('rect').attr('x', x(a)).attr('y', cy + 14).attr('height', 10).attr('rx', 5).attr('width', Math.max(4, x(b) - x(a)))
        .style('fill', c.id === 'japan' ? 'var(--deep)' : c.id === 'rings' ? 'var(--crustal)' : 'var(--megathrust)');
    });
    root.attr('aria-label', 'Possible dates for the earthquake given the selected clues: ' + (on.length ? Math.floor(lo) : 'none yet'));

    var v = $('verdict');
    v.textContent = '';
    var last = CLUES.filter(function (c) { return active[c.id] && c.verdict; });
    var best = last.sort(function (a, b) { return (a.range[1] - a.range[0]) - (b.range[1] - b.range[0]); })[0];
    if (!best) { v.textContent = active.oral ? 'The oral histories agree with the other clues: a great shaking and flooding on a winter night.' : 'Click a clue to start narrowing the date.'; return; }
    v.appendChild(el('strong', null, 'So far: '));
    // Verdicts mark bold parts with <b>…</b>; build them as nodes rather than parsing HTML.
    best.verdict.split(/(<b>.*?<\/b>)/).forEach(function (part) {
      if (!part) return;
      var m = /^<b>(.*)<\/b>$/.exec(part);
      v.appendChild(m ? el('strong', null, m[1]) : document.createTextNode(part));
    });
    if (active.oral) v.appendChild(document.createTextNode(' The oral histories agree.'));
  }

  // ---------------------------------------------------------------- init
  function init() {
    build();
    var list = $('arrivals');
    SITES.forEach(function (s) {
      var li = el('li');
      li.appendChild(el('span', 'a-name', s.name));
      li.appendChild(el('span', 'a-time', '~' + s.hours.toFixed(1) + ' h after the quake · ' + clock(QUAKE_JP, s.hours).replace(', 1700', '')));
      list.appendChild(li);
    });
    $('play-btn').addEventListener('click', function () { if (state.playing) pause(); else play(); });
    $('hours').addEventListener('input', function (ev) { var v = +ev.target.value; pause(); state.t = v; render(); });
    $('isochrones').addEventListener('change', function (ev) { state.iso = ev.target.checked; render(); });
    document.querySelectorAll('#speed-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.speed === state.speed));
      b.addEventListener('click', function () {
        state.speed = +b.dataset.speed;
        document.querySelectorAll('#speed-buttons button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
    buildClues();
    $('all-clues').addEventListener('click', function () { CLUES.forEach(function (c) { active[c.id] = true; }); renderClues(); });
    $('reset-clues').addEventListener('click', function () { active = {}; renderClues(); });
    render(); renderClues();
    if (window.ResizeObserver) new ResizeObserver(function () { renderClues(); }).observe($('window-wrap'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
