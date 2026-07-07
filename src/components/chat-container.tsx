"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useChat } from "@/hooks/use-chat";
import { useHaptics } from "@/hooks/use-haptics";
import { useSound } from "@/hooks/use-sound";
import { useNotification } from "@/hooks/use-notification";
import { apiFetch } from "@/lib/api-fetch";
import { vlog } from "@/lib/verbose";
import type { StoredSession } from "@/lib/types";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { exportSessionMarkdown } from "@/lib/export";
import { MenuIcon, SettingsIcon, ExportIcon, CheckIcon, GitBranchIcon, CloseIcon, TerminalIcon } from "./icons";
import { GitPanel } from "./git-panel";
import { TerminalPanel } from "./terminal-panel";

interface ChatContainerProps {
  initialSessionId?: string;
  initialWorkspace?: string;
  defaultModel?: string;
  onLabelChange?: (label: string) => void;
  onStreamingChange?: (streaming: boolean) => void;
  onSessionIdChange?: (sessionId: string | null) => void;
  onSelectSession?: (id: string, workspace?: string) => void;
  onOpenSidebar?: () => void;
  onOpenSettings?: () => void;
  onOpenQr?: () => void;
}

export function ChatContainer({
  initialSessionId,
  initialWorkspace,
  defaultModel,
  onLabelChange,
  onStreamingChange,
  onSessionIdChange,
  onSelectSession,
  onOpenSidebar,
  onOpenSettings,
  onOpenQr,
}: ChatContainerProps) {
  const [workspace, setWorkspace] = useState<string>(initialWorkspace || "");
  const [mcpFallback, setMcpFallback] = useState(false);

  const {
    messages,
    toolCalls,
    sessionId,
    isStreaming,
    isLoadingHistory,
    isWatching,
    model,
    selectedModel,
    selectedMode,
    error,
    sendMessage,
    loadSession,
    setSelectedModel,
    setSelectedMode,
    stopStreaming,
    retryLastMessage,
    queuedMessages,
    forceSendQueued,
    editQueued,
    deleteQueued,
  } = useChat(defaultModel, initialWorkspace, workspace || undefined);

  const haptics = useHaptics();
  const sound = useSound();
  const notification = useNotification();
  const [recentSessions, setRecentSessions] = useState<StoredSession[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [exportCopied, setExportCopied] = useState(false);
  const [gitInfo, setGitInfo] = useState<{ branch: string; changedFiles: number } | null>(null);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalCount, setTerminalCount] = useState(0);
  const terminalPollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const prevMsgCountRef = useRef(0);
  const loadedInitialRef = useRef(false);
  const prevStreamingRef = useRef(false);
  const streamStartRef = useRef(0);

  useEffect(() => {
    if (initialSessionId && !loadedInitialRef.current) {
      loadedInitialRef.current = true;
      vlog("container", "loading initial session", { initialSessionId, initialWorkspace });
      loadSession(initialSessionId, initialWorkspace);
    }
  }, [initialSessionId, initialWorkspace, loadSession]);

  const fetchWorkspace = useCallback(() => {
    if (initialWorkspace) {
      setWorkspace(initialWorkspace);
      return;
    }
    apiFetch("/api/info")
      .then((r) => r.json())
      .then((data) => {
        const ws = data.mcpWorkspace || data.workspace || "";
        setWorkspace(ws);
        setMcpFallback(Boolean(data.mcpWorkspace));
      })
      .catch((err) => console.error("[workspace] Failed to fetch:", err));
  }, [initialWorkspace]);

  useEffect(() => {
    fetchWorkspace();
    apiFetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions?.length > 0) setRecentSessions(data.sessions.slice(0, 3));
      })
      .catch((err) => console.error("[sessions] Failed to fetch:", err));
  }, [fetchWorkspace]);

  useEffect(() => {
    const assistantMsgs = messages.filter((m) => m.role === "assistant").length;
    if (assistantMsgs > prevMsgCountRef.current && assistantMsgs > 0) {
      haptics.tap();
    }
    prevMsgCountRef.current = assistantMsgs;
  }, [messages, haptics]);

  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      streamStartRef.current = Date.now();
      notification.dismiss();
    }
    if (prevStreamingRef.current && !isStreaming) {
      const duration = Date.now() - streamStartRef.current;
      const longEnough = duration > 3000;
      const elapsedSec = Math.floor(duration / 1000);
      if (error) {
        if (longEnough || document.hidden) sound.playError();
      } else {
        if (longEnough || document.hidden) sound.playComplete();
      }
      if (document.hidden) {
        notification.notify(error ? "error" : "complete", elapsedSec);
      }
    }
    prevStreamingRef.current = isStreaming;
    onStreamingChange?.(isStreaming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, error]);

  useEffect(() => {
    if (!isStreaming) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - streamStartRef.current) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  useEffect(() => {
    onSessionIdChange?.(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      onLabelChange?.(firstUser.content.slice(0, 50));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleExport = useCallback(async () => {
    const md = exportSessionMarkdown(messages, toolCalls);
    try {
      await navigator.clipboard.writeText(md);
      haptics.tap();
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 1500);
    } catch {
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${sessionId?.slice(0, 8) || "export"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [messages, toolCalls, sessionId, haptics]);

  const fetchTerminalCount = useCallback(() => {
    apiFetch("/api/terminal")
      .then((r) => r.json())
      .then((data) => {
        const all: { cwd: string }[] = data.terminals || [];
        const count = workspace ? all.filter((t) => t.cwd === workspace).length : all.length;
        setTerminalCount(count);
      })
      .catch(() => {});
  }, [workspace]);

  useEffect(() => {
    fetchTerminalCount();
    terminalPollRef.current = setInterval(fetchTerminalCount, 10_000);
    return () => clearInterval(terminalPollRef.current);
  }, [fetchTerminalCount]);

  useEffect(() => {
    if (!workspace) return;
    const gitUrl = `/api/git?workspace=${encodeURIComponent(workspace)}`;
    const fetchGit = () => {
      apiFetch(gitUrl)
        .then((r) => r.json())
        .then((data) => {
          if (data.branch) setGitInfo({ branch: data.branch, changedFiles: data.changedFiles ?? 0 });
          else setGitInfo(null);
        })
        .catch(() => {});
    };
    fetchGit();
    const id = setInterval(fetchGit, 30_000);
    return () => clearInterval(id);
  }, [workspace]);

  const dirName = workspace.split("/").filter(Boolean).pop() || "~";
  const elapsedLabel = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : `${elapsed}s`;

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 flex items-center justify-between header-bar px-2 sm:px-3 border-b border-border">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <button
            onClick={() => {
              haptics.tap();
              onOpenSidebar?.();
            }}
            aria-label="Open session sidebar"
            className="icon-btn shrink-0 hover:bg-bg-hover text-text-muted hover:text-text-secondary"
          >
            <MenuIcon />
          </button>
          <span className="text-clr-base font-medium text-text-secondary truncate">{dirName}</span>
          {gitInfo && (
            <button
              onClick={() => setGitPanelOpen(true)}
              className="touch-chip text-text-muted bg-bg-surface hover:bg-bg-hover shrink-0"
            >
              <GitBranchIcon size={12} />
              <span className="truncate max-w-[80px]">{gitInfo.branch}</span>
              {gitInfo.changedFiles > 0 && (
                <span className="text-warning">+{gitInfo.changedFiles}</span>
              )}
            </button>
          )}
          <button
            onClick={() => setTerminalOpen(true)}
            className="touch-chip text-text-muted bg-bg-surface hover:bg-bg-hover shrink-0"
          >
            <TerminalIcon size={12} />
            <span>Terminal</span>
            {terminalCount > 0 && (
              <span className="text-success">{terminalCount}</span>
            )}
          </button>
          {isStreaming && (
            <>
              {model && (
                <>
                  <span className="text-text-muted text-clr-xs">/</span>
                  <span className="text-clr-xs text-text-muted truncate max-w-[120px]">{model}</span>
                </>
              )}
              <span className="text-clr-xs text-text-muted/60 tabular-nums">{elapsedLabel}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {sessionId && (
            <span className="text-clr-2xs text-text-muted font-mono mr-1 hidden sm:inline opacity-60">
              {sessionId.slice(0, 8)}
            </span>
          )}
          {sessionId && messages.length > 0 && (
            <button
              onClick={handleExport}
              className="icon-btn hover:bg-bg-hover text-text-muted hover:text-text-secondary"
              aria-label={exportCopied ? "Copied to clipboard" : "Export conversation"}
            >
              {exportCopied ? <CheckIcon size={14} /> : <ExportIcon size={14} />}
            </button>
          )}
          <button
            onClick={() => {
              haptics.tap();
              onOpenSettings?.();
            }}
            className="icon-btn hover:bg-bg-hover text-text-muted hover:text-text-secondary"
            aria-label="Settings"
          >
            <SettingsIcon size={16} />
          </button>
          <button
            onClick={() => {
              haptics.tap();
              onOpenQr?.();
            }}
            className="icon-btn hover:bg-bg-hover text-text-muted hover:text-text-secondary"
            aria-label="Connect device"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <line x1="21" y1="14" x2="21" y2="14.01" />
              <line x1="21" y1="21" x2="21" y2="21.01" />
            </svg>
          </button>
        </div>
      </header>

      {mcpFallback && (
        <div className="shrink-0 px-4 py-2 border-b border-warning/20 text-warning text-clr-xs bg-warning/5">
          Agent runs from <span className="font-mono">{workspace.split("/").pop()}</span> for MCP (Notion, Composio). Pick a project in the sidebar to change workspace.
        </div>
      )}

      {error && (
        <div className="shrink-0 px-4 py-2 border-b border-error/20 text-error text-clr-sm bg-error/5">
          {error}
        </div>
      )}

      {notification.pending && (
        <div
          className={`shrink-0 flex items-center justify-between px-4 py-2 border-b text-clr-sm ${
            notification.pending.type === "error"
              ? "border-error/20 text-error bg-error/5"
              : "border-success/20 text-success bg-success/5"
          }`}
        >
          <span>
            {notification.pending.type === "error" ? "Agent errored" : "Agent finished"}
            {notification.pending.elapsed !== null && notification.pending.elapsed !== undefined && notification.pending.elapsed > 0 && (
              <span className="opacity-60 ml-1">
                ({notification.pending.elapsed >= 60
                  ? `${Math.floor(notification.pending.elapsed / 60)}m ${notification.pending.elapsed % 60}s`
                  : `${notification.pending.elapsed}s`})
              </span>
            )}
          </span>
          <button
            onClick={notification.dismiss}
            className="icon-btn hover:bg-bg-hover transition-colors"
            aria-label="Dismiss notification"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      <MessageList
        messages={messages}
        toolCalls={toolCalls}
        isStreaming={isStreaming}
        isLoadingHistory={isLoadingHistory}
        isWatching={isWatching}
        recentSessions={recentSessions}
        onSelectSession={onSelectSession ?? loadSession}
        onRetry={retryLastMessage}
        queuedMessages={queuedMessages}
        onForceSend={forceSendQueued}
        onEditQueued={editQueued}
        onDeleteQueued={deleteQueued}
      />

      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        selectedModel={selectedModel}
        selectedMode={selectedMode}
        onModelChange={setSelectedModel}
        onModeChange={setSelectedMode}
      />

      <GitPanel
        open={gitPanelOpen}
        onClose={() => {
          setGitPanelOpen(false);
          if (workspace) {
            apiFetch(`/api/git?workspace=${encodeURIComponent(workspace)}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.branch) setGitInfo({ branch: data.branch, changedFiles: data.changedFiles ?? 0 });
                else setGitInfo(null);
              })
              .catch(() => {});
          }
        }}
        workspace={workspace || undefined}
      />

      <TerminalPanel
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        workspace={workspace || undefined}
        onCountChange={(n) => { setTerminalCount(n); }}
      />
    </div>
  );
}
