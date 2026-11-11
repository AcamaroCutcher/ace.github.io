/* Lesson 05 widgets: planvspolicy, valueiter, qlearn. The MDP mirrors mdp.py (AIMA's 4x3 world). */
(function () {
  'use strict';
  var h = AG.h;
  var COLS = 4, ROWS = 3, WALL = '2,2', TERM = { '4,3': 1, '4,2': -1 };
  var ACTS = ['Up', 'Down', 'Left', 'Right'], D = { Up: [0, 1], Down: [0, -1], Left: [-1, 0], Right: [1, 0] };
  var SIDE = { Up: ['Left', 'Right'], Down: ['Left', 'Right'], Left: ['Up', 'Down'], Right: ['Up', 'Down'] };
  var ARROW = { Up: '↑', Down: '↓', Left: '←', Right: '→' };
  var STATES = [];
  for (var x = 1; x <= COLS; x++) for (var y = 1; y <= ROWS; y++) if (x + ',' + y !== WALL) STATES.push(x + ',' + y);
  function xy(s) { return s.split(',').map(Number); }
  function move(s, a) {
    var p = xy(s), t = [p[0] + D[a][0], p[1] + D[a][1]], k = t[0] + ',' + t[1];
    if (k === WALL || t[0] < 1 || t[0] > COLS || t[1] < 1 || t[1] > ROWS) return s;
    return k;
  }
  function trans(s, a, pInt) { var q = (1 - pInt) / 2; return [[pInt, move(s, a)], [q, move(s, SIDE[a][0])], [q, move(s, SIDE[a][1])]]; }
  function R(s, living) { return s in TERM ? TERM[s] : living; }
  function sweep(U, living, gamma, pInt) {
    var U2 = {}, delta = 0;
    STATES.forEach(function (s) {
      if (s in TERM) U2[s] = TERM[s];
      else U2[s] = R(s, living) + gamma * Math.max.apply(null, ACTS.map(function (a) { return trans(s, a, pInt).reduce(function (t, pr) { return t + pr[0] * U[pr[1]]; }, 0); }));
      delta = Math.max(delta, Math.abs(U2[s] - U[s]));
    });
    return { U: U2, delta: delta };
  }
  function solve(living, gamma, pInt) {
    var U = {}; STATES.forEach(function (s) { U[s] = 0; });
    for (var i = 0; i < 2000; i++) { var r = sweep(U, living, gamma, pInt); U = r.U; if (r.delta < 1e-7) break; }
    return U;
  }
  function policy(U, pInt) {
    var pi = {};
    STATES.forEach(function (s) {
      if (s in TERM) return;
      var best = null, bv = -Infinity;
      ACTS.forEach(function (a) { var v = trans(s, a, pInt).reduce(function (t, pr) { return t + pr[0] * U[pr[1]]; }, 0); if (v > bv + 1e-12) { bv = v; best = a; } });
      pi[s] = best;
    });
    return pi;
  }
  function sample(s, a, pInt, r) { var t = trans(s, a, pInt), u = r(), c = 0; for (var i = 0; i < 3; i++) { c += t[i][0]; if (u < c) return t[i][1]; } return t[2][1]; }

  // draw the 4x3 grid on a canvas; fill(s) -> {bg, text, sub}
  function drawGrid(C, cellFn, extra) {
    var ctx = C.ctx, cw = C.W / COLS, ch = C.H / ROWS;
    ctx.clearRect(0, 0, C.W, C.H);
    for (var x = 1; x <= COLS; x++) for (var y = 1; y <= ROWS; y++) {
      var s = x + ',' + y, px = (x - 1) * cw, py = (ROWS - y) * ch;
      if (s === WALL) { ctx.fillStyle = AG.isDark() ? '#3a3a38' : '#3d3c37'; ctx.fillRect(px, py, cw, ch); continue; }
      var c = cellFn(s, px, py, cw, ch) || {};
      ctx.fillStyle = c.bg || AG.css('--surface'); ctx.fillRect(px, py, cw, ch);
      if (c.draw) c.draw(ctx, px, py, cw, ch);
      ctx.strokeStyle = AG.css('--line'); ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, cw - 1, ch - 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (c.text) { ctx.fillStyle = c.color || AG.css('--ink'); ctx.font = '700 ' + Math.round(Math.min(cw, ch) * .2) + 'px ui-monospace, Menlo, monospace'; ctx.fillText(c.text, px + cw / 2, py + ch / 2 - (c.sub ? ch * .1 : 0)); }
      if (c.sub) { ctx.fillStyle = AG.css('--muted'); ctx.font = Math.round(Math.min(cw, ch) * .16) + 'px system-ui'; ctx.fillText(c.sub, px + cw / 2, py + ch / 2 + ch * .2); }
      ctx.fillStyle = AG.css('--muted'); ctx.font = '600 10px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('[' + s + ']', px + 5, py + 4);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (extra) extra(ctx, cw, ch);
  }
  function valColor(v, a) {
    a = a == null ? .55 : a;
    return v >= 0 ? 'rgba(15,157,118,' + (a * Math.min(1, v)) + ')' : 'rgba(212,67,74,' + (a * Math.min(1, -v)) + ')';
  }
  function center(s, cw, ch) { var p = xy(s); return [(p[0] - .5) * cw, (ROWS - p[1] + .5) * ch]; }

  /* ================================================================ plan vs policy */
  AG.widget('planvspolicy', function (root) {
    var PLAN = ['Up', 'Up', 'Right', 'Right', 'Right'];
    var pi = policy(solve(-0.04, 1, 0.8), 0.8), rnd = AG.rng(5);
    var stats = { plan: [0, 0], pol: [0, 0] }, trails = [];
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Fixed plan vs. policy' }), h('span', { text: 'Plan: Up, Up, Right, Right, Right. Policy: the optimal π* for R(s) = −0.04.' })]));
    var grid = h('div', { class: 'w-grid2 even' }), st = h('div', { class: 'w-stage' }), side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(st); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(st, function (w) { return Math.round(w * 3 / 4); }, function () { draw(); });
    var tbl = h('tbody');
    side.appendChild(h('div', { class: 'table-wrap' }, [h('table', null, [h('thead', null, [h('tr', null, ['', 'Runs', 'Reached +1', 'Rate'].map(function (t) { return h('th', { text: t }); }))]), tbl])]));
    var note = h('p', { class: 'w-note' }); side.appendChild(note);
    var b1 = h('button', { type: 'button', class: 'primary', text: 'Run plan ×1000' }), b2 = h('button', { type: 'button', text: 'Run policy ×1000' }), b3 = h('button', { type: 'button', text: 'Animate one of each' });
    root.appendChild(h('div', { class: 'w-row' }, [b1, b2, b3]));
    function runPlan() { var s = '1,1', path = [s]; for (var i = 0; i < PLAN.length && !(s in TERM); i++) { s = sample(s, PLAN[i], 0.8, rnd); path.push(s); } return { ok: s === '4,3', path: path }; }
    function runPol() { var s = '1,1', path = [s]; for (var i = 0; i < 100 && !(s in TERM); i++) { s = sample(s, pi[s], 0.8, rnd); path.push(s); } return { ok: s === '4,3', path: path }; }
    function upd() {
      tbl.innerHTML = '';
      [['Fixed plan', stats.plan], ['Policy π*', stats.pol]].forEach(function (r) {
        tbl.appendChild(h('tr', null, [h('td', { text: r[0] }), h('td', { text: String(r[1][0]) }), h('td', { text: String(r[1][1]) }), h('td', null, [h('b', { text: r[1][0] ? (100 * r[1][1] / r[1][0]).toFixed(1) + '%' : '–' })])]));
      });
      note.innerHTML = 'Theory for the plan: 0.8⁵ + 0.1⁴·0.8 = <b>32.8%</b>. The policy can wander for a while, but it reaches +1 most of the time, because it always has a good move from wherever it lands.';
    }
    function draw() {
      drawGrid(C, function (s) {
        if (s === '4,3') return { bg: 'rgba(15,157,118,.25)', text: '+1' };
        if (s === '4,2') return { bg: 'rgba(212,67,74,.22)', text: '−1' };
        return { text: pi[s] ? ARROW[pi[s]] : '', color: AG.css('--muted') };
      }, function (ctx, cw, ch) {
        trails.forEach(function (t) {
          ctx.strokeStyle = t.color; ctx.lineWidth = 3; ctx.globalAlpha = .85; ctx.beginPath();
          t.path.slice(0, t.n).forEach(function (s, i) { var c = center(s, cw, ch), j = (t.off || 0); if (i) ctx.lineTo(c[0] + j, c[1] + j); else ctx.moveTo(c[0] + j, c[1] + j); });
          ctx.stroke(); ctx.globalAlpha = 1;
          var last = center(t.path[Math.max(0, t.n - 1)], cw, ch);
          ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(last[0] + (t.off || 0), last[1] + (t.off || 0), 7, 0, 7); ctx.fill();
        });
      });
    }
    b1.addEventListener('click', function () { for (var i = 0; i < 1000; i++) { var r = runPlan(); stats.plan[0]++; if (r.ok) stats.plan[1]++; } upd(); });
    b2.addEventListener('click', function () { for (var i = 0; i < 1000; i++) { var r = runPol(); stats.pol[0]++; if (r.ok) stats.pol[1]++; } upd(); });
    b3.addEventListener('click', function () {
      var a = runPlan(), b = runPol();
      trails = [{ path: a.path, n: 1, color: AG.css('--warm'), off: -5 }, { path: b.path, n: 1, color: AG.css('--accent'), off: 5 }];
      var step = function () {
        var more = false;
        trails.forEach(function (t) { if (t.n < t.path.length) { t.n++; more = true; } });
        draw();
        if (more) setTimeout(step, AG.reduce ? 0 : 380);
        else note.innerHTML = '<span style="color:var(--warm)">■</span> Plan ' + (a.ok ? 'reached +1' : 'ended in ' + a.path[a.path.length - 1]) + ' after ' + (a.path.length - 1) + ' moves. <span style="color:var(--accent)">■</span> Policy ' + (b.ok ? 'reached +1' : 'ended in −1') + ' after ' + (b.path.length - 1) + ' moves.';
      };
      step();
    });
    upd(); draw();
  });

  /* ================================================================ value iteration */
  AG.widget('valueiter', function (root) {
    var living = -0.04, gamma = 1, pInt = 0.8, U, iter, delta, sel = '1,1';
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Value iteration on the 4×3 world' }), h('span', { text: 'Colors show U(s); arrows show the greedy policy for the current U.' })]));
    function slider(label, min, max, step, val, fmt, on) {
      var inp = h('input', { type: 'range', min: min, max: max, step: step, value: val }), out = h('output', { text: fmt(val) });
      inp.addEventListener('input', function () { out.textContent = fmt(+inp.value); on(+inp.value); });
      return h('label', { class: 'ctl' }, [h('span', { class: 'row' }, [label, out]), inp]);
    }
    root.appendChild(h('div', { class: 'w-row' }, [
      slider('Living reward R(s)', -2, 0.1, 0.01, living, function (v) { return v.toFixed(2); }, function (v) { living = v; reset(); }),
      slider('Discount γ', 0.5, 1, 0.01, gamma, function (v) { return v.toFixed(2); }, function (v) { gamma = v; reset(); }),
      slider('P(intended move)', 0.34, 1, 0.01, pInt, function (v) { return v.toFixed(2); }, function (v) { pInt = v; reset(); })]));
    var grid = h('div', { class: 'w-grid2' }), st = h('div', { class: 'w-stage', style: 'cursor:pointer' }), side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(st); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(st, function (w) { return Math.round(w * 3 / 4); }, function () { draw(); });
    var readout = h('div', { class: 'readout' }), detail = h('div', { class: 'log', style: 'height:auto;min-height:170px' }), warn = h('p', { class: 'w-note' });
    side.appendChild(readout); side.appendChild(h('div', { class: 'w-lab', text: 'Bellman update for the selected square' })); side.appendChild(detail); side.appendChild(warn);
    var b1 = h('button', { type: 'button', class: 'primary', text: 'One sweep' }), b2 = h('button', { type: 'button', text: 'Run to convergence' }), b3 = h('button', { type: 'button', text: 'Reset U = 0' });
    root.appendChild(h('div', { class: 'w-row' }, [b1, b2, b3]));
    function reset() { U = {}; STATES.forEach(function (s) { U[s] = 0; }); iter = 0; delta = null; draw(); }
    function one() { var r = sweep(U, living, gamma, pInt); U = r.U; delta = r.delta; iter++; draw(); }
    function draw() {
      var pi = policy(U, pInt);
      drawGrid(C, function (s) {
        var v = U[s];
        return { bg: valColor(v), text: (v >= 0 ? '+' : '') + v.toFixed(3), sub: s in TERM ? 'terminal' : (iter ? ARROW[pi[s]] + ' ' + pi[s] : ''), color: AG.css('--ink') };
      }, function (ctx, cw, ch) {
        var c = center(sel, cw, ch);
        ctx.strokeStyle = AG.css('--accent'); ctx.lineWidth = 3; ctx.strokeRect(c[0] - cw / 2 + 2, c[1] - ch / 2 + 2, cw - 4, ch - 4);
      });
      readout.innerHTML = '';
      [[iter, 'sweeps'], [delta == null ? '–' : delta.toExponential(1), 'max change δ'], [U['1,1'].toFixed(3), 'U(start)']].forEach(function (r) { readout.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })])); });
      // Bellman detail
      detail.innerHTML = '';
      if (sel in TERM) { detail.appendChild(h('div', { text: '[' + sel + '] is terminal: U = R = ' + TERM[sel] })); }
      else {
        var best = -Infinity, ba = null;
        detail.appendChild(h('div', { class: 'dim', text: 'U\'([' + sel + ']) = R + γ · max over actions of Σ P(s\'|s,a) U(s\')' }));
        ACTS.forEach(function (a) {
          var t = trans(sel, a, pInt), v = t.reduce(function (acc, pr) { return acc + pr[0] * U[pr[1]]; }, 0);
          if (v > best + 1e-12) { best = v; ba = a; }
          detail.appendChild(h('div', { 'data-a': a, text: (a + ':').padEnd(7) + t.map(function (pr) { return pr[0].toFixed(2) + '×' + U[pr[1]].toFixed(3); }).join(' + ') + ' = ' + v.toFixed(3) }));
        });
        [].forEach.call(detail.querySelectorAll('[data-a]'), function (el) { if (el.getAttribute('data-a') === ba) el.className = 'ok'; });
        detail.appendChild(h('div', { class: 'act', text: 'U\' = ' + living.toFixed(2) + ' + ' + gamma.toFixed(2) + ' × ' + best.toFixed(3) + ' = ' + (living + gamma * best).toFixed(3) + '   (best: ' + ba + ')' }));
      }
      warn.innerHTML = gamma >= 0.999 && living > 0 ? '<b style="color:var(--bad)">With γ = 1 and a positive living reward, staying forever is worth infinity:</b> utilities grow without bound. Lower γ.' : 'Click a square to inspect its update.';
    }
    C.cv.addEventListener('click', function (ev) {
      var p = AG.pos(C.cv, ev), x = Math.floor(p.x / (C.W / COLS)) + 1, y = ROWS - Math.floor(p.y / (C.H / ROWS));
      var s = x + ',' + y; if (s !== WALL && STATES.indexOf(s) >= 0) { sel = s; draw(); }
    });
    b1.addEventListener('click', one);
    b2.addEventListener('click', function () {
      var n = 0;
      (function go() { one(); n++; if (n < 300 && delta > 1e-6) setTimeout(go, AG.reduce ? 0 : 60); })();
    });
    b3.addEventListener('click', reset);
    reset();
  });

  /* ================================================================ Q-learning */
  AG.widget('qlearn', function (root) {
    var alpha = 0.1, eps = 0.1, living = -0.04, Q, episodes, rnd = AG.rng(3), errs = [], agentPos = '1,1', timer = null;
    var Ustar = solve(living, 1, 0.8);
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Q-learning on the 4×3 world' }), h('span', { text: 'Model-free: the agent only sees states and rewards. α and ε as in mdp.py.' })]));
    function slider(label, min, max, step, val, on) {
      var inp = h('input', { type: 'range', min: min, max: max, step: step, value: val }), out = h('output', { text: String(val) });
      inp.addEventListener('input', function () { out.textContent = inp.value; on(+inp.value); });
      return h('label', { class: 'ctl' }, [h('span', { class: 'row' }, [label, out]), inp]);
    }
    root.appendChild(h('div', { class: 'w-row' }, [slider('Learning rate α', 0.01, 1, 0.01, alpha, function (v) { alpha = v; }), slider('Exploration ε', 0, 1, 0.01, eps, function (v) { eps = v; })]));
    var grid = h('div', { class: 'w-grid2' }), st = h('div', { class: 'w-stage' }), side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(st); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(st, function (w) { return Math.round(w * 3 / 4); }, function () { draw(); });
    var readout = h('div', { class: 'readout' }); side.appendChild(readout);
    side.appendChild(h('div', { class: 'w-lab', text: 'Average |max Q − U*| over states' }));
    var chartBox = h('div', { class: 'w-stage', style: 'background:var(--surface)' }); side.appendChild(chartBox);
    var CH = AG.canvas(chartBox, 0.5, function () { chart(); });
    var b1 = h('button', { type: 'button', class: 'primary', text: 'Watch 1 episode' }), b2 = h('button', { type: 'button', text: 'Train ×100' }), b3 = h('button', { type: 'button', text: 'Train ×1000' }), b4 = h('button', { type: 'button', text: 'Reset' });
    root.appendChild(h('div', { class: 'w-row' }, [b1, b2, b3, b4]));
    function reset() {
      if (timer) { clearTimeout(timer); timer = null; }
      Q = {}; STATES.forEach(function (s) { ACTS.forEach(function (a) { Q[s + '|' + a] = s in TERM ? TERM[s] : 0; }); });
      episodes = 0; errs = []; agentPos = '1,1'; draw(); chart();
    }
    function maxQ(s) { return Math.max.apply(null, ACTS.map(function (a) { return Q[s + '|' + a]; })); }
    function choose(s) {
      if (rnd() < eps) return ACTS[Math.floor(rnd() * 4)];
      var best = ACTS[0]; ACTS.forEach(function (a) { if (Q[s + '|' + a] > Q[s + '|' + best]) best = a; }); return best;
    }
    function stepQ(s) {
      var a = choose(s), s2 = sample(s, a, 0.8, rnd);
      var target = R(s, living) + maxQ(s2);
      Q[s + '|' + a] += alpha * (target - Q[s + '|' + a]);
      return s2;
    }
    function err() { var e = 0, n = 0; STATES.forEach(function (s) { if (!(s in TERM)) { e += Math.abs(maxQ(s) - Ustar[s]); n++; } }); return e / n; }
    function episode() { var s = '1,1', n = 0; while (!(s in TERM) && n++ < 500) s = stepQ(s); episodes++; errs.push(err()); }
    function draw() {
      drawGrid(C, function (s) {
        if (s in TERM) return { bg: valColor(TERM[s], .3), text: TERM[s] > 0 ? '+1' : '−1' };
        return {
          draw: function (ctx, px, py, cw, ch) {
            var cx = px + cw / 2, cy = py + ch / 2, tri = { Up: [[px, py], [px + cw, py]], Down: [[px, py + ch], [px + cw, py + ch]], Left: [[px, py], [px, py + ch]], Right: [[px + cw, py], [px + cw, py + ch]] };
            ACTS.forEach(function (a) {
              var q = Q[s + '|' + a], t = tri[a];
              ctx.fillStyle = valColor(q, .7); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(t[0][0], t[0][1]); ctx.lineTo(t[1][0], t[1][1]); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = AG.css('--line-2'); ctx.stroke();
              var lx = cx + (D[a][0]) * cw * .3, ly = cy - (D[a][1]) * ch * .32;
              ctx.fillStyle = AG.css('--ink'); ctx.font = Math.round(Math.min(cw, ch) * .12) + 'px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(q.toFixed(2), lx, ly);
            });
            var best = ACTS.reduce(function (b, a) { return Q[s + '|' + a] > Q[s + '|' + b] ? a : b; }, ACTS[0]);
            if (episodes) { ctx.fillStyle = AG.css('--accent'); ctx.font = '700 ' + Math.round(Math.min(cw, ch) * .2) + 'px system-ui'; ctx.fillText(ARROW[best], cx, cy); }
          }
        };
      }, function (ctx, cw, ch) {
        var c = center(agentPos, cw, ch);
        ctx.fillStyle = AG.css('--warm'); ctx.beginPath(); ctx.arc(c[0], c[1], Math.min(cw, ch) * .12, 0, 7); ctx.fill();
      });
      readout.innerHTML = '';
      [[episodes, 'episodes'], [errs.length ? errs[errs.length - 1].toFixed(3) : '–', 'avg error'], [maxQ('1,1').toFixed(3), 'max Q(start)'], [Ustar['1,1'].toFixed(3), 'U*(start)']].forEach(function (r) { readout.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })])); });
    }
    function chart() { AG.lineChart(CH, [{ data: errs, color: AG.css('--accent') }], { min: 0, xlabel: 'episodes →', empty: 'train to see the error fall' }); }
    b1.addEventListener('click', function () {
      if (timer) return;
      agentPos = '1,1'; var n = 0;
      (function go() {
        if (agentPos in TERM || n++ > 200) { episodes++; errs.push(err()); chart(); draw(); timer = null; return; }
        agentPos = stepQ(agentPos); draw();
        timer = setTimeout(go, AG.reduce ? 0 : 240);
      })();
    });
    b2.addEventListener('click', function () { for (var i = 0; i < 100; i++) episode(); agentPos = '1,1'; draw(); chart(); });
    b3.addEventListener('click', function () { for (var i = 0; i < 1000; i++) episode(); agentPos = '1,1'; draw(); chart(); });
    b4.addEventListener('click', reset);
    reset();
  });

  /* ================================================================ paint your own MDP */
  AG.widget('mdppaint', function (root) {
    var C2 = 9, R2 = 6, cells = [], tool = 'wall', living = -0.04, gamma = 0.95, pInt = 0.8, start = [0, 0], U = null, pi = null, trails = [];
    for (var i = 0; i < C2 * R2; i++) cells.push({ t: 'empty' });
    // a default world: a cliff of pits along the bottom, a goal at the far end, a few walls
    for (var x = 1; x < C2 - 1; x++) cells[(R2 - 1) * C2 + x] = { t: 'pit' };
    cells[(R2 - 1) * C2 + C2 - 1] = { t: 'goal' }; start = [0, R2 - 1];
    [[3, 1], [3, 2], [3, 3], [6, 2], [6, 3], [6, 4]].forEach(function (p) { cells[p[1] * C2 + p[0]] = { t: 'wall' }; });
    var REW = { goal: 1, pit: -1 };
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Paint your own world' }), h('span', { text: 'Walls, +1 goals and −1 pits. The policy is recomputed (value iteration) every time you paint.' })]));
    var tools = h('div', { class: 'seg', role: 'group', 'aria-label': 'Paint tool' });
    [['wall', '▮ Wall'], ['goal', '★ +1 goal'], ['pit', '✖ −1 pit'], ['start', '● Start'], ['empty', '◻ Erase']].forEach(function (t) {
      var b = h('button', { type: 'button', text: t[1], 'aria-pressed': String(t[0] === tool) });
      b.addEventListener('click', function () { tool = t[0]; [].forEach.call(tools.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); });
      tools.appendChild(b);
    });
    root.appendChild(tools);
    function sl(label, min, max, step, val, on) { var i2 = h('input', { type: 'range', min: min, max: max, step: step, value: val }), o = h('output', { text: String(val) }); i2.addEventListener('input', function () { o.textContent = (+i2.value).toFixed(2); on(+i2.value); solve2(); draw(); }); return h('label', { class: 'ctl' }, [h('span', { class: 'row' }, [label, o]), i2]); }
    root.appendChild(h('div', { class: 'w-row' }, [sl('Living reward', -1, 0.05, 0.01, living, function (v) { living = v; }), sl('Discount γ', 0.5, 0.99, 0.01, gamma, function (v) { gamma = v; }), sl('P(intended move)', 0.34, 1, 0.01, pInt, function (v) { pInt = v; })]));
    var st = h('div', { class: 'w-stage', style: 'cursor:crosshair' }); root.appendChild(st);
    var CV = AG.canvas(st, function (w) { return Math.round(w * R2 / C2); }, function () { draw(); });
    var bSim = h('button', { type: 'button', class: 'primary', text: 'Release 30 agents from ●' }), bClear = h('button', { type: 'button', text: 'Clear all' });
    var stat = h('p', { class: 'w-note' });
    root.appendChild(h('div', { class: 'w-row' }, [bSim, bClear])); root.appendChild(stat);
    var DIRS2 = [[0, -1, '↑'], [0, 1, '↓'], [-1, 0, '←'], [1, 0, '→']];   // screen coordinates: y down
    function T(i) { return cells[i].t; }
    function mv(i, d) { var x2 = i % C2 + d[0], y2 = Math.floor(i / C2) + d[1]; if (x2 < 0 || y2 < 0 || x2 >= C2 || y2 >= R2 || T(y2 * C2 + x2) === 'wall') return i; return y2 * C2 + x2; }
    function trans2(i, a) { var d = DIRS2[a], side = a < 2 ? [2, 3] : [0, 1], q = (1 - pInt) / 2; return [[pInt, mv(i, d)], [q, mv(i, DIRS2[side[0]])], [q, mv(i, DIRS2[side[1]])]]; }
    function solve2() {
      U = new Float64Array(C2 * R2); pi = new Int8Array(C2 * R2).fill(-1);
      for (var it = 0; it < 500; it++) {
        var U2 = new Float64Array(C2 * R2), delta = 0;
        for (var i = 0; i < C2 * R2; i++) {
          var t = T(i);
          if (t === 'wall') continue;
          if (t in REW) { U2[i] = REW[t]; continue; }
          var best = -Infinity;
          for (var a = 0; a < 4; a++) { var v = 0; trans2(i, a).forEach(function (pr) { v += pr[0] * U[pr[1]]; }); if (v > best) best = v; }
          U2[i] = living + gamma * best; delta = Math.max(delta, Math.abs(U2[i] - U[i]));
        }
        U = U2; if (delta < 1e-6) break;
      }
      for (i = 0; i < C2 * R2; i++) {
        if (T(i) !== 'empty') continue;
        var bv = -Infinity;
        for (a = 0; a < 4; a++) { var v2 = 0; trans2(i, a).forEach(function (pr) { v2 += pr[0] * U[pr[1]]; }); if (v2 > bv + 1e-12) { bv = v2; pi[i] = a; } }
      }
    }
    function draw() {
      var ctx = CV.ctx, cw = CV.W / C2, ch = CV.H / R2;
      ctx.clearRect(0, 0, CV.W, CV.H);
      for (var i = 0; i < C2 * R2; i++) {
        var x2 = (i % C2) * cw, y2 = Math.floor(i / C2) * ch, t = T(i);
        ctx.fillStyle = t === 'wall' ? (AG.isDark() ? '#3a3a38' : '#3d3c37') : t === 'goal' ? 'rgba(15,157,118,.55)' : t === 'pit' ? 'rgba(212,67,74,.5)' : (U[i] >= 0 ? 'rgba(15,157,118,' + Math.min(.5, U[i] * .5) + ')' : 'rgba(212,67,74,' + Math.min(.5, -U[i] * .5) + ')');
        if (t === 'empty') { ctx.fillStyle = AG.css('--surface'); ctx.fillRect(x2, y2, cw, ch); ctx.fillStyle = U[i] >= 0 ? 'rgba(15,157,118,' + Math.min(.45, U[i] * .45) + ')' : 'rgba(212,67,74,' + Math.min(.45, -U[i] * .45) + ')'; }
        ctx.fillRect(x2, y2, cw, ch);
        ctx.strokeStyle = AG.css('--line'); ctx.strokeRect(x2 + .5, y2 + .5, cw - 1, ch - 1);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = AG.css('--ink');
        if (t === 'goal' || t === 'pit') { ctx.font = '700 ' + Math.round(ch * .3) + 'px system-ui'; ctx.fillText(t === 'goal' ? '+1' : '−1', x2 + cw / 2, y2 + ch / 2); }
        else if (t === 'empty') {
          ctx.font = '700 ' + Math.round(ch * .34) + 'px system-ui'; ctx.fillText(pi[i] >= 0 ? DIRS2[pi[i]][2] : '', x2 + cw / 2, y2 + ch * .42);
          ctx.font = Math.round(ch * .15) + 'px ui-monospace, Menlo, monospace'; ctx.fillStyle = AG.css('--muted'); ctx.fillText(U[i].toFixed(2), x2 + cw / 2, y2 + ch * .78);
        }
      }
      ctx.lineWidth = 2;
      trails.forEach(function (tr) {
        ctx.strokeStyle = tr.end === 'goal' ? 'rgba(15,157,118,.55)' : tr.end === 'pit' ? 'rgba(212,67,74,.55)' : 'rgba(150,150,150,.4)'; ctx.beginPath();
        tr.p.forEach(function (c, k) { var px = (c % C2 + .5) * cw + tr.j, py = (Math.floor(c / C2) + .5) * ch + tr.j; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
      });
      var si = start[1] * C2 + start[0];
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc((start[0] + .5) * cw, (start[1] + .5) * ch, Math.min(cw, ch) * .18, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; void si;
    }
    var painting = false;
    function paint(ev) {
      var p = AG.pos(CV.cv, ev), x2 = Math.floor(p.x / (CV.W / C2)), y2 = Math.floor(p.y / (CV.H / R2));
      if (x2 < 0 || y2 < 0 || x2 >= C2 || y2 >= R2) return;
      var i = y2 * C2 + x2;
      if (tool === 'start') { if (T(i) === 'empty') start = [x2, y2]; }
      else if (!(x2 === start[0] && y2 === start[1])) cells[i] = { t: tool };
      trails = []; solve2(); draw();
    }
    CV.cv.addEventListener('pointerdown', function (ev) { painting = true; CV.cv.setPointerCapture(ev.pointerId); paint(ev); });
    CV.cv.addEventListener('pointermove', function (ev) { if (painting && tool !== 'start') paint(ev); });
    CV.cv.addEventListener('pointerup', function () { painting = false; });
    bClear.addEventListener('click', function () { cells.forEach(function (c, i) { cells[i] = { t: 'empty' }; }); cells[C2 * R2 - 1] = { t: 'goal' }; trails = []; solve2(); draw(); stat.textContent = ''; });
    bSim.addEventListener('click', function () {
      var r = AG.rng(Math.floor(Math.random() * 1e9)), n = { goal: 0, pit: 0, lost: 0 }, steps = 0;
      trails = [];
      for (var k = 0; k < 30; k++) {
        var i = start[1] * C2 + start[0], path = [i], end = 'lost';
        for (var s2 = 0; s2 < 200; s2++) {
          if (T(i) in REW) { end = T(i); break; }
          if (pi[i] < 0) break;
          var tr = trans2(i, pi[i]), u = r(), c = 0;
          for (var q = 0; q < 3; q++) { c += tr[q][0]; if (u < c) { i = tr[q][1]; break; } }
          path.push(i);
        }
        n[end]++; steps += path.length - 1;
        trails.push({ p: path, end: end, j: (r() - .5) * 10 });
      }
      draw();
      stat.innerHTML = 'Of 30 agents following the policy: <b>' + n.goal + '</b> reached +1, <b>' + n.pit + '</b> fell into −1, ' + n.lost + ' never finished (200 steps). Average ' + (steps / 30).toFixed(1) + ' steps. Try a lower P(intended move) and watch the policy move away from the pits.';
    });
    solve2(); draw();
  });
})();
