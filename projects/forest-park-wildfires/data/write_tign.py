#!/usr/bin/env python3
"""Write a fire-arrival-time field (TIGN_G) into a WRF-SFIRE wrfinput file.

Two uses, both for the SFIRE code path (ifire = 1):

  1) Many ignition points (more than the 5 ignition lines the namelist allows):
       python write_tign.py points wrfinput_d03 ignitions.csv --sr 5
     ignitions.csv columns: lat,lon,time_s,radius_m   (time_s = seconds after the run starts)
     then in namelist.input &fire:  fire_num_ignitions = 0,  fire_tign_in_time = <printed value>

  2) Ignition from an observed perimeter (spin-up / "replay"):
       python write_tign.py perimeter wrfinput_d03 perimeter.geojson \
              --ign 45.5336,-122.7138 --t-ign 0 --t-perim 3600 --sr 5
     then in namelist.input &fire:  fire_num_ignitions = 0,  fire_perimeter_time = 3600

The fire mesh coordinates are taken from FXLONG/FXLAT in the file when they are set; otherwise
they are interpolated from the atmospheric XLONG/XLAT with the refinement ratio --sr (sr_x = sr_y).
The file is modified in place: keep a copy (cp wrfinput_d03 wrfinput_d03.orig).

Requires: numpy, netCDF4, scipy (and nothing else; GeoJSON or a simple KML polygon is read here).
"""
import argparse
import csv
import json
import re
import sys

import numpy as np
from netCDF4 import Dataset
from scipy.ndimage import distance_transform_edt

NEVER = 1.0e7            # seconds; any time far beyond the end of the run


def fire_mesh(ds, sr):
    """(lon, lat) of fire-cell centres, shape (ny_f, nx_f) without the padding, and (ny_f, nx_f)."""
    lon = np.asarray(ds.variables["FXLONG"][0], dtype="float64") if "FXLONG" in ds.variables else None
    if lon is not None and np.abs(lon).max() > 0:
        lat = np.asarray(ds.variables["FXLAT"][0], dtype="float64")
        ok = (lon != 0) | (lat != 0)
        ny = int(np.where(ok.any(axis=1))[0][-1] + 1)
        nx = int(np.where(ok.any(axis=0))[0][-1] + 1)
        return lon[:ny, :nx], lat[:ny, :nx]
    if not sr:
        sys.exit("FXLONG/FXLAT are not set in this file: pass the refinement ratio with --sr")
    X = np.asarray(ds.variables["XLONG"][0], dtype="float64")
    Y = np.asarray(ds.variables["XLAT"][0], dtype="float64")
    ny, nx = X.shape
    fi = (np.arange(nx * sr) + 0.5) / sr - 0.5          # fire-cell centres in atmospheric index units
    fj = (np.arange(ny * sr) + 0.5) / sr - 0.5
    from scipy.interpolate import RegularGridInterpolator
    pts = np.stack(np.meshgrid(fj, fi, indexing="ij"), axis=-1)
    kw = dict(method="linear", bounds_error=False, fill_value=None)
    lon = RegularGridInterpolator((np.arange(ny), np.arange(nx)), X, **kw)(pts)
    lat = RegularGridInterpolator((np.arange(ny), np.arange(nx)), Y, **kw)(pts)
    return lon, lat


def local_xy(lon, lat, lon0, lat0):
    """Metres east/north of (lon0, lat0); fine over a fire domain of tens of km."""
    k = 111_320.0
    return (lon - lon0) * k * np.cos(np.radians(lat0)), (lat - lat0) * k


def write(ds, tign):
    var = ds.variables["TIGN_G"]
    full = np.full(var.shape[1:], NEVER, dtype="float32")
    full[: tign.shape[0], : tign.shape[1]] = tign
    var[0] = full


def read_polygon(path):
    txt = open(path).read()
    if path.lower().endswith((".json", ".geojson")):
        g = json.loads(txt)
        geom = g["features"][0]["geometry"] if g.get("type") == "FeatureCollection" else g.get("geometry", g)
        ring = geom["coordinates"][0] if geom["type"] == "Polygon" else max(
            (p[0] for p in geom["coordinates"]), key=len)
        return np.array(ring, dtype="float64")[:, :2]
    m = re.search(r"<coordinates>(.*?)</coordinates>", txt, re.S)     # first ring of a KML polygon
    if not m:
        sys.exit("no <coordinates> found in " + path)
    return np.array([[float(v) for v in c.split(",")[:2]] for c in m.group(1).split()])


def inside_polygon(x, y, ring):
    from matplotlib.path import Path
    return Path(ring).contains_points(np.c_[x.ravel(), y.ravel()]).reshape(x.shape)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["points", "perimeter"])
    ap.add_argument("wrfinput")
    ap.add_argument("source", help="ignitions.csv (points) or perimeter .geojson/.kml (perimeter)")
    ap.add_argument("--sr", type=int, default=0, help="fire mesh refinement ratio sr_x (= sr_y)")
    ap.add_argument("--ign", help="perimeter mode: ignition point lat,lon")
    ap.add_argument("--t-ign", type=float, default=0.0, help="perimeter mode: ignition time, s after start")
    ap.add_argument("--t-perim", type=float, help="perimeter mode: time of the perimeter, s after start")
    ap.add_argument("--s-ext", type=float, default=0.3,
                    help="perimeter mode: speed (m/s) used to extend T outside the perimeter so lfn stays distance-like")
    a = ap.parse_args()

    ds = Dataset(a.wrfinput, "r+")
    lon, lat = fire_mesh(ds, a.sr)
    lon0, lat0 = float(lon.mean()), float(lat.mean())
    x, y = local_xy(lon, lat, lon0, lat0)
    dx = float(np.median(np.abs(np.diff(x, axis=1))))
    dy = float(np.median(np.abs(np.diff(y, axis=0))))
    print(f"fire mesh {lon.shape[1]} x {lon.shape[0]} cells, about {dx:.1f} x {dy:.1f} m")

    if a.mode == "points":
        tign = np.full(lon.shape, NEVER)
        rows = list(csv.DictReader(open(a.source)))
        for r in rows:
            px, py = local_xy(float(r["lon"]), float(r["lat"]), lon0, lat0)
            d = np.hypot(x - px, y - py)
            rad = max(float(r.get("radius_m") or 0), 1.5 * max(dx, dy))   # at least one fire cell
            tign = np.where(d <= rad, np.minimum(tign, float(r["time_s"])), tign)
            if not (d <= rad).any():
                print("warning: ignition outside the fire domain:", r)
        last = max(float(r["time_s"]) for r in rows)
        write(ds, tign)
        print(f"{len(rows)} ignitions written, {int((tign < NEVER).sum())} fire cells")
        print("namelist.input &fire:\n  fire_num_ignitions = 0,\n"
              f"  fire_tign_in_time  = {last + 60:.0f},   ! > last ignition time; ignition from TIGN_G until then")
    else:
        if a.ign is None or a.t_perim is None:
            sys.exit("perimeter mode needs --ign lat,lon and --t-perim")
        ring = read_polygon(a.source)
        rx, ry = local_xy(ring[:, 0], ring[:, 1], lon0, lat0)
        inside = inside_polygon(x, y, np.c_[rx, ry])
        # distance to the perimeter, inside and outside, on the fire mesh
        d_out = distance_transform_edt(~inside, sampling=(dy, dx))
        ilat, ilon = (float(v) for v in a.ign.split(","))
        ix, iy = local_xy(ilon, ilat, lon0, lat0)
        j, i = np.unravel_index(np.argmin(np.hypot(x - ix, y - iy)), x.shape)
        if not inside[j, i]:
            sys.exit("the ignition point is not inside the perimeter")
        # fraction of the way along the ray from the ignition: r / R, with R the distance from the
        # ignition to the first perimeter crossing beyond the cell (isochrones = scaled perimeters)
        ix0, iy0 = x[j, i], y[j, i]
        ux, uy = x[inside] - ix0, y[inside] - iy0
        r = np.hypot(ux, uy)
        ux, uy = ux / np.maximum(r, 1e-9), uy / np.maximum(r, 1e-9)
        R = np.full(r.shape, np.inf)
        for (ax_, ay_), (bx_, by_) in zip(np.c_[rx, ry], np.roll(np.c_[rx, ry], -1, axis=0)):
            ex, ey, wx, wy = bx_ - ax_, by_ - ay_, ax_ - ix0, ay_ - iy0
            den = ux * ey - uy * ex
            with np.errstate(divide="ignore", invalid="ignore"):
                t = (wx * ey - wy * ex) / den
                s_ = (wx * uy - wy * ux) / den
            hit = (np.abs(den) > 1e-12) & (s_ >= 0) & (s_ <= 1) & (t >= r - 1e-6)
            R = np.where(hit & (t < R), t, R)
        frac = np.ones(x.shape)
        frac[inside] = np.where(np.isfinite(R), np.minimum(1.0, r / R), 1.0)
        tign = np.where(inside, a.t_ign + (a.t_perim - a.t_ign) * frac, a.t_perim + d_out / a.s_ext)
        tign = np.where(np.isfinite(tign), tign, a.t_perim)
        write(ds, tign)
        print(f"perimeter area {inside.sum() * dx * dy / 1e4:.1f} ha, T from {a.t_ign:.0f} to {a.t_perim:.0f} s")
        print("namelist.input &fire:\n  fire_num_ignitions  = 0,\n"
              f"  fire_perimeter_time = {a.t_perim:.0f},   ! replay TIGN_G until then, then spread normally")
    ds.close()


if __name__ == "__main__":
    main()
