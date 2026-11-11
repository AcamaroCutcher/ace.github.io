# Agents course: example code

Companion code for the interactive course at https://acamaro.com/projects/agents/
(an AI-written study companion to Russell & Norvig, *Artificial Intelligence: A Modern Approach*).

| File | Lesson | Needs | Tested? |
|---|---|---|---|
| vacuum_world.py | 01 | Python 3.8+ | yes |
| agent_zoo.py | 02 | Python 3.8+ | yes (matches the web widget exactly) |
| search.py | 03 | Python 3.8+ | yes |
| wumpus_kb.py | 04 | Python 3.8+ | yes |
| mdp.py | 05 | Python 3.8+ | yes |
| bpe.py | 06 | Python 3.8+ | yes |
| tiny_gpt.py | 06 | `pip install torch` | yes (CPU, about 1 minute) |
| mini_agent.py | 07 | `--offline`: nothing; otherwise `pip install anthropic` + API key | offline mode yes; Claude mode against a mock API |
| mcp_microscope_scratch.py | 08 | Python 3.8+ | yes (JSON-RPC session piped in) |
| mcp_microscope_sdk.py | 08 | `pip install "mcp[cli]"`, Python 3.10+ | compiles; not run |
| robot_agent.py | 09 | `--sim`: nothing; robot: `pip install pyserial`; `--brain claude`: anthropic; `--brain ollama`: Ollama | sim + offline yes; Claude against a mock API; serial and Ollama not run |
| robot_firmware/robot_firmware.ino | 09 | Arduino IDE, Uno/Nano, TB6612FNG, HC-SR04 | not compiled; check pins |

Start with: `python vacuum_world.py`, then `python mini_agent.py --offline`, then `python robot_agent.py --sim`.
