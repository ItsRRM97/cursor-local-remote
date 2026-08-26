import { resolve } from "path";
import { isNoFolderPath } from "@/lib/workspace-paths";

/** Display label for a workspace path. */
export function workspaceDisplayName(workspace: string, _homeDir?: string): string {
  const norm = resolve(workspace.replace(/[/\\]+$/, "") || "/");
  if (isNoFolderPath(norm)) return "No folder";
  const parts = norm.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) || norm || "~";
}
