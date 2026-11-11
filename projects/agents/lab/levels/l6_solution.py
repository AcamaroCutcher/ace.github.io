# Lawn-mower pattern (boustrophedon): drive to the wall, step sideways, come back, repeat.
state = {"phase": "drive", "turn_left": True}

def program(p):
    d, s = p["distance"], state
    if s["phase"] == "drive":
        if d > 35:
            return ("drive", min(100, d - 25))
        s["phase"] = "turn1"
    if s["phase"] == "turn1":
        s["phase"] = "side"
        return ("turn", 90 if s["turn_left"] else -90)
    if s["phase"] == "side":
        s["phase"] = "turn2"
        return ("drive", 30) if d > 45 else ("turn", 90 if s["turn_left"] else -90)
    if s["phase"] == "turn2":
        s["phase"] = "drive"
        s["turn_left"] = not s["turn_left"]
        return ("turn", 90 if not s["turn_left"] else -90)
    return ("stop",)
