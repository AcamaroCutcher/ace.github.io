"""
wumpus_kb.py - a knowledge-based agent in the wumpus world (AIMA Chapter 7, and the
probabilistic version in 3e Section 13.6 / 4e Section 12.7).

The agent never sees pits or the wumpus. It only feels a Breeze next to a pit and smells a
Stench next to the wumpus. From those percepts it reasons about which squares are safe.

Inference here is MODEL CHECKING (AIMA's TT-ENTAILS idea): enumerate every possible world
(every placement of pits and of the one wumpus on the squares we haven't visited), keep the
ones consistent with what we have perceived, and ask:

    "Is there a pit in [x,y]?"  is entailed false  <=>  no consistent world has a pit there.

Weighting each consistent world by its prior (each square has a pit with probability 0.2)
gives the probability of a pit, exactly as in the book's probabilistic wumpus example.

Run:  python wumpus_kb.py            (the world of AIMA Figure 7.2)
No packages needed.
"""
import itertools
from collections import deque

N = 4
PIT_PRIOR = 0.2


def neighbors(c):
    x, y = c
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        if 1 <= x + dx <= N and 1 <= y + dy <= N:
            yield (x + dx, y + dy)


class World:
    """The true environment (the agent can't look inside)."""

    def __init__(self, pits, wumpus, gold):
        self.pits, self.wumpus, self.gold = set(pits), wumpus, gold

    def percept(self, c):
        return {
            "breeze": any(n in self.pits for n in neighbors(c)),
            "stench": any(n == self.wumpus for n in neighbors(c)),
            "glitter": c == self.gold,
        }


class KnowledgeBase:
    def __init__(self):
        self.visited = {}           # square -> percept dict (what TELL put into the KB)

    def tell(self, square, percept):
        self.visited[square] = percept

    def unknown(self):
        return [(x, y) for x in range(1, N + 1) for y in range(1, N + 1) if (x, y) not in self.visited]

    # ---- ASK: probability of a pit / the wumpus in each unknown square -----------------
    def pit_probabilities(self):
        frontier = sorted({n for v in self.visited for n in neighbors(v) if n not in self.visited})
        weights = {c: 0.0 for c in frontier}
        total = 0.0
        for bits in itertools.product((False, True), repeat=len(frontier)):    # 2^|frontier| worlds
            pits = {c for c, b in zip(frontier, bits) if b}
            if all(any(n in pits for n in neighbors(v)) == p["breeze"] for v, p in self.visited.items()):
                w = 1.0
                for b in bits:
                    w *= PIT_PRIOR if b else 1 - PIT_PRIOR
                total += w
                for c in pits:
                    weights[c] += w
        probs = {c: weights[c] / total for c in frontier}
        for c in self.unknown():           # squares not next to anything we've felt: just the prior
            probs.setdefault(c, PIT_PRIOR)
        return probs

    def wumpus_probabilities(self):
        cands = [c for c in self.unknown()
                 if all((c in neighbors(v)) == p["stench"] for v, p in self.visited.items())]
        return {c: (1 / len(cands) if c in cands else 0.0) for c in self.unknown()}

    def safe_squares(self):
        pp, wp = self.pit_probabilities(), self.wumpus_probabilities()
        return {c for c in self.unknown() if pp[c] == 0 and wp[c] == 0}


def route(start, goal, allowed):
    """Breadth-first path through squares we know are safe."""
    q, parent = deque([start]), {start: None}
    while q:
        c = q.popleft()
        if c == goal:
            break
        for n in neighbors(c):
            if n not in parent and (n in allowed or n == goal):
                parent[n] = c
                q.append(n)
    if goal not in parent:
        return None
    path, c = [], goal
    while c:
        path.append(c)
        c = parent[c]
    return path[::-1]


def show(kb, here):
    pp, wp = kb.pit_probabilities(), kb.wumpus_probabilities()
    for y in range(N, 0, -1):
        cells = []
        for x in range(1, N + 1):
            c = (x, y)
            if c == here:
                cells.append("  A  ")
            elif c in kb.visited:
                p = kb.visited[c]
                cells.append(" " + ("B" if p["breeze"] else ".") + ("S" if p["stench"] else ".") + "  ")
            elif pp[c] == 0 and wp[c] == 0:
                cells.append(" OK  ")
            else:
                cells.append(f"{max(pp[c], wp[c]):.2f} ")
        print("   |" + "|".join(cells) + "|")


def run(world, max_steps=30):
    kb, here, path = KnowledgeBase(), (1, 1), [(1, 1)]
    for step in range(max_steps):
        p = world.percept(here)
        kb.tell(here, p)                                         # TELL the KB what we perceive
        print(f"\nStep {step}: at {here}, percept {p}")
        if p["glitter"]:
            print("Glitter! Grab the gold and climb out the way we came.")
            return path
        show(kb, here)
        safe = kb.safe_squares()                                 # ASK the KB
        known_safe = set(kb.visited) | safe
        options = [(len(route(here, c, known_safe) or []), c) for c in safe]
        options = [o for o in options if o[0] > 0]
        if options:
            _, target = min(options)
            print(f"   safe unexplored squares: {sorted(safe)}  ->  go to {target}")
        else:
            pp, wp = kb.pit_probabilities(), kb.wumpus_probabilities()
            reachable = [c for c in kb.unknown() if route(here, c, set(kb.visited))]
            target = min(reachable, key=lambda c: 1 - (1 - pp[c]) * (1 - wp[c]))
            risk = 1 - (1 - pp[target]) * (1 - wp[target])
            print(f"   nothing is provably safe; least risky square is {target} (risk {risk:.2f})")
            if risk > 0.5:
                print("   too risky: climb out without the gold")
                return path
        leg = route(here, target, known_safe)
        path += leg[1:]
        here = target
        if here in world.pits or here == world.wumpus:
            print(f"   ... and the agent died in {here}")
            return path
    return path


if __name__ == "__main__":
    # AIMA Figure 7.2: pits in (3,1), (3,3), (4,4); wumpus in (1,3); gold in (2,3)
    world = World(pits={(3, 1), (3, 3), (4, 4)}, wumpus=(1, 3), gold=(2, 3))
    print("Legend: A agent, B breeze felt, S stench felt, OK provably safe, number = risk")
    run(world)
