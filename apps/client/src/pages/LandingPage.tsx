import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

/**
 * Public marketing landing page. The first thing every visitor sees.
 *
 * Self-contained on purpose: no app shell, no auth dependencies, no
 * tRPC. Tailwind only, with inline SVG illustrations so it has zero
 * runtime asset dependencies and renders instantly even if the API
 * is cold-starting.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b1014] text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-50">
      <BackgroundGlow />
      <NavBar />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Security />
      <Comparison />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ───────────────────────── Nav ───────────────────────── */

function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 inset-x-0 z-40 transition-all duration-300",
        scrolled
          ? "bg-[#0b1014]/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <BrandMark />
          <span className="text-[17px] font-semibold tracking-tight">Veil</span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#how" className="hover:text-white transition">How it works</a>
          <a href="#security" className="hover:text-white transition">Security</a>
          <a href="#faq" className="hover:text-white transition">FAQ</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-zinc-300 hover:text-white px-3 py-2 rounded-lg transition"
          >
            Sign in
          </Link>
          <Link
            to="/welcome"
            className="text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-400 transition px-4 py-2 rounded-lg shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]"
          >
            Get started
          </Link>
        </div>

        <button
          aria-label="Open menu"
          className="md:hidden text-zinc-300 p-2 -mr-2"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[#0b1014]/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1 text-sm">
            <a onClick={() => setOpen(false)} href="#features" className="py-2.5 text-zinc-300">Features</a>
            <a onClick={() => setOpen(false)} href="#how" className="py-2.5 text-zinc-300">How it works</a>
            <a onClick={() => setOpen(false)} href="#security" className="py-2.5 text-zinc-300">Security</a>
            <a onClick={() => setOpen(false)} href="#faq" className="py-2.5 text-zinc-300">FAQ</a>
            <div className="h-px bg-white/5 my-2" />
            <Link onClick={() => setOpen(false)} to="/login" className="py-2.5 text-zinc-300">Sign in</Link>
            <Link
              onClick={() => setOpen(false)}
              to="/welcome"
              className="mt-1 text-center text-white font-medium bg-emerald-500 hover:bg-emerald-400 px-4 py-3 rounded-lg"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function BrandMark() {
  return (
    <span className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 grid place-items-center shadow-[0_8px_20px_-6px_rgba(16,185,129,0.55)]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2.2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative pt-32 sm:pt-40 pb-20 sm:pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-medium tracking-wide uppercase text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Open-source · End-to-end encrypted
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-semibold tracking-tight leading-[1.05]">
              Private messaging.
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                Without the trade-offs.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl leading-relaxed">
              Veil is a fast, modern messenger built around one promise:
              your conversations are yours alone. End-to-end encrypted by
              default, no ads, no trackers, no data harvesting — ever.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                to="/welcome"
                className="group inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-7 py-4 rounded-xl shadow-[0_18px_40px_-12px_rgba(16,185,129,0.6)] transition"
              >
                Get started — it's free
                <svg className="transition group-hover:translate-x-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-200 font-medium px-7 py-4 rounded-xl transition"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <CheckDot /> No phone number required
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckDot /> Works on every device
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckDot /> Forever free, no ads
              </span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckDot() {
  return (
    <span className="grid place-items-center w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-300">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="absolute -inset-10 bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-transparent blur-3xl rounded-full pointer-events-none" />
      <div className="relative rounded-[2.4rem] border border-white/10 bg-[#0f161b] p-3 shadow-[0_60px_120px_-30px_rgba(0,0,0,0.8)]">
        <div className="rounded-[1.9rem] overflow-hidden border border-white/5 bg-[#0b1014]">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between text-[10px] text-zinc-500">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="ml-1">100%</span>
            </span>
          </div>

          <div className="px-5 py-3 flex items-center gap-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 grid place-items-center text-sm font-semibold">
              A
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Alex</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                end-to-end encrypted
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>

          <div className="px-4 py-5 space-y-3 min-h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_60%)]">
            <Bubble side="in">Hey, did you see the new build?</Bubble>
            <Bubble side="in" delay>It's actually really fast 🔥</Bubble>
            <Bubble side="out">Just opened it. The animations are buttery.</Bubble>
            <Bubble side="out" delay>And no ads anywhere ✨</Bubble>
            <Bubble side="in">That's the dream tbh</Bubble>
          </div>

          <div className="px-4 pt-2 pb-4 border-t border-white/5 flex items-center gap-2">
            <div className="flex-1 h-9 rounded-full bg-white/5 px-4 flex items-center text-[12px] text-zinc-500">
              Type a message
            </div>
            <button className="w-9 h-9 rounded-full bg-emerald-500 grid place-items-center text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  children,
  side,
  delay,
}: {
  children: React.ReactNode;
  side: "in" | "out";
  delay?: boolean;
}) {
  return (
    <div className={side === "in" ? "flex justify-start" : "flex justify-end"}>
      <div
        className={[
          "max-w-[78%] text-[13px] leading-snug px-3.5 py-2 rounded-2xl shadow-sm",
          side === "in"
            ? "bg-white/[0.06] text-zinc-100 rounded-bl-sm"
            : "bg-emerald-500 text-white rounded-br-sm",
          delay ? "opacity-90" : "",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Trust bar ───────────────────────── */

function TrustBar() {
  const stats = [
    { v: "100%", k: "End-to-end encrypted" },
    { v: "0", k: "Ads or trackers" },
    { v: "Open", k: "Source on GitHub" },
    { v: "PWA", k: "Installs on any device" },
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.k} className="text-center">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              {s.v}
            </div>
            <div className="text-xs sm:text-sm text-zinc-500 mt-1">{s.k}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Features ───────────────────────── */

function Features() {
  const items: Array<{
    title: string;
    body: string;
    icon: React.ReactNode;
    accent: string;
  }> = [
    {
      title: "End-to-end encrypted",
      body: "Every message, photo, and voice note is encrypted on your device with the Signal-style Double Ratchet. Not even our servers can read them.",
      icon: <IconShield />,
      accent: "from-emerald-400/20 to-teal-500/10",
    },
    {
      title: "No phone number needed",
      body: "Sign up with a random ID and a recovery phrase. No SIM, no email, no identity attached to your account.",
      icon: <IconMask />,
      accent: "from-violet-400/20 to-fuchsia-500/10",
    },
    {
      title: "Disappearing messages",
      body: "Set a timer per chat — 1 hour, 1 day, 1 week. Messages vanish from every device automatically when time's up.",
      icon: <IconTimer />,
      accent: "from-rose-400/20 to-orange-500/10",
    },
    {
      title: "Encrypted group chats",
      body: "Built on the MLS-style Sender Keys protocol. Add up to hundreds of members with the same end-to-end guarantees as 1:1 chats.",
      icon: <IconGroup />,
      accent: "from-sky-400/20 to-indigo-500/10",
    },
    {
      title: "Voice notes & media",
      body: "Send photos, view-once images, and voice messages. Everything is encrypted before it ever leaves your phone.",
      icon: <IconMic />,
      accent: "from-amber-400/20 to-yellow-500/10",
    },
    {
      title: "Push notifications, privately",
      body: "Get notified instantly when a message arrives — but the notification payload itself contains nothing readable on the wire.",
      icon: <IconBell />,
      accent: "from-emerald-400/20 to-lime-500/10",
    },
    {
      title: "Stealth mode",
      body: "Hide read receipts, typing indicators, and last-seen. Auto-blur the app when you switch tabs. Your privacy, your rules.",
      icon: <IconEye />,
      accent: "from-fuchsia-400/20 to-pink-500/10",
    },
    {
      title: "Works everywhere",
      body: "Install Veil to your home screen as a PWA on iOS, Android, Mac, Windows, and Linux. One account, every device.",
      icon: <IconDevices />,
      accent: "from-cyan-400/20 to-blue-500/10",
    },
    {
      title: "Open source",
      body: "Every line of code is auditable. No hidden backdoors, no proprietary blobs. Run it, fork it, host it yourself.",
      icon: <IconCode />,
      accent: "from-emerald-400/20 to-teal-500/10",
    },
  ];
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>Features</SectionLabel>
        <SectionHeading
          title="Everything you'd want in a messenger."
          subtitle="Nothing you wouldn't."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it) => (
            <div
              key={it.title}
              className="group relative rounded-2xl border border-white/5 bg-white/[0.025] hover:bg-white/[0.04] hover:border-white/10 transition p-7 overflow-hidden"
            >
              <div
                className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${it.accent} blur-3xl opacity-60 group-hover:opacity-100 transition`}
              />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 grid place-items-center text-emerald-300 mb-5">
                  {it.icon}
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-white">{it.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create an account in 30 seconds",
      body: "Pick how you want to sign up — phone, email, or a random ID with a recovery phrase. No personal data is ever required.",
    },
    {
      n: "02",
      title: "Connect with the people you trust",
      body: "Share a one-tap invite link with anyone. They join, you both verify, and a private encrypted channel is opened between you.",
    },
    {
      n: "03",
      title: "Talk freely — forever",
      body: "Send messages, voice notes, photos, and join group chats. Everything is end-to-end encrypted. We literally can't read it.",
    },
  ];
  return (
    <section id="how" className="py-24 sm:py-32 bg-gradient-to-b from-transparent via-white/[0.015] to-transparent">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>How it works</SectionLabel>
        <SectionHeading
          title="Three steps. That's the whole thing."
          subtitle="No setup wizards. No personal questions. Just messaging that respects you."
        />
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-white/5 bg-[#0f161b] p-7"
            >
              <div className="text-emerald-400 text-sm font-mono">{s.n}</div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.body}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-white/20 to-transparent" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Security ───────────────────────── */

function Security() {
  return (
    <section id="security" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionLabel>Security</SectionLabel>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
              Encryption that's been
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                public for a decade.
              </span>
            </h2>
            <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
              Veil uses the same battle-tested cryptographic primitives that
              secure billions of messages every day. We didn't roll our own —
              we stand on the shoulders of giants.
            </p>
            <ul className="mt-8 space-y-4">
              <SecurityRow
                title="X3DH key exchange"
                body="Asynchronous handshake establishes a shared secret even when the recipient is offline."
              />
              <SecurityRow
                title="Double Ratchet"
                body="Forward secrecy and post-compromise security on every single message — past chats stay safe even if a key leaks."
              />
              <SecurityRow
                title="Zero-knowledge servers"
                body="Our infrastructure relays opaque ciphertext. The encryption keys never leave your device."
              />
              <SecurityRow
                title="100% open source"
                body="Audit it, fork it, self-host it. No hidden code. No proprietary crypto."
              />
            </ul>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-tr from-emerald-500/15 to-teal-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="relative rounded-2xl border border-white/10 bg-[#0f161b] p-6 font-mono text-[12px] leading-relaxed shadow-2xl">
              <div className="flex items-center gap-1.5 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 text-zinc-500 text-[11px]">message.encrypt.ts</span>
              </div>
              <div className="space-y-1.5">
                <CodeLine c="zinc-500"># Alice sends "Hi" to Bob</CodeLine>
                <CodeLine><span className="text-violet-300">const</span> <span className="text-sky-300">plaintext</span> = <span className="text-emerald-300">"Hi"</span>;</CodeLine>
                <CodeLine />
                <CodeLine c="zinc-500"># Derive next message key from the ratchet</CodeLine>
                <CodeLine><span className="text-violet-300">const</span> {"{"} key, header {"}"} = <span className="text-amber-300">ratchet</span>.<span className="text-sky-300">advance</span>();</CodeLine>
                <CodeLine />
                <CodeLine c="zinc-500"># AES-256-GCM with the per-message key</CodeLine>
                <CodeLine><span className="text-violet-300">const</span> <span className="text-sky-300">ciphertext</span> = <span className="text-amber-300">aesGcm</span>.<span className="text-sky-300">encrypt</span>(plaintext, key);</CodeLine>
                <CodeLine />
                <CodeLine c="zinc-500"># Server only sees opaque bytes</CodeLine>
                <CodeLine><span className="text-amber-300">veil</span>.<span className="text-sky-300">send</span>({"{"} header, ciphertext {"}"});</CodeLine>
                <CodeLine />
                <div className="pl-2 border-l-2 border-emerald-500/50 bg-emerald-500/5 text-emerald-300 px-3 py-2 rounded">
                  ✓ Server stored 46 bytes of unreadable ciphertext.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecurityRow({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <div className="mt-1 grid place-items-center w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-300 shrink-0 border border-emerald-500/20">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <div>
        <h4 className="font-semibold text-white">{title}</h4>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

function CodeLine({
  children,
  c,
}: {
  children?: React.ReactNode;
  c?: string;
}) {
  return (
    <div className={c ? `text-${c}` : "text-zinc-200"}>
      {children ?? "\u00a0"}
    </div>
  );
}

/* ───────────────────────── Comparison ───────────────────────── */

function Comparison() {
  const rows: Array<{ label: string; veil: boolean | string; others: boolean | string }> = [
    { label: "End-to-end encrypted by default", veil: true, others: "Sometimes" },
    { label: "No phone number required", veil: true, others: false },
    { label: "Open source", veil: true, others: "Rarely" },
    { label: "No ads or trackers", veil: true, others: false },
    { label: "Disappearing messages", veil: true, others: "Limited" },
    { label: "Self-hostable", veil: true, others: false },
    { label: "Free forever", veil: true, others: "Maybe" },
  ];

  return (
    <section className="py-24 sm:py-32 bg-gradient-to-b from-transparent via-white/[0.015] to-transparent">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <SectionLabel>The honest comparison</SectionLabel>
        <SectionHeading
          title="Why people switch to Veil."
          subtitle="The features other messengers gate, charge for, or quietly skip."
        />
        <div className="mt-12 rounded-2xl border border-white/5 bg-[#0f161b] overflow-hidden">
          <div className="grid grid-cols-3 text-sm font-medium border-b border-white/5">
            <div className="px-5 py-4 text-zinc-400">Feature</div>
            <div className="px-5 py-4 text-center text-emerald-300">Veil</div>
            <div className="px-5 py-4 text-center text-zinc-400">Typical messenger</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-3 text-sm ${i !== rows.length - 1 ? "border-b border-white/5" : ""}`}
            >
              <div className="px-5 py-4 text-zinc-300">{r.label}</div>
              <div className="px-5 py-4 grid place-items-center">
                <Cell value={r.veil} positive />
              </div>
              <div className="px-5 py-4 grid place-items-center">
                <Cell value={r.others} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cell({ value, positive }: { value: boolean | string; positive?: boolean }) {
  if (value === true) {
    return (
      <span className={`grid place-items-center w-7 h-7 rounded-full ${positive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-zinc-300"}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="grid place-items-center w-7 h-7 rounded-full bg-rose-500/10 text-rose-400/80">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return <span className="text-xs text-zinc-500">{value}</span>;
}

/* ───────────────────────── FAQ ───────────────────────── */

function FAQ() {
  const items = [
    {
      q: "Is Veil really free?",
      a: "Yes — and it always will be. Veil is open source and run as a community project. There are no ads, no premium tiers, and no data sales because we don't have your data to sell.",
    },
    {
      q: "Do I need to give my phone number?",
      a: "No. You can sign up with a random ID and a recovery phrase that exists only on your device. Phone and email signup are also available if you prefer.",
    },
    {
      q: "Can the Veil team read my messages?",
      a: "No. Encryption keys are generated on your device and never leave it. Our servers only see opaque ciphertext — bytes that look like random noise. Even if someone hacked us, they'd get nothing readable.",
    },
    {
      q: "What happens if I lose my device?",
      a: "If you signed up with a recovery phrase, you can restore access on a new device. Your encrypted message history isn't recoverable by design — that's the privacy trade-off.",
    },
    {
      q: "Does it work on iPhone?",
      a: "Yes. Veil works as a Progressive Web App — open it in Safari, tap Share → Add to Home Screen, and it behaves like a native app, including push notifications on iOS 16.4+.",
    },
    {
      q: "Is the source code really open?",
      a: "Yes. Every line — client, server, and crypto layer — is on GitHub under a permissive license. Audit it, run it, or self-host the entire stack on your own infrastructure.",
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionLabel>FAQ</SectionLabel>
        <SectionHeading
          title="Questions, answered."
          subtitle="If something's not here, we're easy to reach."
        />
        <div className="mt-12 divide-y divide-white/5 border-y border-white/5">
          {items.map((it, i) => (
            <button
              key={it.q}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full text-left py-5 group"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-white text-base sm:text-lg">{it.q}</span>
                <span
                  className={`shrink-0 w-7 h-7 grid place-items-center rounded-full border border-white/10 text-zinc-400 transition group-hover:border-white/20 ${openIdx === i ? "bg-emerald-500/15 text-emerald-300 rotate-45 border-emerald-500/30" : ""}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </span>
              </div>
              <div
                className={`grid transition-all duration-300 ${openIdx === i ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <p className="text-zinc-400 leading-relaxed text-sm sm:text-base pr-10">
                    {it.a}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent p-10 sm:p-16 text-center">
          <div className="absolute -top-32 -left-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-20 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Take your conversations back.
            </h2>
            <p className="mt-5 text-lg text-zinc-300 max-w-xl mx-auto">
              Join Veil today. It takes 30 seconds, costs nothing, and your messages
              stay between you and the people you actually trust.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/welcome"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl shadow-[0_18px_40px_-12px_rgba(16,185,129,0.7)] transition"
              >
                Get started — free forever
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 border border-white/15 hover:bg-white/5 text-white font-medium px-8 py-4 rounded-xl transition"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#080c10]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <a href="#top" className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-[17px] font-semibold tracking-tight">Veil</span>
            </a>
            <p className="mt-4 text-sm text-zinc-500 max-w-sm leading-relaxed">
              The privacy-first messenger. End-to-end encrypted, open source,
              and built for everyone who believes their conversations are no
              one else's business.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <SocialIcon label="GitHub" href="https://github.com">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.57.23 2.73.11 3.02.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" /></svg>
              </SocialIcon>
              <SocialIcon label="X (Twitter)" href="https://x.com">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </SocialIcon>
              <SocialIcon label="Mastodon" href="https://mastodon.social">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.58 13.91c-.29 1.5-2.61 3.13-5.27 3.45-1.39.17-2.75.32-4.21.25-2.39-.11-4.27-.57-4.27-.57 0 .23.01.45.04.66.31 2.36 2.34 2.5 4.27 2.57 1.94.07 3.67-.48 3.67-.48l.08 1.76s-1.36.73-3.78.86c-1.34.07-3-.04-4.93-.55C2.99 20.74 2.27 16.27 2.16 11.74 2.13 10.4 2.15 9.13 2.15 8.07c0-4.64 3.04-6 3.04-6 1.54-.71 4.16-1 6.89-1.02h.07c2.73.02 5.36.31 6.89 1.02 0 0 3.04 1.36 3.04 6 0 0 .04 3.42-.5 5.84z" /></svg>
              </SocialIcon>
            </div>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: "Features", href: "#features" },
              { label: "How it works", href: "#how" },
              { label: "Security", href: "#security" },
              { label: "FAQ", href: "#faq" },
            ]}
          />
          <FooterCol
            title="Get the app"
            internal
            links={[
              { label: "Sign up", to: "/welcome" },
              { label: "Sign in", to: "/login" },
              { label: "Install as PWA", href: "#how" },
            ]}
          />
          <FooterCol
            title="Resources"
            links={[
              { label: "GitHub", href: "https://github.com" },
              { label: "Privacy", href: "#" },
              { label: "Terms", href: "#" },
              { label: "Contact", href: "mailto:hello@veil.app" },
            ]}
          />
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} Veil. Made with care for the people who deserve privacy.</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="w-9 h-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:border-white/20 transition"
    >
      {children}
    </a>
  );
}

type FooterLink =
  | { label: string; href: string; to?: undefined }
  | { label: string; to: string; href?: undefined };

function FooterCol({
  title,
  links,
  internal,
}: {
  title: string;
  links: FooterLink[];
  internal?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wider uppercase text-zinc-300">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) =>
          internal && l.to ? (
            <li key={l.label}>
              <Link to={l.to} className="text-zinc-400 hover:text-white transition">
                {l.label}
              </Link>
            </li>
          ) : (
            <li key={l.label}>
              <a
                href={l.href ?? "#"}
                className="text-zinc-400 hover:text-white transition"
                {...(l.href?.startsWith("http") ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              >
                {l.label}
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/* ───────────────────────── Section helpers ───────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase text-emerald-300/90">
      <span className="w-6 h-px bg-emerald-400/60" />
      {children}
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] max-w-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-zinc-400 max-w-2xl">{subtitle}</p>
      )}
    </>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_60%)]" />
      <div className="absolute top-[40%] -left-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.10),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

/* ───────────────────────── Icons ───────────────────────── */

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconMask() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c0-4 3-7 9-7s9 3 9 7c0 5-4 8-9 8s-9-3-9-8z" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}
function IconTimer() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </svg>
  );
}
function IconGroup() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="10" r="2.6" />
      <path d="M16 20a5 5 0 0 1 5.5-5" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
function IconDevices() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="10" rx="1.5" />
      <rect x="14" y="9" width="8" height="12" rx="1.5" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l-6-6 6-6" />
      <path d="M15 6l6 6-6 6" />
    </svg>
  );
}
