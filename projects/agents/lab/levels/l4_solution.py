# A utility-based agent: map the apartment, search for unexplored squares, and never start
# a trip it cannot return from (lesson 02, UtilityAgent, rewritten as a plain function).
from collections import deque

D = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}
pos, free, visited = (0, 0), {(0, 0)}, {(0, 0)}          # the dock is (0, 0) in our own coordinates

def bfs(start, goal):
    q, parent = deque([start]), {start: None}
    while q:
        c = q.popleft()
        if goal(c):
            path = []
            while parent[c]:
                c, d = parent[c]
                path.append(d)
            return path[::-1]
        for d, (dx, dy) in D.items():
            n = (c[0] + dx, c[1] + dy)
            if n in free and n not in parent:
                parent[n] = (c, d)
                q.append(n)
    return None

def go(d):
    global pos
    pos = (pos[0] + D[d][0], pos[1] + D[d][1])
    return d

def program(p):
    visited.add(pos)
    for d, (dx, dy) in D.items():
        if not p["walls"][d]:
            free.add((pos[0] + dx, pos[1] + dy))
    home = bfs(pos, lambda c: c == (0, 0))
    unexplored = bfs(pos, lambda c: c not in visited)
    if p["dock"] and p["battery"] < 100 and unexplored is not None:
        return "Dock"
    if p["dirty"] and p["battery"] - 1 > len(home):
        return "Suck"
    if unexplored:
        t = pos
        for d in unexplored:
            t = (t[0] + D[d][0], t[1] + D[d][1])
        back = bfs(t, lambda c: c == (0, 0)) or []
        if len(unexplored) + len(back) + 1 < p["battery"]:
            return go(unexplored[0])
    if home:
        return go(home[0])
    return "NoOp"
