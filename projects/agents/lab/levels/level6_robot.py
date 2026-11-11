"""Level 6: a blind robot (one forward distance sensor) must explore a room.
Your program gets {'distance': cm, 'last': result of your previous action} and returns
('drive', cm), ('turn', degrees) or ('stop',). The same body and limits as robot_agent.py."""
from robot_agent import SimRobot, Body
from lab_common import load_agent, report, safe_act

ACTIONS, TARGET, CELL = 60, 45, 20


def covered(path):
    cells = set()
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        for k in range(21):
            x, y = x0 + (x1 - x0) * k / 20, y0 + (y1 - y0) * k / 20
            cells.add((int(x // CELL), int(y // CELL)))
    return cells


robot, body, agent = SimRobot(), None, load_agent()
body = Body(robot)
path, frames, last, refused = [(robot.x, robot.y)], [], "start", 0
for i in range(ACTIONS):
    percept = {"distance": robot.distance(), "last": last}
    act, err = safe_act(agent.program, percept)
    if err:
        report(ok=False, error=err)
        raise SystemExit
    if not isinstance(act, (tuple, list)) or not act or act[0] not in ("drive", "turn", "stop"):
        report(ok=False, error=f"program returned {act!r}; expected ('drive', cm), ('turn', degrees) or ('stop',)")
        raise SystemExit
    if act[0] == "stop":
        frames.append([robot.x, robot.y, robot.heading, "stop", percept["distance"]])
        break
    arg = {"cm": act[1]} if act[0] == "drive" else {"degrees": act[1]}
    last, is_err = body.call(act[0], arg)
    refused += is_err
    path.append((robot.x, robot.y))
    frames.append([robot.x, robot.y, robot.heading, f"{act[0]}({act[1]})", percept["distance"], last])
total_cells = (200 // CELL) ** 2 - 4                      # the box covers 4 cells
pct = round(100 * len(covered(path)) / total_cells)
report(ok=pct >= TARGET, score=pct, target=TARGET, frames=frames,
       rows=[{"start": "room 2 x 2 m", "score": f"{pct}% covered", "note": f"{refused} refused actions"}],
       summary=f"covered {pct}% of the floor in {len(frames)} actions (target {TARGET}%), {refused} refused")
