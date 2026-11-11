"""
mdp.py - AIMA Chapter 17 (Markov decision processes) and the Q-learning agent of
Chapter 21 (3e) / 22 (4e), on the book's 4x3 world (Figure 17.1).

    . . . +1        (4,3) is a terminal state worth +1, (4,2) is terminal and worth -1,
    . # . -1        (2,2) is a wall. Every other state gives the "living reward" R(s).
    S . . .         Actions go in the intended direction with probability 0.8, and at
                    right angles with probability 0.1 each. Bumping a wall: stay put.

Run:  python mdp.py
Needs no packages.
"""
import random

COLS, ROWS = 4, 3
WALLS = {(2, 2)}
TERMINALS = {(4, 3): 1.0, (4, 2): -1.0}
ACTIONS = {"Up": (0, 1), "Down": (0, -1), "Left": (-1, 0), "Right": (1, 0)}
ARROWS = {"Up": "^", "Down": "v", "Left": "<", "Right": ">"}
SIDEWAYS = {"Up": ("Left", "Right"), "Down": ("Left", "Right"),
            "Left": ("Up", "Down"), "Right": ("Up", "Down")}

STATES = [(x, y) for x in range(1, COLS + 1) for y in range(1, ROWS + 1) if (x, y) not in WALLS]


def move(s, a):
    dx, dy = ACTIONS[a]
    t = (s[0] + dx, s[1] + dy)
    if t in WALLS or not (1 <= t[0] <= COLS and 1 <= t[1] <= ROWS):
        return s
    return t


def transitions(s, a):
    """P(s' | s, a) as a list of (probability, s')."""
    left, right = SIDEWAYS[a]
    return [(0.8, move(s, a)), (0.1, move(s, left)), (0.1, move(s, right))]


def reward(s, living):
    return TERMINALS.get(s, living)


def value_iteration(living=-0.04, gamma=1.0, eps=1e-6, verbose=False):
    """AIMA 3e Figure 17.4: repeat the Bellman update until utilities stop changing.

        U(s) <- R(s) + gamma * max_a sum_s' P(s'|s,a) U(s')
    """
    U = {s: 0.0 for s in STATES}
    it = 0
    while True:
        it += 1
        U2, delta = {}, 0.0
        for s in STATES:
            if s in TERMINALS:
                U2[s] = TERMINALS[s]
            else:
                U2[s] = reward(s, living) + gamma * max(
                    sum(p * U[t] for p, t in transitions(s, a)) for a in ACTIONS)
            delta = max(delta, abs(U2[s] - U[s]))
        U = U2
        if verbose and it <= 3:
            print(f"after iteration {it}:"); show_values(U)
        # stopping rule from the book; with gamma = 1 we just use a small absolute threshold
        if delta < (eps * (1 - gamma) / gamma if gamma < 1 else eps):
            return U, it


def best_policy(U):
    return {s: max(ACTIONS, key=lambda a: sum(p * U[t] for p, t in transitions(s, a)))
            for s in STATES if s not in TERMINALS}


def show_values(U):
    for y in range(ROWS, 0, -1):
        row = []
        for x in range(1, COLS + 1):
            row.append("  ####" if (x, y) in WALLS else f"{U[(x, y)]:+6.3f}")
        print("   " + " ".join(row))


def show_policy(pi):
    for y in range(ROWS, 0, -1):
        row = ""
        for x in range(1, COLS + 1):
            s = (x, y)
            row += " # " if s in WALLS else (" +1" if TERMINALS.get(s) == 1 else " -1" if s in TERMINALS else f" {ARROWS[pi[s]]} ")
        print("   " + row)


# ------------------------------------------------------------------------- Q-learning
def q_learning(episodes=5000, living=-0.04, gamma=1.0, alpha=0.1, epsilon=0.1, seed=1):
    """A model-free agent: it never sees P(s'|s,a); it only tries actions and observes results.

        Q(s,a) <- Q(s,a) + alpha * (r + gamma * max_a' Q(s',a') - Q(s,a))
    """
    rng = random.Random(seed)
    Q = {(s, a): 0.0 for s in STATES for a in ACTIONS}
    for s, r in TERMINALS.items():
        for a in ACTIONS:
            Q[(s, a)] = r
    for _ in range(episodes):
        s = (1, 1)
        while s not in TERMINALS:
            if rng.random() < epsilon:                                   # explore
                a = rng.choice(list(ACTIONS))
            else:                                                        # exploit
                a = max(ACTIONS, key=lambda b: Q[(s, b)])
            r_ = rng.random()                                            # the world rolls the dice
            p_cum, s2 = 0.0, s
            for p, t in transitions(s, a):
                p_cum += p
                if r_ < p_cum:
                    s2 = t
                    break
            target = reward(s, living) + gamma * max(Q[(s2, b)] for b in ACTIONS)
            Q[(s, a)] += alpha * (target - Q[(s, a)])
            s = s2
    return Q


if __name__ == "__main__":
    U, iters = value_iteration(-0.04)
    print(f"Value iteration, R(s) = -0.04, gamma = 1: converged after {iters} iterations")
    show_values(U)
    print("Optimal policy:")
    show_policy(best_policy(U))

    print("\nHow the policy changes with the living reward (AIMA Figure 17.2):")
    for living in (-2.0, -0.2, -0.04, -0.01, 0.0):
        U, _ = value_iteration(living, gamma=0.999 if living >= 0 else 1.0)
        print(f"R(s) = {living}")
        show_policy(best_policy(U))

    Q = q_learning()
    U_q = {s: max(Q[(s, a)] for a in ACTIONS) for s in STATES}
    print("\nQ-learning after 5000 episodes (estimates of the same utilities):")
    show_values(U_q)
    show_policy({s: max(ACTIONS, key=lambda a: Q[(s, a)]) for s in STATES if s not in TERMINALS})
