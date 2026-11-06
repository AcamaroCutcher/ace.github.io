/*
 * Level-set lab: the equation WRF-SFIRE solves for the fire front, in the browser.
 *
 *   dpsi/dt + S(x, n) |grad psi| = 0,   n = grad psi / |grad psi|,   fire area = { psi <= 0 }
 *
 * S follows SFIRE's fire_ros_cawfe with fire_advection = 1 (the Registry default):
 *   S = R0 + phiW(|U|) max(0, cos(U, n)) + phiS(|grad z|) max(0, cos(grad z, n)),  S <= 6 m/s
 * with the Rothermel coefficients of the Anderson-13 fuel models (data/sfire-fuels.json).
 * Space: upwind |grad psi| (fire_upwinding = 4, "Sethian", = Godunov for S >= 0) or no
 * upwinding (fire_upwinding = 0). Time: Heun / RK2 (fire_back_weight = 0.5).
 * fire_grows_only: psi may only decrease. Optional reinitialization to a signed distance
 * (the fire_lsm_reinit option of the ifire = 2 code path).
 *
 * <div class="lab" data-lab="levelset" data-preset="single|multi" data-root="../"></div>
 */
(function () {
  'use strict';
  var NX = 180, NY = 120, DX = 10;               // 1.8 km x 1.2 km, 10 m cells
  var N = NX * NY, BIG = 1e4, ROS_MAX = 6;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  function Lab(host, coef) {
    var preset = host.getAttribute('data-preset') || 'single';
    // ---------- state
    var psi = new Float32Array(N), psiS = new Float32Array(N), F1 = new Float32Array(N), F2 = new Float32Array(N);
    var tign = new Float32Array(N), Sb = new Float32Array(N), fuelOK = new Uint8Array(N);
    var z = new Float32Array(N), zx = new Float32Array(N), zy = new Float32Array(N), Smap = new Float32Array(N);
    var t = 0, steps = 0, playing = !reduce, schedule = [], nextIgn = 0;
    var P = { fuel: '2', wind: 5, dir: 90, terrain: 'ridge', barrier: 'road', scheme: 'upwind', reinit: false, advection: '1',
      view: 'fire', arrows: true, speed: 30 };
    if (preset === 'multi') { P.wind = 4; P.dir = 75; P.terrain = 'ridge'; P.barrier = 'none'; P.speed = 40; }

    // ---------- DOM
    var canvas = h('canvas', { width: 900, height: 600, 'aria-label': 'Level-set simulation. Click or tap to ignite.' });
    var badge = h('div', { class: 'lab-badge' }), hint = h('div', { class: 'lab-hint', text: 'Click or tap to ignite' });
    var stage = h('div', { class: 'lab-stage' }, [canvas, badge, hint]);
    host.appendChild(stage);
    var ctx = canvas.getContext('2d');
    var grid = document.createElement('canvas'); grid.width = NX; grid.height = NY;
    var gctx = grid.getContext('2d'), img = gctx.createImageData(NX, NY);

    function select(label, key, opts) {
      var s = h('select');
      opts.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(P[key]) === String(o[0])) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', function () { P[key] = s.value; changed(key); });
      return h('label', {}, [document.createTextNode(label), s]);
    }
    function range(label, key, min, max, step, unit) {
      var out = h('output', { text: P[key] + unit });
      var r = h('input', { type: 'range', min: min, max: max, step: step, value: P[key] });
      r.addEventListener('input', function () { P[key] = +r.value; out.textContent = r.value + unit; changed(key); });
      var lab = h('label', {}, [h('span', {}, [document.createTextNode(label + ' '), out]), r]);
      return lab;
    }
    function check(label, key) {
      var c = h('input', { type: 'checkbox' }); c.checked = !!P[key];
      c.addEventListener('change', function () { P[key] = c.checked; changed(key); });
      return h('label', { class: 'check' }, [c, document.createTextNode(label)]);
    }
    var fuelOpts = Object.keys(coef).map(function (k) { return [k, k + ' · ' + coef[k].name]; });
    var controls = h('div', { class: 'lab-controls' }, [
      select('Fuel model (Anderson 13)', 'fuel', fuelOpts),
      range('Wind speed at 6.1 m', 'wind', 0, 12, 0.5, ' m/s'),
      range('Wind from', 'dir', 0, 359, 1, '°'),
      select('Terrain', 'terrain', [['flat', 'Flat'], ['hill', 'Round hill (120 m)'], ['ridge', 'NW–SE ridge (150 m), like the park']]),
      select('Firebreak', 'barrier', [['none', 'None'], ['road', 'Road, 20 m, no fuel'], ['river', 'River, 60 m']]),
      select('Spread direction (fire_advection)', 'advection', [['1', '1 · speed projected on the normal (default)'], ['0', '0 · wind component along the normal']]),
      select('Spatial scheme for |∇ψ|', 'scheme', [['upwind', 'Upwind (fire_upwinding = 4)'], ['central', 'No upwinding (fire_upwinding = 0)']]),
      select('View', 'view', [['fire', 'Fire on the fuel map'], ['psi', 'Level-set function ψ'], ['tign', 'Fire arrival time T'], ['3d', 'ψ as a 3-D surface']]),
      range('Playback', 'speed', 5, 120, 5, '× real time'),
      h('div', { class: 'ctl' }, [check('Reinitialize ψ to a distance function', 'reinit'), check('Show spread vectors S·n on the front', 'arrows')])
    ]);
    host.appendChild(controls);
    var bPlay = h('button', { type: 'button', class: 'primary', text: playing ? 'Pause' : 'Play' });
    var bStep = h('button', { type: 'button', text: 'Step' });
    var bReset = h('button', { type: 'button', text: 'Reset' });
    var bClear = h('button', { type: 'button', text: 'Clear ignitions' });
    host.appendChild(h('div', { class: 'lab-buttons' }, [bPlay, bStep, bReset, bClear]));
    var readout = h('div', { class: 'lab-readout', 'aria-live': 'off' });
    host.appendChild(readout);
    var slice = h('canvas', { width: 900, height: 150, 'aria-label': 'Cross-section of the level-set function' });
    var sliceNote = h('p', { text: 'Cross-section of ψ along the dashed line. The fire is where ψ ≤ 0; the front is where the curve crosses zero, and the upwind scheme moves that crossing outward at speed S.' });
    host.appendChild(h('div', { class: 'lab-slice' }, [slice, sliceNote]));
    var sctx = slice.getContext('2d');

    // ---------- setup
    function terrain() {
      var cx = NX * DX / 2, cy = NY * DX / 2, a = -40 * Math.PI / 180;
      for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
        var x = i * DX - cx, y = cy - j * DX, k = j * NX + i, v = 0;
        if (P.terrain === 'hill') v = 120 * Math.exp(-(x * x + y * y) / (2 * 260 * 260));
        else if (P.terrain === 'ridge') { var d = -Math.sin(a) * x + Math.cos(a) * y; v = 150 * Math.exp(-(d * d) / (2 * 230 * 230)); }
        z[k] = v;
      }
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        k = j * NX + i;
        var e = z[j * NX + Math.min(NX - 1, i + 1)], w = z[j * NX + Math.max(0, i - 1)];
        var n = z[Math.max(0, j - 1) * NX + i], s = z[Math.min(NY - 1, j + 1) * NX + i];
        zx[k] = (e - w) / (2 * DX); zy[k] = (n - s) / (2 * DX);   // y up = north
      }
    }
    function barrier() {
      for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
        var x = i * DX, k = j * NX + i, ok = 1;
        if (P.barrier === 'road' && x >= 1180 && x < 1200) ok = 0;
        if (P.barrier === 'river' && x >= 1160 && x < 1220) ok = 0;
        fuelOK[k] = ok;
      }
    }
    function spreadBounds() {
      var c = coef[P.fuel], U = P.wind;
      var umid = Math.min(U, 30) * 196.85;
      var phiw = c.R0 * c.C * Math.pow(c.ratio, -c.E) * Math.pow(umid, c.B);
      for (var k = 0; k < N; k++) {
        var tanp = Math.min(Math.hypot(zx[k], zy[k]), 5);
        Sb[k] = fuelOK[k] ? Math.min(ROS_MAX, c.R0 + phiw + c.R0 * c.phis * tanp * tanp) : 0;
      }
      return phiw;
    }
    var phiW = 0;
    function windVec() {   // direction the wind blows TO, x east, y north
      var a = (P.dir + 180) * Math.PI / 180;
      return [Math.sin(a), Math.cos(a)];
    }

    function reset() {
      t = 0; steps = 0; nextIgn = 0;
      for (var k = 0; k < N; k++) { psi[k] = BIG; tign[k] = Infinity; }
      schedule.sort(function (a, b) { return a.t - b.t; });
      applyIgnitions(0);
    }
    function defaultSchedule() {
      schedule = preset === 'multi'
        ? [{ x: 1500, y: 300, r: 15, t: 0 }, { x: 1450, y: 900, r: 15, t: 120 }, { x: 1250, y: 600, r: 15, t: 300 },
           { x: 1600, y: 620, r: 15, t: 480 }, { x: 1050, y: 250, r: 15, t: 660 }]
        : [{ x: 1500, y: 600, r: 20, t: 0 }];
    }
    function applyIgnitions(now) {
      while (nextIgn < schedule.length && schedule[nextIgn].t <= now + 1e-6) {
        var g = schedule[nextIgn++];
        for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
          var k = j * NX + i;
          var d = Math.hypot(i * DX - g.x, (NY - 1 - j) * DX - g.y) - g.r;
          var dd = fuelOK[k] ? d : Math.max(d, DX);     // no-fuel cells never count as burning
          if (dd < psi[k]) psi[k] = dd;
          if (d <= 0 && fuelOK[k] && tign[k] > g.t) tign[k] = g.t;
        }
      }
    }

    // ---------- numerics
    function rhs(src, out) {
      var c = coef[P.fuel], w = windVec(), U = P.wind, central = P.scheme === 'central';
      for (var j = 0; j < NY; j++) {
        var jm = j > 0 ? j - 1 : j, jp = j < NY - 1 ? j + 1 : j;
        for (var i = 0; i < NX; i++) {
          var k = j * NX + i;
          if (!fuelOK[k]) { out[k] = 0; Smap[k] = 0; continue; }
          var im = i > 0 ? i - 1 : i, ip = i < NX - 1 ? i + 1 : i;
          var p = src[k];
          // fuel-free neighbours (roads, rivers) act as zero-gradient walls: no information crosses them
          var kw = j * NX + im, ke = j * NX + ip, ks = jp * NX + i, kn = jm * NX + i;
          var pw = fuelOK[kw] ? src[kw] : p, pe = fuelOK[ke] ? src[ke] : p;
          var ps = fuelOK[ks] ? src[ks] : p, pn = fuelOK[kn] ? src[kn] : p;
          // x to the east, y to the north (row j grows southward)
          var dxm = (p - pw) / DX, dxp = (pe - p) / DX;
          var dym = (p - ps) / DX, dyp = (pn - p) / DX;
          var cx = 0.5 * (dxm + dxp), cy = 0.5 * (dym + dyp), cn = Math.hypot(cx, cy);
          var nx = cn > 0 ? cx / cn : 0, ny = cn > 0 ? cy / cn : 0;
          var gz = Math.hypot(zx[k], zy[k]), S;
          if (P.advection === '1') {          // SFIRE default: full speed/slope, projected on n
            var cw = U > 0 ? Math.max(0, w[0] * nx + w[1] * ny) : 0;
            var cs = gz > 0 ? Math.max(0, (zx[k] * nx + zy[k] * ny) / gz) : 0, tanp = Math.min(gz, 5);
            S = Math.min(ROS_MAX, c.R0 + phiW * cw + c.R0 * c.phis * tanp * tanp * cs);
          } else {                            // fire_advection = 0: wind and slope components along n
            var un = Math.max(0, U * (w[0] * nx + w[1] * ny)), tn = Math.min(Math.max(0, zx[k] * nx + zy[k] * ny), 5);
            var pw = un > 0 ? c.R0 * c.C * Math.pow(c.ratio, -c.E) * Math.pow(Math.min(un, 30) * 196.85, c.B) : 0;
            S = Math.min(ROS_MAX, c.R0 + pw + c.R0 * c.phis * tn * tn);
          }
          Smap[k] = S;
          var g = central ? cn : Math.sqrt(Math.pow(Math.max(dxm, 0), 2) + Math.pow(Math.min(dxp, 0), 2) +
                                           Math.pow(Math.max(dym, 0), 2) + Math.pow(Math.min(dyp, 0), 2));
          out[k] = S * g;
        }
      }
    }
    function reinit() {   // a few pseudo-time steps of psi_tau = sign(psi0) (1 - |grad psi|)
      var d = 0.3 * DX, s0 = psiS;
      for (var k = 0; k < N; k++) s0[k] = psi[k];
      for (var it = 0; it < 4; it++) {
        for (var j = 0; j < NY; j++) {
          var jm = j > 0 ? j - 1 : j, jp = j < NY - 1 ? j + 1 : j;
          for (var i = 0; i < NX; i++) {
            k = j * NX + i;
            var p0 = s0[k]; if (Math.abs(p0) > 40 * DX) { F1[k] = 0; continue; }
            var im = i > 0 ? i - 1 : i, ip = i < NX - 1 ? i + 1 : i, p = psi[k];
            var a = (p - psi[j * NX + im]) / DX, b = (psi[j * NX + ip] - p) / DX;
            var c = (p - psi[jp * NX + i]) / DX, e = (psi[jm * NX + i] - p) / DX;
            var sg = p0 / Math.sqrt(p0 * p0 + DX * DX), g;
            if (p0 > 0) g = Math.sqrt(Math.max(Math.pow(Math.max(a, 0), 2), Math.pow(Math.min(b, 0), 2)) + Math.max(Math.pow(Math.max(c, 0), 2), Math.pow(Math.min(e, 0), 2)));
            else g = Math.sqrt(Math.max(Math.pow(Math.min(a, 0), 2), Math.pow(Math.max(b, 0), 2)) + Math.max(Math.pow(Math.min(c, 0), 2), Math.pow(Math.max(e, 0), 2)));
            F1[k] = sg * (1 - g);
          }
        }
        for (k = 0; k < N; k++) {
          var np = psi[k] + d * F1[k];
          if ((s0[k] > 0) === (np > 0) || s0[k] === 0) psi[k] = np;   // never move the zero crossing
        }
      }
    }
    var Smax = 0;
    function step(maxDt) {
      Smax = 0; for (var k = 0; k < N; k++) if (Sb[k] > Smax) Smax = Sb[k];
      var dt = Math.min(maxDt, Smax > 0 ? 0.45 * DX / Smax : maxDt);
      if (nextIgn < schedule.length) dt = Math.min(dt, Math.max(1e-3, schedule[nextIgn].t - t));
      rhs(psi, F1);
      for (k = 0; k < N; k++) psiS[k] = psi[k] - dt * F1[k];
      rhs(psiS, F2);
      for (k = 0; k < N; k++) {
        var old = psi[k];
        var nv = old - 0.5 * dt * (F1[k] + F2[k]);
        if (nv > old) nv = old;                          // fire_grows_only
        if (old > 0 && nv <= 0 && tign[k] === Infinity) tign[k] = t + dt * old / (old - nv);
        psi[k] = nv;
      }
      t += dt; steps++;
      if (P.reinit && steps % 8 === 0) reinit();
      applyIgnitions(t);
      return dt;
    }

    // ---------- drawing
    function shade(k) {
      var e = k % NX < NX - 1 ? z[k + 1] : z[k], wv = k % NX > 0 ? z[k - 1] : z[k];
      var nn = k >= NX ? z[k - NX] : z[k], ss = k < N - NX ? z[k + NX] : z[k];
      var hs = 0.75 + 0.9 * ((wv - e) + (nn - ss)) / (2 * DX);
      return Math.max(0.55, Math.min(1.25, hs));
    }
    var FUEL_RGB = { '1': [214, 170, 60], '2': [120, 150, 70], '3': [200, 160, 70], '8': [60, 120, 60], '9': [95, 130, 60], '10': [70, 110, 55] };
    function draw() {
      var dark = isDark(), d = img.data, base = FUEL_RGB[P.fuel] || [90, 130, 70];
      var tmax = 1;
      for (var k = 0; k < N; k++) if (tign[k] !== Infinity && tign[k] > tmax) tmax = tign[k];
      for (k = 0; k < N; k++) {
        var o = k * 4, r, g, b, s = shade(k);
        if (P.view === 'psi' || P.view === '3d') {
          var v = Math.max(-1, Math.min(1, psi[k] / 300));
          var mid = dark ? [56, 56, 53] : [240, 239, 236], neg = dark ? [230, 103, 103] : [227, 73, 72], pos = dark ? [57, 135, 229] : [42, 120, 214];
          var tgt = v < 0 ? neg : pos, f = Math.abs(v);
          r = mid[0] + (tgt[0] - mid[0]) * f; g = mid[1] + (tgt[1] - mid[1]) * f; b = mid[2] + (tgt[2] - mid[2]) * f;
          // level-set contours every 50 m
          var q = Math.abs(psi[k]) % 50; if (psi[k] < BIG / 2 && (q < 2.2 || q > 47.8)) { r *= 0.7; g *= 0.7; b *= 0.7; }
        } else if (P.view === 'tign') {
          var surf = dark ? [26, 26, 25] : [252, 252, 251];
          if (tign[k] === Infinity) { r = surf[0] * s * (dark ? 1.2 : 0.97); g = surf[1] * s * (dark ? 1.2 : 0.97); b = surf[2] * s * (dark ? 1.2 : 0.97); }
          else {   // one hue (orange) light -> dark with time
            var f2 = Math.min(1, tign[k] / tmax);
            var lo = [252, 206, 170], hi = [140, 45, 10];
            r = lo[0] + (hi[0] - lo[0]) * f2; g = lo[1] + (hi[1] - lo[1]) * f2; b = lo[2] + (hi[2] - lo[2]) * f2;
          }
        } else {
          if (!fuelOK[k]) { r = dark ? 70 : 150; g = dark ? 74 : 155; b = dark ? 80 : 165; if (P.barrier === 'river') { r = 70; g = 120; b = 170; } }
          else { var m = dark ? 0.55 : 1.0; r = base[0] * s * m; g = base[1] * s * m; b = base[2] * s * m; if (!dark) { r = 255 - (255 - r) * 0.55; g = 255 - (255 - g) * 0.55; b = 255 - (255 - b) * 0.55; } }
          if (tign[k] <= t) {
            var age = t - tign[k], tf = coef[P.fuel].Tf || 60;
            if (age < tf) { var a2 = age / tf; r = 255; g = 230 - 150 * a2; b = 120 - 100 * a2; }
            else { var fade = Math.min(1, (age - tf) / (4 * tf)); r = 150 - (150 - (dark ? 40 : 70)) * fade; g = 40 - 20 * fade; b = 20 - 5 * fade; }
          }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
      gctx.putImageData(img, 0, 0);
      var W = canvas.width, H = canvas.height, sc = W / NX;
      ctx.imageSmoothingEnabled = P.view !== 'fire';
      if (P.view === '3d') { draw3d(dark); }
      else {
        ctx.drawImage(grid, 0, 0, W, H);
        if (P.view !== 'psi') isochrones(sc, dark);
        contour(psi, 0, sc, dark ? '#fff4c2' : '#1b1b19', 2.2);
        if (P.arrows && P.view === 'fire') arrows(sc);
        // slice line
        ctx.setLineDash([6, 6]); ctx.strokeStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
        var yl = (sliceRow() + 0.5) * sc; ctx.beginPath(); ctx.moveTo(0, yl); ctx.lineTo(W, yl); ctx.stroke(); ctx.setLineDash([]);
        windArrow(dark);
      }
      drawSlice(dark);
      var burned = 0; for (k = 0; k < N; k++) if (psi[k] <= 0) burned++;
      badge.textContent = 't = ' + fmtT(t) + ' · ' + (burned * DX * DX / 1e4).toFixed(1) + ' ha burned';
      var band = 0, dev = 0; for (k = 0; k < N; k++) if (Math.abs(psi[k]) < 5 * DX) { band++; dev += Math.abs(gradMag(k) - 1); }
      readout.textContent = '';
      [['Head-fire rate (this fuel, wind, flat)', (coef[P.fuel].R0 + phiW).toFixed(3) + ' m/s'],
       ['Backing rate R₀', coef[P.fuel].R0.toFixed(4) + ' m/s'],
       ['Fastest cell now', Smax.toFixed(2) + ' m/s'],
       ['Time step (CFL)', (Smax > 0 ? (0.45 * DX / Smax) : 0).toFixed(1) + ' s'],
       ['|∇ψ| − 1 near the front', band ? (dev / band).toFixed(2) : '–']].forEach(function (p) {
        var s2 = h('span'); s2.appendChild(document.createTextNode(p[0] + ': ')); s2.appendChild(h('b', { text: p[1] })); readout.appendChild(s2);
      });
    }
    function gradMag(k) {
      var i = k % NX, j = (k / NX) | 0;
      var e = psi[j * NX + Math.min(NX - 1, i + 1)], w = psi[j * NX + Math.max(0, i - 1)];
      var n = psi[Math.max(0, j - 1) * NX + i], s = psi[Math.min(NY - 1, j + 1) * NX + i];
      return Math.hypot((e - w) / (2 * DX), (n - s) / (2 * DX));
    }
    function fmtT(s) { var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ' min ' + (r < 10 ? '0' : '') + r + ' s'; }
    function sliceRow() { var g = schedule[0]; return g ? Math.max(0, Math.min(NY - 1, Math.round(NY - 1 - g.y / DX))) : (NY / 2) | 0; }

    // marching squares on a grid field, at level lv
    function contour(f, lv, sc, color, lw) {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
      for (var j = 0; j < NY - 1; j++) for (var i = 0; i < NX - 1; i++) {
        var a = f[j * NX + i] - lv, b = f[j * NX + i + 1] - lv, c = f[(j + 1) * NX + i + 1] - lv, d = f[(j + 1) * NX + i] - lv;
        if (!isFinite(a + b + c + d)) continue;
        var pts = [];
        if ((a <= 0) !== (b <= 0)) pts.push([i + a / (a - b), j]);
        if ((b <= 0) !== (c <= 0)) pts.push([i + 1, j + b / (b - c)]);
        if ((d <= 0) !== (c <= 0)) pts.push([i + d / (d - c), j + 1]);
        if ((a <= 0) !== (d <= 0)) pts.push([i, j + a / (a - d)]);
        if (pts.length >= 2) {
          ctx.moveTo((pts[0][0] + 0.5) * sc, (pts[0][1] + 0.5) * sc); ctx.lineTo((pts[1][0] + 0.5) * sc, (pts[1][1] + 0.5) * sc);
          if (pts.length === 4) { ctx.moveTo((pts[2][0] + 0.5) * sc, (pts[2][1] + 0.5) * sc); ctx.lineTo((pts[3][0] + 0.5) * sc, (pts[3][1] + 0.5) * sc); }
        }
      }
      ctx.stroke();
    }
    var tmp = new Float32Array(N);
    function isochrones(sc, dark) {
      if (t < 60) return;
      var stepT = t > 2400 ? 600 : t > 900 ? 300 : 120;
      for (var k = 0; k < N; k++) tmp[k] = tign[k] === Infinity ? 1e9 : tign[k];
      for (var lv = stepT; lv < t; lv += stepT) contour(tmp, lv, sc, dark ? 'rgba(255,220,180,.45)' : 'rgba(80,30,10,.45)', 1);
    }
    function arrows(sc) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;
      for (var j = 2; j < NY - 2; j += 6) for (var i = 2; i < NX - 2; i += 6) {
        var k = j * NX + i;
        if (Math.abs(psi[k]) > 1.5 * DX || !fuelOK[k]) continue;
        var cx = (psi[k + 1] - psi[k - 1]) / (2 * DX), cy = (psi[k - NX] - psi[k + NX]) / (2 * DX), cn = Math.hypot(cx, cy);
        if (!cn) continue;
        var L = 6 + 60 * Math.min(1, Smap[k] / 1.5), x0 = (i + 0.5) * sc, y0 = (j + 0.5) * sc;
        var x1 = x0 + cx / cn * L, y1 = y0 - cy / cn * L;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        var ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(ang - 0.5), y1 - 6 * Math.sin(ang - 0.5));
        ctx.lineTo(x1 - 6 * Math.cos(ang + 0.5), y1 - 6 * Math.sin(ang + 0.5)); ctx.closePath(); ctx.fill();
      }
    }
    function windArrow(dark) {
      if (P.wind <= 0) return;
      var w = windVec(), x = canvas.width - 70, y = canvas.height - 60, L = 18 + P.wind * 3;
      ctx.fillStyle = 'rgba(10,10,9,.6)'; ctx.beginPath(); ctx.arc(x, y, 44, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3;
      var x0 = x - w[0] * L / 2, y0 = y + w[1] * L / 2, x1 = x + w[0] * L / 2, y1 = y - w[1] * L / 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      var ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 10 * Math.cos(ang - 0.5), y1 - 10 * Math.sin(ang - 0.5));
      ctx.lineTo(x1 - 10 * Math.cos(ang + 0.5), y1 - 10 * Math.sin(ang + 0.5)); ctx.closePath(); ctx.fill();
      ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(P.wind + ' m/s', x, y + 34);
    }
    var az = 0.6;
    function draw3d(dark) {
      var W = canvas.width, H = canvas.height;
      ctx.fillStyle = dark ? '#151514' : '#f4f3ef'; ctx.fillRect(0, 0, W, H);
      var el = 0.55, k0 = W / (NX * DX) * 0.78, zs = 0.9, cx0 = NX * DX / 2, cy0 = NY * DX / 2;
      function proj(x, y, zz) {
        var X = x - cx0, Y = y - cy0;
        var rx = X * Math.cos(az) - Y * Math.sin(az), ry = X * Math.sin(az) + Y * Math.cos(az);
        return [W / 2 + rx * k0, H * 0.56 + (ry * Math.sin(el) - zz * zs * Math.cos(el)) * k0];
      }
      // zero plane
      var c1 = proj(0, 0, 0), c2 = proj(NX * DX, 0, 0), c3 = proj(NX * DX, NY * DX, 0), c4 = proj(0, NY * DX, 0);
      ctx.fillStyle = dark ? 'rgba(255,176,102,.10)' : 'rgba(180,82,12,.08)';
      ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.lineTo(c4[0], c4[1]); ctx.closePath(); ctx.fill();
      var stp = 4, clip = function (v) { return Math.max(-250, Math.min(450, v)); };
      ctx.lineWidth = 1;
      for (var pass = 0; pass < 2; pass++) for (var a = 0; a < (pass ? NX : NY); a += stp) {
        var prev = null;
        for (var b = 0; b < (pass ? NY : NX); b += 2) {
          var i = pass ? a : b, j = pass ? b : a, k = j * NX + i, v = psi[k] > BIG / 2 ? 450 : clip(psi[k]);
          var p = proj(i * DX, (NY - 1 - j) * DX, v);
          if (prev) {
            ctx.strokeStyle = v <= 0 ? (dark ? 'rgba(255,140,60,.9)' : 'rgba(200,70,20,.9)') : (dark ? 'rgba(140,170,220,.45)' : 'rgba(42,90,160,.45)');
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          }
          prev = p;
        }
      }
      // the front: psi = 0 lifted onto the plane
      ctx.fillStyle = dark ? '#fff4c2' : '#1b1b19';
      for (var jj = 0; jj < NY - 1; jj++) for (var ii = 0; ii < NX - 1; ii++) {
        var kk = jj * NX + ii;
        if ((psi[kk] <= 0) !== (psi[kk + 1] <= 0) || (psi[kk] <= 0) !== (psi[kk + NX] <= 0)) {
          var q = proj(ii * DX, (NY - 1 - jj) * DX, 0); ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2);
        }
      }
      ctx.fillStyle = dark ? '#c3c2b7' : '#52514e'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('ψ(x, y) clipped to −250…450 m. Orange: ψ ≤ 0 (burning or burned). The flat sheet is ψ = 0; the fire front is where the surface cuts it.', 14, H - 14);
    }
    function drawSlice(dark) {
      var W = slice.width, H = slice.height, j = sliceRow();
      sctx.clearRect(0, 0, W, H);
      var lo = -200, hi = 400, Y = function (v) { return 10 + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - 30); };
      sctx.strokeStyle = dark ? '#383835' : '#c3c2b7'; sctx.lineWidth = 1;
      sctx.beginPath(); sctx.moveTo(0, Y(0)); sctx.lineTo(W, Y(0)); sctx.stroke();
      sctx.fillStyle = dark ? 'rgba(230,103,103,.25)' : 'rgba(227,73,72,.18)';
      sctx.beginPath(); sctx.moveTo(0, Y(0));
      for (var i = 0; i < NX; i++) { var v = Math.min(0, psi[j * NX + i]); sctx.lineTo(i / (NX - 1) * W, Y(v)); }
      sctx.lineTo(W, Y(0)); sctx.closePath(); sctx.fill();
      sctx.strokeStyle = dark ? '#3987e5' : '#2a78d6'; sctx.lineWidth = 2; sctx.beginPath();
      for (i = 0; i < NX; i++) { v = psi[j * NX + i]; if (v > BIG / 2) v = hi; var x = i / (NX - 1) * W; i ? sctx.lineTo(x, Y(v)) : sctx.moveTo(x, Y(v)); }
      sctx.stroke();
      sctx.fillStyle = dark ? '#898781' : '#898781'; sctx.font = '11px system-ui, sans-serif';
      sctx.fillText('ψ = 0', 4, Y(0) - 4); sctx.fillText('+400 m', 4, Y(hi) + 10); sctx.fillText('−200 m', 4, Y(lo) - 2);
      sctx.fillText('0 km', 4, H - 4); sctx.textAlign = 'right'; sctx.fillText((NX * DX / 1000).toFixed(1) + ' km', W - 4, H - 4); sctx.textAlign = 'left';
    }

    // ---------- interaction
    function changed(key) {
      if (key === 'terrain') { terrain(); }
      if (key === 'barrier') { barrier(); }
      if (key === 'fuel' || key === 'wind' || key === 'terrain' || key === 'barrier') phiW = spreadBounds();
      if (key === 'fuel' || key === 'terrain' || key === 'barrier') reset();
      draw();
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (P.view === '3d') return;
      var b = canvas.getBoundingClientRect();
      var i = (e.clientX - b.left) / b.width * NX, j = (e.clientY - b.top) / b.height * NY;
      var g = { x: i * DX, y: (NY - 1 - j) * DX, r: 15, t: t };
      schedule.push(g); schedule.sort(function (a, c) { return a.t - c.t; });
      nextIgn = schedule.filter(function (s) { return s.t < t; }).length;
      applyIgnitions(t); hint.hidden = true;
      if (!playing) draw();
    });
    bPlay.addEventListener('click', function () { playing = !playing; bPlay.textContent = playing ? 'Pause' : 'Play'; last = performance.now(); });
    bStep.addEventListener('click', function () { step(30); draw(); });
    bReset.addEventListener('click', function () { if (!schedule.length) defaultSchedule(); reset(); draw(); });
    bClear.addEventListener('click', function () { schedule = []; reset(); draw(); });

    var visible = true, last = performance.now();
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);
    function loop(now) {
      var dtReal = Math.min(0.1, (now - last) / 1000); last = now;
      if (playing && visible) {
        var target = dtReal * P.speed, done = 0, n = 0;
        while (done < target && n < 40) { done += step(target - done); n++; }
        if (P.view === '3d') az += dtReal * 0.25;
        draw();
      }
      requestAnimationFrame(loop);
    }
    new MutationObserver(function () { draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ---------- go
    Object.keys(coef).forEach(function (k) { coef[k].Tf = (+k <= 3 ? 7 : +k === 4 ? 180 : +k <= 7 ? 100 : 900) / 0.85; });
    terrain(); barrier(); phiW = spreadBounds(); defaultSchedule(); reset();
    if (reduce) { for (var s = 0; s < 400 && t < 900; s++) step(30); }
    draw();
    requestAnimationFrame(loop);
  }

  function init() {
    if (window.FIRELAB_GPU) return;   // the WebGL lab (firelab.js) takes over
    var labs = document.querySelectorAll('[data-lab="levelset"]');
    if (!labs.length) return;
    var root = labs[0].getAttribute('data-root') || '';
    fetch(root + 'data/sfire-fuels.json').then(function (r) { return r.json(); }).then(function (d) {
      labs.forEach(function (el) { Lab(el, JSON.parse(JSON.stringify(d.coef))); });
    }).catch(function (e) { labs.forEach(function (el) { el.textContent = 'Could not load the fuel data for this demo (' + e + ').'; }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
