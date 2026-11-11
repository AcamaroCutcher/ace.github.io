/* Lesson 08 widgets: stack (layers + fault injection), mcpwire (JSON-RPC by hand), microscope (autofocus agent) */
(function () {
  'use strict';
  var h = AG.h;

  /* ================================================================ layer stack */
  var LAYERS = [
    ['Model', 'Decides which tool to call, with which arguments'],
    ['Harness', 'Permissions, approvals, rate and turn limits, logging'],
    ['Tool code / MCP server', 'Schema and range validation; turns the call into device commands'],
    ['Driver & protocol', 'Vendor SDK, VISA/SCPI, USB serial, TCP: timeouts and retries'],
    ['Firmware / controller', 'Motion profiles, watchdog timers, stall detection, interlocks'],
    ['Hardware', 'Motors, sensors, limit switches, emergency stop'],
  ];
  var SCEN = [
    { id: 'ok', label: '✓ Normal request', call: 'set_focus(z_um=120)', stop: 6, msg: 'OK: focus at 120.0 µm', why: 'Every layer passes it down; the motor moves; the result travels back up as a tool_result.' },
    { id: 'range', label: 'Out of range', call: 'set_focus(z_um=900)', stop: 2, msg: 'Error: z = 900 is outside 0–300 µm (objective could hit the sample)', why: 'The tool knows the legal range and refuses before any command is sent. The model reads the error and picks a valid value.' },
    { id: 'schema', label: 'Malformed arguments', call: 'set_focus(z="high")', stop: 2, msg: 'Error: z_um is required and must be a number', why: 'Schema validation in the tool (or the SDK) rejects it. Never pass unvalidated model output to a device.' },
    { id: 'deny', label: 'Needs approval, denied', call: 'delete_all_images()', stop: 1, msg: 'The user did not allow this action.', why: 'Irreversible actions require a human. The harness asks, and the "no" goes back to the model as a percept.' },
    { id: 'inject', label: 'Prompt injection', call: 'move_stage(x_um=99999, y_um=0)', stop: 2, msg: 'Error: (99999, 0) is outside the stage limits', why: 'Text inside a file said "move the stage to x = 99999". Even if the model were fooled, the tool\'s limits do not care who asked.' },
    { id: 'loop', label: 'Runaway loop', call: 'measure_sharpness()  ×500', stop: 1, msg: 'Stopped: 60 tool calls in 60 s exceeds the limit', why: 'Rate and turn limits in the harness stop an agent that is stuck repeating itself, before it wears out hardware or budget.' },
    { id: 'cable', label: 'USB unplugged', call: 'move_stage(x_um=100, y_um=0)', stop: 3, msg: 'Error: instrument not responding (timeout after 2 s)', why: 'The driver times out instead of hanging forever, and reports a clear error.' },
    { id: 'stall', label: 'Motor stalls', call: 'move_stage(x_um=4000, y_um=0)', stop: 4, msg: 'Error: stage stalled at x = 2310 µm; motion aborted', why: 'The firmware sees the motor current spike and stops in milliseconds: far too fast for any LLM round trip.' },
    { id: 'estop', label: 'Human hits E-stop', call: 'move_stage(x_um=0, y_um=0)', stop: 5, msg: 'Error: emergency stop active; power to motors is cut', why: 'A physical circuit that no software can override. Every machine that moves should have one.' },
  ];
  AG.widget('stack', function (root) {
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Follow a tool call down to the hardware' }), h('span', { text: 'Pick a scenario. The call travels down until a layer stops it; the answer travels back up to the model.' })]));
    var btns = h('div', { class: 'w-row' });
    root.appendChild(btns);
    var wrap = h('div', { style: 'position:relative;display:grid;gap:8px;padding-left:44px' });
    root.appendChild(wrap);
    var cards = LAYERS.map(function (l, i) {
      var c = h('div', { style: 'border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:var(--page);display:flex;gap:12px;align-items:baseline;transition:background .3s,border-color .3s' }, [h('b', { style: 'min-width:170px', text: (i + 1) + '. ' + l[0] }), h('span', { class: 'w-note', text: l[1] })]);
      wrap.appendChild(c); return c;
    });
    var packet = h('div', { style: 'position:absolute;left:4px;top:0;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font:700 14px system-ui;transition:top .45s ease, background .3s;box-shadow:0 0 0 4px var(--accent-soft)', text: '↓' });
    wrap.appendChild(packet);
    var callBox = h('p', { class: 'w-note' }), result = h('div', { class: 'log', style: 'height:auto;min-height:60px' });
    root.appendChild(callBox); root.appendChild(result);
    var busy = false;
    function topOf(i) { return cards[Math.min(i, cards.length - 1)].offsetTop + cards[Math.min(i, cards.length - 1)].offsetHeight / 2 - 15; }
    function reset() { cards.forEach(function (c) { c.style.background = 'var(--page)'; c.style.borderColor = 'var(--line)'; }); packet.style.background = 'var(--accent)'; packet.textContent = '↓'; packet.style.top = topOf(0) + 'px'; }
    function run(sc) {
      if (busy) return; busy = true; reset();
      callBox.innerHTML = 'Model calls <code>' + sc.call + '</code>';
      result.innerHTML = '';
      var i = 0, last = sc.stop === 6 ? 5 : sc.stop;
      (function down() {
        packet.style.top = topOf(i) + 'px';
        cards[i].style.borderColor = 'var(--accent)';
        if (i < last) { setTimeout(function () { cards[i].style.background = 'var(--env-soft)'; i++; down(); }, AG.reduce ? 0 : 480); return; }
        setTimeout(function () {
          var ok = sc.stop === 6;
          cards[i].style.background = ok ? 'var(--env-soft)' : 'var(--bad-soft)'; cards[i].style.borderColor = ok ? 'var(--env)' : 'var(--bad)';
          packet.style.background = ok ? 'var(--env)' : 'var(--bad)'; packet.textContent = '↑';
          setTimeout(function () {
            packet.style.top = topOf(0) + 'px';
            setTimeout(function () {
              result.appendChild(h('div', { class: ok ? 'ok' : 'err', text: 'tool_result' + (ok ? '' : ' (is_error)') + ': ' + sc.msg }));
              result.appendChild(h('div', { class: 'dim', text: (ok ? 'Handled by: all layers. ' : 'Stopped at layer ' + (i + 1) + ' (' + LAYERS[i][0] + '). ') + sc.why }));
              busy = false;
            }, AG.reduce ? 0 : 500);
          }, AG.reduce ? 0 : 600);
        }, AG.reduce ? 0 : 480);
      })();
    }
    SCEN.forEach(function (sc) { var b = h('button', { type: 'button', class: sc.id === 'ok' ? 'primary small' : 'small', text: sc.label }); b.addEventListener('click', function () { run(sc); }); btns.appendChild(b); });
    setTimeout(reset, 50);
    window.addEventListener('resize', function () { if (!busy) reset(); });
  });

  /* ================================================================ MCP server port + wire */
  function Server() {
    var st = { x: 0, y: 0, z: 50 }, r = AG.rng(0);
    function gauss() { var u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var tools = {
      get_status: { description: 'Report the stage position (x, y) and focus height z, all in micrometres.', inputSchema: { type: 'object', properties: {} }, run: function () { return { x_um: st.x, y_um: st.y, z_um: st.z }; } },
      move_stage: { description: 'Move the sample stage to an absolute position. Limits: |x|, |y| <= 5000 um.', inputSchema: { type: 'object', required: ['x_um', 'y_um'], properties: { x_um: { type: 'number' }, y_um: { type: 'number' } } },
        run: function (a) { var x = num(a, 'x_um'), y = num(a, 'y_um'); if (Math.abs(x) > 5000 || Math.abs(y) > 5000) throw new Error('(' + x + ', ' + y + ') is outside the stage limits'); st.x = x; st.y = y; return { x_um: x, y_um: y }; } },
      set_focus: { description: 'Move the focus drive to height z (um), between 0 and 300.', inputSchema: { type: 'object', required: ['z_um'], properties: { z_um: { type: 'number' } } },
        run: function (a) { var z = num(a, 'z_um'); if (z < 0 || z > 300) throw new Error('z = ' + z.toFixed(1) + ' is outside 0.0-300.0 um (objective could hit the sample)'); st.z = z; return { z_um: z }; } },
      measure_sharpness: { description: 'Capture an image and return its sharpness from 0 (blurry) to 1 (in focus).', inputSchema: { type: 'object', properties: {} },
        run: function () { var d = (st.z - (120 + 0.004 * st.x - 0.002 * st.y)) / 15; return { sharpness: Math.round(AG.clamp(Math.exp(-d * d) + 0.01 * gauss(), 0, 1) * 1e4) / 1e4, z_um: st.z }; } },
    };
    function num(a, k) { if (!(k in a)) throw new Error("'" + k + "'"); var v = a[k]; if (typeof v === 'boolean' || v === null || isNaN(parseFloat(v))) throw new Error("could not convert '" + v + "' to float"); return parseFloat(v); }
    var SUP = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
    return {
      handle: function (msg) {
        var method = msg.method, params = msg.params || {}, id = msg.id;
        if (id === undefined || id === null) return null;   // notification
        var res;
        if (method === 'initialize') res = { protocolVersion: SUP.indexOf(params.protocolVersion) >= 0 ? params.protocolVersion : SUP[0], capabilities: { tools: {} }, serverInfo: { name: 'microscope-from-scratch', version: '0.1.0' } };
        else if (method === 'ping') res = {};
        else if (method === 'tools/list') res = { tools: Object.keys(tools).map(function (n) { return { name: n, description: tools[n].description, inputSchema: tools[n].inputSchema }; }) };
        else if (method === 'tools/call') {
          var t = tools[params.name];
          if (!t) return { jsonrpc: '2.0', id: id, error: { code: -32602, message: 'Unknown tool: ' + params.name } };
          try { res = { content: [{ type: 'text', text: JSON.stringify(t.run(params.arguments || {})) }], isError: false }; }
          catch (e) { res = { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }; }
        } else return { jsonrpc: '2.0', id: id, error: { code: -32601, message: 'Method not found: ' + method } };
        return { jsonrpc: '2.0', id: id, result: res };
      },
      state: st,
    };
  }
  AG.mcpServer = Server;
  var PRE = [
    ['1. initialize', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'my-agent', version: '0.1' } } }],
    ['2. notifications/initialized', { jsonrpc: '2.0', method: 'notifications/initialized' }],
    ['3. tools/list', { jsonrpc: '2.0', id: 2, method: 'tools/list' }],
    ['tools/call get_status', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_status', arguments: {} } }],
    ['tools/call set_focus 120', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'set_focus', arguments: { z_um: 120 } } }],
    ['tools/call measure_sharpness', { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'measure_sharpness', arguments: {} } }],
    ['tools/call set_focus 900 (invalid)', { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'set_focus', arguments: { z_um: 900 } } }],
    ['tools/call move_stage', { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'move_stage', arguments: { x_um: 2000, y_um: -1000 } } }],
    ['unknown method', { jsonrpc: '2.0', id: 8, method: 'resources/subscribe' }],
  ];
  AG.widget('mcpwire', function (root) {
    var server = Server();
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'An MCP session, one JSON-RPC message at a time' }), h('span', { text: 'Client (you) → stdin of the server; server stdout → client.' })]));
    var pick = h('select', { 'aria-label': 'Preset message' });
    PRE.forEach(function (p, i) { pick.appendChild(h('option', { value: i, text: p[0] })); });
    var ta = h('textarea', { rows: 6, 'aria-label': 'JSON-RPC request', spellcheck: 'false' });
    var bSend = h('button', { type: 'button', class: 'primary', text: 'Send →' }), bNext = h('button', { type: 'button', text: 'Next preset' });
    var lane = h('div', { style: 'position:relative;height:36px;border-radius:18px;background:var(--surface-2);border:1px solid var(--line);overflow:hidden' });
    var env = h('div', { style: 'position:absolute;top:5px;left:6px;padding:2px 10px;border-radius:12px;background:var(--accent);color:var(--accent-ink);font:700 12px ui-monospace,Menlo,monospace;transition:left .6s ease', text: '{…}' });
    lane.appendChild(env);
    lane.appendChild(h('span', { style: 'position:absolute;left:12px;bottom:-1px;font-size:10px;color:var(--muted)', text: 'client' }));
    lane.appendChild(h('span', { style: 'position:absolute;right:12px;bottom:-1px;font-size:10px;color:var(--muted)', text: 'server' }));
    var grid = h('div', { class: 'w-grid2 even' });
    var left = h('div', { style: 'display:grid;gap:8px;align-content:start' }, [h('div', { class: 'w-row' }, [pick, bNext]), ta, h('div', { class: 'w-row' }, [bSend])]);
    var resp = h('div', { class: 'log', style: 'height:250px' });
    var right = h('div', { style: 'display:grid;gap:8px;align-content:start' }, [h('div', { class: 'w-lab', text: 'Server responses (stdout)' }), resp]);
    grid.appendChild(left); grid.appendChild(right);
    root.appendChild(lane); root.appendChild(grid);
    var state = h('p', { class: 'w-note' }); root.appendChild(state);
    function load(i) { ta.value = JSON.stringify(PRE[i][1], null, 1); }
    function showState() { state.innerHTML = 'Instrument state: x = <b>' + server.state.x + '</b> µm, y = <b>' + server.state.y + '</b> µm, z = <b>' + server.state.z + '</b> µm. Best focus here ≈ ' + (120 + 0.004 * server.state.x - 0.002 * server.state.y).toFixed(1) + ' µm.'; }
    function send() {
      var raw = ta.value, msg, reply;
      try { msg = JSON.parse(raw); reply = server.handle(msg); }
      catch (e) { reply = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
      env.style.transition = AG.reduce ? 'none' : 'left .6s ease'; env.style.left = '6px'; env.style.background = 'var(--accent)'; env.textContent = (msg && msg.method) || '???';
      requestAnimationFrame(function () {
        env.style.left = 'calc(100% - ' + (env.offsetWidth + 6) + 'px)';
        setTimeout(function () {
          resp.appendChild(h('div', { class: 'per', text: '→ ' + JSON.stringify(msg || raw) }));
          if (reply) {
            env.style.background = reply.error || (reply.result && reply.result.isError) ? 'var(--bad)' : 'var(--env)'; env.textContent = 'reply';
            env.style.left = '6px';
            setTimeout(function () { resp.appendChild(h('div', { class: reply.error || (reply.result && reply.result.isError) ? 'err' : 'ok', text: '← ' + JSON.stringify(reply) })); resp.scrollTop = resp.scrollHeight; showState(); }, AG.reduce ? 0 : 600);
          } else { resp.appendChild(h('div', { class: 'dim', text: '   (notification: the server never replies; it logs to stderr)' })); resp.scrollTop = resp.scrollHeight; }
        }, AG.reduce ? 0 : 650);
      });
    }
    pick.addEventListener('change', function () { load(+pick.value); });
    bNext.addEventListener('click', function () { pick.value = String((+pick.value + 1) % PRE.length); load(+pick.value); });
    bSend.addEventListener('click', send);
    load(0); showState();
  });

  /* ================================================================ microscope + autofocus agent */
  AG.widget('microscope', function (root) {
    var st = { x: 0, y: 0, z: 50 }, ref = null, busy = false, pts = [];
    function best() { return 120 + 0.004 * st.x - 0.002 * st.y; }
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Simulated microscope' }), h('span', { text: 'Stage ±5000 µm, focus 0–300 µm. Sharpness is measured from the pixels.' })]));
    var grid = h('div', { class: 'w-grid2 even' }), st1 = h('div', { class: 'w-stage', style: 'background:#000' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(st1); grid.appendChild(side); root.appendChild(grid);
    var V = AG.canvas(st1, 1, function () { render(); });
    // the sample: a texture of "cells", drawn once
    var TEX = 640, tex = document.createElement('canvas'); tex.width = tex.height = TEX;
    (function paint() {
      var c = tex.getContext('2d'), r = AG.rng(21);
      c.fillStyle = '#f3e8f1'; c.fillRect(0, 0, TEX, TEX);
      for (var i = 0; i < 70; i++) {
        var x = r() * TEX, y = r() * TEX, rad = 14 + r() * 26;
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          var cx = x + dx * TEX, cy = y + dy * TEX;
          c.fillStyle = 'rgba(214,120,170,' + (0.35 + r() * 0.3) + ')'; c.beginPath(); c.ellipse(cx, cy, rad, rad * (0.7 + r() * 0.3), r() * 3, 0, 7); c.fill();
          c.strokeStyle = 'rgba(120,40,100,.7)'; c.lineWidth = 2; c.stroke();
          c.fillStyle = 'rgba(70,40,140,.85)'; c.beginPath(); c.arc(cx + rad * .15, cy - rad * .1, rad * .3, 0, 7); c.fill();
        }
      }
      for (i = 0; i < 900; i++) { c.fillStyle = 'rgba(90,40,90,' + r() * .5 + ')'; c.fillRect(r() * TEX, r() * TEX, 1.5, 1.5); }
    })();
    var small = document.createElement('canvas');
    function render() {
      var ctx = V.ctx, W = V.W, H = V.H;
      var d = Math.abs(st.z - best()), s = 1 + d / 5;            // blur grows with defocus
      var sw = Math.max(4, Math.round(W / s)), sh = Math.max(4, Math.round(H / s));
      small.width = sw; small.height = sh;
      var sc = small.getContext('2d'), ox = ((st.x * 0.05) % TEX + TEX) % TEX, oy = ((-st.y * 0.05) % TEX + TEX) % TEX;
      sc.imageSmoothingEnabled = true;
      // tile the texture so the field of view can wrap
      for (var tx = -1; tx <= 1; tx++) for (var ty = -1; ty <= 1; ty++) sc.drawImage(tex, (tx * TEX - ox) * sw / W, (ty * TEX - oy) * sh / H, TEX * sw / W, TEX * sh / H);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H); ctx.drawImage(small, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H - 24, W, 24);
      ctx.fillStyle = '#fff'; ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.fillText('x=' + st.x.toFixed(0) + ' y=' + st.y.toFixed(0) + ' z=' + st.z.toFixed(1) + ' µm', 8, H - 8);
    }
    function lapVar() {
      // variance of the Laplacian on the grayscale image: a standard focus measure
      var c = V.cv, ctx = c.getContext('2d'), w = Math.min(c.width, 300), hh = Math.min(c.height - 40, 300);
      var x0 = Math.floor((c.width - w) / 2), y0 = Math.floor((c.height - 40 - hh) / 2), img = ctx.getImageData(x0, y0, w, hh).data, g = new Float32Array(w * hh);
      for (var i = 0; i < w * hh; i++) g[i] = 0.299 * img[4 * i] + 0.587 * img[4 * i + 1] + 0.114 * img[4 * i + 2];
      var sum = 0, sum2 = 0, n = 0;
      for (var y = 1; y < hh - 1; y++) for (var x = 1; x < w - 1; x++) { var k = y * w + x, L = g[k - 1] + g[k + 1] + g[k - w] + g[k + w] - 4 * g[k]; sum += L; sum2 += L * L; n++; }
      return sum2 / n - (sum / n) * (sum / n);
    }
    function sharpness() {
      render();
      if (ref === null) { var z0 = st.z; st.z = best(); render(); ref = lapVar(); st.z = z0; render(); }
      return Math.round(AG.clamp(lapVar() / ref, 0, 1) * 1e4) / 1e4;
    }
    // tools (same names, limits and messages as the MCP server)
    function tool(name, args) {
      try {
        var out;
        if (name === 'move_stage') { if (Math.abs(args.x_um) > 5000 || Math.abs(args.y_um) > 5000) throw new Error('(' + args.x_um + ', ' + args.y_um + ') is outside the stage limits'); st.x = +args.x_um; st.y = +args.y_um; ref = null; render(); out = { x_um: st.x, y_um: st.y }; }
        else if (name === 'set_focus') { if (!(args.z_um >= 0 && args.z_um <= 300)) throw new Error('z = ' + (+args.z_um).toFixed(1) + ' is outside 0.0-300.0 um (objective could hit the sample)'); st.z = +args.z_um; render(); out = { z_um: st.z }; }
        else if (name === 'measure_sharpness') { out = { sharpness: sharpness(), z_um: st.z }; pts.push([st.z, out.sharpness]); chart(); }
        else out = { x_um: st.x, y_um: st.y, z_um: st.z };
        log('act', name + '(' + JSON.stringify(args) + ') → ' + JSON.stringify(out));
        return out;
      } catch (e) { log('err', name + '(' + JSON.stringify(args) + ') → Error: ' + e.message); return { error: e.message }; }
    }
    var xIn = h('input', { type: 'number', value: 0, step: 500, style: 'width:90px', 'aria-label': 'x µm' }), yIn = h('input', { type: 'number', value: 0, step: 500, style: 'width:90px', 'aria-label': 'y µm' });
    var zIn = h('input', { type: 'range', min: 0, max: 300, step: 0.5, value: 50 }), zOut = h('output', { text: '50.0' });
    zIn.addEventListener('input', function () { zOut.textContent = (+zIn.value).toFixed(1); });
    var bMove = h('button', { type: 'button', class: 'small mono', text: 'move_stage' }), bFocus = h('button', { type: 'button', class: 'small mono', text: 'set_focus' }), bMeas = h('button', { type: 'button', class: 'small mono', text: 'measure_sharpness' });
    var bAgent = h('button', { type: 'button', class: 'primary', text: 'Run autofocus agent' }), bTilt = h('button', { type: 'button', text: 'Autofocus at 3 positions' }), bBad = h('button', { type: 'button', text: 'Ask for z = 400' });
    side.appendChild(h('div', { class: 'w-lab', text: 'Tools (by hand)' }));
    side.appendChild(h('div', { class: 'w-row' }, [h('label', { class: 'w-note' }, ['x ', xIn]), h('label', { class: 'w-note' }, ['y ', yIn]), bMove]));
    side.appendChild(h('div', { class: 'w-row' }, [h('label', { class: 'ctl', style: 'min-width:160px' }, [h('span', { class: 'row' }, ['z (µm)', zOut]), zIn]), bFocus, bMeas]));
    side.appendChild(h('div', { class: 'w-lab', text: 'Agent' }));
    side.appendChild(h('div', { class: 'w-row' }, [bAgent, bTilt, bBad]));
    var chartBox = h('div', { class: 'w-stage', style: 'background:var(--surface)' }); side.appendChild(chartBox);
    var CH = AG.canvas(chartBox, 0.42, function () { chart(); });
    var logBox = h('div', { class: 'log', style: 'height:180px' }); root.appendChild(logBox);
    function log(cls, t) { logBox.appendChild(h('div', { class: cls, text: t })); logBox.scrollTop = logBox.scrollHeight; }
    function chart() {
      var ctx = CH.ctx, W = CH.W, H = CH.H, pad = 26;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = AG.css('--line'); ctx.beginPath(); ctx.moveTo(pad, 6); ctx.lineTo(pad, H - pad); ctx.lineTo(W - 6, H - pad); ctx.stroke();
      ctx.fillStyle = AG.css('--muted'); ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillText('sharpness vs z (µm)', pad + 6, 14); ctx.fillText('0', pad - 2, H - 12); ctx.fillText('300', W - 28, H - 12);
      pts.forEach(function (p, i) {
        ctx.fillStyle = i === pts.length - 1 ? AG.css('--warm') : AG.css('--accent');
        ctx.beginPath(); ctx.arc(pad + (W - pad - 6) * p[0] / 300, H - pad - (H - pad - 10) * p[1], 3.5, 0, 7); ctx.fill();
      });
    }
    bMove.addEventListener('click', function () { tool('move_stage', { x_um: +xIn.value, y_um: +yIn.value }); pts = []; chart(); });
    bFocus.addEventListener('click', function () { tool('set_focus', { z_um: +zIn.value }); });
    bMeas.addEventListener('click', function () { tool('measure_sharpness', {}); });
    bBad.addEventListener('click', function () { log('think', 'agent: The sample might be higher up; trying z = 400.'); tool('set_focus', { z_um: 400 }); log('think', 'agent: That is outside the focus range (0–300 µm). I will stay within the limits.'); });
    function wait() { return AG.wait(140); }
    async function autofocus() {
      pts = []; chart();
      log('think', 'agent: Coarse sweep first: 11 measurements from z = 0 to 300 µm.');
      var bestZ = 0, bestS = -1;
      for (var z = 0; z <= 300; z += 30) { tool('set_focus', { z_um: z }); var r = tool('measure_sharpness', {}); if (r.sharpness > bestS) { bestS = r.sharpness; bestZ = z; } await wait(); }
      var lo = Math.max(0, bestZ - 30), hi = Math.min(300, bestZ + 30), g = 0.618;
      log('think', 'agent: Best coarse value at z = ' + bestZ + ' (sharpness ' + bestS.toFixed(3) + '). Refining between ' + lo + ' and ' + hi + ' µm by golden-section search.');
      var a = hi - g * (hi - lo), b = lo + g * (hi - lo);
      tool('set_focus', { z_um: +a.toFixed(1) }); var fa = tool('measure_sharpness', {}).sharpness; await wait();
      tool('set_focus', { z_um: +b.toFixed(1) }); var fb = tool('measure_sharpness', {}).sharpness; await wait();
      for (var k = 0; k < 9; k++) {
        if (fa > fb) { hi = b; b = a; fb = fa; a = hi - g * (hi - lo); tool('set_focus', { z_um: +a.toFixed(1) }); fa = tool('measure_sharpness', {}).sharpness; }
        else { lo = a; a = b; fa = fb; b = lo + g * (hi - lo); tool('set_focus', { z_um: +b.toFixed(1) }); fb = tool('measure_sharpness', {}).sharpness; }
        await wait();
      }
      var zf = +((lo + hi) / 2).toFixed(1);
      tool('set_focus', { z_um: zf }); var final = tool('measure_sharpness', {});
      zIn.value = zf; zOut.textContent = zf.toFixed(1);
      log('ok', 'agent: In focus at z = ' + zf + ' µm (sharpness ' + final.sharpness.toFixed(3) + ') after ' + pts.length + ' measurements. (True best focus here: ' + best().toFixed(1) + ' µm.)');
      return zf;
    }
    bAgent.addEventListener('click', async function () { if (busy) return; busy = true; try { await autofocus(); } finally { busy = false; } });
    bTilt.addEventListener('click', async function () {
      if (busy) return; busy = true;
      try {
        var found = [];
        for (var x of [-3000, 0, 3000]) { log('think', 'agent: Moving to x = ' + x + ' µm and focusing there.'); tool('move_stage', { x_um: x, y_um: 0 }); xIn.value = x; found.push([x, await autofocus()]); }
        var slope = (found[2][1] - found[0][1]) / 6000;
        log('ok', 'agent: Best focus at x = −3000, 0, 3000: ' + found.map(function (f) { return f[1]; }).join(', ') + ' µm. The sample is tilted by about ' + (slope * 1000).toFixed(1) + ' µm per mm along x.');
      } finally { busy = false; }
    });
    render(); chart();
    log('dim', 'Tools: move_stage(x_um, y_um), set_focus(z_um), measure_sharpness(). Same limits as the MCP server.');
  });
})();
