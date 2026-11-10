/*
 * Shared behavior for the home page, CV and Projects & Papers library:
 * theme toggle, mobile menu, navbar shadow, current-section highlight, scroll reveal.
 * Every block checks that its elements exist, so pages can leave parts out.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var THEME_KEY = 'quake-viz-theme'; // shared with projects/*/theme.js

  // ---------- Theme toggle ----------
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    var icon = themeToggle.querySelector('i');
    var syncToggle = function () {
      var dark = root.classList.contains('dark-mode');
      if (icon) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeToggle.setAttribute('aria-pressed', String(dark));
    };
    syncToggle();
    themeToggle.addEventListener('click', function () {
      var dark = !root.classList.contains('dark-mode');
      root.classList.toggle('dark-mode', dark);
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) { /* storage unavailable */ }
      syncToggle();
    });
    // Follow the operating system while the visitor has not chosen a theme
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function (e) {
      var saved = null;
      try { saved = localStorage.getItem(THEME_KEY) || localStorage.getItem('theme'); } catch (err) { /* ignore */ }
      if (!saved) { root.classList.toggle('dark-mode', e.matches); syncToggle(); }
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
  }

  // ---------- Mobile menu ----------
  var menuToggle = document.getElementById('mobileMenuToggle');
  var navMenu = document.getElementById('navMenu');
  if (menuToggle && navMenu) {
    var setMenu = function (open) {
      navMenu.classList.toggle('active', open);
      menuToggle.classList.toggle('active', open);
      menuToggle.setAttribute('aria-expanded', String(open));
    };
    menuToggle.setAttribute('aria-controls', 'navMenu');
    setMenu(false);
    menuToggle.addEventListener('click', function () { setMenu(!navMenu.classList.contains('active')); });
    navMenu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu.classList.contains('active')) { setMenu(false); menuToggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (navMenu.classList.contains('active') && !e.target.closest('.navbar')) setMenu(false);
    });
  }

  // ---------- Navbar shadow once the page scrolls ----------
  var navbar = document.getElementById('navbar');
  if (navbar) {
    var onScroll = function () { navbar.classList.toggle('scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------- Highlight the section being read (home page) ----------
  var sectionLinks = {};
  document.querySelectorAll('.nav-link[href^="#"]').forEach(function (a) {
    sectionLinks[a.getAttribute('href').slice(1)] = a;
  });
  var ids = Object.keys(sectionLinks);
  if (ids.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        ids.forEach(function (id) { sectionLinks[id].classList.remove('active'); });
        sectionLinks[entry.target.id].classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  // ---------- Scroll reveal ----------
  var revealEls = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (revealEls.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('in'); });
    } else {
      var revealer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('in'); revealer.unobserve(entry.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      revealEls.forEach(function (el) { revealer.observe(el); });
    }
  }

  // ---------- Copy email address ----------
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.querySelector('[data-copy-label]');
    var original = label ? label.textContent : '';
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function (ok) {
        if (!label) return;
        label.textContent = ok ? 'Copied' : text;
        setTimeout(function () { label.textContent = original; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });

  // ---------- Print button (CV) ----------
  document.querySelectorAll('[data-print]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.print(); });
  });

  // ---------- External links open in a new tab ----------
  document.querySelectorAll('a[href^="http"]').forEach(function (link) {
    if (link.hostname && link.hostname !== window.location.hostname) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // ---------- Equations (KaTeX, loaded on pages that have [data-tex]) ----------
  var texEls = document.querySelectorAll('[data-tex]');
  if (texEls.length) {
    var typeset = function () {
      if (!window.katex) return;
      texEls.forEach(function (el) {
        try {
          window.katex.render(el.getAttribute('data-tex'), el, { displayMode: true, throwOnError: false });
        } catch (e) { /* leave the fallback text in place */ }
      });
    };
    if (window.katex) typeset(); else window.addEventListener('load', typeset);
  }

  // ---------- Reading progress bar ----------
  var bar = document.querySelector('.scroll-progress');
  if (bar) {
    var ticking = false;
    var paint = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();
  }

  // ---------- Featured cards: light follows the pointer ----------
  document.querySelectorAll('.work-card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // ---------- Hero: a small fire-spread simulation on the graph-paper grid ----------
  // A stochastic cellular automaton: each burning cell can ignite its neighbors, with a wind
  // bias. Cells glow, cool, and the grid regrows before the next ignition. Decorative only.
  var canvas = document.querySelector('.hero-canvas');
  if (canvas && canvas.getContext && !reduceMotion) {
    var ctx = canvas.getContext('2d');
    var CELL = 32, cols = 0, rows = 0, heat, state, burning, wind, running = false, visible = true, last = 0, idle = 0;

    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
      heat = new Float32Array(cols * rows); state = new Uint8Array(cols * rows); burning = [];
      idle = 20;
    };
    var ignite = function () {
      state.fill(0); burning = [];
      // start on the right-hand side, where the mask lets the canvas show
      var c = Math.floor(cols * (0.55 + Math.random() * 0.35)), r = Math.floor(rows * (0.15 + Math.random() * 0.6));
      var a = Math.random() * Math.PI * 2;
      wind = [Math.cos(a), Math.sin(a)];
      var i = r * cols + c; state[i] = 1; heat[i] = 1; burning.push(i);
    };
    var step = function () {
      if (!burning.length) { if (--idle <= 0) { ignite(); idle = 26; } return; }
      var next = [];
      for (var k = 0; k < burning.length; k++) {
        var i = burning[k], c = i % cols, r = (i - c) / cols, spreading = false;
        for (var d = 0; d < 4; d++) {
          var dc = d === 0 ? 1 : d === 1 ? -1 : 0, dr = d === 2 ? 1 : d === 3 ? -1 : 0;
          var nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          var j = nr * cols + nc;
          if (state[j]) continue;
          var p = 0.2 + 0.22 * (dc * wind[0] + dr * wind[1]);
          if (Math.random() < p) { state[j] = 1; heat[j] = 1; next.push(j); } else { spreading = true; }
        }
        if (spreading && Math.random() < 0.72) next.push(i); else state[i] = 2;
      }
      burning = next.length > 420 ? [] : next;
    };
    var draw = function (t) {
      if (!running) return;
      requestAnimationFrame(draw);
      if (t - last < 110) return;
      last = t;
      step();
      var dark = root.classList.contains('dark-mode');
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (var i = 0; i < heat.length; i++) {
        var hgt = heat[i];
        if (hgt <= 0.01) continue;
        var c = i % cols, r = (i - c) / cols;
        // hot cells are amber, cooling cells fade toward ash
        var g = Math.round(90 + 110 * hgt);
        ctx.fillStyle = 'rgba(' + (dark ? 255 : 234) + ',' + g + ',' + (dark ? 60 : 40) + ',' + (hgt * (dark ? 0.34 : 0.26)).toFixed(3) + ')';
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1);
        heat[i] = hgt * 0.955;
      }
    };
    var setRunning = function () {
      var should = visible && !document.hidden;
      if (should && !running) { running = true; requestAnimationFrame(draw); }
      if (!should) running = false;
    };
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', setRunning);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; setRunning(); }).observe(canvas);
    }
    setRunning();
  }

  // ---------- Footer year ----------
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
