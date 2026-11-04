/*
 * Floating navigation bar pinned to the bottom of every visualization page:
 *   [ ◀ Back ]   3 of 11 · What the record shows   [ Next ▶ ]
 * Back/Next follow the PAGES order below (the single source of truth); the middle opens the hub.
 * Page 01's Back and the last page's Next return to the hub. Plain script; works from disk too.
 */
(function () {
  'use strict';

  var PAGES = [
    { dir: '01-probability-explorer', title: 'What are the odds in the next 50 years?' },
    { dir: '02-monte-carlo', title: 'Roll the next 50 years' },
    { dir: '03-earthquake-record', title: 'What the record shows' },
    { dir: '04-small-quakes', title: 'Small quakes predict big ones' },
    { dir: '05-memory', title: 'Memory or no memory?' },
    { dir: '06-megathrust-history', title: '10,000 years of great Cascadia earthquakes' },
    { dir: '07-subduction-3d', title: 'Inside the subduction zone' },
    { dir: '08-story', title: 'Cascadia: what are the odds? (the story)' },
    { dir: '09-three-quakes', title: 'Three kinds of earthquakes' },
    { dir: '10-orphan-tsunami', title: 'The orphan tsunami of 1700' },
    { dir: 'prepare', title: 'Be prepared' },
  ];
  var HUB_HREF = '../index.html#projects';

  function currentIndex() {
    var parts = location.pathname.split('/').filter(Boolean);
    if (parts.length && /\.html?$/.test(parts[parts.length - 1])) parts.pop();
    var dir = decodeURIComponent(parts[parts.length - 1] || '');
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].dir === dir) return i;
    return -1;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function navButton(cls, href, arrow, word, aria, arrowFirst) {
    var a = el('a', 'fnav-btn ' + cls);
    a.href = href;
    a.setAttribute('aria-label', aria);
    a.title = aria;
    var ar = el('span', 'fnav-arrow', arrow);
    ar.setAttribute('aria-hidden', 'true');
    var w = el('span', 'fnav-word', word);
    if (arrowFirst) { a.appendChild(ar); a.appendChild(w); } else { a.appendChild(w); a.appendChild(ar); }
    return a;
  }

  function build() {
    var i = currentIndex();
    if (i < 0 || document.querySelector('.fnav')) return;
    var prev = PAGES[i - 1], next = PAGES[i + 1], cur = PAGES[i];

    var bar = el('nav', 'fnav');
    bar.setAttribute('aria-label', 'Visualization pages');
    bar.style.setProperty('--fnav-progress', ((i + 1) / PAGES.length * 100).toFixed(2) + '%');

    var progress = el('span', 'fnav-progress');
    progress.setAttribute('aria-hidden', 'true');
    bar.appendChild(progress);

    bar.appendChild(prev
      ? navButton('fnav-back', '../' + prev.dir + '/index.html', '◀', 'Back', 'Back: ' + prev.title, true)
      : navButton('fnav-back', HUB_HREF, '◀', 'Back', 'Back to all visualizations', true));

    var mid = el('a', 'fnav-mid');
    mid.href = HUB_HREF;
    mid.title = 'See all visualizations';
    mid.setAttribute('aria-label', 'Page ' + (i + 1) + ' of ' + PAGES.length + ': ' + cur.title + '. See all visualizations');
    mid.appendChild(el('span', 'fnav-pos', (i + 1) + ' of ' + PAGES.length));
    mid.appendChild(el('span', 'fnav-dot', '·'));
    mid.appendChild(el('span', 'fnav-title', cur.title));
    bar.appendChild(mid);

    bar.appendChild(next
      ? navButton('fnav-next', '../' + next.dir + '/index.html', '▶', 'Next', 'Next: ' + next.title, false)
      : navButton('fnav-next', HUB_HREF, '▶', 'Done', 'Done: back to all visualizations', false));

    document.body.appendChild(bar);
    document.body.classList.add('has-fnav');
    document.documentElement.classList.add('has-fnav');
    window.__pageNav = { index: i, pages: PAGES };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
