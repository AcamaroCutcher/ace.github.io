// Fire Archive page: navigation, theme toggle and reveal-on-scroll,
// plus this page's interactive figures. Data files in ./data are generated from the database.
const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark = () => document.documentElement.classList.contains('dark-mode');
/* ------------------------------------------------------------------ noise */
const perm = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  let s = 1337; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(lerp(lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u),
    lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}


/* ------------------------------------------------------------------ section navigation */
// Sections are labelled like spectral bands (B01, B02 ...). The header highlights the band you are
// reading, and a thermal-coloured bar shows how far down the page you are.
function tuner() {
  const menu = $('chanMenu'), mb = $('menuBtn'), bands = $('bands'), bar = $('progress');
  const items = [...menu.querySelectorAll('a')]
    .map((a) => ({ id: a.getAttribute('href').slice(1), no: a.dataset.no, name: a.textContent.replace(a.dataset.no, '').trim() }))
    .map((c) => ({ ...c, el: document.getElementById(c.id) }))
    .filter((c) => c.el);
  bands.innerHTML = items.map((c, i) => `<a href="#${c.id}" data-i="${i}"><span>B${c.no}</span><em>${c.name}</em></a>`).join('');
  for (const a of menu.querySelectorAll('a span')) a.textContent = 'B' + a.textContent;

  mb.addEventListener('click', () => { const open = menu.classList.toggle('open'); mb.setAttribute('aria-expanded', open); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.classList.remove('open'); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target !== mb) menu.classList.remove('open'); });

  let current = -2, ticking = false;
  function update() {
    ticking = false;
    const doc = document.documentElement;
    bar.style.width = (100 * scrollY / Math.max(1, doc.scrollHeight - innerHeight)).toFixed(1) + '%';
    const line = innerHeight * 0.35;
    let i = -1;
    items.forEach((c, k) => { if (c.el.getBoundingClientRect().top <= line) i = k; });
    if (i === current) return;
    current = i;
    for (const a of bands.children) a.classList.toggle('on', +a.dataset.i === i);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ------------------------------------------------------------------ reveal + clock */
function reveal() {
  const els = document.querySelectorAll('.body > h2, .body > figure, .body > .callout, .body > .tbl-wrap, .rail, .satchart, .er, .linkdemo, .hostgrid, .cases');
  els.forEach((e) => e.classList.add('rv'));
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

/* ------------------------------------------------------------------ theme toggle (key shared with the rest of the site) */
function theme() {
  const b = $('themeBtn'), root = document.documentElement; if (!b) return;
  const sync = () => { const d = isDark(); b.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); b.setAttribute('aria-pressed', String(d)); };
  b.addEventListener('click', () => {
    const d = !isDark(); root.classList.toggle('dark-mode', d);
    try { localStorage.setItem('quake-viz-theme', d ? 'dark' : 'light'); } catch (e) { /* storage unavailable */ }
    sync();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
    let saved = null; try { saved = localStorage.getItem('quake-viz-theme') || localStorage.getItem('theme'); } catch (err) { /* ignore */ }
    if (!saved) { root.classList.toggle('dark-mode', e.matches); sync(); }
  });
  sync();
}


export { noise3, tuner, reveal, theme, $, REDUCED, isDark, lerp };
