"""A small Claude agent that can read (but not change) the files in /workspace (lesson 06).

Run it in a container: the only files it can ever see are the ones you mount there.
Usage: python agent.py "your question about the files"
"""
import sys
from pathlib import Path

import anthropic
from anthropic import beta_tool

WORKSPACE = Path("/workspace")
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment


def inside_workspace(path: str) -> Path:
    p = (WORKSPACE / path).resolve()
    if p != WORKSPACE and WORKSPACE not in p.parents:
        raise ValueError(f"{path} is outside /workspace")
    return p


@beta_tool
def list_files(directory: str = ".") -> str:
    """List the files and folders in a directory of the workspace.

    Args:
        directory: Path relative to the workspace root, e.g. "." or "src".
    """
    d = inside_workspace(directory)
    names = [p.name + ("/" if p.is_dir() else "") for p in sorted(d.iterdir())]
    return "\n".join(names) or "(empty)"


@beta_tool
def read_file(path: str) -> str:
    """Read a text file from the workspace (at most the first 20,000 characters).

    Args:
        path: Path relative to the workspace root, e.g. "README.md".
    """
    return inside_workspace(path).read_text(errors="replace")[:20_000]


question = " ".join(sys.argv[1:]) or "What is in this folder? Summarize it in a few sentences."

runner = client.beta.messages.tool_runner(
    model="claude-opus-5-5",
    max_tokens=16000,
    betas=["server-side-fallback-2026-07-01"],
    fallbacks="default",  # if a request is declined, the API retries it on a fallback model
    system="You answer questions about the files in /workspace. Look at the files with your tools before answering.",
    tools=[list_files, read_file],
    messages=[{"role": "user", "content": question}],
)

last = None
for message in runner:  # one message per turn; the runner calls the tools in between
    last = message
    for block in message.content:
        if block.type == "tool_use":
            print(f"  [tool] {block.name} {block.input}", file=sys.stderr)
        elif block.type == "text":
            print(block.text)

if last is not None and last.stop_reason == "refusal":
    print("The model declined this request.", file=sys.stderr)
