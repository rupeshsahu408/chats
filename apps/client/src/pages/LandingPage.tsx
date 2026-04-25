import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import peopleUsingPhones from "../assets/landing/people-using-phones.jpg";
import smilingWithPhone from "../assets/landing/smiling-with-phone.jpg";

/**
 * Public marketing landing page.
 *
 * Light, warm, WhatsApp/Meta-inspired design. Self-contained on
 * purpose: no app shell, no auth dependencies, no tRPC.
 */
export function LandingPage() {
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
      <NavBar />
      <Hero />
      <TrustBar />
      <Features />
      <Lifestyle />
      <PressStrip />
      <Testimonials />
      <HowItWorks />
      <Security />
      <Comparison />
      <GetTheApp />
      <FAQ />
      <FinalCTA />
      <Footer />
      <FloatingInstallChip />
    </div>
  );
}

/* ───────────────────────── Floating install chip ───────────────────────── */

const INSTALL_CHIP_DISMISS_KEY = "veil:landing_install_chip_dismissed";

function FloatingInstallChip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(INSTALL_CHIP_DISMISS_KEY) === "1") return;

    const heroThreshold = () =>
      Math.max(window.innerHeight * 0.85, 600);

    const onScroll = () => {
      const past = window.scrollY > heroThreshold();
      setVisible(past);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      sessionStorage.setItem(INSTALL_CHIP_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      aria-hidden={!visible}
      className={[
        "fixed z-50 bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:bottom-6",
        "transition-all duration-200",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
    >
      <Link
        to="/welcome"
        className="group flex items-center gap-2.5 pl-4 pr-2 py-2 rounded-full text-white shadow-[0_18px_40px_-12px_rgba(17,27,33,0.45)] border border-white/10 hover:bg-[#253D2C] transition-colors"
        style={{ backgroundColor: "#2E6F40" }}
      >
        <span className="grid place-items-center w-7 h-7 rounded-full bg-white/15">
          <LockMini />
        </span>
        <span className="flex flex-col leading-tight pr-1">
          <span className="text-[11px] font-medium text-[#CFFFDC] tracking-wide">
            Free · 30 seconds
          </span>
          <span className="text-[14px] font-semibold">Install VeilChat</span>
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="ml-1 grid place-items-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </Link>
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
        "fixed top-0 inset-x-0 z-40 transition-colors duration-200",
        scrolled
          ? "bg-[#FCF5EB]/85 backdrop-blur-xl border-b border-[#253D2C]/10"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[18px] font-bold tracking-tight text-[#253D2C]">
            VeilChat
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-[15px] text-[#3C5A47]">
          <a href="#features" className="hover:text-[#2E6F40]">Features</a>
          <a href="#how" className="hover:text-[#2E6F40]">How it works</a>
          <a href="#security" className="hover:text-[#2E6F40]">Privacy</a>
          <a href="#faq" className="hover:text-[#2E6F40]">FAQ</a>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/login"
            className="text-[15px] font-medium text-[#253D2C] hover:text-[#2E6F40] px-4 py-2 rounded-full"
          >
            Sign in
          </Link>
          <Link
            to="/welcome"
            className="text-[15px] font-semibold text-white bg-[#2E6F40] hover:bg-[#253D2C] px-5 py-2.5 rounded-full transition-colors"
          >
            Get VeilChat
          </Link>
        </div>

        <button
          aria-label="Open menu"
          className="md:hidden text-[#253D2C] p-2 -mr-2"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        <div className="md:hidden border-t border-[#253D2C]/10 bg-[#FCF5EB]/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1 text-[15px]">
            <a onClick={() => setOpen(false)} href="#features" className="py-2.5 text-[#3C5A47]">Features</a>
            <a onClick={() => setOpen(false)} href="#how" className="py-2.5 text-[#3C5A47]">How it works</a>
            <a onClick={() => setOpen(false)} href="#security" className="py-2.5 text-[#3C5A47]">Privacy</a>
            <a onClick={() => setOpen(false)} href="#faq" className="py-2.5 text-[#3C5A47]">FAQ</a>
            <div className="h-px bg-[#253D2C]/10 my-2" />
            <Link onClick={() => setOpen(false)} to="/login" className="py-2.5 text-[#253D2C] font-medium">Sign in</Link>
            <Link
              onClick={() => setOpen(false)}
              to="/welcome"
              className="mt-1 text-center text-white font-semibold bg-[#2E6F40] px-4 py-3 rounded-full"
            >
              Get VeilChat
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function BrandMark() {
  return (
    <span className="relative w-9 h-9 rounded-2xl bg-[#2E6F40] grid place-items-center shadow-[0_8px_18px_-8px_rgba(46,111,64,0.55)]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8 2 5 5 5 9v3c0 4 3 8 7 9 4-1 7-5 7-9V9c0-4-3-7-7-7z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </span>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative pt-32 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-[#2E6F40] bg-[#CFFFDC] border border-[#68BA7F]/40 rounded-full px-3 py-1.5">
              <LockMini />
              End-to-end encrypted · Open source
            </div>

            <h1
              className="mt-6 text-[42px] sm:text-[56px] md:text-[64px] lg:text-[72px] font-semibold tracking-[-0.025em] leading-[1.02] text-[#253D2C]"
              style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
            >
              Message{" "}
              <span className="italic" style={{ color: "#2E6F40" }}>
                privately.
              </span>
              <br />
              Built for the people
              <br />
              you actually trust.
            </h1>

            <p className="mt-7 text-[18px] sm:text-[20px] text-[#3C5A47] max-w-xl leading-[1.55]">
              VeilChat is a calm, beautifully simple messenger. Every message,
              call, and photo is end-to-end encrypted by default — so your
              conversations stay between you and the people you talk to.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                to="/welcome"
                className="group inline-flex items-center justify-center gap-2 bg-[#2E6F40] hover:bg-[#253D2C] text-white font-semibold text-[16px] px-7 py-4 rounded-full shadow-[0_18px_36px_-14px_rgba(46,111,64,0.55)] transition-colors"
              >
                Get VeilChat — it's free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center justify-center gap-2 border border-[#253D2C]/15 hover:border-[#2E6F40]/40 hover:bg-white text-[#253D2C] font-medium text-[16px] px-7 py-4 rounded-full transition-colors"
              >
                See how it works
              </a>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-2.5 text-[14px] text-[#3C5A47]">
              <span className="inline-flex items-center gap-2">
                <CheckDot /> No phone number required
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckDot /> Works on every device
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckDot /> Free, forever
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

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div
        className="absolute -top-32 -right-40 w-[640px] h-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(207,255,220,0.85), rgba(207,255,220,0) 65%)",
        }}
      />
      <div
        className="absolute top-[35%] -left-32 w-[420px] h-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(104,186,127,0.18), rgba(104,186,127,0) 65%)",
        }}
      />
    </div>
  );
}

function LockMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckDot() {
  return (
    <span className="grid place-items-center w-[18px] h-[18px] rounded-full bg-[#CFFFDC] text-[#2E6F40]">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div
        className="absolute -inset-8 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(46,111,64,0.18), rgba(46,111,64,0) 60%)",
        }}
      />
      <div
        className="relative rounded-[2.6rem] p-[6px] shadow-[0_60px_120px_-30px_rgba(17,27,33,0.35)]"
        style={{ backgroundColor: "#111B21" }}
      >
        <div
          className="rounded-[2.2rem] overflow-hidden"
          style={{ backgroundColor: "#FCF5EB" }}
        >
          {/* status bar */}
          <div className="px-6 pt-3 pb-2 flex items-center justify-between text-[11px] text-[#253D2C]/70 font-semibold">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[#253D2C]/60" />
              <span className="w-1 h-1 rounded-full bg-[#253D2C]/60" />
              <span className="w-1 h-1 rounded-full bg-[#253D2C]/60" />
              <span className="ml-1">100%</span>
            </span>
          </div>

          {/* chat header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: "#2E6F40" }}
          >
            <button className="text-white/90" aria-label="back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="w-9 h-9 rounded-full bg-white/15 grid place-items-center text-white text-sm font-semibold">
              A
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-white">Alex Mendoza</div>
              <div className="text-[11px] text-[#CFFFDC] flex items-center gap-1">
                <LockMini />
                end-to-end encrypted
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>

          {/* chat body */}
          <div
            className="px-4 py-5 space-y-2 min-h-[360px] relative"
            style={{
              backgroundColor: "#E6FFDA",
              backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='%232E6F40' stroke-opacity='0.06' stroke-width='1.2'><circle cx='12' cy='12' r='6'/><path d='M48 18l8 8-8 8-8-8z'/><circle cx='66' cy='52' r='4'/><path d='M22 56l6 0 0 6'/></g></svg>`,
              )}")`,
              backgroundSize: "120px 120px",
            }}
          >
            <div className="text-center mb-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#3C5A47] bg-[#CFFFDC]/80 backdrop-blur px-3 py-1 rounded-full">
                <LockMini />
                Messages and calls are end-to-end encrypted.
              </span>
            </div>
            <Bubble side="in">Hey, are we still on for Saturday?</Bubble>
            <Bubble side="out">Wouldn't miss it. 7pm at the place by the park?</Bubble>
            <Bubble side="in">Perfect. I'll bring the playlist.</Bubble>
            <Bubble side="out">You always do.</Bubble>
          </div>

          {/* input bar */}
          <div className="px-3 pt-2 pb-3 flex items-center gap-2 bg-[#FCF5EB]">
            <div className="flex-1 h-10 rounded-full bg-white border border-[#253D2C]/10 px-4 flex items-center text-[13px] text-[#3C5A47]/70">
              Message
            </div>
            <button
              className="w-10 h-10 rounded-full grid place-items-center text-white"
              style={{ backgroundColor: "#2E6F40" }}
            >
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
}: {
  children: React.ReactNode;
  side: "in" | "out";
}) {
  if (side === "in") {
    return (
      <div className="flex justify-start">
        <div className="relative max-w-[78%] text-[13px] leading-snug px-3.5 py-2 pr-12 rounded-2xl bg-white text-[#111B21] shadow-[0_1px_1px_rgba(17,27,33,0.06)]">
          {children}
          <span className="absolute bottom-1.5 right-2.5 text-[10px] text-[#3C5A47]/55">
            9:41
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div
        className="relative max-w-[78%] text-[13px] leading-snug px-3.5 py-2 pr-14 rounded-2xl text-[#111B21] shadow-[0_1px_1px_rgba(17,27,33,0.06)]"
        style={{ backgroundColor: "#CFFFDC" }}
      >
        {children}
        <span className="absolute bottom-1.5 right-2.5 inline-flex items-center gap-0.5 text-[10px] text-[#2E6F40]">
          9:41
          <svg width="12" height="9" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6l3 3 6-7" />
            <path d="M6 6l3 3 6-7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── Trust bar ───────────────────────── */

function TrustBar() {
  const stats = [
    { v: "100%", k: "End-to-end encrypted" },
    { v: "0", k: "Ads, ever" },
    { v: "Open", k: "Source on GitHub" },
    { v: "Any", k: "Device, one account" },
  ];
  return (
    <section className="border-y border-[#253D2C]/10 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.k} className="text-center">
            <div
              className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[#253D2C]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {s.v}
            </div>
            <div className="text-[13px] sm:text-[14px] text-[#3C5A47] mt-1">
              {s.k}
            </div>
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
  }> = [
    {
      title: "End-to-end encrypted by default",
      body: "Every message, call, photo, and voice note is encrypted on your device with the Signal-style Double Ratchet. Even our servers can't read them.",
      icon: <IconShield />,
    },
    {
      title: "No phone number, ever",
      body: "Sign up with a private ID and a recovery phrase. No SIM card, no email, no identity attached to your account.",
      icon: <IconMask />,
    },
    {
      title: "Disappearing messages",
      body: "Set a timer per chat — one hour, one day, one week. Messages quietly vanish from every device when their time is up.",
      icon: <IconTimer />,
    },
    {
      title: "Group chats, encrypted too",
      body: "Built on the MLS-style Sender Keys protocol. Bring everyone you love into one chat with the same end-to-end guarantees.",
      icon: <IconGroup />,
    },
    {
      title: "Voice notes & rich media",
      body: "Send photos, view-once images, and voice messages. Everything is encrypted before it ever leaves your phone.",
      icon: <IconMic />,
    },
    {
      title: "Private notifications",
      body: "Get notified the moment a message arrives — but the notification payload itself contains nothing readable on the wire.",
      icon: <IconBell />,
    },
    {
      title: "Stealth mode",
      body: "Hide read receipts, typing indicators, and last-seen status. Auto-blur the app when you switch tabs. Your privacy, your rules.",
      icon: <IconEye />,
    },
    {
      title: "Works everywhere",
      body: "Install VeilChat on iOS, Android, Mac, Windows, or Linux. One private account, every device you own.",
      icon: <IconDevices />,
    },
    {
      title: "Open source, audit-ready",
      body: "Every line of client, server, and crypto code is on GitHub. No hidden backdoors. Fork it. Self-host it. Read it for yourself.",
      icon: <IconCode />,
    },
  ];
  return (
    <section id="features" className="py-24 sm:py-32" style={{ backgroundColor: "#FCF5EB" }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>Features</SectionLabel>
        <SectionHeading
          title="Everything you'd want in a messenger."
          subtitle="And nothing you wouldn't."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-3xl bg-white p-7 border border-[#253D2C]/8 hover:border-[#68BA7F]/40 transition-colors"
              style={{ boxShadow: "0 1px 2px rgba(17,27,33,0.04)" }}
            >
              <div
                className="w-12 h-12 rounded-2xl grid place-items-center mb-5"
                style={{ backgroundColor: "#E6FFDA", color: "#2E6F40" }}
              >
                {it.icon}
              </div>
              <h3 className="text-[18px] font-semibold tracking-tight text-[#253D2C]">
                {it.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#3C5A47]">
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Lifestyle (real photo) ───────────────────────── */

function Lifestyle() {
  return (
    <section className="py-24 sm:py-32" style={{ backgroundColor: "#E6FFDA" }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-6">
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-[2rem] -z-0"
                style={{ backgroundColor: "#CFFFDC" }}
              />
              <div className="relative rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-20px_rgba(37,61,44,0.25)]">
                <img
                  src={peopleUsingPhones}
                  alt="Friends sharing a quiet moment together on their phones"
                  className="w-full h-[460px] sm:h-[520px] object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-5 -right-5 sm:-bottom-7 sm:-right-7 bg-white rounded-2xl px-5 py-4 shadow-[0_18px_40px_-14px_rgba(17,27,33,0.25)] border border-[#253D2C]/8 max-w-[220px]">
                <div className="flex items-center gap-2.5">
                  <span className="grid place-items-center w-8 h-8 rounded-full" style={{ backgroundColor: "#2E6F40" }}>
                    <LockMini />
                  </span>
                  <div className="text-[12px] font-semibold text-[#253D2C] leading-tight">
                    Encrypted from <br />the very first hello.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6">
            <SectionLabel>Made for everyone</SectionLabel>
            <h2
              className="mt-4 text-[34px] sm:text-[44px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#253D2C]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              For the people you talk to{" "}
              <span className="italic" style={{ color: "#2E6F40" }}>
                every day.
              </span>
            </h2>
            <p className="mt-6 text-[18px] text-[#3C5A47] leading-[1.6]">
              From quick check-ins with your best friend to family group chats
              that span continents — VeilChat keeps the conversations that matter
              warm, fast, and yours alone.
            </p>
            <ul className="mt-8 space-y-4">
              <ValuePoint
                title="Designed to feel calm"
                body="No noisy badges, no manipulative streaks. Just the messages you actually want to read."
              />
              <ValuePoint
                title="Built for trust"
                body="Verifiable safety numbers and clear status indicators — so you always know who you're really talking to."
              />
              <ValuePoint
                title="Zero ads, forever"
                body="No tracking, no profiling, no monetizing your relationships. VeilChat is funded by people who care, not advertisers."
              />
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValuePoint({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <div
        className="mt-0.5 grid place-items-center w-7 h-7 rounded-full shrink-0"
        style={{ backgroundColor: "#2E6F40" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <div>
        <h4 className="font-semibold text-[#253D2C] text-[16px]">{title}</h4>
        <p className="text-[15px] text-[#3C5A47] mt-1 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

/* ───────────────────────── Press strip ───────────────────────── */

function PressStrip() {
  const marks: Array<{ name: string; style: React.CSSProperties }> = [
    {
      name: "PRIVACY WEEKLY",
      style: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 800,
        letterSpacing: "0.22em",
        fontSize: "13px",
      },
    },
    {
      name: "Cipher Review",
      style: {
        fontFamily: "'Fraunces', serif",
        fontStyle: "italic",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        fontSize: "22px",
      },
    },
    {
      name: "OPEN/STACK",
      style: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontSize: "18px",
      },
    },
    {
      name: "Quiet Times",
      style: {
        fontFamily: "'Fraunces', serif",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        fontSize: "22px",
      },
    },
    {
      name: "THE LEDGER",
      style: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        letterSpacing: "0.32em",
        fontSize: "13px",
      },
    },
  ];
  return (
    <section
      aria-label="Featured in"
      className="py-12 sm:py-14 border-y border-[#253D2C]/8"
      style={{ backgroundColor: "#FCF5EB" }}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col md:flex-row items-center md:items-baseline gap-6 md:gap-10">
          <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#3C5A47]/70 shrink-0">
            As seen in
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center md:justify-between gap-x-10 gap-y-4">
            {marks.map((m) => (
              <span
                key={m.name}
                className="text-[#253D2C]/45 hover:text-[#253D2C]/70 transition-colors whitespace-nowrap select-none"
                style={m.style}
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Testimonials ───────────────────────── */

function Testimonials() {
  const reviews: Array<{
    quote: string;
    name: string;
    role: string;
    initials: string;
    bg: string;
    fg: string;
  }> = [
    {
      quote:
        "I switched from three other apps. VeilChat is the first one that actually feels calm to use — and the only one I trust with the people I love.",
      name: "Maya Okafor",
      role: "Designer · Lisbon",
      initials: "MO",
      bg: "#2E6F40",
      fg: "#FFFFFF",
    },
    {
      quote:
        "No phone number, no ads, no nonsense. The recovery phrase setup took thirty seconds and I haven't thought about my privacy since.",
      name: "Jonas Reuter",
      role: "Engineer · Berlin",
      initials: "JR",
      bg: "#CFFFDC",
      fg: "#253D2C",
    },
    {
      quote:
        "Our family chat finally lives in one place again. Grandparents on iPhones, cousins on Android — everyone, on the same private thread.",
      name: "Priya Shah",
      role: "Teacher · Mumbai",
      initials: "PS",
      bg: "#253D2C",
      fg: "#CFFFDC",
    },
  ];
  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>Loved by quiet people everywhere</SectionLabel>
        <SectionHeading
          title="What people say after they switch."
          subtitle="A few notes from the early VeilChat community."
        />
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {reviews.map((r) => (
            <figure
              key={r.name}
              className="relative rounded-3xl bg-white border border-[#253D2C]/10 p-7 flex flex-col"
              style={{ boxShadow: "0 1px 2px rgba(17,27,33,0.04)" }}
            >
              <span
                aria-hidden
                className="absolute top-5 right-6 text-[64px] leading-none font-semibold select-none"
                style={{ fontFamily: "'Fraunces', serif", color: "#CFFFDC" }}
              >
                &ldquo;
              </span>
              <div className="flex items-center gap-1 text-[#2E6F40]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.25l2.92 6.32 6.83.78-5.13 4.7 1.45 6.7L12 17.27l-6.07 3.48 1.45-6.7-5.13-4.7 6.83-.78z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 text-[15.5px] sm:text-[16px] text-[#253D2C] leading-[1.55] flex-1">
                {r.quote}
              </blockquote>
              <figcaption className="mt-6 pt-5 border-t border-[#253D2C]/8 flex items-center gap-3">
                <span
                  className="grid place-items-center w-11 h-11 rounded-full text-[14px] font-semibold shrink-0"
                  style={{ backgroundColor: r.bg, color: r.fg }}
                >
                  {r.initials}
                </span>
                <span>
                  <span className="block text-[14.5px] font-semibold text-[#253D2C] leading-tight">
                    {r.name}
                  </span>
                  <span className="block text-[12.5px] text-[#3C5A47]/80 mt-0.5">
                    {r.role}
                  </span>
                </span>
              </figcaption>
            </figure>
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
      title: "Make an account in 30 seconds",
      body: "Pick how you want to sign up — phone, email, or a private ID with a recovery phrase. No personal information is ever required.",
    },
    {
      n: "02",
      title: "Invite the people you trust",
      body: "Share a one-tap invite link. They join, you both verify, and a private encrypted channel opens between you.",
    },
    {
      n: "03",
      title: "Talk freely — for as long as you like",
      body: "Send messages, voice notes, and photos. Start group chats. Everything is end-to-end encrypted. We literally can't read it.",
    },
  ];
  return (
    <section id="how" className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionLabel>How it works</SectionLabel>
        <SectionHeading
          title="Three small steps. That's the whole thing."
          subtitle="No setup wizards. No personal questions. Just messaging that respects you from the first tap."
        />
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-3xl p-8 border border-[#253D2C]/8"
              style={{ backgroundColor: "#FCF5EB" }}
            >
              <div
                className="inline-flex items-center justify-center w-11 h-11 rounded-2xl text-white text-[14px] font-bold"
                style={{ backgroundColor: "#2E6F40" }}
              >
                {s.n}
              </div>
              <h3 className="mt-5 text-[20px] font-semibold tracking-tight text-[#253D2C]">
                {s.title}
              </h3>
              <p className="mt-2.5 text-[15px] text-[#3C5A47] leading-relaxed">
                {s.body}
              </p>
              {i < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 w-6 h-6 -translate-y-1/2 items-center justify-center text-[#68BA7F]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M13 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Security (real photo) ───────────────────────── */

function Security() {
  return (
    <section
      id="security"
      className="py-24 sm:py-32"
      style={{ backgroundColor: "#111B21", color: "#FCF5EB" }}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.18em] uppercase text-[#CFFFDC]">
              <span className="w-6 h-px bg-[#68BA7F]" />
              Security & Privacy
            </div>
            <h2
              className="mt-4 text-[34px] sm:text-[44px] md:text-[54px] font-semibold tracking-[-0.02em] leading-[1.05]"
              style={{ fontFamily: "'Fraunces', serif", color: "#FCF5EB" }}
            >
              Privacy isn't a feature.{" "}
              <span className="italic" style={{ color: "#CFFFDC" }}>
                It's the whole thing.
              </span>
            </h2>
            <p className="mt-6 text-[18px] text-[#FCF5EB]/75 leading-[1.6] max-w-xl">
              VeilChat is built on cryptographic foundations that secure billions
              of messages every day. We didn't roll our own — we stand on the
              shoulders of giants, and we make every piece auditable.
            </p>
            <ul className="mt-9 space-y-5">
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
                title="Auditable, end to end"
                body="Open source under a permissive license. Audit it, fork it, self-host it. No hidden code. No proprietary crypto."
              />
            </ul>
          </div>

          <div className="lg:col-span-6">
            <div className="relative max-w-md mx-auto lg:ml-auto">
              <div
                className="absolute -inset-3 rounded-[2rem]"
                style={{ backgroundColor: "rgba(46,111,64,0.35)" }}
              />
              <div className="relative rounded-[2rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)]">
                <img
                  src={smilingWithPhone}
                  alt="A person smiling, comfortable knowing their messages are private"
                  className="w-full h-[520px] object-cover"
                  loading="lazy"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(17,27,33,0) 55%, rgba(17,27,33,0.7) 100%)",
                  }}
                />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="inline-flex items-center gap-2 bg-[#2E6F40] text-white text-[12px] font-semibold rounded-full px-3 py-1.5">
                    <LockMini />
                    Private by default
                  </div>
                  <p className="mt-3 text-[18px] font-medium leading-snug max-w-sm" style={{ fontFamily: "'Fraunces', serif" }}>
                    "Finally, a messenger that treats my conversations like
                    they're none of its business."
                  </p>
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
      <div
        className="mt-0.5 grid place-items-center w-8 h-8 rounded-xl shrink-0"
        style={{ backgroundColor: "rgba(207,255,220,0.15)", color: "#CFFFDC" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <div>
        <h4 className="font-semibold text-[#FCF5EB] text-[17px]">{title}</h4>
        <p className="text-[15px] text-[#FCF5EB]/65 mt-1 leading-relaxed">{body}</p>
      </div>
    </li>
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
    <section className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <SectionLabel>The honest comparison</SectionLabel>
        <SectionHeading
          title="Why people quietly switch to VeilChat."
          subtitle="The features other messengers gate, charge for, or quietly skip."
        />
        <div className="mt-12 rounded-3xl border border-[#253D2C]/10 overflow-hidden bg-white">
          <div
            className="grid grid-cols-3 text-[14px] font-semibold border-b border-[#253D2C]/10"
            style={{ backgroundColor: "#FCF5EB" }}
          >
            <div className="px-5 py-4 text-[#3C5A47]">Feature</div>
            <div className="px-5 py-4 text-center text-[#2E6F40]">VeilChat</div>
            <div className="px-5 py-4 text-center text-[#3C5A47]">Typical messenger</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-3 text-[14.5px] ${i !== rows.length - 1 ? "border-b border-[#253D2C]/8" : ""}`}
            >
              <div className="px-5 py-4 text-[#253D2C]">{r.label}</div>
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
      <span
        className="grid place-items-center w-7 h-7 rounded-full"
        style={{
          backgroundColor: positive ? "#2E6F40" : "#E6FFDA",
          color: positive ? "white" : "#2E6F40",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className="grid place-items-center w-7 h-7 rounded-full"
        style={{ backgroundColor: "#FCF5EB", color: "#B85C50" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return <span className="text-[12.5px] text-[#3C5A47]/70">{value}</span>;
}

/* ───────────────────────── Get the app ───────────────────────── */

function GetTheApp() {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [installUrl, setInstallUrl] = useState<string>("");

  useEffect(() => {
    const url =
      typeof window !== "undefined"
        ? window.location.origin + "/welcome"
        : "https://veil.app/welcome";
    setInstallUrl(url);
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#253D2C", light: "#FCF5EB" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, []);

  const platforms: Array<{
    label: string;
    sub: string;
    hint: string;
    icon: React.ReactNode;
  }> = [
    {
      label: "iPhone & iPad",
      sub: "Install on iOS",
      hint: "Open in Safari → tap Share → Add to Home Screen.",
      icon: <IconApple />,
    },
    {
      label: "Android",
      sub: "Install on Android",
      hint: "Open in Chrome → tap menu → Install app.",
      icon: <IconAndroid />,
    },
    {
      label: "Mac, Windows & Linux",
      sub: "Install on desktop",
      hint: "Click the install icon in your browser's address bar.",
      icon: <IconDesktop />,
    },
  ];

  return (
    <section
      id="install"
      className="py-24 sm:py-32"
      style={{ backgroundColor: "#FCF5EB" }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="rounded-[2.5rem] bg-white border border-[#253D2C]/10 overflow-hidden shadow-[0_30px_60px_-30px_rgba(17,27,33,0.18)]">
          <div className="grid lg:grid-cols-12 gap-0">
            {/* Left: QR card */}
            <div
              className="lg:col-span-5 p-10 sm:p-12 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: "#E6FFDA" }}
            >
              <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.2em] uppercase text-[#2E6F40]">
                <span className="w-6 h-px bg-[#68BA7F]" />
                Scan to install
              </div>
              <div className="mt-6 relative">
                <div
                  className="absolute -inset-3 rounded-[1.6rem]"
                  style={{ backgroundColor: "#CFFFDC" }}
                />
                <div className="relative bg-white p-4 rounded-[1.4rem] border border-[#253D2C]/10 shadow-[0_18px_40px_-18px_rgba(17,27,33,0.25)]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Scan to open VeilChat on your phone"
                      width={200}
                      height={200}
                      className="block w-[200px] h-[200px] rounded-lg"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] rounded-lg bg-[#FCF5EB]" />
                  )}
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white shadow-[0_8px_18px_-6px_rgba(17,27,33,0.25)] border border-[#253D2C]/10">
                      <BrandMark />
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-[15px] text-[#253D2C] font-medium">
                Open your camera. Tap the link.
              </p>
              <p className="mt-1 text-[13.5px] text-[#3C5A47] max-w-xs">
                VeilChat installs in seconds — no app store, no account required to
                start.
              </p>
            </div>

            {/* Right: install buttons */}
            <div className="lg:col-span-7 p-10 sm:p-12">
              <SectionLabel>Get the app</SectionLabel>
              <h2
                className="mt-3 text-[28px] sm:text-[36px] md:text-[42px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#253D2C]"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                One VeilChat account.{" "}
                <span className="italic" style={{ color: "#2E6F40" }}>
                  Every device.
                </span>
              </h2>
              <p className="mt-4 text-[15.5px] text-[#3C5A47] leading-relaxed max-w-md">
                VeilChat is a Progressive Web App — install it straight from your
                browser. No app store reviews, no waiting, always the latest
                version.
              </p>

              <div className="mt-7 space-y-3">
                {platforms.map((p) => (
                  <Link
                    key={p.label}
                    to="/welcome"
                    className="group flex items-center gap-4 rounded-2xl border border-[#253D2C]/10 hover:border-[#2E6F40]/40 hover:bg-[#FCF5EB] px-5 py-4 transition-colors"
                  >
                    <span
                      className="grid place-items-center w-12 h-12 rounded-xl shrink-0 text-white"
                      style={{ backgroundColor: "#253D2C" }}
                    >
                      {p.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-medium text-[#3C5A47]/80 leading-none">
                        {p.sub}
                      </span>
                      <span className="block mt-1 text-[16px] font-semibold text-[#253D2C] leading-tight">
                        {p.label}
                      </span>
                      <span className="block mt-1 text-[12.5px] text-[#3C5A47]/80 leading-snug">
                        {p.hint}
                      </span>
                    </span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#2E6F40] shrink-0"
                    >
                      <path d="M5 12h14" />
                      <path d="M13 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>

              {installUrl && (
                <div className="mt-6 flex items-center gap-2 text-[12.5px] text-[#3C5A47]/80">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" />
                    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07L13 19" />
                  </svg>
                  <span className="truncate">{installUrl}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconApple() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.43 2.13-1.16 2.86-.74.79-1.97 1.39-3.04 1.31-.13-1.1.42-2.23 1.13-2.95.79-.81 2.12-1.41 3.07-1.22zM20.5 17.17c-.5 1.16-.74 1.68-1.39 2.71-.9 1.43-2.18 3.21-3.76 3.22-1.4.01-1.76-.91-3.66-.9-1.9.01-2.3.92-3.7.91-1.58-.01-2.79-1.62-3.69-3.05C2.06 16.42.95 11.34 3.32 8.21 4.45 6.69 6.16 5.74 7.86 5.74c1.74 0 2.83.95 4.27.95 1.39 0 2.24-.95 4.25-.95 1.5 0 3.09.82 4.22 2.23-3.71 2.03-3.1 7.34-.1 9.2z" />
    </svg>
  );
}

function IconAndroid() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.69-.4l-1.86 3.22A11.95 11.95 0 0 0 12 8c-1.78 0-3.46.39-4.89 1.12L5.25 5.9a.4.4 0 0 0-.69.4l1.84 3.18A8.93 8.93 0 0 0 2 16h20a8.93 8.93 0 0 0-4.4-6.52zM7.5 13.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm9 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  );
}

function IconDesktop() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function FAQ() {
  const items = [
    {
      q: "Is VeilChat really free?",
      a: "Yes — and it always will be. VeilChat is open source and run as a community project. There are no ads, no premium tiers, and no data sales because we don't have your data to sell.",
    },
    {
      q: "Do I need to give my phone number?",
      a: "No. You can sign up with a private ID and a recovery phrase that exists only on your device. Phone and email signup are also available if you prefer that.",
    },
    {
      q: "Can the VeilChat team read my messages?",
      a: "No. Encryption keys are generated on your device and never leave it. Our servers only see opaque ciphertext — bytes that look like random noise. Even if someone hacked us, they'd find nothing readable.",
    },
    {
      q: "What happens if I lose my device?",
      a: "If you signed up with a recovery phrase, you can restore access on a new device. Your encrypted message history isn't recoverable by design — that's the privacy trade-off we believe is worth making.",
    },
    {
      q: "Does VeilChat work on iPhone?",
      a: "Yes. VeilChat works as a Progressive Web App — open it in Safari, tap Share → Add to Home Screen, and it behaves like a native app, including push notifications on iOS 16.4+.",
    },
    {
      q: "Is the source code really open?",
      a: "Yes. Every line — client, server, and crypto layer — is on GitHub under a permissive license. Audit it, run it, or self-host the entire stack on your own infrastructure.",
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 sm:py-32" style={{ backgroundColor: "#FCF5EB" }}>
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionLabel>FAQ</SectionLabel>
        <SectionHeading
          title="Questions, gently answered."
          subtitle="If something's not here, we're easy to reach."
        />
        <div className="mt-12 rounded-3xl bg-white border border-[#253D2C]/10 overflow-hidden">
          {items.map((it, i) => (
            <div
              key={it.q}
              className={i !== items.length - 1 ? "border-b border-[#253D2C]/8" : ""}
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full text-left px-6 py-5"
                aria-expanded={openIdx === i}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#253D2C] text-[16px] sm:text-[17px]">
                    {it.q}
                  </span>
                  <span
                    className={`shrink-0 w-8 h-8 grid place-items-center rounded-full transition-colors ${
                      openIdx === i
                        ? "bg-[#2E6F40] text-white"
                        : "bg-[#E6FFDA] text-[#2E6F40]"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      {openIdx === i ? <path d="M5 12h14" /> : (
                        <>
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </>
                      )}
                    </svg>
                  </span>
                </div>
                <div
                  className={`grid transition-all duration-200 ${openIdx === i ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="text-[#3C5A47] leading-relaxed text-[15px] pr-10">
                      {it.a}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCTA() {
  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div
          className="relative overflow-hidden rounded-[2.5rem] p-12 sm:p-16 text-center"
          style={{ backgroundColor: "#2E6F40" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='%23CFFFDC' stroke-opacity='0.5' stroke-width='1'><circle cx='12' cy='12' r='6'/><path d='M48 18l8 8-8 8-8-8z'/><circle cx='66' cy='52' r='4'/><path d='M22 56l6 0 0 6'/></g></svg>`,
              )}")`,
              backgroundSize: "120px 120px",
            }}
          />
          <div className="relative">
            <h2
              className="text-[34px] sm:text-[48px] md:text-[56px] font-semibold tracking-[-0.02em] leading-[1.05] text-white"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Take your conversations{" "}
              <span className="italic" style={{ color: "#CFFFDC" }}>
                back.
              </span>
            </h2>
            <p className="mt-5 text-[17px] sm:text-[19px] text-[#E6FFDA] max-w-xl mx-auto leading-relaxed">
              Join VeilChat today. It takes thirty seconds, costs nothing, and your
              messages stay between you and the people you actually trust.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/welcome"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FCF5EB] text-[#2E6F40] font-semibold text-[16px] px-8 py-4 rounded-full shadow-[0_18px_36px_-14px_rgba(0,0,0,0.35)] transition-colors"
              >
                Get VeilChat — free forever
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 border border-white/30 hover:bg-white/10 text-white font-medium text-[16px] px-8 py-4 rounded-full transition-colors"
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
    <footer style={{ backgroundColor: "#111B21", color: "#FCF5EB" }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <a href="#top" className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-[18px] font-bold tracking-tight text-white">
                VeilChat
              </span>
            </a>
            <p className="mt-4 text-[14.5px] text-[#FCF5EB]/65 max-w-sm leading-relaxed">
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
              { label: "Privacy", href: "#security" },
              { label: "FAQ", href: "#faq" },
            ]}
          />
          <FooterCol
            title="Get the app"
            internal
            links={[
              { label: "Sign up", to: "/welcome" },
              { label: "Sign in", to: "/login" },
              { label: "Install as PWA", href: "#install" },
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

        <div className="mt-14 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12.5px] text-[#FCF5EB]/55">
          <div>
            © {new Date().getFullYear()} VeilChat. Made with care for the people
            who deserve privacy.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#68BA7F]" />
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
      className="w-9 h-9 grid place-items-center rounded-full border border-white/15 bg-white/5 text-[#FCF5EB]/80 hover:text-white hover:border-white/30 hover:bg-white/10 transition-colors"
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
      <div className="text-[12px] font-bold tracking-[0.18em] uppercase text-white">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5 text-[14px]">
        {links.map((l) =>
          internal && l.to ? (
            <li key={l.label}>
              <Link to={l.to} className="text-[#FCF5EB]/65 hover:text-white transition-colors">
                {l.label}
              </Link>
            </li>
          ) : (
            <li key={l.label}>
              <a
                href={l.href ?? "#"}
                className="text-[#FCF5EB]/65 hover:text-white transition-colors"
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
    <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.2em] uppercase text-[#2E6F40]">
      <span className="w-6 h-px bg-[#68BA7F]" />
      {children}
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h2
        className="mt-4 text-[32px] sm:text-[42px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.06] max-w-3xl text-[#253D2C]"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-[18px] text-[#3C5A47] max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </>
  );
}

/* ───────────────────────── Icons ───────────────────────── */

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconMask() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c0-4 3-7 9-7s9 3 9 7c0 5-4 8-9 8s-9-3-9-8z" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}
function IconTimer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </svg>
  );
}
function IconGroup() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="10" r="2.6" />
      <path d="M16 20a5 5 0 0 1 5.5-5" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
function IconDevices() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="10" rx="1.5" />
      <rect x="14" y="9" width="8" height="12" rx="1.5" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l-6-6 6-6" />
      <path d="M15 6l6 6-6 6" />
    </svg>
  );
}
