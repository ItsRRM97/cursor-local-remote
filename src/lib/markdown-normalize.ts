/**
 * Repair markdown that lost line breaks during transcript streaming or chunk merges.
 * Cursor transcripts sometimes collapse table rows onto one line, which breaks GFM parsing.
 */
export function normalizeMarkdown(content: string): string {
  let result = repairCollapsedMarkdown(content);

  if (!result.includes("|")) return result;

  // Heading glued to a table: "## Title| col |" -> "## Title\n\n| col |"
  result = result.replace(/(^|\n)(#{1,6}\s[^\n|]+)\|/g, "$1$2\n\n|");

  // Collapsed table row boundaries (repeat until stable for multi-row tables)
  let prev = "";
  let guard = 0;
  while (prev !== result && guard++ < 24) {
    prev = result;
    result = result.replace(/\|\|(?=[-:])/g, "|\n|");
    result = result.replace(/\|\|(?=\s*\*?\*?[A-Za-z0-9`"'(])/g, "|\n|");
    result = result.replace(/\|\s+\|(?=\s*\*?\*?[A-Za-z0-9`"'(])/g, "|\n|");
  }

  // Paragraph or list line ending before a table row
  result = result.replace(/(^|\n)([^\n|]+)\n(\|[^|\n]+\|[^|\n]*\|)/g, (match, lead, line, row) => {
    if (line.trimStart().startsWith("|") || line.trimStart().startsWith("#")) return match;
    return `${lead}${line}\n\n${row}`;
  });

  return result;
}

/** Fix headings, lists, and rules collapsed during streaming merges. */
function repairCollapsedMarkdown(content: string): string {
  let result = content;

  // "##The" -> "## The"
  result = result.replace(/(^|\n)(#{1,6})([A-Za-z])/g, "$1$2 $3");

  // "together:1. **Item**" -> "together:\n\n1. **Item**"
  result = result.replace(/([^\n:]):(\d+\.\s+)/g, "$1:\n\n$2");

  // "---##" or "---**" -> horizontal rule before block
  result = result.replace(/---([#*])/g, "---\n\n$1");

  return result;
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

/** Merge streaming deltas that share a suffix/prefix overlap (token boundaries). */
function mergeWithSuffixPrefixOverlap(prev: string, next: string): string | null {
  const max = Math.min(prev.length, next.length, 500);
  for (let len = max; len > 0; len--) {
    if (prev.slice(-len) === next.slice(0, len)) {
      return prev + next.slice(len);
    }
  }
  return null;
}

function isNewAssistantSegment(prev: string, next: string): boolean {
  const prevTrim = prev.trimEnd();
  const nextTrim = next.trimStart();

  if (/[.!?]["']?$/.test(prevTrim) && /^[A-Z]/.test(nextTrim)) return true;
  if (/\n\n$/.test(prev) && /^#{1,6}\s/.test(nextTrim)) return true;
  if (/\n\n$/.test(prev) && /^[-*]\s/.test(nextTrim)) return true;

  return false;
}

function isPlausibleStreamingSnapshot(prev: string, next: string): boolean {
  const prefixLen = commonPrefixLength(prev, next);
  if (prefixLen < 12) return false;
  const shorter = Math.min(prev.length, next.length);
  return shorter > 0 && prefixLen >= shorter * 0.85;
}

/** Collapse newline runs so redaction stripping does not break snapshot prefix checks. */
function normalizeMergeKey(text: string): string {
  return text.replace(/\n+/g, "\n").trim();
}

function shouldReplaceWithNewSegment(prev: string, next: string): boolean {
  if (!prev || !next) return false;
  if (next.startsWith(prev) || prev.startsWith(next)) return false;

  const prevKey = normalizeMergeKey(prev);
  const nextKey = normalizeMergeKey(next);
  if (prevKey && nextKey.startsWith(prevKey)) return false;
  if (nextKey && prevKey.startsWith(nextKey)) return false;
  if (isPlausibleStreamingSnapshot(prevKey, nextKey)) return false;

  const prefixLen = commonPrefixLength(prevKey, nextKey);
  const minLen = Math.min(prevKey.length, nextKey.length);
  if (minLen === 0) return false;

  // Cursor transcripts often emit a short status line, then a separate full answer.
  // Those are not streaming deltas; keep only the latest disjoint segment.
  if (prefixLen < 40 && prefixLen < minLen * 0.2) {
    // Tiny chunks are usually mid-token stream deltas; let overlap merge handle them.
    if (prev.length < 60 && next.length < 60) return false;
    return next.length >= 80 || next.length >= prev.length * 1.5;
  }

  return false;
}

/** Merge assistant transcript chunks (stream deltas and jsonl segments). */
export function mergeAssistantChunks(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;
  if (shouldReplaceWithNewSegment(prev, next)) return next;
  return joinMessageContent(prev, next);
}

/** Join transcript text chunks without breaking markdown structure. */
export function joinMessageContent(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;

  // stream-json with --stream-partial-output sends cumulative snapshots; replace, do not append.
  if (next.startsWith(prev)) return next;
  if (prev.startsWith(next)) return prev;

  const prevKey = normalizeMergeKey(prev);
  const nextKey = normalizeMergeKey(next);
  if (prevKey && nextKey.startsWith(prevKey)) {
    return next.length >= prev.length ? next : prev;
  }
  if (nextKey && prevKey.startsWith(nextKey)) {
    return prev;
  }

  // Sanitization/redaction can break strict prefix checks; prefer the newer longer snapshot.
  if (isPlausibleStreamingSnapshot(prevKey, nextKey)) {
    return next.length >= prev.length ? next : prev;
  }

  const overlap = mergeWithSuffixPrefixOverlap(prev, next);
  if (overlap) return overlap;

  if (prev.endsWith("\n") || next.startsWith("\n")) return prev + next;
  if (next.startsWith(" ")) return prev + next;

  if (/^\s*\|/.test(next) && !/\|\s*$/.test(prev)) {
    return `${prev}\n\n${next}`;
  }

  if (/\|\s*$/.test(prev) && /^\s*\|/.test(next)) {
    return `${prev}\n${next}`;
  }

  // Markdown heading marker without trailing space: "##" + "Title"
  if (/(?:^|\n)(#{1,6})$/.test(prev) && /^[^\s#]/.test(next)) {
    return `${prev} ${next}`;
  }

  if (isNewAssistantSegment(prev, next)) {
    return `${prev}\n\n${next}`;
  }

  // Do not invent spaces between chunks: stream deltas carry their own word boundaries.
  // Inserting spaces here splits words when chunks arrive mid-token ("learn" + "able").
  return prev + next;
}
