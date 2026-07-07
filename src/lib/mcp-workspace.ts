import { readFile, readdir } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { workspaceToProjectKey } from "@/lib/transcript-reader";

const PROJECTS_DIR = join(homedir(), "Projects");
const CLR_REPO = join(PROJECTS_DIR, "cursor-local-remote");

function projectDir(workspace: string): string {
  return join(homedir(), ".cursor", "projects", workspaceToProjectKey(workspace));
}

function mcpsDir(workspace: string): string {
  return join(projectDir(workspace), "mcps");
}

/** Count registered MCP tool descriptors for a Cursor workspace root. */
export async function countMcpTools(workspace: string): Promise<number> {
  try {
    const servers = await readdir(mcpsDir(workspace));
    let total = 0;
    for (const server of servers) {
      try {
        const tools = await readdir(join(mcpsDir(workspace), server, "tools"));
        total += tools.filter((f) => f.endsWith(".json")).length;
      } catch {
        // server has no tools dir
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/** OAuth access tokens in ~/.cursor/projects/<key>/mcp-auth.json (agent CLI auth). */
export async function countMcpAuthTokens(workspace: string): Promise<number> {
  const authPath = join(projectDir(workspace), "mcp-auth.json");
  if (!existsSync(authPath)) return 0;
  try {
    const raw = await readFile(authPath, "utf8");
    const data = JSON.parse(raw) as Record<string, { tokens?: { access_token?: string } }>;
    return Object.values(data).filter((entry) => Boolean(entry.tokens?.access_token)).length;
  } catch {
    return 0;
  }
}

export async function hasMcpCatalog(workspace: string): Promise<boolean> {
  return (await countMcpTools(workspace)) > 0;
}

async function mcpScore(workspace: string): Promise<number> {
  const [tools, tokens] = await Promise.all([countMcpTools(workspace), countMcpAuthTokens(workspace)]);
  if (tools === 0) return 0;
  // Prefer workspaces where headless agent CLI has completed OAuth (notion, etc.)
  return tools + tokens * 500;
}

const FALLBACK_CANDIDATES = [
  () => process.env.CLR_MCP_WORKSPACE?.trim(),
  () => CLR_REPO,
  () => PROJECTS_DIR,
];

/**
 * Pick a workspace root where the Cursor agent CLI can load and authenticate MCP servers.
 * Bare ~/Projects often has tool catalogs but no OAuth tokens; cursor-local-remote usually has both.
 */
export async function resolveAgentWorkspace(requested?: string): Promise<string> {
  const raw = requested?.trim() || process.env.CURSOR_WORKSPACE?.trim();
  const workspace = raw ? resolve(raw) : resolve(process.cwd());

  const candidates = new Set<string>([workspace]);
  for (const pick of FALLBACK_CANDIDATES) {
    const candidate = pick();
    if (candidate) candidates.add(resolve(candidate));
  }

  let best = workspace;
  let bestScore = await mcpScore(workspace);

  for (const candidate of candidates) {
    const score = await mcpScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export { PROJECTS_DIR, CLR_REPO };
