// Materials list: every part, supply and tool with price and store links.
// Filter, search, sort, tick what you own, change quantities; totals update live.
// Ticks and quantities are kept in this browser only (localStorage, best effort).
import { MATERIALS, CHECKED } from './materials-data.js';

const $ = (id) => document.getElementById(id);
const KINDS = [
  ['all', 'Everything'], ['hub', 'Hub parts'], ['power-extra', 'Charging'], ['build', 'Build supplies'],
  ['tool', 'Tools'], ['carry', 'Carry-along'], ['airtime', 'Airtime'],
];
const KEY = 'sr-materials-v1';
const rows = MATERIALS.map((m, i) => ({ ...m, i, key: (m.item + '|' + m.part).slice(0, 80) }));
let state = { have: {}, qty: {} };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.have && s.qty) state = s; } catch (e) { /* storage unavailable */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
let kind = 'all', query = '', sort = { k: null, asc: true };

const lo = (r) => (typeof r.price === 'number' ? r.price : null);
const hi = (r) => (typeof r.priceHi === 'number' ? r.priceHi : lo(r));
const qtyOf = (r) => (state.qty[r.key] ?? r.qty ?? 1);
const money = (n, d = 0) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const range = (a, b, d = 0) => (a === b ? money(a, d) : `${money(a, d)}–${money(b, d)}`);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\.|^store\./, ''); } catch (e) { return 'link'; } };

function visible() {
  const q = query.trim().toLowerCase();
  let list = rows.filter((r) => (kind === 'all' || r.kind === kind)
    && (!q || [r.cat, r.item, r.part, r.vendor, r.note].join(' ').toLowerCase().includes(q)));
  if (sort.k) {
    const f = sort.k === 'price' ? (r) => lo(r) ?? 1e9 : sort.k === 'total' ? (r) => (lo(r) ?? 1e9) * qtyOf(r) : (r) => r.item.toLowerCase();
    list = [...list].sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * (sort.asc ? 1 : -1));
  }
  return list;
}

function totals(list) {
  let a = 0, b = 0, ha = 0, hb = 0, unpriced = 0;
  for (const r of list) {
    if (r.kind === 'airtime') continue;              // recurring, shown separately
    const p = lo(r); if (p == null) { unpriced++; continue; }
    const q = qtyOf(r), x = p * q, y = hi(r) * q;
    a += x; b += y; if (state.have[r.key]) { ha += x; hb += y; }
  }
  return { a, b, ha, hb, unpriced };
}

function priceCell(r) {
  const p = lo(r); if (p == null) return `<td class="pr">${esc(r.priceText || 'varies')}</td>`;
  const unit = range(p, hi(r), p < 100 && p % 1 ? 2 : 0) + (r.unit ? ` <small>${esc(r.unit)}</small>` : '');
  const q = qtyOf(r);
  return `<td class="pr">${unit}${q > 1 ? `<small>× ${q} = ${range(p * q, hi(r) * q)}</small>` : ''}</td>`;
}

function render() {
  const list = visible();
  const t = $('matTable');
  let h = `<thead><tr><th title="Tick what you already own">Own</th><th data-k="item">Item</th><th>Qty</th><th data-k="price" style="text-align:right">Price</th><th>Where to buy</th></tr></thead><tbody>`;
  let last = null;
  for (const r of list) {
    if (!sort.k && r.cat !== last) { h += `<tr class="cat"><td colspan="5">${esc(r.cat)}</td></tr>`; last = r.cat; }
    const have = !!state.have[r.key];
    const links = (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.vendor || host(r.url))} ↗</a>` : '')
      + (r.alt && r.alt[1] ? `<a class="alt" href="${esc(r.alt[1])}" target="_blank" rel="noopener">${esc(r.alt[0])} ↗</a>` : '');
    h += `<tr class="${have ? 'have' : ''}" data-key="${esc(r.key)}">
      <td class="ck"><input type="checkbox" ${have ? 'checked' : ''} aria-label="I already own ${esc(r.item)}" /></td>
      <td class="it"><b>${esc(r.item)}</b><span>${esc(r.part)}</span>${r.note ? `<br><span>${esc(r.note)}</span>` : ''}${r.verified === false ? '<br><em>price not confirmed</em>' : ''}</td>
      <td class="q"><input type="number" min="0" max="99" step="1" value="${qtyOf(r)}" aria-label="Quantity of ${esc(r.item)}" /></td>
      ${priceCell(r)}
      <td class="v">${links || '<span class="sub">source locally</span>'}</td></tr>`;
  }
  if (!list.length) h += '<tr><td colspan="5" class="sub" style="padding:20px 8px">Nothing matches that search.</td></tr>';
  t.innerHTML = h + '</tbody>';
  for (const th of t.querySelectorAll('th[data-k]')) th.classList.toggle('sorted', th.dataset.k === sort.k), th.classList.toggle('asc', th.dataset.k === sort.k && sort.asc);
  summary(list);
}

function summary(list) {
  const s = totals(list);
  const need = [s.a - s.ha, s.b - s.hb];
  const air = list.filter((r) => r.kind === 'airtime');
  $('matSum').innerHTML = `
    <div><small>Items shown</small><b class="o">${list.length}</b></div>
    <div><small>Total</small><b>${range(s.a, s.b)}</b></div>
    <div><small>Already own</small><b>${range(s.ha, s.hb)}</b></div>
    <div><small>Still to buy</small><b>${range(need[0], need[1])}</b></div>`;
  if (air.length) $('matSum').title = 'Satellite airtime is a recurring cost and is not included in the totals.';
}

function headline() {
  const hub = totals(rows.filter((r) => r.kind === 'hub'));
  const build = totals(rows.filter((r) => r.kind === 'build'));
  const tools = totals(rows.filter((r) => r.kind === 'tool'));
  const pwr = totals(rows.filter((r) => r.kind === 'power-extra'));
  const carry = totals(rows.filter((r) => r.kind === 'carry'));
  const d = new Date(CHECKED + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  $('bomTotal').innerHTML = `The hub's parts come to about <b>${range(hub.a, hub.b)}</b>, plus <b>${range(build.a, build.b)}</b> in build supplies. Add solar and crank charging (${range(pwr.a, pwr.b)}), tools if you don't have them (${range(tools.a, tools.b)}), carry-along gear (${range(carry.a, carry.b)}), and satellite airtime. Prices checked ${d}.`;
}

function csv() {
  const list = visible().filter((r) => !state.have[r.key]);
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [['Category', 'Item', 'Part', 'Qty', 'Unit price (USD)', 'Vendor', 'Link'].map(q).join(',')];
  for (const r of list) lines.push([r.cat, r.item, r.part, qtyOf(r), lo(r) == null ? (r.priceText || 'varies') : (hi(r) !== lo(r) ? `${lo(r)}-${hi(r)}` : lo(r)), r.vendor, r.url].map(q).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'survival-radio-shopping-list.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function init() {
  if (!$('matTable')) return;
  $('matFilter').innerHTML = KINDS.filter(([k]) => k === 'all' || rows.some((r) => r.kind === k))
    .map(([k, l]) => `<button type="button" data-k="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('');
  $('matFilter').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; kind = b.dataset.k;
    for (const x of $('matFilter').children) x.classList.toggle('on', x === b); render();
  });
  $('matSearch').addEventListener('input', (e) => { query = e.target.value; render(); });
  const t = $('matTable');
  t.addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-key]'); if (!tr) return; const k = tr.dataset.key;
    if (e.target.type === 'checkbox') { if (e.target.checked) state.have[k] = 1; else delete state.have[k]; }
    if (e.target.type === 'number') { const v = Math.max(0, Math.min(99, Math.round(+e.target.value || 0))); state.qty[k] = v; }
    save(); render();
  });
  t.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-k]'); if (!th) return;
    if (sort.k === th.dataset.k) { if (!sort.asc) sort = { k: null, asc: true }; else sort.asc = false; } else sort = { k: th.dataset.k, asc: true };
    render();
  });
  $('matCsv').addEventListener('click', csv);
  $('matReset').addEventListener('click', () => { state = { have: {}, qty: {} }; save(); render(); });
  headline(); render();
}
init();
