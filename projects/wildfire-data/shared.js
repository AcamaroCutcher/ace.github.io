// Fire Archive page: navigation, theme and reveal shared with the Survival Radio page,
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


/* ------------------------------------------------------------------ tuner navigation */
function tuner() {
  const scale = $('scale'), needle = $('needle'), readout = $('readout'), menu = $('chanMenu'), mb = $('menuBtn');
  const chans = [...menu.querySelectorAll('a')].map((a) => ({ id: a.getAttribute('href').slice(1), no: a.dataset.no, name: a.textContent.replace(a.dataset.no, '').trim() }));
  const items = chans.map((c) => ({ ...c, el: document.getElementById(c.id) })).filter((c) => c.el);
  const pos = (i) => 3 + (i / (items.length - 1)) * 94;          // % across the scale
  function build() {
    const narrow = scale.clientWidth / items.length < 84;
    let h = '';
    for (let k = 0; k <= 120; k++) h += `<span class="tick${k % 8 === 0 ? ' mj' : ''}" style="left:${3 + k / 120 * 94}%"></span>`;
    items.forEach((c, i) => { h += `<a class="ch" href="#${c.id}" data-i="${i}" style="left:${pos(i)}%" title="${c.no} ${c.name}" data-full="${c.no} ${c.name}" data-short="${narrow ? c.no : c.no + ' ' + c.name}">${narrow ? c.no : c.no + ' ' + c.name}</a>`; });
    scale.innerHTML = h;
  }
  build(); addEventListener('resize', () => { clearTimeout(build.t); build.t = setTimeout(build, 150); });
  $('tuner').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const r = scale.getBoundingClientRect(), p = (e.clientX - r.left) / r.width * 100;
    let best = 0; items.forEach((c, i) => { if (Math.abs(pos(i) - p) < Math.abs(pos(best) - p)) best = i; });
    items[best].el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  });
  mb.addEventListener('click', () => { const o = menu.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) { menu.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target !== mb) menu.classList.remove('open'); });
  let ticking = false, lastI = -2;
  function update() {
    ticking = false;
    const line = innerHeight * 0.35;
    let i = -1;
    for (let k = 0; k < items.length; k++) if (items[k].el.getBoundingClientRect().top <= line) i = k;
    let left;
    if (i < 0) { const top = items[0].el.getBoundingClientRect().top; left = Math.max(0, 3 * (1 - (top - line) / innerHeight)); }
    else {
      const a = items[i].el.getBoundingClientRect(), nx = items[i + 1] ? items[i + 1].el.getBoundingClientRect().top : a.bottom;
      const f = Math.max(0, Math.min(1, (line - a.top) / Math.max(1, nx - a.top)));
      left = i + 1 < items.length ? lerp(pos(i), pos(i + 1), f) : pos(i);
    }
    needle.style.left = left + '%';
    if (i !== lastI) {
      lastI = i;
      readout.textContent = i < 0 ? 'CH 00 · STANDBY' : `CH ${items[i].no} · ${items[i].name.toUpperCase()}`;
      for (const a of scale.querySelectorAll('.ch')) { const on = +a.dataset.i === i; a.classList.toggle('on', on); a.textContent = on ? a.dataset.full : a.dataset.short; }
    }
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
