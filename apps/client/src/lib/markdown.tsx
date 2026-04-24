import { useMemo } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/atom-one-dark.css";

type Block =
  | { kind: "text"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "code"; lang: string | null; code: string };

function splitBlocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const fence = line.match(/^```([a-zA-Z0-9_+-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || null;
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        code.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) i++;
      out.push({ kind: "code", lang, code: code.join("\n") });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      out.push({ kind: "quote", lines: quote });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      !/^```([a-zA-Z0-9_+-]*)\s*$/.test(lines[i] ?? "") &&
      !/^>\s?/.test(lines[i] ?? "")
    ) {
      buf.push(lines[i] ?? "");
      i++;
    }
    out.push({ kind: "text", lines: buf });
  }
  return out;
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: Token[] }
  | { kind: "italic"; value: Token[] }
  | { kind: "code"; value: string };

function tokenizeInline(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      tokens.push({ kind: "text", value: buf });
      buf = "";
    }
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > i) {
        flush();
        tokens.push({ kind: "code", value: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "*" && s[i + 1] === "*") {
      const end = s.indexOf("**", i + 2);
      if (end > i + 1) {
        flush();
        tokens.push({ kind: "bold", value: tokenizeInline(s.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "*" || ch === "_") {
      const end = s.indexOf(ch, i + 1);
      if (
        end > i &&
        s[i - 1] !== ch &&
        s[end + 1] !== ch &&
        !/\s/.test(s[i + 1] ?? "") &&
        !/\s/.test(s[end - 1] ?? "")
      ) {
        flush();
        tokens.push({
          kind: "italic",
          value: tokenizeInline(s.slice(i + 1, end)),
        });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return tokens;
}

type RenderTextSegment = (text: string, key: string) => React.ReactNode;

function renderInline(
  tokens: Token[],
  keyPrefix: string,
  renderText: RenderTextSegment,
): React.ReactNode[] {
  return tokens.map((t, idx) => {
    const k = `${keyPrefix}${idx}`;
    if (t.kind === "text") return renderText(t.value, k);
    if (t.kind === "bold")
      return (
        <strong key={k}>{renderInline(t.value, `${k}.`, renderText)}</strong>
      );
    if (t.kind === "italic")
      return <em key={k}>{renderInline(t.value, `${k}.`, renderText)}</em>;
    return (
      <code
        key={k}
        className="px-1 py-[1px] rounded bg-black/20 text-[0.92em] font-mono"
      >
        {t.value}
      </code>
    );
  });
}

function renderTextLines(
  lines: string[],
  key: string,
  renderText: RenderTextSegment,
): React.ReactNode {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    out.push(
      <span key={`${key}.${i}`}>
        {renderInline(tokenizeInline(line), `${key}.${i}.`, renderText)}
      </span>,
    );
    if (i < lines.length - 1) out.push(<br key={`${key}.${i}.br`} />);
  }
  return <>{out}</>;
}

const defaultRenderText: RenderTextSegment = (value, key) => (
  <span key={key}>{value}</span>
);

function CodeBlock({ lang, code }: { lang: string | null; code: string }) {
  const html = useMemo(() => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true })
          .value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      const div = document.createElement("div");
      div.textContent = code;
      return div.innerHTML;
    }
  }, [code, lang]);
  return (
    <pre
      className={
        "veil-code-block my-1 rounded-md bg-[#1a1d21] text-[12.5px] " +
        "leading-snug overflow-x-auto px-3 py-2 font-mono"
      }
    >
      {lang && (
        <div className="text-[10px] uppercase tracking-wider text-text-muted/70 mb-1">
          {lang}
        </div>
      )}
      <code
        className="hljs"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}

/**
 * Render a chat message body with lightweight Markdown:
 *   **bold**, *italic* / _italic_, `inline code`,
 *   > blockquote
 *   ```lang fenced code blocks ``` (syntax-highlighted)
 *
 * Plain URLs, emoji and other text pass through untouched —
 * link previews are rendered separately by the bubble.
 */
export function MessageText({
  text,
  renderText,
}: {
  text: string;
  /**
   * Optional override for plain-text spans inside the rendered tree.
   * Used by group chats to inject mention pills (`@xxxxxxxx`) without
   * losing the surrounding markdown formatting.
   */
  renderText?: RenderTextSegment;
}) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  const rt = renderText ?? defaultRenderText;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "code")
          return <CodeBlock key={i} lang={b.lang} code={b.code} />;
        if (b.kind === "quote")
          return (
            <blockquote
              key={i}
              className="my-1 pl-3 border-l-2 border-wa-green/60 text-text/85 italic"
            >
              {renderTextLines(b.lines, `q${i}`, rt)}
            </blockquote>
          );
        return (
          <span key={i}>{renderTextLines(b.lines, `t${i}`, rt)}</span>
        );
      })}
    </>
  );
}
