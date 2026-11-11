"""Level 1 and 2: the two-square vacuum world (AIMA Fig. 2.2)."""
import sys
from lab_common import load_agent, report, safe_act

MOVE_COST = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
TARGET = float(sys.argv[2]) if len(sys.argv) > 2 else 19.0
STEPS = 10


def episode(a, b, loc, record):
    agent = load_agent()
    world, score, frames = {"A": a, "B": b}, 0.0, []
    for t in range(STEPS):
        percept = (loc, world[loc])
        act, err = safe_act(agent.program, percept)
        if err:
            return None, frames, err
        if act == "Suck":
            world[loc] = "Clean"
        elif act in ("Left", "Right"):
            loc = "A" if act == "Left" else "B"
            score -= MOVE_COST
        elif act != "NoOp":
            return None, frames, f"program returned {act!r}; expected 'Left', 'Right', 'Suck' or 'NoOp'"
        score += sum(1 for s in world.values() if s == "Clean")
        if record:
            frames.append({"A": world["A"], "B": world["B"], "loc": loc, "percept": list(percept), "act": act, "score": score})
    return score, frames, None


rows, total, shown = [], 0.0, []
for a in ("Clean", "Dirty"):
    for b in ("Clean", "Dirty"):
        for loc in ("A", "B"):
            sc, fr, err = episode(a, b, loc, record=(a == b == "Dirty" and loc == "A"))
            if err:
                report(ok=False, error=err, rows=rows)
                raise SystemExit
            rows.append({"start": f"A={a}, B={b}, at {loc}", "score": sc})
            total += sc
            if fr:
                shown = fr
avg = total / 8
report(ok=avg >= TARGET, score=round(avg, 2), target=TARGET, rows=rows, frames=shown,
       summary=f"average score over the 8 start states: {avg:.2f} (target {TARGET})")
