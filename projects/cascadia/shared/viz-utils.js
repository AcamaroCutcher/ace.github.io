/* Small helpers shared by visualization pages. Plain script: exposes window.VizUtils. */
(function () {
  'use strict';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  window.VizUtils = {
    $: function (id) { return document.getElementById(id); },

    /** Create an HTML element. Text is always set with textContent (never innerHTML). */
    el: function (tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    },

    svg: function (tag, attrs, parent) {
      var n = document.createElementNS(SVG_NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    },

    /** Percent with sensible precision; `digits` forces fixed decimals. */
    fmtPct: function (p, digits) {
      var v = p * 100;
      if (digits != null) return v.toFixed(digits) + '%';
      if (v === 0) return '0%';
      if (v > 0 && v < 0.1) return '<0.1%';
      if (v < 1) return v.toFixed(1) + '%';
      if (v >= 99.5 && v < 100) return '>99%';
      return Math.round(v) + '%';
    },

    fmtInt: function (n) { return Math.round(n).toLocaleString('en-US'); },

    /** Short colored stroke used as a series key in legends and tooltips. */
    keyLine: function (color) {
      var k = document.createElement('span');
      k.className = 'key-line';
      k.style.background = color;
      return k;
    },

    keyRect: function (color) {
      var k = document.createElement('span');
      k.className = 'key-rect';
      k.style.background = color;
      return k;
    },

    /** Resolve a CSS custom property (e.g. '--deep') to its current value, for <canvas>. */
    cssVar: function (name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },

    /** Seeded PRNG (mulberry32): same seed gives the same sequence, so runs are reproducible. */
    rng: function (seed) {
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    prefersReducedMotion: function () {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
  };
})();
