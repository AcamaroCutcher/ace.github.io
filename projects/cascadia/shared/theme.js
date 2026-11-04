/* Light/dark toggle shared by all pages. Follows the OS setting until the viewer picks one. */
(function () {
  'use strict';
  var KEY = 'quake-viz-theme';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function current() {
    return root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  var saved = stored();
  if (saved) root.setAttribute('data-theme', saved);

  // Pages that draw to <canvas> listen for this to re-read CSS colors.
  function announce() { document.dispatchEvent(new Event('quake-themechange')); }
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', announce);

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    function label() { btn.textContent = current() === 'dark' ? 'Light mode' : 'Dark mode'; }
    label();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* storage unavailable */ }
      label();
      announce();
    });
  });
})();
