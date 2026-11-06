/*
 * Ignition animation on the WUI fuel map.
 *
 * <div class="firemap" data-root="../">  (data-root = path to the project folder)
 *   <canvas></canvas>
 * </div>
 *
 * Data (img/fire/): fire-arrival.png is the 640 x 669 model grid; each pixel holds when that 30 m
 * cell catches fire on the animation clock (0 = never). It comes from the project's own
 * Rothermel + minimum-travel-time model: 60 of the ensemble's random east-wind ignitions,
 * started 18 minutes apart, each burning for 8 hours. fire-anim.json has the clock length and
 * ignition cells. The base map has a light and a dark version and follows the theme toggle.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOOP_SECONDS = 26, HOLD_SECONDS = 3;

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }

  function FireMap(host) {
    var root = host.getAttribute('data-root') || '';
    var fy = parseFloat(host.getAttribute('data-focus-y') || '0.5');
    var canvas = host.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var hud = host.querySelector('[data-hud]');
    var btn = host.querySelector('[data-play]');
    var fire = document.createElement('canvas');
    var glow = document.createElement('canvas'), gctx, hot = document.createElement('canvas'), hctx, himg;   // tiny copy of the fire layer, upscaled = soft glow
    var fctx, img, grid, meta, arrival, burned, bases = {}, W = 0, H = 0, dpr = 1;
    var lastT = 0, playing = !reduce, visible = false, t0 = performance.now(), paused = 0, embers = [];

    Promise.all([
      fetch(root + 'img/fire/fire-anim.json').then(function (r) { return r.json(); }),
      loadImg(root + 'img/fire/fire-arrival.png'),
      loadImg(root + 'img/fire/fuelmap-dark.jpg'),
      loadImg(root + 'img/fire/fuelmap-light.jpg')
    ]).then(function (r) {
      meta = r[0]; bases.dark = r[2]; bases.light = r[3];
      var gw = meta.width, gh = meta.height;
      var c = document.createElement('canvas'); c.width = gw; c.height = gh;
      var g = c.getContext('2d'); g.drawImage(r[1], 0, 0);
      var px = g.getImageData(0, 0, gw, gh).data;
      arrival = new Float32Array(gw * gh);
      burned = [];
      for (var i = 0; i < gw * gh; i++) {
        var v = px[i * 4];
        arrival[i] = v ? (v - 1) / 254 * meta.minutes : -1;
        if (v) burned.push(i);
      }
      fire.width = gw; fire.height = gh;
      fctx = fire.getContext('2d');
      hot.width = gw; hot.height = gh; hctx = hot.getContext('2d'); himg = hctx.createImageData(gw, gh);
      glow.width = Math.ceil(gw / 6); glow.height = Math.ceil(gh / 6);
      gctx = glow.getContext('2d');
      gctx.imageSmoothingEnabled = true;
      img = fctx.createImageData(gw, gh);
      grid = { w: gw, h: gh };
      size();
      host.classList.add('ready');
      if (reduce) { draw(meta.minutes + 1e6); } else { requestAnimationFrame(loop); }
    }).catch(function () { host.classList.add('failed'); });

    function size() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // "cover" placement of the 640 x 669 grid in the canvas, with a vertical focus point
    function place() {
      var s = Math.max(W / grid.w, H / grid.h);
      var dw = grid.w * s, dh = grid.h * s;
      return { s: s, x: (W - dw) / 2, y: Math.min(0, Math.max(H - dh, H / 2 - dh * fy)), w: dw, h: dh };
    }

    function clockMinutes(now) {
      var cycle = (LOOP_SECONDS + HOLD_SECONDS) * 1000;
      var e = ((now - t0) % cycle) / 1000;
      return Math.min(e / LOOP_SECONDS, 1) * meta.minutes;
    }

    function draw(t) {
      lastT = t;
      var dark = isDark();
      var p = place();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(dark ? bases.dark : bases.light, p.x, p.y, p.w, p.h);

      // fire layer: front -> flames -> embers -> char
      var d = img.data, i, k, age, a;
      d.fill(0);
      var hd = himg.data; hd.fill(0);
      for (k = 0; k < burned.length; k++) {
        i = burned[k];
        age = t - arrival[i];
        if (age < 0) continue;
        var o = i * 4;
        if (age < 12) {            // flame front
          d[o] = 255; d[o + 1] = 236; d[o + 2] = 160; a = 255;
        } else if (age < 70) {     // flaming
          var f = (age - 12) / 58;
          d[o] = 255; d[o + 1] = Math.round(170 - 110 * f); d[o + 2] = Math.round(40 - 30 * f); a = 245;
        } else if (age < 220) {    // smouldering
          var s = (age - 70) / 150;
          d[o] = Math.round(200 - 120 * s); d[o + 1] = Math.round(40 - 20 * s); d[o + 2] = 12; a = 230;
        } else {                   // burned
          if (dark) { d[o] = 52; d[o + 1] = 24; d[o + 2] = 16; a = 220; }
          else { d[o] = 74; d[o + 1] = 44; d[o + 2] = 34; a = 215; }
        }
        d[o + 3] = a;
        if (age < 220) { hd[o] = d[o]; hd[o + 1] = d[o + 1]; hd[o + 2] = d[o + 2]; hd[o + 3] = a; }
      }
      fctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fire, p.x, p.y, p.w, p.h);
      // glow pass: shrink the fire layer 6x and draw it back up with smoothing (cheap blur, works everywhere)
      gctx.clearRect(0, 0, glow.width, glow.height);
      hctx.putImageData(himg, 0, 0);
      gctx.drawImage(hot, 0, 0, glow.width, glow.height);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx.globalAlpha = dark ? 0.7 : 0.3;
      ctx.drawImage(glow, p.x, p.y, p.w, p.h);
      ctx.globalAlpha = 1;

      // ignition pings
      ctx.globalCompositeOperation = 'source-over';
      var lit = 0;
      meta.ignitions.forEach(function (g) {
        var since = t - g[2];
        if (since < 0) return;
        lit++;
        if (since < 45) {
          var q = since / 45;
          var x = p.x + (g[1] + 0.5) * p.s, y = p.y + (g[0] + 0.5) * p.s;
          ctx.strokeStyle = 'rgba(255,' + (dark ? 220 : 120) + ',80,' + (1 - q) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 4 + q * 26, 0, 6.283); ctx.stroke();
        }
      });

      // embers lofted from active flames, carried west by the east wind
      if (!reduce) {
        if (embers.length < 140 && burned.length) {
          for (var n = 0; n < 6; n++) {
            var c = burned[(Math.random() * burned.length) | 0];
            var ag = t - arrival[c];
            if (ag >= 0 && ag < 70) {
              embers.push({ x: p.x + (c % grid.w + Math.random()) * p.s, y: p.y + ((c / grid.w | 0) + Math.random()) * p.s,
                            vx: -(20 + Math.random() * 45), vy: -(6 + Math.random() * 18), life: 0, ttl: 1.2 + Math.random() * 1.8 });
            }
          }
        }
        ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        for (var j = embers.length - 1; j >= 0; j--) {
          var e = embers[j];
          e.life += 1 / 60; e.x += e.vx / 60; e.y += e.vy / 60;
          if (e.life > e.ttl) { embers.splice(j, 1); continue; }
          var al = Math.sin(Math.PI * e.life / e.ttl);
          ctx.fillStyle = 'rgba(255,' + (150 + (Math.random() * 60 | 0)) + ',40,' + al + ')';
          ctx.fillRect(e.x, e.y, 2, 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      if (hud) {
        var hrs = Math.min(t, meta.minutes) / 60;
        hud.textContent = (t >= meta.minutes ? 'All ' + meta.ignitions.length + ' fires after 8 h of burning'
          : 'Hour ' + hrs.toFixed(1) + ' · ' + lit + ' of ' + meta.ignitions.length + ' fires ignited') +
          ' · east wind ' + meta.wind_mph + ' mph ←';
      }
    }

    function loop(now) {
      if (playing && visible) draw(clockMinutes(now));
      requestAnimationFrame(loop);
    }

    if (btn) {
      btn.addEventListener('click', function () {
        if (reduce) { reduce = false; playing = true; t0 = performance.now(); btn.textContent = 'Pause'; requestAnimationFrame(loop); return; }
        playing = !playing;
        if (playing) { t0 += performance.now() - paused; } else { paused = performance.now(); }
        btn.textContent = playing ? 'Pause' : 'Play';
      });
      btn.textContent = reduce ? 'Play' : 'Pause';
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);
    } else { visible = true; }
    window.addEventListener('resize', function () { if (grid) { size(); if (!playing || reduce) draw(lastT); } });
    // redraw immediately when the theme changes (button or OS setting)
    function retheme() { if (grid && (!playing || reduce)) draw(lastT); }
    new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  }

  function init() { document.querySelectorAll('.firemap').forEach(FireMap); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
