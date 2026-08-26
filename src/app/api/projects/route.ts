import { resolve } from "node:path";
import { listWorkspaces } from "@/lib/session-store";
import { getWorkspace, workspaceDisplayName } from "@/lib/workspace";
import { listCursorWorkspaces } from "@/lib/cursor-workspaces";
import { listFilesystemProjects, noFolderProjectInfo } from "@/lib/mcp-workspace";
import { serverError } from "@/lib/errors";
import type { ProjectInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

const RECENT_LIMIT = 8;

function mergeProject(existing: ProjectInfo | undefined, incoming: ProjectInfo): ProjectInfo {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    name: incoming.name || existing.name,
    displayPath: incoming.displayPath ?? existing.displayPath,
    lastUsedAt: Math.max(existing.lastUsedAt ?? 0, incoming.lastUsedAt ?? 0) || undefined,
  };
}

export async function GET() {
  try {
    const [cursorProjects, dbWorkspaces, filesystemProjects] = await Promise.all([
      listCursorWorkspaces(),
      listWorkspaces(),
      process.env.CLR_PROJECT_ROOTS_FALLBACK === "1"
        ? listFilesystemProjects()
        : Promise.resolve([] as ProjectInfo[]),
    ]);
    const currentWorkspace = getWorkspace();
    const mcpOverride = process.env.CLR_MCP_WORKSPACE?.trim();
    const resolvedMcp = mcpOverride ? resolve(mcpOverride) : null;

    const byPath = new Map<string, ProjectInfo>();
    const noFolder = noFolderProjectInfo();
    byPath.set(noFolder.path, noFolder);

    for (const p of cursorProjects) {
      byPath.set(p.path, mergeProject(byPath.get(p.path), p));
    }
    for (const ws of dbWorkspaces) {
      if (byPath.has(ws)) continue;
      byPath.set(ws, { name: workspaceDisplayName(ws), path: ws, key: ws });
    }
    for (const p of filesystemProjects) {
      if (!byPath.has(p.path)) byPath.set(p.path, p);
    }
    if (!byPath.has(currentWorkspace)) {
      byPath.set(currentWorkspace, {
        name: workspaceDisplayName(currentWorkspace),
        path: currentWorkspace,
        key: currentWorkspace,
      });
    }

    const all = Array.from(byPath.values());
    const noFolderPath = noFolder.path;

    const folderProjects = all
      .filter((p) => p.path !== noFolderPath)
      .sort((a, b) => {
        const ta = a.lastUsedAt ?? 0;
        const tb = b.lastUsedAt ?? 0;
        if (tb !== ta) return tb - ta;
        return a.name.localeCompare(b.name);
      });

    const recentPaths = new Set<string>();
    const recent: ProjectInfo[] = [];
    for (const p of folderProjects) {
      if (recent.length >= RECENT_LIMIT) break;
      if (recentPaths.has(p.path)) continue;
      recentPaths.add(p.path);
      recent.push(p);
    }

    const projects = [noFolder, ...folderProjects];

    return Response.json({
      projects,
      recent,
      currentWorkspace,
      noFolderPath,
      mcpWorkspace:
        resolvedMcp && resolvedMcp !== currentWorkspace ? resolvedMcp : null,
    });
  } catch {
    return serverError("Failed to list projects");
  }
}
