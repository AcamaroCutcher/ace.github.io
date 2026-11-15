// Survival Radio: page atmosphere and navigation.
//  - hero background: drifting topographic contours with a small LoRa mesh pinging across it
//  - band scope: a tunable spectrum + waterfall showing what each radio in the build sounds like
//  - Morse SOS indicator, tuner-style section navigation, reveal-on-scroll
// Pure canvas/DOM, no dependencies. Everything pauses when off screen and respects reduced motion.
const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark = () => document.documentElement.classList.contains('dark-mode');
// hero colours for each theme (the radio face and scope are dark in both)
const PAL = {
  dark: { major: 'rgba(196,182,128,.17)', minor: 'rgba(170,160,120,.075)', tick: 'rgba(170,160,120,.25)', link: 'rgba(164,236,110,.14)', pkt: 'rgba(190,255,140,.9)',
    ping: (a) => `rgba(164,236,110,${a})`, pulse: (a) => `rgba(255,107,26,${a})`, node: 'rgba(164,236,110,.7)', nodeTxt: 'rgba(164,236,110,.45)', hub: '#ff6b1a', hubTxt: 'rgba(255,164,92,.9)' },
  light: { major: 'rgba(110,92,40,.26)', minor: 'rgba(110,92,40,.11)', tick: 'rgba(110,92,40,.45)', link: 'rgba(58,117,24,.3)', pkt: 'rgba(44,100,14,.95)',
    ping: (a) => `rgba(58,117,24,${a})`, pulse: (a) => `rgba(212,80,10,${a * 1.3})`, node: 'rgba(58,117,24,.8)', nodeTxt: 'rgba(58,117,24,.7)', hub: '#d4500a', hubTxt: 'rgba(169,65,9,.95)' },
};
const pal = () => (isDark() ? PAL.dark : PAL.light);

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

/* ------------------------------------------------------------------ hero: topo + mesh */
function hero() {
  const cv = $('heroCanvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, cell = 16, cols = 0, rows = 0, field = null, nodes = [], links = [];
  const packets = [], rings = [];
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 700 ? 14 : 18;
    cols = Math.ceil(W / cell) + 1; rows = Math.ceil(H / cell) + 1; field = new Float32Array(cols * rows);
    // mesh nodes scattered on the "map", with the hub placed lower-middle
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    nodes = [{ x: W * 0.47, y: H * 0.8, hub: true, name: 'HUB' }];
    const wide = W > 1100;
    for (let i = 0, tries = 0; i < 9 && tries < 400; tries++) {
      const x = W * (0.04 + 0.92 * r()), y = H * (0.08 + 0.86 * r());
      if (wide && x < W * 0.5 && y > H * 0.12 && y < H * 0.9) continue;      // keep clear of the headline column
      if (!wide && y > H * 0.08 && y < H * 0.95 && x < W * 0.9) continue;
      nodes.push({ x, y, name: 'N' + String(++i).padStart(2, '0') });
    }
    links = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes.map((n, j) => [Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y), j]).sort((a, b) => a[0] - b[0]);
      for (const [, j] of d.slice(1, 3)) if (!links.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) links.push([i, j]);
    }
  }
  function contours(t) {
    const z = t * 0.035;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cell / 260, y = j * cell / 260;
      field[j * cols + i] = noise3(x, y, z) * 0.9 + noise3(x * 2.3, y * 2.3, z * 1.3) * 0.35;
    }
    const levels = 14;
    for (let L = 0; L < levels; L++) {
      const iso = -0.75 + L * (1.5 / levels);
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i], b = field[j * cols + i + 1], c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
        const idx = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * cell, y = j * cell;
        const T = [x + cell * (iso - a) / (b - a), y], R = [x + cell, y + cell * (iso - b) / (c - b)];
        const B = [x + cell * (iso - d) / (c - d), y + cell], Lf = [x, y + cell * (iso - a) / (d - a)];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(Lf, B); break;
          case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(Lf, R); break;
          case 4: case 11: seg(T, R); break;
          case 5: seg(Lf, T); seg(B, R); break;
          case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(Lf, T); break;
          case 10: seg(T, R); seg(Lf, B); break;
        }
      }
      ctx.strokeStyle = L % 4 === 0 ? pal().major : pal().minor;
      ctx.lineWidth = L % 4 === 0 ? 1.1 : 0.8;
      ctx.stroke();
    }
  }
  let last = 0, t0 = performance.now(), visible = true, nextPkt = 0, nextRing = 0;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv);
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || now - last < 50) return; last = now;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    contours(REDUCED ? 0 : t);
    // grid ticks like a map sheet
    const P = pal();
    ctx.fillStyle = P.tick; ctx.font = '10px "IBM Plex Mono", monospace';
    for (let x = 120; x < W; x += 240) { ctx.fillRect(x, 0, 1, 6); ctx.fillText((45.5 + x / 9000).toFixed(3) + '°N', x + 4, 14); }
    // mesh links
    ctx.setLineDash([2, 5]); ctx.strokeStyle = P.link; ctx.lineWidth = 1;
    ctx.beginPath(); for (const [a, b] of links) { ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); } ctx.stroke(); ctx.setLineDash([]);
    if (!REDUCED && t > nextPkt) { const l = links[Math.floor(Math.random() * links.length)]; packets.push({ l, k: 0, rev: Math.random() < 0.5 }); nextPkt = t + 0.5 + Math.random() * 0.9; }
    if (!REDUCED && t > nextRing) { rings.push({ n: nodes[0], r: 0 }); nextRing = t + 3.2; }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]; p.k += 0.035; if (p.k >= 1) { packets.splice(i, 1); rings.push({ n: nodes[p.rev ? p.l[0] : p.l[1]], r: 0, small: true }); continue; }
      const A = nodes[p.rev ? p.l[1] : p.l[0]], B = nodes[p.rev ? p.l[0] : p.l[1]];
      const x = lerp(A.x, B.x, p.k), y = lerp(A.y, B.y, p.k);
      ctx.fillStyle = P.pkt; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.r += r.small ? 1.4 : 2.2; const max = r.small ? 34 : 260;
      if (r.r > max) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = r.small ? P.ping(0.5 * (1 - r.r / max)) : P.pulse(0.35 * (1 - r.r / max));
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r.n.x, r.n.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const n of nodes) {
      ctx.fillStyle = n.hub ? P.hub : P.node;
      ctx.beginPath(); if (n.hub) ctx.arc(n.x, n.y, 4, 0, Math.PI * 2); else { ctx.moveTo(n.x, n.y - 4); ctx.lineTo(n.x + 4, n.y + 3); ctx.lineTo(n.x - 4, n.y + 3); } ctx.fill();
      ctx.fillStyle = n.hub ? P.hubTxt : P.nodeTxt; ctx.fillText(n.name, n.x + 7, n.y + 3);
    }
  }
  layout(); addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 150); });
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ band scope */
const STATIONS = [
  { f: '162.550', band: 'NOAA WX', name: 'NOAA Weather Radio', kind: 'fm',
    desc: 'Continuous voice forecasts and emergency alerts, a steady narrow FM carrier. Portland is on 162.550 MHz.',
    use: 'Heard on: the SDR receiver (Tier 2), receive only' },
  { f: '144.390', band: 'APRS', name: 'APRS packet', kind: 'aprs',
    desc: 'Short 1200-baud bursts carrying positions and messages between ham stations, relayed by digipeaters.',
    use: 'Sent from: the ham handheld (Tier 2), license required' },
  { f: '906.875', band: 'LoRa', name: 'Meshtastic mesh', kind: 'lora',
    desc: 'LoRa chirps: each symbol is a tone that sweeps across the channel, which is why the waterfall shows diagonal stripes. Default US LongFast slot.',
    use: 'Sent from: the RAK4631 mesh radio (Tier 1), no license' },
  { f: '739.000', band: 'LTE B12', name: 'Cell downlink, after the quake', kind: 'dead',
    desc: 'Simulated outage: the local tower has lost power and backhaul, so the band is just noise. This is why the hub doesn\'t depend on towers.',
    use: 'Illustration, not a recording' },
  { f: '1090.000', band: 'ADS-B', name: 'Aircraft positions', kind: 'adsb',
    desc: 'Microsecond pulse bursts from aircraft transponders. Decode them to see rescue helicopters working your area.',
    use: 'Heard on: the SDR receiver (Tier 2), receive only' },
  { f: '1575.420', band: 'GNSS L1', name: 'GPS / Galileo', kind: 'gnss',
    desc: 'Below the noise floor. The receiver finds it by correlating with each satellite\'s known code, which lifts it out of the noise.',
    use: 'Heard by: the MAX-M10S receiver (Tier 1), receive only' },
  { f: '1621.250', band: 'IRIDIUM', name: 'Iridium satellite', kind: 'iridium',
    desc: 'Short TDMA bursts on 41.667 kHz channels in the 1616–1626.5 MHz band, from satellites 780 km up.',
    use: 'Sent from: the RockBLOCK 9704 (Tier 1), certified modem' },
];
function scope() {
  const cv = $('scope'), knob = $('knob'); if (!cv || !knob) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, specH = 0, dpr = 1, visible = true;
  const SPAN = 300;                              // degrees of knob travel
  const step = SPAN / (STATIONS.length - 1), A0 = -SPAN / 2;
  let angle = A0, target = A0, dragging = false, cur = 0;
  const presets = $('presets');
  presets.innerHTML = STATIONS.map((s, i) => `<button type="button" data-i="${i}">${s.band}</button>`).join('');
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; specH = Math.round(H * 0.34);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.fillStyle = '#060805'; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  layout(); addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 150); });
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv);

  const idxOf = (a) => Math.max(0, Math.min(STATIONS.length - 1, Math.round((a - A0) / step)));
  function showInfo(i) {
    const s = STATIONS[i]; cur = i;
    $('rxName').textContent = s.name; $('rxDesc').textContent = s.desc; $('rxUse').textContent = s.use; $('rxBand').textContent = s.band;
    knob.setAttribute('aria-valuenow', i); knob.setAttribute('aria-valuetext', `${s.f} MHz, ${s.name}`);
    for (const b of presets.children) b.classList.toggle('on', +b.dataset.i === i);
  }
  function tuneTo(i) { target = A0 + i * step; showInfo(i); }
  presets.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) tuneTo(+b.dataset.i); });
  knob.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); tuneTo(Math.min(STATIONS.length - 1, cur + 1)); }
    if (['ArrowLeft', 'ArrowDown'].includes(e.key)) { e.preventDefault(); tuneTo(Math.max(0, cur - 1)); }
  });
  knob.addEventListener('wheel', (e) => { e.preventDefault(); tuneTo(Math.max(0, Math.min(STATIONS.length - 1, cur + (e.deltaY > 0 ? 1 : -1)))); }, { passive: false });
  let prevA = 0;
  const ptrAngle = (e) => { const r = knob.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; };
  knob.addEventListener('pointerdown', (e) => { dragging = true; prevA = ptrAngle(e); knob.setPointerCapture(e.pointerId); });
  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return; const a = ptrAngle(e); let d = a - prevA; if (d > 180) d -= 360; if (d < -180) d += 360; prevA = a;
    target = Math.max(A0, Math.min(-A0, target + d)); angle = target; const i = idxOf(angle); if (i !== cur) showInfo(i);
  });
  const end = () => { if (!dragging) return; dragging = false; tuneTo(idxOf(target)); };
  knob.addEventListener('pointerup', end); knob.addEventListener('pointercancel', end);
  showInfo(0);

  // colormap: black -> deep green -> phosphor -> amber -> white
  const cmap = (v) => {
    v = Math.max(0, Math.min(1, v));
    if (v < 0.35) return [0, Math.round(40 * v / 0.35), Math.round(10 * v / 0.35)];
    if (v < 0.7) { const k = (v - 0.35) / 0.35; return [Math.round(60 * k), Math.round(40 + 196 * k), Math.round(10 + 100 * k)]; }
    const k = (v - 0.7) / 0.3; return [Math.round(60 + 195 * k), Math.round(236 - 40 * k + 19 * k * k), Math.round(110 + 60 * k)];
  };
  let row = null, rowData = null, t = 0, last = 0, pk = { burst: 0, next: 0, ch: 0 };
  const spec = new Float32Array(1024);
  function signal(kind, x, off, tt) {               // x in [-1,1] across the display, centre = tuned frequency
    const u = x - off;
    switch (kind) {
      case 'fm': return 0.62 * Math.exp(-(u * u) / 0.0009) + 0.18 * Math.exp(-(u * u) / 0.004) * (0.7 + 0.3 * Math.sin(tt * 9));
      case 'aprs': return pk.burst > 0 ? 0.55 * Math.exp(-(u * u) / 0.004) * (0.8 + 0.2 * Math.sin(u * 160 + tt * 40)) : 0;
      case 'lora': {
        if (pk.burst <= 0) return 0;
        const bw = 0.42, sweep = ((tt * 2.2) % 1) * bw - bw / 2;      // one chirp per symbol, wrapping across the channel
        return Math.abs(u) < bw / 2 ? 0.7 * Math.exp(-((u - sweep) ** 2) / 0.0007) + 0.06 : 0;
      }
      case 'adsb': return pk.burst > 0 && Math.random() < 0.6 ? 0.45 * Math.exp(-(u * u) / 0.03) : 0;
      case 'gnss': return 0.035 * Math.exp(-(u * u) / 0.08);
      case 'iridium': {
        if (pk.burst <= 0) return 0;
        const c = -0.6 + pk.ch * 0.12;
        return 0.6 * Math.exp(-((u - c) ** 2) / 0.0012);
      }
      default: return 0;
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || now - last < 33) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (!dragging) angle += (target - angle) * Math.min(1, dt * 10);
    knob.style.transform = `rotate(${angle}deg)`;
    const pos = (angle - A0) / step, i = Math.round(pos), off = (pos - i) * 1.6;   // detuning slides the signal off centre
    const s = STATIONS[Math.max(0, Math.min(STATIONS.length - 1, i))];
    // live frequency readout while turning
    const fa = parseFloat(STATIONS[Math.floor(Math.max(0, Math.min(STATIONS.length - 1.001, pos)))].f), fb = parseFloat(STATIONS[Math.ceil(Math.max(0, Math.min(STATIONS.length - 1, pos)))].f);
    const fr = Math.abs(off) < 0.02 ? parseFloat(s.f) : lerp(fa, fb, pos - Math.floor(pos));
    $('rxFreq').firstChild.nodeValue = fr.toFixed(3);
    // burst scheduler
    pk.burst -= dt;
    if (t > pk.next) {
      const k = s.kind;
      pk.burst = k === 'aprs' ? 0.9 : k === 'lora' ? 1.4 : k === 'adsb' ? 0.08 : k === 'iridium' ? 0.12 : 0;
      pk.ch = Math.floor(Math.random() * 11);
      pk.next = t + (k === 'aprs' ? 2.5 + Math.random() * 2 : k === 'lora' ? 2.2 + Math.random() * 1.5 : k === 'adsb' ? 0.15 + Math.random() * 0.3 : k === 'iridium' ? 0.09 + Math.random() * 0.5 : 1);
    }
    const w = cv.width, h = cv.height, sh = Math.round(specH * dpr), N = Math.min(1024, w);
    const detuneFade = Math.max(0, 1 - Math.abs(off) * 1.2);
    for (let k = 0; k < N; k++) {
      const x = (k / N) * 2 - 1;
      const n = 0.18 + 0.08 * Math.random() + 0.03 * Math.sin(x * 7 + t);
      spec[k] = spec[k] * 0.55 + (n + signal(s.kind, x, off, t) * detuneFade) * 0.45;
    }
    // waterfall: scroll down then paint a new row
    const wy = sh + 1, wh = h - wy, rh = Math.max(1, Math.round(dpr * 1.5));
    if (wh > rh) ctx.drawImage(cv, 0, wy, w, wh - rh, 0, wy + rh, w, wh - rh);
    if (!row || row.width !== w) { row = ctx.createImageData(w, 1); rowData = row.data; }
    for (let px = 0; px < w; px++) {
      const v = spec[Math.min(N - 1, Math.floor(px / w * N))];
      const [r, g, b] = cmap((v - 0.12) * 1.5);
      rowData[px * 4] = r; rowData[px * 4 + 1] = g; rowData[px * 4 + 2] = b; rowData[px * 4 + 3] = 255;
    }
    for (let k = 0; k < rh; k++) ctx.putImageData(row, 0, wy + k);
    // spectrum trace
    ctx.fillStyle = '#060805'; ctx.fillRect(0, 0, w, sh + 1);
    ctx.strokeStyle = 'rgba(164,236,110,.12)'; ctx.lineWidth = 1;
    for (let gx = 0; gx <= 10; gx++) { ctx.beginPath(); ctx.moveTo(gx * w / 10, 0); ctx.lineTo(gx * w / 10, sh); ctx.stroke(); }
    for (let gy = 1; gy < 4; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * sh / 4); ctx.lineTo(w, gy * sh / 4); ctx.stroke(); }
    ctx.beginPath();
    for (let k = 0; k < N; k++) { const x = k / (N - 1) * w, y = sh - Math.min(1, spec[k]) * sh * 0.9; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = '#a4ec6e'; ctx.lineWidth = 1.2 * dpr; ctx.shadowColor = '#a4ec6e'; ctx.shadowBlur = 6 * dpr; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,107,26,.8)'; ctx.fillRect(w / 2 - dpr * 0.5, 0, dpr, sh);         // tuned-frequency marker
    ctx.strokeStyle = '#233019'; ctx.beginPath(); ctx.moveTo(0, sh + 0.5); ctx.lineTo(w, sh + 0.5); ctx.stroke();
  }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ Morse SOS */
function morse() {
  const leds = [$('morseLed'), $('hdrLed')].filter(Boolean), txt = $('morseTxt');
  if (!leds.length) return;
  const U = 140, seq = [];                    // ... --- ...  (dot = 1 unit, dash = 3, gaps 1 / 3, word gap 7)
  const sym = ['.', '.', '.', '-', '-', '-', '.', '.', '.'];
  sym.forEach((c, i) => { seq.push([true, c === '.' ? 1 : 3, i]); seq.push([false, (i === 2 || i === 5) ? 3 : 1, -1]); });
  seq[seq.length - 1][1] = 9;
  const chars = '··· ––– ···';
  let k = 0;
  const run = () => {
    const [on, len, i] = seq[k]; leds.forEach((l) => l.classList.toggle('on', on));
    if (txt) txt.innerHTML = on ? chars.split('').map((c, j) => { const n = j - Math.floor(j / 4); return j % 4 !== 3 && n === i ? `<b style="color:var(--accent)">${c}</b>` : c; }).join('') + '  SOS' : chars + '  SOS';
    k = (k + 1) % seq.length; setTimeout(run, len * U);
  };
  if (REDUCED) { if (txt) txt.textContent = chars + '  SOS'; return; }
  run();
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
  const els = document.querySelectorAll('.body > h2, .body > figure, .body > .callout, .body > .tbl-wrap, .dl-grid, .rail, .bench-head, .rx');
  els.forEach((e) => e.classList.add('rv'));
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}
function clock() {
  const el = $('rxClock'); if (!el) return;
  const tick = () => { el.textContent = new Date().toISOString().slice(11, 19) + ' UTC'; };
  tick(); setInterval(tick, 1000);
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

theme(); hero(); scope(); morse(); tuner(); reveal(); clock();
