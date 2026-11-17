// Carrier board in 3D: the routed layout from cad/build_pcb.py (pcb-data.js).
// Explode the layers, light up a net and watch signals travel its copper, or play the assembly.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PCB } from './pcb-data.js';

const $ = (id) => document.getElementById(id);
const host = $('pcbView');

// KiCad footprint name -> what to draw; box (courtyard) -> centre and size
const KIND = (fp) => /^R_/.test(fp) ? 'R' : /^C_0805/.test(fp) ? 'C' : /SOD-123/.test(fp) ? 'D' : /SOT-23/.test(fp) ? 'Q' : /SOIC/.test(fp) ? 'ic'
  : /PinSocket/.test(fp) ? 'socket' : /IDC/.test(fp) ? 'idc' : /JST_SH/.test(fp) ? 'sh' : /JST_PH/.test(fp) ? 'jst' : /TerminalBlock/.test(fp) ? 'terminal'
  : /Buzzer/.test(fp) ? 'buzzer' : /CP_Radial/.test(fp) ? 'cap-radial' : 'other';
for (const c of PCB.comps) {
  c.kind ||= KIND(c.fp || '');
  if (c.box) { c.x = (c.box[0] + c.box[2]) / 2; c.y = (c.box[1] + c.box[3]) / 2; c.w = c.box[2] - c.box[0]; c.h = c.box[3] - c.box[1]; }
}
{ // the modules that plug into the sockets
  const R_ = Object.fromEntries(PCB.comps.map((c) => [c.ref, c]));
  if (R_.J9 && R_.J10 && !R_.U1) {
    const xs = R_.J9.pads.map((p) => p.x), y = (R_.J9.pads[0].y + R_.J10.pads[0].y) / 2;
    PCB.comps.push({ ref: 'U1', kind: 'feather', value: 'Adafruit ESP32-S3 Feather (5477)', x: (Math.min(...xs) + Math.max(...xs)) / 2, y, w: 50.8, h: 22.86,
      desc: 'The controller. It plugs into sockets J9 and J10, so it can come out for flashing on the bench.', pads: [], socketPads: [...R_.J9.pads, ...R_.J10.pads] });
  }
  if (R_.J11 && !R_.U2) {
    const xs = R_.J11.pads.map((p) => p.x);
    PCB.comps.push({ ref: 'U2', kind: 'boost', value: 'Adafruit MiniBoost 5 V (4654)', x: (Math.min(...xs) + Math.max(...xs)) / 2, y: R_.J11.pads[0].y + 3.2, w: 12.5, h: 9.5,
      desc: '5 V boost module in socket J11. EN low switches the 5 V rail fully off.', pads: [], socketPads: R_.J11.pads });
  }
}
const KIND_COL = { power: 0xff5a4e, i2c: 0x5b8def, uart: 0xf2b33d, spi: 0xb07ae8, gpio: 0xd9d4c4 };
const KIND_LABEL = { power: 'Power & ground', i2c: 'I²C', uart: 'UART', spi: 'SPI (e-paper)', gpio: 'GPIO & analog' };

function boot() {
  if (!host || boot.done) return; boot.done = true;
  const B = PCB.board, T = B.t;
  const isDark = () => document.documentElement.classList.contains('dark-mode');
  // ------------------------------------------------------------ scene
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 40; controls.maxDistance = 400; controls.maxPolarAngle = Math.PI * 0.94;
  const key = new THREE.DirectionalLight(0xfff0d8, 1.6); key.position.set(60, 140, 80); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 400 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005;
  scene.add(key, new THREE.HemisphereLight(0xefe6cf, 0x23251e, 0.5));
  const rim = new THREE.DirectionalLight(0xffb070, 0.6); rim.position.set(-90, 40, -80); scene.add(rim);
  const under = new THREE.DirectionalLight(0xdfe6ff, 0.9); under.position.set(20, -150, 40); scene.add(under);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -T / 2 - 14; floor.receiveShadow = true; scene.add(floor);

  // board coords (mm, y up on the board) -> scene (x right, z toward viewer)
  const P = (x, y, h = 0) => new THREE.Vector3(x - B.w / 2, h, -(y - B.h / 2));
  const root = new THREE.Group(); scene.add(root);
  const L = {}; for (const k of ['bottomCu', 'core', 'topCu', 'mask', 'pads', 'silk', 'parts']) { L[k] = new THREE.Group(); root.add(L[k]); }
  const EXP = { bottomCu: -10, core: 0, topCu: 6, mask: 12, pads: 15, silk: 20, parts: 30 };
  const std = (color, r = 0.6, m = 0.05, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...o });

  // ------------------------------------------------------------ board, mask, holes
  const shape = new THREE.Shape();
  { const r = 2, w = B.w, h = B.h; shape.moveTo(r, 0); shape.lineTo(w - r, 0); shape.quadraticCurveTo(w, 0, w, r); shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h); shape.lineTo(r, h); shape.quadraticCurveTo(0, h, 0, h - r); shape.lineTo(0, r); shape.quadraticCurveTo(0, 0, r, 0); }
  for (const hl of B.holes) { const p = new THREE.Path(); p.absarc(hl.x, hl.y, hl.d / 2, 0, Math.PI * 2, true); shape.holes.push(p); }
  const core = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 24 }), std(0xc9b27a, 0.75));
  core.rotation.x = -Math.PI / 2; core.position.set(-B.w / 2, -T / 2, B.h / 2); core.castShadow = core.receiveShadow = true; L.core.add(core);
  const maskMat = std(0x34452a, 0.42, 0.05, { transparent: true, opacity: 0.84 });
  const mask = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), maskMat); mask.rotation.x = -Math.PI / 2; mask.position.set(-B.w / 2, T / 2 + 0.06, B.h / 2); L.mask.add(mask);
  const gold = std(0xd9b25a, 0.28, 1), tin = std(0xcfd3d6, 0.3, 1), black = std(0x141414, 0.55, 0.1), hole = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  for (const hl of B.holes) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(hl.d / 2, hl.d / 2 + 0.9, 32), gold); ring.rotation.x = -Math.PI / 2; ring.position.copy(P(hl.x, hl.y, T / 2 + 0.1)); L.pads.add(ring);
  }

  // ------------------------------------------------------------ copper tracks (merged per net + layer)
  const netMats = {}, netMeshes = {}, netPaths = {};
  const CU = 0.07;
  function trackGeo(t, y) {
    const geos = [];
    for (let k = 0; k < t.pts.length - 1; k++) {
      const a = P(...t.pts[k], y), b = P(...t.pts[k + 1], y), len = a.distanceTo(b); if (len < 1e-6) continue;
      const g = new THREE.BoxGeometry(len, CU, t.w); g.rotateY(-Math.atan2(b.z - a.z, b.x - a.x)); g.translate((a.x + b.x) / 2, y, (a.z + b.z) / 2); geos.push(g);
    }
    for (const p of t.pts) { const c = new THREE.CylinderGeometry(t.w / 2, t.w / 2, CU, 12); const v = P(...p, y); c.translate(v.x, y, v.z); geos.push(c); }
    return geos;
  }
  const byNet = {};
  for (const t of PCB.tracks) {
    const y = t.layer === 'top' ? T / 2 + CU / 2 : -T / 2 - CU / 2;
    (byNet[t.net + '|' + t.layer] ||= []).push(...trackGeo(t, y));
    (netPaths[t.net] ||= []).push(t);
  }
  const copper = (net) => {
    const kind = PCB.nets[net].kind, base = new THREE.Color(0xc8742c);
    return netMats[net] ||= std(base, 0.35, 0.9, { emissive: new THREE.Color(KIND_COL[kind]), emissiveIntensity: 0 });
  };
  for (const [k, geos] of Object.entries(byNet)) {
    const [net, layer] = k.split('|');
    const m = new THREE.Mesh(mergeGeometries(geos), copper(net)); m.userData.net = net; m.receiveShadow = true;
    (layer === 'top' ? L.topCu : L.bottomCu).add(m); (netMeshes[net] ||= []).push(m);
  }
  // ground pour on the bottom
  const pour = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), std(0xb5652a, 0.4, 0.85, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  pour.rotation.x = -Math.PI / 2; pour.position.set(-B.w / 2, -T / 2 - 0.02, B.h / 2); pour.userData.net = 'GND'; L.bottomCu.add(pour); (netMeshes.GND ||= []).push(pour);
  pour.material.emissive = new THREE.Color(KIND_COL.power); pour.material.emissiveIntensity = 0; netMats.GND = pour.material;
  // vias
  const viaGeo = new THREE.CylinderGeometry(0.35, 0.35, T + 0.2, 14);
  for (const v of PCB.vias) { const m = new THREE.Mesh(viaGeo, gold); m.position.copy(P(v.x, v.y, 0)); m.userData.net = v.net; L.pads.add(m); }

  // ------------------------------------------------------------ pads
  const padMeshes = [];
  for (const c of PCB.comps) for (const p of c.pads) {
    const tops = [T / 2 + 0.11];
    if (p.th) tops.push(-T / 2 - 0.11);
    for (const y of tops) {
      let g;
      if (p.shape === 'circle') g = new THREE.CylinderGeometry(p.w / 2, p.w / 2, 0.08, 20);
      else g = new THREE.BoxGeometry(p.w, 0.08, p.h);
      const m = new THREE.Mesh(g, gold); m.position.copy(P(p.x, p.y, y)); m.userData = { pad: p, comp: c }; L.pads.add(m); padMeshes.push(m);
      if (p.th) { const d = new THREE.Mesh(new THREE.CircleGeometry(p.drill / 2, 16), hole); d.rotation.x = y > 0 ? -Math.PI / 2 : Math.PI / 2; d.position.copy(P(p.x, p.y, y + (y > 0 ? 0.05 : -0.05))); L.pads.add(d); }
    }
  }

  // ------------------------------------------------------------ silkscreen (canvas texture)
  {
    const S = 12, cv = document.createElement('canvas'); cv.width = B.w * S; cv.height = B.h * S; const g = cv.getContext('2d');
    g.strokeStyle = '#efeadb'; g.fillStyle = '#efeadb'; g.lineWidth = 2.2;
    const X = (x) => x * S, Y = (y) => (B.h - y) * S;
    for (const c of PCB.comps) {
      if (c.kind === 'feather' || c.kind === 'boost') continue;
      if (c.kind === 'R' || c.kind === 'C' || c.kind === 'D' || c.kind === 'Q') g.strokeRect(X(c.x - c.w / 2 - 0.4), Y(c.y + c.h / 2 + 0.4), (c.w + 0.8) * S, (c.h + 0.8) * S);
      else if (c.kind === 'buzzer' || c.kind === 'cap-radial') { g.beginPath(); g.arc(X(c.x), Y(c.y), c.w / 2 * S + 3, 0, Math.PI * 2); g.stroke(); }
      else g.strokeRect(X(c.x - c.w / 2), Y(c.y + c.h / 2), c.w * S, c.h * S);
      g.font = `600 ${c.kind === 'module' ? 30 : 20}px "IBM Plex Mono", monospace`;
      const lx = c.kind === 'R' || c.kind === 'C' ? c.x + c.w / 2 + 1.2 : c.x - c.w / 2;
      const ly = c.kind === 'R' || c.kind === 'C' || c.kind === 'D' || c.kind === 'Q' ? c.y : c.y + c.h / 2 + 1.0;
      g.fillText(c.ref, X(lx), Y(ly) + (c.kind === 'R' || c.kind === 'C' ? 7 : 0));
    }
    g.font = '700 40px "Saira Stencil One", "IBM Plex Mono", sans-serif'; g.fillText('SURVIVAL RADIO', X(6), Y(52));
    g.font = '500 20px "IBM Plex Mono", monospace'; g.fillText('CARRIER v0.2', X(6), Y(49));
    g.fillText('acamaro.com', X(6), Y(46.5));
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const silk = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    silk.rotation.x = -Math.PI / 2; silk.position.y = T / 2 + 0.14; L.silk.add(silk);
  }

  // ------------------------------------------------------------ components
  const parts = {};
  function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
  function cyl(r, h, mat, x, y, z, seg = 28) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
  function headerStrip(pads, h, mat) {
    const g = new THREE.Group(); const xs = pads.map((p) => p.x), ys = pads.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const c = P((x0 + x1) / 2, (y0 + y1) / 2, 0);
    g.add(box(x1 - x0 + 2.54, h, y1 - y0 + 2.54, mat, c.x, T / 2 + h / 2, c.z));
    for (const p of pads) { const q = P(p.x, p.y); g.add(box(0.9, 0.2, 0.9, black, q.x, T / 2 + h + 0.1, q.z)); }
    return g;
  }
  const white = std(0xece8dc, 0.55), blue = std(0x1f3b70, 0.5), green = std(0x2f6b3a, 0.55), pcbBlack = std(0x1b1b1b, 0.5), can = std(0xc7cbd0, 0.25, 1);
  for (const c of PCB.comps) {
    const g = new THREE.Group(); g.userData.comp = c; const ctr = P(c.x, c.y), top = T / 2;
    const pads = c.pads;
    const bw = Math.max(1, c.w - 0.5), bh = Math.max(1, c.h - 0.5);
    switch (c.kind) {
      case 'R': case 'C': {
        const vert = c.h > c.w, len = 2.0, wid = 1.25, h = c.kind === 'R' ? 0.5 : 0.85;
        const bodyMat = c.kind === 'R' ? pcbBlack : std(0xb48a5a, 0.6);
        g.add(box(vert ? wid : len * 0.6, h, vert ? len * 0.6 : wid, bodyMat, ctr.x, top + h / 2 + 0.1, ctr.z));
        for (const p of pads) { const q = P(p.x, p.y); g.add(box(vert ? wid : 0.45, h, vert ? 0.45 : wid, tin, q.x + (vert ? 0 : (q.x > ctr.x ? -0.2 : 0.2)), top + h / 2 + 0.1, q.z + (vert ? (q.z > ctr.z ? -0.2 : 0.2) : 0))); }
        break;
      }
      case 'Q': { const c3 = P((pads[0].x + pads[1].x + pads[2].x) / 3, (pads[0].y + pads[1].y + pads[2].y) / 3); g.add(box(1.3, 1.0, 2.9, black, c3.x, top + 0.6, c3.z)); for (const p of pads) { const q = P(p.x, p.y); g.add(box(0.9, 0.15, 0.4, tin, q.x, top + 0.15, q.z)); } break; }
      case 'D': { const k = P(pads[0].x, pads[0].y), a2 = P(pads[1].x, pads[1].y), m = k.clone().add(a2).multiplyScalar(0.5), vert = Math.abs(k.z - a2.z) > Math.abs(k.x - a2.x);
        g.add(box(vert ? 1.6 : 2.7, 1.1, vert ? 2.7 : 1.6, black, m.x, top + 0.65, m.z)); g.add(box(vert ? 1.62 : 0.35, 1.12, vert ? 0.35 : 1.62, std(0xd8d8d8, 0.5), m.x + (k.x - m.x) * 0.55, top + 0.66, m.z + (k.z - m.z) * 0.55)); break; }
      case 'ic': { g.add(box(7.5, 2.4, 11.6, black, ctr.x, top + 1.3, ctr.z)); for (const p of pads) { const q = P(p.x, p.y); g.add(box(1.4, 0.2, 0.42, tin, q.x, top + 0.2, q.z)); } g.add(cyl(0.6, 0.05, std(0x333333), ctr.x - 2.4, top + 2.52, ctr.z - 4.4, 16)); break; }
      case 'socket': g.add(headerStrip(pads, c.ref === 'J11' ? 8.5 : 8.5, pcbBlack)); break;
      case 'idc': { g.add(box(bw, 9, bh, std(0x222222, 0.6), ctr.x, top + 4.5, ctr.z)); g.add(box(1.2, 6, 4.5, std(0x111111), ctr.x - bw / 2 - 0.3, top + 5, ctr.z)); for (const p of pads) { const q = P(p.x, p.y); g.add(box(0.64, 6, 0.64, gold, q.x, top + 3.2, q.z)); } break; }
      case 'jst': { g.add(box(bw, 6, bh, white, ctr.x, top + 3, ctr.z)); g.add(box(bw - 1, 4.4, 0.6, std(0xd2cdbf), ctr.x, top + 3.6, ctr.z - bh / 2 + 0.3)); break; }
      case 'sh': { g.add(box(6, 2.9, 4.3, white, ctr.x, top + 1.5, ctr.z)); break; }
      case 'terminal': { g.add(box(bw, 8.5, bh, green, ctr.x, top + 4.25, ctr.z)); for (const p of pads) { const q = P(p.x, p.y); g.add(cyl(1.1, 0.6, tin, q.x, top + 8.6, q.z, 16)); } break; }
      case 'buzzer': { g.add(cyl(6, 9.5, std(0x111111, 0.4), ctr.x, top + 4.75, ctr.z, 40)); g.add(cyl(1.0, 0.3, std(0x333), ctr.x, top + 9.6, ctr.z, 16)); break; }
      case 'cap-radial': { g.add(cyl(3.15, 7.7, std(0x2b3a55, 0.4, 0.2), ctr.x, top + 3.85, ctr.z, 32)); g.add(cyl(3.0, 0.2, can, ctr.x, top + 7.8, ctr.z, 32)); g.add(box(1.2, 7.6, 0.4, std(0xd8dce2, 0.5), ctr.x - 2.3, top + 3.85, ctr.z + 2.0)); break; }
      case 'feather': {
        const y = top + 8.5 + 2.5 + 0.8;
        g.add(box(50.8, 1.6, 22.86, std(0x1d1d1d, 0.5), ctr.x, y, ctr.z));
        g.add(box(18, 3.1, 15.4, can, ctr.x + 12, y + 2.3, ctr.z));
        g.add(box(9, 3.2, 7.4, std(0xb9bec4, 0.3, 1), ctr.x - 23, y + 2.3, ctr.z));
        g.add(box(6, 5, 8, std(0xeeeeee, 0.6), ctr.x - 14, y + 3.3, ctr.z + 6));
        for (const p of c.socketPads) { const q = P(p.x, p.y); g.add(box(0.64, 3, 0.64, gold, q.x, y - 1.6, q.z)); }
        break;
      }
      case 'boost': {
        const y = top + 8.5 + 2.5 + 0.8;
        g.add(box(12.5, 1.6, 9.5, blue, ctr.x, y, ctr.z));
        g.add(box(4, 2, 4, std(0x222222), ctr.x - 1, y + 1.6, ctr.z - 1));
        g.add(box(3.4, 1.4, 1.8, std(0x8a7a5a), ctr.x + 3.5, y + 1.4, ctr.z - 2));
        for (const p of c.socketPads) { const q = P(p.x, p.y); g.add(box(0.64, 3, 0.64, gold, q.x, y - 1.6, q.z)); }
        break;
      }
      default: g.add(box(bw, 2, bh, white, ctr.x, top + 1, ctr.z));
    }
    g.traverse((o) => { if (o.isMesh) { o.userData.comp = c; o.castShadow = true; } });
    L.parts.add(g); parts[c.ref] = g; g.userData.base = g.position.clone();
  }

  // ------------------------------------------------------------ state, UI
  let explode = 0, explodeT = 0, selNet = null, selComp = null, build = null;
  const pulses = [];
  const caption = $('pcbCap'), tip = $('pcbTip'), info = $('pcbInfo'), netList = $('pcbNets');
  const vis = { parts: true, silk: true, mask: true, topCu: true, bottomCu: true };

  // net list
  const kinds = {}; for (const [n, d] of Object.entries(PCB.nets)) (kinds[d.kind] ||= []).push(n);
  netList.innerHTML = Object.entries(KIND_LABEL).filter(([k]) => kinds[k]).map(([k, lab]) =>
    `<div class="grp">${lab}</div>` + kinds[k].map((n) => `<button type="button" data-net="${n}"><i style="background:#${KIND_COL[k].toString(16).padStart(6, '0')}"></i>${n}</button>`).join('')).join('');
  netList.addEventListener('click', (e) => { const b = e.target.closest('[data-net]'); if (b) pickNet(selNet === b.dataset.net ? null : b.dataset.net); });

  function pickNet(n) {
    selNet = n; pulses.splice(0).forEach((p) => p.m.removeFromParent());
    for (const [net, m] of Object.entries(netMats)) { m.emissiveIntensity = net === n ? (net === 'GND' ? 0.3 : 0.9) : 0; if (net !== 'GND') m.opacity = 1; }
    for (const b of netList.querySelectorAll('[data-net]')) b.classList.toggle('on', b.dataset.net === n);
    if (n) {
      maskMat.opacity = Math.min(maskMat.opacity, 0.55);
      const d = PCB.nets[n];
      info.innerHTML = `<h3>${n}</h3><p>${d.desc}</p><p class="sub">${d.pins.length} pins: ${d.pins.join(', ')}</p>${n === 'GND' ? '<p class="sub">Ground is the copper pour that fills the bottom layer; surface-mount ground pads reach it through vias.</p>' : ''}`;
    } else { maskMat.opacity = vis.mask ? 0.84 : 0; info.innerHTML = defaultInfo; }
  }
  const defaultInfo = info.innerHTML;
  function pickComp(c) {
    selComp = c;
    if (!c) { info.innerHTML = defaultInfo; return; }
    const rows = c.pads.filter((p) => !/^M/.test(p.pin)).map((p) => `<tr><td>${p.pin}</td><td>${p.net ? `<button type="button" class="netlink" data-net="${p.net}">${p.net}</button>` : '—'}</td></tr>`).join('');
    info.innerHTML = `<h3>${c.ref} · ${c.value}</h3><p>${c.desc}</p>${c.fp ? `<p class="sub">Footprint: ${c.fp}</p>` : ''}${rows ? `<table class="mini-t">${rows}</table>` : ''}`;
  }
  info.addEventListener('click', (e) => { const b = e.target.closest('.netlink'); if (b) pickNet(b.dataset.net); });

  // layer toggles & controls
  for (const b of document.querySelectorAll('#pcbLayers [data-l]')) b.onclick = () => {
    const k = b.dataset.l; vis[k] = !vis[k]; b.classList.toggle('on', vis[k]);
    if (k === 'mask') { maskMat.opacity = vis.mask ? (selNet ? 0.55 : 0.84) : 0; mask.visible = vis.mask; }
    else L[k].visible = vis[k];
    if (k === 'parts') L.parts.visible = vis.parts;
  };
  $('pcbExplode').oninput = (e) => { explode = +e.target.value; };
  $('pcbFlip').onclick = () => { const back = camera.position.y > 0; flyTo(back ? V(0, -170, 60) : V(60, 120, 120)); };
  $('pcbReset').onclick = () => { explode = 0; $('pcbExplode').value = 0; pickNet(null); pickComp(null); flyTo(V(60, 120, 120)); };
  $('pcbBuild').onclick = () => startBuild();

  // build animation
  const STAGES = [
    ['Bare board: two copper layers, olive solder mask, white silkscreen.', () => []],
    ['Stage 1 · surface-mount parts: resistors, capacitors, diodes, transistors, the expander and the Qwiic socket. Solder these first, lowest parts first.', (c) => ['R', 'C', 'D', 'Q', 'ic', 'sh'].includes(c.kind)],
    ['Stage 2 · through-hole connectors: JST sockets, the modem box header, the screw terminal.', (c) => ['jst', 'idc', 'terminal'].includes(c.kind)],
    ['Stage 3 · tall parts: buzzer and 100 µF capacitor (check the polarity marks).', (c) => c.kind === 'buzzer' || c.kind === 'cap-radial'],
    ['Stage 4 · sockets for the modules. Solder them with the Feather and boost board plugged in so they line up.', (c) => c.kind === 'socket'],
    ['Stage 5 · plug in the modules: the MiniBoost and the Feather.', (c) => c.kind === 'feather' || c.kind === 'boost'],
    ['Done. Before powering it, check with a meter that LOAD, 5V and 3V3 are not shorted to GND, then power it from a current-limited supply.', () => []],
  ];
  function startBuild() {
    pickNet(null); pickComp(null); explode = 0; $('pcbExplode').value = 0;
    for (const g of Object.values(parts)) { g.visible = false; g.position.copy(g.userData.base); }
    build = { stage: 0, t: 0, items: [] }; caption.innerHTML = STAGES[0][0]; caption.classList.add('show');
    flyTo(V(70, 110, 110));
  }
  function stepBuild(dt) {
    if (!build) return;
    build.t += dt;
    if (build.items.length && build.items.every((it) => it.done) || (!build.items.length && build.t > 2.2)) {
      if (build.t < 1.4) return;
      build.stage++; build.t = 0;
      if (build.stage >= STAGES.length) { build = null; setTimeout(() => caption.classList.remove('show'), 4000); return; }
      caption.innerHTML = STAGES[build.stage][0];
      const sel = PCB.comps.filter(STAGES[build.stage][1]);
      build.items = sel.map((c, i) => ({ g: parts[c.ref], c, delay: i * 0.12, k: 0, done: false }));
      build.items.forEach((it) => { it.g.visible = true; it.g.position.y = 60; });
    }
    for (const it of build.items) {
      if (it.done) continue;
      const k = Math.max(0, Math.min(1, (build.t - it.delay) / 0.55)); const e = 1 - (1 - k) ** 3;
      it.g.position.y = it.g.userData.base.y + explodeT * EXP.parts + 60 * (1 - e);
      if (k >= 1) { it.done = true; spark(it.c); }
    }
  }
  const sparkGeo = new THREE.RingGeometry(0.3, 0.6, 20);
  function spark(c) {
    for (const p of c.pads.slice(0, 18)) {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.copy(P(p.x, p.y, T / 2 + 0.3)); root.add(m); pulses.push({ spark: true, m, t: 0 });
    }
  }

  // pulses along the selected net's copper
  const pulseGeo = new THREE.SphereGeometry(0.55, 12, 12);
  let pulseTimer = 0;
  function spawnPulses() {
    if (!selNet || !netPaths[selNet]) return;
    const col = KIND_COL[PCB.nets[selNet].kind];
    for (const t of netPaths[selNet]) {
      const y = t.layer === 'top' ? T / 2 + 0.3 : -T / 2 - 0.3;
      const pts = t.pts.map((p) => P(p[0], p[1], y)); const lens = [0]; for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + pts[k].distanceTo(pts[k - 1]));
      const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: col })); (t.layer === 'top' ? L.topCu : L.bottomCu).add(m);
      pulses.push({ m, pts, lens, s: 0, speed: 26 });
    }
  }

  // camera
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const fly = { on: false };
  function flyTo(p, target = V(0, 0, 0), dur = 1.2) { Object.assign(fly, { on: true, k: 0, p0: camera.position.clone(), p1: p, t0: controls.target.clone(), t1: target, dur }); }
  camera.position.set(140, 160, 170); controls.target.set(0, 0, 0);
  controls.addEventListener('start', () => { fly.on = false; });

  // picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  function hit(e) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = [...(vis.parts ? [L.parts] : []), L.pads, ...(vis.topCu ? [L.topCu] : []), ...(vis.bottomCu ? [L.bottomCu] : [])];
    for (const h of ray.intersectObjects(objs, true)) {
      if (!h.object.visible || pulses.some((p) => p.m === h.object)) continue;
      const u = h.object.userData; if (u.pad || u.comp || u.net) return { ...u, x: e.clientX - r.left, y: e.clientY - r.top };
    }
    return null;
  }
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; const h = hit(e);
    if (!h) { tip.classList.remove('show'); renderer.domElement.style.cursor = 'grab'; return; }
    renderer.domElement.style.cursor = 'pointer';
    tip.innerHTML = h.pad ? `<b>${h.comp.ref}.${h.pad.pin}</b> · ${h.pad.net || 'no net'}` : h.comp ? `<b>${h.comp.ref}</b> · ${h.comp.value}` : `<b>${h.net}</b> trace`;
    tip.style.left = h.x + 14 + 'px'; tip.style.top = h.y + 10 + 'px'; tip.classList.add('show');
  });
  renderer.domElement.addEventListener('pointerleave', () => tip.classList.remove('show'));
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; down = null;
    const h = hit(e); if (!h) { pickNet(null); pickComp(null); return; }
    if (h.pad && h.pad.net) { pickComp(h.comp); pickNet(h.pad.net); pickComp(h.comp); return; }
    if (h.net && !h.comp) { pickNet(h.net); return; }
    if (h.comp) { pickNet(null); pickComp(h.comp); }
  });

  // theme
  function theme() {
    const d = isDark(); scene.background = new THREE.Color(d ? 0x17180f : 0xd9d1b9);
    floor.material.opacity = d ? 0.45 : 0.22;
  }
  theme(); new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // loop
  function resize() { const w = host.clientWidth, h = host.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true; new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(host);
  const clock = new THREE.Clock();
  flyTo(V(60, 120, 120), V(0, 0, 0), 2.2);
  (function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05); if (!visible) return;
    explodeT += (explode - explodeT) * Math.min(1, dt * 6);
    for (const [k, g] of Object.entries(L)) g.position.y = EXP[k] * explodeT;
    if (!build) for (const g of Object.values(parts)) g.position.y = g.userData.base.y;
    stepBuild(dt);
    pulseTimer += dt; if (selNet && pulseTimer > 0.9) { pulseTimer = 0; spawnPulses(); }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (p.spark) { p.t += dt; const s = 1 + p.t * 6; p.m.scale.set(s, s, s); p.m.material.opacity = 1 - p.t / 0.5; if (p.t > 0.5) { p.m.removeFromParent(); pulses.splice(i, 1); } continue; }
      p.s += p.speed * dt; const tot = p.lens[p.lens.length - 1];
      if (p.s > tot) { p.m.removeFromParent(); pulses.splice(i, 1); continue; }
      let k = 1; while (k < p.lens.length - 1 && p.lens[k] < p.s) k++;
      const f = (p.s - p.lens[k - 1]) / Math.max(1e-6, p.lens[k] - p.lens[k - 1]); p.m.position.lerpVectors(p.pts[k - 1], p.pts[k], f);
    }
    if (fly.on) {
      fly.k = Math.min(1, fly.k + dt / fly.dur); const e = fly.k < 0.5 ? 4 * fly.k ** 3 : 1 - (-2 * fly.k + 2) ** 3 / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e); if (fly.k >= 1) fly.on = false;
    }
    controls.update(); renderer.render(scene, camera);
  })();
}

// start the second WebGL view only when its section approaches the screen
if (host) new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: '600px 0px' }).observe(host);

// parts table (rendered right away, independent of WebGL)
{
  const t = $('pcbBom');
  if (t) {
    const groups = new Map();
    for (const c of PCB.comps) { if (!c.fp) continue; const k = c.value + '|' + c.fp; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    t.innerHTML = '<tr><th>Refs</th><th>Part</th><th>Qty</th><th>Footprint</th><th>What it does</th></tr>' + [...groups.entries()].map(([k, cs]) =>
      `<tr><td><code>${cs.map((c) => c.ref).join(' ')}</code></td><td>${cs[0].value}</td><td>${cs.length}</td><td><code>${cs[0].fp}</code></td><td>${cs[0].desc}</td></tr>`).join('');
    const st = $('pcbStats'); if (st) st.textContent = `${PCB.tracks.length} copper traces and ${PCB.vias.length} vias`;
  }
}
