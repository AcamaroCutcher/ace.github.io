# Level 6: a robot that can only measure the distance straight ahead must explore a 2 x 2 m room.
# percept = {"distance": cm to the nearest thing ahead, "last": what your previous action did}
# return ("drive", cm) with -100 <= cm <= 100, ("turn", degrees) with -180..180 (+ = left), or ("stop",)
# The body refuses drives that would hit something. Goal: cover 45% of the floor in 60 actions.

def program(percept):
    # TODO: this robot drives into the wall and then just gets refused forever.
    return ("drive", 25)
