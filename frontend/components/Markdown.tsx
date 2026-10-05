"use client";

import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import Citation from "./Citation";

/** Turn `[n]` into `[n](#cite-n)` outside of code so we can render chips. */
function withCitations(text: string, max: number): string {
  if (max <= 0) return text;
  let head = text;
  let tail = "";
  if ((text.match(/```/g) ?? []).length % 2 === 1) {
    const i = text.lastIndexOf("```");
    head = text.slice(0, i);
    tail = text.slice(i);
  }
  const converted = head
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\[(\d{1,2})\](?!\()/g, (m, d) => (+d >= 1 && +d <= max ? `[${d}](#cite-${d})` : m)),
    )
    .join("");
  return converted + tail;
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [ok, setOk] = useState(false);
  const el = Children.toArray(children)[0];
  if (!isValidElement(el)) return <pre>{children}</pre>;
  const code = el as ReactElement<{ className?: string; children?: ReactNode }>;
  const lang = /language-([\w-]+)/.exec(code.props.className ?? "")?.[1];
  const text = String(code.props.children ?? "").replace(/\n$/, "");

  return (
    <div className="not-prose my-4 overflow-hidden rounded-2xl border border-line bg-code">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="eyebrow">{lang ?? "code"}</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setOk(true);
              setTimeout(() => setOk(false), 1500);
            } catch {}
          }}
          className="flex items-center gap-1 text-xs text-ink-faint transition hover:text-ink"
          aria-label="Copy code"
        >
          {ok ? <Check size={12} /> : <Copy size={12} />} {ok ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono">{text}</code>
      </pre>
    </div>
  );
}

export default function Markdown({
  text,
  sources = [],
  onCite,
}: {
  text: string;
  sources?: string[];
  onCite?: (n: number) => void;
}) {
  const snippet = (n: number) => sources[n - 1]?.replace(/^CONTENT:\s*/i, "").trim();

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ href, children }) => {
          const m = href ? /^#cite-(\d+)$/.exec(href) : null;
          if (m) return <Citation n={+m[1]} snippet={snippet(+m[1])} onJump={(n) => onCite?.(n)} />;
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {withCitations(text, sources.length)}
    </ReactMarkdown>
  );
}
