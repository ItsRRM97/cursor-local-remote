import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";
import { getNoFolderDir } from "@/lib/workspace-paths";

export { isNoFolderPath } from "@/lib/workspace-paths";

/** Absolute path to the No folder scratch workspace. */
export const NO_FOLDER_DIR = getNoFolderDir(homedir());

export function ensureNoFolderDir(): string {
  if (!existsSync(NO_FOLDER_DIR)) {
    mkdirSync(NO_FOLDER_DIR, { recursive: true });
  }
  return resolve(NO_FOLDER_DIR);
}
