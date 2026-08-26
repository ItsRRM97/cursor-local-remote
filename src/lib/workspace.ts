import { resolve } from "path";
import { workspaceDisplayName as displayName } from "@/lib/workspace-name";
import { ensureNoFolderDir } from "@/lib/workspace-paths.server";

export { NO_FOLDER_DIR, ensureNoFolderDir, isNoFolderPath } from "@/lib/workspace-paths.server";
export { getNoFolderDir } from "@/lib/workspace-paths";

export function getWorkspace(): string {
  const fromEnv = process.env.CURSOR_WORKSPACE;
  if (fromEnv) return resolve(fromEnv);
  return ensureNoFolderDir();
}

export function workspaceDisplayName(workspace: string): string {
  return displayName(workspace);
}
