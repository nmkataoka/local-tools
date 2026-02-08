# codex-mcp-bridge

MCP server that wraps the [Codex CLI](https://github.com/openai/codex) as two tools (`codex_review`, `codex_exec`) over stdio, so Claude Code can invoke Codex via standard MCP tool calls.

## Structure

Single-file server: `codex-mcp-bridge.mjs` (ESM, no build step). Dependencies in `package.json` are `@modelcontextprotocol/sdk` and `zod`.

## How it works

- `codex_review` — runs `codex review` with options like `--uncommitted`, `--base`, `--commit`, `--title`, and an optional custom prompt.
- `codex_exec` — runs `codex exec --dangerously-bypass-approvals-and-sandbox` with a prompt.
- All logging goes to stderr (stdout is reserved for MCP JSON-RPC).
- `NO_COLOR=1` is set to strip ANSI codes from Codex output.
- Codex binary is resolved via `$CODEX_PATH` env var, falling back to `codex` on `$PATH`.

## Known codex CLI quirks

- `codex review --uncommitted` conflicts with the positional `[PROMPT]` arg in the CLI parser. The bridge works around this by piping the prompt via stdin (`-`).
- `codex review` does not support `-m` for model selection.

## Registration

```bash
claude mcp add --transport stdio --scope user codex-bridge -- \
  node /Users/nolankataoka/NoBackup/local-tools/codex-mcp-bridge/codex-mcp-bridge.mjs
```
