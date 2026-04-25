import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

/**
 * VeilChat — Terms & Conditions.
 *
 * Long-form, comprehensive terms of service that mirror the warm
 * cream / forest-green visual language of the public LandingPage
 * and the matching Privacy Policy at /privacy-policy.
 *
 * Self-contained on purpose: no app shell, no auth dependency, no
 * tRPC. Reachable for completely logged-out visitors who arrive
 * via the "Terms & Conditions" link in the footer.
 *
 * Reading-rule convention
 * ───────────────────────
 * Sections are numbered (1, 1.1, 1.2 …) so external documents and
 * regulator correspondence can cite a stable address such as
 * "VeilChat Terms §11.3 — Termination by you". Every clause that
 * imposes a meaningful obligation on either side ends with a short
 * plain-English summary in italics so non-lawyers can skim the
 * document and still understand what they have agreed to.
 */

const LAST_UPDATED = "26 April 2026";
const EFFECTIVE_DATE = "26 April 2026";
const VERSION = "1.0";

type SectionNode = {
  id: string;
  num: string;
  title: string;
  children?: SectionNode[];
};

const TOC: SectionNode[] = [
  { id: "summary", num: "0", title: "At-a-glance summary" },
  { id: "agreement", num: "1", title: "The agreement between you and us" },
  { id: "who-we-are", num: "2", title: "Who we are" },
  { id: "definitions", num: "3", title: "Definitions used in these Terms" },
  { id: "eligibility", num: "4", title: "Eligibility & age requirements" },
  {
    id: "account",
    num: "5",
    title: "Your VeilChat account",
    children: [
      { id: "account-creation", num: "5.1", title: "Creating an account" },
      { id: "account-credentials", num: "5.2", title: "Credentials, recovery phrase & PIN" },
      { id: "account-security", num: "5.3", title: "Security of your account" },
      { id: "account-multiple-devices", num: "5.4", title: "Multiple devices & linked sessions" },
    ],
  },
  {
    id: "service",
    num: "6",
    title: "What the service is — and is not",
    children: [
      { id: "service-description", num: "6.1", title: "Description of the service" },
      { id: "service-availability", num: "6.2", title: "Availability, uptime & maintenance" },
      { id: "service-changes", num: "6.3", title: "Changes & evolution of the service" },
    ],
  },
  {
    id: "content",
    num: "7",
    title: "Your content, your responsibility",
    children: [
      { id: "content-ownership", num: "7.1", title: "You own your content" },
      { id: "content-licence", num: "7.2", title: "The narrow technical licence you grant us" },
      { id: "content-warranties", num: "7.3", title: "Your warranties about your content" },
      { id: "content-no-monitoring", num: "7.4", title: "We do not pre-screen or monitor messages" },
    ],
  },
  {
    id: "acceptable-use",
    num: "8",
    title: "Acceptable use policy",
    children: [
      { id: "au-prohibited", num: "8.1", title: "Prohibited content" },
      { id: "au-prohibited-conduct", num: "8.2", title: "Prohibited conduct" },
      { id: "au-automation", num: "8.3", title: "Automation, bots & scraping" },
      { id: "au-security", num: "8.4", title: "Security testing & responsible disclosure" },
      { id: "au-enforcement", num: "8.5", title: "How we enforce this policy" },
    ],
  },
  { id: "fees", num: "9", title: "Fees, donations & in-app purchases" },
  { id: "third-party", num: "10", title: "Third-party services, links & integrations" },
  {
    id: "termination",
    num: "11",
    title: "Suspension, termination & deletion",
    children: [
      { id: "term-by-us", num: "11.1", title: "Suspension or termination by us" },
      { id: "term-by-you", num: "11.2", title: "Termination by you" },
      { id: "term-effects", num: "11.3", title: "Effects of termination" },
    ],
  },
  { id: "ip", num: "12", title: "Intellectual-property rights in the service" },
  { id: "feedback", num: "13", title: "Feedback & contributions" },
  { id: "open-source", num: "14", title: "Open-source components" },
  { id: "warranty", num: "15", title: "No warranty — service provided 'as is'" },
  { id: "liability", num: "16", title: "Limitation of liability" },
  { id: "indemnity", num: "17", title: "Indemnification" },
  { id: "force-majeure", num: "18", title: "Force majeure" },
  { id: "law", num: "19", title: "Governing law & jurisdiction" },
  {
    id: "disputes",
    num: "20",
    title: "Dispute resolution",
    children: [
      { id: "disputes-informal", num: "20.1", title: "Informal resolution first" },
      { id: "disputes-arbitration", num: "20.2", title: "Arbitration where permitted" },
      { id: "disputes-class", num: "20.3", title: "No class actions" },
      { id: "disputes-consumer", num: "20.4", title: "Mandatory consumer protections" },
    ],
  },
  { id: "us-export", num: "21", title: "Export controls & sanctions" },
  { id: "us-government", num: "22", title: "U.S. government end-users" },
  { id: "modifications", num: "23", title: "Modifications to these Terms" },
  { id: "general", num: "24", title: "General provisions" },
  { id: "contact", num: "25", title: "Contact" },
  { id: "glossary", num: "26", title: "Glossary of terms used in this document" },
];

export function TermsPage() {
  // The browser tab title is set explicitly so the document is easy
  // to identify in a tab strip and shows up cleanly in shared
  // previews.
  useEffect(() => {
    const previous = document.title;
    document.title = "Terms & Conditions · VeilChat";
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
      <TermsNav />
      <TermsHero />
      <TermsBody />
      <TermsFooter />
    </div>
  );
}

/* ───────────────────────── Navigation ───────────────────────── */

function TermsNav() {
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
          <Link to="/" className="hover:text-[#2E6F40]">
            Home
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

function TermsHero() {
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
          <ScrollMini />
          Legal · Terms of service
        </div>
        <h1
          className="mt-6 text-[40px] sm:text-[52px] md:text-[60px] font-semibold tracking-[-0.025em] leading-[1.05] text-[#253D2C]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          Terms &amp;{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            Conditions.
          </span>
        </h1>
        <p className="mt-6 text-[16px] sm:text-[18px] text-[#3C5A47] leading-[1.6] max-w-2xl mx-auto">
          The complete agreement between you and VeilChat — written
          long enough to actually answer the questions you might
          have, and clearly enough that you can read it without a
          law degree. Sit down with a coffee, or skim the
          at-a-glance summary below; either way, you'll know exactly
          what we've promised and what we expect in return.
        </p>

        <dl className="mt-10 grid grid-cols-3 gap-4 sm:gap-6 max-w-xl mx-auto text-left">
          <MetaCell label="Effective" value={EFFECTIVE_DATE} />
          <MetaCell label="Last updated" value={LAST_UPDATED} />
          <MetaCell label="Version" value={VERSION} />
        </dl>
      </div>
    </section>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#253D2C]/10 bg-white/60 backdrop-blur-sm px-4 py-3">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#2E6F40]">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] font-semibold text-[#253D2C] leading-snug">
        {value}
      </dd>
    </div>
  );
}

function ScrollMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

/* ───────────────────────── Body ───────────────────────── */

function TermsBody() {
  const flatIds = useMemo(() => {
    const out: string[] = [];
    for (const s of TOC) {
      out.push(s.id);
      if (s.children) for (const c of s.children) out.push(c.id);
    }
    return out;
  }, []);

  const [activeId, setActiveId] = useState<string>(flatIds[0] ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top,
          );
        const top = visible[0];
        if (top) {
          setActiveId(top.target.id);
        }
      },
      { rootMargin: "-100px 0px -65% 0px", threshold: [0, 1] },
    );
    flatIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [flatIds]);

  return (
    <section className="relative pb-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
              <TableOfContents activeId={activeId} />
            </div>
          </aside>

          <article className="lg:col-span-8 xl:col-span-9 max-w-3xl">
            <SummarySection />
            <AgreementSection />
            <WhoWeAreSection />
            <DefinitionsSection />
            <EligibilitySection />
            <AccountSection />
            <ServiceSection />
            <ContentSection />
            <AcceptableUseSection />
            <FeesSection />
            <ThirdPartySection />
            <TerminationSection />
            <IpSection />
            <FeedbackSection />
            <OpenSourceSection />
            <WarrantySection />
            <LiabilitySection />
            <IndemnitySection />
            <ForceMajeureSection />
            <LawSection />
            <DisputesSection />
            <ExportSection />
            <UsGovSection />
            <ModificationsSection />
            <GeneralSection />
            <ContactSection />
            <GlossarySection />
          </article>
        </div>
      </div>
    </section>
  );
}

function TableOfContents({ activeId }: { activeId: string }) {
  return (
    <nav aria-label="Table of contents" className="text-[13.5px]">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2E6F40]">
        On this page
      </div>
      <ul className="mt-4 space-y-1.5">
        {TOC.map((s) => {
          const isActive =
            activeId === s.id ||
            (s.children?.some((c) => c.id === activeId) ?? false);
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={[
                  "block py-1 leading-snug transition-colors",
                  isActive
                    ? "text-[#2E6F40] font-semibold"
                    : "text-[#3C5A47] hover:text-[#2E6F40]",
                ].join(" ")}
              >
                <span className="font-mono text-[11.5px] mr-2 text-[#2E6F40]/70">
                  {s.num}
                </span>
                {s.title}
              </a>
              {s.children && (
                <ul className="ml-5 mt-0.5 mb-1 space-y-0.5 border-l border-[#253D2C]/10 pl-3">
                  {s.children.map((c) => {
                    const childActive = activeId === c.id;
                    return (
                      <li key={c.id}>
                        <a
                          href={`#${c.id}`}
                          className={[
                            "block py-0.5 text-[12.5px] leading-snug transition-colors",
                            childActive
                              ? "text-[#2E6F40] font-semibold"
                              : "text-[#3C5A47]/80 hover:text-[#2E6F40]",
                          ].join(" ")}
                        >
                          <span className="font-mono text-[11px] mr-1.5 text-[#2E6F40]/60">
                            {c.num}
                          </span>
                          {c.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ───────────────────────── Section primitives ───────────────────────── */

function H2({ id, num, children }: { id: string; num: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 mt-16 mb-5 text-[26px] sm:text-[30px] font-semibold tracking-tight text-[#253D2C] leading-tight"
      style={{ fontFamily: "'Fraunces', 'Inter', serif" }}
    >
      <span className="font-mono text-[15px] text-[#2E6F40] mr-3 align-middle">
        §{num}
      </span>
      {children}
    </h2>
  );
}

function H3({ id, num, children }: { id: string; num: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 mt-10 mb-3 text-[19px] sm:text-[20px] font-semibold text-[#253D2C] leading-snug"
    >
      <span className="font-mono text-[13px] text-[#2E6F40] mr-2 align-middle">
        §{num}
      </span>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-4 text-[15.5px] leading-[1.75] text-[#253D2C]/90">
      {children}
    </p>
  );
}

function Plain({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-3 text-[14px] leading-[1.7] italic text-[#3C5A47]/90 border-l-2 border-[#68BA7F] pl-4">
      <span className="not-italic font-semibold text-[#2E6F40] tracking-wide text-[11px] uppercase mr-2">
        In plain English
      </span>
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="my-4 ml-5 space-y-2 text-[15px] leading-[1.7] text-[#253D2C]/90 list-disc marker:text-[#2E6F40]/70">
      {children}
    </ul>
  );
}

function Box({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "warn" | "good";
  title: string;
  children: React.ReactNode;
}) {
  const palette = {
    neutral: {
      bg: "#FFFFFF",
      bd: "rgba(37,61,44,0.10)",
      tag: "#2E6F40",
      tagBg: "#CFFFDC",
    },
    warn: {
      bg: "#FFF8EE",
      bd: "rgba(196,138,40,0.30)",
      tag: "#8C5A1A",
      tagBg: "#FFE9C2",
    },
    good: {
      bg: "#F0FFF5",
      bd: "rgba(104,186,127,0.40)",
      tag: "#1F5A2E",
      tagBg: "#CFFFDC",
    },
  }[tone];
  return (
    <div
      className="my-6 rounded-2xl px-5 py-4"
      style={{ backgroundColor: palette.bg, border: `1px solid ${palette.bd}` }}
    >
      <div
        className="inline-flex items-center text-[10.5px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
        style={{ color: palette.tag, backgroundColor: palette.tagBg }}
      >
        {title}
      </div>
      <div className="mt-2 text-[14.5px] leading-[1.7] text-[#253D2C]/90">
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Section content ───────────────────────── */

function SummarySection() {
  return (
    <>
      <H2 id="summary" num="0">At-a-glance summary</H2>
      <P>
        Terms of service documents are notorious for being long
        enough that nobody reads them and one-sided enough that the
        people who do read them feel cheated. We've tried to do
        neither. The headline points are these:
      </P>
      <UL>
        <li>
          <strong>VeilChat is free.</strong> There are no ads, no
          paid tiers, no in-app purchases, and no upsells.
        </li>
        <li>
          <strong>You own everything you write.</strong> We do not
          claim a copyright in your messages, and we do not use them
          to train any model.
        </li>
        <li>
          <strong>You're responsible for what you send.</strong>{" "}
          Encryption protects your privacy; it does not absolve you
          of responsibility for breaking the law or hurting other
          people.
        </li>
        <li>
          <strong>Don't abuse the service.</strong> The acceptable
          use rules in §8 describe the small set of things that will
          get an account suspended.
        </li>
        <li>
          <strong>You can leave at any time.</strong> Closing your
          account permanently deletes the account record and the
          server-side data described in our Privacy Policy within
          fourteen days.
        </li>
        <li>
          <strong>The service is provided "as is".</strong> We will
          do our honest best to keep VeilChat running smoothly, but
          we cannot guarantee it will be error-free or uninterrupted
          (§15).
        </li>
        <li>
          <strong>Liability is limited</strong> to the maximum extent
          permitted by law (§16). If you are a consumer, mandatory
          consumer-protection laws in your country still apply on top
          of these Terms.
        </li>
        <li>
          <strong>If something goes wrong, we want to hear from you
          first.</strong> §20 describes how disputes are resolved,
          starting with a real human reading your email.
        </li>
      </UL>
      <Box tone="good" title="Bottom line">
        Use VeilChat to talk privately with people you trust. Be
        decent to other users. Don't try to break the service or
        anyone else. The rest is detail.
      </Box>
    </>
  );
}

function AgreementSection() {
  return (
    <>
      <H2 id="agreement" num="1">The agreement between you and us</H2>
      <P>
        These Terms &amp; Conditions (the "<strong>Terms</strong>")
        form a binding legal agreement between you ("<strong>you</strong>",
        "<strong>your</strong>") and the VeilChat project
        ("<strong>VeilChat</strong>", "<strong>we</strong>",
        "<strong>us</strong>", "<strong>our</strong>") that governs
        your access to and use of the VeilChat web client, the
        downloadable Progressive Web App, the marketing pages on
        the same domain, and the routing servers that connect them
        (collectively, the "<strong>Service</strong>").
      </P>
      <P>
        By creating an account, by signing in with an existing
        account, by installing VeilChat as a Progressive Web App,
        or simply by continuing to use the Service after these
        Terms have come into effect, you agree to be bound by them.
        If you do not agree, you must not use the Service.
      </P>
      <P>
        These Terms incorporate by reference the{" "}
        <Link to="/privacy-policy" className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline">
          VeilChat Privacy Policy
        </Link>
        , which describes how we process personal data, and any
        feature-specific notice you accept inside the application
        (for example, the prompts that appear when you enable
        biometric unlock or push notifications).
      </P>
      <Plain>
        Using VeilChat means agreeing to these Terms. If a clause
        in these Terms ever conflicts with the Privacy Policy on a
        question about how we handle personal data, the Privacy
        Policy wins.
      </Plain>
    </>
  );
}

function WhoWeAreSection() {
  return (
    <>
      <H2 id="who-we-are" num="2">Who we are</H2>
      <P>
        VeilChat is operated by the VeilChat project, an
        independent team that builds and maintains a privacy-first
        end-to-end encrypted messenger. The web client is delivered
        from <code>chats-client-vert.vercel.app</code> (and any
        future custom domain we may serve it from); the routing
        backend is reachable at <code>chats-fk6e.onrender.com</code>.
      </P>
      <P>
        For all questions about these Terms, write to us at{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:legal@veil.app"
        >
          legal@veil.app
        </a>
        . For privacy questions, use{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:privacy@veil.app"
        >
          privacy@veil.app
        </a>
        ; for security disclosures, use{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:security@veil.app"
        >
          security@veil.app
        </a>
        .
      </P>
    </>
  );
}

function DefinitionsSection() {
  return (
    <>
      <H2 id="definitions" num="3">Definitions used in these Terms</H2>
      <UL>
        <li>
          <strong>Account.</strong> The record we create when you
          sign up, identified by a unique account identifier and
          your chosen username.
        </li>
        <li>
          <strong>Content.</strong> Any text, image, video, audio,
          file, link, or other material you create, transmit,
          upload, or otherwise make available through the Service.
        </li>
        <li>
          <strong>Encrypted Content.</strong> Any Content that is
          end-to-end encrypted by your device before it reaches our
          servers, in which form we cannot read it.
        </li>
        <li>
          <strong>End-to-end encryption (E2EE).</strong> A scheme
          in which only the sending and receiving devices hold the
          keys necessary to decrypt the Content.
        </li>
        <li>
          <strong>Recovery Phrase.</strong> The 24-word secret
          generated for you at sign-up that, together with your
          local PIN, is required to unlock your Account on a new
          device.
        </li>
        <li>
          <strong>Service.</strong> The web client, the
          Progressive Web App, the routing backend, and the
          marketing pages, taken together.
        </li>
      </UL>
    </>
  );
}

function EligibilitySection() {
  return (
    <>
      <H2 id="eligibility" num="4">Eligibility &amp; age requirements</H2>
      <P>
        To use the Service, you must be at least thirteen (13)
        years old, or such higher age as the law of your country
        requires for you to give valid consent to the processing
        of your personal data. In the European Economic Area, the
        minimum age is sixteen (16) years, except in Member States
        that have lawfully set a lower age under Article 8 GDPR,
        in which case the minimum age is the age set by that
        Member State.
      </P>
      <P>
        If you are under the age of legal majority in your
        country but old enough to use the Service under the rule
        above, your parent or legal guardian must read these
        Terms with you and consent on your behalf to your use of
        the Service.
      </P>
      <P>
        You also represent that you are not a person prohibited
        from receiving services under the laws of your country or
        the export-control rules described in §21.
      </P>
      <Plain>
        VeilChat is a tool for people who can legally give consent
        to using a messenger. If that's not you, please ask a
        parent or guardian first.
      </Plain>
    </>
  );
}

function AccountSection() {
  return (
    <>
      <H2 id="account" num="5">Your VeilChat account</H2>

      <H3 id="account-creation" num="5.1">Creating an account</H3>
      <P>
        You may sign up using an email address, a phone number, or
        a random ID with no link to any other identifier. The
        information you provide must be accurate at the time you
        provide it; you are responsible for keeping your account
        information up to date.
      </P>
      <P>
        You may create only one personal account at a time. You
        may not impersonate another person, misrepresent your
        affiliation with anyone, or pick a username that is
        designed to deceive other users.
      </P>

      <H3 id="account-credentials" num="5.2">Credentials, recovery phrase &amp; PIN</H3>
      <P>
        Your Recovery Phrase and your local PIN are the only
        secrets that can unlock your encrypted message history on
        a new device. We do not have a copy of either, and we
        cannot recover them for you. If you lose them, you will
        lose access to your encrypted history; that is a feature
        of the design, not a bug.
      </P>
      <UL>
        <li>
          Write your Recovery Phrase down and store it in a place
          only you can reach.
        </li>
        <li>
          Do not photograph, screenshot, email, paste into a chat,
          or otherwise digitise your Recovery Phrase in a way that
          could expose it to a third party.
        </li>
        <li>
          Pick a PIN you will remember, do not share it with
          anyone, and change it if you ever suspect it has been
          observed.
        </li>
      </UL>

      <H3 id="account-security" num="5.3">Security of your account</H3>
      <P>
        You are responsible for all activity that occurs under
        your account, except where that activity is the result of
        unauthorised access made possible by a fault on our side.
        You agree to:
      </P>
      <UL>
        <li>
          Notify us promptly at{" "}
          <a
            className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
            href="mailto:security@veil.app"
          >
            security@veil.app
          </a>{" "}
          if you suspect that your account has been accessed
          without your authorisation, or that your Recovery Phrase
          has been disclosed to a third party.
        </li>
        <li>
          Keep your devices, browsers, and operating systems up to
          date so that the underlying cryptography continues to be
          enforced as designed.
        </li>
        <li>
          Use strong, unique passwords for any optional password
          you set on the account, and enable a passkey where
          available.
        </li>
      </UL>

      <H3 id="account-multiple-devices" num="5.4">Multiple devices &amp; linked sessions</H3>
      <P>
        You may use the Service on more than one device by linking
        them to your account. Each linked device receives its own
        copy of your private keys, derived from your Recovery
        Phrase, and is therefore able to decrypt new messages
        independently. You can revoke any linked device at any
        time from Settings → Sessions; revoking a session
        invalidates the session token immediately and the device
        will no longer be able to fetch new envelopes for your
        account.
      </P>
      <Plain>
        Look after your account like you'd look after a key to
        your house: don't leave it lying around, change locks if
        you suspect a copy is out there, and tell us if something
        looks off.
      </Plain>
    </>
  );
}

function ServiceSection() {
  return (
    <>
      <H2 id="service" num="6">What the service is — and is not</H2>

      <H3 id="service-description" num="6.1">Description of the service</H3>
      <P>
        The Service lets you send and receive end-to-end encrypted
        text messages, voice notes, photos, videos, files, and
        calls between accounts you have explicitly connected with.
        It also offers optional features such as group chats, a
        discovery profile, a vault for encrypted notes, focus
        modes, scheduled messages, and disappearing-message
        timers. The exact set of features available at any given
        time is the set you can see inside the application.
      </P>

      <H3 id="service-availability" num="6.2">Availability, uptime &amp; maintenance</H3>
      <P>
        We aim to keep the Service available continuously, but we
        do not guarantee any specific level of availability. From
        time to time we will perform maintenance that requires
        brief downtime, and from time to time third-party outages
        (a hosting provider going down, a push-notification
        service experiencing issues, the public internet
        misbehaving) will affect us. We try to schedule planned
        maintenance for low-traffic windows and to communicate it
        in advance via the in-app status indicator and the
        VeilChat status page where one is in operation.
      </P>

      <H3 id="service-changes" num="6.3">Changes &amp; evolution of the service</H3>
      <P>
        Software changes. We may add new features, improve
        existing ones, deprecate old ones, change the user
        interface, and change the technical architecture of the
        Service at our discretion. Where a change materially
        reduces a function you have been actively using, we will
        give you reasonable advance notice and, where possible, a
        way to export the affected data before the change takes
        effect.
      </P>
      <Plain>
        We try to keep the lights on; we don't promise the lights
        will never blink. We add and remove features over time and
        give you notice when it actually matters to you.
      </Plain>
    </>
  );
}

function ContentSection() {
  return (
    <>
      <H2 id="content" num="7">Your content, your responsibility</H2>

      <H3 id="content-ownership" num="7.1">You own your content</H3>
      <P>
        As between you and us, you retain all ownership rights in
        the Content you create, transmit, upload, or otherwise
        make available through the Service. We do not claim any
        ownership in your Content, and we do not use your Content
        to train any artificial-intelligence model, recommendation
        engine, or advertising system.
      </P>

      <H3 id="content-licence" num="7.2">The narrow technical licence you grant us</H3>
      <P>
        Solely so that we can deliver the Service to you and the
        people you send it to, you grant us a worldwide,
        non-exclusive, royalty-free, sub-licensable (only to our
        infrastructure providers acting on our behalf, as
        described in §10 of the Privacy Policy) licence to host,
        transmit, store, and route the Encrypted Content you
        upload, until that Encrypted Content is delivered to its
        recipients or expires under the retention rules in §9 of
        the Privacy Policy. This licence is strictly technical: we
        do not gain any ownership rights, we cannot read the
        Encrypted Content, and we cannot use it for any purpose
        other than routing it to its recipients.
      </P>
      <P>
        For Content you intentionally make public (for example, a
        bio you display on your discovery profile), the licence
        also extends to publishing that Content on the surfaces of
        the Service where you have chosen to display it.
      </P>

      <H3 id="content-warranties" num="7.3">Your warranties about your content</H3>
      <P>
        You represent and warrant that:
      </P>
      <UL>
        <li>
          You own the Content you upload, or you have all
          necessary rights and permissions to make it available
          through the Service.
        </li>
        <li>
          The Content does not infringe the intellectual-property
          rights, privacy rights, publicity rights, or any other
          rights of any third party.
        </li>
        <li>
          The Content does not violate any applicable law or
          regulation in any jurisdiction in which it might
          reasonably be received.
        </li>
        <li>
          You have obtained any consents required from people
          identifiable in the Content (for example, before sending
          a photograph of someone to a third person).
        </li>
      </UL>

      <H3 id="content-no-monitoring" num="7.4">We do not pre-screen or monitor messages</H3>
      <P>
        Because of the way end-to-end encryption works, we cannot
        read the contents of your messages, your attachments, your
        voice notes, or your call media. As a consequence, we do
        not pre-screen, edit, classify, score, or otherwise
        moderate the Encrypted Content you exchange with other
        users. The acceptable-use rules in §8 still apply, but we
        rely on user reports and on the metadata categories
        described in our Privacy Policy to enforce them; we do not
        and cannot perform content scanning of any kind.
      </P>
      <Plain>
        Your messages are yours, you stay in charge of them, and
        we have no technical way to look at them in the first
        place.
      </Plain>
    </>
  );
}

function AcceptableUseSection() {
  return (
    <>
      <H2 id="acceptable-use" num="8">Acceptable use policy</H2>
      <P>
        VeilChat exists so that ordinary people can have private
        conversations. The rules below describe the small set of
        behaviours that are not permitted on the Service. They
        apply to every account, on every device, in every
        jurisdiction.
      </P>

      <H3 id="au-prohibited" num="8.1">Prohibited content</H3>
      <P>
        You must not use the Service to create, store, transmit,
        or solicit any of the following:
      </P>
      <UL>
        <li>
          Content that sexually exploits or endangers children, or
          that depicts the abuse of children. We report all
          credible reports of child sexual abuse material received
          through abuse-reporting channels to the relevant
          authorities to the extent the law requires.
        </li>
        <li>
          Content that incites or threatens imminent violence
          against a person or group, or that constitutes a true
          threat under the law of a relevant jurisdiction.
        </li>
        <li>
          Content that constitutes harassment, stalking, or
          intimidation of a specific person, including the
          non-consensual distribution of intimate imagery.
        </li>
        <li>
          Content that promotes terrorism, organised criminal
          activity, or trafficking in human beings.
        </li>
        <li>
          Content that is unlawful in the jurisdiction in which
          it would reasonably be received, including infringing
          material, fraudulent material, illegal goods, or
          regulated substances offered without lawful
          authorisation.
        </li>
      </UL>

      <H3 id="au-prohibited-conduct" num="8.2">Prohibited conduct</H3>
      <P>
        You must not:
      </P>
      <UL>
        <li>
          Send unsolicited bulk or commercial messages, marketing
          spam, or chain messages.
        </li>
        <li>
          Create accounts at scale, register accounts using
          automation tools, or operate accounts on behalf of
          another person without their authorisation.
        </li>
        <li>
          Impersonate another person, group, or organisation, or
          misrepresent your affiliation with anyone.
        </li>
        <li>
          Use the Service in a way that knowingly disrupts,
          interferes with, degrades, or imposes an unreasonable
          load on the infrastructure that delivers it.
        </li>
        <li>
          Use the Service to engage in a denial-of-service attack
          or to facilitate a denial-of-service attack against any
          other system.
        </li>
        <li>
          Use the Service in a way that violates the rights or
          legitimate expectations of other users.
        </li>
      </UL>

      <H3 id="au-automation" num="8.3">Automation, bots &amp; scraping</H3>
      <P>
        You must not, except with our prior written permission:
      </P>
      <UL>
        <li>
          Use automation, bots, scripts, headless browsers, or
          screen-scrapers to access the Service.
        </li>
        <li>
          Reverse engineer, decompile, or disassemble any part of
          the Service, except to the extent that applicable law
          expressly permits such activity notwithstanding this
          restriction.
        </li>
        <li>
          Bypass, attempt to bypass, or facilitate the
          circumvention of any rate limit, abuse-protection
          mechanism, or technical limitation we have implemented.
        </li>
        <li>
          Republish, mirror, or otherwise systematically exploit
          metadata or directory information obtained from the
          Service.
        </li>
      </UL>

      <H3 id="au-security" num="8.4">Security testing &amp; responsible disclosure</H3>
      <P>
        We welcome good-faith security research. If you intend to
        probe the Service, please:
      </P>
      <UL>
        <li>
          Use only test accounts you control, never the accounts
          of other users.
        </li>
        <li>
          Avoid any test that could degrade availability for real
          users (denial-of-service, bulk data exfiltration, etc.).
        </li>
        <li>
          Stop and report immediately if you encounter another
          user's data; do not download it, do not share it.
        </li>
        <li>
          Report findings privately to{" "}
          <a
            className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
            href="mailto:security@veil.app"
          >
            security@veil.app
          </a>{" "}
          and give us a reasonable opportunity to remediate before
          disclosing publicly.
        </li>
      </UL>
      <P>
        Research conducted in good faith and within these limits
        does not violate the Acceptable Use Policy and we will not
        pursue legal action against researchers who follow them.
      </P>

      <H3 id="au-enforcement" num="8.5">How we enforce this policy</H3>
      <P>
        Where we have a reasonable basis to believe that an
        account is being used in a way that violates this Policy,
        we may, in proportion to the nature and severity of the
        violation:
      </P>
      <UL>
        <li>
          Issue a warning to the account holder by in-app message
          or email.
        </li>
        <li>
          Throttle, rate-limit, or temporarily suspend the
          account.
        </li>
        <li>
          Remove or refuse to route specific Content (subject to
          the limits set by end-to-end encryption — in practice,
          only metadata-level controls are technically available
          to us).
        </li>
        <li>
          Permanently close the account in line with §11.1.
        </li>
        <li>
          Cooperate with relevant authorities to the extent
          required by law.
        </li>
      </UL>
      <Plain>
        Don't use VeilChat to hurt other people, don't try to
        knock the service over, and don't try to scrape it. Real
        security researchers acting in good faith are welcome.
      </Plain>
    </>
  );
}

function FeesSection() {
  return (
    <>
      <H2 id="fees" num="9">Fees, donations &amp; in-app purchases</H2>
      <P>
        VeilChat is provided to you free of charge. There are no
        subscription fees, no usage-based charges, no in-app
        purchases, and no advertising. We may, at our discretion,
        offer a way for users to make voluntary donations toward
        the cost of running the infrastructure. Where we do, the
        following will apply:
      </P>
      <UL>
        <li>
          Donations are voluntary, are not consideration for any
          enhanced level of service, and do not entitle the
          donor to any feature or privilege not available to
          other users.
        </li>
        <li>
          Donations are processed by an unaffiliated payment
          processor whose own terms and privacy policy will apply
          to the payment transaction itself.
        </li>
        <li>
          Donations are non-refundable except where required by
          law, and we do not offer chargeback dispute resolution.
        </li>
      </UL>
      <P>
        If, in the future, we ever introduce a paid feature, we
        will publish revised Terms describing it, give clear
        advance notice, and never silently start charging for a
        feature you previously used for free.
      </P>
    </>
  );
}

function ThirdPartySection() {
  return (
    <>
      <H2 id="third-party" num="10">Third-party services, links &amp; integrations</H2>
      <P>
        The Service may include links to third-party websites or
        documents (for example, our public source-code repository,
        a security researcher's write-up, or a regulator's
        webpage). We do not control those sites, we do not endorse
        their content, and these Terms do not apply to your use of
        them. You access third-party sites at your own risk and
        subject to those sites' own terms.
      </P>
      <P>
        Where the Service interoperates with a third-party
        protocol or service in order to deliver a feature (for
        example, the Web Push protocol used to deliver push
        notifications, the WebRTC protocol used for calls, or the
        TURN/STUN relay used to traverse hostile networks), the
        third-party operator's terms govern that operator's
        portion of the interaction; ours govern only our portion.
      </P>
    </>
  );
}

function TerminationSection() {
  return (
    <>
      <H2 id="termination" num="11">Suspension, termination &amp; deletion</H2>

      <H3 id="term-by-us" num="11.1">Suspension or termination by us</H3>
      <P>
        We may suspend or terminate your access to the Service,
        in whole or in part, with immediate effect:
      </P>
      <UL>
        <li>
          If you materially or repeatedly violate these Terms,
          including the Acceptable Use Policy in §8.
        </li>
        <li>
          If we are required to do so by law, by court order, or
          by an applicable regulatory authority.
        </li>
        <li>
          If continuing to provide the Service to your account
          would expose us, our infrastructure providers, or other
          users to a meaningful security or liability risk.
        </li>
      </UL>
      <P>
        Where suspension or termination is the result of a
        violation that you can cure, we will, where reasonably
        practicable, give you advance notice and a meaningful
        opportunity to cure before taking action. Where the
        violation is severe (for example, the prohibited content
        listed in §8.1), suspension may take effect immediately
        and without prior notice.
      </P>

      <H3 id="term-by-you" num="11.2">Termination by you</H3>
      <P>
        You may stop using the Service at any time, for any
        reason, by closing your account from Settings → Account →
        Delete my account. Closing your account triggers the
        deletion process described in §9 of the Privacy Policy.
        You may also simply stop using the Service without closing
        your account; in that case the account will remain
        dormant and subject to the retention rules already
        described, but will not be automatically deleted.
      </P>

      <H3 id="term-effects" num="11.3">Effects of termination</H3>
      <P>
        On termination of these Terms (whether by you, by us, or
        by operation of law):
      </P>
      <UL>
        <li>
          Your right to access and use the Service ends
          immediately.
        </li>
        <li>
          The deletion timetable in §9 of the Privacy Policy
          applies to the data associated with your account.
        </li>
        <li>
          Sections of these Terms that, by their nature, are
          intended to survive termination — including §7.3
          (warranties), §15 (no warranty), §16 (limitation of
          liability), §17 (indemnification), §19 (governing law),
          and §20 (dispute resolution) — survive.
        </li>
        <li>
          Termination does not affect any rights or remedies
          either party had accrued before termination.
        </li>
      </UL>
      <Plain>
        We can stop you using the service if you break the rules
        or the law; you can leave whenever you want. Some clauses
        keep applying after the agreement ends, exactly the
        clauses you'd expect to.
      </Plain>
    </>
  );
}

function IpSection() {
  return (
    <>
      <H2 id="ip" num="12">Intellectual-property rights in the service</H2>
      <P>
        Subject to the open-source licences described in §14 and
        to any rights you have in your Content under §7, all
        intellectual-property rights in the Service — including
        the source code, the visual design, the typography, the
        VeilChat name, the VeilChat logo, the wordmark, and the
        accompanying brand assets — belong to us or to our
        licensors.
      </P>
      <P>
        Nothing in these Terms grants you any right to use the
        VeilChat name or logo for commercial purposes, to suggest
        an endorsement of your own product or service, or to
        register a confusingly similar trademark.
      </P>
    </>
  );
}

function FeedbackSection() {
  return (
    <>
      <H2 id="feedback" num="13">Feedback &amp; contributions</H2>
      <P>
        If you choose to send us feedback, suggestions, ideas, or
        bug reports, you grant us a perpetual, irrevocable,
        worldwide, royalty-free licence to use them for any
        purpose related to the Service, without any obligation to
        you. We do not, however, take ownership of your underlying
        rights, and you remain free to use the same idea
        elsewhere.
      </P>
      <P>
        If you choose to contribute code or documentation to a
        public VeilChat repository, the contribution-licence terms
        of that repository (typically the same open-source licence
        the rest of the project is published under) govern your
        contribution.
      </P>
    </>
  );
}

function OpenSourceSection() {
  return (
    <>
      <H2 id="open-source" num="14">Open-source components</H2>
      <P>
        The Service is built on top of, and incorporates, a number
        of open-source components. Each such component is licensed
        under its own terms, which take precedence over these
        Terms with respect to that component. The complete list of
        open-source dependencies, together with the text of the
        applicable licences, is available from our public source
        repository.
      </P>
      <P>
        Where an open-source licence grants you rights — for
        example, the right to use, copy, modify, or redistribute a
        component — those rights remain available to you on the
        terms of that licence, regardless of anything in these
        Terms.
      </P>
    </>
  );
}

function WarrantySection() {
  return (
    <>
      <H2 id="warranty" num="15">No warranty — service provided "as is"</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE
        SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT
        ANY WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED,
        STATUTORY, OR OTHERWISE. WE SPECIFICALLY DISCLAIM ALL
        IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
      </P>
      <P>
        We do not warrant that the Service will be uninterrupted,
        error-free, free of malicious code, or available at any
        particular time or in any particular geographic area; that
        defects will be corrected; or that the Service will meet
        your specific requirements.
      </P>
      <P>
        Some jurisdictions do not allow the exclusion of certain
        warranties. To the extent that any such warranty cannot
        lawfully be excluded, our liability under that warranty is
        limited as set out in §16.
      </P>
    </>
  );
}

function LiabilitySection() {
  return (
    <>
      <H2 id="liability" num="16">Limitation of liability</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE,
        OUR AFFILIATES, OUR INFRASTRUCTURE PROVIDERS, AND OUR
        RESPECTIVE OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS
        SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
        CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES,
        OR FOR ANY LOSS OF PROFIT, REVENUE, GOODWILL, BUSINESS
        OPPORTUNITY, OR DATA, ARISING OUT OF OR RELATED TO YOUR
        USE OF, OR INABILITY TO USE, THE SERVICE, REGARDLESS OF
        THE LEGAL THEORY ON WHICH THE CLAIM IS BASED AND
        REGARDLESS OF WHETHER WE WERE ADVISED OF THE POSSIBILITY
        OF SUCH DAMAGES.
      </P>
      <P>
        Our aggregate liability for all claims arising out of or
        related to these Terms or the Service shall not exceed the
        greater of (a) the amount you have paid us in connection
        with the Service in the twelve months preceding the event
        giving rise to the claim, or (b) one hundred United States
        dollars (US$100).
      </P>
      <P>
        Nothing in these Terms excludes or limits any liability
        that cannot be lawfully excluded or limited, including
        liability for fraud, fraudulent misrepresentation, death
        or personal injury caused by negligence, or any other
        liability that applicable law treats as non-excludable.
      </P>
      <Plain>
        We have done our honest best to build a careful product,
        but we cannot accept open-ended financial responsibility
        for things outside our control. Where the law says we
        can't limit something — for example, our liability if we
        intentionally hurt you — we don't try to.
      </Plain>
    </>
  );
}

function IndemnitySection() {
  return (
    <>
      <H2 id="indemnity" num="17">Indemnification</H2>
      <P>
        You agree to defend, indemnify, and hold harmless the
        VeilChat project and our affiliates, infrastructure
        providers, officers, directors, employees, and agents
        from and against any claim, demand, loss, damage, cost,
        or expense (including reasonable lawyers' fees) arising
        out of or related to:
      </P>
      <UL>
        <li>Your use of the Service in violation of these Terms;</li>
        <li>Your Content or your conduct toward other users;</li>
        <li>
          Your violation of any law or of any third-party right;
          or
        </li>
        <li>
          Any false statement you make in connection with your
          account.
        </li>
      </UL>
      <P>
        We will give you prompt notice of any claim that triggers
        this indemnity, will let you control the defence and
        settlement of the claim (provided that any settlement
        affecting our rights requires our prior written consent),
        and will reasonably co-operate with you in the defence.
      </P>
      <P>
        This section does not apply to consumers using the Service
        for purposes outside their trade, business, craft, or
        profession to the extent that mandatory consumer-protection
        law in their country prohibits such an indemnity.
      </P>
    </>
  );
}

function ForceMajeureSection() {
  return (
    <>
      <H2 id="force-majeure" num="18">Force majeure</H2>
      <P>
        Neither party shall be liable for any failure or delay in
        the performance of its obligations under these Terms (other
        than the obligation to pay any sum that is due) where the
        failure or delay is caused by an event beyond its
        reasonable control, including without limitation acts of
        God, natural disasters, fire, flood, pandemic, government
        action, war, terrorism, civil unrest, labour disputes,
        outage of a major internet backbone or hosting provider,
        nationwide DNS outage, or any large-scale failure of the
        public internet.
      </P>
    </>
  );
}

function LawSection() {
  return (
    <>
      <H2 id="law" num="19">Governing law &amp; jurisdiction</H2>
      <P>
        These Terms, and any non-contractual obligations arising
        out of or in connection with them, are governed by the
        laws of the jurisdiction in which the VeilChat project is
        domiciled at the time the dispute arises, without regard
        to its choice-of-law rules.
      </P>
      <P>
        Subject to §20 (Dispute resolution), the courts of that
        jurisdiction shall have exclusive jurisdiction to settle
        any dispute or claim arising out of or in connection with
        these Terms or their subject matter or formation,
        including non-contractual disputes or claims.
      </P>
      <P>
        Nothing in this section deprives a consumer of the
        protection afforded by mandatory provisions of the law of
        the country in which the consumer is habitually resident,
        nor of the right to bring proceedings in the courts of
        that country.
      </P>
    </>
  );
}

function DisputesSection() {
  return (
    <>
      <H2 id="disputes" num="20">Dispute resolution</H2>

      <H3 id="disputes-informal" num="20.1">Informal resolution first</H3>
      <P>
        If you have a complaint about the Service or about us, we
        ask that you contact us first at{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:legal@veil.app"
        >
          legal@veil.app
        </a>{" "}
        and give us thirty (30) days to attempt to resolve the
        complaint informally before bringing any formal proceeding.
        Most issues we have ever encountered have been resolved
        this way; we read every email and we want to know when
        something has gone wrong.
      </P>

      <H3 id="disputes-arbitration" num="20.2">Arbitration where permitted</H3>
      <P>
        Where the law of your country permits binding arbitration
        of consumer disputes, and you and we both agree in writing
        that a particular dispute will be resolved that way, the
        arbitration shall take place under the rules of a
        well-known, neutral arbitral institution selected jointly
        by the parties, in English, before a single arbitrator,
        with each party bearing its own costs.
      </P>
      <P>
        Where the law of your country does not permit binding
        arbitration of consumer disputes — including, without
        limitation, in many EU Member States — this clause does
        not apply and the dispute shall be resolved in the courts
        identified in §19.
      </P>

      <H3 id="disputes-class" num="20.3">No class actions</H3>
      <P>
        To the maximum extent permitted by applicable law, you and
        we each agree to bring any dispute arising under these
        Terms only in your or our individual capacity, and not as
        a plaintiff or class member in any purported class,
        consolidated, or representative action. Where the law of
        your jurisdiction prohibits a waiver of the right to bring
        a class action, this clause does not apply to you and you
        retain that right.
      </P>

      <H3 id="disputes-consumer" num="20.4">Mandatory consumer protections</H3>
      <P>
        Nothing in this §20 limits any right a consumer has under
        the mandatory consumer-protection law of their country,
        including the right to bring proceedings before the
        courts of that country, the right to invoke any out-of-
        court complaint and redress mechanism (such as the
        European Commission's online dispute resolution platform
        at <code>ec.europa.eu/consumers/odr</code>), or any other
        non-waivable right.
      </P>
      <Plain>
        If you have a problem, talk to us first. If we cannot fix
        it together, the courts of the country in which you live
        usually remain available to you.
      </Plain>
    </>
  );
}

function ExportSection() {
  return (
    <>
      <H2 id="us-export" num="21">Export controls &amp; sanctions</H2>
      <P>
        The Service may be subject to export-control laws of the
        United States, the European Union, and other
        jurisdictions. By using the Service you represent that:
      </P>
      <UL>
        <li>
          You are not located in a country that is subject to a
          comprehensive embargo by the United States, the United
          Kingdom, or the European Union, where the use of the
          Service would breach that embargo.
        </li>
        <li>
          You are not listed on any list of individuals or entities
          subject to financial sanctions, including the U.S.
          Treasury Department's List of Specially Designated
          Nationals, the U.K. Consolidated List, or the EU
          Consolidated List.
        </li>
        <li>
          You will not use the Service in connection with the
          development, production, use, or stockpiling of
          weapons of mass destruction or any activity prohibited
          by applicable export-control law.
        </li>
      </UL>
    </>
  );
}

function UsGovSection() {
  return (
    <>
      <H2 id="us-government" num="22">U.S. government end-users</H2>
      <P>
        If you are using the Service on behalf of the United
        States government, the Service constitutes "commercial
        computer software" and "commercial computer software
        documentation" within the meaning of the Federal
        Acquisition Regulation (FAR) §12.212 and Defense Federal
        Acquisition Regulation Supplement (DFARS) §227.7202. You
        are licensed to use the Service only with those rights
        identified in these Terms; no rights are granted in excess
        of, or different from, those granted to a commercial
        end-user.
      </P>
    </>
  );
}

function ModificationsSection() {
  return (
    <>
      <H2 id="modifications" num="23">Modifications to these Terms</H2>
      <P>
        We may update these Terms from time to time. When we do,
        we will:
      </P>
      <UL>
        <li>
          Update the "Last updated" date at the top of the page
          and publish a new version number.
        </li>
        <li>
          Maintain a complete, append-only changelog of past
          versions, accessible from this page.
        </li>
        <li>
          For any change that materially expands your obligations
          or materially reduces your rights, give you at least
          thirty (30) days' advance notice — by in-app banner, by
          email, or both — and, where applicable consumer law
          requires it, ask for fresh acceptance before the change
          takes effect.
        </li>
      </UL>
      <P>
        Continued use of the Service after a non-material update
        constitutes acceptance of the updated Terms. If you do
        not agree to a material change, you may terminate your
        account before the change takes effect, in which case the
        change will not apply to you.
      </P>
    </>
  );
}

function GeneralSection() {
  return (
    <>
      <H2 id="general" num="24">General provisions</H2>
      <UL>
        <li>
          <strong>Entire agreement.</strong> These Terms, together
          with the documents they incorporate by reference,
          constitute the entire agreement between you and us in
          relation to the Service and supersede all prior
          agreements and understandings, whether oral or written.
        </li>
        <li>
          <strong>Severability.</strong> If any provision of these
          Terms is found by a court of competent jurisdiction to
          be invalid, illegal, or unenforceable, that provision
          shall be enforced to the maximum extent permissible and
          the remaining provisions of these Terms shall continue
          in full force and effect.
        </li>
        <li>
          <strong>Waiver.</strong> Our failure to exercise or
          enforce any right or provision of these Terms shall not
          constitute a waiver of that right or provision.
        </li>
        <li>
          <strong>Assignment.</strong> You may not assign or
          transfer your rights or obligations under these Terms
          without our prior written consent. We may assign or
          transfer our rights and obligations under these Terms
          to an affiliate or in connection with a merger,
          acquisition, or sale of assets, on the conditions set
          out in §7.3 of the Privacy Policy.
        </li>
        <li>
          <strong>No third-party beneficiaries.</strong> These
          Terms do not confer any rights on any person who is not
          a party to them, except as expressly stated in §17
          (Indemnification).
        </li>
        <li>
          <strong>Notices.</strong> Notices to you may be given by
          email, by in-app message, or by posting on the public
          VeilChat website. Notices to us must be sent to{" "}
          <a
            className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
            href="mailto:legal@veil.app"
          >
            legal@veil.app
          </a>{" "}
          and are effective on receipt.
        </li>
        <li>
          <strong>Headings.</strong> The headings in these Terms
          are for convenience only and do not affect the
          interpretation of any provision.
        </li>
        <li>
          <strong>Language.</strong> The English-language version
          of these Terms is the authoritative version. Where we
          publish a translation, it is provided for convenience
          only and the English version controls in the event of
          any inconsistency.
        </li>
      </UL>
    </>
  );
}

function ContactSection() {
  return (
    <>
      <H2 id="contact" num="25">Contact</H2>
      <P>
        Questions about these Terms? Write to{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:legal@veil.app"
        >
          legal@veil.app
        </a>
        . Privacy questions go to{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:privacy@veil.app"
        >
          privacy@veil.app
        </a>{" "}
        and security disclosures to{" "}
        <a
          className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline"
          href="mailto:security@veil.app"
        >
          security@veil.app
        </a>
        . We read every message and reply personally.
      </P>
    </>
  );
}

function GlossarySection() {
  return (
    <>
      <H2 id="glossary" num="26">Glossary of terms used in this document</H2>
      <UL>
        <li>
          <strong>Affiliate.</strong> An entity that controls, is
          controlled by, or is under common control with another
          entity.
        </li>
        <li>
          <strong>Applicable law.</strong> Any law, regulation,
          rule, code, order, or judgment of any governmental or
          regulatory authority that applies to a party or to the
          Service.
        </li>
        <li>
          <strong>Consumer.</strong> An individual who is acting
          for purposes that are wholly or mainly outside their
          trade, business, craft, or profession.
        </li>
        <li>
          <strong>End-to-end encryption (E2EE).</strong> A scheme
          in which only the sending and receiving devices hold the
          keys necessary to decrypt the data, and intermediaries
          (including the service operator) cannot read it.
        </li>
        <li>
          <strong>Force majeure event.</strong> An event beyond a
          party's reasonable control, as further described in §18.
        </li>
        <li>
          <strong>Including.</strong> Means "including, without
          limitation"; does not limit the generality of any
          preceding words.
        </li>
        <li>
          <strong>You / your.</strong> The person, organisation,
          or entity that uses the Service.
        </li>
      </UL>
      <Box tone="neutral" title="Final word">
        We will work hard to keep these Terms short, accurate, and
        readable. If we ever fail at any of those three things,
        write to us and tell us — that is the kind of feedback we
        most want.
      </Box>
    </>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function TermsFooter() {
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
