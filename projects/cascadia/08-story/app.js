/*
 * Project 8: "Cascadia: what are the odds?". A scrollytelling walkthrough of the report.
 * One sticky SVG graphic changes as each text step scrolls into the middle of the screen.
 */
(function () {
  'use strict';

  var U = window.VizUtils, Q = window.QUAKE, B = window.BPT, C = window.PNW_CATALOG, S = window.CASCADIA_SLAB, T = window.CASCADIA_TURBIDITES;
  var $ = U.$, el = U.el;
  var NOW = new Date().getFullYear();
  var VW = 800, VH = 520;
  var LAB = 'fill: var(--text-primary); font-size: 14px; font-weight: 600; paint-order: stroke; stroke: var(--page); stroke-width: 5px; stroke-linejoin: round';
  var SUB = 'fill: var(--text-secondary); font-size: 12px; paint-order: stroke; stroke: var(--page); stroke-width: 4px; stroke-linejoin: round';

  // ---------------------------------------------------------------- cross-section geometry (latitude of Seattle)
  var LAT = 47.6, W_LON = -127.5, E_LON = -120.5, KM_PER_DEG = 111.32 * Math.cos(LAT * Math.PI / 180), VE = 2.5;
  var X0 = 40, X1 = 760, Y0 = 120, PX_PER_KM = (X1 - X0) / ((E_LON - W_LON) * KM_PER_DEG);
  function xs(lon) { return X0 + (lon - W_LON) * KM_PER_DEG * PX_PER_KM; }
  function ys(depth) { return Y0 + depth * PX_PER_KM * VE; }
  function slabAt(lon, lat) {
    var fx = (lon - S.lon0) / S.step, fy = (lat - S.lat0) / S.step, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= S.nx - 1 || j >= S.ny - 1) return null;
    var a = S.depth[j * S.nx + i], b = S.depth[j * S.nx + i + 1], c = S.depth[(j + 1) * S.nx + i], d = S.depth[(j + 1) * S.nx + i + 1];
    if (a === null || b === null || c === null || d === null) return null;
    var tx = fx - i, ty = fy - j;
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }
  var PROFILE = [];
  for (var lon = W_LON; lon <= E_LON + 1e-9; lon += 0.05) { var d = slabAt(lon, LAT); if (d !== null && d <= 110) PROFILE.push([lon, d]); }
  var TRENCH_LON = PROFILE[0][0];

  // Earthquakes in the Puget Sound latitude band (M2.5+ set plus the larger M4+ quakes), classified against the plate
  var seen = {};
  var XS_QUAKES = C.puget.concat(C.main.filter(function (r) { return r[3] >= 46.5 && r[3] <= 48.8 && r[2] >= -124.2 && r[2] <= -121.3; }))
    .filter(function (r) { if (seen[r[0]]) return false; seen[r[0]] = true; return r[4] <= 100; })
    .map(function (r) {
      var s = slabAt(r[2], r[3]);
      return { lon: r[2], depth: Math.max(0, r[4]), mag: r[5], cls: s === null ? 'other' : r[4] >= s - 5 ? 'deep' : 'crustal' };
    });

  // ---------------------------------------------------------------- graphic scaffolding
  var svg = d3.select('#graphic').attr('viewBox', '0 0 ' + VW + ' ' + VH);
  var layers = {};
  ['xs', 'chart'].forEach(function (k) { layers[k] = svg.append('g').attr('class', 'layer-' + k).style('opacity', 0); });
  var current = null;

  function caption(text) { $('graphic-caption').textContent = text; }
  function fadeTo(name) {
    Object.keys(layers).forEach(function (k) {
      layers[k].interrupt().transition().duration(U.prefersReducedMotion() ? 0 : 350).style('opacity', k === name ? 1 : 0);
    });
  }

  // ---------------------------------------------------------------- the cross-section scene (steps 1–4)
  var xsBuilt = false, xsSel = {};
  function buildCrossSection() {
    var g = layers.xs;
    var coastLon = -124.3;
    // Sea and land surface
    g.append('rect').attr('x', X0).attr('y', Y0 - 18).attr('width', xs(coastLon) - X0).attr('height', 18).style('fill', 'var(--deep)').style('opacity', 0.15);
    var land = 'M' + xs(coastLon) + ',' + Y0 + 'L' + xs(-123.9) + ',' + (Y0 - 14) + 'Q' + xs(-123.5) + ',' + (Y0 - 40) + ' ' + xs(-123.1) + ',' + (Y0 - 12) +
      'L' + xs(-122.6) + ',' + (Y0 - 4) + 'L' + xs(-121.9) + ',' + (Y0 - 8) + 'Q' + xs(-121.3) + ',' + (Y0 - 46) + ' ' + xs(-120.9) + ',' + (Y0 - 14) +
      'L' + X1 + ',' + (Y0 - 12) + 'L' + X1 + ',' + Y0 + 'Z';
    g.append('path').attr('d', land).style('fill', 'var(--text-muted)').style('opacity', 0.35);
    g.append('line').attr('x1', X0).attr('x2', X1).attr('y1', Y0).attr('y2', Y0).style('stroke', 'var(--axis)');

    // North American Plate (everything above the slab) and the Juan de Fuca Plate (band below the slab top)
    var top = PROFILE.map(function (p) { return [xs(p[0]), ys(p[1])]; });
    var westDepth = PROFILE[0][1], THICK = 35;
    var plate = 'M' + X0 + ',' + ys(westDepth) + 'L' + top.map(function (p) { return p.join(','); }).join('L') +
      'L' + top.slice().reverse().map(function (p) { return p[0] + ',' + Math.min(VH - 20, p[1] + THICK * PX_PER_KM * VE); }).join('L') +
      'L' + X0 + ',' + ys(westDepth + THICK) + 'Z';
    g.append('path').attr('d', plate).style('fill', 'var(--context)').style('opacity', 0.45);
    g.append('path').attr('d', 'M' + X0 + ',' + ys(westDepth) + 'L' + top.map(function (p) { return p.join(','); }).join('L'))
      .style('fill', 'none').style('stroke', 'var(--text-secondary)').style('stroke-width', 1.5);
    // Locked megathrust: plate top shallower than ~25 km
    var locked = PROFILE.filter(function (p) { return p[1] <= 25; });
    xsSel.locked = g.append('path').attr('d', 'M' + locked.map(function (p) { return xs(p[0]) + ',' + ys(p[1]); }).join('L'))
      .style('fill', 'none').style('stroke', 'var(--megathrust)').style('stroke-width', 7).style('stroke-linecap', 'round').style('opacity', 0.35);

    // Depth axis
    [0, 20, 40, 60, 80, 100].forEach(function (dd) {
      g.append('text').attr('x', X0 - 6).attr('y', ys(dd)).attr('dy', '0.32em').attr('text-anchor', 'end').style('fill', 'var(--text-muted)').style('font-size', '11px').text(dd);
    });
    g.append('text').attr('x', 4).attr('y', ys(100) + 20).style('fill', 'var(--text-muted)').style('font-size', '11px').text('km deep');

    // Earthquakes
    xsSel.dots = g.append('g').selectAll('circle').data(XS_QUAKES).join('circle')
      .attr('cx', function (q) { return xs(q.lon); }).attr('cy', function (q) { return ys(q.depth); })
      .attr('r', function (q) { return 1.2 + Math.max(0, q.mag - 2.5) * 1.1; })
      .style('fill', 'var(--text-muted)').style('opacity', 0.4);

    // Labels
    g.append('text').attr('x', xs(-126.6)).attr('y', Y0 - 28).attr('text-anchor', 'middle').attr('style', SUB).text('Pacific Ocean');
    g.append('text').attr('x', xs(-123.5)).attr('y', Y0 - 48).attr('text-anchor', 'middle').attr('style', SUB).text('Olympic Mts.');
    g.append('text').attr('x', xs(-122.4)).attr('y', Y0 - 16).attr('text-anchor', 'middle').attr('style', SUB).text('Seattle');
    g.append('text').attr('x', xs(-121.2)).attr('y', Y0 - 54).attr('text-anchor', 'middle').attr('style', SUB).text('Cascades');
    xsSel.plateLabels = g.append('g');
    xsSel.plateLabels.append('text').attr('x', xs(-121.4)).attr('y', ys(18)).attr('text-anchor', 'middle').attr('style', LAB).text('North American Plate');
    xsSel.plateLabels.append('text').attr('x', xs(-125.9)).attr('y', ys(westDepth + 22)).attr('text-anchor', 'middle').attr('style', LAB).text('Juan de Fuca Plate');
    // Convergence arrow
    var ay = ys(westDepth + 9);
    xsSel.plateLabels.append('path').attr('d', 'M' + xs(-127.3) + ',' + ay + 'H' + xs(-126.5) + 'M' + (xs(-126.5) - 8) + ',' + (ay - 6) + 'L' + xs(-126.5) + ',' + ay + 'L' + (xs(-126.5) - 8) + ',' + (ay + 6))
      .style('fill', 'none').style('stroke', 'var(--text-primary)').style('stroke-width', 2.5);
    xsSel.plateLabels.append('text').attr('x', xs(-126.9)).attr('y', ay - 10).attr('text-anchor', 'middle').attr('style', SUB).text('a few cm/yr');

    // Representative events
    function star(cx, cy) {
      var p = d3.range(10).map(function (i) { var r = i % 2 ? 6 : 14, a = Math.PI / 5 * i - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
      return 'M' + p.join('L') + 'Z';
    }
    var events = [
      { k: 'crustal', lon: -122.5, depth: 8, color: 'var(--crustal)', label: 'Seattle Fault, ~923 C.E., M7.5–7.8', pos: 'below' },
      { k: 'deep', lon: -122.727, depth: 51.8, color: 'var(--deep)', label: '2001 Nisqually, M6.8, 52 km deep', pos: 'below' },
      { k: 'megathrust', lon: -125.4, depth: slabAt(-125.4, LAT), color: 'var(--megathrust)', label: 'January 26, 1700, M~9', pos: 'above' },
    ];
    xsSel.events = {};
    events.forEach(function (e) {
      var eg = g.append('g').style('opacity', 0);
      eg.append('path').attr('d', star(xs(e.lon), ys(e.depth))).style('fill', e.color).style('stroke', 'var(--page)').style('stroke-width', 2);
      eg.append('text').attr('x', xs(e.lon)).attr('y', ys(e.depth) + (e.pos === 'below' ? 32 : -22)).attr('text-anchor', 'middle').attr('style', LAB).text(e.label);
      xsSel.events[e.k] = eg;
    });
    xsBuilt = true;
  }

  function updateCrossSection(step) {
    var dur = U.prefersReducedMotion() ? 0 : 500;
    var hi = { crustal: 'crustal', deep: 'deep' }[step];
    xsSel.dots.transition().duration(dur)
      .style('fill', function (q) { return hi && q.cls === hi ? 'var(--' + (hi === 'deep' ? 'deep' : 'crustal') + ')' : 'var(--text-muted)'; })
      .style('opacity', function (q) { return !hi ? 0.4 : q.cls === hi ? 0.85 : 0.12; });
    xsSel.locked.transition().duration(dur).style('opacity', step === 'megathrust' ? 1 : step === 'plates' ? 0.35 : 0.15);
    Object.keys(xsSel.events).forEach(function (k) { xsSel.events[k].transition().duration(dur).style('opacity', k === step ? 1 : 0); });
    xsSel.plateLabels.transition().duration(dur).style('opacity', step === 'plates' ? 1 : 0.35);
    var captions = {
      plates: 'Cross-section at the latitude of Seattle (47.6°N), west to east. Plate surface: USGS Slab2. Dots: earthquakes since 1980 (M2.5+, USGS ComCat).',
      crustal: 'Aqua: quakes in the crust above the sinking plate. The star marks the ~923 C.E. Seattle Fault earthquake (depth illustrative).',
      deep: 'Blue: quakes inside the sinking plate, 40–60 km down. They cluster under Puget Sound, as Nisqually did in 2001.',
      megathrust: 'Orange: the locked plate boundary. It is almost silent between great quakes, then ruptures 1,000 km of coast at once.',
    };
    caption(captions[step]);
    svg.attr('aria-label', captions[step]);
  }

  // ---------------------------------------------------------------- chart scenes (steps 5–10)
  var CHART = { left: 80, right: 760, top: 60, bottom: 460 };
  function clearChart() { layers.chart.selectAll('*').interrupt().remove(); return layers.chart; }
  function title(g, text) { g.append('text').attr('x', CHART.left).attr('y', 30).attr('style', LAB.replace('14px', '18px')).text(text); }

  var ROWS = [
    { key: 'deep', label: 'Deep, Puget Sound', tau: 26, color: 'var(--deep)', p: 0.85 },
    { key: 'crustal', label: 'Crustal, Puget Sound', tau: 265, color: 'var(--crustal)', p: 0.17 },
    { key: 'm9', label: 'Cascadia M9', tau: 500, color: 'var(--megathrust)', p: 0.10 },
  ];

  function sceneClock() {
    var g = clearChart(); title(g, 'One possible next 300 years');
    var x = d3.scaleLinear([NOW, NOW + 300], [CHART.left + 120, CHART.right]);
    var rng = U.rng(19), dur = U.prefersReducedMotion() ? 0 : 900;
    [NOW, NOW + 100, NOW + 200, NOW + 300].forEach(function (yr) {
      g.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', 70).attr('y2', 430).style('stroke', 'var(--grid)');
      g.append('text').attr('x', x(yr)).attr('y', 450).attr('text-anchor', 'middle').style('fill', 'var(--text-muted)').style('font-size', '12px').text(yr);
    });
    ROWS.forEach(function (r, i) {
      var cy = 120 + i * 120, t = 0, ev = [];
      for (;;) { t += -r.tau * Math.log(1 - rng()); if (t > 300) break; ev.push(t); }
      g.append('text').attr('x', CHART.left - 50).attr('y', cy - 22).attr('style', LAB).text(r.label);
      g.append('text').attr('x', CHART.left - 50).attr('y', cy - 4).attr('style', SUB).text('every ~' + r.tau + ' yr on average');
      g.append('line').attr('x1', x(NOW)).attr('x2', x(NOW + 300)).attr('y1', cy + 16).attr('y2', cy + 16).style('stroke', 'var(--axis)');
      g.selectAll(null).data(ev).join('circle').attr('cx', function (v) { return x(NOW + v); }).attr('cy', cy + 16).attr('r', 0)
        .style('fill', r.color).style('stroke', 'var(--page)').style('stroke-width', 2)
        .transition().delay(function (v) { return dur * v / 300; }).duration(250).attr('r', i === 2 ? 10 : 7);
      g.append('text').attr('x', CHART.right).attr('y', cy - 4).attr('text-anchor', 'end').attr('style', SUB).text(ev.length + (ev.length === 1 ? ' quake' : ' quakes') + ' in this future');
    });
    caption('Random quake times at each source’s average rate (the same no-memory model the report uses). Another draw would look different.');
  }

  function sceneFormula() {
    var g = clearChart(); title(g, 'P = 1 − e^(−t/τ)');
    var x = d3.scaleLinear([0, 200], [CHART.left, CHART.right]), y = d3.scaleLinear([0, 1], [CHART.bottom, CHART.top + 10]);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      g.append('line').attr('x1', CHART.left).attr('x2', CHART.right).attr('y1', y(v)).attr('y2', y(v)).style('stroke', v ? 'var(--grid)' : 'var(--axis)');
      g.append('text').attr('x', CHART.left - 8).attr('y', y(v)).attr('dy', '0.32em').attr('text-anchor', 'end').style('fill', 'var(--text-muted)').style('font-size', '12px').text(v * 100 + '%');
    });
    [0, 50, 100, 150, 200].forEach(function (v) {
      g.append('text').attr('x', x(v)).attr('y', CHART.bottom + 20).attr('text-anchor', 'middle').style('fill', 'var(--text-muted)').style('font-size', '12px').text(v === 0 ? '0' : v + ' yr');
    });
    g.append('line').attr('x1', x(50)).attr('x2', x(50)).attr('y1', CHART.top).attr('y2', CHART.bottom).style('stroke', 'var(--text-primary)').style('stroke-width', 1.5);
    g.append('text').attr('x', x(50) + 6).attr('y', CHART.top + 6).attr('style', SUB).text('50 years ≈ a building’s life');
    var dur = U.prefersReducedMotion() ? 0 : 900;
    ROWS.forEach(function (r) {
      var line = d3.line().x(function (t) { return x(t); }).y(function (t) { return y(Q.poisson(r.tau, t)); });
      var path = g.append('path').attr('d', line(d3.range(0, 201, 2))).style('fill', 'none').style('stroke', r.color).style('stroke-width', 3);
      var len = path.node().getTotalLength();
      path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len).transition().duration(dur).attr('stroke-dashoffset', 0);
      var p50 = Q.poisson(r.tau, 50);
      g.append('circle').attr('cx', x(50)).attr('cy', y(p50)).attr('r', 6).style('fill', r.color).style('stroke', 'var(--page)').style('stroke-width', 2);
      g.append('text').attr('x', x(50) - 10).attr('y', y(p50) - 10).attr('text-anchor', 'end').attr('style', LAB)
        .text(r.label + ': ' + Math.round(p50 * 100) + '%');
    });
    caption('τ = average years between quakes: 26 (deep), 265 (crustal), 500 (M9). The curves are the report’s formula; the dots are its 50-year numbers.');
  }

  function sceneOdds() {
    var g = clearChart(); title(g, 'Chance of at least one in the next 50 years');
    var rows = [
      { label: 'Deep M6.5+, Puget Sound', p: 0.85, color: 'var(--deep)' },
      { label: 'Crustal M6.5+, Puget Sound', p: 0.17, color: 'var(--crustal)' },
      { label: 'Cascadia M9', p: 0.10, hi: 0.15, color: 'var(--megathrust)' },
      { label: 'Crustal M6.5+, Portland area', p: 0.06, color: 'var(--crustal)' },
      { label: 'Seattle Fault M6.5+', p: 0.05, color: 'var(--crustal)' },
    ];
    var x = d3.scaleLinear([0, 1], [CHART.left + 190, CHART.right - 40]), dur = U.prefersReducedMotion() ? 0 : 700;
    rows.forEach(function (r, i) {
      var cy = 90 + i * 70;
      g.append('text').attr('x', CHART.left + 180).attr('y', cy + 12).attr('text-anchor', 'end').attr('style', SUB.replace('12px', '14px')).text(r.label);
      g.append('rect').attr('x', x(0)).attr('y', cy).attr('height', 24).attr('rx', 4).attr('width', 0).style('fill', r.color)
        .transition().delay(i * 120).duration(dur).attr('width', x(r.p) - x(0));
      // The "memory" extension (10% → 15%) grows together with its bar, so there is never a gap before its label.
      if (r.hi) g.append('rect').attr('x', x(0)).attr('y', cy).attr('height', 24).attr('rx', 4).attr('width', 0).style('fill', r.color).style('opacity', 0.4)
        .lower().transition().delay(i * 120).duration(dur).attr('width', x(r.hi) - x(0));
      g.append('text').attr('x', x(r.hi || r.p) + 8).attr('y', cy + 12).attr('dy', '0.32em').attr('style', LAB)
        .text(r.hi ? '10–15%' : Math.round(r.p * 100) + '%');
    });
    caption('All values from the report (pp. 2–5). The lighter part of the M9 bar is the extra chance if the fault "remembers" 1700.');
  }

  function sceneMemory() {
    var g = clearChart(); title(g, 'Chance of a Cascadia M9 in the next 50 years');
    var x = d3.scaleLinear([1700, 2300], [CHART.left, CHART.right]), y = d3.scaleLinear([0, 0.25], [CHART.bottom, CHART.top + 10]);
    [0, 0.05, 0.1, 0.15, 0.2, 0.25].forEach(function (v) {
      g.append('line').attr('x1', CHART.left).attr('x2', CHART.right).attr('y1', y(v)).attr('y2', y(v)).style('stroke', v ? 'var(--grid)' : 'var(--axis)');
      g.append('text').attr('x', CHART.left - 8).attr('y', y(v)).attr('dy', '0.32em').attr('text-anchor', 'end').style('fill', 'var(--text-muted)').style('font-size', '12px').text(Math.round(v * 100) + '%');
    });
    [1700, 1800, 1900, 2000, 2100, 2200, 2300].forEach(function (v) {
      g.append('text').attr('x', x(v)).attr('y', CHART.bottom + 20).attr('text-anchor', 'middle').style('fill', 'var(--text-muted)').style('font-size', '12px').text(v);
    });
    var poi = B.poisson.conditional(0, 50, 500), mem = function (yr) { return B.conditional(yr - 1700, 50, 500, 0.5); };
    g.append('line').attr('x1', x(1700)).attr('x2', x(2300)).attr('y1', y(poi)).attr('y2', y(poi)).style('stroke', 'var(--text-secondary)').style('stroke-width', 2.5);
    var path = g.append('path').attr('d', d3.line().x(function (v) { return x(v); }).y(function (v) { return y(mem(v)); })(d3.range(1700, 2301, 2)))
      .style('fill', 'none').style('stroke', 'var(--megathrust)').style('stroke-width', 3);
    var len = path.node().getTotalLength(), dur = U.prefersReducedMotion() ? 0 : 1100;
    path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len).transition().duration(dur).attr('stroke-dashoffset', 0);
    g.append('line').attr('x1', x(NOW)).attr('x2', x(NOW)).attr('y1', CHART.top).attr('y2', CHART.bottom).style('stroke', 'var(--text-primary)').style('stroke-width', 1.5);
    g.append('text').attr('x', x(NOW) + 8).attr('y', y(mem(NOW)) - 10).attr('style', LAB).text('Today, with memory: ' + Math.round(mem(NOW) * 100) + '%');
    g.append('text').attr('x', x(NOW) + 8).attr('y', y(poi) + 20).attr('style', LAB).text('No memory: ' + Math.round(poi * 100) + '%');
    caption('Memory model: Brownian passage time, 500-year average, α = 0.5 (gives 14%; the report’s 15% matches a ~480-year average). See project 5.');
  }

  function sceneRecord() {
    var g = clearChart(); title(g, 'Great Cascadia earthquakes in the last 10,000 years');
    var ago = function (e) { return e.id === 'T1' ? NOW - 1700 : e.median + (NOW - 1950); };
    var x = d3.scaleLinear([10200, 0], [CHART.left, CHART.right]);
    [10000, 8000, 6000, 4000, 2000, 0].forEach(function (v) {
      g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 150).attr('y2', 360).style('stroke', 'var(--grid)');
      g.append('text').attr('x', x(v)).attr('y', 380).attr('text-anchor', 'middle').style('fill', 'var(--text-muted)').style('font-size', '12px').text(v === 0 ? 'today' : U.fmtInt(v) + ' yr ago');
    });
    g.append('text').attr('x', CHART.left).attr('y', 205).attr('style', SUB).text('Whole coast');
    g.append('text').attr('x', CHART.left).attr('y', 295).attr('style', SUB).text('Southern Cascadia only');
    var dur = U.prefersReducedMotion() ? 0 : 1600;
    T.events.forEach(function (e) {
      var cy = e.numbered ? 230 : 320;
      g.append('circle').attr('cx', x(ago(e))).attr('cy', cy).attr('r', 0).style('fill', 'var(--megathrust)').style('opacity', e.numbered ? 1 : 0.55)
        .style('stroke', 'var(--page)').style('stroke-width', 2)
        .transition().delay(dur * (1 - ago(e) / 10200)).duration(250).attr('r', e.numbered ? 9 : 7);
    });
    g.append('text').attr('x', x(NOW - 1700)).attr('y', 260).attr('text-anchor', 'end').attr('style', LAB).text('1700 →');
    g.append('text').attr('x', CHART.left).attr('y', 430).attr('style', SUB.replace('12px', '14px'))
      .text(T.events.filter(function (e) { return e.numbered; }).length + ' whole-coast and ' + T.events.filter(function (e) { return !e.numbered; }).length +
        ' partial ruptures dated from offshore sediment layers.');
    caption('Ages: Goldfinger and others (2012), USGS Professional Paper 1661-F. Explore every event in project 6.');
  }

  function scenePrepare() {
    var g = clearChart(); title(g, 'Your preparedness checklist');
    var done = checklistDone(), total = 5, cx = 400, cy = 260, r = 130;
    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r).style('fill', 'none').style('stroke', 'var(--grid)').style('stroke-width', 26);
    var arc = d3.arc().innerRadius(r - 13).outerRadius(r + 13).startAngle(0).cornerRadius(6);
    g.append('path').attr('class', 'progress').attr('transform', 'translate(' + cx + ',' + cy + ')').attr('d', arc.endAngle(2 * Math.PI * done / total)()).style('fill', 'var(--crustal)');
    g.append('text').attr('class', 'progress-text').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle').attr('dy', '0.32em')
      .attr('style', LAB.replace('14px', '48px')).text(done + ' / ' + total);
    g.append('text').attr('x', cx).attr('y', cy + 50).attr('text-anchor', 'middle').attr('style', SUB.replace('12px', '15px')).text('steps done');
    caption('Check items off in the text. Your progress is saved in this browser only.');
  }

  // ---------------------------------------------------------------- checklist
  var KEY = 'quake-story-checklist';
  function loadChecklist() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function checklistDone() { var s = loadChecklist(); return Object.keys(s).filter(function (k) { return s[k]; }).length; }
  function bindChecklist() {
    var s = loadChecklist();
    document.querySelectorAll('#checklist input').forEach(function (cb) {
      cb.checked = !!s[cb.dataset.item];
      cb.addEventListener('change', function () {
        var st = loadChecklist(); st[cb.dataset.item] = cb.checked;
        try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable */ }
        syncChecklist();
        if (current === 'prepare') scenePrepare();
      });
    });
    syncChecklist();
  }
  function syncChecklist() {
    var n = checklistDone();
    $('checklist-status').textContent = n === 5 ? 'All five done. Nice work.' : 'You’ve done ' + n + ' of 5.';
  }

  // ---------------------------------------------------------------- step switching
  var XS_STEPS = { plates: 1, crustal: 1, deep: 1, megathrust: 1 };
  var SCENES = { clock: sceneClock, formula: sceneFormula, odds: sceneOdds, memory: sceneMemory, record: sceneRecord, prepare: scenePrepare };
  function setStep(step) {
    if (step === current) return;
    current = step;
    document.querySelectorAll('.step').forEach(function (s) { s.classList.toggle('is-active', s.dataset.step === step); });
    $('scrolly').dataset.activeStep = step;
    if (XS_STEPS[step]) {
      if (!xsBuilt) buildCrossSection();
      fadeTo('xs'); updateCrossSection(step);
    } else {
      SCENES[step](); fadeTo('chart');
      svg.attr('aria-label', $('graphic-caption').textContent);
    }
  }

  function buildDive() {
    var items = [
      ['01', 'What are the odds?', 'The formula and all seven 50-year probabilities.', '01-probability-explorer'],
      ['02', 'Roll the next 50 years', 'Thousands of simulated futures on a map.', '02-monte-carlo'],
      ['03', 'What the record shows', '45 years of real earthquakes, and the report’s claims checked.', '03-earthquake-record'],
      ['04', 'Small quakes predict big ones', 'The Gutenberg–Richter rule and the b-value.', '04-small-quakes'],
      ['05', 'Memory or no memory?', 'Why the M9 odds are 10% or 15%.', '05-memory'],
      ['06', '10,000 years of great quakes', 'Every dated turbidite event.', '06-megathrust-history'],
      ['07', 'Inside the subduction zone', 'The sinking plate and its quakes in 3D.', '07-subduction-3d'],
      ['09', 'Three kinds of earthquakes', 'An animated explainer.', '09-three-quakes'],
      ['10', 'The orphan tsunami of 1700', 'How a Japanese record dated the last M9.', '10-orphan-tsunami'],
    ];
    var wrap = $('dive');
    items.forEach(function (it) {
      var a = el('a', 'card');
      a.href = '../' + it[3] + '/index.html';
      a.appendChild(el('span', 'num', it[0])); a.appendChild(el('h3', null, it[1])); a.appendChild(el('p', null, it[2]));
      wrap.appendChild(a);
    });
  }

  function init() {
    document.querySelectorAll('[data-elapsed]').forEach(function (n) { n.textContent = NOW - 1700; });
    bindChecklist();
    buildDive();
    var steps = document.querySelectorAll('.step');
    if ('IntersectionObserver' in window) {
      // Desktop: a step becomes active at the middle of the screen. Phones: the graphic is pinned to the top half and
      // the text scrolls over it, so a step activates lower down, once its card sits below the graphic.
      var narrow = window.matchMedia('(max-width: 860px)'), io = null;
      var observe = function () {
        if (io) io.disconnect();
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) setStep(en.target.dataset.step); });
        }, { rootMargin: narrow.matches ? '-70% 0px -25% 0px' : '-45% 0px -45% 0px' });
        steps.forEach(function (s) { io.observe(s); });
      };
      observe();
      if (narrow.addEventListener) narrow.addEventListener('change', observe);
    }
    steps.forEach(function (s) { s.addEventListener('focus', function () { setStep(s.dataset.step); }); });
    setStep('plates');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
