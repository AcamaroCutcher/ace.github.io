# A sandbox for a coding agent: Claude Code in a container (lesson 06)
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates ripgrep python3 \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

# a folder for Claude Code's settings and login, owned by the ordinary "node" user
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

USER node
WORKDIR /workspace
CMD ["claude"]
