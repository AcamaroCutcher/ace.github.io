"""Synthetic wrfout-style file (fire-mesh variables only) from the project's spread model.
NOT WRF-SFIRE output: it exists to test wrfsfire_to_kml.py end to end."""
import json, sys, datetime as dt
import numpy as np, tifffile
from PIL import Image
from netCDF4 import Dataset
from pyproj import Transformer
site, proj, out = sys.argv[1], sys.argv[2], sys.argv[3]
meta = json.load(open(f"{site}/img/fire/fire-anim.json"))
v = np.asarray(Image.open(f"{site}/img/fire/fire-arrival.png")).astype(float)
arr = np.where(v > 0, (v - 1) / 254 * meta["minutes"] * 60, np.inf)            # seconds
fuel = tifffile.imread(f"{proj}/data/processed/fuel_anderson13_wui.tif").astype(int)
zsf = tifffile.imread(f"{proj}/data/processed/elevation_30m.tif").astype("float32")
g = json.load(open(f"{proj}/data/raw/grid.json")); x0, y0, x1, y1 = g["bounds"]
H, W = arr.shape
xs = x0 + (np.arange(W) + .5) * 30; ys = y1 - (np.arange(H) + .5) * 30
X, Y = np.meshgrid(xs, ys)
lon, lat = Transformer.from_crs("EPSG:32610", "EPSG:4326", always_xy=True).transform(X, Y)
fgi = dict(zip(range(1, 14), [0.166, 0.897, 0.675, 2.468, 0.785, 1.345, 1.092, 1.121, 0.780, 2.694, 2.582, 7.749, 13.024]))
wt = dict(zip(range(1, 14), [7, 7, 7, 180, 100, 100, 100, 900, 900, 900, 900, 900, 900]))
FG = np.vectorize(lambda k: fgi.get(k, 0.0))(fuel); TF = np.vectorize(lambda k: wt.get(k, 7) / 0.85)(fuel)
pad = 5                                    # mimic the sr padding at the far edges
flip = lambda a: a[::-1]                   # WRF rows run south -> north
def padded(a, fill=0):
    o = np.full((H + pad, W + pad), fill, dtype="float32"); o[:H, :W] = flip(a); return o
t0 = dt.datetime(2020, 9, 8, 0, 0, 0)
frames = np.arange(0, meta["minutes"] * 60 + 1, 3600)
ds = Dataset(out, "w")
ds.createDimension("Time", None); ds.createDimension("DateStrLen", 19)
ds.createDimension("south_north_subgrid", H + pad); ds.createDimension("west_east_subgrid", W + pad)
ds.SIMULATION_START_DATE = t0.strftime("%Y-%m-%d_%H:%M:%S"); ds.TITLE = "SYNTHETIC test file - not WRF-SFIRE output"
T = ds.createVariable("Times", "S1", ("Time", "DateStrLen"))
dims = ("Time", "south_north_subgrid", "west_east_subgrid")
V = {n: ds.createVariable(n, "f4", dims, zlib=True) for n in ["FXLONG", "FXLAT", "LFN", "TIGN_G", "FIRE_AREA", "FGRNHFX", "ZSF"]}
for k, t in enumerate(frames):
    T[k] = np.array(list((t0 + dt.timedelta(seconds=float(t))).strftime("%Y-%m-%d_%H:%M:%S")), dtype="S1")
    burned = arr <= t
    V["FXLONG"][k] = padded(lon); V["FXLAT"][k] = padded(lat); V["ZSF"][k] = padded(zsf)
    V["LFN"][k] = padded(np.where(np.isfinite(arr), arr - t, 1e5), 1e5)        # replay-style lfn = tign - t
    V["TIGN_G"][k] = padded(np.where(burned, arr, 2.0), 2.0)                    # placeholder in unburned cells
    V["FIRE_AREA"][k] = padded(burned.astype("float32"))
    age = np.where(burned, t - arr, np.inf)
    V["FGRNHFX"][k] = padded(np.where(burned, FG * (1 - 0.08 / 1.08) * 17.433e6 / TF * np.exp(-age / TF), 0))
ds.close(); print("frames", len(frames), "grid", H, W)
