# Level 2: now every move costs 1 point. The reflex agent keeps moving forever.
# Give your agent a memory: module-level variables persist between calls
# (and are reset at the start of each episode).

def program(percept):
    location, status = percept
    if status == "Dirty":
        return "Suck"
    return "Right" if location == "A" else "Left"
