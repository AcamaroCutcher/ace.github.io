/* Lesson 02 widgets: archdiagram (the five agent architectures), gridzoo (port of agent_zoo.py) */
(function () {
  'use strict';
  var h = AG.h, s = AG.s;

  /* ================================================================ archdiagram */
  // box: [id, label, x, y, w, h, color var, description]
  var B = {
    sensors: ['Sensors', '--accent', 'Turn the world into percepts. In agent_zoo.py: World.percept() returns dirty, walls, dock and battery.'],
    actuators: ['Actuators', '--warm', 'Carry out the chosen action. In agent_zoo.py: World.execute(action).'],
    now: ['What the world is like now', '--accent', 'The agent\'s belief about the current state. Reflex agents have only the percept; model-based agents keep internal state (self.pos, self.free, self.walls, self.visited).'],
    rules: ['Condition-action rules', '--ink', 'if-then rules: "if dirty then Suck". ReflexAgent.__call__ and the neighbor rule in ModelReflexAgent.__call__.'],
    action: ['What action I should do now', '--warm', 'The output of the agent program, one action per percept.'],
    state: ['State', '--env', 'Memory carried between steps. ModelReflexAgent.update() folds each percept into it.'],
    evolve: ['How the world evolves', '--env', 'Part of the transition model: what changes by itself. (In our grid world nothing does; in a dynamic world dirt reappears.)'],
    mine: ['What my actions do', '--env', 'Part of the transition model: the predicted effect of my own action. ModelReflexAgent.move() updates self.pos.'],
    future: ['What it will be like if I do action A', '--info', 'Simulating the future with the model: search over action sequences. bfs() in agent_zoo.py.'],
    goals: ['Goals', '--info', 'What the agent is trying to achieve. GoalAgent: "no unexplored square left".'],
    util: ['Utility: how happy will I be?', '--warm', 'Scores outcomes so the agent can trade off. UtilityAgent checks len(path) + back + 1 < battery: dirt is worth +10, a dead battery −50.'],
    std: ['Performance standard', '--muted', 'A fixed external measure of success. For an LLM in training: next-token accuracy, then human or AI preference judgments.'],
    critic: ['Critic', '--bad', 'Compares what happened with the standard and produces feedback (a reward or a loss).'],
    learn: ['Learning element', '--env', 'Changes the performance element to do better next time. For a neural network: gradient descent on the weights.'],
    perf: ['Performance element', '--accent', 'The whole agent of the earlier diagrams: it selects actions.'],
    gen: ['Problem generator', '--info', 'Suggests exploratory actions that may be worse now but informative. ε-greedy exploration in lesson 05.'],
  };
  var L = {
    reflex: {
      boxes: { sensors: [350, 40, 170, 44], now: [350, 120, 170, 52], rules: [120, 200, 170, 52], action: [350, 280, 170, 52], actuators: [350, 360, 170, 44] },
      flows: [['sensors', 'now', 'action', 'actuators'], ['rules', 'action']], note: 'Percept → rule → action. No memory: the decision uses only what the sensors say right now.' },
    model: {
      boxes: { sensors: [350, 40, 170, 44], state: [60, 40, 150, 40], evolve: [60, 100, 150, 44], mine: [60, 160, 150, 44], now: [350, 120, 170, 52], rules: [60, 260, 150, 44], action: [350, 280, 170, 52], actuators: [350, 360, 170, 44] },
      flows: [['sensors', 'now', 'action', 'actuators'], ['state', 'now'], ['evolve', 'now'], ['mine', 'now'], ['rules', 'action']], note: 'The percept is combined with remembered state and a model of the world to estimate the current state.' },
    goal: {
      boxes: { sensors: [350, 40, 170, 44], state: [60, 40, 150, 40], evolve: [60, 100, 150, 44], mine: [60, 160, 150, 44], now: [350, 110, 170, 44], future: [350, 190, 170, 52], goals: [60, 260, 150, 44], action: [350, 280, 170, 44], actuators: [350, 360, 170, 44] },
      flows: [['sensors', 'now', 'future', 'action', 'actuators'], ['state', 'now'], ['mine', 'future'], ['goals', 'action']], note: 'The agent imagines the result of actions ("what if I do A?") and picks those that achieve its goals: search and planning.' },
    utility: {
      boxes: { sensors: [350, 40, 170, 44], state: [60, 40, 150, 40], evolve: [60, 100, 150, 44], mine: [60, 160, 150, 44], now: [350, 100, 170, 40], future: [350, 160, 170, 46], util: [350, 222, 170, 46], action: [350, 290, 170, 40], actuators: [350, 360, 170, 44] },
      flows: [['sensors', 'now', 'future', 'util', 'action', 'actuators'], ['state', 'now'], ['mine', 'future']], note: 'Instead of a yes/no goal, a utility function scores each imagined outcome; the agent picks the best expected one.' },
    learning: {
      boxes: { std: [40, 30, 170, 40], critic: [300, 30, 170, 44], learn: [40, 160, 170, 52], gen: [40, 300, 170, 52], sensors: [520, 30, 0, 0], perf: [300, 170, 220, 150], actuators: [300, 370, 220, 40] },
      flows: [['std', 'critic', 'learn', 'perf', 'actuators'], ['learn', 'gen', 'perf'], ['critic', 'perf']], note: 'Any of the agents above becomes the performance element. The critic scores outcomes, the learning element changes the performance element, the problem generator proposes experiments.' },
  };
  AG.widget('archdiagram', function (root) {
    var kind = 'reflex';
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Agent architectures' }), h('span', { text: 'AIMA Figures 2.9, 2.11, 2.13, 2.14 and 2.15, redrawn and animated.' })]));
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Architecture' });
    [['reflex', 'Simple reflex'], ['model', 'Model-based'], ['goal', 'Goal-based'], ['utility', 'Utility-based'], ['learning', 'Learning']].forEach(function (k) {
      var b = h('button', { type: 'button', text: k[1], 'aria-pressed': String(k[0] === kind) });
      b.addEventListener('click', function () { kind = k[0]; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); layout(); });
      seg.appendChild(b);
    });
    root.appendChild(seg);
    var svg = s('svg', { viewBox: '0 0 760 430', role: 'img', 'aria-label': 'Agent architecture diagram' });
    root.appendChild(h('div', { class: 'w-stage' }, [svg]));
    var note = h('p', { class: 'w-note' }), hover = h('p', { class: 'w-note', html: '<b>Hover a box</b> to see what it does.' });
    root.appendChild(note); root.appendChild(hover);
    // static parts: agent frame + environment
    var frame = s('rect', { x: 20, y: 14, width: 560, height: 404, rx: 16, fill: 'none', 'stroke-width': 2 });
    var env = s('rect', { x: 610, y: 14, width: 130, height: 404, rx: 24, 'stroke-width': 2, 'stroke-dasharray': '6 5' });
    var envT = s('text', { x: 675, y: 220, 'text-anchor': 'middle', class: 'svg-text', 'font-weight': '700' }); envT.textContent = 'Environment';
    var agT = s('text', { x: 36, y: 410, class: 'svg-muted' }); agT.textContent = 'Agent';
    var linkLayer = s('g'), boxLayer = s('g'), dotLayer = s('g');
    var envIn = s('path', { fill: 'none', 'stroke-width': 2 }), envOut = s('path', { fill: 'none', 'stroke-width': 2 });
    [frame, env, envT, agT, envIn, envOut, linkLayer, boxLayer, dotLayer].forEach(function (e) { svg.appendChild(e); });
    var G = {};
    Object.keys(B).forEach(function (id) {
      var g = s('g', { tabindex: 0, role: 'button', 'aria-label': B[id][0] });
      g.style.transition = AG.reduce ? 'none' : 'transform .6s cubic-bezier(.2,.8,.2,1), opacity .4s';
      var r = s('rect', { rx: 9, 'stroke-width': 1.6 });
      var t = s('text', { 'text-anchor': 'middle', class: 'svg-text', 'font-size': 12.5 });
      g.appendChild(r); g.appendChild(t);
      g.addEventListener('mouseenter', function () { hover.innerHTML = '<b>' + B[id][0] + '.</b> ' + B[id][2]; r.setAttribute('stroke-width', 3); });
      g.addEventListener('mouseleave', function () { r.setAttribute('stroke-width', 1.6); });
      g.addEventListener('focus', function () { hover.innerHTML = '<b>' + B[id][0] + '.</b> ' + B[id][2]; });
      boxLayer.appendChild(g);
      G[id] = { g: g, r: r, t: t };
    });
    var flows = [];
    function wrap(t, label, w) {
      t.innerHTML = '';
      var words = label.split(' '), lines = [''], max = Math.max(8, Math.floor(w / 7.2));
      words.forEach(function (wd) { if ((lines[lines.length - 1] + ' ' + wd).trim().length > max) lines.push(wd); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + wd).trim(); });
      lines.forEach(function (ln, i) { var ts = s('tspan', { x: 0, dy: i === 0 ? (-(lines.length - 1) * 7.5 + 4.5) : 15 }); ts.textContent = ln; t.appendChild(ts); });
    }
    function center(id) { var b = L[kind].boxes[id]; return { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, w: b[2], h: b[3], x0: b[0], y0: b[1] }; }
    function edge(a, b) {
      var A = center(a), C = center(b);
      // leave from the side facing the target
      var sx, sy, ex, ey;
      if (Math.abs(A.y - C.y) > Math.abs(A.x - C.x) * 0.6) { sx = A.x; sy = C.y > A.y ? A.y0 + A.h : A.y0; ex = C.x; ey = C.y > A.y ? C.y0 : C.y0 + C.h; }
      else { sy = A.y; sx = C.x > A.x ? A.x0 + A.w : A.x0; ey = C.y; ex = C.x > A.x ? C.x0 : C.x0 + C.w; }
      return 'M' + sx + ',' + sy + ' C' + (sx + ex) / 2 + ',' + sy + ' ' + (sx + ex) / 2 + ',' + ey + ' ' + ex + ',' + ey;
    }
    function layout() {
      var lay = L[kind], ink = AG.css('--ink');
      frame.setAttribute('stroke', AG.css('--accent'));
      env.setAttribute('fill', AG.css('--env-soft')); env.setAttribute('stroke', AG.css('--env'));
      Object.keys(G).forEach(function (id) {
        var b = lay.boxes[id], o = G[id];
        if (!b || !b[2]) { o.g.style.opacity = 0; o.g.style.pointerEvents = 'none'; return; }
        var col = AG.css(B[id][1]);
        o.g.style.opacity = 1; o.g.style.pointerEvents = 'auto';
        o.g.style.transform = 'translate(' + b[0] + 'px,' + b[1] + 'px)';
        o.r.setAttribute('width', b[2]); o.r.setAttribute('height', b[3]);
        o.r.setAttribute('fill', AG.css('--surface')); o.r.setAttribute('stroke', col);
        o.t.setAttribute('transform', 'translate(' + b[2] / 2 + ',' + b[3] / 2 + ')');
        if (id === 'perf') { o.t.setAttribute('transform', 'translate(' + b[2] / 2 + ',22)'); }
        wrap(o.t, B[id][0], b[2]);
      });
      // links
      linkLayer.innerHTML = ''; dotLayer.innerHTML = ''; flows = [];
      lay.flows.forEach(function (chain, ci) {
        for (var i = 0; i + 1 < chain.length; i++) {
          if (!lay.boxes[chain[i]][2] || !lay.boxes[chain[i + 1]][2]) continue;
          var d = edge(chain[i], chain[i + 1]);
          var p = s('path', { d: d, fill: 'none', stroke: ink, 'stroke-opacity': .35, 'stroke-width': 1.6 });
          linkLayer.appendChild(p);
          var dot = s('circle', { r: 4, fill: ci === 0 ? AG.css('--accent') : AG.css('--env') });
          dotLayer.appendChild(dot);
          flows.push({ p: p, dot: dot, k: i, n: chain.length - 1, ci: ci });
        }
      });
      var sb = lay.boxes.sensors, ab = lay.boxes.actuators;
      var acc = AG.css('--accent'), warm = AG.css('--warm');
      if (kind === 'learning') {
        envIn.setAttribute('d', 'M610,60 L470,52'); envOut.setAttribute('d', 'M520,390 L610,390');
      } else {
        envIn.setAttribute('d', 'M610,' + (sb[1] + sb[3] / 2) + ' L' + (sb[0] + sb[2]) + ',' + (sb[1] + sb[3] / 2));
        envOut.setAttribute('d', 'M' + (ab[0] + ab[2]) + ',' + (ab[1] + ab[3] / 2) + ' L610,' + (ab[1] + ab[3] / 2));
      }
      envIn.setAttribute('stroke', acc); envOut.setAttribute('stroke', warm);
      note.innerHTML = '<b>' + { reflex: 'Simple reflex', model: 'Model-based reflex', goal: 'Goal-based', utility: 'Utility-based', learning: 'Learning' }[kind] + ':</b> ' + lay.note;
    }
    layout();
    AG.onTheme(layout);
    if (AG.reduce) return;
    var t0 = performance.now();
    (function anim(now) {
      var T = ((now - t0) / 3200) % 1;
      flows.forEach(function (f) {
        var span = 1 / f.n, u = (T - f.k * span) / span;
        var on = u >= 0 && u <= 1;
        f.dot.setAttribute('opacity', on ? 1 : 0);
        if (on) { var L2 = f.p.getTotalLength(), pt = f.p.getPointAtLength(L2 * u); f.dot.setAttribute('cx', pt.x); f.dot.setAttribute('cy', pt.y); }
      });
      requestAnimationFrame(anim);
    })(t0);
  });

  /* ================================================================ gridzoo: port of agent_zoo.py */
  var MAP = [
    '##############',
    '#D...#.......#',
    '#....#..##...#',
    '#.........#..#',
    '###.###...#..#',
    '#.....#......#',
    '#..#..####.###',
    '#..#.........#',
    '##############',
  ];
  var DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }, ORDER = ['N', 'E', 'S', 'W'];
  var MAX_BATTERY = 100, STEPS = 400, DIRT_P = 0.3;
  function key(x, y) { return x + ',' + y; }

  function World(seed) {
    var rnd = AG.rng(seed);
    this.walls = new Set(); this.dirt = new Set();
    for (var y = 0; y < MAP.length; y++) for (var x = 0; x < MAP[y].length; x++) {
      var ch = MAP[y][x];
      if (ch === '#') this.walls.add(key(x, y));
      else if (ch === 'D') this.dock = [x, y];
      else if (rnd() < DIRT_P) this.dirt.add(key(x, y));
    }
    this.total = this.dirt.size; this.pos = this.dock.slice(); this.battery = MAX_BATTERY; this.score = 0; this.dead = false; this.cleaned = 0; this.steps = 0;
  }
  World.prototype.percept = function () {
    var x = this.pos[0], y = this.pos[1], w = {}, self = this;
    ORDER.forEach(function (d) { w[d] = self.walls.has(key(x + DIRS[d][0], y + DIRS[d][1])); });
    return { dirty: this.dirt.has(key(x, y)), walls: w, dock: x === this.dock[0] && y === this.dock[1], battery: this.battery };
  };
  World.prototype.execute = function (a) {
    if (this.dead) return;
    this.steps++;
    if (DIRS[a]) {
      var nx = this.pos[0] + DIRS[a][0], ny = this.pos[1] + DIRS[a][1];
      if (!this.walls.has(key(nx, ny))) this.pos = [nx, ny];
      this.battery -= 1;
    } else if (a === 'Suck') {
      var k = key(this.pos[0], this.pos[1]);
      if (this.dirt.has(k)) { this.dirt.delete(k); this.score += 10; this.cleaned++; }
      this.battery -= 1;
    } else if (a === 'Dock' && this.pos[0] === this.dock[0] && this.pos[1] === this.dock[1]) this.battery = MAX_BATTERY;
    if (this.battery <= 0 && !(this.pos[0] === this.dock[0] && this.pos[1] === this.dock[1])) { this.dead = true; this.score -= 50; }
  };

  function bfs(start, goal, free) {
    var q = [start], head = 0, parent = new Map();
    parent.set(key(start[0], start[1]), null);
    while (head < q.length) {
      var c = q[head++], ck = key(c[0], c[1]);
      if (goal(c)) {
        var path = [], k = ck;
        while (parent.get(k)) { var pr = parent.get(k); path.push(pr[1]); k = pr[0]; }
        return path.reverse();
      }
      for (var i = 0; i < 4; i++) {
        var d = ORDER[i], n = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]], nk = key(n[0], n[1]);
        if (free.has(nk) && !parent.has(nk)) { parent.set(nk, [ck, d]); q.push(n); }
      }
    }
    return null;
  }

  function makeAgent(kind, rnd) {
    if (kind === 'random') return { act: function () { return ORDER.concat(['Suck'])[Math.floor(rnd() * 5)]; } };
    if (kind === 'reflex') return { act: function (p) {
      if (p.dirty) return 'Suck';
      var open = ORDER.filter(function (d) { return !p.walls[d]; });
      return open[Math.floor(rnd() * open.length)];
    } };
    var A = { pos: [0, 0], free: new Set(['0,0']), walls: new Set(), visited: new Set(['0,0']), path: null };
    A.update = function (p) {
      A.visited.add(key(A.pos[0], A.pos[1]));
      ORDER.forEach(function (d) { (p.walls[d] ? A.walls : A.free).add(key(A.pos[0] + DIRS[d][0], A.pos[1] + DIRS[d][1])); });
    };
    A.move = function (d) { A.pos = [A.pos[0] + DIRS[d][0], A.pos[1] + DIRS[d][1]]; return d; };
    var unvisited = function (c) { return !A.visited.has(key(c[0], c[1])); };
    var isHome = function (c) { return c[0] === 0 && c[1] === 0; };
    if (kind === 'model') A.act = function (p) {
      A.update(p); A.path = null;
      if (p.dirty) return 'Suck';
      for (var i = 0; i < 4; i++) {
        var d = ORDER[i];
        if (!p.walls[d] && !A.visited.has(key(A.pos[0] + DIRS[d][0], A.pos[1] + DIRS[d][1]))) return A.move(d);
      }
      var open = ORDER.filter(function (d) { return !p.walls[d]; });
      return A.move(open[Math.floor(rnd() * open.length)]);
    };
    if (kind === 'goal') A.act = function (p) {
      A.update(p); A.path = null;
      if (p.dirty) return 'Suck';
      var path = bfs(A.pos, unvisited, A.free);
      if (path && path.length) { A.path = path; return A.move(path[0]); }
      var home = bfs(A.pos, isHome, A.free);
      if (home && home.length) { A.path = home; return A.move(home[0]); }
      return p.dock ? 'Dock' : 'NoOp';
    };
    if (kind === 'utility') A.act = function (p) {
      A.update(p); A.path = null;
      var home = bfs(A.pos, isHome, A.free), dHome = home.length;
      if (p.dock && p.battery < MAX_BATTERY && bfs(A.pos, unvisited, A.free) !== null) return 'Dock';
      if (p.dirty && p.battery - 1 > dHome) return 'Suck';
      var path = bfs(A.pos, unvisited, A.free);
      if (path && path.length) {
        var t = A.pos.slice();
        path.forEach(function (d) { t = [t[0] + DIRS[d][0], t[1] + DIRS[d][1]]; });
        var back = (bfs(t, isHome, A.free) || []).length;
        if (path.length + back + 1 < p.battery) { A.path = path; return A.move(path[0]); }
      }
      if (home && home.length) { A.path = home; return A.move(home[0]); }
      return p.dock ? 'Dock' : 'NoOp';
    };
    return A;
  }
  function runOne(kind, seed) {
    var w = new World(seed), ag = makeAgent(kind, AG.rng(seed + 1000));
    for (var i = 0; i < STEPS && !w.dead; i++) w.execute(ag.act(w.percept()));
    return w;
  }
  AG.agentZoo = { runOne: runOne };   // exposed for testing against the Python output

  var KINDS = [['random', 'Random'], ['reflex', 'Simple reflex'], ['model', 'Model-based'], ['goal', 'Goal-based'], ['utility', 'Utility-based']];
  AG.widget('gridzoo', function (root) {
    var kind = 'reflex', seed = 1, world, agent, timer = null, showMap = true, lastAct = '';
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Agent zoo: one apartment, five agent programs' }), h('span', { text: 'The robot senses only its own square, adjacent walls, the dock and its battery.' })]));
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Agent type' });
    KINDS.forEach(function (k) {
      var b = h('button', { type: 'button', text: k[1], 'aria-pressed': String(k[0] === kind) });
      b.addEventListener('click', function () { kind = k[0]; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); reset(); });
      seg.appendChild(b);
    });
    root.appendChild(seg);
    var grid = h('div', { class: 'w-grid2' });
    var stage = h('div', { class: 'w-stage' });
    var side = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    grid.appendChild(stage); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(stage, function (w) { return Math.round(w * 9 / 14); }, function () { draw(); });
    var readout = h('div', { class: 'readout' }); side.appendChild(readout);
    var batt = h('div', { style: 'height:12px;border-radius:6px;background:var(--line-2);border:1px solid var(--line);overflow:hidden' }, [h('i', { style: 'display:block;height:100%;width:100%;background:var(--env);transition:width .2s' })]);
    side.appendChild(h('div', { class: 'w-lab', text: 'Battery' })); side.appendChild(batt);
    var status = h('p', { class: 'w-note' }); side.appendChild(status);
    var bStep = h('button', { type: 'button', text: 'Step' }), bRun = h('button', { type: 'button', class: 'primary', text: 'Run ▶' });
    var bNew = h('button', { type: 'button', text: 'New world' }), bBench = h('button', { type: 'button', text: 'Benchmark 20 worlds' });
    var speed = h('input', { type: 'range', min: 1, max: 60, value: 18, 'aria-label': 'Speed' });
    var cMap = h('input', { type: 'checkbox', checked: true });
    cMap.addEventListener('change', function () { showMap = cMap.checked; draw(); });
    root.appendChild(h('div', { class: 'w-row' }, [bStep, bRun, bNew, bBench, h('label', { class: 'ctl', style: 'min-width:130px' }, [h('span', { text: 'Speed' }), speed]), h('label', { class: 'w-note' }, [cMap, ' Show the agent\'s map'])]));
    var bench = h('div'); root.appendChild(bench);

    function reset() { stop(); world = new World(seed); agent = makeAgent(kind, AG.rng(seed + 1000)); lastAct = ''; upd(); draw(); }
    function stepOnce() {
      if (world.dead || world.steps >= STEPS) { stop(); return; }
      lastAct = agent.act(world.percept());
      world.execute(lastAct);
      upd(); draw();
      if (world.dead || world.steps >= STEPS) stop();
    }
    function upd() {
      readout.innerHTML = '';
      [[world.steps + '/' + STEPS, 'steps'], [world.score, 'score'], [world.cleaned + '/' + world.total, 'dirt cleaned']].forEach(function (r) {
        readout.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })]));
      });
      batt.firstChild.style.width = Math.max(0, world.battery) + '%';
      batt.firstChild.style.background = world.battery < 25 ? 'var(--bad)' : world.battery < 50 ? 'var(--warm)' : 'var(--env)';
      status.innerHTML = world.dead ? '<b style="color:var(--bad)">Battery dead away from the dock (−50).</b>' :
        world.steps >= STEPS ? '<b>Time is up.</b>' : lastAct ? 'Last action: <code>' + lastAct + '</code>' : 'Seed ' + seed + '. Press Run.';
    }
    function draw() {
      if (!world) return;
      var ctx = C.ctx, W = C.W, H = C.H, cs = W / 14;
      ctx.clearRect(0, 0, W, H);
      var surf = AG.css('--surface'), wall = AG.isDark() ? '#3a3a38' : '#4a4a46', line = AG.css('--line-2');
      for (var y = 0; y < 9; y++) for (var x = 0; x < 14; x++) {
        var k = key(x, y), px = x * cs, py = y * cs;
        ctx.fillStyle = world.walls.has(k) ? wall : surf;
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = line; ctx.strokeRect(px + .5, py + .5, cs - 1, cs - 1);
        if (world.dirt.has(k)) {
          var r = AG.rng(x * 31 + y * 7);
          for (var d = 0; d < 6; d++) { ctx.fillStyle = 'rgba(140,100,60,.75)'; ctx.beginPath(); ctx.arc(px + cs * (.2 + .6 * r()), py + cs * (.2 + .6 * r()), cs * (.05 + .06 * r()), 0, 7); ctx.fill(); }
        }
      }
      // dock
      ctx.fillStyle = AG.css('--env'); ctx.font = '700 ' + Math.round(cs * .32) + 'px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('⚡', world.dock[0] * cs + cs / 2, world.dock[1] * cs + cs * .35);
      // agent's map (fog over squares it has not seen)
      if (showMap && agent.visited) {
        var ox = world.dock[0], oy = world.dock[1];
        for (y = 0; y < 9; y++) for (x = 0; x < 14; x++) {
          var rk = key(x - ox, y - oy);
          var known = agent.free.has(rk) || agent.walls.has(rk);
          if (!known) { ctx.fillStyle = AG.isDark() ? 'rgba(0,0,0,.62)' : 'rgba(20,20,30,.42)'; ctx.fillRect(x * cs, y * cs, cs, cs); }
          else if (agent.visited.has(rk)) { ctx.fillStyle = AG.isDark() ? 'rgba(157,140,255,.10)' : 'rgba(91,79,224,.07)'; ctx.fillRect(x * cs, y * cs, cs, cs); }
        }
        if (agent.path && agent.path.length) {
          ctx.strokeStyle = AG.css('--accent'); ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.beginPath();
          var cx = world.pos[0], cy = world.pos[1];
          ctx.moveTo(cx * cs + cs / 2, cy * cs + cs / 2);
          // the plan was made before the first move; skip the step already taken
          agent.path.slice(1).forEach(function (dd) { cx += DIRS[dd][0]; cy += DIRS[dd][1]; ctx.lineTo(cx * cs + cs / 2, cy * cs + cs / 2); });
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (showMap) {
        ctx.fillStyle = AG.css('--muted'); ctx.textAlign = 'left'; ctx.font = '12px system-ui';
        ctx.fillText('This agent has no map: it remembers nothing.', 8, H - 8);
      }
      // robot
      var rx = world.pos[0] * cs + cs / 2, ry = world.pos[1] * cs + cs / 2;
      ctx.fillStyle = world.dead ? AG.css('--bad') : AG.css('--accent');
      ctx.beginPath(); ctx.arc(rx, ry, cs * .34, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rx + cs * .12, ry - cs * .08, cs * .07, 0, 7); ctx.fill();
      ctx.textAlign = 'left';
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } bRun.textContent = 'Run ▶'; }
    bStep.addEventListener('click', function () { stop(); stepOnce(); });
    bRun.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (world.dead || world.steps >= STEPS) reset();
      bRun.textContent = 'Pause ❚❚';
      var tick = function () { var n = Math.max(1, Math.round(+speed.value / 12)); for (var i = 0; i < n; i++) stepOnce(); };
      timer = setInterval(tick, AG.reduce ? 40 : Math.max(16, 260 - +speed.value * 4));
    });
    speed.addEventListener('input', function () { if (timer) { stop(); bRun.click(); } });
    bNew.addEventListener('click', function () { seed = seed % 20 + 1; reset(); });
    bBench.addEventListener('click', function () {
      var tb = h('tbody');
      KINDS.forEach(function (k) {
        var sc = 0, fr = 0, deaths = 0;
        for (var sd = 1; sd <= 20; sd++) { var w = runOne(k[0], sd); sc += w.score; fr += w.cleaned / w.total; deaths += w.dead ? 1 : 0; }
        tb.appendChild(h('tr', null, [h('td', { text: k[1] }), h('td', null, [h('b', { text: (sc / 20).toFixed(1) })]), h('td', { text: Math.round(100 * fr / 20) + '%' }), h('td', { text: String(deaths) })]));
      });
      bench.innerHTML = '';
      bench.appendChild(h('div', { class: 'table-wrap' }, [h('table', null, [h('thead', null, [h('tr', null, ['Agent', 'Average score', 'Dirt cleaned', 'Battery deaths'].map(function (t) { return h('th', { text: t }); }))]), tb])]));
      bench.appendChild(h('p', { class: 'w-note', text: 'Seeds 1–20, 400 steps each. Same numbers as python agent_zoo.py.' }));
    });
    reset();
  });
})();
