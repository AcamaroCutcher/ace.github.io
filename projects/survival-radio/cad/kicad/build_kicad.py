"""Survival Radio carrier board -> KiCad project (schematic, board, project) + website data.

Uses footprints and symbols from the KiCad standard libraries, routes the board on the real
pad geometry with router.py, and writes:
  carrier/carrier.kicad_pro, carrier.kicad_sch, carrier.kicad_pcb
  ../../pcb-data.js (for the 3D viewer on the page)
Run:  python3 build_kicad.py [KiCad SharedSupport dir]
Then: kicad-cli pcb drc --refill-zones --save-board --schematic-parity carrier/carrier.kicad_pcb
"""
import json, math, os, sys, uuid
from sexpr import parse, dump, find, findall, Sym

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '..', '..'))
KI = sys.argv[1] if len(sys.argv) > 1 else '/Applications/KiCad/KiCad.app/Contents/SharedSupport'
OUT = os.path.join(HERE, 'carrier')
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)
from router import route

BW, BH = 100.0, 70.0
OX, OY = 100.0, 50.0                       # board's top-left corner on the KiCad page
kx = lambda bx: round(OX + bx, 4)
ky = lambda by: round(OY + (BH - by), 4)
U = lambda: str(uuid.uuid4())
S = Sym

# ---------------------------------------------------------------------------- parts
# ref, value, footprint, symbol, board x, board y (footprint origin), rotation, {pin: net}, description
FEA = {1: None, 2: '3V3', 3: None, 4: 'GND', 5: 'MESH_TX', 6: 'MESH_RX', 7: 'CH4_TX', 8: 'CH4_RX', 9: 'LADDER', 10: 'MOTION_INT',
       11: 'EPD_CLK', 12: 'EPD_DIN', 13: 'I_BTD', 14: 'MODEM_RX', 15: 'MODEM_TX', 16: None}
FEB = {1: 'LOAD', 2: None, 3: None, 4: 'BUZ_PWM', 5: 'EPD_BUSY', 6: 'I_EN', 7: 'EPD_CS', 8: 'EPD_DC', 9: 'EPD_RST', 10: 'SOS_IN', 11: 'SCL', 12: 'SDA'}
PARTS = [
  ('J9', 'Feather 16-pin socket', 'Connector_PinSocket_2.54mm:PinSocket_1x16_P2.54mm_Vertical', 'Connector_Generic:Conn_01x16', 28.0, 30.0, 90, FEA,
   'Socket for the Feather\'s 16-pin side: RST 3V NC GND A0–A5 SCK MO MI RX TX DB.'),
  ('J10', 'Feather 12-pin socket', 'Connector_PinSocket_2.54mm:PinSocket_1x12_P2.54mm_Vertical', 'Connector_Generic:Conn_01x12', 38.16, 50.32, 90, FEB,
   'Socket for the Feather\'s 12-pin side: BAT EN USB D13 D12 D11 D10 D9 D6 D5 SCL SDA.'),
  ('J11', 'MiniBoost socket', 'Connector_PinSocket_2.54mm:PinSocket_1x04_P2.54mm_Vertical', 'Connector_Generic:Conn_01x04', 82.0, 57.0, 90,
   {1: 'LOAD', 2: 'GND', 3: 'BOOST_EN', 4: '5V'}, 'Socket for the Adafruit MiniBoost 5 V module (VIN, GND, EN, VOUT). Match the order to the module\'s silkscreen.'),
  ('J1', 'RockBLOCK 9704 (2x8 IDC)', 'Connector_IDC:IDC-Header_2x08_P2.54mm_Vertical', 'Connector_Generic:Conn_02x08_Odd_Even', 86.0, 39.78, 0,
   {1: 'GND', 4: 'GND', 10: 'GND', 16: 'GND', 3: 'I_EN', 7: 'I_BTD', 13: 'MODEM_RX', 14: 'MODEM_TX', 15: '5V'},
   'Ribbon cable to the RockBLOCK 9704 16-pin header: V_IN+ (15), I_EN (3), I_BTD (7), TXD (13), RXD (14), grounds.'),
  ('C2', '100uF 10V', 'Capacitor_THT:CP_Radial_D6.3mm_P2.50mm', 'Device:C_Polarized', 94.0, 52.5, 270, {1: '5V', 2: 'GND'},
   'Bulk capacitor on the 5 V rail next to the modem cable.'),
  ('R10', '100k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 79.0, 52.0, 270, {1: 'BOOST_EN', 2: 'GND'}, 'Pull-down on boost EN: 5 V stays off while the controller boots.'),
  ('U3', 'MCP23008-E/SO', 'Package_SO:SOIC-18W_7.5x11.6mm_P1.27mm', 'Interface_Expansion:MCP23008-xSO', 75.5, 12.5, 0,
   {1: 'SCL', 2: 'SDA', 3: 'GND', 4: 'GND', 5: 'GND', 6: '3V3', 9: 'GND', 10: 'BOOST_EN', 11: 'POD_DRV', 12: 'PANEL_LED', 18: '3V3'},
   'I²C GPIO expander at 0x20 (A0–A2 low): boost enable, pod LED/vibration, panel LED.'),
  ('C4', '100nF', 'Capacitor_SMD:C_0805_2012Metric', 'Device:C', 76.0, 21.5, 0, {1: '3V3', 2: 'GND'}, 'Decoupling for U3.'),
  ('J3', 'Sensor pod (8-pin)', 'Connector_JST:JST_PH_B8B-PH-K_1x08_P2.00mm_Vertical', 'Connector_Generic:Conn_01x08', 40.0, 7.5, 0,
   {1: '5V', 2: '3V3', 3: 'GND', 4: 'SDA', 5: 'SCL', 6: 'CH4_TX', 7: 'CH4_RX', 8: 'POD_OUT'},
   'Sensor-pod cable to the 8-pin M12 bulkhead: 5 V, 3.3 V, GND, I²C, methane UART, switched pod output.'),
  ('Q2', 'MMBT3904', 'Package_TO_SOT_SMD:SOT-23', 'Transistor_BJT:Q_NPN_BEC', 61.0, 9.5, 0, {1: 'Q2_B', 2: 'GND', 3: 'POD_OUT'}, 'Low-side switch for the pod LED and vibration motor.'),
  ('R8', '1k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 67.0, 9.5, 0, {1: 'Q2_B', 2: 'POD_DRV'}, 'Base resistor for Q2.'),
  ('R9', '10k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 63.5, 15.0, 270, {1: 'Q2_B', 2: 'GND'}, 'Holds Q2 off at start-up.'),
  ('D2', '1N4148W', 'Diode_SMD:D_SOD-123', 'Device:D', 57.0, 14.0, 270, {1: '3V3', 2: 'POD_OUT'}, 'Flyback diode across the pod motor.'),
  ('J4', 'Qwiic (JST-SH 4)', 'Connector_JST:JST_SH_SM04B-SRSS-TB_1x04-1MP_P1.00mm_Horizontal', 'Connector_Generic:Conn_01x04', 25.5, 7.5, 180,
   {1: 'GND', 2: '3V3', 3: 'SDA', 4: 'SCL'}, 'Qwiic chain to the GNSS receiver and the LIS3DH accelerometer.'),
  ('J8', 'Motion INT', 'Connector_JST:JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical', 'Connector_Generic:Conn_01x02', 32.0, 7.5, 0, {1: 'MOTION_INT', 2: 'GND'},
   'LIS3DH INT1: wakes the controller on motion or free-fall.'),
  ('J5', 'E-paper (8-pin)', 'Connector_JST:JST_PH_B8B-PH-K_1x08_P2.00mm_Vertical', 'Connector_Generic:Conn_01x08', 30.0, 64.0, 0,
   {1: '3V3', 2: 'GND', 3: 'EPD_DIN', 4: 'EPD_CLK', 5: 'EPD_CS', 6: 'EPD_DC', 7: 'EPD_RST', 8: 'EPD_BUSY'}, 'E-paper display cable (SPI and control).'),
  ('J6', 'Control panel (6-pin)', 'Connector_JST:JST_PH_B6B-PH-K_1x06_P2.00mm_Vertical', 'Connector_Generic:Conn_01x06', 54.0, 64.0, 0,
   {1: 'SOS_SW', 2: 'LADDER', 3: 'BTN2', 4: 'BTN3', 5: 'LED_A', 6: 'GND'}, 'Control panel: SOS switch, three buttons, panel LED, ground.'),
  ('R1', '10k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 57.5, 56.5, 270, {1: '3V3', 2: 'SOS_SW'}, 'SOS pull-up.'),
  ('R2', '1k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 62.0, 58.5, 0, {1: 'SOS_SW', 2: 'SOS_IN'}, 'Series resistor into the SOS pin.'),
  ('C1', '100nF', 'Capacitor_SMD:C_0805_2012Metric', 'Device:C', 66.5, 56.0, 270, {1: 'SOS_IN', 2: 'GND'}, 'With R2, an RC filter on the SOS line.'),
  ('R11', '330', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 71.0, 58.5, 0, {1: 'PANEL_LED', 2: 'LED_A'}, 'Panel LED current limit.'),
  ('R3', '10k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 47.0, 21.5, 270, {1: '3V3', 2: 'LADDER'}, 'Top of the button ladder.'),
  ('R4', '10k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 51.5, 21.5, 270, {1: 'LADDER', 2: 'BTN2'}, 'Button 2: about 1.65 V.'),
  ('R5', '33k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 56.0, 21.5, 270, {1: 'LADDER', 2: 'BTN3'}, 'Button 3: about 2.5 V.'),
  ('BZ1', 'Buzzer 12 mm', 'Buzzer_Beeper:Buzzer_12x9.5RM7.6', 'Device:Buzzer', 8.2, 21.0, 0, {1: 'LOAD', 2: 'BUZ_K'}, 'Magnetic buzzer 3–5 V, driven by Q1.'),
  ('Q1', 'MMBT3904', 'Package_TO_SOT_SMD:SOT-23', 'Transistor_BJT:Q_NPN_BEC', 21.5, 29.5, 0, {1: 'Q1_B', 2: 'GND', 3: 'BUZ_K'}, 'Low-side switch for the buzzer.'),
  ('R6', '1k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 26.5, 24.5, 0, {1: 'BUZ_PWM', 2: 'Q1_B'}, 'Base resistor for Q1.'),
  ('R7', '10k', 'Resistor_SMD:R_0805_2012Metric', 'Device:R', 19.8, 25.0, 270, {1: 'Q1_B', 2: 'GND'}, 'Holds Q1 off at reset.'),
  ('D1', '1N4148W', 'Diode_SMD:D_SOD-123', 'Device:D', 12.0, 31.0, 0, {1: 'LOAD', 2: 'BUZ_K'}, 'Flyback diode across the buzzer.'),
  ('J7', 'LOAD in', 'TerminalBlock_Phoenix:TerminalBlock_Phoenix_PT-1,5-2-3.5-H_1x02_P3.50mm_Horizontal', 'Connector:Screw_Terminal_01x02', 6.5, 41.0, 270,
   {1: 'LOAD', 2: 'GND'}, 'LOAD rail in from the charger board (≤ 4.4 V) and ground.'),
  ('C3', '10uF', 'Capacitor_SMD:C_0805_2012Metric', 'Device:C', 14.0, 40.0, 270, {1: 'LOAD', 2: 'GND'}, 'Bulk capacitance on LOAD.'),
  ('J2', 'Mesh radio (4-pin)', 'Connector_JST:JST_PH_B4B-PH-K_1x04_P2.00mm_Vertical', 'Connector_Generic:Conn_01x04', 6.0, 57.0, 0,
   {1: 'LOAD', 2: 'GND', 3: 'MESH_RX', 4: 'MESH_TX'}, 'Mesh radio (RAK19007): battery-rail power and UART 2.'),
] + [(f'H{i + 1}', 'M2.5', 'MountingHole:MountingHole_2.7mm_M2.5', 'Mechanical:MountingHole', x, y, 0, {}, 'M2.5 mounting hole.')
     for i, (x, y) in enumerate([(3.5, 3.5), (96.5, 3.5), (3.5, 66.5), (96.5, 66.5)])]
POWER = {'LOAD', '5V', '3V3'}
NET_KIND = {'GND': 'power', 'LOAD': 'power', '5V': 'power', '3V3': 'power', 'SDA': 'i2c', 'SCL': 'i2c',
            'MODEM_TX': 'uart', 'MODEM_RX': 'uart', 'MESH_TX': 'uart', 'MESH_RX': 'uart', 'CH4_TX': 'uart', 'CH4_RX': 'uart'}
for n in ['EPD_CLK', 'EPD_DIN', 'EPD_CS', 'EPD_DC', 'EPD_RST', 'EPD_BUSY']: NET_KIND[n] = 'spi'

# ---------------------------------------------------------------------------- footprints
def load_fp(libname):
    lib, name = libname.split(':')
    return parse(open(os.path.join(KI, 'footprints', lib + '.pretty', name + '.kicad_mod'), encoding='utf-8').read())

def rot(px, py, a):                       # KiCad: positive angle = counter-clockwise on screen (y down)
    r = math.radians(a)
    return px * math.cos(r) + py * math.sin(r), -px * math.sin(r) + py * math.cos(r)

def sym_pin_names(libname):
    lib, name = libname.split(':')
    syms = {str(e[1]): e for e in findall(parse(open(os.path.join(KI, 'symbols', lib + '.kicad_sym'), encoding='utf-8').read()), 'symbol')}
    sd = syms[name]
    ext = find(sd, 'extends')
    if ext: sd = syms[str(ext[1])]
    out = {}
    for sub in findall(sd, 'symbol'):
        for pn in findall(sub, 'pin'):
            out[str(find(pn, 'number')[1])] = str(find(pn, 'name')[1])
    return out
NC = {}
for ref, value, fpname, sym, bx, by, a, pinmap, desc in PARTS:
    if ref.startswith('H'): continue
    for num, nm in sym_pin_names(sym).items():
        if num.isdigit() and not pinmap.get(int(num)):
            NC[(ref, num)] = f'unconnected-({ref}-{nm if nm != "~" else "Pin_" + num}-Pad{num})'
nets = sorted({n for p in PARTS for n in p[7].values() if n}, key=lambda n: (n != 'GND', n))
NETNUM = {n: i + 1 for i, n in enumerate(nets)}
NCNUM = {k: len(nets) + 1 + i for i, k in enumerate(NC)}
pads, fps, web_comps = [], [], []
for ref, value, fpname, sym, bx, by, a, pinmap, desc in PARTS:
    fp = load_fp(fpname)
    X, Y = kx(bx), ky(by)
    comp_pads = []
    for pd in findall(fp, 'pad'):
        num, kind, shape = str(pd[1]), str(pd[2]), str(pd[3])
        at = find(pd, 'at'); px, py = float(at[1]), float(at[2]); pa = float(at[3]) if len(at) > 3 else 0.0
        size = find(pd, 'size'); w, h = float(size[1]), float(size[2])
        tot = (pa + a) % 180
        if abs(tot - 90) < 1: w, h = h, w
        dx, dy = rot(px, py, a)
        ax, ay = X + dx, Y + dy
        layers = [str(l) for l in find(pd, 'layers')[1:]]
        th = kind in ('thru_hole', 'np_thru_hole')
        net = pinmap.get(int(num)) if num.isdigit() else None
        drill = find(pd, 'drill')
        p = dict(id=f'{ref}.{num}', ref=ref, pin=num, x=round(ax - OX, 4), y=round(BH - (ay - OY), 4), w=w, h=h,
                 shape='circle' if shape == 'circle' else 'rect', th=th, net=net, npth=kind == 'np_thru_hole',
                 drill=float(drill[1]) if drill and len(drill) > 1 and not isinstance(drill[1], list) and str(drill[1]) != 'oval' else (float(drill[2]) if drill and len(drill) > 2 and str(drill[1]) == 'oval' else 0.0),
                 layer=0 if ('F.Cu' in layers or '*.Cu' in layers) else 1)
        if kind == 'np_thru_hole': p['net'] = None
        comp_pads.append(p)
        # board-file pad: same local position, absolute angle
        if at is not None:
            at[:] = [S('at'), px, py] + ([(pa + a) % 360] if (pa + a) % 360 else [])
        if net:
            pd.append([S('net'), NETNUM[net], '/' + net])
            if (ref, num) == ('J3', '3'): pd.append([S('zone_connect'), 2])   # solid to the GND plane (a trace blocks one thermal spoke)
        elif (ref, num) in NC:
            pd.append([S('net'), NCNUM[(ref, num)], NC[(ref, num)]])
    pads += [p for p in comp_pads if not p['npth']]
    # courtyard bbox for the website outline
    xs, ys = [], []
    for g in findall(fp, 'fp_line') + findall(fp, 'fp_rect') + findall(fp, 'fp_circle') + findall(fp, 'fp_poly'):
        lay = find(g, 'layer')
        if lay and str(lay[1]) == 'F.CrtYd':
            if str(g[0]) == 'fp_circle':
                ce, en = find(g, 'center'), find(g, 'end'); rr = math.hypot(float(en[1]) - float(ce[1]), float(en[2]) - float(ce[2]))
                xs += [float(ce[1]) - rr, float(ce[1]) + rr]; ys += [float(ce[2]) - rr, float(ce[2]) + rr]
            for k in ('start', 'end', 'center'):
                e = find(g, k)
                if e: xs.append(float(e[1])); ys.append(float(e[2]))
            pts = find(g, 'pts')
            if pts:
                for xy in findall(pts, 'xy'): xs.append(float(xy[1])); ys.append(float(xy[2]))
    if xs:
        corners = [rot(x, y, a) for x in (min(xs), max(xs)) for y in (min(ys), max(ys))]
        cx0, cx1 = min(c[0] for c in corners) + X - OX, max(c[0] for c in corners) + X - OX
        cy0, cy1 = BH - (max(c[1] for c in corners) + Y - OY), BH - (min(c[1] for c in corners) + Y - OY)
    else:
        cx0 = cx1 = bx; cy0 = cy1 = by
    web_comps.append(dict(ref=ref, value=value, fp=fpname.split(':')[1], desc=desc, rot=a, ox=bx, oy=by,
                          box=[round(cx0, 3), round(cy0, 3), round(cx1, 3), round(cy1, 3)], pads=comp_pads))
    # turn the library footprint into a board footprint
    body = [e for e in fp[2:] if not (isinstance(e, list) and e and str(e[0]) in ('version', 'generator', 'generator_version', 'layer'))]
    for prop in findall(body, 'property'):
        if prop[1] == 'Reference':
            prop[2] = ref
            if ref.startswith('H') and not find(prop, 'hide'): prop.append([S('hide'), S('yes')])
        if prop[1] == 'Value': prop[2] = value
        pat = find(prop, 'at')
        if pat is not None and a:
            pat[:] = [S('at'), pat[1], pat[2], (float(pat[3]) if len(pat) > 3 else 0) + a]
    for t in findall(body, 'fp_text'):
        tat = find(t, 'at')
        if tat is not None and a: tat[:] = [S('at'), tat[1], tat[2], (float(tat[3]) if len(tat) > 3 else 0) + a]
    fps.append([S('footprint'), fpname, [S('layer'), 'F.Cu'], [S('uuid'), U()], [S('at'), X, Y] + ([a] if a else [])] + body)

# ---------------------------------------------------------------------------- route
holes = [(p['x'], p['y'], 3.2) for c in web_comps if c['ref'].startswith('H') for p in [dict(x=c['ox'], y=c['oy'])]]
keep = []
tracks, vias, failed = route(pads, nets, BW, BH, holes, power=POWER, clr=0.2, sig_w=0.25, pwr_w=0.8, grid=0.25, keepouts=keep)
print(f'routed: {len(tracks)} tracks, {len(vias)} vias, failed {failed}')

# ---------------------------------------------------------------------------- board file
tpl = parse(open(os.path.join(KI, 'template', 'Hammond_1593K_Enclosure', 'Hammond_1593K_Enclosure.kicad_pcb'), encoding='utf-8').read())
layers, setup = find(tpl, 'layers'), find(tpl, 'setup')
for k in ('aux_axis_origin', 'grid_origin'):
    e = find(setup, k)
    if e: e[1], e[2] = OX, OY + BH
for lay in find(setup, 'stackup')[1:] if find(setup, 'stackup') else []:
    if isinstance(lay, list) and find(lay, 'color'): find(lay, 'color')[1] = 'Green'
pcb = [S('kicad_pcb'), [S('version'), find(tpl, 'version')[1]], [S('generator'), 'survival_radio_build'], [S('generator_version'), '10.0'],
       [S('general'), [S('thickness'), 1.6], [S('legacy_teardrops'), S('no')]], [S('paper'), 'A4'],
       [S('title_block'), [S('title'), 'Survival Radio carrier board'], [S('rev'), '0.2'], [S('company'), 'acamaro.com'],
        [S('comment'), 1, 'Concept board: generated by cad/kicad/build_kicad.py. Check footprints and module pinouts before ordering.']],
       layers, setup, [S('net'), 0, '']] + [[S('net'), NETNUM[n], '/' + n] for n in nets] + [[S('net'), NCNUM[k], v] for k, v in NC.items()]
pcb += fps
r = 2.0   # board outline with rounded corners
def gl(x1, y1, x2, y2): return [S('gr_line'), [S('start'), kx(x1), ky(y1)], [S('end'), kx(x2), ky(y2)], [S('stroke'), [S('width'), 0.1], [S('type'), S('default')]], [S('layer'), 'Edge.Cuts'], [S('uuid'), U()]]
def ga(sx, sy, mx, my, ex, ey): return [S('gr_arc'), [S('start'), kx(sx), ky(sy)], [S('mid'), kx(mx), ky(my)], [S('end'), kx(ex), ky(ey)], [S('stroke'), [S('width'), 0.1], [S('type'), S('default')]], [S('layer'), 'Edge.Cuts'], [S('uuid'), U()]]
c = r * (1 - math.cos(math.pi / 4))
pcb += [gl(r, 0, BW - r, 0), gl(BW, r, BW, BH - r), gl(BW - r, BH, r, BH), gl(0, BH - r, 0, r),
        ga(BW - r, 0, BW - c, c, BW, r), ga(BW, BH - r, BW - c, BH - c, BW - r, BH), ga(r, BH, c, BH - c, 0, BH - r), ga(0, r, c, c, r, 0)]
def gtext(s, x, y, size, layer='F.SilkS', bold=False):
    return [S('gr_text'), s, [S('at'), kx(x), ky(y), 0], [S('layer'), layer], [S('uuid'), U()],
            [S('effects'), [S('font'), [S('size'), size, size], [S('thickness'), size * 0.15]] + ([[S('bold'), S('yes')]] if bold else []), [S('justify'), S('left')]]]
pcb += [gtext('SURVIVAL RADIO', 6.5, 49.0, 1.6, bold=True), gtext('CARRIER v0.2  concept', 6.5, 46.6, 1.0), gtext('acamaro.com', 6.5, 44.8, 1.0)]
for t in tracks:
    lay = 'F.Cu' if t['layer'] == 'top' else 'B.Cu'
    for k in range(len(t['pts']) - 1):
        (x1, y1), (x2, y2) = t['pts'][k], t['pts'][k + 1]
        pcb.append([S('segment'), [S('start'), kx(x1), ky(y1)], [S('end'), kx(x2), ky(y2)], [S('width'), t['w']], [S('layer'), lay], [S('net'), NETNUM[t['net']]], [S('uuid'), U()]])
for v in vias:
    pcb.append([S('via'), [S('at'), kx(v['x']), ky(v['y'])], [S('size'), 0.6], [S('drill'), 0.3], [S('layers'), 'F.Cu', 'B.Cu'], [S('net'), NETNUM[v['net']]], [S('uuid'), U()]])
m = 0.4
pcb.append([S('zone'), [S('net'), NETNUM['GND']], [S('net_name'), '/GND'], [S('layer'), 'B.Cu'], [S('uuid'), U()], [S('name'), 'GND plane'],
            [S('hatch'), S('edge'), 0.5], [S('connect_pads'), [S('clearance'), 0.25]], [S('min_thickness'), 0.25], [S('filled_areas_thickness'), S('no')],
            [S('fill'), S('yes'), [S('thermal_gap'), 0.4], [S('thermal_bridge_width'), 0.5]],
            [S('polygon'), [S('pts'), [S('xy'), kx(m), ky(m)], [S('xy'), kx(BW - m), ky(m)], [S('xy'), kx(BW - m), ky(BH - m)], [S('xy'), kx(m), ky(BH - m)]]]])
pcb.append([S('embedded_fonts'), S('no')])
open(os.path.join(OUT, 'carrier.kicad_pcb'), 'w', encoding='utf-8').write(dump(pcb) + '\n')

# ---------------------------------------------------------------------------- project file (rules, net classes)
pro = {
  'meta': {'filename': 'carrier.kicad_pro', 'version': 3},
  'board': {'design_settings': {
      'defaults': {},
      'rules': {'min_clearance': 0.2, 'min_track_width': 0.2, 'min_via_diameter': 0.5, 'min_via_annular_width': 0.1,
                'min_through_hole_diameter': 0.3, 'min_hole_to_hole': 0.25, 'min_copper_edge_clearance': 0.3, 'min_silk_clearance': 0.0,
                'solder_mask_to_copper_clearance': 0.0, 'min_hole_clearance': 0.25},
      'rule_severities': {'footprint_symbol_field_mismatch': 'ignore', 'lib_footprint_issues': 'ignore', 'lib_footprint_mismatch': 'ignore', 'silk_overlap': 'ignore',
                          'silk_over_copper': 'warning', 'silk_edge_clearance': 'warning', 'text_height': 'ignore', 'text_thickness': 'ignore'},
      'track_widths': [0.25, 0.4, 0.8], 'via_dimensions': [{'diameter': 0.6, 'drill': 0.3}]}},
  'net_settings': {'meta': {'version': 4},
      'classes': [{'name': 'Default', 'clearance': 0.2, 'track_width': 0.25, 'via_diameter': 0.6, 'via_drill': 0.3,
                   'microvia_diameter': 0.3, 'microvia_drill': 0.1, 'diff_pair_width': 0.2, 'diff_pair_gap': 0.25, 'diff_pair_via_gap': 0.25,
                   'wire_width': 6, 'bus_width': 12, 'line_style': 0, 'pcb_color': 'rgba(0, 0, 0, 0.000)', 'schematic_color': 'rgba(0, 0, 0, 0.000)', 'priority': 2147483647},
                  {'name': 'Power', 'clearance': 0.2, 'track_width': 0.8, 'via_diameter': 0.6, 'via_drill': 0.3,
                   'microvia_diameter': 0.3, 'microvia_drill': 0.1, 'diff_pair_width': 0.2, 'diff_pair_gap': 0.25, 'diff_pair_via_gap': 0.25,
                   'wire_width': 6, 'bus_width': 12, 'line_style': 0, 'pcb_color': 'rgba(0, 0, 0, 0.000)', 'schematic_color': 'rgba(0, 0, 0, 0.000)', 'priority': 0}],
      'netclass_patterns': [{'netclass': 'Power', 'pattern': n} for n in sorted(POWER)]},
  'schematic': {'meta': {'version': 1}},
  'sheets': [], 'text_variables': {},
}
json.dump(pro, open(os.path.join(OUT, 'carrier.kicad_pro'), 'w'), indent=2)

# ---------------------------------------------------------------------------- schematic
libcache = {}
def lib_symbol(libname):
    lib, name = libname.split(':')
    if lib not in libcache:
        libcache[lib] = {str(e[1]): e for e in findall(parse(open(os.path.join(KI, 'symbols', lib + '.kicad_sym'), encoding='utf-8').read()), 'symbol')}
    syms = libcache[lib]
    s = [x for x in syms[name]]
    ext = find(s, 'extends')
    if ext:                                # flatten: parent's graphics and pins, child's properties
        parent = lib_symbol(f'{lib}:{ext[1]}')
        s = [x for x in s if not (isinstance(x, list) and str(x[0]) == 'extends')]
        for sub in findall(parent, 'symbol'):
            sub2 = [x for x in sub]; sub2[1] = str(sub2[1]).replace(str(ext[1]).split(':')[-1], name, 1)
            s.append(sub2)
        for k in ('pin_numbers', 'pin_names', 'power'):
            if not find(s, k) and find(parent, k): s.insert(2, find(parent, k))
    s = [x for x in s]; s[1] = f'{lib}:{name}'
    return s

def sym_pins(symdef):
    pins = []
    for sub in findall(symdef, 'symbol'):
        parts = str(sub[1]).rsplit('_', 2)
        if len(parts) == 3 and parts[2] not in ('0', '1'): continue
        for p in findall(sub, 'pin'):
            at = find(p, 'at'); num = find(p, 'number')
            pins.append(dict(num=str(num[1]), x=float(at[1]), y=float(at[2]), a=float(at[3]) if len(at) > 3 else 0, type=str(p[1])))
    return pins

sch_root = U()
lib_defs, items = {}, []
GRID = 2.54
cols, cw, ch = 7, 63.5, 58.42
def snap(v): return round(round(v / 1.27) * 1.27, 4)
order = [p for p in PARTS]
for i, (ref, value, fpname, symname, *_rest) in enumerate(order):
    pinmap = _rest[3]
    if symname not in lib_defs: lib_defs[symname] = lib_symbol(symname)
    sd = lib_defs[symname]
    col, row = i % cols, i // cols
    SX, SY = snap(30 + col * cw), snap(35 + row * ch)
    su = U()
    props = []
    for prop in findall(sd, 'property'):
        k = str(prop[1]); v = prop[2]
        if k == 'Reference': v = ref
        elif k == 'Value': v = value
        elif k == 'Footprint': v = fpname
        pat = find(prop, 'at')
        eff = find(prop, 'effects')
        np_ = [S('property'), k, v, [S('at'), round(SX + float(pat[1]), 4), round(SY - float(pat[2]), 4), float(pat[3]) if len(pat) > 3 else 0]]
        if eff: np_.append(eff)
        props.append(np_)
    pins = sym_pins(sd)
    items.append([S('symbol'), [S('lib_id'), symname], [S('at'), SX, SY, 0], [S('unit'), 1], [S('exclude_from_sim'), S('no')], [S('in_bom'), S('no') if ref.startswith('H') else S('yes')],
                  [S('on_board'), S('yes')], [S('dnp'), S('no')], [S('uuid'), su]] + props +
                 [[S('pin'), p['num'], [S('uuid'), U()]] for p in pins] +
                 [[S('instances'), [S('project'), 'carrier', [S('path'), '/' + sch_root, [S('reference'), ref], [S('unit'), 1]]]]])
    for p in pins:
        x, y = snap(SX + p['x']), snap(SY - p['y'])
        net = pinmap.get(int(p['num'])) if p['num'].isdigit() else None
        if net:
            la = (int(p['a']) + 180) % 360
            just = [S('justify'), S('left') if la in (0, 90) else S('right'), S('bottom')] if la in (0, 180) else [S('justify'), S('left') if la == 90 else S('right'), S('bottom')]
            items.append([S('label'), net, [S('at'), x, y, la], [S('fields_autoplaced'), S('yes')], [S('effects'), [S('font'), [S('size'), 1.27, 1.27]], just], [S('uuid'), U()]])
        elif not ref.startswith('H'):
            items.append([S('no_connect'), [S('at'), x, y], [S('uuid'), U()]])

# power flags so ERC knows these nets are driven
flag = lib_symbol('power:PWR_FLAG'); lib_defs['power:PWR_FLAG'] = flag
for k, net in enumerate(['GND', 'LOAD', '5V', '3V3']):
    SX, SY = snap(30 + k * 25.4), snap(35 + 6 * ch)
    fp = sym_pins(flag)[0]
    items.append([S('symbol'), [S('lib_id'), 'power:PWR_FLAG'], [S('at'), SX, SY, 0], [S('unit'), 1], [S('exclude_from_sim'), S('no')], [S('in_bom'), S('yes')],
                  [S('on_board'), S('yes')], [S('dnp'), S('no')], [S('uuid'), U()],
                  [S('property'), 'Reference', f'#FLG0{k + 1}', [S('at'), SX, SY + 1.9, 0], [S('effects'), [S('font'), [S('size'), 1.27, 1.27]], [S('hide'), S('yes')]]],
                  [S('property'), 'Value', 'PWR_FLAG', [S('at'), SX, SY - 3.81, 0], [S('effects'), [S('font'), [S('size'), 1.27, 1.27]]]],
                  [S('property'), 'Footprint', '', [S('at'), SX, SY, 0], [S('effects'), [S('font'), [S('size'), 1.27, 1.27]], [S('hide'), S('yes')]]],
                  [S('pin'), '1', [S('uuid'), U()]],
                  [S('instances'), [S('project'), 'carrier', [S('path'), '/' + sch_root, [S('reference'), f'#FLG0{k + 1}'], [S('unit'), 1]]]]])
    x, y = snap(SX + fp['x']), snap(SY - fp['y'])
    items.append([S('label'), net, [S('at'), x, y, 270], [S('effects'), [S('font'), [S('size'), 1.27, 1.27]], [S('justify'), S('right'), S('bottom')]], [S('uuid'), U()]])
items.append([S('text'), 'Survival Radio carrier board (concept). Generated by cad/kicad/build_kicad.py from the same netlist as the website.\nNets are joined by labels; every pin of a net carries a label with the net name.',
              [S('exclude_from_sim'), S('no')], [S('at'), 30, 20, 0], [S('effects'), [S('font'), [S('size'), 2, 2]], [S('justify'), S('left'), S('bottom')]], [S('uuid'), U()]])

sch = [S('kicad_sch'), [S('version'), 20250114], [S('generator'), 'survival_radio_build'], [S('generator_version'), '10.0'], [S('uuid'), sch_root], [S('paper'), 'A2'],
       [S('title_block'), [S('title'), 'Survival Radio carrier board'], [S('rev'), '0.2'], [S('company'), 'acamaro.com']],
       [S('lib_symbols')] + list(lib_defs.values())] + items + [[S('sheet_instances'), [S('path'), '/', [S('page'), '1']]], [S('embedded_fonts'), S('no')]]
open(os.path.join(OUT, 'carrier.kicad_sch'), 'w', encoding='utf-8').write(dump(sch) + '\n')

# ---------------------------------------------------------------------------- website data
NET_DESC = json.load(open(os.path.join(HERE, 'net_desc.json'))) if os.path.exists(os.path.join(HERE, 'net_desc.json')) else {}
netpins = {}
for c_ in web_comps:
    for p in c_['pads']:
        if p['net']: netpins.setdefault(p['net'], []).append(f"{c_['ref']}.{p['pin']}")
web = dict(board=dict(w=BW, h=BH, t=1.6, holes=[dict(x=c_['ox'], y=c_['oy'], d=2.7) for c_ in web_comps if c_['ref'].startswith('H')]),
           comps=[c_ for c_ in web_comps if not c_['ref'].startswith('H')], tracks=tracks, vias=vias, failed=failed,
           nets={n: dict(kind=NET_KIND.get(n, 'gpio'), desc=NET_DESC.get(n, ''), pins=netpins.get(n, [])) for n in nets})
with open(os.path.join(SITE, 'pcb-data.js'), 'w') as f:
    f.write('// Generated by cad/kicad/build_kicad.py from the KiCad carrier-board project (mm, origin bottom-left, y up).\n')
    f.write('export const PCB = ' + json.dumps(web, separators=(',', ':')) + ';\n')
print('wrote', OUT, 'and pcb-data.js')

# ---------------------------------------------------------------------------- project library tables (point at KiCad's bundled libraries)
symlibs = sorted({p[3].split(':')[0] for p in PARTS} | {'power'})
fplibs = sorted({p[2].split(':')[0] for p in PARTS})
with open(os.path.join(OUT, 'sym-lib-table'), 'w') as f:
    f.write('(sym_lib_table\n  (version 7)\n' + ''.join(f'  (lib (name "{l}")(type "KiCad")(uri "${{KICAD10_SYMBOL_DIR}}/{l}.kicad_sym")(options "")(descr ""))\n' for l in symlibs) + ')\n')
with open(os.path.join(OUT, 'fp-lib-table'), 'w') as f:
    f.write('(fp_lib_table\n  (version 7)\n' + ''.join(f'  (lib (name "{l}")(type "KiCad")(uri "${{KICAD10_FOOTPRINT_DIR}}/{l}.pretty")(options "")(descr ""))\n' for l in fplibs) + ')\n')

