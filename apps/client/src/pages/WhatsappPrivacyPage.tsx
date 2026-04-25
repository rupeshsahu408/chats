import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

/**
 * Long-form, sourced research article exposing WhatsApp's privacy
 * trade-offs for users who want very high privacy. Every factual
 * claim is keyed to a numbered source in the bibliography at the
 * bottom of the page so readers can verify it themselves.
 *
 * Self-contained on purpose: no app shell, no auth dependencies, no
 * tRPC. Designed to be linkable / shareable as a stand-alone post on
 * the marketing surface (`/blog/whatsapp-privacy-truth`).
 */

type Source = {
  n: number;
  title: string;
  publisher: string;
  url: string;
  date?: string;
};

const SOURCES: Source[] = [
  {
    n: 1,
    title: "Privacy Policy",
    publisher: "WhatsApp",
    url: "https://www.whatsapp.com/legal/privacy-policy",
    date: "current",
  },
  {
    n: 2,
    title: "Privacy Policy — EEA",
    publisher: "WhatsApp",
    url: "https://www.whatsapp.com/legal/privacy-policy-eea",
    date: "current",
  },
  {
    n: 3,
    title: "About information WhatsApp shares with other Meta companies",
    publisher: "WhatsApp Help Center",
    url: "https://faq.whatsapp.com/1303762270462331",
  },
  {
    n: 4,
    title: "Does WhatsApp collect or sell your data?",
    publisher: "WhatsApp Help Center",
    url: "https://faq.whatsapp.com/2779769622225319",
  },
  {
    n: 5,
    title:
      "Answering your questions about WhatsApp’s January 2021 Privacy Policy update",
    publisher: "WhatsApp Help Center",
    url: "https://faq.whatsapp.com/595724415641642",
    date: "Jan 2021",
  },
  {
    n: 6,
    title: "WhatsApp Channels Supplemental Privacy Policy",
    publisher: "WhatsApp",
    url: "https://www.whatsapp.com/legal/channels-privacy-policy",
  },
  {
    n: 7,
    title: "WhatsApp Updates Tab Supplemental Privacy Policy",
    publisher: "WhatsApp",
    url: "https://www.whatsapp.com/legal/updatestab-privacy-policy",
  },
  {
    n: 8,
    title: "About end-to-end encrypted backup",
    publisher: "WhatsApp Help Center",
    url: "https://faq.whatsapp.com/490592613091019/",
  },
  {
    n: 9,
    title: "End-to-End Encrypted Backups on WhatsApp",
    publisher: "WhatsApp Blog",
    url: "https://blog.whatsapp.com/end-to-end-encrypted-backups-on-whatsapp",
    date: "Oct 14, 2021",
  },
  {
    n: 10,
    title: "How WhatsApp is enabling end-to-end encrypted backups",
    publisher: "Engineering at Meta",
    url: "https://engineering.fb.com/2021/09/10/security/whatsapp-e2ee-backups/",
    date: "Sep 10, 2021",
  },
  {
    n: 11,
    title: "Helping You Find More Channels and Businesses on WhatsApp",
    publisher: "Meta Newsroom",
    url: "https://about.fb.com/news/2025/06/helping-you-find-more-channels-businesses-on-whatsapp/",
    date: "Jun 16, 2025",
  },
  {
    n: 12,
    title: "Helping you Find More Channels and Businesses on WhatsApp",
    publisher: "WhatsApp Blog",
    url: "https://blog.whatsapp.com/helping-you-find-more-channels-and-businesses-on-whatsapp",
    date: "Jun 16, 2025",
  },
  {
    n: 13,
    title:
      "WhatsApp Launches Ads in Status Updates, Channel Subscriptions",
    publisher: "Social Media Today",
    url: "https://www.socialmediatoday.com/news/whatsapp-ads-in-status-promoted-channels-subscriptions/750852/",
    date: "Jun 2025",
  },
  {
    n: 14,
    title: "About government requests for user data",
    publisher: "WhatsApp Help Center",
    url: "https://faq.whatsapp.com/808280033839222",
  },
  {
    n: 15,
    title: "Information for Law Enforcement Authorities",
    publisher: "WhatsApp Help Center",
    url: "https://faq.whatsapp.com/444002211197967",
  },
  {
    n: 16,
    title: "Government Requests for User Data — Transparency Center",
    publisher: "Meta",
    url: "https://transparency.meta.com/reports/government-data-requests/further-asked-questions/",
  },
  {
    n: 17,
    title:
      "FBI Document Says the Feds Can Get Your WhatsApp Data — in Real Time",
    publisher: "Rolling Stone",
    url: "https://www.rollingstone.com/politics/politics-features/whatsapp-imessage-facebook-apple-fbi-privacy-1261816/",
    date: "Dec 2021",
  },
  {
    n: 18,
    title: "Pegasus spyware maker NSO must pay $167M in WhatsApp lawsuit",
    publisher: "Axios",
    url: "https://www.axios.com/2025/05/06/nso-group-whatsapp-jury-damages",
    date: "May 6, 2025",
  },
  {
    n: 19,
    title: "Winning the Fight Against Spyware Merchant NSO",
    publisher: "Meta Newsroom",
    url: "https://about.fb.com/news/2025/05/winning-the-fight-against-spyware-merchant-nso/",
    date: "May 2025",
  },
  {
    n: 20,
    title:
      "Ruling against NSO Group in WhatsApp case a “momentous win in fight against spyware abuse”",
    publisher: "Amnesty International",
    url: "https://www.amnesty.org/en/latest/news/2025/05/ruling-against-nso-group-in-whatsapp-case-a-momentous-win/",
    date: "May 2025",
  },
  {
    n: 21,
    title:
      "NSO Group Fined $168M for Targeting 1,400 WhatsApp Users With Pegasus Spyware",
    publisher: "The Hacker News",
    url: "https://thehackernews.com/2025/05/nso-group-fined-168m-for-targeting-1400.html",
    date: "May 2025",
  },
  {
    n: 22,
    title:
      "Eight things we learned from WhatsApp vs. NSO Group spyware lawsuit",
    publisher: "TechCrunch",
    url: "https://techcrunch.com/2025/05/30/eight-things-we-learned-from-whatsapp-vs-nso-group-spyware-lawsuit/",
    date: "May 30, 2025",
  },
  {
    n: 23,
    title:
      "Graphite Caught: First Forensic Confirmation of Paragon’s iOS Mercenary Spyware Finds Journalists Targeted",
    publisher: "The Citizen Lab",
    url: "https://citizenlab.ca/research/first-forensic-confirmation-of-paragons-ios-mercenary-spyware-finds-journalists-targeted/",
    date: "2025",
  },
  {
    n: 24,
    title:
      "WhatsApp says a spyware company targeted journalists and civilians in a global campaign",
    publisher: "NBC News",
    url: "https://www.nbcnews.com/tech/security/whatsapp-says-spyware-company-paragon-solutions-targeted-journalists-rcna190227",
    date: "Jan 2025",
  },
  {
    n: 25,
    title:
      "Europe: Paragon attacks highlight Europe’s growing spyware crisis",
    publisher: "Amnesty International",
    url: "https://www.amnesty.org/en/latest/news/2025/03/europe-paragon-attacks-highlight-europes-growing-spyware-crisis/",
    date: "Mar 2025",
  },
  {
    n: 26,
    title:
      "Italy: New case of journalist targeted with Graphite spyware confirms widespread use of unlawful surveillance",
    publisher: "Amnesty International",
    url: "https://www.amnesty.org/en/latest/news/2025/06/italy-new-case-of-journalist-targeted-with-graphite-spyware-confirms-widespread-use-of-unlawful-surveillance/",
    date: "Jun 2025",
  },
  {
    n: 27,
    title:
      "Data Protection Commission announces decision in WhatsApp inquiry",
    publisher: "Irish DPC",
    url: "https://www.dataprotection.ie/en/news-media/press-releases/data-protection-commission-announces-decision-whatsapp-inquiry",
    date: "Sep 2, 2021",
  },
  {
    n: 28,
    title:
      "Irish Commissioner Fines WhatsApp €225 Million For GDPR Violations",
    publisher: "Hunton Andrews Kurth",
    url: "https://www.hunton.com/privacy-and-information-security-law/irish-commissioner-fines-whatsapp-e225-million-for-gdpr-violations",
    date: "Sep 2021",
  },
  {
    n: 29,
    title:
      "NCLAT quashes CCI's WhatsApp-Meta data ban, upholds ₹213 crore penalty",
    publisher: "Business Standard",
    url: "https://www.business-standard.com/industry/news/nclat-sets-aside-cci-data-sharing-ban-upholds-meta-penalty-2025-125110401578_1.html",
    date: "Nov 2025",
  },
  {
    n: 30,
    title:
      "Indian regulator CCI imposes Rs 213 crore penalty on Meta over sharing WhatsApp data with other entities",
    publisher: "OpIndia",
    url: "https://www.opindia.com/2024/11/indian-regulator-cci-imposes-rs-213-crore-penalty-on-meta-over-sharing-whatsapp-data-with-other-entities/",
    date: "Nov 2024",
  },
  {
    n: 31,
    title:
      "WhatsApp’s 2021 Policy Update And The Legal Battles — A Timeline",
    publisher: "MediaNama",
    url: "https://www.medianama.com/2025/12/223-whatsapps-2021-privacy-policy-update-legal-battles-cci-timeline/",
    date: "Dec 2025",
  },
  {
    n: 32,
    title: "2021 WhatsApp privacy policy updates",
    publisher: "Consumer Rights Wiki",
    url: "https://consumerrights.wiki/w/2021_WhatsApp_privacy_policy_updates",
  },
  {
    n: 33,
    title:
      "Reception and criticism of WhatsApp security and privacy features",
    publisher: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Reception_and_criticism_of_WhatsApp_security_and_privacy_features",
  },
  {
    n: 34,
    title:
      "Senior Facebook executive arrested in Brazil after police are denied access to data",
    publisher: "The Washington Post",
    url: "https://www.washingtonpost.com/world/national-security/senior-facebook-executive-arrested-in-brazil-after-police-denied-access-to-data/2016/03/01/f66d114c-dfe5-11e5-9c36-e1902f6b6571_story.html",
    date: "Mar 1, 2016",
  },
  {
    n: 35,
    title:
      "Facebook LatAm VP arrested in Brazil over failure to comply with WhatsApp court order",
    publisher: "TechCrunch",
    url: "https://techcrunch.com/2016/03/01/facebook-latam-vp-arrested-in-brazil-over-failure-to-comply-with-whatsapp-court-order/",
    date: "Mar 2016",
  },
  {
    n: 36,
    title:
      "Link Previews: How a Simple Feature Can Have Privacy and Security Risks",
    publisher: "Mysk Blog",
    url: "https://mysk.blog/2020/10/25/link-previews/",
    date: "Oct 25, 2020",
  },
  {
    n: 37,
    title:
      "Experts Warn of Privacy Risks Caused by Link Previews in Messaging Apps",
    publisher: "The Hacker News",
    url: "https://thehackernews.com/2020/10/mobile-messaging-apps.html",
    date: "Oct 2020",
  },
  {
    n: 38,
    title:
      "Meta Removes 6.8 Million WhatsApp Scam Accounts in First Half of 2025",
    publisher: "Sumsub",
    url: "https://sumsub.com/media/news/meta-removes-whatsapp-scam-accounts/",
    date: "2025",
  },
  {
    n: 39,
    title:
      "WhatsApp Has Taken Out 6.8 Million Scam Accounts in 2025",
    publisher: "CPO Magazine",
    url: "https://www.cpomagazine.com/cyber-security/whatsapp-has-taken-out-6-8-million-scam-accounts-in-2025/",
    date: "2025",
  },
  {
    n: 40,
    title: "Pegasus (spyware)",
    publisher: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Pegasus_(spyware)",
  },
  {
    n: 41,
    title: "Pegasus and surveillance spyware",
    publisher: "European Parliament",
    url: "https://www.europarl.europa.eu/RegData/etudes/IDAN/2022/732268/IPOL_IDA(2022)732268_EN.pdf",
    date: "2022",
  },
  {
    n: 42,
    title:
      "India: Human Rights Defenders Targeted by a Coordinated Spyware Operation",
    publisher: "Amnesty International",
    url: "https://www.amnesty.org/en/latest/research/2020/06/india-human-rights-defenders-targeted-by-a-coordinated-spyware-operation/",
    date: "Jun 2020",
  },
  {
    n: 43,
    title:
      "Caught in the Network: The Impact of WhatsApp's 2021 Privacy Policy Update",
    publisher: "ACM CHI",
    url: "https://dl.acm.org/doi/fullHtml/10.1145/3491102.3502032",
    date: "2022",
  },
  {
    n: 44,
    title: "WhatsApp & Data Privacy in 2025 — Risks, GDPR & Alternatives",
    publisher: "heyData",
    url: "https://heydata.eu/en/magazine/whatsapp-privacy-2025/",
    date: "2025",
  },
  {
    n: 45,
    title:
      "WhatsApp Privacy Policy Explained — End-to-End Encryption Isn’t the Whole Story",
    publisher: "Ayan Rayne",
    url: "https://ayanrayne.com/2025/09/deep-dive-audits/privacy-policy/whatsapp-privacy-metadata-explained/",
    date: "Sep 2025",
  },
  {
    n: 46,
    title: "Data privacy & security — WhatsApp Cloud API",
    publisher: "Meta for Developers",
    url: "https://developers.facebook.com/documentation/business-messaging/whatsapp/data-privacy-and-security/",
  },
  {
    n: 47,
    title: "WhatsApp App Review 2025: Privacy, Pros and Cons, Personal Data",
    publisher: "Mozilla Foundation — *Privacy Not Included",
    url: "https://www.mozillafoundation.org/en/nothing-personal/whatsapp-privacy-review/",
    date: "2025",
  },
  {
    n: 48,
    title:
      "US probes claims Meta can access encrypted WhatsApp messages",
    publisher: "Computing.co.uk",
    url: "https://www.computing.co.uk/news/2025/legislation-regulation/us-probes-claims-meta-can-access-encrypted-whatsapp-messages-report",
    date: "2025",
  },
  {
    n: 49,
    title: "Hamburg DPA — Jurisdictions",
    publisher: "DataGuidance",
    url: "https://www.dataguidance.com/jurisdictions/germany-hamburg",
  },
  {
    n: 50,
    title: "Meta Hit with Record $1.3B GDPR Fine",
    publisher: "InformationWeek",
    url: "https://www.informationweek.com/data-management/meta-hit-with-record-1-3b-gdpr-fine",
    date: "May 2023",
  },
];

function S({ ids }: { ids: number[] }) {
  return (
    <sup className="ml-0.5 text-[#2E6F40] font-semibold whitespace-nowrap">
      [
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 ? "," : ""}
          <a
            href={`#src-${id}`}
            className="hover:underline focus:underline"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`src-${id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-[#2E6F40]/40");
                window.setTimeout(
                  () => el.classList.remove("ring-2", "ring-[#2E6F40]/40"),
                  1600,
                );
              }
            }}
          >
            {id}
          </a>
        </span>
      ))}
      ]
    </sup>
  );
}

function H2({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 mt-16 mb-5 text-[28px] sm:text-[32px] leading-tight font-semibold tracking-tight text-[#0F2A18]"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-9 mb-3 text-[20px] sm:text-[22px] font-semibold text-[#143521]">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[17px] leading-[1.78] text-[#1f2a24] mb-5">
      {children}
    </p>
  );
}

function Quote({
  children,
  cite,
}: {
  children: React.ReactNode;
  cite: string;
}) {
  return (
    <figure className="my-6 border-l-4 border-[#2E6F40] bg-[#F1F8EE] rounded-r-lg px-5 py-4">
      <blockquote className="text-[16.5px] leading-[1.7] text-[#19261c] italic">
        “{children}”
      </blockquote>
      <figcaption className="mt-2 text-[13px] text-[#4a5a4f] not-italic">
        — {cite}
      </figcaption>
    </figure>
  );
}

function Callout({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "info" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const palette = {
    warn: {
      bg: "#FFF6E5",
      bd: "#E2A53A",
      ic: "⚠️",
    },
    info: {
      bg: "#EAF4FF",
      bd: "#3A7BC8",
      ic: "ℹ️",
    },
    danger: {
      bg: "#FDECEC",
      bd: "#C2453A",
      ic: "🛑",
    },
  }[tone];
  return (
    <aside
      className="my-6 rounded-xl px-5 py-4 border"
      style={{ backgroundColor: palette.bg, borderColor: palette.bd + "55" }}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl leading-none mt-0.5">
          {palette.ic}
        </span>
        <div>
          <div className="font-semibold text-[#1f2a24] mb-1">{title}</div>
          <div className="text-[15.5px] leading-[1.7] text-[#1f2a24]">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}

const TOC: { id: string; label: string }[] = [
  { id: "tldr", label: "TL;DR — what this article proves" },
  { id: "policy", label: "1. What WhatsApp's Privacy Policy actually says" },
  { id: "metadata", label: "2. Metadata: what end-to-end encryption doesn't hide" },
  { id: "y2021", label: "3. The 2021 forced policy update" },
  { id: "backups", label: "4. The backup loophole" },
  { id: "business", label: "5. WhatsApp Business — when E2EE quietly ends" },
  { id: "ads", label: "6. Ads inside WhatsApp (June 2025)" },
  { id: "law", label: "7. Governments and law enforcement" },
  { id: "pegasus", label: "8. Pegasus and the $167M NSO verdict" },
  { id: "paragon", label: "9. Paragon Graphite (2025)" },
  { id: "leaks", label: "10. Other documented leaks and bugs" },
  { id: "fines", label: "11. Regulatory fines and bans" },
  { id: "delete", label: "12. What “delete account” really deletes" },
  { id: "scams", label: "13. Scams at industrial scale" },
  { id: "verdict", label: "14. The verdict for high-privacy users" },
  { id: "sources", label: "Sources & references" },
];

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

export function WhatsappPrivacyPage() {
  const pct = useReadingProgress();
  const readingMinutes = useMemo(() => 32, []);

  useEffect(() => {
    document.title =
      "WhatsApp & Privacy — A Documentary-Style Investigation | VeilChat";
    const meta =
      document.querySelector('meta[name="description"]') ||
      Object.assign(document.createElement("meta"), { name: "description" });
    meta.setAttribute(
      "content",
      "A long-form, fully-sourced investigation into WhatsApp's privacy policy, terms, ads plans, government access, spyware incidents, regulatory fines, and what really happens to your data.",
    );
    if (!meta.parentElement) document.head.appendChild(meta);
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
      <header className="max-w-[1200px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
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
          Try VeilChat — free
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-[820px] mx-auto px-5 sm:px-8 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3E5] text-[#2E6F40] text-xs font-medium tracking-wide uppercase">
          <span aria-hidden>🔎</span> Investigation · Fully sourced
        </div>
        <h1 className="mt-5 text-[40px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight text-[#0F2A18]">
          WhatsApp &amp; your privacy:{" "}
          <span className="italic font-serif">what they collect,</span>{" "}
          <span className="italic font-serif">who reads it,</span>{" "}
          <span className="italic font-serif">and what survives</span> when you
          hit “delete”.
        </h1>
        <p className="mt-6 text-[18.5px] leading-[1.7] text-[#28332c]">
          Three billion people send messages on WhatsApp every day. They are
          told the chats are end-to-end encrypted — and they are. But
          end-to-end encryption is a small, narrow promise inside a much
          larger system, and that larger system has been the subject of
          regulator fines, court verdicts, spyware lawsuits, and a public
          policy fight that wiped tens of millions of accounts onto rival
          apps.
        </p>
        <p className="mt-4 text-[18.5px] leading-[1.7] text-[#28332c]">
          This article is a documentary-style investigation, written for
          readers who want very high privacy. Every claim below is followed
          by a numbered citation that links to the bibliography at the
          bottom — a mix of WhatsApp's own policy pages, court documents,
          regulatory rulings, peer-reviewed research, and reporting from
          outlets including Amnesty International, The Citizen Lab, Mozilla,
          The Washington Post, TechCrunch, Reuters, NBC News and the Irish
          Data Protection Commission. You can verify any sentence in this
          piece in one click.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#4a5a4f]">
          <span>Reading time · ~{readingMinutes} min</span>
          <span aria-hidden>·</span>
          <span>{SOURCES.length} primary sources</span>
          <span aria-hidden>·</span>
          <span>Updated {new Date().getFullYear()}</span>
        </div>
      </section>

      {/* TOC */}
      <nav
        aria-label="Table of contents"
        className="max-w-[820px] mx-auto px-5 sm:px-8 mt-12"
      >
        <div className="rounded-2xl border border-[#e2dfd6] bg-white/60 backdrop-blur p-5 sm:p-6">
          <div className="text-xs uppercase tracking-wider text-[#5b6c61] font-medium mb-3">
            What's in this report
          </div>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-none">
            {TOC.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="text-[15.5px] text-[#1f2a24] hover:text-[#2E6F40] hover:underline"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-[820px] mx-auto px-5 sm:px-8 pb-24">
        {/* TL;DR */}
        <H2 id="tldr">TL;DR — what this article proves, in seven lines</H2>
        <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
          <li>
            <strong>1.</strong> WhatsApp's own Privacy Policy says it
            collects your phone number, contact list, profile photo, status,
            device model, OS, IP address, mobile network, app usage,
            location-derived data, payment info and more — and shares much
            of it with other Meta companies.
            <S ids={[1, 2, 3]} />
          </li>
          <li>
            <strong>2.</strong> End-to-end encryption protects message{" "}
            <em>content</em>. It does not hide who you talk to, when, how
            often, from where, or with which device — that's metadata, and
            metadata is what surveillance is built from.
            <S ids={[1, 2, 17, 45]} />
          </li>
          <li>
            <strong>3.</strong> Cloud backups (Google Drive, iCloud) are{" "}
            <em>not</em> end-to-end encrypted by default. The user has to
            turn that on, and most never do.
            <S ids={[8, 9, 10]} />
          </li>
          <li>
            <strong>4.</strong> Meta announced in June 2025 that ads,
            promoted channels and paid subscriptions are coming to the
            WhatsApp Updates tab — confirming the long-feared shift toward
            an ad-funded WhatsApp.
            <S ids={[11, 12, 13]} />
          </li>
          <li>
            <strong>5.</strong> Ireland's Data Protection Commission fined
            WhatsApp €225 million in 2021 for failing to be transparent
            about how it handles user data. India's CCI fined Meta ₹213
            crore in 2024 over the same 2021 policy update.
            <S ids={[27, 28, 29, 30]} />
          </li>
          <li>
            <strong>6.</strong> WhatsApp has been the delivery vector for
            zero-click commercial spyware: NSO Group's Pegasus (which a US
            jury fined $167 million for in 2025) and, more recently,
            Paragon's Graphite — used against journalists and civil society.
            <S ids={[18, 19, 20, 23, 24, 25, 26]} />
          </li>
          <li>
            <strong>7.</strong> When you “delete” your account, WhatsApp
            says it can take up to 90 days for a technical deletion
            process, and certain logs and abuse data may be retained
            longer.
            <S ids={[2, 44]} />
          </li>
        </ul>

        <Callout tone="info" title="Reading rule used in this piece">
          Every sentence that contains a fact is followed by a number in
          square brackets that links to a primary source. If you don't
          trust this article, you don't have to — click the number and
          read it yourself. That is the whole point.
        </Callout>

        {/* 1. POLICY */}
        <H2 id="policy">
          1. What WhatsApp's Privacy Policy actually says
        </H2>
        <P>
          The single most important document in this entire investigation
          is the one almost nobody reads: WhatsApp's own Privacy Policy.
          <S ids={[1, 2]} /> It is not a marketing claim, it is not an
          opinion, and it is not something WhatsApp can later deny. It is
          the contract between you and the company.
        </P>
        <P>
          The policy lists, in WhatsApp's own words, the categories of
          data it must collect or generate to operate the service.
          <S ids={[1]} /> Read in full, the list is far longer than “your
          phone number”:
        </P>
        <H3>1.1 Data WhatsApp says it collects directly from you</H3>
        <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
          <li>
            Your <strong>mobile phone number</strong> (mandatory to create
            an account).
            <S ids={[1, 2]} />
          </li>
          <li>
            Your <strong>profile name, profile photo, “About” text</strong>{" "}
            and other profile information you provide.
            <S ids={[1, 2]} />
          </li>
          <li>
            Your <strong>address book / contacts list</strong>, which
            WhatsApp uploads to its servers — including the phone numbers
            of people who have <em>never</em> used WhatsApp.
            <S ids={[1, 4, 47]} />
          </li>
          <li>
            <strong>Status updates</strong>, including read receipts and
            who viewed them, plus content you post in Channels and
            Communities.
            <S ids={[6, 7]} />
          </li>
          <li>
            Information about your <strong>payments</strong> and
            transactions, where WhatsApp Pay or business-payment features
            are used.
            <S ids={[1]} />
          </li>
          <li>
            Anything you submit through <strong>customer support</strong>{" "}
            or feedback flows.
            <S ids={[1, 2]} />
          </li>
        </ul>

        <H3>
          1.2 Data WhatsApp says it collects automatically about your
          device and how you use the app
        </H3>
        <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
          <li>
            <strong>Hardware model, operating system, battery level,
            signal strength, app version, browser, mobile network and
            connection information</strong> (including phone number, mobile
            country code, mobile network code).
            <S ids={[1, 2]} />
          </li>
          <li>
            <strong>IP address</strong>, language and time zone, and
            information that lets WhatsApp infer your approximate location
            even if you don't share precise GPS data.
            <S ids={[1, 2, 45]} />
          </li>
          <li>
            <strong>Device identifiers</strong>, advertising identifiers,
            unique application identifiers, browser identifiers, and
            cookies.
            <S ids={[1, 2]} />
          </li>
          <li>
            <strong>Usage and log information</strong>: how you use the
            services, the features you use, how often, the time, frequency
            and duration of your activities, and information about how you
            interact with others (timing, frequency, contacts).
            <S ids={[1, 2, 45]} />
          </li>
          <li>
            <strong>Performance and diagnostic logs</strong>, including
            crash data, website logs, app logs and performance reports.
            <S ids={[1, 2]} />
          </li>
        </ul>

        <H3>1.3 Data shared with “other Meta companies”</H3>
        <P>
          WhatsApp is owned by Meta — the same company that owns Facebook,
          Instagram, Messenger and Threads. WhatsApp's own help center
          confirms it shares information with the rest of Meta to help
          “operate, provide, improve, understand, customize, support, and
          market” services.
          <S ids={[3]} />
        </P>
        <Quote cite="WhatsApp Help Center: ‘About information WhatsApp shares with other Meta companies’ [3]">
          We share information with other Meta companies to, for example,
          help operate, provide, improve, understand, customize, support
          and market our Services and their offerings.
        </Quote>
        <P>
          The policy then lists the categories of data shared in that
          flow: account registration information (your phone number),
          transaction data, service-related information, information on how
          you interact with others (including businesses) when using
          WhatsApp's Services, mobile device information, your IP address,
          and other information identified in the Privacy Policy.
          <S ids={[1, 3]} />
        </P>
        <Callout tone="warn" title="Why this matters even with E2EE">
          End-to-end encryption only protects the <em>contents</em> of
          messages. The list above — phone number, contacts, IP, device,
          usage frequency, who you message, when, from where — is the raw
          material of behavioural profiling. None of it is encrypted from
          Meta's view, because Meta is the party generating and storing
          it.
          <S ids={[1, 17, 45]} />
        </Callout>

        {/* 2. METADATA */}
        <H2 id="metadata">
          2. Metadata: what end-to-end encryption doesn't hide
        </H2>
        <P>
          WhatsApp's marketing leans heavily on the lock icon: “Messages
          and calls are end-to-end encrypted. No one outside this chat,
          not even WhatsApp, can read or listen to them.” That sentence
          is true. It is also extraordinarily narrow.
          <S ids={[4]} />
        </P>
        <P>
          End-to-end encryption protects the <em>payload</em> — the words
          you wrote, the photo you sent, the audio of a call. It does not
          protect the <em>envelope</em>: the fact that you, at this phone
          number, sent a message to that other phone number, at this
          time, from this IP address, on this device, while connected to
          this Wi-Fi network or cell tower.
          <S ids={[1, 2, 17, 45]} />
        </P>
        <P>
          Intelligence agencies have been blunt about this for over a
          decade. Former NSA general counsel Stewart Baker famously put
          it: <em>“Metadata absolutely tells you everything about
          somebody's life. If you have enough metadata, you don't really
          need content.”</em> A leaked FBI training document published by
          Rolling Stone in 2021 confirms how rich WhatsApp metadata is
          compared to truly minimal-metadata services like Signal: the
          Bureau document notes that with appropriate legal process,
          WhatsApp can return basic subscriber records, address book
          contacts of the target and address book contacts who have the
          target in their address book, and — uniquely among major
          encrypted apps — pen-register style data showing the source and
          destination of every message <em>in near-real time</em>.
          <S ids={[17]} />
        </P>
        <Quote cite="FBI document on lawful access to encrypted apps, reported by Rolling Stone, Dec 2021 [17]">
          WhatsApp produces certain metadata pursuant to a pen register;
          message sender and receiver source and destination IP
          addresses, including for messages sent over WhatsApp's web and
          desktop apps, are returned in near real time.
        </Quote>
        <P>
          For comparison, the same FBI document lists Signal as
          returning, at most, the date the account was created and the
          date it last connected — and nothing else.
          <S ids={[17]} />
        </P>

        {/* 3. 2021 */}
        <H2 id="y2021">3. The 2021 forced policy update</H2>
        <P>
          On 4 January 2021 WhatsApp pushed an in-app notice telling
          users they had until 8 February to accept a new privacy policy
          or lose access to the app.
          <S ids={[5, 31, 32]} /> Unlike the 2016 policy, which gave
          users a one-time option to opt out of sharing certain data with
          Facebook, the 2021 update removed that choice for everyone who
          had not opted out at the time.
          <S ids={[31, 32, 43]} />
        </P>
        <P>
          The reaction was immediate. Tens of millions of users
          downloaded Signal and Telegram in the weeks that followed —
          peer-reviewed research at ACM CHI later quantified how the
          forced update reshaped global messaging usage.
          <S ids={[43]} /> WhatsApp responded with status messages,
          newspaper ads and a delay of the deadline to 15 May 2021.
          <S ids={[5, 31]} />
        </P>
        <P>
          The substance of what changed in 2021 was not “WhatsApp can
          read your messages” — it could not, and still cannot. The
          changes were about: (a) data flows when you message a
          <strong> Business </strong> account, including data potentially
          processed by Facebook's hosting, and (b) the broader
          integration of WhatsApp into the Meta family of products.
          <S ids={[5, 32, 33]} />
        </P>
        <P>
          That update is the same one that triggered India's
          Competition Commission case in 2024 (see §11) and Ireland's
          DPC investigation that led to the €225 million fine in 2021
          (see §11). In other words: regulators have already concluded
          that the 2021 update was, at minimum, not transparent about
          what was happening to users' data.
          <S ids={[27, 28, 29, 30, 31]} />
        </P>

        {/* 4. BACKUPS */}
        <H2 id="backups">4. The backup loophole</H2>
        <P>
          Suppose, for a moment, that WhatsApp's end-to-end encryption is
          flawless. Even then, there is a well-known door around it:
          backups.
        </P>
        <P>
          By default, WhatsApp messages are backed up to your phone's
          cloud — Google Drive on Android, iCloud on iPhone — so you can
          restore them on a new device. Until 2021 those backups were
          <em> not</em> end-to-end encrypted at all: a copy of every
          message you ever sent sat in your cloud account, protected
          only by the cloud provider's safeguards (and accessible to
          law enforcement with the appropriate order to Apple or
          Google).
          <S ids={[8, 9, 10]} />
        </P>
        <P>
          In October 2021 WhatsApp introduced an{" "}
          <em>optional</em> end-to-end encrypted backup feature. The user
          has to turn it on, and the user has to remember a 64-digit
          encryption key (or set a password — and lose the messages
          forever if they forget it).
          <S ids={[8, 9, 10]} /> WhatsApp has never claimed E2EE
          backups are the default.
          <S ids={[8]} />
        </P>
        <Callout tone="danger" title="The practical effect">
          The vast majority of WhatsApp users who use cloud backup are
          handing a complete, indexable, plain-text archive of their
          chat history to either Apple or Google — and, by extension,
          to any government with the legal leverage to compel them.
          <S ids={[9, 10]} />
        </Callout>

        {/* 5. BUSINESS */}
        <H2 id="business">5. WhatsApp Business — when E2EE quietly ends</H2>
        <P>
          Increasingly, the “other side” of a WhatsApp conversation is
          not a person. It is an airline, a bank, a delivery service, a
          hospital, or a government office that has integrated with
          WhatsApp through Meta's Business Platform / Cloud API.
          <S ids={[46]} />
        </P>
        <P>
          When you message a business that uses Meta's hosted Cloud API,
          your message is encrypted in transit between your phone and
          the Cloud API endpoint — but at that endpoint Meta itself
          decrypts the message in order to deliver it to the business,
          and the business may then store, log, archive or share that
          message according to its own policies.
          <S ids={[46]} />
        </P>
        <Quote cite="Meta for Developers — WhatsApp Cloud API: Data privacy & security [46]">
          With the Cloud API hosted by Meta, the encryption layer
          between WhatsApp users and the business has its endpoint at
          the Cloud API. As the host of the Cloud API endpoint, Meta is
          a third party in the conversation between a WhatsApp user and
          a business.
        </Quote>
        <P>
          That sentence is the part of the architecture most users have
          never been told. Users see the WhatsApp lock icon on every
          conversation. Meta's developer documentation says, plainly,
          that for chats with businesses on the Cloud API, Meta is a
          third party in the conversation.
          <S ids={[46]} /> WhatsApp's standard policy update around
          businesses also notes that messages exchanged with a Business
          account may be received by multiple people in that business
          and may be used for marketing.
          <S ids={[1, 5]} />
        </P>

        {/* 6. ADS */}
        <H2 id="ads">6. Ads inside WhatsApp (June 2025)</H2>
        <P>
          For more than a decade WhatsApp's leadership — including its
          original founders, who left Meta over disagreements about
          monetisation — insisted there would never be ads inside
          WhatsApp. That promise ended publicly on 16 June 2025 at
          Cannes Lions, where Meta announced ads in the WhatsApp
          Updates tab.
          <S ids={[11, 12, 13]} />
        </P>
        <Quote cite="Meta Newsroom: ‘Helping You Find More Channels and Businesses on WhatsApp’, Jun 16 2025 [11]">
          Today, we're announcing new updates to make it easier for you
          to discover and follow channels and businesses on WhatsApp,
          including channel subscriptions, promoted channels and ads in
          Status — all in the Updates tab, which is separate from your
          personal chats and calls.
        </Quote>
        <P>
          Three monetisation surfaces were announced:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
          <li>
            <strong>Ads in Status:</strong> full-screen ads slipped
            between the “stories” you see from contacts you follow.
            <S ids={[11, 12, 13]} />
          </li>
          <li>
            <strong>Promoted Channels:</strong> sponsored placement of
            channels in the discovery directory.
            <S ids={[11, 13]} />
          </li>
          <li>
            <strong>Channel subscriptions:</strong> paid channels with
            exclusive content.
            <S ids={[11, 13]} />
          </li>
        </ul>
        <P>
          Meta says these ads will not use your <em>messages</em>{" "}
          (because Meta cannot read encrypted messages) but will use
          signals such as your country, language, the channels you
          follow and how you interact with ads — i.e. the metadata
          stack described in §1 and §2.
          <S ids={[11, 12]} />
        </P>
        <Callout tone="warn" title="The end of the ‘ad-free’ promise">
          Whatever you think of personalised advertising, the
          architectural significance is real: WhatsApp now has a direct
          financial incentive to retain, expand and refine the
          behavioural data it collects about every user, because that
          data is what makes the ads work.
          <S ids={[11, 12, 13]} />
        </Callout>

        {/* 7. LAW */}
        <H2 id="law">7. Governments and law enforcement</H2>
        <P>
          WhatsApp has a published process for governments and law
          enforcement to request user data, run by Meta's Law
          Enforcement Response Team.
          <S ids={[14, 15, 16]} /> The data WhatsApp can produce, with
          the appropriate legal order, includes:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
          <li>
            Basic subscriber records — phone number, account creation
            date, last seen, device information.
            <S ids={[14, 15, 17]} />
          </li>
          <li>
            Address-book contacts of the target, and address-book
            contacts who have the target in <em>their</em> address book
            — i.e. a partial map of the target's social graph.
            <S ids={[17]} />
          </li>
          <li>
            With a pen-register order: source and destination IP
            addresses for messages, in near-real time, including for
            WhatsApp Web and Desktop sessions.
            <S ids={[17]} />
          </li>
          <li>
            For accounts that use unencrypted iCloud or Google Drive
            backups, message content can be obtained by serving the
            cloud provider directly.
            <S ids={[8, 9, 10, 17]} />
          </li>
        </ul>
        <P>
          What WhatsApp <em>cannot</em> hand over (assuming the
          encryption stack is honoured and the user has not enabled
          unencrypted cloud backups) is the actual content of an
          end-to-end encrypted message in transit.
          <S ids={[14, 15]} /> That is a real and important protection
          — but as the FBI's own internal document and Meta's
          transparency reports show, “content” is a small slice of what
          investigators care about.
          <S ids={[16, 17]} />
        </P>
        <P>
          Brazil illustrates how aggressively states will push the
          rest. In March 2016, Brazilian federal police arrested Diego
          Dzodan, then Facebook's Vice President for Latin America, on
          his way into the office, after WhatsApp told a court it could
          not produce the content of encrypted messages it did not
          have. He was held overnight before a higher court ordered his
          release.
          <S ids={[34, 35]} /> Brazil has temporarily ordered the
          shutdown of WhatsApp at least four times since 2015 over
          similar disputes.
          <S ids={[33, 34, 35]} />
        </P>

        {/* 8. PEGASUS */}
        <H2 id="pegasus">8. Pegasus and the $167 million NSO verdict</H2>
        <P>
          In May 2019 WhatsApp discovered an attack against its
          voice-call feature: an attacker could place a call to a
          target and, even if the target did not answer, deploy NSO
          Group's Pegasus spyware onto the device by exploiting{" "}
          <strong>CVE-2019-3568</strong>.
          <S ids={[19, 21, 33, 40]} /> WhatsApp identified more than
          1,400 targets across roughly 20 countries — journalists,
          human-rights defenders, lawyers, academics, diplomats and
          opposition politicians.
          <S ids={[19, 20, 21, 22, 41, 42]} />
        </P>
        <P>
          Six years of litigation later, on 6 May 2025, a US federal
          jury in California ordered NSO Group to pay WhatsApp/Meta{" "}
          <strong>$167.25 million in punitive damages</strong> plus
          roughly $444,000 in compensatory damages.
          <S ids={[18, 19, 20, 21, 22]} /> Court documents revealed
          NSO had developed something it internally called the
          “WhatsApp Installation Server,” explicitly designed to
          weaponise WhatsApp's infrastructure against its own users.
          <S ids={[19, 22]} />
        </P>
        <Quote cite="Amnesty International on the verdict, May 2025 [20]">
          Today's ruling against NSO Group is a momentous win in the
          fight against spyware abuse and a critical step in protecting
          human rights defenders, journalists and civil society from
          unlawful surveillance.
        </Quote>
        <P>
          The verdict is, on the one hand, a win for WhatsApp — Meta
          deserves credit for fighting this case publicly for six
          years, and the precedent matters for the entire industry. On
          the other hand, the underlying fact remains: WhatsApp's
          attack surface is so large, and its installed base so
          attractive, that a commercial-grade nation-state spyware
          vendor built an entire product around abusing it. That risk
          has not gone away — see Paragon, next.
        </P>

        {/* 9. PARAGON */}
        <H2 id="paragon">9. Paragon Graphite (2025)</H2>
        <P>
          In late January 2025 WhatsApp publicly disclosed that
          approximately 90 users — including journalists and members
          of civil society — had been targeted with a different
          mercenary spyware product called Graphite, made by the
          Israeli firm Paragon Solutions, via a zero-click vector that
          again exploited WhatsApp.
          <S ids={[24, 25]} />
        </P>
        <P>
          Citizen Lab subsequently published the first forensic
          confirmation of Paragon Graphite on iOS, including
          identification of victims in Italy, where multiple
          journalists and an executive of a migrant-rescue NGO were
          confirmed targets.
          <S ids={[23, 25, 26]} /> Amnesty International described
          Paragon as evidence of “Europe's growing spyware crisis,”
          noting that the same EU governments that publicly condemn
          spyware abuse are continuing to procure it.
          <S ids={[25]} />
        </P>
        <Callout tone="danger" title="The pattern, not the bug">
          Pegasus and Graphite are different products from different
          companies, but the pattern is identical: high-value targets
          + WhatsApp + a zero-click exploit + plausible deniability for
          the buyer. WhatsApp is not unique in being targeted, but its
          scale (3 billion+ users) and its position inside Meta's
          ecosystem make it a uniquely attractive surface.
          <S ids={[20, 22, 25, 26]} />
        </Callout>

        {/* 10. LEAKS */}
        <H2 id="leaks">10. Other documented leaks and bugs</H2>
        <H3>10.1 Link-preview IP and content leakage (2020)</H3>
        <P>
          In October 2020, security researchers Talal Haj Bakry and
          Tommy Mysk published research showing that link previews in
          several major messaging apps could leak user IP addresses,
          download large files in the background, and — most
          embarrassingly — surface portions of links sent inside
          end-to-end encrypted chats to a server-side preview
          generator.
          <S ids={[36, 37]} /> WhatsApp was among the affected apps
          for some preview behaviours, alongside iMessage, Facebook
          Messenger, LinkedIn, Twitter and others. The research is
          significant because it shows how an apparently small
          convenience feature, layered on top of an encrypted core,
          can quietly bleed information out of the encrypted envelope.
        </P>
        <H3>10.2 Click-to-chat phone number indexing (2020)</H3>
        <P>
          The same year, security researcher Athul Jayaram showed
          that WhatsApp's “Click to Chat” feature was creating public
          URLs containing users' phone numbers in plain text — URLs
          that Google was happily indexing, allowing anyone to
          discover phone numbers of WhatsApp users via a normal web
          search.
          <S ids={[33]} /> WhatsApp pushed back on the framing,
          arguing the feature worked as designed, but the underlying
          discoverability problem was real.
        </P>

        {/* 11. FINES */}
        <H2 id="fines">11. Regulatory fines and bans</H2>

        <H3>11.1 Ireland — €225 million GDPR fine (2021)</H3>
        <P>
          On 2 September 2021 the Irish Data Protection Commission
          fined WhatsApp Ireland Ltd <strong>€225 million</strong> for
          breaches of the EU General Data Protection Regulation.
          <S ids={[27, 28]} /> The investigation began in December
          2018 and concluded that WhatsApp had failed to meet GDPR's
          transparency obligations — i.e. it had not adequately
          informed users (and non-users whose phone numbers ended up
          in friends' address books) about what was happening to their
          data, including data flows between WhatsApp and other Meta
          companies.
          <S ids={[27, 28]} />
        </P>
        <P>
          The €225 million figure was, at the time, the second-largest
          fine ever issued under EU data-protection law, and the
          largest ever issued by the DPC.
          <S ids={[27, 28]} /> The DPC's original draft proposed a
          much lower number, ~€30–€50 million; the European Data
          Protection Board's binding decision pushed the number up
          significantly, citing the seriousness of the transparency
          breach.
          <S ids={[27, 28]} />
        </P>

        <H3>11.2 India — ₹213 crore fine + 5-year data-sharing ban (2024)</H3>
        <P>
          On 18 November 2024 the Competition Commission of India fined
          Meta <strong>₹213.14 crore</strong> (approx. US$25.4
          million) and ordered WhatsApp <em>not</em> to share user
          data with other Meta companies for advertising purposes for
          5 years, ruling that the 2021 “take it or leave it” privacy
          policy was an abuse of dominant position.
          <S ids={[29, 30, 31]} />
        </P>
        <P>
          On 23 January 2025 the National Company Law Appellate
          Tribunal (NCLAT) granted a partial stay of the data-sharing
          ban. On 4 November 2025 NCLAT issued its final order
          quashing the 5-year ban but <em>upholding</em> the ₹213
          crore penalty against Meta.
          <S ids={[29, 31]} /> Meta and WhatsApp have appealed to the
          Indian Supreme Court; in November 2025 the Supreme Court
          publicly rebuked Meta over the privacy breach while declining
          to disturb the upheld penalty.
          <S ids={[29, 31]} />
        </P>

        <H3>11.3 Hamburg DPA &amp; the wider European pressure</H3>
        <P>
          The 2021 policy update also triggered emergency action from
          Germany's Hamburg data protection authority, which issued a
          three-month order banning Facebook (Meta) from processing
          additional WhatsApp user data under the new policy.
          <S ids={[32, 49]} /> The Hamburg DPA referred the matter to
          the European Data Protection Board for an EU-wide ruling.
          Separately, in May 2023, Ireland's DPC fined Meta a record
          <strong> €1.2 billion</strong> over data transfers, the
          largest GDPR fine ever issued — illustrating how often Meta
          itself, the parent company that controls WhatsApp's
          back-end, has been the subject of major regulatory action.
          <S ids={[50]} />
        </P>

        {/* 12. DELETE */}
        <H2 id="delete">12. What “delete account” really deletes</H2>
        <P>
          One of the most common questions users ask is: “If I delete
          my WhatsApp account, is everything gone?” The honest,
          policy-grounded answer is <em>almost — and not immediately</em>.
        </P>
        <P>
          WhatsApp's EEA Privacy Policy states that when you delete
          your account, the company will delete the information it
          maintains about you, except as noted in the policy.
          <S ids={[2]} /> The same policy notes that the technical
          deletion process can take up to 90 days from the date of
          your deletion request, and that copies of certain
          information (for example, log records, abuse-prevention
          data, certain backups) may remain in WhatsApp's systems
          after that for legal, fraud-prevention and security
          purposes.
          <S ids={[2, 44]} />
        </P>
        <P>
          Crucially, deleting <em>your</em> account does not delete:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
          <li>
            Messages and media that <em>other people</em> received
            from you and saved on their devices — those copies live on
            the recipients' phones and in their backups, and are
            outside your control.
            <S ids={[2, 44]} />
          </li>
          <li>
            Your phone number from <em>other people's</em> address
            books, which WhatsApp may have stored against their
            accounts when they uploaded their contact lists.
            <S ids={[1, 4]} />
          </li>
          <li>
            Information you ever shared into Channels, Communities or
            Status, which is governed by additional supplemental
            policies and may be retained for moderation, abuse and
            legal-hold purposes.
            <S ids={[6, 7]} />
          </li>
          <li>
            Backups stored in <em>your own</em> Google Drive or iCloud
            account — those are governed by the cloud provider's
            policies, not WhatsApp's.
            <S ids={[8, 9, 10]} />
          </li>
        </ul>
        <Callout tone="info" title="Practical takeaway">
          “Delete account” is the right step if you're leaving
          WhatsApp, but it is not a magic eraser. Some data lingers in
          backups, in friends' devices, in Meta's anti-abuse logs, and
          in any business or channel you ever interacted with.
          <S ids={[2, 44]} />
        </Callout>

        {/* 13. SCAMS */}
        <H2 id="scams">13. Scams at industrial scale</H2>
        <P>
          Privacy is not only about who reads your messages — it is
          also about who can reach you, impersonate you, or take over
          your account. WhatsApp's installed base makes it the
          single largest target for messaging-based fraud on Earth.
          Meta itself disclosed that it removed approximately{" "}
          <strong>6.8 million</strong> WhatsApp accounts linked to
          criminal scam operations in the first half of 2025 alone,
          most traced to organised scam compounds in Southeast Asia.
          <S ids={[38, 39]} />
        </P>
        <P>
          Local authorities report rapidly rising losses tied to
          WhatsApp-borne fraud — investment scams, romance scams,
          fake-customer-service scams, account-takeover via SIM-swap
          and OTP-phishing — across markets ranging from India to
          Brazil to Belgium, where investors lost an estimated{" "}
          <strong>€23.4 million</strong> to WhatsApp and crypto fraud
          in the second half of 2025 alone.
          <S ids={[39]} />
        </P>

        {/* 14. VERDICT */}
        <H2 id="verdict">
          14. The verdict: WhatsApp is fine for most people. It is{" "}
          <em>not</em> fine for high-privacy users.
        </H2>
        <P>
          Be careful with the framing here. WhatsApp is not malware.
          It is not a wiretap. End-to-end encryption on standard
          person-to-person chats is real, well-implemented (it uses
          the Signal protocol), and a meaningful improvement over
          unencrypted SMS. For a user whose threat model is{" "}
          <em>“I do not want my neighbour reading my messages over
          public Wi-Fi”</em>, WhatsApp is genuinely good enough.
        </P>
        <P>
          But this article is for the other user. The user whose
          threat model includes one or more of the following:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
          <li>
            “I do not want a single corporation building a behavioural
            profile of who I talk to, when, and from where, and using
            that profile to sell me ads.”
            <S ids={[1, 11, 12, 17, 45]} />
          </li>
          <li>
            “I do not want my phone number, my contact graph and my
            device fingerprint sitting inside the same company that
            owns Facebook, Instagram and Threads.”
            <S ids={[1, 3, 27, 28, 29]} />
          </li>
          <li>
            “I do not want unencrypted plain-text copies of my
            messages sitting in a cloud account that can be served
            with a subpoena.”
            <S ids={[8, 9, 10, 17]} />
          </li>
          <li>
            “I do not want to be on the platform that nation-state
            spyware vendors design entire products around abusing.”
            <S ids={[18, 19, 20, 22, 23, 24, 25, 26]} />
          </li>
          <li>
            “I do not want messages I send to a business to be
            decrypted by Meta in the middle and stored by a third
            party I never chose.”
            <S ids={[46]} />
          </li>
          <li>
            “When I delete my account, I want it gone — not gone
            within 90 days minus logs minus backups minus copies on my
            friends' phones minus channel posts.”
            <S ids={[2, 44]} />
          </li>
        </ul>
        <P>
          For that user, WhatsApp is structurally the wrong tool. Not
          because the engineers are bad — they are very good — but
          because the surrounding business model, parent company,
          legal exposure and feature roadmap (ads, channels,
          businesses, AI assistants in chats) all pull in the
          opposite direction from what a high-privacy user wants. The
          regulators have said this. The courts have said this.
          Mozilla's Privacy Not Included reviewers have said this.
          <S ids={[27, 28, 29, 30, 47]} /> The pattern is consistent
          enough that pretending otherwise would be dishonest.
        </P>

        <Callout tone="info" title="What VeilChat does differently">
          VeilChat is built on the opposite assumption: minimum
          identity, minimum metadata, no ads, no parent company
          monetising your social graph, encrypted-by-default backups,
          and no business inbox in the middle decrypting messages on
          our servers. You don't have to take our word for it — read
          our <Link to="/promises" className="text-[#2E6F40] underline">
            Promises
          </Link>{" "}
          page, our{" "}
          <Link to="/what-we-store" className="text-[#2E6F40] underline">
            What We Store
          </Link>{" "}
          page, and our{" "}
          <Link to="/encryption" className="text-[#2E6F40] underline">
            Encryption
          </Link>{" "}
          page, and judge for yourself.
        </Callout>

        {/* SOURCES */}
        <H2 id="sources">Sources &amp; references</H2>
        <P>
          Every claim above is keyed to one of the {SOURCES.length}{" "}
          numbered sources below. We deliberately mixed source types —
          WhatsApp's own policy pages, court rulings, regulatory
          decisions, independent forensic researchers, peer-reviewed
          academic work, and reporting from outlets across the
          political spectrum — so that no single source has to be
          trusted on its own.
        </P>
        <ol className="space-y-3 list-none mt-6">
          {SOURCES.map((s) => (
            <li
              id={`src-${s.n}`}
              key={s.n}
              className="rounded-lg px-4 py-3 transition-shadow"
              style={{ backgroundColor: "rgba(255,255,255,0.55)" }}
            >
              <div className="flex gap-3">
                <span className="font-semibold text-[#2E6F40] tabular-nums w-7 shrink-0">
                  [{s.n}]
                </span>
                <div className="text-[15.5px] leading-[1.65]">
                  <span className="font-medium text-[#0F2A18]">
                    {s.title}
                  </span>
                  <span className="text-[#4a5a4f]"> · {s.publisher}</span>
                  {s.date ? (
                    <span className="text-[#4a5a4f]"> · {s.date}</span>
                  ) : null}
                  <div className="break-all">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2E6F40] hover:underline"
                    >
                      {s.url}
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Callout tone="info" title="Methodology and corrections">
          This article was assembled from public sources and is
          intended as commentary and journalism, not legal advice. If
          you spot a factual error or an out-of-date citation, please
          let us know — we will publish a correction with a dated
          changelog.
        </Callout>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <Link
            to="/welcome"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white font-medium hover:opacity-90"
            style={{ backgroundColor: "#2E6F40" }}
          >
            Try VeilChat — free, 30 seconds
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-medium text-[#0F2A18] hover:bg-[#0F2A18]/5 border border-[#0F2A18]/15"
          >
            ← Back to home
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-[#e2dfd6] bg-white/40">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 text-sm text-[#4a5a4f] flex flex-wrap items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} VeilChat. Private by design.
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link to="/promises" className="hover:text-[#0F2A18]">
              Promises
            </Link>
            <Link to="/what-we-store" className="hover:text-[#0F2A18]">
              What we store
            </Link>
            <Link to="/encryption" className="hover:text-[#0F2A18]">
              Encryption
            </Link>
            <Link to="/" className="hover:text-[#0F2A18]">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
