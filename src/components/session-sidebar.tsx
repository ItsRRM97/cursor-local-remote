"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { StoredSession, ProjectInfo } from "@/lib/types";
import { useHaptics } from "@/hooks/use-haptics";
import { apiFetch } from "@/lib/api-fetch";
import { timeAgo, formatSessionTitle } from "@/lib/format";
import { RefreshIcon, CloseIcon, PlusIcon, Spinner, TrashIcon, ChevronDown, CheckIcon } from "./icons";

interface SessionSidebarProps {
  open: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (id: string, workspace?: string) => void;
  onNewSession: (workspace?: string) => void;
  onWorkspaceChange?: (workspace: string | null) => void;
  activeStatuses?: Record<string, "streaming" | "idle">;
  workspaceTerminals?: Record<string, number>;
}

function StatusIndicator({ status }: { status: "streaming" | "idle" }) {
  if (status === "streaming") {
    return (
      <span className="shrink-0 w-2 h-2 rounded-full border-[1.5px] border-success border-t-transparent animate-spin" />
    );
  }
  return <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-text-muted/40" />;
}

function ArchiveIcon({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function UnarchiveIcon({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <polyline points="12 15 12 10" />
      <polyline points="9 12 12 9 15 12" />
    </svg>
  );
}

const PROJECT_STORAGE_KEY = "clr-selected-project";
const STARRED_STORAGE_KEY = "clr-starred-projects"; // localStorage fallback key

function StarIcon({ size = 12, filled = false, className = "" }: { size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function loadStarredLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STARRED_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveStarred(paths: string[]) {
  localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(paths));
  apiFetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starred_projects: JSON.stringify(paths) }),
  }).catch(() => {});
}

function SessionTooltip({ session, children }: { session: StoredSession; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setVisible(true);
  };

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setVisible(false)}
      className="relative"
    >
      {children}
      {visible && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="relative -translate-x-1/2 -translate-y-full -mt-1.5 max-w-[240px] px-3 py-2.5 rounded-md min-h-[var(--clr-touch-min)] bg-bg-elevated border border-border shadow-lg">
            <p className="text-clr-xs text-text leading-snug break-words">{formatSessionTitle(session)}</p>
            {session.preview && session.preview !== session.title && (
              <p className="text-clr-2xs text-text-muted mt-0.5 leading-snug break-words line-clamp-3">{session.preview}</p>
            )}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-border" />
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionSidebar({
  open,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onWorkspaceChange,
  activeStatuses = {},
  workspaceTerminals = {},
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [starred, setStarred] = useState<string[]>([]);
  const haptics = useHaptics();

  useEffect(() => {
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    const localStars = loadStarredLocal();
    setSelectedProject(stored); // eslint-disable-line react-hooks/set-state-in-effect
    setStarred(localStars); // eslint-disable-line react-hooks/set-state-in-effect

    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const serverStars = data.settings?.starred_projects;
        if (serverStars) {
          try {
            const parsed: string[] = JSON.parse(serverStars);
            if (parsed.length > 0 || localStars.length === 0) {
              setStarred(parsed);
              localStorage.setItem(STARRED_STORAGE_KEY, serverStars);
            }
          } catch { /* ignore bad json */ }
        } else if (localStars.length > 0) {
          saveStarred(localStars);
        }
      })
      .catch(() => {});
  }, []);

  const toggleStar = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setStarred((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      saveStarred(next);
      return next;
    });
  }, []);

  const fetchProjects = useCallback(() => {
    apiFetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        if (selectedProject) return;
        const preferred = data.mcpWorkspace || data.currentWorkspace;
        if (preferred) {
          setSelectedProject(preferred);
          localStorage.setItem(PROJECT_STORAGE_KEY, preferred);
          onWorkspaceChange?.(preferred);
        }
      })
      .catch(() => {});
  }, [selectedProject, onWorkspaceChange]);

  const fetchSessions = useCallback(() => {
    setFetchError(null);
    const params = new URLSearchParams();
    if (selectedProject === "__all__") {
      params.set("all", "true");
    } else if (selectedProject) {
      params.set("workspace", selectedProject);
    }
    if (showArchived) {
      params.set("archived", "true");
    }
    const qs = params.toString();
    return apiFetch("/api/sessions" + (qs ? "?" + qs : ""))
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setFetchError("Failed to load sessions"));
  }, [selectedProject, showArchived]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- loading state for fetch
    setConfirmingDelete(null);
    fetchProjects();
    fetchSessions().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, fetchSessions, fetchProjects]);

  const handleProjectSelect = useCallback((path: string) => {
    setSelectedProject(path);
    localStorage.setItem(PROJECT_STORAGE_KEY, path);
    setProjectDropdownOpen(false);
    if (path !== "__all__") {
      onWorkspaceChange?.(path);
    }
  }, [onWorkspaceChange]);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirmingDelete === sessionId) {
      haptics.error();
      apiFetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(() => fetchSessions())
        .catch(() => setFetchError("Failed to delete session"))
        .finally(() => setConfirmingDelete(null));
    } else {
      haptics.warn();
      setConfirmingDelete(sessionId);
    }
  };

  const handleArchiveClick = (e: React.MouseEvent, session: StoredSession) => {
    e.stopPropagation();
    haptics.tap();
    apiFetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: showArchived ? "unarchive" : "archive", sessionId: session.id, workspace: session.workspace }),
    })
      .then(() => fetchSessions())
      .catch(() => setFetchError("Failed to update session"));
  };

  const handleArchiveAll = () => {
    haptics.warn();
    const workspace = selectedProject === "__all__" ? undefined : selectedProject || undefined;
    apiFetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive_all", workspace }),
    })
      .then(() => fetchSessions())
      .catch(() => setFetchError("Failed to archive sessions"));
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDelete(null);
  };

  const currentProjectName = selectedProject === "__all__"
    ? "All projects"
    : projects.find((p) => p.path === selectedProject)?.name
      || selectedProject?.split("/").pop()
      || "Current project";

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="Session history"
        aria-hidden={!open}
        className={`fixed inset-0 z-50 bg-bg-elevated transform transition-transform duration-150 flex flex-col sm:inset-auto sm:top-0 sm:left-0 sm:h-full sm:w-[280px] sm:border-r sm:border-border ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between header-bar px-3 border-b border-border shrink-0">
          <span className="text-clr-base font-medium text-text-secondary">Sessions</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                haptics.tap();
                setLoading(true);
                fetchSessions().finally(() => setLoading(false));
              }}
              disabled={loading}
              aria-label="Refresh sessions"
              className="icon-btn hover:bg-bg-hover text-text-muted hover:text-text-secondary disabled:opacity-40"
            >
              <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              className="icon-btn hover:bg-bg-hover text-text-muted hover:text-text-secondary"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <div className="px-2 pt-2 pb-1 space-y-1 shrink-0">
          <button
            onClick={() => {
              const ws = selectedProject && selectedProject !== "__all__" ? selectedProject : undefined;
              onNewSession(ws);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md min-h-[var(--clr-touch-min)] text-clr-sm text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <PlusIcon />
            New session
          </button>

          <div className="px-1">
            <p className="text-clr-2xs text-text-muted uppercase tracking-wider px-2 mb-1">
              Current project
            </p>
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-md min-h-[var(--clr-touch-min)] bg-bg-active border border-border"
              aria-current="true"
            >
              <CheckIcon size={14} className="text-accent shrink-0" />
              <span className="text-clr-sm font-medium text-text truncate flex-1" title={currentProjectName}>
                {currentProjectName}
              </span>
            </div>
          </div>

          {starred.length > 0 && (
            <div className="space-y-px">
              <p className="text-clr-2xs text-text-muted uppercase tracking-wider px-3 pt-1 pb-0.5">
                Starred
              </p>
              {starred.map((path) => {
                const proj = projects.find((p) => p.path === path);
                const name = proj?.name || path.split("/").pop() || path;
                const isActive = selectedProject === path;
                const termCount = workspaceTerminals[path] || 0;
                return (
                  <button
                    key={path}
                    onClick={() => handleProjectSelect(path)}
                    aria-current={isActive ? "true" : undefined}
                    className={`w-full flex items-center gap-1.5 px-3 py-2.5 rounded-md min-h-[var(--clr-touch-min)] text-clr-sm transition-colors ${
                      isActive
                        ? "project-picker-active bg-bg-active text-text"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                    }`}
                  >
                    {isActive ? (
                      <CheckIcon size={12} className="shrink-0 text-accent" />
                    ) : (
                      <StarIcon size={10} filled className="shrink-0 text-text-secondary" />
                    )}
                    <span className="truncate flex-1 text-left">{name}</span>
                    {termCount > 0 && (
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-success" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => {
                haptics.tap();
                setProjectDropdownOpen((v) => !v);
              }}
              aria-expanded={projectDropdownOpen}
              aria-haspopup="listbox"
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md min-h-[var(--clr-touch-min)] text-clr-sm text-text-secondary hover:text-text hover:bg-bg-hover border border-border/60 transition-colors"
            >
              <span>Browse all projects</span>
              <ChevronDown className={projectDropdownOpen ? "rotate-180" : ""} />
            </button>
            {projectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-elevated border border-border rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => handleProjectSelect("__all__")}
                    className={`w-full text-left px-3 py-2.5 min-h-[var(--clr-touch-min)] text-clr-sm transition-colors flex items-center gap-2 ${
                      selectedProject === "__all__"
                        ? "project-picker-active text-text bg-bg-active"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text"
                    }`}
                  >
                    {selectedProject === "__all__" && (
                      <CheckIcon size={12} className="shrink-0 text-accent" />
                    )}
                    <span>All projects</span>
                  </button>
                  <div className="h-px bg-border mx-2 my-1" />
                  {projects.map((p) => {
                    const termCount = workspaceTerminals[p.path] || 0;
                    return (
                      <button
                        key={p.key}
                        onClick={() => handleProjectSelect(p.path)}
                        className={`w-full text-left px-3 py-2.5 min-h-[var(--clr-touch-min)] text-clr-sm transition-colors flex items-center gap-2 ${
                          selectedProject === p.path
                            ? "project-picker-active text-text bg-bg-active"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text"
                        }`}
                      >
                        {selectedProject === p.path && (
                          <CheckIcon size={12} className="shrink-0 text-accent" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{p.name}</span>
                            {termCount > 0 && (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-success" />
                            )}
                          </div>
                          <span className="block text-clr-2xs text-text-muted font-mono truncate">{p.path}</span>
                        </div>
                        <span
                          onClick={(e) => toggleStar(e, p.path)}
                          className={`shrink-0 p-0.5 rounded hover:bg-bg-active transition-colors ${
                            starred.includes(p.path) ? "text-text-secondary" : "text-text-muted/30 hover:text-text-muted"
                          }`}
                          role="button"
                          aria-label={starred.includes(p.path) ? "Unstar project" : "Star project"}
                        >
                          <StarIcon size={12} filled={starred.includes(p.path)} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                haptics.tap();
                setShowArchived((v) => !v);
              }}
              aria-pressed={showArchived}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-md min-h-[var(--clr-touch-min)] text-clr-sm transition-colors ${
                showArchived
                  ? "text-text bg-bg-active"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <ArchiveIcon />
              {showArchived ? "Archived" : "Archive"}
            </button>
            {!showArchived && sessions.length > 0 && (
              <button
                onClick={handleArchiveAll}
                title="Archive all visible sessions"
                className="px-2 py-1.5 rounded-md text-clr-2xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors whitespace-nowrap"
              >
                Archive all
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {fetchError && (
            <div className="mx-1 mb-2 px-2.5 py-2 rounded-md bg-error/10 text-error text-clr-xs">
              {fetchError}
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 justify-center py-8 text-text-muted text-clr-sm">
              <Spinner />
            </div>
          ) : sessions.length === 0 && !fetchError ? (
            <p className="text-text-muted text-clr-sm text-center py-8">
              {showArchived ? "No archived sessions" : "No sessions"}
            </p>
          ) : (
            sessions.map((s) => {
              const status = activeStatuses[s.id];
              return (
                <SessionTooltip key={s.id} session={s}>
                  <div className="relative mb-px">
                    <button
                      onClick={() => {
                        haptics.select();
                        onSelectSession(s.id, s.workspace);
                        onClose();
                      }}
                      aria-current={s.id === currentSessionId ? "true" : undefined}
                      className={`group w-full text-left px-3 py-3 rounded-md transition-colors min-h-[var(--clr-touch-min)] ${
                        s.id === currentSessionId
                          ? "bg-bg-active text-text"
                          : "hover:bg-bg-hover text-text-secondary"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 pr-10 sm:pr-12">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {status && <StatusIndicator status={status} />}
                          <p className="text-clr-sm truncate">{formatSessionTitle(s)}</p>
                        </div>
                        <span className="text-clr-2xs text-text-muted shrink-0 tabular-nums whitespace-nowrap pt-0.5">
                          {timeAgo(s.updatedAt)}
                        </span>
                      </div>
                      {selectedProject === "__all__" && (
                        <p className="text-clr-2xs text-text-muted mt-0.5 font-mono truncate">
                          {s.workspace.split("/").pop()}
                        </p>
                      )}
                    </button>

                    {confirmingDelete === s.id ? (
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        <button
                          onClick={(e) => handleDeleteClick(e, s.id)}
                          className="px-2 py-1 rounded text-clr-2xs font-medium bg-error/15 text-error hover:bg-error/25 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          aria-label="Cancel delete"
                          className="icon-btn text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
                        >
                          <CloseIcon size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => handleArchiveClick(e, s)}
                          aria-label={showArchived ? "Unarchive session" : "Archive session"}
                          className="p-1.5 rounded hover:bg-bg-surface text-text-muted hover:text-text-secondary transition-colors"
                        >
                          {showArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, s.id)}
                          aria-label="Delete session"
                          className="p-1.5 rounded hover:bg-bg-surface text-text-muted hover:text-error transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </SessionTooltip>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
