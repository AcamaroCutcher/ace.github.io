// Written guide for the Survival Radio page.
// Renders the part cards and shopping list from data.js, wires "View in 3D" buttons to the
// viewer (app.js exposes window.SR), and highlights the table of contents while scrolling.
// It does not depend on three.js, so the guide still works if the 3D viewer fails to load.
import { CAT, COMP_INFO, TIER_NAMES, BOM } from './data.js';

const $ = (id) => document.getElementById(id);

// Category order and anchors used by the table of contents and the viewer's "Read more" links
const CAT_ORDER = [
  ['brain', 'g-brain', 'Two small computers share the work. The <b>controller</b> runs your own program; the <b>mesh radio</b> runs stock Meshtastic firmware so the phone app, updates and community support all just work. They talk over a serial cable (UART 2 in the wiring table).'],
  ['sat', 'g-sat', 'The satellite layer reaches anyone, anywhere you can see the sky. The modem and antenna are certified parts: you connect them, you never modify them. The 406 MHz beacon is the separate, independent backstop.'],
  ['loc', 'g-loc', 'Where you are, and whether you have fallen or the ground is shaking. Both plug into the controller\'s I²C bus with Qwiic / STEMMA QT cables.'],
  ['sense', 'g-sense', 'The air sensors live in a separate pod on a cable, so they sample the air you breathe and not the warm air inside a sealed box. Readings travel back over I²C and one UART through an 8-pin M12 connector.'],
  ['power', 'g-power', 'Store plenty of energy, accept it from anything (USB-C, solar, a hand crank) and switch off whatever isn\'t needed right now.'],
  ['ui', 'g-ui', 'Readable in full sun with zero power, usable with gloves, and impossible to trigger by accident.'],
  ['rugged', 'g-rugged', 'Waterproof, drop-proof, and every hole sealed. The printed parts are in the downloads.'],
  ['ext', 'g-carry', 'Gear you carry alongside the hub. Each one is a separate path to help, so one failure doesn\'t leave you without options.'],
];
const SKIP = new Set(['pack', 'packSolar', 'mast', 'iridiumSat']); // shown in the 3D view only

const has3D = (id) => (window.SR && window.SR.has ? window.SR.has(id) : true);

function show3D(fn) {
  const go = () => { fn(); $('model').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if (window.SR && window.SR.ready && window.SR.ready()) go();
  else { $('model').scrollIntoView({ behavior: 'smooth', block: 'start' }); window.addEventListener('sr-ready', go, { once: true }); }
}

// ---------------------------------------------------------------------------------------------
// Part cards
// ---------------------------------------------------------------------------------------------
function card(id, i) {
  const cat = CAT[i.cat];
  const buy = i.buy && i.buy.length
    ? `<div class="buy">${i.buy.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div>` : '';
  const specs = i.specs && i.specs.length
    ? `<table class="spec">${i.specs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>` : '';
  const row = (k, v) => (v && v !== '—' ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  return `<div class="part-card" id="part-${id}" style="border-top:3px solid ${cat.color}">
    <h4>${i.name}<button class="view3d" data-id="${id}" type="button">View in 3D</button></h4>
    <div class="meta"><span class="pill t${i.tier}">${TIER_NAMES[i.tier]}</span> ${i.part} · <b>${i.price}</b></div>
    ${buy}
    <dl>${row('What it does', i.what)}${row('Why this one', i.why)}${row('How it connects', i.connects)}${row('Power', i.power)}${specs ? `<dt>Key specs</dt><dd>${specs}</dd>` : ''}</dl>
  </div>`;
}

function renderParts() {
  const el = $('partsList'); if (!el) return;
  let html = '';
  for (const [key, anchor, intro] of CAT_ORDER) {
    const ids = Object.keys(COMP_INFO).filter((id) => COMP_INFO[id].cat === key && !SKIP.has(id));
    if (!ids.length) continue;
    html += `<h3 id="${anchor}" style="color:${CAT[key].color}">${CAT[key].label}</h3><p class="cat-intro">${intro}</p>
      <div class="parts-grid">${ids.map((id) => card(id, COMP_INFO[id])).join('')}</div>`;
  }
  el.innerHTML = html;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.view3d'); if (!b) return;
    show3D(() => window.SR.select(b.dataset.id));
  });
}

// Hide "View in 3D" for anything the viewer doesn't contain (checked once the viewer is up)
function pruneButtons() {
  for (const b of document.querySelectorAll('.view3d[data-id]')) if (!has3D(b.dataset.id)) b.remove();
}

// ---------------------------------------------------------------------------------------------
// Shopping list
// ---------------------------------------------------------------------------------------------
function parsePrice(p) {
  const s = String(p).replace(/[$,~\s]/g, '');
  if (/\/mo|varies/.test(s)) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  return [a, m[2] ? parseFloat(m[2]) : a];
}
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

function renderBOM() {
  const t = $('bomTable'); if (!t) return;
  const extra = new Set(['Solar panel', 'Hand crank', 'Airtime']);
  let lo = 0, hi = 0;
  for (const [cat, item, , qty, price] of BOM) {
    if (cat === 'Carry-along' || extra.has(item)) continue;
    const p = parsePrice(price); if (!p) continue;
    lo += p[0] * qty; hi += p[1] * qty;
  }
  let rows = '<tr><th>Item</th><th>Example part</th><th>Qty</th><th>Price</th><th></th></tr>';
  let last = '';
  for (const [cat, item, part, qty, price, url] of BOM) {
    if (cat !== last) { rows += `<tr><td colspan="5" style="color:var(--accent);font-weight:600;padding-top:16px">${cat}</td></tr>`; last = cat; }
    const pr = /^\d/.test(price) ? '$' + price : /^~\d/.test(price) ? '~$' + price.slice(1) : price;
    rows += `<tr><td>${item}</td><td>${part}</td><td>${qty}</td><td style="white-space:nowrap">${pr}</td><td style="white-space:nowrap">${url ? `<a href="${url}" target="_blank" rel="noopener">buy ↗</a>` : ''}</td></tr>`;
  }
  t.innerHTML = rows;
  const tot = $('bomTotal');
  if (tot) tot.innerHTML = `The hub itself comes to roughly <b>${money(lo)}–${money(hi)}</b> in parts (the methane sensor's price varies by seller and is not included). The satellite modem is about a quarter of that. Add a solar panel and hand crank ($100–250), a registered PLB ($300–450), and satellite airtime ($15 a month plus data). <a href="downloads/bom.csv" download>Download as CSV</a>.`;
}

// ---------------------------------------------------------------------------------------------
// Diagram blocks and "Show in 3D" buttons on the connection sections
// ---------------------------------------------------------------------------------------------
function wireDiagram() {
  for (const g of document.querySelectorAll('#g-diagram .blk[data-c]')) {
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    const go = () => show3D(() => window.SR.select(g.dataset.c));
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  const linkFor = { 'g-uart': 'uart', 'g-i2c': 'i2c', 'g-spi': 'spi', 'g-gpio': 'gpio', 'g-pwrwire': 'pwr', 'g-rf': 'rf' };
  for (const [anchor, key] of Object.entries(linkFor)) {
    const h = $(anchor); if (!h) continue;
    const b = document.createElement('button');
    b.className = 'view3d'; b.type = 'button'; b.textContent = 'Show in 3D';
    b.addEventListener('click', () => show3D(() => window.SR.link(key)));
    h.appendChild(b);
  }
  const phone = document.querySelector('#g-phone h3');
  if (phone) {
    const b = document.createElement('button');
    b.className = 'view3d'; b.type = 'button'; b.textContent = 'Show in 3D';
    b.addEventListener('click', () => show3D(() => window.SR.link('ble')));
    phone.appendChild(b);
  }
}

// ---------------------------------------------------------------------------------------------
// Table of contents: highlight the section being read
// ---------------------------------------------------------------------------------------------
function tocSpy() {
  // Highlight the last section heading that has scrolled past the reading line
  const links = [...document.querySelectorAll('#toc a[href^="#g-"]')];
  const items = links.map((a) => [document.getElementById(a.getAttribute('href').slice(1)), a]).filter(([t]) => t);
  if (!items.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = 90;
    let cur = null;
    for (const [t, a] of items) if (t.getBoundingClientRect().top <= line) cur = a; else if (cur) break;
    for (const a of links) a.classList.toggle('on', a === cur);
  };
  // items are in document order, so the loop can stop at the first heading below the line
  items.sort((x, y) => (x[0].compareDocumentPosition(y[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

renderParts();
renderBOM();
wireDiagram();
tocSpy();
if (window.SR && window.SR.ready && window.SR.ready()) pruneButtons();
else window.addEventListener('sr-ready', pruneButtons, { once: true });
// Arriving with a #part-… or #g-… link: content was rendered after load, so jump again
if (location.hash && location.hash.length > 1) {
  const t = document.getElementById(location.hash.slice(1));
  if (t) requestAnimationFrame(() => t.scrollIntoView());
}
