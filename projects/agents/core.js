/*
 * Agents course: shared runtime for every page.
 *   - theme toggle (shares the site-wide key "quake-viz-theme"), reading-progress bar, TOC highlight
 *   - animated banner: an agent exchanging percepts and actions with its environment
 *   - glossary tooltips for <span class="g" data-g="key">
 *   - syntax highlighting, copy and fold for .code blocks; book <-> code bridges
 *   - quizzes, lesson progress (localStorage, optional)
 *   - widget registry: lesson scripts call AG.widget(name, fn); fn(el) runs for every <div data-widget="name">
 * Honors prefers-reduced-motion.
 */
(function () {
  'use strict';
  var AG = window.AG = window.AG || {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  AG.reduce = reduce;
  if (!reduce) document.documentElement.classList.add('js-anim');

  /* ------------------------------------------------------------ helpers */
  AG.h = function (tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  };
  AG.s = function (tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    return el;
  };
  AG.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  AG.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  AG.store = function (k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('agents:' + k) || 'null');
      localStorage.setItem('agents:' + k, JSON.stringify(v));
    } catch (e) { return null; }
    return v;
  };
  AG.wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 30) : ms); }); };
  AG.rng = function (seed) {           // small deterministic PRNG (mulberry32)
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  AG.onVisible = function (el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { rootMargin: '200px' });
    io.observe(el);
  };
  // read a CSS custom property (theme-aware colors for canvas drawing)
  AG.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; };
  AG.isDark = function () {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  var themeFns = [];
  AG.onTheme = function (fn) { themeFns.push(fn); };
  function themeChanged() { themeFns.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', themeChanged);
  }

  // HiDPI canvas that follows its container's width; height = width * aspect (or fixed px)
  AG.canvas = function (parent, aspect, onResize) {
    var cv = AG.h('canvas');
    parent.appendChild(cv);
    var ctx = cv.getContext('2d');
    var o = { cv: cv, ctx: ctx, W: 0, H: 0 };
    function size() {
      var w = parent.clientWidth || 600;
      var hh = typeof aspect === 'function' ? aspect(w) : Math.round(w * aspect);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
      cv.style.height = hh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.W = w; o.H = hh;
      if (onResize && o.ready) onResize(o);
    }
    o.resize = size;
    size();
    o.ready = true;     // later resizes redraw; the first draw is the widget's job
    if ('ResizeObserver' in window) {
      var last = parent.clientWidth;
      new ResizeObserver(function () { if (Math.abs(parent.clientWidth - last) > 2) { last = parent.clientWidth; size(); } }).observe(parent);
    }
    AG.onTheme(function () { if (onResize) onResize(o); });
    return o;
  };
  // pointer position in CSS pixels relative to a canvas
  AG.pos = function (cv, ev) {
    var r = cv.getBoundingClientRect();
    var p = ev.touches ? ev.touches[0] : ev;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };
  AG.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  // a small line chart: series = [{data:[...], color, label}]
  AG.lineChart = function (o, series, opts) {
    opts = opts || {};
    var ctx = o.ctx, W = o.W, H = o.H, pad = { l: 40, r: 10, t: 12, b: 22 };
    ctx.clearRect(0, 0, W, H);
    var all = []; series.forEach(function (s) { all = all.concat(s.data); });
    if (!all.length) { ctx.fillStyle = AG.css('--muted'); ctx.font = '12px system-ui'; ctx.fillText(opts.empty || 'no data yet', pad.l, H / 2); return; }
    var lo = opts.min != null ? opts.min : Math.min.apply(null, all), hi = opts.max != null ? opts.max : Math.max.apply(null, all);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var n = Math.max.apply(null, series.map(function (s) { return s.data.length; }));
    function X(i) { return pad.l + (W - pad.l - pad.r) * (n <= 1 ? 0 : i / (n - 1)); }
    function Y(v) { return pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo)); }
    ctx.strokeStyle = AG.css('--line'); ctx.fillStyle = AG.css('--muted'); ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.lineWidth = 1;
    for (var k = 0; k <= 3; k++) {
      var v = lo + (hi - lo) * k / 3, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2), 2, y + 4);
    }
    if (opts.xlabel) ctx.fillText(opts.xlabel, W - pad.r - ctx.measureText(opts.xlabel).width, H - 5);
    series.forEach(function (s) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
      s.data.forEach(function (v, i) { if (i) ctx.lineTo(X(i), Y(v)); else ctx.moveTo(X(i), Y(v)); });
      ctx.stroke();
    });
  };

  /* ------------------------------------------------------------ widget registry */
  var widgets = {};
  AG.widget = function (name, fn) { widgets[name] = fn; };
  function mountWidgets() {
    document.querySelectorAll('[data-widget]').forEach(function (el) {
      var name = el.getAttribute('data-widget'), fn = widgets[name];
      if (!fn) { console.warn('no widget named', name); return; }
      var run = function () {
        var ld = el.querySelector('.w-loading'); if (ld) ld.remove();
        try { fn(el); } catch (e) { console.error('widget ' + name + ' failed', e); el.appendChild(AG.h('p', { class: 'w-note', text: 'This interactive part failed to load: ' + e.message })); }
      };
      if (el.hasAttribute('data-eager')) run(); else AG.onVisible(el, run);
    });
  }

  /* ------------------------------------------------------------ theme */
  var KEY = 'quake-viz-theme';
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  function setupTheme() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    function label() { btn.textContent = currentTheme() === 'dark' ? '☀︎ Light' : '☾ Dark'; }
    label();
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* storage unavailable */ }
      label(); themeChanged();
    });
  }

  /* ------------------------------------------------------------ AI-agent theme: a swarm in the margins, a live scene in each banner */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function hidpi(canvas) {
    var ctx = canvas.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), o = { ctx: ctx, W: 0, H: 0 };
    o.size = function () { var r = canvas.getBoundingClientRect(); o.W = r.width; o.H = r.height; canvas.width = Math.round(o.W * dpr); canvas.height = Math.round(o.H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    o.size(); return o;
  }
  function animate(canvas, step, onResize) {
    var running = false, last = 0, visible = true;
    function frame(t) { if (!running) return; var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t; step(dt, t / 1000); requestAnimationFrame(frame); }
    function start() { if (running || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    window.addEventListener('resize', function () { onResize(); if (reduce) step(0, 0); });
    if (reduce) { for (var i = 0; i < 240; i++) step(0.05, i * 0.05); return; }   // reduced motion: one settled frame
    document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else running = false; }).observe(canvas);
    start();
  }
  // margins: small agents with sensor cones that wander, meet, and chase glowing goals
  function swarm(canvas) {
    var c = hidpi(canvas), agents = [], goals = [];
    function init() {
      c.size(); agents = []; goals = [];
      var n = Math.round(Math.min(46, c.W * c.H / 26000));
      for (var i = 0; i < n; i++) agents.push({ x: rand(0, c.W), y: rand(0, c.H), a: rand(0, 6.28), v: rand(14, 26), pulse: 0 });
      for (i = 0; i < 7; i++) goals.push({ x: rand(0, c.W), y: rand(0, c.H), r: 0 });
    }
    init();
    animate(canvas, function (dt, t) {
      var ctx = c.ctx, W = c.W, H = c.H, dark = AG.isDark();
      var col = dark ? '164,139,255' : '91,79,224', col2 = dark ? '56,214,190' : '15,157,138';
      ctx.clearRect(0, 0, W, H);
      goals.forEach(function (g) { g.r = (g.r + dt * 2) % 6.28; var gl = 4 + Math.sin(g.r) * 1.5; ctx.fillStyle = 'rgba(' + col2 + ',.5)'; ctx.beginPath(); ctx.arc(g.x, g.y, gl, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(' + col2 + ',.18)'; ctx.beginPath(); ctx.arc(g.x, g.y, gl + 7, 0, 7); ctx.stroke(); });
      for (var i = 0; i < agents.length; i++) {
        var A = agents[i];
        // perceive: nearest goal inside the sensor cone; think: steer toward it, else wander; act: move
        var best = null, bd = 140;
        goals.forEach(function (g) { var dx = g.x - A.x, dy = g.y - A.y, d = Math.hypot(dx, dy), da = Math.atan2(dy, dx) - A.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (d < bd && Math.abs(da) < 0.7) { bd = d; best = { g: g, da: da, d: d }; } });
        if (best) { A.a += best.da * Math.min(1, dt * 3); if (best.d < 6) { best.g.x = rand(0, W); best.g.y = rand(0, H); A.pulse = 1; } }
        else A.a += rand(-1, 1) * dt * 1.6;
        A.x += Math.cos(A.a) * A.v * dt; A.y += Math.sin(A.a) * A.v * dt;
        if (A.x < -10) A.x = W + 10; if (A.x > W + 10) A.x = -10; if (A.y < -10) A.y = H + 10; if (A.y > H + 10) A.y = -10;
        for (var j = i + 1; j < agents.length; j++) { var B = agents[j], d2 = Math.hypot(A.x - B.x, A.y - B.y); if (d2 < 90) { ctx.strokeStyle = 'rgba(' + col + ',' + (0.16 * (1 - d2 / 90)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); } }
        ctx.fillStyle = 'rgba(' + col + ',.06)'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, 46, A.a - 0.45, A.a + 0.45); ctx.closePath(); ctx.fill();
        if (A.pulse > 0) { ctx.strokeStyle = 'rgba(' + col2 + ',' + A.pulse * 0.6 + ')'; ctx.beginPath(); ctx.arc(A.x, A.y, 6 + (1 - A.pulse) * 22, 0, 7); ctx.stroke(); A.pulse -= dt * 1.5; }
        ctx.fillStyle = 'rgba(' + col + ',.55)'; ctx.beginPath(); ctx.moveTo(A.x + Math.cos(A.a) * 6, A.y + Math.sin(A.a) * 6); ctx.lineTo(A.x + Math.cos(A.a + 2.5) * 4, A.y + Math.sin(A.a + 2.5) * 4); ctx.lineTo(A.x + Math.cos(A.a - 2.5) * 4, A.y + Math.sin(A.a - 2.5) * 4); ctx.closePath(); ctx.fill();
      }
    }, init);
  }

  /* banner scenes: each lesson's idea, alive. They draw in the right part of the banner. */
  var V = '164,139,255', CY = '56,214,226', MG = '236,92,180', AM = '255,170,90', GR = '90,220,160';
  function rgba(c, a) { return 'rgba(' + c + ',' + a + ')'; }
  var SCENES = {};
  SCENES.net = function () {   // a neural network: percepts in, a forward pass through every layer, an action out
    var layers = [4, 7, 7, 5, 2], pulses = [], nodes = [], glow = {}, W = [], wave = 0, acts = ['move', 'grab'];
    function nextNode(li, a) {   // follow the edge weights: strong connections carry most of the signal
      var w = W[li][a], tot = 0, r, j; for (j = 0; j < w.length; j++) tot += w[j];
      r = Math.random() * tot; for (j = 0; j < w.length; j++) { r -= w[j]; if (r <= 0) return j; } return w.length - 1;
    }
    function fire(li, a) { pulses.push({ l: li, a: a, b: nextNode(li, a), t: 0 }); }
    return { init: function (R) {
        nodes = layers.map(function (n, li) { var out = []; for (var k = 0; k < n; k++) out.push({ x: R.x + R.w * (0.08 + 0.84 * li / (layers.length - 1)), y: R.y + R.h * ((k + 1) / (n + 1)) }); return out; });
        if (!W.length) W = layers.slice(0, -1).map(function (n, li) { var m = []; for (var a = 0; a < n; a++) { var row = []; for (var b = 0; b < layers[li + 1]; b++) row.push(Math.pow(Math.random(), 2.2)); m.push(row); } return m; });
      },
      step: function (ctx, R, dt) {
        // percepts arrive as a trickle, plus a full forward pass (every input fires) every few seconds
        if (Math.random() < dt * 4) fire(0, Math.floor(Math.random() * layers[0]));
        wave -= dt; if (wave <= 0) { wave = 2.6; for (var k = 0; k < layers[0]; k++) { glow['0:' + k] = 1; fire(0, k); } }
        nodes.forEach(function (L, li) { if (li === nodes.length - 1) return; L.forEach(function (n, a) { nodes[li + 1].forEach(function (m, b) { var w = W[li][a][b]; ctx.strokeStyle = rgba(V, .04 + .16 * w); ctx.lineWidth = .6 + 1.2 * w; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke(); }); }); });
        ctx.lineWidth = 1;
        var born = [];   // spawned pulses are collected here: pushing into the array being filtered would drop them
        pulses = pulses.filter(function (p) {
          p.t += dt * 1.6; var A = nodes[p.l][p.a], B = nodes[p.l + 1][p.b], u = Math.min(1, p.t), x = A.x + (B.x - A.x) * u, y = A.y + (B.y - A.y) * u;
          var col = p.l + 2 === nodes.length ? AM : CY, x0 = A.x + (B.x - A.x) * Math.max(0, u - .35), y0 = A.y + (B.y - A.y) * Math.max(0, u - .35);
          ctx.strokeStyle = rgba(col, .45); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1;
          ctx.fillStyle = rgba(col, .95); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
          if (p.t >= 1) {
            glow[(p.l + 1) + ':' + p.b] = 1;
            if (p.l + 2 < nodes.length) { born.push({ l: p.l + 1, a: p.b, b: nextNode(p.l + 1, p.b), t: 0 }); if (Math.random() < .3) born.push({ l: p.l + 1, a: p.b, b: nextNode(p.l + 1, p.b), t: 0 }); }
            return false;
          }
          return true;
        });
        pulses = pulses.concat(born);
        if (pulses.length > 120) pulses.splice(0, pulses.length - 120);
        nodes.forEach(function (L, li) { var out = li === nodes.length - 1; L.forEach(function (n, k) { var g = glow[li + ':' + k] || 0; glow[li + ':' + k] = Math.max(0, g - dt * 1.5); ctx.fillStyle = rgba(out ? AM : V, .35 + .65 * g); ctx.beginPath(); ctx.arc(n.x, n.y, 5 + 4 * g, 0, 7); ctx.fill(); if (g > .3) { ctx.strokeStyle = rgba(out ? AM : CY, g * .5); ctx.beginPath(); ctx.arc(n.x, n.y, 9 + 8 * (1 - g), 0, 7); ctx.stroke(); }
          if (out) { ctx.fillStyle = rgba(out && g > .2 ? AM : '210,205,255', .4 + .6 * g); ctx.font = '600 10px ui-monospace, Menlo, monospace'; ctx.fillText(acts[k] || '', n.x + 12, n.y + 3.5); } }); });
        ctx.fillStyle = rgba('210,205,255', .55); ctx.font = '600 11px ui-monospace, Menlo, monospace';
        ctx.fillText('percepts', nodes[0][0].x - 22, R.y + 14); ctx.fillText('action', nodes[nodes.length - 1][0].x - 18, R.y + 14);
      } };
  };
  function gridScene(cols, rows, fn) {   // helper: a grid laid out in the region
    return function () {
      var g = { cols: cols, rows: rows }, inner = fn(g);
      return { init: function (R) { var cs = Math.min(R.w / cols, R.h / rows); g.cs = cs; g.ox = R.x + (R.w - cs * cols) / 2; g.oy = R.y + (R.h - cs * rows) / 2; if (inner.init) inner.init(R); },
        step: function (ctx, R, dt, t) { inner.step(ctx, R, dt, t); } };
    };
  }
  function cell(ctx, g, x, y, fill, stroke) { var p = 2; ctx.fillStyle = fill; AG.roundRect(ctx, g.ox + x * g.cs + p, g.oy + y * g.cs + p, g.cs - 2 * p, g.cs - 2 * p, 4); ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
  SCENES.vacuum = gridScene(9, 6, function (g) {   // a reflex vacuum cleaning a floor that keeps getting dirty
    var dirt = {}, bot = { x: 0, y: 0, fx: 0, fy: 0 }, timer = 0, clean = {};
    function key(x, y) { return x + ',' + y; }
    return { init: function () { for (var i = 0; i < 18; i++) dirt[key(Math.floor(Math.random() * g.cols), Math.floor(Math.random() * g.rows))] = 1; },
      step: function (ctx, R, dt) {
        timer += dt;
        if (timer > 0.32) {
          timer = 0; var k = key(bot.x, bot.y);
          if (dirt[k]) { delete dirt[k]; clean[k] = 1; }
          else { var opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { var nx = bot.x + d[0], ny = bot.y + d[1]; return nx >= 0 && ny >= 0 && nx < g.cols && ny < g.rows; }); var dd = opts.filter(function (d) { return dirt[key(bot.x + d[0], bot.y + d[1])]; }); var d = pick(dd.length ? dd : opts); bot.x += d[0]; bot.y += d[1]; }
          if (Math.random() < .25) dirt[key(Math.floor(Math.random() * g.cols), Math.floor(Math.random() * g.rows))] = 1;
        }
        bot.fx += (bot.x - bot.fx) * Math.min(1, dt * 10); bot.fy += (bot.y - bot.fy) * Math.min(1, dt * 10);
        for (var x = 0; x < g.cols; x++) for (var y = 0; y < g.rows; y++) { var kk = key(x, y), c = clean[kk] || 0; cell(ctx, g, x, y, c ? rgba(GR, .10 + .25 * c) : rgba(V, .07)); if (c) clean[kk] = Math.max(0, c - dt * .4); if (dirt[kk]) { ctx.fillStyle = rgba(AM, .8); for (var s2 = 0; s2 < 3; s2++) { ctx.beginPath(); ctx.arc(g.ox + (x + .3 + .2 * s2) * g.cs, g.oy + (y + .4 + .15 * (s2 % 2)) * g.cs, 2.4, 0, 7); ctx.fill(); } } }
        var bx = g.ox + (bot.fx + .5) * g.cs, by = g.oy + (bot.fy + .5) * g.cs;
        ctx.strokeStyle = rgba(CY, .35); ctx.beginPath(); ctx.arc(bx, by, g.cs * .6, 0, 7); ctx.stroke();
        ctx.fillStyle = rgba(V, .95); ctx.beginPath(); ctx.arc(bx, by, g.cs * .32, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx + g.cs * .1, by - g.cs * .08, g.cs * .07, 0, 7); ctx.fill();
      } };
  });
  SCENES.search = gridScene(16, 9, function (g) {   // A* expanding a frontier, then the path lights up
    var walls, open, closed, came, gs, S, G, path, hold;
    function key(x, y) { return x + ',' + y; }
    function reset() {
      walls = {}; for (var i = 0; i < 38; i++) walls[key(Math.floor(Math.random() * g.cols), Math.floor(Math.random() * g.rows))] = 1;
      S = [0, Math.floor(Math.random() * g.rows)]; G = [g.cols - 1, Math.floor(Math.random() * g.rows)]; delete walls[key(S[0], S[1])]; delete walls[key(G[0], G[1])];
      open = [S]; closed = {}; came = {}; gs = {}; gs[key(S[0], S[1])] = 0; path = null; hold = 0;
    }
    function hh(p) { return Math.abs(p[0] - G[0]) + Math.abs(p[1] - G[1]); }
    var acc = 0;
    return { init: reset,
      step: function (ctx, R, dt) {
        acc += dt;
        while (acc > 0.045 && !path && open.length) {
          acc -= 0.045;
          open.sort(function (a, b) { return (gs[key(a[0], a[1])] + hh(a)) - (gs[key(b[0], b[1])] + hh(b)); });
          var c = open.shift(), ck = key(c[0], c[1]); if (closed[ck]) continue; closed[ck] = 1;
          if (c[0] === G[0] && c[1] === G[1]) { path = []; var k = ck; while (k) { path.push(k); k = came[k]; } break; }
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var n = [c[0] + d[0], c[1] + d[1]], nk = key(n[0], n[1]); if (n[0] < 0 || n[1] < 0 || n[0] >= g.cols || n[1] >= g.rows || walls[nk] || closed[nk]) return; var ng = gs[ck] + 1; if (gs[nk] === undefined || ng < gs[nk]) { gs[nk] = ng; came[nk] = ck; open.push(n); } });
        }
        if (!open.length && !path) { hold += dt; if (hold > 1.2) reset(); }
        if (path) { hold += dt; if (hold > 2.4) reset(); }
        var onOpen = {}; open.forEach(function (p) { onOpen[key(p[0], p[1])] = 1; });
        for (var x = 0; x < g.cols; x++) for (var y = 0; y < g.rows; y++) {
          var kk = key(x, y);
          cell(ctx, g, x, y, walls[kk] ? 'rgba(255,255,255,.18)' : closed[kk] ? rgba(V, .28) : onOpen[kk] ? rgba(CY, .45) : rgba(V, .05));
        }
        if (path) { ctx.strokeStyle = rgba(AM, .95); ctx.lineWidth = g.cs * .22; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); path.forEach(function (k, i) { var p = k.split(',').map(Number), px = g.ox + (p[0] + .5) * g.cs, py = g.oy + (p[1] + .5) * g.cs; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.lineWidth = 1; }
        [[S, GR], [G, MG]].forEach(function (q) { ctx.fillStyle = rgba(q[1], .95); ctx.beginPath(); ctx.arc(g.ox + (q[0][0] + .5) * g.cs, g.oy + (q[0][1] + .5) * g.cs, g.cs * .32, 0, 7); ctx.fill(); });
      } };
  });
  SCENES.logic = gridScene(6, 4, function (g) {   // a cave in fog: rooms are lit as the agent proves them safe
    var lit, at, timer, order;
    function reset() { lit = {}; at = [0, 3]; timer = 0; order = [[0, 3], [1, 3], [0, 2], [1, 2], [2, 3], [1, 1], [2, 2], [3, 3], [2, 1], [3, 2], [4, 3], [3, 1], [4, 2], [5, 3], [4, 1], [5, 2]]; }
    return { init: reset,
      step: function (ctx, R, dt, t) {
        timer += dt;
        if (timer > 0.55) { timer = 0; if (order.length) { at = order.shift(); lit[at.join(',')] = 1; } else reset(); }
        for (var x = 0; x < g.cols; x++) for (var y = 0; y < g.rows; y++) {
          var k = x + ',' + y, L = lit[k] || 0; if (L && L < 1) lit[k] = Math.min(1, L + dt);
          cell(ctx, g, x, y, L ? rgba(GR, .14 + .14 * L) : 'rgba(10,8,30,.65)', L ? rgba(GR, .45) : rgba(V, .15));
          if (L) { ctx.fillStyle = rgba('220,255,235', .8); ctx.font = '700 ' + Math.round(g.cs * .2) + 'px ui-monospace, Menlo, monospace'; ctx.fillText(((x * 7 + y * 3) % 5 === 0) ? 'B' : ((x + y * 5) % 7 === 0) ? 'S' : 'OK', g.ox + x * g.cs + 8, g.oy + y * g.cs + g.cs * .32); }
        }
        var px = g.ox + (at[0] + .5) * g.cs, py = g.oy + (at[1] + .5) * g.cs, r = g.cs * (.55 + .08 * Math.sin(t * 4));
        var grad = ctx.createRadialGradient(px, py, 0, px, py, r * 1.8); grad.addColorStop(0, rgba(AM, .45)); grad.addColorStop(1, rgba(AM, 0)); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px, py, r * 1.8, 0, 7); ctx.fill();
        ctx.fillStyle = rgba(AM, 1); ctx.beginPath(); ctx.arc(px, py, g.cs * .18, 0, 7); ctx.fill();
      } };
  });
  SCENES.values = gridScene(8, 5, function (g) {   // value iteration: utility spreads out from the goal
    var U, iter, timer, walls = { '3,1': 1, '3,2': 1, '5,3': 1 }, goal = '7,0', pit = '7,1';
    function reset() { U = {}; iter = 0; timer = 0; }
    function val(x, y) { return U[x + ',' + y] || 0; }
    return { init: reset,
      step: function (ctx, R, dt) {
        timer += dt;
        if (timer > 0.35) {
          timer = 0; iter++; if (iter > 26) { reset(); return; }
          var N = {};
          for (var x = 0; x < g.cols; x++) for (var y = 0; y < g.rows; y++) {
            var k = x + ',' + y; if (walls[k]) continue; if (k === goal) { N[k] = 1; continue; } if (k === pit) { N[k] = -1; continue; }
            var best = -9; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = x + d[0], ny = y + d[1]; var v = (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || walls[nx + ',' + ny]) ? val(x, y) : val(nx, ny); best = Math.max(best, v); });
            N[k] = -0.04 + 0.95 * best;
          }
          U = N;
        }
        for (var x2 = 0; x2 < g.cols; x2++) for (var y2 = 0; y2 < g.rows; y2++) {
          var k2 = x2 + ',' + y2, v = val(x2, y2);
          if (walls[k2]) { cell(ctx, g, x2, y2, 'rgba(255,255,255,.16)'); continue; }
          cell(ctx, g, x2, y2, v >= 0 ? rgba(GR, .06 + .6 * v) : rgba(MG, .1 + .5 * -v));
          if (iter > 2 && k2 !== goal && k2 !== pit) {
            var bd = null, bv = -9; [[1, 0, '→'], [-1, 0, '←'], [0, 1, '↓'], [0, -1, '↑']].forEach(function (d) { var nx = x2 + d[0], ny = y2 + d[1]; if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || walls[nx + ',' + ny]) return; if (val(nx, ny) > bv) { bv = val(nx, ny); bd = d[2]; } });
            ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '700 ' + Math.round(g.cs * .34) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText(bd || '', g.ox + (x2 + .5) * g.cs, g.oy + (y2 + .62) * g.cs); ctx.textAlign = 'left';
          }
        }
        ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(g.cs * .3) + 'px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('+1', g.ox + 7.5 * g.cs, g.oy + .62 * g.cs); ctx.fillText('−1', g.ox + 7.5 * g.cs, g.oy + 1.62 * g.cs); ctx.textAlign = 'left';
      } };
  });
  SCENES.tokens = function () {   // a sentence being generated: attention arcs from the newest token to earlier ones
    var words = ['the', 'robot', 'saw', 'the', 'wall', ',', 'so', 'it', 'turned', 'left', 'and', 'kept', 'exploring', '.'], n = 2, timer = 0, R0, wts = [];
    function layout(R) { var x = R.x, y = R.y + R.h * .72, out = []; for (var i = 0; i < n; i++) { var w = words[i].length * 8 + 16; if (x + w > R.x + R.w) { x = R.x; y += 30; } out.push({ x: x, y: y, w: w }); x += w + 6; } return out; }
    return { init: function (R) { R0 = R; },
      step: function (ctx, R, dt, t) {
        timer += dt;
        if (timer > 1.1) { timer = 0; n++; if (n > words.length) n = 2; wts = []; for (var i = 0; i < n - 1; i++) wts.push(Math.random() ** 2); wts[n === 8 ? 1 : Math.floor(Math.random() * (n - 1))] = 1; }
        var pos = layout(R), last = pos[n - 1];
        for (var i = 0; i < n - 1; i++) {
          var p = pos[i], w = wts[i] || 0.15, x1 = p.x + p.w / 2, x2 = last.x + last.w / 2, top = Math.min(p.y, last.y) - 30 - Math.abs(x2 - x1) * 0.25;
          ctx.strokeStyle = rgba(CY, .15 + .7 * w); ctx.lineWidth = 1 + 5 * w; ctx.beginPath(); ctx.moveTo(x1, p.y - 12); ctx.quadraticCurveTo((x1 + x2) / 2, top, x2, last.y - 12); ctx.stroke();
        }
        ctx.lineWidth = 1;
        pos.forEach(function (p, i) {
          var isNew = i === n - 1, a = isNew ? Math.min(1, timer * 3) : 1;
          ctx.fillStyle = isNew ? rgba(AM, .25 * a) : rgba(V, .22); AG.roundRect(ctx, p.x, p.y - 11, p.w, 22, 6); ctx.fill();
          ctx.strokeStyle = isNew ? rgba(AM, .9 * a) : rgba(V, .5); ctx.stroke();
          ctx.fillStyle = 'rgba(240,238,255,' + (.92 * a) + ')'; ctx.font = '600 12px ui-monospace, Menlo, monospace'; ctx.fillText(words[i], p.x + 8, p.y + 4);
        });
        // next-token probabilities flicker above
        ctx.font = '600 10.5px ui-monospace, Menlo, monospace';
        ['P(next)', '0.61', '0.22', '0.09'].forEach(function (s2, i) { ctx.fillStyle = rgba('210,205,255', i ? .55 : .7); ctx.fillText(s2, R.x + R.w - 70, R.y + 16 + i * 15); if (i) { ctx.fillStyle = rgba(AM, .7); ctx.fillRect(R.x + R.w - 36, R.y + 8 + i * 15, 30 * (+s2 + .05 * Math.sin(t * 3 + i)), 7); } });
      } };
  };
  SCENES.loop = function () {   // the tool-use loop: a packet orbits model → tool_use → harness → tool_result
    var st = ['model', 'tool_use', 'harness', 'tool_result'], ang = 0, log = [], lastS = -1, cols = [V, AM, CY, GR];
    var LINES = [['model', 'reads 3 messages'], ['tool_use', 'read_file("calc.py")'], ['harness', 'permission ✓ · run'], ['tool_result', '6 lines, 92 chars'], ['model', 'found the bug'], ['tool_use', 'write_file("calc.py")'], ['harness', 'ask user · allowed'], ['tool_result', 'wrote 77 chars'], ['model', 'run the tests'], ['tool_use', 'run_python(test)'], ['harness', 'sandbox ✓'], ['tool_result', 'all tests passed']];
    var li = 0;
    return { step: function (ctx, R, dt) {
      var cx = R.x + R.w * .34, cy = R.y + R.h * .5, r = Math.min(R.w * .26, R.h * .38);
      ang += dt * 0.9; var s2 = Math.floor(((ang % 6.283) / 6.283) * 4);
      if (s2 !== lastS) { lastS = s2; log.push(LINES[li % LINES.length]); li++; if (log.length > 7) log.shift(); }
      ctx.strokeStyle = rgba(V, .35); ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      st.forEach(function (name, i) {
        var a = -Math.PI / 2 + i * Math.PI / 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, on = i === s2;
        ctx.fillStyle = rgba(cols[i], on ? .9 : .3); ctx.beginPath(); ctx.arc(x, y, on ? 11 : 8, 0, 7); ctx.fill();
        ctx.fillStyle = rgba('235,232,255', on ? 1 : .6); ctx.font = (on ? '700 ' : '600 ') + '11.5px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.fillText(name, x, y + (i === 2 ? 26 : -18)); ctx.textAlign = 'left';
      });
      var pa = -Math.PI / 2 + ang, px = cx + Math.cos(pa) * r, py = cy + Math.sin(pa) * r;
      var gr = ctx.createRadialGradient(px, py, 0, px, py, 18); gr.addColorStop(0, rgba(AM, .9)); gr.addColorStop(1, rgba(AM, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, 18, 0, 7); ctx.fill();
      var lx = R.x + R.w * .66, ly = R.y + 18;
      ctx.fillStyle = 'rgba(5,5,20,.55)'; AG.roundRect(ctx, lx - 8, ly - 14, R.w * .36, 7 * 17 + 14, 8); ctx.fill();
      log.forEach(function (l, i) { ctx.font = '600 11px ui-monospace, Menlo, monospace'; ctx.fillStyle = rgba(cols[st.indexOf(l[0])], .95); ctx.fillText(l[0], lx, ly + i * 17); ctx.fillStyle = 'rgba(230,230,240,.8)'; ctx.fillText(l[1], lx + 84, ly + i * 17); });
    } };
  };
  SCENES.world = function () {   // a robot with sonar mapping a room
    var bot, hits = [], room, box;
    function dist(x, y, a) { for (var tt = 2; tt < 600; tt += 2) { var px = x + Math.cos(a) * tt, py = y + Math.sin(a) * tt; if (px < room.x || px > room.x + room.w || py < room.y || py > room.y + room.h || (px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h)) return [tt, px, py]; } return [600, x, y]; }
    return { init: function (R) { room = { x: R.x + R.w * .08, y: R.y + R.h * .08, w: R.w * .84, h: R.h * .84 }; box = { x: room.x + room.w * .55, y: room.y + room.h * .3, w: room.w * .16, h: room.h * .3 }; bot = { x: room.x + 40, y: room.y + room.h - 40, a: -0.3, sweep: 0 }; hits = []; },
      step: function (ctx, R, dt, t) {
        bot.sweep += dt * 2.2;
        var beamA = bot.a + Math.sin(bot.sweep) * 0.9, d = dist(bot.x, bot.y, beamA), ahead = dist(bot.x, bot.y, bot.a)[0];
        if (Math.random() < dt * 60) { hits.push([d[1], d[2], 1]); if (hits.length > 420) hits.shift(); }
        if (ahead < 40) bot.a += dt * 2.4; else { bot.x += Math.cos(bot.a) * 34 * dt; bot.y += Math.sin(bot.a) * 34 * dt; bot.a += Math.sin(t * .7) * dt * .4; }
        var m = 14;   // reflex layer: never leave the room
        if (bot.x < room.x + m || bot.x > room.x + room.w - m || bot.y < room.y + m || bot.y > room.y + room.h - m) { bot.x = AG.clamp(bot.x, room.x + m, room.x + room.w - m); bot.y = AG.clamp(bot.y, room.y + m, room.y + room.h - m); bot.a += Math.PI * 0.6; }
        ctx.strokeStyle = rgba(V, .35); ctx.strokeRect(room.x, room.y, room.w, room.h);
        ctx.fillStyle = rgba(V, .12); ctx.fillRect(box.x, box.y, box.w, box.h);
        hits.forEach(function (hh) { hh[2] = Math.max(.25, hh[2] - dt * .05); ctx.fillStyle = rgba(GR, .8 * hh[2]); ctx.fillRect(hh[0] - 1.5, hh[1] - 1.5, 3, 3); });
        var gr = ctx.createLinearGradient(bot.x, bot.y, d[1], d[2]); gr.addColorStop(0, rgba(CY, .45)); gr.addColorStop(1, rgba(CY, .05));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.arc(bot.x, bot.y, d[0], beamA - .09, beamA + .09); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba(V, 1); ctx.beginPath(); ctx.arc(bot.x, bot.y, 10, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(bot.x + Math.cos(bot.a) * 10, bot.y + Math.sin(bot.a) * 10); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = rgba('220,255,240', .75); ctx.font = '600 11px ui-monospace, Menlo, monospace'; ctx.fillText('distance ' + Math.round(d[0] / 2) + ' cm', room.x + 8, room.y + 16);
      } };
  };
  SCENES.swarm = function () {   // many agents, each with a goal: the lab
    var ag = [], goals = [];
    return { init: function (R) { ag = []; goals = []; for (var i = 0; i < 26; i++) ag.push({ x: R.x + rand(0, R.w), y: R.y + rand(0, R.h), a: rand(0, 6.28), tr: [] }); for (i = 0; i < 5; i++) goals.push({ x: R.x + rand(20, R.w - 20), y: R.y + rand(20, R.h - 20) }); },
      step: function (ctx, R, dt) {
        goals.forEach(function (g) { ctx.fillStyle = rgba(AM, .9); ctx.beginPath(); ctx.arc(g.x, g.y, 5, 0, 7); ctx.fill(); ctx.strokeStyle = rgba(AM, .3); ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, 7); ctx.stroke(); });
        ag.forEach(function (a) {
          var g = goals.reduce(function (b, q) { return Math.hypot(q.x - a.x, q.y - a.y) < Math.hypot(b.x - a.x, b.y - a.y) ? q : b; }, goals[0]);
          var want = Math.atan2(g.y - a.y, g.x - a.x), da = Math.atan2(Math.sin(want - a.a), Math.cos(want - a.a));
          a.a += da * dt * 2 + rand(-1, 1) * dt; a.x += Math.cos(a.a) * 40 * dt; a.y += Math.sin(a.a) * 40 * dt;
          if (Math.hypot(g.x - a.x, g.y - a.y) < 8) { g.x = R.x + rand(20, R.w - 20); g.y = R.y + rand(20, R.h - 20); }
          a.tr.push([a.x, a.y]); if (a.tr.length > 18) a.tr.shift();
          ctx.strokeStyle = rgba(V, .3); ctx.beginPath(); a.tr.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
          ctx.fillStyle = rgba(CY, .95); ctx.beginPath(); ctx.arc(a.x, a.y, 3.2, 0, 7); ctx.fill();
        });
      } };
  };
  // the agent loop readout in the banner: PERCEIVE / THINK / ACT, typed and cycled
  var LOOPS = {
    net: [['a learner asks: "how do agents work?"', 'start from percepts, actions and goals', 'open lesson 00 · background']],
    vacuum: [['[A, Dirty]', 'rule: dirty → suck', 'Suck'], ['[A, Clean]', 'rule: clean, at A → go right', 'Right'], ['[B, Clean]', 'model: A clean, B clean → rest', 'NoOp']],
    search: [['In(Arad), goal In(Bucharest)', 'f = g + h: Sibiu 393, Timisoara 447', 'expand Sibiu'], ['frontier: RV 413, Fagaras 415', 'lowest f first', 'expand Rimnicu Vilcea'], ['Bucharest popped, cost 418', 'goal test passes', 'return path']],
    logic: [['no breeze, no stench in [1,1]', 'KB ⊨ ¬P[1,2] ∧ ¬P[2,1]', 'move to [1,2]'], ['stench in [1,2]', 'wumpus in [1,3] or [2,2]', 'move to [2,1]'], ['breeze in [2,1], no stench', 'KB ⊨ W[1,3], [2,2] is safe', 'move to [2,2]']],
    values: [['state (1,1), R = −0.04', 'U = R + γ max Σ P·U', 'update U(1,1)'], ['δ = 0.012 after 12 sweeps', 'not converged yet', 'sweep again'], ['δ < 1e-6', 'π(s) = argmax expected utility', 'follow the policy']],
    tokens: [['"the robot saw the wall, so it"', 'attention: "it" → "robot"', 'emit "turned"'], ['"... so it turned"', 'P(left) 0.61, P(around) 0.22', 'sample "left"'], ['"... turned left"', 'temperature 0.8', 'emit "and"']],
    loop: [['user: "the tests fail"', 'I should look before I change anything', 'tool_use: read_file("calc.py")'], ['tool_result: mean() divides by 2', 'the bug is the hard-coded 2', 'tool_use: write_file(...)'], ['tool_result: all tests passed', 'the task is done', 'reply with a summary']],
    world: [['sonar: 23 cm ahead', 'too close to drive 50 cm', 'turn(90)'], ['sonar: 170 cm ahead', 'the path is clear', 'drive(100)'], ['tool_result: refused (clearance)', 'the body knows the limit', 'drive(50)']],
    zoo: [['dirty: no · walls: N, E', 'model: an unexplored square to the west', 'move W'], ['battery 31 · home is 24 steps away', 'utility: the risk of a dead battery is too high', 'head home'], ['on the dock', 'recharge, then explore again', 'Dock']],
    scope: [['sharpness 0.31 at z = 80 µm', 'coarse sweep: try z = 110', 'set_focus(110)'], ['sharpness 0.97 at z = 119', 'refine by golden-section search', 'set_focus(119.6)'], ['tool_result: z = 900 refused', 'the limit is 0–300 µm', 'stay in range']],
    swarm: [['your agent.py', 'run it in 8 environments', 'score it'], ['score 19.25 ≥ 19', 'level passed', 'next level'], ['tools for Claude', 'docstrings become schemas', 'let Claude call them']],
  };
  function loopReadout(el, scene) {
    var L = LOOPS[scene] || LOOPS.net, rows = ['PERCEIVE', 'THINK', 'ACT'], k = 0;
    el.innerHTML = '';
    var spans = rows.map(function (r, i) { var row = AG.h('div', { class: 'loop-row r' + i }, [AG.h('b', { text: r }), AG.h('span')]); el.appendChild(row); return row; });
    if (reduce) { L[0].forEach(function (t, i) { spans[i].lastChild.textContent = t; }); return; }
    (function cycle() {
      var item = L[k % L.length]; k++;
      spans.forEach(function (s2) { s2.classList.remove('on'); s2.lastChild.textContent = ''; });
      var i = 0;
      (function nextRow() {
        if (i >= 3) { setTimeout(cycle, 2600); return; }
        var row = spans[i], txt = item[i], j = 0; row.classList.add('on');
        (function type() { row.lastChild.textContent = txt.slice(0, ++j); if (j < txt.length) setTimeout(type, 22); else { i++; setTimeout(nextRow, 420); } })();
      })();
    })();
  }
  function banner() {
    var bg = AG.h('canvas', { class: 'ag-bg', 'aria-hidden': 'true' });
    document.body.insertBefore(bg, document.body.firstChild);
    swarm(bg);
    var cv = document.querySelector('canvas.banner-fx');
    if (cv) {
      var name = cv.getAttribute('data-scene') || 'net', sc = (SCENES[name] || SCENES.net)(), c = hidpi(cv), R = {};
      var layout = function () {
        c.size();
        var wide = c.W > 760;
        R = wide ? { x: c.W * 0.56, y: 26, w: c.W * 0.41, h: c.H - 52 } : { x: 16, y: 16, w: c.W - 32, h: c.H - 32 };
        if (sc.init) sc.init(R);
      };
      layout();
      animate(cv, function (dt, t) { c.ctx.clearRect(0, 0, c.W, c.H); sc.step(c.ctx, R, dt, t); }, layout);
    }
    var lr = document.querySelector('.banner .loop-log');
    if (lr) loopReadout(lr, lr.getAttribute('data-loop'));
  }

  /* ------------------------------------------------------------ XP and badges (stored only in this browser) */
  var BADGES = [
    ['first-run', '▶', 'First run', 'Ran Python in the browser'],
    ['quiz', '✅', 'Quiz taker', 'Finished a quiz'],
    ['perfect', '🎯', 'Perfect score', 'All answers right in a quiz'],
    ['explorer', '🕹', 'Explorer', 'Used 10 different widgets'],
    ['editor', '✎', 'Hacker', 'Edited and ran a program'],
    ['live', '🔑', 'Live wire', 'Ran a live Claude agent'],
    ['lab1', '🧹', 'Lab: vacuum', 'Passed an Agent Lab level'],
    ['lab-all', '🏆', 'Lab master', 'Passed every Agent Lab level'],
    ['half', '📗', 'Halfway', 'Finished 5 lessons'],
    ['graduate', '🎓', 'Graduate', 'Finished all lessons'],
  ];
  AG.BADGES = BADGES;
  function xpState() { return AG.store('xp') || { xp: 0, badges: {}, widgets: {} }; }
  function level(xp) { return Math.floor(Math.sqrt(xp / 25)) + 1; }
  function toast(title, sub) {
    var t = AG.h('div', { class: 'toast', role: 'status' }, [AG.h('b', { text: title }), AG.h('small', { text: sub })]);
    document.body.appendChild(t); requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 400); }, 3200);
  }
  AG.xp = function (n, at) {
    var s = xpState(), before = level(s.xp); s.xp += n; AG.store('xp', s); xpPill();
    if (at && !reduce) { var f = AG.h('div', { class: 'xp-float', text: '+' + n + ' XP' }); f.style.left = at.x + 'px'; f.style.top = at.y + 'px'; document.body.appendChild(f); setTimeout(function () { f.remove(); }, 1200); }
    if (level(s.xp) > before) toast('⚡ Level ' + level(s.xp) + '!', 'Your agent knowledge is leveling up.');
  };
  AG.badge = function (id) {
    var s = xpState(); if (s.badges[id]) return; s.badges[id] = Date.now(); AG.store('xp', s);
    var b = BADGES.filter(function (x) { return x[0] === id; })[0]; if (b) { toast(b[1] + ' Badge: ' + b[2], b[3]); AG.xp(20); }
    renderBadges();
  };
  function xpPill() {
    var p = document.querySelector('[data-xp]'); if (!p) return;
    var s = xpState(), L = level(s.xp), lo = 25 * (L - 1) * (L - 1), hi = 25 * L * L;
    p.innerHTML = '⚡ Lv ' + L + ' <span class="bar"><i style="width:' + Math.round(100 * (s.xp - lo) / (hi - lo)) + '%"></i></span> ' + s.xp + ' XP';
  }
  function renderBadges() {
    var host = document.querySelector('[data-badges]'); if (!host) return;
    var s = xpState(); host.innerHTML = '';
    BADGES.forEach(function (b) { host.appendChild(AG.h('div', { class: 'badge' + (s.badges[b[0]] ? ' got' : ''), title: b[3] }, [AG.h('span', { class: 'ico', text: b[1] }), AG.h('b', { text: b[2] }), AG.h('span', { text: b[3] })])); });
  }
  function xpInit() {
    xpPill(); renderBadges();
    var p = document.querySelector('[data-xp]');
    if (p) p.addEventListener('click', function () { var r = document.body.getAttribute('data-root') || ''; location.href = r + 'index.html#profile'; });
    // first interaction with each widget on each page: +5 XP
    document.addEventListener('pointerdown', function (e) {
      var w = e.target.closest && e.target.closest('[data-widget]'); if (!w) return;
      var key = (document.body.getAttribute('data-lesson') || 'hub') + ':' + w.getAttribute('data-widget');
      var s = xpState(); if (s.widgets[key]) return; s.widgets[key] = 1; AG.store('xp', s);
      AG.xp(5, { x: e.clientX, y: e.clientY });
      if (Object.keys(s.widgets).length >= 10) AG.badge('explorer');
    }, true);
    var d = AG.store('done') || {}, n = Object.keys(d).length;
    if (n >= 5) AG.badge('half');
    if (n >= 11) AG.badge('graduate');
  }

  /* ------------------------------------------------------------ reading bar, TOC, reveal */
  function chrome() {
    var bar = document.querySelector('.read-bar');
    if (bar) {
      var tick = function () {
        var h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0) + ')';
      };
      addEventListener('scroll', tick, { passive: true }); tick();
    }
    var links = [].slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    if (links.length && 'IntersectionObserver' in window) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { links.forEach(function (a) { a.classList.remove('on'); }); var a = map[e.target.id]; if (a) a.classList.add('on'); }
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
    if ('IntersectionObserver' in window) {   // section number badges light up like activated nodes
      var io3 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('lit'); io3.unobserve(e.target); } }); }, { rootMargin: '0px 0px -25% 0px' });
      document.querySelectorAll('.content > section, .hub > section').forEach(function (sec) { io3.observe(sec); });
    }
    var rv = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !reduce) {
      var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      rv.forEach(function (el) { io2.observe(el); });
    } else rv.forEach(function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------ glossary */
  AG.GLOSSARY = {
    'agent': ['Agent', 'Anything that perceives its environment through sensors and acts on it through actuators. A thermostat, a vacuum robot, a chess program and Claude Code are all agents.', 'AIMA §2.1'],
    'environment': ['Environment', 'The part of the world the agent perceives and acts on. Everything outside the agent program.', 'AIMA §2.1'],
    'percept': ['Percept', 'What the agent\'s sensors deliver at one instant. For Claude Code: the user\'s message or a tool result.', 'AIMA §2.1'],
    'percept sequence': ['Percept sequence', 'The complete history of everything the agent has ever perceived. A rational agent\'s choice may depend on all of it.', 'AIMA §2.1'],
    'actuator': ['Actuator', 'The part of an agent that changes the world: wheels, a gripper, a display, or a tool call that writes a file.', 'AIMA §2.1'],
    'sensor': ['Sensor', 'The part of an agent that observes the world: a camera, an ultrasonic range finder, or a tool that reads a file.', 'AIMA §2.1'],
    'agent function': ['Agent function', 'A mathematical description of behavior: a map from every possible percept sequence to an action. Abstract, usually infinite.', 'AIMA §2.1'],
    'agent program': ['Agent program', 'The concrete code that implements the agent function on a physical architecture. It takes the current percept and returns an action.', 'AIMA §2.4'],
    'architecture': ['Architecture', 'The computing device the agent program runs on, with its sensors and actuators. Agent = architecture + program.', 'AIMA §2.4'],
    'performance measure': ['Performance measure', 'The criterion, chosen by the designer, that scores a sequence of environment states. Rationality is defined relative to it.', 'AIMA §2.2'],
    'rational agent': ['Rational agent', 'For every percept sequence, picks the action expected to maximize its performance measure, given its percepts and built-in knowledge. Rational is not the same as omniscient.', 'AIMA §2.2'],
    'omniscience': ['Omniscience', 'Knowing the actual outcome of actions. Impossible in practice; a rational agent maximizes expected performance instead.', 'AIMA §2.2'],
    'autonomy': ['Autonomy', 'The degree to which an agent relies on its own percepts and learning rather than on its designer\'s prior knowledge.', 'AIMA §2.2'],
    'peas': ['PEAS', 'Performance measure, Environment, Actuators, Sensors: the four things to write down before designing any agent.', 'AIMA §2.3'],
    'fully observable': ['Fully observable', 'The sensors give the complete relevant state of the world at each moment. Chess is; driving and coding usually are not.', 'AIMA §2.3'],
    'partially observable': ['Partially observable', 'The sensors miss part of the state (noise, limited range, hidden variables). The agent must remember or infer what it cannot see.', 'AIMA §2.3'],
    'deterministic': ['Deterministic', 'The next state is completely determined by the current state and the action. Otherwise the environment is stochastic or nondeterministic.', 'AIMA §2.3'],
    'stochastic': ['Stochastic', 'Outcomes of actions are uncertain and described by probabilities (a wheel slips 10% of the time).', 'AIMA §2.3'],
    'episodic': ['Episodic', 'Experience splits into independent episodes: each decision does not affect later ones (classifying separate images). Otherwise sequential.', 'AIMA §2.3'],
    'sequential': ['Sequential', 'The current decision can affect all future decisions (chess, driving, editing a codebase).', 'AIMA §2.3'],
    'static': ['Static', 'The world does not change while the agent deliberates. Dynamic worlds keep moving; semidynamic ones only change the score.', 'AIMA §2.3'],
    'dynamic': ['Dynamic', 'The environment can change while the agent is thinking, so slow deliberation counts as a choice to do nothing.', 'AIMA §2.3'],
    'discrete': ['Discrete', 'A finite number of distinct states, percepts and actions (board games, text). Continuous ones vary smoothly (steering angle, position).', 'AIMA §2.3'],
    'multiagent': ['Multiagent', 'Other agents whose behavior affects your performance are in the environment, cooperative or competitive.', 'AIMA §2.3'],
    'known': ['Known environment', 'The agent (or designer) knows the rules: the outcome or outcome probabilities of each action. Unknown environments must be learned.', 'AIMA §2.3'],
    'simple reflex agent': ['Simple reflex agent', 'Chooses actions from the current percept alone using condition-action rules. Works only if the right decision can be made from the current percept.', 'AIMA §2.4'],
    'model-based agent': ['Model-based reflex agent', 'Keeps an internal state, updated with a transition model (how the world evolves, what actions do) and a sensor model, to handle partial observability.', 'AIMA §2.4'],
    'goal-based agent': ['Goal-based agent', 'Has explicit goals and chooses actions by considering the future: search and planning.', 'AIMA §2.4'],
    'utility-based agent': ['Utility-based agent', 'Scores states with a utility function and picks the action with the highest expected utility; handles trade-offs and uncertainty.', 'AIMA §2.4'],
    'learning agent': ['Learning agent', 'Has a performance element (chooses actions), a critic (feedback), a learning element (improves the performance element) and a problem generator (suggests exploration).', 'AIMA §2.4'],
    'condition-action rule': ['Condition-action rule', 'An if-then rule: if the condition holds in the percept or state, do the action. "If car-in-front-is-braking then initiate-braking."', 'AIMA §2.4'],
    'transition model': ['Transition model', 'A description of what each action does: RESULT(s, a) in deterministic worlds, P(s\' | s, a) in stochastic ones.', 'AIMA §2.4, §3.1'],
    'sensor model': ['Sensor model', 'How the state of the world shows up in the agent\'s percepts, e.g. P(percept | state).', 'AIMA 4e §2.4'],
    'state': ['State', 'A description of the world (or of the agent\'s belief about it) at one moment.', ''],
    'search problem': ['Search problem', 'States, an initial state, goal states, ACTIONS(s), RESULT(s, a), and ACTION-COST. A solution is a sequence of actions from initial state to a goal.', 'AIMA §3.1'],
    'frontier': ['Frontier', 'The set of generated nodes waiting to be expanded (also called the open list). The order of the frontier is what distinguishes search algorithms.', 'AIMA §3.3'],
    'node': ['Search node', 'A bookkeeping structure in the search tree: a state plus its parent, the action that reached it, and the path cost g(n).', 'AIMA §3.3'],
    'expand': ['Expand', 'Generate all the children of a node by applying every legal action to its state.', 'AIMA §3.3'],
    'heuristic': ['Heuristic h(n)', 'An estimate of the cost from node n to the nearest goal. Straight-line distance is a heuristic for road distance.', 'AIMA §3.5'],
    'admissible': ['Admissible heuristic', 'Never overestimates the true cost to reach a goal. With an admissible heuristic, A* tree search is optimal.', 'AIMA §3.5'],
    'consistent': ['Consistent heuristic', 'h(n) ≤ cost(n, a, n\') + h(n\') for every step: the triangle inequality. Consistency implies admissibility and makes A* graph search optimal.', 'AIMA §3.5'],
    'bfs': ['Breadth-first search', 'Expands the shallowest node first (FIFO queue). Finds the path with the fewest steps; optimal only if every step costs the same.', 'AIMA §3.4'],
    'dfs': ['Depth-first search', 'Expands the deepest node first (LIFO stack). Little memory, but not optimal and can get lost in deep or infinite branches.', 'AIMA §3.4'],
    'ucs': ['Uniform-cost search', 'Expands the node with the lowest path cost g(n). Dijkstra\'s algorithm, aimed at a goal. Optimal for positive costs.', 'AIMA §3.4'],
    'greedy': ['Greedy best-first search', 'Expands the node that looks closest to the goal, f(n) = h(n). Often fast, not optimal.', 'AIMA §3.5'],
    'astar': ['A* search', 'Expands the node with the lowest f(n) = g(n) + h(n): cost so far plus estimated cost to go. Optimal with an admissible (tree) or consistent (graph) heuristic.', 'AIMA §3.5'],
    'mdp': ['Markov decision process', 'A sequential decision problem in a fully observable, stochastic world: states, actions, a transition model P(s\'|s,a) and rewards.', 'AIMA §17.1'],
    'policy': ['Policy π', 'A function from states to actions: what the agent does in every state. The solution of an MDP.', 'AIMA §17.1'],
    'utility': ['Utility U(s)', 'The expected total (discounted) reward from state s onward when acting optimally.', 'AIMA §17.1'],
    'discount': ['Discount factor γ', 'A number between 0 and 1 that makes rewards now worth more than rewards later. γ near 0 is short-sighted.', 'AIMA §17.1'],
    'bellman': ['Bellman equation', 'U(s) = R(s) + γ max_a Σ_s\' P(s\'|s,a) U(s\'). The utility of a state is its reward plus the discounted expected utility of the best next state.', 'AIMA §17.2'],
    'value iteration': ['Value iteration', 'Start with arbitrary utilities and apply the Bellman update to every state repeatedly. Converges to the true utilities.', 'AIMA §17.2'],
    'q-learning': ['Q-learning', 'A model-free reinforcement-learning method that learns Q(s,a), the value of doing a in s, from experience alone: Q ← Q + α(r + γ max Q(s\',·) − Q).', 'AIMA 3e §21.3, 4e §22.3'],
    'exploration': ['Exploration vs exploitation', 'Trying actions to learn more (explore) versus using what you already know works (exploit). ε-greedy explores with probability ε.', 'AIMA 3e §21.3, 4e §22.3'],
    'reward': ['Reward', 'A number the environment gives the agent after each step. Reinforcement learning maximizes the sum of rewards.', 'AIMA §17.1'],
    'knowledge base': ['Knowledge base (KB)', 'A set of sentences in a formal language. The agent TELLs it what it perceives and ASKs it what to do.', 'AIMA §7.1'],
    'entailment': ['Entailment ⊨', 'KB ⊨ α means α is true in every world (model) in which the KB is true.', 'AIMA §7.3'],
    'model checking': ['Model checking', 'Deciding entailment by enumerating every possible world and checking that α holds in all those where the KB holds.', 'AIMA §7.4'],
    'llm': ['Large language model (LLM)', 'A neural network (a transformer) trained to predict the next token of text. Claude is one. On its own it maps a text prefix to a probability distribution over next tokens.', 'AIMA 4e Ch. 24'],
    'token': ['Token', 'The unit an LLM reads and writes: a common word, a piece of a word, a symbol or a byte. Roughly 3-4 characters of English text on average.', ''],
    'tokenizer': ['Tokenizer', 'The fixed program that turns text into token IDs and back. Usually learned with byte-pair encoding (BPE) or a similar algorithm.', ''],
    'embedding': ['Embedding', 'A learned vector of numbers that represents a token. Similar tokens end up with similar vectors.', 'AIMA 4e §24.1'],
    'attention': ['Attention', 'Each position builds a query vector and compares it with every earlier position\'s key vector; the softmax of those scores weights a sum of value vectors.', 'AIMA 4e §24.4'],
    'transformer': ['Transformer', 'The neural network architecture behind modern LLMs: stacked blocks of self-attention and feed-forward layers with residual connections (Vaswani et al., 2017).', 'AIMA 4e §24.4'],
    'softmax': ['Softmax', 'Turns a list of scores into probabilities: exp(score_i) / Σ_j exp(score_j). Bigger scores get exponentially more probability.', ''],
    'logits': ['Logits', 'The raw scores a model outputs for every possible next token, before softmax turns them into probabilities.', ''],
    'temperature': ['Temperature', 'Divides the logits before softmax. Below 1 sharpens the distribution (more predictable), above 1 flattens it (more random).', ''],
    'context window': ['Context window', 'The maximum number of tokens the model can take in at once: system prompt, tool definitions, every message and tool result so far. Its working memory.', ''],
    'pretraining': ['Pretraining', 'Training a model on a very large text corpus to predict the next token. It learns language, facts and patterns, not yet to follow instructions.', ''],
    'fine-tuning': ['Fine-tuning', 'Further training of a pretrained model on targeted data, such as conversations that show helpful, honest assistant behavior.', ''],
    'rlhf': ['RLHF', 'Reinforcement learning from human feedback: a reward model learned from human preference comparisons steers the LLM toward preferred answers.', ''],
    'constitutional ai': ['Constitutional AI', 'Anthropic\'s method of training with feedback guided by a written set of principles (a constitution), including feedback generated by AI models.', ''],
    'tool use': ['Tool use (function calling)', 'The model emits a structured request (a tool name and JSON arguments); your program runs the tool and sends the result back as a message.', ''],
    'harness': ['Agent harness', 'The ordinary program around the model: it runs the loop, executes tools, enforces permissions and manages the context. Claude Code is a harness.', ''],
    'system prompt': ['System prompt', 'Instructions from the developer placed before the conversation: the agent\'s role, rules and style.', ''],
    'compaction': ['Compaction', 'Summarizing older parts of a long conversation so it fits in the context window and the agent can keep working.', ''],
    'mcp': ['Model Context Protocol (MCP)', 'An open protocol (JSON-RPC 2.0) that lets an AI application discover and call tools, read resources and use prompts provided by separate server programs.', ''],
    'json-rpc': ['JSON-RPC 2.0', 'A tiny remote-procedure-call format: {"jsonrpc":"2.0","id":1,"method":"...","params":{...}} answered by a result or an error with the same id.', ''],
    'scpi': ['SCPI', 'Standard Commands for Programmable Instruments: text commands like *IDN? or MEAS:VOLT? understood by many lab instruments over USB, Ethernet or GPIB, often via VISA.', ''],
    'prompt injection': ['Prompt injection', 'Text inside data the agent reads (a web page, a file, a tool result) that tries to make the model follow new instructions. Defended by permissions and least privilege, not by trust.', ''],
    'least privilege': ['Least privilege', 'Give an agent only the tools, files, network access and physical range it needs for the task, so mistakes and manipulation have limited reach.', ''],
    'ros 2': ['ROS 2', 'Robot Operating System 2: open-source middleware where robot software runs as nodes that exchange typed messages over topics, services and actions.', ''],
    'differential drive': ['Differential drive', 'Two independently driven wheels on one axis (plus a caster). Equal speeds go straight; opposite speeds spin in place.', 'AIMA 4e Ch. 26'],
    'pwm': ['PWM', 'Pulse-width modulation: switching power on and off quickly; the fraction of time on (duty cycle) sets the average motor voltage and so the speed.', ''],
    'sense-plan-act': ['Sense-plan-act', 'The classic robot control loop: read sensors, update a model and plan, then send commands to actuators. Fast reflex layers usually run underneath.', 'AIMA 4e Ch. 26'],
    'subsumption': ['Subsumption architecture', 'Rodney Brooks\' layered design: simple reflex behaviors (avoid obstacles) run constantly and higher layers (explore, go to goal) build on them.', 'AIMA 3e §25.7, 4e Ch. 26'],
  };
  function glossary() {
    var tip = AG.h('div', { class: 'gtip', role: 'tooltip' });
    document.body.appendChild(tip);
    var hideT;
    function show(el) {
      var k = (el.getAttribute('data-g') || el.textContent).toLowerCase();
      var g = AG.GLOSSARY[k];
      if (!g) { console.warn('glossary: missing', k); return; }
      clearTimeout(hideT);
      tip.innerHTML = '<b>' + AG.esc(g[0]) + '</b>' + AG.esc(g[1]) + (g[2] ? '<small>' + AG.esc(g[2]) + '</small>' : '');
      var r = el.getBoundingClientRect();
      tip.style.left = '0px'; tip.style.top = '0px'; tip.classList.add('on');
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = AG.clamp(r.left + scrollX + r.width / 2 - tw / 2, scrollX + 8, scrollX + document.documentElement.clientWidth - tw - 8);
      var y = r.top + scrollY - th - 8;
      if (r.top < th + 70) y = r.bottom + scrollY + 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    function hide() { hideT = setTimeout(function () { tip.classList.remove('on'); }, 80); }
    document.querySelectorAll('.g').forEach(function (el) {
      el.setAttribute('tabindex', '0');
      el.addEventListener('mouseenter', function () { show(el); });
      el.addEventListener('mouseleave', hide);
      el.addEventListener('focus', function () { show(el); });
      el.addEventListener('blur', hide);
    });
    AG.glossaryTable = function (host) {
      var keys = Object.keys(AG.GLOSSARY).sort(function (a, b) { return AG.GLOSSARY[a][0].localeCompare(AG.GLOSSARY[b][0]); });
      var input = AG.h('input', { type: 'text', placeholder: 'Filter terms…', 'aria-label': 'Filter glossary' });
      var tbody = AG.h('tbody');
      function draw() {
        var q = input.value.toLowerCase(); tbody.innerHTML = '';
        keys.forEach(function (k) {
          var g = AG.GLOSSARY[k];
          if (q && (g[0] + ' ' + g[1]).toLowerCase().indexOf(q) < 0) return;
          tbody.appendChild(AG.h('tr', null, [AG.h('td', null, [AG.h('b', { text: g[0] })]), AG.h('td', { text: g[1] }), AG.h('td', { text: g[2] || '' })]));
        });
      }
      input.addEventListener('input', draw); draw();
      host.appendChild(AG.h('div', { class: 'w-row' }, [input, AG.h('span', { class: 'w-note', text: keys.length + ' terms' })]));
      host.appendChild(AG.h('div', { class: 'table-wrap' }, [AG.h('table', null, [AG.h('thead', null, [AG.h('tr', null, [AG.h('th', { text: 'Term' }), AG.h('th', { text: 'Meaning' }), AG.h('th', { text: 'Where' })])]), tbody])]));
    };
  }

  /* ------------------------------------------------------------ syntax highlighting */
  var KW = {
    python: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self',
    js: 'var let const function return if else for while do break continue new this typeof instanceof in of class extends import export from try catch finally throw null undefined true false async await',
    cpp: 'const int long unsigned char bool void if else for while do return true false static String float double break continue switch case default',
    bash: 'if then else fi for do done case esac in export function',
  };
  var BI = { python: 'print len range open str int float dict list set tuple sorted sum min max abs isinstance enumerate zip json math sys input any all round super', cpp: 'Serial pinMode digitalWrite analogWrite pulseIn delayMicroseconds millis constrain sscanf min abs', js: 'Math JSON console document window', bash: 'pip python python3 docker claude curl ollama cd ls mkdir git ssh sudo apt' };
  function highlightLine(line, lang) {
    var kw = new Set((KW[lang] || '').split(' ')), bi = new Set((BI[lang] || '').split(' '));
    var out = '', i = 0, n = line.length;
    var comment = lang === 'python' || lang === 'bash' ? '#' : lang === 'cpp' || lang === 'js' ? '//' : null;
    while (i < n) {
      var c = line[i], rest = line.slice(i);
      if (comment && rest.indexOf(comment) === 0 && !(lang === 'bash' && i > 0 && line[i - 1] !== ' ')) { out += '<span class="t-com">' + AG.esc(rest) + '</span>'; break; }
      if (lang === 'cpp' && rest.indexOf('/*') === 0) { out += '<span class="t-com">' + AG.esc(rest) + '</span>'; break; }
      if (c === '"' || c === "'" || c === '`') {
        var j = i + 1;
        while (j < n && line[j] !== c) { if (line[j] === '\\') j++; j++; }
        var str = line.slice(i, j + 1);
        var isKey = lang === 'json' && /^\s*:/.test(line.slice(j + 1));
        out += '<span class="' + (isKey ? 't-key' : 't-str') + '">' + AG.esc(str) + '</span>'; i = j + 1; continue;
      }
      if (/[0-9]/.test(c) && !/[A-Za-z_]/.test(line[i - 1] || '')) {
        var m = rest.match(/^[0-9][0-9_.eE]*/)[0]; out += '<span class="t-num">' + m + '</span>'; i += m.length; continue;
      }
      if (c === '@' && lang === 'python' && /^@[A-Za-z_]/.test(rest)) { var d = rest.match(/^@[\w.]+/)[0]; out += '<span class="t-dec">' + AG.esc(d) + '</span>'; i += d.length; continue; }
      if (/[A-Za-z_]/.test(c)) {
        var w = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)[0];
        var after = line.slice(i + w.length);
        if (kw.has(w)) out += '<span class="t-kw">' + w + '</span>';
        else if (bi.has(w)) out += '<span class="t-bi">' + w + '</span>';
        else if (/^\s*\(/.test(after) && lang !== 'json') out += '<span class="t-fn">' + w + '</span>';
        else if (lang === 'bash' && i === line.search(/\S/)) out += '<span class="t-bi">' + w + '</span>';
        else out += w;
        i += w.length; continue;
      }
      if (lang === 'bash' && c === '-' && /^--?[\w-]+/.test(rest) && (i === 0 || line[i - 1] === ' ')) { var f = rest.match(/^--?[\w-]+/)[0]; out += '<span class="t-op">' + f + '</span>'; i += f.length; continue; }
      out += AG.esc(c); i++;
    }
    return out;
  }
  AG.highlight = highlightLine;
  // whole blocks: carry multi-line strings (Python triple quotes) and /* */ comments across lines
  function highlightBlock(lines, lang) {
    var open = null;   // the closing delimiter we are waiting for, if inside a multi-line token
    var TQ = ['"' + '""', "'''"];
    return lines.map(function (l) {
      if (lang === 'text') return AG.esc(l);
      if (open) {
        var cls = open === '*/' ? 't-com' : 't-str', end = l.indexOf(open);
        if (end < 0) return '<span class="' + cls + '">' + AG.esc(l) + '</span>';
        var cut = end + open.length;
        open = null;
        return '<span class="' + cls + '">' + AG.esc(l.slice(0, cut)) + '</span>' + highlightLine(l.slice(cut), lang);
      }
      if (lang === 'python') {
        for (var i = 0; i < TQ.length; i++) {
          var q = TQ[i], at = l.indexOf(q), hash = l.indexOf('#');
          if (at >= 0 && (hash < 0 || hash > at) && (l.split(q).length - 1) % 2 === 1) {
            open = q;
            return highlightLine(l.slice(0, at), lang) + '<span class="t-str">' + AG.esc(l.slice(at)) + '</span>';
          }
        }
      }
      if (lang === 'cpp' || lang === 'js') {
        var c0 = l.indexOf('/*');
        if (c0 >= 0 && l.indexOf('*/', c0) < 0 && l.slice(0, c0).indexOf('//') < 0) {
          open = '*/';
          return highlightLine(l.slice(0, c0), lang) + '<span class="t-com">' + AG.esc(l.slice(c0)) + '</span>';
        }
      }
      return highlightLine(l, lang);
    });
  }
  function codeBlocks() {
    document.querySelectorAll('.code').forEach(function (box) {
      var pre = box.querySelector('pre'); if (!pre || pre.getAttribute('data-done')) return;
      pre.setAttribute('data-done', '1');
      var lang = box.getAttribute('data-lang') || 'text';
      var src = pre.textContent.replace(/\n$/, '');
      var start = parseInt(box.getAttribute('data-start') || '1', 10);
      var lines = src.split('\n');
      pre.innerHTML = highlightBlock(lines, lang).map(function (l, k) {
        return '<span class="ln" data-n="' + (start + k) + '">' + l + '</span>';
      }).join('');
      if (box.hasAttribute('data-nonum')) pre.classList.add('nonum');
      var copy = box.querySelector('[data-copy]');
      if (copy) copy.addEventListener('click', function () {
        var done = function () { copy.textContent = 'Copied'; copy.classList.add('done'); setTimeout(function () { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1400); };
        if (navigator.clipboard) navigator.clipboard.writeText(src).then(done, function () {}); else done();
      });
      [].forEach.call(pre.children, function (ln, k) { ln.style.setProperty('--i', Math.min(k, 40)); });
      AG.onVisible(box, function () { box.classList.add('lines-in'); });
      if (box.hasAttribute('data-run')) runnable(box, src);
      if (lines.length > 30 && !box.hasAttribute('data-nofold')) {
        box.classList.add('fold');
        var more = AG.h('button', { class: 'more', type: 'button', text: 'Show all ' + lines.length + ' lines ↓' });
        more.addEventListener('click', function () {
          var on = box.classList.toggle('fold');
          more.textContent = on ? 'Show all ' + lines.length + ' lines ↓' : 'Show less ↑';
        });
        box.appendChild(more);
      }
      // highlight lines named in data-hl="3-5,9"
      var hl = box.getAttribute('data-hl');
      if (hl) hl.split(',').forEach(function (r) {
        var p = r.split('-').map(Number), a = p[0], b = p[1] || p[0];
        for (var q = a; q <= b; q++) { var el = pre.children[q - start]; if (el) el.classList.add('hl'); }
      });
    });
  }
  // highlight a range of lines in a code block from a widget (used by step-through demos)
  AG.markLines = function (box, from, to, cls) {
    cls = cls || 'run';
    var pre = box.querySelector('pre'); if (!pre) return;
    var start = parseInt(box.getAttribute('data-start') || '1', 10);
    [].forEach.call(pre.children, function (el, k) { el.classList.toggle(cls, k + start >= from && k + start <= to); });
    var first = pre.children[from - start];
    if (first) {
      box.classList.remove('fold');
      var top = first.offsetTop - pre.clientHeight / 3;
      pre.scrollTo ? pre.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' }) : (pre.scrollTop = top);
    }
  };

  /* ------------------------------------------------------------ book <-> code bridges */
  function bridges() {
    document.querySelectorAll('.bridge').forEach(function (br) {
      var note = br.querySelector('.bridge-note');
      var py = br.querySelectorAll('.pane.py .bl');
      [].forEach.call(py, function (el) { el.innerHTML = highlightLine(el.textContent, 'python'); });
      var notes = {};
      try { notes = JSON.parse(br.getAttribute('data-notes') || '{}'); } catch (e) { /* none */ }
      function on(k) {
        br.querySelectorAll('.bl').forEach(function (el) { el.classList.toggle('on', !!k && el.getAttribute('data-k') === k); });
        if (note) note.innerHTML = k && notes[k] ? notes[k] : (note.getAttribute('data-default') || '');
      }
      br.querySelectorAll('.bl[data-k]').forEach(function (el) {
        el.addEventListener('mouseenter', function () { on(el.getAttribute('data-k')); });
        el.addEventListener('click', function () { on(el.getAttribute('data-k')); });
      });
      br.addEventListener('mouseleave', function () { on(null); });
      if (note) note.setAttribute('data-default', note.innerHTML);
    });
  }

  /* ------------------------------------------------------------ quiz */
  AG.widget('quiz', function (root) {
    var qs = JSON.parse(root.getAttribute('data-quiz'));
    var box = AG.h('div', { class: 'quiz' }), right = 0, answered = 0;
    var score = AG.h('p', { class: 'score' });
    qs.forEach(function (q, qi) {
      var opts = AG.h('div', { class: 'opts' }), why = AG.h('p', { class: 'why', hidden: true, html: q.e });
      q.o.forEach(function (o, oi) {
        var b = AG.h('button', { type: 'button', html: o });
        b.addEventListener('click', function () {
          if (opts.getAttribute('data-done')) return;
          opts.setAttribute('data-done', '1'); answered++;
          if (oi === q.a) { right++; b.classList.add('right'); var rr = b.getBoundingClientRect(); AG.xp(10, { x: rr.right - 60, y: rr.top }); }
          else { b.classList.add('wrong'); opts.children[q.a].classList.add('right'); }
          why.hidden = false;
          score.textContent = right + ' of ' + answered + ' right' + (answered === qs.length ? (right === qs.length ? ' — all correct!' : ' — reread the sections above for the ones you missed.') : '');
          if (answered === qs.length) { AG.markDone(); AG.badge('quiz'); if (right === qs.length) AG.badge('perfect'); }
        });
        opts.appendChild(b);
      });
      box.appendChild(AG.h('div', { class: 'q' }, [AG.h('p', { html: (qi + 1) + '. ' + q.q }), opts, why]));
    });
    box.appendChild(score);
    root.appendChild(box);
  });

  /* ------------------------------------------------------------ progress */
  AG.markDone = function () {
    var id = document.body.getAttribute('data-lesson');
    if (!id) return;
    var d = AG.store('done') || {}; d[id] = true; AG.store('done', d);
    var b = document.querySelector('[data-mark-done]');
    if (b) { b.textContent = '✓ Lesson marked done'; b.setAttribute('aria-pressed', 'true'); }
  };
  function progress() {
    var d = AG.store('done') || {};
    var b = document.querySelector('[data-mark-done]');
    if (b) {
      var id = document.body.getAttribute('data-lesson');
      if (d[id]) { b.textContent = '✓ Lesson marked done'; b.setAttribute('aria-pressed', 'true'); }
      b.addEventListener('click', function () {
        var dd = AG.store('done') || {};
        if (dd[id]) { delete dd[id]; AG.store('done', dd); b.textContent = 'Mark lesson as done'; b.setAttribute('aria-pressed', 'false'); }
        else AG.markDone();
      });
    }
    var cards = document.querySelectorAll('.lesson-card[data-id]'), n = 0;
    cards.forEach(function (c) { if (d[c.getAttribute('data-id')]) { c.classList.add('done'); n++; } });
    var meter = document.querySelector('[data-meter]');
    if (meter) {
      meter.querySelector('i').style.width = (cards.length ? 100 * n / cards.length : 0) + '%';
      var lab = document.querySelector('[data-meter-label]');
      if (lab) lab.textContent = n + ' of ' + cards.length + ' lessons done';
    }
  }

  /* ------------------------------------------------------------ Python in the browser (Pyodide in a Web Worker) */
  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js';
  var WORKER_SRC = [
    "importScripts('" + PYODIDE + "');",
    "var py; var ready = loadPyodide().then(function (p) { py = p;",
    "  p.setStdout({ batched: function (s) { postMessage({ t: 'out', s: s }); } });",
    "  p.setStderr({ batched: function (s) { postMessage({ t: 'err', s: s }); } });",
    "  postMessage({ t: 'ready' }); });",
    "onmessage = async function (e) {",
    "  await ready; var d = e.data, dir = '/home/pyodide/run' + d.id;",
    "  py.FS.mkdirTree(dir);",
    "  Object.keys(d.files).forEach(function (n) { var parts = n.split('/'); if (parts.length > 1) py.FS.mkdirTree(dir + '/' + parts.slice(0, -1).join('/')); py.FS.writeFile(dir + '/' + n, d.files[n]); });",
    "  var lines = (d.stdin || '').split('\\n').filter(function (l) { return l.length; }), i = 0;",
    "  py.setStdin({ stdin: function () { return i < lines.length ? lines[i++] + '\\n' : undefined; } });",
    "  py.globals.set('__argv', py.toPy(d.argv));",
    "  try {",
    "    await py.runPythonAsync('import sys, os, runpy\\nfor __m in [k for k, v in list(sys.modules.items()) if str(getattr(v, \"__file__\", \"\") or \"\").startswith(\"/home/pyodide/run\")]:\\n    del sys.modules[__m]\\nos.chdir(' + JSON.stringify(dir) + ')\\nsys.path.insert(0, ' + JSON.stringify(dir) + ')\\nsys.argv = list(__argv)\\ntry:\\n    runpy.run_path(' + JSON.stringify(dir + '/' + d.main) + \", run_name='__main__')\\nexcept SystemExit:\\n    pass\\nfinally:\\n    sys.path.remove(\" + JSON.stringify(dir) + ')\\n    os.chdir(\"/home/pyodide\")');",
    "    postMessage({ t: 'done', id: d.id });",
    "  } catch (err) { postMessage({ t: 'err', s: String(err.message || err) }); postMessage({ t: 'done', id: d.id, error: true }); }",
    "};",
  ].join('\n');
  var worker = null, workerReady = null, runId = 0, handlers = {};
  function getWorker() {
    if (worker) return workerReady;
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    workerReady = new Promise(function (res, rej) {
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.t === 'ready') { res(); return; }
        var hd = handlers.current; if (!hd) return;
        if (m.t === 'out') hd.out(m.s);
        else if (m.t === 'err') hd.err(cleanTrace(m.s));
        else if (m.t === 'done') { handlers.current = null; hd.done(!m.error); }
      };
      worker.onerror = function (e) { rej(e); };
    });
    return workerReady;
  }
  function cleanTrace(s) {   // hide Pyodide's own frames; keep the user's
    var lines = String(s).split('\n'), out = [], skip = false;
    lines.forEach(function (l) {
      if (/File "\/lib\/python|_pyodide|pyodide\.ffi|File "<exec>"|File "<frozen runpy>"/.test(l)) { skip = true; return; }
      if (skip && /^\s{4}/.test(l)) return;
      skip = false; out.push(l.replace(/\/home\/pyodide\/run\d+\//g, ''));
    });
    return out.join('\n');
  }
  AG.runPython = function (job, on) {
    // job: {files: {name: source}, main, argv, stdin}; on: {out, err, status, done}
    if (handlers.current) AG.stopPython();
    var first = !worker;
    if (first && on.status) on.status('Loading Python in your browser (about 10 MB, only the first time)…');
    return getWorker().then(function () {
      if (on.status) on.status('Running…');
      handlers.current = { out: on.out, err: on.err, done: on.done };
      worker.postMessage({ id: ++runId, files: job.files, main: job.main, argv: job.argv || [job.main], stdin: job.stdin || '' });
    }, function () { on.err('Could not load Python (Pyodide). Are you offline?'); on.done(false); });
  };
  AG.stopPython = function () {
    if (worker) { worker.terminate(); worker = null; workerReady = null; }
    var hd = handlers.current; handlers.current = null;
    if (hd) hd.done(false, true);
  };
  function runnable(box, src) {
    var head = box.querySelector('.code-head'), file = box.getAttribute('data-file'), full = box.getAttribute('data-full') === '1';
    var argv = [file].concat((box.getAttribute('data-argv') || '').split(' ').filter(Boolean));
    var bRun = AG.h('button', { type: 'button', class: 'run-btn', text: '▶ Run' });
    var bEdit = full ? AG.h('button', { type: 'button', text: '✎ Edit' }) : null;
    var dl = head.querySelector('a[download]');
    head.insertBefore(bRun, dl || head.lastChild);
    if (bEdit) head.insertBefore(bEdit, bRun);
    var panel = AG.h('div', { class: 'run-panel', hidden: true });
    var status = AG.h('div', { class: 'run-status' }), out = AG.h('pre', { class: 'run-out' });
    var bStop = AG.h('button', { type: 'button', text: '■ Stop', hidden: true }), bClose = AG.h('button', { type: 'button', text: '✕' });
    panel.appendChild(AG.h('div', { class: 'run-bar' }, [AG.h('span', { text: 'Output · Python running in your browser (Pyodide)' + (argv.length > 1 ? ' · args: ' + argv.slice(1).join(' ') : '') }), bStop, bClose]));
    panel.appendChild(status); panel.appendChild(out);
    box.appendChild(panel);
    var ta = null;
    if (bEdit) bEdit.addEventListener('click', function () {
      var pre = box.querySelector('pre:not(.run-out)');
      if (ta) {   // reset
        if (!confirm('Discard your edits and restore the original file?')) return;
        ta.remove(); ta = null; pre.hidden = false; bEdit.textContent = '✎ Edit'; box.classList.remove('editing'); return;
      }
      ta = AG.h('textarea', { class: 'code-edit', spellcheck: 'false', 'aria-label': 'Edit ' + file });
      ta.value = src; ta.style.height = Math.min(560, Math.max(220, pre.scrollHeight)) + 'px';
      ta.addEventListener('keydown', function (ev) {
        if (ev.key === 'Tab') { ev.preventDefault(); var st = ta.selectionStart; ta.setRangeText('    ', st, ta.selectionEnd, 'end'); }
        if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); bRun.click(); }
      });
      pre.hidden = true; pre.parentNode.insertBefore(ta, pre.nextSibling);
      box.classList.add('editing'); box.classList.remove('fold');
      bEdit.textContent = '↺ Reset'; ta.setSelectionRange(0, 0); ta.focus(); ta.scrollTop = 0;
    });
    bClose.addEventListener('click', function () { panel.hidden = true; });
    bStop.addEventListener('click', function () { AG.stopPython(); });
    bRun.addEventListener('click', function () {
      panel.hidden = false; out.textContent = ''; bStop.hidden = false; bRun.disabled = true;
      var started = performance.now();
      var getSrc = ta ? Promise.resolve(ta.value) : full ? Promise.resolve(src) : fetch(dl.getAttribute('href')).then(function (r) { return r.text(); });
      getSrc.then(function (code) {
        var files = {}; files[file.split('/').pop()] = code;
        AG.runPython({ files: files, main: file.split('/').pop(), argv: argv, stdin: box.getAttribute('data-stdin') || '' }, {
          status: function (t) { status.textContent = t; },
          out: function (t) { out.appendChild(document.createTextNode(t + '\n')); out.scrollTop = out.scrollHeight; },
          err: function (t) { out.appendChild(AG.h('span', { class: 'err', text: t + '\n' })); out.scrollTop = out.scrollHeight; },
          done: function (ok, stopped) {
            bStop.hidden = true; bRun.disabled = false;
            if (ok) { AG.badge('first-run'); AG.xp(5); if (ta) AG.badge('editor'); }
            status.textContent = stopped ? 'Stopped.' : (ok ? 'Finished' : 'Finished with an error') + ' in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s' + (ta ? ' (your edited version).' : '.');
          },
        });
      });
    });
  }

  /* ------------------------------------------------------------ a small code editor: textarea over highlighted text */
  AG.highlightBlock = function (lines, lang) { return highlightBlock(lines, lang); };
  AG.editor = function (host, opts) {
    var wrap = AG.h('div', { class: 'ed' }), gutter = AG.h('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
    var hl = AG.h('pre', { class: 'ed-hl', 'aria-hidden': 'true' }), ta = AG.h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': opts.label || 'Code editor' });
    if (opts.minHeight) ta.style.minHeight = opts.minHeight + 'px';
    wrap.appendChild(gutter); wrap.appendChild(hl); wrap.appendChild(ta); host.appendChild(wrap);
    function paint() {
      var lines = ta.value.split('\n');
      hl.innerHTML = highlightBlock(lines, opts.lang || 'python').join('\n') + '\n ';
      if (gutter.childNodes.length !== lines.length) { gutter.innerHTML = ''; for (var i = 1; i <= lines.length; i++) gutter.appendChild(AG.h('div', { text: String(i) })); }
      sync();
      if (opts.onChange) opts.onChange(ta.value);
    }
    function sync() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; hl.style.height = ta.offsetHeight + 'px'; }
    ta.addEventListener('input', paint);
    ta.addEventListener('scroll', sync);
    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(ta);
    ta.addEventListener('keydown', function (e) {
      var v = ta.value, s0 = ta.selectionStart, s1 = ta.selectionEnd;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (opts.onRun) opts.onRun(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        var ls = v.lastIndexOf('\n', s0 - 1) + 1;
        if (e.shiftKey) { if (v.slice(ls, ls + 4) === '    ') { ta.value = v.slice(0, ls) + v.slice(ls + 4); ta.selectionStart = ta.selectionEnd = Math.max(ls, s0 - 4); } }
        else ta.setRangeText('    ', s0, s1, 'end');
        paint(); return;
      }
      if (e.key === 'Enter') {   // keep indentation; indent after a colon
        e.preventDefault();
        var start = v.lastIndexOf('\n', s0 - 1) + 1, line = v.slice(start, s0), ind = line.match(/^\s*/)[0];
        if (/:\s*(#.*)?$/.test(line)) ind += '    ';
        ta.setRangeText('\n' + ind, s0, s1, 'end'); paint();
      }
    });
    var api = { el: wrap, ta: ta, get: function () { return ta.value; }, set: function (v) { ta.value = v; ta.scrollTop = 0; paint(); }, focus: function () { ta.focus(); } };
    api.set(opts.value || '');
    return api;
  };
  // run Python and collect stdout; resolves {ok, out, err, result} where result is the parsed __RESULT__ line
  AG.runPyCollect = function (job) {
    return new Promise(function (res) {
      var out = [], err = [], result = null;
      AG.runPython(job, {
        status: job.status,
        out: function (t) { t.split('\n').forEach(function (l) { if (l.indexOf('__RESULT__') === 0) { try { result = JSON.parse(l.slice(10)); } catch (e) { /* ignore */ } } else out.push(l); }); },
        err: function (t) { err.push(t); },
        done: function (ok, stopped) { res({ ok: ok, stopped: !!stopped, out: out.join('\n'), err: err.join('\n'), result: result }); },
      });
    });
  };

  /* ------------------------------------------------------------ course search (Ctrl/⌘-K or /) */
  function search() {
    var root = document.body.getAttribute('data-root') || '';
    var btn = document.querySelector('[data-search]');
    var dlg = AG.h('div', { class: 'search-dlg', hidden: true, role: 'dialog', 'aria-label': 'Search the course' });
    var input = AG.h('input', { type: 'search', placeholder: 'Search lessons, sections and terms…', 'aria-label': 'Search' });
    var list = AG.h('div', { class: 'search-res' });
    dlg.appendChild(AG.h('div', { class: 'search-box' }, [input, AG.h('p', { class: 'search-hint', html: '<kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close · Shortcuts: <kbd>/</kbd> search, <kbd>n</kbd> next lesson, <kbd>p</kbd> previous' }), list]));
    document.body.appendChild(dlg);
    var items = (window.AG_INDEX || []).slice();
    Object.keys(AG.GLOSSARY).forEach(function (k) { var g = AG.GLOSSARY[k]; items.push({ u: '10-roadmap/index.html#glossary', l: 'Glossary', t: g[0], x: g[1], k: 'term' }); });
    var sel = 0, shown = [];
    function run() {
      var q = input.value.toLowerCase().trim(), terms = q.split(/\s+/).filter(Boolean);
      shown = !terms.length ? items.filter(function (it) { return it.k === 'lesson'; }) : items.map(function (it) {
        var t = it.t.toLowerCase(), x = (it.x || '').toLowerCase(), sc = 0;
        for (var i = 0; i < terms.length; i++) { var w = terms[i]; if (t.indexOf(w) >= 0) sc += 3; else if (x.indexOf(w) >= 0) sc += 1; else return null; }
        if (t.indexOf(q) === 0) sc += 3;
        return { it: it, sc: sc + (it.k === 'lesson' ? 1 : 0) };
      }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 14).map(function (r) { return r.it; });
      sel = 0; draw(terms);
    }
    function snippet(x, terms) {
      if (!x) return '';
      var lx = x.toLowerCase(), at = terms.length ? Math.max(0, lx.indexOf(terms[0]) - 50) : 0;
      var s2 = (at ? '…' : '') + x.slice(at, at + 150) + (x.length > at + 150 ? '…' : '');
      var h2 = AG.esc(s2);
      terms.forEach(function (w) { if (w.length > 1) h2 = h2.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
      return h2;
    }
    function draw(terms) {
      list.innerHTML = '';
      if (!shown.length) { list.appendChild(AG.h('p', { class: 'w-note', text: 'No matches.' })); return; }
      shown.forEach(function (it, i) {
        var a = AG.h('a', { href: root + it.u, class: i === sel ? 'on' : '' }, [AG.h('span', { class: 'search-k', text: it.l }), AG.h('b', { text: it.t }), AG.h('small', { html: snippet(it.x, terms || []) })]);
        a.addEventListener('click', close);
        list.appendChild(a);
      });
    }
    function open() { dlg.hidden = false; input.value = ''; run(); input.focus(); }
    function close() { dlg.hidden = true; }
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(input.value.toLowerCase().split(/\s+/).filter(Boolean)); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(input.value.toLowerCase().split(/\s+/).filter(Boolean)); e.preventDefault(); }
      if (e.key === 'Enter' && shown[sel]) { location.href = root + shown[sel].u; close(); }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    if (btn) btn.addEventListener('click', open);
    document.addEventListener('keydown', function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') || (document.activeElement && document.activeElement.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.hidden ? open() : close(); return; }
      if (e.key === 'Escape' && !dlg.hidden) { close(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); open(); }
      if (e.key === 'n') { var nx = document.querySelector('.pager .next'); if (nx) location.href = nx.href; }
      if (e.key === 'p') { var pv = document.querySelector('.pager a:not(.next)'); if (pv) location.href = pv.href; }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    [setupTheme, banner, chrome, glossary, codeBlocks, bridges, progress, mountWidgets, search, xpInit].forEach(function (f) {
      try { f(); } catch (e) { console.error('init ' + f.name + ' failed', e); }   // one failure must not stop the rest
    });
  });
})();
