/*
 * Project 7: "Inside the subduction zone". A small orthographic 3D renderer on <canvas> (no WebGL, no 3D library)
 * showing the Slab2 plate surface and ComCat earthquakes, each classified by its position relative to the plate.
 */
(function () {
  'use strict';

  var U = window.VizUtils, G = window.PNW_MAP, C = window.PNW_CATALOG, S = window.CASCADIA_SLAB, $ = U.$, el = U.el;
  var DAY_MS = 86400000;

  // ---------------------------------------------------------------- geometry
  var LON0 = -124.3, LAT0 = 45, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 111.32;
  var BOX = { lon: [-129.5, -119], lat: [39.8, 50.0] };
  var MAXD = 120;   // km shown
  function kmX(lon) { return (lon - LON0) * KX; }
  function kmY(lat) { return (lat - LAT0) * KY; }

  function slabAt(lon, lat) {
    var fx = (lon - S.lon0) / S.step, fy = (lat - S.lat0) / S.step, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= S.nx - 1 || j >= S.ny - 1) return null;
    var a = S.depth[j * S.nx + i], b = S.depth[j * S.nx + i + 1], c = S.depth[(j + 1) * S.nx + i], d = S.depth[(j + 1) * S.nx + i + 1];
    if (a === null || b === null || c === null || d === null) return null;
    var tx = fx - i, ty = fy - j;
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  // ---------------------------------------------------------------- classes
  var CLASSES = {
    crustal:   { label: 'In the crust above', color: '--crustal' },
    intraslab: { label: 'Inside the sinking plate', color: '--deep' },
    interface: { label: 'Near the plate boundary', color: '--megathrust' },
    offshore:  { label: 'Offshore plates & faults', color: '--context' },
  };
  function classify(lon, lat, depth) {
    var s = slabAt(lon, lat);
    if (s === null) return { cls: 'offshore', slab: null };
    // Inside the plate where it is still shallow (near the trench, e.g. the Gorda Plate off California) counts as
    // offshore-plate deformation, not as the deep intraslab quakes the report describes (40–60 km down).
    if (depth >= s - 5) return { cls: s >= 20 ? 'intraslab' : 'offshore', slab: s };
    if (depth >= s - 12 && s < 35) return { cls: 'interface', slab: s };
    return { cls: 'crustal', slab: s };
  }
  function toQuake(r, small) {
    var c = classify(r[2], r[3], r[4]);
    return { id: r[0], date: new Date(r[1] * DAY_MS), lon: r[2], lat: r[3], depth: Math.max(0, r[4]), mag: r[5], place: r[6] || '',
      cls: c.cls, slab: c.slab, small: small, x: kmX(r[2]), y: kmY(r[3]) };
  }
  var MAIN = C.main.map(function (r) { return toQuake(r, false); }).filter(function (q) { return q.depth <= MAXD; });
  // Puget M2.5+ set duplicates M4+ quakes already in MAIN; keep only the smaller ones.
  var mainIds = {}; MAIN.forEach(function (q) { mainIds[q.id] = true; });
  var SMALL = C.puget.filter(function (r) { return !mainIds[r[0]] && r[5] < 4; }).map(function (r) { return toQuake(r, true); });

  // ---------------------------------------------------------------- slab cells + contours (built once)
  function inPolygon(pt, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  var CELLS = [];
  (function buildCells() {
    var step = 2;   // 0.2° cells
    for (var j = 0; j + step < S.ny; j += step) {
      for (var i = 0; i + step < S.nx; i += step) {
        var ds = [[i, j], [i + step, j], [i + step, j + step], [i, j + step]].map(function (p) { return S.depth[p[1] * S.nx + p[0]]; });
        if (ds.some(function (d) { return d === null || d > MAXD; })) continue;
        var lons = [i, i + step, i + step, i].map(function (k) { return S.lon0 + k * S.step; });
        var lats = [j, j, j + step, j + step].map(function (k) { return S.lat0 + k * S.step; });
        if (lons[0] < BOX.lon[0] || lons[1] > BOX.lon[1] || lats[0] < BOX.lat[0] || lats[2] > BOX.lat[1]) continue;
        var cl = (lons[0] + lons[1]) / 2, ct = (lats[0] + lats[2]) / 2, md = d3.mean(ds);
        CELLS.push({ pts: lons.map(function (lo, k) { return [kmX(lo), kmY(lats[k]), ds[k]]; }), depth: md, lat: ct,
          rupture: inPolygon([cl, ct], G.regions.megathrust.zone) });
      }
    }
  })();
  var CONTOURS = (function () {
    var vals = S.depth.map(function (d) { return d === null ? NaN : d; });
    return d3.contours().size([S.nx, S.ny]).thresholds([20, 40, 60, 80, 100])(vals).map(function (c) {
      var lines = [];
      c.coordinates.forEach(function (poly) {
        poly.forEach(function (ring) {
          // d3.contours also traces the edges of the "no data" area; keep only points where the plate really is at this
          // depth, and break the line elsewhere, so only true depth contours are drawn.
          var run = [];
          ring.forEach(function (p) {
            var lon = S.lon0 + (p[0] - 0.5) * S.step, lat = S.lat0 + (p[1] - 0.5) * S.step, s = slabAt(lon, lat);
            if (s !== null && Math.abs(s - c.value) < 3) run.push([kmX(lon), kmY(lat), c.value]);
            else { if (run.length > 1) lines.push(run); run = []; }
          });
          if (run.length > 1) lines.push(run);
        });
      });
      return { depth: c.value, lines: lines };
    });
  })();
  function inBox(lon, lat) { return lon >= BOX.lon[0] && lon <= BOX.lon[1] && lat >= BOX.lat[0] && lat <= BOX.lat[1]; }
  var COAST = [].concat.apply([], G.land.map(function (g) {
    return g.type === 'Polygon' ? g.coordinates : [].concat.apply([], g.coordinates);
  })).concat([].concat.apply([], G.borders.map(function (g) { return g.type === 'LineString' ? [g.coordinates] : g.coordinates; })))
    .map(function (ring) {
      // Split rings into in-box runs so lines don't jump across the clipped edges
      var runs = [], cur = [];
      ring.forEach(function (p) {
        if (inBox(p[0], p[1])) cur.push([kmX(p[0]), kmY(p[1]), 0]);
        else if (cur.length) { runs.push(cur); cur = []; }
      });
      if (cur.length) runs.push(cur);
      return runs;
    }).reduce(function (a, b) { return a.concat(b); }, []).filter(function (r) { return r.length > 1; });
  var CITIES = G.cities.filter(function (c) { return c.rank <= 1 || c.name === 'Eureka'; });

  // ---------------------------------------------------------------- state + camera
  var PRESETS = { oblique: { yaw: -28, pitch: 32 }, south: { yaw: 0, pitch: 4 }, top: { yaw: 0, pitch: 90 } };
  var BANDS = { all: null, puget: [46.8, 48.4], oregon: [43.4, 46.2], ncal: [40.0, 42.6] };
  var state = { yaw: -28, pitch: 32, zoom: 1, ve: 4, band: 'all', small: false, spin: false, preset: 'oblique',
    show: { crustal: true, intraslab: true, interface: true, offshore: true } };
  var colors = {}, W = 0, H = 0, dpr = 1, drawn = [], spinFrame = null;

  function readColors() {
    ['--crustal', '--deep', '--megathrust', '--context', '--text-primary', '--text-secondary', '--text-muted', '--surface-1',
      '--grid', '--axis', '--map-coast'].forEach(function (n) { colors[n] = U.cssVar(n); });
  }

  function project(p) {
    var yaw = state.yaw * Math.PI / 180, pitch = state.pitch * Math.PI / 180;
    var x = p[0], y = p[1], z = -p[2] * state.ve;
    var xr = x * Math.cos(yaw) - y * Math.sin(yaw), yr = x * Math.sin(yaw) + y * Math.cos(yaw);
    var sx = xr, sy = -(z * Math.cos(pitch) + yr * Math.sin(pitch));
    var depthKey = yr * Math.cos(pitch) - z * Math.sin(pitch);
    var s = scale();
    return [W / 2 + sx * s, H * 0.48 + sy * s, depthKey];
  }
  function scale() {
    var spanX = (BOX.lon[1] - BOX.lon[0]) * KX, spanY = (BOX.lat[1] - BOX.lat[0]) * KY;
    return state.zoom * Math.min(W / (spanX * 1.08), H / (Math.max(spanY * Math.sin(state.pitch * Math.PI / 180) + MAXD * state.ve * Math.cos(state.pitch * Math.PI / 180), MAXD * state.ve) * 1.15));
  }

  // ---------------------------------------------------------------- render
  function quakesShown() {
    var band = BANDS[state.band];
    return MAIN.concat(state.small ? SMALL : []).filter(function (q) {
      return state.show[q.cls] && (!band || (q.lat >= band[0] && q.lat <= band[1]));
    });
  }

  function render() {
    var wrap = $('scene-wrap'), cv = $('scene');
    var w = wrap.clientWidth; if (!w) return;
    var h = Math.round(Math.max(360, Math.min(620, w * 0.62)));
    dpr = window.devicePixelRatio || 1;
    if (w !== W || h !== H) { W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var band = BANDS[state.band];

    // Box: bottom edges first
    var x0 = kmX(BOX.lon[0]), x1 = kmX(BOX.lon[1]), y0 = kmY(BOX.lat[0]), y1 = kmY(BOX.lat[1]);
    var corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    ctx.strokeStyle = colors['--grid']; ctx.lineWidth = 1;
    function poly(pts, close) {
      ctx.beginPath();
      pts.forEach(function (p, i) { var s = project(p); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); });
      if (close) ctx.closePath();
    }
    [20, 40, 60, 80, 100, 120].forEach(function (d) { poly(corners.map(function (c) { return [c[0], c[1], d]; }), true); ctx.stroke(); });
    corners.forEach(function (c) { poly([[c[0], c[1], 0], [c[0], c[1], MAXD]]); ctx.stroke(); });

    // Depth labels on the near-left vertical edge
    var near = corners.slice().sort(function (a, b) { return project([a[0], a[1], 0])[2] - project([b[0], b[1], 0])[2]; })[0];
    ctx.fillStyle = colors['--text-muted']; ctx.font = '11px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    if (state.pitch < 80) [0, 40, 80, 120].forEach(function (d) { var s = project([near[0], near[1], d]); ctx.fillText(d + ' km', s[0] - 6, s[1]); });

    // Painter's sort of plate cells and quakes together
    var prims = [];
    CELLS.forEach(function (c) {
      var ps = c.pts.map(project), k = d3.mean(ps, function (p) { return p[2]; });
      prims.push({ k: k, cell: c, ps: ps });
    });
    var qs = quakesShown();
    qs.forEach(function (q) { var p = project([q.x, q.y, q.depth]); prims.push({ k: p[2], q: q, p: p }); });
    prims.sort(function (a, b) { return b.k - a.k; });

    var orange = colors['--megathrust'], surf = colors['--surface-1'];
    var shade = d3.interpolateRgb(surf, orange);
    drawn = [];
    prims.forEach(function (pr) {
      if (pr.cell) {
        var c = pr.cell, faded = band && (c.lat < band[0] || c.lat > band[1]);
        ctx.beginPath();
        pr.ps.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.closePath();
        ctx.globalAlpha = (faded ? 0.25 : 1) * (c.rupture ? 0.55 : 0.32);
        ctx.fillStyle = c.rupture ? orange : shade(0.25 + 0.6 * Math.min(1, c.depth / MAXD));
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        var q = pr.q, r = q.small ? 1.6 : 2 + (q.mag - 4) * 1.8;
        ctx.beginPath(); ctx.arc(pr.p[0], pr.p[1], r, 0, Math.PI * 2);
        ctx.fillStyle = colors[CLASSES[q.cls].color];
        ctx.globalAlpha = q.cls === 'offshore' ? 0.55 : 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (!q.small) { ctx.lineWidth = q.cls === 'interface' ? 1.5 : 1; ctx.strokeStyle = q.cls === 'interface' ? colors['--text-primary'] : surf; ctx.stroke(); }
        drawn.push({ x: pr.p[0], y: pr.p[1], r: r, q: q });
      }
    });

    // Depth contours of the plate surface
    ctx.lineWidth = 1; ctx.strokeStyle = orange; ctx.globalAlpha = 0.9;
    CONTOURS.forEach(function (c) {
      c.lines.forEach(function (line) {
        ctx.beginPath();
        var started = false;
        line.forEach(function (p) {
          var ok = p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
          if (!ok) { started = false; return; }
          var s = project(p);
          if (started) ctx.lineTo(s[0], s[1]); else { ctx.moveTo(s[0], s[1]); started = true; }
        });
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;

    // Surface: coastline, borders, cities, top box edges
    ctx.strokeStyle = colors['--text-secondary']; ctx.lineWidth = 1;
    COAST.forEach(function (run) { poly(run); ctx.stroke(); });
    ctx.strokeStyle = colors['--axis']; poly(corners.map(function (c) { return [c[0], c[1], 0]; }), true); ctx.stroke();
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    CITIES.forEach(function (c) {
      if (!inBox(c.lon, c.lat)) return;
      var s = project([kmX(c.lon), kmY(c.lat), 0]);
      ctx.beginPath(); ctx.arc(s[0], s[1], 2.5, 0, Math.PI * 2); ctx.fillStyle = colors['--text-primary']; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = surf; ctx.strokeText(c.name, s[0] + 5, s[1] - 7);
      ctx.fillText(c.name, s[0] + 5, s[1] - 7);
    });

    // Orientation axes (bottom-left)
    var ax = [[150, 0, 0, 'E'], [0, 150, 0, 'N'], [0, 0, 150 / state.ve, 'down']];
    ctx.font = '11px system-ui, -apple-system, sans-serif'; ctx.lineWidth = 1.5;
    var origin = [40, H - 34], s0 = project([0, 0, 0]);
    ax.forEach(function (a) {
      var e = project([a[0], a[1], a[2]]), dx = e[0] - s0[0], dy = e[1] - s0[1], len = Math.hypot(dx, dy);
      if (len < 2) return;
      var ux = dx / len * 22, uy = dy / len * 22;
      ctx.strokeStyle = colors['--text-secondary']; ctx.beginPath(); ctx.moveTo(origin[0], origin[1]); ctx.lineTo(origin[0] + ux, origin[1] + uy); ctx.stroke();
      ctx.fillStyle = colors['--text-secondary']; ctx.textAlign = 'center'; ctx.fillText(a[3], origin[0] + ux * 1.4, origin[1] + uy * 1.4);
    });

    $('compass').textContent = 'Depth stretched ' + state.ve + '×';
    cv.setAttribute('aria-label', '3D view: ' + qs.length + ' earthquakes and the subducting plate surface' + (band ? ', ' + state.band + ' band' : '') + '.');
  }

  var pending = null;
  function requestRender() { if (pending) return; pending = requestAnimationFrame(function () { pending = null; render(); }); }

  // ---------------------------------------------------------------- interaction
  function fmtDate(d) { return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function hover(ev) {
    var r = $('scene').getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, best = null, bd = 10;
    for (var i = drawn.length - 1; i >= 0; i--) {
      var d = Math.hypot(drawn[i].x - x, drawn[i].y - y) - drawn[i].r;
      if (d < bd) { bd = d; best = drawn[i]; }
    }
    var tip = $('scene-tip');
    if (!best) { tip.hidden = true; return; }
    var q = best.q;
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-head', 'M' + q.mag.toFixed(1) + ' · ' + fmtDate(q.date)));
    tip.appendChild(el('p', null, CLASSES[q.cls].label + ' · ' + Math.round(q.depth) + ' km deep'));
    if (q.slab !== null) {
      var dz = Math.round(q.depth - q.slab), rel;
      if (dz >= 0) rel = dz + ' km below the plate’s top surface (' + Math.round(q.slab) + ' km deep here)';
      else if (q.cls === 'intraslab' || q.cls === 'offshore') rel = 'at the plate’s top surface (' + Math.round(q.slab) + ' km deep here; quake depths are uncertain by a few km)';
      else rel = Math.abs(dz) + ' km above the plate’s top surface (' + Math.round(q.slab) + ' km deep here)';
      tip.appendChild(el('p', null, 'Position: ' + rel));
    }
    if (q.place) tip.appendChild(el('p', null, q.place));
    tip.hidden = false;
    var left = best.x + 12; if (left + tip.offsetWidth > W) left = best.x - 12 - tip.offsetWidth;
    var top = best.y + 12; if (top + tip.offsetHeight > H) top = best.y - 12 - tip.offsetHeight;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, top) + 'px';
  }

  function bindPointer() {
    var cv = $('scene'), drag = null;
    cv.addEventListener('pointerdown', function (ev) { drag = { x: ev.clientX, y: ev.clientY, yaw: state.yaw, pitch: state.pitch }; cv.setPointerCapture(ev.pointerId); $('scene-tip').hidden = true; });
    cv.addEventListener('pointermove', function (ev) {
      if (!drag) { hover(ev); return; }
      state.yaw = drag.yaw + (ev.clientX - drag.x) * 0.4;
      state.pitch = Math.max(0, Math.min(90, drag.pitch + (ev.clientY - drag.y) * 0.3));
      state.preset = null; syncControls(); requestRender();
    });
    cv.addEventListener('pointerup', function () { drag = null; });
    cv.addEventListener('pointerleave', function () { if (!drag) $('scene-tip').hidden = true; });
    cv.addEventListener('wheel', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      setZoom(state.zoom * Math.exp(-ev.deltaY * 0.01));
    }, { passive: false });
    cv.addEventListener('keydown', function (ev) {
      var d = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[ev.key];
      if (d) { ev.preventDefault(); state.yaw += d[0]; state.pitch = Math.max(0, Math.min(90, state.pitch + d[1])); state.preset = null; syncControls(); render(); }
      else if (ev.key === '+' || ev.key === '=') setZoom(state.zoom * 1.25);
      else if (ev.key === '-') setZoom(state.zoom / 1.25);
    });
  }
  function setZoom(z) { state.zoom = Math.max(0.6, Math.min(5, z)); requestRender(); }

  function animateTo(target) {
    var from = { yaw: state.yaw, pitch: state.pitch }, t0 = performance.now(), dur = U.prefersReducedMotion() ? 0 : 700;
    var dyaw = ((target.yaw - from.yaw + 540) % 360) - 180;
    function step(now) {
      var p = dur ? Math.min(1, (now - t0) / dur) : 1, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      state.yaw = from.yaw + dyaw * e; state.pitch = from.pitch + (target.pitch - from.pitch) * e;
      render();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function toggleSpin(on) {
    state.spin = on;
    if (spinFrame) cancelAnimationFrame(spinFrame);
    spinFrame = null;
    if (!on || U.prefersReducedMotion()) return;
    var last = performance.now();
    function frame(now) {
      state.yaw += (now - last) * 0.012; last = now;
      render();
      if (state.spin) spinFrame = requestAnimationFrame(frame);
    }
    spinFrame = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- toggles, kinds cards
  function counts() {
    var c = { crustal: 0, intraslab: 0, interface: 0, offshore: 0 };
    MAIN.concat(state.small ? SMALL : []).forEach(function (q) { c[q.cls]++; });
    return c;
  }
  function buildToggles() {
    var wrap = $('class-toggles');
    Object.keys(CLASSES).forEach(function (k) {
      var b = el('button', 'chip'); b.type = 'button'; b.dataset.cls = k;
      var d = el('span', 'dot'); d.style.background = 'var(' + CLASSES[k].color + ')';
      b.appendChild(d); b.appendChild(document.createTextNode(CLASSES[k].label + ' '));
      b.appendChild(el('span', 'count'));
      b.addEventListener('click', function () { state.show[k] = !state.show[k]; syncControls(); render(); });
      wrap.appendChild(b);
    });
  }
  function buildKinds() {
    var wrap = $('kinds');
    var info = {
      crustal: { title: 'Crustal (shallow) quakes', quote: 'Faults in the North American Plate, mostly shallower than ~30 km. The report gives a 17% chance of an M6.5+ in the Puget Sound region in 50 years.',
        show: { band: 'puget', preset: 'south' } },
      intraslab: { title: 'Deep (intraslab) quakes', quote: 'Inside the sinking Juan de Fuca Plate, 40–60 km down, mostly beneath Puget Sound. They are the most common damaging type: 85% chance of an M6.5+ in 50 years.',
        show: { band: 'puget', preset: 'south' } },
      interface: { title: 'Megathrust (plate boundary)', quote: 'The fault between the plates, which last ruptured in the 1700 M9. It is nearly silent in between: few small quakes are recorded on it (p. 3). 10–15% chance of an M9 in 50 years.',
        show: { band: 'all', preset: 'oblique' } },
    };
    Object.keys(info).forEach(function (k) {
      var a = el('article', 'card kind'), h = el('h3'), d = el('span', 'dot');
      d.style.background = 'var(' + CLASSES[k].color + ')';
      h.appendChild(d); h.appendChild(document.createTextNode(info[k].title));
      a.appendChild(h);
      a.appendChild(el('div', 'k-count')); a.appendChild(el('div', 'k-sub'));
      a.appendChild(el('p', null, info[k].quote));
      var b = el('button', 'btn', 'Show only these'); b.type = 'button';
      b.addEventListener('click', function () {
        Object.keys(state.show).forEach(function (c) { state.show[c] = c === k; });
        state.band = info[k].show.band;
        setPreset(info[k].show.preset);
        syncControls();
        $('scene-wrap').scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      });
      a.appendChild(b);
      a.dataset.cls = k;
      wrap.appendChild(a);
    });
  }
  function largest(k) { return MAIN.filter(function (q) { return q.cls === k; }).sort(function (a, b) { return b.mag - a.mag; })[0]; }
  function syncKinds() {
    var c = counts();
    document.querySelectorAll('.kind').forEach(function (a) {
      var k = a.dataset.cls, big = largest(k);
      a.querySelector('.k-count').textContent = U.fmtInt(c[k]);
      a.querySelector('.k-sub').textContent = 'recorded quakes ' + (state.small ? '(M4+ everywhere, M2.5+ under Puget Sound)' : 'M4+, 1980–2024') +
        (big ? ' · largest: M' + big.mag.toFixed(1) + ', ' + big.place + ', ' + big.date.getUTCFullYear() : '');
    });
  }

  function setPreset(name) { state.preset = name; animateTo(PRESETS[name]); syncControls(); }

  function syncControls() {
    document.querySelectorAll('#preset-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)); });
    document.querySelectorAll('#band-buttons button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.band === state.band)); });
    var c = counts();
    document.querySelectorAll('#class-toggles .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(state.show[b.dataset.cls]));
      b.querySelector('.count').textContent = '(' + U.fmtInt(c[b.dataset.cls]) + ')';
    });
    $('ve-out').textContent = state.ve + '×';
    $('ve-slider').value = state.ve;
    $('spin').checked = state.spin; $('small').checked = state.small;
    syncKinds();
  }

  function init() {
    readColors(); buildToggles(); buildKinds(); bindPointer();
    document.querySelectorAll('#preset-buttons button').forEach(function (b) { b.addEventListener('click', function () { setPreset(b.dataset.preset); }); });
    document.querySelectorAll('#band-buttons button').forEach(function (b) { b.addEventListener('click', function () { state.band = b.dataset.band; syncControls(); render(); }); });
    $('ve-slider').addEventListener('input', function (ev) { state.ve = +ev.target.value; syncControls(); render(); });
    $('spin').addEventListener('change', function (ev) { toggleSpin(ev.target.checked); });
    $('small').addEventListener('change', function (ev) { state.small = ev.target.checked; syncControls(); render(); });
    $('zoom-in').addEventListener('click', function () { setZoom(state.zoom * 1.25); });
    $('zoom-out').addEventListener('click', function () { setZoom(state.zoom / 1.25); });
    $('zoom-reset').addEventListener('click', function () { state.zoom = 1; setPreset('oblique'); });
    document.addEventListener('quake-themechange', function () { readColors(); render(); });
    syncControls(); render();
    if (window.ResizeObserver) new ResizeObserver(requestRender).observe($('scene-wrap'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
