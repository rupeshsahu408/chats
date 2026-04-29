import { Link } from "react-router-dom";
import { useDocumentMeta, SEO_SITE_URL } from "../lib/useDocumentMeta";

type Post = {
  href: string;
  title: string;
  description: string;
  badge: string;
  date: string;
  dateLabel: string;
  readingMinutes: number;
};

const POSTS: Post[] = [
  {
    href: "/blog/how-to-choose-encrypted-messenger-2026",
    title: "How to choose an end-to-end encrypted messenger in 2026",
    description:
      "A practical, source-cited buyer's guide: what 'end-to-end encrypted' actually means, the metadata trap, the backup trap, jurisdiction, and which app fits which threat model.",
    badge: "Buyer's guide",
    date: "2026-04-29",
    dateLabel: "Apr 29, 2026",
    readingMinutes: 13,
  },
  {
    href: "/blog/messenger-metadata-leaks",
    title: "What metadata your messenger leaks (and what to do about it)",
    description:
      "End-to-end encryption hides your message content. It does not hide who you talked to, when, from where, or for how long. A tour of the seven kinds of metadata your messenger leaks — and how to plug each one.",
    badge: "Deep dive",
    date: "2026-04-29",
    dateLabel: "Apr 29, 2026",
    readingMinutes: 12,
  },
  {
    href: "/blog/messenger-without-phone-number",
    title: "How to use a private messenger without a phone number",
    description:
      "You don't need to give up your phone number to message your friends. A practical 2026 guide to phoneless messengers — Threema, Session, VeilChat, and how Signal's username feature changes the picture.",
    badge: "How-to",
    date: "2026-04-29",
    dateLabel: "Apr 29, 2026",
    readingMinutes: 11,
  },
  {
    href: "/blog/why-open-source-matters-in-messaging",
    title: "Why open source matters in private messaging",
    description:
      "If you can't read the code, the only thing standing between you and a marketing-claim privacy app is trust. Open source replaces that trust with proof — and it matters more in messaging than in any other category.",
    badge: "Essay",
    date: "2026-03-08",
    dateLabel: "Mar 8, 2026",
    readingMinutes: 11,
  },
  {
    href: "/blog/best-encrypted-messengers-2026",
    title: "The best end-to-end encrypted messengers in 2026",
    description:
      "An independent, fully-sourced ranking of Signal, VeilChat, Threema, Session, SimpleX, Briar, Wire and iMessage — and a clear recommendation for who should use which.",
    badge: "Ranking",
    date: "2026-02-04",
    dateLabel: "Feb 4, 2026",
    readingMinutes: 14,
  },
  {
    href: "/blog/signal-vs-whatsapp",
    title: "Signal vs WhatsApp — which one is actually private?",
    description:
      "Same encryption protocol. Wildly different surrounding systems. A side-by-side comparison of metadata, ownership, funding, backups, and what each service can be compelled to hand over.",
    badge: "Comparison",
    date: "2026-01-12",
    dateLabel: "Jan 12, 2026",
    readingMinutes: 12,
  },
  {
    href: "/blog/whatsapp-privacy-truth",
    title: "The truth about WhatsApp privacy",
    description:
      "A long-form, fully-sourced investigation into WhatsApp's privacy policy, terms, ads plans, government access, spyware incidents, regulatory fines, and what really happens to your data.",
    badge: "Investigation",
    date: "2025-06-20",
    dateLabel: "Jun 20, 2025",
    readingMinutes: 22,
  },
];

export function BlogIndexPage() {
  const TITLE = "VeilChat Blog — Privacy, encryption, and private messaging";
  const DESC =
    "Long-form, source-cited writing on end-to-end encryption, messenger privacy, metadata, and how to choose the right private messaging app. Updated for 2026.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog",
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESC,
      url: `${SEO_SITE_URL}/blog`,
      inLanguage: "en",
      publisher: {
        "@type": "Organization",
        name: "VeilChat",
        logo: { "@type": "ImageObject", url: `${SEO_SITE_URL}/icon-512.svg` },
      },
      mainEntity: {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: POSTS.length,
        itemListElement: POSTS.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SEO_SITE_URL}${p.href}`,
          name: p.title,
        })),
      },
    },
  });

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
          <span aria-hidden>📓</span> The VeilChat Blog
        </div>
        <h1
          className="mt-5 text-[40px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight text-[#0F2A18]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          Writing on{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            privacy
          </span>
          , encryption, and private messaging
        </h1>
        <p className="mt-6 text-[18.5px] leading-[1.7] text-[#28332c]">
          Long-form, source-cited articles on end-to-end encryption, messenger
          metadata, and how to choose the right private messaging app for your
          life. No SEO fluff, no listicles, no sponsored placements — every
          claim is keyed to a primary source.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#4a5a4f]">
          <span>{POSTS.length} articles</span>
          <span aria-hidden>·</span>
          <span>Updated {new Date().getFullYear()}</span>
        </div>
      </section>

      {/* Posts list */}
      <section className="max-w-[820px] mx-auto px-5 sm:px-8 mt-14 pb-16">
        <ol className="space-y-5">
          {POSTS.map((p) => (
            <li key={p.href}>
              <Link
                to={p.href}
                className="block rounded-2xl bg-white border border-[#0F2A18]/10 p-6 sm:p-7 hover:border-[#2E6F40]/40 hover:shadow-[0_18px_36px_-22px_rgba(46,111,64,0.4)] transition-all"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold tracking-[0.12em] uppercase text-[#2E6F40]">
                  <span>{p.badge}</span>
                  <span aria-hidden className="text-[#4a5a4f]/50">·</span>
                  <time dateTime={p.date} className="text-[#4a5a4f] normal-case tracking-normal font-medium">
                    {p.dateLabel}
                  </time>
                  <span aria-hidden className="text-[#4a5a4f]/50">·</span>
                  <span className="text-[#4a5a4f] normal-case tracking-normal font-medium">
                    {p.readingMinutes} min read
                  </span>
                </div>
                <h2
                  className="mt-3 text-[24px] sm:text-[28px] leading-[1.2] font-semibold tracking-tight text-[#0F2A18]"
                  style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
                >
                  {p.title}
                </h2>
                <p className="mt-3 text-[16.5px] leading-[1.7] text-[#28332c]">
                  {p.description}
                </p>
                <div className="mt-4 text-[14px] font-semibold text-[#2E6F40]">
                  Read article →
                </div>
              </Link>
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
            A messenger that can't read you
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
