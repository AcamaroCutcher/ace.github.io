"""
robot_agent.py - an LLM agent that drives a small wheeled robot.

Three layers, from slow to fast (the same split real robots use):

    1. the BRAIN   an LLM that turns a goal ("find the door") into tool calls     seconds per step
    2. the BODY    this file: validates each tool call and turns it into          milliseconds
                   motor commands; refuses anything outside safe limits
    3. REFLEXES    the Arduino firmware: motion timeouts and obstacle stops       microseconds
                   that work even if layers 1 and 2 crash

Backends (the robot):
    --sim                 a simulated robot in a 2 x 2 m room (default; no hardware needed)
    --port /dev/ttyACM0   a real robot running robot_firmware.ino   (pip install pyserial)

Brains (the model):
    --brain offline       a hand-written reflex policy (no API, no network)        [default]
    --brain claude        Claude via the Anthropic API   (pip install anthropic)
    --brain ollama        a local model served by Ollama (no internet once the model is pulled)

Examples:
    python robot_agent.py --sim --brain offline
    python robot_agent.py --sim --brain claude "explore the room and tell me how big it is"
    python robot_agent.py --port /dev/ttyACM0 --brain ollama --model qwen3:1.7b "drive forward until something is close"

Tested here: the simulator with the offline brain, and the Claude brain against a mock API.
Not tested here: the serial backend (no robot attached) and the Ollama brain (no Ollama server).
"""
import argparse
import json
import math
import time
import urllib.request

MAX_DRIVE_CM, MAX_TURN_DEG, CLEARANCE_CM = 100, 180, 12
CM_PER_SEC, DEG_PER_SEC, SPEED = 20.0, 90.0, 150    # calibrate these on your robot!

SYSTEM = """You control a small two-wheeled robot through tools. You cannot see; your only sense
is an ultrasonic distance sensor that points forward. Move in small steps, measure often, and
never drive into something closer than the distance you plan to drive. When the goal is reached
or impossible, stop moving and report what you found in a few sentences."""

TOOLS = [
    {"name": "read_distance", "description": "Measure the distance in cm to the nearest object straight ahead.",
     "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "drive", "description": f"Drive straight. Positive = forward, negative = backward. Max {MAX_DRIVE_CM} cm per call.",
     "input_schema": {"type": "object", "properties": {"cm": {"type": "number"}}, "required": ["cm"], "additionalProperties": False}},
    {"name": "turn", "description": f"Turn in place. Positive = left (counter-clockwise), negative = right. Max {MAX_TURN_DEG} degrees per call.",
     "input_schema": {"type": "object", "properties": {"degrees": {"type": "number"}}, "required": ["degrees"], "additionalProperties": False}},
    {"name": "stop", "description": "Stop the motors immediately.",
     "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
]


# =============================================================== robots (the body's hardware)
class SimRobot:
    """A point robot in a rectangular room with one box in it. Distances come from ray casting."""

    def __init__(self):
        self.w, self.h = 200.0, 200.0                 # room size in cm
        self.box = (120.0, 60.0, 160.0, 100.0)        # an obstacle: x0, y0, x1, y1
        self.x, self.y, self.heading = 30.0, 30.0, 0.0  # start near a corner, facing +x

    def distance(self):
        best = 400.0
        dx, dy = math.cos(math.radians(self.heading)), math.sin(math.radians(self.heading))
        for t in [i * 0.5 for i in range(1, 800)]:    # march along the ray in 0.5 cm steps
            px, py = self.x + dx * t, self.y + dy * t
            x0, y0, x1, y1 = self.box
            if not (0 <= px <= self.w and 0 <= py <= self.h) or (x0 <= px <= x1 and y0 <= py <= y1):
                best = t
                break
        return round(best)

    def motors(self, left, right, ms):
        if left > 0 and right > 0 and self.distance() < 15:
            return "ERR obstacle"
        secs = ms / 1000.0
        if left == right:
            d = math.copysign(CM_PER_SEC * secs, left)
            if d > 0:
                d = min(d, max(0, self.distance() - 15))  # the firmware reflex stops it short
            self.x += d * math.cos(math.radians(self.heading))
            self.y += d * math.sin(math.radians(self.heading))
        else:
            self.heading = (self.heading + math.copysign(DEG_PER_SEC * secs, right - left)) % 360
        return "OK M"

    def stop(self):
        return "OK S"

    def pose(self):
        return f"(x={self.x:.0f} cm, y={self.y:.0f} cm, heading={self.heading:.0f} deg)"


class SerialRobot:
    """Talks to robot_firmware.ino over USB serial."""

    def __init__(self, port):
        import serial                                  # pip install pyserial
        self.ser = serial.Serial(port, 115200, timeout=2)
        time.sleep(2)                                  # most Arduinos reset when the port opens
        self.ser.reset_input_buffer()

    def _ask(self, cmd):
        self.ser.write((cmd + "\n").encode())
        while True:
            line = self.ser.readline().decode(errors="replace").strip()
            if not line:
                return "ERR no reply"
            if not line.startswith("EVENT"):           # events are printed but not answers
                return line
            print("   firmware:", line)

    def distance(self):
        reply = self._ask("D")
        return int(reply.split()[1]) if reply.startswith("D ") else 0

    def motors(self, left, right, ms):
        reply = self._ask(f"M {left} {right} {int(ms)}")
        time.sleep(ms / 1000.0 + 0.05)                # wait for the motion to finish
        return reply

    def stop(self):
        return self._ask("S")

    def pose(self):
        return "(unknown: a real robot has no GPS; that is what mapping/SLAM is for)"


# =============================================================== the body: tools with safety checks
class Body:
    def __init__(self, robot):
        self.robot = robot

    def call(self, name, args):
        """Validate, then act. Returns (text for the model, is_error)."""
        if name == "read_distance":
            return f"{self.robot.distance()} cm", False
        if name == "stop":
            return self.robot.stop(), False
        if name == "drive":
            cm = float(args.get("cm", 0))
            if abs(cm) > MAX_DRIVE_CM:
                return f"Refused: {cm} cm is more than the {MAX_DRIVE_CM} cm limit per call.", True
            if cm > 0:
                free = self.robot.distance()
                if cm > free - CLEARANCE_CM:
                    return f"Refused: only {free} cm free ahead; driving {cm} cm would hit something.", True
            ms = abs(cm) / CM_PER_SEC * 1000
            s = SPEED if cm > 0 else -SPEED
            reply = self.robot.motors(s, s, ms)
            return f"{reply}; drove {cm} cm. Now {self.robot.pose()}", reply.startswith("ERR")
        if name == "turn":
            deg = float(args.get("degrees", 0))
            if abs(deg) > MAX_TURN_DEG:
                return f"Refused: turn at most {MAX_TURN_DEG} degrees per call.", True
            ms = abs(deg) / DEG_PER_SEC * 1000
            left, right = (-SPEED, SPEED) if deg > 0 else (SPEED, -SPEED)
            reply = self.robot.motors(left, right, ms)
            return f"{reply}; turned {deg} degrees. Now {self.robot.pose()}", reply.startswith("ERR")
        return f"Unknown tool {name}", True


# =============================================================== brains
class OfflineBrain:
    """No LLM: a simple reflex agent (AIMA Ch. 2) that explores by 'drive if clear, else turn'.
    Its 'tool calls' have the same shape as an LLM's, so the rest of the program is identical."""

    def __init__(self, steps=12):
        self.left = steps
        self.measured = None

    def start(self, goal):
        pass

    def next_actions(self, last_results):
        for name, out, _err, _tid in last_results or []:
            if name == "read_distance":
                self.measured = int(out.split()[0])
        if self.left <= 0:
            return "Explored 12 steps with a reflex rule. (An LLM brain would plan instead.)", []
        self.left -= 1
        if self.measured is None:
            return "Measuring.", [("read_distance", {})]
        free, self.measured = self.measured, None
        if free > 40:
            return f"{free} cm free: driving 25 cm.", [("drive", {"cm": 25}), ("read_distance", {})]
        return f"Only {free} cm free: turning left.", [("turn", {"degrees": 90}), ("read_distance", {})]


class ClaudeBrain:
    def __init__(self, model="claude-opus-5-5"):
        import anthropic
        self.client, self.model, self.messages = anthropic.Anthropic(), model, []

    def start(self, goal):
        self.messages = [{"role": "user", "content": goal}]

    def next_actions(self, last_results):
        if last_results:
            self.messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": tid, "content": out, "is_error": err}
                for (_, out, err, tid) in last_results]})
        r = self.client.beta.messages.create(
            model=self.model, max_tokens=4000, system=SYSTEM, tools=TOOLS, messages=self.messages,
            betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        self.messages.append({"role": "assistant", "content": r.content})
        text = "".join(b.text for b in r.content if b.type == "text")
        if r.stop_reason == "refusal":
            return "The model declined.", []
        return text, [(b.name, b.input, b.id) for b in r.content if b.type == "tool_use"]


class OllamaBrain:
    """A local model through Ollama's HTTP API (https://ollama.com). Pick a model tagged 'tools'.
    On a Raspberry Pi 5, models of 1-4 billion parameters are the practical size."""

    def __init__(self, model="qwen3:1.7b", url="http://localhost:11434/api/chat"):
        self.model, self.url, self.messages = model, url, []
        self.tools = [{"type": "function", "function": {"name": t["name"], "description": t["description"],
                                                         "parameters": t["input_schema"]}} for t in TOOLS]

    def start(self, goal):
        self.messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": goal}]

    def next_actions(self, last_results):
        for name, out, _err, _tid in last_results or []:
            self.messages.append({"role": "tool", "content": out, "tool_name": name})
        body = json.dumps({"model": self.model, "messages": self.messages, "tools": self.tools, "stream": False}).encode()
        req = urllib.request.Request(self.url, body, {"Content-Type": "application/json"})
        msg = json.load(urllib.request.urlopen(req, timeout=300))["message"]
        self.messages.append(msg)
        calls = [(c["function"]["name"], c["function"].get("arguments") or {}, None) for c in msg.get("tool_calls") or []]
        return msg.get("content", ""), calls


# =============================================================== the loop
def run(brain, body, goal, max_steps=25):
    brain.start(goal)
    results = None
    for step in range(1, max_steps + 1):
        text, calls = brain.next_actions(results)
        if text:
            print(f"[{step}] brain: {text.strip()}")
        if not calls:
            break
        results = []
        for call in calls:
            name, args = call[0], call[1]
            tid = call[2] if len(call) > 2 else None
            out, err = body.call(name, args)
            print(f"      {name}({json.dumps(args)}) -> {out}")
            results.append((name, out, err, tid))
    body.robot.stop()
    print("motors stopped.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("goal", nargs="?", default="Explore the room. Find out roughly how big it is, then stop and report.")
    ap.add_argument("--sim", action="store_true", help="use the simulated robot (default if no --port)")
    ap.add_argument("--port", help="serial port of a robot running robot_firmware.ino")
    ap.add_argument("--brain", choices=["offline", "claude", "ollama"], default="offline")
    ap.add_argument("--model", help="model name for claude/ollama")
    a = ap.parse_args()
    robot = SerialRobot(a.port) if a.port else SimRobot()
    if a.brain == "claude":
        brain = ClaudeBrain(a.model or "claude-opus-5-5")
    elif a.brain == "ollama":
        brain = OllamaBrain(a.model or "qwen3:1.7b")
    else:
        brain = OfflineBrain()
    run(brain, Body(robot), a.goal)
