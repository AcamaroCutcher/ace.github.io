"""
agent_zoo.py - the five kinds of agent program from AIMA Section 2.4, in one grid world.

A robot vacuum lives in a small apartment. It is PARTIALLY OBSERVABLE: the robot only senses
whether its own square is dirty, which of its four neighbors are walls, whether it is on the
charging dock, and its battery level. Each move or suck costs 1 battery. Running out of
battery away from the dock ends the run with a -50 penalty. Each dirty square cleaned is +10.

    RandomAgent         ignores its percepts
    ReflexAgent         simple reflex: suck if dirty, else move to a random open neighbor
    ModelReflexAgent    model-based reflex: remembers the map, prefers unvisited neighbors
    GoalAgent           goal-based: SEARCHES (breadth-first) for the nearest unexplored square
    UtilityAgent        utility-based: like GoalAgent, but weighs battery risk and recharges

The random numbers come from mulberry32, the same generator the web page uses, so the
benchmark printed here matches the "Benchmark 20 worlds" button in lesson 02 exactly.

Run:  python agent_zoo.py
No packages needed.
"""
from collections import deque

MAP = [
    "##############",
    "#D...#.......#",
    "#....#..##...#",
    "#.........#..#",
    "###.###...#..#",
    "#.....#......#",
    "#..#..####.###",
    "#..#.........#",
    "##############",
]
DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}
ORDER = ["N", "E", "S", "W"]
MAX_BATTERY, STEPS, DIRT_P = 100, 400, 0.3


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd


# ------------------------------------------------------------------------- environment
class World:
    def __init__(self, seed):
        rnd = mulberry32(seed)
        self.walls, self.dirt = set(), set()
        for y, row in enumerate(MAP):
            for x, ch in enumerate(row):
                if ch == "#":
                    self.walls.add((x, y))
                elif ch == "D":
                    self.dock = (x, y)
                elif rnd() < DIRT_P:
                    self.dirt.add((x, y))
        self.total_dirt = len(self.dirt)
        self.pos, self.battery, self.score, self.dead, self.cleaned = self.dock, MAX_BATTERY, 0, False, 0

    def percept(self):
        x, y = self.pos
        return {"dirty": self.pos in self.dirt,
                "walls": {d: (x + dx, y + dy) in self.walls for d, (dx, dy) in DIRS.items()},
                "dock": self.pos == self.dock, "battery": self.battery}

    def execute(self, action):
        if self.dead:
            return
        if action in DIRS:
            dx, dy = DIRS[action]
            nxt = (self.pos[0] + dx, self.pos[1] + dy)
            if nxt not in self.walls:
                self.pos = nxt
            self.battery -= 1
        elif action == "Suck":
            if self.pos in self.dirt:
                self.dirt.discard(self.pos)
                self.score += 10
                self.cleaned += 1
            self.battery -= 1
        elif action == "Dock" and self.pos == self.dock:
            self.battery = MAX_BATTERY
        if self.battery <= 0 and self.pos != self.dock:
            self.dead = True
            self.score -= 50


# ------------------------------------------------------------------------- agents
class RandomAgent:
    def __init__(self, rnd):
        self.rnd = rnd

    def __call__(self, p):
        return (ORDER + ["Suck"])[int(self.rnd() * 5)]


class ReflexAgent:
    def __init__(self, rnd):
        self.rnd = rnd

    def __call__(self, p):
        if p["dirty"]:
            return "Suck"
        open_dirs = [d for d in ORDER if not p["walls"][d]]
        return open_dirs[int(self.rnd() * len(open_dirs))]


class ModelReflexAgent:
    """Internal state: where I am (dead reckoning from a known start) and the map seen so far."""

    def __init__(self, rnd):
        self.rnd, self.pos, self.free, self.walls, self.visited = rnd, (0, 0), {(0, 0)}, set(), {(0, 0)}

    def update(self, p):                           # UPDATE-STATE: fold the percept into the model
        x, y = self.pos
        self.visited.add(self.pos)
        for d, (dx, dy) in DIRS.items():
            (self.walls if p["walls"][d] else self.free).add((x + dx, y + dy))

    def move(self, d):                             # predicted effect of our own action
        dx, dy = DIRS[d]
        self.pos = (self.pos[0] + dx, self.pos[1] + dy)
        return d

    def __call__(self, p):
        self.update(p)
        if p["dirty"]:
            return "Suck"
        x, y = self.pos
        for d in ORDER:                            # rule: prefer a neighbor I have never visited
            dx, dy = DIRS[d]
            if not p["walls"][d] and (x + dx, y + dy) not in self.visited:
                return self.move(d)
        open_dirs = [d for d in ORDER if not p["walls"][d]]
        return self.move(open_dirs[int(self.rnd() * len(open_dirs))])


def bfs(start, goal_test, free):
    """Breadth-first search over known-free squares. Returns the list of moves, or None."""
    q, parent = deque([start]), {start: None}
    while q:
        c = q.popleft()
        if goal_test(c):
            path = []
            while parent[c]:
                c, d = parent[c]
                path.append(d)
            return path[::-1]
        for d in ORDER:
            dx, dy = DIRS[d]
            n = (c[0] + dx, c[1] + dy)
            if n in free and n not in parent:
                parent[n] = (c, d)
                q.append(n)
    return None


class GoalAgent(ModelReflexAgent):
    """Goal: every reachable square explored. Plans with search instead of reacting."""

    def plan_to_frontier(self):
        return bfs(self.pos, lambda c: c not in self.visited, self.free)

    def __call__(self, p):
        self.update(p)
        if p["dirty"]:
            return "Suck"
        path = self.plan_to_frontier()
        if path:
            return self.move(path[0])
        home = bfs(self.pos, lambda c: c == (0, 0), self.free)
        return self.move(home[0]) if home else ("Dock" if p["dock"] else "NoOp")


class UtilityAgent(GoalAgent):
    """Prefers plans with the highest expected utility: +10 per dirt, -50 if the battery dies.
    In practice: never start an action unless it can still get home afterwards."""

    def __call__(self, p):
        self.update(p)
        home = bfs(self.pos, lambda c: c == (0, 0), self.free)
        d_home = len(home)
        if p["dock"] and p["battery"] < MAX_BATTERY and self.recharging(p):
            return "Dock"
        if p["dirty"] and p["battery"] - 1 > d_home:
            return "Suck"
        path = self.plan_to_frontier()
        if path:
            target = self.target_of(path)
            back = len(bfs(target, lambda c: c == (0, 0), self.free) or [])
            if len(path) + back + 1 < p["battery"]:      # enough battery to get there AND back
                return self.move(path[0])
        if home:
            return self.move(home[0])                    # go home: recharge or finish
        return "Dock" if p["dock"] else "NoOp"

    def recharging(self, p):
        return p["battery"] < MAX_BATTERY and bfs(self.pos, lambda c: c not in self.visited, self.free) is not None

    def target_of(self, path):
        x, y = self.pos
        for d in path:
            dx, dy = DIRS[d]
            x, y = x + dx, y + dy
        return (x, y)


AGENTS = [("Random", RandomAgent), ("Simple reflex", ReflexAgent), ("Model-based reflex", ModelReflexAgent),
          ("Goal-based", GoalAgent), ("Utility-based", UtilityAgent)]


def run(agent_cls, seed):
    w = World(seed)
    agent = agent_cls(mulberry32(seed + 1000))
    for _ in range(STEPS):
        if w.dead:
            break
        w.execute(agent(w.percept()))
    return w


if __name__ == "__main__":
    print(f"20 worlds, {STEPS} steps each, battery {MAX_BATTERY}, +10 per dirt, -50 if the battery dies away from the dock\n")
    print(f"{'agent':20s} {'avg score':>9s} {'dirt cleaned':>13s} {'battery deaths':>15s}")
    for name, cls in AGENTS:
        runs = [run(cls, seed) for seed in range(1, 21)]
        score = sum(r.score for r in runs) / len(runs)
        frac = sum(r.cleaned / r.total_dirt for r in runs) / len(runs)
        deaths = sum(r.dead for r in runs)
        print(f"{name:20s} {score:9.1f} {100 * frac:12.0f}% {deaths:15d}")
