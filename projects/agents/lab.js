/* Agent Lab: write an agent program in Python, run it against an environment (in the browser, Pyodide),
   watch the replay, and pass graded levels. Level files live in lab/levels/ (harness, starter, solution). */
(function () {
  'use strict';
  var h = AG.h;
  var LEVELS = [
    { id: 'vacuum', title: 'Vacuum', harness: 'level1_vacuum.py', argv: ['0', '19'], start: 'l1_start.py', sol: 'l1_solution.py', viz: 'vacuum', lesson: '01-agents-and-environments',
      brief: '<p><b>Goal:</b> average score ≥ 19 over the 8 possible start states, 10 steps each. +1 per clean square per step.</p><p><b>Percept:</b> <code>(location, status)</code>, e.g. <code>("A", "Dirty")</code>. <b>Actions:</b> <code>"Left"</code>, <code>"Right"</code>, <code>"Suck"</code>, <code>"NoOp"</code>.</p>',
      hints: ['If the square is dirty, what should a rational vacuum do?', 'If it is clean, go to the other square.', 'This is the book\'s REFLEX-VACUUM-AGENT, Figure 2.8.'] },
    { id: 'vacuum2', title: 'Moving costs', harness: 'level1_vacuum.py', argv: ['1', '18'], start: 'l2_start.py', sol: 'l2_solution.py', viz: 'vacuum', lesson: '02-agent-programs',
      brief: '<p><b>Goal:</b> average ≥ 18 when every <code>Left</code>/<code>Right</code> costs 1 point. The reflex agent scores 10.25: it never stops moving.</p><p><b>Trick:</b> variables at the top of your file keep their values between calls (and are reset for each new episode).</p>',
      hints: ['Keep a dictionary model = {"A": None, "B": None}.', 'Update it from each percept, and after Suck the square is Clean.', 'When both are known to be clean, return "NoOp".'] },
    { id: 'maze', title: 'Maze', harness: 'level3_maze.py', argv: [], start: 'l3_start.py', sol: 'l3_solution.py', viz: 'maze', lesson: '03-search',
      brief: '<p><b>Goal:</b> escape 5 different 7×7 mazes within 250 moves each. You start top-left; the goal is bottom-right.</p><p><b>Percept:</b> <code>{"pos": (x, y), "goal": (gx, gy), "walls": {"N": bool, "E": bool, "S": bool, "W": bool}}</code>, y grows downward. <b>Actions:</b> <code>"N"</code>, <code>"E"</code>, <code>"S"</code>, <code>"W"</code>.</p>',
      hints: ['A random walk wastes moves revisiting squares. Keep a set of visited squares.', 'Depth-first search: go to an unvisited open neighbor; at a dead end, go back the way you came (keep a stack of moves).', 'Try neighbors that are closer to the goal first: a heuristic!'] },
    { id: 'apartment', title: 'Apartment', harness: 'level4_apartment.py', argv: [], start: 'l4_start.py', sol: 'l4_solution.py', viz: 'apartment', extra: ['agent_zoo.py'], lesson: '02-agent-programs',
      brief: '<p><b>Goal:</b> average score ≥ 150 over 10 apartments: +10 per dirt, −50 if the battery dies away from the dock (100 units; each move or suck costs 1).</p><p><b>Percept:</b> <code>{"dirty", "walls": {...}, "dock", "battery"}</code>. <b>Actions:</b> <code>"N" "E" "S" "W" "Suck" "Dock" "NoOp"</code>.</p>',
      hints: ['Track your own position (start at (0, 0) = the dock) and a map of squares you know are free.', 'Use breadth-first search to plan to the nearest unexplored square.', 'Before each trip, check that you can still get back to the dock; recharge with "Dock".'] },
    { id: 'wumpus', title: 'Wumpus', harness: 'level5_wumpus.py', argv: [], start: 'l5_start.py', sol: 'l5_solution.py', viz: 'wumpus', lesson: '04-knowledge',
      brief: '<p><b>Goal:</b> average score ≥ 300 over 30 caves. +1000 for climbing out of [1,1] with the gold, −1000 for dying, −1 per action. Some caves are impossible: climbing out empty-handed is fine.</p><p><b>Percept:</b> <code>{"pos", "breeze", "stench", "glitter", "has_gold"}</code>. <b>Actions:</b> <code>"N" "E" "S" "W" "Grab" "Climb"</code>.</p>',
      hints: ['Remember the breeze and stench you felt in every visited room.', 'A room is safe if no possible placement of pits and wumpus consistent with your percepts puts danger there (model checking, lesson 04).', 'If nothing is provably safe, go home and Climb: −20 beats −1000.'] },
    { id: 'robot', title: 'Blind robot', harness: 'level6_robot.py', argv: [], start: 'l6_start.py', sol: 'l6_solution.py', viz: 'robot', extra: ['robot_agent.py'], lesson: '09-build-a-robot',
      brief: '<p><b>Goal:</b> cover ≥ 45% of a 2 × 2 m floor in 60 actions with a robot that only measures the distance straight ahead.</p><p><b>Percept:</b> <code>{"distance": cm, "last": "..."}</code>. <b>Actions:</b> <code>("drive", cm)</code> (±100), <code>("turn", degrees)</code> (±180, + = left), <code>("stop",)</code>. The body refuses drives that would hit something.</p>',
      hints: ['Drive while the distance is large, leaving a margin.', 'At a wall: turn 90°, move sideways a little, turn 90° again: a lawn-mower pattern.', 'Alternate the turning direction on each pass.'] },
    { id: 'tools', title: 'Tools for Claude', harness: 'level7_tools.py', argv: [], start: 'l7_start.py', sol: 'l7_solution.py', viz: 'tools', lesson: '07-llm-agents',
      brief: '<p><b>Goal:</b> write Python tools that let Claude bring every greenhouse room to 20–24 °C. Every public function becomes a tool: its docstring is the description and its type hints are the schema.</p><p>Test your tools by hand below, then (with your API key) let Claude use them. The level passes when the greenhouse check succeeds after a Claude run.</p>',
      hints: ['Press "Inspect tools" to see exactly what Claude will receive.', 'A read_all_temperatures() tool saves Claude many calls (and time passes with every reading).', 'Make set_heater refuse unsafe requests with a clear message.'] },
  ];
  var cache = {};
  function fetchText(path) { if (!cache[path]) cache[path] = fetch(path).then(function (r) { if (!r.ok) throw new Error(path + ' ' + r.status); return r.text(); }); return cache[path]; }
  function store() { return AG.store('lab') || { passed: {}, code: {} }; }
  function save(s) { AG.store('lab', s); }

  function confetti() {
    if (AG.reduce) return;
    var c = h('canvas', { style: 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:150' }); document.body.appendChild(c);
    var ctx = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight, parts = [], t0 = performance.now();
    for (var i = 0; i < 140; i++) parts.push({ x: W / 2 + (Math.random() - .5) * 200, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, c: ['#7c5cff', '#13b7a0', '#ff8a3d', '#2a78d6', '#e2559b', '#f2b233'][i % 6], r: Math.random() * 6 + 3, a: Math.random() * 6 });
    (function f(now) {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore(); });
      if (now - t0 < 2200) requestAnimationFrame(f); else c.remove();
    })(t0);
  }

  /* ---------------------------------------------------------------- replay renderers */
  var VIZ = {
    vacuum: function (ctx, W, H, fr, k) {
      var f = fr[Math.max(0, k - 1)] || { A: 'Dirty', B: 'Dirty', loc: 'A', score: 0 }, start = k === 0;
      var st = start ? { A: 'Dirty', B: 'Dirty', loc: 'A' } : f, pad = 14, sw = (W - 3 * pad) / 2, sh = H - 2 * pad - 20;
      ['A', 'B'].forEach(function (s, i) {
        var x = pad + i * (sw + pad);
        ctx.fillStyle = AG.css('--surface'); ctx.strokeStyle = AG.css('--line'); AG.roundRect(ctx, x, pad, sw, sh, 12); ctx.fill(); ctx.stroke();
        if (st[s] === 'Dirty') { var r = AG.rng(i + 4); for (var d = 0; d < 22; d++) { ctx.fillStyle = 'rgba(140,100,60,.6)'; ctx.beginPath(); ctx.arc(x + sw * (.15 + .7 * r()), pad + sh * (.5 + .4 * r()), 2 + r() * 4, 0, 7); ctx.fill(); } }
        ctx.fillStyle = AG.css('--muted'); ctx.font = '700 14px system-ui'; ctx.fillText(s + ' · ' + st[s], x + 10, pad + 20);
      });
      var bx = pad + (st.loc === 'A' ? 0 : sw + pad) + sw / 2;
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc(bx, pad + sh * .42, Math.min(28, sh * .2), 0, 7); ctx.fill();
      ctx.fillStyle = AG.css('--ink'); ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.fillText(start ? 'start' : 't=' + (k - 1) + '  [' + f.percept.join(', ') + '] → ' + f.act + '   score ' + f.score, pad, H - 8);
    },
    maze: function (ctx, W, H, fr, k, res) {
      var n = res.n, cs = Math.min(W, H) / (n + .5), ox = (W - cs * n) / 2, oy = (H - cs * n) / 2, open = {};
      (res.maze || []).forEach(function (p) { open[p[0].join(',') + '|' + p[1].join(',')] = open[p[1].join(',') + '|' + p[0].join(',')] = 1; });
      ctx.fillStyle = AG.css('--surface'); ctx.fillRect(ox, oy, cs * n, cs * n);
      ctx.fillStyle = 'rgba(15,157,118,.35)'; ctx.fillRect(ox + (n - 1) * cs, oy + (n - 1) * cs, cs, cs);
      ctx.strokeStyle = AG.css('--ink'); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (var x = 0; x < n; x++) for (var y = 0; y < n; y++) {
        [[1, 0], [0, 1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1]; if (nx >= n || ny >= n) return;
          if (!open[x + ',' + y + '|' + nx + ',' + ny]) { ctx.beginPath(); if (d[0]) { ctx.moveTo(ox + nx * cs, oy + y * cs); ctx.lineTo(ox + nx * cs, oy + (y + 1) * cs); } else { ctx.moveTo(ox + x * cs, oy + ny * cs); ctx.lineTo(ox + (x + 1) * cs, oy + ny * cs); } ctx.stroke(); }
        });
      }
      ctx.strokeRect(ox, oy, cs * n, cs * n);
      ctx.strokeStyle = AG.css('--accent'); ctx.globalAlpha = .55; ctx.lineWidth = Math.max(3, cs * .18); ctx.beginPath();
      fr.slice(0, k + 1).forEach(function (p, i) { var px = ox + (p[0] + .5) * cs, py = oy + (p[1] + .5) * cs; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.globalAlpha = 1;
      var p = fr[Math.min(k, fr.length - 1)]; ctx.fillStyle = AG.css('--warm'); ctx.beginPath(); ctx.arc(ox + (p[0] + .5) * cs, oy + (p[1] + .5) * cs, cs * .28, 0, 7); ctx.fill();
      ctx.fillStyle = AG.css('--ink'); ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.fillText('maze #1 · move ' + k + ' of ' + (fr.length - 1), 6, H - 6);
    },
    apartment: function (ctx, W, H, fr, k) {
      var map = fr.map, cs = Math.min(W / 14, (H - 18) / 9), dirt = {}, dock = null;
      fr.dirt.forEach(function (d) { dirt[d[0] + ',' + d[1]] = 1; });
      map.forEach(function (row, y) { row.split('').forEach(function (ch, x) { if (ch === 'D') dock = [x, y]; }); });
      var pos = dock;
      for (var i = 0; i < k && i < fr.steps.length; i++) { var s = fr.steps[i]; if (s[4] === 'Suck') delete dirt[(pos[0]) + ',' + (pos[1])]; pos = [s[0], s[1]]; }
      map.forEach(function (row, y) { row.split('').forEach(function (ch, x) {
        ctx.fillStyle = ch === '#' ? (AG.isDark() ? '#3a3a38' : '#3d3c37') : AG.css('--surface'); ctx.fillRect(x * cs, y * cs, cs, cs);
        ctx.strokeStyle = AG.css('--line-2'); ctx.strokeRect(x * cs + .5, y * cs + .5, cs - 1, cs - 1);
        if (dirt[x + ',' + y]) { ctx.fillStyle = 'rgba(140,100,60,.7)'; ctx.beginPath(); ctx.arc((x + .5) * cs, (y + .5) * cs, cs * .18, 0, 7); ctx.fill(); }
      }); });
      ctx.fillStyle = AG.css('--env'); ctx.font = '700 ' + Math.round(cs * .5) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚡', (dock[0] + .5) * cs, (dock[1] + .7) * cs); ctx.textAlign = 'left';
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc((pos[0] + .5) * cs, (pos[1] + .5) * cs, cs * .33, 0, 7); ctx.fill();
      var st = fr.steps[Math.max(0, Math.min(k, fr.steps.length) - 1)] || [0, 0, 100, 0, ''];
      ctx.fillStyle = AG.css('--ink'); ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.fillText('apartment #1 · step ' + k + ' · battery ' + (k ? st[2] : 100) + ' · score ' + (k ? st[3] : 0), 4, H - 4);
    },
    wumpus: function (ctx, W, H, fr, k) {
      var cs = Math.min(W, H - 18) / 4, ox = (W - cs * 4) / 2, pos = [1, 1], visited = { '1,1': 1 }, gold = false;
      for (var i = 0; i < k && i < fr.steps.length; i++) { pos = [fr.steps[i][0], fr.steps[i][1]]; visited[pos.join(',')] = 1; gold = fr.steps[i][3]; }
      for (var x = 1; x <= 4; x++) for (var y = 1; y <= 4; y++) {
        var px = ox + (x - 1) * cs, py = (4 - y) * cs, key = x + ',' + y;
        ctx.fillStyle = visited[key] ? AG.css('--accent-soft') : AG.css('--surface'); ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = AG.css('--line'); ctx.strokeRect(px + .5, py + .5, cs - 1, cs - 1);
        ctx.font = Math.round(cs * .32) + 'px system-ui'; ctx.textAlign = 'center'; ctx.globalAlpha = visited[key] ? 1 : .35;
        if (fr.pits.some(function (p) { return p[0] === x && p[1] === y; })) ctx.fillText('🕳', px + cs / 2, py + cs * .62);
        if (fr.wumpus[0] === x && fr.wumpus[1] === y) ctx.fillText('👹', px + cs / 2, py + cs * .62);
        if (fr.gold[0] === x && fr.gold[1] === y && !gold) ctx.fillText('✨', px + cs * .78, py + cs * .3);
        ctx.globalAlpha = 1;
      }
      ctx.font = Math.round(cs * .4) + 'px system-ui'; ctx.fillText(gold ? '🤑' : '🤖', ox + (pos[0] - .5) * cs, (4 - pos[1] + .7) * cs); ctx.textAlign = 'left';
      var s = fr.steps[Math.max(0, Math.min(k, fr.steps.length) - 1)];
      ctx.fillStyle = AG.css('--ink'); ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.fillText('cave #1 (revealed faintly) · step ' + k + (k && s ? ' · ' + s[2] : ''), 4, H - 4);
    },
    robot: function (ctx, W, H, fr, k) {
      var pad = 12, S = (Math.min(W, H - 16) - 2 * pad) / 200;
      function X(x) { return pad + x * S; } function Y(y) { return H - 16 - pad - y * S; }
      ctx.fillStyle = AG.css('--surface'); ctx.fillRect(X(0), Y(200), 200 * S, 200 * S); ctx.strokeStyle = AG.css('--ink'); ctx.lineWidth = 3; ctx.strokeRect(X(0), Y(200), 200 * S, 200 * S);
      ctx.fillStyle = AG.isDark() ? '#6b4a2b' : '#c9a27a'; ctx.fillRect(X(120), Y(100), 40 * S, 40 * S);
      var pts = [[30, 30, 0]].concat(fr.slice(0, k).map(function (f) { return [f[0], f[1], f[2]]; }));
      ctx.strokeStyle = 'rgba(124,92,255,.35)'; ctx.lineWidth = 20 * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      pts.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); }); ctx.stroke();
      var p = pts[pts.length - 1], a = p[2] * Math.PI / 180;
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 8 * S, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p[0]), Y(p[1])); ctx.lineTo(X(p[0] + Math.cos(a) * 8), Y(p[1] + Math.sin(a) * 8)); ctx.stroke();
      var f = fr[Math.max(0, k - 1)];
      ctx.fillStyle = AG.css('--ink'); ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.fillText(k && f ? 'action ' + k + ': ' + f[3] + (f[5] && /Refused/.test(f[5]) ? '  (refused)' : '') : 'start', 4, H - 2);
    },
  };

  AG.widget('agentlab', function (root) {
    var st = store(), cur = 0, ed, loaded = false, res = null, frames = [], k = 0, timer = null, running = false;
    var tabs = h('div', { class: 'lab-tabs', role: 'tablist' });
    root.appendChild(tabs);
    var grid = h('div', { class: 'lab-grid' }), left = h('div', { class: 'lab-left' }), right = h('div', { class: 'lab-right' });
    grid.appendChild(left); grid.appendChild(right); root.appendChild(grid);
    var head = h('div', { class: 'lab-head' }), brief = h('div', { class: 'lab-brief' }), hints = h('details', { class: 'lab-hints' });
    right.appendChild(head); right.appendChild(brief); right.appendChild(hints);
    var bar = h('div', { class: 'lab-bar' });
    var bRun = h('button', { type: 'button', class: 'primary', text: '▶ Run & check' }), bStop = h('button', { type: 'button', text: '■ Stop', hidden: true });
    var bReset = h('button', { type: 'button', text: 'Reset code' }), bSol = h('button', { type: 'button', text: 'Show a solution' }), bDl = h('button', { type: 'button', text: '↓ agent.py' });
    bar.appendChild(bRun); bar.appendChild(bStop); bar.appendChild(bReset); bar.appendChild(bSol); bar.appendChild(bDl);
    left.appendChild(bar);
    var edHost = h('div'); left.appendChild(edHost);
    left.appendChild(h('p', { class: 'w-note', html: '<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> runs. <kbd>Tab</kbd> indents. Your code is saved in this browser. <code>print()</code> output appears in the console.' }));
    var consoleBox = h('pre', { class: 'pycell-out lab-console' }); left.appendChild(consoleBox);
    // replay + results (environment levels)
    var envBox = h('div', { class: 'lab-env' }), stage = h('div', { class: 'w-stage' });
    var verdict = h('div', { class: 'lab-verdict' });
    var play = h('button', { type: 'button', class: 'small', text: '▶ Replay' }), scrub = h('input', { type: 'range', min: 0, max: 0, value: 0, 'aria-label': 'Replay position', style: 'flex:1' });
    var rows = h('div');
    envBox.appendChild(verdict); envBox.appendChild(stage); envBox.appendChild(h('div', { class: 'w-row' }, [play, scrub])); envBox.appendChild(rows);
    right.appendChild(envBox);
    var C = AG.canvas(stage, function (w) { return Math.round(w * 0.62); }, function () { drawFrame(); });
    // tools level UI
    var toolsBox = h('div', { class: 'lab-tools', hidden: true }); right.appendChild(toolsBox);
    ed = AG.editor(edHost, { value: '', label: 'agent.py', minHeight: 360, onRun: function () { bRun.click(); }, onChange: function (v) { if (!loaded || !v.trim()) return; var s2 = store(); s2.code[LEVELS[cur].id] = v; save(s2); } });

    function drawTabs() {
      tabs.innerHTML = ''; var s2 = store();
      LEVELS.forEach(function (L, i) {
        var b = h('button', { type: 'button', role: 'tab', class: 'lab-tab' + (i === cur ? ' on' : '') + (s2.passed[L.id] ? ' passed' : ''), 'aria-selected': String(i === cur) }, [h('span', { class: 'lvl', text: String(i + 1) }), h('span', { text: L.title })]);
        b.addEventListener('click', function () { load(i); });
        tabs.appendChild(b);
      });
    }
    function files(L, code) {
      var need = ['levels/' + L.harness, 'levels/lab_common.py'], ps = need.map(fetchText).concat((L.extra || []).map(function (f) { return fetchText('../code/' + f); }));
      return Promise.all(ps).then(function (txt) {
        var fs = {}; fs[L.harness] = txt[0]; fs['lab_common.py'] = txt[1]; (L.extra || []).forEach(function (f, i) { fs[f] = txt[2 + i]; }); fs['agent.py'] = code; return fs;
      });
    }
    function load(i) {
      stopReplay(); cur = i; var L = LEVELS[i], s2 = store();
      drawTabs();
      head.innerHTML = '<span class="lab-kicker">Level ' + (i + 1) + ' of ' + LEVELS.length + (s2.passed[L.id] ? ' · ✓ passed' : '') + '</span><h3>' + L.title + '</h3>';
      brief.innerHTML = L.brief + '<p class="w-note">Background: <a href="../' + L.lesson + '/index.html">lesson ' + L.lesson.slice(0, 2) + '</a>.</p>';
      hints.innerHTML = '<summary>Hints (' + L.hints.length + ')</summary><ol>' + L.hints.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>';
      envBox.hidden = L.viz === 'tools'; toolsBox.hidden = L.viz !== 'tools';
      verdict.innerHTML = '<span class="w-note">Press <b>▶ Run & check</b> to test your agent.</span>'; rows.innerHTML = ''; consoleBox.textContent = '';
      res = null; frames = []; k = 0; scrub.max = 0; drawFrame();
      bRun.disabled = true; loaded = false;
      (s2.code[L.id] && s2.code[L.id].trim() ? Promise.resolve(s2.code[L.id]) : fetchText('levels/' + L.start)).then(function (t) {
        ed.set(t); loaded = true; bRun.disabled = false;
        if (L.viz === 'tools') toolsUI();
      });
    }
    function drawFrame() {
      var ctx = C.ctx; ctx.clearRect(0, 0, C.W, C.H);
      var L = LEVELS[cur];
      if (!res || !res.frames) {
        ctx.fillStyle = AG.css('--muted'); ctx.font = '14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('The replay of your agent appears here after a run.', C.W / 2, C.H / 2); ctx.textAlign = 'left'; return;
      }
      VIZ[L.viz](ctx, C.W, C.H, res.frames, k, res);
    }
    function nFrames() { if (!res || !res.frames) return 0; var f = res.frames; return Array.isArray(f) ? f.length : f.steps.length; }
    function stopReplay() { if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Replay'; } }
    play.addEventListener('click', function () {
      if (timer) { stopReplay(); return; }
      if (k >= nFrames()) k = 0;
      play.textContent = '❚❚ Pause';
      timer = setInterval(function () { k++; scrub.value = k; drawFrame(); if (k >= nFrames()) stopReplay(); }, AG.reduce ? 30 : Math.max(40, 2400 / Math.max(10, nFrames())));
    });
    scrub.addEventListener('input', function () { stopReplay(); k = +scrub.value; drawFrame(); });
    function setRunning(on) { running = on; bRun.disabled = on; bStop.hidden = !on; }
    bStop.addEventListener('click', function () { AG.stopPython(); });
    bRun.addEventListener('click', function () {
      var L = LEVELS[cur]; if (running || L.viz === 'tools') { if (L.viz === 'tools') inspect(); return; }
      if (!/def program\s*\(/.test(ed.get())) { verdict.innerHTML = '<span class="pill bad">error</span> agent.py must define <code>def program(percept):</code>'; return; }
      setRunning(true); stopReplay(); consoleBox.textContent = ''; verdict.innerHTML = '<span class="w-note">Running your agent…</span>';
      files(L, ed.get()).then(function (fs) {
        return AG.runPyCollect({ files: fs, main: L.harness, argv: [L.harness].concat(L.argv), status: function (t) { verdict.innerHTML = '<span class="w-note">' + t + '</span>'; } });
      }).then(function (r) {
        setRunning(false);
        consoleBox.textContent = (r.out ? r.out + '\n' : '') + (r.err || '');
        if (r.stopped) { verdict.innerHTML = '<span class="pill warn">stopped</span>'; return; }
        res = r.result;
        if (!res) { verdict.innerHTML = '<span class="pill bad">error</span> Your code crashed before the level could finish. See the console.'; return; }
        if (res.error) { verdict.innerHTML = '<span class="pill bad">error</span> <code>' + AG.esc(res.error.split('\n').filter(Boolean).slice(-1)[0]) + '</code>'; consoleBox.textContent += '\n' + res.error; return; }
        verdict.innerHTML = (res.ok ? '<span class="pill ok">✓ level passed</span> ' : '<span class="pill bad">not yet</span> ') + AG.esc(res.summary || '');
        rows.innerHTML = '';
        if (res.rows) {
          var tb = h('tbody'); res.rows.forEach(function (row) { tb.appendChild(h('tr', null, [h('td', { text: row.start }), h('td', null, [h('b', { text: String(row.score) })]), h('td', { text: row.note || '' })])); });
          rows.appendChild(h('div', { class: 'table-wrap', style: 'max-height:200px;overflow:auto' }, [h('table', null, [h('thead', null, [h('tr', null, ['Test', 'Score', ''].map(function (t) { return h('th', { text: t }); }))]), tb])]));
        }
        k = 0; scrub.max = nFrames(); scrub.value = 0; drawFrame(); play.click();
        AG.badge('first-run');
        if (res.ok) passed(L);
      }).catch(function (e) { setRunning(false); verdict.innerHTML = '<span class="pill bad">error</span> ' + AG.esc(String(e.message || e)); });
    });
    function passed(L) {
      var s2 = store(), first = !s2.passed[L.id];
      s2.passed[L.id] = Date.now(); save(s2); drawTabs();
      if (first) { confetti(); AG.xp(50); AG.badge('lab1'); if (LEVELS.every(function (x) { return s2.passed[x.id]; })) AG.badge('lab-all'); }
    }
    bReset.addEventListener('click', function () { if (!confirm('Replace your code with the starter code?')) return; fetchText('levels/' + LEVELS[cur].start).then(function (t) { ed.set(t); }); });
    bSol.addEventListener('click', function () { if (!confirm('Show a reference solution? Your code is replaced (it is a good idea to try first!).')) return; fetchText('levels/' + LEVELS[cur].sol).then(function (t) { ed.set(t); }); });
    bDl.addEventListener('click', function () { var a = h('a', { href: URL.createObjectURL(new Blob([ed.get()], { type: 'text/x-python' })), download: 'agent.py' }); document.body.appendChild(a); a.click(); a.remove(); });

    /* ---------------- level 7: tools for Claude */
    var tool = { tools: [], log: null };
    function toolsJob(argv) { var L = LEVELS[cur]; return files(L, ed.get()).then(function (fs) { return AG.runPyCollect({ files: fs, main: L.harness, argv: [L.harness].concat(argv) }); }); }
    function inspect() {
      var out = toolsBox.querySelector('.tl-schema'); out.textContent = 'reading your tools…';
      return toolsJob(['schema']).then(function (r) {
        consoleBox.textContent = (r.out || '') + (r.err || '');
        if (!r.result) { out.textContent = 'Your file has an error: see the console.'; tool.tools = []; return; }
        tool.tools = r.result.tools || [];
        out.textContent = JSON.stringify(tool.tools, null, 2);
        var probs = toolsBox.querySelector('.tl-probs'); probs.innerHTML = '';
        (r.result.problems || []).forEach(function (p) { probs.appendChild(h('p', { class: 'w-note' }, [h('span', { class: 'pill warn', text: 'Tip' }), ' ' + p])); });
        var sel = toolsBox.querySelector('.tl-pick'); sel.innerHTML = '';
        tool.tools.forEach(function (t) { sel.appendChild(h('option', { value: t.name, text: t.name })); });
        sel.dispatchEvent(new Event('change'));
      });
    }
    function toolsUI() {
      toolsBox.innerHTML = '';
      AG.live.panel(toolsBox);
      var bIns = h('button', { type: 'button', class: 'primary', text: 'Inspect tools' }), bRes = h('button', { type: 'button', text: 'Reset greenhouse' }), bChk = h('button', { type: 'button', text: 'Check goal' });
      toolsBox.appendChild(h('div', { class: 'w-row' }, [bIns, bRes, bChk]));
      toolsBox.appendChild(h('div', { class: 'tl-probs' }));
      toolsBox.appendChild(h('details', null, [h('summary', { text: 'The tool definitions Claude receives (JSON)' }), h('pre', { class: 'pycell-out tl-schema', text: 'press Inspect tools' })]));
      var pick = h('select', { class: 'tl-pick', 'aria-label': 'Tool' }), argsIn = h('input', { type: 'text', value: '{}', 'aria-label': 'Arguments (JSON)', style: 'flex:1;min-width:160px;font-family:var(--mono)' }), bCall = h('button', { type: 'button', text: 'Call tool' });
      pick.addEventListener('change', function () { var t = tool.tools.filter(function (x) { return x.name === pick.value; })[0]; if (!t) return; var ex = {}; Object.keys(t.input_schema.properties).forEach(function (p) { var ty = t.input_schema.properties[p].type; ex[p] = ty === 'boolean' ? true : ty === 'number' || ty === 'integer' ? 0 : 'seedlings'; }); argsIn.value = JSON.stringify(ex); });
      toolsBox.appendChild(h('div', { class: 'w-lab', text: 'Call a tool yourself' }));
      toolsBox.appendChild(h('div', { class: 'w-row' }, [pick, argsIn, bCall]));
      var prompt = h('textarea', { rows: 2, 'aria-label': 'Task for Claude' }); prompt.value = 'Bring every room to between 20 and 24 °C, then report what you did.';
      var bClaude = h('button', { type: 'button', class: 'primary', text: '🔑 Run with Claude' });
      toolsBox.appendChild(h('div', { class: 'w-lab', text: 'Let Claude use your tools' }));
      toolsBox.appendChild(prompt); toolsBox.appendChild(h('div', { class: 'w-row' }, [bClaude]));
      tool.log = h('div', { class: 'live-log', style: 'max-height:380px' }); toolsBox.appendChild(tool.log);
      function entry(cls, title, body) { var e = h('div', { class: 'live-entry ' + cls }, [h('div', { class: 'live-h', text: title })]); if (body != null) e.appendChild(h('pre', { text: body })); tool.log.appendChild(e); tool.log.scrollTop = tool.log.scrollHeight; return e; }
      function call(name, input) { return toolsJob(['call', name, JSON.stringify(input)]).then(function (r) { return r.result ? (r.result.ok ? [r.result.result, false] : ['Error: ' + r.result.error, true]) : ['Error: ' + (r.err || 'tool crashed'), true]; }); }
      bIns.addEventListener('click', inspect);
      bRes.addEventListener('click', function () { toolsJob(['reset']).then(function () { entry('dim', 'Greenhouse reset to its starting temperatures.'); }); });
      bChk.addEventListener('click', function () { toolsJob(['check']).then(function (r) { var ok = r.result && r.result.ok; entry(ok ? 'ok' : 'err', ok ? '✓ Goal reached: every room is between 20 and 24 °C.' : 'Not yet: ' + ((r.result && r.result.summary) || 'check failed')); }); });
      bCall.addEventListener('click', function () {
        var a; try { a = JSON.parse(argsIn.value || '{}'); } catch (e) { entry('err', 'Arguments must be JSON, e.g. {"room": "herbs"}'); return; }
        entry('tool', '→ ' + pick.value + '(' + JSON.stringify(a) + ')');
        call(pick.value, a).then(function (o) { entry(o[1] ? 'err' : 'res', o[1] ? 'error' : 'result', o[0]); });
      });
      bClaude.addEventListener('click', async function () {
        if (!AG.live.key) { entry('err', 'Paste your API key in the Live mode box above first.'); return; }
        bClaude.disabled = true;
        try {
          await toolsJob(['reset']); await inspect();
          if (!tool.tools.length) { entry('err', 'No tools found in your file.'); return; }
          entry('user', 'You', prompt.value);
          var messages = [{ role: 'user', content: prompt.value }];
          for (var turn = 1; turn <= 25; turn++) {
            var wait = entry('dim', 'Turn ' + turn + ': waiting for ' + AG.live.model + '…');
            var r = await AG.live.create({ system: 'You operate a greenhouse through tools. Use them; do not guess readings. Be efficient: time passes with every reading. When done, report briefly.', tools: tool.tools, messages: messages, max_tokens: 4000 });
            wait.remove();
            messages.push({ role: 'assistant', content: r.content });
            var calls = r.content.filter(function (b) { return b.type === 'tool_use'; });
            r.content.forEach(function (b) { if (b.type === 'text' && b.text) entry('asst', 'Claude', b.text); });
            if (r.stop_reason === 'refusal') { entry('err', 'The model declined.'); break; }
            if (!calls.length) break;
            var results = [];
            for (var i = 0; i < calls.length; i++) {
              entry('tool', '→ ' + calls[i].name + '(' + JSON.stringify(calls[i].input) + ')');
              var o = await call(calls[i].name, calls[i].input);
              entry(o[1] ? 'err' : 'res', o[1] ? 'error' : 'result', o[0]);
              results.push({ type: 'tool_result', tool_use_id: calls[i].id, content: String(o[0]), is_error: o[1] });
            }
            messages.push({ role: 'user', content: results });
          }
          AG.badge('live');
          var chk = await toolsJob(['check']);
          if (chk.result && chk.result.ok) { entry('ok', '✓ Goal reached: every room is between 20 and 24 °C. Level passed!'); passed(LEVELS[cur]); }
          else entry('err', 'The greenhouse is not yet in range. Improve your tools (or the prompt) and try again.');
        } catch (e) { entry('err', 'API error', AG.live.errorText(e)); }
        finally { bClaude.disabled = false; }
      });
      inspect();
    }
    load(0);
  });
})();
