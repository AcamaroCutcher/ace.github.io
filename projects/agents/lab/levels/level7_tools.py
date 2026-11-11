"""Level 7: tools for Claude. Every public function in agent.py becomes a tool:
its docstring is the description and its type hints become the JSON schema.
Modes: schema | call <name> <json args> | check | reset"""
import inspect
import json
import os
import sys
from lab_common import load_agent, report

STATE = "/home/pyodide/greenhouse.json"
TYPES = {str: "string", int: "integer", float: "number", bool: "boolean", list: "array", dict: "object"}
mode = sys.argv[1] if len(sys.argv) > 1 else "schema"

if mode == "reset":
    if os.path.exists(STATE):
        os.remove(STATE)
    report(ok=True)
    raise SystemExit

tools_mod = load_agent()


def describe(fn):
    doc = inspect.getdoc(fn) or ""
    parts = doc.split("Args:")
    desc = " ".join(parts[0].split())
    arg_docs = {}
    if len(parts) > 1:
        for line in parts[1].strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                arg_docs[k.strip()] = v.strip()
    props, req, problems = {}, [], []
    for name, p in inspect.signature(fn).parameters.items():
        t = TYPES.get(p.annotation)
        if t is None:
            problems.append(f"{fn.__name__}({name}): add a type hint such as str, int, float or bool")
            t = "string"
        props[name] = {"type": t}
        if name in arg_docs:
            props[name]["description"] = arg_docs[name]
        if p.default is inspect.Parameter.empty:
            req.append(name)
    if not desc:
        problems.append(f"{fn.__name__}: add a docstring; it is the description Claude reads")
    return {"name": fn.__name__, "description": desc or fn.__name__,
            "input_schema": {"type": "object", "properties": props, "required": req}}, problems


fns = [f for n, f in inspect.getmembers(tools_mod, inspect.isfunction) if not n.startswith("_") and f.__module__ == "agent"]

if mode == "schema":
    tools, problems = [], []
    for f in fns:
        t, p = describe(f)
        tools.append(t)
        problems += p
    report(ok=bool(tools), tools=tools, problems=problems)
elif mode == "call":
    name, args = sys.argv[2], json.loads(sys.argv[3])
    fn = next((f for f in fns if f.__name__ == name), None)
    if fn is None:
        report(ok=False, error=f"no tool named {name}")
    else:
        try:
            out = fn(**args)
            report(ok=True, result=out if isinstance(out, str) else json.dumps(out))
        except Exception as e:
            report(ok=False, error=f"{type(e).__name__}: {e}")
elif mode == "check":
    check = getattr(tools_mod, "_check", None)
    report(ok=bool(check and check()), summary=check.__doc__ if check else "no _check() in agent.py")
