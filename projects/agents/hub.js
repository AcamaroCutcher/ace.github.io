/* Course home: the agent playground (a terminal where you create, run and score agents; real Python; live Claude). */
(function () {
  'use strict';
  var h = AG.h;
  var PROGRAMS = {
    reflex: 'def program(percept):\n    location, status = percept\n    if status == "Dirty":\n        return "Suck"\n    return "Right" if location == "A" else "Left"',
    model: 'model = {"A": None, "B": None}\n\ndef program(percept):\n    location, status = percept\n    model[location] = status\n    if status == "Dirty":\n        model[location] = "Clean"\n        return "Suck"\n    if model["A"] == model["B"] == "Clean":\n        return "NoOp"\n    return "Right" if location == "A" else "Left"',
    random: 'import random\n\ndef program(percept):\n    return random.choice(["Left", "Right", "Suck", "NoOp"])',
    lazy: 'def program(percept):\n    return "NoOp"     # a very rational agent if the floor is already clean',
  };
  var FILES = ['vacuum_world.py', 'agent_zoo.py', 'search.py', 'wumpus_kb.py', 'mdp.py', 'bpe.py', 'mini_agent.py', 'robot_agent.py', 'mcp_microscope_scratch.py', 'tiny_gpt.py'];
  function makeProgram(type) {
    var rnd = AG.rng(Math.floor(Math.random() * 1e9));
    if (type === 'reflex') return function (p) { return p[1] === 'Dirty' ? 'Suck' : p[0] === 'A' ? 'Right' : 'Left'; };
    if (type === 'model') { var m = { A: null, B: null }; return function (p) { m[p[0]] = p[1]; if (p[1] === 'Dirty') { m[p[0]] = 'Clean'; return 'Suck'; } if (m.A === 'Clean' && m.B === 'Clean') return 'NoOp'; return p[0] === 'A' ? 'Right' : 'Left'; }; }
    if (type === 'random') return function () { return ['Left', 'Right', 'Suck', 'NoOp'][Math.floor(rnd() * 4)]; };
    return function () { return 'NoOp'; };
  }
  function evaluate(type, cost) {
    var tot = 0;
    ['Clean', 'Dirty'].forEach(function (a) { ['Clean', 'Dirty'].forEach(function (b) { ['A', 'B'].forEach(function (loc) {
      var w = { A: a, B: b, loc: loc }, prog = makeProgram(type), sc = 0;
      for (var i = 0; i < 10; i++) { var act = prog([w.loc, w[w.loc]]); if (act === 'Suck') w[w.loc] = 'Clean'; else if (act === 'Left' || act === 'Right') { w.loc = act === 'Right' ? 'B' : 'A'; sc -= cost; } sc += (w.A === 'Clean') + (w.B === 'Clean'); }
      tot += sc;
    }); }); });
    return tot / 8;
  }

  AG.widget('agentplay', function (root) {
    var agents = {}, world = { A: 'Dirty', B: 'Dirty', loc: 'A' }, score = 0, busy = false, hist = [], hi = 0, last = '';
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Agent playground' }), h('span', { text: 'A terminal for agents. Click the suggestions in order, or type your own (try help). The Python commands really run, in your browser.' })]));
    var grid = h('div', { class: 'pg-grid' }), left = h('div', { class: 'pg-left' }), view = h('div', { class: 'pg-view' });
    grid.appendChild(left); grid.appendChild(view); root.appendChild(grid);
    var term = h('div', { class: 'pg-term', 'aria-live': 'polite' }), input = h('input', { type: 'text', 'aria-label': 'Command', placeholder: 'type a command, e.g. agent new robo --type reflex', autocomplete: 'off', spellcheck: 'false' });
    left.appendChild(h('div', { class: 'pg-win' }, [h('div', { class: 'pg-bar' }, [h('i'), h('i'), h('i'), h('span', { text: 'agent-shell' })]), term, h('div', { class: 'pg-line' }, [h('span', { class: 'pg-ps', text: '$' }), input])]));
    var chips = h('div', { class: 'pg-chips' }); left.appendChild(chips);
    var keyBox = h('div', { hidden: true }); left.appendChild(keyBox);
    var SUGG = ['agent new robo --type reflex', 'agent run robo', 'agent new memo --type model', 'agent eval robo', 'agent eval memo', 'agent show memo', 'env reset', 'agent run memo', 'python vacuum_world.py', 'python search.py', 'py print([x * x for x in range(10)])', 'claude "In one sentence: what is a rational agent?"'];
    SUGG.forEach(function (c) { var b = h('button', { type: 'button', class: 'pg-chip', text: c }); b.addEventListener('click', function () { if (!busy) { b.classList.add('done'); exec(c); } }); chips.appendChild(b); });
    function out(t, cls) { var d = h('div', { class: 'pg-out ' + (cls || '') }); d.textContent = t; term.appendChild(d); term.scrollTop = term.scrollHeight; return d; }
    out('Welcome! This is a pretend computer with an agent toolkit installed. The Python commands run for real.\nTry: agent new robo --type reflex', 'dim');

    // ---- the right-hand picture
    function draw() {
      view.innerHTML = '';
      view.appendChild(h('div', null, [h('b', { text: 'Your agent lab' }), h('div', { class: 'w-note', text: 'what the toolkit is managing right now' })]));
      var sa = h('div', { class: 'pg-sec' }, [h('small', { text: 'Agents (' + Object.keys(agents).length + ')' })]);
      var list = h('div', { class: 'pg-agents' });
      Object.keys(agents).forEach(function (n) { var a = agents[n]; list.appendChild(h('div', { class: 'pg-agent' + (a.running ? ' running' : '') }, [h('b', { text: n }), h('span', { text: a.type + ' agent' + (a.best != null ? ' · best ' + a.best : '') })])); });
      sa.appendChild(Object.keys(agents).length ? list : h('div', { class: 'pg-empty', text: 'none yet: try agent new robo --type reflex' }));
      view.appendChild(sa);
      var sw = h('div', { class: 'pg-sec' }, [h('small', { text: 'Environment: two-square vacuum world · score ' + score })]);
      var wd = h('div', { class: 'pg-world' });
      ['A', 'B'].forEach(function (k) {
        var sq = h('div', { class: 'pg-sq' + (world[k] === 'Dirty' ? ' dirty' : '') }, [h('span', { text: k + ' · ' + world[k] })]);
        if (world.loc === k) sq.appendChild(h('span', { class: 'bot' }));
        wd.appendChild(sq);
      });
      sw.appendChild(wd);
      if (last) sw.appendChild(h('div', { class: 'w-note', html: last }));
      view.appendChild(sw);
      var sf = h('div', { class: 'pg-sec' }, [h('small', { text: 'Python files (python <file> runs them)' })]), fl = h('div', { class: 'pg-files' });
      FILES.forEach(function (f) { fl.appendChild(h('span', { text: f })); });
      sf.appendChild(fl); view.appendChild(sf);
      var sk = h('div', { class: 'pg-sec' }, [h('small', { text: 'Claude' }), h('div', { class: AG.live && AG.live.key ? 'w-note' : 'pg-empty', text: AG.live && AG.live.key ? 'key set: claude "<question>" calls the API' : 'not connected: type login to add your API key' })]);
      view.appendChild(sk);
    }
    function args(line) { var m = line.match(/"[^"]*"|'[^']*'|\S+/g) || []; return m.map(function (t) { return t.replace(/^["']|["']$/g, ''); }); }
    function flag(a, name, def) { var i = a.indexOf(name); return i >= 0 && a[i + 1] ? a[i + 1] : def; }
    function wait(ms) { return AG.wait(ms); }
    async function runAgent(name, steps) {
      var a = agents[name]; if (!a) { out('agent: no agent named ' + name + ' (agent ls)', 'err'); return; }
      a.running = true; draw();
      var prog = makeProgram(a.type);
      out('running ' + name + ' (' + a.type + ') for ' + steps + ' steps in the vacuum world', 'dim');
      for (var t = 0; t < steps; t++) {
        var p = [world.loc, world[world.loc]], act = prog(p);
        if (act === 'Suck') world[world.loc] = 'Clean'; else if (act === 'Left') world.loc = 'A'; else if (act === 'Right') world.loc = 'B';
        score += (world.A === 'Clean') + (world.B === 'Clean');
        last = 'percept <code>[' + p.join(', ') + ']</code> → action <code>' + act + '</code>';
        out('t=' + t + '  percept [' + p.join(', ') + ']  ->  ' + act + '   score ' + score, act === 'Suck' ? 'act' : 'per');
        draw(); await wait(380);
      }
      a.running = false; draw();
      out('done. score ' + score + '. (env reset makes the floor dirty again)', 'ok');
    }
    function runPy(files, main, argv) {
      return new Promise(function (res) {
        var started = false;
        AG.runPython({ files: files, main: main, argv: argv }, {
          status: function (s) { if (!started) { started = true; out(s, 'dim'); } },
          out: function (s) { out(s); }, err: function (s) { out(s, 'err'); },
          done: function (ok) { if (ok) { AG.badge('first-run'); } res(); },
        });
      });
    }
    async function exec(line) {
      line = line.trim(); if (!line) return;
      hist.push(line); hi = hist.length;
      out('$ ' + line, 'cmd');
      var a = args(line), c = a[0];
      busy = true;
      try {
        if (c === 'help') out([
          'agent new <name> [--type reflex|model|random|lazy]   create an agent',
          'agent ls | agent show <name> | agent rm <name>       list, show its Python program, remove',
          'agent run <name> [--steps 8]                         run it in the vacuum world (watch the right side)',
          'agent eval <name>                                    average score over all 8 start states',
          'env reset | env dirty A                              reset the world / make a square dirty',
          'ls | cat <file> | python <file> [args]               the course\'s Python files, run for real',
          'py <python code>                                     run a line of Python',
          'login | claude "<question>"                          ask Claude (needs your API key)',
          'clear | lab                                          clear the screen / open the Agent Lab'].join('\n'), 'dim');
        else if (c === 'clear') term.innerHTML = '';
        else if (c === 'lab') { out('opening the Agent Lab…', 'ok'); location.href = 'lab/index.html'; }
        else if (c === 'agent') {
          var sub = a[1], name = a[2];
          if (sub === 'new') {
            if (!name) out('usage: agent new <name> [--type reflex|model|random|lazy]', 'err');
            else { var type = flag(a, '--type', 'reflex'); if (!PROGRAMS[type]) { out('unknown type ' + type + ' (reflex, model, random, lazy)', 'err'); } else { agents[name] = { type: type }; out('created ' + type + ' agent "' + name + '". Its agent program:', 'ok'); out(PROGRAMS[type], 'think'); draw(); } }
          } else if (sub === 'ls') out(Object.keys(agents).length ? Object.keys(agents).map(function (n) { return n.padEnd(12) + agents[n].type; }).join('\n') : '(no agents)', 'dim');
          else if (sub === 'show') { if (agents[name]) out(PROGRAMS[agents[name].type], 'think'); else out('no agent ' + name, 'err'); }
          else if (sub === 'rm') { delete agents[name]; out('removed ' + name, 'dim'); draw(); }
          else if (sub === 'run') await runAgent(name, Math.min(30, +flag(a, '--steps', 8) || 8));
          else if (sub === 'eval') {
            if (!agents[name]) out('no agent ' + name, 'err');
            else { var e0 = evaluate(agents[name].type, 0), e1 = evaluate(agents[name].type, 1); agents[name].best = e1.toFixed(2); out(name + ' over all 8 start states, 10 steps each:\n  average score            ' + e0.toFixed(2) + '\n  if each move costs 1     ' + e1.toFixed(2) + (agents[name].type === 'reflex' ? '\n  (the reflex agent keeps moving forever; try a model-based one)' : ''), 'ok'); draw(); }
          } else out('agent: unknown subcommand. Try help.', 'err');
        } else if (c === 'env') {
          if (a[1] === 'reset') { world = { A: 'Dirty', B: 'Dirty', loc: 'A' }; score = 0; last = ''; out('world reset: both squares dirty, vacuum in A', 'ok'); }
          else if (a[1] === 'dirty' && (a[2] === 'A' || a[2] === 'B')) { world[a[2]] = 'Dirty'; out(a[2] + ' is dirty', 'ok'); }
          else out('usage: env reset | env dirty A|B', 'err');
          draw();
        } else if (c === 'ls') out(FILES.join('   '), 'dim');
        else if (c === 'cat') {
          if (FILES.indexOf(a[1]) < 0) out('cat: no such file', 'err');
          else { var txt = await (await fetch('code/' + a[1])).text(); var lines = txt.split('\n'); out(lines.slice(0, 40).join('\n') + (lines.length > 40 ? '\n… (' + lines.length + ' lines; the full file is in the lessons)' : ''), 'dim'); }
        } else if (c === 'python' || c === 'python3') {
          var f = a[1];
          if (!f) out('usage: python <file> [args]', 'err');
          else if (f === 'tiny_gpt.py') out('tiny_gpt.py needs PyTorch, which does not run in the browser. Run it on your computer: pip install torch && python tiny_gpt.py', 'err');
          else if (FILES.indexOf(f) < 0) out('python: can\'t open file \'' + f + '\'. Try ls.', 'err');
          else {
            var src = await (await fetch('code/' + f)).text(), files = {}; files[f] = src;
            var argv = [f].concat(a.slice(2));
            if (f === 'mini_agent.py' && argv.length === 1) argv.push('--offline', '--yes');
            if (f === 'robot_agent.py' && argv.length === 1) argv.push('--sim');
            if (f === 'mcp_microscope_scratch.py') { out('(this server reads JSON-RPC from stdin; see lesson 08 for a full session)', 'dim'); }
            await runPy(files, f, argv);
          }
        } else if (c === 'py') {
          var code = line.slice(2).trim();
          await runPy({ 'snippet.py': code }, 'snippet.py', ['snippet.py']);
        } else if (c === 'login') {
          keyBox.hidden = false; if (!keyBox.firstChild) AG.live.panel(keyBox);
          out('paste your Anthropic API key in the box below the terminal and press Use key', 'dim');
        } else if (c === 'claude') {
          var q = a.slice(1).join(' ');
          if (!AG.live || !AG.live.key) out('not logged in: type login and add your API key (it stays in this tab)', 'err');
          else if (!q) out('usage: claude "<question>"', 'err');
          else {
            var w = out('… asking ' + AG.live.model, 'dim');
            try {
              var r = await AG.live.create({ max_tokens: 600, system: 'You are a concise tutor for a course on AI agents. Answer in at most 4 sentences, plain text.', messages: [{ role: 'user', content: q }] });
              w.remove();
              out(r.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n'), 'think');
              out('[' + r.usage.input_tokens + ' tokens in, ' + r.usage.output_tokens + ' out]', 'dim');
              AG.badge('live');
            } catch (e) { w.remove(); out(AG.live.errorText(e), 'err'); }
          }
        } else out(c + ': command not found. Try help.', 'err');
      } finally { busy = false; draw(); }
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !busy) { var v = input.value; input.value = ''; exec(v); }
      else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = hist[hi] || ''; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; input.value = hist[hi] || ''; } e.preventDefault(); }
    });
    term.addEventListener('click', function () { input.focus(); });
    draw();
  });
})();
