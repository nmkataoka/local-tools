#!/usr/bin/env node
import { execFile as execFileCb } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const CODEX = process.env.CODEX_PATH || "codex";

// ── Helper ────────────────────────────────────────────────────────────
async function runCodex(args, cwd, { stdin } = {}) {
  console.error(`[codex-bridge] running: codex ${args.join(" ")}`);
  try {
    const child = execFileCb(CODEX, args, {
      cwd: cwd || undefined,
      env: { ...process.env, NO_COLOR: "1" },
      timeout: 15 * 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    const { stdout, stderr } = await new Promise((resolve, reject) => {
      let stdout = "", stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else {
          const err = new Error(`codex exited with code ${code}`);
          err.code = code;
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        }
      });
    });
    if (stderr) console.error(`[codex-bridge] stderr: ${stderr}`);
    return stdout || stderr || "";
  } catch (err) {
    const code = err.code ?? err.status ?? "unknown";
    const out = err.stdout || "";
    const errOut = err.stderr || "";
    console.error(`[codex-bridge] codex exited with code ${code}`);
    if (errOut) console.error(`[codex-bridge] stderr: ${errOut}`);
    throw new Error(
      `codex exited with code ${code}\n${out}${out && errOut ? "\n" : ""}${errOut}`.trim()
    );
  }
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
  },
  async ({ cwd, uncommitted, base, commit, title, prompt }) => {
    const args = ["review"];
    if (uncommitted) args.push("--uncommitted");
    if (base)        args.push("--base", base);
    if (commit)      args.push("--commit", commit);
    if (title)       args.push("--title", title);
    // --uncommitted conflicts with positional [PROMPT] in the CLI,
    // so pipe the prompt via stdin (without "-" arg) when both are needed.
    let stdin;
    if (prompt && uncommitted) {
      stdin = prompt;
    } else if (prompt) {
      args.push(prompt);
    }
    const out = await runCodex(args, cwd, { stdin });
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
  },
  async ({ cwd, prompt }) => {
    const args = ["exec", "--dangerously-bypass-approvals-and-sandbox"];
    args.push(prompt);
    const out = await runCodex(args, cwd);
    return { content: [{ type: "text", text: out || "(no output)" }] };
  }
);

// ── Transport ─────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[codex-bridge] server running on stdio");
