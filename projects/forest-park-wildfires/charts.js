/*
 * Small SVG line charts for the WRF-SFIRE handbook (no dependencies).
 *
 * <figure class="viz"><script type="application/json">{
 *   "title": "...", "sub": "...", "xLabel": "...", "yLabel": "...",
 *   "x": [...], "series": [{"name": "...", "y": [...]}, ...],
 *   "xUnit": "s", "yUnit": "%", "xDigits": 0, "yDigits": 1, "yMin": 0, "yMax": 1
 * }</script></figure>
 *
 * Follows the site's dataviz rules: 2px lines, hairline solid grid, one y axis, a legend for
 * >= 2 series plus direct end labels when they don't collide, a crosshair tooltip listing every
 * series at the hovered x (also on keyboard focus with arrow keys), and a data table view.
 * Series colours come from CSS custom properties, so they follow the light/dark toggle.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    var err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t = [], v = Math.ceil(lo / step - 1e-9) * step;
    for (; v <= hi + step * 1e-9; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return t;
  }
  function fmt(v, d) {
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function Chart(fig) {
    var spec = JSON.parse(fig.querySelector('script[type="application/json"]').textContent);
    var xd = spec.xDigits == null ? 0 : spec.xDigits, yd = spec.yDigits == null ? 1 : spec.yDigits;
    var xu = spec.xUnit ? ' ' + spec.xUnit : '', yu = spec.yUnit ? ' ' + spec.yUnit : '';

    var head = document.createElement('div');
    var t = document.createElement('div'); t.className = 'viz-title'; t.textContent = spec.title; head.appendChild(t);
    if (spec.sub) { var s = document.createElement('div'); s.className = 'viz-sub'; s.textContent = spec.sub; head.appendChild(s); }
    fig.appendChild(head);
    if (spec.series.length > 1) {
      var lg = document.createElement('div'); lg.className = 'viz-legend';
      spec.series.forEach(function (se, i) {
        var it = document.createElement('span'), key = document.createElement('i');
        key.style.background = COLORS[i]; it.appendChild(key); it.appendChild(document.createTextNode(se.name)); lg.appendChild(it);
      });
      fig.appendChild(lg);
    }
    var wrap = document.createElement('div'); wrap.className = 'viz-wrap'; fig.appendChild(wrap);
    var tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; wrap.appendChild(tip);

    // table view
    var det = document.createElement('details'), sum = document.createElement('summary');
    sum.textContent = 'Show the data as a table'; det.appendChild(sum);
    var tw = document.createElement('div'); tw.className = 'table-wrap'; det.appendChild(tw);
    var tb = document.createElement('table'), thr = document.createElement('tr');
    [spec.xLabel].concat(spec.series.map(function (se) { return se.name; })).forEach(function (h) {
      var th = document.createElement('th'); th.textContent = h; thr.appendChild(th);
    });
    var thead = document.createElement('thead'); thead.appendChild(thr); tb.appendChild(thead);
    var tbody = document.createElement('tbody'), stepRows = Math.max(1, Math.ceil(spec.x.length / 40));
    for (var r = 0; r < spec.x.length; r += stepRows) {
      var tr = document.createElement('tr'), td = document.createElement('td');
      td.textContent = fmt(spec.x[r], xd); tr.appendChild(td);
      spec.series.forEach(function (se) { var c = document.createElement('td'); c.className = 'r'; c.textContent = fmt(se.y[r], yd); tr.appendChild(c); });
      tbody.appendChild(tr);
    }
    tb.appendChild(tbody); tw.appendChild(tb); fig.appendChild(det);

    var svg, idx = -1, geom;

    function draw() {
      if (svg) svg.remove();
      var W = Math.max(280, wrap.clientWidth), narrow = W < 520;
      var H = narrow ? 230 : 270;
      var m = { l: 52, r: narrow ? 12 : 120, t: 10, b: 44 };
      svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', tabindex: '0',
        'aria-label': spec.title + '. Use left and right arrow keys to read values.' });
      wrap.insertBefore(svg, tip);
      var xs = spec.x, xmin = xs[0], xmax = xs[xs.length - 1];
      var ymin = spec.yMin != null ? spec.yMin : Math.min.apply(null, spec.series.map(function (se) { return Math.min.apply(null, se.y); }));
      var ymax = spec.yMax != null ? spec.yMax : Math.max.apply(null, spec.series.map(function (se) { return Math.max.apply(null, se.y); }));
      var X = function (v) { return m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r); };
      var Y = function (v) { return H - m.b - (v - ymin) / (ymax - ymin || 1) * (H - m.t - m.b); };
      geom = { X: X, Y: Y, m: m, W: W, H: H };

      var g = el('g', { class: 'grid' }, svg);
      niceTicks(ymin, ymax, 5).forEach(function (v) {
        el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g);
        var tx = el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'lab' }, svg); tx.textContent = fmt(v, spec.yTickDigits != null ? spec.yTickDigits : (Math.abs(ymax - ymin) < 5 ? 1 : 0));
      });
      niceTicks(xmin, xmax, narrow ? 4 : 7).forEach(function (v) {
        var tx = el('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle', class: 'lab' }, svg); tx.textContent = fmt(v, spec.xTickDigits || 0);
      });
      el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'base' }, svg);
      var xt = el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title' }, svg); xt.textContent = spec.xLabel;
      var yt = el('text', { x: 12, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'axis-title',
        transform: 'rotate(-90 12 ' + (m.t + H - m.b) / 2 + ')' }, svg); yt.textContent = spec.yLabel;

      var ends = [];
      spec.series.forEach(function (se, i) {
        var d = se.y.map(function (v, k) { return (k ? 'L' : 'M') + X(xs[k]).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
        el('path', { d: d, fill: 'none', style: 'stroke:' + COLORS[i], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        ends.push({ y: Y(se.y[se.y.length - 1]), name: se.name, i: i });
      });
      // direct end labels unless they would collide (then the legend + tooltip carry identity)
      if (!narrow) {
        ends.sort(function (a, b) { return a.y - b.y; });
        var fits = spec.series.every(function (se) { return se.name.length <= 18; });
        var ok = fits && ends.every(function (e, k) { return !k || e.y - ends[k - 1].y >= 14; });
        if (ok) ends.forEach(function (e) {
          el('circle', { cx: X(xmax), cy: e.y, r: 4, style: 'fill:' + COLORS[e.i] + ';stroke:var(--surface-1)', 'stroke-width': 2 }, svg);
          var lt = el('text', { x: X(xmax) + 9, y: e.y + 4, class: 'end-lab' }, svg); lt.textContent = e.name;
        });
      }
      geom.cross = el('line', { y1: m.t, y2: H - m.b, class: 'base', visibility: 'hidden' }, svg);
      geom.dots = spec.series.map(function (se, i) {
        return el('circle', { r: 4.5, style: 'fill:' + COLORS[i] + ';stroke:var(--surface-1)', 'stroke-width': 2, visibility: 'hidden' }, svg);
      });
      var hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', function (e) {
        var b = svg.getBoundingClientRect(), px = (e.clientX - b.left) * W / b.width;
        var best = 0, bd = Infinity;
        xs.forEach(function (v, k) { var dd = Math.abs(X(v) - px); if (dd < bd) { bd = dd; best = k; } });
        show(best);
      });
      hit.addEventListener('pointerleave', hide);
      svg.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          show(Math.max(0, Math.min(xs.length - 1, (idx < 0 ? 0 : idx) + (e.key === 'ArrowRight' ? 1 : -1))));
        } else if (e.key === 'Escape') hide();
      });
      svg.addEventListener('blur', hide);
      if (idx >= 0) show(idx);
    }

    function show(k) {
      idx = k;
      var x = geom.X(spec.x[k]);
      geom.cross.setAttribute('x1', x); geom.cross.setAttribute('x2', x); geom.cross.setAttribute('visibility', 'visible');
      while (tip.firstChild) tip.removeChild(tip.firstChild);
      var h = document.createElement('div'); h.textContent = spec.xLabel + ': ' + fmt(spec.x[k], xd) + xu; h.style.color = 'var(--text-secondary)'; tip.appendChild(h);
      spec.series.forEach(function (se, i) {
        geom.dots[i].setAttribute('cx', x); geom.dots[i].setAttribute('cy', geom.Y(se.y[k])); geom.dots[i].setAttribute('visibility', 'visible');
        var row = document.createElement('div'); row.className = 'row';
        var key = document.createElement('i'); key.style.background = COLORS[i]; row.appendChild(key);
        var txt = document.createElement('div'), b = document.createElement('b'), n = document.createElement('span');
        b.textContent = fmt(se.y[k], yd) + yu; n.textContent = '  ' + se.name;
        txt.appendChild(b); txt.appendChild(n); row.appendChild(txt); tip.appendChild(row);
      });
      tip.hidden = false;
      var b2 = svg.getBoundingClientRect(), scale = b2.width / geom.W;
      var left = x * scale + 14;
      if (left + tip.offsetWidth > wrap.clientWidth) left = x * scale - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = (geom.m.t * scale + 4) + 'px';
    }
    function hide() {
      idx = -1; tip.hidden = true;
      if (!geom) return;
      geom.cross.setAttribute('visibility', 'hidden');
      geom.dots.forEach(function (d) { d.setAttribute('visibility', 'hidden'); });
    }

    draw();
    var tm;
    window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(draw, 120); });
  }

  function init() { document.querySelectorAll('figure.viz').forEach(Chart); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
