import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

/**
 * VeilChat — About Us.
 *
 * A short, warm, user-friendly page that introduces the project,
 * the people behind it, and the values that guide the product.
 * Matches the cream / forest-green design language of the public
 * LandingPage, Privacy Policy and Terms pages.
 */

export function AboutPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "About · VeilChat";
    return () => {
      document.title = previous;
    };
  }, []);

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
      <AboutNav />
      <AboutHero />
      <AboutStory />
      <AboutValues />
      <AboutBuilders />
      <AboutFooter />
    </div>
  );
}

/* ───────────────────────── Navigation ───────────────────────── */

function AboutNav() {
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
      <div className="mx-auto max-w-5xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[18px] font-bold tracking-tight text-[#253D2C]">
            VeilChat
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 text-[14px] text-[#3C5A47]">
          <Link to="/privacy-policy" className="hover:text-[#2E6F40]">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-[#2E6F40]">
            Terms
          </Link>
          <Link
            to="/welcome"
            className="hidden sm:inline-flex text-[14px] font-semibold text-white bg-[#2E6F40] hover:bg-[#253D2C] px-4 py-2 rounded-full transition-colors"
          >
            Get VeilChat
          </Link>
        </nav>
      </div>
    </header>
  );
}

function BrandMark({ size = 32 }: { size?: number }) {
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

function AboutHero() {
  return (
    <section className="relative pt-32 sm:pt-36 pb-12 sm:pb-16 overflow-hidden">
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

      <div className="relative mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-[#2E6F40] bg-[#CFFFDC] border border-[#68BA7F]/40 rounded-full px-3 py-1.5">
          <SparkMini />
          About us
        </div>
        <h1
          className="mt-6 text-[40px] sm:text-[52px] md:text-[60px] font-semibold tracking-[-0.025em] leading-[1.05] text-[#253D2C]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          A small team building{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            private things.
          </span>
        </h1>
        <p className="mt-6 text-[17px] sm:text-[19px] text-[#3C5A47] leading-[1.6] max-w-2xl mx-auto">
          VeilChat is a privacy-first messenger made by people who
          believe that the way we talk online should belong to us —
          not to advertisers, not to algorithms, not to anyone but
          the people in the conversation.
        </p>
      </div>
    </section>
  );
}

function SparkMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ───────────────────────── Story ───────────────────────── */

function AboutStory() {
  return (
    <section className="relative pb-8">
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[#253D2C]/10 p-6 sm:p-10">
          <h2
            className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-[#253D2C] leading-tight"
            style={{ fontFamily: "'Fraunces', 'Inter', serif" }}
          >
            Why we built it
          </h2>
          <p className="mt-4 text-[16px] leading-[1.75] text-[#253D2C]/90">
            We started VeilChat because the apps we used every day
            had quietly stopped feeling like ours. Every tap was
            measured, every contact analysed, every conversation
            turned into a data point. We wanted something simpler:
            a clean, fast messenger where the message you send is
            read only by the person you sent it to.
          </p>
          <p className="mt-4 text-[16px] leading-[1.75] text-[#253D2C]/90">
            So we sat down and built one. End-to-end encryption by
            default. No ads. No tracking. No data sold to anyone.
            Just a calm place to talk.
          </p>
          <p className="mt-4 text-[16px] leading-[1.75] text-[#253D2C]/90">
            VeilChat is free, and it always will be. We pay for the
            servers; you get to talk in peace.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Values ───────────────────────── */

function AboutValues() {
  const values = [
    {
      title: "Privacy by default",
      body:
        "Every chat, every call, every file is end-to-end encrypted from the moment you hit send. We could not read your messages even if someone asked us to.",
      icon: <ShieldIcon />,
    },
    {
      title: "Honest software",
      body:
        "No dark patterns. No fake urgency. No data we don't need. We build the app we'd want our families and friends to use.",
      icon: <HeartIcon />,
    },
    {
      title: "Built to last",
      body:
        "We're a small team that ships carefully, listens to feedback, and keeps the product simple enough that it can quietly keep working for years.",
      icon: <LeafIcon />,
    },
  ];

  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="text-center">
          <h2
            className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[#253D2C] leading-tight"
            style={{ fontFamily: "'Fraunces', 'Inter', serif" }}
          >
            What we care about
          </h2>
          <p className="mt-3 text-[15px] sm:text-[16px] text-[#3C5A47] max-w-xl mx-auto">
            Three simple ideas guide everything we ship.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl bg-white border border-[#253D2C]/10 p-6 hover:border-[#2E6F40]/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#CFFFDC] grid place-items-center text-[#2E6F40]">
                {v.icon}
              </div>
              <h3 className="mt-4 text-[17px] font-semibold text-[#253D2C]">
                {v.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-[1.65] text-[#3C5A47]">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
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

function LeafIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13c0-7 9-11 17-11 0 8-4 17-11 17a7 7 0 0 1-6-3" />
      <path d="M2 22c4-4 8-6 12-6" />
    </svg>
  );
}

/* ───────────────────────── Builders ───────────────────────── */

function AboutBuilders() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2E6F40]">
          <span className="h-px w-6 bg-[#2E6F40]/40" />
          The team
          <span className="h-px w-6 bg-[#2E6F40]/40" />
        </div>
        <h2
          className="mt-4 text-[30px] sm:text-[38px] font-semibold tracking-tight text-[#253D2C] leading-tight"
          style={{ fontFamily: "'Fraunces', 'Inter', serif" }}
        >
          Built by{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            Rupesh Sahu
          </span>{" "}
          and the{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            Zyntra Team.
          </span>
        </h2>
        <p className="mt-4 text-[15.5px] text-[#3C5A47] max-w-xl mx-auto leading-[1.65]">
          A tiny independent crew obsessed with privacy, careful
          design, and software that respects the people who use it.
          Say hi — we read everything.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 max-w-2xl mx-auto">
          <BuilderCard
            name="Rupesh Sahu"
            role="Founder & Engineer"
            instagramUrl="https://www.instagram.com/rupesh_gupta___/"
            instagramHandle="@rupesh_gupta___"
            initials="RS"
          />
          <BuilderCard
            name="Zyntra Team"
            role="Design & Product"
            instagramUrl="https://www.instagram.com/zyntra___x/"
            instagramHandle="@zyntra___x"
            initials="ZT"
          />
        </div>
      </div>
    </section>
  );
}

function BuilderCard({
  name,
  role,
  instagramUrl,
  instagramHandle,
  initials,
}: {
  name: string;
  role: string;
  instagramUrl: string;
  instagramHandle: string;
  initials: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#253D2C]/10 p-6 text-left flex flex-col items-start hover:border-[#2E6F40]/30 hover:shadow-[0_12px_28px_-18px_rgba(46,111,64,0.35)] transition-all">
      <div className="flex items-center gap-3 w-full">
        <div
          className="w-12 h-12 rounded-full grid place-items-center text-white font-semibold text-[15px]"
          style={{
            background:
              "linear-gradient(135deg, #2E6F40 0%, #68BA7F 100%)",
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold text-[#253D2C] truncate">
            {name}
          </div>
          <div className="text-[12.5px] text-[#3C5A47]">{role}</div>
        </div>
      </div>

      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} on Instagram (${instagramHandle})`}
        className="mt-5 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-[13.5px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background:
            "linear-gradient(45deg, #F58529 0%, #DD2A7B 30%, #8134AF 60%, #515BD4 100%)",
        }}
      >
        <InstagramIcon />
        <span>{instagramHandle}</span>
      </a>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function AboutFooter() {
  return (
    <footer style={{ backgroundColor: "#111B21", color: "#FCF5EB" }}>
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="text-[16px] font-bold tracking-tight text-white">
            VeilChat
          </span>
        </Link>
        <div className="text-[12.5px] text-[#FCF5EB]/60 text-center sm:text-right">
          © {new Date().getFullYear()} VeilChat ·{" "}
          <Link to="/about" className="hover:text-white">
            About
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="hover:text-white">
            Terms
          </Link>{" "}
          ·{" "}
          <Link to="/privacy-policy" className="hover:text-white">
            Privacy
          </Link>{" "}
          · <Link to="/" className="hover:text-white">Home</Link>
        </div>
      </div>
    </footer>
  );
}
