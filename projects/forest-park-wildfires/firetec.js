/*
 * FIRETEC labs (Section 15). Formulas follow LANL's open HIGRAD/FIRETEC-1.5.1 source:
 *   Vegetation/burn_veg.F90        reaction rate, computePsif (ifuel = 1 and 3), Theta, c_F
 *   Vegetation/evaporation_veg.F90 evapPDF moisture ramp
 *   Vegetation/convection_veg.F90  convective exchange coefficient
 *   Vegetation/variables_veg.F90   constants
 * <div class="ftec" data-ftec="psi"></div>   temperature-distribution curves
 * <div class="ftec" data-ftec="cell"></div>  one resolved volume of fuel bathed in hot gas (solid energy equation; radiation simplified to exchange at T_gas)
 */
(function () {
  'use strict';
  var C = { Nf: 0.4552, No: 0.5448, Tcrit: 600, Tstep: 310, Tvap: 373, hf: 8913480, hw: 2257000, cpw: 2500, cpWater: 4182,
    rhoMicro: 500, kAir: 0.0338, nu: 1.5e-5, sc: 0.1, Tamb: 300 };
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function h(tag, attrs, kids) { var e = document.createElement(tag); for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } (kids || []).forEach(function (c) { e.appendChild(c); }); return e; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function erf(x) {   // Abramowitz-Stegun 7.1.26
    var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  // computePsif, ifuel = 1 (RRL's ramp joined to two circular arcs)
  function psi1(T) {
    var rlcrit = C.Tcrit - C.Tstep, rlramp = 500 - C.Tstep, pj = 0.30;
    var j1 = pj * 2 * (rlcrit - rlramp) + rlramp, sf = Math.sqrt(rlramp * rlramp - (j1 - rlramp) * (j1 - rlramp)) / pj;
    var rpsi = 2 / sf * (rlcrit - rlramp) * j1 + sf * pj, top = 2 * rlcrit, j2 = top - j1, rpsi2 = sf - rpsi, rl = T - C.Tstep;
    if (rl <= 0) return 0;
    if (rl <= j1) return (rpsi - Math.sqrt(rpsi * rpsi - rl * rl)) / sf;
    if (rl <= j2) return 0.5 / (rlcrit - rlramp) * (rl - rlramp);
    if (rl <= top) return (rpsi2 + Math.sqrt(rpsi * rpsi - (rl - top) * (rl - top))) / sf;
    return 1;
  }
  function psi3(T) { if (T <= C.Tstep) return 0; if (T <= 2 * (C.Tcrit - C.Tstep) + C.Tstep) return 0.5 * (1 + erf(0.0079 * (T - C.Tcrit))); return 1; }
  var TAPSW = C.Tamb + (C.Tvap - C.Tamb) * (C.Tstep - C.Tamb) / (C.Tcrit - C.Tamb), TH = 2 * C.Tvap - TAPSW;
  function psiW(T) { return T <= TAPSW ? 0 : T >= TH ? 1 : (T - TAPSW) / (TH - TAPSW); }

  // ---------- small plotting helpers (one y-axis per panel)
  function setup(cv) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    return { c: c, W: W, H: H, ink: isDark() ? '#c3c2b7' : '#52514e', grid: isDark() ? '#2c2c2a' : '#e6e5df', strong: isDark() ? '#f6f4ee' : '#1d1d1b' };
  }
  function panel(g, box, xr, yr, xt, yt, xlab, ylab, title) {
    var c = g.c, X = function (x) { return box.x + (x - xr[0]) / (xr[1] - xr[0]) * box.w; }, Y = function (y) { return box.y + box.h - (y - yr[0]) / (yr[1] - yr[0]) * box.h; };
    c.font = '11px system-ui, sans-serif'; c.lineWidth = 1;
    yt.forEach(function (v) { c.strokeStyle = g.grid; c.beginPath(); c.moveTo(box.x, Y(v)); c.lineTo(box.x + box.w, Y(v)); c.stroke(); c.fillStyle = g.ink; c.textAlign = 'right'; c.fillText(String(v), box.x - 6, Y(v) + 4); });
    if (xt) xt.forEach(function (v) { c.fillStyle = g.ink; c.textAlign = 'center'; c.fillText(String(v), X(v), box.y + box.h + 15); });
    if (xlab) { c.textAlign = 'center'; c.fillText(xlab, box.x + box.w / 2, box.y + box.h + 31); }
    c.textAlign = 'left'; c.fillStyle = g.strong; c.font = '600 12px system-ui, sans-serif'; c.fillText(title, box.x, box.y - 8);
    if (ylab) { c.font = '11px system-ui, sans-serif'; c.fillStyle = g.ink; c.textAlign = 'right'; c.fillText(ylab, box.x + box.w, box.y - 8); }
    return { X: X, Y: Y };
  }
  function line(g, P, xs, ys, color, width, dash) {
    var c = g.c; c.strokeStyle = color; c.lineWidth = width || 2; c.setLineDash(dash || []); c.lineJoin = 'round'; c.beginPath();
    for (var i = 0; i < xs.length; i++) { var x = P.X(xs[i]), y = P.Y(ys[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke(); c.setLineDash([]);
  }
  function legend(host, items) {
    var L = h('div', { class: 'ftec-legend' });
    items.forEach(function (it) { var sw = h('i'); sw.style.background = it[0]; if (it[2]) sw.className = 'dash'; L.appendChild(h('span', {}, [sw, document.createTextNode(it[1])])); });
    host.appendChild(L); return L;
  }
  function rng(label, min, max, step, val, fmt, on) {
    var out = h('output', { text: fmt(val) }), r = h('input', { type: 'range', min: min, max: max, step: step, value: val });
    r.addEventListener('input', function () { out.textContent = fmt(+r.value); on(+r.value); });
    return h('label', {}, [h('span', {}, [document.createTextNode(label + ' '), out]), r]);
  }

  // ---------- lab 1: psi curves
  function PsiLab(host) {
    var T0 = 600, cv = h('canvas', { class: 'ftec-canvas', role: 'img', 'aria-label': 'Fraction of the solid reacting and fraction of water evaporated against mean solid temperature' });
    host.appendChild(cv);
    var leg = legend(host, []);
    var ro = h('div', { class: 'lab-readout', 'aria-live': 'polite' });
    host.appendChild(h('div', { class: 'lab-controls' }, [rng('Mean solid temperature', 300, 950, 5, T0, function (v) { return v + ' K'; }, function (v) { T0 = v; draw(); })]));
    host.appendChild(ro);
    function draw() {
      var g = setup(cv), s1 = css('--series-1'), s2 = css('--series-2'), s3 = css('--series-3');
      leg.innerHTML = ''; [[s2, 'ψ_s, ifuel = 1 (default)'], [s1, 'ψ_s, ifuel = 3 (erf)', true], [s3, 'ψ_w, water evaporated']].forEach(function (it) {
        var sw = h('i'); sw.style.background = it[0]; if (it[2]) sw.className = 'dash'; leg.appendChild(h('span', {}, [sw, document.createTextNode(it[1])])); });
      var box = { x: 46, y: 24, w: g.W - 62, h: g.H - 64 };
      var P = panel(g, box, [300, 950], [0, 1], [300, 373, 450, 600, 750, 890], [0, 0.25, 0.5, 0.75, 1], 'Mean solid temperature (K)', '', 'Fraction of the cell');
      var xs = [], a = [], b = [], w = [];
      for (var T = 300; T <= 950; T += 2) { xs.push(T); a.push(psi1(T)); b.push(psi3(T)); w.push(psiW(T)); }
      line(g, P, xs, w, s3, 2); line(g, P, xs, b, s1, 2, [6, 4]); line(g, P, xs, a, s2, 2.5);
      var c = g.c, x0 = P.X(T0); c.strokeStyle = g.ink; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x0, box.y); c.lineTo(x0, box.y + box.h); c.stroke(); c.setLineDash([]);
      [[psi1(T0), s2], [psi3(T0), s1], [psiW(T0), s3]].forEach(function (p) { c.fillStyle = p[1]; c.beginPath(); c.arc(x0, P.Y(p[0]), 4, 0, 6.283); c.fill(); c.strokeStyle = isDark() ? '#1d1d1b' : '#fff'; c.lineWidth = 2; c.stroke(); });
      ro.innerHTML = '<span>At <b>' + T0 + ' K</b>: ψ_s = <b>' + psi1(T0).toFixed(3) + '</b> (ifuel 1), <b>' + psi3(T0).toFixed(3) + '</b> (ifuel 3); water evaporated ψ_w = <b>' + psiW(T0).toFixed(2) +
        '</b>. The reaction rate is proportional to ψ_s, so a cell with a mean temperature of 450 K already burns at ' + (100 * psi1(450)).toFixed(0) + '% of its full rate: some of its fuel is hotter than the mean.</span>';
    }
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', draw); draw();
  }

  // ---------- lab 2: one resolved volume of fuel in hot gas
  function CellLab(host) {
    var P = { Tg: 1000, yO2: 0.232, moist: 10, s: 0.5, k: 1, U: 2, rho: 0.7 };
    var cv = h('canvas', { class: 'ftec-canvas tall', role: 'img', 'aria-label': 'Solid temperature, fuel and water remaining, and burning rate over time for one cell of fuel' });
    host.appendChild(cv);
    var leg = h('div', { class: 'ftec-legend' }); host.appendChild(leg);
    host.appendChild(h('div', { class: 'lab-controls' }, [
      rng('Gas temperature T_gas', 500, 1500, 10, P.Tg, function (v) { return v + ' K'; }, function (v) { P.Tg = v; run(); }),
      rng('Oxygen mass fraction', 0, 0.232, 0.004, P.yO2, function (v) { return (v * 100).toFixed(1) + '%'; }, function (v) { P.yO2 = v; run(); }),
      rng('Fuel moisture', 0, 120, 1, P.moist, function (v) { return v + '% of dry mass'; }, function (v) { P.moist = v; run(); }),
      rng('Fuel size scale s', 0.2, 3, 0.05, P.s, function (v) { return v.toFixed(2) + ' mm'; }, function (v) { P.s = v; run(); }),
      rng('Bulk density of fuel', 0.1, 2, 0.05, P.rho, function (v) { return v.toFixed(2) + ' kg/m³'; }, function (v) { P.rho = v; run(); }),
      rng('Wind through the fuel', 0, 10, 0.5, P.U, function (v) { return v + ' m/s'; }, function (v) { P.U = v; run(); }),
      rng('Turbulent kinetic energy k', 0.05, 5, 0.05, P.k, function (v) { return v.toFixed(2) + ' m²/s²'; }, function (v) { P.k = v; run(); })]));
    var ro = h('div', { class: 'lab-readout', 'aria-live': 'polite' }); host.appendChild(ro);
    var res = null;
    function simulate() {
      var s = P.s / 1000, rhoG = 101325 / (287.05 * P.Tg), rhoO = P.yO2 * rhoG;
      var rf0 = P.rho, rf = rf0, rw = rf0 * P.moist / 100, rw0 = rw, Ts = C.Tamb, pw = 0;
      var sp = Math.sqrt(2.2 * P.k) + P.U, Re = s * sp / C.nu, hc = 0.683 / Math.PI * Math.pow(Re, 0.466) * C.kAir / s;
      var sig = C.sc * 0.5 * Math.sqrt(0.2 * P.k);
      var dt = 2e-4, Tend = 30, every = 25, out = { t: [], T: [], f: [], w: [], r: [], dry: null, ign: null, out: null, peak: Ts };
      for (var n = 0, t = 0; t <= Tend; n++, t += dt) {
        // evaporation (evapPDF)
        var target = Math.max(pw, psiW(Ts)), fw = 0;
        if (pw < 1 && rw > 0) fw = Math.min(rw / dt, rw * (target - pw) / (1 - pw) / dt);
        pw = target;
        // burning (burnFuel)
        var ff = 0, theta = 0;
        if (rf > 1e-6 * rf0 && rhoO > 0) {
          var ps = psi1(Ts), perc = Math.max(0, (rf - 0.4 * rf0) / (rf0 * 0.6)), cf = 0.9 * perc + 0.09 * (1 - perc);
          theta = perc * 0.25 * Math.exp(-C.No / C.Nf * ps * rf / rhoO) + (1 - perc) * 0.75;
          var lam = rf * rhoO / Math.pow(rf / C.Nf + rhoO / C.No, 2);
          ff = cf * rf * rhoO * sig * ps * lam / (100 * s * s);
          ff = Math.min(ff, rf / C.Nf / dt);
        }
        // solid energy, Eq. (5) without radiation
        var av = 2 * (rf / C.rhoMicro) / s, conv = hc * av * (P.Tg - Ts);
        var rad = 0.9 * 5.670e-8 * av * (Math.pow(P.Tg, 4) - Math.pow(Ts, 4));   // simplified: exchange with surroundings at T_gas
        var eW = -C.hw * fw - C.Tvap * C.cpWater * fw, eB = theta * C.hf * ff - C.Tcrit * C.Nf * C.cpw * ff;
        var cap = C.cpw * rf + C.cpWater * rw;
        rf = Math.max(0, rf - C.Nf * ff * dt); rw = Math.max(0, rw - fw * dt);
        if (cap > 1e-3 * C.cpw * rf0) Ts = Math.min(2500, Math.max(250, Ts + (conv + rad + eW + eB) / cap * dt));
        out.peak = Math.max(out.peak, Ts);
        if (out.dry === null && (rw0 === 0 || rw < 0.01 * rw0)) out.dry = t;
        if (out.ign === null && rf < 0.9 * rf0) out.ign = t;
        if (out.out === null && rf < 0.05 * rf0) out.out = t;
        if (n % every === 0) { out.t.push(t); out.T.push(Ts); out.f.push(100 * rf / rf0); out.w.push(rw0 > 0 ? 100 * rw / rw0 : 0); out.r.push(C.Nf * ff); }
        if (out.out !== null && t > out.out * 1.15 + 0.5) break;
      }
      out.h = hc; return out;
    }
    function draw() {
      if (!res) return;
      var g = setup(cv), s1 = css('--series-1'), s2 = css('--series-2'), s3 = css('--series-3');
      leg.innerHTML = '';
      [[s2, 'Solid temperature'], [g.ink, 'Gas temperature (held fixed)', true], [s3, 'Dry fuel left'], [s1, 'Water left'], [g.strong, 'Fuel burning rate N·F']].forEach(function (it) {
        var sw = h('i'); sw.style.background = it[0]; if (it[2]) sw.className = 'dash'; leg.appendChild(h('span', {}, [sw, document.createTextNode(it[1])])); });
      var tEnd = res.t[res.t.length - 1], tt = nice(tEnd), pw = g.W - 62, ph = (g.H - 40 - 3 * 34) / 3;
      var xt = []; for (var v = 0; v <= tEnd + 1e-9; v += tt) xt.push(+v.toFixed(2));
      var Tmax = Math.max(P.Tg, res.peak) * 1.05, Tt = []; for (v = 300; v <= Tmax; v += Tmax > 1600 ? 400 : 200) Tt.push(v);
      var b1 = { x: 50, y: 22, w: pw, h: ph }, b2 = { x: 50, y: 22 + ph + 34, w: pw, h: ph }, b3 = { x: 50, y: 22 + 2 * (ph + 34), w: pw, h: ph };
      var P1 = panel(g, b1, [0, tEnd], [250, Tmax], null, Tt, '', 'K', 'Solid temperature T_s');
      line(g, P1, [0, tEnd], [P.Tg, P.Tg], g.ink, 1.2, [5, 4]);
      line(g, P1, [0, tEnd], [600, 600], g.grid, 1, [2, 3]);
      line(g, P1, res.t, res.T, s2, 2.2);
      var P2 = panel(g, b2, [0, tEnd], [0, 100], null, [0, 50, 100], '', '% of initial', 'Fuel and water left');
      line(g, P2, res.t, res.w, s1, 2); line(g, P2, res.t, res.f, s3, 2.2);
      var rmax = Math.max.apply(null, res.r) || 1, rt = [0, +(rmax / 2).toPrecision(2), +rmax.toPrecision(2)];
      var P3 = panel(g, b3, [0, tEnd], [0, rmax * 1.1], xt, rt, 'Time (s)', 'kg m⁻³ s⁻¹', 'Fuel consumption rate N_wood F_wood');
      line(g, P3, res.t, res.r, g.strong, 2);
      function f(x) { return x === null ? '–' : x.toFixed(1) + ' s'; }
      ro.innerHTML = '<span>h = <b>' + res.h.toFixed(0) + ' W m⁻² K⁻¹</b> · dry after <b>' + f(res.dry) + '</b> · 10% burned at <b>' + f(res.ign) + '</b> · 95% burned at <b>' + f(res.out) +
        '</b> · peak T_s <b>' + res.peak.toFixed(0) + ' K</b>' + (res.ign === null ? ' · <b>does not burn</b> within 30 s: too cold, too wet or no oxygen' : '') + '</span>';
    }
    function nice(x) { var r = x / 6, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
    var pending = false;
    function run() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; res = simulate(); draw(); }); }
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', draw); run();
  }

  function init() {
    document.querySelectorAll('[data-ftec]').forEach(function (el) { if (el.dataset.ftec === 'psi') PsiLab(el); else if (el.dataset.ftec === 'cell') CellLab(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
