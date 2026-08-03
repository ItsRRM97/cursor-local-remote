/** Display label for a workspace path (matches Cursor IDE "Home" for ~). */
export function workspaceDisplayName(workspace: string, homeDir?: string): string {
  const norm = workspace.replace(/[/\\]+$/, "") || "/";
  if (homeDir) {
    const homeNorm = homeDir.replace(/[/\\]+$/, "") || "/";
    if (norm === homeNorm) return "Home";
  } else {
    const parts = norm.split(/[/\\]/).filter(Boolean);
    // /Users/<name> or /home/<name>
    if (parts.length === 2 && (parts[0] === "Users" || parts[0] === "home")) {
      return "Home";
    }
  }
  const parts = norm.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) || norm || "~";
}
