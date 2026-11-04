/*
 * Project 4: "Small quakes predict big ones". The report's Gutenberg–Richter estimate for Puget Sound
 * M6.5+ crustal quakes, rebuilt from the USGS catalog.
 *
 *   rate(≥M) = rate(≥4) · 10^(−b (M − 4))        recurrence(≥6.5) = 1 / rate(≥6.5)
 *   b from data (Aki 1965): b = log10(e) / (mean(M) − (Mmin − ΔM/2)), σ ≈ b / √n
 */
(function () {
  'use strict';

  var U = window.VizUtils, C = window.PNW_CATALOG, QM = window.QuakeMap, GEO = window.QuakeGeo;
  var $ = U.$, el = U.el;

  var DAY_MS = 86400000, END_YEAR = 2025, MMIN = 4.0, MTARGET = 6.5, DM = 0.1;
  var BOX = QM.VIEWS.puget;   // same Puget Sound area as project 3
  var REPORT = { paleo: 265, gr: 280, seattle: 1000, n: 20, start: 1960, depth: 30, b: 0.8 };

  var EVENTS = C.puget60.map(function (r) {
    var d = new Date(r[1] * DAY_MS);
    return { id: r[0], date: d, year: d.getUTCFullYear(), lon: r[2], lat: r[3], depth: r[4], mag: r[5], y: 0 };
  }).filter(function (e) {
    return e.lon >= BOX[0][0] && e.lon <= BOX[1][0] && e.lat >= BOX[0][1] && e.lat <= BOX[1][1];
  }).sort(function (a, b) { return a.date - b.date; });

  var state = { b: REPORT.b, depth: REPORT.depth, start: REPORT.start };
  var S = {};   // derived statistics
  var qmap = null;

  // ---------------------------------------------------------------- math
  function isCounted(e) { return e.depth < state.depth && e.year >= state.start; }
  function recurrence(b) { return 1 / (S.rate * Math.pow(10, -b * (MTARGET - MMIN))); }
  function p50(tau) { return 1 - Math.exp(-50 / tau); }
  function roundYears(y) { return y >= 100 ? Math.round(y / 10) * 10 : Math.round(y); }
  function fmtYears(y) { return isFinite(y) ? '~' + U.fmtInt(roundYears(y)) + ' years' : '–'; }
  function fmtDate(d) { return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); }

  function derive() {
    var counted = EVENTS.filter(isCounted);
    var n = counted.length, T = END_YEAR - state.start;
    var mean = n ? d3.mean(counted, function (e) { return e.mag; }) : NaN;
    var bML = n ? Math.LOG10E / (mean - (MMIN - DM / 2)) : NaN;
    S = { counted: counted, n: n, T: T, rate: n / T, bML: bML, bSigma: bML / Math.sqrt(n),
      maxMag: n ? d3.max(counted, function (e) { return e.mag; }) : MMIN };
    S.rec = recurrence(state.b);
  }

  // ---------------------------------------------------------------- the rule + pictograph
  function renderRule() {
    var b = state.b, step = Math.pow(10, b), ratio = Math.pow(10, b * (MTARGET - MMIN));
    $('b-out').textContent = b.toFixed(2);
    $('b-slider').value = b;
    $('b-fit-val').textContent = isFinite(S.bML) ? S.bML.toFixed(2) : '–';
    document.querySelector('[data-b="0.8"]').setAttribute('aria-pressed', String(Math.abs(b - 0.8) < 0.005));
    $('b-fit').setAttribute('aria-pressed', String(isFinite(S.bML) && Math.abs(b - S.bML) < 0.005));

    var f = $('rule-fact');
    f.textContent = 'With b = ' + b.toFixed(2) + ', each step of one magnitude is ';
    f.appendChild(el('strong', null, step.toFixed(1) + '× rarer'));
    f.appendChild(document.createTextNode(' (10^' + b.toFixed(2) + '). From M4 to M6.5 is 2.5 steps: '));
    f.appendChild(el('strong', null, Math.round(ratio) + '× rarer'));
    f.appendChild(document.createTextNode('.'));

    var R = Math.round(ratio), wrap = $('pictograph');
    $('picto-title').textContent = 'For every M6.5+ quake, about ' + U.fmtInt(R) + ' M4+ quakes';
    wrap.textContent = '';
    var dense = R > 300, cols = dense ? 40 : 20, size = dense ? 5 : 7;
    var grid = el('div', 'small-grid');
    grid.style.gridTemplateColumns = 'repeat(' + Math.min(cols, R) + ', ' + size + 'px)';
    for (var i = 0; i < R; i++) {
      var s = el('span');
      s.style.width = s.style.height = size + 'px';
      grid.appendChild(s);
    }
    var left = el('div');
    left.appendChild(grid);
    left.appendChild(el('div', 'grid-label', U.fmtInt(R) + ' × M4+'));
    var big = el('div', 'big');
    big.appendChild(el('span', 'sq'));
    big.appendChild(document.createTextNode('1 × M6.5+'));
    wrap.appendChild(left);
    wrap.appendChild(big);
    wrap.setAttribute('aria-label', 'Pictograph: ' + R + ' small squares for M4+ quakes versus one large square for an M6.5+ quake.');
    $('picto-note').textContent = S.n
      ? 'Puget Sound records about ' + S.rate.toFixed(2) + ' M4+ crustal quakes a year, so collecting ' + U.fmtInt(R) +
        ' of them takes about ' + U.fmtInt(roundYears(R / S.rate)) + ' years. That is the expected time between M6.5+ quakes.'
      : 'No quakes match the current setup.';
  }

  // ---------------------------------------------------------------- tiles + note
  function renderTiles() {
    var t = [
      ['Crustal quakes counted', U.fmtInt(S.n), S.n ? 'M' + MMIN.toFixed(1) + '–M' + S.maxMag.toFixed(1) + ', shallower than ' + state.depth + ' km' : 'none'],
      ['Years of record', String(S.T), state.start + '–2024'],
      ['M4+ per year', S.n ? S.rate.toFixed(2) : '0', S.n ? 'one every ' + (1 / S.rate).toFixed(1) + ' years' : ''],
      ['M6.5+ about every', S.n ? U.fmtInt(roundYears(S.rec)) + ' yr' : '–', 'b = ' + state.b.toFixed(2), 'hero'],
      ['Chance in 50 years', S.n ? U.fmtPct(p50(S.rec)) : '–', 'report: 17%'],
    ];
    var wrap = $('tiles');
    wrap.textContent = '';
    t.forEach(function (x) {
      var d = el('div', 'tile' + (x[3] ? ' ' + x[3] : ''));
      d.appendChild(el('div', 't-label', x[0]));
      d.appendChild(el('div', 't-value', x[1]));
      d.appendChild(el('div', 't-sub', x[2]));
      wrap.appendChild(d);
    });
    $('n-title').textContent = S.n;

    var same = S.n === REPORT.n && state.start === REPORT.start && S.maxMag === 5.4;
    var note = $('reproduce-note');
    note.textContent = '';
    if (same) {
      note.appendChild(el('strong', null, 'Same 20 quakes as the report (M4.0–5.4, 1960–2024). '));
      note.appendChild(document.createTextNode('The simplest calculation with b = 0.8 is 20 ÷ 65 years × 10^(−0.8 × 2.5), about once every ' +
        U.fmtInt(roundYears(recurrence(0.8))) + ' years. The report gives ~280 years. The fact sheet doesn’t describe its exact fitting ' +
        'method (for example, how magnitudes are binned), which can easily shift the result this much. Both are close to the ~265 years ' +
        'from the geological record, which is the report’s point.'));
    } else {
      note.appendChild(document.createTextNode('This setup counts ' + S.n + ' quakes instead of the report’s 20. Press "Use the report’s setup" to match it.'));
    }
  }

  // ---------------------------------------------------------------- map
  function initMap() {
    qmap = QM.create({
      wrap: $('map-wrap'), canvas: $('map'), tooltip: $('map-tip'),
      layers: { sources: false, deepZone: false, history: false, zone: false },
      colorOf: function (e) { return isCounted(e) ? '--crustal' : '--context'; },
      radiusOf: function (m) { return 3.5 + (m - 4) * 3; },
      describeEvent: function (e) {
        var why = isCounted(e) ? 'Counted: shallow crustal quake'
          : e.year < state.start ? 'Not counted: before ' + state.start
          : 'Not counted: ' + Math.max(0, Math.round(e.depth)) + ' km is deeper than ' + state.depth + ' km (intraslab)';
        return { title: 'M' + e.mag.toFixed(1) + ' · ' + fmtDate(e.date),
          lines: [GEO.describe(e.lon, e.lat), Math.max(0, Math.round(e.depth)) + ' km deep', why] };
      },
    });
    qmap.zoomTo('puget');
    $('zoom-in').addEventListener('click', function () { qmap.zoomBy(1.6); });
    $('zoom-out').addEventListener('click', function () { qmap.zoomBy(1 / 1.6); });
    $('zoom-reset').addEventListener('click', function () { qmap.zoomTo('puget'); });
    var lg = $('map-legend');
    [['var(--crustal)', 'Counted (crustal)'], ['var(--context)', 'Not counted']].forEach(function (p) {
      var it = el('span', 'legend-item'), d = el('span', 'key-rect');
      d.style.background = p[0]; d.style.borderRadius = '50%';
      it.appendChild(d); it.appendChild(document.createTextNode(p[1]));
      lg.appendChild(it);
    });
  }
  function renderMap() {
    // Larger quakes are drawn first by the component; all events are "visible" (y = 0 ≤ playhead).
    qmap.setScene({ events: EVENTS, playhead: 1, mode: 'one', pulse: false });
  }

  // ---------------------------------------------------------------- Gutenberg–Richter chart
  var gr = {};
  function buildGrLegend() {
    var lg = $('gr-legend');
    var a = el('span', 'legend-item'), dot = el('span', 'key-rect');
    dot.style.background = 'var(--text-primary)'; dot.style.borderRadius = '50%'; dot.style.width = dot.style.height = '9px';
    a.appendChild(dot); a.appendChild(document.createTextNode('Recorded'));
    var b = el('span', 'legend-item'); b.appendChild(U.keyLine('var(--crustal)')); b.appendChild(document.createTextNode('Gutenberg–Richter line'));
    var c = el('span', 'legend-item'), k = U.keyLine('var(--crustal)'); k.style.opacity = '0.45';
    c.appendChild(k); c.appendChild(document.createTextNode('Extrapolated'));
    [a, b, c].forEach(function (x) { lg.appendChild(x); });
  }

  function renderGr(animate) {
    var wrap = $('gr-wrap'), root = $('gr-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = W < 520 ? 300 : 360, m = { top: 16, right: 16, bottom: 34, left: W < 520 ? 74 : 96 };
    var x = d3.scaleLinear([MMIN, 7.2], [m.left, W - m.right]);
    var y = d3.scaleLog([1e-4, 2], [H - m.bottom, m.top]);
    gr = { x: x, y: y, m: m, W: W, H: H };
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    var yt = [[1, '1 per year'], [0.1, '1 per 10 yr'], [0.01, '1 per 100 yr'], [0.001, '1 per 1,000 yr'], [0.0001, '1 per 10,000 yr']];
    yt.forEach(function (t) {
      U.svg('line', { x1: m.left, x2: W - m.right, y1: y(t[0]), y2: y(t[0]), style: 'stroke: var(--grid); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 8, y: y(t[0]), dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root)
        .textContent = W < 520 ? t[1].replace(' per ', '/').replace(' yr', 'y').replace('1/year', '1/y') : t[1];
    });
    for (var mm = 4; mm <= 7; mm += 0.5) {
      U.svg('text', { x: x(mm), y: H - 12, 'text-anchor': 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = 'M' + mm;
    }
    U.svg('line', { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom, style: 'stroke: var(--axis); stroke-width: 1' }, root);
    if (!S.n) {
      U.svg('text', { x: (m.left + W) / 2, y: H / 2, 'text-anchor': 'middle', style: 'fill: var(--text-secondary); font-size: 14px' }, root)
        .textContent = 'No quakes match this setup.';
      return;
    }

    function rate(M) { return S.rate * Math.pow(10, -state.b * (M - MMIN)); }
    var split = Math.max(S.maxMag, 5);
    function path(a, b) { var d = ''; for (var i = 0; i <= 40; i++) { var M = a + (b - a) * i / 40; d += (i ? 'L' : 'M') + x(M).toFixed(1) + ',' + y(rate(M)).toFixed(1); } return d; }
    U.svg('path', { d: path(MMIN, split), fill: 'none', style: 'stroke: var(--crustal); stroke-width: 2.5; stroke-linecap: round' }, root);
    var ext = U.svg('path', { d: path(split, 7.2), fill: 'none', class: 'gr-extrap', style: 'stroke: var(--crustal); stroke-width: 2.5; stroke-opacity: 0.45; stroke-linecap: round' }, root);
    gr.ext = ext;

    // M6.5 readout
    var r65 = rate(MTARGET), px = x(MTARGET), py = y(r65);
    var guide = U.svg('g', { class: 'gr-guide' }, root);
    U.svg('line', { x1: px, x2: px, y1: H - m.bottom, y2: py, style: 'stroke: var(--text-muted); stroke-width: 1' }, guide);
    U.svg('line', { x1: m.left, x2: px, y1: py, y2: py, style: 'stroke: var(--text-muted); stroke-width: 1' }, guide);
    U.svg('circle', { cx: px, cy: py, r: 6, style: 'fill: var(--megathrust); stroke: var(--surface-1); stroke-width: 2' }, guide);
    var lab = 'fill: var(--text-primary); font-size: 13px; font-weight: 650; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round';
    U.svg('text', { x: px - 10, y: py - 12, 'text-anchor': 'end', style: lab }, guide).textContent = 'M6.5+: about once every ' + U.fmtInt(roundYears(1 / r65)) + ' years';
    gr.guide = guide;

    // Recorded cumulative counts
    var pts = [];
    for (var k = 0; MMIN + k * DM <= S.maxMag + 1e-9; k++) {
      var M = Math.round((MMIN + k * DM) * 10) / 10;
      var N = S.counted.filter(function (e) { return e.mag >= M - 1e-9; }).length;
      if (N) pts.push({ M: M, N: N, rate: N / S.T });
    }
    gr.pts = pts;
    pts.forEach(function (p) {
      U.svg('circle', { cx: x(p.M), cy: y(p.rate), r: 4.5, style: 'fill: var(--text-primary); stroke: var(--surface-1); stroke-width: 2' }, root);
    });
    U.svg('text', { x: x(MMIN) + 8, y: y(pts[0].rate) - 10, style: lab.replace('650', '500').replace('13px', '12px') }, root)
      .textContent = S.n + ' quakes M4+ in ' + S.T + ' years';

    gr.hover = U.svg('line', { y1: m.top, y2: H - m.bottom, visibility: 'hidden', style: 'stroke: var(--text-muted); stroke-width: 1; pointer-events: none' }, root);
    var hit = U.svg('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, fill: 'transparent' }, root);
    hit.addEventListener('pointermove', grHover);
    hit.addEventListener('pointerleave', function () { gr.hover.setAttribute('visibility', 'hidden'); $('gr-tip').hidden = true; });
    root.setAttribute('aria-label', 'Log-scale chart: recorded quake rates from M4 to M' + S.maxMag.toFixed(1) +
      ' and a Gutenberg–Richter line with b = ' + state.b.toFixed(2) + ', extended to M6.5: about once every ' + roundYears(1 / r65) + ' years.');

    if (animate) extendLine();
  }

  function extendLine() {
    var ext = gr.ext; if (!ext) return;
    var len = ext.getTotalLength();
    ext.style.transition = 'none';
    ext.style.strokeDasharray = len; ext.style.strokeDashoffset = len;
    gr.guide.style.opacity = 0;
    ext.getBoundingClientRect();
    ext.style.transition = '';
    ext.style.strokeDashoffset = 0;
    var delay = U.prefersReducedMotion() ? 0 : 1500;
    setTimeout(function () { if (gr.guide) { gr.guide.style.transition = 'opacity 0.4s'; gr.guide.style.opacity = 1; } }, delay);
  }

  function grHover(ev) {
    var rect = $('gr-chart').getBoundingClientRect();
    var M = Math.round(gr.x.invert(ev.clientX - rect.left) * 10) / 10;
    M = Math.max(MMIN, Math.min(7.2, M));
    var px = gr.x(M);
    gr.hover.setAttribute('x1', px); gr.hover.setAttribute('x2', px); gr.hover.setAttribute('visibility', 'visible');
    var line = S.rate * Math.pow(10, -state.b * (M - MMIN));
    var tip = $('gr-tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', 'M' + M.toFixed(1) + ' or larger'));
    var row = el('div', 'tip-row');
    row.appendChild(U.keyLine('var(--crustal)'));
    row.appendChild(el('strong', null, 'every ' + U.fmtInt(roundYears(1 / line)) + ' yr'));
    row.appendChild(el('span', null, 'from the line'));
    tip.appendChild(row);
    var p = gr.pts.filter(function (q) { return Math.abs(q.M - M) < 1e-6; })[0];
    if (p) {
      var r2 = el('div', 'tip-row');
      r2.appendChild(U.keyLine('var(--text-primary)'));
      r2.appendChild(el('strong', null, p.N + ' quakes'));
      r2.appendChild(el('span', null, 'recorded in ' + S.T + ' years'));
      tip.appendChild(r2);
    }
    tip.hidden = false;
    var left = px + 12;
    if (left + tip.offsetWidth > gr.W) left = px - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = gr.m.top + 'px';
  }

  // ---------------------------------------------------------------- sensitivity
  function renderSensitivity() {
    var wrap = $('sens-wrap'), root = $('sens-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = 280, m = { top: 16, right: 16, bottom: 36, left: 64 };
    var x = d3.scaleLinear([0.6, 1.2], [m.left, W - m.right]);
    var y = d3.scaleLog([30, 10000], [H - m.bottom, m.top]);
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    [30, 100, 300, 1000, 3000, 10000].forEach(function (v) {
      U.svg('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), style: 'stroke: var(--grid); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 8, y: y(v), dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = U.fmtInt(v) + ' yr';
    });
    [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2].forEach(function (v) {
      U.svg('text', { x: x(v), y: H - 16, 'text-anchor': 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = v.toFixed(1);
    });
    U.svg('text', { x: (m.left + W - m.right) / 2, y: H - 2, 'text-anchor': 'middle', style: 'fill: var(--text-muted); font-size: 12px' }, root).textContent = 'b-value';
    if (!S.n) return;

    // Range of b the data allow (±1σ), and the report's estimates band
    if (isFinite(S.bML)) {
      var b0 = Math.max(0.6, S.bML - S.bSigma), b1 = Math.min(1.2, S.bML + S.bSigma);
      U.svg('rect', { x: x(b0), y: m.top, width: Math.max(0, x(b1) - x(b0)), height: H - m.top - m.bottom, style: 'fill: var(--crustal); opacity: 0.12' }, root);
    }
    U.svg('rect', { x: m.left, y: y(REPORT.gr), width: W - m.left - m.right, height: Math.max(2, y(REPORT.paleo) - y(REPORT.gr)),
      style: 'fill: var(--megathrust); opacity: 0.35' }, root);

    var d = '';
    for (var i = 0; i <= 60; i++) { var b = 0.6 + 0.6 * i / 60; d += (i ? 'L' : 'M') + x(b).toFixed(1) + ',' + y(Math.min(10000, recurrence(b))).toFixed(1); }
    U.svg('path', { d: d, fill: 'none', style: 'stroke: var(--crustal); stroke-width: 2.5' }, root);

    var cx = x(state.b), cy = y(Math.min(10000, recurrence(state.b)));
    U.svg('circle', { cx: cx, cy: cy, r: 6, style: 'fill: var(--crustal); stroke: var(--surface-1); stroke-width: 2' }, root);
    var lab = 'fill: var(--text-primary); font-size: 13px; font-weight: 650; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round';
    var right = cx < W * 0.6;
    U.svg('text', { x: cx + (right ? 10 : -10), y: cy - 10, 'text-anchor': right ? 'start' : 'end', style: lab }, root)
      .textContent = 'b = ' + state.b.toFixed(2) + ' → ~' + U.fmtInt(roundYears(recurrence(state.b))) + ' yr';

    var hover = U.svg('line', { y1: m.top, y2: H - m.bottom, visibility: 'hidden', style: 'stroke: var(--text-muted); stroke-width: 1; pointer-events: none' }, root);
    var hit = U.svg('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, fill: 'transparent', style: 'cursor: pointer' }, root);
    var tip = $('sens-tip');
    function bAt(ev) { var r = root.getBoundingClientRect(); return Math.max(0.6, Math.min(1.2, Math.round(x.invert(ev.clientX - r.left) * 100) / 100)); }
    hit.addEventListener('pointermove', function (ev) {
      var b = bAt(ev), px = x(b);
      hover.setAttribute('x1', px); hover.setAttribute('x2', px); hover.setAttribute('visibility', 'visible');
      tip.textContent = '';
      tip.appendChild(el('div', 'tip-value', '~' + U.fmtInt(roundYears(recurrence(b))) + ' years'));
      tip.appendChild(el('div', 'tip-head', 'b = ' + b.toFixed(2) + ' · ' + U.fmtPct(p50(recurrence(b))) + ' chance in 50 years'));
      tip.appendChild(el('p', null, 'Click to use this b-value'));
      tip.hidden = false;
      var left = px + 12; if (left + tip.offsetWidth > W) left = px - 12 - tip.offsetWidth;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = m.top + 'px';
    });
    hit.addEventListener('pointerleave', function () { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    hit.addEventListener('click', function (ev) { setB(bAt(ev)); });
    root.setAttribute('aria-label', 'Years between M6.5+ quakes as the b-value changes from 0.6 to 1.2.');

    var lg = $('sens-legend');
    lg.textContent = '';
    var a = el('span', 'legend-item'); a.appendChild(U.keyLine('var(--crustal)')); a.appendChild(document.createTextNode('From these ' + S.n + ' quakes'));
    var bb = el('span', 'legend-item'); bb.appendChild(el('span', 'key-band')); bb.appendChild(document.createTextNode('b-values the data allow (±1σ)'));
    var rb = el('span', 'legend-item'), rk = el('span', 'key-band');
    rk.style.background = 'var(--megathrust)'; rk.style.opacity = '0.5';
    rb.appendChild(rk); rb.appendChild(document.createTextNode("Report's estimates (265–280 yr)"));
    lg.appendChild(a); lg.appendChild(bb); lg.appendChild(rb);

    var t = $('sens-text');
    t.textContent = 'With these ' + S.n + ' quakes, b = 0.8 gives ~' + U.fmtInt(roundYears(recurrence(0.8))) + ' years and b = 1.0 gives ~' +
      U.fmtInt(roundYears(recurrence(1.0))) + ' years. The quakes themselves suggest b ≈ ' + S.bML.toFixed(2) + ' ± ' + S.bSigma.toFixed(2) +
      ', too uncertain to choose between them. That’s why the report uses the well-measured western-U.S. value. Click the chart to try a b-value.';
  }

  // ---------------------------------------------------------------- comparison
  function renderComparison() {
    var wrap = $('cmp-wrap'), root = $('cmp-chart');
    var W = wrap.clientWidth; if (!W) return;
    var rows = [
      { label: 'Geological record of past ruptures, all Puget Sound crustal faults (report)', short: 'Geological record (report)', v: REPORT.paleo, src: 'report' },
      { label: 'Small quakes + b = 0.8 (report)', short: 'Small quakes, b = 0.8 (report)', v: REPORT.gr, src: 'report' },
      { label: 'Small quakes + b = 0.8 (this page, ' + S.n + ' quakes)', short: 'Small quakes, b = 0.8 (this page)', v: S.n ? recurrence(0.8) : NaN, src: 'page' },
      { label: 'Small quakes + b fitted to them (' + (isFinite(S.bML) ? S.bML.toFixed(2) : '–') + ', this page)',
        short: 'Small quakes, fitted b (this page)', v: S.n ? recurrence(S.bML) : NaN, src: 'page' },
      { label: 'Seattle Fault Zone only, one of many faults (report, from the hazard model)', short: 'Seattle Fault only (report)', v: REPORT.seattle, src: 'report' },
    ];
    var narrow = W < 640;
    var rowH = 54, m = { top: 8, right: 16, bottom: 30, left: 12 }, H = m.top + rows.length * rowH + m.bottom;
    var x = d3.scaleLog([100, 3000], [m.left, W - m.right - (W < 520 ? 70 : 150)]);
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';
    [100, 300, 1000, 3000].forEach(function (v) {
      U.svg('line', { x1: x(v), x2: x(v), y1: m.top, y2: H - m.bottom, style: 'stroke: var(--grid); stroke-width: 1' }, root);
      U.svg('text', { x: x(v), y: H - 10, 'text-anchor': 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = U.fmtInt(v) + ' yr';
    });
    rows.forEach(function (r, i) {
      var y0 = m.top + i * rowH;
      U.svg('text', { x: m.left, y: y0 + 14, style: 'fill: var(--text-primary); font-size: 13px' }, root).textContent = narrow ? r.short : r.label;
      var cy = y0 + 34;
      U.svg('line', { x1: x(100), x2: x(3000), y1: cy, y2: cy, style: 'stroke: var(--grid); stroke-width: 1' }, root);
      if (!isFinite(r.v)) return;
      var cx = x(Math.max(100, Math.min(3000, r.v)));
      U.svg('circle', { cx: cx, cy: cy, r: 7, style: 'fill: ' + (r.src === 'page' ? 'var(--crustal)' : 'var(--text-primary)') + '; stroke: var(--surface-1); stroke-width: 2' }, root);
      U.svg('text', { x: W - m.right, y: cy, dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums' }, root)
        // The report's own numbers are shown exactly as published; values computed here are rounded.
        .textContent = (r.src === 'report' ? '' : '~') + U.fmtInt(r.src === 'report' ? r.v : roundYears(r.v)) + ' yr' +
          (W < 520 ? '' : ' · ' + U.fmtPct(p50(r.v)) + ' in 50 yr');
    });
    root.setAttribute('aria-label', 'Dot plot comparing recurrence estimates: ' + rows.map(function (r) { return r.label + ' ' + Math.round(r.v) + ' years'; }).join('; '));
  }

  // ---------------------------------------------------------------- table
  function renderTable() {
    var body = $('quake-table');
    body.textContent = '';
    EVENTS.forEach(function (e) {
      var tr = el('tr');
      tr.appendChild(el('td', null, fmtDate(e.date)));
      tr.appendChild(el('td', 'num', 'M' + e.mag.toFixed(1)));
      tr.appendChild(el('td', 'num', Math.max(0, Math.round(e.depth)) + ' km'));
      tr.appendChild(el('td', null, GEO.describe(e.lon, e.lat)));
      tr.appendChild(el('td', null, isCounted(e) ? 'Yes' : e.year < state.start ? 'No (before ' + state.start + ')' : 'No (too deep)'));
      body.appendChild(tr);
    });
  }

  // ---------------------------------------------------------------- wiring
  function syncControls() {
    $('depth-out').textContent = state.depth + ' km';
    $('depth-slider').value = state.depth;
    document.querySelectorAll('#start-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.start === state.start));
    });
  }

  function setB(b) { state.b = Math.max(0.6, Math.min(1.2, b)); renderB(); }
  function renderB() { S.rec = recurrence(state.b); renderRule(); renderTiles(); renderGr(false); renderSensitivity(); }

  function renderAll(animate) {
    derive(); syncControls(); renderRule(); renderTiles(); renderMap(); renderGr(animate); renderSensitivity(); renderComparison(); renderTable();
  }

  function init() {
    initMap();
    buildGrLegend();
    $('b-slider').addEventListener('input', function (ev) { setB(+ev.target.value); });
    document.querySelector('[data-b="0.8"]').addEventListener('click', function () { setB(0.8); });
    $('b-fit').addEventListener('click', function () { if (isFinite(S.bML)) setB(Math.round(S.bML * 100) / 100); });
    $('depth-slider').addEventListener('input', function (ev) { state.depth = +ev.target.value; renderAll(false); });
    document.querySelectorAll('#start-buttons button').forEach(function (b) {
      b.addEventListener('click', function () { state.start = +b.dataset.start; renderAll(false); });
    });
    $('reset-btn').addEventListener('click', function () {
      state.b = REPORT.b; state.depth = REPORT.depth; state.start = REPORT.start; renderAll(true);
    });
    $('extend-btn').addEventListener('click', extendLine);
    document.addEventListener('quake-themechange', function () { qmap.refreshTheme(); });

    renderAll(true);
    var pending = null, lastW = 0;
    function onResize() {
      var w = document.querySelector('.page').clientWidth;
      if (pending || w === lastW) return;
      lastW = w;
      pending = requestAnimationFrame(function () { pending = null; renderRule(); renderGr(false); renderSensitivity(); renderComparison(); });
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.querySelector('.page'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
