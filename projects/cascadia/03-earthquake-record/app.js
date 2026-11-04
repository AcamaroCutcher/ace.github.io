/*
 * Project 3: "What the record shows". Real USGS earthquakes (ComCat), a live version of Figure 1.
 * Data: shared/data/pnw-catalog.js (built by viz/tools/build-catalog.mjs).
 */
(function () {
  'use strict';

  var U = window.VizUtils, C = window.PNW_CATALOG, G = window.PNW_MAP, QM = window.QuakeMap;
  var $ = U.$, el = U.el;

  var START = 1980, END_Y = 45;                 // playhead runs 0..45 years after Jan 1, 1980
  var DAY_MS = 86400000;
  var VIEWS = QM.VIEWS;
  var REGION_NAMES = {
    region: 'the whole region', puget: 'the Puget Sound area', portland: 'the Portland area',
    oregon: 'northern & central Oregon', mendocino: 'the northern California coast',
  };
  var DEPTH_EDGES = [10, 20, 30, 40, 50];
  // "Northern or central Oregon" for the report's claim: onshore, Coos Bay to the Columbia River.
  var OREGON_NC = [[-124.3, 43.5], [-121.5, 46.1]];
  var DEPTH_LABELS = ['0', '10', '20', '30', '40', '50+'];

  function depthBin(d) { for (var i = 0; i < DEPTH_EDGES.length; i++) if (d < DEPTH_EDGES[i]) return i; return 5; }
  function depthVar(bin) { return 'var(--depth-' + bin + ')'; }

  function toEvent(r) {
    var ms = r[1] * DAY_MS, date = new Date(ms), yr = date.getUTCFullYear();
    var frac = (ms - Date.UTC(yr, 0, 1)) / (Date.UTC(yr + 1, 0, 1) - Date.UTC(yr, 0, 1));
    return { id: r[0], date: date, year: yr, y: yr + frac - START, lon: r[2], lat: r[3], depth: r[4], mag: r[5],
      place: r[6] || '', bin: depthBin(r[4]) };
  }
  var ALL = C.main.map(toEvent);
  var XS = C.puget.map(toEvent);

  var DEFAULTS = { region: 'region', depth: 'all', mag: 4, from: 1980 };
  var state = { region: 'region', depth: 'all', mag: 4, from: 1980, playhead: END_Y, selected: null, speed: 15000, trail: false };
  var derived = { shown: [], region: [] };
  var anim = null, qmap = null;

  // ---------------------------------------------------------------- helpers
  function fmtDate(d) { return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function yearNow() { return Math.min(2024, Math.floor(START + state.playhead)); }
  function inBox(e, b) { return e.lon >= b[0][0] && e.lon <= b[1][0] && e.lat >= b[0][1] && e.lat <= b[1][1]; }
  function inRegion(e, region) {
    if (region === 'region') return true;
    return inBox(e, region === 'oregon' ? OREGON_NC : VIEWS[region]);
  }
  function passes(e) {
    return e.mag >= state.mag && e.year >= state.from &&
      (state.depth === 'all' || (state.depth === 'shallow' ? e.depth < 30 : e.depth >= 30));
  }
  function upTo(list) { return list.filter(function (e) { return e.y <= state.playhead; }); }
  function usgsUrl(e) { return 'https://earthquake.usgs.gov/earthquakes/eventpage/' + encodeURIComponent(e.id); }
  function radiusOf(m) { return 3.5 + (m - 4) * 3; }
  function depthClass(e) { return e.depth >= 30 ? 'deep, likely inside the subducting plate' : 'shallow, in the crust or at a plate boundary'; }

  function describeEvent(e) {
    return {
      title: 'M' + e.mag.toFixed(1) + ' · ' + fmtDate(e.date),
      lines: [e.place, Math.max(0, Math.round(e.depth)) + ' km deep (' + depthClass(e) + ')', 'Click to select'],
    };
  }

  function derive() {
    derived.shown = ALL.filter(passes);
    derived.region = derived.shown.filter(function (e) { return inRegion(e, state.region); });
    if (state.selected && !passes(state.selected)) state.selected = null;
  }

  // ---------------------------------------------------------------- controls
  function bindSegmented(id, key, parse, after) {
    document.querySelectorAll('#' + id + ' button').forEach(function (b) {
      b.addEventListener('click', function () {
        state[key] = parse(b.dataset[key]);
        if (after) after();
        derive(); renderAll();
      });
    });
  }

  function syncControls() {
    [['region-buttons', 'region', String], ['depth-buttons', 'depth', String], ['mag-buttons', 'mag', Number],
      ['from-buttons', 'from', Number], ['speed-buttons', 'speed', Number]].forEach(function (g) {
      document.querySelectorAll('#' + g[0] + ' button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(g[2](b.dataset[g[1]]) === state[g[1]]));
      });
    });
    $('title-mag').textContent = state.mag.toFixed(1);
    $('title-from').textContent = state.from;
    $('table-region').textContent = REGION_NAMES[state.region];
    $('play-btn').textContent = anim ? 'Pause' : state.playhead >= END_Y - 0.01 ? 'Replay' : 'Play';
    $('trail').checked = state.trail;
  }

  function buildLegend() {
    var lg = $('map-legend');
    var depth = el('span', 'legend-item');
    depth.appendChild(document.createTextNode('Depth (km)'));
    var key = el('span', 'depth-key');
    for (var i = 0; i < 6; i++) {
      var w = el('span');
      w.style.display = 'inline-flex'; w.style.flexDirection = 'column'; w.style.alignItems = 'flex-start';
      var sw = el('span', 'sw'); sw.style.background = depthVar(i);
      w.appendChild(sw);
      w.appendChild(el('span', 'depth-key-labels', DEPTH_LABELS[i]));
      key.appendChild(w);
    }
    depth.appendChild(key);
    lg.appendChild(depth);

    var sizes = el('span', 'legend-item size-key');
    [4, 5, 6, 7].forEach(function (m) {
      var r = radiusOf(m), s = el('span');
      var svg = U.svg('svg', { width: r * 2 + 2, height: r * 2 + 2, 'aria-hidden': 'true' });
      U.svg('circle', { cx: r + 1, cy: r + 1, r: r, style: 'fill: none; stroke: var(--text-secondary); stroke-width: 1.5' }, svg);
      s.appendChild(svg); s.appendChild(document.createTextNode('M' + m));
      sizes.appendChild(s);
    });
    lg.appendChild(sizes);
    var hist = el('span', 'legend-item');
    hist.appendChild(el('span', 'hollow'));
    hist.appendChild(document.createTextNode('Notable quake before 1980 (approx.)'));
    lg.appendChild(hist);
  }

  var LAYERS = [
    ['faults', 'Active faults (USGS)', 'var(--map-fault)'],
    ['zone', 'Cascadia subduction zone', 'var(--megathrust)'],
    ['cities', 'Cities', 'var(--text-secondary)'],
    ['history', 'Notable quakes before 1980', 'var(--text-secondary)'],
  ];

  function buildLayerToggles() {
    var lt = $('layer-toggles');
    LAYERS.forEach(function (L) {
      var b = el('button', 'chip');
      b.type = 'button'; b.dataset.layer = L[0];
      var sw = el('span', 'swatch'); sw.style.background = L[2];
      b.appendChild(sw); b.appendChild(document.createTextNode(L[1]));
      b.addEventListener('click', function () {
        var o = {}; o[L[0]] = !qmap.getLayers()[L[0]];
        qmap.setLayers(o); syncLayers();
      });
      lt.appendChild(b);
    });
    syncLayers();
  }
  function syncLayers() {
    var L = qmap.getLayers();
    document.querySelectorAll('#layer-toggles .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(!!L[b.dataset.layer]));
    });
  }

  // ---------------------------------------------------------------- animation
  function play(from) {
    stop();
    if (U.prefersReducedMotion()) { state.playhead = END_Y; renderAll(); return; }
    var startFrac = Math.max(0, Math.min(1, (from || 0) / END_Y)), t0 = performance.now();
    state.playhead = END_Y * startFrac;
    function frame(now) {
      var p = Math.min(1, startFrac + (now - t0) / state.speed);
      state.playhead = END_Y * p;
      anim = p < 1 ? requestAnimationFrame(frame) : null;
      renderLive();
      if (!anim) { syncControls(); renderLive(); }
    }
    anim = requestAnimationFrame(frame);
    syncControls();
  }
  function stop() { if (anim) cancelAnimationFrame(anim); anim = null; }
  function setPlayhead(y) { stop(); state.playhead = Math.max(0, Math.min(END_Y, y)); renderLive(); syncControls(); }

  // ---------------------------------------------------------------- selection
  function select(e, fly) {
    state.selected = e;
    if (e && e.y > state.playhead) { stop(); state.playhead = END_Y; }
    if (e && fly) {
      var k = e.lon < -124.5 ? 3 : 5;
      qmap.focusPoint(e.lon, e.lat, k);
      document.querySelector('.map-section').scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
    renderSelected();
    renderTable();
    renderLive();
    syncControls();
  }

  function renderSelected() {
    var box = $('selected'), e = state.selected;
    box.textContent = '';
    box.hidden = !e;
    if (!e) return;
    box.appendChild(el('span', 's-title', 'Selected: M' + e.mag.toFixed(1) + ' · ' + fmtDate(e.date)));
    box.appendChild(el('span', 's-meta', e.place + ' · ' + Math.max(0, Math.round(e.depth)) + ' km deep'));
    var a = el('a', null, 'Details on the USGS site ↗');
    a.href = usgsUrl(e); a.target = '_blank'; a.rel = 'noopener';
    box.appendChild(a);
    var clear = el('button', 'link-btn', 'Clear');
    clear.type = 'button';
    clear.addEventListener('click', function () { select(null); });
    box.appendChild(clear);
  }

  // ---------------------------------------------------------------- map + side panel
  function renderMap() {
    qmap.setScene({ events: derived.shown, playhead: state.playhead, mode: 'one', highlight: state.selected,
      trail: state.trail ? 5 : 0, pulse: !!anim });
    // Banner counts the selected region, so it always agrees with the tiles beside the map.
    var vis = upTo(derived.region), year = yearNow();
    $('banner-year').textContent = year;
    var text = $('banner-text');
    text.textContent = '';
    text.appendChild(el('strong', null, U.fmtInt(vis.length) + ' quakes'));
    var largest = vis.reduce(function (a, b) { return !a || b.mag > a.mag ? b : a; }, null);
    text.appendChild(document.createTextNode((state.region !== 'region' ? ' in ' + REGION_NAMES[state.region] : '') +
      (largest ? ' · largest M' + largest.mag.toFixed(1) + ' ' + shortPlace(largest) + ' (' + largest.year + ')' : '')));
    var summary = U.fmtInt(derived.shown.length) + ' earthquakes match the filters' +
      (state.region !== 'region' ? '; ' + U.fmtInt(derived.region.length) + ' of them in ' + REGION_NAMES[state.region] : '') + '.';
    $('map-summary').textContent = summary;
    $('map').setAttribute('aria-label', 'Map of recorded earthquakes. ' + summary);
    $('year-scrub').value = state.playhead;
    $('scrub-out').textContent = year;
  }

  function shortPlace(e) {
    var m = /^The \d{4} (.+?) Earthquake/i.exec(e.place);
    if (m) return m[1];
    return e.place.replace(/^\d+ km [NSEW]{1,3} of /, 'near ');
  }

  function renderTiles() {
    var vis = upTo(derived.region), wrap = $('tiles');
    var years = Math.max(1, Math.min(END_Y, state.playhead) - (state.from - START));
    var deep = vis.filter(function (e) { return e.depth >= 30; }).length;
    var largest = vis.reduce(function (a, b) { return !a || b.mag > a.mag ? b : a; }, null);
    var tiles = [
      ['Earthquakes', U.fmtInt(vis.length), state.from + '–' + yearNow()],
      ['Per year', vis.length ? (vis.length / years).toFixed(1) : '0', 'on average'],
      ['Deep (≥ 30 km)', vis.length ? U.fmtPct(deep / vis.length) : '–', U.fmtInt(deep) + ' of ' + U.fmtInt(vis.length)],
      ['Largest', largest ? 'M' + largest.mag.toFixed(1) : '–', largest ? shortPlace(largest) + ', ' + largest.year : 'none yet', true],
    ];
    wrap.textContent = '';
    tiles.forEach(function (t) {
      var d = el('div', 'tile' + (t[3] ? ' wide' : ''));
      d.appendChild(el('div', 't-label', t[0]));
      d.appendChild(el('div', 't-value', t[1]));
      d.appendChild(el('div', 't-sub', t[2]));
      if (t[3] && largest) { d.title = largest.place; }
      wrap.appendChild(d);
    });
  }

  function renderDepthChart() {
    var wrap = $('depth-wrap'), root = $('depth-chart');
    var W = wrap.clientWidth; if (!W) return;
    var BIN = 5, NB = 15, rowH = 16;
    var m = { top: 4, right: 44, bottom: 22, left: 44 }, H = m.top + NB * rowH + m.bottom, iw = W - m.left - m.right;
    var counts = new Array(NB).fill(0);
    upTo(derived.region).forEach(function (e) { counts[Math.min(NB - 1, Math.floor(e.depth / BIN))]++; });
    var max = Math.max.apply(null, counts) || 1;
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';
    U.svg('line', { x1: m.left, x2: m.left, y1: m.top, y2: m.top + NB * rowH, style: 'stroke: var(--axis); stroke-width: 1' }, root);
    var tip = $('depth-tip');
    counts.forEach(function (c, i) {
      var y = m.top + i * rowH, w = (c / max) * iw, bh = rowH - 4;
      if (i % 2 === 0) {
        U.svg('text', { x: m.left - 6, y: y + 2, dy: '0.32em', 'text-anchor': 'end',
          style: 'fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums' }, root)
          .textContent = i === NB - 1 ? '70+' : (i * BIN) + ' km';
      }
      if (c > 0) {
        var r = Math.min(4, w);
        U.svg('path', { d: 'M' + m.left + ',' + (y + 2) + 'H' + (m.left + w - r) + 'Q' + (m.left + w) + ',' + (y + 2) + ' ' + (m.left + w) + ',' + (y + 2 + r) +
          'V' + (y + 2 + bh - r) + 'Q' + (m.left + w) + ',' + (y + 2 + bh) + ' ' + (m.left + w - r) + ',' + (y + 2 + bh) + 'H' + m.left + 'Z',
          style: 'fill: ' + depthVar(depthBin(i * BIN + BIN / 2)) }, root);
      }
      if (c === max && c > 0) {
        U.svg('text', { x: m.left + w + 6, y: y + 2 + bh / 2, dy: '0.32em',
          style: 'fill: var(--text-primary); font-size: 12px; font-weight: 600' }, root).textContent = c;
      }
      var hit = U.svg('rect', { x: m.left, y: y, width: iw + m.right, height: rowH, fill: 'transparent', tabindex: 0,
        'aria-label': (i * BIN) + ' to ' + (i * BIN + BIN) + ' km deep: ' + c + ' earthquakes' }, root);
      function show() {
        tip.textContent = '';
        tip.appendChild(el('div', 'tip-value', String(c)));
        tip.appendChild(el('div', 'tip-head', i === NB - 1 ? '70 km or deeper' : (i * BIN) + '–' + (i * BIN + BIN) + ' km deep'));
        tip.hidden = false;
        tip.style.left = Math.min(W - tip.offsetWidth, m.left + w + 10) + 'px';
        tip.style.top = (y - 6) + 'px';
      }
      hit.addEventListener('pointerenter', show); hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', function () { tip.hidden = true; });
      hit.addEventListener('blur', function () { tip.hidden = true; });
    });
    U.svg('text', { x: m.left, y: H - 4, style: 'fill: var(--text-muted); font-size: 11px' }, root)
      .textContent = 'Quakes per 5 km of depth';
    $('depth-region').textContent = '(' + REGION_NAMES[state.region].replace(/^the /, '') + ')';
    root.setAttribute('aria-label', 'Bar chart of earthquake counts by depth in ' + REGION_NAMES[state.region] + '.');
  }

  // ---------------------------------------------------------------- magnitude-over-time chart
  var tl = {};
  function renderTimeChart() {
    var wrap = $('time-wrap'), root = $('time-chart');
    var W = wrap.clientWidth; if (!W) return;
    var H = 200, m = { top: 10, right: 16, bottom: 26, left: 36 };
    var iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    var evs = derived.region;
    var mMin = Math.floor(state.mag), mMax = Math.max(7.5, Math.ceil(d3.max(evs, function (e) { return e.mag; }) || 7));
    function x(y) { return m.left + (y / END_Y) * iw; }
    function y(mag) { return m.top + (1 - (mag - mMin) / (mMax - mMin)) * ih; }
    tl = { x: x, y: y, m: m, iw: iw, W: W, evs: evs };
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    for (var g = mMin; g <= mMax; g++) {
      U.svg('line', { x1: m.left, x2: m.left + iw, y1: y(g), y2: y(g),
        style: 'stroke: var(' + (g === mMin ? '--axis' : '--grid') + '); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 6, y: y(g), dy: '0.32em', 'text-anchor': 'end',
        style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = 'M' + g;
    }
    var step = W < 600 ? 10 : 5;
    for (var yr = 0; yr <= END_Y; yr += step) {
      U.svg('text', { x: x(yr), y: H - 8, 'text-anchor': yr === 0 ? 'start' : yr === END_Y ? 'end' : 'middle',
        style: 'fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums' }, root).textContent = START + yr;
    }
    if (!evs.length) {
      U.svg('text', { x: m.left + iw / 2, y: m.top + ih / 2, 'text-anchor': 'middle',
        style: 'fill: var(--text-secondary); font-size: 14px' }, root).textContent = 'No earthquakes match these filters in ' + REGION_NAMES[state.region] + '.';
    }

    // Two copies of the dots: faint (future) and full (up to the playhead, revealed by a clip rect).
    var clipId = 'tl-clip';
    var defs = U.svg('defs', {}, root);
    var clip = U.svg('clipPath', { id: clipId }, defs);
    tl.clipRect = U.svg('rect', { x: 0, y: 0, height: H, width: 0 }, clip);
    var faint = U.svg('g', { style: 'opacity: 0.18' }, root);
    var full = U.svg('g', { 'clip-path': 'url(#' + clipId + ')' }, root);
    evs.slice().sort(function (a, b) { return a.mag - b.mag; }).forEach(function (e) {
      var a = { cx: x(e.y), cy: y(e.mag), r: 1.6 + (e.mag - 4) * 1.5, style: 'fill: ' + depthVar(e.bin) };
      U.svg('circle', a, faint);
      U.svg('circle', a, full);
    });
    tl.sel = U.svg('circle', { r: 0, style: 'fill: none; stroke: var(--text-primary); stroke-width: 2; pointer-events: none' }, root);
    tl.ph = U.svg('line', { y1: m.top - 4, y2: m.top + ih, style: 'stroke: var(--text-primary); stroke-width: 2; pointer-events: none' }, root);
    tl.hover = U.svg('line', { y1: m.top, y2: m.top + ih, visibility: 'hidden', style: 'stroke: var(--text-muted); stroke-width: 1; pointer-events: none' }, root);
    tl.quad = d3.quadtree().x(function (e) { return x(e.y); }).y(function (e) { return y(e.mag); }).addAll(evs);
    root.setAttribute('aria-label', 'Magnitude over time for ' + evs.length + ' earthquakes in ' + REGION_NAMES[state.region] + '.');
    updateTimePlayhead();
  }

  function updateTimePlayhead() {
    if (!tl.x) return;
    var px = tl.x(state.playhead);
    tl.clipRect.setAttribute('width', px + 8);
    tl.ph.setAttribute('x1', px); tl.ph.setAttribute('x2', px);
    var s = state.selected;
    if (s && inRegion(s, state.region)) {
      tl.sel.setAttribute('cx', tl.x(s.y)); tl.sel.setAttribute('cy', tl.y(s.mag));
      tl.sel.setAttribute('r', 1.6 + (s.mag - 4) * 1.5 + 4);
    } else tl.sel.setAttribute('r', 0);
  }

  function bindTimeChart() {
    var root = $('time-chart'), dragging = false, moved = false;
    function local(ev) { var r = root.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    function yearAt(px) { return ((px - tl.m.left) / tl.iw) * END_Y; }
    root.addEventListener('pointerdown', function (ev) {
      dragging = true; moved = false; root.setPointerCapture(ev.pointerId);
    });
    root.addEventListener('pointermove', function (ev) {
      var p = local(ev), tip = $('time-tip');
      if (dragging) { moved = true; setPlayhead(yearAt(p[0])); tip.hidden = true; return; }
      var e = tl.quad && tl.quad.find(p[0], p[1], 8);
      tl.hover.setAttribute('x1', p[0]); tl.hover.setAttribute('x2', p[0]);
      tl.hover.setAttribute('visibility', p[0] >= tl.m.left && p[0] <= tl.m.left + tl.iw ? 'visible' : 'hidden');
      if (!e) { tip.hidden = true; return; }
      var info = describeEvent(e);
      tip.textContent = '';
      tip.appendChild(el('div', 'tip-head', info.title));
      tip.appendChild(el('p', null, info.lines[0]));
      tip.appendChild(el('p', null, info.lines[1]));
      tip.hidden = false;
      var left = tl.x(e.y) + 12;
      if (left + tip.offsetWidth > tl.W) left = tl.x(e.y) - 12 - tip.offsetWidth;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, tl.y(e.mag) - 20) + 'px';
    });
    root.addEventListener('pointerup', function (ev) {
      if (!dragging) return;
      dragging = false;
      if (moved) return;
      var p = local(ev), e = tl.quad && tl.quad.find(p[0], p[1], 8);
      if (e) select(e, true);
      else setPlayhead(yearAt(p[0]));
    });
    root.addEventListener('pointerleave', function () { $('time-tip').hidden = true; tl.hover && tl.hover.setAttribute('visibility', 'hidden'); });
  }

  // ---------------------------------------------------------------- cross-section
  function renderCrossSection() {
    var wrap = $('xs-wrap'), root = $('xs-chart');
    var W = wrap.clientWidth; if (!W) return;
    var WEST = -124.2, EAST = -121.3, LAT0 = 47.65, MAXD = 80;
    var kmPerDeg = 111.32 * Math.cos(LAT0 * Math.PI / 180), widthKm = (EAST - WEST) * kmPerDeg;
    var m = { top: 30, right: 16, bottom: 38, left: 52 }, iw = W - m.left - m.right;
    var natural = iw * MAXD / widthKm;
    var ih = Math.max(220, Math.min(380, natural)), ve = ih / natural;
    var H = m.top + ih + m.bottom;
    function x(lon) { return m.left + ((lon - WEST) * kmPerDeg / widthKm) * iw; }
    function y(d) { return m.top + (Math.min(d, MAXD) / MAXD) * ih; }
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    [0, 20, 40, 60, 80].forEach(function (d) {
      U.svg('line', { x1: m.left, x2: m.left + iw, y1: y(d), y2: y(d), style: 'stroke: var(--grid); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 6, y: y(d), dy: '0.32em', 'text-anchor': 'end',
        style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = d + ' km';
    });
    for (var km = 0; km <= widthKm; km += 50) {
      U.svg('text', { x: m.left + (km / widthKm) * iw, y: m.top + ih + 16, 'text-anchor': 'middle',
        style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = km;
    }
    U.svg('text', { x: m.left + iw / 2, y: H - 4, 'text-anchor': 'middle', style: 'fill: var(--text-muted); font-size: 12px' }, root)
      .textContent = 'Distance east of 124.2°W (km)' + (Math.abs(ve - 1) > 0.05 ? ' · depth stretched ×' + ve.toFixed(1) : ' · true proportions');

    // Surface markers
    U.svg('line', { x1: m.left, x2: m.left + iw, y1: y(0), y2: y(0), style: 'stroke: var(--axis); stroke-width: 1.5' }, root);
    [['Olympia', -122.9], ['Seattle', -122.33]].forEach(function (c) {
      U.svg('line', { x1: x(c[1]), x2: x(c[1]), y1: y(0) - 6, y2: y(0), style: 'stroke: var(--text-secondary); stroke-width: 1.5' }, root);
      U.svg('text', { x: x(c[1]), y: y(0) - 10, 'text-anchor': 'middle', style: 'fill: var(--text-primary); font-size: 12px; font-weight: 600' }, root).textContent = c[0];
    });
    U.svg('text', { x: m.left, y: y(0) - 10, style: 'fill: var(--text-secondary); font-size: 12px' }, root).textContent = '← west (coast)';
    U.svg('text', { x: m.left + iw, y: y(0) - 10, 'text-anchor': 'end', style: 'fill: var(--text-secondary); font-size: 12px' }, root).textContent = 'east (Cascades) →';

    var sorted = XS.slice().sort(function (a, b) { return a.mag - b.mag; });
    var g = U.svg('g', {}, root);
    sorted.forEach(function (e) {
      U.svg('circle', { cx: x(e.lon), cy: y(e.depth), r: 1.4 + (e.mag - 2.5) * 1.2,
        style: 'fill: ' + depthVar(e.bin) + '; fill-opacity: 0.75' }, g);
    });

    // Labels for the two populations and the largest quake
    var lab = 'fill: var(--text-primary); font-size: 13px; font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round';
    U.svg('text', { x: x(-121.75), y: y(6), 'text-anchor': 'end', style: lab }, root).textContent = 'Crustal quakes (North American Plate)';
    U.svg('text', { x: x(-123.95), y: y(68), style: lab }, root).textContent = 'Intraslab quakes (inside the sinking Juan de Fuca Plate)';
    var big = XS.reduce(function (a, b) { return b.mag > a.mag ? b : a; });
    U.svg('circle', { cx: x(big.lon), cy: y(big.depth), r: 1.4 + (big.mag - 2.5) * 1.2 + 4, style: 'fill: none; stroke: var(--text-primary); stroke-width: 1.5' }, root);
    U.svg('text', { x: x(big.lon) + 14, y: y(big.depth) + 4, style: lab.replace('13px', '12px') }, root)
      .textContent = 'M' + big.mag.toFixed(1) + (big.year === 2001 ? ' Nisqually' : '') + ', ' + big.year;

    var quad = d3.quadtree().x(function (e) { return x(e.lon); }).y(function (e) { return y(e.depth); }).addAll(XS);
    var tip = $('xs-tip');
    root.onpointermove = function (ev) {
      var r = root.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
      var e = quad.find(px, py, 10);
      if (!e) { tip.hidden = true; return; }
      tip.textContent = '';
      tip.appendChild(el('div', 'tip-head', 'M' + e.mag.toFixed(1) + ' · ' + fmtDate(e.date)));
      tip.appendChild(el('p', null, Math.max(0, Math.round(e.depth)) + ' km deep (' + depthClass(e) + ')'));
      tip.hidden = false;
      var left = x(e.lon) + 12;
      if (left + tip.offsetWidth > W) left = x(e.lon) - 12 - tip.offsetWidth;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, y(e.depth) - 30) + 'px';
    };
    root.onpointerleave = function () { tip.hidden = true; };
    root.setAttribute('aria-label', 'Cross-section of ' + XS.length + ' earthquakes beneath Puget Sound: shallow crustal quakes and a deeper band of intraslab quakes.');
    $('xs-count').textContent = U.fmtInt(XS.length);
  }

  // ---------------------------------------------------------------- claims
  function pointInPolygon(pt, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  var CLAIMS = [
    {
      title: 'Deep quakes dominate under Puget Sound',
      says: '"The most common type of moderate magnitude seismicity in the U.S. Pacific Northwest is deep earthquakes", most common beneath Puget Sound (p. 2).',
      check: function () {
        var p = ALL.filter(function (e) { return inBox(e, VIEWS.puget); });
        var deep = p.filter(function (e) { return e.depth >= 30; }).length;
        return { ok: deep > p.length - deep,
          text: deep + ' of ' + p.length + ' M4+ quakes in the Puget Sound area (' + U.fmtPct(deep / p.length) + ') were 30 km or deeper; ' + (p.length - deep) + ' were shallow.' };
      },
      apply: { region: 'puget', depth: 'all', mag: 4, from: 1980 },
    },
    {
      title: 'Deep quakes happen 40–60 km down',
      says: 'Intraslab earthquakes "typically occur at depths of 25–40 miles (40–60 kilometers)" (p. 2).',
      check: function () {
        var d = ALL.filter(function (e) { return inBox(e, VIEWS.puget) && e.depth >= 30; }).map(function (e) { return e.depth; }).sort(d3.ascending);
        var med = d3.quantile(d, 0.5), lo = d3.quantile(d, 0.1), hi = d3.quantile(d, 0.9);
        return { ok: med >= 40 && med <= 60,
          text: 'Median depth ' + Math.round(med) + ' km; 80% were between ' + Math.round(lo) + ' and ' + Math.round(hi) + ' km (' + d.length + ' deep M4+ quakes).' };
      },
      apply: { region: 'puget', depth: 'deep', mag: 4, from: 1980 },
    },
    {
      title: 'No deep quakes under northern & central Oregon',
      says: '"Since 1990, no intraslab earthquakes with a magnitude greater than or equal to 4 have been observed in northern or central Oregon" (p. 2–3).',
      check: function () {
        var o = ALL.filter(function (e) { return inBox(e, OREGON_NC); });
        var deep90 = o.filter(function (e) { return e.depth >= 30 && e.year >= 1990; }).length;
        return { ok: deep90 === 0,
          text: deep90 + ' deep (≥ 30 km) M4+ quakes since 1990 in northern & central Oregon. All ' + o.length + ' M4+ quakes there were shallow.' };
      },
      apply: { region: 'oregon', depth: 'all', mag: 4, from: 1990 },
    },
    {
      title: 'The megathrust is eerily quiet',
      says: '"There have been very few small-to-moderate magnitude earthquakes observed on the Cascadia megathrust" (p. 3).',
      check: function () {
        var zone = G.regions.megathrust.zone;
        var inz = ALL.filter(function (e) { return e.lat > 42.5 && e.lat < 48.5 && pointInPolygon([e.lon, e.lat], zone); });
        return { ok: inz.length / ALL.length < 0.01,
          text: 'Only ' + inz.length + ' of ' + U.fmtInt(ALL.length) + ' M4+ quakes (' + U.fmtPct(inz.length / ALL.length, 1) + ') fall inside the megathrust zone off Oregon and Washington, even though it last produced an M9 in 1700.' };
      },
      apply: { region: 'region', depth: 'all', mag: 4, from: 1980 },
      layers: { zone: true },
    },
    {
      title: 'A few big offshore quakes per decade near the Gorda Plate',
      says: 'The Gorda Plate region "experiences a few offshore earthquakes per decade (M≥6.5) within ~100 miles (~160 kilometers) of the coastline" (p. 5).',
      check: function () {
        var big = ALL.filter(function (e) {
          if (e.mag < 6.5 || e.lat < 39.8 || e.lat > 43) return false;
          var coast = -124.3, maxW = coast - 160 / (111.32 * Math.cos(e.lat * Math.PI / 180));
          return e.lon < coast && e.lon >= maxW;
        });
        var per = big.length / 4.5;
        return { ok: per >= 1 && per <= 6,
          text: big.length + ' M6.5+ offshore quakes within ~160 km of the northern California and southern Oregon coast in 45 years: about ' + per.toFixed(1) + ' per decade.' };
      },
      apply: { region: 'mendocino', depth: 'all', mag: 6.5, from: 1980 },
    },
  ];

  function buildClaims() {
    var wrap = $('claims');
    CLAIMS.forEach(function (c) {
      var r = c.check(), card = el('article', 'claim');
      card.appendChild(el('h3', null, c.title));
      card.appendChild(el('span', 'c-label', 'The report says'));
      card.appendChild(el('p', null, c.says));
      card.appendChild(el('span', 'c-label', 'The record shows'));
      card.appendChild(el('p', 'c-data', r.text));
      var foot = el('div', 'c-foot');
      var v = el('span', 'verdict' + (r.ok ? '' : ' differs'));
      v.appendChild(el('span', 'icon', r.ok ? '✓' : '!'));
      v.appendChild(document.createTextNode(r.ok ? 'Consistent with the report' : 'Differs from the report'));
      foot.appendChild(v);
      var b = el('button', 'btn', 'Show on map');
      b.type = 'button';
      b.addEventListener('click', function () {
        stop();
        for (var k in c.apply) state[k] = c.apply[k];
        state.playhead = END_Y; state.selected = null;
        if (c.layers) { qmap.setLayers(c.layers); syncLayers(); }
        derive(); renderAll();
        qmap.zoomTo(state.region);
        document.querySelector('.controls').scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
      foot.appendChild(b);
      card.appendChild(foot);
      wrap.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- table
  function renderTable() {
    var body = $('table-body');
    body.textContent = '';
    var top = derived.region.slice().sort(function (a, b) { return b.mag - a.mag || a.y - b.y; }).slice(0, 15);
    if (!top.length) {
      var tr0 = el('tr'), td0 = el('td', null, 'No earthquakes match these filters.');
      td0.colSpan = 5; tr0.appendChild(td0); body.appendChild(tr0);
      return;
    }
    top.forEach(function (e) {
      var tr = el('tr');
      tr.tabIndex = 0;
      tr.setAttribute('aria-selected', String(e === state.selected));
      tr.appendChild(el('td', null, fmtDate(e.date)));
      tr.appendChild(el('td', 'num', 'M' + e.mag.toFixed(1)));
      var dtd = el('td', 'num');
      var dot = el('span', 'dot'); dot.style.background = depthVar(e.bin);
      dtd.appendChild(dot); dtd.appendChild(document.createTextNode(Math.max(0, Math.round(e.depth)) + ' km'));
      tr.appendChild(dtd);
      tr.appendChild(el('td', null, e.place));
      var ltd = el('td'), a = el('a', null, 'USGS ↗');
      a.href = usgsUrl(e); a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', 'USGS event page for M' + e.mag.toFixed(1) + ' ' + e.place);
      a.addEventListener('click', function (ev) { ev.stopPropagation(); });
      ltd.appendChild(a); tr.appendChild(ltd);
      tr.addEventListener('click', function () { select(e, true); });
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e, true); } });
      body.appendChild(tr);
    });
  }

  // ---------------------------------------------------------------- orchestration
  function renderLive() {
    renderMap();
    renderTiles();
    renderDepthChart();
    updateTimePlayhead();
  }

  function renderAll() {
    syncControls();
    renderSelected();
    renderTimeChart();
    renderTable();
    renderLive();
  }

  function init() {
    qmap = QM.create({
      wrap: $('map-wrap'), canvas: $('map'), tooltip: $('map-tip'),
      describeEvent: describeEvent,
      onSelect: function (e) { select(e, false); },
      colorOf: function (e) { return '--depth-' + e.bin; },
      radiusOf: radiusOf,
      layers: { sources: false, deepZone: false, history: true },
      historyFilter: function (h) { return h.year < 1980; },
    });
    buildLegend();
    buildLayerToggles();
    buildClaims();
    $('data-date').textContent = C.generated;

    bindSegmented('region-buttons', 'region', String, function () { qmap.zoomTo(state.region); });
    bindSegmented('depth-buttons', 'depth', String);
    bindSegmented('mag-buttons', 'mag', Number);
    bindSegmented('from-buttons', 'from', Number);
    document.querySelectorAll('#speed-buttons button').forEach(function (b) {
      b.addEventListener('click', function () { state.speed = +b.dataset.speed; if (anim) play(state.playhead); else syncControls(); });
    });
    $('reset-filters').addEventListener('click', function () {
      for (var k in DEFAULTS) state[k] = DEFAULTS[k];
      derive(); renderAll(); qmap.zoomTo('region');
    });
    $('play-btn').addEventListener('click', function () {
      if (anim) { stop(); syncControls(); renderLive(); }
      else play(state.playhead >= END_Y - 0.01 ? 0 : state.playhead);
    });
    $('restart-btn').addEventListener('click', function () { play(0); });
    $('year-scrub').addEventListener('input', function (ev) { setPlayhead(+ev.target.value); });
    $('trail').addEventListener('change', function (ev) { state.trail = ev.target.checked; renderLive(); });
    $('zoom-in').addEventListener('click', function () { qmap.zoomBy(1.6); });
    $('zoom-out').addEventListener('click', function () { qmap.zoomBy(1 / 1.6); });
    $('zoom-reset').addEventListener('click', function () { qmap.zoomTo('region'); });
    bindTimeChart();
    document.addEventListener('quake-themechange', function () { qmap.refreshTheme(); });

    derive();
    renderAll();
    renderCrossSection();

    var pending = null, lastW = 0;
    function onResize() {
      var w = document.querySelector('.page').clientWidth;
      if (pending || w === lastW) return;
      lastW = w;
      pending = requestAnimationFrame(function () { pending = null; renderTimeChart(); renderLive(); renderCrossSection(); });
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.querySelector('.page'));
    else window.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
