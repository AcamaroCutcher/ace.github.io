/*
 * Project 6: 10,000 years of great Cascadia earthquakes from turbidites (Goldfinger et al., 2012, Appendix 8).
 * Numbered events (T1–T18) are correlated along (nearly) the whole margin; lettered events (T2a…) only in part.
 */
(function () {
  'use strict';

  var U = window.VizUtils, D = window.CASCADIA_TURBIDITES, $ = U.$, el = U.el;
  var NOW = new Date().getFullYear(), BP0 = 1950;
  var C = 'var(--megathrust)';

  // Years before today. T1 is the January 26, 1700 earthquake, whose date is known exactly.
  function agoFromBP(bp) { return bp + (NOW - BP0); }
  var EVENTS = D.events.map(function (e) {
    var lats = e.sites.map(function (s) { return D.sites[s].lat; });
    var ago = e.id === 'T1' ? NOW - 1700 : agoFromBP(e.median);
    return { id: e.id, full: e.numbered, ago: ago, agoFrom: agoFromBP(e.from), agoTo: agoFromBP(e.to),
      median: e.median, from: e.from, to: e.to, sites: e.sites, latMin: Math.min.apply(null, lats), latMax: Math.max.apply(null, lats) };
  }).sort(function (a, b) { return b.ago - a.ago; });   // oldest first

  var state = { span: 10000, partial: true, ranges: true, selected: null, playAgo: null, gapMode: 'full' };
  var anim = null, playToken = 0;

  function calYear(ago) {
    var y = Math.round(NOW - ago);
    return y > 0 ? y + ' CE' : (1 - y) + ' BCE';
  }
  function approxCal(ago) {
    // Rounded, so no year-zero correction: "~5650 BCE", not "~5651 BCE". Calendar years take no thousands separator.
    var y = NOW - ago, r = Math.abs(y) >= 1000 ? Math.round(y / 50) * 50 : Math.round(y / 10) * 10;
    return '~' + (r > 0 ? r + ' CE' : -r + ' BCE');
  }
  function fmtAgo(ago) { return U.fmtInt(Math.round(ago / 10) * 10) + ' years ago'; }
  function siteNames(e) { return e.sites.map(function (s) { return D.sites[s].name; }).join(', '); }
  function describe(e) {
    if (e.id === 'T1') return 'January 26, 1700 (date known from Japanese tsunami records and tree rings)';
    return 'About ' + fmtAgo(e.ago) + ' (' + approxCal(e.ago) + '); 95% range ' + calYear(e.agoFrom) + ' to ' + calYear(e.agoTo);
  }

  function gaps(list) {
    var out = [];
    for (var i = 1; i < list.length; i++) out.push({ a: list[i - 1], b: list[i], years: list[i - 1].ago - list[i].ago });
    return out;
  }
  var FULL = EVENTS.filter(function (e) { return e.full; });
  var STATS = {
    full: gaps(FULL), south: gaps(EVENTS),
    meanFull: (FULL[0].ago - FULL[FULL.length - 1].ago) / (FULL.length - 1),
    meanAll: (EVENTS[0].ago - EVENTS[EVENTS.length - 1].ago) / (EVENTS.length - 1),
    since: NOW - 1700,
  };

  var LAB = 'fill: var(--text-primary); font-size: 12px; font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 4px; stroke-linejoin: round';

  // ---------------------------------------------------------------- space–time chart
  function renderSpaceTime() {
    var wrap = $('st-wrap'), root = $('st-chart');
    var W = wrap.clientWidth; if (!W) return;
    var narrow = W < 640;
    var H = narrow ? 360 : 440, m = { top: 34, right: 16, bottom: 34, left: narrow ? 70 : 150 };
    var x = d3.scaleLinear([state.span * 1.02, 0], [m.left, W - m.right]);
    var y = d3.scaleLinear([40.3, 48.7], [H - m.bottom, m.top]);
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';

    // Site guides
    Object.keys(D.sites).forEach(function (k) {
      var s = D.sites[k];
      if (narrow && (k === 'Klamath' || k === 'Smith')) return;
      U.svg('line', { x1: m.left, x2: W - m.right, y1: y(s.lat), y2: y(s.lat), style: 'stroke: var(--grid); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 8, y: y(s.lat), dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-secondary); font-size: 11px' }, root)
        .textContent = narrow ? s.name.split(' ')[0] : s.name;
    });
    U.svg('text', { x: m.left - 8, y: m.top - 18, 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = 'north ↑';
    U.svg('text', { x: m.left - 8, y: H - m.bottom + 16, 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = 'south ↓';

    var ticks = state.span === 10000 ? [10000, 8000, 6000, 4000, 2000, 0] : [3000, 2500, 2000, 1500, 1000, 500, 0];
    ticks.forEach(function (t) {
      U.svg('line', { x1: x(t), x2: x(t), y1: m.top, y2: H - m.bottom, style: 'stroke: var(--grid); stroke-width: 1' }, root);
      U.svg('text', { x: x(t), y: H - 12, 'text-anchor': t === 0 ? 'end' : 'middle', style: 'fill: var(--text-muted); font-size: 11px' }, root)
        .textContent = t === 0 ? 'today' : U.fmtInt(t) + (narrow ? '' : ' yr ago');
    });

    var visible = EVENTS.filter(function (e) {
      return e.ago <= state.span * 1.02 && (state.partial || e.full) && (state.playAgo == null || e.ago >= state.playAgo);
    });

    // 95% ranges
    if (state.ranges) visible.forEach(function (e) {
      var x0 = x(Math.min(state.span * 1.02, e.agoFrom)), x1 = x(e.agoTo);
      U.svg('rect', { x: x0, y: y(e.latMax) - 6, width: Math.max(1, x1 - x0), height: Math.max(12, y(e.latMin) - y(e.latMax) + 12),
        rx: 3, style: 'fill: ' + C + '; fill-opacity: ' + (e.full ? 0.13 : 0.08) }, root);
    });

    // Since 1700 bracket
    var t1 = EVENTS[EVENTS.length - 1];
    if (state.playAgo == null || state.playAgo <= t1.ago) {
      var bx0 = x(t1.ago), bx1 = x(0), by = m.top - 10;
      U.svg('path', { d: 'M' + bx0 + ',' + (by + 5) + 'V' + by + 'H' + bx1 + 'V' + (by + 5), fill: 'none', style: 'stroke: var(--text-primary); stroke-width: 1.5' }, root);
      U.svg('text', { x: bx1, y: by - 6, 'text-anchor': 'end', style: LAB }, root).textContent = STATS.since + ' years since 1700 and counting';
    }

    // Event bars
    visible.forEach(function (e) {
      var cx = x(e.ago), y0 = y(e.latMax) - 4, y1 = y(e.latMin) + 4;
      var g = U.svg('g', { tabindex: 0, role: 'button', 'aria-label': e.id + ': ' + describe(e) + '. Dated at ' + siteNames(e) + '.' }, root);
      U.svg('rect', { x: cx - 8, y: y0 - 6, width: 16, height: y1 - y0 + 12, fill: 'transparent' }, g);
      U.svg('line', { x1: cx, x2: cx, y1: y0, y2: y1, style: 'stroke: ' + C + '; stroke-width: ' + (e.full ? 5 : 4) + '; stroke-linecap: round; stroke-opacity: ' + (e.full ? 1 : 0.5) }, g);
      e.sites.forEach(function (s) {
        U.svg('circle', { cx: cx, cy: y(D.sites[s].lat), r: 3, style: 'fill: var(--surface-1); stroke: ' + C + '; stroke-width: 1.5' }, g);
      });
      if (state.selected === e) {
        U.svg('rect', { x: cx - 7, y: y0 - 7, width: 14, height: y1 - y0 + 14, rx: 7, style: 'fill: none; stroke: var(--text-primary); stroke-width: 2' }, g);
      }
      if (e.id === 'T1' || (state.span === 3000 && e.full && !narrow)) {
        U.svg('text', { x: cx, y: y(e.latMin) + 20, 'text-anchor': 'middle', style: LAB.replace('600', '500').replace('12px', '11px') }, g)
          .textContent = e.id === 'T1' ? '1700' : e.id;
      }
      g.addEventListener('pointerenter', function () { showTip(e, cx, y0); });
      g.addEventListener('focus', function () { showTip(e, cx, y0); });
      g.addEventListener('pointerleave', hideTip);
      g.addEventListener('blur', hideTip);
      g.addEventListener('click', function () { select(e); });
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e); } });
    });

    if (state.playAgo != null) {
      U.svg('line', { x1: x(state.playAgo), x2: x(state.playAgo), y1: m.top, y2: H - m.bottom, style: 'stroke: var(--text-primary); stroke-width: 2' }, root);
    }
    root.setAttribute('aria-label', 'Space–time chart of ' + visible.length + ' great Cascadia earthquakes over the last ' + U.fmtInt(state.span) + ' years.');
  }

  function showTip(e, cx, cy) {
    var tip = $('st-tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', e.id + ' · ' + (e.full ? 'whole-coast rupture' : 'partial rupture')));
    tip.appendChild(el('p', null, describe(e)));
    tip.appendChild(el('p', null, 'Dated at: ' + siteNames(e)));
    tip.hidden = false;
    var W = $('st-wrap').clientWidth, left = cx + 14;
    if (left + tip.offsetWidth > W) left = cx - 14 - tip.offsetWidth;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, cy - 10) + 'px';
  }
  function hideTip() { $('st-tip').hidden = true; }

  function select(e) {
    state.selected = state.selected === e ? null : e;
    renderSelected(); renderSpaceTime(); renderGaps();
  }
  function renderSelected() {
    var box = $('selected'), e = state.selected;
    box.textContent = ''; box.hidden = !e;
    if (!e) return;
    var i = EVENTS.indexOf(e), prev = EVENTS[i - 1], next = EVENTS[i + 1];
    box.appendChild(el('span', 's-title', e.id + ' · ' + (e.full ? 'whole-coast rupture' : 'partial rupture')));
    box.appendChild(el('span', 's-meta', describe(e)));
    box.appendChild(el('span', 's-meta', 'Dated at ' + siteNames(e) + '.'));
    if (prev) box.appendChild(el('span', 's-meta', U.fmtInt(Math.round(prev.ago - e.ago)) + ' years after ' + prev.id + (next ? '; ' + U.fmtInt(Math.round(e.ago - next.ago)) + ' years before ' + next.id : '') + '.'));
    var clear = el('button', 'link-btn', 'Clear'); clear.type = 'button';
    clear.addEventListener('click', function () { select(e); });
    box.appendChild(clear);
  }

  // ---------------------------------------------------------------- play
  function play() {
    if (anim) { playToken++; cancelAnimationFrame(anim); anim = null; state.playAgo = null; syncControls(); renderSpaceTime(); $('st-counter').hidden = true; return; }
    if (U.prefersReducedMotion()) return;
    state.span = 10000;
    var t0 = performance.now(), DUR = 14000, counter = $('st-counter');
    var token = ++playToken;          // frames from an earlier (stopped) playback must never draw
    counter.hidden = false;
    function frame(now) {
      if (token !== playToken) return;
      var p = Math.min(1, (now - t0) / DUR);
      state.playAgo = 10200 * (1 - p);
      var n = EVENTS.filter(function (e) { return e.ago >= state.playAgo && (state.partial || e.full); }).length;
      counter.textContent = (state.playAgo < 5 ? 'Today' : fmtAgo(state.playAgo)) + ' · ' + n + ' great quake' + (n === 1 ? '' : 's') + ' so far';
      renderSpaceTime();
      if (p < 1) anim = requestAnimationFrame(frame);
      else { anim = null; state.playAgo = null; renderSpaceTime(); setTimeout(function () { if (token === playToken && !anim) counter.hidden = true; }, 1500); syncControls(); }
    }
    anim = requestAnimationFrame(frame);
    syncControls();
  }

  // ---------------------------------------------------------------- tiles
  function renderTiles() {
    var tiles = [
      ['Great quakes dated', String(EVENTS.length), FULL.length + ' whole-coast + ' + (EVENTS.length - FULL.length) + ' partial'],
      ['Whole coast: average gap', '~' + U.fmtInt(Math.round(STATS.meanFull / 10) * 10) + ' yr', 'report: ~500 years (p. 4)'],
      ['Southern Cascadia: average gap', '~' + U.fmtInt(Math.round(STATS.meanAll / 10) * 10) + ' yr', 'report: ~300–350 years (p. 4)'],
      ['Since the last one', STATS.since + ' yr', 'January 26, 1700'],
    ];
    var wrap = $('tiles'); wrap.textContent = '';
    tiles.forEach(function (t) {
      var d = el('div', 'tile');
      d.appendChild(el('div', 't-label', t[0])); d.appendChild(el('div', 't-value', t[1])); d.appendChild(el('div', 't-sub', t[2]));
      wrap.appendChild(d);
    });
  }

  // ---------------------------------------------------------------- gaps
  function renderGaps() {
    var wrap = $('gap-wrap'), root = $('gap-chart');
    var W = wrap.clientWidth; if (!W) return;
    var list = state.gapMode === 'full' ? STATS.full : STATS.south;
    var mean = state.gapMode === 'full' ? STATS.meanFull : STATS.meanAll;
    var H = 260, m = { top: 22, right: 12, bottom: 30, left: 48 };
    var n = list.length + 1;  // + the open gap since 1700
    var band = (W - m.left - m.right) / n, bw = Math.min(24, band * 0.7);
    var maxV = Math.max(d3.max(list, function (g) { return g.years; }), STATS.since) * 1.12;
    var y = d3.scaleLinear([0, maxV], [H - m.bottom, m.top]);
    root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.textContent = '';
    y.ticks(5).forEach(function (v) {
      U.svg('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), style: 'stroke: var(' + (v ? '--grid' : '--axis') + '); stroke-width: 1' }, root);
      U.svg('text', { x: m.left - 6, y: y(v), dy: '0.32em', 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = U.fmtInt(v);
    });
    U.svg('text', { x: m.left, y: H - 8, style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = '← older';
    U.svg('text', { x: W - m.right, y: H - 8, 'text-anchor': 'end', style: 'fill: var(--text-muted); font-size: 11px' }, root).textContent = 'today →';

    var tip = $('gap-tip');
    var minG = d3.min(list, function (g) { return g.years; }), maxG = d3.max(list, function (g) { return g.years; });
    list.concat([{ a: list[list.length - 1].b, b: null, years: STATS.since, open: true }]).forEach(function (g, i) {
      var cx = m.left + band * (i + 0.5), x0 = cx - bw / 2, top = y(g.years), h = y(0) - top;
      var sel = state.selected && (g.a === state.selected || g.b === state.selected);
      var r = Math.min(4, h);
      var d = 'M' + x0 + ',' + y(0) + 'V' + (top + r) + 'Q' + x0 + ',' + top + ' ' + (x0 + r) + ',' + top + 'H' + (x0 + bw - r) +
        'Q' + (x0 + bw) + ',' + top + ' ' + (x0 + bw) + ',' + (top + r) + 'V' + y(0) + (g.open ? '' : 'Z');
      U.svg('path', { d: d, style: g.open ? 'fill: none; stroke: ' + C + '; stroke-width: 2' : 'fill: ' + C + '; fill-opacity: ' + (sel ? 1 : 0.8) }, root);
      if (sel) U.svg('rect', { x: x0 - 3, y: top - 3, width: bw + 6, height: h + 3, rx: 4, style: 'fill: none; stroke: var(--text-primary); stroke-width: 2' }, root);
      if (g.open || g.years === minG || g.years === maxG) {
        U.svg('text', { x: cx, y: top - 6, 'text-anchor': g.open ? 'end' : 'middle', style: LAB.replace('12px', '11px') }, root)
          .textContent = g.open ? STATS.since + '+ so far' : U.fmtInt(Math.round(g.years));
      }
      var hit = U.svg('rect', { x: cx - band / 2, y: m.top, width: band, height: H - m.top - m.bottom, fill: 'transparent', tabindex: 0,
        'aria-label': g.open ? 'Open gap since 1700: ' + STATS.since + ' years so far' : g.a.id + ' to ' + g.b.id + ': ' + Math.round(g.years) + ' years' }, root);
      function show() {
        tip.textContent = '';
        tip.appendChild(el('div', 'tip-value', (g.open ? STATS.since + '+' : U.fmtInt(Math.round(g.years))) + ' years'));
        tip.appendChild(el('div', 'tip-head', g.open ? 'Since 1700 (still open)' : g.a.id + ' → ' + g.b.id));
        if (!g.open) tip.appendChild(el('p', null, approxCal(g.a.ago) + ' to ' + (g.b.id === 'T1' ? '1700 CE' : approxCal(g.b.ago))));
        tip.hidden = false;
        var left = cx + bw / 2 + 8; if (left + tip.offsetWidth > W) left = cx - bw / 2 - 8 - tip.offsetWidth;
        tip.style.left = Math.max(0, left) + 'px'; tip.style.top = m.top + 'px';
      }
      hit.addEventListener('pointerenter', show); hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', function () { tip.hidden = true; }); hit.addEventListener('blur', function () { tip.hidden = true; });
      if (!g.open) hit.addEventListener('click', function () { select(g.b); });
    });
    U.svg('line', { x1: m.left, x2: W - m.right, y1: y(mean), y2: y(mean), style: 'stroke: var(--text-primary); stroke-width: 1.5' }, root);
    U.svg('text', { x: m.left + 4, y: y(mean) - 6, style: LAB.replace('12px', '11px') }, root).textContent = 'average ' + U.fmtInt(Math.round(mean)) + ' yr';

    var shorter = list.filter(function (g) { return g.years < STATS.since; }).length;
    $('gap-sub').textContent = (state.gapMode === 'full'
      ? 'Gaps between the ' + FULL.length + ' whole-coast ruptures. '
      : 'Gaps between all ' + EVENTS.length + ' dated great quakes, which all reached southern Cascadia. ') +
      'Shortest ' + U.fmtInt(Math.round(minG)) + ' years, longest ' + U.fmtInt(Math.round(maxG)) + ', average ' + U.fmtInt(Math.round(mean)) +
      '. ' + shorter + ' of the ' + list.length + ' complete gaps were shorter than the ' + STATS.since + ' years since 1700 (the open bar on the right).' +
      (state.gapMode === 'south' ? ' Some partial events have overlapping age ranges, so the shortest gaps are very uncertain.' : '');
    root.setAttribute('aria-label', 'Bar chart of ' + list.length + ' gaps between great earthquakes and the open gap since 1700.');
    $('take-gaps').textContent = 'Gaps between whole-coast ruptures ranged from about ' + U.fmtInt(Math.round(d3.min(STATS.full, function (g) { return g.years; }) / 10) * 10) +
      ' to ' + U.fmtInt(Math.round(d3.max(STATS.full, function (g) { return g.years; }) / 10) * 10) + ' years. That’s why the report gives probabilities, not dates.';
  }

  // ---------------------------------------------------------------- table + legend
  function renderTable() {
    var body = $('event-table'); body.textContent = '';
    EVENTS.slice().reverse().forEach(function (e) {
      var tr = el('tr');
      [e.id, e.full ? 'Whole coast' : 'Partial', e.id === 'T1' ? '1700 CE (exact)' : approxCal(e.ago),
        calYear(e.agoFrom) + ' to ' + calYear(e.agoTo), siteNames(e)].forEach(function (v) { tr.appendChild(el('td', null, v)); });
      body.appendChild(tr);
    });
  }
  function buildLegend() {
    var lg = $('st-legend');
    [['Whole-coast rupture', 1], ['Partial rupture', 0.5]].forEach(function (p) {
      var it = el('span', 'legend-item'), k = el('span', 'key-rect');
      k.style.background = C; k.style.opacity = p[1]; k.style.width = '5px'; k.style.height = '14px';
      it.appendChild(k); it.appendChild(document.createTextNode(p[0])); lg.appendChild(it);
    });
    var r = el('span', 'legend-item'), rk = el('span', 'key-rect'); rk.style.background = C; rk.style.opacity = 0.18;
    r.appendChild(rk); r.appendChild(document.createTextNode('95% age range')); lg.appendChild(r);
    var s = el('span', 'legend-item'), sk = el('span', 'key-rect');
    sk.style.background = 'var(--surface-1)'; sk.style.border = '1.5px solid ' + C; sk.style.borderRadius = '50%'; sk.style.width = sk.style.height = '8px';
    s.appendChild(sk); s.appendChild(document.createTextNode('Dated core site')); lg.appendChild(s);
  }

  function syncControls() {
    document.querySelectorAll('#span-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.span === state.span)); });
    document.querySelectorAll('#gap-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.gap === state.gapMode)); });
    $('play-btn').textContent = anim ? '■ Stop' : '▶ Play 10,000 years';
    $('show-partial').checked = state.partial; $('show-ranges').checked = state.ranges;
  }

  function renderAll() { syncControls(); renderSpaceTime(); renderSelected(); renderTiles(); renderGaps(); }

  function init() {
    buildLegend(); renderTable();
    document.querySelectorAll('#span-buttons button').forEach(function (b) {
      b.addEventListener('click', function () { state.span = +b.dataset.span; renderAll(); });
    });
    document.querySelectorAll('#gap-buttons button').forEach(function (b) {
      b.addEventListener('click', function () { state.gapMode = b.dataset.gap; renderAll(); });
    });
    $('show-partial').addEventListener('change', function (ev) {
      state.partial = ev.target.checked;
      if (!state.partial && state.selected && !state.selected.full) state.selected = null;
      renderAll();
    });
    $('show-ranges').addEventListener('change', function (ev) { state.ranges = ev.target.checked; renderAll(); });
    $('play-btn').addEventListener('click', play);
    renderAll();
    var pending = null, lastW = 0;
    function onResize() {
      var w = document.querySelector('.page').clientWidth;
      if (pending || w === lastW) return;
      lastW = w;
      pending = requestAnimationFrame(function () { pending = null; renderSpaceTime(); renderGaps(); });
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.querySelector('.page'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
