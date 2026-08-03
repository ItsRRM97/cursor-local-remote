import { listProjects } from "@/lib/transcript-reader";
import { listWorkspaces } from "@/lib/session-store";
import { getWorkspace, workspaceDisplayName } from "@/lib/workspace";
import { listFilesystemProjects, resolveAgentWorkspace } from "@/lib/mcp-workspace";
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
    const mcpWorkspace = await resolveAgentWorkspace(currentWorkspace);

    const byPath = new Map<string, ProjectInfo>();
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

    const projects = Array.from(byPath.values()).sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({
      projects,
      currentWorkspace,
      mcpWorkspace: mcpWorkspace !== currentWorkspace ? mcpWorkspace : null,
    });
  } catch {
    return serverError("Failed to list projects");
  }
}
