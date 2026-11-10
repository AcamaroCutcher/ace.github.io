/*
 * Runs in <head>, before the page paints, so there is no flash of the wrong theme.
 * Order of preference: the visitor's saved choice, then the operating system setting.
 * The storage key is shared with the interactive projects so one choice covers the whole site.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem('quake-viz-theme') || localStorage.getItem('theme');
  } catch (e) { /* storage unavailable */ }
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.toggle('dark-mode', dark);
  root.classList.add('js');
})();
