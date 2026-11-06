/*
 * Perimeter ignition lab: build a fire-arrival-time field T(x) from an ignition point and an
 * observed perimeter, then "replay" it the way WRF-SFIRE does with fire_perimeter_time:
 * during spin-up the level-set function is prescribed as  lfn = tign - t  (module_fr_sfire_model,
 * "replay"), so the burning region grows to the perimeter on schedule and its heat warms the
 * atmosphere gradually instead of all at once.
 *
 * Interpolation used here (one simple, common choice; see the page for the papers):
 *   T(x) = t_ig + (t_p - t_ig) * r(x) / R(x)
 *   r = distance from the ignition point, R = distance from the ignition to the first perimeter
 *   crossing along the ray through x (so isochrones are scaled copies of the perimeter)
 * Outside the perimeter T is extended as t_p + d / S_ext so that lfn stays distance-like.
 *
 * <div class="lab" data-lab="perimeter"></div>
 */
(function () {
  'use strict';
  var NX = 180, NY = 120, DX = 10, N = NX * NY;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FUELS = {   // fgi kg/m2, weight (T_f = weight / 0.85 s) from SFIRE's namelist.fire
    '1': { name: 'Short grass', fgi: 0.166, w: 7 },
    '10': { name: 'Timber (litter & understory)', fgi: 2.694, w: 900 }
  };
  var HEAT = 17.433e6, BMST = 0.08 / 1.08;

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  function Lab(host) {
    var TP = 3600, SEXT = 0.3;
    var POLY0 = [[1560, 600], [1480, 760], [1280, 860], [1000, 900], [760, 860], [560, 760], [470, 620],
                [520, 470], [700, 360], [960, 300], [1220, 330], [1440, 440]];
    var poly = POLY0.map(function (p) { return p.slice(); }), ign = [1450, 610];
    var P = { view: 'replay', fuel: '10', t: reduce ? TP : 0 };
    var T = new Float32Array(N), inside = new Uint8Array(N), dB = new Float32Array(N);
    var playing = !reduce, drag = null, curve = null;

    var canvas = h('canvas', { width: 900, height: 600, 'aria-label': 'Perimeter replay. Drag the ignition point or the perimeter vertices.' });
    var badge = h('div', { class: 'lab-badge' }), hint = h('div', { class: 'lab-hint', text: 'Drag the star or the white dots' });
    host.appendChild(h('div', { class: 'lab-stage' }, [canvas, badge, hint]));
    var ctx = canvas.getContext('2d');
    var off = document.createElement('canvas'); off.width = NX; off.height = NY;
    var octx = off.getContext('2d'), img = octx.createImageData(NX, NY);

    var tOut = h('output'), tRange = h('input', { type: 'range', min: 0, max: TP + 1800, step: 10, value: P.t });
    tRange.addEventListener('input', function () { P.t = +tRange.value; playing = false; bPlay.textContent = 'Play'; draw(); });
    var vSel = h('select');
    [['replay', 'Replay: burning region T ≤ t'], ['psi', 'Level-set function lfn = T − t'], ['T', 'Arrival time T with isochrones']].forEach(function (o) {
      vSel.appendChild(h('option', { value: o[0], text: o[1] }));
    });
    vSel.addEventListener('change', function () { P.view = vSel.value; draw(); });
    var fSel = h('select');
    Object.keys(FUELS).forEach(function (k) { var op = h('option', { value: k, text: k + ' · ' + FUELS[k].name }); if (k === P.fuel) op.selected = true; fSel.appendChild(op); });
    fSel.addEventListener('change', function () { P.fuel = fSel.value; curve = null; draw(); });
    host.appendChild(h('div', { class: 'lab-controls' }, [
      h('label', {}, [h('span', {}, [document.createTextNode('Time since ignition '), tOut]), tRange]),
      h('label', {}, [document.createTextNode('View'), vSel]),
      h('label', {}, [document.createTextNode('Fuel (sets burn time and load)'), fSel])
    ]));
    var bPlay = h('button', { type: 'button', class: 'primary', text: playing ? 'Pause' : 'Play' });
    var bReset = h('button', { type: 'button', text: 'Reset shape' });
    host.appendChild(h('div', { class: 'lab-buttons' }, [bPlay, bReset]));
    var chart = h('canvas', { width: 900, height: 200, 'aria-label': 'Sensible heat released into the atmosphere over time' });
    var legend = h('div', { class: 'viz-legend' });
    [['var(--series-1)', 'Replay (fire_perimeter_time): heat ramps up as the fire "grows" to the perimeter'],
     ['var(--series-2)', 'No spin-up: the whole perimeter ignites at t_p']].forEach(function (l) {
      var i = h('i'); i.style.background = l[0]; legend.appendChild(h('span', {}, [i, document.createTextNode(l[1])]));
    });
    var note = h('p', { text: 'Total sensible heat flux into the atmosphere, in MW, from the fuel-burnout model (fuel left = exp(−(t − T)/T_f)). The dashed line is t_p, the perimeter time.' });
    host.appendChild(h('div', { class: 'lab-slice' }, [legend, chart, note]));
    var cctx = chart.getContext('2d');

    function segDist(px, py, a, b) {
      var vx = b[0] - a[0], vy = b[1] - a[1], wx = px - a[0], wy = py - a[1];
      var t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
      return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy);
    }
    function pip(x, y) {
      var c = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var a = poly[i], b = poly[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    }
    function compute() {
      for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
        var k = j * NX + i, x = (i + 0.5) * DX, y = (NY - j - 0.5) * DX, d = Infinity;
        for (var s = 0; s < poly.length; s++) d = Math.min(d, segDist(x, y, poly[s], poly[(s + 1) % poly.length]));
        dB[k] = d; inside[k] = pip(x, y) ? 1 : 0;
      }
      // fraction of the way along the ray from the ignition: r / R, where R is the distance from the
      // ignition to the first perimeter crossing beyond the cell (works for non-convex shapes too)
      for (k = 0; k < N; k++) {
        var cx = (k % NX + 0.5) * DX, cy = (NY - ((k / NX) | 0) - 0.5) * DX;
        if (!inside[k]) { T[k] = TP + dB[k] / SEXT; continue; }
        var ux = cx - ign[0], uy = cy - ign[1], r = Math.hypot(ux, uy);
        if (r < 1e-6) { T[k] = 0; continue; }
        ux /= r; uy /= r;
        var R = Infinity;
        for (var e = 0; e < poly.length; e++) {
          var A = poly[e], Bp = poly[(e + 1) % poly.length], ex = Bp[0] - A[0], ey = Bp[1] - A[1];
          var wx = A[0] - ign[0], wy = A[1] - ign[1], den = ux * ey - uy * ex;
          if (Math.abs(den) < 1e-12) continue;
          var tt = (wx * ey - wy * ex) / den, ss = (wx * uy - wy * ux) / den;
          if (ss >= 0 && ss <= 1 && tt >= r - 1e-6 && tt < R) R = tt;
        }
        T[k] = isFinite(R) ? TP * Math.min(1, r / R) : TP;
      }
      curve = null;
    }
    function heatCurves() {
      var f = FUELS[P.fuel], Tf = f.w / 0.85, peak = f.fgi * (1 - BMST) * HEAT / Tf * DX * DX / 1e6; // MW per cell at ignition
      var ts = [], a = [], b = [];
      for (var t = 0; t <= TP + 1800; t += 20) {
        var qa = 0, qb = 0;
        for (var k = 0; k < N; k++) {
          if (!inside[k]) continue;
          if (t >= T[k]) qa += Math.exp(-(t - T[k]) / Tf);
          if (t >= TP) qb += Math.exp(-(t - TP) / Tf);
        }
        ts.push(t); a.push(qa * peak); b.push(qb * peak);
      }
      return { t: ts, a: a, b: b };
    }

    function draw() {
      var dark = isDark(), d = img.data, t = P.t, f = FUELS[P.fuel], Tf = f.w / 0.85;
      tOut.textContent = (t / 60).toFixed(0) + ' min' + (t >= TP ? ' (after t_p: normal spread)' : '');
      tRange.value = t;
      for (var k = 0; k < N; k++) {
        var o = k * 4, r, gg, b;
        var base = dark ? [44, 52, 40] : [214, 222, 200];
        if (P.view === 'psi') {
          var v = Math.max(-1, Math.min(1, (T[k] - t) / 1800));
          var mid = dark ? [56, 56, 53] : [240, 239, 236], neg = dark ? [230, 103, 103] : [227, 73, 72], pos = dark ? [57, 135, 229] : [42, 120, 214];
          var tg = v < 0 ? neg : pos, a2 = Math.abs(v);
          r = mid[0] + (tg[0] - mid[0]) * a2; gg = mid[1] + (tg[1] - mid[1]) * a2; b = mid[2] + (tg[2] - mid[2]) * a2;
        } else if (P.view === 'T') {
          if (!inside[k]) { r = base[0]; gg = base[1]; b = base[2]; }
          else { var q = Math.min(1, T[k] / TP), lo = [252, 206, 170], hi = [140, 45, 10]; r = lo[0] + (hi[0] - lo[0]) * q; gg = lo[1] + (hi[1] - lo[1]) * q; b = lo[2] + (hi[2] - lo[2]) * q; }
        } else {
          r = base[0]; gg = base[1]; b = base[2];
          if (inside[k] && T[k] <= t) {   // outside the perimeter the real model takes over after t_p
            var left = Math.exp(-(t - T[k]) / Tf);   // fuel fraction remaining
            r = 255 * left + (dark ? 50 : 90) * (1 - left); gg = 170 * left + 25 * (1 - left); b = 40 * left + 18 * (1 - left);
          }
        }
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      var W = canvas.width, H = canvas.height, sc = W / (NX * DX);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
      // isochrones of T every 10 min inside the perimeter
      if (P.view !== 'psi') {
        ctx.strokeStyle = dark ? 'rgba(255,230,200,.5)' : 'rgba(90,35,10,.5)'; ctx.lineWidth = 1;
        for (var lv = 600; lv < TP; lv += 600) iso(lv, W / NX);
      }
      // current front (lfn = 0)
      if (t > 0) { ctx.strokeStyle = dark ? '#fff4c2' : '#1b1b19'; ctx.lineWidth = 2.4; iso(t, W / NX); }
      // perimeter and handles
      ctx.strokeStyle = dark ? '#ffffff' : '#0b0b0b'; ctx.setLineDash([8, 5]); ctx.lineWidth = 2;
      ctx.beginPath(); poly.forEach(function (p, i) { var x = p[0] * sc, y = H - p[1] * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      poly.forEach(function (p) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0] * sc, H - p[1] * sc, 7, 0, 6.283); ctx.fill(); ctx.stroke(); });
      star(ign[0] * sc, H - ign[1] * sc);
      if (!inside[(NY - 1 - Math.floor(ign[1] / DX)) * NX + Math.floor(ign[0] / DX)]) { badge.textContent = 'Move the ignition point inside the perimeter'; drawChart(dark); return; }
      badge.textContent = 't = ' + (t / 60).toFixed(0) + ' min · perimeter time t_p = ' + (TP / 60) + ' min' + (t < TP ? ' · replay (spin-up)' : ' · model spreading');
      drawChart(dark);
    }
    function iso(lv, sc) {
      ctx.beginPath();
      for (var j = 0; j < NY - 1; j++) for (var i = 0; i < NX - 1; i++) {
        var a = T[j * NX + i] - lv, b = T[j * NX + i + 1] - lv, c = T[(j + 1) * NX + i + 1] - lv, d = T[(j + 1) * NX + i] - lv, p = [];
        if ((a <= 0) !== (b <= 0)) p.push([i + a / (a - b), j]);
        if ((b <= 0) !== (c <= 0)) p.push([i + 1, j + b / (b - c)]);
        if ((d <= 0) !== (c <= 0)) p.push([i + d / (d - c), j + 1]);
        if ((a <= 0) !== (d <= 0)) p.push([i, j + a / (a - d)]);
        if (p.length >= 2) { ctx.moveTo((p[0][0] + .5) * sc, (p[0][1] + .5) * sc); ctx.lineTo((p[1][0] + .5) * sc, (p[1][1] + .5) * sc); }
      }
      ctx.stroke();
    }
    function star(x, y) {
      ctx.fillStyle = '#ffb066'; ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i < 10; i++) { var r = i % 2 ? 6 : 14, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    function drawChart(dark) {
      if (!curve) curve = heatCurves();
      var W = chart.width, H = chart.height, m = { l: 56, r: 12, t: 10, b: 28 };
      cctx.clearRect(0, 0, W, H);
      var ymax = 0; curve.a.concat(curve.b).forEach(function (v) { if (v > ymax) ymax = v; });
      ymax = ymax || 1;
      var mag = Math.pow(10, Math.floor(Math.log10(ymax / 4))), stepY = Math.ceil(ymax / 4 / mag) * mag; ymax = stepY * 4;
      var tmax = curve.t[curve.t.length - 1];
      var X = function (t) { return m.l + t / tmax * (W - m.l - m.r); }, Y = function (v) { return H - m.b - v / ymax * (H - m.t - m.b); };
      var ink = dark ? '#898781' : '#898781', grid = dark ? '#2c2c2a' : '#e1e0d9';
      cctx.font = '11px system-ui, sans-serif'; cctx.fillStyle = ink; cctx.strokeStyle = grid; cctx.lineWidth = 1;
      for (var q = 0; q <= 4; q++) {
        var v = ymax * q / 4; cctx.beginPath(); cctx.moveTo(m.l, Y(v)); cctx.lineTo(W - m.r, Y(v)); cctx.stroke();
        cctx.textAlign = 'right'; cctx.fillText(v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 1 : 0 }), m.l - 6, Y(v) + 4);
      }
      cctx.textAlign = 'center';
      for (var tt = 0; tt <= tmax; tt += 900) cctx.fillText((tt / 60) + ' min', X(tt), H - 8);
      cctx.save(); cctx.translate(12, (m.t + H - m.b) / 2); cctx.rotate(-Math.PI / 2); cctx.fillText('MW', 0, 0); cctx.restore();
      cctx.setLineDash([4, 4]); cctx.strokeStyle = dark ? '#c3c2b7' : '#52514e'; cctx.beginPath(); cctx.moveTo(X(TP), m.t); cctx.lineTo(X(TP), H - m.b); cctx.stroke(); cctx.setLineDash([]);
      var cs = getComputedStyle(document.documentElement);
      [[curve.a, cs.getPropertyValue('--series-1').trim() || '#2a78d6'], [curve.b, cs.getPropertyValue('--series-2').trim() || '#eb6834']].forEach(function (s) {
        cctx.strokeStyle = s[1]; cctx.lineWidth = 2; cctx.beginPath();
        s[0].forEach(function (v, i) { var x = X(curve.t[i]), y = Y(v); i ? cctx.lineTo(x, y) : cctx.moveTo(x, y); }); cctx.stroke();
      });
      cctx.fillStyle = dark ? '#f0efec' : '#0b0b0b'; cctx.beginPath(); cctx.arc(X(P.t), Y(sample(curve.a, P.t)), 4, 0, 6.283); cctx.fill();
    }
    function sample(arr, t) { return arr[Math.max(0, Math.min(arr.length - 1, Math.round(t / 20)))]; }

    function pt(e) {
      var b = canvas.getBoundingClientRect();
      return [(e.clientX - b.left) / b.width * NX * DX, (1 - (e.clientY - b.top) / b.height) * NY * DX];
    }
    canvas.addEventListener('pointerdown', function (e) {
      var p = pt(e), best = null, bd = 40;
      if (Math.hypot(p[0] - ign[0], p[1] - ign[1]) < bd) best = 'ign';
      poly.forEach(function (q, i) { var dd = Math.hypot(p[0] - q[0], p[1] - q[1]); if (dd < bd) { bd = dd; best = i; } });
      if (best !== null) { drag = best; canvas.setPointerCapture(e.pointerId); hint.hidden = true; }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (drag === null) return;
      var p = pt(e); p[0] = Math.max(0, Math.min(NX * DX, p[0])); p[1] = Math.max(0, Math.min(NY * DX, p[1]));
      if (drag === 'ign') ign = p; else poly[drag] = p;
      draw();   // show the shape while dragging; recompute T on release
    });
    canvas.addEventListener('pointerup', function () { if (drag !== null) { drag = null; compute(); draw(); } });
    bPlay.addEventListener('click', function () { playing = !playing; bPlay.textContent = playing ? 'Pause' : 'Play'; if (P.t >= TP + 1800) P.t = 0; last = performance.now(); });
    bReset.addEventListener('click', function () { poly = POLY0.map(function (p) { return p.slice(); }); ign = [1450, 610]; compute(); draw(); });
    var last = performance.now(), visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);
    function loop(now) {
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (playing && visible) { P.t += dt * 240; if (P.t > TP + 1800) P.t = 0; draw(); }
      requestAnimationFrame(loop);
    }
    new MutationObserver(function () { draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    compute(); draw(); requestAnimationFrame(loop);
  }

  function init() { document.querySelectorAll('[data-lab="perimeter"]').forEach(function (el) { Lab(el); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
