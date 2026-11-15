// Interactive schematics for the carrier board's small circuits.
// Each circuit is drawn as SVG from a few symbol helpers; "current" is shown as moving dashes
// along the conducting path, and a small scope canvas plots what the pins would see.
// Component values match cad/build_pcb.py.
const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ symbol helpers (SVG strings) */
const W = (id, pts, cls = '') => `<polyline class="w ${cls}" points="${pts}"/>` + (id ? `<polyline class="flow" data-f="${id}" points="${pts}"/>` : '');
const dot = (x, y) => `<circle class="nd" cx="${x}" cy="${y}" r="3.2"/>`;
const txt = (x, y, s, cls = 'lb', anchor = 'start') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
function res(x, y, vertical, ref, val, len = 70) {
  // zig-zag resistor between (x,y) and (x,y+len) or (x+len,y)
  const n = 6, a = 7, seg = (len - 20) / n; let d = vertical ? `M${x} ${y}v10` : `M${x} ${y}h10`;
  for (let i = 0; i < n; i++) { const s = i % 2 ? -a : a; d += vertical ? `l${s} ${seg / 2}l${-s} ${seg / 2}` : `l${seg / 2} ${s}l${seg / 2} ${-s}`; }
  d += vertical ? 'v10' : 'h10';
  const lx = vertical ? x + 14 : x + len / 2, ly = vertical ? y + len / 2 : y - 14;
  return `<path class="sym" d="${d}"/>` + txt(lx, ly - (vertical ? 4 : 0), ref, 'ref', vertical ? 'start' : 'middle') + txt(lx, ly + (vertical ? 12 : 13 + 14), val, 'val', vertical ? 'start' : 'middle');
}
function cap(x, y, vertical, ref, val) {      // plates centred on (x,y)
  const p = vertical ? `M${x - 14} ${y - 4}h28M${x - 14} ${y + 4}h28M${x} ${y - 4}v-14M${x} ${y + 4}v14` : `M${x - 4} ${y - 14}v28M${x + 4} ${y - 14}v28M${x - 4} ${y}h-14M${x + 4} ${y}h14`;
  return `<path class="sym" d="${p}"/>` + txt(x + 20, y - 2, ref, 'ref') + txt(x + 20, y + 12, val, 'val');
}
const gnd = (x, y) => `<path class="sym" d="M${x} ${y}v8M${x - 12} ${y + 8}h24M${x - 7} ${y + 13}h14M${x - 3} ${y + 18}h6"/>`;
const rail = (x, y, label) => `<path class="sym" d="M${x - 12} ${y}h24M${x} ${y}v10"/>` + txt(x, y - 7, label, 'rail', 'middle');
function pinBox(x, y, label, sub, right = true) {
  const w = 140;
  return `<g class="mcu"><rect x="${right ? x : x - w}" y="${y - 20}" width="${w}" height="40" rx="3"/>` +
    txt(right ? x + 10 : x - w + 10, y - 3, label, 'pin') + txt(right ? x + 10 : x - w + 10, y + 12, sub, 'val') + '</g>';
}
function npn(x, y, ref) {                     // base at (x-26,y), collector (x,y-30), emitter (x,y+30)
  return `<g class="q" data-part="${ref}"><circle class="sym body" cx="${x - 6}" cy="${y}" r="20"/>` +
    `<path class="sym" d="M${x - 26} ${y}h12M${x - 14} ${y - 12}v24M${x - 14} ${y - 5}L${x} ${y - 16}v-14M${x - 14} ${y + 5}L${x} ${y + 16}v14"/>` +
    `<path class="sym fill" d="M${x} ${y + 16}l-9 -1 4 -6z"/>` + txt(x + 12, y - 4, ref, 'ref') + txt(x + 12, y + 10, 'MMBT3904', 'val') + '</g>';
}
function diode(x, y, ref, val, up = true) {   // vertical, cathode toward top if up
  const s = up ? -1 : 1;
  return `<path class="sym fill" d="M${x - 10} ${y - 8 * s}h20l-10 ${16 * s}z"/><path class="sym" d="M${x - 10} ${y + 8 * s}h20M${x} ${y - 8 * s}v${-14 * s}M${x} ${y + 8 * s}v${14 * s}"/>` +
    txt(x + 16, y - 2, ref, 'ref') + txt(x + 16, y + 12, val, 'val');
}
function sw(x, y, id, label) {                // vertical switch between (x,y) and (x,y+50)
  return `<g class="sw" data-sw="${id}" tabindex="0" role="button" aria-label="${label}"><rect x="${x - 28}" y="${y - 4}" width="56" height="58" fill="transparent"/>` +
    `<circle class="sym" cx="${x}" cy="${y + 8}" r="3.5"/><circle class="sym" cx="${x}" cy="${y + 42}" r="3.5"/>` +
    `<path class="sym lever" d="M${x} ${y + 42}L${x + 17} ${y + 12}" style="transform-origin:${x}px ${y + 42}px"/>` +
    `<path class="sym" d="M${x} ${y}v4.5M${x} ${y + 45.5}v4.5"/>` + txt(x + 22, y + 30, label, 'ref') + '</g>';
}
function buzzer(x, y) {                       // vertical, + at top (x,y), - at (x,y+60)
  return `<path class="sym" d="M${x} ${y}v12M${x} ${y + 48}v12"/><rect class="sym body bz" x="${x - 18}" y="${y + 12}" width="36" height="36" rx="18"/>` +
    txt(x, y + 34, 'BZ1', 'ref', 'middle') + `<path class="sym waves" d="M${x + 26} ${y + 20}q8 10 0 20M${x + 33} ${y + 15}q12 15 0 30"/>`;
}

/* ------------------------------------------------------------------ scope canvas */
function scope(canvas, traces, tMax, cursor, unit = 'ms') {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#070906'; g.fillRect(0, 0, w, h);
  const L = 74, R = 10, top = 8, bot = 18, n = traces.length, lane = (h - top - bot) / n;
  g.strokeStyle = 'rgba(164,236,110,.08)'; g.lineWidth = 1;
  for (let k = 0; k <= 10; k++) { const x = L + (w - L - R) * k / 10; g.beginPath(); g.moveTo(x, top); g.lineTo(x, h - bot); g.stroke(); }
  g.font = '10px "IBM Plex Mono", monospace'; g.fillStyle = '#6f7a5e';
  g.fillText('0', L - 3, h - 5); g.textAlign = 'right'; g.fillText(tMax + ' ' + unit, w - R, h - 5); g.textAlign = 'left';
  traces.forEach((tr, i) => {
    const y0 = top + lane * i, yb = y0 + lane - 6, yt = y0 + 6;
    g.fillStyle = tr.color; g.fillText(tr.name, 6, y0 + lane / 2 + 3);
    g.strokeStyle = 'rgba(164,236,110,.12)'; g.beginPath(); g.moveTo(L, yb); g.lineTo(w - R, yb); g.stroke();
    g.beginPath(); g.strokeStyle = tr.color; g.lineWidth = 1.6; g.shadowColor = tr.color; g.shadowBlur = 5;
    tr.pts.forEach(([t, v], k) => { const x = L + (w - L - R) * t / tMax, y = yb - (yb - yt) * Math.max(0, Math.min(1, v / tr.max)); k ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke(); g.shadowBlur = 0;
  });
  if (cursor != null) { const x = L + (w - L - R) * cursor / tMax; g.strokeStyle = 'rgba(255,107,26,.8)'; g.beginPath(); g.moveTo(x, top); g.lineTo(x, h - bot); g.stroke(); }
}

/* ------------------------------------------------------------------ circuits */
const C = {};

// 1 · SOS input: 3V3 - R1 10k - A - switch - GND ; A - R2 1k - B - D5 ; B - C1 100nF - GND
C.sos = {
  title: 'SOS switch input',
  svg: () => `<svg viewBox="0 0 640 330">
    ${rail(110, 30, '3V3')}${W('pu', '110,40 110,60')}${res(110, 60, true, 'R1', '10 kΩ')}${W('pu', '110,130 110,160')}
    ${dot(110, 160)}${W('sw', '110,160 110,190')}${sw(110, 190, 'sos', 'SOS switch')}${W('sw', '110,240 110,268')}${gnd(110, 268)}
    ${W('ch', '110,160 200,160')}${res(200, 160, false, 'R2', '1 kΩ')}${W('ch', '270,160 330,160')}${dot(330, 160)}
    ${W('', '330,160 470,160')}${pinBox(470, 160, 'D5 · GPIO5', 'input, wakes from sleep')}
    ${W('ch', '330,160 330,196')}${cap(330, 214, true, 'C1', '100 nF')}${W('ch', '330,232 330,268')}${gnd(330, 268)}
    ${txt(122, 152, 'A', 'node')}${txt(342, 152, 'B', 'node')}
    <text class="probe" id="pA" x="126" y="182"></text><text class="probe" id="pB" x="346" y="194"></text>
  </svg>`,
  controls: `<button class="btn" data-act="flip">Flip the SOS switch</button><button class="btn" data-act="release">Release</button>`,
  init(root) {
    this.closed = false; this.sim = null;
    this.paint(root);
  },
  simulate(close) {
    // bounce pattern (ms) after the contact first moves, then RC integration of the capacitor
    const edges = close ? [2, 2.35, 2.7, 3.5, 3.75, 4.6, 4.75] : [2, 2.2, 2.45, 3.1, 3.3];
    const state = (t) => { let s = !close; for (const e of edges) if (t >= e) s = !s; return s; };   // true = contact closed
    const dt = 0.01, T = 30, R1 = 10e3, R2 = 1e3, Cc = 100e-9;
    let vc = close ? 3.3 : 0; const A = [], B = [], D = []; let fired = null, last = close ? 1 : 0;
    for (let t = 0; t <= T + 1e-9; t += dt) {
      const s = state(t);
      const va = s ? 0 : vc + (3.3 - vc) * R2 / (R1 + R2);
      const i = s ? -vc / R2 : (3.3 - vc) / (R1 + R2);
      vc += i / Cc * dt * 1e-3;
      const lvl = vc < 0.83 ? 0 : vc > 2.48 ? 1 : last; last = lvl;
      if (fired == null && lvl === (close ? 0 : 1)) fired = t;
      const deb = fired == null ? (close ? 1 : 0) : (close ? 0 : 1);
      if (Math.round(t / dt) % 2 === 0) { A.push([t, va]); B.push([t, vc]); D.push([t, deb]); }
    }
    return { A, B, D, fired, T };
  },
  run(root, close) {
    if (close === this.closed && this.sim) return;
    this.closed = close; this.sim = this.simulate(close); this.t0 = performance.now();
    root.querySelector('[data-sw="sos"]').classList.toggle('closed', close);
    this.paint(root);
  },
  paint(root) {
    const on = this.closed;
    flows(root, { pu: on, sw: on, ch: false });
    $('pA').textContent = on ? 'A = 0 V' : 'A = 3.3 V'; $('pB').textContent = on ? 'B = 0 V' : 'B = 3.3 V';
    const s = this.sim;
    const r = s ? `<b>${on ? 'Switch closed' : 'Switch released'}.</b> The contact bounced ${on ? 7 : 5} times in about 3 ms. R2 and C1 round the edges, and the pin crosses the logic threshold at <b>${s.fired?.toFixed(2)} ms</b>. Firmware acts on that first edge, then ignores the pin for 20 ms so the bounces can't trigger a second SOS.`
      : 'The pin idles HIGH through R1. Flip the switch to watch the contact bounce.';
    readout(root, r, on ? 'Current through R1: 3.3 V ÷ 10 kΩ = 0.33 mA while held' : 'Idle current: 0 (no path to ground)');
  },
  frame(root, cv) {
    const s = this.sim || this.simulate(false);
    const k = this.sim ? Math.min(1, (performance.now() - this.t0) / 1400) : 1, tc = k * s.T;
    const cut = (arr) => arr.filter(([t]) => t <= tc);
    scope(cv, [{ name: 'switch A', color: '#ffa45c', max: 3.4, pts: cut(s.A) }, { name: 'pin B', color: '#a4ec6e', max: 3.4, pts: cut(s.B) }, { name: 'firmware', color: '#74d2c3', max: 1.2, pts: cut(s.D) }], s.T, this.sim && k < 1 ? tc : null);
  },
};

// 2 · Button ladder on A4
const LAD = { R3: 10, R4: 10, R5: 33 };
C.ladder = {
  title: 'Three buttons, one pin',
  svg: () => `<svg viewBox="0 0 640 330">
    ${rail(120, 26, '3V3')}${W('top', '120,36 120,50')}${res(120, 50, true, 'R3', '10 kΩ')}${W('top', '120,120 120,140')}${dot(120, 140)}
    ${W('', '120,140 60,140 60,180')}${pinBox(4, 200, 'A4 · ADC', 'analog input')}
    ${W('b1', '120,140 230,140 230,190')}${W('b2', '230,140 370,140 370,150')}${W('b3', '370,140 510,140 510,150')}
    ${dot(230, 140)}${dot(370, 140)}
    ${sw(230, 190, 'b1', 'BTN1 Menu')}${W('b1', '230,240 230,290')}${gnd(230, 290)}
    ${res(370, 150, true, 'R4', '10 kΩ', 60)}${W('b2', '370,210 370,220')}${sw(370, 220, 'b2', 'BTN2 Up')}${W('b2', '370,270 370,290')}${gnd(370, 290)}
    ${res(510, 150, true, 'R5', '33 kΩ', 60)}${W('b3', '510,210 510,220')}${sw(510, 220, 'b3', 'BTN3 Select')}${W('b3', '510,270 510,290')}${gnd(510, 290)}
    <text class="probe" id="pL" x="132" y="132"></text>
  </svg>`,
  controls: `<span class="sub" style="margin:0">Click the buttons in the diagram (you can hold more than one).</span>`,
  init(root) { this.pressed = new Set(); this.hist = []; this.paint(root); },
  toggle(root, id) { this.pressed.has(id) ? this.pressed.delete(id) : this.pressed.add(id); root.querySelector(`[data-sw="${id}"]`).classList.toggle('closed', this.pressed.has(id)); this.paint(root); },
  volts() {
    const br = []; if (this.pressed.has('b1')) br.push(0); if (this.pressed.has('b2')) br.push(LAD.R4); if (this.pressed.has('b3')) br.push(LAD.R5);
    if (!br.length) return 3.3; if (br.includes(0)) return 0;
    const rp = 1 / br.reduce((a, r) => a + 1 / r, 0); return 3.3 * rp / (LAD.R3 + rp);
  },
  paint(root) {
    const v = this.volts(), any = this.pressed.size > 0;
    flows(root, { top: any, b1: this.pressed.has('b1'), b2: this.pressed.has('b2') && !this.pressed.has('b1'), b3: this.pressed.has('b3') && !this.pressed.has('b1') });
    $('pL').textContent = `A4 = ${v.toFixed(2)} V`;
    const raw = Math.min(4095, Math.round(v / 3.1 * 4095));
    const dec = v < 0.8 ? 'BTN1 · Menu' : v < 2.1 ? 'BTN2 · Up' : v < 2.9 ? 'BTN3 · Select' : 'no button';
    const ma = any ? ((3.3 - v) / LAD.R3).toFixed(2) : '0';
    readout(root, `Reading <b>${v.toFixed(2)} V</b> (ADC ≈ ${raw} of 4095) → firmware decodes <b>${dec}</b>. ${this.pressed.size > 1 ? 'With two buttons held, the branches are in parallel and the lowest resistance wins, so give BTN1 the most important job.' : 'Each button pulls the pin to a different voltage: 0 V, about 1.65 V, about 2.53 V; none pressed reads 3.3 V.'}`,
      `Current from 3V3: ${ma} mA · thresholds at 0.8 V, 2.1 V and 2.9 V`);
    this.hist.push(v); if (this.hist.length > 120) this.hist.shift();
  },
  frame(root, cv) {
    this.hist.push(this.volts()); if (this.hist.length > 160) this.hist.shift();
    const pts = this.hist.map((v, i) => [i, v]);
    scope(cv, [{ name: 'A4 volts', color: '#a4ec6e', max: 3.4, pts }], 159, null, 'frames (live)');
  },
};

// 3 · Buzzer driver
C.buzz = {
  title: 'Buzzer driver',
  svg: () => `<svg viewBox="0 0 640 330">
    ${rail(330, 24, 'LOAD 3.7–4.2 V')}${W('c', '330,34 330,50')}${dot(330, 50)}${buzzer(330, 50)}${W('c', '330,110 330,140')}${dot(330, 140)}
    ${W('fb', '330,50 430,50 430,72')}${diode(430, 95, 'D1', '1N4148W')}${W('fb', '430,118 430,140 330,140')}
    ${W('c', '330,140 330,170')}${npn(330, 200, 'Q1')}${W('c', '330,230 330,276')}${gnd(330, 276)}
    ${pinBox(16, 200, 'D13 · PWM', '≈ 2.7 kHz square wave')}${W('b', '156,200 160,200')}${res(160, 200, false, 'R6', '1 kΩ')}${W('b', '230,200 304,200')}${dot(260, 200)}
    ${W('', '260,200 260,212')}${res(260, 212, true, 'R7', '10 kΩ', 50)}${W('', '260,262 260,276')}${gnd(260, 276)}
    <text class="probe" id="pI" x="342" y="132"></text>
  </svg>`,
  controls: `<button class="btn" data-act="beep">Hold to beep</button><button class="btn" data-act="sosbeep">Beep SOS</button><label class="snd"><input type="checkbox" id="sndOn" /> sound</label>`,
  init(root) { this.on = false; this.fly = 0; this.t = 0; this.paint(root); },
  set(root, on) {
    if (on === this.on) return;
    if (!on) this.fly = performance.now();
    this.on = on; this.paint(root); tone(on);
  },
  paint(root) {
    const fb = performance.now() - this.fly < 450 && !this.on;
    flows(root, { c: this.on, b: this.on, fb });
    root.querySelector('.bz')?.classList.toggle('ring', this.on);
    $('pI').textContent = this.on ? 'I ≈ 30 mA' : fb ? 'coil current → D1' : '';
    readout(root, this.on
      ? 'D13 drives the base through R6: about (3.3 − 0.7) V ÷ 1 kΩ ≈ <b>2.6 mA</b>. Q1 then saturates and sinks the buzzer\'s ~30 mA (needs a gain of only about 12; the 3904 has far more), so the buzzer sees nearly the full LOAD voltage.'
      : fb ? '<b>Switch-off:</b> the coil keeps its current flowing for a moment. Without D1 the collector voltage would spike high enough to damage Q1; D1 gives the current a loop back to LOAD instead.'
        : 'Q1 is off; R7 holds its base at 0 V even while D13 floats during reset, so the buzzer stays silent at boot.',
      'Q1 power when on: ≈ 0.2 V × 30 mA = 6 mW; tiny for a SOT-23');
  },
  frame(root, cv) {
    this.t += 1;
    if (this.fly && performance.now() - this.fly < 500) this.paint(root); else if (this.fly) { this.fly = 0; this.paint(root); }
    const pts = [], cur = [], N = 160;
    for (let i = 0; i < N; i++) {
      const ph = Math.floor((i + this.t * 2) / 6) % 2, on = this.on;
      pts.push([i, on ? ph * 3.3 : 0]);
      cur.push([i, on ? 30 * (0.75 + 0.25 * Math.sin(i / 3)) : 0]);
    }
    scope(cv, [{ name: 'D13', color: '#ffa45c', max: 3.6, pts }, { name: 'I buzzer', color: '#a4ec6e', max: 40, pts: cur }], N - 1, null, '≈ 2 ms (slowed)');
  },
};

// 4 · Modem power-up sequence
const SEQ = [  // [t (scaled s), signal, value, note]
  [0.3, 'en', 1, 'Expander GP0 raises BOOST_EN: the 5 V rail comes up and C2 charges.'],
  [0.9, 'i_en', 1, 'Only now does D11 raise I_EN. The modem\'s supercapacitors start charging.'],
  [3.4, 'btd', 1, 'I_BTD goes HIGH: "booted" (tens of seconds from cold; sped up here).'],
  [3.7, 'uart', 1, 'UART 1 opens at 230400 baud; the library sends the message as JSPR.'],
  [5.2, 'uart', 0, 'Message accepted. Stop talking to the modem.'],
  [5.5, 'i_en', 0, 'Drop I_EN and wait…'],
  [6.3, 'btd', 0, '…until I_BTD goes LOW.'],
  [6.6, 'en', 0, 'Then switch the 5 V rail off. The modem draws nothing until the next check-in.'],
];
C.modem = {
  title: 'Satellite modem power-up',
  svg: () => `<svg viewBox="0 -14 640 350">
    ${pinBox(16, 60, 'U3 GP0', 'MCP23008 expander')}${W('en', '156,60 250,60')}${dot(200, 60)}${W('', '200,60 200,80')}${res(200, 80, true, 'R10', '100 kΩ', 50)}${W('', '200,130 200,140')}${gnd(200, 140)}
    <g class="blk"><rect x="250" y="34" width="110" height="74" rx="4"/>${txt(305, 62, 'U2 boost', 'pin', 'middle')}${txt(305, 78, 'MiniBoost 5 V', 'val', 'middle')}${txt(258, 102, 'EN', 'val')}${txt(352, 102, 'OUT', 'val', 'end')}</g>
    ${rail(305, 8, 'LOAD')}${W('pw', '305,18 305,34')}
    ${W('pw', '360,70 440,70')}${dot(380, 70)}${W('pw', '380,70 380,92')}${cap(380, 104, true, 'C2', '100 µF')}${W('', '380,116 380,140')}${gnd(380, 140)}
    <g class="blk"><rect x="440" y="34" width="180" height="282" rx="4"/>${txt(530, 58, 'RockBLOCK 9704', 'pin', 'middle')}${txt(530, 74, '16-pin header via J1', 'val', 'middle')}
      ${txt(450, 74 - 4, '', 'val')}${txt(452, 96, '15 V_IN+', 'val')}${txt(452, 196, '3 I_EN', 'val')}${txt(452, 240, '7 I_BTD', 'val')}${txt(452, 274, '14 RXD', 'val')}${txt(452, 299, '13 TXD', 'val')}</g>
    ${W('pw', '440,70 440,92')}
    ${pinBox(16, 192, 'D11', 'Feather GPIO out')}${W('ien', '156,192 440,192')}
    ${pinBox(16, 236, 'MI · GPIO37', 'Feather GPIO in')}${W('btd', '440,236 156,236')}
    ${pinBox(16, 283, 'TX / RX', 'UART 1 · 230400')}${W('tx', '156,270 440,270')}${W('rx', '440,295 156,295')}
  </svg>`,
  controls: `<button class="btn" data-act="go">Power up and send</button><button class="btn" data-act="wrong">Try it in the wrong order</button>`,
  init(root) { this.t = -1; this.st = { en: 0, i_en: 0, btd: 0, uart: 0 }; this.note = 'The modem must be started and stopped in a fixed order. Press <b>Power up and send</b>.'; this.warn = ''; this.paint(root); },
  go(root, wrong = false) {
    this.t0 = performance.now(); this.t = 0; this.wrong = wrong; this.st = { en: 0, i_en: 0, btd: 0, uart: 0 }; this.warn = ''; this.hist = [];
  },
  paint(root) {
    const s = this.st;
    flows(root, { en: !!s.en, pw: !!s.en, ien: !!s.i_en, btd: !!s.btd, tx: !!s.uart, rx: !!s.uart });
    readout(root, this.note + (this.warn ? `<div class="warnbox" style="margin-top:8px">${this.warn}</div>` : ''), 'Sequence from Ground Control\'s RockBLOCK 9704 hardware documentation');
  },
  frame(root, cv) {
    const T = 7.2;
    if (this.t >= 0) {
      const t = (performance.now() - this.t0) / 1000; this.t = t;
      const seq = this.wrong ? [[0.3, 'i_en', 1, 'D11 raises I_EN while the 5 V rail is still off…'], [0.35, 'warn', 1, ''], [2.2, 'i_en', 0, 'Abort: I_EN back LOW. Start over in the right order.']] : SEQ;
      for (const [ts, k, v, note] of seq) if (t >= ts && !(this.done || new Set()).has(ts)) {
        (this.done ||= new Set()).add(ts);
        if (k === 'warn') this.warn = '<b>Wrong order.</b> Driving a modem pin HIGH while the modem is unpowered can push current into it through the pin\'s protection diodes ("back-powering"), which can leave it in a bad state or damage it. Keep the controller\'s pins LOW or high-impedance until the 5 V rail is up.';
        else { this.st[k] = v; this.note = note; }
        this.paint(root);
      }
      if (t > (this.wrong ? 2.8 : T)) { this.t = -1; this.done = null; if (!this.wrong) this.note += ' <b>Done.</b>'; this.paint(root); }
    }
    // build the timing diagram from the scripted sequence
    const seq = this.wrong ? [[0.3, 'i_en', 1], [2.2, 'i_en', 0]] : SEQ;
    const tr = (k, max = 1) => { let v = 0; const p = [[0, 0]]; for (const [ts, kk, vv] of seq) if (kk === k) { p.push([ts, v], [ts, vv]); v = vv; } p.push([T, v]); return p; };
    const fiveV = (() => { const p = []; for (let t = 0; t <= T; t += 0.02) { const on = !this.wrong && t >= 0.3 && t < 6.6; const k = on ? 1 - Math.exp(-(t - 0.3) / 0.05) : (!this.wrong && t >= 6.6 ? Math.exp(-(t - 6.6) / 0.12) : 0); p.push([t, 5 * k]); } return p; })();
    const uart = (() => { const p = []; for (let t = 0; t <= T; t += 0.01) { const on = !this.wrong && t >= 3.7 && t < 5.2; p.push([t, on ? (Math.sin(t * 900) > 0 ? 1 : 0.15) : 1]); } return p; })();
    scope(cv, [{ name: 'BOOST_EN', color: '#ffa45c', max: 1.2, pts: tr('en') }, { name: '5 V rail', color: '#ff5a4e', max: 5.5, pts: fiveV },
      { name: 'I_EN', color: '#f2b33d', max: 1.2, pts: tr('i_en') }, { name: 'I_BTD', color: '#74d2c3', max: 1.2, pts: tr('btd') }, { name: 'UART', color: '#a4ec6e', max: 1.2, pts: uart }],
      T, this.t >= 0 ? Math.min(this.t, T) : null, 's (scaled)');
  },
};

/* ------------------------------------------------------------------ shared UI */
function flows(root, map) { for (const el of root.querySelectorAll('.flow')) el.classList.toggle('on', !!map[el.dataset.f]); }
function readout(root, html, foot) { root.querySelector('.ckt-read').innerHTML = `<p>${html}</p><p class="sub">${foot}</p>`; }
let actx = null, osc = null;
function tone(on) {
  const want = $('sndOn')?.checked;
  try {
    if (on && want) {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      osc = actx.createOscillator(); const g = actx.createGain(); g.gain.value = 0.04;
      osc.type = 'square'; osc.frequency.value = 2700; osc.connect(g).connect(actx.destination); osc.start();
    } else if (osc) { osc.stop(); osc = null; }
  } catch (e) { /* audio unavailable */ }
}

function init() {
  const host = $('ckt'); if (!host) return;
  const tabs = host.querySelector('.ckt-tabs'), stage = host.querySelector('.ckt-svg'), ctr = host.querySelector('.ckt-ctrl'), cv = host.querySelector('canvas');
  const keys = Object.keys(C); let cur = null, raf = 0, visible = false;
  tabs.innerHTML = keys.map((k, i) => `<button type="button" data-k="${k}"><span>${i + 1}</span>${C[k].title}</button>`).join('');
  function show(k) {
    cur = k; for (const b of tabs.children) b.classList.toggle('on', b.dataset.k === k);
    stage.innerHTML = C[k].svg(); ctr.innerHTML = C[k].controls; C[k].init(host);
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.k); });
  // switch clicks inside the SVG
  const swAct = (g) => {
    if (cur === 'sos') C.sos.run(host, !C.sos.closed);
    if (cur === 'ladder') C.ladder.toggle(host, g.dataset.sw);
  };
  stage.addEventListener('click', (e) => { const g = e.target.closest('[data-sw]'); if (g) swAct(g); });
  stage.addEventListener('keydown', (e) => { const g = e.target.closest('[data-sw]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); swAct(g); } });
  ctr.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'flip') C.sos.run(host, true); if (a === 'release') C.sos.run(host, false);
    if (a === 'go') C.modem.go(host); if (a === 'wrong') C.modem.go(host, true);
    if (a === 'sosbeep') {
      const U = 120; for (const c of '...---...') { C.buzz.set(host, true); await new Promise((r) => setTimeout(r, c === '.' ? U : 3 * U)); C.buzz.set(host, false); await new Promise((r) => setTimeout(r, U)); }
    }
  });
  const beep = (on) => (e) => { if (e.target.closest('[data-act="beep"]')) { e.preventDefault(); C.buzz.set(host, on); } };
  ctr.addEventListener('pointerdown', beep(true)); ctr.addEventListener('pointerup', beep(false)); ctr.addEventListener('pointerleave', () => cur === 'buzz' && C.buzz.set(host, false));
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(host);
  let last = 0;
  const loop = (now) => { raf = requestAnimationFrame(loop); if (!visible || now - last < 33) return; last = now; C[cur].frame(host, cv); };
  show('sos'); requestAnimationFrame(loop);
}
init();
