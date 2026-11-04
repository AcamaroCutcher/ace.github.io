/*
 * Project 2: "Roll the next 50 years" Monte Carlo simulator.
 *
 * Each future is simulated as independent Poisson processes, the same no-memory model the report
 * uses: the time to the next quake is drawn from an exponential distribution, -τ·ln(U).
 * Seattle Fault quakes are a subset of Puget Sound crustal quakes, so each Puget crustal event is
 * tagged as a Seattle Fault event with probability τ_puget / τ_seattle (265 / 1000).
 * Each event then gets a location, depth and magnitude from shared/quake-geo.js.
 */
(function () {
  'use strict';

  var Q = window.QUAKE, U = window.VizUtils, GEO = window.QuakeGeo, $ = U.$, el = U.el;

  var START = new Date().getFullYear();
  var MAX_T = 100;                 // simulate the longest horizon once; the slider only trims
  var PUGET = 'crustal-puget', SEATTLE = 'crustal-seattle', M9 = 'mega-full';

  var SOURCES = Q.scenarios.filter(function (s) { return s.model === 'time-independent'; });
  var BASE = SOURCES.filter(function (s) { return s.id !== SEATTLE; }); // independently simulated
  var byId = {};
  SOURCES.forEach(function (s) { byId[s.id] = s; });
  var THIN = byId[PUGET].tau / byId[SEATTLE].tau;

  var SHORT = {
    'deep-puget': 'Deep quake, Puget Sound',
    'crustal-puget': 'Crustal quake, Puget Sound',
    'mega-full': 'Cascadia M9',
    'crustal-portland': 'Crustal quake, Portland area',
    'crustal-seattle': 'Seattle Fault quake',
  };

  var state = {
    n: 1000, t: 50, seed: 20260, speed: 12000,
    on: {}, playhead: 0, focus: 0, histSrc: 'deep-puget',
    mapMode: 'all', highlight: null,
  };
  SOURCES.forEach(function (s) { state.on[s.id] = true; });

  var sim = null;     // { n, futures, firstBy }
  var view = null;    // derived from the source selection: { firstSel, typeSel, sorted, rate, all }
  var anim = null;
  var colors = {};
  var qmap = null;

  // ---------------------------------------------------------------- simulation
  function simulate(n, seed) {
    var r = U.rng(seed);
    var rLoc = U.rng(seed ^ 0x2545f491);   // separate stream: places and sizes never change the timing
    var futures = new Array(n);
    for (var i = 0; i < n; i++) {
      var ev = [];
      BASE.forEach(function (s) {
        var y = 0;
        for (;;) {
          y += -s.tau * Math.log(1 - r());
          if (y >= MAX_T) break;
          var e = { y: y, src: s.id, seattle: false, type: s.type, fi: i };
          if (s.id === PUGET) e.seattle = r() < THIN;
          ev.push(e);
        }
      });
      ev.sort(function (a, b) { return a.y - b.y; });
      ev.forEach(function (e) { GEO.place(e, rLoc); });
      futures[i] = ev;
    }
    var firstBy = {};
    SOURCES.forEach(function (s) {
      var f = new Float64Array(n);
      for (var i = 0; i < n; i++) {
        f[i] = Infinity;
        var list = futures[i];
        for (var j = 0; j < list.length; j++) if (matches(list[j], s.id)) { f[i] = list[j].y; break; }
      }
      firstBy[s.id] = f;
    });
    return { n: n, futures: futures, firstBy: firstBy };
  }

  function matches(e, id) { return e.src === id || (id === SEATTLE && e.seattle); }
  function selectedMatch(e) { return state.on[e.src] || (state.on[SEATTLE] && e.seattle); }
  function anyOn() { return SOURCES.some(function (s) { return state.on[s.id]; }); }

  function deriveView() {
    var n = sim.n, firstSel = new Float64Array(n), typeSel = new Array(n), all = [];
    for (var i = 0; i < n; i++) {
      firstSel[i] = Infinity; typeSel[i] = null;
      var list = sim.futures[i];
      for (var j = 0; j < list.length; j++) {
        if (!selectedMatch(list[j])) continue;
        if (firstSel[i] === Infinity) { firstSel[i] = list[j].y; typeSel[i] = list[j].type; }
        all.push(list[j]);
      }
    }
    var sorted = Float64Array.from(firstSel).sort();
    // Union rate for the formula. Seattle adds nothing if Puget crustal is already included.
    var rate = 0;
    BASE.forEach(function (s) { if (state.on[s.id]) rate += 1 / s.tau; });
    if (state.on[SEATTLE] && !state.on[PUGET]) rate += 1 / byId[SEATTLE].tau;
    view = { firstSel: firstSel, typeSel: typeSel, sorted: sorted, rate: rate, all: all };
  }

  function countAtMost(sorted, y) {          // upper bound binary search
    var lo = 0, hi = sorted.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (sorted[mid] <= y) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function countFirst(arr, y) { var c = 0; for (var i = 0; i < arr.length; i++) if (arr[i] <= y) c++; return c; }
  function eventsWithin(i, t) {
    return sim.futures[i].filter(function (e) { return e.y < t && selectedMatch(e); });
  }
  function current() { return Math.min(state.playhead, state.t); }
  function theory(rate, y) { return 1 - Math.exp(-rate * y); }
  function yearOf(e) { return Math.floor(START + e.y); }
  /** Calendar year shown for a playhead position: rounded down like event years, so the two always agree. */
  function displayYear(y) { return y >= state.t - 1e-6 ? START + state.t : Math.floor(START + y); }

  // ---------------------------------------------------------------- event descriptions
  function kindName(e) {
    if (e.src === M9) return 'Cascadia megathrust quake';
    if (e.src === 'deep-puget') return 'deep quake';
    if (e.seattle) return 'Seattle Fault quake';
    return 'crustal quake';
  }
  function whereText(e) {
    if (e.src === M9) return 'Epicenter ' + GEO.describe(e.lon, e.lat, 3) + '; the rupture spans ~1,000 km of coast';
    return GEO.describe(e.lon, e.lat);
  }
  function describeEvent(e) {
    return {
      title: 'M' + e.mag.toFixed(1) + ' ' + kindName(e) + ' · ' + yearOf(e),
      lines: [
        whereText(e),
        e.fault ? 'On the ' + e.fault : null,
        Math.round(e.depth) + ' km deep',
        'Future #' + (e.fi + 1) + (state.mapMode === 'all' ? ' (click to open it)' : ''),
      ],
    };
  }

  // ---------------------------------------------------------------- colors
  function readColors() {
    colors = {
      deep: U.cssVar('--deep'), megathrust: U.cssVar('--megathrust'), crustal: U.cssVar('--crustal'),
      empty: U.cssVar('--grid'), ring: U.cssVar('--text-primary'), surface: U.cssVar('--surface-1'),
    };
  }

  // ---------------------------------------------------------------- controls
  function buildControls() {
    var wrap = $('source-chips');
    SOURCES.forEach(function (s) {
      var b = el('button', 'chip');
      b.type = 'button'; b.dataset.id = s.id;
      b.appendChild(el('span', 'check'));
      var dot = el('span', 'dot'); dot.style.background = Q.types[s.type].color;
      b.appendChild(dot);
      b.appendChild(el('span', 'label', SHORT[s.id] + ' · every ' + s.tauLabel));
      b.addEventListener('click', function () {
        state.on[s.id] = !state.on[s.id];
        b.setAttribute('aria-label', SHORT[s.id] + (state.on[s.id] ? ' (on)' : ' (off)'));
        deriveView();
        if (state.highlight && !selectedMatch(state.highlight)) state.highlight = null;
        renderAll();
      });
      wrap.appendChild(b);
    });

    document.querySelectorAll('#n-buttons button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.n = +b.dataset.n;
        state.focus = Math.min(state.focus, state.n - 1);
        state.highlight = null;
        rebuild(); play(0);
      });
    });

    document.querySelectorAll('#speed-buttons button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.speed = +b.dataset.speed;
        if (anim) play(state.playhead); else syncControls();
      });
    });

    var t = $('t-slider');
    t.value = state.t;
    t.addEventListener('input', function () {
      state.t = +t.value;
      stop(); state.playhead = state.t;
      if (state.highlight && state.highlight.y >= state.t) state.highlight = null;
      renderAll();
    });

    $('run-btn').addEventListener('click', function () {
      state.seed = Math.floor(Math.random() * 1e6);
      state.highlight = null;
      rebuild(); play(0);
    });
    $('replay-btn').addEventListener('click', function () { play(0); });
    $('skip-btn').addEventListener('click', function () { stop(); state.playhead = state.t; renderAll(); });

    var hb = $('hist-buttons');
    SOURCES.forEach(function (s) {
      var b = el('button', null, SHORT[s.id]);
      b.type = 'button'; b.dataset.id = s.id;
      b.addEventListener('click', function () { state.histSrc = s.id; renderHist(); });
      hb.appendChild(b);
    });

    var lg = $('type-legend');
    Object.keys(Q.types).forEach(function (k) {
      var it = el('span', 'legend-item');
      it.appendChild(U.keyRect(Q.types[k].color));
      it.appendChild(document.createTextNode(Q.types[k].label.split(' (')[0] + ' first'));
      lg.appendChild(it);
    });
    var none = el('span', 'legend-item');
    none.appendChild(U.keyRect('var(--grid)'));
    none.appendChild(document.createTextNode('No quake yet'));
    lg.appendChild(none);

    var ll = $('line-legend');
    [['Simulated', 'var(--text-primary)'], ['Formula', 'var(--text-muted)']].forEach(function (p) {
      var it = el('span', 'legend-item');
      it.appendChild(U.keyLine(p[1]));
      it.appendChild(document.createTextNode(p[0]));
      ll.appendChild(it);
    });
  }

  function syncControls() {
    document.querySelectorAll('#source-chips .chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(!!state.on[c.dataset.id]));
    });
    document.querySelectorAll('#n-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.n === state.n));
    });
    document.querySelectorAll('#speed-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.speed === state.speed));
    });
    document.querySelectorAll('#hist-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.id === state.histSrc));
    });
    document.querySelectorAll('#map-mode button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.mapMode));
      if (b.dataset.mode === 'all') b.textContent = 'All ' + U.fmtInt(state.n) + ' futures';
    });
    $('t-out').textContent = state.t + ' years (' + START + '–' + (START + state.t) + ')';
    $('seed-note').textContent = 'seed ' + state.seed;
    $('year-scrub').max = state.t;
    $('map-play').textContent = anim ? 'Pause' : state.playhead >= state.t - 0.01 ? 'Replay' : 'Play';
  }

  // ---------------------------------------------------------------- animation
  /** Animate the playhead from `from` years to the end of the period. */
  function play(from) {
    stop();
    if (U.prefersReducedMotion()) { state.playhead = state.t; renderAll(); return; }
    var startFrac = Math.max(0, Math.min(1, (from || 0) / state.t));
    var t0 = performance.now();
    state.playhead = state.t * startFrac;
    function frame(now) {
      var p = Math.min(1, startFrac + (now - t0) / state.speed);
      state.playhead = state.t * p;
      anim = p < 1 ? requestAnimationFrame(frame) : null;
      renderLive();
      if (!anim) syncControls();
    }
    anim = requestAnimationFrame(frame);
    renderAll();
  }
  function stop() { if (anim) cancelAnimationFrame(anim); anim = null; }

  // ---------------------------------------------------------------- grid (canvas)
  var grid = {};

  function gridGeometry() {
    var W = $('canvas-wrap').clientWidth;
    var cols = state.n === 100 ? 10 : state.n === 1000 ? 40 : 100;
    var gap = state.n >= 10000 ? 1 : 2;
    var cell = (W - gap * (cols - 1)) / cols;
    if (state.n === 100) cell = Math.min(cell, 40);
    var rows = Math.ceil(state.n / cols);
    var w = cols * cell + gap * (cols - 1);
    var H = rows * cell + gap * (rows - 1);
    return { W: w, H: H, cols: cols, rows: rows, gap: gap, cell: cell };
  }

  function drawGrid() {
    var c = $('futures');
    var g = gridGeometry();
    var dpr = window.devicePixelRatio || 1;
    if (grid.W !== g.W || grid.H !== g.H || grid.dpr !== dpr) {
      c.width = Math.round(g.W * dpr); c.height = Math.round(g.H * dpr);
      c.style.width = g.W + 'px'; c.style.height = g.H + 'px';
    }
    grid = g; grid.dpr = dpr;
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.W, g.H);
    var y = current(), step = g.cell + g.gap, r = g.cell >= 8 ? 2 : 0;
    for (var i = 0; i < state.n; i++) {
      var lit = view.firstSel[i] <= y;
      ctx.fillStyle = lit ? colors[view.typeSel[i]] : colors.empty;
      var x0 = (i % g.cols) * step, y0 = Math.floor(i / g.cols) * step;
      if (r && ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x0, y0, g.cell, g.cell, r); ctx.fill(); }
      else ctx.fillRect(x0, y0, g.cell, g.cell);
    }
    // Ring around the future shown on the map
    var fx = (state.focus % g.cols) * step, fy = Math.floor(state.focus / g.cols) * step;
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.ring;
    ctx.strokeRect(fx - 1.5, fy - 1.5, g.cell + 3, g.cell + 3);
    c.setAttribute('aria-label', 'Grid of ' + U.fmtInt(state.n) + ' simulated futures; ' +
      U.fmtInt(countAtMost(view.sorted, y)) + ' have had a quake by ' + displayYear(y) +
      '. Use arrow keys to choose the future shown on the map.');
  }

  function indexAt(ev) {
    var rect = $('futures').getBoundingClientRect();
    var step = grid.cell + grid.gap;
    var col = Math.floor((ev.clientX - rect.left) / step), row = Math.floor((ev.clientY - rect.top) / step);
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return -1;
    var i = row * grid.cols + col;
    return i < state.n ? i : -1;
  }

  function showGridTip(ev) {
    var i = indexAt(ev), tip = $('grid-tip');
    if (i < 0) { tip.hidden = true; return; }
    var y = current();
    var evs = eventsWithin(i, y);
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', 'Future #' + (i + 1)));
    if (!evs.length) {
      tip.appendChild(el('p', null, 'No quake from the selected sources by ' + displayYear(y) + '.'));
    } else {
      evs.slice(0, 5).forEach(function (e) {
        var row = el('div', 'tip-row');
        row.appendChild(U.keyLine(Q.types[e.type].color));
        row.appendChild(el('strong', null, String(yearOf(e))));
        row.appendChild(el('span', null, 'M' + e.mag.toFixed(1) + ' ' + kindName(e)));
        tip.appendChild(row);
      });
      if (evs.length > 5) tip.appendChild(el('p', null, '+ ' + (evs.length - 5) + ' more'));
    }
    tip.appendChild(el('p', null, 'Click to show this future on the map.'));
    tip.hidden = false;
    var wrap = $('canvas-wrap').getBoundingClientRect();
    var left = ev.clientX - wrap.left + 14, top = ev.clientY - wrap.top + 14;
    if (left + tip.offsetWidth > wrap.width) left = ev.clientX - wrap.left - tip.offsetWidth - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = top + 'px';
  }

  // ---------------------------------------------------------------- hero + line chart
  function renderHero() {
    var y = current();
    $('year-now').textContent = displayYear(y);
    if (!anyOn()) {
      $('hero-value').textContent = '–';
      $('hero-text').textContent = 'Pick at least one earthquake source above.';
      $('formula-compare').textContent = '';
      return;
    }
    var hit = countAtMost(view.sorted, y);
    $('hero-value').textContent = U.fmtPct(hit / state.n, 1);
    $('hero-text').textContent = 'of futures (' + U.fmtInt(hit) + ' of ' + U.fmtInt(state.n) +
      ') had at least one selected earthquake by ' + displayYear(y) + '.';
    var fc = $('formula-compare');
    fc.textContent = 'The formula predicts ';
    fc.appendChild(el('strong', null, U.fmtPct(theory(view.rate, y), 1)));
    var ry = Math.round(y);
    fc.appendChild(document.createTextNode(' for the same ' + ry + (ry === 1 ? ' year.' : ' years.')));
  }

  var line = {};
  function renderLine() {
    var wrap = $('line-wrap'), root = $('line-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = 220, m = { top: 12, right: 12, bottom: 28, left: 40 };
    var iw = W - m.left - m.right, ih = H - m.top - m.bottom, T = state.t;
    function x(yr) { return m.left + (yr / T) * iw; }
    function yy(p) { return m.top + (1 - p) * ih; }
    line = { m: m, iw: iw, ih: ih, x: x, y: yy, W: W };
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    [0, 0.5, 1].forEach(function (v) {
      U.svg('line', { x1: m.left, x2: m.left + iw, y1: yy(v), y2: yy(v),
        style: 'stroke: var(' + (v === 0 ? '--axis' : '--grid') + '); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 6, y: yy(v), dy: '0.32em', 'text-anchor': 'end',
        style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = (v * 100) + '%';
    });
    [0, T / 2, T].forEach(function (v) {
      U.svg('text', { x: x(v), y: H - 8, 'text-anchor': v === 0 ? 'start' : v === T ? 'end' : 'middle',
        style: 'fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums' }, root).textContent = START + v;
    });
    if (!anyOn()) return;

    var d = '';
    for (var k = 0; k <= 100; k++) { var yr = T * k / 100; d += (k ? 'L' : 'M') + x(yr).toFixed(1) + ',' + yy(theory(view.rate, yr)).toFixed(1); }
    U.svg('path', { d: d, fill: 'none', style: 'stroke: var(--text-muted); stroke-width: 1.5' }, root);

    var y = current(), steps = Math.max(1, Math.round(150 * y / T)), s = '';
    for (var j = 0; j <= steps; j++) {
      var yr2 = y * j / steps;
      s += (j ? 'L' : 'M') + x(yr2).toFixed(1) + ',' + yy(countAtMost(view.sorted, yr2) / state.n).toFixed(1);
    }
    U.svg('path', { d: s, fill: 'none', style: 'stroke: var(--text-primary); stroke-width: 2; stroke-linejoin: round' }, root);
    U.svg('circle', { cx: x(y), cy: yy(countAtMost(view.sorted, y) / state.n), r: 4.5,
      style: 'fill: var(--text-primary); stroke: var(--surface-1); stroke-width: 2' }, root);

    line.hover = U.svg('line', { y1: m.top, y2: m.top + ih, visibility: 'hidden',
      style: 'stroke: var(--text-muted); stroke-width: 1; pointer-events: none' }, root);
    var hit = U.svg('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' }, root);
    hit.addEventListener('pointermove', lineHover);
    hit.addEventListener('pointerleave', function () { line.hover.setAttribute('visibility', 'hidden'); $('line-tip').hidden = true; });
    root.setAttribute('aria-label', 'Line chart of the share of futures hit over time, simulated versus formula.');
  }

  function lineHover(ev) {
    var rect = $('line-chart').getBoundingClientRect();
    var yr = Math.max(0, Math.min(state.t, Math.round(((ev.clientX - rect.left - line.m.left) / line.iw) * state.t)));
    var hx = line.x(yr);
    line.hover.setAttribute('x1', hx); line.hover.setAttribute('x2', hx); line.hover.setAttribute('visibility', 'visible');
    var tip = $('line-tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', 'By ' + (START + yr)));
    var rows = [];
    if (yr <= current()) rows.push(['Simulated', countAtMost(view.sorted, yr) / state.n, 'var(--text-primary)']);
    rows.push(['Formula', theory(view.rate, yr), 'var(--text-muted)']);
    rows.forEach(function (r) {
      var row = el('div', 'tip-row');
      row.appendChild(U.keyLine(r[2]));
      row.appendChild(el('strong', null, U.fmtPct(r[1], 1)));
      row.appendChild(el('span', null, r[0]));
      tip.appendChild(row);
    });
    tip.hidden = false;
    var left = hx + 12;
    if (left + tip.offsetWidth > line.W) left = hx - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = line.m.top + 'px';
  }

  // ---------------------------------------------------------------- map
  var LAYERS = [
    ['sources', 'Faults used in the simulation', 'var(--crustal)'],
    ['faults', 'All active faults (USGS)', 'var(--map-fault)'],
    ['zone', 'Subduction zone', 'var(--megathrust)'],
    ['deepZone', 'Recorded deep quakes since 1970', 'var(--deep)'],
    ['cities', 'Cities', 'var(--text-secondary)'],
    ['history', 'Past quakes in the report', 'var(--text-secondary)'],
  ];

  function initMap() {
    qmap = window.QuakeMap.create({
      wrap: $('map-wrap'), canvas: $('map'), tooltip: $('map-tip'),
      describeEvent: describeEvent,
      onSelect: function (e) { selectEvent(e, false); },
    });

    // Legend: colors by type, circle size by magnitude.
    var lg = $('map-legend');
    [['deep', 'Deep (intraslab)'], ['megathrust', 'Megathrust (Cascadia M9)'], ['crustal', 'Crustal (shallow fault)']]
      .forEach(function (p) {
        var it = el('span', 'legend-item');
        var d = el('span', 'dot'); d.style.background = Q.types[p[0]].color;
        it.appendChild(d); it.appendChild(document.createTextNode(p[1]));
        lg.appendChild(it);
      });
    var sizes = el('span', 'legend-item size-key');
    [6.5, 7.5, 9].forEach(function (m) {
      var r = window.QuakeMap.radius(m), s = el('span');
      var svg = U.svg('svg', { width: r * 2 + 2, height: r * 2 + 2, 'aria-hidden': 'true' });
      U.svg('circle', { cx: r + 1, cy: r + 1, r: r, style: 'fill: none; stroke: var(--text-secondary); stroke-width: 1.5' }, svg);
      s.appendChild(svg); s.appendChild(document.createTextNode('M' + m));
      sizes.appendChild(s);
    });
    lg.appendChild(sizes);
    lg.appendChild(el('span', 'legend-item', 'Expanding ring = just happened'));

    var lt = $('layer-toggles');
    LAYERS.forEach(function (L) {
      var b = el('button', 'chip');
      b.type = 'button'; b.dataset.layer = L[0];
      var sw = el('span', 'swatch'); sw.style.background = L[2];
      b.appendChild(sw); b.appendChild(document.createTextNode(L[1]));
      b.addEventListener('click', function () {
        var o = {}; o[L[0]] = !qmap.getLayers()[L[0]];
        qmap.setLayers(o);
        syncLayers();
      });
      lt.appendChild(b);
    });
    syncLayers();

    $('zoom-in').addEventListener('click', function () { qmap.zoomBy(1.6); });
    $('zoom-out').addEventListener('click', function () { qmap.zoomBy(1 / 1.6); });
    $('zoom-reset').addEventListener('click', function () { qmap.zoomTo('region'); });
    document.querySelectorAll('#map-views button').forEach(function (b) {
      b.addEventListener('click', function () { qmap.zoomTo(b.dataset.view); });
    });
    document.querySelectorAll('#map-mode button').forEach(function (b) {
      b.addEventListener('click', function () { state.mapMode = b.dataset.mode; renderMapPanel(); renderMapLive(); syncControls(); });
    });
    document.querySelectorAll('#future-picker [data-step]').forEach(function (b) {
      b.addEventListener('click', function () { setFocus((state.focus + (+b.dataset.step) + state.n) % state.n); });
    });
    document.querySelectorAll('#future-picker [data-pick]').forEach(function (b) {
      b.addEventListener('click', function () { pickFuture(b.dataset.pick); });
    });

    $('year-scrub').addEventListener('input', function (ev) {
      stop(); state.playhead = +ev.target.value; renderLive(); syncControls();
    });
    $('map-restart').addEventListener('click', function () { play(0); });
    $('map-play').addEventListener('click', function () {
      if (anim) { stop(); syncControls(); }
      else play(state.playhead >= state.t - 0.01 ? 0 : state.playhead);
    });
  }

  function syncLayers() {
    var L = qmap.getLayers();
    document.querySelectorAll('#layer-toggles .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(!!L[b.dataset.layer]));
    });
  }

  function setFocus(i) {
    setNote('');
    state.focus = i;
    state.mapMode = 'one';
    state.highlight = null;
    drawGrid();
    renderMapPanel();
    renderMapLive();
    syncControls();
  }

  /**
   * Select a quake. From the strip or list (`fromTimeline`) the playhead jumps to that moment and the map
   * flies to it; from the map itself nothing moves.
   */
  function selectEvent(e, fromTimeline) {
    var zoom = fromTimeline;
    var changedFuture = e.fi !== state.focus || state.mapMode !== 'one';
    state.focus = e.fi;
    state.mapMode = 'one';
    state.highlight = e;
    if (fromTimeline || e.y > current()) { stop(); state.playhead = Math.min(state.t, e.y + 0.05); }
    if (zoom) {
      if (e.src === M9) qmap.zoomTo('region');
      else qmap.focusPoint(e.lon, e.lat, 4);
    }
    if (changedFuture) { drawGrid(); renderMapPanel(); syncControls(); }
    renderLive();
    syncControls();
  }

  function setNote(text) {
    var n = $('map-note');
    n.textContent = text || '';
    n.hidden = !text;
  }

  function pickFuture(kind) {
    var n = state.n, t = state.t, cands = [], note = '';
    if (kind === 'm9' && !state.on[M9]) {
      state.on[M9] = true;
      deriveView();
      note = 'Cascadia M9 was turned off in the earthquake sources, so it has been turned back on. ';
      renderAll();
    }
    if (kind === 'random') return setFocus(Math.floor(Math.random() * n));
    if (kind === 'most') {
      var best = -1, bi = 0;
      for (var i = 0; i < n; i++) { var c = eventsWithin(i, t).length; if (c > best) { best = c; bi = i; } }
      return setFocus(bi);
    }
    for (var j = 0; j < n; j++) {
      if (kind === 'm9' && sim.firstBy[M9][j] < t) cands.push(j);
      if (kind === 'none' && view.firstSel[j] >= t) cands.push(j);
    }
    if (!cands.length) {
      setNote(note + (kind === 'm9'
        ? 'None of these futures had a Cascadia M9 within ' + t + ' years. Try rolling new futures or a longer period.'
        : 'Every future had at least one selected quake within ' + t + ' years.'));
      return;
    }
    setFocus(cands[Math.floor(Math.random() * cands.length)]);
    if (kind === 'm9') {
      var m9 = eventsWithin(state.focus, t).filter(function (e) { return e.src === M9; })[0];
      if (m9) selectEvent(m9, true);
      setNote(note + U.fmtInt(cands.length) + ' of ' + U.fmtInt(n) + ' futures had a Cascadia M9. Showing Future #' +
        (state.focus + 1) + ', where it strikes in ' + yearOf(m9) + '. The map jumped to that year, and the shaded zone is the rupture. ' +
        'Press "From the start" below the map to watch this future unfold.');
    } else if (kind === 'none') {
      setNote(U.fmtInt(cands.length) + ' of ' + U.fmtInt(n) + ' futures had no quakes from the selected sources. Showing Future #' + (state.focus + 1) + '.');
    }
  }

  var panel = { strip: null, items: [] };

  /** Rebuild the parts of the map panel that depend on the chosen future (not on the playhead). */
  function renderMapPanel() {
    var one = state.mapMode === 'one';
    $('map-future').textContent = one ? 'Future #' + (state.focus + 1) : 'all ' + U.fmtInt(state.n) + ' futures';
    $('strip-wrap').hidden = !one;
    $('quake-list').hidden = !one;
    document.querySelectorAll('#future-picker [data-step]').forEach(function (b) { b.disabled = !one; });
    if (!one) return;
    renderStrip();
    renderQuakeList();
  }

  function renderStrip() {
    var wrap = $('strip-wrap'), root = $('strip');
    var W = wrap.clientWidth; if (!W) return;
    var H = 70, m = { left: 12, right: 12, top: 12, bottom: 22 }, t = state.t;
    var iw = W - m.left - m.right, cy = m.top + 16;
    function x(yr) { return m.left + (yr / t) * iw; }
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    U.svg('line', { x1: m.left, x2: m.left + iw, y1: cy, y2: cy, style: 'stroke: var(--axis); stroke-width: 1' }, root);
    var step = t <= 30 ? 5 : t <= 60 ? 10 : 20;
    if (W < 500) step *= 2;
    for (var yr = 0; yr <= t; yr += step) {
      U.svg('line', { x1: x(yr), x2: x(yr), y1: cy - 3, y2: cy + 3, style: 'stroke: var(--axis); stroke-width: 1' }, root);
      U.svg('text', { x: x(yr), y: H - 4, 'text-anchor': yr === 0 ? 'start' : yr === t ? 'end' : 'middle',
        style: 'fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums' }, root).textContent = START + yr;
    }
    var ph = U.svg('line', { y1: m.top - 6, y2: cy + 10, style: 'stroke: var(--text-primary); stroke-width: 2; pointer-events: none' }, root);
    var hl = U.svg('circle', { r: 0, cy: cy, style: 'fill: none; stroke: var(--text-primary); stroke-width: 2; pointer-events: none' }, root);

    var evs = eventsWithin(state.focus, t).slice().sort(function (a, b) { return b.mag - a.mag; });
    var dots = evs.map(function (e) {
      var r = Math.max(4, window.QuakeMap.radius(e.mag) * 0.6);
      var c = U.svg('circle', { cx: x(e.y), cy: cy, r: r, tabindex: 0, role: 'button',
        'aria-label': describeEvent(e).title,
        style: 'fill: ' + Q.types[e.type].color + '; stroke: var(--surface-1); stroke-width: 1.5; cursor: pointer' }, root);
      c.addEventListener('click', function (ev) { ev.stopPropagation(); selectEvent(e, true); });
      c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectEvent(e, true); } });
      c.addEventListener('pointerenter', function () { showStripTip(e, x(e.y)); });
      c.addEventListener('pointerleave', function () { $('strip-tip').hidden = true; });
      return { e: e, el: c };
    });

    // Clicking the strip background scrubs to that year.
    root.onclick = function (ev) {
      var rect = root.getBoundingClientRect();
      var yr = Math.max(0, Math.min(t, ((ev.clientX - rect.left - m.left) / iw) * t));
      stop(); state.playhead = yr; renderLive(); syncControls();
    };
    root.setAttribute('aria-label', 'Timeline of future #' + (state.focus + 1) + '. Click to jump to a year.');
    panel.strip = { x: x, ph: ph, hl: hl, dots: dots };
  }

  function showStripTip(e, px) {
    var tip = $('strip-tip'), info = describeEvent(e);
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', info.title));
    info.lines.slice(0, 2).forEach(function (l) { if (l) tip.appendChild(el('p', null, l)); });
    tip.hidden = false;
    var W = $('strip-wrap').clientWidth, left = px + 12;
    if (left + tip.offsetWidth > W) left = px - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = '-8px';
  }

  function renderQuakeList() {
    var list = $('quake-list');
    list.textContent = '';
    panel.items = [];
    var evs = eventsWithin(state.focus, state.t);
    if (!evs.length) {
      list.appendChild(el('li', 'empty', 'No quakes from the selected sources in this future between ' + START + ' and ' +
        (START + state.t) + '. Try "Busiest", or roll new futures.'));
      return;
    }
    evs.forEach(function (e) {
      var li = el('li'), b = el('button');
      b.type = 'button';
      b.appendChild(el('span', 'q-year', String(yearOf(e))));
      var d = el('span', 'dot'); d.style.background = Q.types[e.type].color; b.appendChild(d);
      b.appendChild(el('span', 'q-mag', 'M' + e.mag.toFixed(1)));
      var w = el('span', 'q-where');
      w.appendChild(el('strong', null, kindName(e).replace(/^./, function (c) { return c.toUpperCase(); })));
      w.appendChild(document.createTextNode(' · ' + whereText(e) + (e.fault ? ' · ' + e.fault : '') + ' · ' + Math.round(e.depth) + ' km deep'));
      b.appendChild(w);
      var pill = el('span', 'pill', 'not yet');
      b.appendChild(pill);
      b.addEventListener('click', function () { selectEvent(e, true); });
      li.appendChild(b);
      list.appendChild(li);
      panel.items.push({ e: e, li: li, b: b, pill: pill });
    });
  }

  /** Per-frame map updates: quakes up to the playhead, strip playhead, list state, summary. */
  function renderMapLive() {
    if (!qmap) return;
    var ph = current(), one = state.mapMode === 'one';
    var evs = one ? eventsWithin(state.focus, state.t) : view.all;
    var happened = evs.filter(function (e) { return e.y <= ph; });
    var rupture = one && happened.some(function (e) { return e.src === M9; });
    qmap.setScene({ events: evs, playhead: ph, mode: state.mapMode, highlight: one ? state.highlight : null, rupture: rupture });

    var year = displayYear(ph);
    $('year-scrub').value = ph;
    $('scrub-out').textContent = year;

    var summary;
    if (!anyOn()) summary = 'Pick at least one earthquake source above.';
    else if (one) {
      summary = evs.length
        ? evs.length + (evs.length === 1 ? ' quake' : ' quakes') + ' between ' + START + ' and ' + (START + state.t) +
          ': ' + happened.length + ' by ' + year + '.' + (rupture ? ' A Cascadia M9 has ruptured the subduction zone (shaded).' : '')
        : 'No quakes from the selected sources in this future.';
    } else {
      summary = U.fmtInt(happened.length) + ' simulated quakes across ' + U.fmtInt(state.n) + ' futures by ' + year +
        '. Each dot is one quake in one future, so clusters show where the hazard concentrates.';
    }
    $('map-summary').textContent = summary;
    renderBanner(one, evs, happened, rupture, year);
    $('map').setAttribute('aria-label', 'Map of simulated earthquakes. ' + summary);

    if (one && panel.strip) {
      var px = panel.strip.x(ph);
      panel.strip.ph.setAttribute('x1', px); panel.strip.ph.setAttribute('x2', px);
      panel.strip.dots.forEach(function (d) { d.el.style.opacity = d.e.y <= ph ? 1 : 0.3; });
      var h = state.highlight;
      if (h && h.fi === state.focus) {
        panel.strip.hl.setAttribute('cx', panel.strip.x(h.y));
        panel.strip.hl.setAttribute('r', Math.max(4, window.QuakeMap.radius(h.mag) * 0.6) + 4);
      } else panel.strip.hl.setAttribute('r', 0);
      panel.items.forEach(function (it) {
        var upcoming = it.e.y > ph;
        it.li.classList.toggle('is-upcoming', upcoming);
        it.pill.hidden = !upcoming;
        it.b.setAttribute('aria-pressed', String(it.e === state.highlight));
      });
    }
  }

  /** Live banner on the map: the year and what just happened. */
  function renderBanner(one, evs, happened, rupture, year) {
    var text = $('banner-text'), banner = $('map-banner');
    $('banner-year').textContent = year;
    text.textContent = '';
    banner.classList.remove('is-alert');
    if (!anyOn()) { text.textContent = 'No earthquake sources selected'; return; }
    if (!one) {
      var c = { deep: 0, crustal: 0, megathrust: 0 };
      happened.forEach(function (e) { c[e.type]++; });
      text.appendChild(el('strong', null, 'All ' + U.fmtInt(state.n) + ' futures: '));
      text.appendChild(document.createTextNode(U.fmtInt(happened.length) + ' quakes so far (' + U.fmtInt(c.deep) + ' deep, ' +
        U.fmtInt(c.crustal) + ' crustal, ' + U.fmtInt(c.megathrust) + ' Cascadia M9)'));
      return;
    }
    text.appendChild(el('strong', null, 'Future #' + (state.focus + 1) + ': '));
    if (!happened.length) {
      var next = evs[0];
      text.appendChild(document.createTextNode(next ? 'no quakes yet. First one comes in ' + yearOf(next) + '.' :
        'no quakes in this future.'));
      return;
    }
    var last = happened[happened.length - 1];
    if (rupture && current() - last.y < 3 && last.src === M9) banner.classList.add('is-alert');
    text.appendChild(document.createTextNode((last.src === M9 ? 'Cascadia M9 rupture! ' : 'latest: ') + 'M' + last.mag.toFixed(1) + ' ' +
      kindName(last) + ', ' + GEO.describe(last.lon, last.lat, last.src === M9 ? 3 : 2) + ' (' + yearOf(last) + '). ' +
      happened.length + ' of ' + evs.length + ' quakes so far.'));
  }

  // ---------------------------------------------------------------- tallies
  var tallyRows = [];
  function buildTallies() {
    var wrap = $('tallies');
    wrap.textContent = '';
    tallyRows = [];
    SOURCES.concat([{ id: '__any', name: 'Any selected source' }]).forEach(function (s) {
      var union = s.id === '__any';
      var row = el('div', 'tally' + (union ? ' is-union' : ''));
      var name = el('div', 'tally-name');
      var dot = el('span', 'dot');
      dot.style.background = union ? 'var(--text-primary)' : Q.types[s.type].color;
      name.appendChild(dot);
      name.appendChild(document.createTextNode(union ? s.name : SHORT[s.id] + ' (' + s.tauLabel + ')'));
      var simEl = el('div', 'tally-sim');
      var track = el('div', 'tally-track');
      var bar = el('div', 'tally-bar');
      bar.style.background = union ? 'var(--text-secondary)' : Q.types[s.type].color;
      var tick = el('div', 'tally-tick');
      track.appendChild(bar); track.appendChild(tick);
      var th = el('div', 'tally-theory');
      row.appendChild(name); row.appendChild(simEl); row.appendChild(track); row.appendChild(th);
      wrap.appendChild(row);
      tallyRows.push({ s: s, union: union, row: row, sim: simEl, bar: bar, tick: tick, th: th });
    });
  }

  function renderTallies() {
    var y = current();
    $('tally-by').textContent = 'by ' + displayYear(y);
    tallyRows.forEach(function (r) {
      var simP, thP;
      if (r.union) {
        simP = anyOn() ? countAtMost(view.sorted, y) / state.n : 0;
        thP = theory(view.rate, y);
      } else {
        simP = countFirst(sim.firstBy[r.s.id], y) / state.n;
        thP = theory(1 / r.s.tau, y);
        r.row.classList.toggle('is-off', !state.on[r.s.id]);
      }
      r.sim.textContent = U.fmtPct(simP, 1);
      r.bar.style.width = (simP * 100) + '%';
      r.tick.style.left = 'calc(' + (thP * 100) + '% - 1px)';
      r.th.textContent = 'formula ' + U.fmtPct(thP, 1);
    });
  }

  // ---------------------------------------------------------------- histogram
  function poissonPmf(k, lam) {
    var p = Math.exp(-lam);
    for (var i = 1; i <= k; i++) p *= lam / i;
    return p;
  }

  function renderHist() {
    syncControls();
    var s = byId[state.histSrc], t = state.t, n = state.n, K = 6;
    var counts = new Array(K + 1).fill(0);
    for (var i = 0; i < n; i++) {
      var c = 0, list = sim.futures[i];
      for (var j = 0; j < list.length; j++) if (list[j].y < t && matches(list[j], s.id)) c++;
      counts[Math.min(c, K)]++;
    }
    var lam = t / s.tau, exp = [], acc = 0;
    for (var k = 0; k < K; k++) { exp.push(poissonPmf(k, lam)); acc += exp[k]; }
    exp.push(Math.max(0, 1 - acc));
    var shares = counts.map(function (c) { return c / n; });
    var color = Q.types[s.type].color;
    $('hist-key').style.background = color;

    var wrap = $('hist-wrap'), root = $('hist-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = 260, m = { top: 24, right: 12, bottom: 44, left: 44 };
    var iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    var maxV = Math.max.apply(null, shares.concat(exp));
    var top = Math.min(1, Math.ceil(maxV * 10 + 0.5) / 10);
    function yy(v) { return m.top + (1 - v / top) * ih; }
    var band = iw / (K + 1), bw = Math.min(48, band * 0.6);
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    for (var g = 0; g <= top + 1e-9; g += top <= 0.5 ? 0.1 : 0.2) {
      U.svg('line', { x1: m.left, x2: m.left + iw, y1: yy(g), y2: yy(g),
        style: 'stroke: var(' + (g === 0 ? '--axis' : '--grid') + '); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 6, y: yy(g), dy: '0.32em', 'text-anchor': 'end',
        style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = Math.round(g * 100) + '%';
    }

    var tip = $('hist-tip');
    shares.forEach(function (v, k) {
      var cx = m.left + band * (k + 0.5), x0 = cx - bw / 2, h = Math.max(0, yy(0) - yy(v));
      var label = k === K ? K + '+' : String(k);
      if (h > 0) {
        var r = Math.min(4, h);
        U.svg('path', { d: 'M' + x0 + ',' + yy(0) + 'V' + (yy(v) + r) + 'Q' + x0 + ',' + yy(v) + ' ' + (x0 + r) + ',' + yy(v) +
          'H' + (x0 + bw - r) + 'Q' + (x0 + bw) + ',' + yy(v) + ' ' + (x0 + bw) + ',' + (yy(v) + r) + 'V' + yy(0) + 'Z',
          style: 'fill: ' + color }, root);
      }
      U.svg('line', { x1: x0 - 6, x2: x0 + bw + 6, y1: yy(exp[k]), y2: yy(exp[k]),
        style: 'stroke: var(--text-primary); stroke-width: 2; stroke-linecap: round' }, root);
      U.svg('text', { x: cx, y: Math.min(yy(v), yy(exp[k])) - 8, 'text-anchor': 'middle',
        style: 'fill: var(--text-primary); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums' }, root)
        .textContent = U.fmtPct(v);
      U.svg('text', { x: cx, y: H - m.bottom + 18, 'text-anchor': 'middle',
        style: 'fill: var(--text-secondary); font-size: 13px' }, root).textContent = label;

      var hit = U.svg('rect', { x: cx - band / 2, y: m.top, width: band, height: ih, fill: 'transparent', tabindex: 0,
        'aria-label': label + ' quakes: ' + counts[k] + ' futures, ' + U.fmtPct(v, 1) + '; expected ' + U.fmtPct(exp[k], 1) }, root);
      function show() {
        tip.textContent = '';
        tip.appendChild(el('div', 'tip-value', U.fmtPct(v, 1)));
        tip.appendChild(el('div', 'tip-head', label + (k === 1 ? ' quake' : ' quakes') + ' · ' + U.fmtInt(counts[k]) + ' futures'));
        tip.appendChild(el('p', null, 'Expected from the formula: ' + U.fmtPct(exp[k], 1)));
        tip.hidden = false;
        var left = cx + bw / 2 + 10;
        if (left + tip.offsetWidth > W) left = cx - bw / 2 - 10 - tip.offsetWidth;
        tip.style.left = Math.max(0, left) + 'px';
        tip.style.top = m.top + 'px';
      }
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', function () { tip.hidden = true; });
      hit.addEventListener('blur', function () { tip.hidden = true; });
    });
    U.svg('text', { x: m.left + iw / 2, y: H - 6, 'text-anchor': 'middle',
      style: 'fill: var(--text-muted); font-size: 12px' }, root)
      .textContent = 'Quakes per future in ' + t + ' yr (average ' + lam.toFixed(2) + ')';
    root.setAttribute('aria-label', 'Histogram of how many ' + SHORT[s.id] + 's each future gets in ' + t + ' years.');

    var body = $('hist-table');
    body.textContent = '';
    counts.forEach(function (c, k) {
      var tr = el('tr');
      [k === K ? K + ' or more' : String(k), [U.fmtInt(c), 'num'], [U.fmtPct(shares[k], 1), 'num'], [U.fmtPct(exp[k], 1), 'num']]
        .forEach(function (cell) {
          var v = Array.isArray(cell) ? cell : [cell];
          tr.appendChild(el('td', v[1] || null, v[0]));
        });
      body.appendChild(tr);
    });
  }

  // ---------------------------------------------------------------- orchestration
  function rebuild() {
    sim = simulate(state.n, state.seed);
    deriveView();
  }

  function renderLive() {
    drawGrid();
    renderHero();
    renderLine();
    renderTallies();
    renderMapLive();
  }

  function renderAll() {
    syncControls();
    renderMapPanel();
    renderLive();
    renderHist();
  }

  function init() {
    readColors();
    buildControls();
    buildTallies();
    rebuild();
    initMap();
    state.playhead = state.t;
    renderAll();
    play(0);

    var c = $('futures');
    c.addEventListener('pointermove', showGridTip);
    c.addEventListener('pointerleave', function () { $('grid-tip').hidden = true; });
    c.addEventListener('click', function (ev) {
      var i = indexAt(ev);
      if (i < 0) return;
      setFocus(i);
      var mapTop = $('map-wrap').getBoundingClientRect().top;
      if (mapTop > window.innerHeight * 0.6) {
        document.querySelector('.map-section').scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    });
    c.addEventListener('keydown', function (ev) {
      var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -grid.cols, ArrowDown: grid.cols }[ev.key];
      if (d == null) return;
      ev.preventDefault();
      setFocus(Math.max(0, Math.min(state.n - 1, state.focus + d)));
    });

    document.addEventListener('quake-themechange', function () { readColors(); drawGrid(); qmap.refreshTheme(); });
    var pending = null, lastW = 0;
    function onResize() {
      var w = document.querySelector('.page').clientWidth;
      if (pending || w === lastW) return;
      lastW = w;
      pending = requestAnimationFrame(function () { pending = null; grid = {}; renderMapPanel(); renderLive(); renderHist(); });
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.querySelector('.page'));
    else window.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
