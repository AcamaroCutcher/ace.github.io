/*
 * Spread-rate rose: SFIRE's directional spread rate S(n) (fire_ros_cawfe) in every direction n,
 * and the fire shape it produces after a time t from a point ignition in uniform conditions.
 * For a direction-dependent normal speed the burned region is the Wulff shape
 *   K(t) = { x : x . n <= S(n) t  for every unit vector n },
 * computed here by testing a grid of points against 180 half-planes.
 * <div class="rose" data-rose data-root="../"></div>
 */
(function () {
  'use strict';
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function h(tag, attrs, kids) { var e = document.createElement(tag); for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } (kids || []).forEach(function (c) { e.appendChild(c); }); return e; }
  var NAMES = { 1: 'Short grass', 2: 'Timber (grass & understory)', 8: 'Closed timber litter', 9: 'Hardwood litter', 10: 'Timber (litter & understory)' };

  function Rose(host, meta) {
    var P = { fuel: 10, wind: 4, slope: 20, adv: 1, wrf: false, tmin: 30 };
    var cv = h('canvas', { class: 'rose-canvas', 'aria-label': 'Spread rate in every direction and the resulting fire shape' });
    host.appendChild(cv);
    function sel(label, opts, val, on) { var s = h('select'); opts.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); s.addEventListener('change', function () { on(s.value); draw(); }); return h('label', {}, [document.createTextNode(label), s]); }
    function rng(label, min, max, step, val, fmt, on) { var out = h('output', { text: fmt(val) }), r = h('input', { type: 'range', min: min, max: max, step: step, value: val }); r.addEventListener('input', function () { out.textContent = fmt(+r.value); on(+r.value); draw(); }); return h('label', {}, [h('span', {}, [document.createTextNode(label + ' '), out]), r]); }
    host.appendChild(h('div', { class: 'lab-controls' }, [
      sel('Fuel model', Object.keys(NAMES).map(function (k) { return [k, k + ' · ' + NAMES[k]]; }), P.fuel, function (v) { P.fuel = +v; }),
      rng('Wind at 6.1 m (from the east)', 0, 12, 0.5, P.wind, function (v) { return v + ' m/s'; }, function (v) { P.wind = v; }),
      rng('Slope (rising to the north)', 0, 40, 1, P.slope, function (v) { return v + '°'; }, function (v) { P.slope = v; }),
      sel('fire_advection', [[1, '1 · speed projected on n (default)'], [0, '0 · components along n']], 1, function (v) { P.adv = +v; }),
      rng('Time since ignition', 5, 120, 5, P.tmin, function (v) { return v + ' min'; }, function (v) { P.tmin = v; })]));
    var note = h('p', { class: 'lead-note' }); host.appendChild(note);

    function S(theta) {   // theta = direction of n, clockwise from north
      var c = meta.coef.east[P.fuel - 1], R0 = c[0];
      var n = [Math.sin(theta), Math.cos(theta)], U = [-P.wind, 0];        // east wind blows toward the west
      var gz = [0, Math.tan(P.slope * Math.PI / 180)];                     // upslope to the north
      var speed, tanphi, cw = 1, cs = 1;
      if (P.adv === 1) { speed = Math.hypot(U[0], U[1]) + 1e-9; tanphi = Math.hypot(gz[0], gz[1]) + 1e-9; cw = Math.max(0, (U[0] * n[0] + U[1] * n[1]) / speed); cs = Math.max(0, (gz[0] * n[0] + gz[1] * n[1]) / tanphi); }
      else { speed = U[0] * n[0] + U[1] * n[1]; tanphi = gz[0] * n[0] + gz[1] * n[1]; }
      var u = Math.min(Math.max(speed, 0), 30) * 196.85, rw = c[1] * Math.pow(Math.max(u, 1e-6), c[2]) * cw, tp = Math.min(Math.max(tanphi, 0), 5), rs = c[3] * tp * tp * cs;
      var ex = R0 + rw + rs - 6; if (ex > 0) { var tot = rw + rs; rw -= ex * rw / tot; rs -= ex * rs / tot; }
      return Math.max(R0 + rw + rs, 0);
    }
    function draw() {
      var dpr = Math.min(2, window.devicePixelRatio || 1), Wc = cv.clientWidth, Hc = cv.clientHeight;
      cv.width = Wc * dpr; cv.height = Hc * dpr; var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var dark = isDark(), ink = dark ? '#c3c2b7' : '#52514e', grid = dark ? '#2c2c2a' : '#e1e0d9';
      var cs = getComputedStyle(document.documentElement), s1 = cs.getPropertyValue('--series-1').trim(), s2 = cs.getPropertyValue('--series-2').trim();
      c.clearRect(0, 0, Wc, Hc);
      var half = Wc / 2, R = Math.min(half, Hc) * 0.40;
      var N = 180, vals = [], smax = 0;
      for (var k = 0; k < N; k++) { var v = S(k / N * 2 * Math.PI); vals.push(v); smax = Math.max(smax, v); }
      // left: polar rose of S(theta)
      var cx = half / 2, cy = Hc / 2 + 6;
      c.strokeStyle = grid; c.lineWidth = 1;
      [0.25, 0.5, 0.75, 1].forEach(function (f) { c.beginPath(); c.arc(cx, cy, R * f, 0, 6.283); c.stroke(); });
      c.fillStyle = ink; c.font = '11px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText('N (upslope)', cx, cy - R - 8); c.fillText('W (downwind)', cx - R - 4, cy + R + 18);
      c.textAlign = 'left'; c.fillText(smax.toFixed(2) + ' m/s', cx + 4, cy - R + 12);
      c.beginPath();
      vals.forEach(function (v, k2) { var th = k2 / N * 2 * Math.PI, rr = v / smax * R, x = cx + Math.sin(th) * rr, y = cy - Math.cos(th) * rr; k2 ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.closePath(); c.fillStyle = s1 + '22'; c.fill(); c.strokeStyle = s1; c.lineWidth = 2; c.stroke();
      c.font = '600 12px system-ui, sans-serif'; c.fillStyle = ink; c.textAlign = 'center'; c.fillText('Spread rate S(n) in each direction', cx, 16);
      // right: Wulff shape after t
      var t = P.tmin * 60, ext = smax * t, cx2 = half + half / 2, sc = R / Math.max(ext, 1);
      var G = 140, img = c.createImageData(G, G), col = s2.match(/\w\w/g) ? [parseInt(s2.slice(1, 3), 16), parseInt(s2.slice(3, 5), 16), parseInt(s2.slice(5, 7), 16)] : [235, 104, 52];
      var area = 0, cell = (2 * ext / G);
      for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
        var x2 = -ext + (i + 0.5) * cell, y2 = ext - (j + 0.5) * cell, inside = true;
        for (var k3 = 0; k3 < N && inside; k3 += 2) { var th2 = k3 / N * 2 * Math.PI; if (x2 * Math.sin(th2) + y2 * Math.cos(th2) > vals[k3] * t) inside = false; }
        var o = 4 * (j * G + i); if (inside) { img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 210; area++; }
      }
      var tmp = document.createElement('canvas'); tmp.width = G; tmp.height = G; tmp.getContext('2d').putImageData(img, 0, 0);
      c.imageSmoothingEnabled = true; c.drawImage(tmp, cx2 - R, cy - R, 2 * R, 2 * R);
      c.strokeStyle = grid; c.strokeRect(cx2 - R, cy - R, 2 * R, 2 * R);
      c.fillStyle = dark ? '#fff' : '#111'; c.beginPath(); c.arc(cx2, cy, 3, 0, 6.283); c.fill();
      c.fillStyle = ink; c.font = '600 12px system-ui, sans-serif'; c.fillText('Fire shape after ' + P.tmin + ' min', cx2, 16);
      c.font = '11px system-ui, sans-serif'; c.fillText('box = ' + (2 * ext).toFixed(0) + ' m across', cx2, cy + R + 18);
      var ha = area * cell * cell / 1e4;
      // length-to-breadth of the burned region
      var xs = [], ys = [];
      for (j = 0; j < G; j++) for (i = 0; i < G; i++) if (img.data[4 * (j * G + i) + 3]) { xs.push(i); ys.push(j); }
      var lb = xs.length ? (Math.max.apply(null, xs) - Math.min.apply(null, xs) + 1) / (Math.max.apply(null, ys) - Math.min.apply(null, ys) + 1) : 1;
      note.textContent = 'Head-fire rate ' + smax.toFixed(2) + ' m/s; burned area after ' + P.tmin + ' min ' + ha.toFixed(2) + ' ha; east–west extent ÷ north–south extent ' + lb.toFixed(1) + '. ' +
        (P.adv === 1 ? 'With the default projection, flanks only creep at R₀, so wind-driven fires are long and narrow.' : 'With wind components along n, the cross-wind flanks also get no wind term, and the shape is even narrower at high wind.');
    }
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', draw);
    draw();
  }
  function init() {
    var hosts = document.querySelectorAll('[data-rose]'); if (!hosts.length) return;
    fetch((hosts[0].getAttribute('data-root') || '../') + 'data/fp3d.json').then(function (r) { return r.json(); }).then(function (m) { hosts.forEach(function (el) { Rose(el, m); }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
