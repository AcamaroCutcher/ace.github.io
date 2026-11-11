# The book's REFLEX-VACUUM-AGENT (AIMA Fig. 2.8)
def program(percept):
    location, status = percept
    if status == "Dirty":
        return "Suck"
    return "Right" if location == "A" else "Left"
