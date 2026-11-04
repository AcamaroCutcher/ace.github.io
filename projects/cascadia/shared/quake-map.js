/*
 * Interactive Pacific Northwest map on <canvas>. Requires d3 (vendor/d3.min.js), PNW_MAP, VizUtils.
 *
 *   var map = QuakeMap.create({ wrap, canvas, tooltip, describeEvent, onSelect });
 *   map.setScene({ events, playhead, mode: 'one' | 'all', highlight, rupture });
 *   map.setLayers({ faults, sources, zone, deepZone, cities, history });
 *   map.zoomTo('region' | 'puget' | 'portland' | 'mendocino' | 'oregon');
 *
 * Options: colorOf(e) -> CSS color or custom-property name ('--depth-3'), radiusOf(mag) -> px,
 * layers: initial layer visibility, historyFilter(h) -> bool. Scene options: `trail` (years) fades quakes
 * older than that; `pulse: false` turns off the "just happened" rings.
 *
 * The basemap (land, faults, zones, labels) is drawn once per view into an offscreen canvas;
 * only the quakes are redrawn each animation frame.
 */
(function () {
  'use strict';
  var G = window.PNW_MAP, U = window.VizUtils;

  var VIEWS = {
    region:   [[-129.0, 40.1], [-116.2, 50.2]],
    puget:    [[-123.7, 46.75], [-121.55, 48.65]],
    portland: [[-123.75, 44.75], [-122.1, 45.95]],
    mendocino: [[-127.6, 39.8], [-122.8, 42.6]],
    oregon:   [[-125.0, 42.8], [-120.8, 46.5]],
  };

  /** Circle radius in pixels for a magnitude (illustrative scale, not physical). */
  function radius(m) { return 3 + (m - 6) * 5; }

  function create(opts) {
    var wrap = opts.wrap, canvas = opts.canvas, tip = opts.tooltip;
    var ctx = canvas.getContext('2d');
    var base = document.createElement('canvas'), bctx = base.getContext('2d');
    var W = 0, H = 0, dpr = 1, projection = null, transform = d3.zoomIdentity, baseDirty = true;
    var colors = {};
    var layers = { faults: true, sources: true, zone: true, deepZone: true, cities: true, history: false };
    if (opts.layers) for (var lk in opts.layers) layers[lk] = opts.layers[lk];
    var scene = { events: [], playhead: 0, mode: 'one', highlight: null, rupture: false, trail: 0 };
    var rOf = opts.radiusOf || radius;
    var varCache = {};
    var P = {};          // pre-projected geometry (unzoomed pixel coordinates)
    var hits = [];       // screen-space hover targets for this frame
    var quad = null, quadDirty = true, hoverPt = null, dragging = false;

    // ------------------------------------------------------------ setup
    function readColors() {
      ['--map-water', '--map-land', '--map-coast', '--map-fault', '--deep', '--megathrust', '--crustal',
        '--text-primary', '--text-secondary', '--text-muted', '--surface-1'].forEach(function (n) {
        colors[n.slice(2)] = U.cssVar(n);
      });
    }

    function fitProjection() {
      var v = VIEWS.region, pts = [];
      for (var i = 0; i <= 4; i++) {
        var lon = v[0][0] + (v[1][0] - v[0][0]) * i / 4, lat = v[0][1] + (v[1][1] - v[0][1]) * i / 4;
        pts.push([lon, v[0][1]], [lon, v[1][1]], [v[0][0], lat], [v[1][0], lat]);
      }
      projection = d3.geoConicConformal().parallels([42, 49]).rotate([122.5, 0])
        .fitExtent([[6, 6], [W - 6, H - 6]], { type: 'MultiPoint', coordinates: pts });
    }

    function projLine(coords) {
      var out = new Float32Array(coords.length * 2);
      for (var i = 0; i < coords.length; i++) {
        var p = projection(coords[i]);
        out[i * 2] = p[0]; out[i * 2 + 1] = p[1];
      }
      return out;
    }
    function projFlat(flat) {
      var out = new Float32Array(flat.length);
      for (var i = 0; i < flat.length; i += 2) {
        var p = projection([flat[i], flat[i + 1]]);
        out[i] = p[0]; out[i + 1] = p[1];
      }
      return out;
    }
    function rings(geom) {
      if (geom.type === 'Polygon' || geom.type === 'MultiLineString') return geom.coordinates;
      if (geom.type === 'MultiPolygon') return [].concat.apply([], geom.coordinates);
      return [geom.coordinates];
    }

    function preProject() {
      P.land = [].concat.apply([], G.land.map(rings)).map(projLine);
      P.borders = [].concat.apply([], G.borders.map(rings)).map(projLine);
      P.faults = G.faults.map(projFlat);
      var R = G.regions;
      P.sources = R.seattle.concat(R.pugetOther, R.portland).map(function (l) { return projLine(l.coords); });
      P.zone = projLine(R.megathrust.zone);
      P.deepPts = R.deep.map(function (d) { return projection([d[0], d[1]]); });
      P.cities = G.cities.map(function (c) { var p = projection([c.lon, c.lat]); return { c: c, x: p[0], y: p[1] }; });
      P.history = G.historical.map(function (h) { var p = projection([h.lon, h.lat]); return { h: h, x: p[0], y: p[1] }; });
      P.zoneLabel = projection([-127.6, 45.6]);
    }

    function resize() {
      var w = wrap.clientWidth;
      if (!w) return;
      var h = Math.round(Math.max(380, Math.min(660, w * 0.78)));
      if (w === W && h === H) return;
      W = w; H = h; dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      base.width = canvas.width; base.height = canvas.height;
      fitProjection();
      preProject();
      zoom.extent([[0, 0], [W, H]]).translateExtent([[-W * 0.1, -H * 0.1], [W * 1.1, H * 1.1]]);
      transform = d3.zoomIdentity;
      d3.select(canvas).call(zoom.transform, transform);
      baseDirty = true;
      draw();
    }

    // ------------------------------------------------------------ zoom
    var zoom = d3.zoom()
      .scaleExtent([1, 16])
      .filter(function (ev) {
        if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;   // plain scrolling still scrolls the page
        return !ev.button;
      })
      .on('start', function () { dragging = true; hideTip(); })
      .on('zoom', function (ev) { transform = ev.transform; baseDirty = true; quadDirty = true; draw(); })
      .on('end', function () { dragging = false; });
    d3.select(canvas).call(zoom).on('dblclick.zoom', null);

    function animateTo(t) {
      var sel = d3.select(canvas);
      if (U.prefersReducedMotion()) sel.call(zoom.transform, t);
      else sel.transition().duration(750).call(zoom.transform, t);
    }

    function zoomTo(view) {
      var v = VIEWS[view] || VIEWS.region;
      if (view === 'region') { animateTo(d3.zoomIdentity); return; }
      var a = projection([v[0][0], v[1][1]]), b = projection([v[1][0], v[0][1]]);
      var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      var k = Math.min(16, 0.95 * Math.min(W / (x1 - x0), H / (y1 - y0)));
      animateTo(d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
    }

    function focusPoint(lon, lat, k) {
      var p = projection([lon, lat]);
      k = Math.max(transform.k, k || 4);
      animateTo(d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-p[0], -p[1]));
    }

    function zoomBy(f) { d3.select(canvas).transition().duration(250).call(zoom.scaleBy, f); }

    // ------------------------------------------------------------ basemap
    function strokeLines(c, lines) {
      c.beginPath();
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        c.moveTo(l[0], l[1]);
        for (var j = 2; j < l.length; j += 2) c.lineTo(l[j], l[j + 1]);
      }
    }

    function screen(x, y) { return [x * transform.k + transform.x, y * transform.k + transform.y]; }

    function drawBase() {
      var c = bctx, k = transform.k;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = colors['map-water'];
      c.fillRect(0, 0, W, H);

      c.save();
      c.translate(transform.x, transform.y);
      c.scale(k, k);

      strokeLines(c, P.land);
      c.fillStyle = colors['map-land'];
      c.fill('evenodd');
      c.lineWidth = 0.8 / k; c.strokeStyle = colors['map-coast']; c.stroke();

      strokeLines(c, P.borders);
      c.lineWidth = 1 / k; c.strokeStyle = colors['map-coast']; c.stroke();

      if (layers.faults) {
        strokeLines(c, P.faults);
        c.lineWidth = 0.7 / k; c.strokeStyle = colors['map-fault']; c.stroke();
      }
      if (layers.zone) {
        strokeLines(c, [P.zone]);
        c.closePath();
        c.globalAlpha = 0.12; c.fillStyle = colors.megathrust; c.fill();
        c.globalAlpha = 0.6; c.lineWidth = 1 / k; c.strokeStyle = colors.megathrust; c.stroke();
        c.globalAlpha = 1;
      }
      if (layers.deepZone) {                      // real recorded deep quakes: where simulated ones are drawn from
        c.beginPath();
        var dr = 1.8 / Math.sqrt(k);
        P.deepPts.forEach(function (p) { c.moveTo(p[0] + dr, p[1]); c.arc(p[0], p[1], dr, 0, Math.PI * 2); });
        c.globalAlpha = 0.45; c.fillStyle = colors.deep; c.fill(); c.globalAlpha = 1;
      }
      if (layers.sources) {
        strokeLines(c, P.sources);
        c.lineWidth = 1.6 / k; c.strokeStyle = colors.crustal; c.globalAlpha = 0.85; c.stroke(); c.globalAlpha = 1;
      }
      c.restore();

      // Screen-space labels (constant size at any zoom), with simple collision avoidance.
      var placed = [];
      function fits(x, y, w, h) {
        if (x < 2 || y < 2 || x + w > W - 2 || y + h > H - 2) return false;
        for (var i = 0; i < placed.length; i++) {
          var q = placed[i];
          if (x < q[0] + q[2] && x + w > q[0] && y < q[1] + q[3] && y + h > q[1]) return false;
        }
        placed.push([x, y, w, h]);
        return true;
      }
      c.textBaseline = 'middle';

      if (layers.zone) {
        var zl = screen(P.zoneLabel[0], P.zoneLabel[1]);
        c.font = '600 12px system-ui, -apple-system, "Segoe UI", sans-serif';
        c.fillStyle = colors['text-secondary'];
        c.textAlign = 'center';
        if (fits(zl[0] - 60, zl[1] - 16, 120, 32)) {
          c.fillText('Cascadia', zl[0], zl[1] - 8);
          c.fillText('Subduction Zone', zl[0], zl[1] + 8);
        }
      }

      if (layers.cities) {
        var minRank = k >= 3 ? 3 : 2;
        P.cities.slice().sort(function (a, b) { return a.c.rank - b.c.rank; }).forEach(function (pc) {
          if (pc.c.rank > minRank) return;
          var s = screen(pc.x, pc.y);
          c.font = (pc.c.rank === 1 ? '600 12px' : '11px') + ' system-ui, -apple-system, "Segoe UI", sans-serif';
          var tw = c.measureText(pc.c.name).width;
          if (!fits(s[0] + 4, s[1] - 7, tw + 2, 14)) return;
          c.beginPath(); c.arc(s[0], s[1], 2.5, 0, Math.PI * 2);
          c.fillStyle = colors['text-secondary']; c.fill();
          c.textAlign = 'left';
          c.fillStyle = colors['text-primary'];
          c.fillText(pc.c.name, s[0] + 5, s[1]);
        });
      }
      baseDirty = false;
    }

    // ------------------------------------------------------------ quakes
    function colorFor(e) {
      if (!opts.colorOf) return colors[e.type];
      var c = opts.colorOf(e);
      if (c.slice(0, 2) !== '--') return c;
      if (!(c in varCache)) varCache[c] = U.cssVar(c);
      return varCache[c];
    }

    function draw() {
      if (!W) return;
      if (baseDirty) drawBase();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hits = [];

      // A Cascadia M9 ruptures the whole zone: shade it when one has happened in this future.
      if (scene.rupture) {
        ctx.save();
        ctx.translate(transform.x, transform.y); ctx.scale(transform.k, transform.k);
        strokeLines(ctx, [P.zone]); ctx.closePath();
        ctx.globalAlpha = 0.35; ctx.fillStyle = colors.megathrust; ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      if (layers.history) {
        P.history.forEach(function (ph) {
          if (opts.historyFilter && !opts.historyFilter(ph.h)) return;
          var s = screen(ph.x, ph.y), r = Math.max(4, radius(ph.h.mag));
          ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
          ctx.lineWidth = 1.5; ctx.strokeStyle = colors['text-secondary']; ctx.stroke();
          hits.push({ x: s[0], y: s[1], r: r, kind: 'history', data: ph.h });
        });
      }

      var all = scene.mode === 'all', ph = scene.playhead;
      var vis = scene.events.filter(function (e) { return e.y <= ph; })
        .sort(function (a, b) { return b.mag - a.mag; });
      var hl = scene.highlight;
      // In "all" mode, fade dots more as there are more of them so dense areas read as gradients, not blobs.
      var allAlpha = Math.max(0.06, Math.min(0.35, 10 / Math.sqrt(Math.max(1, vis.length))));

      for (var i = 0; i < vis.length; i++) {
        var e = vis[i], p = projection([e.lon, e.lat]), s = screen(p[0], p[1]);
        if (s[0] < -30 || s[1] < -30 || s[0] > W + 30 || s[1] > H + 30) continue;
        var r = all ? Math.max(1.5, rOf(e.mag) * 0.3) : rOf(e.mag);   // small, faint dots let density show
        var color = colorFor(e);
        var age = ph - e.y;
        var old = scene.trail && age > scene.trail;
        if (!all && age < 2 && scene.pulse !== false) {   // "just happened" pulse
          var t = age / 2;
          ctx.beginPath(); ctx.arc(s[0], s[1], r + 4 + 28 * t, 0, Math.PI * 2);
          ctx.globalAlpha = 0.7 * (1 - t); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (all && age < 1) {                // smaller "raindrop" ring as each quake arrives
          var ta = age;
          ctx.beginPath(); ctx.arc(s[0], s[1], r + 2 + 12 * ta, 0, Math.PI * 2);
          ctx.globalAlpha = 0.6 * (1 - ta); ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
        ctx.globalAlpha = all ? allAlpha : old ? 0.22 : 0.9;
        ctx.fillStyle = color; ctx.fill();
        ctx.globalAlpha = 1;
        if (!all && !old) { ctx.lineWidth = 1.5; ctx.strokeStyle = colors['surface-1']; ctx.stroke(); }
        if (!all) hits.push({ x: s[0], y: s[1], r: r, kind: 'quake', data: e });
      }
      if (all) { scene.visible = vis; quadDirty = true; }

      if (hl && hl.y <= ph) {
        var hp = projection([hl.lon, hl.lat]), hs = screen(hp[0], hp[1]);
        ctx.beginPath(); ctx.arc(hs[0], hs[1], rOf(hl.mag) + 5, 0, Math.PI * 2);
        ctx.lineWidth = 2.5; ctx.strokeStyle = colors['text-primary']; ctx.stroke();
      }
      if (hoverPt && !dragging) updateTip(hoverPt);
    }

    // ------------------------------------------------------------ hover + click
    /** Nearest hover target. `slop` is extra pick tolerance in px (clicks get a bit more than hover). */
    function findAt(x, y, slop) {
      slop = slop || 5;
      var best = null, bd = Infinity;
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i], d = Math.hypot(h.x - x, h.y - y);
        if (d <= h.r + slop && d - h.r < bd) { bd = d - h.r; best = h; }
      }
      if (best && best.kind === 'quake') return best;
      if (scene.mode === 'all' && scene.visible && scene.visible.length) {
        if (quadDirty) {
          quad = d3.quadtree()
            .x(function (e) { return screen.apply(null, projection([e.lon, e.lat]))[0]; })
            .y(function (e) { return screen.apply(null, projection([e.lon, e.lat]))[1]; })
            .addAll(scene.visible);
          quadDirty = false;
        }
        var e = quad.find(x, y, 5 + slop);
        if (e) return { kind: 'quake', data: e };
      }
      return best;
    }

    function updateTip(pt) {
      var h = findAt(pt[0], pt[1]);
      canvas.style.cursor = h && h.kind === 'quake' ? 'pointer' : 'grab';
      if (!h) { hideTip(); return; }
      tip.textContent = '';
      var info = h.kind === 'quake' ? opts.describeEvent(h.data) : {
        title: h.data.name + ' (historical)',
        lines: ['M' + h.data.mag.toFixed(1) + (h.data.note ? ' · ' + h.data.note : ''), 'Location approximate, as in the report’s Figure 1'],
      };
      tip.appendChild(U.el('div', 'tip-head', info.title));
      info.lines.forEach(function (l) { if (l) tip.appendChild(U.el('p', null, l)); });
      tip.hidden = false;
      var left = pt[0] + 14, top = pt[1] + 14;
      if (left + tip.offsetWidth > W) left = pt[0] - 14 - tip.offsetWidth;
      if (top + tip.offsetHeight > H) top = pt[1] - 14 - tip.offsetHeight;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, top) + 'px';
    }
    function hideTip() { tip.hidden = true; }

    function localPt(ev) {
      var r = canvas.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }
    canvas.addEventListener('pointermove', function (ev) { hoverPt = localPt(ev); if (!dragging) updateTip(hoverPt); });
    canvas.addEventListener('pointerleave', function () { hoverPt = null; hideTip(); });
    canvas.addEventListener('click', function (ev) {
      var pt = localPt(ev), h = findAt(pt[0], pt[1], 9);
      if (h && h.kind === 'quake' && opts.onSelect) opts.onSelect(h.data);
    });
    canvas.addEventListener('keydown', function (ev) {
      var sel = d3.select(canvas);
      if (ev.key === '+' || ev.key === '=') zoomBy(1.6);
      else if (ev.key === '-' || ev.key === '_') zoomBy(1 / 1.6);
      else if (ev.key === '0') zoomTo('region');
      else if (/^Arrow/.test(ev.key)) {
        var d = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[ev.key];
        sel.call(zoom.translateBy, d[0] / transform.k, d[1] / transform.k);
      } else return;
      ev.preventDefault();
    });

    // ------------------------------------------------------------ public API
    readColors();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    else window.addEventListener('resize', resize);
    resize();

    return {
      setScene: function (s) { for (var k in s) scene[k] = s[k]; draw(); },
      setLayers: function (l) { for (var k in l) layers[k] = l[k]; baseDirty = true; draw(); },
      getLayers: function () { return layers; },
      zoomTo: zoomTo,
      zoomBy: zoomBy,
      focusPoint: focusPoint,
      refreshTheme: function () { readColors(); varCache = {}; baseDirty = true; draw(); },
      draw: draw,
    };
  }

  window.QuakeMap = { create: create, radius: radius, VIEWS: VIEWS };
})();
