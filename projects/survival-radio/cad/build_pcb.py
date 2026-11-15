"""Survival Radio carrier board: placement, netlist and a two-layer grid router.

Concept layout, not a fab-ready design: it has not been through a real DRC, and the
footprints are simplified. It exists to show how the hub's parts would sit on one board
and how every net is routed. Run:  python3 build_pcb.py <survival-radio dir>
Writes pcb-data.js (used by the page), downloads/carrier-netlist.csv and two layer SVGs.

Units: millimetres, origin at the board's bottom-left corner, +y up.
"""
import heapq, json, math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
BW, BH = 100.0, 70.0
G = 0.25                                   # router grid (mm)
NX, NY = int(BW / G) + 1, int(BH / G) + 1
CLR = 0.2                                  # copper-to-copper clearance
SIG_W, PWR_W = 0.3, 0.8

comps, pads = [], []                       # pads: dict(ref, pin, x, y, w, h, shape, th, drill)

def comp(ref, kind, value, x, y, w, h, z, color, desc, outline=None):
    c = dict(ref=ref, kind=kind, value=value, x=x, y=y, w=w, h=h, z=z, color=color, desc=desc, pads={})
    if outline: c['outline'] = outline
    comps.append(c); return c

def pad(c, pin, x, y, w, h, shape='rect', th=False, drill=0.0):
    p = dict(ref=c['ref'], pin=str(pin), x=round(x, 3), y=round(y, 3), w=w, h=h, shape=shape, th=th, drill=drill)
    c['pads'][str(pin)] = p; pads.append(p); return p

def header(c, names, x0, y0, dx, dy, d=1.0, size=1.7):
    for i, n in enumerate(names):
        pad(c, n, x0 + dx * i, y0 + dy * i, size, size, 'rect' if i == 0 else 'circle', True, d)

def r0805(ref, value, x, y, vertical=False, desc=''):
    c = comp(ref, 'R' if ref[0] == 'R' else 'C', value, x, y, 2.0 if not vertical else 1.25, 1.25 if not vertical else 2.0, 0.5,
             '#1b1b1b' if ref[0] == 'R' else '#b48a5a', desc)
    o = 0.95
    if vertical: pad(c, 1, x, y + o, 1.0, 1.3); pad(c, 2, x, y - o, 1.0, 1.3)
    else: pad(c, 1, x - o, y, 1.3, 1.0); pad(c, 2, x + o, y, 1.3, 1.0)
    return c

def sot23(ref, value, x, y, desc):
    c = comp(ref, 'Q', value, x, y, 2.9, 1.3, 1.0, '#151515', desc)
    pad(c, 'B', x - 0.95, y - 1.1, 0.6, 0.9); pad(c, 'E', x + 0.95, y - 1.1, 0.6, 0.9); pad(c, 'C', x, y + 1.1, 0.6, 0.9)
    return c

def sod123(ref, value, x, y, desc, vertical=False):
    c = comp(ref, 'D', value, x, y, 2.7 if not vertical else 1.6, 1.6 if not vertical else 2.7, 1.1, '#151515', desc)
    if vertical: pad(c, 'K', x, y + 1.65, 0.9, 1.2); pad(c, 'A', x, y - 1.65, 0.9, 1.2)
    else: pad(c, 'K', x - 1.65, y, 1.2, 0.9); pad(c, 'A', x + 1.65, y, 1.2, 0.9)
    return c

def jst_ph(ref, names, x0, y, desc, value=None):
    n = len(names)
    c = comp(ref, 'J', value or f'JST-PH {n}-pin', x0 + (n - 1), y + 0.8, 2.0 * (n - 1) + 3.9, 4.5, 6.0, '#ece8dc', desc)
    header(c, names, x0, y, 2.0, 0, d=0.75, size=1.2)
    return c

# ------------------------------------------------------------------ placement
holes = [(3.5, 3.5), (96.5, 3.5), (3.5, 66.5), (96.5, 66.5)]

FA = ['RST', '3V', 'NC', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MO', 'MI', 'RX', 'TX', 'DB']
FB = ['BAT', 'EN', 'USB', 'D13', 'D12', 'D11', 'D10', 'D9', 'D6', 'D5', 'SCL', 'SDA']
u1 = comp('U1', 'module', 'Adafruit ESP32-S3 Feather (5477)', 49.6, 40.16, 50.8, 22.86, 8.5 + 7.2, '#1d1d1d',
          'The controller. Plugs into two female headers (16-pin and 12-pin, 0.1 in), so it can be removed and reflashed on the bench.')
header(u1, FA, 28.0, 30.0, 2.54, 0)
header(u1, FB, 28.0 + 4 * 2.54, 50.32, 2.54, 0)

j1 = comp('J1', 'J', '2x8 box header, 0.1 in', 87.27, 30.89, 8.9, 20.3, 9.0, '#222',
          'Ribbon cable to the RockBLOCK 9704 16-pin header. Pin 1 is marked; follow the modem\'s pin numbering.')
for k in range(8):
    y = 39.78 - 2.54 * k
    pad(j1, 2 * k + 1, 86.0, y, 1.7, 1.7, 'rect' if k == 0 else 'circle', True, 1.0)
    pad(j1, 2 * k + 2, 88.54, y, 1.7, 1.7, 'circle', True, 1.0)

u2 = comp('U2', 'module', 'Adafruit MiniBoost 5 V (4654)', 85.8, 60.2, 12.5, 9.5, 2.54 + 1.6 + 2, '#1f3b70',
          '5 V boost converter on a 4-pin header. EN low switches the output fully off, so the RockBLOCK and pod sensors draw nothing between messages.')
header(u2, ['VIN', 'GND', 'EN', 'VOUT'], 82.0, 56.0, 2.54, 0)

c2 = comp('C2', 'cap-radial', '100 µF 10 V', 93.6, 48.0, 6.3, 6.3, 7.7, '#2b3a55',
          'Bulk capacitor on the 5 V rail, next to the modem cable. Covers the modem\'s current steps while its supercapacitors charge.')
pad(c2, '+', 93.6, 49.25, 1.5, 1.5, 'rect', True, 0.8); pad(c2, '-', 93.6, 46.75, 1.5, 1.5, 'circle', True, 0.8)
r0805('R10', '100k', 82.0, 50.5, True, 'Pull-down on the boost EN pin: keeps the 5 V rail off while the controller boots.')

u3 = comp('U3', 'ic', 'MCP23008 (SOIC-18)', 78.0, 12.0, 7.5, 11.6, 2.5, '#151515',
          'I²C GPIO expander at address 0x20 (A0–A2 tied low). Drives the slow outputs: boost enable, pod vibration/LED, panel LED.')
MCP = {1: 'SCL', 2: 'SDA', 3: 'A2', 4: 'A1', 5: 'A0', 6: 'RESET', 7: 'NC', 8: 'INT', 9: 'VSS',
       10: 'GP0', 11: 'GP1', 12: 'GP2', 13: 'GP3', 14: 'GP4', 15: 'GP5', 16: 'GP6', 17: 'GP7', 18: 'VDD'}
for n in range(1, 19):
    if n <= 9: x, y = 78.0 - 4.7, 12.0 + 5.08 - (n - 1) * 1.27
    else: x, y = 78.0 + 4.7, 12.0 - 5.08 + (n - 10) * 1.27
    pad(u3, MCP[n], x, y, 1.9, 0.6)
r0805('C4', '100 nF', 78.0, 21.0, False, 'Decoupling capacitor for U3, close to its supply pin.')

j3 = jst_ph('J3', ['5V', '3V3', 'GND', 'SDA', 'SCL', 'CH4_RX', 'CH4_TX', 'POD_OUT'], 38.0, 5.0,
            'Sensor-pod cable (to the 8-pin M12 bulkhead): 5 V, 3.3 V, GND, I²C, methane UART, and a switched output for the pod LED and vibration motor.')
sot23('Q2', 'MMBT3904', 60.0, 9.0, 'NPN low-side switch for the pod LED and vibration motor.')
r0805('R8', '1k', 66.0, 8.0, False, 'Base resistor for Q2.')
r0805('R9', '10k', 63.0, 14.5, True, 'Holds Q2 off while the expander starts up.')
sod123('D2', '1N4148W', 56.5, 14.0, 'Flyback diode across the pod motor: clamps the voltage spike when Q2 switches off.', vertical=True)

j4 = comp('J4', 'J', 'STEMMA QT / Qwiic (JST-SH 4)', 25.5, 7.2, 6.0, 4.3, 3.0, '#ece8dc',
          'Qwiic chain to the GNSS receiver and the LIS3DH accelerometer.')
for i, n in enumerate(['GND', '3V3', 'SDA', 'SCL']): pad(j4, n, 24.0 + i, 5.0, 0.6, 1.55)
pad(j4, 'M1', 21.7, 7.9, 1.2, 1.8); pad(j4, 'M2', 29.3, 7.9, 1.2, 1.8)
jst_ph('J8', ['INT', 'GND'], 32.5, 5.0, 'Motion interrupt (LIS3DH INT1): wakes the controller on movement or free-fall.', 'JST-PH 2-pin')

jst_ph('J5', ['VCC', 'GND', 'DIN', 'CLK', 'CS', 'DC', 'RST', 'BUSY'], 30.0, 65.0, 'E-paper display cable (SPI plus control lines).')
jst_ph('J6', ['SOS', 'BTN1', 'BTN2', 'BTN3', 'LED', 'GND'], 54.0, 65.0, 'Control-panel cable: SOS switch, three buttons, panel LED, ground.')
r0805('R1', '10k', 58.0, 58.0, True, 'SOS pull-up: holds the switch line HIGH until the switch connects it to ground.')
r0805('R2', '1k', 62.0, 59.0, False, 'Series resistor into the SOS pin; with C1 it slows the edges and protects the pin from static on the long panel wire.')
r0805('C1', '100 nF', 66.0, 56.5, True, 'With R2, a small RC filter on the SOS line. Firmware still debounces for 20 ms.')
r0805('R11', '330', 70.5, 59.0, False, 'Current limit for the panel LED (about 4 mA at 3.3 V for a red LED).')

r0805('R3', '10k', 47.0, 22.0, True, 'Top of the button ladder: pulls A4 up to 3.3 V when no button is pressed.')
r0805('R4', '10k', 52.0, 22.0, True, 'Button 2 resistor: pressing it pulls A4 to about 1.65 V.')
r0805('R5', '33k', 56.0, 22.0, True, 'Button 3 resistor: pressing it pulls A4 to about 2.5 V.')

bz = comp('BZ1', 'buzzer', 'Magnetic buzzer 3–5 V, 12 mm', 12.0, 21.0, 12.0, 12.0, 9.5, '#111',
          'Alarm buzzer, driven with a ~2.7 kHz PWM square wave from D13 through Q1.')
pad(bz, '+', 8.2, 21.0, 1.6, 1.6, 'rect', True, 0.8); pad(bz, '-', 15.8, 21.0, 1.6, 1.6, 'circle', True, 0.8)
sot23('Q1', 'MMBT3904', 21.0, 28.0, 'NPN low-side switch for the buzzer.')
r0805('R6', '1k', 25.5, 25.0, False, 'Base resistor for Q1: about 2.6 mA of base current from a 3.3 V pin.')
r0805('R7', '10k', 18.0, 26.5, True, 'Holds Q1 off while D13 floats at reset.')
sod123('D1', '1N4148W', 12.0, 30.0, 'Flyback diode across the buzzer coil.')

j7 = comp('J7', 'terminal', 'Screw terminal 2-pin, 3.5 mm', 6.6, 40.0, 7.6, 7.0, 8.5, '#2f6b3a',
          'LOAD rail in from the charger board (power path output, up to 4.4 V) and ground.')
pad(j7, 'LOAD', 4.85, 40.0, 2.2, 2.2, 'rect', True, 1.2); pad(j7, 'GND', 8.35, 40.0, 2.2, 2.2, 'circle', True, 1.2)
r0805('C3', '10 µF', 13.0, 40.0, True, 'Local bulk capacitance on the LOAD rail.')
jst_ph('J2', ['LOAD', 'GND', 'TX', 'RX'], 5.0, 58.0, 'Mesh radio (RAK19007): battery-rail power plus UART 2.')

# ------------------------------------------------------------------ netlist
N = {
  'GND': ['U1.GND', 'J1.1', 'J1.4', 'J1.10', 'J1.16', 'U2.GND', 'C2.-', 'R10.2', 'U3.VSS', 'U3.A0', 'U3.A1', 'U3.A2', 'C4.2',
          'J3.GND', 'Q2.E', 'R9.2', 'J4.GND', 'J8.GND', 'J5.GND', 'J6.GND', 'C1.2', 'Q1.E', 'R7.2', 'J7.GND', 'C3.2', 'J2.GND'],
  'LOAD': ['J7.LOAD', 'C3.1', 'U1.BAT', 'J2.LOAD', 'U2.VIN', 'BZ1.+', 'D1.K'],
  '5V': ['U2.VOUT', 'C2.+', 'J1.15', 'J3.5V'],
  '3V3': ['U1.3V', 'U3.VDD', 'U3.RESET', 'C4.1', 'J4.3V3', 'J5.VCC', 'J3.3V3', 'D2.K', 'R1.1', 'R3.1'],
  'SDA': ['U1.SDA', 'U3.SDA', 'J4.SDA', 'J3.SDA'],
  'SCL': ['U1.SCL', 'U3.SCL', 'J4.SCL', 'J3.SCL'],
  'BOOST_EN': ['U3.GP0', 'U2.EN', 'R10.1'],
  'MODEM_TX': ['U1.TX', 'J1.14'], 'MODEM_RX': ['U1.RX', 'J1.13'],
  'I_EN': ['U1.D11', 'J1.3'], 'I_BTD': ['U1.MI', 'J1.7'],
  'MESH_TX': ['U1.A0', 'J2.RX'], 'MESH_RX': ['U1.A1', 'J2.TX'],
  'CH4_TX': ['U1.A2', 'J3.CH4_RX'], 'CH4_RX': ['U1.A3', 'J3.CH4_TX'],
  'EPD_CLK': ['U1.SCK', 'J5.CLK'], 'EPD_DIN': ['U1.MO', 'J5.DIN'], 'EPD_CS': ['U1.D10', 'J5.CS'],
  'EPD_DC': ['U1.D9', 'J5.DC'], 'EPD_RST': ['U1.D6', 'J5.RST'], 'EPD_BUSY': ['U1.D12', 'J5.BUSY'],
  'SOS_SW': ['J6.SOS', 'R1.2', 'R2.1'], 'SOS_IN': ['R2.2', 'U1.D5', 'C1.1'],
  'LADDER': ['U1.A4', 'R3.2', 'J6.BTN1', 'R4.1', 'R5.1'], 'BTN2': ['R4.2', 'J6.BTN2'], 'BTN3': ['R5.2', 'J6.BTN3'],
  'PANEL_LED': ['U3.GP2', 'R11.1'], 'LED_A': ['R11.2', 'J6.LED'],
  'BUZ_PWM': ['U1.D13', 'R6.1'], 'Q1_B': ['R6.2', 'Q1.B', 'R7.1'], 'BUZ_K': ['Q1.C', 'BZ1.-', 'D1.A'],
  'POD_DRV': ['U3.GP1', 'R8.2'], 'Q2_B': ['R8.1', 'Q2.B', 'R9.1'], 'POD_OUT': ['Q2.C', 'J3.POD_OUT', 'D2.A'],
  'MOTION_INT': ['U1.A5', 'J8.INT'],
}
NET_INFO = {
  'GND': ('power', 'Common ground: the bottom-layer copper pour. Every signal is measured against it.'),
  'LOAD': ('power', 'Battery / power-path rail from the charger (3.0–4.4 V): controller, mesh radio, boost input, buzzer.'),
  '5V': ('power', 'Switched 5 V from the boost: RockBLOCK V_IN+ and the pod\'s particle and methane sensors.'),
  '3V3': ('power', 'The Feather\'s 3.3 V regulator output: logic, expander, Qwiic chain, e-paper, pod I²C sensors.'),
  'SDA': ('i2c', 'I²C data: Feather ↔ expander ↔ Qwiic chain ↔ sensor pod.'), 'SCL': ('i2c', 'I²C clock, driven by the Feather.'),
  'BOOST_EN': ('gpio', 'Expander GP0 → boost EN. HIGH turns the 5 V rail on.'),
  'MODEM_TX': ('uart', 'UART 1: Feather TX → RockBLOCK RXD (pin 14), 230400 baud.'), 'MODEM_RX': ('uart', 'UART 1: RockBLOCK TXD (pin 13) → Feather RX.'),
  'I_EN': ('gpio', 'Modem enable: D11 → RockBLOCK pin 3.'), 'I_BTD': ('gpio', 'Modem "booted": RockBLOCK pin 7 → MI (GPIO37).'),
  'MESH_TX': ('uart', 'UART 2: Feather A0 → mesh radio RXD1.'), 'MESH_RX': ('uart', 'UART 2: mesh radio TXD1 → Feather A1.'),
  'CH4_TX': ('uart', 'UART 3: Feather A2 → methane sensor RX (via pod cable).'), 'CH4_RX': ('uart', 'UART 3: methane sensor TX → Feather A3.'),
  'EPD_CLK': ('spi', 'SPI clock to the e-paper.'), 'EPD_DIN': ('spi', 'SPI data to the e-paper.'), 'EPD_CS': ('spi', 'E-paper chip select (active LOW).'),
  'EPD_DC': ('spi', 'E-paper data / command select.'), 'EPD_RST': ('spi', 'E-paper reset.'), 'EPD_BUSY': ('spi', 'E-paper busy flag.'),
  'SOS_SW': ('gpio', 'SOS switch line, pulled up by R1; the switch pulls it to ground.'), 'SOS_IN': ('gpio', 'Filtered SOS line into D5 (wakes the ESP32-S3 from deep sleep).'),
  'LADDER': ('gpio', 'Button ladder node into A4 (analog).'), 'BTN2': ('gpio', 'Button 2 through R4.'), 'BTN3': ('gpio', 'Button 3 through R5.'),
  'PANEL_LED': ('gpio', 'Expander GP2 → R11.'), 'LED_A': ('gpio', 'Panel LED anode.'),
  'BUZ_PWM': ('gpio', 'D13 PWM → R6.'), 'Q1_B': ('gpio', 'Q1 base.'), 'BUZ_K': ('gpio', 'Buzzer low side, switched by Q1.'),
  'POD_DRV': ('gpio', 'Expander GP1 → R8.'), 'Q2_B': ('gpio', 'Q2 base.'), 'POD_OUT': ('gpio', 'Pod LED / vibration low side, switched by Q2.'),
  'MOTION_INT': ('gpio', 'LIS3DH INT1 → A5 (wake on motion).'),
}
POWER = {'LOAD', '5V', '3V3'}
padmap = {f"{p['ref']}.{p['pin']}": p for p in pads}
for n, ms in N.items():
    for m in ms:
        assert m in padmap, m
        padmap[m]['net'] = n
for p in pads: p.setdefault('net', None)

# ------------------------------------------------------------------ sanity: overlapping pads
def pad_dist(a, b):
    dx = max(0, abs(a['x'] - b['x']) - (a['w'] + b['w']) / 2); dy = max(0, abs(a['y'] - b['y']) - (a['h'] + b['h']) / 2)
    return math.hypot(dx, dy)
bad = [(a['ref'] + '.' + a['pin'], b['ref'] + '.' + b['pin']) for i, a in enumerate(pads) for b in pads[i + 1:]
       if pad_dist(a, b) < CLR and a['net'] != b['net']]
assert not bad, bad[:10]

# ------------------------------------------------------------------ router
FREE, HARD = -1, -2
netid = {n: i for i, n in enumerate(N)}
own = [[FREE] * (NX * NY) for _ in range(2)]        # layer 0 = top, 1 = bottom
def idx(i, j): return j * NX + i
def cell(x, y): return int(round(x / G)), int(round(y / G))

def stamp_pad(p, layer, nid, extra):
    hw, hh = p['w'] / 2 + extra, p['h'] / 2 + extra
    i0, i1 = int((p['x'] - hw) / G) - 1, int((p['x'] + hw) / G) + 2
    j0, j1 = int((p['y'] - hh) / G) - 1, int((p['y'] + hh) / G) + 2
    for j in range(max(0, j0), min(NY, j1)):
        for i in range(max(0, i0), min(NX, i1)):
            x, y = i * G, j * G
            if p['shape'] == 'circle': inside = math.hypot(x - p['x'], y - p['y']) <= p['w'] / 2 + extra
            else: inside = abs(x - p['x']) <= hw and abs(y - p['y']) <= hh
            if inside:
                k = idx(i, j)
                if extra == 0: own[layer][k] = nid
                elif own[layer][k] == FREE: own[layer][k] = nid

# board edge + mounting holes
for L in (0, 1):
    for j in range(NY):
        for i in range(NX):
            x, y = i * G, j * G
            if x < 0.6 or y < 0.6 or x > BW - 0.6 or y > BH - 0.6: own[L][idx(i, j)] = HARD
            for hx, hy in holes:
                if math.hypot(x - hx, y - hy) < 3.0: own[L][idx(i, j)] = HARD
# pads: copper first (exact), then clearance halo (signal half-width + clearance)
for p in pads:
    nid = netid[p['net']] if p['net'] else HARD
    for L in ((0, 1) if p['th'] else (0,)): stamp_pad(p, L, nid, 0)
for p in pads:
    nid = netid[p['net']] if p['net'] else HARD
    for L in ((0, 1) if p['th'] else (0,)): stamp_pad(p, L, nid, CLR + SIG_W / 2)

def stamp_path(cells, nid, width):
    r = width / 2 + CLR + SIG_W / 2
    rc = int(math.ceil(r / G))
    for (i, j, L) in cells:
        for dj in range(-rc, rc + 1):
            for di in range(-rc, rc + 1):
                if math.hypot(di * G, dj * G) >= r - 1e-9: continue
                ii, jj = i + di, j + dj
                if 0 <= ii < NX and 0 <= jj < NY:
                    k = idx(ii, jj)
                    if own[L][k] == FREE: own[L][k] = nid
        own[L][idx(i, j)] = nid

def ok(L, i, j, nid):
    if not (0 <= i < NX and 0 <= j < NY): return False
    o = own[L][idx(i, j)]
    return o == FREE or o == nid

def via_ok(i, j, nid):
    rc = 3                                   # 0.6 mm via pad + clearance, approx
    for L in (0, 1):
        for dj in range(-rc, rc + 1):
            for di in range(-rc, rc + 1):
                if di * di + dj * dj <= rc * rc and not ok(L, i + di, j + dj, nid): return False
    return True

DIRS = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)]
VIA_COST, BOT_MULT, TURN = 40, 1.6, 0.6

def pad_cells(p):
    out = []
    i0, j0 = cell(p['x'], p['y'])
    rng = int(max(p['w'], p['h']) / G) + 1
    for dj in range(-rng, rng + 1):
        for di in range(-rng, rng + 1):
            x, y = (i0 + di) * G, (j0 + dj) * G
            inside = (math.hypot(x - p['x'], y - p['y']) <= p['w'] / 2) if p['shape'] == 'circle' else (abs(x - p['x']) <= p['w'] / 2 and abs(y - p['y']) <= p['h'] / 2)
            if inside:
                for L in ((0, 1) if p['th'] else (0,)): out.append((i0 + di, j0 + dj, L))
    return out

def route(sources, goal_test, heur, nid, width):
    rc_extra = int(math.ceil((width - SIG_W) / 2 / G)) + 1 if width > SIG_W else 0
    def passable(L, i, j):
        if not ok(L, i, j, nid): return False
        if rc_extra:
            for dj in range(-rc_extra, rc_extra + 1):
                for di in range(-rc_extra, rc_extra + 1):
                    if not ok(L, i + di, j + dj, nid): return False
        return True
    dist, prev, hq = {}, {}, []
    for s in sources:
        dist[s] = 0; heapq.heappush(hq, (heur(s), 0, s, None))
    while hq:
        f, g, s, d = heapq.heappop(hq)
        if g > dist.get(s, 1e18): continue
        if goal_test(s):
            path = [s]
            while path[-1] in prev: path.append(prev[path[-1]])
            return path[::-1]
        i, j, L = s
        for k, (di, dj, c) in enumerate(DIRS):
            t = (i + di, j + dj, L)
            if not passable(L, t[0], t[1]): continue
            if di and dj and not (ok(L, i + di, j, nid) and ok(L, i, j + dj, nid)): continue
            ng = g + c * (BOT_MULT if L else 1) + (TURN if d is not None and d != k else 0)
            if ng < dist.get(t, 1e18): dist[t] = ng; prev[t] = s; heapq.heappush(hq, (ng + heur(t), ng, t, k))
        t = (i, j, 1 - L)
        if via_ok(i, j, nid):
            ng = g + VIA_COST
            if ng < dist.get(t, 1e18): dist[t] = ng; prev[t] = s; heapq.heappush(hq, (ng + heur(t), ng, t, None))
    return None

tracks, vias, failed = [], [], []
def emit(path, net, width):
    segs, cur = [], [path[0]]
    for a in path[1:]:
        if a[2] != cur[-1][2]:
            segs.append(cur); vias.append(dict(x=a[0] * G, y=a[1] * G, net=net)); cur = [a]
            for LL in (0, 1): stamp_path([(a[0], a[1], LL)], netid[net], 0.75)
        else: cur.append(a)
    segs.append(cur)
    for s in segs:
        if len(s) < 2: continue
        pts = [s[0]]
        for k in range(1, len(s) - 1):
            a, b, c = pts[-1], s[k], s[k + 1]
            if (b[0] - a[0]) * (c[1] - b[1]) != (b[1] - a[1]) * (c[0] - b[0]): pts.append(b)
        pts.append(s[-1])
        tracks.append(dict(net=net, layer='top' if s[0][2] == 0 else 'bottom', w=width,
                           pts=[[round(p[0] * G, 3), round(p[1] * G, 3)] for p in pts]))

# ground: SMD ground pads drop through a via to the bottom pour
gid = netid['GND']
for m in N['GND']:
    p = padmap[m]
    if p['th']: continue
    src = pad_cells(p)
    def goal(s, p=p):
        x, y = s[0] * G, s[1] * G
        return math.hypot(x - p['x'], y - p['y']) > max(p['w'], p['h']) / 2 + 0.55 and s[2] == 0 and via_ok(s[0], s[1], gid)
    path = route(src, goal, lambda s: 0, gid, SIG_W)
    if not path: failed.append('GND via ' + m); continue
    stamp_path(path, gid, SIG_W); emit(path, 'GND', SIG_W)
    e = path[-1]; vias.append(dict(x=e[0] * G, y=e[1] * G, net='GND'))
    for L in (0, 1): stamp_path([(e[0], e[1], L)], gid, 0.75)

order = sorted([n for n in N if n != 'GND'], key=lambda n: (n not in POWER, len(N[n])))
for net in order:
    nid, width = netid[net], (PWR_W if net in POWER else SIG_W)
    members = [padmap[m] for m in N[net]]
    tree = set(pad_cells(members[0]))
    rest = members[1:]
    while rest:
        rest.sort(key=lambda p: min(math.hypot(p['x'] - c[0] * G, p['y'] - c[1] * G) for c in list(tree)[::7] or tree))
        p = rest.pop(0)
        tgt = set(pad_cells(p)); tx, ty = p['x'] / G, p['y'] / G
        path = route(list(tgt), lambda s: s in tree, lambda s: 0, nid, width) if False else \
               route(list(tree), lambda s: s in tgt, lambda s: math.hypot(s[0] - tx, s[1] - ty) * 0.999, nid, width)
        if not path and width > SIG_W:                    # fall back to a thinner track in tight spots
            path = route(list(tree), lambda s: s in tgt, lambda s: math.hypot(s[0] - tx, s[1] - ty) * 0.999, nid, SIG_W)
            w_used = SIG_W
        else: w_used = width
        if not path: failed.append(f'{net}->{p["ref"]}.{p["pin"]}'); continue
        stamp_path(path, nid, w_used); emit(path, net, w_used)
        tree |= set(path) | tgt

print(f'{len(tracks)} tracks, {len(vias)} vias, failed: {failed}')
total = sum(math.hypot(t['pts'][k + 1][0] - t['pts'][k][0], t['pts'][k + 1][1] - t['pts'][k][1]) for t in tracks for k in range(len(t['pts']) - 1))
print(f'copper length {total:.0f} mm')

# ------------------------------------------------------------------ outputs
data = dict(board=dict(w=BW, h=BH, t=1.6, holes=[dict(x=x, y=y, d=2.7) for x, y in holes]),
            comps=[{k: v for k, v in c.items() if k != 'pads'} | {'pads': list(c['pads'].values())} for c in comps],
            tracks=tracks, vias=vias, nets={n: dict(kind=NET_INFO[n][0], desc=NET_INFO[n][1], pins=N[n]) for n in N},
            failed=failed)
with open(os.path.join(OUT, 'pcb-data.js'), 'w') as f:
    f.write('// Generated by cad/build_pcb.py: carrier-board placement, netlist and routed tracks (mm, origin bottom-left).\n')
    f.write('export const PCB = ' + json.dumps(data, separators=(',', ':')) + ';\n')

os.makedirs(os.path.join(OUT, 'downloads'), exist_ok=True)
with open(os.path.join(OUT, 'downloads', 'carrier-netlist.csv'), 'w') as f:
    f.write('Net,Type,Ref,Pin,Part,Description\n')
    cmap = {c['ref']: c for c in comps}
    for n, ms in N.items():
        for m in ms:
            r, pn = m.split('.', 1)
            f.write(f'"{n}","{NET_INFO[n][0]}","{r}","{pn}","{cmap[r]["value"]}","{NET_INFO[n][1]}"\n')

COL = dict(top='#c8742c', bottom='#3f7fbf')
def svg(layer):
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 {BW + 4} {BH + 4}" width="{(BW + 4) * 8}" height="{(BH + 4) * 8}">',
         f'<g transform="translate(0,{BH}) scale(1,-1)">',
         f'<rect x="0" y="0" width="{BW}" height="{BH}" rx="2" fill="#23301c" stroke="#9aa07a" stroke-width="0.3"/>']
    if layer == 'bottom': s.append(f'<rect x="0.8" y="0.8" width="{BW - 1.6}" height="{BH - 1.6}" rx="1.5" fill="#2c4a6b" opacity=".55"/>')
    for t in tracks:
        if t['layer'] != layer: continue
        pts = ' '.join(f'{x},{y}' for x, y in t['pts'])
        if layer == 'bottom': s.append(f'<polyline points="{pts}" fill="none" stroke="#23301c" stroke-width="{t["w"] + 0.4}" stroke-linecap="round" stroke-linejoin="round"/>')
        s.append(f'<polyline points="{pts}" fill="none" stroke="{COL[layer]}" stroke-width="{t["w"]}" stroke-linecap="round" stroke-linejoin="round"/>')
    for p in pads:
        if not (p['th'] or layer == 'top'): continue
        if p['shape'] == 'circle': s.append(f'<circle cx="{p["x"]}" cy="{p["y"]}" r="{p["w"] / 2}" fill="#d9b25a"/>')
        else: s.append(f'<rect x="{p["x"] - p["w"] / 2}" y="{p["y"] - p["h"] / 2}" width="{p["w"]}" height="{p["h"]}" fill="#d9b25a"/>')
        if p['th']: s.append(f'<circle cx="{p["x"]}" cy="{p["y"]}" r="{p["drill"] / 2}" fill="#111"/>')
    for v in vias: s.append(f'<circle cx="{v["x"]}" cy="{v["y"]}" r="0.35" fill="#d9b25a"/><circle cx="{v["x"]}" cy="{v["y"]}" r="0.15" fill="#111"/>')
    for x, y in holes: s.append(f'<circle cx="{x}" cy="{y}" r="1.35" fill="#111" stroke="#d9b25a" stroke-width="0.6"/>')
    s.append('</g></svg>')
    return '\n'.join(s)
for L in ('top', 'bottom'):
    with open(os.path.join(OUT, 'downloads', f'carrier-{L}.svg'), 'w') as f: f.write(svg(L))
print('wrote pcb-data.js, carrier-netlist.csv, carrier-top.svg, carrier-bottom.svg')
