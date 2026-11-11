"""
vacuum_world.py - AIMA Chapter 2 in runnable form.

The two-square vacuum world (AIMA 3e/4e, Section 2.1, Figure 2.2) and four agent programs
from Section 2.4:

    TableDrivenAgent      looks the whole percept sequence up in a table (Figure 2.7)
    SimpleReflexAgent     acts on the current percept only (Figure 2.8 / 2.10)
    ModelBasedReflexAgent remembers what it has seen (Figure 2.12)
    RandomAgent           a baseline: picks any action

The environment awards +1 for every clean square after every time step (the performance
measure the book proposes) and, optionally, charges for each move.

Run:  python vacuum_world.py
No packages needed (Python 3.8+).
"""
import itertools
import random

LOCATIONS = ("A", "B")
ACTIONS = ("Left", "Right", "Suck", "NoOp")


# ----------------------------------------------------------------------------------------
# The environment: owns the true state. The agent only ever sees percepts.
# ----------------------------------------------------------------------------------------
class VacuumEnvironment:
    def __init__(self, dirt, location, move_cost=0.0):
        self.status = dict(dirt)          # {"A": "Dirty", "B": "Clean"}
        self.location = location          # where the agent is
        self.move_cost = move_cost
        self.score = 0.0

    def percept(self):
        """What the sensors report: [location, status of that square]. Partial observability."""
        return (self.location, self.status[self.location])

    def execute(self, action):
        """Transition model: change the world according to the action."""
        if action == "Suck":
            self.status[self.location] = "Clean"
        elif action == "Right":
            self.location = "B"
            self.score -= self.move_cost
        elif action == "Left":
            self.location = "A"
            self.score -= self.move_cost
        # NoOp does nothing

    def step(self, agent_program):
        p = self.percept()
        a = agent_program(p)
        self.execute(a)
        # performance measure: one point per clean square per time step
        self.score += sum(1 for s in self.status.values() if s == "Clean")
        return p, a


# ----------------------------------------------------------------------------------------
# Agent programs. Each is a function: percept -> action (it may keep private state).
# ----------------------------------------------------------------------------------------
def TableDrivenAgent(table):
    """AIMA Figure 2.7. Appends each percept to the history and looks the whole history up."""
    percepts = []

    def program(percept):
        percepts.append(percept)
        return table.get(tuple(percepts), "NoOp")

    return program


def SimpleReflexAgent():
    """AIMA Figure 2.8 (REFLEX-VACUUM-AGENT): condition-action rules on the current percept."""
    def program(percept):
        location, status = percept
        if status == "Dirty":
            return "Suck"
        if location == "A":
            return "Right"
        return "Left"

    return program


def ModelBasedReflexAgent():
    """AIMA Figure 2.12. Keeps a model of both squares, so it can stop when it knows all is clean."""
    model = {"A": None, "B": None}       # None = never seen

    def program(percept):
        location, status = percept
        model[location] = status          # UPDATE-STATE from the percept
        if status == "Dirty":
            model[location] = "Clean"     # ...and from the predicted effect of our action
            return "Suck"
        if model["A"] == model["B"] == "Clean":
            return "NoOp"                 # rule: everything is known to be clean -> rest
        return "Right" if location == "A" else "Left"

    return program


def RandomAgent(seed=None):
    rng = random.Random(seed)
    return lambda percept: rng.choice(ACTIONS)


# ----------------------------------------------------------------------------------------
# Experiments
# ----------------------------------------------------------------------------------------
def all_start_states():
    """Every combination of dirt and start location: 2 x 2 x 2 = 8 worlds."""
    for a, b, loc in itertools.product(("Clean", "Dirty"), ("Clean", "Dirty"), LOCATIONS):
        yield {"A": a, "B": b}, loc


def evaluate(make_agent, steps=10, move_cost=0.0):
    """Average score over all 8 start states, like AIMA Exercise 2.8 (3e) asks for."""
    total = 0.0
    for dirt, loc in all_start_states():
        env = VacuumEnvironment(dirt, loc, move_cost)
        agent = make_agent()
        for _ in range(steps):
            env.step(agent)
        total += env.score
    return total / 8


def trace(make_agent, dirt, loc, steps=6):
    env = VacuumEnvironment(dirt, loc)
    agent = make_agent()
    print(f"  start: agent in {loc}, squares {dirt}")
    for t in range(steps):
        p, a = env.step(agent)
        print(f"  t={t}  percept={p}  ->  action={a:5s}  score={env.score:.0f}")


if __name__ == "__main__":
    print("Simple reflex agent, both squares dirty, starting in A:")
    trace(SimpleReflexAgent, {"A": "Dirty", "B": "Dirty"}, "A")

    # A table for the first two percepts only: it shows why tables explode.
    # With P possible percepts and lifetime T the table has sum_{t=1..T} P^t rows.
    P = 4  # (A|B) x (Clean|Dirty)
    print("\nTable-driven agent: rows needed for lifetime T =", [sum(P**t for t in range(1, T + 1)) for T in (1, 2, 5, 10, 20)])

    print("\nAverage score over the 8 start states (10 steps):")
    for cost in (0.0, 1.0):
        print(f"  move cost = {cost}")
        for name, make in [("simple reflex", SimpleReflexAgent),
                           ("model-based reflex", ModelBasedReflexAgent),
                           ("random (seed 0)", lambda: RandomAgent(0))]:
            print(f"    {name:20s} {evaluate(make, 10, cost):6.2f}")
