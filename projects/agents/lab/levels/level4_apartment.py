"""Level 4: clean an apartment on one battery charge (the world of agent_zoo.py, lesson 02)."""
from agent_zoo import World, STEPS, MAP
from lab_common import load_agent, report, safe_act

TARGET = 150.0
rows, total, deaths, shown = [], 0.0, 0, None
for seed in range(1, 11):
    w, agent = World(seed), load_agent()
    dirt0 = sorted(w.dirt)
    frames = []
    for _ in range(STEPS):
        if w.dead:
            break
        act, err = safe_act(agent.program, w.percept())
        if err:
            report(ok=False, error=err, rows=rows)
            raise SystemExit
        if act not in ("N", "E", "S", "W", "Suck", "Dock", "NoOp"):
            report(ok=False, error=f"program returned {act!r}", rows=rows)
            raise SystemExit
        w.execute(act)
        if seed == 1:
            frames.append([w.pos[0], w.pos[1], w.battery, w.score, act])
    total += w.score
    deaths += w.dead
    rows.append({"start": f"apartment #{seed}", "score": w.score, "note": "battery died" if w.dead else f"{w.cleaned}/{w.total_dirt} cleaned"})
    if seed == 1:
        shown = {"map": MAP, "dirt": [list(d) for d in dirt0], "steps": frames}
avg = total / 10
report(ok=avg >= TARGET, score=round(avg, 1), target=TARGET, rows=rows, frames=shown,
       summary=f"average score {avg:.1f} over 10 apartments (target {TARGET}), {deaths} battery deaths")
