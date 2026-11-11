"""
mini_agent.py - a tiny coding agent, built the same way as Claude Code (much smaller).

The whole idea of an LLM agent fits in one loop:

    messages = [the user's task]
    loop:
        reply = model(system prompt, tools, messages)      # the model THINKS and picks actions
        append reply to messages
        if the reply has no tool calls: done               # the model says it is finished
        for each tool call: check permission, run it, append the result as a new message

Everything else is engineering around that loop: which tools exist, what they are allowed to
touch (the sandbox), when a human must approve (permissions), and what to do when the
conversation gets too long for the context window.

Two "brains" are included, so you can learn the mechanics before paying for anything:

    python mini_agent.py --offline               # a scripted fake model: no API key, no network
    python mini_agent.py "fix the bug in calc.py" # Claude via the Anthropic API

For the real model:  pip install anthropic   and set ANTHROPIC_API_KEY (or run `ant auth login`).
The agent can only touch files inside ./workspace (created with a small buggy project on
first run). Run it inside a container for a second wall (see the Containers course, lesson 06).
"""
import argparse
import json
import pathlib
import subprocess
import sys
import textwrap

WORKSPACE = pathlib.Path(__file__).resolve().parent / "workspace"
MODEL = "claude-opus-5-5"
MAX_TURNS = 20

SYSTEM_PROMPT = """You are a careful coding agent working in a small Python project.
Use the tools to look before you change anything. After editing, run the tests to check your
work. When the task is done, reply with a short summary of what you changed and why."""

# ---------------------------------------------------------------------------- tools
# Each tool = a JSON schema the model sees + a Python function the harness runs.
TOOLS = [
    {
        "name": "list_files",
        "description": "List the files in the project workspace.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "read_file",
        "description": "Read a text file from the workspace. Paths are relative to the workspace root.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "e.g. calc.py"}},
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a text file in the workspace with the full new contents.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
            "required": ["path", "content"],
            "additionalProperties": False,
        },
    },
    {
        "name": "run_python",
        "description": "Run a Python file from the workspace (for example the tests) and return its output.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
            "additionalProperties": False,
        },
    },
]
NEEDS_APPROVAL = {"write_file", "run_python"}     # reading is harmless; changing and running are not


class ToolError(Exception):
    pass


def safe_path(rel):
    """The sandbox: every path must stay inside WORKSPACE (no '..', no absolute paths)."""
    p = (WORKSPACE / rel).resolve()
    if p != WORKSPACE and WORKSPACE not in p.parents:
        raise ToolError(f"path {rel!r} is outside the workspace")
    return p


def run_tool(name, args):
    if name == "list_files":
        return "\n".join(sorted(str(p.relative_to(WORKSPACE)) for p in WORKSPACE.rglob("*") if p.is_file()))
    if name == "read_file":
        p = safe_path(args["path"])
        if not p.is_file():
            raise ToolError(f"no such file: {args['path']}")
        return p.read_text()
    if name == "write_file":
        p = safe_path(args["path"])
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(args["content"])
        return f"wrote {len(args['content'])} characters to {args['path']}"
    if name == "run_python":
        p = safe_path(args["path"])
        if sys.platform == "emscripten":               # in the browser (Pyodide) there are no subprocesses
            return run_in_process(p)
        r = subprocess.run([sys.executable, str(p)], cwd=WORKSPACE, capture_output=True, text=True, timeout=30)
        return f"exit code {r.returncode}\n{r.stdout}{r.stderr}"[-4000:]   # keep results short: context is precious
    raise ToolError(f"unknown tool {name}")


def run_in_process(path):
    """Run a workspace script inside this Python process (used only in the browser)."""
    import contextlib, io, os, runpy, traceback
    for mod in [m for m, v in sys.modules.items() if str(getattr(v, "__file__", "")).startswith(str(WORKSPACE))]:
        del sys.modules[mod]                       # forget old versions of edited workspace modules
    out, code, cwd = io.StringIO(), 0, os.getcwd()
    sys.path.insert(0, str(WORKSPACE))
    try:
        os.chdir(WORKSPACE)
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            try:
                runpy.run_path(str(path), run_name="__main__")
            except SystemExit as e:
                code = e.code if isinstance(e.code, int) else 1
            except BaseException:
                traceback.print_exc()
                code = 1
    finally:
        os.chdir(cwd)
        sys.path.remove(str(WORKSPACE))
    return f"exit code {code}\n{out.getvalue()}"[-4000:]


# ---------------------------------------------------------------------------- brains
class Reply:
    """What a brain returns: the assistant content to store, and the tool calls to run."""

    def __init__(self, content, text, tool_calls, stop_reason):
        self.content, self.text, self.tool_calls, self.stop_reason = content, text, tool_calls, stop_reason


class ClaudeBrain:
    def __init__(self):
        import anthropic                       # imported here so --offline works without it
        self.client = anthropic.Anthropic()    # reads ANTHROPIC_API_KEY or an `ant auth login` profile

    def think(self, messages):
        r = self.client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
            # if a safety classifier declines a request, the API retries it on a fallback model
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        text = "".join(b.text for b in r.content if b.type == "text")
        calls = [(b.id, b.name, b.input) for b in r.content if b.type == "tool_use"]
        print(f"   [tokens: {r.usage.input_tokens} in, {r.usage.output_tokens} out]")
        # store the content blocks exactly as returned (thinking blocks must go back unchanged)
        return Reply(r.content, text, calls, r.stop_reason)


class ScriptedBrain:
    """A fake model that always makes the same moves. It lets you watch the loop work offline.
    A real model decides each step from the conversation; this one just reads its script."""

    def __init__(self):
        self.step = 0

    def think(self, messages):
        last = messages[-1]["content"]
        fixed = "def add(a, b):\n    return a + b\n\n\ndef mean(xs):\n    return sum(xs) / len(xs)\n"
        script = [
            ("I'll look at the project first.", [("list_files", {})]),
            ("Let me read the code and the tests.", [("read_file", {"path": "calc.py"}),
                                                       ("read_file", {"path": "test_calc.py"})]),
            ("Running the tests to see what fails.", [("run_python", {"path": "test_calc.py"})]),
            ("`mean` divides by a hard-coded 2. It should divide by len(xs). Fixing it.",
             [("write_file", {"path": "calc.py", "content": fixed})]),
            ("Re-running the tests.", [("run_python", {"path": "test_calc.py"})]),
            ("Done. `mean()` in calc.py divided by 2 instead of by the number of values; "
             "it now uses len(xs), and all tests pass.", []),
        ]
        if isinstance(last, list) and any(b.get("is_error") for b in last if isinstance(b, dict)):
            return Reply([{"type": "text", "text": "A tool was refused, so I'll stop here."}],
                         "A tool was refused, so I'll stop here.", [], "end_turn")
        text, calls = script[min(self.step, len(script) - 1)]
        self.step += 1
        content = [{"type": "text", "text": text}]
        tool_calls = []
        for i, (name, args) in enumerate(calls):
            tid = f"toolu_offline_{self.step}_{i}"
            content.append({"type": "tool_use", "id": tid, "name": name, "input": args})
            tool_calls.append((tid, name, args))
        return Reply(content, text, tool_calls, "tool_use" if tool_calls else "end_turn")


# ---------------------------------------------------------------------------- the loop
def approve(name, args, auto_yes):
    if name not in NEEDS_APPROVAL or auto_yes:
        return True
    preview = json.dumps(args)[:200]
    return input(f"   allow {name}({preview})? [y/N] ").strip().lower() == "y"


def run_agent(task, brain, auto_yes=False):
    messages = [{"role": "user", "content": task}]
    for turn in range(1, MAX_TURNS + 1):
        reply = brain.think(messages)
        messages.append({"role": "assistant", "content": reply.content})
        if reply.text:
            print(f"\n[{turn}] agent: {reply.text}")
        if reply.stop_reason == "refusal":
            print("   the model declined this request")
            return messages
        if not reply.tool_calls:                       # no actions requested: the agent is finished
            return messages
        results = []
        for tool_id, name, args in reply.tool_calls:   # ACT: run every requested tool
            print(f"   -> {name}({json.dumps(args)[:80]})")
            if not approve(name, args, auto_yes):
                out, err = "The user did not allow this action.", True
            else:
                try:
                    out, err = run_tool(name, args), False
                except (ToolError, OSError, subprocess.TimeoutExpired) as e:
                    out, err = f"Error: {e}", True
            print(textwrap.indent(out[:300] + ("..." if len(out) > 300 else ""), "      "))
            results.append({"type": "tool_result", "tool_use_id": tool_id, "content": out, "is_error": err})
        # all results go back in ONE user message: they are the agent's next PERCEPTS
        messages.append({"role": "user", "content": results})
    print("stopped: turn limit reached")
    return messages


def make_demo_workspace():
    if WORKSPACE.exists():
        return
    WORKSPACE.mkdir()
    (WORKSPACE / "calc.py").write_text("def add(a, b):\n    return a + b\n\n\ndef mean(xs):\n    return sum(xs) / 2\n")
    (WORKSPACE / "test_calc.py").write_text(textwrap.dedent("""\
        from calc import add, mean

        assert add(2, 3) == 5
        assert mean([2, 4]) == 3
        assert mean([1, 2, 3]) == 2, f"mean([1, 2, 3]) returned {mean([1, 2, 3])}"
        print("all tests passed")
        """))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("task", nargs="?", default="The tests in test_calc.py fail. Find the bug and fix it.")
    ap.add_argument("--offline", action="store_true", help="use the scripted fake model")
    ap.add_argument("--yes", action="store_true", help="approve every action without asking")
    ap.add_argument("--show-messages", action="store_true", help="print the full conversation at the end")
    a = ap.parse_args()
    make_demo_workspace()
    brain = ScriptedBrain() if a.offline else ClaudeBrain()
    msgs = run_agent(a.task, brain, a.yes)
    if a.show_messages:
        def plain(x):
            return x.to_dict() if hasattr(x, "to_dict") else x
        print(json.dumps([{"role": m["role"], "content": [plain(b) for b in m["content"]]
                           if isinstance(m["content"], list) else m["content"]} for m in msgs], indent=1)[:6000])
