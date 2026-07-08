"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage, ToolCallInfo, StoredSession, QueuedMessage } from "@/lib/types";
import { useHaptics } from "@/hooks/use-haptics";
import { timeAgo, formatSessionTitle } from "@/lib/format";
import { MessageBubble } from "./message-bubble";
import { ToolCallCard, ToolCallGroup, TodoLogCard, ChangesSummary, isMinorToolCall } from "./tool-call-card";
import { Spinner, RetryIcon, ClockIcon, ArrowDown } from "./icons";

interface MessageListProps {
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  isStreaming: boolean;
  isLoadingHistory?: boolean;
  isWatching?: boolean;
  recentSessions?: StoredSession[];
  onSelectSession?: (id: string, workspace?: string) => void;
  onRetry?: () => void;
  queuedMessages?: QueuedMessage[];
  onForceSend?: (id: string) => void;
  onEditQueued?: (id: string, newContent: string) => void;
  onDeleteQueued?: (id: string) => void;
}

interface TimelineItem {
  kind: "message" | "toolcall" | "toolgroup";
  timestamp: number;
  message?: ChatMessage;
  toolCall?: ToolCallInfo;
  toolCalls?: ToolCallInfo[];
}

function RecentSessions({
  sessions,
  onSelect,
}: {
  sessions: StoredSession[];
  onSelect: (id: string, workspace?: string) => void;
}) {
  const haptics = useHaptics();
  if (sessions.length === 0) return null;

  return (
    <div className="mt-5 w-full max-w-xs">
      <p className="text-text-muted text-clr-xs font-medium mb-2 uppercase tracking-wider">
        Recent sessions
      </p>
      <div className="space-y-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => { haptics.tap(); onSelect(s.id, s.workspace); }}
            className="w-full text-left px-3 py-2 rounded-lg bg-bg-surface hover:bg-bg-hover border border-border/50 transition-colors group"
          >
            <p className="text-clr-sm text-text-secondary group-hover:text-text truncate">
              {formatSessionTitle(s)}
            </p>
            <p className="text-clr-2xs text-text-muted mt-0.5">{timeAgo(s.updatedAt)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function QueuedMessageCard({
  msg,
  onForceSend,
  onEdit,
  onDelete,
}: {
  msg: QueuedMessage;
  onForceSend: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const haptics = useHaptics();

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== msg.content) onEdit(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(msg.content);
    setEditing(false);
  };

  return (
    <div className="py-2.5 border border-dashed border-text-muted/25 rounded-lg px-3 bg-bg-surface/50">
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5 text-text-muted/50">
          <ClockIcon />
        </span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                autoFocus
                aria-label="Edit queued message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    save();
                  }
                  if (e.key === "Escape") cancel();
                }}
                rows={2}
                className="w-full resize-none bg-bg px-2 py-1.5 text-clr-base text-text rounded border border-border focus:outline-none focus:border-text-muted/40"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={save}
                  className="px-3 py-2 text-clr-2xs font-medium rounded bg-bg-active text-text hover:bg-bg-hover transition-colors min-h-[var(--clr-touch-min)]"
                >
                  Save
                </button>
                <button
                  onClick={cancel}
                  className="px-3 py-2 text-clr-2xs font-medium rounded text-text-muted hover:text-text-secondary transition-colors min-h-[var(--clr-touch-min)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-clr-base text-text-secondary whitespace-pre-wrap break-words">
              {msg.content}
            </p>
          )}
        </div>
      </div>
      {!editing && (
        <div className="flex items-center gap-1 mt-1.5 ml-5">
          <span className="text-clr-2xs text-text-muted/50 mr-1">Queued</span>
          <button
            onClick={() => { haptics.send(); onForceSend(); }}
            className="px-3 py-2 text-clr-2xs font-medium rounded bg-bg-active text-text-secondary hover:text-text transition-colors min-h-[var(--clr-touch-min)]"
            title="Stop current and send this now"
          >
            Send now
          </button>
          <button
            onClick={() => {
              haptics.tap();
              setDraft(msg.content);
              setEditing(true);
            }}
            className="px-3 py-2 text-clr-2xs font-medium rounded text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors min-h-[var(--clr-touch-min)]"
          >
            Edit
          </button>
          <button
            onClick={() => { haptics.warn(); onDelete(); }}
            className="px-3 py-2 text-clr-2xs font-medium rounded text-text-muted hover:text-error/80 hover:bg-error/5 transition-colors min-h-[var(--clr-touch-min)]"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function MessageList({
  messages,
  toolCalls,
  isStreaming,
  isLoadingHistory,
  isWatching,
  recentSessions = [],
  onSelectSession,
  onRetry,
  queuedMessages = [],
  onForceSend,
  onEditQueued,
  onDeleteQueued,
}: MessageListProps) {
  const haptics = useHaptics();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const pinnedToBottomRef = useRef(true);
  /** Once the user scrolls up, stay unpinned until they return to the bottom or tap the pill. */
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const userInteractingRef = useRef(false);
  const interactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchActiveRef = useRef(false);
  const touchStartYRef = useRef(0);

  const releasePin = useCallback(() => {
    userScrolledAwayRef.current = true;
    pinnedToBottomRef.current = false;
    setAutoScroll(false);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      lastScrollTopRef.current = el.scrollHeight;
    } else {
      endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
    userScrolledAwayRef.current = false;
    pinnedToBottomRef.current = true;
    setAutoScroll(true);
  }, []);

  const markUserInteracting = useCallback(() => {
    userInteractingRef.current = true;
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
    interactTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false;
      interactTimerRef.current = null;
    }, 1500);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const top = el.scrollTop;
    const distanceFromBottom = el.scrollHeight - top - el.clientHeight;

    if (top < lastScrollTopRef.current - 2) {
      releasePin();
    } else if (userScrolledAwayRef.current) {
      if (distanceFromBottom < 24) {
        userScrolledAwayRef.current = false;
        pinnedToBottomRef.current = true;
        setAutoScroll(true);
      }
    } else if (distanceFromBottom < 80) {
      pinnedToBottomRef.current = true;
      setAutoScroll(true);
    } else {
      pinnedToBottomRef.current = false;
      setAutoScroll(false);
    }

    lastScrollTopRef.current = top;
  }, [releasePin]);

  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      userScrolledAwayRef.current ||
      !pinnedToBottomRef.current ||
      userInteractingRef.current ||
      touchActiveRef.current
    ) {
      return;
    }

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (
        !el ||
        userScrolledAwayRef.current ||
        !pinnedToBottomRef.current ||
        userInteractingRef.current ||
        touchActiveRef.current
      ) {
        return;
      }
      const nextTop = el.scrollHeight;
      if (nextTop !== el.scrollTop) {
        el.scrollTop = nextTop;
        lastScrollTopRef.current = nextTop;
      }
    });

    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [messages, toolCalls]);

  const sorted: TimelineItem[] = [
    ...messages.map((m): TimelineItem => ({ kind: "message", timestamp: m.timestamp, message: m })),
    ...toolCalls.map(
      (tc): TimelineItem => ({
        kind: "toolcall",
        timestamp: tc.timestamp,
        toolCall: tc,
      }),
    ),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const timeline: TimelineItem[] = [];
  let minorBatch: ToolCallInfo[] = [];

  const flushMinor = () => {
    if (minorBatch.length === 0) return;
    if (minorBatch.length === 1) {
      timeline.push({
        kind: "toolcall",
        timestamp: minorBatch[0].timestamp,
        toolCall: minorBatch[0],
      });
    } else {
      timeline.push({
        kind: "toolgroup",
        timestamp: minorBatch[0].timestamp,
        toolCalls: [...minorBatch],
      });
    }
    minorBatch = [];
  };

  for (const item of sorted) {
    if (item.kind === "toolcall" && item.toolCall && isMinorToolCall(item.toolCall)) {
      minorBatch.push(item.toolCall);
    } else {
      flushMinor();
      timeline.push(item);
    }
  }
  flushMinor();

  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-text-muted text-clr-base">
          <Spinner className="w-3.5 h-3.5" />
          Loading session...
        </div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="flex flex-col items-center max-w-sm">
          <p className="text-text-secondary text-clr-base font-medium mb-1">Cursor Remote</p>
          <p className="text-text-muted text-clr-sm leading-relaxed">
            Send a message to start an agent session.
          </p>
          {onSelectSession && (
            <RecentSessions sessions={recentSessions} onSelect={onSelectSession} />
          )}
        </div>
      </div>
    );
  }

  const hasRunningToolCalls = toolCalls.some((tc) => tc.status === "running");
  const lastItem = timeline[timeline.length - 1];
  const lastIsUser = lastItem?.kind === "message" && lastItem.message?.role === "user";
  const showThinking = isStreaming && !hasRunningToolCalls && lastIsUser;

  let lastTodoId: string | undefined;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const t = timeline[i];
    if (t.kind === "toolcall" && t.toolCall?.type === "todo") {
      lastTodoId = t.toolCall.id;
      break;
    }
  }

  const lastMessage = messages[messages.length - 1];
  const showRetry = !isStreaming && lastMessage?.role === "user" && onRetry;

  return (
    <div className="flex-1 overflow-hidden relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={(e) => {
          markUserInteracting();
          if (e.deltaY < 0) releasePin();
        }}
        onTouchStart={(e) => {
          touchActiveRef.current = true;
          touchStartYRef.current = e.touches[0]?.clientY ?? 0;
          markUserInteracting();
        }}
        onTouchMove={(e) => {
          markUserInteracting();
          const y = e.touches[0]?.clientY ?? touchStartYRef.current;
          if (y - touchStartYRef.current > 6) releasePin();
        }}
        onTouchEnd={() => {
          touchActiveRef.current = false;
        }}
        onTouchCancel={() => {
          touchActiveRef.current = false;
        }}
        onPointerDown={() => markUserInteracting()}
        className="h-full overflow-y-auto chat-scroll"
      >
        <div className="px-4 max-w-3xl mx-auto w-full">
          <div className="divide-y divide-border/50">
            {timeline.map((item, i) => {
              if (item.kind === "message" && item.message) {
                if (item.message.role === "assistant" && !item.message.content.trim()) {
                  return null;
                }
                return <MessageBubble key={item.message.id} message={item.message} />;
              }
              if (item.kind === "toolcall" && item.toolCall) {
                if (item.toolCall.type === "todo") {
                  return <TodoLogCard key={item.toolCall.id} toolCall={item.toolCall} defaultOpen={item.toolCall.id === lastTodoId} />;
                }
                return <ToolCallCard key={item.toolCall.id} toolCall={item.toolCall} />;
              }
              if (item.kind === "toolgroup" && item.toolCalls) {
                return <ToolCallGroup key={`group-${i}`} toolCalls={item.toolCalls} />;
              }
              return null;
            })}
          </div>

          {!isStreaming && timeline.length > 0 && toolCalls.length > 0 && (
            <ChangesSummary toolCalls={toolCalls} />
          )}

          {showThinking && (
            <div className="py-3 flex items-center gap-2 text-text-muted text-clr-sm">
              <Spinner />
              Thinking...
            </div>
          )}

          {isWatching && !isStreaming && timeline.length > 0 && (
            <div className="py-3 flex items-center gap-2 text-text-muted text-clr-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Watching for updates...
            </div>
          )}

          {showRetry && (
            <div className="py-1">
              <button
                onClick={() => { haptics.tap(); onRetry?.(); }}
                className="flex items-center gap-1 text-clr-2xs text-text-muted/60 hover:text-text-muted transition-colors"
                aria-label="Retry last message"
              >
                <RetryIcon />
                Retry last message
              </button>
            </div>
          )}

          {queuedMessages.length > 0 && (
            <div className="space-y-2 py-2">
              {queuedMessages.map((msg) => (
                <QueuedMessageCard
                  key={msg.id}
                  msg={msg}
                  onForceSend={() => onForceSend?.(msg.id)}
                  onEdit={(content) => onEditQueued?.(msg.id, content)}
                  onDelete={() => onDeleteQueued?.(msg.id)}
                />
              ))}
            </div>
          )}

          <div ref={endRef} className="h-4" />
        </div>
      </div>

      {!autoScroll && timeline.length > 0 && (
        <button
          onClick={() => scrollToBottom(true)}
          aria-label={isStreaming ? "Follow live output" : "Scroll to bottom"}
          className="absolute composer-offset left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-5 py-3 rounded-full bg-bg-elevated border border-border text-text-secondary hover:text-text text-clr-sm shadow-lg transition-colors safe-bottom min-h-[var(--clr-touch-min)]"
        >
          <ArrowDown />
          {isStreaming ? "Follow live" : "Scroll to bottom"}
        </button>
      )}
    </div>
  );
}
