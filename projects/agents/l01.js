/* Lesson 01 widgets: agentfig, tablesize, vacuum, peas */
(function () {
  'use strict';
  var h = AG.h, s = AG.s;

  /* ---------------------------------------------------------------- agentfig
     The agent / environment diagram, relabeled for several agents, with percepts and actions flowing. */
  var FIG = {
    vacuum: { name: 'Robot vacuum', env: 'Two squares, dirt', sens: 'location + dirt sensor', act: 'wheels, suction', p: '[A, Dirty]', a: 'Suck' },
    taxi: { name: 'Automated taxi', env: 'Roads, traffic, people', sens: 'cameras, radar, GPS', act: 'steering, brake, throttle', p: 'car ahead braking', a: 'brake' },
    claude: { name: 'Claude Code', env: 'Your repository, terminal, you', sens: 'tool results, your messages', act: 'tool calls, replies', p: '"3 tests failed"', a: 'read_file("calc.py")' },
    robot: { name: 'Wheeled robot', env: 'A room with obstacles', sens: 'ultrasonic range', act: 'two DC motors', p: 'distance = 23 cm', a: 'turn(90)' },
  };
  AG.widget('agentfig', function (root) {
    var sel = 'vacuum';
    var head = h('div', { class: 'w-title' }, [h('b', { text: 'The agent and its environment' }), h('span', { text: 'Percepts flow in through sensors, actions flow out through actuators. Pick an agent:' })]);
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Example agent' });
    Object.keys(FIG).forEach(function (k) {
      var b = h('button', { type: 'button', text: FIG[k].name, 'aria-pressed': String(k === sel) });
      b.addEventListener('click', function () { sel = k; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); draw(); });
      seg.appendChild(b);
    });
    var svg = s('svg', { viewBox: '0 0 720 300', role: 'img', 'aria-label': 'Diagram: agent with sensors and actuators exchanging percepts and actions with the environment' });
    var stage = h('div', { class: 'w-stage' }, [svg]);
    root.appendChild(head); root.appendChild(seg); root.appendChild(stage);
    var dots = [];
    function fit(el, w) { el.setAttribute('font-size', '10.5'); if (el.getComputedTextLength && el.getComputedTextLength() > w) { el.setAttribute('textLength', w); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } }
    function txt(x, y, t, cls, anchor) { var e = s('text', { x: x, y: y, class: cls || 'svg-text', 'text-anchor': anchor || 'middle' }); e.textContent = t; svg.appendChild(e); return e; }
    function draw() {
      var f = FIG[sel];
      svg.innerHTML = '';
      var acc = AG.css('--accent'), env = AG.css('--env'), warm = AG.css('--warm'), ink = AG.css('--ink'), line = AG.css('--line'), surf = AG.css('--surface');
      // environment
      svg.appendChild(s('rect', { x: 470, y: 30, width: 230, height: 240, rx: 30, fill: AG.css('--env-soft'), stroke: env, 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
      txt(585, 62, 'Environment', 'svg-text').setAttribute('font-weight', '700');
      txt(585, 150, f.env, 'svg-muted');
      // agent box
      svg.appendChild(s('rect', { x: 20, y: 30, width: 300, height: 240, rx: 16, fill: surf, stroke: acc, 'stroke-width': 2 }));
      var t = txt(170, 58, 'Agent: ' + f.name); t.setAttribute('font-weight', '700');
      svg.appendChild(s('rect', { x: 176, y: 80, width: 134, height: 48, rx: 9, fill: AG.css('--accent-soft'), stroke: acc }));
      txt(243, 100, 'Sensors'); fit(txt(243, 118, f.sens, 'svg-muted'), 124);
      svg.appendChild(s('rect', { x: 176, y: 184, width: 134, height: 48, rx: 9, fill: AG.css('--warm-soft'), stroke: warm }));
      txt(243, 204, 'Actuators'); fit(txt(243, 222, f.act, 'svg-muted'), 124);
      svg.appendChild(s('rect', { x: 40, y: 120, width: 120, height: 64, rx: 10, fill: 'none', stroke: ink, 'stroke-dasharray': '4 4' }));
      var q = txt(100, 160, '?'); q.setAttribute('font-size', '30'); q.setAttribute('font-weight', '700'); q.setAttribute('fill', acc);
      txt(100, 202, 'agent program', 'svg-muted');
      // arrows
      var defs = s('defs');
      [['ah', ink]].forEach(function (d) {
        var m = s('marker', { id: d[0], viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
        m.appendChild(s('path', { d: 'M0,0 L10,5 L0,10 z', fill: d[1] })); defs.appendChild(m);
      });
      svg.appendChild(defs);
      var pPath = 'M470,104 L310,104', aPath = 'M310,208 L470,208', in1 = 'M176,104 C165,104 165,125 160,135', out1 = 'M160,170 C165,190 165,208 176,208';
      [[pPath, acc], [aPath, warm], [in1, ink], [out1, ink]].forEach(function (p) { svg.appendChild(s('path', { d: p[0], fill: 'none', stroke: p[1], 'stroke-width': 2, 'marker-end': 'url(#ah)', opacity: .8 })); });
      txt(390, 92, 'percept', 'svg-muted'); txt(390, 196, 'action', 'svg-muted');
      var pl = txt(390, 126, f.p); pl.setAttribute('fill', acc); pl.setAttribute('font-family', 'ui-monospace, Menlo, monospace'); pl.setAttribute('font-size', '11');
      var al = txt(390, 232, f.a); al.setAttribute('fill', warm); al.setAttribute('font-family', 'ui-monospace, Menlo, monospace'); al.setAttribute('font-size', '11');
      dots = [[pPath, acc], [in1, ink], [out1, ink], [aPath, warm]].map(function (p, i) {
        var path = s('path', { d: p[0] }), c = s('circle', { r: 5, fill: p[1] });
        svg.appendChild(c);
        return { path: path, c: c, off: i * 0.25 };
      });
      void line;
    }
    draw();
    AG.onTheme(draw);
    if (AG.reduce) return;
    var t0 = performance.now();
    (function anim(now) {
      var T = ((now - t0) / 2600) % 1;
      dots.forEach(function (d) {
        var u = (T - d.off + 1) % 1;
        var visible = u < 0.25;
        d.c.setAttribute('opacity', visible ? 1 : 0);
        if (visible) {
          var L = d.path.getTotalLength(), p = d.path.getPointAtLength(L * u / 0.25);
          d.c.setAttribute('cx', p.x); d.c.setAttribute('cy', p.y);
        }
      });
      requestAnimationFrame(anim);
    })(t0);
  });

  /* ---------------------------------------------------------------- tablesize */
  AG.widget('tablesize', function (root) {
    var P = h('input', { type: 'range', min: 2, max: 64, value: 4 });
    var T = h('input', { type: 'range', min: 1, max: 40, value: 10 });
    var pv = h('output'), tv = h('output'), out = h('div', { class: 'readout' });
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'How big is the agent function table?' }), h('span', { text: 'One row per possible percept sequence.' })]));
    root.appendChild(h('div', { class: 'w-row' }, [
      h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['Possible percepts P', pv]), P]),
      h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['Lifetime T (steps)', tv]), T])]));
    root.appendChild(out);
    var note = h('p', { class: 'w-note' }); root.appendChild(note);
    function fmt(x) { return x < 1e6 ? Math.round(x).toLocaleString() : x.toExponential(2).replace('e+', ' × 10^'); }
    function upd() {
      var p = +P.value, t = +T.value; pv.textContent = p; tv.textContent = t;
      var rows = 0, term = 1;
      for (var i = 1; i <= t; i++) { term *= p; rows += term; }
      var bytes = rows * 1;
      out.innerHTML = '';
      out.appendChild(h('div', null, [h('b', { text: fmt(rows) }), h('span', { text: 'rows' })]));
      out.appendChild(h('div', null, [h('b', { text: bytes < 1e9 ? fmt(bytes / 1e6) + ' MB' : fmt(bytes / 1e12) + ' TB' }), h('span', { text: 'at 1 byte per row' })]));
      note.innerHTML = rows > 1e80 ? '<b>More rows than atoms in the observable universe (~10^80).</b> No table-driven agent can exist; we need programs.' :
        rows > 1e12 ? 'Bigger than any computer memory. This is why agent programs, not tables.' :
          'Still manageable, but grows by a factor of P every extra step of life.';
    }
    P.addEventListener('input', upd); T.addEventListener('input', upd); upd();
  });

  /* ---------------------------------------------------------------- vacuum world */
  var ACTIONS = ['Left', 'Right', 'Suck', 'NoOp'];
  function makeAgent(kind, table, rnd) {
    if (kind === 'reflex') return function (p) { return p[1] === 'Dirty' ? 'Suck' : p[0] === 'A' ? 'Right' : 'Left'; };
    if (kind === 'model') {
      var m = { A: null, B: null };
      var f = function (p) {
        m[p[0]] = p[1];
        if (p[1] === 'Dirty') { m[p[0]] = 'Clean'; return 'Suck'; }
        if (m.A === 'Clean' && m.B === 'Clean') return 'NoOp';
        return p[0] === 'A' ? 'Right' : 'Left';
      };
      f.model = m; return f;
    }
    if (kind === 'random') return function () { return ACTIONS[Math.floor(rnd() * 4)]; };
    return function (p) { return table[p[0] + ',' + p[1]]; };
  }
  AG.widget('vacuum', function (root) {
    var st = { kind: 'reflex', table: { 'A,Clean': 'Right', 'A,Dirty': 'Suck', 'B,Clean': 'Left', 'B,Dirty': 'Suck' }, moveCost: false, dynamic: false };
    var base = { A: 'Dirty', B: 'Dirty', loc: 'A' }, world, agent, t, score, moves, hist, timer = null, rnd = AG.rng(1), anim = { x: 0, sucking: 0 };
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Vacuum world simulator' }), h('span', { text: 'Choose an agent program, then Step or Run. The score is +1 per clean square per step.' })]));
    var agentSel = h('div', { class: 'seg', role: 'group', 'aria-label': 'Agent program' });
    [['reflex', 'Simple reflex'], ['model', 'Model-based'], ['random', 'Random'], ['table', 'Your rule table']].forEach(function (a) {
      var b = h('button', { type: 'button', text: a[1], 'aria-pressed': String(a[0] === st.kind) });
      b.addEventListener('click', function () { st.kind = a[0]; [].forEach.call(agentSel.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); tableBox.hidden = a[0] !== 'table'; reset(true); });
      agentSel.appendChild(b);
    });
    root.appendChild(agentSel);
    // rule table editor
    var tableBox = h('div', { hidden: true });
    var tb = h('tbody');
    Object.keys(st.table).forEach(function (k) {
      var sel = h('select', { 'aria-label': 'Action for percept ' + k });
      ACTIONS.forEach(function (a) { var o = h('option', { value: a, text: a }); if (a === st.table[k]) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { st.table[k] = sel.value; reset(true); });
      tb.appendChild(h('tr', null, [h('td', null, [h('code', { text: '[' + k.replace(',', ', ') + ']' })]), h('td', null, [sel])]));
    });
    tableBox.appendChild(h('p', { class: 'w-note', html: 'This table <b>is</b> the agent function of a percept-only agent: one action per percept.' }));
    tableBox.appendChild(h('div', { class: 'table-wrap' }, [h('table', null, [h('thead', null, [h('tr', null, [h('th', { text: 'Percept' }), h('th', { text: 'Action' })])]), tb])]));
    root.appendChild(tableBox);

    var grid = h('div', { class: 'w-grid2' });
    var stage = h('div', { class: 'w-stage' });
    var right = h('div', { style: 'display:grid;gap:10px' });
    grid.appendChild(stage); grid.appendChild(right); root.appendChild(grid);
    var C = AG.canvas(stage, function (w) { return Math.max(190, Math.round(w * 0.42)); }, function () { draw(); });
    var readout = h('div', { class: 'readout' });
    var log = h('div', { class: 'log', 'aria-live': 'polite' });
    right.appendChild(readout); right.appendChild(log);
    var mem = h('p', { class: 'w-note' });
    right.appendChild(mem);

    var bStep = h('button', { type: 'button', class: 'primary', text: 'Step' });
    var bRun = h('button', { type: 'button', text: 'Run ▶' });
    var bReset = h('button', { type: 'button', text: 'New world' });
    var bEval = h('button', { type: 'button', text: 'Evaluate all 8 worlds' });
    var cMove = h('input', { type: 'checkbox' }), cDyn = h('input', { type: 'checkbox' });
    cMove.addEventListener('change', function () { st.moveCost = cMove.checked; reset(true); });
    cDyn.addEventListener('change', function () { st.dynamic = cDyn.checked; });
    root.appendChild(h('div', { class: 'w-row' }, [bStep, bRun, bReset, bEval,
      h('label', { class: 'w-note' }, [cMove, ' Moving costs 1 point']), h('label', { class: 'w-note' }, [cDyn, ' Dirt reappears (10%)'])]));
    var evalOut = h('div'); root.appendChild(evalOut);

    function reset(keepWorld) {
      stop();
      if (!keepWorld || !base) base = { A: rnd() < .5 ? 'Dirty' : 'Clean', B: rnd() < .5 ? 'Dirty' : 'Clean', loc: rnd() < .5 ? 'A' : 'B' };
      world = { A: base.A, B: base.B, loc: base.loc };
      agent = makeAgent(st.kind, st.table, AG.rng(7));
      t = 0; score = 0; moves = 0; hist = [];
      anim.x = world.loc === 'A' ? 0 : 1;
      log.innerHTML = '';
      line('dim', 'start: vacuum in ' + world.loc + ', A is ' + world.A + ', B is ' + world.B);
      upd(); draw();
    }
    function line(cls, text) { log.appendChild(h('div', { class: cls, text: text })); log.scrollTop = log.scrollHeight; }
    function step() {
      var p = [world.loc, world[world.loc]];
      var a = agent(p);
      hist.push(p);
      if (a === 'Suck') { world[world.loc] = 'Clean'; anim.sucking = 1; }
      else if (a === 'Right' || a === 'Left') {
        var to = a === 'Right' ? 'B' : 'A';
        moves++; if (st.moveCost) score -= 1;   // as in vacuum_world.py, every Left/Right costs
        world.loc = to;
      }
      if (st.dynamic) ['A', 'B'].forEach(function (k) { if (world[k] === 'Clean' && rnd() < 0.1) { world[k] = 'Dirty'; line('err', '   (dirt appeared in ' + k + ')'); } });
      var clean = (world.A === 'Clean') + (world.B === 'Clean');
      score += clean;
      line('', 't=' + t + '  percept [' + p.join(', ') + ']  →  ' + a + '   score ' + score);
      t++;
      upd(); animate();
    }
    function upd() {
      readout.innerHTML = '';
      [[t, 'time step'], [score, 'score'], [moves, 'moves'], [hist.length, 'percepts seen']].forEach(function (r) {
        readout.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })]));
      });
      if (st.kind === 'model' && agent.model) mem.innerHTML = 'Agent\'s internal model: A = <b>' + (agent.model.A || 'unknown') + '</b>, B = <b>' + (agent.model.B || 'unknown') + '</b>';
      else if (st.kind === 'reflex') mem.innerHTML = 'No memory: the agent only knows the current percept.';
      else if (st.kind === 'random') mem.innerHTML = 'Ignores its percepts completely.';
      else mem.innerHTML = 'Your table, applied to the current percept.';
    }
    function animate() {
      var target = world.loc === 'A' ? 0 : 1;
      if (AG.reduce) { anim.x = target; anim.sucking = 0; draw(); return; }
      var from = anim.x, t0 = performance.now();
      (function f(now) {
        var u = Math.min(1, (now - t0) / 380);
        anim.x = from + (target - from) * (1 - Math.pow(1 - u, 3));
        anim.sucking = Math.max(0, anim.sucking - 0.04);
        draw();
        if (u < 1 || anim.sucking > 0) requestAnimationFrame(f);
      })(t0);
    }
    function draw() {
      if (!world) return;
      var ctx = C.ctx, W = C.W, H = C.H;
      ctx.clearRect(0, 0, W, H);
      var pad = 14, sw = (W - pad * 3) / 2, sh = H - pad * 2 - 18;
      ['A', 'B'].forEach(function (k, i) {
        var x = pad + i * (sw + pad), y = pad;
        ctx.fillStyle = AG.css('--surface'); ctx.strokeStyle = AG.css('--line'); ctx.lineWidth = 1.5;
        AG.roundRect(ctx, x, y, sw, sh, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = AG.css('--muted'); ctx.font = '700 15px system-ui'; ctx.fillText(k, x + 12, y + 22);
        if (world[k] === 'Dirty') {
          var r = AG.rng(i + 3);
          for (var d = 0; d < 26; d++) {
            ctx.fillStyle = 'rgba(140,100,60,' + (0.35 + r() * 0.5) + ')';
            ctx.beginPath(); ctx.arc(x + sw * (0.15 + 0.7 * r()), y + sh * (0.55 + 0.35 * r()), 2 + r() * 5, 0, 7); ctx.fill();
          }
        }
        ctx.fillStyle = world[k] === 'Dirty' ? AG.css('--warm') : AG.css('--env');
        ctx.font = '600 12px system-ui'; ctx.fillText(world[k], x + sw - 52, y + 22);
      });
      // vacuum
      var cx = pad + sw / 2 + anim.x * (sw + pad), cy = pad + sh * 0.45, R = Math.min(34, sh * 0.22);
      if (anim.sucking > 0) {
        ctx.strokeStyle = AG.css('--accent'); ctx.globalAlpha = anim.sucking;
        for (var k2 = 0; k2 < 3; k2++) { ctx.beginPath(); ctx.arc(cx, cy, R + 8 + k2 * 9 * (1 - anim.sucking), 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.fillStyle = AG.css('--accent-ink'); ctx.beginPath(); ctx.arc(cx + R * 0.45, cy - R * 0.25, R * 0.16, 0, 7); ctx.fill();
      ctx.strokeStyle = AG.css('--accent-ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.fillStyle = AG.css('--muted'); ctx.font = '12px system-ui';
      ctx.fillText('percept: [' + world.loc + ', ' + world[world.loc] + ']', pad, H - 8);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; bRun.textContent = 'Run ▶'; } }
    bStep.addEventListener('click', function () { stop(); step(); });
    bRun.addEventListener('click', function () {
      if (timer) { stop(); return; }
      bRun.textContent = 'Pause ❚❚';
      timer = setInterval(function () { step(); if (t >= 40) stop(); }, AG.reduce ? 120 : 520);
    });
    bReset.addEventListener('click', function () { base = null; reset(); });
    bEval.addEventListener('click', function () {
      var rows = [['Simple reflex', 'reflex'], ['Model-based', 'model'], ['Your rule table', 'table'], ['Random (seeded)', 'random']];
      var tbody = h('tbody');
      rows.forEach(function (r) {
        var cells = [h('td', { text: r[0] })];
        [false, true].forEach(function (cost) {
          var tot = 0;
          ['Clean', 'Dirty'].forEach(function (a) { ['Clean', 'Dirty'].forEach(function (b) { ['A', 'B'].forEach(function (loc) {
            var w = { A: a, B: b, loc: loc }, ag = makeAgent(r[1], st.table, AG.rng(11)), sc = 0;
            for (var i = 0; i < 10; i++) {
              var act = ag([w.loc, w[w.loc]]);
              if (act === 'Suck') w[w.loc] = 'Clean';
              else if (act === 'Right' || act === 'Left') { w.loc = act === 'Right' ? 'B' : 'A'; if (cost) sc -= 1; }
              sc += (w.A === 'Clean') + (w.B === 'Clean');
            }
            tot += sc;
          }); }); });
          cells.push(h('td', null, [h('b', { text: (tot / 8).toFixed(2) })]));
        });
        tbody.appendChild(h('tr', null, cells));
      });
      evalOut.innerHTML = '';
      evalOut.appendChild(h('div', { class: 'table-wrap' }, [h('table', null, [h('thead', null, [h('tr', null, [h('th', { text: 'Agent (10 steps, all 8 start states)' }), h('th', { text: 'Average score' }), h('th', { text: 'Average, moving costs 1' })])]), tbody])]));
      evalOut.appendChild(h('p', { class: 'w-note', text: 'The reflex and model-based rows match vacuum_world.py exactly. The random agent uses a different random generator here, so its number differs a little from the Python one.' }));
    });
    reset(true);
  });

  /* ---------------------------------------------------------------- PEAS explorer */
  var DIMS = [
    ['obs', 'Observable', ['fully', 'partially']],
    ['agents', 'Agents', ['single', 'multi']],
    ['det', 'Deterministic?', ['deterministic', 'stochastic']],
    ['epi', 'Episodic?', ['episodic', 'sequential']],
    ['dyn', 'Static?', ['static', 'semidynamic', 'dynamic']],
    ['disc', 'Discrete?', ['discrete', 'continuous']],
    ['known', 'Rules', ['known', 'unknown']],
  ];
  var PEAS = [
    { name: 'Automated taxi', src: 'AIMA Fig. 2.4', P: 'Safe, fast, legal, comfortable trip; maximize profits; minimize impact on other road users', E: 'Roads, other traffic, police, pedestrians, customers, weather', A: 'Steering, accelerator, brake, signal, horn, display, speech', S: 'Cameras, radar, lidar, speedometer, GPS, engine sensors, accelerometer, microphones, touchscreen',
      ans: { obs: 'partially', agents: 'multi', det: 'stochastic', epi: 'sequential', dyn: 'dynamic', disc: 'continuous', known: 'known' },
      why: 'Other drivers are agents with their own goals; you cannot see around corners; tires slip; every action affects the future; the world moves while you think.' },
    { name: 'Robot vacuum', src: '', P: 'Fraction of floor cleaned, time, battery used, nothing knocked over', E: 'Rooms, furniture, rugs, cables, pets, people', A: 'Wheels, brushes, suction, docking', S: 'Bump and cliff sensors, dirt sensor, wheel encoders, camera or lidar',
      ans: { obs: 'partially', agents: 'single', det: 'stochastic', epi: 'sequential', dyn: 'dynamic', disc: 'continuous', known: 'known' },
      why: 'It sees only nearby; wheels slip; people and pets move things (you can argue "multi" if pets count as agents).' },
    { name: 'Claude Code (coding agent)', src: 'lesson 07', P: 'Task done correctly, tests pass, the user is satisfied, no harmful or irreversible actions, low cost and time', E: 'A code repository, terminal and operating system, the user, sometimes the web', A: 'Tool calls: read, edit and create files, run commands; text messages to the user', S: 'Tool results (file contents, command output, errors) and the user\'s messages',
      ans: { obs: 'partially', agents: 'multi', det: 'deterministic', epi: 'sequential', dyn: 'static', disc: 'discrete', known: 'known' },
      why: 'It only knows the files it has read (partially observable). The user is a second, cooperative agent. Commands are mostly deterministic (flaky tests are the exception) and the repo usually does not change while it thinks. Everything is text, so discrete.' },
    { name: 'Microscope autofocus agent', src: 'lesson 08', P: 'Sharp images of every target, short time, the objective never touches the sample', E: 'Sample on a motorized stage, optics, illumination', A: 'Stage motors (x, y), focus drive (z), camera trigger', S: 'Camera images, stage encoders, limit switches',
      ans: { obs: 'partially', agents: 'single', det: 'stochastic', epi: 'sequential', dyn: 'static', disc: 'continuous', known: 'known' },
      why: 'Image noise makes it stochastic; you only learn focus quality by taking images; positions are continuous. The sample may drift slowly, so some would say dynamic.' },
    { name: 'Chess with a clock', src: 'AIMA Fig. 2.6', P: 'Win, draw, lose', E: 'Board, opponent, clock', A: 'Moves', S: 'Board state, clock',
      ans: { obs: 'fully', agents: 'multi', det: 'deterministic', epi: 'sequential', dyn: 'semidynamic', disc: 'discrete', known: 'known' },
      why: 'The board does not change while you think, but your clock does: semidynamic. The opponent makes it multiagent (competitive).' },
    { name: 'Image classifier', src: 'AIMA Fig. 2.6 (image analysis)', P: 'Fraction of images labeled correctly', E: 'A stream of images', A: 'Output a label', S: 'Pixels of the current image',
      ans: { obs: 'fully', agents: 'single', det: 'deterministic', epi: 'episodic', dyn: 'semidynamic', disc: 'continuous', known: 'known' },
      why: 'Each image is its own episode: labeling one does not change the next. AIMA lists image analysis as semidynamic.' },
    { name: 'Crossword puzzle', src: 'AIMA Fig. 2.6', P: 'Correct, complete grid', E: 'Grid and clues', A: 'Write letters', S: 'The grid and clues',
      ans: { obs: 'fully', agents: 'single', det: 'deterministic', epi: 'sequential', dyn: 'static', disc: 'discrete', known: 'known' },
      why: 'The easiest kind of environment on every dimension except that choices interact (sequential).' },
  ];
  AG.widget('peas', function (root) {
    var cur = 0, guess = {};
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'PEAS and environment-type explorer' }), h('span', { text: 'Pick an agent, read its PEAS, then classify its environment yourself and check.' })]));
    var pick = h('select', { 'aria-label': 'Agent' });
    PEAS.forEach(function (p, i) { pick.appendChild(h('option', { value: i, text: p.name })); });
    root.appendChild(h('div', { class: 'w-row' }, [pick]));
    var cards = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px' });
    root.appendChild(cards);
    var dimsBox = h('div', { style: 'display:grid;gap:8px' });
    root.appendChild(dimsBox);
    var check = h('button', { type: 'button', class: 'primary', text: 'Check my classification' });
    var reveal = h('button', { type: 'button', text: 'Show the answer' });
    var res = h('p', { class: 'w-note' });
    root.appendChild(h('div', { class: 'w-row' }, [check, reveal]));
    root.appendChild(res);
    function draw() {
      var p = PEAS[cur]; guess = {}; res.innerHTML = '';
      cards.innerHTML = '';
      [['P', 'Performance', p.P, '--accent'], ['E', 'Environment', p.E, '--env'], ['A', 'Actuators', p.A, '--warm'], ['S', 'Sensors', p.S, '--info']].forEach(function (c) {
        cards.appendChild(h('div', { style: 'border:1px solid var(--line);border-top:4px solid var(' + c[3] + ');border-radius:10px;padding:10px 12px;background:var(--page)' },
          [h('div', { class: 'w-lab', text: c[0] + ' · ' + c[1] }), h('p', { style: 'font-size:14px;margin-top:4px', text: c[2] })]));
      });
      if (p.src) cards.appendChild(h('p', { class: 'w-note', text: 'Source: ' + p.src }));
      dimsBox.innerHTML = '';
      DIMS.forEach(function (d) {
        var seg = h('div', { class: 'seg', role: 'group', 'aria-label': d[1] });
        d[2].forEach(function (v) {
          var b = h('button', { type: 'button', class: 'small', text: v, 'aria-pressed': 'false', 'data-v': v });
          b.addEventListener('click', function () { guess[d[0]] = v; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); c.style.outline = ''; }); });
          seg.appendChild(b);
        });
        dimsBox.appendChild(h('div', { class: 'w-row' }, [h('span', { class: 'w-lab', style: 'min-width:120px', text: d[1] }), seg]));
      });
    }
    function mark(showAll) {
      var p = PEAS[cur], right = 0;
      dimsBox.querySelectorAll('.seg').forEach(function (seg, i) {
        var d = DIMS[i], want = p.ans[d[0]];
        [].forEach.call(seg.children, function (b) {
          var v = b.getAttribute('data-v');
          b.style.outline = '';
          if (v === want && (showAll || guess[d[0]])) b.style.outline = '2px solid var(--env)';
          if (guess[d[0]] === v && v !== want) b.style.outline = '2px solid var(--bad)';
          if (showAll && v === want) b.setAttribute('aria-pressed', 'true');
        });
        if (guess[d[0]] === want) right++;
      });
      res.innerHTML = (showAll ? '' : '<b>' + right + ' of 7</b> match the usual classification. ') + p.why;
    }
    check.addEventListener('click', function () { mark(false); });
    reveal.addEventListener('click', function () { mark(true); });
    pick.addEventListener('change', function () { cur = +pick.value; draw(); });
    draw();
  });
})();
