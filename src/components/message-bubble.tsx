"use client";

import { useState, memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Markdown } from "./markdown";
import { useHaptics } from "@/hooks/use-haptics";
import { CheckIcon, CopyIcon } from "./icons";

interface MessageBubbleProps {
  message: ChatMessage;
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-1 right-0 icon-btn opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-secondary touch-visible"
      aria-label={copied ? "Copied" : "Copy message"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      haptics.tap();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  if (isUser) {
    return (
      <div className="py-3 group relative">
        <div className="text-clr-base leading-[1.6] text-text whitespace-pre-wrap break-words bg-bg-surface rounded-lg px-3.5 py-2.5">
          {message.content}
        </div>
        <CopyButton copied={copied} onClick={handleCopy} />
      </div>
    );
  }

  return (
    <div className="py-3 group relative">
      <Markdown content={message.content} />
      <CopyButton copied={copied} onClick={handleCopy} />
    </div>
  );
});
