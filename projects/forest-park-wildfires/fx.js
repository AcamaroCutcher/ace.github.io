/*
 * Forest Park Wildfires: motion layer.
 *  - <canvas data-fx="embers|wind|spread"> inside a .banner: embers drifting west on an east wind,
 *    wind streaks (the Gorge east wind), or a denser, hotter ember field.
 *  - .reveal elements fade up as they scroll into view.
 *  - .subnav links highlight the part of the page in view.
 * Honors prefers-reduced-motion (no animation, content fully visible) and pauses off-screen.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) document.documentElement.classList.add('js-anim');

  function rand(a, b) { return a + Math.random() * (b - a); }

  function Field(canvas) {
    var mode = canvas.getAttribute('data-fx') || 'embers';
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], running = false, last = 0;

    function size() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(W * H / (mode === 'wind' ? 9000 : mode === 'spread' ? 5200 : 7500));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(spawn(true));
    }

    function spawn(anywhere) {
      if (mode === 'wind') {
        return { x: anywhere ? rand(0, W) : W + rand(0, 200), y: rand(0, H), len: rand(40, 160),
                 v: rand(160, 420), a: rand(0.08, 0.32), w: rand(0.6, 1.6) };
      }
      var hot = mode === 'spread';
      return {
        x: anywhere ? rand(0, W) : rand(W * 0.1, W * 1.15),
        y: anywhere ? rand(0, H) : H + rand(0, 40),
        vx: -rand(12, hot ? 70 : 45), vy: -rand(18, hot ? 75 : 55),
        r: rand(0.8, hot ? 2.8 : 2.2), life: rand(0, 1), ttl: rand(4, 9),
        hue: rand(18, 42), ph: rand(0, 6.28)
      };
    }

    function step(t) {
      if (!running) return;
      var dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
      ctx.clearRect(0, 0, W, H);
      if (mode === 'wind') {
        ctx.lineCap = 'round';
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.x -= p.v * dt;
          if (p.x + p.len < 0) parts[i] = p = spawn(false);
          var g = ctx.createLinearGradient(p.x, 0, p.x + p.len, 0);
          g.addColorStop(0, 'rgba(220,235,255,' + p.a + ')');
          g.addColorStop(1, 'rgba(220,235,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = p.w;
          ctx.beginPath();
          var wob = Math.sin((p.x + t * 0.05) / 90) * 6;
          ctx.moveTo(p.x, p.y + wob); ctx.quadraticCurveTo(p.x + p.len / 2, p.y + wob - 4, p.x + p.len, p.y + wob);
          ctx.stroke();
        }
      } else {
        ctx.globalCompositeOperation = 'lighter';
        for (var j = 0; j < parts.length; j++) {
          var e = parts[j];
          e.life += dt / e.ttl;
          e.x += (e.vx + Math.sin(t / 700 + e.ph) * 14) * dt;
          e.y += e.vy * dt;
          if (e.life >= 1 || e.y < -20 || e.x < -20) { parts[j] = e = spawn(false); e.life = 0; }
          var fade = Math.sin(Math.PI * e.life);
          var flick = 0.65 + 0.35 * Math.sin(t / 90 + e.ph * 3);
          var a = Math.max(0, fade * flick);
          var rad = e.r * 5;
          var gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rad);
          gr.addColorStop(0, 'hsla(' + (e.hue + 15) + ',100%,75%,' + a + ')');
          gr.addColorStop(0.3, 'hsla(' + e.hue + ',100%,55%,' + a * 0.55 + ')');
          gr.addColorStop(1, 'hsla(' + e.hue + ',100%,45%,0)');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(e.x, e.y, rad, 0, 6.283); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      requestAnimationFrame(step);
    }

    function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); } }
    function stop() { running = false; }

    size();
    window.addEventListener('resize', function () { size(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }).observe(canvas);
    } else { start(); }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (canvas.getBoundingClientRect().bottom > 0) start();
    });
  }

  function init() {
    if (!reduce) document.querySelectorAll('canvas[data-fx]').forEach(function (c) { Field(c); });

    var rev = document.querySelectorAll('.reveal');
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      rev.forEach(function (el) { io.observe(el); });
    } else {
      rev.forEach(function (el) { el.classList.add('in'); });
    }

    var links = document.querySelectorAll('.subnav a[href^="#"], .doc-toc a[href^="#"], .toc-inline a[href^="#"]');
    if (links.length && 'IntersectionObserver' in window) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) { a.classList.remove('on'); });
            map[e.target.id].classList.add('on');
          }
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      Object.keys(map).forEach(function (id) { var t = document.getElementById(id); if (t) so.observe(t); });
    }
  }

  /* Photo slideshow: crossfade every 7 s, credit line follows the photo. */
  function slideshow() {
    var box = document.querySelector('.slides');
    if (!box) return;
    var slides = box.querySelectorAll('.slide');
    var credit = document.querySelector('[data-slide-credit]');
    var dots = document.querySelector('.slide-dots');
    var i = 0, timer = null;
    var buttons = [];
    slides.forEach(function (s, k) {
      if (!dots) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show photo ' + (k + 1) + ' of ' + slides.length);
      b.addEventListener('click', function () { show(k); restart(); });
      dots.appendChild(b); buttons.push(b);
    });
    function show(k) {
      slides[i].classList.remove('on');
      i = k;
      // restart the drift animation on the incoming photo
      slides[i].style.animation = 'none'; void slides[i].offsetWidth; slides[i].style.animation = '';
      slides[i].classList.add('on');
      if (credit) credit.innerHTML = slides[i].getAttribute('data-credit');
      buttons.forEach(function (b, n) { b.setAttribute('aria-current', n === i ? 'true' : 'false'); });
    }
    function restart() { if (timer) clearInterval(timer); if (!reduce) timer = setInterval(function () { show((i + 1) % slides.length); }, 7000); }
    show(0); restart();
  }

  function printButton() {
    document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  }

  /* Copy buttons on code blocks. */
  function copyButtons() {
    document.querySelectorAll('.code').forEach(function (box) {
      var btn = box.querySelector('.copy'), pre = box.querySelector('pre');
      if (!btn || !pre) return;
      btn.addEventListener('click', function () {
        var text = pre.innerText;
        var done = function () { btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1600); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () {});
        else { var r = document.createRange(); r.selectNodeContents(pre); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { document.execCommand('copy'); done(); } catch (e) {} sel.removeAllRanges(); }
      });
    });
  }

  /* Motion added in v8. All of it is skipped under prefers-reduced-motion. */
  function motion() {
    if (reduce) return;

    // 1. reading-progress bar along the top edge
    var bar = document.createElement('div');
    bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var banner = document.querySelector('.banner'), inner = banner && banner.querySelector('.banner-inner'), ticking = false;
    function onScroll() {
      ticking = false;
      var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      // 2. the banner text sinks and fades a little as the page scrolls away from it
      if (inner && y < banner.offsetHeight + 200) {
        var k = Math.min(1, y / Math.max(1, banner.offsetHeight));
        inner.style.transform = 'translateY(' + (k * 46).toFixed(1) + 'px)';
        inner.style.opacity = (1 - k * 0.75).toFixed(3);
      }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    // 3. siblings that reveal together do so one after another
    document.querySelectorAll('.chapters, .stats, .hero-stats, .lab-buttons').forEach(function (box) {
      var n = 0;
      Array.prototype.forEach.call(box.children, function (el) { el.style.setProperty('--i', Math.min(n++, 8)); });
    });

    // 4. numbers count up the first time they are seen. Text such as "13,007 → 20,373 ha" keeps its format.
    var NUM = /\d[\d,]*(?:\.\d+)?/g;
    function countUp(el) {
      var text = el.textContent, targets = [], m;
      NUM.lastIndex = 0;
      while ((m = NUM.exec(text))) targets.push({ at: m.index, raw: m[0], v: parseFloat(m[0].replace(/,/g, '')), dec: (m[0].split('.')[1] || '').length, comma: m[0].indexOf(',') >= 0 });
      if (!targets.length) return;
      var t0 = performance.now(), dur = 1100;
      el.style.minWidth = el.getBoundingClientRect().width + 'px';   // no layout shift while the digits change
      function fmt(tg, v) { var s2 = v.toFixed(tg.dec); return tg.comma ? s2.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s2; }
      function tick(now) {
        var u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3), out = '', pos = 0;
        targets.forEach(function (tg) { out += text.slice(pos, tg.at) + (u >= 1 ? tg.raw : fmt(tg, tg.v * e)); pos = tg.at + tg.raw.length; });
        el.textContent = out + text.slice(pos);
        if (u < 1) requestAnimationFrame(tick); else el.style.minWidth = '';
      }
      requestAnimationFrame(tick);
    }
    var nums = document.querySelectorAll('.stats strong, .hero-stats b');
    if (nums.length && 'IntersectionObserver' in window) {
      var no = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { no.unobserve(e.target); countUp(e.target); } });
      }, { rootMargin: '0px 0px -10% 0px' });
      nums.forEach(function (el) { no.observe(el); });
    }

    // 5. section cards: a soft light follows the pointer
    document.querySelectorAll('a.chapter').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  function boot() { init(); slideshow(); printButton(); copyButtons(); motion(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
