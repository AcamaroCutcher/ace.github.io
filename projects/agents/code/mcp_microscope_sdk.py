"""
mcp_microscope_sdk.py - the same microscope server, written with the official MCP Python SDK.

Compare with mcp_microscope_scratch.py: the SDK writes the JSON-RPC plumbing and builds each
tool's JSON schema from the Python type hints and docstring. You only write the tools.

Run:  pip install "mcp[cli]"          (needs Python 3.10+)
      python mcp_microscope_sdk.py      (speaks MCP over stdio; normally an agent starts it)
      claude mcp add microscope -- python /full/path/mcp_microscope_sdk.py

Note: this file was written against the SDK's documented FastMCP interface but was not run
while preparing this course (the machine only had Python 3.9). The from-scratch version was.
"""
import math
import random

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("microscope")

X_LIMIT, Z_MIN, Z_MAX = 5000.0, 0.0, 300.0
state = {"x": 0.0, "y": 0.0, "z": 50.0}
rng = random.Random(0)


@mcp.tool()
def get_status() -> dict:
    """Report the stage position (x, y) and focus height z, all in micrometres."""
    return {"x_um": state["x"], "y_um": state["y"], "z_um": state["z"]}


@mcp.tool()
def move_stage(x_um: float, y_um: float) -> dict:
    """Move the sample stage to an absolute position. Limits: |x|, |y| <= 5000 um."""
    if abs(x_um) > X_LIMIT or abs(y_um) > X_LIMIT:
        raise ValueError(f"({x_um}, {y_um}) is outside the stage limits")
    state["x"], state["y"] = x_um, y_um
    return {"x_um": x_um, "y_um": y_um}


@mcp.tool()
def set_focus(z_um: float) -> dict:
    """Move the focus drive to height z in micrometres, between 0 and 300."""
    if not Z_MIN <= z_um <= Z_MAX:
        raise ValueError(f"z = {z_um} is outside {Z_MIN}-{Z_MAX} um")
    state["z"] = z_um
    return {"z_um": z_um}


@mcp.tool()
def measure_sharpness() -> dict:
    """Capture an image and return its sharpness from 0 (blurry) to 1 (in focus)."""
    best = 120.0 + 0.004 * state["x"] - 0.002 * state["y"]
    d = (state["z"] - best) / 15.0
    value = min(1.0, max(0.0, math.exp(-d * d) + rng.gauss(0, 0.01)))
    return {"sharpness": round(value, 4), "z_um": state["z"]}


if __name__ == "__main__":
    mcp.run()          # stdio transport by default
