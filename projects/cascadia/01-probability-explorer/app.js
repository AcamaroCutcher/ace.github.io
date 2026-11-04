/*
 * Project 1: "Odds in 50 Years" probability explorer.
 * No dependencies: plain DOM + SVG. Data lives in ../shared/quake-data.js.
 */
(function () {
  'use strict';

  var Q = window.QUAKE;
  var P = Q.poisson;

  var TAU_MIN = 5, TAU_MAX = 5000, T_MAX = 200, DEFAULT_T = 50;
  var LOG_MIN = Math.log10(TAU_MIN), LOG_MAX = Math.log10(TAU_MAX);
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Only time-independent scenarios can be reproduced with the formula, so only they are presets.
  var presets = Q.scenarios.filter(function (s) { return s.model === 'time-independent'; });
  var byId = {};
  Q.scenarios.forEach(function (s) { byId[s.id] = s; });

  var state = { tau: 26, t: DEFAULT_T, selected: 'deep-puget' };

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(tag, attrs, parent) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function fmtPct(p) {
    var v = p * 100;
    if (v > 0 && v < 0.1) return '<0.1%';
    if (v < 1) return v.toFixed(1) + '%';
    if (v >= 99.5 && v < 100) return '>99%';
    return Math.round(v) + '%';
  }

  function fmtYears(n) { return Math.round(n).toLocaleString('en-US') + (Math.round(n) === 1 ? ' year' : ' years'); }

  function niceTau(raw) {
    if (raw < 100) return Math.round(raw);
    if (raw < 1000) return Math.round(raw / 5) * 5;
    return Math.round(raw / 10) * 10;
  }
  function tauToSlider(tau) { return Math.round((Math.log10(tau) - LOG_MIN) / (LOG_MAX - LOG_MIN) * 1000); }
  function sliderToTau(v) { return niceTau(Math.pow(10, LOG_MIN + (v / 1000) * (LOG_MAX - LOG_MIN))); }

  function selectedScenario() { return state.selected === 'custom' ? null : byId[state.selected]; }
  function colorOf(s) { return s ? Q.types[s.type].color : 'var(--custom)'; }

  function keyLine(color) {
    var k = el('span', 'key-line');
    k.style.background = color;
    return k;
  }

  // ---------- chips ----------
  function buildChips() {
    var wrap = document.querySelector('.chips');
    presets.concat([{ id: 'custom', name: 'Custom' }]).forEach(function (s) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.dataset.id = s.id;
      var dot = el('span', 'dot');
      dot.style.background = s.id === 'custom' ? 'var(--custom)' : Q.types[s.type].color;
      b.appendChild(dot);
      b.appendChild(document.createTextNode(s.id === 'custom' ? 'Custom' : s.name));
      b.addEventListener('click', function () {
        if (s.id === 'custom') { state.selected = 'custom'; update(); }
        else selectScenario(s.id);
      });
      wrap.appendChild(b);
    });
  }

  function selectScenario(id) {
    var s = byId[id];
    if (!s || s.model !== 'time-independent') return;
    state.selected = id;
    state.tau = s.tau;
    $('tau-slider').value = tauToSlider(s.tau);
    update();
  }

  // ---------- readout ----------
  function renderReadout() {
    var s = selectedScenario();
    var p = P(state.tau, state.t);
    var survive = Math.exp(-state.t / state.tau);

    $('hero-value').textContent = fmtPct(p);
    $('hero-text').textContent = s
      ? 'chance of at least one ' + s.sentence + ' in the next ' + fmtYears(state.t) + '.'
      : 'chance of at least one event in the next ' + fmtYears(state.t) +
        ', if events happen on average every ' + fmtYears(state.tau) + '.';

    var f = $('formula-filled');
    f.textContent = '';
    f.appendChild(document.createTextNode('P = 1 − e'));
    var sup = el('sup', null, '−' + state.t + ' / ' + state.tau.toLocaleString('en-US'));
    f.appendChild(sup);
    f.appendChild(document.createTextNode(' = 1 − ' + survive.toFixed(3) + ' = ' + p.toFixed(3)));

    $('fact-annual').textContent = fmtPct(P(state.tau, 1));
    $('fact-none').textContent = fmtPct(survive);
    $('tau-out').textContent = fmtYears(state.tau);
    $('t-out').textContent = fmtYears(state.t);

    var basis = $('basis');
    basis.textContent = '';
    if (s) {
      basis.appendChild(el('strong', null, 'Where τ = ' + s.tauLabel + ' comes from: '));
      basis.appendChild(document.createTextNode(s.basis + ' (report p. ' + s.page + ')'));
    } else {
      basis.appendChild(el('strong', null, 'Custom value. '));
      basis.appendChild(document.createTextNode('Pick a source above to load one of the report’s recurrence intervals.'));
    }

    document.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.id === state.selected));
    });
    document.querySelectorAll('.bar-row').forEach(function (r) {
      if (!r.classList.contains('is-td')) r.setAttribute('aria-pressed', String(r.dataset.id === state.selected));
    });

    // Curve legend: selected series + context series
    var lg = $('curve-legend');
    lg.textContent = '';
    var a = el('span', 'legend-item');
    a.appendChild(keyLine(colorOf(s)));
    a.appendChild(document.createTextNode(s ? s.name : 'Custom (τ = ' + fmtYears(state.tau) + ')'));
    lg.appendChild(a);
    var b = el('span', 'legend-item');
    b.appendChild(keyLine('var(--context)'));
    b.appendChild(document.createTextNode(s ? 'Other sources in the report' : 'Sources in the report'));
    lg.appendChild(b);
  }

  // ---------- chart ----------
  var chart = { geom: null };

  function curvePath(tau, x, y, close) {
    var d = '';
    for (var yr = 0; yr <= T_MAX; yr++) d += (yr ? 'L' : 'M') + x(yr).toFixed(1) + ',' + y(P(tau, yr)).toFixed(1);
    if (close) d += 'L' + x(T_MAX) + ',' + y(0) + 'L' + x(0) + ',' + y(0) + 'Z';
    return d;
  }

  function renderChart() {
    var wrap = $('chart-wrap');
    var root = $('chart');
    var W = wrap.clientWidth;
    if (!W) return;
    var narrow = W < 560;
    var H = narrow ? 280 : 360;
    var m = { top: 16, right: 16, bottom: 56, left: 44 };
    var iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    function x(yr) { return m.left + (yr / T_MAX) * iw; }
    function y(p) { return m.top + (1 - p) * ih; }
    chart.geom = { m: m, iw: iw, ih: ih, x: x, y: y, W: W, H: H };

    root.setAttribute('width', W);
    root.setAttribute('height', H);
    root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    var s = selectedScenario();
    var p = P(state.tau, state.t);

    // Gridlines + y ticks
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      svg('line', { x1: m.left, x2: m.left + iw, y1: y(v), y2: y(v),
        style: 'stroke: var(' + (v === 0 ? '--axis' : '--grid') + '); stroke-width: 1' }, root);
      var t = svg('text', { x: m.left - 8, y: y(v), dy: '0.32em', 'text-anchor': 'end',
        style: 'fill: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums' }, root);
      t.textContent = Math.round(v * 100) + '%';
    });

    // X ticks
    var step = narrow ? 50 : 25;
    for (var yr = 0; yr <= T_MAX; yr += step) {
      var tx = svg('text', { x: x(yr), y: m.top + ih + 18, 'text-anchor': 'middle',
        style: 'fill: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums' }, root);
      tx.textContent = yr;
    }
    var bl = svg('text', { x: x(50), y: m.top + ih + 36, 'text-anchor': 'middle',
      style: 'fill: var(--text-secondary); font-size: 12px' }, root);
    bl.textContent = '↑ typical building lifetime';
    var at = svg('text', { x: m.left + iw, y: m.top + ih + 36, 'text-anchor': 'end',
      style: 'fill: var(--text-muted); font-size: 12px' }, root);
    at.textContent = 'years from now';

    // Context curves (other presets)
    presets.forEach(function (o) {
      if (s && o.id === s.id) return;
      svg('path', { d: curvePath(o.tau, x, y), fill: 'none',
        style: 'stroke: var(--context); stroke-width: 1.5; stroke-linejoin: round' }, root);
    });

    // Selected curve with a 10% wash
    var color = colorOf(s);
    svg('path', { d: curvePath(state.tau, x, y, true), style: 'fill: ' + color + '; fill-opacity: 0.1; stroke: none' }, root);
    svg('path', { d: curvePath(state.tau, x, y), fill: 'none',
      style: 'stroke: ' + color + '; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round' }, root);

    // Marker at (t, P)
    var mx = x(state.t), my = y(p);
    svg('line', { x1: mx, x2: mx, y1: y(0), y2: my, style: 'stroke: var(--text-muted); stroke-width: 1' }, root);
    svg('line', { x1: m.left, x2: mx, y1: my, y2: my, style: 'stroke: var(--text-muted); stroke-width: 1' }, root);
    svg('circle', { cx: mx, cy: my, r: 5, style: 'fill: ' + color + '; stroke: var(--surface-1); stroke-width: 2' }, root);
    var flip = mx > m.left + iw - 130;
    var lbl = svg('text', {
      x: mx + (flip ? -10 : 10), y: p > 0.9 ? my + 20 : my - 10,
      'text-anchor': flip ? 'end' : 'start',
      style: 'fill: var(--text-primary); font-size: 14px; font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round',
    }, root);
    lbl.textContent = fmtPct(p) + ' in ' + state.t + ' yr';

    // Hover layer
    chart.hover = svg('g', { style: 'pointer-events: none', visibility: 'hidden' }, root);
    chart.hoverLine = svg('line', { y1: m.top, y2: m.top + ih, style: 'stroke: var(--text-muted); stroke-width: 1' }, chart.hover);
    chart.hoverDot = svg('circle', { r: 4, style: 'fill: ' + color + '; stroke: var(--surface-1); stroke-width: 2' }, chart.hover);
    var hit = svg('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' }, root);
    hit.addEventListener('pointermove', onHover);
    hit.addEventListener('pointerleave', hideHover);

    root.setAttribute('aria-label',
      'Line chart: chance of at least one quake over the next 0 to 200 years for an average recurrence of ' +
      fmtYears(state.tau) + '. At ' + state.t + ' years the chance is ' + fmtPct(p) + '.');
  }

  function onHover(ev) {
    var g = chart.geom;
    var rect = $('chart').getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var yr = Math.max(0, Math.min(T_MAX, Math.round(((px - g.m.left) / g.iw) * T_MAX)));
    var hx = g.x(yr);
    chart.hover.setAttribute('visibility', 'visible');
    chart.hoverLine.setAttribute('x1', hx);
    chart.hoverLine.setAttribute('x2', hx);
    chart.hoverDot.setAttribute('cx', hx);
    chart.hoverDot.setAttribute('cy', g.y(P(state.tau, yr)));

    var s = selectedScenario();
    var rows = [{ name: s ? s.name : 'Custom (τ = ' + fmtYears(state.tau) + ')', p: P(state.tau, yr), color: colorOf(s), sel: true }];
    presets
      .filter(function (o) { return !s || o.id !== s.id; })
      .map(function (o) { return { name: o.name, p: P(o.tau, yr), color: 'var(--context)' }; })
      .sort(function (a, b) { return b.p - a.p; })
      .forEach(function (r) { rows.push(r); });

    var tip = $('chart-tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', yr === 0 ? 'Today' : 'Within ' + fmtYears(yr)));
    rows.forEach(function (r) {
      var row = el('div', 'tip-row' + (r.sel ? ' is-selected' : ''));
      row.appendChild(keyLine(r.color));
      row.appendChild(el('strong', null, fmtPct(r.p)));
      row.appendChild(el('span', null, r.name));
      tip.appendChild(row);
    });
    tip.hidden = false;
    var tw = tip.offsetWidth;
    var left = hx + 14;
    if (left + tw > g.W) left = hx - 14 - tw;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = g.m.top + 'px';
  }

  function hideHover() {
    if (chart.hover) chart.hover.setAttribute('visibility', 'hidden');
    $('chart-tip').hidden = true;
  }

  // ---------- comparison bars ----------
  function buildBars() {
    var lg = $('type-legend');
    Object.keys(Q.types).forEach(function (k) {
      var it = el('span', 'legend-item');
      var sw = el('span', 'key-rect');
      sw.style.background = Q.types[k].color;
      it.appendChild(sw);
      it.appendChild(document.createTextNode(Q.types[k].label));
      lg.appendChild(it);
    });

    var wrap = $('bars');
    var sorted = Q.scenarios.slice().sort(function (a, b) { return b.reported - a.reported; });
    sorted.forEach(function (s) {
      var td = s.model === 'time-dependent';
      var row = el(td ? 'div' : 'button', 'bar-row' + (td ? ' is-td' : ''));
      row.dataset.id = s.id;
      if (td) row.tabIndex = 0; else row.type = 'button';
      row.setAttribute('aria-label', s.name + ', ' + Q.types[s.type].label + ', ' + s.magnitude +
        ', recurrence ' + s.tauLabel + ': ' + fmtPct(s.reported) + ' in 50 years' + (td ? ' (time-dependent model)' : ''));

      var label = el('div', 'bar-label');
      label.appendChild(el('span', 'bar-name', s.name));
      var meta = el('span', 'bar-meta', s.magnitude + ' · every ' + s.tauLabel);
      if (td) meta.appendChild(el('span', 'pill', 'time-dependent'));
      label.appendChild(meta);

      var track = el('div', 'bar-track');
      var bar = el('div', 'bar');
      bar.style.width = 'calc((100% - 48px) * ' + s.reported + ')';
      bar.style.background = Q.types[s.type].color;
      track.appendChild(bar);
      track.appendChild(el('span', 'bar-value', fmtPct(s.reported)));

      row.appendChild(label);
      row.appendChild(track);
      if (!td) row.addEventListener('click', function () {
        selectScenario(s.id);
        document.querySelector('.explorer').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      row.addEventListener('pointerenter', function () { showBarTip(row, s); });
      row.addEventListener('pointerleave', hideBarTip);
      row.addEventListener('focus', function () { showBarTip(row, s); });
      row.addEventListener('blur', hideBarTip);
      wrap.appendChild(row);
    });
  }

  function showBarTip(row, s) {
    var tip = $('bar-tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-value', fmtPct(s.reported) + ' in 50 years'));
    tip.appendChild(el('div', 'tip-head', s.name + ' (' + s.magnitude + ')'));
    tip.appendChild(el('p', null, s.basis));
    tip.appendChild(el('p', null, 'Model: ' + s.model + ' · report p. ' + s.page));
    tip.hidden = false;
    var host = document.querySelector('.compare').getBoundingClientRect();
    var r = row.getBoundingClientRect();
    var bar = row.querySelector('.bar-value').getBoundingClientRect();
    var left = bar.right - host.left + 12;
    if (left + tip.offsetWidth > host.width - 8) left = Math.max(8, host.width - tip.offsetWidth - 8);
    tip.style.left = left + 'px';
    tip.style.top = (r.bottom - host.top + 4) + 'px';
  }
  function hideBarTip() { $('bar-tip').hidden = true; }

  // ---------- table ----------
  function buildTable() {
    var body = $('table-body');
    Q.scenarios.forEach(function (s) {
      var tr = document.createElement('tr');
      [
        [s.name], [Q.types[s.type].label], [s.magnitude], [s.tauLabel],
        [fmtPct(s.reported), 'num'],
        [s.model === 'time-independent' ? (P(s.tau, 50) * 100).toFixed(1) + '%' : (P(s.tau, 50) * 100).toFixed(1) + '% (not used)', 'num'],
        [s.model], [String(s.page), 'num'],
      ].forEach(function (c) {
        var td = el('td', c[1] || null, c[0]);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  // ---------- wiring ----------
  function update() {
    renderReadout();
    renderChart();
  }

  function init() {
    buildChips();
    buildBars();
    buildTable();

    var tau = $('tau-slider'), t = $('t-slider');
    tau.value = tauToSlider(state.tau);
    t.value = state.t;

    tau.addEventListener('input', function () {
      state.tau = sliderToTau(+tau.value);
      var match = presets.filter(function (s) { return s.tau === state.tau; })[0];
      state.selected = match ? match.id : 'custom';
      update();
    });
    t.addEventListener('input', function () { state.t = +t.value; update(); });
    $('t-reset').addEventListener('click', function () { state.t = DEFAULT_T; t.value = DEFAULT_T; update(); });

    if (window.ResizeObserver) new ResizeObserver(function () { renderChart(); }).observe($('chart-wrap'));
    else window.addEventListener('resize', renderChart);

    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
