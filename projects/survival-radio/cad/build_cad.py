#!/usr/bin/env python3
"""
Survival Radio hub - parametric CAD model (CadQuery).

Builds the hub assembly at real-world scale (millimetres, Z up, front = -Y)
and exports:
  - survival-radio-hub.step   STEP AP214 assembly with part names and colours
                              (opens in Fusion 360, SolidWorks, FreeCAD, Onshape,
                              Inventor, Solid Edge, Rhino, KiCad, ...)
  - survival-radio-hub.glb    glTF binary (web viewer, Blender, Windows 3D Viewer)
  - survival-radio-hub.stl    one mesh of the whole assembly
  - printable/*.stl           the custom 3D-printable parts
  - hub-ports.json            connection points used to draw the wiring on the website

Usage:
    pip install cadquery
    python build_cad.py <output-folder>

Dimensions come from manufacturer data where published (Pelican 1200 case,
RockBLOCK 9704 SMA, RAK19007, Adafruit ESP32-S3 Feather, SparkFun MAX-M10S,
Waveshare 2.9" e-paper, Adafruit SCD-41 / PMSA003I, DFRobot gas sensors,
21700 cells). Parts marked APPROX are envelope estimates - measure your own
parts before you machine or print anything.
"""
import json
import math
import os
import sys

import cadquery as cq

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(os.path.join(OUT, "printable"), exist_ok=True)

# --------------------------------------------------------------------------------------
# Colours (hex) and helpers
# --------------------------------------------------------------------------------------
COL = {
    "case": "#e0611a", "black": "#1c1d21", "rubber": "#101012", "steel": "#b9bdc4",
    "gold": "#d4a52a", "pcbgreen": "#1d6b3a", "pcbblack": "#16181d", "pcbblue": "#1f3c8c",
    "pcbred": "#b3261e", "pcbpurple": "#3b2a6b", "chip": "#0c0c0e", "shield": "#cfd3d9",
    "cell": "#0f766e", "nickel": "#c3c7cc", "printed": "#4b5563", "pod": "#f2c230",
    "bezel": "#2b2f36", "glass": "#a8d8ff", "screen": "#d9dccf", "led": "#22c55e",
    "red": "#d62828", "ceramic": "#d8c9a3", "white": "#eef0f2", "blue": "#2563eb",
    "copper": "#b87333", "grey": "#7b8088", "yellow": "#facc15",
}
ALPHA = {"glass": 0.35, "red": 0.85}


def color(name):
    h = COL[name].lstrip("#")
    return cq.Color(int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, ALPHA.get(name, 1.0))


def box(l, w, h, x=0.0, y=0.0, z=0.0, r=None):
    """Box with its base at z (not centred in z). Optional vertical-edge fillet r."""
    s = cq.Workplane("XY").box(l, w, h, centered=(True, True, False))
    if r:
        try:
            s = s.edges("|Z").fillet(min(r, l / 2 - 0.01, w / 2 - 0.01))
        except Exception:
            pass
    return s.translate((x, y, z))


def cyl(r, h, x=0.0, y=0.0, z=0.0, axis="Z"):
    """Cylinder starting at the given point and extruding h along +axis."""
    s = cq.Workplane("XY").circle(r).extrude(h)
    if axis == "X":
        s = s.rotate((0, 0, 0), (0, 1, 0), 90)
    elif axis == "-X":
        s = s.rotate((0, 0, 0), (0, 1, 0), -90)
    elif axis == "Y":
        s = s.rotate((0, 0, 0), (1, 0, 0), -90)
    elif axis == "-Y":
        s = s.rotate((0, 0, 0), (1, 0, 0), 90)
    elif axis == "-Z":
        s = s.rotate((0, 0, 0), (1, 0, 0), 180)
    return s.translate((x, y, z))


def hexnut(af, h, x=0.0, y=0.0, z=0.0, axis="Z"):
    s = cq.Workplane("XY").polygon(6, af / math.cos(math.pi / 6)).extrude(h)
    if axis == "X":
        s = s.rotate((0, 0, 0), (0, 1, 0), 90)
    elif axis == "-X":
        s = s.rotate((0, 0, 0), (0, 1, 0), -90)
    return s.translate((x, y, z))


def fillet_top(s, r):
    try:
        return s.edges(">Z").fillet(r)
    except Exception:
        return s


# --------------------------------------------------------------------------------------
# Component registry
# --------------------------------------------------------------------------------------
COMPS = []     # list of dicts: id, origin, parts[(name, shape, colour)], ports{name: (x,y,z)}, rot
PRINTABLE = {}  # file name -> shape (in local coordinates)


def comp(cid, origin=(0, 0, 0), rot=None):
    c = {"id": cid, "origin": origin, "parts": [], "ports": {}, "rot": rot}
    COMPS.append(c)
    return c


def part(c, name, shape, col, mat=None):
    c["parts"].append((f"{c['id']}--{name}--{mat or col}", shape, col))


def port(c, name, xyz):
    c["ports"][name] = [round(v, 2) for v in xyz]


def standoffs(c, l, w, h=6.0, inset=3.0, z=-6.0):
    for sx in (-1, 1):
        for sy in (-1, 1):
            part(c, f"standoff{sx}{sy}", cyl(2.4, h, sx * (l / 2 - inset), sy * (w / 2 - inset), z), "gold", "brass")


# ======================================================================================
# 1. CASE (Pelican 1200 Protector envelope)
#    Published: interior 236.5 x 181.1 x 104.6 mm, exterior 271 x 247.7 x 123.4 mm,
#    lid depth 30 mm, base depth 74.4 mm, IP67, automatic pressure-purge valve.
# ======================================================================================
SHELL_L, SHELL_W = 252.0, 200.0           # main shell (excludes latches / handle / hinge)
IN_L, IN_W = 236.5, 181.0                 # interior
BASE_H, FLOOR = 88.0, 13.6                # base outer height, floor thickness
LID_H, LID_TOP = 35.4, 5.4                # lid outer height, lid top thickness
SEAM = BASE_H
LID_INNER_TOP = SEAM + LID_H - LID_TOP    # 118.0
LID_TOP_Z = SEAM + LID_H                  # 123.4
PLATE_Z = FLOOR + 3.0                     # top of printed mounting plate (16.6)
BOARD_Z = PLATE_Z + 6.0                   # underside of boards on 6 mm standoffs (22.6)

case = comp("case")
outer = box(SHELL_L, SHELL_W, BASE_H, r=18)
try:
    outer = outer.edges("<Z").fillet(6)
except Exception:
    pass
inner = box(IN_L, IN_W, BASE_H, z=FLOOR, r=10)
flange = box(SHELL_L + 10, SHELL_W + 10, 10, z=BASE_H - 10, r=22)
base = outer.union(flange).cut(inner)
# side grip recesses (decorative ribs like the real case)
for sx in (-1, 1):
    for yy in (-55, 0, 55):
        base = base.cut(box(4, 30, 46, sx * (SHELL_L / 2 + 0.5), yy, 22, r=1.5))
part(case, "base", base, "case", "plastic")
# latches (front, -Y)
for i, sx in enumerate((-1, 1)):
    latch = box(44, 13, 46, sx * 62, -SHELL_W / 2 - 11.5, SEAM - 26, r=4)
    latch = latch.union(box(36, 6, 8, sx * 62, -SHELL_W / 2 - 17, SEAM + 8, r=2))
    part(case, f"latch{i}", latch, "black", "plastic")
# handle (front)
handle = box(92, 14, 14, 0, -SHELL_W / 2 - 29, SEAM - 4, r=6)
for sx in (-1, 1):
    handle = handle.union(box(14, 24, 14, sx * 39, -SHELL_W / 2 - 15, SEAM - 4, r=3))
part(case, "handle", handle, "rubber", "rubber")
# hinge (back, +Y)
hinge = cyl(6.5, 214, -107, SHELL_W / 2 + 6, SEAM, axis="X")
for xx in (-90, -30, 30, 90):
    hinge = hinge.union(box(22, 12, 16, xx, SHELL_W / 2 + 4, SEAM - 8, r=3))
part(case, "hinge", hinge, "black", "plastic")
# automatic pressure-purge valve (front-left)
valve = cyl(13, 4, -96, -SHELL_W / 2, 42, axis="-Y").union(cyl(7, 2.5, -96, -SHELL_W / 2 - 4, 42, axis="-Y"))
part(case, "purge-valve", valve, "grey", "plastic")
# rubber feet
for sx in (-1, 1):
    for sy in (-1, 1):
        part(case, f"foot{sx}{sy}", box(28, 16, 2.5, sx * 92, sy * 70, -2.5, r=4), "rubber", "rubber")

# ======================================================================================
# 2. LID with openings for the control panel, SOS switch and antenna bulkheads
# ======================================================================================
PANEL_XY = (-30.0, -25.0)
WINDOW_XY = (PANEL_XY[0] - 18.0, PANEL_XY[1])
SOS_XY = (72.0, -38.0)
LORA_XY = (100.0, 70.0)
IRID_XY = (-98.0, 66.0)
GNSS_XY = (45.0, 55.0)

lid = comp("lid")
louter = box(SHELL_L, SHELL_W, LID_H, z=SEAM, r=18)
louter = fillet_top(louter, 6)
lflange = box(SHELL_L + 10, SHELL_W + 10, 10, z=SEAM, r=22)
linner = box(IN_L, IN_W, LID_H - LID_TOP, z=SEAM, r=10)
lshell = louter.union(lflange).cut(linner)
# raised panel pad on the lid top
lshell = lshell.cut(box(76, 38, 20, WINDOW_XY[0], WINDOW_XY[1], LID_INNER_TOP - 1))   # display window
for i in range(3):
    lshell = lshell.cut(cyl(8.2, 20, PANEL_XY[0] + 42, PANEL_XY[1] - 22 + 22 * i, LID_INNER_TOP - 1))
lshell = lshell.cut(cyl(2.6, 20, PANEL_XY[0] + 58, PANEL_XY[1] + 28, LID_INNER_TOP - 1))
lshell = lshell.cut(cyl(6.3, 20, SOS_XY[0], SOS_XY[1], LID_INNER_TOP - 1))
lshell = lshell.cut(cyl(3.3, 20, LORA_XY[0], LORA_XY[1], LID_INNER_TOP - 1))
lshell = lshell.cut(cyl(3.3, 20, IRID_XY[0], IRID_XY[1], LID_INNER_TOP - 1))
for sx in (-1, 1):
    for sy in (-1, 1):
        lshell = lshell.cut(cyl(1.7, 20, PANEL_XY[0] + sx * 58, PANEL_XY[1] + sy * 33, LID_INNER_TOP - 1))
part(lid, "shell", lshell, "case", "plastic")
part(lid, "o-ring", box(IN_L + 6, IN_W + 6, 2, z=SEAM - 1, r=12).cut(box(IN_L + 1, IN_W + 1, 4, z=SEAM - 2, r=10)), "rubber", "rubber")

# ======================================================================================
# 3. CONTROL PANEL (3D-printed bezel, clear window, 3 buttons, status LED)
# ======================================================================================
panel = comp("panel", origin=(PANEL_XY[0], PANEL_XY[1], LID_TOP_Z))
bez = box(130, 80, 4, r=8)
bez = bez.cut(box(82, 44, 2.2, -18, 0, 1.9))                 # window recess
bez = bez.cut(box(76, 38, 6, -18, 0, -1))                    # window opening
for i in range(3):
    bez = bez.cut(cyl(8.2, 6, 42, -22 + 22 * i, -1))
bez = bez.cut(cyl(2.6, 6, 58, 28, -1))
for sx in (-1, 1):
    for sy in (-1, 1):
        bez = bez.cut(cyl(1.7, 6, sx * 58, sy * 33, -1))
part(panel, "bezel", bez, "bezel", "printed")
PRINTABLE["control-panel-bezel.stl"] = bez
part(panel, "window", box(81.6, 43.6, 2.0, -18, 0, 1.95, r=2), "glass", "glass")
for i in range(3):
    by = -22 + 22 * i
    part(panel, f"button{i}-ring", cyl(9.5, 2.5, 42, by, 4).cut(cyl(6.6, 4, 42, by, 3.9)), "steel", "metal")
    part(panel, f"button{i}-cap", cyl(6.2, 3.5, 42, by, 4), "black", "rubber")
    part(panel, f"button{i}-body", cyl(7.8, 18, 42, by, -LID_TOP - 18 + 0.5), "black", "plastic")
part(panel, "led-lens", cyl(2.5, 2.0, 58, 28, 4), "led", "led")
for sx in (-1, 1):
    for sy in (-1, 1):
        part(panel, f"screw{sx}{sy}", cyl(2.8, 1.6, sx * 58, sy * 33, 4), "steel", "metal")
port(panel, "buttons", (42, 0, -LID_TOP - 18))

# ======================================================================================
# 4. E-PAPER DISPLAY (Waveshare 2.9" module: 89.5 x 38 mm, active 66.89 x 29.05 mm)
# ======================================================================================
disp = comp("display", origin=(WINDOW_XY[0], WINDOW_XY[1], LID_INNER_TOP - 3.2))
part(disp, "pcb", box(89.5, 38.0, 1.6), "pcbblack", "pcb")
part(disp, "panel", box(79.0, 36.7, 1.2, -3.5, 0, 1.6), "white", "plastic")
part(disp, "screen", box(66.89, 29.05, 0.3, -2.0, 0, 2.8), "screen", "screen")
part(disp, "connector", box(9, 4, 4, 38, 0, -4), "white", "plastic")
port(disp, "spi", (40, 0, -4))

# ======================================================================================
# 5. GUARDED SOS SWITCH (switch body under lid, flip guard on top)
# ======================================================================================
sos = comp("sos", origin=(SOS_XY[0], SOS_XY[1], LID_TOP_Z))
part(sos, "guard-base", box(38, 46, 6, 0, 0, 0, r=4).cut(cyl(6.4, 8, 0, 0, -1)), "black", "plastic")
part(sos, "nut", hexnut(14, 3, 0, 0, 6), "steel", "metal")
part(sos, "bushing", cyl(6.0, 8, 0, 0, 6), "steel", "metal")
lever = cyl(2.0, 20, 0, 0, 0).rotate((0, 0, 0), (1, 0, 0), 20).translate((0, 0, 12))
part(sos, "lever", lever, "steel", "metal")
part(sos, "body", box(14, 16, 26, 0, 0, -LID_TOP - 26), "black", "plastic")
port(sos, "gpio", (0, 0, -LID_TOP - 26))
# flip cover: its own sub-assembly so the web viewer can rotate it about the hinge line
cover = comp("sosCover", origin=(SOS_XY[0], SOS_XY[1] + 21, LID_TOP_Z + 6))
cv = box(36, 44, 28, 0, -22, 0, r=5)
cv = fillet_top(cv, 4).cut(box(32, 40, 27, 0, -22, -1, r=3))
part(cover, "cover", cv, "red", "redcover")
part(cover, "hinge-pin", cyl(2.5, 40, -20, 0, 1, axis="X"), "steel", "metal")

# ======================================================================================
# 6. ANTENNAS through the lid (SMA bulkheads)
# ======================================================================================
lora = comp("loraAnt", origin=(LORA_XY[0], LORA_XY[1], LID_TOP_Z))
part(lora, "bulkhead-nut", hexnut(8, 2.5), "gold", "gold")
part(lora, "bulkhead-rear", hexnut(8, 2.5, 0, 0, -LID_TOP - 2.5), "gold", "gold")
part(lora, "barrel", cyl(3.2, 8, 0, 0, 2.5), "gold", "gold")
part(lora, "base", cyl(5.5, 20, 0, 0, 10.5), "rubber", "rubber")
part(lora, "knuckle", cyl(5.8, 10, -5, 0, 30, axis="X"), "rubber", "rubber")
whip = cq.Workplane("XY").circle(5.2).workplane(offset=165).circle(4.0).loft().translate((0, 0, 36))
part(lora, "whip", whip, "rubber", "rubber")
part(lora, "tip", cyl(4.2, 6, 0, 0, 201), "rubber", "rubber")
port(lora, "rf", (0, 0, -LID_TOP - 3))
port(lora, "tip", (0, 0, 205))

irid = comp("iridiumAnt", origin=(IRID_XY[0], IRID_XY[1], LID_TOP_Z))
part(irid, "bulkhead-nut", hexnut(8, 2.5), "gold", "gold")
part(irid, "bulkhead-rear", hexnut(8, 2.5, 0, 0, -LID_TOP - 2.5), "gold", "gold")
part(irid, "base", cyl(9.5, 12, 0, 0, 2.5), "rubber", "rubber")     # APPROX envelope of a passive helical
rad = cyl(9.0, 56, 0, 0, 14.5)
try:
    rad = rad.faces(">Z").edges().fillet(8.5)
except Exception:
    pass
part(irid, "radome", rad, "black", "plastic")
port(irid, "rf", (0, 0, -LID_TOP - 3))
port(irid, "tip", (0, 0, 72))

gpatch = comp("gnssPatch", origin=(GNSS_XY[0], GNSS_XY[1], LID_INNER_TOP))
part(gpatch, "patch", box(25, 25, 4, 0, 0, -4.0), "ceramic", "ceramic")
part(gpatch, "ground-plane", box(28, 28, 1.2, 0, 0, -5.2), "steel", "metal")
part(gpatch, "feed", cyl(1.6, 2, 0, 0, -7.2), "gold", "gold")
port(gpatch, "rf", (0, 0, -7.2))

# ======================================================================================
# 7. PRINTED MOUNTING PLATE on the case floor
# ======================================================================================
plate = comp("plate", origin=(0, 0, FLOOR))
pl = box(IN_L - 8, IN_W - 8, 3.0, r=8)
for (sx, sy, l, w) in [(-60, -15, 30, 50), (60, -5, 20, 40), (0, -70, 60, 10)]:
    pl = pl.cut(box(l, w, 5, sx, sy, -1, r=4))   # weight-saving slots
part(plate, "plate", pl, "printed", "printed")
PRINTABLE["mounting-plate.stl"] = pl

# ======================================================================================
# 8. BATTERY: 4 x 21700 Li-ion in parallel (1S4P) on a printed cradle, with BMS + NTC
# ======================================================================================
batt = comp("battery", origin=(-70.0, 42.0, PLATE_Z))
CELL_R, CELL_L = 10.85, 70.15
cr = box(80, 94, 13, r=4)
for i in range(4):
    cy = -33 + 22 * i
    cr = cr.cut(cyl(CELL_R + 0.4, 74, -37, cy, 2 + CELL_R, axis="X"))
part(batt, "cradle", cr, "printed", "printed")
PRINTABLE["battery-cradle.stl"] = cr
for i in range(4):
    cy = -33 + 22 * i
    part(batt, f"cell{i}", cyl(CELL_R, CELL_L - 2, -CELL_L / 2 + 1, cy, 2 + CELL_R, axis="X"), "cell", "cell")
    for sx in (-1, 1):
        part(batt, f"cell{i}-cap{sx}", cyl(7.5, 1.0, sx * (CELL_L / 2 - 1) - (1 if sx > 0 else 0), cy, 2 + CELL_R, axis="X"), "steel", "metal")
for sx in (-1, 1):
    part(batt, f"strip{sx}", box(0.6, 80, 16, sx * (CELL_L / 2 + 0.4), 0, 5), "nickel", "metal")
part(batt, "bms", box(44, 14, 1.6, 0, 0, 2 + 2 * CELL_R + 0.5), "pcbgreen", "pcb")
part(batt, "bms-chip", box(6, 5, 1.2, -8, 0, 2 + 2 * CELL_R + 2.1), "chip", "chip")
part(batt, "ntc", box(4, 8, 2, 12, 11, 2 + 2 * CELL_R), "black", "plastic")
port(batt, "pwr", (CELL_L / 2 + 2, -40, 12))

# ======================================================================================
# 9. POWER: Adafruit bq24074 charger (APPROX 35 x 30 mm) + 5 V boost (APPROX) + fuse/TVS
# ======================================================================================
pwr = comp("power", origin=(-72.0, -48.0, BOARD_Z))
part(pwr, "charger-pcb", box(35, 30, 1.6, -10, 0), "pcbblack", "pcb")
standoffs(pwr, 35, 30, inset=3)
part(pwr, "charger-ic", box(4, 4, 1.0, -12, 2, 1.6), "chip", "chip")
part(pwr, "charger-usbc", box(9, 7.5, 3.2, -24.5, 0, 1.6), "steel", "metal")
part(pwr, "charger-jst", box(8, 6, 6, 4, -9, 1.6), "white", "plastic")
part(pwr, "cap", cyl(2.5, 4, -2, 8, 1.6), "chip", "chip")
part(pwr, "boost-pcb", box(22, 14, 1.6, 22, 4), "pcbblack", "pcb")
part(pwr, "boost-inductor", box(5, 5, 3, 22, 4, 1.6), "chip", "chip")
part(pwr, "fuse-holder", box(18, 8, 8, 10, -20, 0), "black", "plastic")
part(pwr, "tvs", box(5, 3, 2.4, 22, -8, 1.6), "chip", "chip")
port(pwr, "in", (-24, 0, 4))
port(pwr, "load", (30, 4, 4))
port(pwr, "bat", (4, -9, 8))

# ======================================================================================
# 10. MESH RADIO: RAK4631 (nRF52840 + SX1262) on RAK19007 base board (30 x 60 x 8.5 mm)
# ======================================================================================
rak = comp("rak", origin=(5.0, 62.0, BOARD_Z))
part(rak, "base-pcb", box(60, 30, 1.6), "pcbblue", "pcb")
standoffs(rak, 60, 30, inset=3)
part(rak, "usbc", box(7.5, 9, 3.2, -27, 0, 1.6), "steel", "metal")
part(rak, "jst-batt", box(6, 7, 4.5, -18, -10, 1.6), "white", "plastic")
part(rak, "jst-solar", box(6, 7, 4.5, -18, 10, 1.6), "white", "plastic")
part(rak, "core-pcb", box(20, 30, 1.2, 10, 0, 4.8), "pcbblack", "pcb")
part(rak, "core-connector", box(16, 5, 3.2, 10, 8, 1.6), "black", "plastic")
part(rak, "rak4630-shield", box(15, 15, 2.2, 10, -3, 6.0), "shield", "metal")
part(rak, "ufl-lora", cyl(1.3, 1.2, 17, 11, 6.0), "gold", "gold")
part(rak, "ufl-ble", cyl(1.3, 1.2, 3, 11, 6.0), "gold", "gold")
part(rak, "io-header", box(24, 2.5, 2, -6, -13.5, 1.6), "black", "plastic")
part(rak, "ble-antenna", box(30, 8, 0.8, -10, 20, 14), "white", "plastic")
port(rak, "ufl", (17, 11, 8))
port(rak, "uart", (-6, -14, 4))
port(rak, "bat", (-18, -10, 6))
port(rak, "ble", (-10, 20, 15))

# ======================================================================================
# 11. CONTROLLER: Adafruit ESP32-S3 Feather (52.3 x 22.7 x 7.2 mm)
# ======================================================================================
fth = comp("feather", origin=(5.0, 15.0, BOARD_Z))
part(fth, "pcb", box(52.3, 22.7, 1.6, r=2), "pcbblack", "pcb")
standoffs(fth, 52.3, 22.7, inset=2.5)
part(fth, "esp32s3-module", box(15.4, 20.5, 2.4, 8, 0, 1.6), "shield", "metal")
part(fth, "usbc", box(7.5, 9, 3.2, -23.5, 0, 1.6), "steel", "metal")
part(fth, "jst-batt", box(6, 8, 4.5, -14, 6.5, 1.6), "white", "plastic")
part(fth, "stemma-qt", box(4.5, 6, 3, 22, -6, 1.6), "white", "plastic")
part(fth, "header-a", box(40.6, 2.5, 8.5, 0, 10.1, 1.6), "black", "plastic")
part(fth, "header-b", box(30.5, 2.5, 8.5, 5, -10.1, 1.6), "black", "plastic")
part(fth, "neopixel", box(2, 2, 0.8, -6, -4, 1.6), "white", "plastic")
port(fth, "uart1", (-10, 10, 10))
port(fth, "uart2", (-18, 10, 10))
port(fth, "uart3", (12, -10, 10))
port(fth, "i2c", (22, -6, 5))
port(fth, "spi", (0, 10, 10))
port(fth, "gpio", (18, 10, 10))
port(fth, "bat", (-14, 6.5, 6))

# ======================================================================================
# 12. GNSS: SparkFun MAX-M10S breakout (Qwiic), 44.2 x 30.5 mm incl. SMA
# ======================================================================================
gnss = comp("gnss", origin=(0.0, -35.0, BOARD_Z))
part(gnss, "pcb", box(38, 30.5, 1.6, r=1.5), "pcbred", "pcb")
standoffs(gnss, 38, 30.5, inset=3)
part(gnss, "max-m10s", box(9.7, 10.1, 2.5, 4, 0, 1.6), "shield", "metal")
part(gnss, "sma", cyl(3.2, 7, 19, 0, 4.2, axis="X"), "gold", "gold")
part(gnss, "sma-body", box(6.4, 6.4, 6.4, 20, 0, 1.6), "gold", "gold")
for sy in (-1, 1):
    part(gnss, f"qwiic{sy}", box(4.5, 6, 3, -15, sy * 9, 1.6), "black", "plastic")
part(gnss, "backup-cap", cyl(2.4, 1.6, -6, -9, 1.6), "chip", "chip")
port(gnss, "i2c", (-16, 9, 5))
port(gnss, "i2c-out", (-16, -9, 5))
port(gnss, "rf", (26, 0, 4.2))

# ======================================================================================
# 13. IMU: Adafruit LIS3DH (STEMMA QT)
# ======================================================================================
imu = comp("imu", origin=(46.0, -30.0, BOARD_Z))
part(imu, "pcb", box(25.4, 17.8, 1.6, r=2), "pcbblack", "pcb")
standoffs(imu, 25.4, 17.8, inset=2.5)
part(imu, "lis3dh", box(3, 3, 1, 0, 0, 1.6), "chip", "chip")
for sx in (-1, 1):
    part(imu, f"qt{sx}", box(4.5, 6, 3, sx * 10, 0, 1.6), "white", "plastic")
port(imu, "i2c", (-10, 0, 5))

# ======================================================================================
# 14. SATELLITE MODEM: RockBLOCK 9704 SMA (48 x 52 x 16 mm)
# ======================================================================================
rb = comp("rockblock", origin=(82.0, 52.0, BOARD_Z))
part(rb, "pcb", box(48, 52, 1.6, r=2).cut(box(12, 10, 4, 18, 26, -1)), "pcbblack", "pcb")
standoffs(rb, 48, 52, inset=3.5)
part(rb, "iridium-9704", box(30, 26, 4.5, -4, 4, 1.6), "shield", "metal")   # APPROX module can
part(rb, "label", box(24, 18, 0.2, -4, 4, 6.1), "white", "label")
for i, yy in enumerate((-12, -22)):
    part(rb, f"supercap{i}", cyl(5, 18, -20, yy, 6.6, axis="X"), "blue", "plastic")
part(rb, "sma-body", box(7, 7, 7, 18, 19, 1.6), "gold", "gold")
part(rb, "sma", cyl(3.2, 8, 18, 22.5, 5.1, axis="Y"), "gold", "gold")
part(rb, "header-16", box(20.3, 5.1, 8.5, 0, -22, 1.6), "black", "plastic")
part(rb, "usbc", box(9, 7.5, 3.2, 21, -10, 1.6), "steel", "metal")
part(rb, "ufl-gnss", cyl(1.3, 1.2, 8, -12, 1.6), "gold", "gold")
port(rb, "uart", (0, -22, 10))
port(rb, "pwr", (-8, -22, 10))
port(rb, "rf", (18, 30, 5))

# ======================================================================================
# 15. ALERTS: piezo buzzer
# ======================================================================================
alerts = comp("alerts", origin=(90.0, -25.0, PLATE_Z))
part(alerts, "buzzer", cyl(8.5, 9.5), "black", "plastic")
part(alerts, "buzzer-hole", cyl(1.2, 0.3, 0, 0, 9.5), "chip", "chip")
port(alerts, "gpio", (-8, 0, 6))

# ======================================================================================
# 16. PORTS on the right wall: IP67 USB-C (e.g. Amphenol LTW UC series) + M12 DC-IN
# ======================================================================================
WALL_X = SHELL_L / 2      # 126 (outer face)
ports = comp("ports", origin=(WALL_X, 0.0, 50.0))
def panel_conn(c, name, y, body_r, nut_af, out_r, cap_r, out_len=10.0):
    # +X is outward. Built with axis X.
    part(c, f"{name}-nut", hexnut(nut_af, 3.0, 0, 0, 0, axis="X").translate((0, y, 0)), "steel", "metal")
    part(c, f"{name}-barrel", cyl(out_r, out_len, 3.0, y, 0, axis="X"), "steel", "metal")
    part(c, f"{name}-cap", cyl(cap_r, 9, 3.0 + out_len - 6, y, 0, axis="X"), "rubber", "rubber")
    part(c, f"{name}-tether", box(2, 6, 14, 3.0 + 4, y, -cap_r - 10), "rubber", "rubber")
    part(c, f"{name}-body", cyl(body_r, 22, -8 - 22, y, 0, axis="X"), "black", "plastic")
    part(c, f"{name}-rear-nut", hexnut(nut_af, 3.0, -11, y, 0, axis="X"), "steel", "metal")
panel_conn(ports, "usbc", -28.0, 8.5, 22, 9.5, 11.0)
panel_conn(ports, "dcin", 27.0, 7.0, 18, 8.0, 9.5)
port(ports, "usbc", (-30, -28, 0))
port(ports, "dcin", (-30, 27, 0))

podc = comp("podConn", origin=(-WALL_X, -28.0, 50.0))
part(podc, "nut", hexnut(18, 3.0, -3, 0, 0, axis="X"), "steel", "metal")
part(podc, "barrel", cyl(8.0, 12, -15, 0, 0, axis="X"), "steel", "metal")
part(podc, "body", cyl(7.0, 22, 8, 0, 0, axis="X"), "black", "plastic")
part(podc, "rear-nut", hexnut(18, 3.0, 8, 0, 0, axis="X"), "steel", "metal")
port(podc, "inside", (30, 0, 0))
port(podc, "outside", (-15, 0, 0))

# ======================================================================================
# 17. SENSOR POD (3D-printed two-part shell, clipped to the case side or a shoulder strap)
#     Local frame: front = -Y, back = +Y, bottom at z = 0.  86 x 46 x 124 mm.
# ======================================================================================
POD_W, POD_D, POD_H, POD_T = 86.0, 46.0, 124.0, 2.5
pod = comp("sensorPod", origin=(-WALL_X - 34.0, 20.0, 16.0), rot=-90)
body = box(POD_W, POD_D, POD_H, r=9)
body = fillet_top(body, 4)
cavity = box(POD_W - 2 * POD_T, POD_D - 2 * POD_T, POD_H - 2 * POD_T, 0, 0, POD_T, r=7)
shell = body.cut(cavity)
front = shell.intersect(box(400, POD_D / 2, 400, 0, -POD_D / 4, -100))
for row in range(6):
    for colx in (-18, 18):
        front = front.cut(box(30, 6, 2.6, colx, -POD_D / 2, 12 + row * 9.5, r=1.2))
for row in range(3):
    front = front.cut(box(64, 6, 2.6, 0, -POD_D / 2, 84 + row * 9.5, r=1.2))
front = front.cut(cyl(3.2, 8, 30, -POD_D / 2 - 1, 114, axis="Y"))
# alignment lip so the halves locate on each other
front = front.union(box(POD_W - 2 * POD_T - 0.4, 2.0, POD_H - 2 * POD_T - 0.4, 0, 1.0, POD_T + 0.2).cut(
    box(POD_W - 2 * POD_T - 3.4, 4.0, POD_H - 2 * POD_T - 3.4, 0, 1.0, POD_T + 1.7)))
part(pod, "front-shell", front, "pod", "printed")
PRINTABLE["sensor-pod-front.stl"] = front
back = shell.intersect(box(400, POD_D / 2, 400, 0, POD_D / 4, -100))
for row in range(4):
    back = back.cut(box(50, 6, 2.6, 0, POD_D / 2, 30 + row * 9, r=1.2))
for zz in (22, 92):
    loop = box(66, 10, 14, 0, POD_D / 2 + 5, zz, r=3).cut(box(56, 4, 20, 0, POD_D / 2 + 5, zz - 3))
    back = back.union(loop)
back = back.cut(cyl(8.2, 6, 0, 6, -1))
part(pod, "back-shell", back, "pod", "printed")
PRINTABLE["sensor-pod-back.stl"] = back
part(pod, "frame", box(76, 2.0, 112, 0, 3.4, 5), "printed", "printed")
# PMSA003I breakout (51 x 35.5 x 13.6) - laser particle counter
part(pod, "pmsa003i", box(51, 13.6, 35.5, 0, -8.8, 6), "steel", "metal")
part(pod, "pmsa003i-inlet", cyl(4, 1, -12, -15.6, 24, axis="-Y"), "chip", "chip")
part(pod, "pmsa003i-outlet", box(10, 1, 6, 12, -16.1, 26), "chip", "chip")
# DFRobot factory-calibrated O2 (SEN0465) and CO (SEN0466): 37 x 32 mm boards + probes
for nm, xx in (("o2", -19.0), ("co", 19.0)):
    part(pod, f"{nm}-board", box(37, 1.6, 32, xx, -1.8, 46), "pcbblue", "pcb")
    part(pod, f"{nm}-probe", cyl(10, 16, xx, -2.6, 62, axis="-Y"), "black", "plastic")
    part(pod, f"{nm}-probe-cap", cyl(6, 1.0, xx, -18.6, 62, axis="-Y"), "steel", "metal")
# NDIR methane module (Winsen MH-440D class) APPROX cylinder 33 x 20 mm
part(pod, "ch4-ndir", cyl(16.5, 18, 0, -2.4, 99, axis="-Y"), "steel", "metal")
part(pod, "ch4-filter", cyl(10, 0.8, 0, -20.4, 99, axis="-Y"), "white", "plastic")
# SCD-41 (25.5 x 22.8) + BME280 on the back of the frame
part(pod, "scd41", box(25.5, 1.6, 22.8, -20, 3.0, 40), "pcbblack", "pcb")
part(pod, "scd41-sensor", box(10.1, 6.5, 10.1, -20, 4.6, 46), "steel", "metal")
part(pod, "bme280", box(25.4, 1.6, 17.8, 20, 3.0, 40), "pcbblack", "pcb")
part(pod, "bme280-chip", box(2.5, 1.0, 2.5, 20, 4.6, 48), "steel", "metal")
# alerts
part(pod, "vibe-motor", cyl(5, 3, -28, -20.0, 112, axis="Y"), "steel", "metal")
part(pod, "led", cyl(2.6, 3, 30, -22.5, 114, axis="Y"), "led", "led")
part(pod, "m12", cyl(8.0, 14, 0, 6, -14), "steel", "metal")
part(pod, "m12-nut", hexnut(18, 3, 0, 6, -1), "steel", "metal")
port(pod, "cable", (0, 6, -14))
port(pod, "led", (30, -24, 114))

# ======================================================================================
# Assemble and export
# ======================================================================================
assy = cq.Assembly(name="survival_radio_hub")
ports_out = {}
for c in COMPS:
    sub = cq.Assembly(name=c["id"])
    for (nm, shp, col) in c["parts"]:
        sub.add(shp, name=nm, color=color(col))
    ox, oy, oz = c["origin"]
    if c["rot"]:
        loc = cq.Location(cq.Vector(ox, oy, oz), cq.Vector(0, 0, 1), c["rot"])
    else:
        loc = cq.Location(cq.Vector(ox, oy, oz))
    assy.add(sub, loc=loc)
    ports_out[c["id"]] = {"origin": [ox, oy, oz], "rot": c["rot"] or 0, "ports": c["ports"]}

assy.export(os.path.join(OUT, "survival-radio-hub.step"), exportType="STEP")
assy.export(os.path.join(OUT, "survival-radio-hub.glb"), exportType="GLTF", tolerance=0.08, angularTolerance=0.25)
cq.exporters.export(assy.toCompound(), os.path.join(OUT, "survival-radio-hub.stl"), tolerance=0.08, angularTolerance=0.2)
for fn, shp in PRINTABLE.items():
    cq.exporters.export(shp, os.path.join(OUT, "printable", fn), tolerance=0.03, angularTolerance=0.1)
with open(os.path.join(OUT, "hub-ports.json"), "w") as f:
    json.dump({"units": "mm", "frame": "Z up, front = -Y", "comps": ports_out}, f, indent=1)

n_parts = sum(len(c["parts"]) for c in COMPS)
print(f"components: {len(COMPS)}  parts: {n_parts}")
for fn in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, fn)
    if os.path.isfile(p):
        print(f"{fn:34s} {os.path.getsize(p)/1e6:7.2f} MB")
