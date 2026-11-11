# Level 4: clean the apartment from lesson 02 before the battery dies.
# percept = {"dirty": bool, "walls": {"N": bool, "E": bool, "S": bool, "W": bool},
#            "dock": bool, "battery": int}
# actions: "N", "E", "S", "W", "Suck", "Dock" (recharge, only on the dock), "NoOp"
# Each move or suck costs 1 battery (100 when full). +10 per dirt, -50 if the battery dies away from the dock.
import random

def program(percept):
    # a simple reflex agent: it scores about 14. You need 150.
    if percept["dirty"]:
        return "Suck"
    return random.choice([d for d in "NESW" if not percept["walls"][d]])
