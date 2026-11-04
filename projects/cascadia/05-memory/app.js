/*
 * Project 5: "Memory or no memory?". Poisson (no memory) vs Brownian passage time (memory) for Cascadia,
 * conditioned on the last great earthquake on January 26, 1700.
 */
(function () {
  'use strict';

  var U = window.VizUtils, B = window.BPT, $ = U.$, el = U.el;
  var NOW = new Date().getFullYear(), LAST = 1700, X_END = 2700;

  var SOURCES = {
    full: { label: 'Cascadia M9', mu: 500, alpha: 0.5, match: { mu: 480, alpha: 0.5 },
      report: 'Report: 10% (no memory), 15% (memory)', reportMemory: 0.15, reportPoisson: 0.10 },
    south: { label: 'southern Cascadia M8+', mu: 330, alpha: 0.5, match: { mu: 300, alpha: 0.5 },
      report: 'Report: ~30% (memory)', reportMemory: 0.30, reportPoisson: null },
  };
  var C_MEM = 'var(--megathrust)', C_POI = 'var(--text-secondary)';

  var state = { src: 'full', mu: 500, alpha: 0.5, year: NOW, win: 50, seed: 7 };

  function elapsed() { return Math.max(0, state.year - LAST); }
  function pMem(e) { return B.conditional(e, state.win, state.mu, state.alpha); }
  function pPoi() { return B.poisson.conditional(0, state.win, state.mu); }
  function pct(p) { return U.fmtPct(p, p < 0.1 && p > 0 ? 1 : 0); }
  function pct1(p) { return U.fmtPct(p, 1); }

  function setSvg(root, W, H) {
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';
  }
  var LAB = 'fill: var(--text-primary); font-size: 12px; font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round';

  // ---------------------------------------------------------------- mini hazard charts
  function renderMinis() {
    var tMax = Math.max(1000, state.mu * 2);
    var maxH = Math.max(1 / state.mu, d3.max(d3.range(1, tMax, 5), function (t) { return B.hazard(t, state.mu, state.alpha); })) * 1.2;
    [['mini-poisson', function (t) { return 1 / state.mu; }, C_POI], ['mini-bpt', function (t) { return B.hazard(t, state.mu, state.alpha); }, C_MEM]]
      .forEach(function (cfg) {
        var wrap = $(cfg[0]), root = wrap.querySelector('svg');
        var W = wrap.clientWidth; if (!W) return;
        var H = 150, m = { top: 10, right: 12, bottom: 26, left: 48 };
        var x = d3.scaleLinear([0, tMax], [m.left, W - m.right]), y = d3.scaleLinear([0, maxH], [H - m.bottom, m.top]);
        setSvg(root, W, H);
        y.ticks(3).forEach(function (v) {
          U.svg('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), style: 'stroke: var(' + (v ? '--grid' : '--axis') + '); stroke-width: 1' }, root);
          U.svg('text', { x: m.left - 6, y: y(v), dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = (v * 100).toFixed(1) + '%';
        });
        [0, tMax / 2, tMax].forEach(function (v, i) {
          U.svg('text', { x: x(v), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root)
            .textContent = i === 0 ? '0' : i === 1 ? U.fmtInt(v) + ' yr' : U.fmtInt(v) + ' yr since last quake';
        });
        var d = '';
        for (var i = 0; i <= 120; i++) { var t = Math.max(0.5, tMax * i / 120); d += (i ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(cfg[1](t)).toFixed(1); }
        U.svg('path', { d: d, fill: 'none', style: 'stroke: ' + cfg[2] + '; stroke-width: 2' }, root);
        var e = NOW - LAST, cy = y(cfg[1](e));
        U.svg('circle', { cx: x(e), cy: cy, r: 5, style: 'fill: ' + cfg[2] + '; stroke: var(--surface-1); stroke-width: 2' }, root);
        U.svg('text', { x: x(e) + 8, y: cy - 8, style: LAB }, root).textContent = 'today: ' + (cfg[1](e) * 100).toFixed(2) + '% per year';
        root.setAttribute('aria-label', 'Chance per year versus years since the last quake. Today: ' + (cfg[1](e) * 100).toFixed(2) + '% per year.');
      });
  }

  // ---------------------------------------------------------------- main odds chart
  var odds = {};
  function renderOdds() {
    var wrap = $('odds-wrap'), root = $('odds-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = W < 560 ? 280 : 340, m = { top: 18, right: 18, bottom: 30, left: 44 };
    var maxP = Math.max(0.2, d3.max(d3.range(0, X_END - LAST + 1, 5), function (e) { return pMem(e); }), pPoi()) * 1.15;
    var x = d3.scaleLinear([LAST, X_END], [m.left, W - m.right]), y = d3.scaleLinear([0, Math.min(1, maxP)], [H - m.bottom, m.top]);
    odds = { x: x, y: y, m: m, W: W, H: H };
    setSvg(root, W, H);

    y.ticks(5).forEach(function (v) {
      U.svg('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), style: 'stroke: var(' + (v ? '--grid' : '--axis') + '); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 6, y: y(v), dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = Math.round(v * 100) + '%';
    });
    (W < 560 ? [1700, 2000, 2300, 2600] : [1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700]).forEach(function (v) {
      U.svg('text', { x: x(v), y: H - 10, 'text-anchor': v === LAST ? 'start' : v === X_END ? 'end' : 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = v;
    });

    // Today band
    U.svg('line', { x1: x(NOW), x2: x(NOW), y1: m.top, y2: H - m.bottom, style: 'stroke: var(--axis); stroke-width: 1' }, root);
    U.svg('text', { x: x(NOW) + 4, y: m.top + 10, style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = 'today';

    U.svg('line', { x1: x(LAST), x2: x(X_END), y1: y(pPoi()), y2: y(pPoi()), style: 'stroke: ' + C_POI + '; stroke-width: 2' }, root);
    var d = '';
    for (var yr = LAST; yr <= X_END; yr += 2) d += (yr === LAST ? 'M' : 'L') + x(yr).toFixed(1) + ',' + y(pMem(yr - LAST)).toFixed(1);
    U.svg('path', { d: d, fill: 'none', style: 'stroke: ' + C_MEM + '; stroke-width: 2.5' }, root);

    // Selected year marker
    var sx = x(state.year), mem = pMem(elapsed()), poi = pPoi();
    U.svg('line', { x1: sx, x2: sx, y1: m.top, y2: H - m.bottom, style: 'stroke: var(--text-primary); stroke-width: 1.5' }, root);
    var left = sx > W * 0.7;
    [[mem, C_MEM, 'with memory'], [poi, C_POI, 'no memory']].forEach(function (p, i) {
      var cy = y(p[0]);
      U.svg('circle', { cx: sx, cy: cy, r: 5.5, style: 'fill: ' + p[1] + '; stroke: var(--surface-1); stroke-width: 2' }, root);
      var off = Math.abs(y(mem) - y(poi)) < 18 ? (i === 0 ? -9 : 13) : -9;
      U.svg('text', { x: sx + (left ? -10 : 10), y: cy + off, 'text-anchor': left ? 'end' : 'start', style: LAB }, root).textContent = pct(p[0]) + ' ' + p[2];
    });

    odds.hover = U.svg('line', { y1: m.top, y2: H - m.bottom, visibility: 'hidden', style: 'stroke: var(--text-muted); stroke-width: 1; pointer-events: none' }, root);
    var hit = U.svg('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, fill: 'transparent' }, root);
    hit.addEventListener('pointermove', oddsHover);
    hit.addEventListener('pointerleave', function () { odds.hover.setAttribute('visibility', 'hidden'); $('odds-tip').hidden = true; });
    hit.addEventListener('click', function (ev) { setYear(yearAt(ev)); });
    root.setAttribute('aria-label', 'Chance of a ' + SOURCES[state.src].label + ' in the next ' + state.win + ' years, by the year you ask. In ' +
      state.year + ': ' + pct(mem) + ' with memory, ' + pct(poi) + ' without.');
  }
  function yearAt(ev) {
    var r = $('odds-chart').getBoundingClientRect();
    return Math.round(Math.max(LAST, Math.min(X_END, odds.x.invert(ev.clientX - r.left))));
  }
  function oddsHover(ev) {
    var yr = yearAt(ev), px = odds.x(yr), tip = $('odds-tip');
    odds.hover.setAttribute('x1', px); odds.hover.setAttribute('x2', px); odds.hover.setAttribute('visibility', 'visible');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', 'Asked in ' + yr + ' (' + (yr - LAST) + ' years after 1700)'));
    [[pMem(yr - LAST), C_MEM, 'with memory'], [pPoi(), C_POI, 'no memory']].forEach(function (r) {
      var row = el('div', 'tip-row');
      row.appendChild(U.keyLine(r[1])); row.appendChild(el('strong', null, pct1(r[0]))); row.appendChild(el('span', null, r[2]));
      tip.appendChild(row);
    });
    tip.appendChild(el('p', null, 'Click to ask in ' + yr));
    tip.hidden = false;
    var left = px + 12; if (left + tip.offsetWidth > odds.W) left = px - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = odds.m.top + 'px';
  }

  // ---------------------------------------------------------------- tiles + notes
  function renderTiles() {
    var s = SOURCES[state.src], mem = pMem(elapsed()), poi = pPoi();
    var tiles = [
      [C_POI, 'No memory', pct(poi), 'same in every year'],
      [C_MEM, 'With memory', pct(mem), 'given no quake since 1700'],
      [null, 'Years since 1700', String(elapsed()), 'asked in ' + state.year],
      [null, 'The report', s.reportPoisson != null ? '10% / 15%' : '~30%', s.reportPoisson != null ? 'no memory / memory' : 'memory model'],
    ];
    var wrap = $('tiles'); wrap.textContent = '';
    tiles.forEach(function (t) {
      var d = el('div', 'tile'), lab = el('div', 't-label');
      if (t[0]) lab.appendChild(U.keyLine(t[0]));
      lab.appendChild(document.createTextNode(t[1]));
      d.appendChild(lab); d.appendChild(el('div', 't-value', t[2])); d.appendChild(el('div', 't-sub', t[3]));
      wrap.appendChild(d);
    });
    $('odds-sub').textContent = 'Chance of at least one ' + s.label + ' in the ' + state.win + ' years after the year you pick, assuming none has happened since 1700.';

    var note = $('match-note'), today = B.conditional(NOW - LAST, 50, state.mu, state.alpha);
    note.textContent = '';
    if (state.src === 'full') {
      note.appendChild(el('strong', null, 'Reproducing the report: '));
      note.appendChild(document.createTextNode('with an average of exactly 500 years and α = 0.5 (a common choice), the memory model gives ' +
        pct1(B.conditional(NOW - LAST, 50, 500, 0.5)) + ' for the next 50 years. The report says 15%. An average of ~480 years, which is still "~500", gives ' +
        pct1(B.conditional(NOW - LAST, 50, 480, 0.5)) + '. "Match the report" loads it. Your current settings give ' + pct1(today) + ' from today.'));
    } else {
      note.appendChild(el('strong', null, 'Reproducing the report: '));
      note.appendChild(document.createTextNode('with 300–350 years between great quakes and α between 0.4 and 0.6, the memory model gives ' +
        pct(B.conditional(NOW - LAST, 50, 350, 0.6)) + ' to ' + pct(B.conditional(NOW - LAST, 50, 300, 0.4)) +
        ' from today, a range around the report’s ~30%. Your current settings give ' + pct1(today) + '.'));
    }
    document.querySelectorAll('[data-elapsed]').forEach(function (n) { n.textContent = NOW - LAST; });
  }

  // ---------------------------------------------------------------- gap distribution
  var why = {};
  function renderWhy() {
    var wrap = $('why-wrap'), root = $('why-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = W < 560 ? 260 : 300, m = { top: 18, right: 18, bottom: 32, left: 18 };
    var tMax = Math.max(1200, state.mu * 2.4), e = elapsed(), w = state.win;
    var pdfM = function (t) { return B.pdf(t, state.mu, state.alpha); }, pdfP = function (t) { return B.poisson.pdf(t, state.mu); };
    var maxY = d3.max(d3.range(1, tMax, 4), function (t) { return Math.max(pdfM(t), pdfP(t)); }) * 1.1;
    var x = d3.scaleLinear([0, tMax], [m.left, W - m.right]), y = d3.scaleLinear([0, maxY], [H - m.bottom, m.top]);
    why = { x: x, W: W, m: m, H: H, tMax: tMax };
    setSvg(root, W, H);

    x.ticks(W < 560 ? 4 : 8).forEach(function (v) {
      U.svg('text', { x: x(v), y: H - 12, 'text-anchor': 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = U.fmtInt(v) + ' yr';
    });
    U.svg('line', { x1: m.left, x2: W - m.right, y1: y(0), y2: y(0), style: 'stroke: var(--axis); stroke-width: 1' }, root);

    function area(f, a, b, opacity, color) {
      var d = 'M' + x(a) + ',' + y(0);
      for (var i = 0; i <= 60; i++) { var t = Math.max(0.5, a + (b - a) * i / 60); d += 'L' + x(t).toFixed(1) + ',' + y(f(t)).toFixed(1); }
      d += 'L' + x(b) + ',' + y(0) + 'Z';
      U.svg('path', { d: d, style: 'fill: ' + color + '; fill-opacity: ' + opacity + '; stroke: none' }, root);
    }
    // Still possible (beyond the window) and the window itself, for both models
    area(pdfP, e + w, tMax, 0.08, C_POI); area(pdfM, e + w, tMax, 0.1, C_MEM);
    area(pdfP, e, Math.min(tMax, e + w), 0.3, C_POI); area(pdfM, e, Math.min(tMax, e + w), 0.45, C_MEM);
    // Ruled out (gaps shorter than the time already elapsed)
    U.svg('rect', { x: m.left, y: m.top, width: Math.max(0, x(e) - m.left), height: H - m.top - m.bottom, style: 'fill: var(--page); opacity: 0.55' }, root);

    function curve(f, color, width) {
      var d = '';
      for (var i = 0; i <= 200; i++) { var t = Math.max(0.5, tMax * i / 200); d += (i ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(Math.min(maxY, f(t))).toFixed(1); }
      U.svg('path', { d: d, fill: 'none', style: 'stroke: ' + color + '; stroke-width: ' + width }, root);
    }
    curve(pdfP, C_POI, 2); curve(pdfM, C_MEM, 2.5);
    U.svg('line', { x1: x(e), x2: x(e), y1: m.top, y2: y(0), style: 'stroke: var(--text-primary); stroke-width: 1.5' }, root);
    var right = x(e) < W * 0.7;
    U.svg('text', { x: x(e) + (right ? 6 : -6), y: m.top + 12, 'text-anchor': right ? 'start' : 'end', style: LAB }, root)
      .textContent = e + ' yr since 1700' + (W < 560 ? '' : ': shorter gaps are ruled out');

    var Fm0 = B.cdf(e, state.mu, state.alpha), Fm1 = B.cdf(e + w, state.mu, state.alpha);
    var Fp0 = 1 - Math.exp(-e / state.mu), Fp1 = 1 - Math.exp(-(e + w) / state.mu);
    var ex = $('why-explain'); ex.textContent = '';
    [[C_MEM, 'With memory', Fm1 - Fm0, 1 - Fm0], [C_POI, 'No memory', Fp1 - Fp0, 1 - Fp0]].forEach(function (r) {
      var p = el('p');
      var k = el('span', 'key-area'); k.style.background = r[0]; k.style.opacity = 0.6;
      p.appendChild(k);
      p.appendChild(document.createTextNode(' '));
      p.appendChild(el('strong', null, r[1] + ': '));
      p.appendChild(document.createTextNode('of the gaps still possible (' + pct1(r[3]) + ' of all gaps), ' + pct1(r[2]) +
        ' end in the next ' + w + ' years. ' + pct1(r[2]) + ' ÷ ' + pct1(r[3]) + ' = '));
      p.appendChild(el('strong', null, pct1(r[2] / r[3])));
      p.appendChild(document.createTextNode('.'));
      ex.appendChild(p);
    });
    $('why-sub').textContent = 'Curves show how likely each gap length is (average ' + state.mu + ' years). The no-memory curve is highest for very short ' +
      'gaps; the memory curve peaks near the average. Shaded: gaps that end in the next ' + w + ' years.';

    var hover = U.svg('line', { y1: m.top, y2: y(0), visibility: 'hidden', style: 'stroke: var(--text-muted); stroke-width: 1; pointer-events: none' }, root);
    var hit = U.svg('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, fill: 'transparent' }, root);
    var tip = $('why-tip');
    hit.addEventListener('pointermove', function (ev) {
      var r = root.getBoundingClientRect(), t = Math.max(1, Math.round(x.invert(ev.clientX - r.left)));
      hover.setAttribute('x1', x(t)); hover.setAttribute('x2', x(t)); hover.setAttribute('visibility', 'visible');
      tip.textContent = '';
      tip.appendChild(el('div', 'tip-head', 'Gap longer than ' + U.fmtInt(t) + ' years'));
      [[1 - B.cdf(t, state.mu, state.alpha), C_MEM, 'with memory'], [Math.exp(-t / state.mu), C_POI, 'no memory']].forEach(function (q) {
        var row = el('div', 'tip-row'); row.appendChild(U.keyLine(q[1])); row.appendChild(el('strong', null, pct1(q[0]))); row.appendChild(el('span', null, q[2]));
        tip.appendChild(row);
      });
      tip.hidden = false;
      var left = x(t) + 12; if (left + tip.offsetWidth > W) left = x(t) - 12 - tip.offsetWidth;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = m.top + 'px';
    });
    hit.addEventListener('pointerleave', function () { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    root.setAttribute('aria-label', 'Distribution of gaps between great quakes under both models, with the next ' + w + ' years shaded.');
  }

  // ---------------------------------------------------------------- simulated histories
  function renderHistories() {
    var wrap = $('hist-wrap'), root = $('hist-chart');
    var W = wrap.clientWidth; if (!W) return;
    var SPAN = 5000, rowH = 56, labelW = W < 560 ? 0 : 190;
    var rows = [
      { label: 'Nearly clockwork (α = 0.2)', draw: function (r) { return B.sample(state.mu, 0.2, r); }, color: C_MEM },
      { label: 'Memory model (α = ' + state.alpha.toFixed(2) + ')', draw: function (r) { return B.sample(state.mu, state.alpha, r); }, color: C_MEM },
      { label: 'No memory (random)', draw: function (r) { return B.samplePoisson(state.mu, r); }, color: C_POI },
    ];
    var m = { top: 8, right: 14, bottom: 26, left: 12 + labelW }, H = m.top + rows.length * rowH + m.bottom;
    var x = d3.scaleLinear([0, SPAN], [m.left, W - m.right]);
    setSvg(root, W, H);
    [0, 1000, 2000, 3000, 4000, 5000].forEach(function (v) {
      U.svg('text', { x: x(v), y: H - 8, 'text-anchor': v === 0 ? 'start' : v === SPAN ? 'end' : 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = U.fmtInt(v) + ' yr';
    });
    var tip = $('hist-tip');
    rows.forEach(function (row, i) {
      var rng = U.rng(state.seed * 31 + i * 7919), t = row.draw(rng), events = [];
      while (t < SPAN) { events.push(t); t += row.draw(rng); }
      var cy = m.top + i * rowH + rowH / 2 + (W < 560 ? 8 : 0);
      if (labelW) U.svg('text', { x: 12, y: cy, dy: '0.32em', style: 'fill: var(--text-primary); font-size: 13px' }, root).textContent = row.label;
      else U.svg('text', { x: m.left, y: cy - 18, style: 'fill: var(--text-primary); font-size: 12px' }, root).textContent = row.label;
      U.svg('line', { x1: x(0), x2: x(SPAN), y1: cy, y2: cy, style: 'stroke: var(--grid); stroke-width: 1' }, root);
      var gaps = events.slice(1).map(function (v, k) { return v - events[k]; });
      events.forEach(function (v, k) {
        var c = U.svg('circle', { cx: x(v), cy: cy, r: 6, tabindex: 0, style: 'fill: ' + row.color + '; stroke: var(--surface-1); stroke-width: 2; cursor: default' }, root);
        var info = 'Great quake at year ' + Math.round(v) + (k ? ' · ' + Math.round(v - events[k - 1]) + ' years after the previous one' : '');
        c.setAttribute('aria-label', info);
        function show() {
          tip.textContent = ''; tip.appendChild(el('div', 'tip-head', row.label)); tip.appendChild(el('p', null, info)); tip.hidden = false;
          var left = x(v) + 12; if (left + tip.offsetWidth > W) left = x(v) - 12 - tip.offsetWidth;
          tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, cy - 50) + 'px';
        }
        c.addEventListener('pointerenter', show); c.addEventListener('focus', show);
        c.addEventListener('pointerleave', function () { tip.hidden = true; }); c.addEventListener('blur', function () { tip.hidden = true; });
      });
      if (gaps.length) {
        U.svg('text', { x: W - m.right, y: cy + 20, 'text-anchor': 'end', style: 'fill: var(--text-secondary); font-size: 11px' }, root)
          .textContent = events.length + ' quakes · gaps ' + Math.round(d3.min(gaps)) + '–' + U.fmtInt(Math.round(d3.max(gaps))) + ' yr';
      }
    });
    $('hist-mu').textContent = state.mu;
    root.setAttribute('aria-label', 'Three simulated 5,000-year histories with different regularity.');
  }

  // ---------------------------------------------------------------- southern Cascadia grid
  function renderSouth() {
    var t = $('south-grid'); t.textContent = '';
    var mus = [300, 330, 350], alphas = [0.4, 0.5, 0.6], e = NOW - LAST;
    var head = el('tr'); head.appendChild(el('th', null, 'Average gap ↓ / irregularity α →'));
    alphas.forEach(function (a) { var th = el('th', null, 'α = ' + a.toFixed(1)); th.scope = 'col'; head.appendChild(th); });
    var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
    var body = el('tbody');
    mus.forEach(function (mu) {
      var tr = el('tr'), th = el('th', null, mu + ' years'); th.scope = 'row'; tr.appendChild(th);
      alphas.forEach(function (a) {
        var p = B.conditional(e, 50, mu, a), td = el('td'), b = el('button', Math.abs(p - 0.30) <= 0.03 ? 'near' : '', pct(p));
        b.type = 'button';
        b.setAttribute('aria-label', mu + ' years, alpha ' + a + ': ' + pct(p) + ' in 50 years');
        b.setAttribute('aria-pressed', String(state.src === 'south' && state.mu === mu && Math.abs(state.alpha - a) < 1e-6));
        b.addEventListener('click', function () { state.src = 'south'; state.mu = mu; state.alpha = a; state.year = NOW; state.win = 50; renderAll(); });
        td.appendChild(b); tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    t.appendChild(body);
    var cap = el('caption', null, 'Chance of a southern Cascadia M8+ in the next 50 years, from ' + NOW + '. Outlined: within 3 points of the report’s ~30%.');
    t.appendChild(cap);
  }

  // ---------------------------------------------------------------- wiring
  function syncControls() {
    $('mu-slider').value = state.mu; $('mu-out').textContent = state.mu + ' years';
    $('alpha-slider').value = state.alpha; $('alpha-out').textContent = state.alpha.toFixed(2);
    $('year-slider').value = state.year; $('year-out').textContent = state.year + (state.year === NOW ? ' (today)' : '');
    document.querySelectorAll('#src-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.src === state.src)); });
    document.querySelectorAll('#win-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.win === state.win)); });
    var lg = $('odds-legend'); lg.textContent = '';
    [[C_MEM, 'With memory'], [C_POI, 'No memory']].forEach(function (p) {
      var it = el('span', 'legend-item'); it.appendChild(U.keyLine(p[0])); it.appendChild(document.createTextNode(p[1])); lg.appendChild(it);
    });
    var wl = $('why-legend'); wl.textContent = '';
    [[C_MEM, 'With memory'], [C_POI, 'No memory']].forEach(function (p) {
      var it = el('span', 'legend-item'); it.appendChild(U.keyLine(p[0])); it.appendChild(document.createTextNode(p[1])); wl.appendChild(it);
    });
  }

  function setYear(y) { state.year = Math.max(LAST, Math.min(X_END, y)); renderAll(); }

  function renderAll() {
    syncControls(); renderMinis(); renderTiles(); renderOdds(); renderWhy(); renderHistories(); renderSouth();
  }

  function init() {
    document.querySelectorAll('#src-buttons button').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = SOURCES[b.dataset.src];
        state.src = b.dataset.src; state.mu = s.mu; state.alpha = s.alpha; renderAll();
      });
    });
    document.querySelectorAll('#win-buttons button').forEach(function (b) {
      b.addEventListener('click', function () { state.win = +b.dataset.win; renderAll(); });
    });
    $('mu-slider').addEventListener('input', function (ev) { state.mu = +ev.target.value; renderAll(); });
    $('alpha-slider').addEventListener('input', function (ev) { state.alpha = +ev.target.value; renderAll(); });
    $('year-slider').addEventListener('input', function (ev) { setYear(+ev.target.value); });
    $('today-btn').addEventListener('click', function () { setYear(NOW); });
    $('match-btn').addEventListener('click', function () {
      var mt = SOURCES[state.src].match;
      state.mu = mt.mu; state.alpha = mt.alpha; state.year = NOW; state.win = 50; renderAll();
    });
    $('shuffle-btn').addEventListener('click', function () { state.seed++; renderHistories(); });
    renderAll();
    var pending = null, lastW = 0;
    function onResize() {
      var w = document.querySelector('.page').clientWidth;
      if (pending || w === lastW) return;
      lastW = w;
      pending = requestAnimationFrame(function () { pending = null; renderAll(); });
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.querySelector('.page'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
