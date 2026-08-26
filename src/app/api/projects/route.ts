import { resolve } from "node:path";
import { listProjects } from "@/lib/transcript-reader";
import { listWorkspaces } from "@/lib/session-store";
import { getWorkspace, workspaceDisplayName } from "@/lib/workspace";
import { listFilesystemProjects, noFolderProjectInfo } from "@/lib/mcp-workspace";
import { serverError } from "@/lib/errors";
import type { ProjectInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [transcriptProjects, dbWorkspaces, filesystemProjects] = await Promise.all([
      listProjects(),
      listWorkspaces(),
      listFilesystemProjects(),
    ]);
    const currentWorkspace = getWorkspace();
    const mcpOverride = process.env.CLR_MCP_WORKSPACE?.trim();
    const resolvedMcp = mcpOverride ? resolve(mcpOverride) : null;

    const byPath = new Map<string, ProjectInfo>();
    const noFolder = noFolderProjectInfo();
    byPath.set(noFolder.path, noFolder);

    for (const p of transcriptProjects) {
      byPath.set(p.path, p);
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

    const projects = Array.from(byPath.values()).sort((a, b) => {
      if (a.path === noFolder.path) return -1;
      if (b.path === noFolder.path) return 1;
      return a.name.localeCompare(b.name);
    });

    return Response.json({
      projects,
      currentWorkspace,
      noFolderPath: noFolder.path,
      mcpWorkspace:
        resolvedMcp && resolvedMcp !== currentWorkspace ? resolvedMcp : null,
    });
  } catch {
    return serverError("Failed to list projects");
  }
}
