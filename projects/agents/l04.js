/* Lesson 04 widgets: wumpus (knowledge-based explorer, mirrors wumpus_kb.py), truthtable (TT-ENTAILS on the book's KB) */
(function () {
  'use strict';
  var h = AG.h;
  var N = 4, PIT_PRIOR = 0.2;
  function k(c) { return c[0] + ',' + c[1]; }
  function nbrs(c) {
    var out = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var x = c[0] + d[0], y = c[1] + d[1]; if (x >= 1 && x <= N && y >= 1 && y <= N) out.push([x, y]); });
    return out;
  }
  function isAdj(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }

  /* ---------------------------------------------------------------- the KB (same algorithm as wumpus_kb.py) */
  function KB() { this.visited = new Map(); this.stats = { frontier: 0, worlds: 0, consistent: 0, wcands: 0 }; }
  KB.prototype.tell = function (c, p) { this.visited.set(k(c), { c: c, p: p }); };
  KB.prototype.unknown = function () { var out = []; for (var x = 1; x <= N; x++) for (var y = 1; y <= N; y++) if (!this.visited.has(k([x, y]))) out.push([x, y]); return out; };
  KB.prototype.pitProbs = function () {
    var self = this, fset = new Map();
    this.visited.forEach(function (v) { nbrs(v.c).forEach(function (n) { if (!self.visited.has(k(n))) fset.set(k(n), n); }); });
    var frontier = Array.from(fset.values()).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var weights = {}, total = 0, consistent = 0, F = frontier.length;
    frontier.forEach(function (c) { weights[k(c)] = 0; });
    var vis = Array.from(this.visited.values());
    for (var m = 0; m < (1 << F); m++) {
      var pits = new Set(), w = 1;
      for (var i = 0; i < F; i++) { if (m & (1 << i)) { pits.add(k(frontier[i])); w *= PIT_PRIOR; } else w *= 1 - PIT_PRIOR; }
      var ok = vis.every(function (v) { return nbrs(v.c).some(function (n) { return pits.has(k(n)); }) === v.p.breeze; });
      if (ok) { total += w; consistent++; pits.forEach(function (pk) { weights[pk] += w; }); }
    }
    this.stats.frontier = F; this.stats.worlds = 1 << F; this.stats.consistent = consistent;
    var probs = {};
    frontier.forEach(function (c) { probs[k(c)] = weights[k(c)] / total; });
    this.unknown().forEach(function (c) { if (!(k(c) in probs)) probs[k(c)] = PIT_PRIOR; });
    return probs;
  };
  KB.prototype.wumpusProbs = function () {
    var vis = Array.from(this.visited.values());
    var cands = this.unknown().filter(function (c) { return vis.every(function (v) { return isAdj(c, v.c) === v.p.stench; }); });
    this.stats.wcands = cands.length;
    var out = {};
    this.unknown().forEach(function (c) { out[k(c)] = cands.some(function (d) { return d[0] === c[0] && d[1] === c[1]; }) ? 1 / cands.length : 0; });
    return out;
  };
  function route(start, goal, allowed) {
    var q = [start], parent = new Map([[k(start), null]]), head = 0;
    while (head < q.length) {
      var c = q[head++];
      if (c[0] === goal[0] && c[1] === goal[1]) break;
      nbrs(c).forEach(function (n) { if (!parent.has(k(n)) && (allowed.has(k(n)) || (n[0] === goal[0] && n[1] === goal[1]))) { parent.set(k(n), c); q.push(n); } });
    }
    if (!parent.has(k(goal))) return null;
    var path = [], cc = goal;
    while (cc) { path.push(cc); cc = parent.get(k(cc)); }
    return path.reverse();
  }

  var PRESETS = {
    book: { name: 'Book world (Fig. 7.2)', pits: [[3, 1], [3, 3], [4, 4]], wumpus: [1, 3], gold: [2, 3] },
    breezy: { name: 'Book: breezy start (§13.6 / §12.7)', pits: [[2, 2]], wumpus: [4, 3], gold: [3, 4], script: [[1, 2], [2, 1]] },
  };
  function randomWorld(seed) {
    var r = AG.rng(seed), pits = [], cells = [];
    for (var x = 1; x <= N; x++) for (var y = 1; y <= N; y++) if (x !== 1 || y !== 1) { cells.push([x, y]); if (r() < PIT_PRIOR) pits.push([x, y]); }
    var wumpus = cells[Math.floor(r() * cells.length)];
    var free = cells.filter(function (c) { return !pits.some(function (p) { return p[0] === c[0] && p[1] === c[1]; }); });
    return { name: 'Random world #' + seed, pits: pits, wumpus: wumpus, gold: (free.length ? free : cells)[Math.floor(r() * (free.length || cells.length))] };
  }

  AG.widget('wumpus', function (root) {
    var preset = 'book', seed = 1, world, kb, here, status, reveal = false, log = [], scripted = [];
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Wumpus world explorer' }), h('span', { text: 'The agent TELLs its percepts and ASKs which rooms are safe. Coordinates are [column, row] as in the book.' })]));
    var pick = h('select', { 'aria-label': 'World' });
    [['book', PRESETS.book.name], ['breezy', PRESETS.breezy.name], ['random', 'Random worlds']].forEach(function (o) { pick.appendChild(h('option', { value: o[0], text: o[1] })); });
    var bStep = h('button', { type: 'button', class: 'primary', text: 'Agent step' }), bRun = h('button', { type: 'button', text: 'Run to the end' }), bReset = h('button', { type: 'button', text: 'Restart' });
    var bNew = h('button', { type: 'button', text: 'Next random world' });
    var cRev = h('input', { type: 'checkbox' });
    root.appendChild(h('div', { class: 'w-row' }, [pick, bStep, bRun, bReset, bNew, h('label', { class: 'w-note' }, [cRev, ' Reveal the truth'])]));
    var grid = h('div', { class: 'w-grid2' }), board = h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;aspect-ratio:1;max-width:440px;width:100%' });
    var side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(h('div', null, [board])); grid.appendChild(side); root.appendChild(grid);
    var msg = h('p', { class: 'w-note' }), stats = h('div', { class: 'readout' }), logBox = h('div', { class: 'log', style: 'height:200px' });
    side.appendChild(msg); side.appendChild(stats); side.appendChild(h('div', { class: 'w-lab', text: 'Knowledge base: sentences TELLed so far' })); side.appendChild(logBox);

    function setup() {
      var w = preset === 'random' ? randomWorld(seed) : PRESETS[preset];
      world = { pits: new Set(w.pits.map(k)), wumpus: w.wumpus, gold: w.gold, name: w.name };
      scripted = (PRESETS[preset] && PRESETS[preset].script || []).slice();
      kb = new KB(); here = [1, 1]; status = 'exploring'; log = [];
      bNew.hidden = preset !== 'random';
      perceive(); draw();
    }
    function percept(c) {
      return { breeze: nbrs(c).some(function (n) { return world.pits.has(k(n)); }), stench: nbrs(c).some(function (n) { return n[0] === world.wumpus[0] && n[1] === world.wumpus[1]; }), glitter: c[0] === world.gold[0] && c[1] === world.gold[1] };
    }
    function sub(c) { return c[0] + ',' + c[1]; }
    function perceive() {
      if (world.pits.has(k(here)) || (here[0] === world.wumpus[0] && here[1] === world.wumpus[1])) {
        status = 'dead'; log.push(['err', 'Entered [' + sub(here) + ']: ' + (world.pits.has(k(here)) ? 'fell into a pit.' : 'eaten by the wumpus.')]); return;
      }
      var p = percept(here);
      kb.tell(here, p);
      log.push(['per', 'TELL ' + (p.breeze ? '' : '¬') + 'B' + sub(here) + ' ∧ ' + (p.stench ? '' : '¬') + 'S' + sub(here) + (p.glitter ? ' ∧ Glitter' + sub(here) : '')]);
      if (p.glitter) { status = 'won'; log.push(['ok', 'Glitter! Grab the gold and climb out along the safe path.']); }
    }
    function moveTo(target) {
      var known = new Set(Array.from(kb.visited.keys()));
      var path = route(here, target, known);
      if (!path) return false;
      here = target; log.push(['act', 'move to [' + sub(target) + '] via ' + path.map(function (c) { return '[' + sub(c) + ']'; }).join(' → ')]);
      perceive(); return true;
    }
    function agentStep() {
      if (status !== 'exploring') return;
      if (scripted.length) { moveTo(scripted.shift()); draw(); return; }
      var pp = kb.pitProbs(), wp = kb.wumpusProbs();
      var safe = kb.unknown().filter(function (c) { return pp[k(c)] === 0 && wp[k(c)] === 0; });
      var knownSafe = new Set(Array.from(kb.visited.keys()).concat(safe.map(k)));
      var opts = safe.map(function (c) { return [(route(here, c, knownSafe) || []).length, c]; }).filter(function (o) { return o[0] > 0; });
      opts.sort(function (a, b) { return a[0] - b[0] || a[1][0] - b[1][0] || a[1][1] - b[1][1]; });
      if (opts.length) { log.push(['think', 'ASK: safe rooms = {' + safe.map(function (c) { return '[' + sub(c) + ']'; }).join(', ') + '} → nearest']); moveTo(opts[0][1]); }
      else {
        var reach = kb.unknown().filter(function (c) { return route(here, c, new Set(Array.from(kb.visited.keys()))); });
        if (!reach.length) { status = 'out'; log.push(['dim', 'Nothing left to explore: climb out.']); draw(); return; }
        var risk = function (c) { return 1 - (1 - pp[k(c)]) * (1 - wp[k(c)]); };
        reach.sort(function (a, b) { return risk(a) - risk(b) || a[0] - b[0] || a[1] - b[1]; });
        var best = reach[0];
        log.push(['think', 'ASK: no room is provably safe. Least risky: [' + sub(best) + '] (risk ' + risk(best).toFixed(2) + ')']);
        if (risk(best) > 0.5) { status = 'out'; log.push(['dim', 'Too risky: climb out without the gold.']); }
        else moveTo(best);
      }
      draw();
    }
    function draw() {
      var pp = kb.pitProbs(), wp = kb.wumpusProbs();
      board.innerHTML = '';
      for (var y = N; y >= 1; y--) for (var x = 1; x <= N; x++) {
        var c = [x, y], key = k(c), v = kb.visited.get(key), isHere = here[0] === x && here[1] === y;
        var cell = h('button', { type: 'button', 'aria-label': 'Room ' + x + ',' + y, style: 'position:relative;border-radius:10px;border:1px solid var(--line);background:var(--surface);display:grid;place-items:center;font:600 13px system-ui;color:var(--ink);padding:4px;min-height:0;min-width:0' });
        var lines = [];
        if (v) {
          cell.style.background = 'var(--accent-soft)';
          lines.push((v.p.breeze ? '≋ breeze ' : '') + (v.p.stench ? '☁ stench' : '') || 'nothing');
        } else if (status !== 'dead') {
          var pr = pp[key] || 0, wr = wp[key] || 0;
          if (pr === 0 && wr === 0) { cell.style.background = 'var(--env-soft)'; cell.style.borderColor = 'var(--env)'; lines.push('OK'); }
          else {
            if (pr > 0) lines.push('pit ' + pr.toFixed(2));
            if (wr > 0) lines.push('wumpus ' + wr.toFixed(2));
            var risk = 1 - (1 - pr) * (1 - wr);
            cell.style.background = 'rgba(212,67,74,' + (0.06 + 0.3 * risk) + ')';
          }
        }
        if (reveal || status === 'dead' || status === 'won' || status === 'out') {
          var t = [];
          if (world.pits.has(key)) t.push('🕳 pit');
          if (world.wumpus[0] === x && world.wumpus[1] === y) t.push('👹 wumpus');
          if (world.gold[0] === x && world.gold[1] === y) t.push('✨ gold');
          if (t.length) lines.push(t.join(' '));
        }
        cell.appendChild(h('span', { style: 'position:absolute;top:4px;left:6px;font:600 10px ui-monospace,Menlo,monospace;color:var(--muted)', text: '[' + x + ',' + y + ']' }));
        cell.appendChild(h('span', { style: 'text-align:center;line-height:1.3;font-size:12px;white-space:pre-line', text: lines.join('\n') }));
        if (isHere) cell.appendChild(h('span', { style: 'position:absolute;bottom:4px;right:6px;font-size:18px', text: status === 'dead' ? '💀' : '🤖' }));
        // manual moves: any unvisited room next to a visited one
        var canGo = status === 'exploring' && !v && Array.from(kb.visited.values()).some(function (vv) { return isAdj(vv.c, c); });
        if (canGo) { cell.style.cursor = 'pointer'; cell.style.outline = '2px dashed var(--accent)'; cell.style.outlineOffset = '-4px'; (function (cc) { cell.addEventListener('click', function () { scripted = []; log.push(['act', 'You chose [' + sub(cc) + ']']); moveTo(cc); draw(); }); })(c); }
        else cell.disabled = !canGo && !v;
        board.appendChild(cell);
      }
      stats.innerHTML = '';
      [[kb.visited.size, 'rooms visited'], [kb.stats.worlds, 'pit worlds checked'], [kb.stats.consistent, 'consistent with KB'], [kb.stats.wcands, 'possible wumpus rooms']].forEach(function (r) {
        stats.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })]));
      });
      msg.innerHTML = '<b>' + world.name + '.</b> ' + ({ exploring: 'Exploring. Dashed rooms can be entered: press Agent step, or click one.', won: '<b style="color:var(--env)">Found the gold!</b>', dead: '<b style="color:var(--bad)">The agent died.</b> It took a risk (or you did).', out: 'The agent climbed out.' }[status]);
      logBox.innerHTML = '';
      log.forEach(function (l) { logBox.appendChild(h('div', { class: l[0], text: l[1] })); });
      logBox.scrollTop = logBox.scrollHeight;
      bStep.disabled = status !== 'exploring';
    }
    pick.addEventListener('change', function () { preset = pick.value; setup(); });
    bStep.addEventListener('click', agentStep);
    bRun.addEventListener('click', function () { var n = 0; (function go() { if (status === 'exploring' && n++ < 40) { agentStep(); setTimeout(go, AG.reduce ? 0 : 450); } })(); });
    bReset.addEventListener('click', setup);
    bNew.addEventListener('click', function () { seed++; setup(); });
    cRev.addEventListener('change', function () { reveal = cRev.checked; draw(); });
    setup();
  });

  /* ---------------------------------------------------------------- truth table */
  var SYM = ['B11', 'B21', 'P11', 'P12', 'P21', 'P22', 'P31'];
  function lab(sy) { return sy[0] + sy[1] + ',' + sy[2]; }
  var RULES = [
    ['R1', '¬P1,1', function (m) { return !m.P11; }],
    ['R2', 'B1,1 ⇔ (P1,2 ∨ P2,1)', function (m) { return m.B11 === (m.P12 || m.P21); }],
    ['R3', 'B2,1 ⇔ (P1,1 ∨ P2,2 ∨ P3,1)', function (m) { return m.B21 === (m.P11 || m.P22 || m.P31); }],
    ['R4', '¬B1,1', function (m) { return !m.B11; }],
    ['R5', 'B2,1', function (m) { return m.B21; }],
  ];
  var QUERIES = [
    ['¬P1,2  (no pit in [1,2])', function (m) { return !m.P12; }],
    ['¬P2,1  (no pit in [2,1])', function (m) { return !m.P21; }],
    ['P2,2  (pit in [2,2])', function (m) { return m.P22; }],
    ['¬P2,2  (no pit in [2,2])', function (m) { return !m.P22; }],
    ['P2,2 ∨ P3,1  (a pit in [2,2] or [3,1])', function (m) { return m.P22 || m.P31; }],
    ['P3,1  (pit in [3,1])', function (m) { return m.P31; }],
  ];
  AG.widget('truthtable', function (root) {
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'TT-ENTAILS: model checking by truth table' }), h('span', { text: 'KB = R1 ∧ R2 ∧ R3 ∧ R4 ∧ R5 over 7 symbols. Does KB ⊨ α?' })]));
    var q = h('select', { 'aria-label': 'Query' });
    QUERIES.forEach(function (o, i) { q.appendChild(h('option', { value: i, text: 'α = ' + o[0] })); });
    var bCheck = h('button', { type: 'button', class: 'primary', text: 'Check' });
    var cAll = h('input', { type: 'checkbox' });
    root.appendChild(h('div', { class: 'w-row' }, [q, bCheck, h('label', { class: 'w-note' }, [cAll, ' Show all 128 rows (otherwise only models of the KB)'])]));
    var verdict = h('p', { class: 'w-note', html: 'Press <b>Check</b>.' });
    root.appendChild(verdict);
    var tbody = h('tbody'), wrap = h('div', { class: 'table-wrap', style: 'max-height:360px;overflow:auto' });
    var head = h('tr', null, [h('th', { text: '#' })].concat(SYM.map(function (sy) { return h('th', { text: lab(sy) }); })).concat(RULES.map(function (r) { return h('th', { text: r[0], title: r[1] }); })).concat([h('th', { text: 'KB' }), h('th', { text: 'α' })]));
    wrap.appendChild(h('table', { style: 'font:12.5px ui-monospace,Menlo,monospace' }, [h('thead', { style: 'position:sticky;top:0' }, [head]), tbody]));
    root.appendChild(wrap);
    root.appendChild(h('p', { class: 'w-note', html: 'Rules: ' + RULES.map(function (r) { return '<b>' + r[0] + '</b> ' + r[1]; }).join(' · ') }));
    var models = [];
    for (var i = 0; i < 128; i++) {
      var m = {}; SYM.forEach(function (sy, j) { m[sy] = !!(i & (1 << (6 - j))); });
      models.push(m);
    }
    var running = null;
    function T(b) { return b ? 'T' : '·'; }
    function render(upTo) {
      var a = QUERIES[+q.value][1], all = cAll.checked;
      tbody.innerHTML = '';
      var kbCount = 0, ok = 0, counter = null;
      models.forEach(function (m, i) {
        var rv = RULES.map(function (r) { return r[2](m); }), kbv = rv.every(Boolean), av = a(m);
        if (i <= upTo && kbv) { kbCount++; if (av) ok++; else if (counter === null) counter = i; }
        if (!all && !kbv) return;
        var tr = h('tr', { style: (kbv ? 'background:var(--accent-soft);' : '') + (i > upTo ? 'opacity:.35' : '') });
        tr.appendChild(h('td', { text: String(i + 1) }));
        SYM.forEach(function (sy) { tr.appendChild(h('td', { text: T(m[sy]) })); });
        rv.forEach(function (v) { tr.appendChild(h('td', { text: T(v), style: v ? '' : 'color:var(--bad)' })); });
        tr.appendChild(h('td', null, [h('b', { text: T(kbv) })]));
        tr.appendChild(h('td', { style: kbv && i <= upTo ? (av ? 'color:var(--env);font-weight:700' : 'color:var(--bad);font-weight:700') : '', text: T(av) }));
        tbody.appendChild(tr);
      });
      if (upTo >= 127) {
        verdict.innerHTML = 'Checked all 128 models. The KB is true in <b>' + kbCount + '</b> of them. ' + (counter === null ?
          'α is true in every one, so <b style="color:var(--env)">KB ⊨ α</b>.' : 'α is false in model #' + (counter + 1) + ', a world the KB allows, so <b style="color:var(--bad)">KB does not entail α</b>.');
      } else verdict.innerHTML = 'Enumerating… ' + (upTo + 1) + ' of 128 models';
    }
    bCheck.addEventListener('click', function () {
      if (running) cancelAnimationFrame(running);
      if (AG.reduce) { render(127); return; }
      var t0 = performance.now();
      (function f(now) { var u = Math.min(127, Math.floor((now - t0) / 12)); render(u); if (u < 127) running = requestAnimationFrame(f); })(t0);
    });
    q.addEventListener('change', function () { render(-1); verdict.innerHTML = 'Press <b>Check</b>.'; });
    cAll.addEventListener('change', function () { bCheck.click(); });
    render(-1);
  });
})();
