/* Lesson 00 widgets: timeline, pycell, dice, vectors, softmax, descent, httpbuilder */
(function () {
  'use strict';
  var h = AG.h;

  /* ================================================================ timeline */
  var EVENTS = [
    [1943, 'learning', 'The artificial neuron', 'McCulloch and Pitts model neurons as simple threshold units: the seed of neural networks.', null],
    [1950, 'idea', 'The Turing test', 'Alan Turing\'s paper "Computing Machinery and Intelligence" proposes judging machine intelligence by conversation.', '00-background'],
    [1956, 'idea', 'The Dartmouth workshop', 'McCarthy, Minsky, Shannon and Rochester gather to study "artificial intelligence", the name McCarthy proposed for the workshop.', null],
    [1958, 'learning', 'The perceptron', 'Frank Rosenblatt\'s perceptron learns to classify patterns by adjusting weights.', '06-inside-an-llm'],
    [1968, 'search', 'A* search and Shakey', 'Hart, Nilsson and Raphael publish A*, developed for Shakey, SRI\'s robot that planned its own actions.', '03-search'],
    [1972, 'logic', 'Logic programming and expert systems', 'Prolog appears; in the 1970s rule-based expert systems such as MYCIN encode specialist knowledge.', '04-knowledge'],
    [1986, 'learning', 'Backpropagation', 'Rumelhart, Hinton and Williams popularize backpropagation for training multi-layer networks.', '06-inside-an-llm'],
    [1988, 'prob', 'Bayesian networks', 'Judea Pearl\'s book makes probabilistic reasoning practical for AI.', '04-knowledge'],
    [1989, 'prob', 'Q-learning', 'Chris Watkins introduces Q-learning: learning to act from rewards alone.', '05-decisions-and-learning'],
    [1995, 'idea', 'AIMA, 1st edition', 'Russell and Norvig unify the field around rational agents.', '01-agents-and-environments'],
    [1997, 'search', 'Deep Blue beats Kasparov', 'IBM\'s chess machine wins a match against the world champion, with massive search and evaluation.', '03-search'],
    [2002, 'robots', 'Robot vacuums at home', 'iRobot\'s Roomba brings a simple reactive agent into millions of homes.', '02-agent-programs'],
    [2005, 'robots', 'Stanley crosses the desert', 'Stanford\'s self-driving car wins the DARPA Grand Challenge, built on probabilistic perception.', '09-build-a-robot'],
    [2012, 'learning', 'AlexNet', 'A deep convolutional network trained on GPUs wins ImageNet by a wide margin: deep learning takes off.', '06-inside-an-llm'],
    [2016, 'learning', 'AlphaGo', 'DeepMind\'s system, combining search with learned networks and reinforcement learning, beats Lee Sedol at Go.', '05-decisions-and-learning'],
    [2017, 'llm', 'The Transformer', '"Attention Is All You Need" introduces the architecture behind modern LLMs.', '06-inside-an-llm'],
    [2020, 'llm', 'Scaling up: GPT-3', 'A 175-billion-parameter language model shows that scale brings broad abilities. AIMA\'s 4th edition appears the same year.', '06-inside-an-llm'],
    [2022, 'llm', 'ChatGPT and Constitutional AI', 'Chat assistants trained with human feedback reach the public; Anthropic publishes Constitutional AI.', '05-decisions-and-learning'],
    [2023, 'llm', 'Claude', 'Anthropic releases its first Claude models.', '06-inside-an-llm'],
    [2024, 'agents', 'Tools, computer use and MCP', 'Claude gains computer use (Oct.) and Anthropic open-sources the Model Context Protocol (Nov.).', '08-real-world'],
    [2025, 'agents', 'Coding agents', 'Claude Code, an agent that works in your terminal, becomes generally available (May).', '07-llm-agents'],
  ];
  var THEMES = { idea: ['Ideas', '#7c5cff'], search: ['Search', '#2a78d6'], logic: ['Logic', '#13b7a0'], prob: ['Probability', '#f2b233'], learning: ['Learning', '#e2559b'], robots: ['Robots', '#ff8a3d'], llm: ['LLMs', '#5b4fe0'], agents: ['LLM agents', '#0f9d76'] };
  AG.widget('timeline', function (root) {
    var sel = 15, filter = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: '80 years of AI, from neurons to agents' }), h('span', { text: 'Click a dot. Filter by theme.' })]));
    var chips = h('div', { class: 'w-row' });
    Object.keys(THEMES).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'small', 'aria-pressed': 'false', html: '<span style="color:' + THEMES[k][1] + '">●</span> ' + THEMES[k][0] });
      b.addEventListener('click', function () { filter = filter === k ? null : k; [].forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', String(c === b && filter === k)); }); draw(); });
      chips.appendChild(b);
    });
    root.appendChild(chips);
    var track = h('div', { class: 'tl-track' }); root.appendChild(track);
    var card = h('div', { class: 'tl-card' }); root.appendChild(card);
    function draw() {
      track.innerHTML = '';
      track.appendChild(h('div', { class: 'tl-line' }));
      EVENTS.forEach(function (e, i) {
        var dim = filter && e[1] !== filter;
        var b = h('button', { type: 'button', class: 'tl-dot' + (i === sel ? ' on' : ''), style: 'left:' + (2 + 96 * i / (EVENTS.length - 1)) + '%;--c:' + THEMES[e[1]][1] + ';opacity:' + (dim ? .2 : 1), 'aria-label': e[0] + ': ' + e[2] }, [h('span', { text: String(e[0]) })]);
        b.addEventListener('click', function () { sel = i; draw(); });
        track.appendChild(b);
      });
      var e = EVENTS[sel];
      card.innerHTML = '';
      card.appendChild(h('div', { class: 'tl-year', style: 'color:' + THEMES[e[1]][1], text: e[0] + ' · ' + THEMES[e[1]][0] }));
      card.appendChild(h('b', { text: e[2] }));
      card.appendChild(h('p', { text: e[3] }));
      if (e[4]) card.appendChild(h('a', { href: '../' + e[4] + '/index.html', text: 'Where this lives in the course → lesson ' + e[4].slice(0, 2) }));
      var nav = h('div', { class: 'w-row' }), prev = h('button', { type: 'button', class: 'small', text: '← earlier' }), next = h('button', { type: 'button', class: 'small', text: 'later →' });
      prev.disabled = sel === 0; next.disabled = sel === EVENTS.length - 1;
      prev.addEventListener('click', function () { sel--; draw(); }); next.addEventListener('click', function () { sel++; draw(); });
      nav.appendChild(prev); nav.appendChild(next); card.appendChild(nav);
    }
    draw();
  });

  /* ================================================================ runnable Python cell */
  AG.widget('pycell', function (root) {
    var src = root.querySelector('.pycell-src').textContent;
    root.classList.add('pycell');
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: root.getAttribute('data-title') })]));
    var host = h('div'); root.appendChild(host);
    var out = h('pre', { class: 'pycell-out' });
    var bRun = h('button', { type: 'button', class: 'primary small', text: '▶ Run' }), bReset = h('button', { type: 'button', class: 'small', text: '↺ Reset' });
    var status = h('span', { class: 'w-note' });
    var ed = AG.editor(host, { value: src, minHeight: 60, onRun: function () { bRun.click(); } });
    root.appendChild(h('div', { class: 'pycell-bar' }, [bRun, bReset, status]));
    root.appendChild(out);
    bReset.addEventListener('click', function () { ed.set(src); out.textContent = ''; });
    bRun.addEventListener('click', function () {
      out.textContent = ''; bRun.disabled = true; var t0 = performance.now();
      AG.runPython({ files: { 'cell.py': ed.get() }, main: 'cell.py' }, {
        status: function (t) { status.textContent = t; },
        out: function (t) { out.appendChild(document.createTextNode(t + '\n')); },
        err: function (t) { out.appendChild(h('span', { class: 'err', text: t + '\n' })); },
        done: function (ok) { bRun.disabled = false; status.textContent = (ok ? 'ran' : 'error') + ' in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s · Ctrl/⌘+Enter runs'; if (ok) { AG.badge('first-run'); if (ed.get() !== src) AG.badge('editor'); } },
      });
    });
  });

  /* ================================================================ dice: expected value and the law of large numbers */
  var DISTS = {
    die: { name: 'Fair die (1–6)', v: [1, 2, 3, 4, 5, 6], p: [1, 1, 1, 1, 1, 1].map(function (x) { return x / 6; }) },
    bet: { name: 'Bet: win 10 with p = 0.2', v: [0, 10], p: [0.8, 0.2] },
    slip: { name: 'Robot step: forward 0.8, sideways 0.2 (lesson 05)', v: [1, 0], p: [0.8, 0.2] },
    lottery: { name: 'Lottery: win 100 with p = 0.01, ticket costs 2', v: [-2, 98], p: [0.99, 0.01] },
  };
  AG.widget('dice', function (root) {
    var d = 'die', rolls = [], sum = 0, counts = {}, r = AG.rng(17);
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Expected value and the law of large numbers' }), h('span', { text: 'The running average (purple) settles on E[X] (green).' })]));
    var pick = h('select', { 'aria-label': 'Random variable' });
    Object.keys(DISTS).forEach(function (k) { pick.appendChild(h('option', { value: k, text: DISTS[k].name })); });
    var b1 = h('button', { type: 'button', text: 'Roll ×1' }), b2 = h('button', { type: 'button', class: 'primary', text: 'Roll ×100' }), b3 = h('button', { type: 'button', text: 'Roll ×1000' }), b4 = h('button', { type: 'button', text: 'Reset' });
    root.appendChild(h('div', { class: 'w-row' }, [pick, b1, b2, b3, b4]));
    var grid = h('div', { class: 'w-grid2' }), cb = h('div', { class: 'w-stage', style: 'background:var(--surface)' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(cb); grid.appendChild(side); root.appendChild(grid);
    var CH = AG.canvas(cb, 0.55, function () { chart(); });
    var ro = h('div', { class: 'readout' }), hist = h('div', { class: 'bar-list' }); side.appendChild(ro); side.appendChild(hist);
    function E() { var D = DISTS[d]; return D.v.reduce(function (a, v, i) { return a + v * D.p[i]; }, 0); }
    var avg = [];
    function roll(n) {
      var D = DISTS[d];
      for (var i = 0; i < n; i++) { var u = r(), c = 0, v = D.v[D.v.length - 1]; for (var j = 0; j < D.v.length; j++) { c += D.p[j]; if (u < c) { v = D.v[j]; break; } } rolls.push(v); sum += v; counts[v] = (counts[v] || 0) + 1; avg.push(sum / rolls.length); }
      if (avg.length > 600) { var step = Math.ceil(avg.length / 600); avg = avg.filter(function (_, k) { return k % step === 0 || k === avg.length - 1; }); }
      draw();
    }
    function chart() { AG.lineChart(CH, [{ data: avg, color: AG.css('--accent') }, { data: avg.map(E), color: AG.css('--env') }], { xlabel: 'rolls →', empty: 'roll to start' }); }
    function draw() {
      chart();
      ro.innerHTML = '';
      [[rolls.length, 'rolls'], [rolls.length ? (sum / rolls.length).toFixed(3) : '–', 'running average'], [E().toFixed(3), 'E[X] = Σ x·P(x)']].forEach(function (x) { ro.appendChild(h('div', null, [h('b', { text: String(x[0]) }), h('span', { text: x[1] })])); });
      hist.innerHTML = ''; var D = DISTS[d];
      D.v.forEach(function (v, i) { var f = rolls.length ? (counts[v] || 0) / rolls.length : 0; hist.appendChild(h('div', { class: 'br' }, [h('span', { text: 'x = ' + v }), h('div', null, [h('i', { style: 'width:' + Math.max(.5, f * 100) + '%' })]), h('span', { text: (f * 100).toFixed(1) + '% (p ' + (D.p[i] * 100).toFixed(0) + '%)' })])); });
    }
    function reset() { rolls = []; sum = 0; counts = {}; avg = []; draw(); }
    pick.addEventListener('change', function () { d = pick.value; reset(); });
    b1.addEventListener('click', function () { roll(1); }); b2.addEventListener('click', function () { roll(100); }); b3.addEventListener('click', function () { roll(1000); }); b4.addEventListener('click', reset);
    draw();
  });

  /* ================================================================ vectors and the dot product */
  AG.widget('vectors', function (root) {
    var A = { x: 1.2, y: 0.5 }, B = { x: 0.6, y: 1.1 }, drag = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'The dot product, by dragging' }), h('span', { text: 'Drag the tips of a (purple) and b (green).' })]));
    var grid = h('div', { class: 'w-grid2' }), st = h('div', { class: 'w-stage' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(st); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(st, function (w) { return Math.min(380, Math.round(w * .8)); }, function () { draw(); });
    var ro = h('div', { class: 'readout' }), note = h('p', { class: 'w-note' }); side.appendChild(ro); side.appendChild(note);
    function S() { var R = Math.min(C.W, C.H) / 2 / 1.7; return { cx: C.W / 2, cy: C.H / 2, R: R }; }
    function px(p) { var s = S(); return [s.cx + p.x * s.R, s.cy - p.y * s.R]; }
    function arrow(ctx, p, col, lab) {
      var s = S(), q = px(p), a = Math.atan2(q[1] - s.cy, q[0] - s.cx);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.cx, s.cy); ctx.lineTo(q[0], q[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - 12 * Math.cos(a - .4), q[1] - 12 * Math.sin(a - .4)); ctx.lineTo(q[0] - 12 * Math.cos(a + .4), q[1] - 12 * Math.sin(a + .4)); ctx.fill();
      ctx.font = '700 14px system-ui'; ctx.fillText(lab, q[0] + 8, q[1] - 8);
      ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 7); ctx.globalAlpha = .25; ctx.fill(); ctx.globalAlpha = 1;
    }
    function draw() {
      var ctx = C.ctx, s = S(); ctx.clearRect(0, 0, C.W, C.H);
      ctx.strokeStyle = AG.css('--line'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, s.cy); ctx.lineTo(C.W, s.cy); ctx.moveTo(s.cx, 0); ctx.lineTo(s.cx, C.H); ctx.stroke();
      var dot = A.x * B.x + A.y * B.y, la = Math.hypot(A.x, A.y), lb = Math.hypot(B.x, B.y), cos = dot / (la * lb || 1);
      // projection of b onto a
      var k = dot / (la * la || 1), pr = { x: A.x * k, y: A.y * k }, q = px(pr), bq = px(B);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = AG.css('--muted'); ctx.beginPath(); ctx.moveTo(bq[0], bq[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = AG.css('--warm'); ctx.lineWidth = 5; ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(s.cx, s.cy); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.globalAlpha = 1;
      arrow(ctx, A, AG.css('--accent'), 'a'); arrow(ctx, B, AG.css('--env'), 'b');
      ro.innerHTML = '';
      [[dot.toFixed(2), 'a · b = aₓbₓ + a_yb_y'], [la.toFixed(2) + ' · ' + lb.toFixed(2), '|a| · |b|'], [cos.toFixed(2), 'cos θ'], [(Math.acos(AG.clamp(cos, -1, 1)) * 180 / Math.PI).toFixed(0) + '°', 'angle θ']].forEach(function (x) { ro.appendChild(h('div', null, [h('b', { text: x[0] }), h('span', { text: x[1] })])); });
      note.innerHTML = cos > 0.9 ? '<b>Nearly aligned:</b> in attention, this key would get a large weight.' : Math.abs(cos) < 0.15 ? '<b>Perpendicular:</b> the dot product is about 0; the vectors are "unrelated".' : cos < -0.5 ? '<b>Opposed:</b> negative dot product.' : 'The orange segment is the projection of b onto a; its signed length times |a| is the dot product.';
    }
    function hit(ev) { var p = AG.pos(C.cv, ev), best = null; [A, B].forEach(function (o) { var q = px(o); if (Math.hypot(q[0] - p.x, q[1] - p.y) < 20) best = o; }); return best; }
    C.cv.addEventListener('pointerdown', function (ev) { drag = hit(ev); if (drag) C.cv.setPointerCapture(ev.pointerId); });
    C.cv.addEventListener('pointermove', function (ev) { C.cv.style.cursor = hit(ev) ? 'grab' : 'default'; if (!drag) return; var s = S(), p = AG.pos(C.cv, ev); drag.x = AG.clamp((p.x - s.cx) / s.R, -1.6, 1.6); drag.y = AG.clamp(-(p.y - s.cy) / s.R, -1.6, 1.6); draw(); });
    C.cv.addEventListener('pointerup', function () { drag = null; });
    draw();
  });

  /* ================================================================ softmax playground */
  AG.widget('softmax', function (root) {
    var labels = ['cat', 'robot', 'agent', 'banana'], z = [1.0, 2.5, 2.0, -1.0], T = 1, right = 1;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'From scores to probabilities' }), h('span', { text: 'softmax(z)ᵢ = exp(zᵢ/T) / Σⱼ exp(zⱼ/T). Move the scores and the temperature.' })]));
    var grid = h('div', { class: 'w-grid2 even' }), left = h('div', { style: 'display:grid;gap:8px' }), right2 = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(left); grid.appendChild(right2); root.appendChild(grid);
    z.forEach(function (v, i) {
      var inp = h('input', { type: 'range', min: -4, max: 6, step: 0.1, value: v }), o = h('output', { text: v.toFixed(1) });
      inp.addEventListener('input', function () { z[i] = +inp.value; o.textContent = z[i].toFixed(1); draw(); });
      left.appendChild(h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['score (logit) for "' + labels[i] + '"', o]), inp]));
    });
    var ti = h('input', { type: 'range', min: 0.1, max: 4, step: 0.05, value: 1 }), to = h('output', { text: '1.00' });
    ti.addEventListener('input', function () { T = +ti.value; to.textContent = T.toFixed(2); draw(); });
    left.appendChild(h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['temperature T', to]), ti]));
    var rsel = h('select', { 'aria-label': 'Correct answer' }); labels.forEach(function (l, i) { var op = h('option', { value: i, text: 'correct answer: ' + l }); if (i === right) op.selected = true; rsel.appendChild(op); });
    rsel.addEventListener('change', function () { right = +rsel.value; draw(); });
    left.appendChild(rsel);
    var bars = h('div', { class: 'bar-list' }), ro = h('div', { class: 'readout' });
    right2.appendChild(bars); right2.appendChild(ro);
    function draw() {
      var mx = Math.max.apply(null, z), ex = z.map(function (v) { return Math.exp((v - mx) / T); }), Z = ex.reduce(function (a, b) { return a + b; }, 0), p = ex.map(function (e) { return e / Z; });
      bars.innerHTML = '';
      labels.forEach(function (l, i) { bars.appendChild(h('div', { class: 'br' + (i === right ? ' pick' : '') }, [h('span', { text: l }), h('div', null, [h('i', { style: 'width:' + Math.max(.5, p[i] * 100) + '%' })]), h('span', { text: (p[i] * 100).toFixed(1) + '%' })])); });
      ro.innerHTML = '';
      [[(-Math.log(p[right])).toFixed(3), 'cross-entropy loss −log P(correct)'], [p.reduce(function (a, b) { return a + b; }, 0).toFixed(3), 'Σ probabilities']].forEach(function (x) { ro.appendChild(h('div', null, [h('b', { text: x[0] }), h('span', { text: x[1] })])); });
    }
    draw();
  });

  /* ================================================================ gradient descent */
  var FUNS = {
    bowl: { name: 'Bowl: f(x) = x²', f: function (x) { return x * x; }, d: function (x) { return 2 * x; }, x0: 2.6, range: [-3, 3] },
    wavy: { name: 'Bumpy: f(x) = x² + 1.5 sin(3x)', f: function (x) { return x * x + 1.5 * Math.sin(3 * x); }, d: function (x) { return 2 * x + 4.5 * Math.cos(3 * x); }, x0: 2.6, range: [-3, 3] },
  };
  AG.widget('descent', function (root) {
    var fn = 'bowl', lr = 0.1, x, path, timer = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Gradient descent, one step at a time' }), h('span', { text: 'x ← x − η · f′(x). Click the curve to move the starting point.' })]));
    var pick = h('select', { 'aria-label': 'Function' }); Object.keys(FUNS).forEach(function (k) { pick.appendChild(h('option', { value: k, text: FUNS[k].name })); });
    var li = h('input', { type: 'range', min: 0.01, max: 1.1, step: 0.01, value: lr }), lo = h('output', { text: lr.toFixed(2) });
    li.addEventListener('input', function () { lr = +li.value; lo.textContent = lr.toFixed(2); reset(); });
    var bStep = h('button', { type: 'button', text: 'Step' }), bRun = h('button', { type: 'button', class: 'primary', text: 'Run 30 steps' });
    root.appendChild(h('div', { class: 'w-row' }, [pick, h('label', { class: 'ctl', style: 'min-width:200px' }, [h('span', { class: 'row' }, ['learning rate η', lo]), li]), bStep, bRun]));
    var st = h('div', { class: 'w-stage' }); root.appendChild(st);
    var C = AG.canvas(st, 0.42, function () { draw(); });
    var note = h('p', { class: 'w-note' }); root.appendChild(note);
    function F() { return FUNS[fn]; }
    function reset(x0) { if (timer) { clearInterval(timer); timer = null; } x = x0 != null ? x0 : F().x0; path = [x]; draw(); }
    function step() { var g = F().d(x); x = x - lr * g; path.push(x); draw(); }
    function draw() {
      var ctx = C.ctx, W = C.W, H = C.H, R = F().range, ys = [], k;
      for (k = 0; k <= 200; k++) ys.push(F().f(R[0] + (R[1] - R[0]) * k / 200));
      var lo2 = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      function X(v) { return 20 + (W - 40) * (v - R[0]) / (R[1] - R[0]); } function Y(v) { return H - 16 - (H - 32) * (v - lo2) / (hi - lo2); }
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = AG.css('--ink'); ctx.lineWidth = 2; ctx.beginPath();
      ys.forEach(function (v, i) { var xx = R[0] + (R[1] - R[0]) * i / 200; if (i) ctx.lineTo(X(xx), Y(v)); else ctx.moveTo(X(xx), Y(v)); }); ctx.stroke();
      ctx.strokeStyle = AG.css('--warm'); ctx.lineWidth = 1.5; ctx.beginPath();
      path.forEach(function (p, i) { var cx = X(AG.clamp(p, R[0], R[1])), cy = Y(F().f(AG.clamp(p, R[0], R[1]))); if (i) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy); }); ctx.stroke();
      path.forEach(function (p, i) { if (p < R[0] || p > R[1]) return; ctx.fillStyle = i === path.length - 1 ? AG.css('--accent') : AG.css('--warm'); ctx.beginPath(); ctx.arc(X(p), Y(F().f(p)), i === path.length - 1 ? 8 : 3.5, 0, 7); ctx.fill(); });
      var out = x < R[0] || x > R[1] || !isFinite(x);
      note.innerHTML = 'Step ' + (path.length - 1) + ': x = ' + (isFinite(x) ? x.toFixed(4) : '∞') + ', f(x) = ' + (isFinite(x) ? F().f(x).toFixed(4) : '∞') + '. ' +
        (out ? '<b style="color:var(--bad)">Diverged: the steps overshoot and grow.</b> Lower η.' : lr > 0.9 && fn === 'bowl' ? 'With η near 1 on this bowl the step overshoots to the other side every time.' : fn === 'wavy' ? 'Bumpy functions have local minima: where you end up depends on where you start and on η.' : 'Each step moves against the slope; the steps shrink as the slope flattens.');
    }
    C.cv.addEventListener('click', function (ev) { var p = AG.pos(C.cv, ev), R = F().range; reset(R[0] + (R[1] - R[0]) * (p.x - 20) / (C.W - 40)); });
    pick.addEventListener('change', function () { fn = pick.value; reset(); });
    bStep.addEventListener('click', step);
    bRun.addEventListener('click', function () { if (timer) return; var n = 0; timer = setInterval(function () { step(); if (++n >= 30 || !isFinite(x) || Math.abs(x) > 50) { clearInterval(timer); timer = null; } }, AG.reduce ? 10 : 120); });
    reset();
  });

  /* ================================================================ anatomy of an API call */
  AG.widget('httpbuilder', function (root) {
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Build a Claude API request' }), h('span', { text: 'Change the fields; watch the HTTP request and an example response update.' })]));
    var model = h('select', { 'aria-label': 'Model' }); ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'].forEach(function (m) { model.appendChild(h('option', { value: m, text: m })); });
    var sys = h('input', { type: 'text', value: 'You are a helpful robot assistant.', 'aria-label': 'System prompt', style: 'flex:1;min-width:200px' });
    var msg = h('input', { type: 'text', value: 'Is the path ahead clear?', 'aria-label': 'User message', style: 'flex:1;min-width:200px' });
    var tool = h('input', { type: 'checkbox', checked: true });
    root.appendChild(h('div', { class: 'w-row' }, [model, h('label', { class: 'w-note' }, [tool, ' give it a read_distance tool'])]));
    root.appendChild(h('div', { class: 'w-row' }, [h('span', { class: 'w-lab', text: 'system' }), sys]));
    root.appendChild(h('div', { class: 'w-row' }, [h('span', { class: 'w-lab', text: 'user' }), msg]));
    var grid = h('div', { class: 'w-grid2 even' }), req = h('div', { class: 'code', 'data-lang': 'json' }, [h('div', { class: 'code-head' }, [h('span', { class: 'fname', text: '→ request: what your program sends' })]), h('pre')]);
    var res = h('div', { class: 'code', 'data-lang': 'json' }, [h('div', { class: 'code-head' }, [h('span', { class: 'fname', text: '← example response (illustrative)' })]), h('pre')]);
    grid.appendChild(req); grid.appendChild(res); root.appendChild(grid);
    var note = h('p', { class: 'w-note' }); root.appendChild(note);
    function set(box, text) { box.querySelector('pre').innerHTML = text.split('\n').map(function (l, i) { return '<span class="ln" data-n="' + (i + 1) + '">' + AG.highlight(l, 'json') + '</span>'; }).join(''); }
    function draw() {
      var body = { model: model.value, max_tokens: 1024, system: sys.value, messages: [{ role: 'user', content: msg.value }] };
      if (tool.checked) body.tools = [{ name: 'read_distance', description: 'Measure the distance in cm to the nearest object straight ahead.', input_schema: { type: 'object', properties: {} } }];
      set(req, 'POST https://api.anthropic.com/v1/messages\nx-api-key: $ANTHROPIC_API_KEY\nanthropic-version: 2026-10-21\ncontent-type: application/json\n\n' + JSON.stringify(body, null, 2));
      var content = tool.checked ? [{ type: 'text', text: 'Let me measure.' }, { type: 'tool_use', id: 'toolu_01A…', name: 'read_distance', input: {} }] : [{ type: 'text', text: 'I can\'t sense anything without a sensor tool, so I can\'t tell.' }];
      set(res, 'HTTP/1.1 200 OK\ncontent-type: application/json\n\n' + JSON.stringify({ id: 'msg_01…', type: 'message', role: 'assistant', model: model.value, content: content, stop_reason: tool.checked ? 'tool_use' : 'end_turn', usage: { input_tokens: tool.checked ? 412 : 31, output_tokens: tool.checked ? 38 : 24 } }, null, 2));
      note.innerHTML = tool.checked ? '<b>stop_reason: "tool_use"</b> means the model wants your program to run <code>read_distance</code> and send the result back in the next request. That loop is lesson 07.' : 'Without a tool the model can only answer from what it already knows. The API keeps no memory: the next request must resend the conversation.';
    }
    [model, sys, msg, tool].forEach(function (e) { e.addEventListener('input', draw); e.addEventListener('change', draw); });
    draw();
  });
})();
