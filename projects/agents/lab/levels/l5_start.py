# Level 5: the wumpus world. Get the gold and climb out alive.
# percept = {"pos": (x, y), "breeze": bool, "stench": bool, "glitter": bool, "has_gold": bool}
# (x, y) from (1, 1) to (4, 4); "N" increases y. Actions: "N", "E", "S", "W", "Grab", "Climb".
# Score: +1000 for climbing out (in [1,1]) with the gold, -1000 for dying, -1 per action.

def program(percept):
    if percept["glitter"]:
        return "Grab"
    # TODO: walking east blindly falls into pits. Reason about breezes and stenches.
    return "E"
