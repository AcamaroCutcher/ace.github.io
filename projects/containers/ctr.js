/*
 * Containers & Docker: motion and interactive widgets.
 *  - animated container-yard background and banner
 *  - scroll progress bar, diagram build-in animations, staggered code lines
 *  - widgets, each rendered into <div data-widget="name">:
 *      playground   a simulated Docker terminal with a live picture of your machine
 *      vmvsctr      start virtual machines vs containers and compare time and memory
 *      layercache   build a Dockerfile and watch which layers are cached
 *      entrypoint   CMD vs ENTRYPOINT: what actually runs
 *      cmdbuilder   assemble a docker run command and see what each part does
 *      composeflow  send requests through Caddy -> web -> db; stop services, delete volumes
 *      agentloop    step through an agent's tool calls inside a container
 *      sandbox      toggle security flags and try attacks
 *      archcheck    will this image run on that machine?
 *      filter       live search over the cheat sheet and troubleshooting table
 *      quiz         a short check at the end of each lesson
 * Honors prefers-reduced-motion. Progress is kept in localStorage (optional).
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PALETTE = ['#2496ed', '#1baf7a', '#eb6834', '#8b5cf6', '#e0a526', '#e5484d', '#0ea5a4'];

  /* ---------------- helpers ---------------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function hex(n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  // animate fn(progress 0..1) over ms; a timer finishes it even where animation frames are paused (background tabs)
  function tween(ms, fn) {
    return new Promise(function (res) {
      if (reduce || ms <= 0) { fn(1); return res(); }
      var t0 = performance.now(), done = false;
      function fin() { if (done) return; done = true; fn(1); res(); }
      function f() { if (done) return; var p = Math.min(1, (performance.now() - t0) / ms); fn(p); if (p < 1) requestAnimationFrame(f); else fin(); }
      requestAnimationFrame(f); setTimeout(fin, ms + 250);
    });
  }
  function onVisible(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
  }

  /* ---------------- container drawing ---------------- */
  function drawBox(ctx, x, y, w, hgt, color, alpha, label) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var r = Math.min(4, hgt / 5);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hgt - r); ctx.quadraticCurveTo(x + w, y + hgt, x + w - r, y + hgt);
    ctx.lineTo(x + r, y + hgt); ctx.quadraticCurveTo(x, y + hgt, x, y + hgt - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.fill();
    ctx.globalAlpha = alpha * 0.35;              // corrugated ridges
    ctx.fillStyle = '#000';
    for (var i = x + 7; i < x + w - 4; i += 6) ctx.fillRect(i, y + 3, 1.2, hgt - 6);
    if (label && w > 70) {
      ctx.globalAlpha = Math.min(1, alpha * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(x + 6, y + hgt / 2 - 8, Math.min(w - 12, label.length * 7 + 10), 16);
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px ui-monospace, Menlo, monospace';
      ctx.fillText(label, x + 11, y + hgt / 2 + 4);
    }
    ctx.globalAlpha = 1;
  }

  function Yard(canvas, opts) {
    var ctx = canvas.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, lanes = [], running = false, last = 0;
    var LABELS = ['nginx:1.27', 'postgres:17', 'python:3.13', 'redis:7', 'node:22', 'ollama', 'caddy:2', 'ubuntu:24.04', 'gcc:14', 'alpine', 'jupyter', 'open-webui'];
    function size() {
      var r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lanes = [];
      var lh = opts.laneH, gap = opts.gap, n = Math.ceil(H / (lh + gap)) + 1;
      for (var i = 0; i < n; i++) {
        var lane = { y: i * (lh + gap) + opts.offset, v: rand(opts.vmin, opts.vmax) * (i % 2 ? -1 : 1), boxes: [] };
        var x = rand(-200, 0);
        while (x < W + 200) { var w = pick([90, 140, 140, 190]); lane.boxes.push({ x: x, w: w, c: pick(PALETTE), l: opts.labels ? pick(LABELS) : '', a: rand(opts.amin, opts.amax) }); x += w + rand(14, 120); }
        lanes.push(lane);
      }
    }
    function frame(t) {
      if (!running) return;
      var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
      ctx.clearRect(0, 0, W, H);
      lanes.forEach(function (lane) {
        lane.boxes.forEach(function (b) {
          b.x += lane.v * dt;
          if (lane.v > 0 && b.x > W + 40) { b.x = Math.min.apply(null, lane.boxes.map(function (o) { return o.x; })) - b.w - rand(14, 120); b.c = pick(PALETTE); }
          if (lane.v < 0 && b.x + b.w < -40) { b.x = Math.max.apply(null, lane.boxes.map(function (o) { return o.x + o.w; })) + rand(14, 120); b.c = pick(PALETTE); }
          var fade = opts.fadeLeft ? Math.max(0, Math.min(1, (b.x - W * 0.42) / (W * 0.3))) : 1;
          if (fade > 0.01) drawBox(ctx, b.x, lane.y, b.w, opts.laneH, b.c, b.a * fade * (isDark() ? opts.darkMul : opts.lightMul), b.l);
        });
      });
      requestAnimationFrame(frame);
    }
    function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    function stop() { running = false; }
    size();
    window.addEventListener('resize', size);
    if (reduce) { running = true; frame(performance.now()); running = false; return; }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window && !opts.always) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? start() : stop(); }); }).observe(canvas);
    } else start();
  }

  /* ---------------- page chrome ---------------- */
  function chrome() {
    var bg = h('canvas', { class: 'ctr-bg', 'aria-hidden': 'true' });
    document.body.insertBefore(bg, document.body.firstChild);
    Yard(bg, { laneH: 24, gap: 32, offset: 14, vmin: 6, vmax: 16, amin: 0.05, amax: 0.12, lightMul: 0.9, darkMul: 0.6, labels: false, always: true });

    var banner = document.querySelector('.ctr-banner');
    if (banner) {
      var c = h('canvas', { class: 'ctr-banner-fx', 'aria-hidden': 'true' });
      banner.appendChild(c);
      Yard(c, { laneH: 34, gap: 16, offset: 10, vmin: 18, vmax: 42, amin: 0.55, amax: 0.9, lightMul: 1, darkMul: 1, labels: true, fadeLeft: true });
    }

    var bar = h('div', { class: 'ctr-progress', 'aria-hidden': 'true' });
    document.body.appendChild(bar);
    function prog() {
      var d = document.documentElement, max = d.scrollHeight - d.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? d.scrollTop / max : 0) + ')';
    }
    window.addEventListener('scroll', prog, { passive: true }); prog();

    // diagrams build themselves when they scroll into view
    document.querySelectorAll('.diagram svg').forEach(function (svg) {
      var parts = Array.prototype.slice.call(svg.querySelectorAll('rect, text, path'));
      parts.forEach(function (p) { p.classList.add('bit'); });
      var order = parts.slice().sort(function (a, b) { return bottom(b) - bottom(a); });
      order.forEach(function (p, i) { p.style.animationDelay = (Math.min(i, 40) * 35) + 'ms'; });
      onVisible(svg, function () { svg.classList.add('built'); });
    });
    function bottom(el) { try { var b = el.getBBox(); return b.y + b.height; } catch (e) { return 0; } }

    // code lines slide in one after another
    document.querySelectorAll('.code').forEach(function (box) { onVisible(box, function () { box.classList.add('lines-in'); }); });

    // lesson progress on the hub
    var done = store('ctr-done') || {};
    document.querySelectorAll('a.lesson-card').forEach(function (a) {
      var slug = a.getAttribute('href').split('/')[0];
      if (done[slug]) { a.classList.add('done'); a.querySelector('.chapter-top').appendChild(h('span', { class: 'done-tag', text: '✓ Done' })); }
    });
    var meter = document.querySelector('[data-progress]');
    if (meter) {
      var n = document.querySelectorAll('a.lesson-card').length, k = Object.keys(done).length;
      meter.innerHTML = '<span style="--p:' + (n ? k / n : 0) + '"></span>';
      meter.setAttribute('title', k + ' of ' + n + ' lessons done');
      meter.nextElementSibling && (meter.nextElementSibling.textContent = k + ' of ' + n + ' lessons done');
    }
  }
  function markDone() {
    var slug = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '').split('/').pop();
    var d = store('ctr-done') || {}; d[slug] = 1; store('ctr-done', d);
  }

  /* =============== widget: playground =============== */
  var IMAGES = {
    'hello-world': { size: '13 kB', kind: 'hello' },
    'nginx': { size: '48 MB', kind: 'web', port: 80 },
    'ubuntu': { size: '78 MB', kind: 'os', pretty: 'Ubuntu 24.04.1 LTS' },
    'debian': { size: '117 MB', kind: 'os', pretty: 'Debian GNU/Linux 12 (bookworm)' },
    'alpine': { size: '8 MB', kind: 'os', pretty: 'Alpine Linux v3.20' },
    'python': { size: '150 MB', kind: 'python' },
    'postgres': { size: '435 MB', kind: 'db', port: 5432, need: 'POSTGRES_PASSWORD' },
    'redis': { size: '117 MB', kind: 'db', port: 6379 },
    'node': { size: '390 MB', kind: 'python' }
  };
  var ADJ = ['brave', 'calm', 'eager', 'happy', 'jolly', 'kind', 'lucid', 'quirky', 'serene', 'zen'];
  var NOUN = ['curie', 'darwin', 'euler', 'hopper', 'lovelace', 'noether', 'turing', 'tesla', 'ride', 'banach'];

  function splitArgs(s) {
    var out = [], cur = '', q = null, any = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; any = true; continue; }
      if (/\s/.test(ch)) { if (cur || any) { out.push(cur); cur = ''; any = false; } continue; }
      cur += ch;
    }
    if (cur || any) out.push(cur);
    return out;
  }

  function playground(root) {
    var st = { images: {}, cons: [], vols: {} };
    var term = h('div', { class: 'pg-term', translate: 'no', role: 'log', 'aria-live': 'polite' });
    var input = h('input', { class: 'pg-input', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Type a docker command', placeholder: 'type a command, e.g. docker run hello-world' });
    var hist = [], hi = 0;
    var view = h('div', { class: 'pg-view' });
    var chips = h('div', { class: 'pg-chips' });
    var SUGG = (root.getAttribute('data-steps') || 'docker run hello-world|docker run -d --name web -p 8080:80 nginx|docker ps|curl localhost:8080|docker logs web|docker run -d --name web2 -p 8080:80 nginx|docker stop web|docker ps -a|docker rm web|docker run ubuntu cat /etc/os-release|docker run -d --name db postgres|docker logs db|docker run -d --name db2 -e POSTGRES_PASSWORD=secret postgres:17|docker images|docker system prune').split('|');
    SUGG.forEach(function (s) { chips.appendChild(h('button', { type: 'button', class: 'pg-chip', text: s, onclick: function () { run(s); input.focus({ preventScroll: true }); } })); });

    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Docker playground' }), h('span', { text: 'A simulation that runs in your browser: type commands or click the suggestions. Nothing is installed or downloaded.' })]));
    root.appendChild(h('div', { class: 'pg-grid' }, [
      h('div', { class: 'pg-left' }, [
        h('div', { class: 'pg-win' }, [h('div', { class: 'pg-bar' }, [h('i'), h('i'), h('i'), h('span', { text: 'Terminal' })]), term,
          h('label', { class: 'pg-line' }, [h('span', { class: 'pg-ps', text: '$' }), input])]),
        chips
      ]),
      view
    ]));

    function line(text, cls) { var d = h('div', { class: 'pg-out ' + (cls || '') }); d.textContent = text; term.appendChild(d); term.scrollTop = term.scrollHeight; return d; }
    function htmlLine(html, cls) { var d = h('div', { class: 'pg-out ' + (cls || '') }); d.innerHTML = html; term.appendChild(d); term.scrollTop = term.scrollHeight; return d; }
    line('Welcome! This is a pretend computer with Docker installed. Try: docker run hello-world', 'dim');

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var v = input.value.trim(); input.value = ''; if (v) run(v); }
      else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = hist[hi] || ''; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; input.value = hist[hi] || ''; } e.preventDefault(); }
    });

    var busy = Promise.resolve();
    function run(cmd) { busy = busy.then(function () { hist.push(cmd); hi = hist.length; htmlLine('<span class="pg-ps">$</span> ' + esc(cmd), 'cmd'); return exec(cmd); }).then(render); }

    function base(img) { return img.split(':')[0].split('/').pop(); }
    function find(ref) { return st.cons.filter(function (c) { return c.name === ref || c.id.indexOf(ref) === 0; })[0]; }
    function portOwner(p) { return st.cons.filter(function (c) { return c.status === 'running' && c.ports.some(function (x) { return x.h === p; }); })[0]; }

    async function pull(img) {
      var key = img.indexOf(':') < 0 ? img + ':latest' : img;
      if (st.images[key]) return true;
      var info = IMAGES[base(img)];
      line("Unable to find image '" + key + "' locally");
      if (!info) { line("docker: Error response from daemon: pull access denied for " + base(img) + ", repository does not exist (the simulator knows: " + Object.keys(IMAGES).join(', ') + ').', 'err'); return false; }
      line(key.split(':')[1] + ': Pulling from library/' + base(img));
      var bars = [];
      for (var i = 0; i < (info.size === '13 kB' ? 1 : 3); i++) bars.push(htmlLine(hex(12) + ': <span class="pg-pbar"><i></i></span> Downloading', 'dim'));
      for (var s = 1; s <= 5; s++) { await wait(140); bars.forEach(function (b, j) { b.querySelector('i').style.width = Math.min(100, s * 20 + j * 7) + '%'; }); }
      bars.forEach(function (b) { b.lastChild.textContent = ' Pull complete'; });
      line('Status: Downloaded newer image for ' + key);
      st.images[key] = info.size;
      return true;
    }

    async function exec(cmd) {
      var a = splitArgs(cmd);
      if (!a.length) return;
      if (a[0] === 'clear') { term.innerHTML = ''; return; }
      if (a[0] === 'help') { line('Simulated: docker run/ps/stop/start/rm/logs/exec/images/pull/rmi/volume/system prune, curl localhost:PORT, clear'); return; }
      if (a[0] === 'curl') return curl(a.slice(1));
      if (a[0] === 'sudo') a.shift();
      if (a[0] !== 'docker') { line(a[0] + ': command not found (in this simulator, start commands with docker)', 'err'); return; }
      var sub = a[1], rest = a.slice(2);
      switch (sub) {
        case 'run': return dockerRun(rest);
        case 'ps': return ps(rest.indexOf('-a') >= 0 || rest.indexOf('--all') >= 0);
        case 'images': case 'image':
          if (sub === 'image' && rest[0] !== 'ls') { line('Try: docker images', 'dim'); return; }
          table([['REPOSITORY', 'TAG', 'SIZE']].concat(Object.keys(st.images).map(function (k) { return [k.split(':')[0], k.split(':')[1], st.images[k]]; })));
          return;
        case 'pull': if (rest[0]) await pull(rest[0]); return;
        case 'stop': return each(rest, function (c) { if (c.status === 'running') { c.status = 'exited'; c.code = 0; c.flash = 'stop'; } line(c.name); if (c.rm) remove(c); });
        case 'start': return each(rest, function (c) {
          var clash = c.ports.filter(function (p) { var o = portOwner(p.h); return o && o !== c; })[0];
          if (clash) { line('Error: port ' + clash.h + ' is already allocated', 'err'); return; }
          if (c.kind === 'db' && c.need && !c.env[c.need]) { c.status = 'exited'; c.code = 1; line(c.name); return; }
          if (c.kind === 'web' || c.kind === 'db') c.status = 'running'; c.flash = 'start'; line(c.name);
        });
        case 'restart': return each(rest, function (c) { c.status = c.kind === 'web' || c.kind === 'db' ? 'running' : 'exited'; c.flash = 'start'; line(c.name); });
        case 'rm': {
          var force = rest.indexOf('-f') >= 0 || rest.indexOf('--force') >= 0;
          return each(rest.filter(function (x) { return x[0] !== '-'; }), function (c) {
            if (c.status === 'running' && !force) { line('Error: cannot remove container "' + c.name + '": container is running: stop the container before removing or force remove (-f)', 'err'); return; }
            remove(c); line(c.name);
          });
        }
        case 'logs': return each(rest.filter(function (x) { return x[0] !== '-'; }), function (c) { (c.logs.length ? c.logs : ['(no output)']).forEach(function (l) { line(l, l.indexOf('ERROR') >= 0 || l.indexOf('Error') >= 0 ? 'err' : ''); }); });
        case 'exec': {
          var r = rest.filter(function (x) { return x[0] !== '-'; });
          var c = find(r[0] || '');
          if (!c) { line('Error: No such container: ' + r[0], 'err'); return; }
          if (c.status !== 'running') { line('Error response from daemon: container ' + c.id + ' is not running', 'err'); return; }
          var what = r.slice(1).join(' ');
          if (/^(sh|bash)$/.test(what)) line('(simulator: an interactive shell opens here in real Docker; type exit to leave it)', 'dim');
          else if (/ps/.test(what)) table([['PID', 'COMMAND'], ['1', c.kind === 'web' ? 'nginx: master process' : c.image], ['31', what]]);
          else line('(ran "' + what + '" inside ' + c.name + ')', 'dim');
          return;
        }
        case 'rmi': return Object.keys(st.images).forEach(function (k) {
          if (rest.indexOf(k) >= 0 || rest.indexOf(k.split(':')[0]) >= 0) {
            if (st.cons.some(function (c) { return c.imageKey === k; })) line('Error: conflict: unable to remove ' + k + ' (used by a container)', 'err');
            else { delete st.images[k]; line('Untagged: ' + k); }
          }
        });
        case 'volume': {
          if (rest[0] === 'create' && rest[1]) { st.vols[rest[1]] = 1; line(rest[1]); }
          else if (rest[0] === 'ls') table([['DRIVER', 'VOLUME NAME']].concat(Object.keys(st.vols).map(function (v) { return ['local', v]; })));
          else if (rest[0] === 'rm' && rest[1]) { delete st.vols[rest[1]]; line(rest[1]); }
          else line('Try: docker volume create NAME, docker volume ls, docker volume rm NAME', 'dim');
          return;
        }
        case 'system':
          if (rest[0] === 'prune') {
            var gone = st.cons.filter(function (c) { return c.status !== 'running'; });
            gone.forEach(remove);
            line('Deleted Containers: ' + (gone.map(function (c) { return c.id; }).join(', ') || 'none'));
            var used = {}; st.cons.forEach(function (c) { used[c.imageKey] = 1; });
            var n = 0; Object.keys(st.images).forEach(function (k) { if (!used[k] && rest.indexOf('-a') >= 0) { delete st.images[k]; n++; } });
            line('Total reclaimed space: ' + (gone.length * 2 + n * 60) + ' MB' + (rest.indexOf('-a') < 0 ? ' (add -a to remove unused images too)' : ''));
          } else if (rest[0] === 'df') table([['TYPE', 'TOTAL'], ['Images', String(Object.keys(st.images).length)], ['Containers', String(st.cons.length)], ['Volumes', String(Object.keys(st.vols).length)]]);
          return;
        case '--version': case 'version': line('Docker version 28.x (simulated)'); return;
        default: line('docker: unknown command "' + (sub || '') + '" in this simulator. Type help.', 'err');
      }
    }

    function each(refs, fn) {
      if (!refs.length) { line('Error: requires at least one container name or ID', 'err'); return; }
      refs.forEach(function (r) { var c = find(r); if (!c) line('Error: No such container: ' + r, 'err'); else fn(c); });
    }
    function remove(c) { c.flash = 'gone'; st.cons = st.cons.filter(function (o) { return o !== c; }); }
    function table(rows) {
      var w = rows[0].map(function (_, i) { return Math.max.apply(null, rows.map(function (r) { return String(r[i] || '').length; })) + 3; });
      rows.forEach(function (r, j) { line(r.map(function (x, i) { var s = String(x || ''); return i < r.length - 1 ? s + ' '.repeat(Math.max(1, w[i] - s.length)) : s; }).join(''), j ? '' : 'dim'); });
    }
    function ps(all) {
      var rows = [['CONTAINER ID', 'IMAGE', 'STATUS', 'PORTS', 'NAMES']];
      st.cons.forEach(function (c) {
        if (!all && c.status !== 'running') return;
        rows.push([c.id, c.imageKey, c.status === 'running' ? 'Up ' + Math.max(1, Math.round((Date.now() - c.t) / 1000)) + ' seconds' : 'Exited (' + c.code + ')',
          c.ports.map(function (p) { return (p.ip || '0.0.0.0') + ':' + p.h + '->' + p.c + '/tcp'; }).join(', '), c.name]);
      });
      table(rows);
      if (!all && st.cons.some(function (c) { return c.status !== 'running'; })) line('(stopped containers are hidden; add -a to see them)', 'dim');
    }

    async function dockerRun(args) {
      var o = { d: false, it: false, rm: false, name: null, ports: [], env: {}, vols: [] }, i = 0;
      for (; i < args.length; i++) {
        var x = args[i];
        if (x === '-d' || x === '--detach') o.d = true;
        else if (/^-(it|ti|i|t)$/.test(x)) o.it = true;
        else if (x === '-dit' || x === '-itd') { o.it = true; o.d = true; }
        else if (x === '--rm') o.rm = true;
        else if (x === '--name') o.name = args[++i];
        else if (x === '-p' || x === '--publish') {
          var p = (args[++i] || '').split(':');
          if (p.length < 2) { line('docker: invalid publish format: use -p HOST:CONTAINER, e.g. -p 8080:80', 'err'); return; }
          o.ports.push({ ip: p.length === 3 ? p[0] : null, h: p[p.length - 2], c: p[p.length - 1] });
        }
        else if (x === '-e' || x === '--env') { var kv = (args[++i] || '').split('='); o.env[kv[0]] = kv.slice(1).join('=') || '(from your shell)'; }
        else if (x === '-v' || x === '--volume') { var v = args[++i] || ''; o.vols.push(v); var src = v.split(':')[0]; if (src && src[0] !== '/' && src[0] !== '.' && src[0] !== '$') st.vols[src] = 1; }
        else if (x === '-w' || x === '--workdir' || x === '--user' || x === '--network' || x === '--memory' || x === '--cpus' || x === '--platform') i++;
        else if (x[0] === '-') { /* ignore other flags */ }
        else break;
      }
      var img = args[i], cmdArgs = args.slice(i + 1);
      if (!img) { line('"docker run" requires at least 1 argument: the image', 'err'); return; }
      if (o.name && find(o.name)) { line('docker: Error response from daemon: Conflict. The container name "/' + o.name + '" is already in use. Remove it first (docker rm ' + o.name + ') or pick another name.', 'err'); return; }
      for (var k = 0; k < o.ports.length; k++) {
        if (portOwner(o.ports[k].h)) { line('docker: Error response from daemon: Bind for 0.0.0.0:' + o.ports[k].h + ' failed: port is already allocated', 'err'); return; }
      }
      if (!(await pull(img))) return;
      var key = img.indexOf(':') < 0 ? img + ':latest' : img, info = IMAGES[base(img)];
      var c = { id: hex(12), name: o.name || pick(ADJ) + '_' + pick(NOUN), image: base(img), imageKey: key, kind: info.kind, need: info.need,
        ports: o.ports, env: o.env, vols: o.vols, rm: o.rm, status: 'running', code: 0, logs: [], t: Date.now(), flash: 'new', color: pick(PALETTE) };
      st.cons.push(c);
      if (info.kind === 'hello') {
        ['Hello from Docker!', 'This message shows that your installation appears to be working correctly.', '', 'To generate this message, Docker took the following steps:',
          ' 1. The Docker client contacted the Docker daemon.', ' 2. The daemon pulled the "hello-world" image from Docker Hub.',
          ' 3. The daemon created a new container from that image, which ran the program that produced this output.',
          ' 4. The daemon streamed that output to the Docker client, which sent it to your terminal.'].forEach(function (l) { c.logs.push(l); line(l); });
        c.status = 'exited';
      } else if (info.kind === 'web') {
        c.logs.push('/docker-entrypoint.sh: Configuration complete; ready for start up', 'nginx: start worker processes');
        if (o.d) line(c.id + hex(52));
        else { c.logs.forEach(function (l) { line(l); }); line('(in a real terminal nginx would keep running here until Ctrl-C; the simulator puts it in the background. Use -d next time.)', 'dim'); }
        if (!o.ports.length) line('note: no -p, so nothing outside the container can reach this web server', 'dim');
      } else if (info.kind === 'db') {
        if (info.need && !o.env[info.need]) {
          c.logs.push('Error: Database is uninitialized and superuser password is not specified.', '       You must specify POSTGRES_PASSWORD to a non-empty value for the superuser.', '       For example, "-e POSTGRES_PASSWORD=password" on "docker run".');
          c.status = 'exited'; c.code = 1;
          if (o.d) line(c.id + hex(52)); else c.logs.forEach(function (l) { line(l, 'err'); });
          if (o.d) line('(it started, then stopped at once: try docker ps -a and docker logs ' + c.name + ')', 'dim');
        } else {
          c.logs.push(c.image === 'redis' ? 'Ready to accept connections tcp' : 'database system is ready to accept connections');
          if (o.d) line(c.id + hex(52)); else { line(c.logs[0]); line('(moved to the background by the simulator; use -d next time)', 'dim'); }
        }
      } else {
        // an OS or language image: runs its command and exits
        var what = cmdArgs.join(' ');
        if (o.it && (!what || /^(bash|sh|python|node)$/.test(what))) line('(an interactive ' + (what || 'shell') + ' would open here. Try it in a real terminal! The simulator exits it for you.)', 'dim');
        else if (/^echo /.test(what)) { c.logs.push(cmdArgs.slice(1).join(' ')); line(c.logs[0]); }
        else if (/os-release/.test(what)) { c.logs.push('PRETTY_NAME="' + (info.pretty || 'Debian GNU/Linux 12 (bookworm)') + '"'); line(c.logs[0]); }
        else if (/--version|-V/.test(what)) { c.logs.push(c.image === 'python' ? 'Python 3.13.1' : 'v22.12.0'); line(c.logs[0]); }
        else if (what) { c.logs.push('(ran: ' + what + ')'); line(c.logs[0], 'dim'); }
        else if (!o.it) line('(the container started and exited at once: a container lives only as long as its main program, and ' + c.image + ' has nothing to do. Try docker ps -a)', 'dim');
        c.status = 'exited';
      }
      if (c.rm && c.status === 'exited') { await wait(400); remove(c); }
    }

    function curl(args) {
      var url = args.filter(function (x) { return x[0] !== '-'; })[0] || '';
      var m = url.match(/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (!m) { line('curl: in this simulator, try curl localhost:PORT', 'dim'); return; }
      var c = portOwner(m[1]);
      if (!c) { line('curl: (7) Failed to connect to localhost port ' + m[1] + ': Connection refused', 'err'); return; }
      if (c.kind !== 'web') { line('curl: (52) Empty reply from server (that port belongs to ' + c.image + ', which does not speak HTTP)', 'err'); return; }
      ['<!DOCTYPE html>', '<html><head><title>Welcome to nginx!</title></head>', '<body><h1>Welcome to nginx!</h1> ...'].forEach(function (l) { line(l); });
      c.logs.push('172.17.0.1 - - "GET / HTTP/1.1" 200 615 "-" "curl/8.7"');
      c.flash = 'hit';
    }

    function render() {
      view.innerHTML = '';
      view.appendChild(h('div', { class: 'pg-host' }, [h('b', { text: 'Your computer' }), h('span', { text: 'what Docker is managing right now' })]));
      var ports = st.cons.filter(function (c) { return c.status === 'running' && c.ports.length; });
      view.appendChild(h('div', { class: 'pg-sec' }, [h('small', { text: 'Ports open on localhost' }),
        ports.length ? h('div', { class: 'pg-row' }, ports.reduce(function (acc, c) { return acc.concat(c.ports.map(function (p) { return h('span', { class: 'pg-port', html: ':' + esc(p.h) + ' <i>→</i> ' + esc(c.name) + ':' + esc(p.c) }); })); }, []))
          : h('div', { class: 'pg-empty', text: 'none' })]));
      var cs = h('div', { class: 'pg-cons' });
      st.cons.forEach(function (c) {
        var card = h('div', { class: 'pg-con ' + c.status + (c.flash ? ' f-' + c.flash : ''), style: '--c:' + c.color, title: c.id }, [
          h('div', { class: 'pg-con-top' }, [h('i', { class: 'dot' }), h('b', { text: c.name })]),
          h('code', { text: c.imageKey }),
          h('small', { text: c.status === 'running' ? 'running' : 'exited (' + c.code + ')' + (c.rm ? ', --rm' : '') }),
          c.vols.length ? h('small', { class: 'pg-vol', text: '⛁ ' + c.vols.join(', ') }) : null
        ]);
        c.flash = null;
        cs.appendChild(card);
      });
      view.appendChild(h('div', { class: 'pg-sec' }, [h('small', { text: 'Containers (' + st.cons.length + ')' }), st.cons.length ? cs : h('div', { class: 'pg-empty', text: 'none yet: try docker run hello-world' })]));
      var imgs = Object.keys(st.images);
      view.appendChild(h('div', { class: 'pg-sec' }, [h('small', { text: 'Images downloaded (' + imgs.length + ')' }),
        imgs.length ? h('div', { class: 'pg-row' }, imgs.map(function (k) { return h('span', { class: 'pg-img', html: '<i></i>' + esc(k) + ' <em>' + esc(st.images[k]) + '</em>' }); })) : h('div', { class: 'pg-empty', text: 'none' })]));
      var vols = Object.keys(st.vols);
      if (vols.length) view.appendChild(h('div', { class: 'pg-sec' }, [h('small', { text: 'Volumes' }), h('div', { class: 'pg-row' }, vols.map(function (v) { return h('span', { class: 'pg-volchip', text: '⛁ ' + v }); }))]));
    }
    render();
  }

  /* =============== widget: VMs vs containers =============== */
  function vmvsctr(root) {
    var RAM = 16384, used = 0;
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Start some machines' }), h('span', { text: 'A laptop with 16 GB of memory. Illustrative numbers: a small VM needs about 2 GB and 30–60 s to boot; a small container about 50 MB and half a second.' })]));
    var mem = h('div', { class: 'vm-mem' }, [h('span', { class: 'vm-memfill' })]);
    var memTxt = h('small', { class: 'vm-memtxt', text: '0 MB of 16 GB used' });
    var lanes = { vm: h('div', { class: 'vm-lane' }), ct: h('div', { class: 'vm-lane' }) };
    var counts = { vm: 0, ct: 0 };
    var stats = { vm: h('small', { text: '0 running' }), ct: h('small', { text: '0 running' }) };
    function upd() {
      mem.firstChild.style.width = Math.min(100, used / RAM * 100) + '%';
      mem.classList.toggle('full', used > RAM * 0.85);
      memTxt.textContent = (used >= 1024 ? (used / 1024).toFixed(1) + ' GB' : used + ' MB') + ' of 16 GB used';
      stats.vm.textContent = counts.vm + ' running'; stats.ct.textContent = counts.ct + ' running';
    }
    function add(kind, n) {
      for (var i = 0; i < n; i++) {
        var need = kind === 'vm' ? 2048 : 50;
        if (used + need > RAM) { flash(kind === 'vm' ? 'Out of memory: no room for another VM' : 'Out of memory'); return; }
        used += need; counts[kind]++;
        var bar = h('i'), lbl = h('span', { text: kind === 'vm' ? 'booting OS…' : 'starting…' });
        var el = h('div', { class: 'vm-item ' + kind }, [h('div', { class: 'vm-pb' }, [bar]), lbl]);
        lanes[kind].appendChild(el);
        (function (el, bar, lbl, kind) {
          var dur = kind === 'vm' ? rand(3500, 5500) : rand(200, 450);
          tween(dur, function (p) {
            bar.style.width = (p * 100) + '%';
            if (kind === 'vm') lbl.textContent = p < 0.3 ? 'firmware…' : p < 0.7 ? 'booting kernel…' : p < 1 ? 'starting services…' : 'ready (~' + Math.round(dur / 100) + ' s)';
            else if (p >= 1) lbl.textContent = 'ready (' + (dur / 1000).toFixed(1) + ' s)';
            if (p >= 1) el.classList.add('up');
          });
        })(el, bar, lbl, kind);
      }
      upd();
    }
    var note = h('div', { class: 'vm-note', role: 'status' });
    function flash(t) { note.textContent = t; note.classList.remove('show'); void note.offsetWidth; note.classList.add('show'); }
    function reset() { used = 0; counts = { vm: 0, ct: 0 }; lanes.vm.innerHTML = ''; lanes.ct.innerHTML = ''; note.textContent = ''; upd(); }
    root.appendChild(h('div', { class: 'vm-grid' }, [
      h('div', { class: 'vm-col' }, [h('div', { class: 'vm-col-h' }, [h('b', { text: 'Virtual machines' }), stats.vm]),
        h('div', { class: 'w-btns' }, [h('button', { type: 'button', text: '+1 VM', onclick: function () { add('vm', 1); } }), h('button', { type: 'button', text: '+3 VMs', onclick: function () { add('vm', 3); } })]), lanes.vm]),
      h('div', { class: 'vm-col' }, [h('div', { class: 'vm-col-h' }, [h('b', { text: 'Containers' }), stats.ct]),
        h('div', { class: 'w-btns' }, [h('button', { type: 'button', text: '+1 container', onclick: function () { add('ct', 1); } }), h('button', { type: 'button', text: '+20 containers', onclick: function () { add('ct', 20); } })]), lanes.ct])
    ]));
    root.appendChild(h('div', { class: 'vm-foot' }, [h('div', { class: 'vm-memwrap' }, [h('small', { text: 'Memory' }), mem, memTxt]), h('button', { type: 'button', class: 'ghost', text: 'Reset', onclick: reset }), note]));
  }

  /* =============== widget: layer cache =============== */
  function layercache(root) {
    var GOOD = [
      { t: 'FROM python:3.13-slim', dep: 'base', s: 9 }, { t: 'WORKDIR /app', dep: '', s: 0.1 },
      { t: 'COPY requirements.txt .', dep: 'req', s: 0.2 }, { t: 'RUN pip install -r requirements.txt', dep: '', s: 24 },
      { t: 'COPY app.py .', dep: 'app', s: 0.2 }, { t: 'CMD ["gunicorn", …]', dep: '', s: 0 }];
    var BAD = [
      { t: 'FROM python:3.13-slim', dep: 'base', s: 9 }, { t: 'WORKDIR /app', dep: '', s: 0.1 },
      { t: 'COPY . .', dep: 'req app', s: 0.3 }, { t: 'RUN pip install -r requirements.txt', dep: '', s: 24 },
      { t: 'CMD ["gunicorn", …]', dep: '', s: 0 }];
    var order = 'good', cached = { good: false, bad: false }, changed = {}, building = false, baseCached = false;
    var list = h('ol', { class: 'lc-list', translate: 'no' }), total = h('div', { class: 'lc-total' }), log = h('div', { class: 'lc-msg' });
    var chg = h('div', { class: 'lc-changes' });
    function drawList() {
      list.innerHTML = '';
      (order === 'good' ? GOOD : BAD).forEach(function (s) {
        list.appendChild(h('li', {}, [h('code', { text: s.t }), h('span', { class: 'lc-bar' }, [h('i')]), h('em', { text: '' })]));
      });
    }
    function setOrder(o) { order = o; ordBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.o === o); }); drawList(); total.textContent = ''; log.textContent = cached[o] ? '' : 'First build with this Dockerfile: nothing is cached yet.'; }
    function toggle(k, btn) { changed[k] = !changed[k]; btn.setAttribute('aria-pressed', !!changed[k]); }
    var ordBtns = [h('button', { type: 'button', 'data-o': 'good', text: 'Dependencies first (good)', onclick: function () { if (!building) setOrder('good'); } }),
      h('button', { type: 'button', 'data-o': 'bad', text: 'Copy everything first (bad)', onclick: function () { if (!building) setOrder('bad'); } })];
    [['app', 'Edit app.py'], ['req', 'Add a package to requirements.txt'], ['base', 'Change the FROM tag']].forEach(function (p) {
      var b = h('button', { type: 'button', class: 'tog', 'aria-pressed': 'false', text: p[1] }); b.onclick = function () { toggle(p[0], b); }; chg.appendChild(b);
    });
    var go = h('button', { type: 'button', class: 'primary', text: '▶ docker build', onclick: build });
    async function build() {
      if (building) return; building = true; go.disabled = true;
      var steps = order === 'good' ? GOOD : BAD, lis = list.children, dirty = !cached[order], sum = 0;
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i], li = lis[i];
        if (!dirty && s.dep) s.dep.split(' ').forEach(function (d) { if (changed[d]) dirty = true; });
        li.className = 'act';
        if (!dirty) { li.className = 'cached'; li.querySelector('em').textContent = 'CACHED'; li.querySelector('i').style.width = '100%'; await wait(120); continue; }
        var secs = i === 0 && baseCached && !changed.base ? 0.4 : s.s, dur = Math.max(150, secs * 90);
        await tween(dur, function (p) { li.querySelector('i').style.width = p * 100 + '%'; li.querySelector('em').textContent = (p * secs).toFixed(1) + ' s'; });
        li.querySelector('em').textContent = secs.toFixed(1) + ' s';
        li.className = 'ran'; sum += secs;
      }
      total.innerHTML = 'Build time: <b>' + sum.toFixed(1) + ' s</b>';
      log.textContent = sum < 1 ? 'Everything came from the cache.' : (order === 'bad' && changed.app && !changed.req) ? 'Editing one line of code re-ran pip install, because COPY . . copies app.py before it. Switch to the good order and try again.' : (changed.req ? 'A new package invalidates the pip layer and everything after it. That is expected.' : 'Only the steps after the change were redone.');
      cached[order] = true; baseCached = true; changed = {};
      chg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      building = false; go.disabled = false;
    }
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Build cache simulator' }), h('span', { text: 'Pick a Dockerfile order, change something, and build. Green layers come from the cache. Times are typical, sped up.' })]));
    root.appendChild(h('div', { class: 'w-btns seg' }, ordBtns));
    root.appendChild(list);
    root.appendChild(h('div', { class: 'lc-ctl' }, [h('small', { text: 'Before the next build:' }), chg, go]));
    root.appendChild(h('div', { class: 'lc-foot' }, [total, log]));
    setOrder('good');
  }

  /* =============== widget: CMD vs ENTRYPOINT =============== */
  function entrypoint(root) {
    var CFG = [
      { k: 'cmd', label: 'CMD ["gunicorn", "app:app"]', e: [], c: ['gunicorn', 'app:app'] },
      { k: 'ep', label: 'ENTRYPOINT ["hello"]', e: ['hello'], c: [] },
      { k: 'both', label: 'ENTRYPOINT ["python"] + CMD ["app.py"]', e: ['python'], c: ['app.py'] }];
    var sel = CFG[0], inp = h('input', { type: 'text', value: '', placeholder: '(nothing)', 'aria-label': 'Words after the image name', spellcheck: 'false' });
    var out = h('div', { class: 'ep-out', translate: 'no' });
    function upd() {
      var args = splitArgs(inp.value), runs = sel.e.concat(args.length ? args : sel.c);
      var why = !sel.e.length ? (args.length ? 'Your words replaced CMD completely.' : 'Nothing typed, so the CMD default runs.')
        : (args.length ? 'Your words were appended to the ENTRYPOINT' + (sel.c.length ? ', replacing the CMD default.' : '.') : (sel.c.length ? 'CMD supplies the default arguments to the ENTRYPOINT.' : 'The ENTRYPOINT runs with no arguments.'));
      out.innerHTML = '<div><small>You type</small><code>docker run my-image ' + esc(inp.value) + '</code></div><div><small>The container runs</small><code class="hl">' + esc(runs.join(' ') || '(nothing!)') + '</code></div><p>' + why + '</p>';
    }
    var btns = CFG.map(function (c) { return h('button', { type: 'button', text: c.label, 'aria-pressed': c === sel, onclick: function () { sel = c; btns.forEach(function (b, i) { b.setAttribute('aria-pressed', CFG[i] === sel); }); upd(); } }); });
    inp.addEventListener('input', upd);
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'What actually runs?' }), h('span', { text: 'Choose the Dockerfile line, then type words after the image name.' })]));
    root.appendChild(h('div', { class: 'w-btns seg mono' }, btns));
    root.appendChild(h('label', { class: 'ep-in' }, [h('code', { text: 'docker run my-image' }), inp]));
    root.appendChild(out);
    root.appendChild(h('div', { class: 'w-btns ep-try' }, ['Ada', 'python --version', 'other.py', ''].map(function (v) {
      return h('button', { type: 'button', class: 'ghost mono', text: v ? 'try: ' + v : 'clear', onclick: function () { inp.value = v; upd(); } });
    })));
    upd();
  }

  /* =============== widget: docker run builder =============== */
  function cmdbuilder(root) {
    var P = [
      { n: 'Python script', img: 'python:3.13', cmd: 'python analysis.py', w: '/work', it: true, mount: true },
      { n: 'pandoc → PDF', img: 'pandoc/latex', cmd: 'report.md -o report.pdf', w: '/data', mount: true },
      { n: 'Compile Fortran', img: 'gcc:14', cmd: 'gfortran -O2 -o hello hello.f90', w: '/work', mount: true },
      { n: 'Node dev server', img: 'node:22', cmd: 'sh -c "npm install && npm run dev -- --host 0.0.0.0"', w: '/app', it: true, mount: true, port: '5173:5173' },
      { n: 'PostgreSQL', img: 'postgres:17', cmd: '', d: true, name: 'pg', port: '5432:5432', env: 'POSTGRES_PASSWORD=dev', vol: 'pgdata:/var/lib/postgresql/data', rm: false },
      { n: 'Jupyter', img: 'quay.io/jupyter/scipy-notebook', cmd: '', w: '/home/jovyan/work', mount: true, port: '8888:8888', nowd: true }];
    var cur, opt = {};
    var out = h('div', { class: 'cb-out', translate: 'no' }), expl = h('div', { class: 'cb-expl', 'aria-live': 'polite' });
    var opts = h('div', { class: 'cb-opts' });
    var TIPS = {
      run: 'Create a new container from an image and start it.',
      rm: '--rm: delete the container when it exits, so stopped containers don’t pile up.',
      it: '-it: keep input open and give it a terminal, for programs that print colors or ask questions.',
      d: '-d: run in the background (detached) and return the prompt at once.',
      name: '--name: a name to use instead of the random ID in later commands.',
      p: '-p HOST:CONTAINER: forward a port on your computer to the container.',
      p127: 'Prefixing 127.0.0.1 makes the port reachable only from this computer, not from the network.',
      v: '-v HOST:CONTAINER: show a folder of your computer inside the container (a bind mount).',
      ro: ':ro makes the mount read-only, so the container can’t change your files.',
      nv: 'A named volume: storage Docker manages, which outlives the container.',
      w: '-w: the folder the command starts in.',
      user: '--user: run as you instead of root, so new files belong to you (matters on Linux).',
      e: '-e: set an environment variable, which is how containers are configured.',
      img: 'The image to start from (downloaded the first time).',
      cmd: 'The command to run inside the container, replacing the image’s default.'
    };
    function part(text, cls, tip) { return '<span class="cb-p ' + cls + '" tabindex="0" data-tip="' + esc(TIPS[tip] || '') + '">' + esc(text) + '</span>'; }
    function upd() {
      var c = cur, s = [part('docker', 'cmd', 'run'), part('run', 'kw', 'run')];
      if (opt.rm) s.push(part('--rm', 'flag', 'rm'));
      if (opt.it) s.push(part('-it', 'flag', 'it'));
      if (opt.d) s.push(part('-d', 'flag', 'd'));
      if (opt.name && c.name) s.push(part('--name ' + c.name, 'flag', 'name'));
      if (opt.port && c.port) { s.push(part('-p', 'flag', 'p')); s.push(part((opt.local ? '127.0.0.1:' : '') + c.port, 'num', opt.local ? 'p127' : 'p')); }
      if (c.env) s.push(part('-e ' + c.env, 'var', 'e'));
      if (c.vol) s.push(part('-v ' + c.vol, 'str', 'nv'));
      if (opt.mount && c.w) { s.push(part('-v "$PWD":' + c.w + (opt.ro ? ':ro' : ''), 'str', opt.ro ? 'ro' : 'v')); if (!c.nowd && c.w !== '/data') s.push(part('-w ' + c.w, 'flag', 'w')); }
      if (opt.user) s.push(part('--user "$(id -u):$(id -g)"', 'var', 'user'));
      s.push(part(c.img, 'img', 'img'));
      if (c.cmd) s.push(part(c.cmd, 'arg', 'cmd'));
      out.innerHTML = '<div class="cb-line">' + s.join(' ') + '</div><button type="button" class="copy cb-copy">Copy</button>';
      out.querySelector('.cb-copy').onclick = function (e) {
        var t = out.querySelector('.cb-line').textContent;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { e.target.textContent = 'Copied'; setTimeout(function () { e.target.textContent = 'Copy'; }, 1200); }, function () {});
      };
      out.querySelectorAll('.cb-p').forEach(function (p) {
        function show() { expl.textContent = p.getAttribute('data-tip'); out.querySelectorAll('.cb-p').forEach(function (q) { q.classList.toggle('on', q === p); }); }
        p.addEventListener('mouseenter', show); p.addEventListener('focus', show); p.addEventListener('click', show);
      });
      if (opt.ro && c.cmd && /-o |gfortran|npm install/.test(c.cmd)) expl.textContent = 'Careful: this tool writes files, and a read-only mount would make it fail.';
    }
    function choose(p) {
      cur = p;
      opt = { rm: p.rm !== false, it: !!p.it, d: !!p.d, name: !!p.name, port: !!p.port, local: true, mount: !!p.mount, ro: false, user: false };
      presets.forEach(function (b, i) { b.setAttribute('aria-pressed', P[i] === p); });
      drawOpts(); upd(); expl.textContent = 'Point at any part of the command to see what it does.';
    }
    function drawOpts() {
      opts.innerHTML = '';
      [['rm', 'Remove when done (--rm)'], ['it', 'Interactive (-it)'], ['d', 'Background (-d)'], ['mount', 'Mount this folder', 'w'], ['ro', 'Read-only mount', 'w'], ['port', 'Publish a port', 'port'], ['local', 'Only this computer', 'port'], ['user', 'Run as me (Linux)']].forEach(function (o) {
        if (o[2] && !cur[o[2]]) return;
        var cb = h('input', { type: 'checkbox' }); cb.checked = !!opt[o[0]];
        cb.onchange = function () { opt[o[0]] = cb.checked; if (o[0] === 'd' && cb.checked) opt.it = false; if (o[0] === 'it' && cb.checked) opt.d = false; drawOpts(); upd(); };
        opts.appendChild(h('label', { class: 'cb-o' }, [cb, ' ' + o[1]]));
      });
    }
    var presets = P.map(function (p) { return h('button', { type: 'button', text: p.n, onclick: function () { choose(p); } }); });
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Command builder' }), h('span', { text: 'Pick a task, switch options on and off, and point at any part of the command.' })]));
    root.appendChild(h('div', { class: 'w-btns seg' }, presets));
    root.appendChild(opts); root.appendChild(out); root.appendChild(expl);
    choose(P[0]);
  }

  /* =============== widget: compose request flow =============== */
  function composeflow(root) {
    var NS = 'http://www.w3.org/2000/svg';
    var st = { up: true, db: true, count: 0 }, busy = false;
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 760 170'); svg.setAttribute('class', 'cf-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Browser, caddy, web and db with a moving request');
    var nodes = { br: [20, 'Browser', 'you'], caddy: [210, 'caddy', ':443'], web: [400, 'web', 'Flask :8000'], db: [590, 'db', 'Postgres :5432'] };
    var box = {};
    svg.innerHTML = '<rect class="cf-net" x="190" y="12" width="560" height="120" rx="12"/><text class="cf-netl" x="204" y="30">compose network</text>' +
      '<line class="cf-wire" x1="150" y1="78" x2="210" y2="78"/><line class="cf-wire" x1="340" y1="78" x2="400" y2="78"/><line class="cf-wire" x1="530" y1="78" x2="590" y2="78"/>' +
      '<rect class="cf-vol" x="590" y="140" width="150" height="26" rx="13"/><text class="cf-voll" x="665" y="158" text-anchor="middle">volume db-data</text>';
    Object.keys(nodes).forEach(function (k) {
      var g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'cf-node n-' + k);
      g.innerHTML = '<rect x="' + nodes[k][0] + '" y="50" width="130" height="56" rx="10"/><text x="' + (nodes[k][0] + 65) + '" y="74" text-anchor="middle" class="t1">' + nodes[k][1] + '</text><text x="' + (nodes[k][0] + 65) + '" y="93" text-anchor="middle" class="t2">' + nodes[k][2] + '</text>';
      svg.appendChild(g); box[k] = g;
    });
    var dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', '7'); dot.setAttribute('class', 'cf-dot'); dot.setAttribute('cx', -20); dot.setAttribute('cy', 78); svg.appendChild(dot);
    var page = h('div', { class: 'cf-page' }), info = h('div', { class: 'cf-info', 'aria-live': 'polite' });
    function move(x0, x1, ms) {
      return tween(ms, function (p) { var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; dot.setAttribute('cx', x0 + (x1 - x0) * e); });
    }
    function ping(k) { box[k].classList.remove('ping'); void box[k].getBoundingClientRect(); box[k].classList.add('ping'); }
    async function visit() {
      if (busy) return; busy = true; dot.classList.remove('bad'); dot.style.opacity = 1;
      await move(150, 210, 300);
      if (!st.up) { dot.classList.add('bad'); page.innerHTML = '<b class="bad">This site can’t be reached</b><span>localhost refused to connect. (The stack is down: run docker compose up -d.)</span>'; await wait(500); dot.style.opacity = 0; busy = false; return; }
      ping('caddy'); await move(275, 400, 380); ping('web');
      if (!st.db) {
        await move(465, 560, 260); dot.classList.add('bad'); await move(560, 465, 260); await move(400, 150, 500);
        page.innerHTML = '<b class="bad">500 Internal Server Error</b><span>web could not connect to db:5432. The app is up, but its database is stopped.</span>';
        dot.style.opacity = 0; busy = false; return;
      }
      await move(465, 590, 380); ping('db'); st.count++; await wait(120);
      await move(590, 150, 700);
      page.innerHTML = '<b>Hello!</b><span>This page has been visited <strong>' + st.count + '</strong> times.</span>';
      dot.style.opacity = 0; busy = false;
    }
    function state() {
      box.db.classList.toggle('off', !st.db || !st.up); box.web.classList.toggle('off', !st.up); box.caddy.classList.toggle('off', !st.up);
      svg.querySelector('.cf-vol').classList.toggle('gone', st.vol === false);
    }
    var B = [
      ['Visit the page', async function () { await visit(); }],
      ['Visit 5×', async function () { for (var i = 0; i < 5; i++) await visit(); }],
      ['docker compose stop db', function () { st.db = false; state(); info.textContent = 'db stopped. Its data is still in the volume.'; }],
      ['docker compose start db', function () { st.db = true; state(); info.textContent = 'db is back, with the same count.'; }],
      ['docker compose down', function () { st.up = false; state(); info.textContent = 'All containers removed. The volume db-data is kept.'; }],
      ['docker compose down -v', function () { st.up = false; st.count = 0; st.vol = false; state(); info.textContent = 'Containers removed and the volume deleted: the visit count is gone for good.'; }],
      ['docker compose up -d', function () { st.up = true; st.db = true; st.vol = true; state(); info.textContent = st.count ? 'Everything recreated. The count survived, because it lives in the volume.' : 'Everything started with a fresh, empty database.'; }]];
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Follow a request' }), h('span', { text: 'Send requests through the stack from this lesson, then stop services and delete volumes to see what breaks and what survives.' })]));
    root.appendChild(svg);
    root.appendChild(h('div', { class: 'w-btns mono' }, B.map(function (b) { return h('button', { type: 'button', text: b[0], onclick: b[1] }); })));
    root.appendChild(h('div', { class: 'cf-browser' }, [h('div', { class: 'cf-url', text: 'https://localhost' }), page]));
    root.appendChild(info);
    page.innerHTML = '<span>Press “Visit the page”.</span>';
  }

  /* =============== widget: agent loop =============== */
  function agentloop(root) {
    var S = [
      { from: 'you', to: 'api', who: 'You', t: 'docker run --rm -e ANTHROPIC_API_KEY -v "$PWD":/workspace:ro file-agent "What does this project do?"', k: 'cmd' },
      { from: 'ctr', to: 'api', who: 'agent.py → Claude', t: 'Sends the question plus the two tool descriptions: list_files and read_file.', k: 'msg' },
      { from: 'api', to: 'ctr', who: 'Claude', t: 'tool_use: list_files {"directory": "."}', k: 'tool' },
      { from: 'ctr', to: 'api', who: 'Tool runs in the container', t: 'README.md\napp.py\nrequirements.txt\ndata/', k: 'res' },
      { from: 'api', to: 'ctr', who: 'Claude', t: 'tool_use: read_file {"path": "README.md"}', k: 'tool' },
      { from: 'ctr', to: 'api', who: 'Tool runs in the container', t: '# Visit counter\nA Flask app that counts page visits in PostgreSQL…', k: 'res' },
      { from: 'api', to: 'ctr', who: 'Claude', t: 'tool_use: read_file {"path": "../../home/you/.ssh/id_rsa"}   (a mistake, or a prompt injection hidden in a file)', k: 'tool bad' },
      { from: 'ctr', to: 'api', who: 'Blocked twice', t: 'ValueError: ../../home/you/.ssh/id_rsa is outside /workspace\n…and even without that check, your home folder isn’t mounted: inside the container that file does not exist.', k: 'res block' },
      { from: 'api', to: 'you', who: 'Claude', t: 'This project is a small Flask web app that counts visits in a PostgreSQL database. Run it with docker compose up -d …', k: 'final' }];
    var i = 0, timer = null;
    var lanes = h('div', { class: 'al-lanes' }, [
      h('div', { class: 'al-node', 'data-n': 'you' }, [h('b', { text: 'You' }), h('small', { text: 'terminal' })]),
      h('div', { class: 'al-node', 'data-n': 'ctr' }, [h('b', { text: 'Container' }), h('small', { text: 'agent.py + tools, sees only /workspace' })]),
      h('div', { class: 'al-node', 'data-n': 'api' }, [h('b', { text: 'Claude API' }), h('small', { text: 'decides which tool to call' })])]);
    var log = h('div', { class: 'al-log', translate: 'no' });
    var next = h('button', { type: 'button', class: 'primary', text: 'Next step →' }), play = h('button', { type: 'button', text: '▶ Play' }), rst = h('button', { type: 'button', class: 'ghost', text: 'Reset' });
    var count = h('small', { class: 'al-count' });
    function step() {
      if (i >= S.length) { stopPlay(); return; }
      var s = S[i++];
      lanes.querySelectorAll('.al-node').forEach(function (n) { var k = n.getAttribute('data-n'); n.classList.toggle('from', k === s.from); n.classList.toggle('to', k === s.to); });
      var item = h('div', { class: 'al-item ' + s.k }, [h('small', { text: s.who }), h('pre', { text: s.t })]);
      log.appendChild(item); log.scrollTop = log.scrollHeight;
      count.textContent = 'Step ' + i + ' of ' + S.length;
      next.disabled = i >= S.length;
      if (i >= S.length) stopPlay();
    }
    function stopPlay() { clearInterval(timer); timer = null; play.textContent = '▶ Play'; }
    next.onclick = step;
    play.onclick = function () { if (timer) return stopPlay(); if (i >= S.length) reset(); play.textContent = '❚❚ Pause'; step(); timer = setInterval(step, 1600); };
    function reset() { stopPlay(); i = 0; log.innerHTML = ''; next.disabled = false; count.textContent = ''; lanes.querySelectorAll('.al-node').forEach(function (n) { n.classList.remove('from', 'to'); }); }
    rst.onclick = reset;
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Watch the agent loop' }), h('span', { text: 'A replay of one run of the agent below. The tool calls are the same shape the real program sends and receives.' })]));
    root.appendChild(lanes); root.appendChild(log);
    root.appendChild(h('div', { class: 'w-btns' }, [next, play, rst, count]));
  }

  /* =============== widget: sandbox flags =============== */
  function sandbox(root) {
    var F = [
      { k: 'net', f: '--network none', d: 'no network' }, { k: 'mem', f: '--memory 512m', d: 'memory cap' }, { k: 'pids', f: '--pids-limit 128', d: 'process cap' },
      { k: 'ro', f: '--read-only --tmpfs /tmp', d: 'read-only system' }, { k: 'mro', f: ':ro on the mount', d: 'inputs read-only' }, { k: 'caps', f: '--cap-drop ALL --security-opt no-new-privileges', d: 'no special powers' }];
    var A = [
      { t: 'Download and run a script from the internet', by: 'net' }, { t: 'Upload your files to a server', by: 'net' },
      { t: 'Allocate 50 GB of memory', by: 'mem' }, { t: 'Fork bomb: start processes forever', by: 'pids' },
      { t: 'Overwrite /usr/bin/python', by: 'ro' }, { t: 'Delete the input files in /job', by: 'mro' },
      { t: 'Change the network or mount file systems (needs capabilities)', by: 'caps' }, { t: 'Read ~/.ssh on your computer', by: 'always' }];
    var on = {}; F.forEach(function (f) { on[f.k] = true; });
    var cmd = h('div', { class: 'sb-cmd', translate: 'no' }), res = h('div', { class: 'sb-res' });
    var tg = h('div', { class: 'sb-flags' });
    F.forEach(function (f) {
      var cb = h('input', { type: 'checkbox', checked: true });
      cb.onchange = function () { on[f.k] = cb.checked; upd(); };
      tg.appendChild(h('label', { class: 'sb-flag' }, [cb, h('code', { text: f.f }), h('small', { text: f.d })]));
    });
    var atk = h('div', { class: 'sb-atk' });
    A.forEach(function (a) {
      var b = h('button', { type: 'button', text: a.t });
      b.onclick = function () {
        var blocked = a.by === 'always' || on[a.by], why;
        if (a.by === 'always') why = 'Blocked: that folder was never mounted, so it does not exist inside the container.';
        else why = blocked ? 'Blocked by ' + F.filter(function (f) { return f.k === a.by; })[0].f + '.' : 'It worked. Switch on ' + F.filter(function (f) { return f.k === a.by; })[0].f + ' to stop it.';
        var r = h('div', { class: 'sb-r ' + (blocked ? 'ok' : 'bad') }, [h('b', { text: (blocked ? '🛡 ' : '⚠ ') + a.t }), h('span', { text: why })]);
        res.insertBefore(r, res.firstChild); while (res.children.length > 4) res.removeChild(res.lastChild);
      };
      atk.appendChild(b);
    });
    function upd() {
      var parts = ['docker run --rm'];
      if (on.net) parts.push('--network none'); if (on.mem) parts.push('--memory 512m'); if (on.pids) parts.push('--pids-limit 128');
      if (on.ro) parts.push('--read-only --tmpfs /tmp'); if (on.caps) parts.push('--cap-drop ALL --security-opt no-new-privileges');
      parts.push('-v "$PWD/job":/job' + (on.mro ? ':ro' : '')); parts.push('python:3.13-slim python /job/script.py');
      cmd.textContent = parts.join(' \\\n  ');
    }
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Lock the box, then attack it' }), h('span', { text: 'Switch protections off and on, then try what a misbehaving script might do.' })]));
    root.appendChild(h('div', { class: 'sb-grid' }, [h('div', {}, [tg, cmd]), h('div', {}, [atk, res])]));
    upd();
  }

  /* =============== widget: architecture check =============== */
  function archcheck(root) {
    var BUILD = [['mac', 'Mac with Apple silicon', 'arm64'], ['pc', 'Intel / AMD PC', 'amd64']];
    var TARGET = [['hpc', 'University HPC cluster', 'amd64'], ['vps', 'Typical cloud server', 'amd64'], ['grav', 'AWS Graviton server', 'arm64'], ['pi', 'Raspberry Pi 5', 'arm64'], ['mac2', 'Another Apple-silicon Mac', 'arm64']];
    var FLAGS = [['none', 'docker build', ''], ['amd', 'docker buildx build --platform linux/amd64', ''], ['multi', 'docker buildx build --platform linux/amd64,linux/arm64', '']];
    var b = BUILD[0], t = TARGET[0], fl = FLAGS[0];
    var out = h('div', { class: 'ac-out', 'aria-live': 'polite' });
    function seg(arr, cur, set, mono) {
      var bs = arr.map(function (x) {
        var btn = h('button', { type: 'button', class: mono ? 'mono' : null, 'aria-pressed': x === cur, html: esc(x[1]) + (x[2] ? ' <small>' + x[2] + '</small>' : '') });
        btn.onclick = function () { set(x); bs.forEach(function (y, i) { y.setAttribute('aria-pressed', arr[i] === x); }); upd(); };
        return btn;
      });
      return h('div', { class: 'w-btns seg' }, bs);
    }
    function upd() {
      var flag = fl[0];
      var archs = flag === 'none' ? [b[2]] : flag === 'amd' ? ['amd64'] : ['amd64', 'arm64'];
      var ok = archs.indexOf(t[2]) >= 0;
      out.className = 'ac-out ' + (ok ? 'ok' : 'bad');
      out.innerHTML = '<div class="ac-arch">image: <b>' + archs.join(' + ') + '</b> → machine: <b>' + t[2] + '</b></div>' +
        (ok ? '<p>✓ Runs natively' + (archs.length > 1 ? ': the registry hands each machine the matching build.' : '.') + '</p>'
          : '<p>✗ <code>exec format error</code>. The image contains ' + archs[0] + ' programs, and this machine runs ' + t[2] + '. ' +
            (t[0] === 'hpc' ? 'Apptainer on the cluster fails the same way.' : 'Docker can emulate it with --platform, but slowly.') + ' Fix: build with --platform linux/' + t[2] + ' or for both.</p>');
    }
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Will my image run there?' }), h('span', { text: 'Pick where you build, how you build, and where it runs.' })]));
    root.appendChild(h('small', { class: 'w-lab', text: 'Built on' })); root.appendChild(seg(BUILD, b, function (x) { b = x; }));
    root.appendChild(h('small', { class: 'w-lab', text: 'Built with' })); root.appendChild(seg(FLAGS, fl, function (x) { fl = x; }, true));
    root.appendChild(h('small', { class: 'w-lab', text: 'Runs on' })); root.appendChild(seg(TARGET, t, function (x) { t = x; }));
    root.appendChild(out); upd();
  }

  /* =============== widget: filter =============== */
  function filter(root) {
    var inp = h('input', { type: 'search', placeholder: 'Search commands and errors, e.g. port, logs, volume, exec format', 'aria-label': 'Search the cheat sheet and troubleshooting table' });
    var n = h('small', { class: 'fl-n' });
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Find a command or an error' }), h('span', { text: 'Filters the troubleshooting table and the cheat sheet on this page as you type.' })]));
    root.appendChild(h('div', { class: 'fl-row' }, [inp, n]));
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase(), hits = 0;
      document.querySelectorAll('#trouble tbody tr').forEach(function (tr) { var m = !q || tr.textContent.toLowerCase().indexOf(q) >= 0; tr.hidden = !m; if (m && q) hits++; });
      document.querySelectorAll('#cheat .code').forEach(function (box) {
        var any = false;
        box.querySelectorAll('.ln').forEach(function (ln) { var m = !q || ln.textContent.toLowerCase().indexOf(q) >= 0; ln.classList.toggle('dimmed', !m); ln.classList.toggle('hit', !!q && m); if (m && q) { any = true; hits++; } });
        box.classList.toggle('fl-miss', !!q && !any);
      });
      n.textContent = q ? hits + ' match' + (hits === 1 ? '' : 'es') : '';
    });
  }

  /* =============== widget: quiz =============== */
  function quiz(root) {
    var Q; try { Q = JSON.parse(root.getAttribute('data-quiz')); } catch (e) { return; }
    var right = 0, answered = 0;
    var score = h('div', { class: 'qz-score', 'aria-live': 'polite' });
    root.appendChild(h('div', { class: 'w-head' }, [h('b', { text: 'Check yourself' }), h('span', { text: Q.length + ' quick questions. Get them all right to mark this lesson done on the course page.' })]));
    Q.forEach(function (q, qi) {
      var fb = h('div', { class: 'qz-fb', 'aria-live': 'polite' }), opts = h('div', { class: 'qz-opts' }), done = false, missed = false;
      q.o.forEach(function (o, oi) {
        var b = h('button', { type: 'button', html: o });
        b.onclick = function () {
          if (done) return;
          var ok = oi === q.a;
          b.classList.add(ok ? 'right' : 'wrong');
          if (ok) { done = true; answered++; if (!missed) right++; opts.querySelectorAll('button').forEach(function (x) { x.disabled = x !== b; }); fb.innerHTML = '✓ ' + q.e; fb.className = 'qz-fb ok'; }
          else { missed = true; b.disabled = true; fb.innerHTML = 'Not quite. Try again.'; fb.className = 'qz-fb no'; }
          if (answered === Q.length) {
            score.textContent = right === Q.length ? 'All ' + right + ' right on the first try. Lesson marked done ✓' : right + ' of ' + Q.length + ' right on the first try. Lesson marked done ✓';
            score.classList.add('show'); markDone();
          }
        };
        opts.appendChild(b);
      });
      root.appendChild(h('div', { class: 'qz-q' }, [h('p', { html: '<b>' + (qi + 1) + '.</b> ' + q.q }), opts, fb]));
    });
    root.appendChild(score);
  }

  var W = { playground: playground, vmvsctr: vmvsctr, layercache: layercache, entrypoint: entrypoint, cmdbuilder: cmdbuilder,
    composeflow: composeflow, agentloop: agentloop, sandbox: sandbox, archcheck: archcheck, filter: filter, quiz: quiz };

  function boot() {
    chrome();
    document.querySelectorAll('[data-widget]').forEach(function (el) {
      var f = W[el.getAttribute('data-widget')];
      if (!f) return;
      try { el.innerHTML = ''; f(el); el.classList.add('ready'); } catch (e) { el.textContent = 'This interactive part could not start: ' + e.message; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
