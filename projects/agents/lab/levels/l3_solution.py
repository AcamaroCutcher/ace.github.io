# Depth-first exploration with memory (lesson 03), trying directions toward the goal first.
MOVES = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}
BACK = {"N": "S", "S": "N", "E": "W", "W": "E"}
visited, trail = set(), []          # trail = the moves that led here, so we can backtrack

def program(percept):
    x, y = percept["pos"]
    gx, gy = percept["goal"]
    visited.add((x, y))
    options = sorted(MOVES, key=lambda d: abs(x + MOVES[d][0] - gx) + abs(y + MOVES[d][1] - gy))
    for d in options:
        nxt = (x + MOVES[d][0], y + MOVES[d][1])
        if not percept["walls"][d] and nxt not in visited:
            trail.append(d)
            return d
    return BACK[trail.pop()]        # dead end: go back the way we came
