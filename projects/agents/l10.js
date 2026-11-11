/* Lesson 10 widgets: ladder (project checklist), glossary (searchable table) */
(function () {
  'use strict';
  var h = AG.h;
  var LADDER = [
    ['01', 'Run vacuum_world.py and make dirt reappear', '../01-agents-and-environments/index.html#code'],
    ['02', 'Give the reflex agent one bit of memory in agent_zoo.py', '../02-agent-programs/index.html#code'],
    ['03', 'Solve the 8-puzzle with A* and two heuristics', '../03-search/index.html#code'],
    ['04', 'Run 1,000 random wumpus worlds and measure success', '../04-knowledge/index.html#code'],
    ['05', 'Q-learning on your own grid world', '../05-decisions-and-learning/index.html#code'],
    ['06', 'Train tiny_gpt.py on a book', '../06-inside-an-llm/index.html#gpt'],
    ['07', 'Run mini_agent.py offline, then with Claude', '../07-llm-agents/index.html#build'],
    ['07', 'Add a search tool and a token budget to mini_agent.py', '../07-llm-agents/index.html#safety'],
    ['07', 'Run mini_agent.py inside a Docker container with --network none', '../../containers/ai-agents/index.html'],
    ['08', 'Connect mcp_microscope_scratch.py to Claude Code', '../08-real-world/index.html#server'],
    ['08', 'Wrap a real device (Arduino LED or a lab instrument) in an MCP server', '../08-real-world/index.html#instruments'],
    ['09', 'Drive the robot simulator with robot_agent.py --brain claude', '../09-build-a-robot/index.html#code'],
    ['09', 'Build the robot and pass every bring-up step', '../09-build-a-robot/index.html#bringup'],
    ['09', 'Run a local model on the Raspberry Pi with Ollama', '../09-build-a-robot/index.html#brains'],
  ];
  AG.widget('ladder', function (root) {
    var done = AG.store('ladder') || {};
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Projects to build' }), h('span', { text: 'From a 150-line simulation to a robot on your floor.' })]));
    var meter = h('div', { class: 'meter' }, [h('i')]), lab = h('span', { class: 'w-note' });
    root.appendChild(h('div', { class: 'progress-row' }, [meter, lab]));
    var list = h('div', { style: 'display:grid;gap:6px' });
    root.appendChild(list);
    function upd() { var n = LADDER.filter(function (_, i) { return done[i]; }).length; meter.firstChild.style.width = (100 * n / LADDER.length) + '%'; lab.textContent = n + ' of ' + LADDER.length + ' built'; }
    LADDER.forEach(function (l, i) {
      var cb = h('input', { type: 'checkbox', checked: !!done[i], 'aria-label': l[1] });
      cb.addEventListener('change', function () { done[i] = cb.checked; AG.store('ladder', done); upd(); });
      list.appendChild(h('label', { style: 'display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--page);min-width:0' },
        [cb, h('span', { class: 'pill', text: 'Lesson ' + l[0] }), h('span', { style: 'flex:1 1 180px;min-width:0', text: l[1] }), h('a', { href: l[2], text: 'Go →' })]));
    });
    upd();
  });
  AG.widget('glossary', function (root) { AG.glossaryTable(root); });
})();
