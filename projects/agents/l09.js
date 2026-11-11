/* Lesson 09 widgets: robotsim (port of robot_agent.py: SimRobot + Body + OfflineBrain), wiring */
(function () {
  'use strict';
  var h = AG.h, s = AG.s;
  var MAX_DRIVE_CM = 100, MAX_TURN_DEG = 180, CLEARANCE_CM = 12, CM_PER_SEC = 20, DEG_PER_SEC = 90, SPEED = 150;
  // Python's round() and format(.0f) round halves to even; match them so the numbers equal the Python output
  function pyRound(v) { var f = Math.floor(v), d = v - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(v); }
  function pyFloat(v) { return Number.isInteger(v) ? v.toFixed(1) : String(v); }
  function copysign(a, b) { return b < 0 || Object.is(b, -0) ? -Math.abs(a) : Math.abs(a); }

  function SimRobot() {
    this.w = 200; this.h = 200; this.box = [120, 60, 160, 100]; this.x = 30; this.y = 30; this.heading = 0;
  }
  SimRobot.prototype.hit = function () {
    var dx = Math.cos(this.heading * Math.PI / 180), dy = Math.sin(this.heading * Math.PI / 180), b = this.box;
    for (var i = 1; i < 800; i++) {
      var t = i * 0.5, px = this.x + dx * t, py = this.y + dy * t;
      if (!(px >= 0 && px <= this.w && py >= 0 && py <= this.h) || (px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3])) return { t: t, x: px, y: py };
    }
    return { t: 400, x: this.x + dx * 400, y: this.y + dy * 400 };
  };
  SimRobot.prototype.distance = function () { return pyRound(this.hit().t); };
  SimRobot.prototype.motors = function (left, right, ms) {
    if (left > 0 && right > 0 && this.distance() < 15) return 'ERR obstacle';
    var secs = ms / 1000;
    if (left === right) {
      var d = copysign(CM_PER_SEC * secs, left);
      if (d > 0) d = Math.min(d, Math.max(0, this.distance() - 15));
      this.x += d * Math.cos(this.heading * Math.PI / 180); this.y += d * Math.sin(this.heading * Math.PI / 180);
    } else this.heading = (((this.heading + copysign(DEG_PER_SEC * secs, right - left)) % 360) + 360) % 360;
    return 'OK M';
  };
  SimRobot.prototype.pose = function () { return '(x=' + pyRound(this.x) + ' cm, y=' + pyRound(this.y) + ' cm, heading=' + pyRound(this.heading) + ' deg)'; };

  function bodyCall(robot, name, args) {
    if (name === 'read_distance') return [robot.distance() + ' cm', false, 'body'];
    if (name === 'stop') return ['OK S', false, 'body'];
    if (name === 'drive') {
      var cm = +args.cm;
      if (Math.abs(cm) > MAX_DRIVE_CM) return ['Refused: ' + pyFloat(cm) + ' cm is more than the ' + MAX_DRIVE_CM + ' cm limit per call.', true, 'body'];
      if (cm > 0) { var free = robot.distance(); if (cm > free - CLEARANCE_CM) return ['Refused: only ' + free + ' cm free ahead; driving ' + pyFloat(cm) + ' cm would hit something.', true, 'body']; }
      var ms = Math.abs(cm) / CM_PER_SEC * 1000, sp = cm > 0 ? SPEED : -SPEED, rep = robot.motors(sp, sp, ms);
      return [rep + '; drove ' + pyFloat(cm) + ' cm. Now ' + robot.pose(), rep.indexOf('ERR') === 0, rep.indexOf('ERR') === 0 ? 'reflex' : 'motors'];
    }
    if (name === 'turn') {
      var deg = +args.degrees;
      if (Math.abs(deg) > MAX_TURN_DEG) return ['Refused: turn at most ' + MAX_TURN_DEG + ' degrees per call.', true, 'body'];
      var ms2 = Math.abs(deg) / DEG_PER_SEC * 1000, lr = deg > 0 ? [-SPEED, SPEED] : [SPEED, -SPEED], rep2 = robot.motors(lr[0], lr[1], ms2);
      return [rep2 + '; turned ' + pyFloat(deg) + ' degrees. Now ' + robot.pose(), rep2.indexOf('ERR') === 0, 'motors'];
    }
    return ['Unknown tool ' + name, true, 'body'];
  }
  function OfflineBrain() { this.left = 12; this.measured = null; }
  OfflineBrain.prototype.next = function (results) {
    var self = this;
    (results || []).forEach(function (r) { if (r[0] === 'read_distance') self.measured = parseInt(r[1], 10); });
    if (this.left <= 0) return ['Explored 12 steps with a reflex rule. (An LLM brain would plan instead.)', []];
    this.left--;
    if (this.measured === null) return ['Measuring.', [['read_distance', {}]]];
    var free = this.measured; this.measured = null;
    if (free > 40) return [free + ' cm free: driving 25 cm.', [['drive', { cm: 25 }], ['read_distance', {}]]];
    return ['Only ' + free + ' cm free: turning left.', [['turn', { degrees: 90 }], ['read_distance', {}]]];
  };
  // An LLM-style plan, written as a small program so its narration uses the real measurements.
  function PlannerBrain() { this.k = 0; this.mem = {}; }
  PlannerBrain.prototype.next = function (results) {
    var m = this.mem, last = results && results.length ? results[results.length - 1] : null, d = last ? parseInt(last[1], 10) : null;
    var steps = [
      function () { return ['I can only sense straight ahead, so I\'ll measure first.', [['read_distance', {}]]]; },
      function () { m.a = d; return [d + ' cm of free space ahead. I\'ll drive the maximum 100 cm and measure again.', [['drive', { cm: 100 }], ['read_distance', {}]]]; },
      function () { m.b = d; return ['Now ' + d + ' cm ahead. I\'ll try 80 cm to get close to the wall.', [['drive', { cm: 80 }]]]; },
      function () { return ['The body refused: 80 cm would leave less than the safety clearance. I\'ll drive 50 cm instead.', [['drive', { cm: 50 }], ['read_distance', {}]]]; },
      function () { m.front = d; return ['The wall is ' + d + ' cm ahead. To measure the width, I\'ll turn around and measure the distance behind me.', [['turn', { degrees: 180 }], ['read_distance', {}]]]; },
      function () { m.back = d; m.width = m.front + m.back; return [d + ' cm to the other wall, so this side of the room is about ' + m.front + ' + ' + d + ' = ' + m.width + ' cm. Now the other direction: turn right 90°.', [['turn', { degrees: -90 }], ['read_distance', {}]]]; },
      function () { m.f2 = d; return [d + ' cm ahead. Turning around to measure behind.', [['turn', { degrees: 180 }], ['read_distance', {}]]]; },
      function () { m.depth = m.f2 + d; return ['The room is about ' + m.width + ' cm × ' + m.depth + ' cm (roughly ' + (m.width / 100).toFixed(1) + ' m × ' + (m.depth / 100).toFixed(1) + ' m). I\'ve stopped.', [['stop', {}]]]; },
      function () { return ['Done.', []]; },
    ];
    return steps[Math.min(this.k++, steps.length - 1)]();
  };
  var R_SYSTEM = 'You control a small two-wheeled robot through tools. You cannot see; your only sense\nis an ultrasonic distance sensor that points forward. Move in small steps, measure often, and\nnever drive into something closer than the distance you plan to drive. When the goal is reached\nor impossible, stop moving and report what you found in a few sentences.';
  var R_TOOLS = [
    { name: 'read_distance', description: 'Measure the distance in cm to the nearest object straight ahead.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'drive', description: 'Drive straight. Positive = forward, negative = backward. Max 100 cm per call.', input_schema: { type: 'object', properties: { cm: { type: 'number' } }, required: ['cm'], additionalProperties: false } },
    { name: 'turn', description: 'Turn in place. Positive = left (counter-clockwise), negative = right. Max 180 degrees per call.', input_schema: { type: 'object', properties: { degrees: { type: 'number' } }, required: ['degrees'], additionalProperties: false } },
    { name: 'stop', description: 'Stop the motors immediately.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  ];
  // The same brain as ClaudeBrain in robot_agent.py, calling the API from the browser with the visitor's key
  function LiveBrain(goal) { this.messages = [{ role: 'user', content: goal }]; this.usage = 0; }
  LiveBrain.prototype.next = async function (results) {
    if (results && results.length) this.messages.push({ role: 'user', content: results.map(function (r) { return { type: 'tool_result', tool_use_id: r[3], content: r[1], is_error: r[2] }; }) });
    var r = await AG.live.create({ system: R_SYSTEM, tools: R_TOOLS, messages: this.messages, max_tokens: 4000 });
    this.messages.push({ role: 'assistant', content: r.content });
    if (r.stop_reason === 'refusal') return ['The model declined.', []];
    var text = r.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(' ');
    return [text, r.content.filter(function (b) { return b.type === 'tool_use'; }).map(function (b) { return [b.name, b.input, b.id]; })];
  };
  AG.robot = { SimRobot: SimRobot, bodyCall: bodyCall, OfflineBrain: OfflineBrain };

  AG.widget('robotsim', function (root) {
    var robot, mode = 'manual', brain = null, pending = null, busy = false, dots = [], trail = [], beam = null, anim = null, flash = {};
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Robot simulator' }), h('span', { text: '2 × 2 m room, one box. Same physics, limits and messages as robot_agent.py.' })]));
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Brain' });
    [['manual', 'Manual tools (you)'], ['reflex', 'Reflex brain'], ['llm', 'LLM-style plan (replay)'], ['live', '🔑 Live Claude (your key)']].forEach(function (m) {
      var b = h('button', { type: 'button', text: m[1], 'aria-pressed': String(m[0] === mode) });
      b.addEventListener('click', function () { mode = m[0]; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); reset(); });
      seg.appendChild(b);
    });
    root.appendChild(seg);
    var liveBox = h('div', { hidden: true, style: 'display:grid;gap:8px' });
    root.appendChild(liveBox);
    var goalIn = h('textarea', { rows: 2, 'aria-label': 'Goal for the robot' }); goalIn.value = 'Explore the room. Find out roughly how big it is, then stop and report.';
    var liveReady = false;
    var grid = h('div', { class: 'w-grid2' }), st = h('div', { class: 'w-stage' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(st); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(st, 1, function () { draw(); });
    var layers = h('div', { class: 'w-row' });
    var LBL = { brain: 'Brain (LLM / agent)', body: 'Body (validation)', motors: 'Motors', reflex: 'Reflex (firmware)' };
    var badges = {};
    Object.keys(LBL).forEach(function (k) { badges[k] = h('span', { class: 'pill', style: 'transition:all .2s', text: LBL[k] }); layers.appendChild(badges[k]); });
    side.appendChild(layers);
    var manual = h('div', { style: 'display:grid;gap:6px' });
    var cm = h('input', { type: 'number', value: 25, style: 'width:80px', 'aria-label': 'cm' }), dg = h('input', { type: 'number', value: 90, style: 'width:80px', 'aria-label': 'degrees' });
    function tb(label, fn) { var b = h('button', { type: 'button', class: 'small mono', text: label }); b.addEventListener('click', fn); return b; }
    manual.appendChild(h('div', { class: 'w-row' }, [tb('read_distance()', function () { act([['read_distance', {}]]); }), tb('stop()', function () { act([['stop', {}]]); })]));
    manual.appendChild(h('div', { class: 'w-row' }, [tb('drive(cm=', function () { act([['drive', { cm: +cm.value }]]); }), cm, h('span', { class: 'mono', text: ')' })]));
    manual.appendChild(h('div', { class: 'w-row' }, [tb('turn(degrees=', function () { act([['turn', { degrees: +dg.value }]]); }), dg, h('span', { class: 'mono', text: ')' }), h('span', { class: 'w-note', text: '+ = left' })]));
    var auto = h('div', { class: 'w-row' }), bStep = h('button', { type: 'button', class: 'primary', text: 'Next step' }), bRun = h('button', { type: 'button', text: 'Run all ▶' });
    auto.appendChild(bStep); auto.appendChild(bRun);
    var bReset = h('button', { type: 'button', text: 'Reset robot' });
    side.appendChild(manual); side.appendChild(auto); side.appendChild(h('div', { class: 'w-row' }, [bReset]));
    var pose = h('p', { class: 'w-note' }); side.appendChild(pose);
    var logBox = h('div', { class: 'log', style: 'height:240px' }); root.appendChild(logBox);
    function log(cls, t) { logBox.appendChild(h('div', { class: cls, text: t })); logBox.scrollTop = logBox.scrollHeight; }
    function light(k) { Object.keys(badges).forEach(function (b) { var on = b === k; badges[b].style.background = on ? (k === 'reflex' ? 'var(--bad-soft)' : 'var(--accent-soft)') : ''; badges[b].style.borderColor = on ? (k === 'reflex' ? 'var(--bad)' : 'var(--accent)') : ''; }); }
    function reset() {
      robot = new SimRobot(); dots = []; trail = [[robot.x, robot.y]]; beam = null; pending = null; busy = false; logBox.innerHTML = '';
      liveBox.hidden = mode !== 'live';
      if (mode === 'live' && !liveReady) { liveReady = true; AG.live.panel(liveBox); liveBox.appendChild(h('label', { class: 'ctl' }, [h('span', { text: 'Goal (try your own: "find the box and stop 20 cm in front of it")' }), goalIn])); }
      brain = mode === 'reflex' ? new OfflineBrain() : mode === 'llm' ? new PlannerBrain() : mode === 'live' ? new LiveBrain(goalIn.value) : null;
      manual.hidden = mode !== 'manual'; auto.hidden = mode === 'manual';
      bStep.disabled = false; bRun.disabled = false;
      log('dim', mode === 'manual' ? 'You are the brain. Call a tool.' : mode === 'reflex' ? 'python robot_agent.py --sim   (OfflineBrain)' : mode === 'live' ? 'Live: Claude decides every step. Press Next step or Run all (each step is one API call). Edit the goal, then Reset robot to apply it.' : 'Goal: "Explore the room. Find out roughly how big it is, then stop and report."');
      light(null); draw(); upd();
    }
    function upd() { pose.innerHTML = 'Pose: <code>' + robot.pose() + '</code>'; }
    async function act(calls, text) {
      if (busy) return []; busy = true;
      var results = [];
      for (var i = 0; i < calls.length; i++) {
        var c = calls[i], from = { x: robot.x, y: robot.y, hd: robot.heading };
        light('body');
        var r = bodyCall(robot, c[0], c[1]);
        log(r[1] ? 'err' : c[0] === 'read_distance' ? 'per' : 'act', '      ' + c[0] + '(' + JSON.stringify(c[1]) + ') -> ' + r[0]);
        if (c[0] === 'read_distance') { var hp = robot.hit(); beam = { x: hp.x, y: hp.y, t: performance.now() }; if (hp.t < 399) dots.push([hp.x, hp.y]); }
        if (r[2] === 'motors' || r[2] === 'reflex') { light(r[2]); await animate(from); trail.push([robot.x, robot.y]); }
        if (r[1] && r[2] === 'body') light('body');
        results.push([c[0], r[0], r[1], c[2]]);
        draw(); upd(); await AG.wait(180);
      }
      busy = false; return results;
    }
    function animate(from) {
      return new Promise(function (res) {
        var to = { x: robot.x, y: robot.y, hd: robot.heading }, dh = ((to.hd - from.hd + 540) % 360) - 180, t0 = performance.now(), dur = AG.reduce ? 1 : 650;
        if (Math.abs(dh) > 179.9 && Math.abs(to.hd - from.hd) > 179) dh = to.hd - from.hd;   // a full 180° turn: keep the sign of the command
        (function f(now) {
          var u = Math.min(1, (now - t0) / dur), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          anim = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, hd: from.hd + dh * e };
          draw();
          if (u < 1) requestAnimationFrame(f); else { anim = null; draw(); res(); }
        })(t0);
      });
    }
    async function brainStep() {
      if (busy || !brain) return false;
      light('brain');
      var out;
      if (mode === 'live' && !AG.live.key) { log('err', 'Paste your API key in the Live mode box first.'); return false; }
      try { busy = true; out = await brain.next(pending); } catch (e) { busy = false; log('err', 'API error: ' + AG.live.errorText(e)); return false; }
      busy = false;
      if (brain.messages && brain.messages.length > 60) { log('err', 'Stopped: step limit for live mode.'); return false; }
      var n = logBox.querySelectorAll('.think').length + 1;
      if (out[0]) log('think', '[' + n + '] brain: ' + out[0]);
      if (!out[1].length) { log('dim', 'motors stopped.'); bStep.disabled = true; bRun.disabled = true; light(null); return false; }
      pending = await act(out[1]);
      return true;
    }
    bStep.addEventListener('click', function () { brainStep(); });
    bRun.addEventListener('click', async function () { bRun.disabled = true; while (await brainStep()) await AG.wait(250); });
    bReset.addEventListener('click', reset);
    function draw() {
      var ctx = C.ctx, W = C.W, H = C.H, pad = 16, S = (Math.min(W, H) - 2 * pad) / 200;
      function X(x) { return pad + x * S; } function Y(y) { return H - pad - y * S; }
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = AG.css('--surface'); ctx.fillRect(X(0), Y(200), 200 * S, 200 * S);
      ctx.strokeStyle = AG.css('--ink'); ctx.lineWidth = 3; ctx.strokeRect(X(0), Y(200), 200 * S, 200 * S);
      // grid every 50 cm
      ctx.strokeStyle = AG.css('--line-2'); ctx.lineWidth = 1;
      for (var g = 50; g < 200; g += 50) { ctx.beginPath(); ctx.moveTo(X(g), Y(0)); ctx.lineTo(X(g), Y(200)); ctx.moveTo(X(0), Y(g)); ctx.lineTo(X(200), Y(g)); ctx.stroke(); }
      var b = robot.box; ctx.fillStyle = AG.isDark() ? '#6b4a2b' : '#c9a27a'; ctx.fillRect(X(b[0]), Y(b[3]), (b[2] - b[0]) * S, (b[3] - b[1]) * S);
      ctx.fillStyle = AG.css('--muted'); ctx.font = '11px system-ui'; ctx.fillText('box', X(b[0]) + 4, Y(b[3]) + 14); ctx.fillText('50 cm grid', X(0) + 4, Y(0) - 5);
      // trail
      ctx.strokeStyle = AG.css('--accent'); ctx.globalAlpha = .35; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath();
      trail.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); }); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      // map dots: what the robot has sensed
      ctx.fillStyle = AG.css('--warm'); dots.forEach(function (d) { ctx.beginPath(); ctx.arc(X(d[0]), Y(d[1]), 4, 0, 7); ctx.fill(); });
      var p = anim || { x: robot.x, y: robot.y, hd: robot.heading };
      // beam
      if (beam && performance.now() - beam.t < 1600 && !anim) {
        ctx.strokeStyle = AG.css('--env'); ctx.lineWidth = 2; ctx.globalAlpha = .8; ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(beam.x), Y(beam.y)); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // robot
      var a = p.hd * Math.PI / 180, R = 9 * S;
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), R, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(p.x + Math.cos(a) * 9), Y(p.y + Math.sin(a) * 9)); ctx.stroke();
      // keep the beam fading
      if (beam && performance.now() - beam.t < 1600) requestAnimationFrame(function () { if (!anim) draw(); });
    }
    reset();
  });

  /* ================================================================ wiring diagram */
  AG.widget('wiring', function (root) {
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Wiring' }), h('span', { text: 'Hover or tap a wire or a part. Pin numbers match robot_firmware.ino.' })]));
    var svg = s('svg', { viewBox: '0 0 860 430', role: 'img', 'aria-label': 'Wiring diagram' });
    root.appendChild(h('div', { class: 'w-stage' }, [svg]));
    var note = h('p', { class: 'w-note', html: '<b>Rule zero:</b> all grounds connected together, and motors never powered from the Arduino\'s 5 V pin.' });
    root.appendChild(note);
    var PARTS = [
      ['pi', 20, 150, 150, 120, 'Raspberry Pi 5', 'Runs robot_agent.py (brain + body). Talks to the Arduino over USB serial at 115200 baud. Powered by its own USB-C supply or power bank.'],
      ['ard', 250, 120, 170, 230, 'Arduino Uno', 'Runs robot_firmware.ino: the reflex layer. Gets power and commands over USB from the Pi.'],
      ['drv', 520, 120, 140, 230, 'TB6612FNG', 'Dual H-bridge motor driver. Logic side (VCC, pins) at 5 V from the Arduino; power side (VM) from the battery.'],
      ['ml', 720, 110, 120, 60, 'Left motor', 'DC gear motor on outputs AO1/AO2. If it spins the wrong way, swap its two wires.'],
      ['mr', 720, 210, 120, 60, 'Right motor', 'DC gear motor on outputs BO1/BO2.'],
      ['us', 300, 20, 150, 50, 'HC-SR04', 'Ultrasonic range finder. TRIG starts a 40 kHz ping; ECHO goes high for the round-trip time (~58 µs per cm).'],
      ['bat', 560, 380, 150, 40, 'Motor battery', 'Powers only the motors through VM. Its minus terminal must join the common ground.'],
    ];
    var W = [
      ['USB', 'M170,210 L250,210', '--info', 'USB cable: 5 V power for the Arduino plus the serial link. The Pi sends "M 150 150 1250", the Arduino answers "OK M".'],
      ['D5 → PWMA', 'M420,150 L520,150', '--accent', 'Left motor speed: PWM duty cycle 0–255.'],
      ['D7 → AIN1', 'M420,170 L520,170', '--accent', 'Left motor direction bit 1.'],
      ['D8 → AIN2', 'M420,190 L520,190', '--accent', 'Left motor direction bit 2. AIN1=1, AIN2=0: forward; 0/1: backward; 0/0: stop.'],
      ['D6 → PWMB', 'M420,220 L520,220', '--warm', 'Right motor speed.'],
      ['D9 → BIN1', 'M420,240 L520,240', '--warm', 'Right motor direction bit 1.'],
      ['D10 → BIN2', 'M420,260 L520,260', '--warm', 'Right motor direction bit 2.'],
      ['D4 → STBY', 'M420,285 L520,285', '--muted', 'Standby: HIGH enables the driver. The firmware sets it HIGH at start.'],
      ['5V → VCC', 'M420,310 L520,310', '--bad', '5 V logic supply for the driver chip (not for the motors).'],
      ['GND (common)', 'M420,335 L520,335 M335,350 L335,395 L560,395 M590,350 L590,380', '--ink', 'Ground: Arduino, driver, sensor and battery minus all connected. Without a common ground, signals have no reference and nothing works reliably.'],
      ['D11 → TRIG', 'M360,120 L360,70', '--env', 'Trigger pulse (10 µs) starts a measurement.'],
      ['D12 ← ECHO', 'M390,120 L390,70', '--env', 'Echo pulse width = round-trip time of the sound. Distance (cm) ≈ microseconds / 58.'],
      ['5V, GND → sensor', 'M300,135 L280,135 L280,45 L300,45', '--bad', 'The HC-SR04 also needs 5 V and ground from the Arduino.'],
      ['AO1/AO2 → left motor', 'M660,150 L720,140', '--accent', 'Motor current for the left motor.'],
      ['BO1/BO2 → right motor', 'M660,240 L720,240', '--warm', 'Motor current for the right motor.'],
      ['Battery + → VM', 'M650,380 L650,350', '--bad', 'Motor supply. Check your motors\' voltage rating; TT motors are usually 3–6 V.'],
    ];
    function draw() {
      svg.innerHTML = '';
      var surf = AG.css('--surface'), ink = AG.css('--ink');
      W.forEach(function (w) {
        var p = s('path', { d: w[1], fill: 'none', stroke: AG.css(w[2]), 'stroke-width': 3, 'stroke-linecap': 'round', style: 'cursor:pointer' });
        var hit = s('path', { d: w[1], fill: 'none', stroke: 'transparent', 'stroke-width': 14, style: 'cursor:pointer' });
        function on() { svg.querySelectorAll('path[data-w]').forEach(function (x) { x.setAttribute('stroke-width', 3); x.setAttribute('opacity', .35); }); p.setAttribute('stroke-width', 6); p.setAttribute('opacity', 1); note.innerHTML = '<b>' + w[0] + ':</b> ' + w[3]; }
        p.setAttribute('data-w', '1');
        [p, hit].forEach(function (el) { el.addEventListener('mouseenter', on); el.addEventListener('click', on); });
        svg.appendChild(p); svg.appendChild(hit);
      });
      PARTS.forEach(function (pt) {
        var g = s('g', { style: 'cursor:pointer' });
        g.appendChild(s('rect', { x: pt[1], y: pt[2], width: pt[3], height: pt[4], rx: 10, fill: surf, stroke: ink, 'stroke-width': 1.6 }));
        var t = s('text', { x: pt[1] + pt[3] / 2, y: pt[2] + 22, 'text-anchor': 'middle', class: 'svg-text', 'font-weight': 700 }); t.textContent = pt[5]; g.appendChild(t);
        g.addEventListener('mouseenter', function () { svg.querySelectorAll('path[data-w]').forEach(function (x) { x.setAttribute('stroke-width', 3); x.setAttribute('opacity', 1); }); note.innerHTML = '<b>' + pt[5] + ':</b> ' + pt[6]; });
        svg.appendChild(g);
      });
      // pin labels
      [['D5', 150], ['D7', 170], ['D8', 190], ['D6', 220], ['D9', 240], ['D10', 260], ['D4', 285], ['5V', 310], ['GND', 335]].forEach(function (l) { var t = s('text', { x: 412, y: l[1] + 4, 'text-anchor': 'end', class: 'svg-muted', 'font-size': 11 }); t.textContent = l[0]; svg.appendChild(t); });
      [['PWMA', 150], ['AIN1', 170], ['AIN2', 190], ['PWMB', 220], ['BIN1', 240], ['BIN2', 260], ['STBY', 285], ['VCC', 310], ['GND', 335]].forEach(function (l) { var t = s('text', { x: 528, y: l[1] + 4, class: 'svg-muted', 'font-size': 11 }); t.textContent = l[0]; svg.appendChild(t); });
      [['TRIG', 360], ['ECHO', 390]].forEach(function (l) { var t = s('text', { x: l[1], y: 88, 'text-anchor': 'middle', class: 'svg-muted', 'font-size': 10 }); t.textContent = l[0]; svg.appendChild(t); });
      var vm = s('text', { x: 645, y: 345, 'text-anchor': 'end', class: 'svg-muted', 'font-size': 11 }); vm.textContent = 'VM'; svg.appendChild(vm);
      var usb = s('text', { x: 210, y: 202, 'text-anchor': 'middle', class: 'svg-muted', 'font-size': 11 }); usb.textContent = 'USB'; svg.appendChild(usb);
    }
    draw(); AG.onTheme(draw);
  });
})();
