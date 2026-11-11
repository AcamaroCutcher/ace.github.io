"""Level 3: escape a maze you cannot see. Percept: your position, the goal, and walls around you."""
import random
from lab_common import load_agent, report, safe_act

N, LIMIT = 7, 250
DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}


def make_maze(seed):
    """Recursive backtracker on an N x N grid of cells. Returns the set of open passages."""
    rng, open_, seen, stack = random.Random(seed), set(), {(0, 0)}, [(0, 0)]
    while stack:
        x, y = stack[-1]
        nbrs = [(x + dx, y + dy) for dx, dy in DIRS.values() if 0 <= x + dx < N and 0 <= y + dy < N and (x + dx, y + dy) not in seen]
        if not nbrs:
            stack.pop()
            continue
        n = rng.choice(nbrs)
        open_.add(frozenset([(x, y), n]))
        seen.add(n)
        stack.append(n)
    return open_


def run(seed, record):
    passages, pos, goal = make_maze(seed), (0, 0), (N - 1, N - 1)
    agent, frames = load_agent(), [pos]
    for step in range(LIMIT):
        walls = {d: frozenset([pos, (pos[0] + dx, pos[1] + dy)]) not in passages for d, (dx, dy) in DIRS.items()}
        percept = {"pos": pos, "goal": goal, "walls": walls}
        act, err = safe_act(agent.program, percept)
        if err:
            return None, frames, passages, err
        if act not in DIRS:
            return None, frames, passages, f"program returned {act!r}; expected 'N', 'E', 'S' or 'W'"
        if not walls[act]:
            pos = (pos[0] + DIRS[act][0], pos[1] + DIRS[act][1])
        frames.append(pos)
        if pos == goal:
            return step + 1, frames, passages, None
    return None, frames, passages, None


rows, shown, maze = [], None, None
for seed in range(1, 6):
    steps, frames, passages, err = run(seed, seed == 1)
    if err:
        report(ok=False, error=err, rows=rows)
        raise SystemExit
    rows.append({"start": f"maze #{seed}", "score": steps if steps else f"not out after {LIMIT} moves"})
    if seed == 1:
        shown = [list(p) for p in frames]
        maze = [[list(c) for c in p] for p in passages]
solved = sum(1 for r in rows if isinstance(r["score"], int))
report(ok=solved == 5, score=solved, target=5, rows=rows, frames=shown, maze=maze, n=N,
       summary=f"escaped {solved} of 5 mazes within {LIMIT} moves")
