"use client";

import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { normalizeMarkdown } from "@/lib/markdown-normalize";
import "highlight.js/styles/github-dark.css";

interface MarkdownProps {
  content: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-clr-xl font-semibold mt-5 mb-2 text-text">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-clr-lg font-semibold mt-4 mb-1.5 text-text">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-clr-md font-semibold mt-3 mb-1 text-text">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-clr-base font-semibold mt-2.5 mb-1 text-text">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-clr-base font-medium mt-2 mb-0.5 text-text-secondary">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-clr-sm font-medium mt-2 mb-0.5 text-text-secondary">{children}</h6>
  ),
  p: ({ children }) => <p className="my-1 text-clr-base leading-[1.6]">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 decoration-text-muted/40 hover:decoration-accent transition-colors"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-2 rounded-lg bg-[#0d0d0d] border border-border px-3.5 py-3 overflow-x-auto">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return <code className={`${className} text-clr-sm leading-[1.7] font-mono`}>{children}</code>;
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-[#1c1c1c] text-[#d4d4d4] text-clr-sm font-mono">
        {children}
      </code>
    );
  },
  ul: ({ children }) => <ul className="my-1.5 space-y-0.5 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 space-y-0.5 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-clr-base leading-[1.6]">{children}</li>,
  hr: () => <hr className="my-3 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-border text-text-secondary italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-clr-base border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-bg-surface">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/50">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold border-b border-border text-text whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-clr-base leading-[1.5] border-b border-border/40">{children}</td>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className="my-2 max-w-full rounded" loading="lazy" />
  ),
};

export const Markdown = memo(function Markdown({ content }: MarkdownProps) {
  const normalized = useMemo(() => normalizeMarkdown(content), [content]);

  return (
    <div className="text-text markdown-body break-words [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
});
