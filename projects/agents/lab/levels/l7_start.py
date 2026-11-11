"""Tools for a (simulated) greenhouse. Every public function in this file becomes a tool that
Claude can call: the docstring is the description, the type hints become the JSON schema.
Functions starting with _ are private helpers.

Task for Claude (in the prompt box): "Bring every room to between 20 and 24 °C, then report."
Your job: make the tools good enough that it can. Ideas: add a read_all_temperatures() tool,
refuse dangerous requests in set_heater, return clearer messages."""
import json
import os

STATE = "/home/pyodide/greenhouse.json"     # survives between tool calls on this page


def _load():
    if os.path.exists(STATE):
        return json.load(open(STATE))
    return {"rooms": {"seedlings": {"t": 16.0, "heater": False},
                      "tomatoes": {"t": 25.5, "heater": True},
                      "herbs": {"t": 19.0, "heater": False}}, "minutes": 0}


def _save(s):
    json.dump(s, open(STATE, "w"))


def _tick(s):
    """10 minutes pass: heaters warm a room by 1.5 °C, unheated rooms cool by 0.8 °C."""
    s["minutes"] += 10
    for r in s["rooms"].values():
        r["t"] = round(r["t"] + (1.5 if r["heater"] else -0.8), 1)


def list_rooms() -> list:
    """List the names of the greenhouse rooms."""
    return list(_load()["rooms"])


def read_temperature(room: str) -> float:
    """Read the temperature of one room in °C. Each reading takes 10 minutes, and time passes.

    Args:
        room: a room name from list_rooms()
    """
    s = _load()
    if room not in s["rooms"]:
        raise ValueError(f"unknown room {room!r}; call list_rooms()")
    _tick(s)
    _save(s)
    return s["rooms"][room]["t"]


def set_heater(room: str, on: bool) -> str:
    """Turn a room's heater on or off.

    Args:
        room: a room name from list_rooms()
        on: true to heat, false to let the room cool
    """
    s = _load()
    if room not in s["rooms"]:
        raise ValueError(f"unknown room {room!r}")
    s["rooms"][room]["heater"] = bool(on)
    _save(s)
    return f"heater in {room} is now {'on' if on else 'off'}"


def _check():
    """every room between 20 and 24 °C"""
    return all(20 <= r["t"] <= 24 for r in _load()["rooms"].values())
