/* Lesson 03 widgets: romania (step-through best-first search), gridsearch (draw-your-own grid lab) */
(function () {
  'use strict';
  var h = AG.h, s = AG.s;

  /* ================================================================ Romania */
  var ROADS = [['Arad', 'Zerind', 75], ['Arad', 'Sibiu', 140], ['Arad', 'Timisoara', 118], ['Zerind', 'Oradea', 71], ['Oradea', 'Sibiu', 151],
    ['Timisoara', 'Lugoj', 111], ['Lugoj', 'Mehadia', 70], ['Mehadia', 'Drobeta', 75], ['Drobeta', 'Craiova', 120], ['Craiova', 'Rimnicu Vilcea', 146],
    ['Craiova', 'Pitesti', 138], ['Sibiu', 'Fagaras', 99], ['Sibiu', 'Rimnicu Vilcea', 80], ['Rimnicu Vilcea', 'Pitesti', 97], ['Fagaras', 'Bucharest', 211],
    ['Pitesti', 'Bucharest', 101], ['Bucharest', 'Giurgiu', 90], ['Bucharest', 'Urziceni', 85], ['Urziceni', 'Hirsova', 98], ['Hirsova', 'Eforie', 86],
    ['Urziceni', 'Vaslui', 142], ['Vaslui', 'Iasi', 92], ['Iasi', 'Neamt', 87]];
  var SLD = { Arad: 366, Bucharest: 0, Craiova: 160, Drobeta: 242, Eforie: 161, Fagaras: 176, Giurgiu: 77, Hirsova: 151, Iasi: 226, Lugoj: 244, Mehadia: 241,
    Neamt: 234, Oradea: 380, Pitesti: 100, 'Rimnicu Vilcea': 193, Sibiu: 253, Timisoara: 329, Urziceni: 80, Vaslui: 199, Zerind: 374 };
  // approximate map positions (from the aima-python project), y up
  var POS = { Arad: [91, 492], Bucharest: [400, 327], Craiova: [253, 288], Drobeta: [165, 299], Eforie: [562, 293], Fagaras: [305, 449], Giurgiu: [375, 270],
    Hirsova: [534, 350], Iasi: [473, 506], Lugoj: [165, 379], Mehadia: [168, 339], Neamt: [406, 537], Oradea: [131, 571], Pitesti: [320, 368],
    'Rimnicu Vilcea': [233, 410], Sibiu: [207, 457], Timisoara: [94, 410], Urziceni: [456, 350], Vaslui: [509, 444], Zerind: [108, 531] };
  var NB = {};
  ROADS.forEach(function (r) { (NB[r[0]] = NB[r[0]] || {})[r[1]] = r[2]; (NB[r[1]] = NB[r[1]] || {})[r[0]] = r[2]; });

  // produce the full trace of a search, mirroring search.py (same tie-breaking)
  function trace(alg, start, W) {
    var steps = [], counter = 0;
    var f = { ucs: function (n) { return n.g; }, greedy: function (n) { return SLD[n.s]; }, astar: function (n) { return n.g + (W || 1) * SLD[n.s]; } }[alg];
    function node(st, parent, g) { return { s: st, p: parent, g: g, depth: parent ? parent.depth + 1 : 0, id: counter++ }; }
    var root = node(start, null, 0), frontier = [], reached = {}, expanded = [];
    function sorted() { return frontier.slice().sort(function (a, b) { return a.f - b.f || a.id - b.id; }); }
    reached[start] = root;
    if (alg === 'bfs') {
      if (start === 'Bucharest') return [{ pop: root, frontier: [], expanded: [], done: root }];
      frontier.push(root); var seen = {}; seen[start] = true;
      while (frontier.length) {
        var n = frontier.shift(); expanded.push(n.s);
        var kids = Object.keys(NB[n.s]).sort(), added = [], goal = null;
        for (var i = 0; i < kids.length; i++) {
          var c = node(kids[i], n, n.g + NB[n.s][kids[i]]);
          if (c.s === 'Bucharest') { goal = c; break; }
          if (!seen[c.s]) { seen[c.s] = true; c.f = c.depth; frontier.push(c); added.push(c); }
        }
        steps.push({ pop: n, added: added, frontier: frontier.slice(), expanded: expanded.slice(), done: goal, note: goal ? 'Breadth-first tests children when they are generated: Bucharest found as a child of ' + n.s + '.' : '' });
        if (goal) return steps;
      }
      return steps;
    }
    root.f = f(root); frontier.push(root);
    while (frontier.length) {
      var fr = sorted(); var cur = fr[0]; frontier.splice(frontier.indexOf(cur), 1);
      if (cur.s === 'Bucharest') { steps.push({ pop: cur, added: [], frontier: sorted(), expanded: expanded.slice(), done: cur, note: 'Bucharest popped from the frontier: goal test passes.' }); return steps; }
      expanded.push(cur.s);
      var add = [];
      Object.keys(NB[cur.s]).sort().forEach(function (k) {
        var ch = node(k, cur, cur.g + NB[cur.s][k]);
        if (!reached[k] || ch.g < reached[k].g) {
          reached[k] = ch; ch.f = f(ch); frontier.push(ch); add.push(ch);
        }
      });
      steps.push({ pop: cur, added: add, frontier: sorted(), expanded: expanded.slice(), done: null });
    }
    return steps;
  }
  AG.romaniaTrace = trace;   // exposed for testing against search.py
  function pathOf(n) { var p = []; while (n) { p.unshift(n.s); n = n.p; } return p; }

  AG.widget('romania', function (root) {
    var alg = 'astar', start = 'Arad', steps = [], k = -1, timer = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Route finding in Romania' }), h('span', { text: 'Goal: Bucharest. Step through the search and watch the frontier.' })]));
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Algorithm' });
    [['bfs', 'Breadth-first'], ['ucs', 'Uniform-cost'], ['greedy', 'Greedy (h)'], ['astar', 'A* (g + h)']].forEach(function (a) {
      var b = h('button', { type: 'button', text: a[1], 'aria-pressed': String(a[0] === alg) });
      b.addEventListener('click', function () { alg = a[0]; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); reset(); });
      seg.appendChild(b);
    });
    var sel = h('select', { 'aria-label': 'Start city' });
    Object.keys(POS).sort().forEach(function (c) { var o = h('option', { value: c, text: c }); if (c === start) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { start = sel.value; reset(); });
    root.appendChild(h('div', { class: 'w-row' }, [seg, h('label', { class: 'w-note' }, ['Start: ', sel])]));
    var grid = h('div', { class: 'w-grid2' });
    var svg = s('svg', { viewBox: '60 -10 540 360', role: 'img', 'aria-label': 'Road map of Romania' });
    var stage = h('div', { class: 'w-stage' }, [svg]);
    var side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(stage); grid.appendChild(side); root.appendChild(grid);
    var info = h('div', { class: 'readout' }), msg = h('p', { class: 'w-note' });
    var ftab = h('tbody');
    side.appendChild(info);
    side.appendChild(h('div', { class: 'w-lab', text: 'Frontier (priority queue, best first)' }));
    side.appendChild(h('div', { class: 'table-wrap', style: 'max-height:250px;overflow:auto' }, [h('table', null, [h('thead', null, [h('tr', null, ['City', 'g', 'h', 'f'].map(function (t) { return h('th', { text: t }); }))]), ftab])]));
    side.appendChild(msg);
    var bStep = h('button', { type: 'button', class: 'primary', text: 'Step' }), bRun = h('button', { type: 'button', text: 'Run ▶' }), bReset = h('button', { type: 'button', text: 'Reset' });
    root.appendChild(h('div', { class: 'w-row' }, [bStep, bRun, bReset]));

    function Y(y) { return 590 - y; }
    var roadEls = [], cityEls = {};
    function build() {
      svg.innerHTML = '';
      var ink = AG.css('--ink'), mut = AG.css('--muted');
      ROADS.forEach(function (r) {
        var a = POS[r[0]], b = POS[r[1]];
        var l = s('line', { x1: a[0], y1: Y(a[1]), x2: b[0], y2: Y(b[1]), stroke: AG.css('--line'), 'stroke-width': 3, 'stroke-linecap': 'round' });
        svg.appendChild(l); roadEls.push({ r: r, el: l });
        var t = s('text', { x: (a[0] + b[0]) / 2, y: Y((a[1] + b[1]) / 2) - 3, 'text-anchor': 'middle', 'font-size': 9, fill: mut, 'font-family': 'ui-monospace, Menlo, monospace' });
        t.textContent = r[2]; svg.appendChild(t);
      });
      Object.keys(POS).forEach(function (c) {
        var p = POS[c], g = s('g', { style: 'cursor:pointer' });
        var circ = s('circle', { cx: p[0], cy: Y(p[1]), r: 7, fill: AG.css('--surface'), stroke: ink, 'stroke-width': 1.5 });
        var lab = s('text', { x: p[0] + 9, y: Y(p[1]) - 6, 'font-size': 11, fill: ink, 'font-family': 'system-ui' }); lab.textContent = c === 'Rimnicu Vilcea' ? 'Rimnicu V.' : c;
        var hl = s('text', { x: p[0] + 9, y: Y(p[1]) + 12, 'font-size': 9, fill: AG.css('--warm'), 'font-family': 'ui-monospace, Menlo, monospace' }); hl.textContent = 'h=' + SLD[c];
        g.appendChild(circ); g.appendChild(lab); g.appendChild(hl);
        g.addEventListener('click', function () { start = c; sel.value = c; reset(); });
        svg.appendChild(g); cityEls[c] = { circ: circ, lab: lab };
      });
    }
    function reset() { stop(); steps = trace(alg, start); k = -1; render(); }
    function render() {
      var st = k >= 0 ? steps[k] : null;
      var acc = AG.css('--accent'), env = AG.css('--env'), warm = AG.css('--warm'), surf = AG.css('--surface'), ink = AG.css('--ink');
      var exp = st ? st.expanded : [], fr = st ? st.frontier : [{ s: start, g: 0, f: 0, id: 0 }];
      Object.keys(cityEls).forEach(function (c) {
        var e = cityEls[c];
        e.circ.setAttribute('fill', exp.indexOf(c) >= 0 ? acc : surf);
        e.circ.setAttribute('stroke', fr.some(function (n) { return n.s === c; }) ? warm : ink);
        e.circ.setAttribute('stroke-width', fr.some(function (n) { return n.s === c; }) ? 3.5 : 1.5);
        e.circ.setAttribute('r', c === 'Bucharest' || c === start ? 9 : 7);
      });
      if (st && st.pop) cityEls[st.pop.s].circ.setAttribute('fill', warm);
      var path = st && st.done ? pathOf(st.done) : st && st.pop ? pathOf(st.pop) : [];
      roadEls.forEach(function (r) {
        var on = false;
        for (var i = 0; i + 1 < path.length; i++) if ((path[i] === r.r[0] && path[i + 1] === r.r[1]) || (path[i] === r.r[1] && path[i + 1] === r.r[0])) on = true;
        r.el.setAttribute('stroke', on ? (st && st.done ? env : warm) : AG.css('--line'));
        r.el.setAttribute('stroke-width', on ? 5 : 3);
      });
      ftab.innerHTML = '';
      fr.forEach(function (n, i) {
        var hh = SLD[n.s], f = alg === 'bfs' ? '–' : alg === 'ucs' ? n.g : alg === 'greedy' ? hh : n.g + hh;
        ftab.appendChild(h('tr', { style: i === 0 && alg !== 'bfs' ? 'font-weight:700' : '' }, [h('td', { text: n.s }), h('td', { text: String(n.g) }), h('td', { text: String(hh) }), h('td', { text: String(f) })]));
      });
      info.innerHTML = '';
      [[st ? st.expanded.length : 0, 'expanded'], [fr.length, 'on frontier'], [st && st.done ? st.done.g + ' km' : '–', 'solution cost']].forEach(function (r) {
        info.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })]));
      });
      if (!st) msg.innerHTML = 'The frontier holds only the start node. Press <b>Step</b>.';
      else if (st.done) msg.innerHTML = '<b>Solution:</b> ' + pathOf(st.done).join(' → ') + ' (' + st.done.g + ' km). ' + (st.note || '') + (st.done.g === 418 || start !== 'Arad' ? '' : ' <b>Not optimal:</b> the best route is 418 km.');
      else msg.innerHTML = 'Popped <b>' + st.pop.s + '</b> (g = ' + st.pop.g + ') and expanded it. Added: ' + (st.added.length ? st.added.map(function (n) { return n.s; }).join(', ') : 'nothing new') + '. ' + (st.note || '');
      bStep.disabled = k >= steps.length - 1;
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } bRun.textContent = 'Run ▶'; }
    bStep.addEventListener('click', function () { stop(); if (k < steps.length - 1) { k++; render(); } });
    bRun.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (k >= steps.length - 1) k = -1;
      bRun.textContent = 'Pause ❚❚';
      timer = setInterval(function () { if (k < steps.length - 1) { k++; render(); } else stop(); }, AG.reduce ? 200 : 900);
    });
    bReset.addEventListener('click', reset);
    build(); reset();
    AG.onTheme(function () { build(); render(); });
  });

  /* ================================================================ grid lab */
  var COLS = 32, ROWS = 18;
  function gridSearch(cells, S, G, alg, W) {
    // cells: Uint8Array, 0 free, 1 wall, 2 mud. returns {order:[idx...], path:[idx...], cost, expanded}
    var N = COLS * ROWS, g = new Float64Array(N).fill(Infinity), parent = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var order = [], counter = 0;
    function hfun(i) { return Math.abs(i % COLS - G % COLS) + Math.abs(Math.floor(i / COLS) - Math.floor(G / COLS)); }
    function cost(i) { return cells[i] === 2 ? 5 : 1; }
    function nbrs(i) {
      var x = i % COLS, y = Math.floor(i / COLS), out = [];
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d) { var nx = x + d[0], ny = y + d[1]; if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && cells[ny * COLS + nx] !== 1) out.push(ny * COLS + nx); });
      return out;
    }
    function done(goal) {
      var path = []; for (var c = goal; c !== -1; c = parent[c]) path.unshift(c);
      return { order: order, path: goal === -1 ? [] : path, cost: goal === -1 ? Infinity : g[goal], expanded: order.length };
    }
    g[S] = 0;
    if (alg === 'bfs' || alg === 'dfs') {
      var fr = [S], seen = new Uint8Array(N); seen[S] = 1;
      while (fr.length) {
        var c = alg === 'bfs' ? fr.shift() : fr.pop();
        if (alg === 'dfs') { if (closed[c]) continue; }
        closed[c] = 1; order.push(c);
        if (c === G) return done(G);
        var ns = nbrs(c);
        if (alg === 'dfs') ns.reverse();
        for (var j = 0; j < ns.length; j++) {
          var n = ns[j];
          if (alg === 'bfs') { if (!seen[n]) { seen[n] = 1; g[n] = g[c] + cost(n); parent[n] = c; fr.push(n); } }
          else if (!closed[n]) { g[n] = g[c] + cost(n); parent[n] = c; fr.push(n); }
        }
      }
      return done(-1);
    }
    // binary heap on [f, tiebreak, idx]
    var heap = [];
    function push(e) { heap.push(e); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (less(heap[i], heap[p])) { var t = heap[i]; heap[i] = heap[p]; heap[p] = t; i = p; } else break; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; var t = heap[i]; heap[i] = heap[m]; heap[m] = t; i = m; } } return top; }
    function less(a, b) { return a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2]))); }
    function f(i) { return alg === 'ucs' ? g[i] : alg === 'greedy' ? hfun(i) : g[i] + W * hfun(i); }
    push([f(S), counter++, S]);
    while (heap.length) {
      var e = pop(), cur = e[2];
      if (closed[cur]) continue;
      closed[cur] = 1; order.push(cur);
      if (cur === G) return done(G);
      var nb = nbrs(cur);
      for (var q = 0; q < nb.length; q++) {
        var nn = nb[q], ng = g[cur] + cost(nn);
        if (ng < g[nn]) { g[nn] = ng; parent[nn] = cur; push([f(nn), counter++, nn]); }
      }
    }
    return done(-1);
  }
  AG.gridSearch = gridSearch;

  AG.widget('gridsearch', function (root) {
    var cells = new Uint8Array(COLS * ROWS), S = 8 * COLS + 3, G = 8 * COLS + 28, alg = 'astar', W = 1, tool = 'wall', result = null, anim = 0, animT = null;
    // a default map: a wall with a gap and a mud pond
    for (var y = 2; y < 16; y++) cells[y * COLS + 15] = 1;
    cells[3 * COLS + 15] = 0;
    for (y = 6; y < 12; y++) for (var x = 18; x < 24; x++) cells[y * COLS + x] = 2;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Grid search lab' }), h('span', { text: 'Click or drag on the grid to paint with the selected tool. Moves cost 1, mud costs 5.' })]));
    var algSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Algorithm' });
    var ALGS = [['bfs', 'BFS'], ['dfs', 'DFS'], ['ucs', 'Uniform-cost'], ['greedy', 'Greedy'], ['astar', 'A*']];
    ALGS.forEach(function (a) {
      var b = h('button', { type: 'button', text: a[1], 'aria-pressed': String(a[0] === alg) });
      b.addEventListener('click', function () { alg = a[0]; [].forEach.call(algSeg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); run(); });
      algSeg.appendChild(b);
    });
    var toolSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Paint tool' });
    [['wall', '▮ Wall'], ['mud', '≈ Mud'], ['erase', '◻ Erase'], ['start', '● Start'], ['goal', '★ Goal']].forEach(function (t) {
      var b = h('button', { type: 'button', text: t[1], 'aria-pressed': String(t[0] === tool) });
      b.addEventListener('click', function () { tool = t[0]; [].forEach.call(toolSeg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); });
      toolSeg.appendChild(b);
    });
    var wIn = h('input', { type: 'range', min: 1, max: 5, step: 0.5, value: 1 }), wOut = h('output', { text: '1.0' });
    wIn.addEventListener('input', function () { W = +wIn.value; wOut.textContent = W.toFixed(1); run(); });
    root.appendChild(h('div', { class: 'w-row' }, [algSeg, h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['A* weight W', wOut]), wIn])]));
    root.appendChild(h('div', { class: 'w-row' }, [toolSeg]));
    var stage = h('div', { class: 'w-stage' }); root.appendChild(stage);
    var C = AG.canvas(stage, function (w) { return Math.round(w * ROWS / COLS); }, function () { draw(); });
    var readout = h('div', { class: 'readout' }); root.appendChild(readout);
    var bRun = h('button', { type: 'button', class: 'primary', text: 'Search ▶' }), bRace = h('button', { type: 'button', text: 'Race all' });
    var bMaze = h('button', { type: 'button', text: 'Random maze' }), bClear = h('button', { type: 'button', text: 'Clear' });
    root.appendChild(h('div', { class: 'w-row' }, [bRun, bRace, bMaze, bClear]));
    var race = h('div'); root.appendChild(race);

    function run(animate) {
      result = gridSearch(cells, S, G, alg, W);
      if (animTimer) cancelAnimationFrame(animTimer);
      if (animate && !AG.reduce) {
        anim = 0; var t0 = performance.now(), n = result.order.length;
        var f = function (now) { anim = Math.min(n, Math.floor((now - t0) / 1000 * Math.max(60, n / 1.5))); draw(); if (anim < n) animTimer = requestAnimationFrame(f); else { animTimer = null; draw(); } };
        animTimer = requestAnimationFrame(f);
      } else { anim = result.order.length; draw(); }
      var opt = gridSearch(cells, S, G, 'ucs', 1).cost;
      readout.innerHTML = '';
      [[result.expanded, 'squares expanded'], [isFinite(result.cost) ? result.cost : 'none', 'path cost'], [isFinite(opt) ? opt : '–', 'optimal cost'],
        [!isFinite(result.cost) ? '–' : result.cost === opt ? 'yes ✓' : 'no ✗', 'optimal?']].forEach(function (r) {
        readout.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })]));
      });
    }
    var animTimer = null;
    function draw() {
      var ctx = C.ctx, cw = C.W / COLS, ch = C.H / ROWS;
      ctx.clearRect(0, 0, C.W, C.H);
      var order = result ? result.order : [], shown = Math.min(anim, order.length), rank = new Float32Array(COLS * ROWS);
      for (var i = 0; i < shown; i++) rank[order[i]] = 1 + i;
      var dark = AG.isDark();
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        var k = y * COLS + x, c = cells[k];
        ctx.fillStyle = c === 1 ? (dark ? '#d8d6cf' : '#26251f') : c === 2 ? (dark ? '#6b4a2b' : '#c9a27a') : AG.css('--surface');
        ctx.fillRect(x * cw, y * ch, cw, ch);
        if (rank[k] && c !== 1) {
          var t = rank[k] / Math.max(1, order.length);
          ctx.fillStyle = 'hsla(' + (250 - 90 * t) + ',70%,' + (dark ? 60 : 55) + '%,' + (c === 2 ? .45 : .32) + ')';
          ctx.fillRect(x * cw, y * ch, cw, ch);
        }
        ctx.strokeStyle = AG.css('--line-2'); ctx.strokeRect(x * cw + .5, y * ch + .5, cw - 1, ch - 1);
      }
      if (result && shown >= order.length && result.path.length) {
        ctx.strokeStyle = AG.css('--warm'); ctx.lineWidth = Math.max(3, cw * .22); ctx.lineJoin = 'round'; ctx.beginPath();
        result.path.forEach(function (p, j) { var px = (p % COLS + .5) * cw, py = (Math.floor(p / COLS) + .5) * ch; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
      }
      [[S, AG.css('--env'), '●'], [G, AG.css('--bad'), '★']].forEach(function (m) {
        var px = (m[0] % COLS + .5) * cw, py = (Math.floor(m[0] / COLS) + .5) * ch;
        ctx.fillStyle = m[1]; ctx.beginPath(); ctx.arc(px, py, Math.min(cw, ch) * .42, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(ch * .5) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m[2], px, py + 1);
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    // painting
    var painting = false, moved = false;
    function cellAt(ev) { var p = AG.pos(C.cv, ev); var x = Math.floor(p.x / (C.W / COLS)), y = Math.floor(p.y / (C.H / ROWS)); if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return -1; return y * COLS + x; }
    function paint(ev) {
      var k = cellAt(ev); if (k < 0) return;
      if (tool === 'start') { if (cells[k] !== 1 && k !== G) S = k; }
      else if (tool === 'goal') { if (cells[k] !== 1 && k !== S) G = k; }
      else if (k !== S && k !== G) cells[k] = tool === 'wall' ? 1 : tool === 'mud' ? 2 : 0;
      moved = true; result = null; draw();
    }
    C.cv.addEventListener('pointerdown', function (ev) { painting = true; moved = false; C.cv.setPointerCapture(ev.pointerId); paint(ev); });
    C.cv.addEventListener('pointermove', function (ev) { if (painting) paint(ev); });
    C.cv.addEventListener('pointerup', function () { if (painting && moved) run(false); painting = false; });
    bRun.addEventListener('click', function () { run(true); });
    bRace.addEventListener('click', function () {
      var tb = h('tbody'), opt = gridSearch(cells, S, G, 'ucs', 1).cost;
      ALGS.concat([['wastar', 'Weighted A* (W = 3)']]).forEach(function (a) {
        var r = a[0] === 'wastar' ? gridSearch(cells, S, G, 'astar', 3) : gridSearch(cells, S, G, a[0], W);
        tb.appendChild(h('tr', null, [h('td', { text: a[1] + (a[0] === 'astar' && W !== 1 ? ' (W = ' + W + ')' : '') }), h('td', null, [h('b', { text: String(r.expanded) })]),
          h('td', { text: isFinite(r.cost) ? String(r.cost) : 'no path' }), h('td', null, [h('span', { class: 'pill ' + (r.cost === opt ? 'ok' : 'bad'), text: r.cost === opt ? 'optimal' : 'not optimal' })])]));
      });
      race.innerHTML = '';
      race.appendChild(h('div', { class: 'table-wrap' }, [h('table', null, [h('thead', null, [h('tr', null, ['Algorithm', 'Expanded', 'Path cost', ''].map(function (t) { return h('th', { text: t }); }))]), tb])]));
    });
    bMaze.addEventListener('click', function () {
      // recursive-backtracker maze on odd cells, then knock out some walls and add mud
      cells.fill(1);
      var rnd = AG.rng(Math.floor(Math.random() * 1e9)), stack = [[1, 1]]; cells[COLS + 1] = 0;
      while (stack.length) {
        var c = stack[stack.length - 1], opts = [];
        [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (d) { var nx = c[0] + d[0], ny = c[1] + d[1]; if (nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && cells[ny * COLS + nx] === 1) opts.push([nx, ny, d]); });
        if (!opts.length) { stack.pop(); continue; }
        var o = opts[Math.floor(rnd() * opts.length)];
        cells[(c[1] + o[2][1] / 2) * COLS + c[0] + o[2][0] / 2] = 0; cells[o[1] * COLS + o[0]] = 0; stack.push([o[0], o[1]]);
      }
      for (var i = 0; i < 90; i++) { var k = Math.floor(rnd() * COLS * ROWS), xx = k % COLS, yy = Math.floor(k / COLS); if (xx > 0 && yy > 0 && xx < COLS - 1 && yy < ROWS - 1) cells[k] = rnd() < .5 ? 0 : 2; }
      S = COLS + 1; G = (ROWS - 3) * COLS + COLS - 3; cells[S] = 0; cells[G] = 0;
      run(true);
    });
    bClear.addEventListener('click', function () { cells.fill(0); run(false); });
    run(false);
  });

  /* ================================================================ 8-puzzle: play it, then race the algorithms */
  var GOAL8 = '123456780';
  function nbrs8(st) {
    var z = st.indexOf('0'), r = Math.floor(z / 3), c = z % 3, out = [];
    [[-1, 0, 'Up'], [1, 0, 'Down'], [0, -1, 'Left'], [0, 1, 'Right']].forEach(function (d) {
      var rr = r + d[0], cc = c + d[1];
      if (rr < 0 || rr > 2 || cc < 0 || cc > 2) return;
      var k = rr * 3 + cc, a = st.split(''); a[z] = a[k]; a[k] = '0'; out.push(a.join(''));
    });
    return out;
  }
  function misplaced(st) { var n = 0; for (var i = 0; i < 9; i++) if (st[i] !== '0' && st[i] !== GOAL8[i]) n++; return n; }
  function manhattan(st) { var d = 0; for (var i = 0; i < 9; i++) { var v = +st[i]; if (!v) continue; var g = v - 1; d += Math.abs(Math.floor(i / 3) - Math.floor(g / 3)) + Math.abs(i % 3 - g % 3); } return d; }
  function solve8(start, alg) {
    var t0 = performance.now(), h = alg === 'bfs' ? function () { return 0; } : alg === 'misplaced' ? misplaced : manhattan;
    var g = {}, parent = {}, heap = [], counter = 0, expanded = 0;
    function push(e) { heap.push(e); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] < e[0] || (heap[p][0] === e[0] && heap[p][1] <= e[1])) break; heap[i] = heap[p]; i = p; } heap[i] = e; }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i, mv = last; if (l < heap.length && (heap[l][0] < mv[0] || (heap[l][0] === mv[0] && heap[l][1] < mv[1]))) { m = l; mv = heap[l]; } if (r < heap.length && (heap[r][0] < mv[0] || (heap[r][0] === mv[0] && heap[r][1] < mv[1]))) { m = r; mv = heap[r]; } if (m === i) break; heap[i] = heap[m]; i = m; } heap[i] = last; } return top; }
    g[start] = 0; parent[start] = null; push([alg === 'greedy' ? h(start) : h(start), counter++, start]);
    var closed = {};
    while (heap.length) {
      var e = pop(), st = e[2];
      if (closed[st]) continue; closed[st] = 1; expanded++;
      if (st === GOAL8) { var path = []; for (var x = st; x !== null; x = parent[x]) path.unshift(x); return { path: path, expanded: expanded, ms: performance.now() - t0 }; }
      nbrs8(st).forEach(function (n) {
        var ng = g[st] + 1;
        if (!(n in g) || ng < g[n]) { g[n] = ng; parent[n] = st; push([alg === 'greedy' ? h(n) : ng + h(n), counter++, n]); }
      });
    }
    return null;
  }
  AG.solve8 = solve8;
  AG.widget('puzzle8', function (root) {
    var state = GOAL8, anim = null, rnd = AG.rng(Date.now() % 100000), moves = 0;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'The 8-puzzle: play it, then let search solve it' }), h('span', { text: 'Click a tile next to the gap to slide it. AIMA §3.2 and §3.6.' })]));
    var grid = h('div', { class: 'w-grid2' }), boardWrap = h('div', { style: 'display:grid;gap:10px;justify-items:center' }), side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(boardWrap); grid.appendChild(side); root.appendChild(grid);
    var board = h('div', { class: 'p8-board' }); boardWrap.appendChild(board);
    var tiles = {};
    for (var v = 1; v <= 8; v++) (function (v) {
      var t = h('button', { type: 'button', class: 'p8-tile', text: String(v), 'aria-label': 'Tile ' + v });
      t.addEventListener('click', function () {
        if (anim) return;
        var i = state.indexOf(String(v)), z = state.indexOf('0');
        if (Math.abs(Math.floor(i / 3) - Math.floor(z / 3)) + Math.abs(i % 3 - z % 3) !== 1) return;
        var a = state.split(''); a[z] = String(v); a[i] = '0'; state = a.join(''); moves++; place();
      });
      board.appendChild(t); tiles[v] = t;
    })(v);
    var info = h('div', { class: 'readout' }); boardWrap.appendChild(info);
    var depth = h('input', { type: 'range', min: 4, max: 80, value: 24 }), dOut = h('output', { text: '24' });
    depth.addEventListener('input', function () { dOut.textContent = depth.value; });
    var bShuf = h('button', { type: 'button', text: 'Shuffle' });
    side.appendChild(h('div', { class: 'w-row' }, [h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['Random moves from the goal', dOut]), depth]), bShuf]));
    var alg = h('select', { 'aria-label': 'Algorithm' });
    [['manhattan', 'A* with Manhattan distance (h₂)'], ['misplaced', 'A* with misplaced tiles (h₁)'], ['bfs', 'Uniform-cost / breadth-first (h = 0)'], ['greedy', 'Greedy best-first (Manhattan)']].forEach(function (o) { alg.appendChild(h('option', { value: o[0], text: o[1] })); });
    var bSolve = h('button', { type: 'button', class: 'primary', text: 'Solve and animate' }), bRace = h('button', { type: 'button', text: 'Race all four' });
    side.appendChild(h('div', { class: 'w-row' }, [alg])); side.appendChild(h('div', { class: 'w-row' }, [bSolve, bRace]));
    var res = h('div'), note = h('p', { class: 'w-note' }); side.appendChild(res); side.appendChild(note);
    function place() {
      for (var i = 0; i < 9; i++) { var c = state[i]; if (c === '0') continue; var t = tiles[c]; t.style.transform = 'translate(' + (i % 3) * 100 + '%,' + Math.floor(i / 3) * 100 + '%)'; t.classList.toggle('home', state[i] === GOAL8[i]); }
      info.innerHTML = '';
      [[moves, 'your moves'], [misplaced(state), 'h₁ misplaced'], [manhattan(state), 'h₂ Manhattan'], [state === GOAL8 ? '✓' : '–', 'solved']].forEach(function (r) { info.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })])); });
    }
    bShuf.addEventListener('click', function () {
      if (anim) return;
      var prev = null; state = GOAL8;
      for (var k = 0; k < +depth.value; k++) { var ns = nbrs8(state).filter(function (n) { return n !== prev; }); prev = state; state = ns[Math.floor(rnd() * ns.length)]; }
      moves = 0; res.innerHTML = ''; note.textContent = ''; place();
    });
    bSolve.addEventListener('click', function () {
      if (anim || state === GOAL8) return;
      var r = solve8(state, alg.value);
      note.innerHTML = 'Found a ' + (r.path.length - 1) + '-move solution after expanding <b>' + r.expanded.toLocaleString() + '</b> states in ' + r.ms.toFixed(0) + ' ms. Animating…';
      var k = 0;
      anim = setInterval(function () {
        k++; if (k >= r.path.length) { clearInterval(anim); anim = null; note.innerHTML = note.innerHTML.replace('Animating…', 'Done.'); return; }
        state = r.path[k]; moves++; place();
      }, AG.reduce ? 30 : 260);
    });
    bRace.addEventListener('click', function () {
      if (state === GOAL8) { note.textContent = 'Shuffle first.'; return; }
      var tb = h('tbody'), opt = null;
      [['bfs', 'Uniform-cost (h = 0)'], ['misplaced', 'A*, h₁ misplaced'], ['manhattan', 'A*, h₂ Manhattan'], ['greedy', 'Greedy, h₂']].forEach(function (a) {
        var r = solve8(state, a[0]); if (a[0] === 'bfs') opt = r.path.length - 1;
        tb.appendChild(h('tr', null, [h('td', { text: a[1] }), h('td', null, [h('b', { text: r.expanded.toLocaleString() })]), h('td', { text: String(r.path.length - 1) }), h('td', { text: r.ms.toFixed(0) + ' ms' }), h('td', null, [h('span', { class: 'pill ' + (r.path.length - 1 === opt ? 'ok' : 'bad'), text: r.path.length - 1 === opt ? 'optimal' : 'not optimal' })])]));
      });
      res.innerHTML = '';
      res.appendChild(h('div', { class: 'table-wrap' }, [h('table', null, [h('thead', null, [h('tr', null, ['Algorithm', 'States expanded', 'Moves', 'Time', ''].map(function (t) { return h('th', { text: t }); }))]), tb])]));
      note.innerHTML = 'h₂ dominates h₁ (it is never smaller, and both are admissible), so A* with h₂ never expands more states. Greedy is fast but its solutions are often longer. With h = 0, A* is uniform-cost search.';
    });
    place();
  });
})();
