import { spawn, execFileSync, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { AgentMode } from "@/lib/types";
import { getConfig } from "@/lib/session-store";

let agentChecked = false;
let agentBinCache: string | null = null;

export function resolveAgentBin(): string {
  if (agentBinCache) return agentBinCache;
  const local = join(homedir(), ".local", "bin", "agent");
  agentBinCache = existsSync(local) ? local : "agent";
  return agentBinCache;
}

export function agentEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.CURSOR_AGENT;
  env.HOME = env.HOME || homedir();
  const localBin = join(homedir(), ".local", "bin");
  const path = env.PATH || "";
  if (!path.split(":").includes(localBin)) {
    env.PATH = `${localBin}:${path}`;
  }
  return env;
}

function ensureAgentOnPath(): void {
  if (agentChecked) return;
  try {
    execFileSync(resolveAgentBin(), ["--version"], { stdio: "ignore", timeout: 5_000, env: agentEnv() });
    agentChecked = true;
  } catch {
    throw new Error(
      "Could not find the 'agent' CLI. Make sure Cursor is installed and the CLI is on your PATH.",
    );
  }
}

export function classifyAgentStartError(stderr: string, timedOut: boolean): string {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
  const text = stderr.replace(ansi, "").trim();
  const lower = text.toLowerCase();
  if (
    lower.includes("authentication required") ||
    lower.includes("not logged in") ||
    lower.includes("unauthenticated") ||
    lower.includes("invalid or expired")
  ) {
    return "Cursor CLI is not authenticated. On the Mac, run: agent login";
  }
  if (text) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || text;
    return last.slice(0, 400);
  }
  if (timedOut) return "Agent failed to start (no session event in time)";
  return "Agent failed to start";
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

function sessionIdFromEvent(event: Record<string, unknown>): string | null {
  const id = event.session_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export interface SpawnedAgent {
  child: ChildProcess;
  stderr: () => string;
  waitForSessionId: (
    timeoutMs: number,
    onEvent?: (event: Record<string, unknown>) => void,
  ) => Promise<string | null>;
}

export async function spawnAgent(options: AgentOptions): Promise<SpawnedAgent> {
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

  const child = spawn(resolveAgentBin(), args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options.workspace || undefined,
    env: agentEnv(),
  });

  const stderrChunks: string[] = [];
  let stdoutBuffer = "";
  let foundId: string | null = null;
  const sessionWaiters: Array<(id: string) => void> = [];
  const eventListeners: Array<(event: Record<string, unknown>) => void> = [];

  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderrChunks.push(text);
    const trimmed = text.trim();
    if (trimmed) console.error("[agent stderr]", trimmed);
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as Record<string, unknown>;
        if (!foundId) {
          const id = sessionIdFromEvent(event);
          if (id) {
            foundId = id;
            for (const waiter of sessionWaiters) waiter(id);
            sessionWaiters.length = 0;
          }
        }
        for (const listener of eventListeners) listener(event);
      } catch {
        // non-json line
      }
    }
  });

  return {
    child,
    stderr: () => stderrChunks.join(""),
    waitForSessionId(timeoutMs, onEvent) {
      if (onEvent) eventListeners.push(onEvent);
      return new Promise((resolve) => {
        if (foundId) {
          resolve(foundId);
          return;
        }
        if (child.exitCode !== null) {
          resolve(null);
          return;
        }

        const onFound = (id: string) => {
          cleanup();
          resolve(id);
        };
        sessionWaiters.push(onFound);

        const timer = setTimeout(() => {
          cleanup();
          resolve(null);
        }, timeoutMs);

        const onDone = () => {
          if (foundId) return;
          cleanup();
          resolve(null);
        };
        child.once("close", onDone);
        child.once("error", onDone);

        function cleanup() {
          clearTimeout(timer);
          child.off("close", onDone);
          child.off("error", onDone);
          const idx = sessionWaiters.indexOf(onFound);
          if (idx >= 0) sessionWaiters.splice(idx, 1);
        }
      });
    },
  };
}
