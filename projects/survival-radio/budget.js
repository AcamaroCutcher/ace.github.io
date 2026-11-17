// Budget kit builder: pick one option per layer, watch the total against a $500 budget,
// and see the kit laid out in its case. Choices are remembered in this browser only.
import { BITEMS, SLOTS, ADDONS, PRESETS } from './budget-data.js';

const $ = (id) => document.getElementById(id);
const BUDGET = 500;
const KEY = 'sr-budget-v1';
const money = (n, d = 2) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let state = fromPreset('core');
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.pick) state = s; } catch (e) { /* storage unavailable */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

function fromPreset(k) {
  const p = PRESETS[k], pick = {}, qty = {};
  for (const s of SLOTS) {
    const v = p.pick[s.id];
    if (Array.isArray(v)) { pick[s.id] = v[0]; qty[s.id] = v[1]; } else pick[s.id] = v ?? null;
  }
  return { pick, qty, addons: [...p.addons], preset: k };
}

function lines() {
  const out = [];
  for (const s of SLOTS) { const id = state.pick[s.id]; if (id) out.push({ slot: s, item: BITEMS[id], id, qty: s.qty ? (state.qty[s.id] || 1) : 1 }); }
  for (const a of state.addons) out.push({ slot: null, item: BITEMS[a], id: a, qty: 1 });
  return out;
}
function totals() {
  let lo = 0, hi = 0, monthly = 0;
  for (const l of lines()) { lo += l.item.price * l.qty; hi += (l.item.priceHi ?? l.item.price) * l.qty; monthly += (l.item.monthly || 0); }
  return { lo, hi, monthly };
}

/* ------------------------------------------------------------------ flat-lay illustration */
const ART = {
  node: (n) => [...Array(Math.min(n, 3)).keys()].map((i) => `<g transform="translate(${i * 18},${i * 14})"><rect x="0" y="0" width="64" height="42" rx="8" class="k-dark"/><circle cx="14" cy="21" r="5" class="k-led"/><rect x="28" y="11" width="28" height="20" rx="3" class="k-scr"/><path d="M64 10h10" class="k-ant"/></g>`).join(''),
  radio: () => `<rect x="0" y="0" width="160" height="96" rx="10" class="k-body"/><rect x="10" y="12" width="70" height="72" rx="6" class="k-grille"/>${[...Array(7).keys()].map((i) => `<path d="M18 ${22 + i * 9}h54" class="k-line"/>`).join('')}<circle cx="120" cy="34" r="18" class="k-dial"/><path d="M120 34l10-8" class="k-ant"/><rect x="94" y="62" width="52" height="14" rx="3" class="k-scr"/><path d="M160 30h16v40h-10" class="k-crank"/><path d="M14 0v-26" class="k-ant"/>`,
  walkie: (n) => [...Array(n).keys()].map((i) => `<g transform="translate(${i * 46},0)"><rect x="0" y="20" width="36" height="96" rx="8" class="k-dark"/><rect x="6" y="30" width="24" height="18" rx="2" class="k-scr"/>${[...Array(4).keys()].map((j) => `<path d="M8 ${62 + j * 8}h20" class="k-line"/>`).join('')}<path d="M26 20v-24" class="k-ant"/></g>`).join(''),
  phone: () => `<rect x="0" y="0" width="54" height="104" rx="10" class="k-dark"/><rect x="5" y="9" width="44" height="82" rx="4" class="k-scr"/><path d="M14 40l13-12 13 12M27 28v26" class="k-sos"/><text x="27" y="74" class="k-tiny" text-anchor="middle">SOS</text>`,
  plb: () => `<rect x="0" y="16" width="56" height="90" rx="12" class="k-yellow"/><path d="M40 16v-22" class="k-ant"/><rect x="10" y="34" width="36" height="20" rx="4" class="k-dark"/><circle cx="28" cy="76" r="9" class="k-red"/>`,
  msgr: () => `<rect x="0" y="10" width="62" height="88" rx="14" class="k-orange"/><rect x="12" y="24" width="38" height="26" rx="4" class="k-scr"/><circle cx="31" cy="72" r="8" class="k-dark"/>`,
  bank: () => `<rect x="0" y="0" width="128" height="62" rx="10" class="k-body"/>${[0, 1, 2, 3].map((i) => `<circle cx="${92 + i * 8}" cy="31" r="2.6" class="k-led"/>`).join('')}<rect x="12" y="20" width="14" height="22" rx="3" class="k-dark"/>`,
  solar: () => `<rect x="0" y="0" width="180" height="118" rx="6" class="k-panel"/>${[1, 2].map((i) => `<path d="M${i * 60} 0v118" class="k-cell"/>`).join('')}${[1, 2, 3].map((i) => `<path d="M0 ${i * 29.5}h180" class="k-cell"/>`).join('')}<rect x="150" y="96" width="24" height="16" rx="3" class="k-dark"/>`,
  cable: () => `<circle cx="34" cy="34" r="30" class="k-coil"/><circle cx="34" cy="34" r="22" class="k-coil"/><circle cx="34" cy="34" r="14" class="k-coil"/><path d="M64 34h20" class="k-coil"/>`,
  co: () => `<circle cx="38" cy="38" r="38" class="k-white"/><circle cx="38" cy="38" r="26" class="k-ring"/><text x="38" y="44" class="k-co" text-anchor="middle">CO</text><circle cx="58" cy="18" r="3" class="k-led"/>`,
  sensor: () => `<rect x="0" y="0" width="38" height="26" rx="3" class="k-pcb"/><rect x="13" y="8" width="12" height="10" rx="1" class="k-dark"/>`,
  sdr: () => `<rect x="0" y="0" width="90" height="26" rx="6" class="k-alu"/><rect x="90" y="7" width="14" height="12" rx="2" class="k-dark"/><path d="M-30 50l30-24 30 24" class="k-ant"/>`,
};
// where each slot sits in the case (case interior is 40..600 x 40..360)
const POS = { solar: [60, 64], radio: [262, 70], mesh: [470, 74], walkie: [500, 196], sat: [60, 210], bank: [150, 284], cable: [300, 278], co: [384, 196], sensor: [440, 300], sdr: [176, 210] };
function artFor(l) {
  const id = l.id, s = l.slot?.id;
  if (s === 'mesh') return ['mesh', ART.node(l.qty)];
  if (s === 'wx') return ['radio', ART.radio()];
  if (s === 'voice') return ['walkie', ART.walkie(id === 'voice-uv5r-mini' ? 1 : 2)];
  if (s === 'sat') return ['sat', id === 'sat-phone-sos' ? ART.phone() : /plb1|resqlink/.test(id) ? ART.plb() : ART.msgr()];
  if (s === 'bank') return ['bank', ART.bank()];
  if (s === 'solar') return ['solar', ART.solar()];
  if (s === 'cables') return ['cable', ART.cable()];
  if (s === 'co') return ['co', ART.co()];
  if (id === 'safe-bme280' || id === 'safe-bme688') return ['sensor', ART.sensor()];
  if (id === 'sdr-v4l-kit') return ['sdr', ART.sdr()];
  return null;
}
function drawArt() {
  const caseId = state.pick.case;
  const shell = caseId === 'case-drybag'
    ? `<path d="M70 40 Q320 10 570 40 L600 350 Q320 380 40 350 Z" class="k-bag"/><path d="M90 46 Q320 22 550 46" class="k-roll"/>`
    : caseId ? `<rect x="24" y="24" width="592" height="352" rx="22" class="k-case"/><rect x="40" y="40" width="560" height="320" rx="12" class="k-foam"/><rect x="120" y="14" width="56" height="16" rx="4" class="k-latch"/><rect x="464" y="14" width="56" height="16" rx="4" class="k-latch"/>`
      : `<rect x="40" y="40" width="560" height="320" rx="12" class="k-table"/>`;
  let items = '';
  for (const l of lines()) {
    const a = artFor(l); if (!a) continue;
    const [slot, svg] = a, [x, y] = POS[slot];
    items += `<g class="k-item" data-id="${l.id}" transform="translate(${x},${y})"><g class="k-in">${svg}</g><text class="k-lab" x="0" y="-10">${esc(l.item.item.replace(/ pair$/, ''))}</text></g>`;
  }
  $('kitArt').innerHTML = `<svg viewBox="0 0 640 400" role="img" aria-label="The selected budget kit laid out in its case">${shell}${items}</svg>`;
}

/* ------------------------------------------------------------------ controls */
function priceTag(i, qty = 1) {
  const lo = i.price * qty, hi = (i.priceHi ?? i.price) * qty;
  const m = i.monthly ? ` <small>+ ${money(i.monthly)}/mo</small>` : '';
  return (lo === 0 ? '$0' : lo === hi ? money(lo) : `${money(lo, 0)}–${money(hi, 0)}`) + m;
}
function drawSlots() {
  $('kitSlots').innerHTML = SLOTS.map((s) => {
    const cur = state.pick[s.id], q = state.qty[s.id] || 1;
    const opts = s.options.map((id) => { const i = BITEMS[id]; return `<button type="button" class="${cur === id ? 'on' : ''}" data-slot="${s.id}" data-id="${id}"><b>${esc(i.part.split('(')[0].trim())}</b><span>${priceTag(i)}</span></button>`; }).join('')
      + (s.none ? `<button type="button" class="none ${cur ? '' : 'on'}" data-slot="${s.id}" data-id=""><b>Skip</b><span>$0</span></button>` : '');
    const sel = cur ? BITEMS[cur] : null;
    const detail = sel ? `<p class="kit-note">${esc(sel.note)}${sel.verified === false ? ' <em>price not confirmed</em>' : ''} <a href="${esc(sel.url)}" target="_blank" rel="noopener">${esc(sel.vendor)} ↗</a>${sel.alt && sel.alt[1] ? ` <a class="alt" href="${esc(sel.alt[1])}" target="_blank" rel="noopener">${esc(sel.alt[0])} ↗</a>` : ''}</p>` : '<p class="kit-note">Not included.</p>';
    const qty = s.qty && cur ? `<label class="kit-qty">How many <button type="button" data-q="-1" data-slot="${s.id}" aria-label="One fewer">−</button><output>${q}</output><button type="button" data-q="1" data-slot="${s.id}" aria-label="One more">+</button></label>` : '';
    return `<div class="kit-slot"><div class="kit-h"><h4>${s.label}</h4>${qty}</div><p class="sub">${s.desc}</p><div class="kit-opts">${opts}</div>${detail}</div>`;
  }).join('');
  $('kitAddons').innerHTML = ADDONS.map((id) => { const i = BITEMS[id]; return `<label><input type="checkbox" data-add="${id}" ${state.addons.includes(id) ? 'checked' : ''}/> <span><b>${esc(i.item)}</b> · ${esc(i.part)}<small>${esc(i.note)}</small></span><span>${priceTag(i)}</span></label>`; }).join('');
}
function drawMeter() {
  const t = totals(), pct = Math.min(100, t.lo / 700 * 100), b = BUDGET / 700 * 100, over = t.lo > BUDGET;
  $('kitMeter').innerHTML = `<div class="km-top"><div><small>Kit total</small><b class="${over ? 'over' : ''}">${money(t.lo)}</b>${t.hi > t.lo + 0.5 ? `<span>up to ${money(t.hi, 0)} depending on store</span>` : ''}</div>
    <div><small>${over ? 'Over budget by' : 'Left in a $500 budget'}</small><b class="${over ? 'over' : 'ok'}">${money(Math.abs(BUDGET - t.lo))}</b>${t.monthly ? `<span>plus ${money(t.monthly)} a month for the satellite plan</span>` : ''}</div></div>
    <div class="km-bar"><div style="width:${pct}%" class="${over ? 'over' : ''}"></div><i style="left:${b}%"><span>$500</span></i></div>`;
  for (const btn of $('kitPresets').querySelectorAll('button')) btn.classList.toggle('on', btn.dataset.p === state.preset);
  const list = lines();
  $('kitList').innerHTML = `<table class="tbl"><tr><th>Item</th><th>Qty</th><th style="text-align:right">Price</th><th>Buy</th></tr>${list.map((l) =>
    `<tr><td>${esc(l.item.part)}</td><td>${l.qty}</td><td style="text-align:right;white-space:nowrap">${priceTag(l.item, l.qty)}</td><td>${l.item.url && l.item.price ? `<a href="${esc(l.item.url)}" target="_blank" rel="noopener">${esc(l.item.vendor)} ↗</a>` : '<span class="sub">already owned</span>'}</td></tr>`).join('')}</table>`;
}
function render() { drawSlots(); drawMeter(); drawArt(); save(); }

function init() {
  if (!$('kit')) return;
  $('kitPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) => {
    const s = fromPreset(k); const keep = state; state = s; const t = totals(); state = keep;
    return `<button type="button" data-p="${k}"><b>${p.label}</b><span>${money(t.lo, 0)}</span><small>${p.desc}</small></button>`;
  }).join('');
  $('kitPresets').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) { state = fromPreset(b.dataset.p); render(); } });
  $('kitSlots').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { const s = q.dataset.slot; state.qty[s] = Math.max(1, Math.min(4, (state.qty[s] || 1) + +q.dataset.q)); state.preset = null; render(); return; }
    const b = e.target.closest('[data-slot][data-id]'); if (!b) return;
    state.pick[b.dataset.slot] = b.dataset.id || null; state.preset = null; render();
  });
  $('kitAddons').addEventListener('change', (e) => {
    const id = e.target.dataset.add; if (!id) return;
    state.addons = e.target.checked ? [...new Set([...state.addons, id])] : state.addons.filter((x) => x !== id); state.preset = null; render();
  });
  $('kitArt').addEventListener('click', (e) => {
    const g = e.target.closest('.k-item'); if (!g) return;
    const btn = $('kitSlots').querySelector(`button.on[data-id="${g.dataset.id}"]`) || $('kitAddons').querySelector(`[data-add="${g.dataset.id}"]`);
    if (btn) { btn.closest('.kit-slot, label').scrollIntoView({ behavior: 'smooth', block: 'center' }); btn.closest('.kit-slot, label').classList.add('flash'); setTimeout(() => btn.closest('.kit-slot, label').classList.remove('flash'), 1200); }
  });
  $('kitCsv').addEventListener('click', () => {
    const qv = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [['Layer', 'Item', 'Part', 'Qty', 'Unit price (USD)', 'Monthly', 'Vendor', 'Link'].map(qv).join(',')];
    for (const l of lines()) rows.push([l.slot ? l.slot.label : 'Add-on', l.item.item, l.item.part, l.qty, l.item.priceHi ? `${l.item.price}-${l.item.priceHi}` : l.item.price, l.item.monthly || '', l.item.vendor, l.item.url].map(qv).join(','));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv' })); a.download = 'survival-radio-budget-kit.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  $('kitReset').addEventListener('click', () => { state = fromPreset('core'); render(); });
  render();
}
init();
