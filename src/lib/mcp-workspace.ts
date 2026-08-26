import { readFile, readdir } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { workspaceToProjectKey } from "@/lib/transcript-reader";
import { workspaceDisplayName } from "@/lib/workspace";
import { ensureNoFolderDir, isNoFolderPath } from "@/lib/workspace-paths.server";
import type { ProjectInfo } from "@/lib/types";

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

/**
 * Agent workspace for MCP/tool loading. Uses the requested folder unless
 * CLR_MCP_WORKSPACE overrides (for headless OAuth on a specific project).
 */
export async function resolveAgentWorkspace(requested?: string): Promise<string> {
  const override = process.env.CLR_MCP_WORKSPACE?.trim();
  if (override) return resolve(override);

  const raw = requested?.trim() || process.env.CURSOR_WORKSPACE?.trim();
  if (raw) return resolve(raw);
  return ensureNoFolderDir();
}

function projectScanRoots(): string[] {
  const roots: string[] = [];
  const fromEnv = process.env.CLR_PROJECT_ROOTS?.split(":").map((s) => s.trim()).filter(Boolean);
  if (fromEnv && fromEnv.length > 0) {
    roots.push(...fromEnv);
  } else {
    const projectsDir = join(homedir(), "Projects");
    if (existsSync(projectsDir)) roots.push(projectsDir);
  }
  return roots.map((r) => resolve(r));
}

/** Top-level folders under CLR_PROJECT_ROOTS (or ~/Projects when unset). */
export async function listFilesystemProjects(): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];
  const seen = new Set<string>();

  for (const root of projectScanRoots()) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const path = resolve(join(root, entry.name));
        if (seen.has(path) || isNoFolderPath(path)) continue;
        seen.add(path);
        projects.push({
          name: workspaceDisplayName(path),
          path,
          key: workspaceToProjectKey(path),
        });
      }
    } catch {
      // root missing or unreadable
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export function noFolderProjectInfo(): ProjectInfo {
  const path = ensureNoFolderDir();
  return {
    name: "No folder",
    path,
    key: workspaceToProjectKey(path),
  };
}
