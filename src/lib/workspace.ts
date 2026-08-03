import { resolve } from "path";
import { homedir } from "os";
import { workspaceDisplayName as displayName } from "@/lib/workspace-name";

export function getWorkspace(): string {
  const fromEnv = process.env.CURSOR_WORKSPACE;
  if (fromEnv) return resolve(fromEnv);
  return process.cwd();
}

/** Label for the home directory workspace (matches Cursor IDE "Home"). */
export function workspaceDisplayName(workspace: string): string {
  return displayName(workspace, homedir());
}
