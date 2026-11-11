"""
mcp_microscope_scratch.py - an MCP server written from scratch, with no SDK, to show what the
Model Context Protocol actually is on the wire.

MCP lets any agent (Claude Code, Claude Desktop, your own agent) discover and call tools that
live in a separate program. The "stdio" transport is simple:

    * the agent starts this program and talks to it over stdin/stdout
    * every message is one line of JSON-RPC 2.0 (no newlines inside a message)
    * logs go to stderr, never stdout (stdout is reserved for protocol messages)

The tools drive a SIMULATED microscope: a motorized stage (x, y) and a focus drive (z).
Swap the Microscope class for real driver calls (a vendor SDK, PyVISA/SCPI, a serial port)
and the agent side does not change at all. That is the point of the protocol.

Try it by hand:
    python mcp_microscope_scratch.py
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"me","version":"0"}}}
    {"jsonrpc":"2.0","method":"notifications/initialized"}
    {"jsonrpc":"2.0","id":2,"method":"tools/list"}
    {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"set_focus","arguments":{"z_um":120}}}

Use it from Claude Code:   claude mcp add microscope -- python /full/path/mcp_microscope_scratch.py
No packages needed. For real servers, use the official SDK (see mcp_microscope_sdk.py).
"""
import json
import math
import random
import sys

SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ------------------------------------------------------------------ the "hardware"
class Microscope:
    """A fake instrument. The sample is tilted, so the best focus depends on where you look."""
    X_LIMIT, Z_MIN, Z_MAX = 5000.0, 0.0, 300.0

    def __init__(self):
        self.x = self.y = 0.0
        self.z = 50.0
        self.rng = random.Random(0)

    def best_focus(self):
        return 120.0 + 0.004 * self.x - 0.002 * self.y

    def sharpness(self):
        d = (self.z - self.best_focus()) / 15.0
        return round(min(1.0, max(0.0, math.exp(-d * d) + self.rng.gauss(0, 0.01))), 4)


scope = Microscope()

# ------------------------------------------------------------------ tools: schema + handler
TOOLS = {
    "get_status": {
        "description": "Report the stage position (x, y) and focus height z, all in micrometres.",
        "inputSchema": {"type": "object", "properties": {}},
        "run": lambda a: {"x_um": scope.x, "y_um": scope.y, "z_um": scope.z},
    },
    "move_stage": {
        "description": f"Move the sample stage to an absolute position. Limits: |x|, |y| <= {Microscope.X_LIMIT:.0f} um.",
        "inputSchema": {"type": "object", "required": ["x_um", "y_um"],
                        "properties": {"x_um": {"type": "number"}, "y_um": {"type": "number"}}},
    },
    "set_focus": {
        "description": f"Move the focus drive to height z (um), between {Microscope.Z_MIN:.0f} and {Microscope.Z_MAX:.0f}.",
        "inputSchema": {"type": "object", "required": ["z_um"], "properties": {"z_um": {"type": "number"}}},
    },
    "measure_sharpness": {
        "description": "Capture an image and return its sharpness from 0 (blurry) to 1 (in focus).",
        "inputSchema": {"type": "object", "properties": {}},
        "run": lambda a: {"sharpness": scope.sharpness(), "z_um": scope.z},
    },
}


def move_stage(a):
    x, y = float(a["x_um"]), float(a["y_um"])
    if abs(x) > Microscope.X_LIMIT or abs(y) > Microscope.X_LIMIT:      # safety check lives HERE,
        raise ValueError(f"({x}, {y}) is outside the stage limits")    # not in the model's good intentions
    scope.x, scope.y = x, y
    return {"x_um": x, "y_um": y}


def set_focus(a):
    z = float(a["z_um"])
    if not Microscope.Z_MIN <= z <= Microscope.Z_MAX:
        raise ValueError(f"z = {z} is outside {Microscope.Z_MIN}-{Microscope.Z_MAX} um (objective could hit the sample)")
    scope.z = z
    return {"z_um": z}


TOOLS["move_stage"]["run"] = move_stage
TOOLS["set_focus"]["run"] = set_focus


# ------------------------------------------------------------------ JSON-RPC dispatch
def handle(msg):
    method, params, mid = msg.get("method"), msg.get("params") or {}, msg.get("id")
    if mid is None:                            # a notification: never answered
        log("notification:", method)
        return None
    if method == "initialize":
        asked = params.get("protocolVersion")
        result = {
            "protocolVersion": asked if asked in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0],
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "microscope-from-scratch", "version": "0.1.0"},
        }
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": [{"name": n, "description": t["description"], "inputSchema": t["inputSchema"]}
                            for n, t in TOOLS.items()]}
    elif method == "tools/call":
        tool = TOOLS.get(params.get("name"))
        if tool is None:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": f"Unknown tool: {params.get('name')}"}}
        try:
            out, is_error = json.dumps(tool["run"](params.get("arguments") or {})), False
        except (ValueError, KeyError, TypeError) as e:
            out, is_error = f"Error: {e}", True     # tool errors go back to the MODEL, so it can adapt
        result = {"content": [{"type": "text", "text": out}], "isError": is_error}
    else:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {method}"}}
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def main():
    log("microscope MCP server ready (stdio)")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}
        else:
            reply = handle(msg)
        if reply is not None:
            sys.stdout.write(json.dumps(reply) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
