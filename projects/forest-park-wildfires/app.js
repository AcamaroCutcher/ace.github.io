/* Click a figure to view it full size. */
(function () {
  'use strict';
  var dlg = document.getElementById('viewer');
  var img = document.getElementById('viewer-img');
  var title = document.getElementById('viewer-title');
  if (!dlg || typeof dlg.showModal !== 'function') return;

  document.querySelectorAll('.zoom[data-full]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var thumb = btn.querySelector('img');
      img.src = btn.getAttribute('data-full');
      img.alt = thumb ? thumb.alt : '';
      var h = btn.closest('.fig') && btn.closest('.fig').querySelector('h3');
      title.textContent = h ? h.textContent : '';
      dlg.showModal();
    });
  });

  document.getElementById('viewer-close').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
