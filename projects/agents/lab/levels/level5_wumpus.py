"""Level 5: the wumpus world (AIMA Ch. 7). Find the gold without dying.
Actions: 'N', 'E', 'S', 'W' (move), 'Grab', 'Climb' (only in [1,1]). Score: +1000 for climbing out
with the gold, -1000 for dying, -1 per action."""
import random
from lab_common import load_agent, report, safe_act

N, LIMIT, TARGET = 4, 60, 300
D = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}


def world(seed):
    r = random.Random(seed)
    cells = [(x, y) for x in range(1, 5) for y in range(1, 5) if (x, y) != (1, 1)]
    pits = {c for c in cells if r.random() < 0.2}
    wumpus = r.choice(cells)
    gold = r.choice([c for c in cells if c not in pits] or cells)
    return pits, wumpus, gold


def run(seed, record):
    pits, wumpus, gold = world(seed)
    agent, pos, has_gold, score, frames = load_agent(), (1, 1), False, 0, []
    adj = lambda c, t: abs(c[0] - t[0]) + abs(c[1] - t[1]) == 1
    for _ in range(LIMIT):
        percept = {"pos": pos, "breeze": any(adj(pos, p) for p in pits), "stench": adj(pos, wumpus),
                   "glitter": pos == gold and not has_gold, "has_gold": has_gold}
        act, err = safe_act(agent.program, percept)
        if err:
            return None, frames, err, (pits, wumpus, gold)
        score -= 1
        note = ""
        if act in D:
            nxt = (pos[0] + D[act][0], pos[1] + D[act][1])
            if 1 <= nxt[0] <= N and 1 <= nxt[1] <= N:
                pos = nxt
            if pos in pits or pos == wumpus:
                score -= 1000
                note = "died"
        elif act == "Grab":
            if pos == gold and not has_gold:
                has_gold = True
        elif act == "Climb":
            if pos == (1, 1):
                if has_gold:
                    score += 1000
                note = "climbed out"
        else:
            return None, frames, f"program returned {act!r}", (pits, wumpus, gold)
        frames.append([pos[0], pos[1], act, has_gold])
        if note:
            return (score, note), frames, None, (pits, wumpus, gold)
    return (score, "out of time"), frames, None, (pits, wumpus, gold)


rows, total, shown = [], 0, None
for seed in range(1, 31):
    res, frames, err, w = run(seed, seed == 1)
    if err:
        report(ok=False, error=err, rows=rows)
        raise SystemExit
    total += res[0]
    rows.append({"start": f"cave #{seed}", "score": res[0], "note": res[1]})
    if seed == 1:
        shown = {"steps": frames, "pits": [list(p) for p in w[0]], "wumpus": list(w[1]), "gold": list(w[2])}
avg = total / 30
report(ok=avg >= TARGET, score=round(avg, 1), target=TARGET, rows=rows, frames=shown,
       summary=f"average score {avg:.1f} over 30 caves (target {TARGET})")
