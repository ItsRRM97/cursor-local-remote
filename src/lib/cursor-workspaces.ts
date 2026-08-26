import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve, basename } from "path";
import type { ProjectInfo } from "@/lib/types";
import { workspaceToProjectKey } from "@/lib/transcript-reader";
import { vlog } from "@/lib/verbose";

export interface CursorWorkspaceEntry extends ProjectInfo {
  displayPath?: string;
  lastUsedAt?: number;
}

function defaultStateDbPath(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Cursor",
    "User",
    "globalStorage",
    "state.vscdb",
  );
}

function stateDbPath(): string {
  const fromEnv = process.env.CLR_CURSOR_STATE_DB?.trim();
  return fromEnv ? resolve(fromEnv) : defaultStateDbPath();
}

function sqliteQuote(key: string): string {
  return `'${key.replace(/'/g, "''")}'`;
}

/** Read one ItemTable JSON blob without loading the whole vscdb (file can be multi-GB). */
function readItemJson(key: string): unknown {
  const dbPath = stateDbPath();
  if (!existsSync(dbPath)) return null;

  try {
    const raw = execFileSync(
      "sqlite3",
      [dbPath, `SELECT value FROM ItemTable WHERE key=${sqliteQuote(key)}`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ).trim();
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch (err) {
    vlog("cursor-workspaces", "sqlite3 query failed", key, String(err));
    return null;
  }
}

function decodeFolderUri(uri: unknown): string | null {
  if (!uri || typeof uri !== "string") return null;
  if (!uri.startsWith("file://")) return null;
  try {
    const decoded = decodeURIComponent(uri.replace(/^file:\/\//, ""));
    return resolve(decoded);
  } catch {
    return null;
  }
}

function pathFromUriObject(uri: unknown): string | null {
  if (!uri || typeof uri !== "object") return null;
  const obj = uri as { fsPath?: string; external?: string; path?: string };
  if (obj.fsPath) return resolve(obj.fsPath);
  if (obj.external) return decodeFolderUri(obj.external);
  if (obj.path) return resolve(obj.path);
  return null;
}

function expandDisplayPath(displayPath: string): string {
  if (displayPath.startsWith("~/")) {
    return resolve(homedir(), displayPath.slice(2));
  }
  return resolve(displayPath);
}

function recencyFromAdditionalProjects(data: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(data)) return map;
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      type?: string;
      lastUsedAt?: number;
      displayPath?: string;
      workspaceIdentifier?: { uri?: unknown };
    };
    if (row.type !== "workspace") continue;
    const path =
      pathFromUriObject(row.workspaceIdentifier?.uri) ??
      (row.displayPath ? expandDisplayPath(row.displayPath) : null);
    if (!path || !row.lastUsedAt) continue;
    map.set(path, Math.max(map.get(path) ?? 0, row.lastUsedAt));
  }
  return map;
}

function recencyFromRecentPaths(data: unknown): Map<string, number> {
  const map = new Map<string, number>();
  const entries = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { entries?: unknown[] }).entries)
      ? (data as { entries: unknown[] }).entries
      : [];
  let rank = entries.length;
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const row = item as { folderUri?: string };
    const path = decodeFolderUri(row.folderUri);
    if (!path) continue;
    const score = rank * 1_000;
    map.set(path, Math.max(map.get(path) ?? 0, score));
    rank -= 1;
  }
  return map;
}

function removedWorkspacePaths(data: unknown): Set<string> {
  const removed = new Set<string>();
  if (!Array.isArray(data)) return removed;
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      type?: string;
      displayPath?: string;
      workspaceIdentifier?: { uri?: unknown };
    };
    if (row.type !== "workspace") continue;
    const path =
      pathFromUriObject(row.workspaceIdentifier?.uri) ??
      (row.displayPath ? expandDisplayPath(row.displayPath) : null);
    if (path) removed.add(path);
  }
  return removed;
}

function labelForPath(path: string, displayPath?: string): string {
  if (resolve(path) === resolve(homedir())) return "Home";
  if (displayPath?.startsWith("~/")) {
    const short = displayPath.slice(2);
    const base = basename(short);
    return base || short;
  }
  if (displayPath && displayPath !== path) {
    return basename(displayPath) || displayPath;
  }
  return basename(path) || path;
}

/** Folder workspaces from Cursor IDE (matches the desktop project list). */
export async function listCursorWorkspaces(): Promise<CursorWorkspaceEntry[]> {
  const metadata = readItemJson("workspaceMetadata.entries") as { entries?: unknown[] } | null;
  if (!metadata?.entries?.length) return [];

  const additional = readItemJson("cursor/glass.additionalProjects");
  const removed = readItemJson("cursor/glass.removedProjects");
  const recent = readItemJson("history.recentlyOpenedPathsList");

  const removedPaths = removedWorkspacePaths(removed);
  const recency = new Map<string, number>();
  for (const [path, ts] of recencyFromAdditionalProjects(additional)) {
    recency.set(path, ts);
  }
  for (const [path, ts] of recencyFromRecentPaths(recent)) {
    recency.set(path, Math.max(recency.get(path) ?? 0, ts));
  }

  const byPath = new Map<string, CursorWorkspaceEntry>();

  for (const raw of metadata.entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as {
      folderUri?: string;
      displayPath?: string;
      paths?: Array<{ uri?: unknown; displayPath?: string }>;
    };

    const path =
      decodeFolderUri(entry.folderUri) ??
      pathFromUriObject(entry.paths?.[0]?.uri) ??
      (entry.displayPath ? expandDisplayPath(entry.displayPath) : null);

    if (!path || removedPaths.has(path)) continue;
    if (!existsSync(path)) continue;

    const displayPath = entry.displayPath ?? entry.paths?.[0]?.displayPath;
    byPath.set(path, {
      name: labelForPath(path, displayPath),
      path,
      key: workspaceToProjectKey(path),
      displayPath,
      lastUsedAt: recency.get(path) ?? 0,
    });
  }

  return Array.from(byPath.values()).sort((a, b) => {
    const ta = a.lastUsedAt ?? 0;
    const tb = b.lastUsedAt ?? 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

/** Known workspace paths from Cursor (for transcript key decoding). */
export async function knownCursorWorkspacePaths(): Promise<string[]> {
  const workspaces = await listCursorWorkspaces();
  return workspaces.map((w) => w.path);
}
