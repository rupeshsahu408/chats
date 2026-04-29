import {
  BlogLayout,
  Cite,
  H2,
  H3,
  P,
  Callout,
  CompareTable,
  type BlogSource,
  type BlogTocItem,
} from "../components/BlogLayout";
import { useDocumentMeta, SEO_SITE_URL } from "../lib/useDocumentMeta";

const SOURCES: BlogSource[] = [
  { n: 1, title: "Signal Protocol Documentation", publisher: "Signal", url: "https://signal.org/docs/" },
  { n: 2, title: "WhatsApp end-to-end encryption white paper", publisher: "WhatsApp", url: "https://www.whatsapp.com/security/" },
  { n: 3, title: "Messaging Layer Security (MLS) — RFC 9420", publisher: "IETF", url: "https://datatracker.ietf.org/doc/rfc9420/", date: "Jul 2023" },
  { n: 4, title: "Signal Subpoena Response — Eastern Virginia", publisher: "Signal", url: "https://signal.org/bigbrother/eastern-virginia-grand-jury/", date: "Oct 2016" },
  { n: 5, title: "Signal Subpoena Response — Santa Clara County", publisher: "Signal", url: "https://signal.org/bigbrother/santa-clara-county/", date: "Apr 2021" },
  { n: 6, title: "WhatsApp — Information for Law Enforcement Authorities", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/444002211197967" },
  { n: 7, title: "About information WhatsApp shares with other Meta companies", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1303762270462331" },
  { n: 8, title: "Telegram Privacy Policy", publisher: "Telegram", url: "https://telegram.org/privacy" },
  { n: 9, title: "Telegram MTProto 2.0", publisher: "Telegram", url: "https://core.telegram.org/api/end-to-end" },
  { n: 10, title: "Threema Whitepaper", publisher: "Threema", url: "https://threema.ch/press-files/cryptography_whitepaper.pdf" },
  { n: 11, title: "Wire Security Whitepaper", publisher: "Wire", url: "https://wire.com/en/security/" },
  { n: 12, title: "iMessage Security Overview", publisher: "Apple Platform Security", url: "https://support.apple.com/guide/security/imessage-security-overview-secd9764312f/web" },
  { n: 13, title: "iCloud Backups and Messages in iCloud", publisher: "Apple Platform Security", url: "https://support.apple.com/guide/security/icloud-data-security-overview-sec0a319b35f/web" },
  { n: 14, title: "Advanced Data Protection for iCloud", publisher: "Apple Newsroom", url: "https://www.apple.com/newsroom/2022/12/apple-advances-user-security-with-powerful-new-data-protections/", date: "Dec 7, 2022" },
  { n: 15, title: "Signal Foundation 990 Filings", publisher: "ProPublica Nonprofit Explorer", url: "https://projects.propublica.org/nonprofits/organizations/824506840" },
  { n: 16, title: "Signal Sealed Sender", publisher: "Signal Blog", url: "https://signal.org/blog/sealed-sender/", date: "Oct 29, 2018" },
  { n: 17, title: "Signal Private Contact Discovery", publisher: "Signal Blog", url: "https://signal.org/blog/private-contact-discovery/", date: "Sep 26, 2017" },
  { n: 18, title: "EFF Secure Messaging Scorecard (archived)", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/node/82654" },
  { n: 19, title: "FBI Document — Lawful Access to Secure Messaging Apps", publisher: "Property of the People (FOIA)", url: "https://propertyofthepeople.org/document-detail/?doc-id=21114562", date: "Jan 2021" },
  { n: 20, title: "Reproducible Builds project", publisher: "reproducible-builds.org", url: "https://reproducible-builds.org/" },
  { n: 21, title: "Telegram Default Chats Are Not End-to-End Encrypted", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/deeplinks/2018/12/telegrams-encrypted-chats-are-not-default-2018" },
  { n: 22, title: "Pegasus spyware maker NSO must pay $167M in WhatsApp lawsuit", publisher: "Axios", url: "https://www.axios.com/2025/05/06/nso-group-whatsapp-jury-damages", date: "May 6, 2025" },
  { n: 23, title: "Apple Advanced Data Protection — adoption and threat model", publisher: "Apple Platform Security", url: "https://support.apple.com/guide/security/advanced-data-protection-for-icloud-sec973254c5f/web" },
  { n: 24, title: "Session Whitepaper", publisher: "Session", url: "https://getsession.org/whitepaper" },
];

const TOC: BlogTocItem[] = [
  { id: "tldr", label: "TL;DR — the 60-second answer" },
  { id: "what-counts", label: "1. What 'end-to-end encrypted' actually means" },
  { id: "checklist", label: "2. The seven-point buyer's checklist" },
  { id: "metadata", label: "3. The metadata question (the one most people miss)" },
  { id: "identifier", label: "4. Phone number, email, or anonymous ID?" },
  { id: "backup", label: "5. The backup trap" },
  { id: "open-source", label: "6. Open source — necessary, not sufficient" },
  { id: "jurisdiction", label: "7. Jurisdiction and funding model" },
  { id: "comparison", label: "8. Side-by-side: WhatsApp, Signal, iMessage, Telegram, Threema, Wire, Session, VeilChat" },
  { id: "scenarios", label: "9. Pick the right messenger for your situation" },
  { id: "verdict", label: "10. The verdict" },
];

export function HowToChooseEncryptedMessengerPage() {
  const TITLE =
    "How to choose an end-to-end encrypted messenger in 2026";
  const DESC =
    "A practical, source-cited buyer's guide to picking a private messenger in 2026: what 'end-to-end encrypted' actually means, the metadata trap, the backup trap, jurisdiction, and which app fits which threat model.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog/how-to-choose-encrypted-messenger-2026",
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESC,
      image: `${SEO_SITE_URL}/og-image.png`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SEO_SITE_URL}/blog/how-to-choose-encrypted-messenger-2026`,
      },
      author: { "@type": "Organization", name: "VeilChat" },
      publisher: {
        "@type": "Organization",
        name: "VeilChat",
        logo: { "@type": "ImageObject", url: `${SEO_SITE_URL}/icon-512.svg` },
      },
      inLanguage: "en",
      datePublished: "2026-04-29",
      dateModified: "2026-04-29",
      keywords:
        "encrypted messenger, end-to-end encryption, private messaging app, how to choose a messenger, Signal vs WhatsApp, Threema, Wire, iMessage, Session, VeilChat, secure chat 2026",
    },
  });

  return (
    <BlogLayout
      slug="how-to-choose-encrypted-messenger-2026"
      badge="Buyer's guide · 2026"
      title={
        <>
          How to choose an{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            end-to-end encrypted
          </span>{" "}
          messenger in 2026
        </>
      }
      lead={
        <>
          <p>
            Almost every messenger now claims to be "end-to-end encrypted".
            Most aren't lying. Most also aren't telling you the whole story
            — about which chats are encrypted, what metadata they keep,
            who can be subpoenaed for it, and what happens to the
            unencrypted backup that lands in iCloud or Google Drive
            ten minutes after you send the message.
          </p>
          <p>
            This is a practical, source-cited guide to choosing the right
            one for your actual life. No "best app" award. Just a
            seven-point checklist and a real comparison.
          </p>
        </>
      }
      readingMinutes={13}
      toc={TOC}
      sources={SOURCES}
      related={[
        {
          href: "/blog/signal-vs-whatsapp",
          title: "Signal vs WhatsApp — which one is actually private?",
          description:
            "Same encryption protocol. Wildly different surrounding systems.",
        },
        {
          href: "/blog/best-encrypted-messengers-2026",
          title: "The best end-to-end encrypted messengers in 2026",
          description:
            "An independent ranking of the top private messengers — and which to skip.",
        },
        {
          href: "/blog/why-open-source-matters-in-messaging",
          title: "Why open source matters in private messaging",
          description:
            "If you can't read the code, the only thing standing between you and a marketing claim is trust.",
        },
      ]}
    >
      <H2 id="tldr">TL;DR — the 60-second answer</H2>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>If you want the largest network with strong defaults:</strong>{" "}
          WhatsApp encrypts content, but Meta sees a lot of metadata{" "}
          <Cite n={6} /> <Cite n={7} />.
        </li>
        <li>
          <strong>If you want the gold standard for normal users:</strong>{" "}
          Signal — open source, non-profit, almost no metadata <Cite n={4} />{" "}
          <Cite n={16} />.
        </li>
        <li>
          <strong>If you want no phone number at all:</strong> VeilChat,
          Threema, or Session.
        </li>
        <li>
          <strong>If you want zero account on the server:</strong> Session{" "}
          <Cite n={24} />.
        </li>
        <li>
          <strong>If you want polish + privacy at a price:</strong> Threema{" "}
          <Cite n={10} />.
        </li>
        <li>
          <strong>Avoid as a privacy choice:</strong> Telegram by default
          (1-on-1 "Secret Chats" are E2EE; group and cloud chats are not)
          <Cite n={21} />.
        </li>
      </ul>
      <Callout title="A note on certainty">
        Anyone who tells you there's one correct answer for everyone is
        selling something. The correct answer depends on{" "}
        <em>who you're worried about</em>, <em>what you're protecting</em>,
        and <em>who needs to be reachable</em>. The checklist below is
        designed to work that out.
      </Callout>

      <H2 id="what-counts">1. What "end-to-end encrypted" actually means</H2>
      <P>
        End-to-end encryption (E2EE) means your message is encrypted on
        your device, transits the server as opaque ciphertext, and is
        decrypted only on the recipient's device. The server can deliver
        it but cannot read it. That's the strict, useful definition.
      </P>
      <P>
        Three traps to watch for:
      </P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>
          <strong>"Encrypted in transit" ≠ end-to-end.</strong> "Transit"
          encryption (TLS) only protects the hop between you and the
          server. The server can read everything. Most "encrypted" apps
          from the 2010s were transit-only.
        </li>
        <li>
          <strong>Optional E2EE ≠ default E2EE.</strong> Telegram famously
          encrypts only its 1-on-1 "Secret Chats" end-to-end; the default
          chats and groups are server-side encrypted, meaning Telegram
          can read them <Cite n={21} /> <Cite n={9} />.
        </li>
        <li>
          <strong>E2EE on send ≠ E2EE at rest on the recipient's
          backup.</strong> If your friend syncs their WhatsApp messages
          to Google Drive without an encryption key, those messages are
          recoverable by Google — and by Google's lawful-access process.
        </li>
      </ol>

      <H2 id="checklist">2. The seven-point buyer's checklist</H2>
      <P>
        Run a candidate messenger through these seven questions. If it
        scores yes on at least 5 of them, it's a serious choice for most
        people.
      </P>
      <ol className="mt-4 space-y-3 list-decimal list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Is every conversation E2EE by default,</strong> including
          groups and 1-on-1 calls?
        </li>
        <li>
          <strong>Is the protocol public</strong> — and either a
          peer-reviewed standard (Signal Protocol <Cite n={1} />, MLS{" "}
          <Cite n={3} />) or a documented design (MTProto 2.0
          <Cite n={9} />, Threema's whitepaper <Cite n={10} />)?
        </li>
        <li>
          <strong>Is the client open source</strong> so anyone can verify
          the implementation matches the protocol?
        </li>
        <li>
          <strong>Is the server open source</strong> too — not just the
          client? (This is rarer than you'd think.)
        </li>
        <li>
          <strong>What metadata does the server retain</strong>, and for
          how long? Look for short, specific lists rather than "various
          information" hand-waving.
        </li>
        <li>
          <strong>Is there an option to sign up without a phone
          number,</strong> and to encrypt your backup with a key only
          you hold?
        </li>
        <li>
          <strong>What is the funding model</strong>: ads, paid product,
          non-profit, donations? "Free with no ads" usually means the
          payment is data — except in the rare cases where it's a real
          non-profit (Signal <Cite n={15} />) or a small paid app
          (Threema <Cite n={10} />).
        </li>
      </ol>

      <H2 id="metadata">3. The metadata question (the one most people miss)</H2>
      <P>
        Even when content is end-to-end encrypted, the server can still
        learn an enormous amount: who you talked to, when, for how long,
        from which IP, on which device. The 2014 leaked NSA quote — "we
        kill people based on metadata" — was about exactly this.
      </P>
      <P>
        WhatsApp's law-enforcement guide <Cite n={6} /> lists what it can
        provide on demand: account registration info, IP addresses,
        device info, and — via "real-time ping" available 24/7 to law
        enforcement — your "metadata" of who you message and when{" "}
        <Cite n={6} />. Signal's responses to subpoenas, by contrast, are
        famously short: account creation date and last connection date.
        Nothing else, because nothing else exists <Cite n={4} /> <Cite n={5} />.
      </P>
      <P>
        Two specific server-side techniques that minimise metadata:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Sealed Sender</strong> (Signal): the server learns
          <em>who</em> a message is going to, but not <em>who</em> it's
          from <Cite n={16} />.
        </li>
        <li>
          <strong>Private Contact Discovery</strong> (Signal): your
          address book is matched server-side without the server seeing
          which phone numbers you uploaded <Cite n={17} />.
        </li>
      </ul>
      <Callout title="Why this matters in practice">
        Pegasus, Predator and Graphite spyware — and the broader
        targeted-surveillance industry — overwhelmingly trade in
        metadata, not message content. A WhatsApp lawsuit against NSO
        Group resulted in a $167M judgement in 2025 <Cite n={22} />,
        which is the public tip of a much larger ecosystem. A messenger
        that genuinely doesn't <em>have</em> the metadata is structurally
        safer than one that does.
      </Callout>

      <H2 id="identifier">4. Phone number, email, or anonymous ID?</H2>
      <P>
        Your account identifier is the single biggest privacy decision
        most people don't realise they're making.
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Phone number</strong> (WhatsApp, Signal, iMessage,
          Telegram): convenient, social-graph friendly, but ties your
          messenger to your real-world identity. Anyone who has your
          number can find you on the app.
        </li>
        <li>
          <strong>Email</strong> (Wire <Cite n={11} />, optional on
          others): better for separating identities, but still trackable.
        </li>
        <li>
          <strong>Anonymous ID</strong> (Threema, Session, VeilChat):
          your account is a random string only your contacts know.
          Maximum compartmentalisation; you have to share an invite or
          QR code rather than just "find me on WhatsApp".
        </li>
      </ul>

      <H2 id="backup">5. The backup trap</H2>
      <P>
        This is where most people accidentally undo all their privacy
        work. WhatsApp messages are E2EE on the wire; the iCloud or
        Google Drive backup, by default, is not. If your recipient backs
        up to iCloud without enabling{" "}
        <a
          href="https://support.apple.com/guide/security/advanced-data-protection-for-icloud-sec973254c5f/web"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2E6F40] underline"
        >
          Apple's Advanced Data Protection
        </a>
        <Cite n={23} />, the message is recoverable by Apple under a
        warrant. Google Drive backups for WhatsApp, until recently,
        were the same.
      </P>
      <H3>What to look for</H3>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>End-to-end encrypted backups, on by default</strong>{" "}
          (Signal — local-only by default; iMessage with ADP{" "}
          <Cite n={14} /> <Cite n={13} />).
        </li>
        <li>
          <strong>A recovery phrase you control,</strong> not "log in
          with the same SSO that holds the keys".
        </li>
        <li>
          <strong>An option for no cloud backup at all</strong> if your
          threat model demands it.
        </li>
      </ul>

      <H2 id="open-source">6. Open source — necessary, not sufficient</H2>
      <P>
        We've{" "}
        <a
          href="/blog/why-open-source-matters-in-messaging"
          className="text-[#2E6F40] underline"
        >
          written a separate essay
        </a>{" "}
        on why open source is non-negotiable for a messenger. The
        short version:
      </P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>
          Closed source = "trust us we're not reading your messages".
          You can't verify it.
        </li>
        <li>
          Open client = academic and independent researchers can audit
          it (and routinely do).
        </li>
        <li>
          Open server = nobody can quietly run a logging build in
          production.
        </li>
        <li>
          <strong>Reproducible builds</strong> <Cite n={20} /> are the
          next layer: they prove the binary on your phone came from the
          source on GitHub.
        </li>
      </ol>

      <H2 id="jurisdiction">7. Jurisdiction and funding model</H2>
      <P>
        Where the company is incorporated determines who can compel it
        to do what. A short, opinionated guide:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>USA:</strong> strong First Amendment protections for
          publishing, but generous law-enforcement access via subpoena,
          National Security Letter, and FISA. Companies with the
          smallest data footprint (Signal) survive this best.
        </li>
        <li>
          <strong>EU:</strong> GDPR limits collection; pending "Chat
          Control" legislation could force client-side scanning.
        </li>
        <li>
          <strong>Switzerland:</strong> Threema's home — strong privacy
          law, no domestic intelligence-sharing alliances.
        </li>
        <li>
          <strong>Five Eyes signatories</strong> (US, UK, Canada,
          Australia, New Zealand): historically pressure E2EE
          providers to add backdoors; an FBI document leaked in 2021{" "}
          <Cite n={19} /> details exactly what each major messenger
          can hand over.
        </li>
      </ul>
      <P>
        Funding model is a parallel question. Free-and-ad-supported
        means data is the product. Free-and-non-profit (Signal{" "}
        <Cite n={15} />) and paid (Threema, partial-paid Wire) align
        the incentives more cleanly.
      </P>

      <H2 id="comparison">
        8. Side-by-side: WhatsApp, Signal, iMessage, Telegram, Threema,
        Wire, Session, VeilChat
      </H2>
      <CompareTable
        columns={[
          "WhatsApp",
          "Signal",
          "iMessage",
          "Telegram",
          "Threema",
          "Wire",
          "Session",
          "VeilChat",
        ]}
        rows={[
          {
            label: "E2EE by default",
            cells: [
              "Yes",
              "Yes",
              "Yes (Apple↔Apple)",
              "No (Secret Chats only)",
              "Yes",
              "Yes",
              "Yes",
              "Yes",
            ],
          },
          {
            label: "Open source (client)",
            cells: ["No", "Yes", "No", "Partial", "Yes", "Yes", "Yes", "Yes"],
          },
          {
            label: "Open source (server)",
            cells: ["No", "Yes", "No", "No", "No", "Yes", "Yes", "Yes"],
          },
          {
            label: "Phone number required",
            cells: ["Yes", "Yes", "Yes (Apple ID)", "Yes", "No", "No", "No", "No"],
          },
          {
            label: "Sealed sender / minimal metadata",
            cells: [
              "No",
              "Yes",
              "Limited",
              "No",
              "Yes",
              "Partial",
              "Yes",
              "Yes",
            ],
          },
          {
            label: "E2EE backups by default",
            cells: [
              "Off (opt-in)",
              "Local only",
              "Off (opt-in via ADP)",
              "N/A (cloud)",
              "Yes",
              "Yes",
              "Yes",
              "Yes",
            ],
          },
          {
            label: "Funding model",
            cells: [
              "Meta",
              "Non-profit",
              "Apple",
              "VC + premium",
              "Paid app",
              "Paid + free",
              "Token/donation",
              "Donations + paid features",
            ],
          },
        ]}
      />
      <P>
        See our deeper{" "}
        <a
          href="/blog/best-encrypted-messengers-2026"
          className="text-[#2E6F40] underline"
        >
          ranking of the best encrypted messengers in 2026
        </a>{" "}
        for the long-form take on each one.
      </P>

      <H2 id="scenarios">9. Pick the right messenger for your situation</H2>
      <H3>"I just want my friends and family to actually use it."</H3>
      <P>
        WhatsApp wins on network effect in most countries, Signal in
        privacy-aware circles. Both encrypt content end-to-end. Make
        sure backups on both sides are encrypted, and turn on
        disappearing messages by default.
      </P>
      <H3>"I'm a journalist, lawyer, doctor, or activist."</H3>
      <P>
        Use Signal as your daily driver and treat your <em>burner</em>{" "}
        identity (sources, anonymous tips) on a no-phone-number app —
        VeilChat, Threema, or Session. Keep the two graphs strictly
        separate.
      </P>
      <H3>"I'm in a country where messengers get blocked."</H3>
      <P>
        Look for apps with built-in censorship circumvention: Signal's
        TLS-camouflaged proxy, Telegram's MTProto proxies (acknowledging
        the encryption trade-off), or onion-routed alternatives like
        Session <Cite n={24} />.
      </P>
      <H3>"I want privacy without giving up my whole social graph."</H3>
      <P>
        Use a primary E2EE messenger with phone signup (Signal) for
        people who already have your number, and a no-phone messenger
        (VeilChat, Threema) for everyone you'd rather not link to your
        real identity.
      </P>

      <H2 id="verdict">10. The verdict</H2>
      <P>
        There is no single best messenger — there's a best messenger
        <em>for your threat model</em>. But there is a clear set of
        questions to ask, and the apps that score well on most of them
        are Signal, Threema, Wire, Session, and VeilChat.
      </P>
      <P>
        If you want a messenger that's open source end to end, requires
        no phone number, holds essentially no metadata, and is free —
        give{" "}
        <a href="/welcome" className="text-[#2E6F40] underline">
          VeilChat
        </a>{" "}
        a try. If you want the largest privacy-respecting network,
        install{" "}
        <a
          href="https://signal.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2E6F40] underline"
        >
          Signal
        </a>
        . Either way, the worst choice is the one most people make by
        default — staying with whatever messenger came preinstalled and
        hoping for the best.
      </P>
    </BlogLayout>
  );
}
