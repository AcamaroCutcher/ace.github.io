/* Lesson 06 widgets: pipeline, bpe, ngram, attention, params, train, chatformat */
(function () {
  'use strict';
  var h = AG.h;

  /* ---------------------------------------------------------------- the training corpus (original text) */
  var PROSE = [
    'an agent is anything that perceives its environment and acts upon it. a robot vacuum perceives dirt and walls, and it acts with wheels and a brush. a coding agent perceives files and the output of commands, and it acts by editing files and running programs.',
    'the agent program decides what to do next. a simple reflex agent looks only at what it senses right now. a model based agent remembers what it has seen. a goal based agent plans ahead, and a utility based agent weighs what it might gain against what it might lose.',
    'a language model reads a sequence of tokens and predicts the next token. it does this again and again, adding one token at a time, until the answer is complete. the model never sees letters directly; it sees numbers that stand for pieces of words.',
    'attention lets every token look back at the tokens before it. the robot saw the wall, so it stopped. to understand the word it, the model must look back and find the robot. attention gives the model a way to find the right words in the context.',
    'training starts from random numbers. the model guesses the next token, measures how wrong the guess was, and changes its numbers a little to make the right token more likely. after many steps the guesses get better, and the model learns the patterns of the language.',
    'a robot needs fast reflexes and slow plans. the reflexes stop the motors when something is too close. the plans decide where to go next. the language model is good at plans, but the reflexes must live in simple code that always runs.',
    'when the agent calls a tool, the program around the model runs the tool and sends back the result. the result becomes a new part of the context, and the model reads it before it decides what to do next. this loop of thinking, acting and observing is the heart of an agent.',
    'the microscope agent moves the stage, changes the focus, and measures how sharp the image is. it keeps the focus that gives the sharpest image. if a command would move the lens into the sample, the tool refuses, and the agent must try something else.',
  ];
  function grammar(n, seed) {
    var r = AG.rng(seed), who = ['the robot', 'the agent', 'a small rover', 'the vacuum', 'my drone', 'the arm'],
      verb = ['moves to', 'looks at', 'drives toward', 'maps', 'cleans', 'avoids', 'inspects'],
      what = ['the kitchen', 'a red box', 'the charging dock', 'the wall', 'the door', 'a sample'],
      why = ['because the battery is low', 'to reach its goal', 'after it senses dirt', 'when the path is clear', 'while it plans', 'before it stops'];
    var out = [];
    for (var i = 0; i < n; i++) out.push([who, verb, what, why].map(function (l) { return l[Math.floor(r() * l.length)]; }).join(' ') + '.');
    return out.join(' ');
  }
  var CORPUS = PROSE.join(' ') + ' ' + grammar(220, 1);

  /* ---------------------------------------------------------------- word model (for the pipeline) */
  var WORDS = CORPUS.match(/[a-z]+|[.,;]/g);
  var VOCAB = (function () {
    var c = {}; WORDS.forEach(function (w) { c[w] = (c[w] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || (a < b ? -1 : 1); });
  })();
  var VID = {}; VOCAB.forEach(function (w, i) { VID[w] = i; });
  var TRI = {}, BI = {}, UNI = {};
  for (var i = 0; i < WORDS.length; i++) {
    var w = WORDS[i];
    UNI[w] = (UNI[w] || 0) + 1;
    if (i > 0) { var b = WORDS[i - 1]; (BI[b] = BI[b] || {})[w] = (BI[b][w] || 0) + 1; }
    if (i > 1) { var t = WORDS[i - 2] + ' ' + WORDS[i - 1]; (TRI[t] = TRI[t] || {})[w] = (TRI[t][w] || 0) + 1; }
  }
  function nextDist(toks, T) {
    var n = toks.length, table = null, used = '';
    if (n >= 2 && TRI[toks[n - 2] + ' ' + toks[n - 1]]) { table = TRI[toks[n - 2] + ' ' + toks[n - 1]]; used = 'previous 2 words'; }
    else if (n >= 1 && BI[toks[n - 1]]) { table = BI[toks[n - 1]]; used = 'previous word'; }
    else { table = UNI; used = 'no context (word frequencies)'; }
    var ks = Object.keys(table), logits = ks.map(function (k2) { return Math.log(table[k2]); });
    var mx = Math.max.apply(null, logits), ex = logits.map(function (z) { return Math.exp((z - mx) / T); }), Z = ex.reduce(function (a, c) { return a + c; }, 0);
    var d = ks.map(function (k2, j) { return { tok: k2, p: ex[j] / Z }; }).sort(function (a, c) { return c.p - a.p; });
    return { dist: d, used: used };
  }
  function sampleFrom(d, r) { var u = r(), c = 0; for (var j = 0; j < d.length; j++) { c += d[j].p; if (u < c) return d[j]; } return d[d.length - 1]; }
  function hashVec(word, n) { var r = AG.rng(word.split('').reduce(function (a, c) { return (a * 31 + c.charCodeAt(0)) >>> 0; }, 7)); var v = []; for (var j = 0; j < n; j++) v.push(r() * 2 - 1); return v; }

  /* ================================================================ pipeline */
  AG.widget('pipeline', function (root) {
    var text = 'the robot saw the wall , so it', T = 0.8, r = AG.rng(11), busy = false;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'One step of generation' }), h('span', { text: 'Text → tokens → IDs → vectors → model → probabilities → sample → append.' })]));
    var inp = h('input', { type: 'text', value: text, 'aria-label': 'Prompt', style: 'flex:1;min-width:220px' });
    var tIn = h('input', { type: 'range', min: 0.1, max: 2, step: 0.05, value: T }), tOut = h('output', { text: T.toFixed(2) });
    tIn.addEventListener('input', function () { T = +tIn.value; tOut.textContent = T.toFixed(2); render(-1); });
    var bGen = h('button', { type: 'button', class: 'primary', text: 'Generate next token' }), bAuto = h('button', { type: 'button', text: 'Generate 12' });
    root.appendChild(h('div', { class: 'w-row' }, [inp, h('label', { class: 'ctl', style: 'min-width:140px' }, [h('span', { class: 'row' }, ['Temperature', tOut]), tIn]), bGen, bAuto]));
    var stages = h('div', { class: 'pipe-stages' });
    root.appendChild(stages);
    var names = [['1 · Tokens', 'Cut the text into tokens (here: words and punctuation; Claude uses learned subword tokens).'], ['2 · Token IDs', 'Each token is an integer: its index in the vocabulary.'],
      ['3 · Embeddings', 'Each ID becomes a vector of numbers. (Shown: made-up vectors; a real model learns them.)'], ['4 · Transformer', 'N blocks of attention + MLP read all the vectors and produce scores for the next token.'],
      ['5 · Probabilities', 'Softmax(logits / T). Here from word counts; in Claude from the network.'], ['6 · Sample', 'Pick one token at random according to those probabilities, append it, and go again.']];
    var boxes = names.map(function (n) {
      var body = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;min-height:60px;align-content:flex-start' });
      var box = h('div', { style: 'border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--page);display:grid;gap:6px;align-content:start;transition:border-color .3s, box-shadow .3s, transform .3s' }, [h('div', { class: 'w-lab', text: n[0] }), body, h('p', { class: 'w-note', style: 'font-size:12px', text: n[1] })]);
      stages.appendChild(box); return { box: box, body: body };
    });
    var out = h('p', { class: 'w-note' }); root.appendChild(out);
    function toks() { return (inp.value.toLowerCase().match(/[a-z]+|[.,;]/g) || []); }
    function chip(txt, color) { return h('span', { style: 'font:12px ui-monospace,Menlo,monospace;padding:2px 6px;border-radius:6px;background:' + (color || 'var(--accent-soft)') + ';border:1px solid var(--line)', text: txt }); }
    function render(active, picked) {
      var tk = toks(), last = tk.slice(-6);
      boxes.forEach(function (b, j) { b.box.style.borderColor = j === active ? 'var(--accent)' : 'var(--line)'; b.box.style.boxShadow = j === active ? '0 0 0 3px var(--accent-soft)' : 'none'; b.box.style.transform = j === active ? 'translateY(-2px)' : 'none'; });
      boxes[0].body.innerHTML = ''; last.forEach(function (t, j) { boxes[0].body.appendChild(chip(t, 'hsla(' + (j * 57 % 360) + ',70%,60%,.18)')); });
      if (tk.length > 6) boxes[0].body.insertBefore(chip('…'), boxes[0].body.firstChild);
      boxes[1].body.innerHTML = ''; last.forEach(function (t) { boxes[1].body.appendChild(chip(String(VID[t] != null ? VID[t] : '?'))); });
      boxes[2].body.innerHTML = '';
      last.forEach(function (t) {
        var strip = h('div', { style: 'display:grid;grid-template-columns:repeat(8,1fr);width:100%;height:10px;border-radius:3px;overflow:hidden' });
        hashVec(t, 8).forEach(function (v) { strip.appendChild(h('i', { style: 'background:' + (v > 0 ? 'rgba(91,79,224,' + v + ')' : 'rgba(217,130,43,' + (-v) + ')') })); });
        boxes[2].body.appendChild(strip);
      });
      boxes[3].body.innerHTML = '';
      for (var j = 0; j < 4; j++) boxes[3].body.appendChild(h('div', { style: 'width:100%;height:9px;border-radius:4px;background:linear-gradient(90deg,var(--accent),var(--env));opacity:' + (active === 3 ? (.4 + .15 * j) : .25) + (active === 3 && !AG.reduce ? ';animation:shimmer 1s linear infinite;background-size:200% 100%' : '') }));
      boxes[3].body.appendChild(h('span', { class: 'w-note', style: 'font-size:11.5px', text: 'blocks × N (Claude: undisclosed)' }));
      var nd = nextDist(tk, T);
      boxes[4].body.innerHTML = '';
      var list = h('div', { class: 'bar-list', style: 'width:100%' });
      nd.dist.slice(0, 6).forEach(function (d) {
        var row = h('div', { class: 'br' + (picked && picked.tok === d.tok ? ' pick' : '') }, [h('span', { text: d.tok }), h('div', null, [h('i', { style: 'width:' + Math.max(1, d.p * 100) + '%' })]), h('span', { text: (d.p * 100).toFixed(1) + '%' })]);
        list.appendChild(row);
      });
      boxes[4].body.appendChild(list);
      boxes[5].body.innerHTML = '';
      if (picked) boxes[5].body.appendChild(chip(picked.tok, 'var(--warm-soft)'));
      out.innerHTML = 'Context used for the prediction: <b>' + nd.used + '</b>. ' + (picked ? 'Sampled <b>"' + picked.tok + '"</b> (p = ' + (picked.p * 100).toFixed(1) + '%).' : '');
    }
    function genOne() {
      return new Promise(function (res) {
        var steps = [0, 1, 2, 3, 4];
        var nd = nextDist(toks(), T), pick = sampleFrom(nd.dist, r);
        (function go() {
          if (!steps.length) { render(5, pick); inp.value = inp.value.replace(/\s+$/, '') + ' ' + pick.tok; setTimeout(function () { render(-1); res(); }, AG.reduce ? 0 : 500); return; }
          render(steps.shift()); setTimeout(go, AG.reduce ? 0 : 320);
        })();
      });
    }
    bGen.addEventListener('click', function () { if (busy) return; busy = true; genOne().then(function () { busy = false; }); });
    bAuto.addEventListener('click', function () {
      if (busy) return; busy = true; var n = 0;
      (function go() { if (n++ >= 12) { busy = false; return; } genOne().then(go); })();
    });
    inp.addEventListener('input', function () { render(-1); });
    render(-1);
  });

  /* ================================================================ BPE (same algorithm and tie-breaking as bpe.py) */
  var BPE_PY_TEXT = 'an agent perceives its environment through sensors and acts upon that environment\nthrough actuators. a rational agent selects the action that is expected to maximize its\nperformance measure. the agent program runs on the agent architecture. a learning agent\ncan improve its performance. an agent that plans considers the future consequences of actions.';
  function bpeTrain(text, n) {
    var words = new Map();
    text.split(/\s+/).filter(Boolean).forEach(function (w) { var k = JSON.stringify(('_' + w).split('')); words.set(k, (words.get(k) || 0) + 1); });
    var merges = [];
    for (var m = 0; m < n; m++) {
      var counts = new Map();
      words.forEach(function (f, k) { var t = JSON.parse(k); for (var j = 0; j + 1 < t.length; j++) { var pk = t[j] + '\u0000' + t[j + 1]; counts.set(pk, (counts.get(pk) || 0) + f); } });
      if (!counts.size) break;
      var best = null, bc = -1;
      counts.forEach(function (c, pk) {
        if (c > bc) { best = pk; bc = c; return; }
        if (c === bc) { var a = pk.split('\u0000'), bb = best.split('\u0000'); if (a[0] > bb[0] || (a[0] === bb[0] && a[1] > bb[1])) best = pk; }
      });
      var pair = best.split('\u0000');
      merges.push({ a: pair[0], b: pair[1], count: bc });
      var nw = new Map();
      words.forEach(function (f, k) { var t2 = merge(JSON.parse(k), pair); var k2 = JSON.stringify(t2); nw.set(k2, (nw.get(k2) || 0) + f); });
      words = nw;
    }
    return merges;
  }
  function merge(t, pair) { var out = [], j = 0; while (j < t.length) { if (j < t.length - 1 && t[j] === pair[0] && t[j + 1] === pair[1]) { out.push(t[j] + t[j + 1]); j += 2; } else { out.push(t[j]); j++; } } return out; }
  function bpeEncode(text, merges, n) {
    var out = [];
    text.split(/\s+/).filter(Boolean).forEach(function (w) { var t = ('_' + w).split(''); for (var m = 0; m < n; m++) t = merge(t, [merges[m].a, merges[m].b]); out = out.concat(t); });
    return out;
  }
  AG.bpe = { train: bpeTrain, encode: bpeEncode, PYTEXT: BPE_PY_TEXT };
  AG.widget('bpe', function (root) {
    var merges = [], src = CORPUS;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Byte-pair encoding, live' }), h('span', { text: 'Trained on this lesson\'s corpus. "_" marks the start of a word.' })]));
    var slider = h('input', { type: 'range', min: 0, max: 300, value: 40 }), sOut = h('output', { text: '40' });
    var test = h('input', { type: 'text', value: 'the robot perceives the wall and plans a safer route', style: 'flex:1;min-width:240px', 'aria-label': 'Text to tokenize' });
    var bPy = h('button', { type: 'button', text: 'Use bpe.py\'s training text' }), bBack = h('button', { type: 'button', text: 'Use lesson corpus' });
    root.appendChild(h('div', { class: 'w-row' }, [h('label', { class: 'ctl', style: 'min-width:220px' }, [h('span', { class: 'row' }, ['Merges learned', sOut]), slider]), bPy, bBack]));
    root.appendChild(h('div', { class: 'w-row' }, [test]));
    var tokBox = h('div', { style: 'display:flex;flex-wrap:wrap;gap:3px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--page);min-height:48px' });
    root.appendChild(tokBox);
    var stats = h('div', { class: 'readout' }); root.appendChild(stats);
    var mlist = h('div', { class: 'log', style: 'height:150px' });
    root.appendChild(h('div', { class: 'w-lab', text: 'Merges, in the order learned' })); root.appendChild(mlist);
    function retrain() { merges = bpeTrain(src, 300); slider.max = merges.length; draw(); }
    function draw() {
      var n = Math.min(+slider.value, merges.length); sOut.textContent = n;
      var toks = bpeEncode(test.value.toLowerCase(), merges, n);
      tokBox.innerHTML = '';
      toks.forEach(function (t, j) { tokBox.appendChild(h('span', { style: 'font:13px ui-monospace,Menlo,monospace;padding:3px 6px;border-radius:6px;background:hsla(' + (j * 47 % 360) + ',70%,55%,.2);border:1px solid var(--line)', text: t })); });
      var chars = test.value.replace(/\s+/g, '').length;
      var base = new Set(src.replace(/\s+/g, '').split('')); base.add('_');
      stats.innerHTML = '';
      [[chars, 'characters'], [toks.length, 'tokens'], [(chars / Math.max(1, toks.length)).toFixed(2), 'chars per token'], [base.size + n, 'vocabulary size']].forEach(function (r) { stats.appendChild(h('div', null, [h('b', { text: String(r[0]) }), h('span', { text: r[1] })])); });
      mlist.innerHTML = '';
      merges.slice(0, n).forEach(function (m, j) { mlist.appendChild(h('div', { class: j === n - 1 ? 'act' : '', text: (j + 1 + '.').padStart(4) + ' ' + JSON.stringify(m.a) + ' + ' + JSON.stringify(m.b) + ' → ' + JSON.stringify(m.a + m.b) + '   (' + m.count + '×)' })); });
      mlist.scrollTop = mlist.scrollHeight;
    }
    slider.addEventListener('input', draw); test.addEventListener('input', draw);
    bPy.addEventListener('click', function () { src = BPE_PY_TEXT; test.value = 'the agent acts rationally'; slider.value = 40; retrain(); });
    bBack.addEventListener('click', function () { src = CORPUS; retrain(); });
    retrain();
  });

  /* ================================================================ character n-gram model */
  AG.widget('ngram', function (root) {
    var MAXN = 7, counts = [];
    for (var n = 1; n <= MAXN; n++) {
      var m = new Map();
      for (var j = n - 1; j < CORPUS.length; j++) { var ctx = CORPUS.slice(j - n + 1, j), c = CORPUS[j]; var e = m.get(ctx); if (!e) { e = {}; m.set(ctx, e); } e[c] = (e[c] || 0) + 1; }
      counts.push(m);
    }
    var order = 4, T = 1, topk = 0, r = AG.rng(9), timer = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Character n-gram language model' }), h('span', { text: 'Predicts the next character from the previous n − 1 characters by counting.' })]));
    function sl(label, min, max, step, val, fmt, on) { var i = h('input', { type: 'range', min: min, max: max, step: step, value: val }), o = h('output', { text: fmt(val) }); i.addEventListener('input', function () { o.textContent = fmt(+i.value); on(+i.value); }); return h('label', { class: 'ctl' }, [h('span', { class: 'row' }, [label, o]), i]); }
    root.appendChild(h('div', { class: 'w-row' }, [
      sl('Order n', 1, MAXN, 1, order, function (v) { return v + (v === 1 ? ' (no context)' : ' (' + (v - 1) + ' chars)'); }, function (v) { order = v; draw(); }),
      sl('Temperature', 0.05, 2.5, 0.05, T, function (v) { return v.toFixed(2); }, function (v) { T = v; draw(); }),
      sl('Top-k (0 = off)', 0, 20, 1, topk, function (v) { return String(v); }, function (v) { topk = v; draw(); })]));
    var ta = h('textarea', { rows: 3, 'aria-label': 'Text so far' }); ta.value = 'the robot ';
    root.appendChild(ta);
    var grid = h('div', { class: 'w-grid2 even' }), bars = h('div', { class: 'bar-list' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(h('div', null, [h('div', { class: 'w-lab', text: 'Next-character distribution' }), bars])); grid.appendChild(side); root.appendChild(grid);
    var info = h('p', { class: 'w-note' }); side.appendChild(info);
    var b1 = h('button', { type: 'button', class: 'primary', text: 'Sample 1 char' }), b2 = h('button', { type: 'button', text: 'Generate 200 ▶' }), b3 = h('button', { type: 'button', text: 'Greedy 200' }), b4 = h('button', { type: 'button', text: 'Reset' });
    side.appendChild(h('div', { class: 'w-row' }, [b1, b2, b3, b4]));
    var det = h('details', null, [h('summary', { text: 'Show the training corpus (' + CORPUS.length.toLocaleString() + ' characters)' }), h('p', { style: 'font:12.5px/1.6 ui-monospace,Menlo,monospace;max-height:200px;overflow:auto;margin-top:6px', text: CORPUS })]);
    root.appendChild(det);
    function dist() {
      var text = ta.value.toLowerCase(), n2 = order, e;
      while (n2 >= 1) { e = counts[n2 - 1].get(text.slice(Math.max(0, text.length - n2 + 1), text.length)); if (n2 === 1) e = counts[0].get(''); if (e && text.length >= n2 - 1) break; n2--; }
      var ks = Object.keys(e), tot = ks.reduce(function (a, k2) { return a + e[k2]; }, 0);
      var d = ks.map(function (k2) { return { c: k2, logit: Math.log(e[k2] / tot) }; }).sort(function (a, b) { return b.logit - a.logit; });
      if (topk) d = d.slice(0, topk);
      var mx = d[0].logit, Z = 0; d.forEach(function (x) { x.w = Math.exp((x.logit - mx) / T); Z += x.w; }); d.forEach(function (x) { x.p = x.w / Z; });
      return { d: d, used: n2, total: tot };
    }
    function show(c) { return c === ' ' ? '␣' : c === '.' ? '.' : c; }
    function draw(picked) {
      var r2 = dist();
      bars.innerHTML = '';
      r2.d.slice(0, 12).forEach(function (x) { bars.appendChild(h('div', { class: 'br' + (picked === x.c ? ' pick' : '') }, [h('span', { text: '"' + show(x.c) + '"' }), h('div', null, [h('i', { style: 'width:' + Math.max(.5, x.p * 100) + '%' })]), h('span', { text: (x.p * 100).toFixed(1) + '%' })])); });
      info.innerHTML = 'Context used: <b>"' + AG.esc(ta.value.slice(-(r2.used - 1)) || '') + '"</b> (order ' + r2.used + (r2.used < order ? ', backed off: the longer context never appeared in training' : '') + '), seen ' + r2.total + ' times. ' + r2.d.length + ' possible next characters.';
    }
    function sampleOne(greedy) { var r2 = dist(), x = greedy ? r2.d[0] : (function () { var u = r(), c = 0; for (var j = 0; j < r2.d.length; j++) { c += r2.d[j].p; if (u < c) return r2.d[j]; } return r2.d[r2.d.length - 1]; })(); ta.value += x.c; return x.c; }
    function gen(greedy) {
      if (timer) { clearInterval(timer); timer = null; return; }
      var n2 = 0;
      timer = setInterval(function () { var c = sampleOne(greedy); draw(c); ta.scrollTop = ta.scrollHeight; if (++n2 >= 200) { clearInterval(timer); timer = null; } }, AG.reduce ? 1 : 25);
    }
    b1.addEventListener('click', function () { draw(sampleOne(false)); });
    b2.addEventListener('click', function () { gen(false); });
    b3.addEventListener('click', function () { gen(true); });
    b4.addEventListener('click', function () { ta.value = 'the robot '; draw(); });
    ta.addEventListener('input', function () { draw(); });
    draw();
  });

  /* ================================================================ attention in 2-D */
  AG.widget('attention', function (root) {
    var keys = [{ w: 'robot', x: 0.9, y: 0.7 }, { w: 'saw', x: -0.8, y: 0.5 }, { w: 'wall', x: 0.6, y: -0.6 }, { w: 'so', x: -0.7, y: -0.8 }, { w: 'it', x: 0.1, y: 0.15 }];
    var q = { x: 0.4, y: 1.1 }, sharp = 2, drag = null;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Scaled dot-product attention in two dimensions' }), h('span', { text: 'The query belongs to the token "it". Drag the query arrow or any key.' })]));
    var sIn = h('input', { type: 'range', min: 0.2, max: 8, step: 0.1, value: sharp }), sOut = h('output', { text: sharp.toFixed(1) });
    sIn.addEventListener('input', function () { sharp = +sIn.value; sOut.textContent = sharp.toFixed(1); draw(); });
    root.appendChild(h('div', { class: 'w-row' }, [h('label', { class: 'ctl', style: 'min-width:220px' }, [h('span', { class: 'row' }, ['Sharpness (score scale)', sOut]), sIn])]));
    var grid = h('div', { class: 'w-grid2' }), st = h('div', { class: 'w-stage' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(st); grid.appendChild(side); root.appendChild(grid);
    var C = AG.canvas(st, function (w) { return Math.min(420, Math.round(w * 0.8)); }, function () { draw(); });
    var tb = h('tbody'), note = h('p', { class: 'w-note' });
    side.appendChild(h('div', { class: 'table-wrap' }, [h('table', { style: 'font-size:13px' }, [h('thead', null, [h('tr', null, ['Key', 'q·k', '× scale', 'weight'].map(function (t) { return h('th', { text: t }); }))]), tb])]));
    side.appendChild(note);
    function S() { var R = Math.min(C.W, C.H) / 2 / 1.5; return { cx: C.W / 2, cy: C.H / 2, R: R }; }
    function toPx(p) { var s = S(); return [s.cx + p.x * s.R, s.cy - p.y * s.R]; }
    function weights() {
      var sc = keys.map(function (k) { return (q.x * k.x + q.y * k.y) * sharp; }), mx = Math.max.apply(null, sc), ex = sc.map(function (z) { return Math.exp(z - mx); }), Z = ex.reduce(function (a, b) { return a + b; }, 0);
      return { sc: sc, w: ex.map(function (e) { return e / Z; }) };
    }
    var COL = ['#5b4fe0', '#0f9d76', '#d9822b', '#2a78d6', '#d4434a'];
    function draw() {
      var ctx = C.ctx, s = S(), W2 = weights();
      ctx.clearRect(0, 0, C.W, C.H);
      ctx.strokeStyle = AG.css('--line'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, s.cy); ctx.lineTo(C.W, s.cy); ctx.moveTo(s.cx, 0); ctx.lineTo(s.cx, C.H); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.R, 0, 7); ctx.stroke();
      var out = { x: 0, y: 0 };
      keys.forEach(function (k, j) {
        var p = toPx(k), w = W2.w[j];
        out.x += w * k.x; out.y += w * k.y;
        ctx.strokeStyle = COL[j]; ctx.globalAlpha = .25 + .75 * w; ctx.lineWidth = 1 + 10 * w;
        var qp = toPx(q); ctx.beginPath(); ctx.moveTo(qp[0], qp[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = COL[j]; ctx.beginPath(); ctx.arc(p[0], p[1], 7 + 10 * w, 0, 7); ctx.fill();
        ctx.fillStyle = AG.css('--ink'); ctx.font = '600 13px system-ui'; ctx.fillText(k.w, p[0] + 12, p[1] - 10);
      });
      // query arrow
      var qp2 = toPx(q);
      ctx.strokeStyle = AG.css('--accent'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.cx, s.cy); ctx.lineTo(qp2[0], qp2[1]); ctx.stroke();
      ctx.fillStyle = AG.css('--accent'); ctx.beginPath(); ctx.arc(qp2[0], qp2[1], 8, 0, 7); ctx.fill();
      ctx.fillStyle = AG.css('--accent'); ctx.font = '700 13px system-ui'; ctx.fillText('query("it")', qp2[0] + 10, qp2[1] + 18);
      // output star
      var op = toPx(out);
      ctx.fillStyle = AG.css('--warm'); ctx.font = '700 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', op[0], op[1]); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      tb.innerHTML = '';
      keys.forEach(function (k, j) {
        tb.appendChild(h('tr', null, [h('td', null, [h('b', { style: 'color:' + COL[j], text: k.w })]), h('td', { text: (W2.sc[j] / sharp).toFixed(2) }), h('td', { text: W2.sc[j].toFixed(2) }),
          h('td', null, [h('div', { style: 'display:flex;gap:6px;align-items:center' }, [h('div', { style: 'height:10px;border-radius:3px;background:' + COL[j] + ';width:' + Math.round(70 * W2.w[j]) + 'px' }), h('span', { text: (W2.w[j] * 100).toFixed(0) + '%' })])])]));
      });
      var top = W2.w.indexOf(Math.max.apply(null, W2.w));
      note.innerHTML = 'Output ★ = Σ weight × value (here each value is the key\'s own point). "it" attends most to <b>' + keys[top].w + '</b>. In a trained model, the learned query and key matrices put "it" near the noun it refers to.';
    }
    function pick(ev) { var p = AG.pos(C.cv, ev), best = null, bd = 18; [q].concat(keys).forEach(function (o) { var pp = toPx(o), d = Math.hypot(pp[0] - p.x, pp[1] - p.y); if (d < bd) { bd = d; best = o; } }); return best; }
    C.cv.addEventListener('pointerdown', function (ev) { drag = pick(ev); if (drag) C.cv.setPointerCapture(ev.pointerId); });
    C.cv.addEventListener('pointermove', function (ev) {
      var s = S(), p = AG.pos(C.cv, ev);
      C.cv.style.cursor = pick(ev) ? 'grab' : 'default';
      if (!drag) return;
      drag.x = AG.clamp((p.x - s.cx) / s.R, -1.45, 1.45); drag.y = AG.clamp(-(p.y - s.cy) / s.R, -1.45, 1.45); draw();
    });
    C.cv.addEventListener('pointerup', function () { drag = null; });
    draw();
  });

  /* ================================================================ parameter counter */
  AG.widget('params', function (root) {
    var P = { L: 12, d: 768, V: 50257, ctx: 1024, D: 300e9 };
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'How many parameters?' }), h('span', { text: 'Per block ≈ 12·d² (attention 4d², MLP 8d²). Plus embeddings V·d and positions ctx·d.' })]));
    var presets = h('div', { class: 'w-row' });
    [['tiny_gpt.py', { L: 3, d: 96, V: 25, ctx: 64, D: 2e6 }], ['GPT-2 small (2019)', { L: 12, d: 768, V: 50257, ctx: 1024, D: 1e10 }], ['GPT-3 (2020)', { L: 96, d: 12288, V: 50257, ctx: 2048, D: 300e9 }]].forEach(function (p) {
      var b = h('button', { type: 'button', class: 'small', text: p[0] }); b.addEventListener('click', function () { P = Object.assign({}, p[1]); sync(); }); presets.appendChild(b);
    });
    root.appendChild(presets);
    var inputs = {};
    var row = h('div', { class: 'w-row' });
    [['L', 'Layers (blocks)'], ['d', 'Width d'], ['V', 'Vocabulary'], ['ctx', 'Context length'], ['D', 'Training tokens']].forEach(function (f) {
      var i = h('input', { type: 'number', min: 1, step: 'any', value: P[f[0]], style: 'width:130px' });
      i.addEventListener('input', function () { P[f[0]] = Math.max(1, +i.value || 1); calc(); });
      inputs[f[0]] = i; row.appendChild(h('label', { class: 'ctl', style: 'min-width:130px' }, [h('span', { text: f[1] }), i]));
    });
    root.appendChild(row);
    var out = h('div', { class: 'readout' }), note = h('p', { class: 'w-note' });
    root.appendChild(out); root.appendChild(note);
    function fmt(x) { return x >= 1e12 ? (x / 1e12).toFixed(2) + ' T' : x >= 1e9 ? (x / 1e9).toFixed(2) + ' B' : x >= 1e6 ? (x / 1e6).toFixed(2) + ' M' : x >= 1e3 ? (x / 1e3).toFixed(1) + ' k' : String(Math.round(x)); }
    function sync() { Object.keys(inputs).forEach(function (k) { inputs[k].value = P[k]; }); calc(); }
    function calc() {
      var blocks = P.L * 12 * P.d * P.d, emb = P.V * P.d, pos = P.ctx * P.d, N = blocks + emb + pos;
      out.innerHTML = '';
      [[fmt(blocks), 'in blocks'], [fmt(emb + pos), 'embeddings'], [fmt(N), 'total ≈'], [fmt(N * 2) + 'B', 'memory at 2 bytes each'], [(6 * N * P.D).toExponential(2), 'training FLOPs ≈ 6·N·D']].forEach(function (r) { out.appendChild(h('div', null, [h('b', { text: r[0] }), h('span', { text: r[1] })])); });
      note.innerHTML = 'Rules of thumb from the scaling-law literature: training costs about 6 floating-point operations per parameter per training token, and generating one token costs about 2 per parameter. GPT-3\'s 175 B parameters and 300 B tokens give ≈ 3 × 10²³ FLOPs. Anthropic has not published Claude\'s parameter count.';
    }
    sync();
  });

  /* ================================================================ train a bigram network live */
  AG.widget('train', function (root) {
    var text = CORPUS.replace(/[^a-z .]/g, '');
    var chars = Array.from(new Set(text.split(''))).sort(), V = chars.length, ix = {}; chars.forEach(function (c, i) { ix[c] = i; });
    var data = new Int32Array(text.length); for (var i = 0; i < text.length; i++) data[i] = ix[text[i]];
    // best possible bigram loss: conditional entropy from counts
    var cnt = new Float64Array(V * V); for (i = 1; i < data.length; i++) cnt[data[i - 1] * V + data[i]]++;
    var Hopt = 0, tot = data.length - 1;
    for (var a = 0; a < V; a++) { var row = 0; for (var b = 0; b < V; b++) row += cnt[a * V + b]; for (b = 0; b < V; b++) if (cnt[a * V + b]) Hopt -= cnt[a * V + b] / tot * Math.log(cnt[a * V + b] / row); }
    var Wt, losses, step, running = false, lr = 20, r = AG.rng(4), BATCH = 256;
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'Gradient descent on a bigram network' }), h('span', { text: V + ' characters; parameters: one ' + V + '×' + V + ' matrix of logits (' + V * V + ' numbers).' })]));
    var lrIn = h('input', { type: 'range', min: 1, max: 80, step: 1, value: lr }), lrOut = h('output', { text: String(lr) });
    lrIn.addEventListener('input', function () { lr = +lrIn.value; lrOut.textContent = lr; });
    var bGo = h('button', { type: 'button', class: 'primary', text: 'Train ▶' }), bReset = h('button', { type: 'button', text: 'Reset weights' });
    root.appendChild(h('div', { class: 'w-row' }, [bGo, bReset, h('label', { class: 'ctl', style: 'min-width:180px' }, [h('span', { class: 'row' }, ['Learning rate', lrOut]), lrIn])]));
    var grid = h('div', { class: 'w-grid2 even' }), cb = h('div', { class: 'w-stage', style: 'background:var(--surface)' }), side = h('div', { style: 'display:grid;gap:8px;align-content:start' });
    grid.appendChild(cb); grid.appendChild(side); root.appendChild(grid);
    var CH = AG.canvas(cb, 0.55, function () { chart(); });
    var readout = h('div', { class: 'readout' }), sampleBox = h('div', { class: 'log', style: 'height:110px' });
    side.appendChild(readout); side.appendChild(h('div', { class: 'w-lab', text: 'Sample from the current weights' })); side.appendChild(sampleBox);
    function reset() { Wt = new Float32Array(V * V); for (var j = 0; j < V * V; j++) Wt[j] = (r() - .5) * 0.2; losses = []; step = 0; chart(); upd(); }
    function trainStep() {
      var grad = new Float32Array(V * V), loss = 0, p = new Float32Array(V);
      for (var n = 0; n < BATCH; n++) {
        var t = 1 + Math.floor(r() * (data.length - 1)), x = data[t - 1], y = data[t], mx = -Infinity, Z = 0, k2;
        for (k2 = 0; k2 < V; k2++) mx = Math.max(mx, Wt[x * V + k2]);
        for (k2 = 0; k2 < V; k2++) { p[k2] = Math.exp(Wt[x * V + k2] - mx); Z += p[k2]; }
        for (k2 = 0; k2 < V; k2++) { p[k2] /= Z; grad[x * V + k2] += p[k2]; }
        grad[x * V + y] -= 1; loss -= Math.log(p[y] + 1e-12);
      }
      for (var j = 0; j < V * V; j++) Wt[j] -= lr * grad[j] / BATCH;
      step++; return loss / BATCH;
    }
    function sample(n) {
      var c = ix['t'] || 0, out = chars[c];
      for (var j = 0; j < n; j++) {
        var mx = -Infinity, Z = 0, p = []; for (var k2 = 0; k2 < V; k2++) mx = Math.max(mx, Wt[c * V + k2]);
        for (k2 = 0; k2 < V; k2++) { p.push(Math.exp(Wt[c * V + k2] - mx)); Z += p[k2]; }
        var u = r() * Z, acc = 0; for (k2 = 0; k2 < V; k2++) { acc += p[k2]; if (u < acc) break; }
        c = Math.min(k2, V - 1); out += chars[c];
      }
      return out;
    }
    function chart() {
      AG.lineChart(CH, [{ data: losses, color: AG.css('--accent') }, { data: losses.map(function () { return Hopt; }), color: AG.css('--env') }, { data: losses.map(function () { return Math.log(V); }), color: AG.css('--muted') }], { min: 0, xlabel: 'steps →', empty: 'press Train' });
    }
    function upd() {
      readout.innerHTML = '';
      [[step, 'steps'], [losses.length ? losses[losses.length - 1].toFixed(3) : '–', 'loss (purple)'], [Math.log(V).toFixed(3), 'random guess (gray)'], [Hopt.toFixed(3), 'best bigram (green)']].forEach(function (x) { readout.appendChild(h('div', null, [h('b', { text: String(x[0]) }), h('span', { text: x[1] })])); });
    }
    function loop() {
      if (!running) return;
      var L = 0; for (var j = 0; j < 8; j++) L += trainStep(); losses.push(L / 8);
      if (losses.length > 400) losses = losses.filter(function (_, k3) { return k3 % 2 === 0; });
      chart(); upd();
      if (step % 64 === 0) { sampleBox.appendChild(h('div', { text: 'step ' + step + ': ' + sample(70) })); sampleBox.scrollTop = sampleBox.scrollHeight; }
      if (step >= 4000) { running = false; bGo.textContent = 'Train ▶'; return; }
      requestAnimationFrame(loop);
    }
    bGo.addEventListener('click', function () { running = !running; bGo.textContent = running ? 'Pause ❚❚' : 'Train ▶'; if (running) { sampleBox.appendChild(h('div', { class: 'dim', text: 'step ' + step + ': ' + sample(70) })); loop(); } });
    bReset.addEventListener('click', function () { running = false; bGo.textContent = 'Train ▶'; sampleBox.innerHTML = ''; reset(); });
    AG.trainDemo = { steps: function (n) { var L = 0; for (var j = 0; j < n; j++) L = trainStep(); return [L, Hopt, Math.log(V)]; } };
    reset();
  });

  /* ================================================================ chat format */
  AG.widget('chatformat', function (root) {
    var view = 'chat';
    root.appendChild(h('div', { class: 'w-title' }, [h('b', { text: 'One conversation, three views' }), h('span', { text: 'A user asks a robot agent a question; the model calls a tool, gets the result, and answers.' })]));
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'View' });
    [['chat', 'What you see'], ['api', 'What the API receives (JSON)'], ['tokens', 'What the model sees (illustrative)']].forEach(function (v) {
      var b = h('button', { type: 'button', text: v[1], 'aria-pressed': String(v[0] === view) });
      b.addEventListener('click', function () { view = v[0]; [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); draw(); });
      seg.appendChild(b);
    });
    root.appendChild(seg);
    var box = h('div'); root.appendChild(box);
    var API = {
      model: 'claude-opus-5-5', max_tokens: 1024,
      system: 'You control a small robot. Use the tools; never guess sensor values.',
      tools: [{ name: 'read_distance', description: 'Measure the distance in cm to the nearest object straight ahead.', input_schema: { type: 'object', properties: {} } }],
      messages: [
        { role: 'user', content: 'Is the path ahead clear?' },
        { role: 'assistant', content: [{ type: 'text', text: 'Let me measure.' }, { type: 'tool_use', id: 'toolu_01', name: 'read_distance', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: '23 cm' }] },
      ],
    };
    function bubble(who, txt, cls) {
      var me = who === 'You';
      return h('div', { style: 'display:flex;justify-content:' + (me ? 'flex-end' : 'flex-start') }, [h('div', { style: 'max-width:78%;padding:9px 12px;border-radius:14px;' + (me ? 'background:var(--accent);color:var(--accent-ink)' : cls === 'tool' ? 'background:var(--env-soft);border:1px dashed var(--env);font:12.5px ui-monospace,Menlo,monospace' : 'background:var(--surface-2)') }, [h('div', { style: 'font:700 11px system-ui;opacity:.75;margin-bottom:2px', text: who }), h('div', { text: txt })])]);
    }
    function draw() {
      box.innerHTML = '';
      if (view === 'chat') {
        var c = h('div', { style: 'display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--page)' });
        c.appendChild(bubble('You', 'Is the path ahead clear?'));
        c.appendChild(bubble('Robot agent', 'Let me measure.'));
        c.appendChild(bubble('tool: read_distance()', '→ 23 cm', 'tool'));
        c.appendChild(bubble('Robot agent', 'Not quite: there is an obstacle about 23 cm ahead. I can turn and look for a clearer direction.'));
        box.appendChild(c);
        box.appendChild(h('p', { class: 'w-note', text: 'A chat app usually hides the tool call. The model did not measure anything itself: it asked the program to run read_distance, and the program ran the sensor.' }));
      } else if (view === 'api') {
        var pre = h('div', { class: 'code', 'data-lang': 'json' }, [h('div', { class: 'code-head' }, [h('span', { class: 'fname', text: 'POST /v1/messages  (third request of the loop)' })]), h('pre')]);
        var lines = JSON.stringify(API, null, 2).split('\n');
        pre.querySelector('pre').innerHTML = lines.map(function (l, j) { return '<span class="ln" data-n="' + (j + 1) + '">' + AG.highlight(l, 'json') + '</span>'; }).join('');
        box.appendChild(pre);
        box.appendChild(h('p', { class: 'w-note', html: 'The API is <b>stateless</b>: every request carries the whole conversation so far. The model\'s answer to this request is the final text. Lesson 07 builds this loop.' }));
      } else {
        var parts = [['sys', '⟨system⟩ You control a small robot. Use the tools; never guess sensor values. ⟨tools⟩ read_distance: Measure the distance in cm to the nearest object straight ahead. {} ⟨/tools⟩'],
          ['user', '⟨user⟩ Is the path ahead clear?'], ['asst', '⟨assistant⟩ Let me measure. ⟨tool_call name="read_distance"⟩ {} ⟨/tool_call⟩'],
          ['tool', '⟨tool_result⟩ 23 cm ⟨/tool_result⟩'], ['gen', '⟨assistant⟩ Not quite: there is an obstacle about 23 cm ahead …']];
        var colors = { sys: 'var(--surface-2)', user: 'var(--accent-soft)', asst: 'var(--warm-soft)', tool: 'var(--env-soft)', gen: 'var(--info-soft)' };
        var wrap = h('div', { style: 'display:flex;flex-wrap:wrap;gap:3px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--page);font:12.5px ui-monospace,Menlo,monospace' });
        var n = 0;
        parts.forEach(function (p) {
          (p[1].match(/⟨[^⟩]+⟩|[A-Za-z]+|[^\sA-Za-z]/g) || []).forEach(function (t) {
            n++;
            wrap.appendChild(h('span', { style: 'padding:2px 4px;border-radius:4px;background:' + colors[p[0]] + (p[0] === 'gen' ? ';outline:1px dashed var(--info)' : '') + (t[0] === '⟨' ? ';font-weight:700' : ''), text: t }));
          });
        });
        box.appendChild(wrap);
        box.appendChild(h('p', { class: 'w-note', html: 'About ' + n + ' tokens. Everything is one sequence; the model\'s only job is to continue it. The dashed tokens are what it generates. Special marker tokens (made up here) separate the roles, so the model can tell the system prompt, your words, its own words and tool results apart.' }));
      }
    }
    draw();
  });
})();
