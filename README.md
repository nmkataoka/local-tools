# codex-mcp-bridge

An MCP server that lets Claude Code invoke [OpenAI Codex CLI](https://github.com/openai/codex) for code reviews and task execution.

## Prerequisites

- **Node.js** — must be available in the shell where you run Claude Code
- **Codex CLI** — install via `brew install codex` or see the [Codex repo](https://github.com/openai/codex)

## Setup

1. Clone this repo and install dependencies:

   ```bash
   cd codex-mcp-bridge
   npm install
   ```

2. Register the MCP server with Claude Code, providing the full path to the Codex binary via the `CODEX_PATH` environment variable. Claude Code's MCP subprocesses don't inherit your normal shell `$PATH`, so this is required.

   For Homebrew-installed Codex (most common):

   ```bash
   claude mcp add --transport stdio --scope user \
     -e CODEX_PATH=/opt/homebrew/bin/codex \
     codex-bridge -- \
     node /path/to/codex-mcp-bridge/codex-mcp-bridge.mjs
   ```

   Replace `/path/to/codex-mcp-bridge` with the actual path on your machine. If Codex is installed elsewhere, adjust `CODEX_PATH` accordingly.

3. Restart Claude Code. You can verify the server is connected by running `/mcp` — you should see `codex-bridge` listed with two tools.

## Usage

Once set up, just ask Claude Code naturally:

- *"Run a codex review on my uncommitted changes"*
- *"Ask codex to review the diff against main"*
- *"Use codex to review commit abc1234"*

Claude Code will call the `codex_review` or `codex_exec` tools automatically.

## Tools

| Tool | Description |
|------|-------------|
| `codex_review` | Runs `codex review` with options for uncommitted changes, base branch, specific commits, and custom prompts |
| `codex_exec` | Runs `codex exec` in full-auto mode with a given prompt |

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `CODEX_PATH` | **Required.** Absolute path to the Codex CLI binary (e.g. `/opt/homebrew/bin/codex`) |
