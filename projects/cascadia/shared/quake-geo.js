/*
 * Where and how big simulated earthquakes are. Requires window.PNW_MAP (shared/data/pnw-map.js).
 *
 * Locations (each source stays in its own region):
 *   - Deep (intraslab), Puget Sound: resampled from real ComCat quakes 35–70 km beneath Puget Sound, with ~3 km jitter.
 *   - Puget Sound crustal: a random point along the mapped Puget Sound faults (USGS Quaternary fault database),
 *     weighted by fault length. Seattle Fault events fall on the Seattle Fault Zone; the rest on the other faults.
 *   - Portland / N. Willamette Valley crustal: a random point along the Portland-area faults.
 *   - Cascadia M9: epicenter somewhere in the megathrust rupture zone; the rupture fills the whole zone.
 *
 * Magnitudes: the report gives only thresholds (M ≥ 6.5, M ~9), so sizes are drawn from a Gutenberg–Richter
 * distribution with the report's western-U.S. b-value (0.8), truncated at a plausible maximum for each source.
 * The maximums are illustrative assumptions noted below, not values from the report.
 */
(function () {
  'use strict';
  var G = window.PNW_MAP;
  var B_VALUE = 0.8;

  var MAG_MODEL = {
    'deep-puget':       { min: 6.5, max: 7.5, depth: null,     note: 'Historic events M6.5–6.8; report notes intraslab quakes reach ~M8 worldwide' },
    'crustal-puget':    { min: 6.5, max: 7.8, depth: [5, 25],  note: 'Report cites the 923–924 C.E. M7.5–7.8 Seattle Fault event' },
    'crustal-seattle':  { min: 6.5, max: 7.8, depth: [5, 25],  note: 'Report cites the 923–924 C.E. M7.5–7.8 Seattle Fault event' },
    'crustal-portland': { min: 6.5, max: 7.2, depth: [5, 25],  note: 'Assumed maximum for Portland-area faults' },
    'mega-full':        { min: 8.7, max: 9.2, depth: [10, 30], note: 'Range estimated for the 1700 Cascadia earthquake' },
  };

  // ---------------------------------------------------------------- geometry helpers
  var KM_PER_DEG = 111.32;
  function distKm(lon1, lat1, lon2, lat2) {
    var mlat = ((lat1 + lat2) / 2) * Math.PI / 180;
    var dx = (lon2 - lon1) * Math.cos(mlat) * KM_PER_DEG, dy = (lat2 - lat1) * KM_PER_DEG;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Length-weighted sampler over a set of polylines ({ name, coords: [[lon, lat], ...] }). */
  function lineSampler(lines) {
    var segs = [], total = 0;
    lines.forEach(function (l) {
      for (var i = 1; i < l.coords.length; i++) {
        var a = l.coords[i - 1], b = l.coords[i], len = distKm(a[0], a[1], b[0], b[1]);
        if (len <= 0) continue;
        total += len;
        segs.push({ a: a, b: b, cum: total, name: l.name });
      }
    });
    return function (r) {
      var target = r() * total, lo = 0, hi = segs.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (segs[mid].cum < target) lo = mid + 1; else hi = mid; }
      var s = segs[lo], t = r();
      return { lon: s.a[0] + (s.b[0] - s.a[0]) * t, lat: s.a[1] + (s.b[1] - s.a[1]) * t, fault: s.name };
    };
  }

  function interpLon(line, lat) {               // line sorted by latitude (either direction)
    var pts = line.slice().sort(function (p, q) { return p[1] - q[1]; });
    if (lat <= pts[0][1]) return pts[0][0];
    for (var i = 1; i < pts.length; i++) {
      if (lat <= pts[i][1]) {
        var t = (lat - pts[i - 1][1]) / (pts[i][1] - pts[i - 1][1]);
        return pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
      }
    }
    return pts[pts.length - 1][0];
  }

  var R = G.regions;
  var sampleSeattle = lineSampler(R.seattle);
  var samplePuget = lineSampler(R.pugetOther);
  var samplePortland = lineSampler(R.portland);
  var trench = R.megathrust.trench;
  var downdip = R.megathrust.zone.slice(trench.length, R.megathrust.zone.length - 1);
  var LAT_SPAN = [trench[0][1] + 0.3, 49.6];

  function sampleDeep(r) {
    var p = R.deep[Math.floor(r() * R.deep.length)];
    var jitter = 0.03;                         // ≈ 3 km
    return {
      lon: p[0] + (r() - 0.5) * 2 * jitter / Math.cos(p[1] * Math.PI / 180),
      lat: p[1] + (r() - 0.5) * 2 * jitter,
      depth: Math.max(35, Math.min(70, p[2] + (r() - 0.5) * 6)),
    };
  }

  function sampleMegathrust(r) {
    var lat = LAT_SPAN[0] + r() * (LAT_SPAN[1] - LAT_SPAN[0]);
    var w = interpLon(trench, lat), e = interpLon(downdip, lat);
    return { lon: w + (e - w) * (0.25 + 0.5 * r()), lat: lat };
  }

  /** Truncated Gutenberg–Richter magnitude: P(M > m) ∝ 10^(−b (m − min)), capped at max. */
  function grMagnitude(r, min, max) {
    var c = 1 - Math.pow(10, -B_VALUE * (max - min));
    return min - Math.log10(1 - r() * c) / B_VALUE;
  }

  // ---------------------------------------------------------------- descriptions
  var BEARINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  /** "18 km SW of Tacoma". maxRank 3 includes small coastal towns (useful offshore). */
  function describe(lon, lat, maxRank) {
    var best = null, bd = Infinity;
    G.cities.forEach(function (c) {
      if (c.rank > (maxRank || 2)) return;
      var d = distKm(lon, lat, c.lon, c.lat);
      if (d < bd) { bd = d; best = c; }
    });
    if (bd < 8) return 'beneath ' + best.name;
    var ang = Math.atan2(lat - best.lat, (lon - best.lon) * Math.cos(lat * Math.PI / 180)) * 180 / Math.PI;
    var idx = Math.round(((90 - ang + 360) % 360) / 45) % 8;
    return Math.round(bd) + ' km ' + BEARINGS[idx] + ' of ' + best.name;
  }

  window.QuakeGeo = {
    MAG_MODEL: MAG_MODEL,
    B_VALUE: B_VALUE,
    distKm: distKm,
    describe: describe,

    /** Fill in location, depth and magnitude for a simulated event { src, seattle } using rng r. */
    place: function (e, r) {
      var m = MAG_MODEL[e.seattle ? 'crustal-seattle' : e.src], loc;
      if (e.src === 'deep-puget') loc = sampleDeep(r);
      else if (e.src === 'mega-full') loc = sampleMegathrust(r);
      else if (e.src === 'crustal-portland') loc = samplePortland(r);
      else loc = e.seattle ? sampleSeattle(r) : samplePuget(r);
      e.lon = loc.lon;
      e.lat = loc.lat;
      e.fault = loc.fault || null;
      e.depth = loc.depth != null ? loc.depth : m.depth[0] + r() * (m.depth[1] - m.depth[0]);
      e.mag = e.src === 'mega-full' ? m.min + r() * (m.max - m.min) : grMagnitude(r, m.min, m.max);
      return e;
    },
  };
})();
