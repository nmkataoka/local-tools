# Codex MCP Bridge — Implementation Plan

## Project Overview
An MCP server that wraps the Codex CLI, exposing `codex_review` and `codex_exec` tools over stdio. This lets Claude Code invoke Codex for code review and general tasks through the standard MCP tool-call interface.

## Directory
```
/Users/nolankataoka/NoBackup/local-tools/codex-mcp-bridge/
```

## Files
1. `package.json` — project manifest
2. `codex-mcp-bridge.mjs` — MCP server entry point
3. `node_modules/` — dependencies

## Status
- [x] Step 1: Create `package.json` — DONE
- [x] Step 2: Run `npm install` — DONE (91 packages installed)
- [x] Step 3: Write `codex-mcp-bridge.mjs` — DONE
- [x] Step 4: Register with Claude Code via `claude mcp add` — DONE

---

## Step 2: npm install

```bash
cd /Users/nolankataoka/NoBackup/local-tools/codex-mcp-bridge && npm install
```

This installs `@modelcontextprotocol/sdk` and `zod`.

---

## Step 3: Write `codex-mcp-bridge.mjs`

Create file at: `/Users/nolankataoka/NoBackup/local-tools/codex-mcp-bridge/codex-mcp-bridge.mjs`

Write this EXACT content:

```js
#!/usr/bin/env node
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const execFile = promisify(execFileCb);
const CODEX = "/opt/homebrew/bin/codex";

// ── Helper ────────────────────────────────────────────────────────────
async function runCodex(args, cwd) {
  console.error(`[codex-bridge] running: codex ${args.join(" ")}`);
  const { stdout, stderr } = await execFile(CODEX, args, {
    cwd: cwd || undefined,
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 5 * 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (stderr) console.error(`[codex-bridge] stderr: ${stderr}`);
  return stdout;
}

// ── Server ────────────────────────────────────────────────────────────
const server = new McpServer({ name: "codex-bridge", version: "1.0.0" });

// ── codex_review ──────────────────────────────────────────────────────
server.tool(
  "codex_review",
  "Run codex review on a git repository",
  {
    cwd:         z.string().optional().describe("Working directory (must be a git repo)"),
    uncommitted: z.boolean().optional().describe("Review uncommitted changes"),
    base:        z.string().optional().describe("Base branch for diff"),
    commit:      z.string().optional().describe("Specific commit SHA to review"),
    title:       z.string().optional().describe("PR title for context"),
    prompt:      z.string().optional().describe("Additional review prompt"),
    model:       z.string().optional().describe("Model to use (e.g. o4-mini)"),
  },
  async ({ cwd, uncommitted, base, commit, title, prompt, model }) => {
    const args = ["review"];
    if (uncommitted) args.push("--uncommitted");
    if (base)        args.push("--base", base);
    if (commit)      args.push("--commit", commit);
    if (title)       args.push("--title", title);
    if (model)       args.push("-m", model);
    if (prompt)      args.push(prompt);
    const out = await runCodex(args, cwd);
    return { content: [{ type: "text", text: out || "(no output)" }] };
  }
);

// ── codex_exec ────────────────────────────────────────────────────────
server.tool(
  "codex_exec",
  "Run codex exec --full-auto with a prompt",
  {
    cwd:     z.string().optional().describe("Working directory"),
    prompt:  z.string().describe("The task prompt for Codex"),
    model:   z.string().optional().describe("Model to use"),
    sandbox: z.enum(["full-auto"]).optional().describe("Sandbox policy"),
  },
  async ({ cwd, prompt, model, sandbox }) => {
    const args = ["exec", "--full-auto"];
    if (model)   args.push("-m", model);
    if (sandbox) args.push("-s", sandbox);
    args.push(prompt);
    const out = await runCodex(args, cwd);
    return { content: [{ type: "text", text: out || "(no output)" }] };
  }
);

// ── Transport ─────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[codex-bridge] server running on stdio");
```

---

## Step 4: Register with Claude Code

```bash
claude mcp add --transport stdio --scope user codex-bridge -- \
  node /Users/nolankataoka/NoBackup/local-tools/codex-mcp-bridge/codex-mcp-bridge.mjs
```

This adds an entry to `~/.claude.json` so the server starts automatically in all Claude Code sessions.

---

## Verification
1. Run `/mcp` in Claude Code — confirm `codex-bridge` shows connected with 2 tools (`codex_review`, `codex_exec`)
2. In a git repo with uncommitted changes, ask: "use codex_review to review my uncommitted changes"
3. Invoke with a bad `--commit` SHA to verify errors propagate cleanly

---

## Notes
- `.mjs` extension gives native ESM — no build step needed
- All logging goes to `stderr` (stdout is reserved for MCP JSON-RPC protocol)
- `NO_COLOR=1` env var strips ANSI escape codes from Codex output
- Codex binary resolved via `$CODEX_PATH` env var, falling back to `codex` on `$PATH`
- Uses Codex's default model; no `model` parameter exposed (codex review doesn't support `-m`)
- `codex_exec` always runs with `--full-auto`; no sandbox parameter exposed
