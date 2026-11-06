/* Typeset $$...$$ (display) and \(...\) (inline) with the vendored KaTeX. */
(function () {
  'use strict';
  function go() {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(document.body, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false, ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
