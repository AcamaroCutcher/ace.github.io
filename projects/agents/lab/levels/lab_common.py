"""Shared helpers for Agent Lab levels. The page runs: harness file + your agent (agent.py)."""
import importlib
import json
import sys
import traceback


def load_agent():
    """(Re)load agent.py so every episode starts with a fresh agent (fresh global state)."""
    if "agent" in sys.modules:
        return importlib.reload(sys.modules["agent"])
    return importlib.import_module("agent")


def report(**result):
    print("__RESULT__" + json.dumps(result))


def safe_act(fn, percept):
    try:
        return fn(percept), None
    except Exception:
        return None, traceback.format_exc(limit=3)
