/* Lesson 07 widgets: agentsim (replay of mini_agent.py --offline), toolschema, contextsim */
(function () {
  'use strict';
  var h = AG.h;

  /* ================================================================ agentsim */
  var CALC = 'def add(a, b):\n    return a + b\n\n\ndef mean(xs):\n    return sum(xs) / 2\n';
  var TEST = 'from calc import add, mean\n\nassert add(2, 3) == 5\nassert mean([2, 4]) == 3\nassert mean([1, 2, 3]) == 2, f"mean([1, 2, 3]) returned {mean([1, 2, 3])}"\nprint("all tests passed")\n';
  var FIXED = 'def add(a, b):\n    return a + b\n\n\ndef mean(xs):\n    return sum(xs) / len(xs)\n';
  var TURNS = [
    { text: "I'll look at the project first.", calls: [['list_files', {}, 'calc.py\ntest_calc.py']] },
    { text: 'Let me read the code and the tests.', calls: [['read_file', { path: 'calc.py' }, CALC], ['read_file', { path: 'test_calc.py' }, TEST]] },
    { text: 'Running the tests to see what fails.', calls: [['run_python', { path: 'test_calc.py' }, 'exit code 1\nTraceback (most recent call last):\n  File "test_calc.py", line 5, in <module>\n    assert mean([1, 2, 3]) == 2, f"mean([1, 2, 3]) returned {mean([1, 2, 3])}"\nAssertionError: mean([1, 2, 3]) returned 3.0']] },
    { text: '`mean` divides by a hard-coded 2. It should divide by len(xs). Fixing it.', calls: [['write_file', { path: 'calc.py', content: FIXED }, 'wrote 77 characters to calc.py']] },
    { text: 'Re-running the tests.', calls: [['run_python', { path: 'test_calc.py' }, 'exit code 0\nall tests passed']] },
    { text: 'Done. `mean()` in calc.py divided by 2 instead of by the number of values; it now uses len(xs), and all tests pass.', calls: [] },
  ];
  var NEEDS = { write_file: true, run_python: true };
  var TASK = 'The tests in test_calc.py fail. Find the bug and fix it.';
  var SYS_TOKENS = 420;   // rough size of the system prompt + 4 tool schemas

  AG.widget('agentsim', function (root) {
    var code = document.getElementById('loopcode');
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'mini_agent.py, one phase at a time' }), h('span', { text: 'Left: the terminal and the messages list. Right: the code running now (highlighted).' })]));
    var bStep = h('button', { type: 'button', class: 'primary', text: 'Step' }), bAuto = h('button', { type: 'button', text: 'Auto ▶' }), bReset = h('button', { type: 'button', text: 'Restart' });
    var approveRow = h('div', { class: 'w-row', hidden: true }, [h('span', { class: 'pill warn', text: 'Permission needed' }), h('button', { type: 'button', class: 'primary', text: 'Allow', 'data-a': 'y' }), h('button', { type: 'button', text: 'Deny', 'data-a': 'n' })]);
    root.appendChild(h('div', { class: 'w-row' }, [bStep, bAuto, bReset, approveRow]));
    var grid = h('div', { class: 'w-grid2 even' }), left = h('div', { style: 'display:grid;gap:10px;align-content:start;min-width:0' }), right = h('div', { style: 'min-width:0;display:grid;gap:8px;align-content:start' });
    grid.appendChild(left); grid.appendChild(right); root.appendChild(grid);
    var term = h('div', { class: 'log', style: 'height:230px' });
    var phase = h('p', { class: 'w-note' });
    var meter = h('div', { class: 'readout' });
    var msgs = h('div', { class: 'log', style: 'height:260px;background:var(--page);color:var(--ink);border:1px solid var(--line)' });
    left.appendChild(h('div', { class: 'w-lab', text: 'Terminal' })); left.appendChild(term);
    left.appendChild(h('div', { class: 'w-lab', text: 'messages (sent with every request)' })); left.appendChild(msgs);
    right.appendChild(phase); right.appendChild(meter);
    if (code) { code.style.margin = '0'; right.appendChild(code); }
    var st, timer = null;
    function reset() {
      st = { turn: 0, phase: 'start', messages: [{ role: 'user', content: TASK }], callIdx: 0, results: [], waiting: false, denied: false, requests: 0, processed: 0, done: false, newIdx: 0 };
      term.innerHTML = ''; line('dim', '$ python mini_agent.py --offline'); approveRow.hidden = true;
      show('Start: the conversation is just the task.', 215, 215);
    }
    function line(cls, t) { term.appendChild(h('div', { class: cls, text: t })); term.scrollTop = term.scrollHeight; }
    function tokens(m) { return Math.round(JSON.stringify(m).length / 4); }
    function show(text, a, b) {
      phase.innerHTML = text;
      if (code) AG.markLines(code, a, b);
      renderMsgs();
      var ctx = SYS_TOKENS + tokens(st.messages);
      meter.innerHTML = '';
      [[st.turn, 'model calls'], ['≈ ' + ctx.toLocaleString(), 'tokens in next request'], ['≈ ' + st.processed.toLocaleString(), 'input tokens so far']].forEach(function (r) { meter.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })])); });
    }
    function short(s, n) { s = String(s).replace(/\n/g, '\\n'); return s.length > n ? s.slice(0, n) + '…' : s; }
    function renderMsgs() {
      msgs.innerHTML = '';
      st.messages.forEach(function (m, i) {
        var txt;
        if (typeof m.content === 'string') txt = '"' + short(m.content, 70) + '"';
        else txt = '[' + m.content.map(function (b) {
          if (b.type === 'text') return '{text: "' + short(b.text, 46) + '"}';
          if (b.type === 'tool_use') return '{tool_use: ' + b.name + '(' + short(JSON.stringify(b.input), 34) + ')}';
          return '{tool_result' + (b.is_error ? ' ERROR' : '') + ': "' + short(b.content, 40) + '"}';
        }).join(',\n    ') + ']';
        var el = h('div', { style: 'padding:3px 0;border-bottom:1px dashed var(--line)' + (i >= st.newIdx ? ';background:var(--accent-soft)' : ''), text: i + ' ' + m.role + ': ' + txt });
        msgs.appendChild(el);
      });
      msgs.scrollTop = msgs.scrollHeight;
    }
    function step() {
      if (st.done || st.waiting) return;
      var T = TURNS[Math.min(st.turn, TURNS.length - 1)];
      if (st.phase === 'start' || st.phase === 'think') {
        // the model call
        st.processed += SYS_TOKENS + tokens(st.messages);
        var content;
        if (st.denied) { content = [{ type: 'text', text: "A tool was refused, so I'll stop here." }]; T = { text: content[0].text, calls: [] }; st.turnObj = T; }
        else { st.turnObj = T; content = [{ type: 'text', text: T.text }].concat(T.calls.map(function (c, j) { return { type: 'tool_use', id: 'toolu_' + st.turn + '_' + j, name: c[0], input: c[1] }; })); }
        st.newIdx = st.messages.length;
        st.messages.push({ role: 'assistant', content: content });
        st.turn++;
        st.phase = 'print';
        show('<b>THINK.</b> <code>brain.think(messages)</code> sends the whole list to the model; the reply (text' + (st.turnObj.calls.length ? ' + ' + st.turnObj.calls.length + ' tool call' + (st.turnObj.calls.length > 1 ? 's' : '') : '') + ') is appended as an assistant message.', 217, 218);
        return;
      }
      if (st.phase === 'print') {
        line('think', '[' + st.turn + '] agent: ' + st.turnObj.text);
        if (!st.turnObj.calls.length) { st.done = true; st.newIdx = st.messages.length; show('<b>DONE.</b> No tool calls in the reply, so <code>run_agent</code> returns. The agent has decided it is finished.', 224, 225); line('dim', '$'); return; }
        st.phase = 'tool'; st.callIdx = 0; st.results = [];
        show('<b>CHECK.</b> The reply contains tool calls, so the loop continues to the ACT phase.', 219, 225);
        return;
      }
      if (st.phase === 'tool') {
        var c = st.turnObj.calls[st.callIdx];
        line('act', '   -> ' + c[0] + '(' + short(JSON.stringify(c[1]), 60) + ')');
        if (NEEDS[c[0]]) {
          st.waiting = true; approveRow.hidden = false;
          show('<b>PERMISSION.</b> <code>' + c[0] + '</code> is in <code>NEEDS_APPROVAL</code>, so <code>approve()</code> asks the user. Allow or deny it above.', 207, 211);
          stop(); return;
        }
        runCall(c, true);
        return;
      }
      if (st.phase === 'results') {
        st.newIdx = st.messages.length;
        st.messages.push({ role: 'user', content: st.results });
        st.phase = 'think';
        show('<b>PERCEIVE.</b> All tool results go back in <b>one</b> user message. They are the agent\'s new percepts; next step the model reads them.', 239, 239);
      }
    }
    function runCall(c, allowed) {
      var r;
      if (allowed) { r = { type: 'tool_result', tool_use_id: 'toolu_' + (st.turn - 1) + '_' + st.callIdx, content: c[2], is_error: false }; line('', c[2].split('\n').slice(0, 4).map(function (l) { return '      ' + l; }).join('\n') + (c[2].split('\n').length > 4 ? '\n      …' : '')); }
      else { r = { type: 'tool_result', tool_use_id: 'toolu_' + (st.turn - 1) + '_' + st.callIdx, content: 'The user did not allow this action.', is_error: true }; line('err', '      The user did not allow this action.'); st.denied = true; }
      st.results.push(r);
      st.callIdx++;
      if (st.callIdx >= st.turnObj.calls.length) st.phase = 'results';
      show(allowed ? '<b>ACT.</b> <code>run_tool()</code> executes <code>' + c[0] + '</code> inside the sandbox; the output becomes a <code>tool_result</code> (collected in <code>results</code>).' : '<b>DENIED.</b> The harness does not run the tool. It records an error result instead, so the model learns what happened.', allowed ? 232 : 229, allowed ? 237 : 231);
    }
    approveRow.addEventListener('click', function (ev) {
      var a = ev.target.getAttribute && ev.target.getAttribute('data-a'); if (!a || !st.waiting) return;
      st.waiting = false; approveRow.hidden = true;
      line('dim', '   allow? ' + (a === 'y' ? 'y' : 'N'));
      runCall(st.turnObj.calls[st.callIdx], a === 'y');
    });
    function stop() { if (timer) { clearInterval(timer); timer = null; bAuto.textContent = 'Auto ▶'; } }
    bStep.addEventListener('click', function () { stop(); step(); });
    bAuto.addEventListener('click', function () { if (timer) { stop(); return; } bAuto.textContent = 'Pause ❚❚'; timer = setInterval(function () { if (st.done) { stop(); return; } step(); }, AG.reduce ? 300 : 1300); });
    bReset.addEventListener('click', function () { stop(); reset(); });
    reset();
  });

  /* ================================================================ tool designer */
  AG.widget('toolschema', function (root) {
    var T = { name: 'move_stage', desc: 'Move the microscope stage to an absolute position in micrometres. Limits: |x|, |y| <= 5000. Returns the new position.', params: [
      { n: 'x_um', t: 'number', r: true, d: 'Target x position in micrometres' }, { n: 'y_um', t: 'number', r: true, d: 'Target y position in micrometres' }] };
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Tool designer' }), h('span', { text: 'Edit the tool; see the JSON the model receives, a Python handler stub, and design warnings.' })]));
    var nameIn = h('input', { type: 'text', value: T.name, 'aria-label': 'Tool name', style: 'min-width:200px' });
    var descIn = h('textarea', { rows: 2, 'aria-label': 'Tool description' }); descIn.value = T.desc;
    var pBox = h('div', { style: 'display:grid;gap:6px' });
    var bAdd = h('button', { type: 'button', class: 'small', text: '+ parameter' });
    var presets = h('div', { class: 'w-row' });
    [['Good: move_stage', T], ['Vague: do_it', { name: 'do_it', desc: 'does stuff', params: [{ n: 'x', t: 'string', r: false, d: '' }] }],
      ['Robot: drive', { name: 'drive', desc: 'Drive straight. Positive = forward, negative = backward, in centimetres. At most 100 cm per call; refused if an obstacle is closer.', params: [{ n: 'cm', t: 'number', r: true, d: 'Distance in cm, -100 to 100' }] }]].forEach(function (p) {
      var b = h('button', { type: 'button', class: 'small', text: p[0] }); b.addEventListener('click', function () { T = JSON.parse(JSON.stringify(p[1])); nameIn.value = T.name; descIn.value = T.desc; drawParams(); out(); }); presets.appendChild(b);
    });
    root.appendChild(presets);
    root.appendChild(h('label', { class: 'ctl' }, [h('span', { text: 'Name' }), nameIn]));
    root.appendChild(h('label', { class: 'ctl' }, [h('span', { text: 'Description (the model reads this to decide when to call the tool)' }), descIn]));
    root.appendChild(h('div', { class: 'w-lab', text: 'Parameters' })); root.appendChild(pBox); root.appendChild(h('div', { class: 'w-row' }, [bAdd]));
    var warn = h('div', { style: 'display:grid;gap:4px' }); root.appendChild(warn);
    var grid = h('div', { class: 'w-grid2 even' }), j1 = h('div', { class: 'code', 'data-lang': 'json' }, [h('div', { class: 'code-head' }, [h('span', { class: 'fname', text: 'tools=[ ... ] entry (Messages API)' })]), h('pre')]);
    var j2 = h('div', { class: 'code', 'data-lang': 'python' }, [h('div', { class: 'code-head' }, [h('span', { class: 'fname', text: 'handler stub (your code)' })]), h('pre')]);
    grid.appendChild(j1); grid.appendChild(j2); root.appendChild(grid);
    function drawParams() {
      pBox.innerHTML = '';
      T.params.forEach(function (p, i) {
        var n = h('input', { type: 'text', value: p.n, 'aria-label': 'Parameter name', style: 'width:120px' }), t = h('select', { 'aria-label': 'Type' }), r = h('input', { type: 'checkbox', checked: p.r }), d = h('input', { type: 'text', value: p.d, 'aria-label': 'Parameter description', style: 'flex:1;min-width:160px' }), x = h('button', { type: 'button', class: 'small', text: '✕' });
        ['string', 'number', 'integer', 'boolean'].forEach(function (o) { var op = h('option', { value: o, text: o }); if (o === p.t) op.selected = true; t.appendChild(op); });
        n.addEventListener('input', function () { p.n = n.value; out(); }); t.addEventListener('change', function () { p.t = t.value; out(); }); r.addEventListener('change', function () { p.r = r.checked; out(); }); d.addEventListener('input', function () { p.d = d.value; out(); });
        x.addEventListener('click', function () { T.params.splice(i, 1); drawParams(); out(); });
        pBox.appendChild(h('div', { class: 'w-row' }, [n, t, h('label', { class: 'w-note' }, [r, ' required']), d, x]));
      });
    }
    function setCode(box, text, lang) { box.querySelector('pre').innerHTML = text.split('\n').map(function (l, i) { return '<span class="ln" data-n="' + (i + 1) + '">' + AG.highlight(l, lang) + '</span>'; }).join(''); }
    function out() {
      T.name = nameIn.value.trim(); T.desc = descIn.value.trim();
      var props = {}, req = [];
      T.params.forEach(function (p) { if (!p.n) return; props[p.n] = { type: p.t }; if (p.d) props[p.n].description = p.d; if (p.r) req.push(p.n); });
      var tool = { name: T.name, description: T.desc, input_schema: { type: 'object', properties: props, required: req, additionalProperties: false } };
      setCode(j1, JSON.stringify(tool, null, 2), 'json');
      var pyT = { string: 'str', number: 'float', integer: 'int', boolean: 'bool' };
      var sig = T.params.filter(function (p) { return p.n; }).map(function (p) { return p.n + ': ' + pyT[p.t] + (p.r ? '' : ' = None'); }).join(', ');
      setCode(j2, ['def ' + (T.name || 'tool') + '(' + sig + ') -> str:', '    """' + (T.desc || 'TODO: describe the tool') + '"""', '    # 1. validate every input against hard limits (raise or return an error message)', '    # 2. do the action (call a driver, an API, a file...)', '    # 3. return a short, informative result for the model', '    return "ok"', '', '', '# in the loop: if block.name == "' + T.name + '": result = ' + (T.name || 'tool') + '(**block.input)'].join('\n'), 'python');
      var w = [];
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(T.name)) w.push(['bad', 'Name must be 1–64 letters, digits, _ or -.']);
      if (/^(do|run|tool|func|stuff|thing|do_it|helper)/i.test(T.name)) w.push(['warn', 'Vague name: the model chooses tools by name. Say what it acts on: read_file, move_stage.']);
      if (T.desc.length < 40) w.push(['warn', 'Short description. Say what it does, when to use it, units and limits, and what it returns.']);
      if (!/limit|max|at most|between|<=|refus/i.test(T.desc) && T.params.some(function (p) { return p.t === 'number' || p.t === 'integer'; })) w.push(['warn', 'Numeric inputs without stated limits. State them, and enforce them in the handler.']);
      T.params.forEach(function (p) { if (p.n && !p.d) w.push(['warn', 'Parameter "' + p.n + '" has no description.']); if (p.n && p.n.length < 2) w.push(['warn', 'Parameter "' + p.n + '": one-letter names are ambiguous.']); });
      if (!req.length && T.params.length) w.push(['warn', 'Nothing is required: the model may omit inputs you need.']);
      warn.innerHTML = '';
      if (!w.length) warn.appendChild(h('p', { class: 'w-note' }, [h('span', { class: 'pill ok', text: 'Looks good' }), ' Clear name, a description with limits, typed and described parameters.']));
      w.forEach(function (x) { warn.appendChild(h('p', { class: 'w-note' }, [h('span', { class: 'pill ' + x[0], text: x[0] === 'bad' ? 'Error' : 'Tip' }), ' ' + x[1]])); });
    }
    nameIn.addEventListener('input', out); descIn.addEventListener('input', out);
    bAdd.addEventListener('click', function () { T.params.push({ n: 'param' + (T.params.length + 1), t: 'string', r: false, d: '' }); drawParams(); out(); });
    drawParams(); out();
  });

  /* ================================================================ context-window simulator */
  var FACTS = [
    { turn: 1, text: 'The user wants tabs, not spaces', where: 'user', imp: true },
    { turn: 2, text: 'Never touch the folder data/raw/', where: 'user', imp: true },
    { turn: 4, text: 'config.yaml sets timeout = 30', where: 'tool', imp: false },
    { turn: 6, text: 'The failing test is test_parse_dates', where: 'tool', imp: true },
    { turn: 9, text: 'The user prefers small commits', where: 'user', imp: true },
    { turn: 12, text: 'utils.py has a helper slugify()', where: 'tool', imp: false },
    { turn: 15, text: 'The bug is in parse_dates() line 88', where: 'tool', imp: true },
  ];
  AG.widget('contextsim', function (root) {
    var strategy = 'none', limit = 60, N = 24;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Context window simulator' }), h('span', { text: N + ' turns. Each block is a message; height ∝ tokens (tool results are big).' })]));
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Strategy' });
    [['none', 'Keep everything'], ['truncate', 'Truncate oldest'], ['clear', 'Clear old tool results'], ['compact', 'Compaction (summary)']].forEach(function (s) {
      var b = h('button', { type: 'button', text: s[1], 'aria-pressed': String(s[0] === strategy) });
      b.addEventListener('click', function () { strategy = s[0]; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); draw(); });
      seg.appendChild(b);
    });
    var lim = h('input', { type: 'range', min: 25, max: 120, value: limit }), limO = h('output', { text: limit + ' k' });
    lim.addEventListener('input', function () { limit = +lim.value; limO.textContent = limit + ' k'; draw(); });
    root.appendChild(h('div', { class: 'w-row' }, [seg, h('label', { class: 'ctl' }, [h('span', { class: 'row' }, ['Context limit (thousand tokens)', limO]), lim])]));
    var bar = h('div', { style: 'display:flex;align-items:flex-end;gap:2px;height:150px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--page);position:relative;overflow:hidden' });
    root.appendChild(bar);
    var grid = h('div', { class: 'w-grid2 even' }), facts = h('div', { style: 'display:grid;gap:5px' }), info = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(h('div', null, [h('div', { class: 'w-lab', text: 'Does the agent still know…?' }), facts])); grid.appendChild(info); root.appendChild(grid);
    // the session: each turn = user msg (small) + assistant (small) + tool result (big)
    var r = AG.rng(2), msgs = [];
    for (var t = 1; t <= N; t++) {
      msgs.push({ turn: t, kind: 'user', tok: 0.3 + r() * 0.5 }, { turn: t, kind: 'assistant', tok: 0.4 + r() * 0.6 }, { turn: t, kind: 'tool', tok: 1.5 + r() * 4 });
    }
    function apply() {
      var total = function (L) { return L.reduce(function (a, m) { return a + m.tok; }, 0); };
      var L = msgs.map(function (m) { return Object.assign({}, m); }), events = [];
      if (strategy === 'none') return { L: L, events: total(L) > limit ? ['Over the limit: the request fails (or the oldest content is silently cut).'] : [] };
      if (strategy === 'truncate') { while (total(L) > limit) { L.shift(); } events.push('Dropped all messages before turn ' + L[0].turn + '.'); return { L: L, events: events }; }
      if (strategy === 'clear') {
        for (var i = 0; i < L.length && total(L) > limit; i++) if (L[i].kind === 'tool' && !L[i].cleared) { L[i].cleared = true; L[i].tok = 0.1; }
        events.push('Replaced the oldest tool results with "[cleared: re-read if needed]".');
        while (total(L) > limit) L.shift();
        return { L: L, events: events };
      }
      // compaction: when over 80% of the limit, summarize everything so far into one block
      var out = [], summary = null;
      L.forEach(function (m) {
        out.push(m);
        if (total(out) > limit * 0.8) {
          var covered = out.filter(function (x) { return !x.summary; }).map(function (x) { return x.turn; });
          var upto = Math.max.apply(null, covered);
          var kept = FACTS.filter(function (f) { return f.turn <= upto && f.imp; }).map(function (f) { return f.text; });
          var prevKept = summary ? summary.kept : [];
          summary = { turn: upto, kind: 'summary', tok: 2.5, summary: true, kept: Array.from(new Set(prevKept.concat(kept))), upto: upto };
          out = [summary];
          events.push('Compacted turns 1–' + upto + ' into a summary.');
        }
      });
      return { L: out, events: events };
    }
    function knows(f, L) {
      for (var i = 0; i < L.length; i++) {
        var m = L[i];
        if (m.summary && m.kept.indexOf(f.text) >= 0) return 'summary';
        if (m.turn === f.turn && ((f.where === 'user' && m.kind === 'user') || (f.where === 'tool' && m.kind === 'tool' && !m.cleared))) return 'verbatim';
      }
      return null;
    }
    function draw() {
      var res = apply(), L = res.L, total = L.reduce(function (a, m) { return a + m.tok; }, 0);
      bar.innerHTML = '';
      var col = { user: 'var(--accent)', assistant: 'var(--warm)', tool: 'var(--env)', summary: 'var(--info)' };
      L.forEach(function (m) {
        bar.appendChild(h('div', { title: (m.summary ? 'summary of turns 1–' + m.upto : 'turn ' + m.turn + ' ' + m.kind) + ' · ' + m.tok.toFixed(1) + 'k tokens', style: 'flex:1 1 0;min-width:2px;border-radius:3px 3px 0 0;height:' + Math.min(100, m.tok * 22) + '%;background:' + col[m.kind] + ';opacity:' + (m.cleared ? .25 : .85) }));
      });
      var over = total > limit;
      bar.appendChild(h('div', { style: 'position:absolute;left:8px;top:6px;font:600 12px ui-monospace,Menlo,monospace;color:' + (over ? 'var(--bad)' : 'var(--muted)'), text: total.toFixed(0) + 'k of ' + limit + 'k tokens' + (over ? ' — OVER LIMIT' : '') }));
      facts.innerHTML = '';
      FACTS.forEach(function (f) {
        var k = over && strategy === 'none' ? null : knows(f, L);
        facts.appendChild(h('div', { class: 'w-note', style: 'display:flex;gap:8px;align-items:center' }, [h('span', { class: 'pill ' + (k === 'verbatim' ? 'ok' : k === 'summary' ? 'warn' : 'bad'), text: k === 'verbatim' ? 'verbatim' : k === 'summary' ? 'in summary' : 'forgotten' }), h('span', { text: 'turn ' + f.turn + ' (' + (f.where === 'user' ? 'user said' : 'tool output') + '): ' + f.text })]));
      });
      info.innerHTML = '';
      info.appendChild(h('div', { class: 'w-note', html: '<span style="color:var(--accent)">■</span> user &nbsp;<span style="color:var(--warm)">■</span> assistant &nbsp;<span style="color:var(--env)">■</span> tool result &nbsp;<span style="color:var(--info)">■</span> summary' }));
      res.events.forEach(function (e) { info.appendChild(h('p', { class: 'w-note', text: '• ' + e })); });
      info.appendChild(h('p', { class: 'w-note', html: { none: 'Simple and lossless, until it does not fit.', truncate: 'Cheap, but the task\'s early instructions disappear first, which is exactly what you do not want to forget.', clear: 'Instructions survive; bulky outputs go. Facts that only lived in an old tool result are gone, but the agent could re-read the file.', compact: 'Keeps what the summary judged important, loses the rest. A good summary prompt decides what survives.' }[strategy] }));
    }
    draw();
  });

  /* ================================================================ live agent: real Claude, tools run in this browser */
  var LIVE_TOOLS = [
    { name: 'list_files', description: 'List the files in the project workspace.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'read_file', description: 'Read a text file from the workspace. Paths are relative to the workspace root.', input_schema: { type: 'object', properties: { path: { type: 'string', description: 'e.g. calc.py' } }, required: ['path'], additionalProperties: false } },
    { name: 'write_file', description: 'Create or overwrite a text file in the workspace with the full new contents.', input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false } },
    { name: 'run_python', description: 'Run a Python file from the workspace (for example the tests) and return its output.', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } },
  ];
  var LIVE_SYSTEM = 'You are a careful coding agent working in a small Python project.\nUse the tools to look before you change anything. After editing, run the tests to check your\nwork. When the task is done, reply with a short summary of what you changed and why.';
  var PROJECTS = {
    calc: { name: 'The calc.py bug (same as mini_agent.py)', task: 'The tests in test_calc.py fail. Find the bug and fix it.', files: { 'calc.py': CALC, 'test_calc.py': TEST } },
    stats: { name: 'Two bugs in stats.py', task: 'Make all tests in test_stats.py pass. Do not change the tests.',
      files: {
        'stats.py': 'def median(xs):\n    xs = sorted(xs)\n    n = len(xs)\n    return xs[n // 2]\n\n\ndef variance(xs):\n    m = sum(xs) / len(xs)\n    return sum((x - m) ** 2 for x in xs) / len(xs) - 1\n',
        'test_stats.py': 'from stats import median, variance\n\nassert median([3, 1, 2]) == 2\nassert median([4, 1, 3, 2]) == 2.5, f"median of an even list: got {median([4, 1, 3, 2])}"\nassert abs(variance([1, 2, 3, 4]) - 1.25) < 1e-9, f"population variance: got {variance([1, 2, 3, 4])}"\nprint("all tests passed")\n' } },
    feature: { name: 'Add a feature: word counter', task: 'Add a function top_words(text, n) to words.py that returns the n most common words (lowercase, ignoring punctuation) as a list of (word, count) pairs, most common first. Write tests for it in test_words.py and make them pass.',
      files: { 'words.py': '"""Small text utilities."""\n\n\ndef word_count(text):\n    return len(text.split())\n', 'test_words.py': 'from words import word_count\n\nassert word_count("an agent acts") == 3\nprint("all tests passed")\n' } },
  };
  AG.widget('liveagent', function (root) {
    var proj = 'calc', fs = {}, running = false, stopFlag = false, messages = [], usage = { in: 0, out: 0, calls: 0, cost: 0 }, pendingApproval = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'A live coding agent: real Claude, tools running in your browser' }), h('span', { text: 'The same loop and tools as mini_agent.py. The files live in this page; run_python runs them with Pyodide.' })]));
    AG.live.panel(root);
    var pick = h('select', { 'aria-label': 'Project' });
    Object.keys(PROJECTS).forEach(function (k) { pick.appendChild(h('option', { value: k, text: PROJECTS[k].name })); });
    var task = h('textarea', { rows: 2, 'aria-label': 'Task for the agent' });
    var auto = h('input', { type: 'checkbox' }), maxT = h('input', { type: 'number', value: 12, min: 1, max: 40, style: 'width:70px', 'aria-label': 'Max turns' });
    var bRun = h('button', { type: 'button', class: 'primary', text: '▶ Run agent' }), bStop = h('button', { type: 'button', text: '■ Stop', disabled: true }), bReset = h('button', { type: 'button', text: 'Reset files' });
    root.appendChild(h('div', { class: 'w-row' }, [h('span', { class: 'w-lab', text: 'Project' }), pick, bReset]));
    root.appendChild(h('label', { class: 'ctl' }, [h('span', { text: 'Task (edit it: ask for anything in this workspace)' }), task]));
    root.appendChild(h('div', { class: 'w-row' }, [bRun, bStop, h('label', { class: 'w-note' }, [auto, ' auto-approve writes and runs']), h('label', { class: 'w-note' }, ['max turns ', maxT])]));
    var grid = h('div', { class: 'w-grid2' }), left = h('div', { style: 'display:grid;gap:8px;min-width:0;align-content:start' }), right = h('div', { style: 'display:grid;gap:8px;min-width:0;align-content:start' });
    grid.appendChild(left); grid.appendChild(right); root.appendChild(grid);
    var transcript = h('div', { class: 'live-log' });
    var meter = h('div', { class: 'readout' });
    left.appendChild(h('div', { class: 'w-lab', text: 'Transcript' })); left.appendChild(transcript);
    right.appendChild(meter);
    var tabs = h('div', { class: 'seg', role: 'tablist' }), editor = h('textarea', { class: 'code-edit', spellcheck: 'false', style: 'min-height:260px;border-radius:10px', 'aria-label': 'File contents' });
    var curFile = null;
    right.appendChild(h('div', { class: 'w-lab', text: 'Workspace (you can edit files too)' })); right.appendChild(tabs); right.appendChild(editor);
    var bMsgs = h('button', { type: 'button', class: 'small', text: 'Show raw messages JSON' }), raw = h('pre', { class: 'run-out', hidden: true, style: 'background:#07080b;border-radius:10px;max-height:300px' });
    right.appendChild(bMsgs); right.appendChild(raw);
    bMsgs.addEventListener('click', function () { raw.hidden = !raw.hidden; bMsgs.textContent = raw.hidden ? 'Show raw messages JSON' : 'Hide raw messages JSON'; showRaw(); });
    function showRaw() { if (!raw.hidden) raw.textContent = JSON.stringify({ system: LIVE_SYSTEM, tools: LIVE_TOOLS.map(function (t) { return t.name; }), messages: messages }, null, 1).slice(0, 60000); }
    function loadProject() {
      var P = PROJECTS[proj]; fs = JSON.parse(JSON.stringify(P.files)); task.value = P.task; curFile = Object.keys(fs)[0]; drawTabs();
    }
    function drawTabs() {
      tabs.innerHTML = '';
      Object.keys(fs).sort().forEach(function (f) {
        var b = h('button', { type: 'button', class: 'small mono', text: f, 'aria-pressed': String(f === curFile) });
        b.addEventListener('click', function () { curFile = f; drawTabs(); });
        tabs.appendChild(b);
      });
      editor.value = fs[curFile] || '';
    }
    editor.addEventListener('input', function () { if (curFile) fs[curFile] = editor.value; });
    function meterUpd() {
      meter.innerHTML = '';
      [[usage.calls, 'API calls'], [usage.in.toLocaleString(), 'input tokens'], [usage.out.toLocaleString(), 'output tokens'], ['$' + usage.cost.toFixed(4), 'cost (estimate)']].forEach(function (r) { meter.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })])); });
    }
    function entry(cls, title, body) {
      var e = h('div', { class: 'live-entry ' + cls }, [h('div', { class: 'live-h', text: title })]);
      if (body != null) e.appendChild(h('pre', { text: body }));
      transcript.appendChild(e); transcript.scrollTop = transcript.scrollHeight; return e;
    }
    function ask(name, input) {
      if (auto.checked || NEEDS[name] !== true) return Promise.resolve(true);
      return new Promise(function (res) {
        var e = entry('perm', 'Permission: ' + name + '(' + short(JSON.stringify(input), 120) + ')');
        var y = h('button', { type: 'button', class: 'small primary', text: 'Allow' }), n = h('button', { type: 'button', class: 'small', text: 'Deny' });
        e.appendChild(h('div', { class: 'w-row' }, [y, n]));
        pendingApproval = function (v) { e.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); e.appendChild(h('span', { class: 'w-note', text: v ? ' allowed' : ' denied' })); pendingApproval = null; res(v); };
        y.addEventListener('click', function () { pendingApproval(true); });
        n.addEventListener('click', function () { pendingApproval(false); });
      });
    }
    function short(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }
    function clean(p) { return String(p || '').replace(/^\.?\//, ''); }
    function runTool(name, input) {
      if (name === 'list_files') return Promise.resolve([Object.keys(fs).sort().join('\n'), false]);
      if (name === 'read_file') { var f = clean(input.path); return Promise.resolve(f in fs ? [fs[f], false] : ['Error: no such file: ' + input.path, true]); }
      if (name === 'write_file') {
        var w = clean(input.path);
        if (!w || w.indexOf('..') >= 0 || w[0] === '/') return Promise.resolve(['Error: path ' + JSON.stringify(input.path) + ' is outside the workspace', true]);
        fs[w] = String(input.content); curFile = w; drawTabs();
        return Promise.resolve(['wrote ' + fs[w].length + ' characters to ' + w, false]);
      }
      if (name === 'run_python') {
        var r = clean(input.path);
        if (!(r in fs)) return Promise.resolve(['Error: no such file: ' + input.path, true]);
        return new Promise(function (res) {
          var out = '', err = '';
          AG.runPython({ files: fs, main: r, argv: [r] }, {
            out: function (t) { out += t + '\n'; }, err: function (t) { err += t + '\n'; },
            done: function (ok) { res([('exit code ' + (ok ? 0 : 1) + '\n' + out + err).slice(-4000), false]); },
          });
        });
      }
      return Promise.resolve(['Unknown tool ' + name, true]);
    }
    async function run() {
      if (running) return;
      if (!AG.live.key) { entry('err', 'No API key', 'Paste your Anthropic API key in the Live mode box above, then press Use key.'); return; }
      running = true; stopFlag = false; bRun.disabled = true; bStop.disabled = false;
      transcript.innerHTML = ''; messages = [{ role: 'user', content: task.value }]; usage = { in: 0, out: 0, calls: 0, cost: 0 }; meterUpd();
      entry('user', 'You', task.value);
      try {
        for (var turn = 1; turn <= +maxT.value && !stopFlag; turn++) {
          var wait = entry('dim', 'Turn ' + turn + ': waiting for ' + AG.live.model + '…');
          var r = await AG.live.create({ system: LIVE_SYSTEM, tools: LIVE_TOOLS, messages: messages, max_tokens: 8000 });
          wait.remove();
          usage.calls++; usage.in += (r.usage.input_tokens || 0) + (r.usage.cache_read_input_tokens || 0) + (r.usage.cache_creation_input_tokens || 0); usage.out += r.usage.output_tokens || 0; usage.cost += AG.live.cost(r.usage, r.model); meterUpd();
          messages.push({ role: 'assistant', content: r.content }); showRaw();
          var calls = [];
          r.content.forEach(function (b) {
            if (b.type === 'text' && b.text) entry('asst', 'Claude (turn ' + turn + ')', b.text);
            else if (b.type === 'tool_use') calls.push(b);
            else if (b.type === 'fallback') entry('dim', 'A fallback model continued this turn.');
          });
          if (r.stop_reason === 'refusal') { entry('err', 'The model declined this request.'); break; }
          if (r.stop_reason === 'max_tokens') entry('err', 'The reply hit max_tokens and was cut off.');
          if (!calls.length) { entry('ok', 'Done: no more tool calls. The agent decided it is finished.'); break; }
          var results = [];
          for (var i = 0; i < calls.length; i++) {
            var c = calls[i];
            entry('tool', '→ ' + c.name + '(' + short(JSON.stringify(c.input), 160) + ')');
            var ok = await ask(c.name, c.input), out;
            if (stopFlag) break;
            if (!ok) out = ['The user did not allow this action.', true];
            else out = await runTool(c.name, c.input);
            entry(out[1] ? 'err' : 'res', out[1] ? 'tool_result (error)' : 'tool_result', short(out[0], 1500));
            results.push({ type: 'tool_result', tool_use_id: c.id, content: out[0], is_error: out[1] });
          }
          if (stopFlag) break;
          messages.push({ role: 'user', content: results }); showRaw();
          if (turn === +maxT.value) entry('err', 'Stopped: turn limit reached.');
        }
        if (stopFlag) entry('err', 'Stopped by you.');
      } catch (e) { entry('err', 'API error', AG.live.errorText(e)); }
      running = false; bRun.disabled = false; bStop.disabled = true;
    }
    bRun.addEventListener('click', run);
    bStop.addEventListener('click', function () { stopFlag = true; if (pendingApproval) pendingApproval(false); AG.stopPython(); });
    pick.addEventListener('change', function () { proj = pick.value; loadProject(); });
    bReset.addEventListener('click', loadProject);
    loadProject(); meterUpd();
  });
})();
