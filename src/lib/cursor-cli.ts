import { spawn, execFileSync, type ChildProcess } from "child_process";
import type { AgentMode } from "@/lib/types";
import { getConfig } from "@/lib/session-store";

let agentChecked = false;

function ensureAgentOnPath(): void {
  if (agentChecked) return;
  try {
    execFileSync("agent", ["--version"], { stdio: "ignore", timeout: 5_000 });
    agentChecked = true;
  } catch {
    throw new Error(
      "Could not find the 'agent' CLI. Make sure Cursor is installed and the CLI is on your PATH.",
    );
  }
}

export interface AgentOptions {
  prompt: string;
  sessionId?: string;
  workspace?: string;
  model?: string;
  mode?: AgentMode;
}

async function shouldTrust(): Promise<boolean> {
  if (process.env.CURSOR_TRUST === "0") return false;
  if (process.env.CURSOR_TRUST === "1") return true;
  const val = await getConfig("trust");
  return val !== "0";
}

/** Headless agent still prompts per MCP tool call unless --force is set. */
function shouldForce(): boolean {
  if (process.env.CURSOR_FORCE === "0") return false;
  if (process.env.CURSOR_FORCE === "1") return true;
  return true;
}


async function resolveAgentModel(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;
  const fromEnv = process.env.CURSOR_DEFAULT_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const fromConfig = await getConfig("default_model");
  if (fromConfig) return fromConfig;
  return undefined;
}

export async function spawnAgent(options: AgentOptions): Promise<ChildProcess> {
  ensureAgentOnPath();
  const args = ["-p", options.prompt, "--output-format", "stream-json", "--stream-partial-output"];

  if (await shouldTrust()) {
    args.push("--trust");
    args.push("--approve-mcps");
    if (shouldForce()) {
      args.push("--force");
    }
  }
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (options.workspace) {
    args.push("--workspace", options.workspace);
  }
  const model = await resolveAgentModel(options.model);
  if (model) {
    args.push("--model", model);
  }
  if (options.mode && options.mode !== "agent") {
    args.push("--mode", options.mode);
  }

  return spawn("agent", args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });
}

