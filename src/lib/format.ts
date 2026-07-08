const SESSION_TITLE_MAX = 50;

const DATETIME_TITLE_RE =
  /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s/i;

export function stripSessionMetadata(text: string): string {
  return text
    .replace(/<timestamp>[\s\S]*?<\/timestamp>\n?/gi, "")
    .replace(/<user_query>\n?/g, "")
    .replace(/<\/user_query>\n?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDatetimeLikeTitle(text: string): boolean {
  const t = text.trim();
  return DATETIME_TITLE_RE.test(t) || /\(UTC[+-]/.test(t);
}

function shortSessionDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncateSessionTitle(text: string): string {
  if (text.length <= SESSION_TITLE_MAX) return text;
  return text.slice(0, SESSION_TITLE_MAX).trimEnd();
}

export function formatSessionTitle(input: {
  title?: string;
  preview?: string;
  updatedAt?: number;
}): string {
  const candidates = [input.title, input.preview].filter(Boolean) as string[];

  for (const raw of candidates) {
    const cleaned = stripSessionMetadata(raw);
    if (cleaned && !isDatetimeLikeTitle(cleaned)) {
      return truncateSessionTitle(cleaned);
    }
  }

  if (input.updatedAt) return shortSessionDate(input.updatedAt);
  return "New session";
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
