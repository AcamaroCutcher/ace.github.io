"""Two-layer grid router (A*, 45-degree moves, vias) used for the carrier board.

route(pads, nets, ...) -> (tracks, vias, failed)
pads: dicts with x, y (mm, board coords, y up), w, h (axis-aligned copper size), shape ('rect'|'circle'),
      th (through-hole), net (name or None).
GND is treated as a plane on the bottom layer: through-hole ground pads connect to it directly and
surface-mount ground pads get a short stub to a via.
"""
import heapq, math


def route(pads, nets, bw, bh, holes, power=(), clr=0.2, sig_w=0.25, pwr_w=0.8, grid=0.25, gnd='GND', keepouts=()):
    G = grid
    NX, NY = int(bw / G) + 1, int(bh / G) + 1
    FREE, HARD = -1, -2
    netid = {n: i for i, n in enumerate(nets)}
    own = [[FREE] * (NX * NY) for _ in range(2)]
    idx = lambda i, j: j * NX + i
    cell = lambda x, y: (int(round(x / G)), int(round(y / G)))

    def stamp_pad(p, layer, nid, extra):
        hw, hh = p['w'] / 2 + extra, p['h'] / 2 + extra
        i0, i1 = int((p['x'] - hw) / G) - 1, int((p['x'] + hw) / G) + 2
        j0, j1 = int((p['y'] - hh) / G) - 1, int((p['y'] + hh) / G) + 2
        for j in range(max(0, j0), min(NY, j1)):
            for i in range(max(0, i0), min(NX, i1)):
                x, y = i * G, j * G
                if p['shape'] == 'circle':
                    inside = math.hypot(x - p['x'], y - p['y']) <= p['w'] / 2 + extra
                else:
                    inside = abs(x - p['x']) <= hw and abs(y - p['y']) <= hh
                if inside:
                    k = idx(i, j)
                    if extra == 0 or own[layer][k] == FREE:
                        own[layer][k] = nid

    edge = 0.5 + sig_w / 2
    for L in (0, 1):
        for j in range(NY):
            for i in range(NX):
                x, y = i * G, j * G
                if x < edge or y < edge or x > bw - edge or y > bh - edge:
                    own[L][idx(i, j)] = HARD
                for hx, hy, r in holes:
                    if math.hypot(x - hx, y - hy) < r:
                        own[L][idx(i, j)] = HARD
                for (x0, y0, x1, y1, layers) in keepouts:
                    if L in layers and x0 <= x <= x1 and y0 <= y <= y1:
                        own[L][idx(i, j)] = HARD
    for p in pads:
        nid = netid[p['net']] if p['net'] in netid else HARD
        for L in ((0, 1) if p['th'] else (p.get('layer', 0),)):
            stamp_pad(p, L, nid, 0)
    for p in pads:
        nid = netid[p['net']] if p['net'] in netid else HARD
        for L in ((0, 1) if p['th'] else (p.get('layer', 0),)):
            stamp_pad(p, L, nid, clr + sig_w / 2 + 0.02)

    def stamp_path(cells, nid, width):
        r = width / 2 + clr + sig_w / 2 + 0.02
        rc = int(math.ceil(r / G))
        for (i, j, L) in cells:
            for dj in range(-rc, rc + 1):
                for di in range(-rc, rc + 1):
                    if math.hypot(di * G, dj * G) >= r:
                        continue
                    ii, jj = i + di, j + dj
                    if 0 <= ii < NX and 0 <= jj < NY:
                        k = idx(ii, jj)
                        if own[L][k] == FREE:
                            own[L][k] = nid
            own[L][idx(i, j)] = nid

    def ok(L, i, j, nid):
        if not (0 <= i < NX and 0 <= j < NY):
            return False
        o = own[L][idx(i, j)]
        return o == FREE or o == nid

    VIA_R = 0.3                                  # 0.6 mm via pad
    via_rc = int(math.ceil((VIA_R + clr + sig_w / 2) / G))

    def via_ok(i, j, nid):
        for L in (0, 1):
            for dj in range(-via_rc, via_rc + 1):
                for di in range(-via_rc, via_rc + 1):
                    if math.hypot(di * G, dj * G) <= VIA_R + clr + sig_w / 2 and not ok(L, i + di, j + dj, nid):
                        return False
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
                if p['shape'] == 'circle':
                    inside = math.hypot(x - p['x'], y - p['y']) <= p['w'] / 2 - 0.05
                else:
                    inside = abs(x - p['x']) <= p['w'] / 2 - 0.05 and abs(y - p['y']) <= p['h'] / 2 - 0.05
                if inside:
                    for L in ((0, 1) if p['th'] else (p.get('layer', 0),)):
                        out.append((i0 + di, j0 + dj, L))
        if not out:
            out = [(i0, j0, L) for L in ((0, 1) if p['th'] else (p.get('layer', 0),))]
        return out

    def astar(sources, goal, heur, nid, width):
        rx = int(math.ceil((width - sig_w) / 2 / G)) + (1 if width > sig_w else 0)

        def passable(L, i, j):
            if not ok(L, i, j, nid):
                return False
            if rx:
                for dj in range(-rx, rx + 1):
                    for di in range(-rx, rx + 1):
                        if not ok(L, i + di, j + dj, nid):
                            return False
            return True
        dist, prev, hq = {}, {}, []
        for s in sources:
            dist[s] = 0
            heapq.heappush(hq, (heur(s), 0, s, None))
        n = 0
        while hq:
            f, g, s, d = heapq.heappop(hq)
            if g > dist.get(s, 1e18):
                continue
            n += 1
            if n > 600000:
                return None
            if goal(s):
                path = [s]
                while path[-1] in prev:
                    path.append(prev[path[-1]])
                return path[::-1]
            i, j, L = s
            for k, (di, dj, c) in enumerate(DIRS):
                t = (i + di, j + dj, L)
                if not passable(L, t[0], t[1]):
                    continue
                if di and dj and not (ok(L, i + di, j, nid) and ok(L, i, j + dj, nid)):
                    continue
                ng = g + c * (BOT_MULT if L else 1) + (TURN if d is not None and d != k else 0)
                if ng < dist.get(t, 1e18):
                    dist[t] = ng; prev[t] = s
                    heapq.heappush(hq, (ng + heur(t), ng, t, k))
            t = (i, j, 1 - L)
            if via_ok(i, j, nid):
                ng = g + VIA_COST
                if ng < dist.get(t, 1e18):
                    dist[t] = ng; prev[t] = s
                    heapq.heappush(hq, (ng + heur(t), ng, t, None))
        return None

    tracks, vias, failed = [], [], []

    def emit(path, net, width):
        segs, cur = [], [path[0]]
        for a in path[1:]:
            if a[2] != cur[-1][2]:
                segs.append(cur)
                vias.append(dict(x=round(a[0] * G, 3), y=round(a[1] * G, 3), net=net))
                for LL in (0, 1):
                    stamp_path([(a[0], a[1], LL)], netid[net], 2 * VIA_R)
                cur = [a]
            else:
                cur.append(a)
        segs.append(cur)
        for s in segs:
            if len(s) < 2:
                continue
            pts = [s[0]]
            for k in range(1, len(s) - 1):
                a, b, c = pts[-1], s[k], s[k + 1]
                if (b[0] - a[0]) * (c[1] - b[1]) != (b[1] - a[1]) * (c[0] - b[0]):
                    pts.append(b)
            pts.append(s[-1])
            tracks.append(dict(net=net, layer='top' if s[0][2] == 0 else 'bottom', w=width,
                               pts=[[round(p[0] * G, 3), round(p[1] * G, 3)] for p in pts]))

    padsby = {}
    for p in pads:
        if p['net']:
            padsby.setdefault(p['net'], []).append(p)

    # ground first: surface-mount ground pads drop through a via to the bottom plane
    if gnd in netid:
        gid = netid[gnd]
        for p in padsby.get(gnd, []):
            if p['th'] or p.get('layer', 0) == 1:
                continue
            src = pad_cells(p)
            reach = max(p['w'], p['h']) / 2 + VIA_R + 0.15

            def goal(s, p=p):
                return s[2] == 0 and math.hypot(s[0] * G - p['x'], s[1] * G - p['y']) > reach and via_ok(s[0], s[1], gid)
            path = astar(src, goal, lambda s: 0, gid, sig_w)
            if not path:
                failed.append('GND via ' + p['id']); continue
            stamp_path(path, gid, sig_w); emit(path, gnd, sig_w)
            e = path[-1]
            vias.append(dict(x=round(e[0] * G, 3), y=round(e[1] * G, 3), net=gnd))
            for L in (0, 1):
                stamp_path([(e[0], e[1], L)], gid, 2 * VIA_R)

    order = sorted([n for n in nets if n != gnd and len(padsby.get(n, [])) > 1], key=lambda n: (n not in power, len(padsby[n])))
    for net in order:
        nid = netid[net]
        width = pwr_w if net in power else sig_w
        members = sorted(padsby[net], key=lambda p: (p['x'], p['y']))
        tree = set(pad_cells(members[0]))
        rest = members[1:]
        while rest:
            tl = list(tree)
            rest.sort(key=lambda p: min(math.hypot(p['x'] - c[0] * G, p['y'] - c[1] * G) for c in tl[::5] or tl))
            p = rest.pop(0)
            tgt = set(pad_cells(p)); tx, ty = p['x'] / G, p['y'] / G
            h = lambda s: math.hypot(s[0] - tx, s[1] - ty) * 0.999
            w_used = width
            path = astar(tl, lambda s: s in tgt, h, nid, width)
            if not path and width > sig_w:
                w_used = max(sig_w, 0.4)
                path = astar(tl, lambda s: s in tgt, h, nid, w_used)
            if not path and w_used > sig_w:
                w_used = sig_w
                path = astar(tl, lambda s: s in tgt, h, nid, w_used)
            if not path:
                failed.append(f"{net}->{p['id']}"); continue
            stamp_path(path, nid, w_used); emit(path, net, w_used)
            tree |= set(path) | tgt
    return tracks, vias, failed
