import { join, resolve } from "path";

/** Relative path under home for the No folder scratch workspace. */
export const NO_FOLDER_REL = join(".cursor-local-remote", "no-folder");

export function getNoFolderDir(homeDir: string): string {
  return resolve(homeDir, NO_FOLDER_REL);
}

/** True when workspace is the No folder scratch dir. */
export function isNoFolderPath(workspace: string, homeDir?: string): boolean {
  const norm = resolve((workspace || "/").replace(/[/\\]+$/, "") || "/");
  if (homeDir) {
    return norm === getNoFolderDir(homeDir);
  }
  return norm.replace(/\\/g, "/").endsWith("/.cursor-local-remote/no-folder");
}
