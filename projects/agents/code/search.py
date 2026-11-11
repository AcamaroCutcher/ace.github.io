"""
search.py - AIMA Chapter 3: problem-solving agents and search.

One generic BEST-FIRST-SEARCH (AIMA 4e Figure 3.7) gives you every algorithm in the chapter by
changing only the priority f(n) used to order the frontier:

    breadth-first   f(n) = depth(n)          (FIFO queue)
    uniform-cost    f(n) = g(n)              (path cost so far; Dijkstra's algorithm)
    greedy          f(n) = h(n)              (estimated cost to the goal)
    A*              f(n) = g(n) + h(n)
    weighted A*     f(n) = g(n) + W*h(n)     (W > 1: faster, not always optimal)

The example is the book's road map of Romania (3e Figure 3.2, 4e Figure 3.1) with straight-line
distances to Bucharest as the heuristic (3e Figure 3.22, 4e Figure 3.16).

Run:  python search.py
No packages needed.
"""
import heapq
import itertools

# ---------------------------------------------------------------------- the problem
ROADS = {  # undirected road distances in km (AIMA 3e Fig. 3.2, 4e Fig. 3.1)
    ("Arad", "Zerind"): 75, ("Arad", "Sibiu"): 140, ("Arad", "Timisoara"): 118,
    ("Zerind", "Oradea"): 71, ("Oradea", "Sibiu"): 151, ("Timisoara", "Lugoj"): 111,
    ("Lugoj", "Mehadia"): 70, ("Mehadia", "Drobeta"): 75, ("Drobeta", "Craiova"): 120,
    ("Craiova", "Rimnicu Vilcea"): 146, ("Craiova", "Pitesti"): 138, ("Sibiu", "Fagaras"): 99,
    ("Sibiu", "Rimnicu Vilcea"): 80, ("Rimnicu Vilcea", "Pitesti"): 97,
    ("Fagaras", "Bucharest"): 211, ("Pitesti", "Bucharest"): 101, ("Bucharest", "Giurgiu"): 90,
    ("Bucharest", "Urziceni"): 85, ("Urziceni", "Hirsova"): 98, ("Hirsova", "Eforie"): 86,
    ("Urziceni", "Vaslui"): 142, ("Vaslui", "Iasi"): 92, ("Iasi", "Neamt"): 87,
}
SLD_BUCHAREST = {  # straight-line distance to Bucharest: an admissible heuristic
    "Arad": 366, "Bucharest": 0, "Craiova": 160, "Drobeta": 242, "Eforie": 161, "Fagaras": 176,
    "Giurgiu": 77, "Hirsova": 151, "Iasi": 226, "Lugoj": 244, "Mehadia": 241, "Neamt": 234,
    "Oradea": 380, "Pitesti": 100, "Rimnicu Vilcea": 193, "Sibiu": 253, "Timisoara": 329,
    "Urziceni": 80, "Vaslui": 199, "Zerind": 374,
}


class RouteProblem:
    """The five parts of a search problem (AIMA Section 3.1)."""

    def __init__(self, initial, goal, roads):
        self.initial = initial                       # 1. initial state
        self.goal = goal
        self.neighbors = {}
        for (a, b), d in roads.items():
            self.neighbors.setdefault(a, {})[b] = d
            self.neighbors.setdefault(b, {})[a] = d

    def actions(self, state):                        # 2. ACTIONS(s): drive to a neighbor
        return sorted(self.neighbors[state])

    def result(self, state, action):                 # 3. RESULT(s, a): transition model
        return action

    def is_goal(self, state):                        # 4. goal test
        return state == self.goal

    def action_cost(self, s, a, s2):                 # 5. ACTION-COST(s, a, s')
        return self.neighbors[s][s2]


class Node:
    def __init__(self, state, parent=None, path_cost=0.0, depth=0):
        self.state, self.parent, self.path_cost, self.depth = state, parent, path_cost, depth

    def path(self):
        node, out = self, []
        while node:
            out.append(node.state)
            node = node.parent
        return out[::-1]


def expand(problem, node):
    for a in problem.actions(node.state):
        s2 = problem.result(node.state, a)
        cost = node.path_cost + problem.action_cost(node.state, a, s2)
        yield Node(s2, node, cost, node.depth + 1)


def best_first_search(problem, f, early_goal_test=False):
    """AIMA 4e Figure 3.7. Returns (goal node or None, number of nodes expanded, expansion order)."""
    node = Node(problem.initial)
    counter = itertools.count()                      # tie-breaker: first in, first out
    frontier = [(f(node), next(counter), node)]
    reached = {problem.initial: node}
    expanded = []
    while frontier:
        _, _, node = heapq.heappop(frontier)
        if problem.is_goal(node.state):
            return node, len(expanded), expanded
        expanded.append(node.state)
        for child in expand(problem, node):
            s = child.state
            if s not in reached or child.path_cost < reached[s].path_cost:
                reached[s] = child
                if early_goal_test and problem.is_goal(s):   # breadth-first can stop here
                    return child, len(expanded), expanded
                heapq.heappush(frontier, (f(child), next(counter), child))
    return None, len(expanded), expanded


def breadth_first(problem):
    # breadth-first never revisits a reached state, even through a cheaper path
    node = Node(problem.initial)
    if problem.is_goal(node.state):
        return node, 0, []
    frontier, reached, expanded = [node], {problem.initial}, []
    while frontier:
        node = frontier.pop(0)
        expanded.append(node.state)
        for child in expand(problem, node):
            if problem.is_goal(child.state):
                return child, len(expanded), expanded
            if child.state not in reached:
                reached.add(child.state)
                frontier.append(child)
    return None, len(expanded), expanded


def uniform_cost(problem):
    return best_first_search(problem, lambda n: n.path_cost)


def greedy(problem, h):
    return best_first_search(problem, lambda n: h(n.state))


def astar(problem, h, weight=1.0):
    return best_first_search(problem, lambda n: n.path_cost + weight * h(n.state))


if __name__ == "__main__":
    problem = RouteProblem("Arad", "Bucharest", ROADS)
    h = SLD_BUCHAREST.get
    runs = [
        ("breadth-first", breadth_first(problem)),
        ("uniform-cost", uniform_cost(problem)),
        ("greedy best-first", greedy(problem, h)),
        ("A*", astar(problem, h)),
        ("weighted A* (W=2)", astar(problem, h, 2.0)),
    ]
    for name, (node, n_expanded, order) in runs:
        print(f"{name:18s} cost {node.path_cost:4.0f} km   expanded {n_expanded:2d}   path: {' -> '.join(node.path())}")
    print("\nA* expansion order (compare with AIMA Figure 3.18 in 4e / 3.24 in 3e):")
    _, _, order = astar(problem, h)
    print("  " + ", ".join(order))
