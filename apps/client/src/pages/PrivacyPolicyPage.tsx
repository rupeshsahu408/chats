import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useDocumentMeta } from "../lib/useDocumentMeta";

/**
 * VeilChat — Privacy Policy.
 *
 * Long-form, comprehensive privacy policy that mirrors the warm
 * cream / forest-green visual language of the public LandingPage.
 *
 * Self-contained on purpose: no app shell, no auth dependency, no
 * tRPC. The page must be reachable for completely logged-out
 * visitors who arrive via the "Privacy Policy" link in the footer.
 *
 * Reading-rule convention
 * ───────────────────────
 * Sections are numbered (1, 1.1, 1.2 …) so external documents and
 * regulator correspondence can cite a stable address such as
 * "VeilChat Privacy Policy §6.3 — Push notifications". Every clause
 * that refers to a specific data category, processor, or right ends
 * with a short plain-English summary in italics so non-lawyers can
 * skim the document and still understand what we mean.
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
  { id: "who-we-are", num: "1", title: "Who we are & how to reach us" },
  { id: "scope", num: "2", title: "Scope & applicability of this policy" },
  {
    id: "what-we-collect",
    num: "3",
    title: "Information we collect",
    children: [
      { id: "account-data", num: "3.1", title: "Account & identity data" },
      { id: "auth-data", num: "3.2", title: "Authentication & device-binding data" },
      { id: "message-data", num: "3.3", title: "Messages, attachments & call signalling" },
      { id: "metadata", num: "3.4", title: "Routing metadata & operational logs" },
      { id: "discovery", num: "3.5", title: "Discovery, contacts & social graph" },
      { id: "device-info", num: "3.6", title: "Device, browser & network information" },
      { id: "support-data", num: "3.7", title: "Support & in-app feedback" },
      { id: "do-not-collect", num: "3.8", title: "Information we deliberately do not collect" },
    ],
  },
  {
    id: "encryption",
    num: "4",
    title: "End-to-end encryption — what it actually means",
    children: [
      { id: "primitives", num: "4.1", title: "Cryptographic primitives we use" },
      { id: "keys", num: "4.2", title: "Where the keys live" },
      { id: "ratchet", num: "4.3", title: "Forward secrecy & post-compromise security" },
      { id: "verification", num: "4.4", title: "Safety numbers & out-of-band verification" },
    ],
  },
  {
    id: "use",
    num: "5",
    title: "How we use the information we hold",
  },
  {
    id: "legal-bases",
    num: "6",
    title: "Legal bases on which we rely (GDPR / UK GDPR)",
  },
  {
    id: "sharing",
    num: "7",
    title: "How we share information",
    children: [
      { id: "subprocessors", num: "7.1", title: "Sub-processors & infrastructure providers" },
      { id: "law-enforcement", num: "7.2", title: "Government & law-enforcement requests" },
      { id: "business-transfers", num: "7.3", title: "Mergers, acquisitions & insolvency" },
      { id: "no-sale", num: "7.4", title: "We do not sell or rent personal data" },
    ],
  },
  { id: "transfers", num: "8", title: "International data transfers" },
  { id: "retention", num: "9", title: "How long we keep information" },
  {
    id: "rights",
    num: "10",
    title: "Your privacy rights",
    children: [
      { id: "rights-eea", num: "10.1", title: "European Economic Area & United Kingdom (GDPR / UK GDPR)" },
      { id: "rights-california", num: "10.2", title: "California (CCPA / CPRA)" },
      { id: "rights-india", num: "10.3", title: "India (Digital Personal Data Protection Act, 2023)" },
      { id: "rights-other", num: "10.4", title: "Other jurisdictions" },
      { id: "rights-how", num: "10.5", title: "How to exercise your rights" },
    ],
  },
  { id: "children", num: "11", title: "Children's privacy" },
  { id: "security", num: "12", title: "Security of processing" },
  { id: "breach", num: "13", title: "Data-breach notification" },
  { id: "cookies", num: "14", title: "Cookies, local storage & on-device caches" },
  { id: "push", num: "15", title: "Push notifications" },
  { id: "links", num: "16", title: "Links to third-party content" },
  { id: "ads", num: "17", title: "No advertising, no tracking, no profiling" },
  { id: "automated", num: "18", title: "Automated decision-making & profiling" },
  { id: "changes", num: "19", title: "Changes to this Privacy Policy" },
  { id: "supervisory", num: "20", title: "Supervisory authorities & complaints" },
  { id: "glossary", num: "21", title: "Glossary of terms used in this policy" },
];

export function PrivacyPolicyPage() {
  // The browser tab title is set explicitly so the policy is easy to
  // identify in a tab strip and shows up cleanly in shared previews.
  useDocumentMeta({
    title: "Privacy Policy · VeilChat",
    description:
      "VeilChat's privacy policy: what we collect (almost nothing), how we protect it, who we share it with, and the rights you can exercise.",
    canonical: "/privacy-policy",
    ogType: "article",
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
      <PolicyNav />
      <PolicyHero />
      <PolicyBody />
      <PolicyFooter />
    </div>
  );
}

/* ───────────────────────── Navigation ───────────────────────── */

function PolicyNav() {
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

function PolicyHero() {
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
          <LockMini />
          Legal · Privacy
        </div>
        <h1
          className="mt-6 text-[40px] sm:text-[52px] md:text-[60px] font-semibold tracking-[-0.025em] leading-[1.05] text-[#253D2C]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          The VeilChat{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            Privacy Policy.
          </span>
        </h1>
        <p className="mt-6 text-[16px] sm:text-[18px] text-[#3C5A47] leading-[1.6] max-w-2xl mx-auto">
          A long, deliberate, plain-English description of every single
          piece of information VeilChat ("we", "us") collects, why we
          collect it, who we share it with, how long we keep it, and
          the rights you have over it. We wrote it the way we wanted to
          read it ourselves: no euphemisms, no hidden carve-outs, no
          "we may" weasel words.
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

function LockMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/* ───────────────────────── Body ───────────────────────── */

function PolicyBody() {
  // Build a flat list of all section ids so the active-section
  // highlight in the table-of-contents knows what's currently in
  // view. Memoised so we don't reflatten on every render.
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
        // Pick the topmost intersecting section. The threshold is
        // small enough that we still update for sections shorter
        // than the viewport.
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
          {/* TOC ─ desktop only, sticky sidebar */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
              <TableOfContents activeId={activeId} />
            </div>
          </aside>

          {/* Main policy text */}
          <article className="lg:col-span-8 xl:col-span-9 max-w-3xl">
            <SummarySection />
            <WhoWeAreSection />
            <ScopeSection />
            <WhatWeCollectSection />
            <EncryptionSection />
            <HowWeUseSection />
            <LegalBasesSection />
            <SharingSection />
            <TransfersSection />
            <RetentionSection />
            <RightsSection />
            <ChildrenSection />
            <SecuritySection />
            <BreachSection />
            <CookiesSection />
            <PushSection />
            <LinksSection />
            <AdsSection />
            <AutomatedSection />
            <ChangesSection />
            <SupervisorySection />
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
        Privacy policies are notorious for being long enough that no
        one reads them and vague enough that no one understands them.
        We chose to make ours long but precise, then to put the
        important conclusions up front so anyone in a hurry can leave
        within thirty seconds with an honest picture of what we do.
      </P>
      <UL>
        <li>
          <strong>Your messages are end-to-end encrypted.</strong>{" "}
          The server stores the ciphertext and routes it to your
          recipients' devices. We hold no key that can decrypt it,
          and there is no "back door" we can be compelled to use.
        </li>
        <li>
          <strong>We do see metadata.</strong> To deliver a message
          we must know which account is sending it to which account
          and at what time. We are honest about that, we minimise
          what we keep, and we delete it as soon as we can.
        </li>
        <li>
          <strong>You don't need to give us a phone number.</strong>{" "}
          You can sign up with an email address, a phone number, or a
          random ID that has no link to anything else about you.
        </li>
        <li>
          <strong>We do not sell your data, run ads, or build a
          profile of you.</strong> There are no analytics SDKs, no
          third-party trackers, no advertising identifiers, and no
          behavioural scoring of any kind anywhere in VeilChat.
        </li>
        <li>
          <strong>Your private keys never leave your device.</strong>{" "}
          They are derived from your recovery phrase and are stored
          only in your browser's encrypted storage. Loss of the
          recovery phrase means even we cannot recover your messages
          — and that is a feature.
        </li>
        <li>
          <strong>You can delete everything.</strong> Closing your
          account permanently deletes your account record, your
          public keys, your prekeys, your contacts, and any
          undelivered ciphertext within fourteen days, with no
          tombstone retention beyond what the law requires.
        </li>
        <li>
          <strong>You can complain.</strong> If you live in the
          European Economic Area, the United Kingdom, California,
          India, Brazil, or any of a growing list of jurisdictions,
          you have specific rights described in §10 below — and you
          may always lodge a complaint with your local supervisory
          authority listed in §20.
        </li>
      </UL>
      <Box tone="good" title="Bottom line">
        VeilChat exists so two people can have a private conversation
        without a third party watching. Everything that follows is the
        long-form, mechanical explanation of how we keep that
        promise.
      </Box>
    </>
  );
}

function WhoWeAreSection() {
  return (
    <>
      <H2 id="who-we-are" num="1">Who we are &amp; how to reach us</H2>
      <P>
        VeilChat is an end-to-end encrypted messenger operated by the
        VeilChat project ("VeilChat", "we", "us", "our"). VeilChat
        consists of a web client (delivered through a content
        delivery network from <code>chats-client-vert.vercel.app</code>{" "}
        and any future custom domain we may serve it from) and a
        small set of routing services (currently reachable at{" "}
        <code>chats-fk6e.onrender.com</code>) that exist solely to
        carry encrypted envelopes between the people you choose to
        talk to.
      </P>
      <P>
        For all questions about this Privacy Policy, requests to
        exercise your rights, or notices that you believe we are not
        complying with applicable data-protection law, you can
        contact us at <a className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline" href="mailto:privacy@veil.app">privacy@veil.app</a>.
        Press, security researchers, and law-enforcement agencies are
        directed to the dedicated channels listed in §7.2 and §20
        respectively.
      </P>
      <Plain>
        We are a small project. There is one human-readable email
        address. We answer it personally and we will not bury you in
        ticket numbers.
      </Plain>
    </>
  );
}

function ScopeSection() {
  return (
    <>
      <H2 id="scope" num="2">Scope &amp; applicability of this policy</H2>
      <P>
        This Privacy Policy describes how we process personal data
        when you use the VeilChat web client, install it as a
        Progressive Web App on your phone or desktop, or interact
        with the publicly visible marketing pages we serve from the
        same domain. It applies to every person who visits the site,
        whether or not you create an account, and whether or not you
        are signed in at the time.
      </P>
      <P>
        This policy <strong>does not</strong> apply to the personal
        data of people you message through VeilChat. Once you send a
        message, the contents of that message and the metadata
        associated with it are also processed by your recipient's
        device (and, depending on their setup, by their device's
        operating system, browser, or any backup software they have
        chosen to enable). The recipient is the controller for what
        happens to the message after it has been delivered to them,
        and we encourage everyone to think carefully about who they
        share sensitive information with.
      </P>
      <P>
        Where this policy says we process information "on your
        behalf" or "as your processor", we mean it in the strict
        legal sense: we are acting under your instructions, the data
        belongs to you, and we will follow your erasure or rectifi­
        cation requests promptly. Where we process information for
        our own purposes — for example, to keep the service running
        or to comply with the law — we are the controller of that
        processing and the rights and obligations described in this
        policy apply directly to us.
      </P>
      <Plain>
        Everything written here applies to anyone who lands on
        VeilChat. Your message contents end up on your friend's
        phone, too, and we have no control over what their phone
        does with them after that.
      </Plain>
    </>
  );
}

function WhatWeCollectSection() {
  return (
    <>
      <H2 id="what-we-collect" num="3">Information we collect</H2>
      <P>
        VeilChat tries hard to know as little about you as
        physically possible. The sections below list the only
        categories of personal data that ever touch our systems,
        grouped by what they are used for. The single source of
        truth for the underlying database fields is
        <code> apps/server/src/db/schema.ts </code>
        in our public source code; this policy will be updated
        before any new field is added.
      </P>

      <H3 id="account-data" num="3.1">Account &amp; identity data</H3>
      <P>
        When you create an account we store, at minimum:
      </P>
      <UL>
        <li>
          A <strong>username</strong> (a public handle you pick, e.g.
          <code> @yourname </code>). Required so other people can add
          you. Visible to anyone who looks you up.
        </li>
        <li>
          Your <strong>public identity keys</strong> (an Ed25519
          signing key and an X25519 key-exchange key). These are
          mathematically derived from a secret only you possess and
          are required so that someone starting a new conversation
          with you can verify they are talking to you.
        </li>
        <li>
          Optionally, a <strong>display name</strong>, a{" "}
          <strong>short bio</strong>, and a <strong>profile photo</strong>{" "}
          if you choose to set them. You can clear any of them at any
          time.
        </li>
        <li>
          The <strong>account-creation timestamp</strong> and a{" "}
          <strong>last-seen timestamp</strong>. The last-seen
          timestamp respects the privacy setting you choose (everyone
          / contacts only / nobody) and may be omitted from API
          responses entirely.
        </li>
      </UL>
      <P>
        If you sign up using an email address or phone number, we do
        not store the address itself in clear text. Instead we keep
        an HMAC fingerprint computed with a server-side secret. That
        is enough for us to confirm "this is the same address you
        used before" when you sign in again or recover your account,
        but it is not enough for an attacker who steals our database
        to reconstruct the original address.
      </P>
      <P>
        If you sign up with a random ID, no contact information is
        ever attached to your account. The cost of that choice is
        that there is no "forgot password" flow we can offer you;
        recovery depends entirely on your possession of the recovery
        phrase generated when you signed up.
      </P>
      <Plain>
        We need to know who you say you are so other people can find
        you. If you give us an email or a phone number, we hash it.
        If you give us nothing, we don't ask twice.
      </Plain>

      <H3 id="auth-data" num="3.2">Authentication &amp; device-binding data</H3>
      <P>
        To keep your sessions secure, the server stores a small
        amount of authentication state:
      </P>
      <UL>
        <li>
          A salted, memory-hard password hash (Argon2id) if you set
          a password. We never receive or store the password itself,
          and an attacker who steals our database still has to break
          Argon2id to recover anything.
        </li>
        <li>
          One row per active session, containing a refresh-token
          identifier, the session-creation time, the most recent
          activity time, an opaque per-session secret used to bind
          push notifications to the right device, and an
          approximate location label derived from the IP address (in
          the form of a country and city, never a precise GPS fix)
          so we can show you a meaningful sign-in activity log.
        </li>
        <li>
          Optionally, one or more WebAuthn / FIDO2 passkey
          credentials if you have registered them. We store only the
          public key and the credential ID, not the private key
          (which never leaves your security key or your device's
          secure enclave).
        </li>
        <li>
          Short-lived one-time codes you receive by email or SMS for
          verification purposes. These are deleted as soon as they
          are used or expire.
        </li>
      </UL>
      <Plain>
        We keep just enough to tell logged-in you apart from a
        stranger, and we let you see and revoke every active session
        from Settings.
      </Plain>

      <H3 id="message-data" num="3.3">Messages, attachments &amp; call signalling</H3>
      <P>
        Your messages, your reactions to messages, your voice notes,
        your photos and your video calls are end-to-end encrypted on
        your device before they are uploaded to the server. The
        server therefore stores:
      </P>
      <UL>
        <li>
          For each message: an opaque <strong>ciphertext blob</strong>{" "}
          (AES-256-GCM authenticated encryption), an{" "}
          <strong>encrypted ratchet header</strong> describing the
          Signal-protocol counters and ephemeral key needed to decrypt
          the message, and the routing metadata described in §3.4.
        </li>
        <li>
          For each attachment: the attachment is encrypted on your
          device with a fresh symmetric key, the ciphertext is
          uploaded to object storage as an opaque blob, and the
          decryption key travels inside the encrypted message
          envelope. The server records only the blob's identifier,
          its size in bytes, the mime hint chosen by the uploader,
          the owner's user ID, and the time at which the blob will
          expire (default 24 hours after upload).
        </li>
        <li>
          For each call: short-lived signalling messages (offer,
          answer, ICE candidates) routed between the two endpoints.
          Where we cannot establish a direct peer-to-peer connection,
          we route the encrypted media through a TURN relay; the
          relay sees the IP addresses of both endpoints but, because
          the media is end-to-end encrypted, it cannot inspect the
          audio or video stream itself.
        </li>
      </UL>
      <Box tone="good" title="What we never see">
        We never see message text, attachment contents, link
        previews, voice-note audio, video-call media, group names,
        group descriptions, or even your read-receipt timestamps in a
        form we can interpret. Everything in that list is either
        encrypted with a key we do not hold or computed and rendered
        only on your device.
      </Box>

      <H3 id="metadata" num="3.4">Routing metadata &amp; operational logs</H3>
      <P>
        To deliver a message we have to know who is sending it to
        whom, and we have to keep just enough of an operational log
        to debug outages and to investigate abuse. Specifically, the
        server stores:
      </P>
      <UL>
        <li>
          The sender and recipient user IDs of each message envelope
          and the conversation identifier they belong to.
        </li>
        <li>
          The timestamps at which the envelope was created, delivered
          to the recipient's device, and (if the recipient has read
          receipts enabled) read.
        </li>
        <li>
          The expiry timestamp at which the envelope will be hard-
          deleted from the database. For ordinary messages this is
          the moment delivery is acknowledged plus a small grace
          window; for messages with disappearing-message mode
          enabled, it is the time you chose.
        </li>
        <li>
          A short-lived request log (HTTP method, response code, IP
          address, user-agent) kept for at most fourteen days for
          security monitoring and rate-limit enforcement. We do not
          retain this log in long-term storage and we do not feed it
          into any analytics pipeline.
        </li>
      </UL>
      <Box tone="warn" title="An honest caveat about metadata">
        End-to-end encryption protects the contents of your
        conversations. It does not, on its own, hide who you are
        talking to or when. We minimise the metadata we keep and we
        delete it as soon as we can, but a court order that compelled
        us to disclose the recipient list of a particular account
        would, in principle, be technically enforceable on the small
        amount we still hold. Where the law allows, we tell affected
        users; see §7.2 and §20.
      </Box>

      <H3 id="discovery" num="3.5">Discovery, contacts &amp; social graph</H3>
      <P>
        VeilChat lets you find and add other people in two ways: by
        searching for their public username, or by exchanging an
        invite link or QR code that you generated. We do not upload
        your phone book, scan your inbox, or import your existing
        social graph from any other service. Specifically:
      </P>
      <UL>
        <li>
          The <strong>connection list</strong> stored on the server
          contains, for each accepted contact, just the two user IDs
          and the time the connection was accepted. This is the
          minimum necessary to enforce the rule that strangers
          cannot message you.
        </li>
        <li>
          <strong>Invite tokens</strong> you generate are random,
          short-lived strings. They expire automatically and become
          invalid the moment they are redeemed.
        </li>
        <li>
          When you scan another user's QR code we run a contact
          discovery exchange that reveals the existence of an account
          with that public key, and nothing else.
        </li>
        <li>
          The optional discovery profile (the page reachable from
          <code> /discover </code>) is opt-in, and you can clear it
          at any time. While it is enabled, the public username, the
          display name, the bio, and any badges you have chosen to
          display are visible to other VeilChat users.
        </li>
      </UL>
      <Plain>
        We do not import your address book, ever. If two people end
        up connected on VeilChat, it is because at least one of them
        deliberately took an action to make that happen.
      </Plain>

      <H3 id="device-info" num="3.6">Device, browser &amp; network information</H3>
      <P>
        When your browser talks to our servers it necessarily
        discloses certain technical information that is part of the
        underlying internet protocols. We treat this information as
        the bare minimum required to deliver the service:
      </P>
      <UL>
        <li>
          The IP address from which a request originates. We use it
          to enforce rate limits, to power the approximate-location
          label in your sign-in activity list, and to detect abusive
          patterns. Raw IP addresses are not retained beyond the
          short-lived request log described in §3.4.
        </li>
        <li>
          The User-Agent string sent by your browser. We use it to
          serve a slightly different style sheet to very small
          screens and to flag unusual sign-ins ("a sign-in from a
          browser you have never used before").
        </li>
        <li>
          Service-worker registration and PWA install state, kept
          locally in your browser only. We never read this back from
          our servers.
        </li>
      </UL>
      <Plain>
        Standard internet plumbing: the bits browsers send anyway. We
        do not fingerprint canvas, fonts, audio, or any of the other
        creepier signals that ad-tech relies on.
      </Plain>

      <H3 id="support-data" num="3.7">Support &amp; in-app feedback</H3>
      <P>
        If you write to us at <code>support@veil.app</code>, fill in
        an in-app feedback form, or report another user for abuse,
        we will receive whatever you choose to send us — typically
        a description of the problem, your username, and any logs or
        screenshots you decide to attach. We use this information
        only to investigate and respond to your report. We delete
        the email and any attached logs once the matter is resolved
        or, at the latest, after twelve months.
      </P>
      <Plain>
        If you tell us something, we keep it long enough to help you,
        then we delete it.
      </Plain>

      <H3 id="do-not-collect" num="3.8">Information we deliberately do not collect</H3>
      <P>
        We have explicitly designed the system <em>not</em> to
        collect a long list of categories that other messengers
        treat as routine. To make this concrete, none of the
        following ever exist on our servers, in our databases, in
        our logs, or in our backups:
      </P>
      <UL>
        <li>
          The plaintext body of any message, ever, under any
          circumstance.
        </li>
        <li>
          A copy of your address book, contact list, calendar, or
          any other data exported from your device.
        </li>
        <li>
          Advertising identifiers (IDFA, GAID), behavioural
          profiles, look-alike audiences, or any data that we share
          with advertising networks.
        </li>
        <li>
          Third-party analytics SDKs (Google Analytics, Mixpanel,
          Amplitude, Segment, Heap, Hotjar, FullStory, etc.). The
          marketing pages of VeilChat ship without any of them.
        </li>
        <li>
          Browser fingerprinting beyond the User-Agent string
          described above (no canvas hashing, no font enumeration,
          no audio-context fingerprinting, no WebGL probes).
        </li>
        <li>
          Any biometric data. Where biometric authentication is
          available on your device, the comparison happens in your
          device's secure enclave; the server only sees a yes/no
          result attested by the operating system.
        </li>
        <li>
          A long-term tombstone of accounts you have deleted. After
          the deletion grace period described in §9, the account
          row, all associated keys, all undelivered ciphertext, and
          all linked sessions are gone.
        </li>
      </UL>
      <Box tone="good" title="In one sentence">
        If a category of data is not listed in §3.1 to §3.7, we do
        not have it.
      </Box>
    </>
  );
}

function EncryptionSection() {
  return (
    <>
      <H2 id="encryption" num="4">End-to-end encryption — what it actually means</H2>
      <P>
        End-to-end encryption is more than a marketing slogan; it is
        the entire reason the rest of this Privacy Policy is short
        and boring. Because the contents of your conversations are
        encrypted with keys that exist only on your device and your
        recipient's device, we are mathematically unable to read,
        scan, classify, or hand over those contents. The sub-sections
        below describe the cryptographic machinery that backs that
        promise so anyone with the relevant background can audit it
        independently.
      </P>

      <H3 id="primitives" num="4.1">Cryptographic primitives we use</H3>
      <UL>
        <li>
          <strong>Identity keys</strong>: Curve25519 (X25519 for
          key exchange, Ed25519 for signatures).
        </li>
        <li>
          <strong>Per-message encryption</strong>: AES-256 in GCM
          mode for authenticated encryption, with keys derived per
          message from the Double-Ratchet construction.
        </li>
        <li>
          <strong>Key agreement</strong>: X3DH (Extended Triple
          Diffie–Hellman) at session start, then a Double Ratchet
          for ongoing message keys.
        </li>
        <li>
          <strong>Key derivation</strong>: HKDF-SHA256 throughout.
        </li>
        <li>
          <strong>Password derivation</strong> (only used for the
          local PIN that wraps the on-device key store): Argon2id
          with conservative memory and iteration parameters.
        </li>
        <li>
          <strong>Random number generation</strong>:
          <code> crypto.getRandomValues </code>provided by your
          browser, which in modern browsers is sourced from the
          operating system's CSPRNG.
        </li>
      </UL>

      <H3 id="keys" num="4.2">Where the keys live</H3>
      <P>
        Every private key VeilChat uses to decrypt your data lives
        only on your device. Specifically:
      </P>
      <UL>
        <li>
          Your <strong>identity private key</strong> is derived from
          a 24-word recovery phrase generated at sign-up. The
          recovery phrase is shown to you exactly once and is never
          transmitted to our servers.
        </li>
        <li>
          The recovery phrase, the identity private key, and the
          message-database key are stored in your browser's
          IndexedDB, wrapped with an Argon2id-derived key bound to
          the local PIN you set when you first unlocked the app on
          this device.
        </li>
        <li>
          Per-conversation symmetric keys ("ratchet state") are
          derived on the fly during message exchange, used for one
          message each, and then discarded.
        </li>
      </UL>

      <H3 id="ratchet" num="4.3">Forward secrecy &amp; post-compromise security</H3>
      <P>
        The Double Ratchet construction provides two important
        properties beyond simple end-to-end encryption:
      </P>
      <UL>
        <li>
          <strong>Forward secrecy.</strong> If your device is
          compromised today, an attacker who later obtains a copy
          of yesterday's encrypted messages still cannot decrypt
          them, because the key material needed to do so was
          deleted as soon as the messages were processed.
        </li>
        <li>
          <strong>Post-compromise security.</strong> If a key is
          ever leaked, the very next message you exchange with that
          conversation partner ratchets the state forward into a
          new, unrelated key tree. The attacker is locked out
          again as soon as you send (or receive) one more message.
        </li>
      </UL>

      <H3 id="verification" num="4.4">Safety numbers &amp; out-of-band verification</H3>
      <P>
        Each conversation has a "safety number" derived from both
        participants' public identity keys. You can compare safety
        numbers in person, by reading them aloud, or by scanning a
        QR code, and you should do so for any conversation where it
        matters that no one — including us, including a future,
        compromised version of us — is in a position to substitute
        a fake key in the middle of the conversation.
      </P>
      <Plain>
        The maths means we cannot read your messages even if we
        wanted to, and the safety-number check lets you verify, with
        certainty, that no third party has wedged itself between you
        and the person you think you are talking to.
      </Plain>
    </>
  );
}

function HowWeUseSection() {
  return (
    <>
      <H2 id="use" num="5">How we use the information we hold</H2>
      <P>
        We use the categories of information described in §3 only
        for the limited purposes listed below. We do not repurpose
        information for goals you would not expect, we do not feed
        it into machine-learning models for anything other than the
        on-device features described in §3.6, and we do not share
        it for marketing purposes with anyone, ever.
      </P>
      <UL>
        <li>
          <strong>To provide the service.</strong> Routing encrypted
          envelopes from senders to recipients, displaying your
          contact list, delivering push notifications, syncing
          settings between your linked devices, and rendering the
          marketing pages.
        </li>
        <li>
          <strong>To keep the service secure.</strong> Detecting and
          blocking abuse, enforcing rate limits, investigating
          credential-stuffing or spam waves, alerting you to a
          sign-in from a new device, and responding to vulnerability
          reports.
        </li>
        <li>
          <strong>To honour your settings.</strong> Applying your
          choices about read receipts, last-seen visibility,
          disappearing messages, profile-photo visibility, and the
          discovery profile.
        </li>
        <li>
          <strong>To answer your support questions</strong> and to
          investigate user reports of abuse.
        </li>
        <li>
          <strong>To comply with the law.</strong> Responding to
          valid legal process, meeting tax and accounting
          obligations on the very small amount of payment data
          related to optional donations, and replying to data-
          protection authorities.
        </li>
        <li>
          <strong>To improve the service.</strong> Where we collect
          aggregate, non-identifying counters (for example, "how
          many sessions ran into a particular error in the last
          hour"), we use them to debug and to plan capacity. We do
          not link those counters to any individual account.
        </li>
      </UL>
      <Plain>
        We use information for the obvious, expected purposes — and
        for nothing else.
      </Plain>
    </>
  );
}

function LegalBasesSection() {
  return (
    <>
      <H2 id="legal-bases" num="6">Legal bases on which we rely (GDPR / UK GDPR)</H2>
      <P>
        For users in the European Economic Area, the United Kingdom,
        and other jurisdictions whose law follows the same model,
        Articles 6 and 9 of the GDPR require us to identify a
        specific legal basis for each act of processing. The bases
        on which we rely are as follows.
      </P>
      <UL>
        <li>
          <strong>Performance of a contract</strong> (Article 6(1)(b)).
          We process your account, authentication, and message-
          routing data because we cannot deliver the messenger
          service to you otherwise. This is the basis for the bulk
          of the processing described in §5.
        </li>
        <li>
          <strong>Legitimate interests</strong> (Article 6(1)(f)).
          We rely on this basis for security monitoring,
          rate-limit enforcement, fraud and abuse detection, and
          maintaining the operational logs described in §3.4. We
          have carried out the balancing test the GDPR requires,
          and we believe these uses are necessary, proportionate,
          and aligned with the privacy-protective design of the
          rest of the product.
        </li>
        <li>
          <strong>Consent</strong> (Article 6(1)(a)). We rely on
          your consent for genuinely optional features — for
          example, the discovery profile, the link-preview
          generator, push notifications, and the use of biometrics
          to unlock the app. Consent can be withdrawn at any time
          from Settings, and withdrawing it does not affect the
          lawfulness of the processing that took place before
          withdrawal.
        </li>
        <li>
          <strong>Compliance with a legal obligation</strong>{" "}
          (Article 6(1)(c)). When we receive a demonstrably valid
          legal request and applicable law requires us to comply,
          we will do so to the limited extent the request requires.
          We push back on overbroad requests; see §7.2.
        </li>
        <li>
          <strong>Vital interests</strong> (Article 6(1)(d)). In the
          unlikely scenario that we hold information that could
          prevent serious physical harm to a person and we are
          legally permitted to share it, we may do so. This basis
          has not yet been used in practice.
        </li>
      </UL>
      <Plain>
        We can defend, point by point, why we hold each piece of
        information we hold and on which line of the law we rely to
        do so.
      </Plain>
    </>
  );
}

function SharingSection() {
  return (
    <>
      <H2 id="sharing" num="7">How we share information</H2>
      <P>
        VeilChat does not sell, rent, lease, lend, swap, or
        otherwise commercially trade personal data with anyone. The
        only categories of recipient that ever receive any of the
        information described in §3 are listed below, and each is
        bound by contract to use it only for the narrow purpose for
        which it was disclosed.
      </P>

      <H3 id="subprocessors" num="7.1">Sub-processors &amp; infrastructure providers</H3>
      <P>
        To run the service we rely on a small number of well-known
        infrastructure providers. They process data on our behalf,
        under written data-processing agreements, and only as
        instructed.
      </P>
      <UL>
        <li>
          <strong>Vercel Inc.</strong> hosts and serves the static
          web client. It receives the IP address and User-Agent
          string of anyone who loads the page, in the course of
          delivering it.
        </li>
        <li>
          <strong>Render Services Inc.</strong> hosts the routing
          and storage backend. It processes the encrypted envelopes,
          the database rows described in §3, and the operational
          logs described in §3.4.
        </li>
        <li>
          <strong>An object-storage provider</strong> (currently
          Cloudflare R2) holds the opaque ciphertext blobs of any
          attachments you send, until they expire and are deleted.
        </li>
        <li>
          <strong>A transactional email provider</strong> sends
          one-time codes, sign-in alerts, and account-recovery
          emails. It receives the destination email address and the
          message body of the email itself.
        </li>
        <li>
          <strong>A push-notification gateway</strong> (currently
          the standard Web Push protocol with the browser-vendor
          push services your browser is configured to use) receives
          the encrypted push payload and the endpoint URL your
          browser issued. The push payload itself contains no
          message text; see §15.
        </li>
        <li>
          <strong>A TURN/STUN relay</strong> may be used to route
          end-to-end encrypted call media when a direct peer-to-peer
          connection cannot be established. It sees the IP
          addresses of the participants but cannot decrypt the
          audio or video.
        </li>
      </UL>
      <P>
        We periodically review this list. Any addition or
        replacement is described in the "changes" log at the bottom
        of this page before it goes live.
      </P>

      <H3 id="law-enforcement" num="7.2">Government &amp; law-enforcement requests</H3>
      <P>
        VeilChat will not disclose information about a user in
        response to an informal request, a phone call, or a polite
        e-mail. We require properly served, jurisdictionally valid
        legal process, and we narrowly construe what we are
        compelled to disclose. When we do disclose anything, we
        disclose only what we are legally required to and nothing
        else.
      </P>
      <P>
        Because of how the service is designed, the maximum a
        court could compel us to produce is:
      </P>
      <UL>
        <li>
          The categories of account, authentication, and metadata
          information described in §3.1, §3.2, and §3.4 for the
          specifically named accounts in the order.
        </li>
        <li>
          The list of conversation identifiers a specifically named
          account currently participates in.
        </li>
        <li>
          Encrypted ciphertext that has not yet been delivered to
          the recipient, which is useless without the recipient's
          private keys.
        </li>
      </UL>
      <P>
        We <strong>cannot</strong> produce the contents of past
        messages, the contents of attachments, the audio or video
        of a call, or anything else that depends on a key we do not
        hold, because we do not hold those keys. No court order can
        compel us to produce information we are mathematically
        unable to access.
      </P>
      <P>
        Where the law allows, we will notify you of a request that
        targets your account before complying, so that you have an
        opportunity to challenge it. Where a gag order or other
        secrecy obligation prevents that, we will notify you as
        soon as the obligation lapses. Aggregate, redacted statistics
        about the requests we receive are published in our annual
        transparency report.
      </P>

      <H3 id="business-transfers" num="7.3">Mergers, acquisitions &amp; insolvency</H3>
      <P>
        If VeilChat is involved in a merger, acquisition, asset
        sale, restructuring, or insolvency proceeding, personal
        data will form part of the assets transferred. We will
        notify you in advance and give you a meaningful opportunity
        to delete your account before the transfer completes; any
        successor entity will be required by contract to honour the
        commitments in this Privacy Policy until at least the
        next major version is published.
      </P>

      <H3 id="no-sale" num="7.4">We do not sell or rent personal data</H3>
      <P>
        We do not sell personal information for monetary
        consideration, we do not "share" personal information for
        cross-context behavioural advertising as those terms are
        defined under the California Consumer Privacy Act, and we
        do not engage in any equivalent practice under any other
        jurisdiction's law. There is therefore no "Do Not Sell or
        Share My Personal Information" link in our footer because
        the answer is permanent and unconditional: we don't.
      </P>
      <Plain>
        The only third parties who touch your data are the people
        we pay to keep the lights on, and even they don't see the
        contents of your messages.
      </Plain>
    </>
  );
}

function TransfersSection() {
  return (
    <>
      <H2 id="transfers" num="8">International data transfers</H2>
      <P>
        VeilChat operates from infrastructure that may be located
        in the United States and in other jurisdictions outside the
        European Economic Area, the United Kingdom, and India.
        Where personal data is transferred from one jurisdiction to
        another, we rely on the following safeguards, in
        descending order of preference:
      </P>
      <UL>
        <li>
          An <strong>adequacy decision</strong> issued by the
          European Commission, the UK government, or the relevant
          authority in your jurisdiction.
        </li>
        <li>
          The <strong>EU Standard Contractual Clauses</strong>{" "}
          (Module Two for controller-to-processor transfers,
          Module Three for processor-to-processor transfers), in
          their most current form, supplemented by the additional
          measures recommended by the European Data Protection
          Board where appropriate.
        </li>
        <li>
          The <strong>UK International Data Transfer Addendum</strong>{" "}
          to the EU Standard Contractual Clauses, where transfers
          originate from the United Kingdom.
        </li>
        <li>
          Specific safeguards required by applicable law, including
          but not limited to the requirements of India's Digital
          Personal Data Protection Act, 2023, and Brazil's LGPD.
        </li>
      </UL>
      <P>
        Because the bulk of the personal data we process is
        end-to-end encrypted before it leaves your device, the
        contents of your conversations are protected against
        compelled disclosure in any jurisdiction by the simple fact
        that the data the foreign authority receives is unintelligible
        ciphertext. The metadata we hold is the area where
        transfer law actually has practical effect, and the
        safeguards above apply to it.
      </P>
      <Plain>
        Your messages travel across borders, but they travel
        encrypted, so the legal regime of the country they pass
        through cannot read them.
      </Plain>
    </>
  );
}

function RetentionSection() {
  return (
    <>
      <H2 id="retention" num="9">How long we keep information</H2>
      <P>
        We retain personal data for the shortest period that is
        compatible with the purposes for which it was collected, as
        described in the table below. After the retention period
        elapses, the data is deleted by hard-delete (not by tombstone
        marker) and is not recoverable from regular backups beyond
        the time it takes for the next backup-rotation cycle to run.
      </P>
      <div className="my-6 overflow-x-auto rounded-2xl border border-[#253D2C]/10 bg-white">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-[#FCF5EB] text-left">
              <Th>Category</Th>
              <Th>Retention</Th>
              <Th>What happens after</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#253D2C]/10">
            <Row c="Message ciphertext (delivered)" r="Up to 7 days, then hard-deleted on a rolling sweep" a="Gone from the database; the recipient's device retains its own decrypted copy" />
            <Row c="Message ciphertext (undelivered)" r="Up to 30 days waiting for the recipient to come online" a="Discarded if still undelivered" />
            <Row c="Disappearing messages" r="Until the timer you chose elapses" a="Hard-deleted on both server and recipient device" />
            <Row c="Attachments (R2 blobs)" r="24 hours by default; up to 7 days for messages still pending delivery" a="Object hard-deleted from storage; database row removed" />
            <Row c="Account record (active)" r="For as long as your account exists" a="Deleted within 14 days of you closing the account" />
            <Row c="Account record (closed)" r="14-day grace period during which you can reopen the account" a="Hard-deleted; user ID is not reused" />
            <Row c="Sessions / refresh tokens" r="Until you sign out, the session expires, or you revoke it" a="Row deleted; the session cannot be re-established" />
            <Row c="Sign-in activity log" r="90 days" a="Hard-deleted from the database" />
            <Row c="Operational HTTP request log" r="14 days" a="Discarded; not retained in long-term storage" />
            <Row c="Support correspondence" r="12 months from last reply" a="Email and any attachments deleted" />
            <Row c="Backups" r="30-day rolling window" a="Old backups overwritten; data referenced only by them is no longer recoverable after the cycle completes" />
          </tbody>
        </table>
      </div>
      <P>
        Where applicable law imposes a longer retention period
        (for example, certain accounting records related to
        donations), we retain only the specific records required by
        that law, and only for the period the law requires.
      </P>
      <Plain>
        We delete things on a schedule. Closing your account empties
        almost everything within two weeks.
      </Plain>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2E6F40] border-b border-[#253D2C]/10">
      {children}
    </th>
  );
}

function Row({ c, r, a }: { c: string; r: string; a: string }) {
  return (
    <tr>
      <td className="px-4 py-3 align-top text-[#253D2C] font-medium">{c}</td>
      <td className="px-4 py-3 align-top text-[#3C5A47]">{r}</td>
      <td className="px-4 py-3 align-top text-[#3C5A47]">{a}</td>
    </tr>
  );
}

function RightsSection() {
  return (
    <>
      <H2 id="rights" num="10">Your privacy rights</H2>
      <P>
        Depending on where you live, you may be entitled to a
        specific bundle of rights over the personal data we hold
        about you. The sub-sections below describe the most common
        such bundles. Whichever applies to you, we treat the
        underlying spirit — your right to know, to control, and to
        leave — as the default for all users worldwide.
      </P>

      <H3 id="rights-eea" num="10.1">European Economic Area &amp; United Kingdom (GDPR / UK GDPR)</H3>
      <UL>
        <li>
          The right of <strong>access</strong> to the personal data
          we hold about you, together with information about how it
          is processed (Article 15).
        </li>
        <li>
          The right to <strong>rectification</strong> of inaccurate
          personal data (Article 16).
        </li>
        <li>
          The right to <strong>erasure</strong> ("the right to be
          forgotten"), subject to limited exceptions (Article 17).
        </li>
        <li>
          The right to <strong>restriction of processing</strong>{" "}
          while a question about the data is being resolved (Article
          18).
        </li>
        <li>
          The right to <strong>data portability</strong>, that is,
          to receive the personal data you have provided in a
          structured, commonly used, machine-readable format
          (Article 20).
        </li>
        <li>
          The right to <strong>object</strong> to processing carried
          out on the basis of legitimate interests (Article 21).
        </li>
        <li>
          The right not to be subject to a decision based solely on
          automated processing that produces legal or similarly
          significant effects (Article 22) — see §18.
        </li>
        <li>
          The right to <strong>withdraw consent</strong> at any
          time where processing is based on consent (Article 7(3)).
        </li>
        <li>
          The right to <strong>lodge a complaint</strong> with a
          supervisory authority — see §20.
        </li>
      </UL>

      <H3 id="rights-california" num="10.2">California (CCPA / CPRA)</H3>
      <UL>
        <li>
          The right to <strong>know</strong> the categories of
          personal information we have collected, the categories of
          sources from which it was collected, the business or
          commercial purposes for which it was collected, and the
          categories of third parties with whom it has been shared.
        </li>
        <li>
          The right to <strong>delete</strong> personal information
          we have collected from you, subject to certain
          exceptions.
        </li>
        <li>
          The right to <strong>correct</strong> inaccurate personal
          information.
        </li>
        <li>
          The right to <strong>limit the use</strong> of sensitive
          personal information. As described in §3, we collect very
          little information that would qualify as "sensitive" under
          the CPRA, and we do not use it for any purpose other than
          providing the service.
        </li>
        <li>
          The right to <strong>opt out of sale and sharing</strong>{" "}
          of personal information. We do not sell or share personal
          information; see §7.4.
        </li>
        <li>
          The right not to receive <strong>discriminatory
          treatment</strong> for exercising any of the above rights.
        </li>
      </UL>

      <H3 id="rights-india" num="10.3">India (Digital Personal Data Protection Act, 2023)</H3>
      <UL>
        <li>
          The right to obtain <strong>a summary of the personal
          data</strong> being processed and the processing
          activities undertaken (§11).
        </li>
        <li>
          The right to <strong>correction, completion, updating,
          and erasure</strong> of personal data (§12).
        </li>
        <li>
          The right to <strong>grievance redressal</strong> through
          the contact point in §1, and the right to escalate to the
          Data Protection Board of India where we have not addressed
          your grievance to your satisfaction (§13).
        </li>
        <li>
          The right to <strong>nominate</strong> another person to
          exercise your rights in the event of your death or
          incapacity (§14).
        </li>
        <li>
          The right, where consent is the basis of processing, to
          <strong> withdraw consent</strong> at any time (§6).
        </li>
      </UL>

      <H3 id="rights-other" num="10.4">Other jurisdictions</H3>
      <P>
        Equivalent rights apply under Brazil's LGPD, Canada's
        PIPEDA, Australia's Privacy Act, South Africa's POPIA, and
        a growing list of US-state laws (Colorado, Virginia,
        Connecticut, Utah, Texas, and others). Where any of these
        laws gives you a right that is not listed above, we extend
        that right to you on the same terms.
      </P>

      <H3 id="rights-how" num="10.5">How to exercise your rights</H3>
      <P>
        For most rights, the answer is built into the product:
      </P>
      <UL>
        <li>
          To <strong>access</strong> the data on your account, open
          Settings → Privacy → Download my data.
        </li>
        <li>
          To <strong>rectify</strong> profile information, edit it
          from Settings → Profile.
        </li>
        <li>
          To <strong>erase</strong> your account, open Settings →
          Account → Delete my account. The grace period in §9
          applies.
        </li>
        <li>
          To <strong>withdraw consent</strong> for an optional
          feature, toggle it off in Settings.
        </li>
      </UL>
      <P>
        For rights that cannot be exercised through the product, or
        for any question about how a request was handled, write to
        <a className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline" href="mailto:privacy@veil.app"> privacy@veil.app</a>.
        We aim to respond within 30 days, in line with the most
        protective applicable deadline. We may ask you to confirm
        information that proves the request comes from you, but we
        will not require any information beyond what is strictly
        necessary for that purpose.
      </P>
      <Plain>
        You can see, download, change, and delete the data we hold
        about you, mostly without ever talking to us, and always
        without having to argue with us.
      </Plain>
    </>
  );
}

function ChildrenSection() {
  return (
    <>
      <H2 id="children" num="11">Children's privacy</H2>
      <P>
        VeilChat is not directed at children under the age of
        thirteen, and in the European Economic Area not directed at
        children under the age of sixteen (or such other age as the
        applicable Member State has set under Article 8 GDPR). We do
        not knowingly collect personal data from such children. If
        we become aware that we have inadvertently done so, we will
        delete the data and close the account.
      </P>
      <P>
        If you believe a child has provided personal data to us,
        please write to <a className="text-[#2E6F40] underline decoration-dotted underline-offset-4 hover:no-underline" href="mailto:privacy@veil.app">privacy@veil.app</a>{" "}
        and we will investigate promptly.
      </P>
    </>
  );
}

function SecuritySection() {
  return (
    <>
      <H2 id="security" num="12">Security of processing</H2>
      <P>
        We implement appropriate technical and organisational
        measures designed to protect personal data against
        accidental or unlawful destruction, loss, alteration,
        unauthorised disclosure of, or access to, personal data
        transmitted, stored or otherwise processed. The principal
        measures are:
      </P>
      <UL>
        <li>
          End-to-end encryption of all message contents, with keys
          held only on user devices.
        </li>
        <li>
          TLS 1.3 (with HTTPS Strict Transport Security and modern
          cipher suites) for every connection between the client
          and our servers.
        </li>
        <li>
          A strict Content Security Policy on every page we serve,
          combined with subresource integrity for all critical
          third-party scripts (currently: none).
        </li>
        <li>
          Server-side rate limiting, brute-force protection, and
          anomaly detection on every authentication endpoint.
        </li>
        <li>
          Argon2id password hashing with conservative cost
          parameters.
        </li>
        <li>
          Periodic third-party security assessments and a
          public-facing responsible-disclosure programme reachable
          at <code>security@veil.app</code>.
        </li>
        <li>
          Principle of least privilege for all engineering access
          to production systems, with audit logging of every
          administrative action.
        </li>
        <li>
          Encryption at rest of the underlying database and object
          storage, on top of (not instead of) the end-to-end
          encryption described in §4.
        </li>
      </UL>
      <P>
        No system can be guaranteed perfectly secure. We commit to
        being transparent about the limits of what we can
        guarantee, and to following the breach-notification
        procedure in §13 if our defences are ever overcome.
      </P>
    </>
  );
}

function BreachSection() {
  return (
    <>
      <H2 id="breach" num="13">Data-breach notification</H2>
      <P>
        If we become aware of a personal data breach that is likely
        to result in a risk to your rights and freedoms, we will:
      </P>
      <UL>
        <li>
          Notify the relevant supervisory authority within 72 hours
          of becoming aware of the breach, in accordance with
          Article 33 GDPR or the equivalent obligation under your
          local law.
        </li>
        <li>
          Notify affected users without undue delay, by email or
          in-app banner, in clear and plain language, including the
          nature of the breach, the categories and approximate
          number of records concerned, the likely consequences, the
          measures we have taken or propose to take to address it,
          and the steps you can take to protect yourself.
        </li>
        <li>
          Publish a public post-mortem at the earliest moment
          consistent with not making the underlying issue easier to
          re-exploit.
        </li>
      </UL>
      <P>
        Because the contents of your messages are end-to-end
        encrypted, even a worst-case compromise of our servers
        would not by itself expose those contents. The
        notification we send you would, however, describe exactly
        what was exposed.
      </P>
    </>
  );
}

function CookiesSection() {
  return (
    <>
      <H2 id="cookies" num="14">Cookies, local storage &amp; on-device caches</H2>
      <P>
        VeilChat uses a small number of strictly necessary cookies
        and a richer set of on-device storage mechanisms to
        function. None of them are used for advertising, none of
        them are shared with third parties, and none of them require
        a consent banner under the ePrivacy Directive because each
        is "strictly necessary" within the meaning of Article 5(3).
      </P>
      <UL>
        <li>
          A long-lived <code>veil_refresh</code> cookie storing your
          refresh token. It is HttpOnly, Secure, and SameSite=Lax.
          You can clear it by signing out.
        </li>
        <li>
          A <code>veil_session_hint</code> cookie used to detect
          which devices are currently signed in to your account so
          we can show you the sign-in activity list.
        </li>
        <li>
          IndexedDB on your device, used to store your encrypted
          identity, your message history (decrypted only on your
          device), and various local preferences.
        </li>
        <li>
          A service worker, registered to provide offline support
          and push notifications. The service worker can be removed
          from your browser's "site settings" panel.
        </li>
      </UL>
      <P>
        Where the service worker caches static assets, it does so
        under your browser's standard Cache Storage API and on the
        same eviction terms as the rest of your browser cache.
      </P>
    </>
  );
}

function PushSection() {
  return (
    <>
      <H2 id="push" num="15">Push notifications</H2>
      <P>
        If you allow VeilChat to send push notifications, we will
        register your device with the Web Push service your
        browser is configured to use (typically operated by the
        browser vendor) and store the endpoint URL it issues. When
        a new message arrives for you we send an encrypted payload
        to that endpoint; the endpoint forwards it to your device,
        which decrypts it locally and shows the notification.
      </P>
      <P>
        The push payload <strong>does not contain the message
        text</strong>. It contains only the conversation identifier
        and a wakeup hint. The actual notification body
        ("New message from Alex") is computed on your device after
        the message itself has been decrypted.
      </P>
      <P>
        You can withdraw permission at any time from your browser's
        site-settings panel, or by toggling the switch in
        Settings → Notifications.
      </P>
    </>
  );
}

function LinksSection() {
  return (
    <>
      <H2 id="links" num="16">Links to third-party content</H2>
      <P>
        VeilChat occasionally links to third-party websites, for
        example our public source-code repository, a security
        researcher's write-up, or a regulator's webpage. We do not
        control those websites and this Privacy Policy does not
        apply to them. We encourage you to read the privacy
        notices of any third-party site you visit through a link
        on VeilChat.
      </P>
      <P>
        Within the messaging product, link previews — if you have
        enabled them — are generated <strong>on your device</strong>{" "}
        before the message is encrypted. The server never sees the
        URL or the preview content. The destination site, however,
        will see your IP address as soon as your device fetches
        its preview.
      </P>
    </>
  );
}

function AdsSection() {
  return (
    <>
      <H2 id="ads" num="17">No advertising, no tracking, no profiling</H2>
      <P>
        We say this in several places throughout this policy and we
        repeat it here in its own section because it is important.
      </P>
      <UL>
        <li>
          VeilChat does not display advertising of any kind, neither
          first-party nor third-party, neither inside the app nor
          on the marketing pages.
        </li>
        <li>
          VeilChat does not collect, generate, infer, or share
          advertising identifiers, behavioural profiles, look-alike
          audiences, conversion events, or anything else that an
          advertising network or a data broker could use.
        </li>
        <li>
          VeilChat does not embed any third-party tracking pixels,
          tag managers, or analytics SDKs.
        </li>
        <li>
          VeilChat will never send you a marketing email or a push
          notification you have not specifically asked for.
        </li>
      </UL>
      <P>
        Should this ever change, we will require fresh, opt-in
        consent before introducing any such mechanism, and we will
        amend this Privacy Policy with prominent notice well in
        advance of any change taking effect.
      </P>
    </>
  );
}

function AutomatedSection() {
  return (
    <>
      <H2 id="automated" num="18">Automated decision-making &amp; profiling</H2>
      <P>
        VeilChat does not subject you to any decision based solely
        on automated processing that produces legal effects
        concerning you or similarly significantly affects you. Where
        we use automated systems at all (for example, our
        rate-limit logic, which decides whether to slow down a
        request that looks like part of a brute-force wave), the
        outcome is reversible by writing to support and is not
        permanent.
      </P>
    </>
  );
}

function ChangesSection() {
  return (
    <>
      <H2 id="changes" num="19">Changes to this Privacy Policy</H2>
      <P>
        We may update this Privacy Policy from time to time. When
        we do, we will:
      </P>
      <UL>
        <li>
          Update the "Last updated" date at the top of the page and
          publish a new version number.
        </li>
        <li>
          Maintain a complete, append-only changelog of past
          versions, accessible from this page.
        </li>
        <li>
          For any change that materially reduces your privacy or
          materially expands the scope of processing, give you at
          least 30 days' advance notice — by in-app banner, by
          email, or both — and, where consent is required, ask for
          fresh consent before the change takes effect.
        </li>
      </UL>
      <P>
        Continued use of the service after a non-material update
        constitutes acceptance of the updated policy.
      </P>
    </>
  );
}

function SupervisorySection() {
  return (
    <>
      <H2 id="supervisory" num="20">Supervisory authorities &amp; complaints</H2>
      <P>
        We would always prefer that you write to us directly first,
        because we read every message and we want the chance to fix
        whatever has gone wrong. If we cannot resolve your concern,
        you may complain to a supervisory authority.
      </P>
      <UL>
        <li>
          <strong>European Economic Area:</strong> the data
          protection authority of the EU member state in which you
          live, work, or where the alleged infringement took place.
        </li>
        <li>
          <strong>United Kingdom:</strong> the Information
          Commissioner's Office (<code>ico.org.uk</code>).
        </li>
        <li>
          <strong>India:</strong> the Data Protection Board of
          India once it is operational; in the meantime, the
          appropriate authority under the Information Technology
          Act, 2000.
        </li>
        <li>
          <strong>Brazil:</strong> the Autoridade Nacional de
          Proteção de Dados (<code>gov.br/anpd</code>).
        </li>
        <li>
          <strong>California:</strong> the California Privacy
          Protection Agency (<code>cppa.ca.gov</code>) and the
          Office of the Attorney General (<code>oag.ca.gov</code>).
        </li>
        <li>
          <strong>Other jurisdictions:</strong> the supervisory
          authority designated by your local law.
        </li>
      </UL>
    </>
  );
}

function GlossarySection() {
  return (
    <>
      <H2 id="glossary" num="21">Glossary of terms used in this policy</H2>
      <UL>
        <li>
          <strong>Personal data.</strong> Any information relating
          to an identified or identifiable natural person.
        </li>
        <li>
          <strong>Processing.</strong> Any operation performed on
          personal data — collection, storage, use, disclosure,
          deletion, and so on.
        </li>
        <li>
          <strong>Controller.</strong> The party that determines
          the purposes and means of the processing of personal
          data.
        </li>
        <li>
          <strong>Processor.</strong> A party that processes
          personal data on behalf of a controller.
        </li>
        <li>
          <strong>End-to-end encryption (E2EE).</strong> A scheme
          in which only the sending and receiving devices hold the
          keys necessary to decrypt the data, and intermediaries
          (including the service operator) cannot read the data
          even with full access to it.
        </li>
        <li>
          <strong>Metadata.</strong> Data about data — for example,
          who is talking to whom and when, as opposed to what they
          are saying.
        </li>
        <li>
          <strong>Sub-processor.</strong> A party engaged by a
          processor to assist in carrying out specific processing
          activities on behalf of the controller.
        </li>
      </UL>
      <Box tone="neutral" title="Final word">
        We will work hard to keep this policy short, accurate, and
        readable. If we ever fail at any of those three things,
        write to us and tell us — that is the kind of feedback we
        most want.
      </Box>
    </>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function PolicyFooter() {
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
          <Link to="/privacy-policy" className="hover:text-white">
            Privacy Policy
          </Link>{" "}
          · <Link to="/" className="hover:text-white">Home</Link>
        </div>
      </div>
    </footer>
  );
}
