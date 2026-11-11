# A model-based reflex agent (AIMA Fig. 2.12): remember what each square looked like.
model = {"A": None, "B": None}

def program(percept):
    location, status = percept
    model[location] = status
    if status == "Dirty":
        model[location] = "Clean"          # predicted effect of Suck
        return "Suck"
    if model["A"] == model["B"] == "Clean":
        return "NoOp"                      # everything is known to be clean: rest
    return "Right" if location == "A" else "Left"
