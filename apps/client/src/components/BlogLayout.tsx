import { Link } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

export type BlogSource = {
  n: number;
  title: string;
  publisher: string;
  url: string;
  date?: string;
};

export type BlogTocItem = { id: string; label: string };

type BlogLayoutProps = {
  badge: string;
  title: ReactNode;
  lead: ReactNode;
  readingMinutes: number;
  toc: BlogTocItem[];
  sources: BlogSource[];
  children: ReactNode;
  /** Internal slug only — `/blog/...` is added automatically. */
  slug: string;
  /** Title used on the "More reading" cards on the bottom. */
  related?: { href: string; title: string; description: string }[];
};

function useReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const v = total > 0 ? (h.scrollTop / total) * 100 : 0;
      setPct(Math.min(100, Math.max(0, v)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return pct;
}

/**
 * Shared layout for the long-form `/blog/*` posts.
 *
 * Same warm cream + forest-green visual language as the public
 * LandingPage and the existing WhatsappPrivacyPage. Self-contained:
 * no app shell, no auth, no tRPC.
 */
export function BlogLayout({
  badge,
  title,
  lead,
  readingMinutes,
  toc,
  sources,
  children,
  related = [],
}: BlogLayoutProps) {
  const pct = useReadingProgress();

  return (
    <div
      className="min-h-screen antialiased"
      style={{
        backgroundColor: "#FCF5EB",
        color: "#111B21",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Reading progress bar */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{ backgroundColor: "transparent" }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: "#2E6F40",
            transition: "width 80ms linear",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="max-w-[1200px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <span
            aria-hidden
            className="grid place-items-center w-8 h-8 rounded-lg text-white font-bold"
            style={{ backgroundColor: "#2E6F40" }}
          >
            ✓
          </span>
          <span className="font-semibold text-[#0F2A18] group-hover:opacity-80">
            VeilChat
          </span>
        </Link>
        <Link
          to="/welcome"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: "#2E6F40" }}
        >
          Try VeilChat
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-[820px] mx-auto px-5 sm:px-8 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3E5] text-[#2E6F40] text-xs font-medium tracking-wide uppercase">
          <span aria-hidden>🔎</span> {badge}
        </div>
        <h1
          className="mt-5 text-[40px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight text-[#0F2A18]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          {title}
        </h1>
        <div className="mt-6 text-[18.5px] leading-[1.7] text-[#28332c] space-y-4">
          {lead}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#4a5a4f]">
          <span>Reading time · ~{readingMinutes} min</span>
          <span aria-hidden>·</span>
          <span>{sources.length} primary sources</span>
          <span aria-hidden>·</span>
          <span>Updated {new Date().getFullYear()}</span>
        </div>
      </section>

      {/* TOC */}
      <nav
        aria-label="Table of contents"
        className="max-w-[820px] mx-auto px-5 sm:px-8 mt-12"
      >
        <details
          open
          className="rounded-2xl border border-[#0F2A18]/10 bg-white/70 px-5 py-4"
        >
          <summary className="cursor-pointer text-sm font-semibold text-[#0F2A18] tracking-wide uppercase">
            What's in this post
          </summary>
          <ol className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[15px] text-[#28332c] list-decimal list-inside marker:text-[#2E6F40]/70">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="hover:text-[#2E6F40] underline-offset-4 hover:underline"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </details>
      </nav>

      {/* Body */}
      <article className="max-w-[820px] mx-auto px-5 sm:px-8 mt-12 pb-16 text-[18px] leading-[1.8] text-[#1f2a23]">
        {children}
      </article>

      {/* Sources */}
      <section
        id="sources"
        className="max-w-[820px] mx-auto px-5 sm:px-8 pb-16"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-[#0F2A18]">
          Sources &amp; references
        </h2>
        <p className="mt-3 text-[15px] text-[#4a5a4f]">
          Every numbered claim above is keyed to one of the{" "}
          {sources.length} sources below.
        </p>
        <ol className="mt-5 space-y-3 text-[15px] text-[#28332c] list-decimal list-inside marker:text-[#2E6F40]/70">
          {sources.map((s) => (
            <li key={s.n} id={`s-${s.n}`}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2E6F40] hover:underline"
              >
                {s.title}
              </a>{" "}
              — <em>{s.publisher}</em>
              {s.date ? `, ${s.date}` : ""}
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="max-w-[820px] mx-auto px-5 sm:px-8 pb-12">
        <div className="rounded-3xl bg-gradient-to-br from-[#2E6F40] to-[#1F4F2D] text-white p-8 sm:p-10 shadow-[0_20px_45px_-20px_rgba(46,111,64,0.6)]">
          <h2
            className="text-[28px] sm:text-[34px] font-semibold leading-[1.1]"
            style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
          >
            Ready for a messenger that genuinely cannot read you?
          </h2>
          <p className="mt-3 text-[16px] text-white/85">
            VeilChat is free, open source, and works on every device. Thirty
            seconds to install — no phone number required.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/welcome"
              className="inline-flex items-center gap-2 bg-white text-[#1F4F2D] font-semibold px-5 py-3 rounded-full hover:bg-white/95"
            >
              Try VeilChat — free, 30 seconds
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium px-5 py-3 rounded-full border border-white/15"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </section>

      {/* Related reading */}
      {related.length > 0 && (
        <section className="max-w-[820px] mx-auto px-5 sm:px-8 pb-20">
          <h2 className="text-xl font-semibold tracking-tight text-[#0F2A18]">
            More from the VeilChat blog
          </h2>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {related.map((r) => (
              <Link
                key={r.href}
                to={r.href}
                className="block rounded-2xl bg-white border border-[#0F2A18]/10 p-5 hover:border-[#2E6F40]/40 hover:shadow-[0_12px_28px_-16px_rgba(46,111,64,0.35)] transition-all"
              >
                <div className="text-[15px] font-semibold text-[#0F2A18]">
                  {r.title}
                </div>
                <div className="mt-1.5 text-[14px] text-[#4a5a4f] leading-relaxed">
                  {r.description}
                </div>
                <div className="mt-3 text-[13px] font-semibold text-[#2E6F40]">
                  Read article →
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[#0F2A18]/10 mt-8">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-[14px] text-[#4a5a4f]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid place-items-center w-6 h-6 rounded-md text-white text-xs font-bold"
              style={{ backgroundColor: "#2E6F40" }}
            >
              ✓
            </span>
            <span>© {new Date().getFullYear()} VeilChat</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/" className="hover:text-[#2E6F40]">Home</Link>
            <Link to="/blog" className="hover:text-[#2E6F40]">Blog</Link>
            <Link to="/about" className="hover:text-[#2E6F40]">About</Link>
            <Link to="/encryption" className="hover:text-[#2E6F40]">Encryption</Link>
            <Link to="/open-source" className="hover:text-[#2E6F40]">Open source</Link>
            <Link to="/privacy-policy" className="hover:text-[#2E6F40]">Privacy</Link>
            <Link to="/terms" className="hover:text-[#2E6F40]">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Inline `[n]` citation that anchors to the matching source entry. */
export function Cite({ n }: { n: number }) {
  return (
    <a
      href={`#s-${n}`}
      className="inline-flex items-baseline align-baseline ml-0.5 text-[12px] font-semibold text-[#2E6F40] hover:underline"
      aria-label={`Source ${n}`}
    >
      [{n}]
    </a>
  );
}

/** Section heading used inside the article body. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 mb-4 text-[28px] sm:text-[32px] font-semibold tracking-tight text-[#0F2A18] scroll-mt-24"
      style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-8 mb-3 text-[20px] sm:text-[22px] font-semibold tracking-tight text-[#0F2A18]">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4">{children}</p>;
}

/** Highlighted callout box. */
export function Callout({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-[#2E6F40]/25 bg-[#E8F3E5]/60 px-5 py-4">
      {title && (
        <div className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[#2E6F40]">
          {title}
        </div>
      )}
      <div className={`${title ? "mt-2" : ""} text-[16.5px] text-[#1f2a23] leading-[1.7]`}>
        {children}
      </div>
    </div>
  );
}

/** Comparison-table primitive. */
export function CompareTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { label: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="mt-6 -mx-5 sm:mx-0 overflow-x-auto">
      <table className="w-full min-w-[560px] text-[15px] text-left border-separate border-spacing-0 rounded-2xl overflow-hidden border border-[#0F2A18]/10 bg-white">
        <thead>
          <tr className="bg-[#E8F3E5]/80 text-[#0F2A18]">
            <th className="px-4 py-3 font-semibold border-b border-[#0F2A18]/10"></th>
            {columns.map((c) => (
              <th
                key={c}
                className="px-4 py-3 font-semibold border-b border-[#0F2A18]/10"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={i % 2 ? "bg-[#FBF6EE]/60" : ""}>
              <th className="px-4 py-3 font-medium text-[#0F2A18] align-top border-b border-[#0F2A18]/8">
                {r.label}
              </th>
              {r.cells.map((cell, idx) => (
                <td
                  key={idx}
                  className="px-4 py-3 text-[#28332c] align-top border-b border-[#0F2A18]/8"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
