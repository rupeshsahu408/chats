import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDocumentMeta } from "../lib/useDocumentMeta";

const REPO_URL = "https://github.com/rupeshsahu408/VeilChat";
const REPO_API = "https://api.github.com/repos/rupeshsahu408/VeilChat";
const SECURITY_URL = `${REPO_URL}/blob/main/SECURITY.md`;
const TRANSPARENCY_URL = `${REPO_URL}/blob/main/TRANSPARENCY.md`;
const TRADEMARK_URL = `${REPO_URL}/blob/main/TRADEMARK.md`;
const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
const CRYPTO_URL = `${REPO_URL}/tree/main/packages/crypto`;
const README_URL = `${REPO_URL}/blob/main/README.md`;

/**
 * Public "Open Source" page.
 *
 * The most important page on the site for a privacy product:
 * it converts the abstract claim "we encrypt everything" into
 * something the visitor can actually verify themselves.
 *
 * Visual language matches the warm cream + forest green of the
 * landing page so the two read as one continuous site.
 */
export function OpenSourcePage() {
  useDocumentMeta({
    title: "Open source — every line, on GitHub · VeilChat",
    description:
      "VeilChat is open source: client, server, and crypto layer are on GitHub under a permissive license. Audit it, run it, or self-host the entire stack.",
    canonical: "/open-source",
    ogType: "website",
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
      <TopBar />
      <Hero />
      <StatsStrip />
      <RepoShowcase />
      <WhyOpenSource />
      <RepoTour />
      <CodePeek />
      <Comparison />
      <LicensePlainEnglish />
      <SecurityAndContribute />
      <FinalCTA />
      <PageFooter />
    </div>
  );
}

/* ───────────────────────── Top bar ───────────────────────── */

function TopBar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={[
        "fixed top-0 inset-x-0 z-40 transition-colors duration-200",
        scrolled
          ? "bg-[#FCF5EB]/85 backdrop-blur-xl border-b border-[#253D2C]/10"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[18px] font-bold tracking-tight text-[#253D2C]">
            VeilChat
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-[14px] font-medium text-[#253D2C] hover:text-[#2E6F40] px-4 py-2 rounded-full"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M11 5l-7 7 7 7" />
            </svg>
            Back to home
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#2E6F40] hover:bg-[#253D2C] px-4 py-2 rounded-full transition-colors"
          >
            <GithubIcon size={14} />
            View on GitHub
          </a>
        </div>
      </div>
    </header>
  );
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
      }}
      className="relative bg-[#2E6F40] grid place-items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-8px_rgba(46,111,64,0.55)]"
    >
      <svg
        viewBox="0 0 64 64"
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        aria-hidden="true"
      >
        <path
          d="M16 22 L32 44 L48 22"
          fill="none"
          stroke="white"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="52" cy="13" r="4" fill="white" />
      </svg>
    </span>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative pt-32 sm:pt-36 pb-12 sm:pb-16 overflow-hidden">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-[#2E6F40] bg-[#CFFFDC] border border-[#68BA7F]/40 rounded-full px-3 py-1.5">
          <GithubIcon size={11} />
          100% open source · AGPL-3.0
        </div>

        <h1
          className="mt-6 text-[44px] sm:text-[60px] md:text-[72px] font-semibold tracking-[-0.025em] leading-[1.02] text-[#253D2C]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          Don't trust us.{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            Verify.
          </span>
        </h1>

        <p className="mt-6 text-[18px] sm:text-[20px] text-[#3C5A47] leading-[1.55] max-w-2xl mx-auto">
          Every line of VeilChat is public. The encryption that protects your
          messages, the server that routes them, the app you tap on — all
          open, all auditable, all licensed under AGPL-3.0.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center sm:items-center">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-[#2E6F40] hover:bg-[#253D2C] text-white font-semibold text-[16px] px-7 py-4 rounded-full shadow-[0_18px_36px_-14px_rgba(46,111,64,0.55)] transition-colors"
          >
            <GithubIcon size={16} />
            Read the source on GitHub
            <ArrowOut />
          </a>
          <a
            href="#repo-tour"
            className="inline-flex items-center justify-center gap-2 border border-[#253D2C]/15 hover:border-[#2E6F40]/40 hover:bg-white text-[#253D2C] font-medium text-[16px] px-7 py-4 rounded-full transition-colors"
          >
            What's inside the repo
          </a>
        </div>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(207,255,220,0.85), rgba(207,255,220,0) 65%)",
        }}
      />
    </div>
  );
}

/* ───────────────────────── Live GitHub stats ───────────────────────── */

type RepoStats = {
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  lastUpdated: string | null;
};

function StatsStrip() {
  const [stats, setStats] = useState<RepoStats>({
    stars: null,
    forks: null,
    watchers: null,
    lastUpdated: null,
  });
  const [contributors, setContributors] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(REPO_API)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStats({
          stars: data.stargazers_count ?? null,
          forks: data.forks_count ?? null,
          watchers: data.subscribers_count ?? null,
          lastUpdated: data.pushed_at ?? null,
        });
      })
      .catch(() => {
        /* silently fall back to placeholders */
      });

    fetch(`${REPO_API}/contributors?per_page=100&anon=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setContributors(data.length);
      })
      .catch(() => {
        /* silently fall back to placeholder */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const cards: Array<{
    label: string;
    value: string;
    icon: JSX.Element;
    live?: boolean;
  }> = [
    {
      label: "Stars",
      value: stats.stars != null ? formatCount(stats.stars) : "—",
      icon: <StarIcon />,
    },
    {
      label: "Contributors",
      value: contributors != null ? formatCount(contributors) : "—",
      icon: <PeopleIcon />,
    },
    {
      label: "License",
      value: "AGPL-3.0",
      icon: <ScaleIcon />,
    },
    {
      label: "Last commit",
      value: stats.lastUpdated ? timeAgo(stats.lastUpdated) : "—",
      icon: <ClockIcon />,
      live: stats.lastUpdated != null,
    },
  ];

  return (
    <section className="relative pb-4">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {cards.map((c) => (
            <a
              key={c.label}
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 bg-white border border-[#253D2C]/10 hover:border-[#2E6F40]/40 rounded-2xl px-4 py-3.5 transition-colors shadow-[0_2px_8px_-4px_rgba(17,27,33,0.08)]"
            >
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#CFFFDC] text-[#2E6F40]">
                {c.icon}
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-[#3C5A47]/70">
                  {c.label}
                  {c.live && <LivePulse />}
                </span>
                <span className="text-[16px] font-semibold text-[#253D2C] truncate">
                  {c.value}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, (Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 86400 * 365)
    return `${Math.floor(diffSec / (86400 * 30))}mo ago`;
  return `${Math.floor(diffSec / (86400 * 365))}y ago`;
}

/* ───────────────────────── Repo screenshot showcase ───────────────────────── */

function RepoShowcase() {
  return (
    <section className="py-16 sm:py-24 px-5 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <SectionLabel>The whole project, in plain sight</SectionLabel>
          <SectionHeading
            title={
              <>
                This is the actual repo.
                <br className="hidden sm:block" /> Not a marketing screenshot.
              </>
            }
            subtitle="Click any folder, read any file, audit any commit. There's no separate, secret version of VeilChat — what's running on your phone is what's published here."
          />
        </div>

        <BrowserFrame url="github.com/rupeshsahu408/VeilChat">
          <img
            src="/landing/veilchat-github-repo.png"
            alt="VeilChat GitHub repository file listing — README, LICENSE, SECURITY.md, TRANSPARENCY.md, TRADEMARK.md, packages/crypto, server-contract, and more."
            className="block w-full h-auto"
            loading="lazy"
          />
        </BrowserFrame>

        <div className="mt-6 flex justify-center">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#2E6F40] hover:text-[#253D2C]"
          >
            Open the live repo
            <ArrowOut />
          </a>
        </div>
      </div>
    </section>
  );
}

function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-[#253D2C]/15 bg-[#0d1117] shadow-[0_60px_120px_-30px_rgba(17,27,33,0.45)]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161b22] border-b border-white/5">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex-1 text-center text-[12px] text-white/55 font-mono truncate px-3">
          {url}
        </span>
        <span className="w-12" />
      </div>
      <div className="bg-[#0d1117]">{children}</div>
    </div>
  );
}

/* ───────────────────────── Why open source ───────────────────────── */

function WhyOpenSource() {
  const pillars = [
    {
      icon: <EyeIcon />,
      title: "You can read the encryption code.",
      body: "Not a whitepaper. Not a marketing diagram. The actual TypeScript that derives keys, encrypts every message, and verifies every signature — sitting in packages/crypto on GitHub.",
    },
    {
      icon: <FingerprintIcon />,
      title: "We can't change it without you knowing.",
      body: "Every change is a public commit. Every release is a public tag. If we ever weakened the encryption, every security researcher in the world would see it — instantly.",
    },
    {
      icon: <NoEyeIcon />,
      title: "No tracking, no analytics — and you can prove it.",
      body: "Most apps tell you they don't track you. We let you grep the codebase for it. There are no analytics SDKs, no third-party trackers, no telemetry endpoints. Look for yourself.",
    },
    {
      icon: <InfinityIcon />,
      title: "If we disappear, the project doesn't.",
      body: "The code is yours, under AGPL-3.0. Anyone — you, a community, a future you — can keep VeilChat alive, run their own server, and stay in touch. No vendor lock-in. Forever.",
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-5 sm:px-8 bg-white/60 border-y border-[#253D2C]/10">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-14">
          <SectionLabel>Why this matters to you</SectionLabel>
          <SectionHeading
            title={<>Privacy promises mean nothing<br className="hidden sm:block" /> without proof.</>}
            subtitle="Most messaging apps ask you to take their word for it. VeilChat hands you the receipts."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="rounded-3xl bg-[#FCF5EB] border border-[#253D2C]/10 p-6 sm:p-7 shadow-[0_2px_8px_-4px_rgba(17,27,33,0.06)]"
            >
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-[#CFFFDC] text-[#2E6F40]">
                {p.icon}
              </span>
              <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-[#253D2C] leading-snug">
                {p.title}
              </h3>
              <p className="mt-2.5 text-[15px] text-[#3C5A47] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Repo tour ───────────────────────── */

function RepoTour() {
  const items: Array<{
    name: string;
    desc: string;
    href: string;
    type: "folder" | "doc";
  }> = [
    {
      name: "packages/crypto/",
      desc: "The encryption core. Ed25519 identity keys, X25519 key agreement, recovery-phrase derivation. The math that protects your messages.",
      href: CRYPTO_URL,
      type: "folder",
    },
    {
      name: "server-contract/",
      desc: "The exact wire protocol our server speaks. Anyone can run their own VeilChat server that's compatible with the official client.",
      href: `${REPO_URL}/tree/main/server-contract`,
      type: "folder",
    },
    {
      name: "docs/",
      desc: "Architecture notes, threat model, and how each piece fits together. Written for humans, not lawyers.",
      href: `${REPO_URL}/tree/main/docs`,
      type: "folder",
    },
    {
      name: "SECURITY.md",
      desc: "Found a vulnerability? This is how to report it responsibly. Static analysis policy and dependency hygiene live here too.",
      href: SECURITY_URL,
      type: "doc",
    },
    {
      name: "TRANSPARENCY.md",
      desc: "Our public ledger of promises — and how to verify each one. Includes published-package verification instructions.",
      href: TRANSPARENCY_URL,
      type: "doc",
    },
    {
      name: "TRADEMARK.md",
      desc: "What you can and can't do with the VeilChat name and logo. Open source code, protected brand.",
      href: TRADEMARK_URL,
      type: "doc",
    },
    {
      name: "CONTRIBUTING.md",
      desc: "How to send a pull request, our review checklist, and the automated checks that gate every change.",
      href: CONTRIBUTING_URL,
      type: "doc",
    },
    {
      name: "LICENSE",
      desc: "AGPL-3.0. You can read it, run it, modify it, and redistribute it — as long as your version stays open too.",
      href: LICENSE_URL,
      type: "doc",
    },
    {
      name: "README.md",
      desc: "Start here. The 5-minute tour: what VeilChat is, how to run it locally, and how the pieces talk to each other.",
      href: README_URL,
      type: "doc",
    },
  ];

  return (
    <section id="repo-tour" className="py-16 sm:py-24 px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-14">
          <SectionLabel>A guided tour</SectionLabel>
          <SectionHeading
            title={<>What's actually in the repo.</>}
            subtitle="You don't need to be a developer to understand what each part does. Tap any item to open it on GitHub."
          />
        </div>

        <div className="rounded-3xl border border-[#253D2C]/10 bg-white overflow-hidden shadow-[0_2px_8px_-4px_rgba(17,27,33,0.08)]">
          {items.map((it, idx) => (
            <a
              key={it.name}
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "group flex items-start gap-4 px-5 sm:px-6 py-4 sm:py-5 hover:bg-[#FCF5EB] transition-colors",
                idx > 0 ? "border-t border-[#253D2C]/8" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "shrink-0 grid place-items-center w-10 h-10 rounded-xl",
                  it.type === "folder"
                    ? "bg-[#CFFFDC] text-[#2E6F40]"
                    : "bg-[#253D2C]/8 text-[#253D2C]",
                ].join(" ")}
              >
                {it.type === "folder" ? <FolderIcon /> : <DocIcon />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-mono text-[14px] sm:text-[15px] font-semibold text-[#253D2C]">
                  {it.name}
                </span>
                <span className="block mt-1 text-[14px] sm:text-[15px] text-[#3C5A47] leading-relaxed">
                  {it.desc}
                </span>
              </span>
              <span className="shrink-0 text-[#3C5A47]/40 group-hover:text-[#2E6F40] transition-colors mt-1.5">
                <ArrowOut />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Code peek ───────────────────────── */

function CodePeek() {
  return (
    <section className="py-16 sm:py-24 px-5 sm:px-8 bg-white/60 border-y border-[#253D2C]/10">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-5">
          <SectionLabel>The encryption, in code</SectionLabel>
          <h2
            className="mt-3 text-[34px] sm:text-[42px] font-semibold tracking-tight leading-[1.1] text-[#253D2C]"
            style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
          >
            Real code.<br />
            <span className="italic" style={{ color: "#2E6F40" }}>
              Real keys.
            </span>{" "}
            Real you.
          </h2>
          <p className="mt-5 text-[16px] sm:text-[17px] text-[#3C5A47] leading-relaxed">
            Every device generates an Ed25519 identity keypair locally. The
            private key never leaves your device — not even encrypted, not
            even backed up. We literally couldn't read your messages if a
            court asked us to.
          </p>
          <p className="mt-4 text-[16px] sm:text-[17px] text-[#3C5A47] leading-relaxed">
            This snippet lives in{" "}
            <code className="font-mono text-[14px] bg-[#CFFFDC]/60 text-[#253D2C] px-1.5 py-0.5 rounded">
              packages/crypto/
            </code>{" "}
            on GitHub. You can read it, run it, audit it.
          </p>
          <a
            href={CRYPTO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 text-[15px] font-semibold text-[#2E6F40] hover:text-[#253D2C]"
          >
            Open packages/crypto on GitHub
            <ArrowOut />
          </a>
        </div>

        <div className="lg:col-span-7">
          <CodeWindow
            filename="packages/crypto/identity.ts"
            lines={[
              { c: "// Generate a brand-new Ed25519 identity for this device." },
              { c: "// Runs entirely client-side. The private key never leaves." },
              { c: "" },
              { c: "import { ed25519 } from \"@noble/curves/ed25519\";", t: "stmt" },
              { c: "import { x25519 } from \"@noble/curves/ed25519\";", t: "stmt" },
              { c: "import { randomBytes } from \"@noble/hashes/utils\";", t: "stmt" },
              { c: "" },
              { c: "export function generateIdentity(): Identity {", t: "fn" },
              { c: "  const seed = randomBytes(32);" },
              { c: "  const identityPriv = seed;" },
              { c: "  const identityPub  = ed25519.getPublicKey(seed);" },
              { c: "" },
              { c: "  // Separate X25519 key for ECDH key-agreement (Phase 3+)" },
              { c: "  const sessionPriv = randomBytes(32);" },
              { c: "  const sessionPub  = x25519.getPublicKey(sessionPriv);" },
              { c: "" },
              { c: "  return { identityPriv, identityPub, sessionPriv, sessionPub };", t: "ret" },
              { c: "}" },
              { c: "" },
              { c: "// We never call .send() with a private key. Audit it yourself.", t: "comment" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function CodeWindow({
  filename,
  lines,
}: {
  filename: string;
  lines: Array<{ c: string; t?: "stmt" | "fn" | "ret" | "comment" }>;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-[#253D2C]/15 bg-[#0d1117] shadow-[0_50px_100px_-30px_rgba(17,27,33,0.45)]">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#161b22] border-b border-white/5">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="text-[12px] text-white/55 font-mono truncate">{filename}</span>
      </div>
      <pre
        className="m-0 p-5 sm:p-6 text-[12.5px] sm:text-[13.5px] leading-[1.65] font-mono text-[#c9d1d9] overflow-x-auto"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
      >
        {lines.map((l, i) => (
          <div key={i} className="flex gap-4">
            <span className="text-[#3b4754] select-none w-6 text-right">{i + 1}</span>
            <span style={{ color: codeColor(l) }}>{l.c || "\u00A0"}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function codeColor(l: { c: string; t?: string }): string {
  if (l.c.trim().startsWith("//")) return "#7a8590";
  if (l.t === "stmt") return "#79c0ff";
  if (l.t === "fn") return "#d2a8ff";
  if (l.t === "ret") return "#a5d6ff";
  return "#c9d1d9";
}

/* ───────────────────────── Comparison ───────────────────────── */

function Comparison() {
  type Cell = boolean | string;
  const rows: Array<{ label: string; cells: [Cell, Cell, Cell, Cell] }> = [
    {
      label: "Open-source client",
      cells: [true, false, "Partial", true],
    },
    {
      label: "Open-source server",
      cells: [true, false, false, "Partial"],
    },
    {
      label: "License",
      cells: ["AGPL-3.0", "Proprietary", "Proprietary", "GPL"],
    },
    {
      label: "Public security policy",
      cells: [true, "Limited", "Limited", true],
    },
    {
      label: "Public transparency doc",
      cells: [true, false, false, false],
    },
    {
      label: "Self-hostable",
      cells: [true, false, false, false],
    },
    {
      label: "No tracking SDKs",
      cells: [true, false, false, true],
    },
  ];
  const headers = ["VeilChat", "WhatsApp", "Telegram", "Signal"];
  return (
    <section className="py-16 sm:py-24 px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-14">
          <SectionLabel>Transparency, compared</SectionLabel>
          <SectionHeading
            title={<>How VeilChat stacks up<br className="hidden sm:block" /> on openness.</>}
            subtitle="Encryption is only as trustworthy as your ability to verify it."
          />
        </div>

        <div className="rounded-3xl border border-[#253D2C]/10 bg-white overflow-hidden shadow-[0_2px_8px_-4px_rgba(17,27,33,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#FCF5EB] border-b border-[#253D2C]/10">
                  <th className="py-4 px-5 text-[13px] font-semibold uppercase tracking-wide text-[#3C5A47]/80">
                    Promise
                  </th>
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={[
                        "py-4 px-4 text-[13px] font-semibold uppercase tracking-wide text-center",
                        i === 0 ? "text-[#2E6F40]" : "text-[#3C5A47]/80",
                      ].join(" ")}
                    >
                      {h}
                      {i === 0 && (
                        <span className="block text-[10px] text-[#2E6F40]/80 font-medium mt-0.5">
                          (you're here)
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.label}
                    className={idx > 0 ? "border-t border-[#253D2C]/8" : ""}
                  >
                    <td className="py-4 px-5 text-[14px] sm:text-[15px] text-[#253D2C] font-medium">
                      {r.label}
                    </td>
                    {r.cells.map((c, i) => (
                      <td
                        key={i}
                        className={[
                          "py-4 px-4 text-center text-[14px]",
                          i === 0 ? "bg-[#FCF5EB]/60" : "",
                        ].join(" ")}
                      >
                        <CompCell value={c} highlight={i === 0} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-[12.5px] text-[#3C5A47]/70 text-center max-w-2xl mx-auto">
          Comparison reflects publicly available information at time of writing.
          Verifiable against each project's official repository and security policy.
        </p>
      </div>
    </section>
  );
}

function CompCell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (value === true) {
    return (
      <span
        className={[
          "inline-flex items-center justify-center w-7 h-7 rounded-full",
          highlight
            ? "bg-[#2E6F40] text-white"
            : "bg-[#CFFFDC] text-[#2E6F40]",
        ].join(" ")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#253D2C]/8 text-[#3C5A47]/55">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[12px] font-semibold",
        highlight ? "bg-[#2E6F40] text-white" : "bg-[#FCF5EB] text-[#253D2C] border border-[#253D2C]/10",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

/* ───────────────────────── License plain English ───────────────────────── */

function LicensePlainEnglish() {
  const points = [
    {
      title: "You can use it.",
      body: "For personal use, for your team, for your business — totally free, no asterisks.",
    },
    {
      title: "You can read it.",
      body: "Every line. Every commit. Every release. Forever.",
    },
    {
      title: "You can change it.",
      body: "Fork the repo, modify it, run your own version. It's yours to bend.",
    },
    {
      title: "If you ship it, share back.",
      body: "Run a modified VeilChat as a service? AGPL-3.0 asks you to publish your changes too. Privacy stays a public good.",
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-5 sm:px-8 bg-white/60 border-y border-[#253D2C]/10">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <SectionLabel>The license, in plain English</SectionLabel>
          <SectionHeading
            title={<>AGPL-3.0 in 30 seconds.</>}
            subtitle="Lawyers wrote the long version. Here's what it actually means for you."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {points.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl bg-[#FCF5EB] border border-[#253D2C]/10 p-5 sm:p-6"
            >
              <h3 className="text-[18px] font-semibold text-[#253D2C] tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-[15px] text-[#3C5A47] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#2E6F40] hover:text-[#253D2C]"
          >
            Read the full AGPL-3.0 license
            <ArrowOut />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Security + Contribute ───────────────────────── */

function SecurityAndContribute() {
  return (
    <section className="py-16 sm:py-24 px-5 sm:px-8">
      <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-5 sm:gap-6">
        <a
          href={SECURITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-3xl bg-[#253D2C] text-white p-7 sm:p-9 overflow-hidden relative shadow-[0_30px_60px_-25px_rgba(37,61,44,0.5)] hover:bg-[#1c2f22] transition-colors"
        >
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/10 text-[#CFFFDC]">
            <ShieldIcon />
          </span>
          <h3 className="mt-5 text-[24px] sm:text-[28px] font-semibold tracking-tight leading-tight">
            Found something scary?
          </h3>
          <p className="mt-3 text-[15px] text-white/75 leading-relaxed max-w-md">
            Responsible disclosure is welcome and rewarded with credit. Read
            our SECURITY.md for the disclosure policy, scope, and how to reach
            us privately.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-[#CFFFDC]">
            Read the security policy
            <ArrowOut />
          </span>
        </a>

        <a
          href={CONTRIBUTING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-3xl bg-[#CFFFDC] text-[#1f3027] p-7 sm:p-9 overflow-hidden relative shadow-[0_30px_60px_-25px_rgba(46,111,64,0.35)] hover:bg-[#bdf3cf] transition-colors"
        >
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white text-[#2E6F40]">
            <HeartIcon />
          </span>
          <h3 className="mt-5 text-[24px] sm:text-[28px] font-semibold tracking-tight leading-tight text-[#253D2C]">
            Want to help build it?
          </h3>
          <p className="mt-3 text-[15px] text-[#1f3027]/85 leading-relaxed max-w-md">
            Bug reports, design ideas, translations, code. CONTRIBUTING.md
            walks you through the review checklist and the automated checks
            every PR runs through.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-[#2E6F40]">
            Read the contributor guide
            <ArrowOut />
          </span>
        </a>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCTA() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8">
      <div className="mx-auto max-w-4xl text-center rounded-[32px] bg-gradient-to-br from-[#2E6F40] to-[#1f4a2c] text-white px-7 sm:px-12 py-14 sm:py-20 shadow-[0_60px_120px_-30px_rgba(37,61,44,0.55)] relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(207,255,220,0.25), rgba(207,255,220,0) 65%)",
          }}
        />
        <div className="relative">
          <h2
            className="text-[36px] sm:text-[52px] font-semibold tracking-tight leading-[1.05]"
            style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
          >
            See it for yourself.
          </h2>
          <p className="mt-5 text-[17px] sm:text-[19px] text-white/85 max-w-xl mx-auto leading-relaxed">
            The whole project — encryption, server, app, docs — is one click
            away. No signup, no email, no marketing wall.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center sm:items-center">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FCF5EB] text-[#253D2C] font-semibold text-[16px] px-7 py-4 rounded-full transition-colors"
            >
              <GithubIcon size={16} />
              Open VeilChat on GitHub
              <ArrowOut />
            </a>
            <Link
              to="/welcome"
              className="inline-flex items-center justify-center gap-2 border border-white/25 hover:bg-white/10 text-white font-medium text-[16px] px-7 py-4 rounded-full transition-colors"
            >
              Get the app
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function PageFooter() {
  return (
    <footer className="px-5 sm:px-8 pb-12">
      <div className="mx-auto max-w-6xl border-t border-[#253D2C]/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#3C5A47]">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <span>VeilChat — built in the open. Licensed AGPL-3.0.</span>
        </div>
        <div className="flex items-center gap-5">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#2E6F40]">
            GitHub
          </a>
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#2E6F40]">
            License
          </a>
          <a href={SECURITY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#2E6F40]">
            Security
          </a>
          <Link to="/" className="hover:text-[#2E6F40]">
            Home
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Shared section bits ───────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-semibold tracking-[0.18em] uppercase text-[#2E6F40]">
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <>
      <h2
        className="mt-3 text-[34px] sm:text-[44px] md:text-[52px] font-semibold tracking-tight leading-[1.05] text-[#253D2C]"
        style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-[16px] sm:text-[18px] text-[#3C5A47] max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </>
  );
}

/* ───────────────────────── Icons ───────────────────────── */

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54 0-.27-.01-.97-.02-1.9-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.31 3.1 1.16.9-.25 1.86-.38 2.82-.38.96 0 1.92.13 2.82.38 2.15-1.47 3.1-1.16 3.1-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.29-5.15 5.56.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.05 0 .3.2.65.78.54 4.46-1.49 7.68-5.7 7.68-10.66C23.25 5.48 18.27.5 12 .5z" />
    </svg>
  );
}

function ArrowOut() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <path d="M5 21h14" />
      <path d="M3 9l4-6 4 6" />
      <path d="M13 9l4-6 4 6" />
      <path d="M3 9a4 4 0 0 0 8 0" />
      <path d="M13 9a4 4 0 0 0 8 0" />
    </svg>
  );
}

function LivePulse() {
  return (
    <span
      className="veil-live-pulse"
      role="img"
      aria-label="Live — actively maintained"
      title="Live — actively maintained"
    />
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2c.4 0 .77.16 1.06.44L11 6.5h8.5A1.5 1.5 0 0 1 21 8v9.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 11v3a4 4 0 0 0 8 0V8a8 8 0 1 0-16 0v6" />
      <path d="M8 14v1a4 4 0 0 0 4 4" />
      <path d="M16 22a8 8 0 0 0 .8-3.5" />
    </svg>
  );
}

function NoEyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.5 19.5 0 0 1 4.22-5.06" />
      <path d="M9.9 5.08A11 11 0 0 1 12 5c7 0 11 8 11 8a19.45 19.45 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function InfinityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.6 6.6c-2 0-3 1.4-4.2 3.4-1.5 2.4-2.7 4-4.8 4a3.4 3.4 0 1 1 0-6.8c2 0 3.3 1.6 4.8 4 1.2 2 2.2 3.4 4.2 3.4a3.4 3.4 0 1 0 0-6.8z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
