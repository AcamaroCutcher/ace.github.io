# A knowledge-based agent (lesson 04): TELL percepts, ASK which rooms are provably safe
# (model checking), explore safe rooms, grab the gold, and walk home through known rooms.
import itertools
from collections import deque

seen = {}                      # room -> (breeze, stench)
D = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}

def nbrs(c):
    return [(c[0] + dx, c[1] + dy) for dx, dy in D.values() if 1 <= c[0] + dx <= 4 and 1 <= c[1] + dy <= 4]

def safe_rooms():
    unknown = [(x, y) for x in range(1, 5) for y in range(1, 5) if (x, y) not in seen]
    frontier = sorted({n for v in seen for n in nbrs(v) if n not in seen})
    pit_possible = set()
    for bits in itertools.product((0, 1), repeat=len(frontier)):        # every pit placement
        pits = {c for c, b in zip(frontier, bits) if b}
        if all(any(n in pits for n in nbrs(v)) == b for v, (b, s) in seen.items()):
            pit_possible |= pits
    wumpus_possible = {c for c in unknown if all((c in nbrs(v)) == s for v, (b, s) in seen.items())}
    return [c for c in frontier if c not in pit_possible and c not in wumpus_possible]

def step_toward(start, goal):
    allowed = set(seen) | {goal}
    q, parent = deque([start]), {start: None}
    while q:
        c = q.popleft()
        if c == goal:
            while parent[c] != start:
                c = parent[c]
            return next(d for d, (dx, dy) in D.items() if (start[0] + dx, start[1] + dy) == c)
        for n in nbrs(c):
            if n in allowed and n not in parent:
                parent[n] = c
                q.append(n)
    return None

def program(p):
    pos = tuple(p["pos"])
    seen[pos] = (p["breeze"], p["stench"])
    if p["glitter"]:
        return "Grab"
    if p["has_gold"] or not safe_rooms():
        return "Climb" if pos == (1, 1) else step_toward(pos, (1, 1))
    target = min(safe_rooms(), key=lambda c: abs(c[0] - pos[0]) + abs(c[1] - pos[1]))
    return step_toward(pos, target)
