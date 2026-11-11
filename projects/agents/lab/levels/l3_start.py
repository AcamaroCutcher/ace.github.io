# Level 3: escape the maze. You cannot see the maze, only the walls around you.
# percept = {"pos": (x, y), "goal": (gx, gy), "walls": {"N": True/False, "E": ..., "S": ..., "W": ...}}
# y grows downward (S). Return "N", "E", "S" or "W".
import random

def program(percept):
    # TODO: a random walk rarely gets out in time. Remember where you have been!
    open_dirs = [d for d, wall in percept["walls"].items() if not wall]
    return random.choice(open_dirs)
