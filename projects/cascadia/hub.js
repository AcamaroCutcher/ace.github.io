/*
 * Hub page animation.
 *  - Hero background: the real USGS catalog (M4+, 1980–2024) replayed in time order on a Pacific Northwest map.
 *    Each quake flashes at its epicenter (bigger = larger magnitude), leaves a faint mark, and M5+ quakes send out a ring.
 *    A seismograph trace along the bottom jumps with each quake.
 *  - Stat tiles count up, cards rise in on scroll, and a spotlight follows the pointer over cards.
 * Respects prefers-reduced-motion (draws the finished map once, no loop) and pauses when the hero is off screen.
 */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var MAP = window.PNW_MAP, CAT = window.PNW_CATALOG;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('hero-map');
  var hero = document.getElementById('hero');
  var ctx = canvas.getContext('2d');
  var yearEl = document.getElementById('replay-year');
  var nEl = document.getElementById('replay-n');
  var toggle = document.getElementById('replay-toggle');

  var DAY0 = 3652.5;                          // catalog times are days since 1970; 1980-01-01 ≈ 3652.5
  var DAYS_PER_YEAR = 365.2425;
  var START = 1980, END = 2025;
  var REPLAY_SECONDS = 70;                    // 45 years in 70 seconds
  var HOLD_SECONDS = 4;                       // pause on the full picture before looping
  var TRENCH = MAP.regions.megathrust.trench;

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // Events: [year, lon, lat, depth, mag, place]; sorted by time
  var events = CAT.main.map(function (e) {
    return { t: START + (e[1] - DAY0) / DAYS_PER_YEAR, lon: e[2], lat: e[3], depth: e[4], mag: e[5], place: e[6] };
  }).filter(function (e) { return e.t >= START && e.t < END; }).sort(function (a, b) { return a.t - b.t; });

  // Classify for color: west of the trench = offshore; deep (30 km+) = inside the sinking plate; else shallow crust
  function trenchLon(lat) {
    for (var i = 1; i < TRENCH.length; i++) {
      var a = TRENCH[i - 1], b = TRENCH[i];
      if ((lat - a[1]) * (lat - b[1]) <= 0) return a[0] + (b[0] - a[0]) * (lat - a[1]) / ((b[1] - a[1]) || 1);
    }
    return lat < TRENCH[0][1] ? TRENCH[0][0] : TRENCH[TRENCH.length - 1][0];
  }
  events.forEach(function (e) { e.kind = e.lon < trenchLon(e.lat) ? 'offshore' : e.depth >= 30 ? 'deep' : 'crustal'; });

  // Short label for the big ones: "The 2001 Nisqually, Washington Earthquake" -> "Nisqually"
  function label(e) {
    var m = /^The \d{4} (.+?)(,.*)? Earthquake$/.exec(e.place) || /^\d{4} (.+?)(,.*)? Earthquake$/.exec(e.place);
    var name = m ? m[1] : e.place.replace(/^\d+ km [NSEW]+ of /, 'off ').replace(/, (California|Oregon|Washington|Canada)$/, '');
    return 'M' + e.mag.toFixed(1) + ' · ' + Math.floor(e.t) + ' · ' + name;
  }

  // ---------- Geometry ----------
  var W = 0, H = 0, DPR = 1, proj, base, marks, colors;
  var LAT0 = 39.9, LAT1 = 50.5, LON0 = -129.5, LON1 = -116, KX = Math.cos(45.2 * Math.PI / 180);

  function layout() {
    var r = hero.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * DPR; canvas.height = H * DPR;
    // Fit the map to the hero height, anchored right (centered on narrow screens)
    var top = 8, bottom = W > 900 ? 64 : 8;          // keep the map clear of the legend strip on wide screens
    var k = Math.min((H - top - bottom) / (LAT1 - LAT0), W * 1.1 / ((LON1 - LON0) * KX));
    var mapW = (LON1 - LON0) * KX * k;
    var x0 = W > 900 ? W - mapW - Math.max(0, (W - 1120) / 2) * 0.35 + W * 0.02 : (W - mapW) / 2;
    var y0 = top + (H - top - bottom - (LAT1 - LAT0) * k) / 2;
    proj = function (lon, lat) { return [x0 + (lon - LON0) * KX * k, y0 + (LAT1 - lat) * k]; };
    proj.k = k;
  }

  function readColors() {
    colors = {
      water: css('--map-water'), land: css('--map-land'), coast: css('--map-coast'), fault: css('--map-fault'),
      deep: css('--deep'), crustal: css('--crustal'), offshore: css('--text-muted'), mega: css('--megathrust'),
      text: css('--text-primary'), muted: css('--text-muted'), page: css('--page'),
    };
  }

  function makeLayer() {
    var c = document.createElement('canvas'); c.width = W * DPR; c.height = H * DPR;
    var g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); return { c: c, g: g };
  }

  function pathRings(g, rings) {
    rings.forEach(function (ring) {
      ring.forEach(function (p, i) { var q = proj(p[0], p[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    });
  }

  function drawBase() {
    base = makeLayer(); var g = base.g;
    g.fillStyle = colors.water; g.fillRect(0, 0, W, H);
    // Land
    g.beginPath();
    MAP.land.forEach(function (f) {
      (f.type === 'MultiPolygon' ? f.coordinates : [f.coordinates]).forEach(function (poly) { pathRings(g, poly); });
    });
    g.fillStyle = colors.land; g.fill('evenodd');
    g.lineWidth = 0.8; g.strokeStyle = colors.coast; g.stroke();
    // Faults (quaternary), very faint
    g.beginPath();
    MAP.faults.forEach(function (f) {
      for (var i = 0; i < f.length; i += 2) { var q = proj(f[i], f[i + 1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
    });
    g.globalAlpha = 0.8; g.lineWidth = 0.5; g.strokeStyle = colors.fault; g.stroke(); g.globalAlpha = 1;
    // State / country borders
    g.beginPath();
    MAP.borders.forEach(function (b) {
      (b.type === 'MultiLineString' ? b.coordinates : [b.coordinates]).forEach(function (l) { pathRings(g, [l]); });
    });
    g.setLineDash([3, 3]); g.lineWidth = 0.7; g.strokeStyle = colors.coast; g.stroke(); g.setLineDash([]);
    // Plate boundary (trench) with teeth on the overriding (east) side
    g.beginPath(); pathRings(g, [TRENCH]);
    g.lineWidth = 2; g.strokeStyle = colors.mega; g.stroke();
    g.fillStyle = colors.mega;
    for (var i = 1; i < TRENCH.length; i++) {
      var a = proj(TRENCH[i - 1][0], TRENCH[i - 1][1]), b = proj(TRENCH[i][0], TRENCH[i][1]);
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      var nx = -uy, ny = ux; if (nx < 0) { nx = -nx; ny = -ny; }     // normal pointing east
      for (var s = 9; s < len - 4; s += 18) {
        var px = a[0] + ux * s, py = a[1] + uy * s;
        g.beginPath(); g.moveTo(px - ux * 4, py - uy * 4); g.lineTo(px + ux * 4, py + uy * 4); g.lineTo(px + nx * 6, py + ny * 6); g.closePath(); g.fill();
      }
    }
    // Cities
    g.font = '11px system-ui, -apple-system, sans-serif'; g.textBaseline = 'middle';
    MAP.cities.forEach(function (c) {
      if (c.rank > 1 && !/Portland|Vancouver|Eureka/.test(c.name)) return;
      var q = proj(c.lon, c.lat);
      g.fillStyle = colors.text; g.beginPath(); g.arc(q[0], q[1], 2.2, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.7; g.fillText(c.name, q[0] + 6, q[1]); g.globalAlpha = 1;
    });
    marks = makeLayer();
  }

  // ---------- Replay ----------
  var clock = 0, last = 0, next = 0, active = [], labels = [], paused = false, visible = true, raf = 0;
  var trace = new Float32Array(600), traceHead = 0, shaking = 0;

  function rad(m) { return 1.6 + (m - 4) * 2.6; }
  function color(e) { return colors[e.kind]; }

  function addMark(e) {
    var q = proj(e.lon, e.lat), g = marks.g;
    g.globalAlpha = e.mag >= 5 ? 0.5 : 0.28; g.fillStyle = color(e);
    g.beginPath(); g.arc(q[0], q[1], Math.max(1, rad(e.mag) * 0.6), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }

  function resetReplay() { clock = 0; next = 0; active = []; labels = []; marks.g.clearRect(0, 0, W, H); }

  function advance(dt) {
    clock += dt;
    var total = REPLAY_SECONDS + HOLD_SECONDS;
    if (clock > total) resetReplay();
    var year = START + Math.min(clock / REPLAY_SECONDS, 1) * (END - START);
    while (next < events.length && events[next].t <= year) {
      var e = events[next++];
      active.push({ e: e, born: clock });
      addMark(e);
      shaking += Math.min(1, Math.pow(10, 0.5 * (e.mag - 4)) / 12);
      if (e.mag >= 6.5) labels.push({ e: e, born: clock });
    }
    active = active.filter(function (a) { return clock - a.born < (a.e.mag >= 5 ? 3.2 : 1.6); });
    labels = labels.filter(function (l) { return clock - l.born < 5; });
    yearEl.textContent = Math.min(END - 1, Math.floor(year));
    nEl.textContent = next.toLocaleString('en-US');
  }

  function drawFrame() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(base.c, 0, 0, W, H);
    ctx.drawImage(marks.c, 0, 0, W, H);
    active.forEach(function (a) {
      var q = proj(a.e.lon, a.e.lat), age = clock - a.born, c = color(a.e), r = rad(a.e.mag);
      // Flash
      var f = Math.max(0, 1 - age / 1.6);
      ctx.globalAlpha = f; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(q[0], q[1], r * (1 + 0.6 * f), 0, Math.PI * 2); ctx.fill();
      // Ring for M5+
      if (a.e.mag >= 5) {
        var p = age / 3.2;
        ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = c; ctx.lineWidth = 1.5 + (a.e.mag - 5);
        ctx.beginPath(); ctx.arc(q[0], q[1], r + p * (14 + (a.e.mag - 5) * 26), 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    // Labels for M6.5+
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'; ctx.textBaseline = 'middle';
    var placed = [];
    labels.forEach(function (l) {
      var q = proj(l.e.lon, l.e.lat), age = clock - l.born, a = Math.min(1, age * 3, (5 - age) * 1.5);
      var text = label(l.e), tw = ctx.measureText(text).width;
      var x = q[0] + 14, y = Math.max(84, Math.min(H - 96, q[1] - 14));   // clear of the header and legend strip
      if (x + tw + 12 > W) x = q[0] - 14 - tw - 12;
      // Stack instead of overlapping earlier labels
      for (var tries = 0; tries < 6 && placed.some(function (b) { return x < b.x + b.w && b.x < x + tw + 12 && Math.abs(b.y - y) < 24; }); tries++) y += 26;
      placed.push({ x: x, y: y, w: tw + 12 });
      ctx.globalAlpha = a * 0.92; ctx.fillStyle = colors.page;
      roundRect(ctx, x, y - 11, tw + 12, 22, 6); ctx.fill();
      ctx.globalAlpha = a; ctx.fillStyle = colors.text; ctx.fillText(text, x + 6, y);
    });
    ctx.globalAlpha = 1;
    drawTrace();
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // Seismograph along the bottom edge
  function pushTrace() {
    var t = performance.now() / 1000;
    var v = (Math.sin(t * 23) * 0.5 + Math.sin(t * 37.3) * 0.3 + (Math.random() - 0.5)) * (0.06 + shaking);
    trace[traceHead] = Math.max(-1, Math.min(1, v)); traceHead = (traceHead + 1) % trace.length;
    shaking *= 0.93;
  }
  function drawTrace() {
    var n = trace.length, y0 = H - 46, amp = 22, dx = W / n;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var v = trace[(traceHead + i) % n], x = i * dx, y = y0 + v * amp;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.globalAlpha = 0.45; ctx.lineWidth = 1.2; ctx.strokeStyle = colors.muted; ctx.stroke(); ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    advance(dt); pushTrace(); pushTrace(); drawFrame();
    schedule();
  }
  function schedule() { if (!raf && !paused && visible && !document.hidden) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

  function rebuild() {
    layout(); readColors(); drawBase();
    // Re-stamp the marks already shown
    for (var i = 0; i < next; i++) addMark(events[i]);
    drawFrame();
  }

  function setPaused(p) {
    paused = p;
    toggle.setAttribute('aria-pressed', String(p));
    toggle.textContent = p ? 'Play' : 'Pause';
    toggle.setAttribute('aria-label', (p ? 'Play' : 'Pause') + ' the earthquake replay');
    if (p) stop(); else schedule();
  }

  function start() {
    rebuild();
    if (reduce) {          // Finished picture, no motion
      clock = REPLAY_SECONDS; advance(0); labels = []; active = []; rebuild();
      setPaused(true);
      return;
    }
    schedule();
  }

  toggle.addEventListener('click', function () {
    if (reduce && paused && next >= events.length) { resetReplay(); rebuild(); }
    setPaused(!paused);
  });
  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(rebuild, 120); });
  document.addEventListener('quake-themechange', rebuild);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else schedule(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) schedule(); else stop(); }).observe(hero);
  }

  // ---------- Stat count-up ----------
  function countUp() {
    var els = document.querySelectorAll('[data-count]');
    if (reduce) return;
    els.forEach(function (el) {
      var to = +el.getAttribute('data-count'), t0 = performance.now() + 700, dur = 1400;
      el.textContent = '0';
      (function tick(now) {
        var p = Math.max(0, Math.min(1, (now - t0) / dur)), ease = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(to * ease));
        if (p < 1) requestAnimationFrame(tick);
      })(performance.now());
    });
  }

  // ---------- Card reveal + spotlight ----------
  function reveal() {
    var items = document.querySelectorAll('.reveal');
    if (reduce || !('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      var batch = es.filter(function (e) { return e.isIntersecting; });
      batch.forEach(function (e, i) { e.target.style.setProperty('--rd', (i * 70) + 'ms'); e.target.classList.add('in'); io.unobserve(e.target); });
    }, { rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }
  document.querySelectorAll('.proj').forEach(function (card) {
    card.addEventListener('pointermove', function (ev) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    });
  });

  // Smooth scroll for "Browse all 10"
  document.querySelectorAll('a[href="#projects"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      document.getElementById('projects').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  // Expose for tests
  window.__hub = { events: events, state: function () { return { clock: clock, shown: next, paused: paused, kinds: kindCounts() }; } };
  function kindCounts() { var c = {}; events.forEach(function (e) { c[e.kind] = (c[e.kind] || 0) + 1; }); return c; }

  // When hosted inside a personal site at /projects/<name>/, show the link back to the projects library
  var home = document.getElementById('home-link');
  if (home && /\/projects\/[^/]+\/(index\.html)?$/.test(location.pathname)) home.hidden = false;

  start(); countUp(); reveal();
})();
