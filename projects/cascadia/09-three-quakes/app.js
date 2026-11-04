/*
 * Project 9: "Three kinds of earthquakes". A deterministic SVG animation: renderAt(t) draws the frame for
 * any time t (seconds), so playing, scrubbing and jumping to chapters all use the same code path.
 */
(function () {
  'use strict';

  var U = window.VizUtils, $ = U.$, el = U.el;
  var DURATION = 60;
  var CHAPTERS = [
    { t: 0, title: 'Two plates collide',
      caption: 'Off the Pacific Northwest coast, the Juan de Fuca Plate slides east beneath the North American Plate, a few centimeters a year.' },
    { t: 9, title: 'The megathrust locks',
      caption: 'The boundary between the plates sticks. For centuries the upper plate is squeezed: the coast bulges up and strain builds.' },
    { t: 19, title: 'The Big One',
      caption: 'The locked boundary slips all at once, an M~9 megathrust earthquake. The sea floor lifts, the coast drops, and a tsunami races out. The last one: January 26, 1700.' },
    { t: 33, title: 'A deep quake',
      caption: 'Deep inside the sinking plate, 40–60 km down, the rock breaks. These intraslab quakes are the most common damaging kind: 1949, 1965 and 2001.' },
    { t: 43, title: 'A shallow quake',
      caption: 'Faults in the squeezed upper plate break close to the surface. The Seattle Fault produced an M7.5–7.8 around 923–924 C.E.' },
    { t: 53, title: 'The odds',
      caption: 'Chance of at least one in the next 50 years (USGS): deep M6.5+ under Puget Sound 85%, crustal M6.5+ 17%, Cascadia M9 10–15%.' },
  ];
  var T_RUPTURE = 21, T_DEEP = 35, T_CRUSTAL = 45;

  // ---------------------------------------------------------------- geometry
  var SEA = 150, TRENCH = 300, COAST = 400, TH = 46;
  function slabTop(x) { return x <= TRENCH ? 205 : 205 + 265 * Math.pow((x - TRENCH) / 600, 1.5); }
  function gauss(x, c, w) { return Math.exp(-Math.pow((x - c) / w, 2)); }
  function smooth(a, b, t) { var u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); }

  /** How locked/strained the megathrust is: 0 → 1 while locking, then snaps to −0.5 (coast drops) at rupture. */
  function lockAt(t) {
    if (t < T_RUPTURE) return smooth(9, 19, t);
    return 1 - 1.5 * smooth(T_RUPTURE, T_RUPTURE + 0.5, t);
  }
  function landY(x, lock) {
    var base = SEA - 4 - 30 * gauss(x, 470, 45) - 10 * gauss(x, 560, 60);
    var volcano = x > 720 && x < 840 ? -Math.max(0, 74 - Math.abs(x - 780) * 1.25) : 0;
    return base + volcano - lock * 14 * gauss(x, 430, 60);
  }
  function shelfY(x, lock) {   // continental slope between trench and coast
    var f = (x - TRENCH) / (COAST - TRENCH);
    return 205 + (SEA - 205) * Math.pow(f, 0.8) + lock * 10 * gauss(x, 330, 30) - lock * 8 * gauss(x, 390, 25);
  }
  function surfaceY(x, lock) { return x < COAST ? shelfY(x, lock) : landY(x, lock); }

  function waterY(x, t) {
    if (t < T_RUPTURE) return SEA;
    var dt = t - T_RUPTURE, amp = 13 * Math.exp(-dt / 9);
    return SEA - amp * (gauss(x, 340 - 70 * dt, 26) * 0.9 + gauss(x, 340 + 45 * dt, 22) * (x < COAST + 30 ? 1 : 0));
  }

  // ---------------------------------------------------------------- scene construction
  var svg = d3.select('#anim'), R = {};
  function build() {
    var defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'clip-stage').append('rect').attr('width', 900).attr('height', 500);
    var g = svg.append('g').attr('clip-path', 'url(#clip-stage)');
    g.append('rect').attr('width', 900).attr('height', 500).style('fill', 'var(--page)');
    R.continent = g.append('path').style('fill', 'var(--text-muted)').style('opacity', 0.28);
    R.water = g.append('path').style('fill', 'var(--deep)').style('opacity', 0.22);
    R.flood = g.append('rect').attr('x', COAST - 4).attr('y', SEA - 26).attr('width', 60).attr('height', 26).style('fill', 'var(--deep)').style('opacity', 0);
    R.plate = g.append('path').style('fill', 'var(--context)').style('opacity', 0.75);
    R.stripes = g.append('path').style('fill', 'none').style('stroke', 'var(--surface-1)').style('stroke-width', 3).style('stroke-dasharray', '14 20').style('opacity', 0.8);
    R.locked = g.append('path').style('fill', 'none').style('stroke', 'var(--megathrust)').style('stroke-linecap', 'round');
    R.fault = g.append('path').attr('d', 'M600,' + (SEA - 2) + 'L582,250').style('stroke', 'var(--crustal)').style('stroke-width', 3).style('opacity', 0.35);
    R.surface = g.append('path').style('fill', 'none').style('stroke', 'var(--text-secondary)').style('stroke-width', 1.5);
    R.waterLine = g.append('path').style('fill', 'none').style('stroke', 'var(--deep)').style('stroke-width', 2);

    // Ghost-forest trees on the coast
    R.trees = g.append('g');
    [408, 418, 428, 440].forEach(function (x) {
      var t = R.trees.append('g').attr('data-x', x);
      t.append('rect').attr('x', -1.5).attr('y', -12).attr('width', 3).attr('height', 12).style('fill', 'var(--text-secondary)');
      t.append('path').attr('class', 'crown').attr('d', 'M0,-30L8,-10L-8,-10Z');
    });
    R.ghostLabel = g.append('text').attr('x', 424).attr('y', SEA - 52).attr('text-anchor', 'middle').attr('class', 'lab-s').text('ghost forest').style('opacity', 0);

    // City
    R.city = g.append('g');
    [[-22, 22], [-12, 34], [-2, 26], [8, 40], [18, 20]].forEach(function (b) {
      R.city.append('rect').attr('x', b[0]).attr('y', -b[1]).attr('width', 9).attr('height', b[1]).style('fill', 'var(--text-primary)').style('opacity', 0.75);
    });

    // Labels
    function lab(x, y, text, cls) { return g.append('text').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('class', cls || 'lab').text(text); }
    lab(150, SEA - 18, 'Pacific Ocean', 'lab-s');
    lab(150, 245, 'Juan de Fuca Plate');
    lab(720, 230, 'North American Plate');
    lab(640, SEA - 52, 'Seattle', 'lab-s');
    lab(780, SEA - 84, 'Cascades', 'lab-s');
    R.arrow = g.append('path').attr('d', 'M90,225H200M190,218L200,225L190,232').style('fill', 'none').style('stroke', 'var(--text-primary)').style('stroke-width', 2.5);

    // Strain meter
    R.meter = g.append('g').attr('transform', 'translate(720,24)');
    R.meter.append('text').attr('x', 0).attr('y', 0).attr('class', 'lab-s').text('Megathrust strain');
    R.meter.append('rect').attr('x', 0).attr('y', 8).attr('width', 150).attr('height', 10).attr('rx', 5).style('fill', 'var(--grid)');
    R.meterFill = R.meter.append('rect').attr('x', 0).attr('y', 8).attr('height', 10).attr('rx', 5).style('fill', 'var(--megathrust)');

    // Quake markers and seismic rings
    function quake(cx, cy, color) {
      var q = g.append('g').style('opacity', 0);
      q.rings = [0, 1, 2].map(function () { return q.append('circle').attr('cx', cx).attr('cy', cy).style('fill', 'none').style('stroke', color).style('stroke-width', 2.5); });
      var p = d3.range(10).map(function (i) { var r = i % 2 ? 6 : 15, a = Math.PI / 5 * i - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
      q.append('path').attr('d', 'M' + p.join('L') + 'Z').style('fill', color).style('stroke', 'var(--page)').style('stroke-width', 2);
      return q;
    }
    R.qMega = quake(360, slabTop(360) + 2, 'var(--megathrust)');
    R.qDeep = quake(640, slabTop(640) + 18, 'var(--deep)');
    R.qCrust = quake(592, 205, 'var(--crustal)');

    // Odds overlay
    R.odds = g.append('g').style('opacity', 0);
    R.odds.append('rect').attr('x', 120).attr('y', 70).attr('width', 660).attr('height', 330).attr('rx', 14).style('fill', 'var(--surface-1)').style('opacity', 0.94);
    R.odds.append('text').attr('x', 450).attr('y', 112).attr('text-anchor', 'middle').attr('class', 'lab').style('font-size', '20px').text('Chance in the next 50 years');
    R.oddsNums = [['Deep M6.5+', 'var(--deep)', 85, null], ['Crustal M6.5+', 'var(--crustal)', 17, null], ['Cascadia M9', 'var(--megathrust)', 10, 15]].map(function (o, i) {
      var cx = 230 + i * 220;
      R.odds.append('circle').attr('cx', cx).attr('cy', 210).attr('r', 62).style('fill', 'none').style('stroke', o[1]).style('stroke-width', 8);
      var n = R.odds.append('text').attr('x', cx).attr('y', o[3] ? 219 : 222).attr('text-anchor', 'middle').attr('class', 'lab-big').style('font-size', o[3] ? '26px' : '34px');
      R.odds.append('text').attr('x', cx).attr('y', 310).attr('text-anchor', 'middle').attr('class', 'lab').text(o[0]);
      return { node: n, to: o[2], hi: o[3] };
    });
    R.odds.append('text').attr('x', 450).attr('y', 368).attr('text-anchor', 'middle').attr('class', 'lab-s').text('Deep and crustal: Puget Sound region. Source: USGS Fact Sheet 2025–3050.');
  }

  // ---------------------------------------------------------------- rendering a frame
  function pathFrom(points) { return 'M' + points.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'); }
  function rings(q, t0, t, maxR) {
    var dt = t - t0, active = dt >= 0 && dt < 5;
    q.style('opacity', active ? Math.min(1, dt * 4) * (dt > 4 ? 5 - dt : 1) : 0);
    q.rings.forEach(function (c, k) {
      var r = Math.max(0, (dt - k * 0.45) * maxR);
      c.attr('r', r).style('opacity', active ? Math.max(0, 1 - r / (maxR * 3.2)) : 0);
    });
  }

  function renderAt(t) {
    var lock = lockAt(t);
    var xsW = d3.range(0, 901, 6);
    // Plate
    var top = xsW.map(function (x) { return [x, slabTop(x)]; }), bottom = xsW.slice().reverse().map(function (x) { return [x, slabTop(x) + TH]; });
    R.plate.attr('d', pathFrom(top.concat(bottom)) + 'Z');
    R.stripes.attr('d', pathFrom(xsW.map(function (x) { return [x, slabTop(x) + TH / 2]; })))
      .style('stroke-dashoffset', -(t < T_RUPTURE ? t * 22 : T_RUPTURE * 22 + (t - T_RUPTURE) * 8 + Math.min(1, t - T_RUPTURE) * 40));

    // Continent (between surface and slab) and its surface
    var surf = d3.range(TRENCH, 901, 4).map(function (x) { return [x, surfaceY(x, lock)]; });
    var under = d3.range(900, TRENCH - 1, -6).map(function (x) { return [x, slabTop(x)]; });
    R.continent.attr('d', pathFrom(surf.concat(under)) + 'Z');
    R.surface.attr('d', pathFrom(surf));

    // Water and tsunami
    var wl = d3.range(0, COAST + 31, 4).map(function (x) { return [x, Math.min(waterY(x, t), x < COAST ? 400 : SEA)]; });
    var bed = d3.range(COAST, -1, -6).map(function (x) { return [x, x <= TRENCH ? 205 : shelfY(x, lock)]; });
    R.water.attr('d', pathFrom(wl.filter(function (p) { return p[0] <= COAST; }).concat(bed)) + 'Z');
    R.waterLine.attr('d', pathFrom(wl.filter(function (p) { return p[0] <= COAST; })));
    var floodOn = t > T_RUPTURE + 1 && t < T_RUPTURE + 6;
    R.flood.style('opacity', floodOn ? 0.35 * Math.min(1, (t - T_RUPTURE - 1) * 2) * Math.min(1, (T_RUPTURE + 6 - t)) : 0);

    // Locked zone glow
    var lockedPts = d3.range(TRENCH, 476, 4).map(function (x) { return [x, slabTop(x)]; });
    R.locked.attr('d', pathFrom(lockedPts))
      .style('stroke-width', t >= T_RUPTURE && t < T_RUPTURE + 2 ? 10 : 6)
      .style('opacity', t < 9 ? 0.15 : t < T_RUPTURE ? 0.3 + 0.7 * Math.max(0, lock) : t < T_RUPTURE + 2 ? 1 : 0.25);

    // Strain meter (visible while locking and through the rupture)
    R.meter.style('opacity', t >= 8 && t < 33 ? 1 : 0);
    R.meterFill.attr('width', 150 * Math.max(0, lock));

    // Trees: green until the coast drops, then gray (ghost forest)
    var dead = smooth(T_RUPTURE + 2, T_RUPTURE + 5, t);
    R.trees.selectAll('g').each(function () {
      var x = +this.getAttribute('data-x');
      d3.select(this).attr('transform', 'translate(' + x + ',' + landY(x, lock).toFixed(1) + ')')
        .select('.crown').style('fill', dead > 0.5 ? 'var(--text-muted)' : 'var(--crustal)').style('opacity', 1 - 0.4 * dead);
    });
    R.ghostLabel.style('opacity', dead);

    // City shaking when waves pass
    var shake = 0;
    [[T_RUPTURE, 1.5], [T_DEEP, 3.5], [T_CRUSTAL, 4.5]].forEach(function (s) { var dt = t - s[0]; if (dt > 0.6 && dt < 3.5) shake = s[1] * Math.sin(dt * 42) * (1 - (dt - 0.6) / 2.9); });
    var cityX = 640, crustStep = t >= T_CRUSTAL ? 3 : 0;
    R.city.attr('transform', 'translate(' + (cityX + shake).toFixed(1) + ',' + (landY(cityX, lock) + crustStep).toFixed(1) + ')');

    // Quakes
    rings(R.qMega, T_RUPTURE, t, 150);
    rings(R.qDeep, T_DEEP, t, 110);
    rings(R.qCrust, T_CRUSTAL, t, 110);
    R.fault.style('opacity', t >= 43 && t < 53 ? 1 : 0.35).style('stroke-width', t >= T_CRUSTAL && t < T_CRUSTAL + 2 ? 5 : 3);
    R.arrow.style('opacity', t < 19 ? 1 : 0.4);

    // Odds overlay
    var od = smooth(53, 54, t);
    R.odds.style('opacity', od);
    var count = smooth(53.5, 56, t);
    R.oddsNums.forEach(function (o) {
      o.node.text(o.hi ? Math.round(o.to * count) + '–' + Math.round(o.hi * count) + '%' : Math.round(o.to * count) + '%');
    });
  }

  // ---------------------------------------------------------------- player
  var state = { t: 0, playing: false, speed: 1 }, raf = null, last = 0;
  function chapterAt(t) { var c = 0; CHAPTERS.forEach(function (ch, i) { if (t >= ch.t) c = i; }); return c; }
  function fmt(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  function update() {
    renderAt(state.t);
    var c = chapterAt(state.t), ch = CHAPTERS[c];
    $('caption').textContent = ch.caption;
    $('chapter-badge').textContent = (c + 1) + '. ' + ch.title;
    $('scrub').value = state.t;
    $('time-out').textContent = fmt(state.t) + ' / ' + fmt(DURATION);
    $('play-btn').textContent = state.playing ? '❚❚ Pause' : state.t >= DURATION - 0.01 ? '↺ Replay' : '▶ Play';
    $('play-btn').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    document.querySelectorAll('#chapters button').forEach(function (b, i) {
      b.setAttribute('aria-current', String(i === c));
      var start = CHAPTERS[i].t, end = i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].t : DURATION;
      b.querySelector('.bar').style.width = (Math.max(0, Math.min(1, (state.t - start) / (end - start))) * 100) + '%';
    });
    $('anim').setAttribute('aria-label', 'Chapter ' + (c + 1) + ': ' + ch.title + '. ' + ch.caption);
  }

  function seek(t) { state.t = Math.max(0, Math.min(DURATION, t)); update(); }
  function play() {
    if (state.t >= DURATION - 0.01) state.t = 0;
    state.playing = true; last = performance.now();
    cancelAnimationFrame(raf);
    function frame(now) {
      if (!state.playing) return;
      state.t = Math.min(DURATION, state.t + (now - last) / 1000 * state.speed); last = now;
      if (state.t >= DURATION) state.playing = false;
      update();
      if (state.playing) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    update();
  }
  function pause() { state.playing = false; cancelAnimationFrame(raf); update(); }

  function init() {
    build();
    var list = $('chapters');
    CHAPTERS.forEach(function (ch, i) {
      var li = el('li'), b = el('button');
      b.type = 'button';
      b.appendChild(el('span', 'n', 'Chapter ' + (i + 1)));
      b.appendChild(document.createTextNode(ch.title));
      b.appendChild(el('span', 'bar'));
      b.addEventListener('click', function () { seek(ch.t + 0.01); });
      li.appendChild(b); list.appendChild(li);
    });
    $('play-btn').addEventListener('click', function () { if (state.playing) pause(); else play(); });
    $('restart-btn').addEventListener('click', function () { seek(0); play(); });
    // Read the slider before pausing: pause() redraws and would reset the slider to the old time.
    $('scrub').addEventListener('input', function (ev) { var v = +ev.target.value; pause(); seek(v); });
    document.querySelectorAll('#speed-buttons button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.speed = +b.dataset.speed;
        document.querySelectorAll('#speed-buttons button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      b.setAttribute('aria-pressed', String(+b.dataset.speed === state.speed));
    });
    document.addEventListener('keydown', function (ev) {
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName) && ev.key === ' ') return;
      if (ev.key === ' ') { ev.preventDefault(); if (state.playing) pause(); else play(); }
      else if (ev.key === 'ArrowRight') { var c = chapterAt(state.t); if (c + 1 < CHAPTERS.length) seek(CHAPTERS[c + 1].t + 0.01); }
      else if (ev.key === 'ArrowLeft') { var c2 = chapterAt(state.t); seek(CHAPTERS[Math.max(0, state.t - CHAPTERS[c2].t > 1.5 ? c2 : c2 - 1)].t + 0.01); }
    });
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
