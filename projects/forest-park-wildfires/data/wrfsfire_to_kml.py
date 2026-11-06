#!/usr/bin/env python3
"""Convert WRF-SFIRE output (wrfout NetCDF) to KML/KMZ, GeoJSON and textures for 3-D tools.

    python wrfsfire_to_kml.py wrfout_d03_2020-09-08_00:00:00 --out fire_viz --step 15

Products (all in --out):
  perimeters.kml/.kmz  fire perimeter at every output time (LFN = 0 contour), time-stamped so the
                       Google Earth time slider animates the fire
  fire_heat.kmz        ground heat flux FGRNHFX as time-stamped image overlays + colour bar
  perimeters.geojson   the same perimeters for Leaflet / Mapbox / CesiumJS / QGIS
  arrival_time.png     16-bit fire arrival time on a regular lat/lon grid (0 = never burns)
  terrain.png          16-bit fire-mesh terrain (ZSF) on the same grid
  textures.json        georeference + scales for the two PNGs (Unity, Blender, Unreal, three.js)

Notes on WRF-SFIRE output that this script handles:
  * Fire-mesh arrays (FXLONG, FXLAT, LFN, TIGN_G, FGRNHFX, ZSF, ...) are on the refined "subgrid"
    and carry sr_x/sr_y padding cells at the far edges that are not part of the domain. They are
    cropped here using the cells where FXLONG/FXLAT are zero.
  * TIGN_G is only meaningful where the fire has arrived (LFN <= 0). In unburned cells the model
    keeps a placeholder time, so "TIGN_G <= t" alone would mark the whole domain as burned.
  * The fire mesh is on the model's map projection (usually Lambert), not a lat/lon grid. Image
    overlays in KML need a lat/lon box, so rasters are resampled (nearest neighbour) first.

Requires: numpy, netCDF4, matplotlib, scipy, simplekml (pip install netCDF4 simplekml scipy matplotlib)
"""
import argparse
import datetime as dt
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import simplekml  # noqa: E402
from netCDF4 import Dataset  # noqa: E402
from scipy.spatial import cKDTree  # noqa: E402


def times(ds):
    raw = ds.variables["Times"][:]
    return [dt.datetime.strptime(b"".join(r).decode(), "%Y-%m-%d_%H:%M:%S") for r in raw]


def crop_box(ds):
    """Rows/cols of the fire mesh that hold real cells (drop the zero padding)."""
    lon = ds.variables["FXLONG"][0]
    lat = ds.variables["FXLAT"][0]
    ok = (np.asarray(lon) != 0) | (np.asarray(lat) != 0)
    rows = np.where(ok.any(axis=1))[0]
    cols = np.where(ok.any(axis=0))[0]
    return slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1)


def field(ds, name, t, box):
    return np.asarray(ds.variables[name][t][box], dtype="float64")


def contours(lon, lat, f, level=0.0):
    """Closed rings (lon, lat) of f = level. Returned rings are lists of (lon, lat)."""
    if not (np.nanmin(f) <= level <= np.nanmax(f)):
        return []
    fig = plt.figure()
    cs = plt.contour(lon, lat, f, levels=[level])
    rings = [seg for seg in cs.allsegs[0] if len(seg) >= 4]
    plt.close(fig)
    return rings


class Regridder:
    """Nearest-neighbour resampling from the curvilinear fire mesh to a regular lat/lon grid."""

    def __init__(self, lon, lat, res_m):
        self.west, self.east = float(lon.min()), float(lon.max())
        self.south, self.north = float(lat.min()), float(lat.max())
        lat0 = np.radians(0.5 * (self.south + self.north))
        dlat = res_m / 111_320.0
        dlon = res_m / (111_320.0 * np.cos(lat0))
        self.lons = np.arange(self.west, self.east, dlon)
        self.lats = np.arange(self.north, self.south, -dlat)
        X, Y = np.meshgrid(self.lons, self.lats)
        scale = np.cos(lat0)
        tree = cKDTree(np.c_[lon.ravel() * scale, lat.ravel()])
        dist, self.idx = tree.query(np.c_[X.ravel() * scale, Y.ravel()])
        self.outside = dist > 2.5 * max(dlat, dlon)   # beyond the edge of the mesh
        self.shape = X.shape

    def __call__(self, f):
        out = np.asarray(f).ravel()[self.idx].reshape(self.shape).astype("float64")
        out[self.outside.reshape(self.shape)] = np.nan
        return out


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wrfout")
    ap.add_argument("--out", default="fire_viz")
    ap.add_argument("--step", type=float, default=0, help="minutes between perimeters (0 = every frame)")
    ap.add_argument("--res", type=float, default=30.0, help="metres per pixel of the image products")
    ap.add_argument("--no-heat", action="store_true", help="skip the FGRNHFX image overlays")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    ds = Dataset(a.wrfout)
    tt = times(ds)
    box = crop_box(ds)
    lon = field(ds, "FXLONG", 0, box)
    lat = field(ds, "FXLAT", 0, box)
    start = ds.getncattr("SIMULATION_START_DATE") if "SIMULATION_START_DATE" in ds.ncattrs() else None
    t0 = dt.datetime.strptime(start, "%Y-%m-%d_%H:%M:%S") if start else tt[0]

    frames, last = [], None
    for k, t in enumerate(tt):
        if a.step and last is not None and (t - last).total_seconds() < a.step * 60 - 1:
            continue
        frames.append(k)
        last = t

    # ---------------------------------------------------------------- perimeters
    kml = simplekml.Kml(name="WRF-SFIRE fire perimeters")
    style = simplekml.Style()
    style.linestyle.color = "ff1a6cff"     # aabbggrr: orange line
    style.linestyle.width = 2
    style.polystyle.color = "551a6cff"
    features = []
    for n, k in enumerate(frames):
        lfn = field(ds, "LFN", k, box)
        end = tt[frames[n + 1]] if n + 1 < len(frames) else tt[k] + dt.timedelta(hours=1)
        rings = contours(lon, lat, lfn, 0.0)
        area_ha = float((lfn <= 0).sum()) * cell_area_m2(lon, lat) / 1e4
        for r in rings:
            ring = [(float(x), float(y)) for x, y in r]
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            p = kml.newpolygon(name=f"{tt[k]:%Y-%m-%d %H:%M} UTC", outerboundaryis=ring)
            p.style = style
            p.timespan.begin, p.timespan.end = iso(tt[k]), iso(end)
            p.description = f"Burned area {area_ha:.1f} ha"
            features.append({"type": "Feature",
                             "properties": {"time": iso(tt[k]), "end": iso(end), "burned_ha": round(area_ha, 1)},
                             "geometry": {"type": "Polygon", "coordinates": [ring]}})
    kml.save(os.path.join(a.out, "perimeters.kml"))
    kml.savekmz(os.path.join(a.out, "perimeters.kmz"))       # same content, zipped (much smaller)
    with open(os.path.join(a.out, "perimeters.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)
    print(f"perimeters: {len(features)} rings over {len(frames)} times")

    rg = Regridder(lon, lat, a.res)
    bbox = dict(north=rg.north, south=rg.south, east=rg.east, west=rg.west)

    # ---------------------------------------------------------------- heat-flux overlays
    if not a.no_heat and "FGRNHFX" in ds.variables:
        kz = simplekml.Kml(name="WRF-SFIRE ground heat flux")
        cmap = plt.get_cmap("inferno")
        for n, k in enumerate(frames):
            q = rg(field(ds, "FGRNHFX", k, box))
            v = np.log10(np.clip(np.nan_to_num(q), 1, None))      # 1 W/m2 .. 1e6 W/m2
            rgba = cmap(np.clip(v / 6.0, 0, 1))
            rgba[..., 3] = np.where(np.nan_to_num(q) > 1000, 0.85, 0.0)  # show >= 1 kW/m2
            name = f"heat_{n:03d}.png"
            path = os.path.join(a.out, name)
            plt.imsave(path, rgba)
            g = kz.newgroundoverlay(name=f"{tt[k]:%H:%M} UTC")
            g.icon.href = kz.addfile(path)          # stored as files/<name> inside the KMZ
            g.latlonbox.north, g.latlonbox.south = rg.north, rg.south
            g.latlonbox.east, g.latlonbox.west = rg.east, rg.west
            end = tt[frames[n + 1]] if n + 1 < len(frames) else tt[k] + dt.timedelta(hours=1)
            g.timespan.begin, g.timespan.end = iso(tt[k]), iso(end)
        fig, ax = plt.subplots(figsize=(4, 0.6), dpi=150)
        fig.colorbar(plt.cm.ScalarMappable(cmap=cmap, norm=matplotlib.colors.Normalize(0, 6)), cax=ax,
                     orientation="horizontal", label="log10 ground heat flux (W/m²)")
        fig.savefig(os.path.join(a.out, "colorbar.png"), bbox_inches="tight", transparent=True)
        plt.close(fig)
        sc = kz.newscreenoverlay(name="Colour bar")
        sc.icon.href = kz.addfile(os.path.join(a.out, "colorbar.png"))
        sc.overlayxy = simplekml.OverlayXY(x=0, y=0, xunits=simplekml.Units.fraction, yunits=simplekml.Units.fraction)
        sc.screenxy = simplekml.ScreenXY(x=0.02, y=0.05, xunits=simplekml.Units.fraction, yunits=simplekml.Units.fraction)
        kz.savekmz(os.path.join(a.out, "fire_heat.kmz"))
        for n in range(len(frames)):
            os.remove(os.path.join(a.out, f"heat_{n:03d}.png"))
        print("heat overlays:", len(frames))

    # ---------------------------------------------------------------- textures for 3-D tools
    k = len(tt) - 1
    lfn = field(ds, "LFN", k, box)
    tig = field(ds, "TIGN_G", k, box)
    arr = np.where(lfn <= 0, tig, np.nan)                      # seconds since simulation start
    arr = rg(arr)
    tmax = float(np.nanmax(arr)) if np.isfinite(arr).any() else 1.0
    a16 = np.where(np.isfinite(arr), 1 + np.round(arr / tmax * 65534), 0).astype(np.uint16)
    save_png16(os.path.join(a.out, "arrival_time.png"), a16)
    meta = dict(bbox=bbox, width=int(a16.shape[1]), height=int(a16.shape[0]), pixel_m=a.res,
                simulation_start=iso(t0), arrival_seconds_per_count=tmax / 65534,
                arrival_note="pixel = 1 + arrival_s / arrival_seconds_per_count; 0 = never burns")
    if "ZSF" in ds.variables:
        zsf = rg(field(ds, "ZSF", 0, box))
        zmin, zmax = float(np.nanmin(zsf)), float(np.nanmax(zsf))
        z16 = np.round((np.nan_to_num(zsf, nan=zmin) - zmin) / max(zmax - zmin, 1e-6) * 65535).astype(np.uint16)
        save_png16(os.path.join(a.out, "terrain.png"), z16)
        meta.update(terrain_min_m=zmin, terrain_max_m=zmax)
    with open(os.path.join(a.out, "textures.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print("textures:", a16.shape, f"arrival up to {tmax / 3600:.2f} h")


def cell_area_m2(lon, lat):
    dy = np.nanmedian(np.abs(np.diff(lat, axis=0))) * 111_320.0
    dx = np.nanmedian(np.abs(np.diff(lon, axis=1))) * 111_320.0 * np.cos(np.radians(np.nanmean(lat)))
    return dx * dy


def save_png16(path, a):
    """16-bit greyscale PNG without extra dependencies (Pillow's I;16 also works)."""
    import struct
    import zlib
    h, w = a.shape
    raw = b"".join(b"\x00" + a[r].astype(">u2").tobytes() for r in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 16, 0, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    main()
