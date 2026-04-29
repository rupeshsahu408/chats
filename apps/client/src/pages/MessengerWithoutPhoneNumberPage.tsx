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
  { n: 1, title: "Signal Username Beta — phone number privacy", publisher: "Signal Blog", url: "https://signal.org/blog/phone-number-privacy-usernames/", date: "Feb 2024" },
  { n: 2, title: "WhatsApp account creation requires a phone number", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/" },
  { n: 3, title: "Telegram Privacy Policy", publisher: "Telegram", url: "https://telegram.org/privacy" },
  { n: 4, title: "Threema — registration without phone or email", publisher: "Threema", url: "https://threema.ch/en/faq/anon_setup" },
  { n: 5, title: "Threema Whitepaper", publisher: "Threema", url: "https://threema.ch/press-files/cryptography_whitepaper.pdf" },
  { n: 6, title: "Wire — registration with email or phone", publisher: "Wire", url: "https://support.wire.com/" },
  { n: 7, title: "Session — built without phone or email", publisher: "Session", url: "https://getsession.org/" },
  { n: 8, title: "Session Whitepaper", publisher: "Session", url: "https://getsession.org/whitepaper" },
  { n: 9, title: "Briar — peer-to-peer messaging", publisher: "Briar Project", url: "https://briarproject.org/" },
  { n: 10, title: "SimpleX Chat", publisher: "SimpleX", url: "https://simplex.chat/" },
  { n: 11, title: "Cell-Site Simulators / IMSI Catchers", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/pages/cell-site-simulatorsimsi-catchers" },
  { n: 12, title: "Information for Law Enforcement Authorities", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/444002211197967" },
  { n: 13, title: "FBI Document — Lawful Access to Secure Messaging Apps", publisher: "Property of the People (FOIA)", url: "https://propertyofthepeople.org/document-detail/?doc-id=21114562", date: "Jan 2021" },
  { n: 14, title: "Disposable phone numbers / VoIP risks", publisher: "Twilio Trust Hub", url: "https://www.twilio.com/en-us/trust" },
  { n: 15, title: "Pegasus spyware maker NSO must pay $167M in WhatsApp lawsuit", publisher: "Axios", url: "https://www.axios.com/2025/05/06/nso-group-whatsapp-jury-damages", date: "May 6, 2025" },
  { n: 16, title: "BIP-39 — Mnemonic code for generating deterministic keys", publisher: "Bitcoin Improvement Proposal 39", url: "https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki" },
  { n: 17, title: "How victims of intimate-partner violence use technology", publisher: "ACM CHI / Cornell Tech IPV research", url: "https://www.ipvtechresearch.org/" },
  { n: 18, title: "MySudo — disposable identities", publisher: "MySudo", url: "https://mysudo.com/" },
  { n: 19, title: "Ed25519 signature scheme", publisher: "RFC 8032", url: "https://datatracker.ietf.org/doc/html/rfc8032" },
  { n: 20, title: "X25519 key exchange", publisher: "RFC 7748", url: "https://datatracker.ietf.org/doc/html/rfc7748" },
];

const TOC: BlogTocItem[] = [
  { id: "tldr", label: "TL;DR — yes, you can" },
  { id: "why", label: "1. Why a phone number is a privacy problem" },
  { id: "how-id-works", label: "2. How phoneless messengers actually work" },
  { id: "options", label: "3. Your real options in 2026" },
  { id: "veilchat", label: "4. VeilChat — sign up in 30 seconds, no number" },
  { id: "threema", label: "5. Threema — paid, polished, anonymous by default" },
  { id: "session", label: "6. Session — onion-routed, no account" },
  { id: "signal-username", label: "7. Signal usernames — the half-step" },
  { id: "burner-vs-real", label: "8. Burner number vs real phoneless ID" },
  { id: "tradeoffs", label: "9. The trade-offs nobody mentions" },
  { id: "verdict", label: "10. The verdict" },
];

export function MessengerWithoutPhoneNumberPage() {
  const TITLE =
    "How to use a private messenger without a phone number (2026 guide)";
  const DESC =
    "You don't need to give up your phone number to message your friends. A practical, 2026 guide to phoneless messengers — Threema, Session, VeilChat, and how Signal's username feature changes the picture.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog/messenger-without-phone-number",
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESC,
      image: `${SEO_SITE_URL}/og-image.png`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SEO_SITE_URL}/blog/messenger-without-phone-number`,
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
        "messenger without phone number, no phone number messaging app, anonymous messenger, Threema, Session, VeilChat, Signal username, private messaging without SIM",
    },
  });

  return (
    <BlogLayout
      slug="messenger-without-phone-number"
      badge="How-to · 2026"
      title={
        <>
          How to use a{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            private messenger
          </span>{" "}
          without a phone number
        </>
      }
      lead={
        <>
          <p>
            For most of the last decade, "use a private messenger" meant
            "use Signal". And to use Signal, you needed a phone number.
            That's a frustrating loop if your reason for caring about
            privacy is, specifically, not wanting your messenger to be
            tied to your real-world identity.
          </p>
          <p>
            In 2026 you have real options. This is a practical, source-
            cited guide to messengers that work without a phone number
            at all — including how they handle accounts under the hood,
            and where each one fits.
          </p>
        </>
      }
      readingMinutes={11}
      toc={TOC}
      sources={SOURCES}
      related={[
        {
          href: "/blog/how-to-choose-encrypted-messenger-2026",
          title: "How to choose an end-to-end encrypted messenger in 2026",
          description:
            "A practical, source-cited buyer's guide for picking the right messenger.",
        },
        {
          href: "/blog/messenger-metadata-leaks",
          title: "What metadata your messenger leaks",
          description:
            "End-to-end encryption hides content. It does not hide who, when, where, or how often.",
        },
        {
          href: "/blog/why-open-source-matters-in-messaging",
          title: "Why open source matters in private messaging",
          description:
            "If you can't read the code, the only thing standing between you and a marketing claim is trust.",
        },
      ]}
    >
      <H2 id="tldr">TL;DR — yes, you can</H2>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          Three good apps in 2026 require <strong>no phone number, no
          email, no SIM</strong>: Threema (paid) <Cite n={4} />, Session
          (free) <Cite n={7} />, and VeilChat (free).
        </li>
        <li>
          Signal added <strong>usernames</strong> in 2024 <Cite n={1} />:
          you still register with a phone, but you can hide it from
          everyone you talk to.
        </li>
        <li>
          A "burner" VoIP number is a poor substitute for a phoneless
          design — it just moves the metadata problem somewhere else
          <Cite n={14} />.
        </li>
        <li>
          The trade-off: you give up "just look me up by my number".
          You gain compartmentalisation and a much smaller server
          footprint.
        </li>
      </ul>

      <H2 id="why">1. Why a phone number is a privacy problem</H2>
      <P>
        A phone number is the strongest real-world identifier most
        people have. It's tied to a SIM card, registered to a name (or
        a SIM-registration ID where required by law), tracked by your
        carrier, broadcast at the radio layer to nearby IMSI catchers
        <Cite n={11} />, and used as the primary key in basically every
        government and commercial database that has ever known you.
      </P>
      <P>
        When a messenger uses your phone number as your account ID, all
        of that backstops your account. It also means:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          Anyone with your number can find you on the app — wanted or
          unwanted.
        </li>
        <li>
          Subpoenas to your carrier can produce a "messenger
          fingerprint" (when you registered, what device, which IPs
          you've reached the server from). The 2021 leaked FBI table
          <Cite n={13} /> covers exactly this.
        </li>
        <li>
          A SIM-swap attack against your carrier can hijack the
          messenger account.
        </li>
        <li>
          For people in dangerous personal situations — survivors of
          stalking and intimate-partner violence in particular{" "}
          <Cite n={17} /> — a phone-number messenger is essentially
          impossible to use safely.
        </li>
      </ul>

      <H2 id="how-id-works">2. How phoneless messengers actually work</H2>
      <P>
        A messenger doesn't need a phone number. What it needs is a
        stable, unique identifier so it can route messages to you and
        no one else. There are three modern approaches:
      </P>
      <H3>A. Cryptographic identity (random ID)</H3>
      <P>
        The app generates a public/private keypair on your device the
        first time you launch it. Your "account" is your public key
        (typically Ed25519 <Cite n={19} /> for signatures and X25519
        <Cite n={20} /> for key exchange). The server only knows the
        public key — it never has your private one. This is how
        Threema <Cite n={5} />, Session <Cite n={8} />, and VeilChat
        all work.
      </P>
      <H3>B. Recovery phrase (BIP-39 mnemonic)</H3>
      <P>
        To restore the same identity on a new device, you need to bring
        the private key with you. The standard, pulled from the Bitcoin
        world, is a BIP-39 mnemonic phrase <Cite n={16} /> — 12 or 24
        English words that encode the key. Write it down once, store it
        like you'd store a passport.
      </P>
      <H3>C. Optional username layer</H3>
      <P>
        A raw 32-byte public key isn't memorable. So most phoneless
        apps add a username (Signal-style usernames <Cite n={1} />) or
        a discoverable short ID (Threema's 8-character ID) on top, so
        humans have something to share verbally.
      </P>

      <H2 id="options">3. Your real options in 2026</H2>
      <CompareTable
        columns={["Threema", "Session", "VeilChat", "Signal (with username)"]}
        rows={[
          {
            label: "Phone number required",
            cells: ["No", "No", "No", "Yes (hidden)"],
          },
          {
            label: "Email required",
            cells: ["No", "No", "Optional", "No"],
          },
          {
            label: "Cost",
            cells: ["Paid (~$5)", "Free", "Free", "Free"],
          },
          {
            label: "Open source",
            cells: ["Yes", "Yes", "Yes", "Yes"],
          },
          {
            label: "Server holds your account",
            cells: ["Yes", "No (decentralised)", "Yes", "Yes"],
          },
          {
            label: "Network effect",
            cells: ["Small / EU-heavy", "Small", "New / growing", "Massive"],
          },
        ]}
      />

      <H2 id="veilchat">4. VeilChat — sign up in 30 seconds, no number</H2>
      <P>
        VeilChat is built around the principle that nothing the server
        doesn't need to know should ever leave your device. The signup
        flow takes about 30 seconds:
      </P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>Open <a href="/welcome" className="text-[#2E6F40] underline">VeilChat</a> in any browser, or install it as a Progressive Web App.</li>
        <li>Choose "Create a private ID".</li>
        <li>The app generates an Ed25519 + X25519 keypair on your device.</li>
        <li>You get a 12-word recovery phrase. Write it down.</li>
        <li>Pick a display name. That's it.</li>
      </ol>
      <P>
        From the server's point of view, your account is a public key
        and a creation date. There's no number, no email, no SIM. To
        share your account with a friend, you send them an invite link
        or QR code — they tap it and you're connected.
      </P>
      <Callout title="Why a recovery phrase, not a password">
        A password lives in a database the server can be subpoenaed for.
        A recovery phrase lives only on your paper. The server never
        sees it, can't reset it, and can't be compelled to hand it over
        because it doesn't exist on the server.
      </Callout>

      <H2 id="threema">5. Threema — paid, polished, anonymous by default</H2>
      <P>
        Threema was the first mainstream messenger to ship anonymous
        registration as a default <Cite n={4} />. You pay roughly $5
        once, you get an 8-character random ID, and that's your
        identity forever. The cryptography <Cite n={5} /> is standard
        and the apps are well audited.
      </P>
      <P>
        Trade-off: it's small outside Switzerland, Germany and
        Austria, where it has unusually high adoption. Network effect
        is the real cost.
      </P>

      <H2 id="session">6. Session — onion-routed, no account</H2>
      <P>
        Session <Cite n={7} /> goes further: there's no central
        account-holding server at all. Messages route through an
        onion network of community-run nodes, similar to Tor.
        Registration is "tap once to generate a key" <Cite n={8} />.
      </P>
      <P>
        Trade-offs: no real-time voice or video on most platforms, and
        message delivery latency is higher than a centralised
        messenger. For text-only, threat-model-heavy use, it's a serious
        choice.
      </P>

      <H2 id="signal-username">7. Signal usernames — the half-step</H2>
      <P>
        In February 2024, Signal launched usernames in beta{" "}
        <Cite n={1} />. The headline change: you no longer need to share
        your phone number with the people you message. They look you
        up by an opaque username, and your number stays hidden from
        them.
      </P>
      <P>
        Signal still requires a phone number to register the account.
        That number is now invisible to your contacts but it still
        exists on Signal's servers — and on whichever telco issued the
        SIM. It's a meaningful improvement, not a full phoneless flow.
      </P>

      <H2 id="burner-vs-real">8. Burner number vs real phoneless ID</H2>
      <P>
        A common workaround is to register a phone-number messenger
        with a "burner" — a VoIP number from Google Voice, MySudo
        <Cite n={18} />, Twilio <Cite n={14} />, or a prepaid SIM. This
        works for some threat models but not others.
      </P>
      <H3>Where burners help</H3>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>Compartmentalising messenger identity from your real number.</li>
        <li>Avoiding accidental contact-graph linking.</li>
        <li>Protecting against casual stalkers who only know your real number.</li>
      </ul>
      <H3>Where burners don't help</H3>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          The VoIP provider sees everything the carrier would have
          seen, and is generally <em>more</em> subpoena-friendly.
        </li>
        <li>
          The provider's KYC (Know Your Customer) usually links the
          burner to your real identity anyway.
        </li>
        <li>
          The number can be reassigned to someone else if you stop
          paying, recycling your messenger account.
        </li>
      </ul>
      <P>
        For most users, a real phoneless app is a cleaner answer than
        chaining a burner onto a phone-number app.
      </P>

      <H2 id="tradeoffs">9. The trade-offs nobody mentions</H2>
      <P>
        Phoneless apps have real downsides. Worth being honest about:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>No automatic contact discovery.</strong> You have to
          deliberately exchange invites with each person you want to
          talk to.
        </li>
        <li>
          <strong>Smaller social graph.</strong> Your network on
          Threema/Session/VeilChat is the people you've actively added.
          That's a feature for some users; a friction for others.
        </li>
        <li>
          <strong>Recovery is on you.</strong> Lose the recovery phrase,
          lose the account. There's no "click to reset password"
          because there's no password.
        </li>
        <li>
          <strong>Some regulated workflows expect a number.</strong>{" "}
          You may still want a phone-number app for the bank, the
          school WhatsApp group, and the family chat — and a phoneless
          app for everything else.
        </li>
      </ul>

      <H2 id="verdict">10. The verdict</H2>
      <P>
        In 2026, "I want a private messenger but don't want to give it
        my phone number" is a request you can fully satisfy. The three
        cleanest answers are:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong><a href="/welcome" className="text-[#2E6F40] underline">VeilChat</a></strong>{" "}
          — free, open source, 30-second signup, encrypted push, no
          phone or email required.
        </li>
        <li>
          <strong>Threema</strong> — paid, polished, the most mature
          phoneless app on the market.
        </li>
        <li>
          <strong>Session</strong> — for the threat models where even a
          centralised account is too much.
        </li>
      </ul>
      <P>
        If you want the Signal network specifically, turn on{" "}
        <a
          href="https://signal.org/blog/phone-number-privacy-usernames/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2E6F40] underline"
        >
          Signal usernames
        </a>{" "}
        — it's a real improvement, even though it isn't fully phoneless.
      </P>
      <P>
        And if you're only here because the privacy promise of major
        messengers stopped feeling honest after the NSO judgment{" "}
        <Cite n={15} /> and the WhatsApp law-enforcement guide{" "}
        <Cite n={12} /> — you're not alone. The good news is that the
        alternatives have caught up.
      </P>
    </BlogLayout>
  );
}
