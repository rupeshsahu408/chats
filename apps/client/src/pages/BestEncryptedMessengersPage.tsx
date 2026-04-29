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
  { n: 1, title: "Signal Privacy Policy", publisher: "Signal Foundation", url: "https://signal.org/legal/" },
  { n: 2, title: "Signal Subpoena Response — Santa Clara", publisher: "Signal", url: "https://signal.org/bigbrother/santa-clara-county/", date: "Apr 2021" },
  { n: 3, title: "Threema Cryptography Whitepaper", publisher: "Threema GmbH", url: "https://threema.ch/press-files/2_documentation/cryptography_whitepaper.pdf" },
  { n: 4, title: "Threema Privacy Policy", publisher: "Threema GmbH", url: "https://threema.ch/en/privacy" },
  { n: 5, title: "Session Whitepaper", publisher: "Oxen Privacy Tech Foundation", url: "https://getsession.org/whitepaper" },
  { n: 6, title: "Session FAQ — Phone numbers", publisher: "Session", url: "https://getsession.org/faq" },
  { n: 7, title: "SimpleX Chat — A truly private messenger", publisher: "SimpleX", url: "https://simplex.chat/" },
  { n: 8, title: "SimpleX threat model", publisher: "SimpleX", url: "https://simplex.chat/blog/20230301-simplex-message-queue-protocol.html" },
  { n: 9, title: "Briar — Resilient peer-to-peer messaging", publisher: "Briar Project", url: "https://briarproject.org/" },
  { n: 10, title: "Briar Security Audit Report", publisher: "Cure53", url: "https://briarproject.org/news/2017-beta-released-security-audit/" },
  { n: 11, title: "Wire Privacy Policy", publisher: "Wire Swiss GmbH", url: "https://wire.com/en/legal/" },
  { n: 12, title: "Wire Source Code", publisher: "GitHub", url: "https://github.com/wireapp" },
  { n: 13, title: "WhatsApp Privacy Policy", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/privacy-policy" },
  { n: 14, title: "Telegram FAQ — End-to-end encryption", publisher: "Telegram", url: "https://telegram.org/faq#q-how-secure-is-telegram" },
  { n: 15, title: "Telegram Privacy Policy", publisher: "Telegram", url: "https://telegram.org/privacy" },
  { n: 16, title: "iMessage End-to-end encryption", publisher: "Apple Platform Security", url: "https://support.apple.com/guide/security/imessage-security-overview-secd9764312f/web" },
  { n: 17, title: "Apple Advanced Data Protection", publisher: "Apple Support", url: "https://support.apple.com/en-us/HT212520" },
  { n: 18, title: "Signal Protocol Documentation", publisher: "Signal", url: "https://signal.org/docs/" },
  { n: 19, title: "MLS — Messaging Layer Security RFC 9420", publisher: "IETF", url: "https://datatracker.ietf.org/doc/rfc9420/", date: "Jul 2023" },
  { n: 20, title: "Signal Foundation 990 Filings", publisher: "ProPublica Nonprofit Explorer", url: "https://projects.propublica.org/nonprofits/organizations/824506840" },
];

const TOC: BlogTocItem[] = [
  { id: "tldr", label: "TL;DR — the short answer" },
  { id: "criteria", label: "1. How we ranked them" },
  { id: "signal", label: "2. Signal — the gold standard" },
  { id: "veilchat", label: "3. VeilChat — phone-number-free + open source" },
  { id: "threema", label: "4. Threema — the Swiss option" },
  { id: "session", label: "5. Session — no identifiers at all" },
  { id: "simplex", label: "6. SimpleX — no user IDs, period" },
  { id: "briar", label: "7. Briar — peer-to-peer over Tor" },
  { id: "wire", label: "8. Wire — open-source for teams" },
  { id: "imessage", label: "9. iMessage — only if you're all-Apple" },
  { id: "skip", label: "10. The ones to skip (and why)" },
  { id: "comparison", label: "11. Full comparison table" },
  { id: "verdict", label: "12. Our recommendation" },
];

export function BestEncryptedMessengersPage() {
  const TITLE =
    "Best end-to-end encrypted messengers in 2026 (independent ranking)";
  const DESC =
    "An independent, fully-sourced ranking of the best end-to-end encrypted messengers in 2026 — Signal, VeilChat, Threema, Session, SimpleX, Briar, Wire and iMessage — and a clear recommendation for who should use which.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog/best-encrypted-messengers-2026",
    ogType: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: TITLE,
        description: DESC,
        image: `${SEO_SITE_URL}/og-image.png`,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SEO_SITE_URL}/blog/best-encrypted-messengers-2026`,
        },
        author: { "@type": "Organization", name: "VeilChat" },
        publisher: {
          "@type": "Organization",
          name: "VeilChat",
          logo: { "@type": "ImageObject", url: `${SEO_SITE_URL}/icon-512.svg` },
        },
        inLanguage: "en",
        datePublished: "2026-02-04",
        dateModified: "2026-04-29",
        keywords:
          "best encrypted messenger 2026, private messaging app, end-to-end encryption, Signal, Threema, Session, SimpleX, Briar, Wire, iMessage, VeilChat",
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Best end-to-end encrypted messengers in 2026",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Signal" },
          { "@type": "ListItem", position: 2, name: "VeilChat" },
          { "@type": "ListItem", position: 3, name: "Threema" },
          { "@type": "ListItem", position: 4, name: "Session" },
          { "@type": "ListItem", position: 5, name: "SimpleX" },
          { "@type": "ListItem", position: 6, name: "Briar" },
          { "@type": "ListItem", position: 7, name: "Wire" },
          { "@type": "ListItem", position: 8, name: "iMessage" },
        ],
      },
    ],
  });

  return (
    <BlogLayout
      slug="best-encrypted-messengers-2026"
      badge="Ranking · Updated 2026"
      title={
        <>
          The best{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            end-to-end encrypted
          </span>{" "}
          messengers in 2026
        </>
      }
      lead={
        <>
          <p>
            "End-to-end encrypted" has become a marketing tagline. Most apps
            that wear it actually encrypt the contents of your messages — but
            the differences between them, in metadata collection, ownership,
            and what survives outside the encrypted envelope, are enormous.
          </p>
          <p>
            We tested and reviewed the eight most credible private messengers
            in active development in 2026. This is the result — an independent
            ranking, fully sourced, with a clear recommendation for who should
            use which one.
          </p>
        </>
      }
      readingMinutes={16}
      toc={TOC}
      sources={SOURCES}
      related={[
        {
          href: "/blog/signal-vs-whatsapp",
          title: "Signal vs WhatsApp — which one is actually private?",
          description:
            "An honest, side-by-side comparison of the two largest encrypted messengers — and where VeilChat fits in.",
        },
        {
          href: "/blog/why-open-source-matters-in-messaging",
          title: "Why open source matters in private messaging",
          description:
            "Closed-source apps ask you to trust a marketing claim. Open source lets you (or anyone) verify it.",
        },
      ]}
    >
      <H2 id="tldr">TL;DR — the short answer</H2>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>For most people:</strong> Signal. Free, polished, run by a
          non-profit, the gold standard for over a decade.
        </li>
        <li>
          <strong>If you don't want to give a phone number:</strong> VeilChat,
          SimpleX, or Session.
        </li>
        <li>
          <strong>If you want a paid app for one-time, lifetime privacy:</strong>{" "}
          Threema (Swiss, ~$5 once).
        </li>
        <li>
          <strong>If you want zero metadata at any cost:</strong> Briar
          (peer-to-peer over Tor) or SimpleX.
        </li>
        <li>
          <strong>Skip:</strong> Telegram (encryption is opt-in and not on by
          default for most chats <Cite n={14} />), and any messenger from a
          large ad-tech company that hasn't shipped end-to-end encryption by
          default.
        </li>
      </ul>

      <H2 id="criteria">1. How we ranked them</H2>
      <P>Six criteria, weighted equally:</P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Encryption strength &amp; default-on:</strong> is everything
          encrypted, by default, with a peer-reviewed protocol?
        </li>
        <li>
          <strong>Metadata minimization:</strong> what does the server know
          about who you talk to, when, and from where?
        </li>
        <li>
          <strong>Identifier required:</strong> phone number, email, or
          something less personal?
        </li>
        <li>
          <strong>Open source:</strong> can the code be independently audited?
        </li>
        <li>
          <strong>Independent ownership:</strong> who pays the bills, and what
          do they want?
        </li>
        <li>
          <strong>Real-world usability:</strong> would you actually convince a
          friend to install it?
        </li>
      </ol>

      <H2 id="signal">2. Signal — the gold standard</H2>
      <P>
        <strong>Phone number:</strong> required (usernames optional since 2024)
        · <strong>Open source:</strong> yes (client + server) ·{" "}
        <strong>Owner:</strong> Signal Foundation (501(c)(3) non-profit
        <Cite n={20} />) · <strong>Cost:</strong> free.
      </P>
      <P>
        Signal invented the modern end-to-end encryption protocol that almost
        every other entry on this list either uses or is descended from
        <Cite n={18} />. Its only reliable metadata is "account creation date"
        and "last connected" timestamp — and it has proved this in court more
        than once <Cite n={2} />. The non-profit ownership means it cannot be
        acquired and pivoted into an ad business.
      </P>
      <P>
        <strong>Best for:</strong> almost everyone. The default
        recommendation.
      </P>
      <P>
        <strong>Trade-off:</strong> still requires a phone number to
        register; usernames help others find you without it, but the number
        is still on file. Some people don't want their personal phone number
        connected to <em>any</em> account, anywhere — and Signal can't quite
        offer that.
      </P>

      <H2 id="veilchat">3. VeilChat — phone-number-free + open source</H2>
      <P>
        <strong>Phone number:</strong> optional (private-ID signup is the
        default) · <strong>Open source:</strong> yes · <strong>Owner:</strong>{" "}
        independent project · <strong>Cost:</strong> free.
      </P>
      <P>
        Yes, this is our app — and we're including it because we built it to
        fix the one thing Signal can't: privacy without a phone number. You
        sign up with a private ID and a recovery phrase that exists only on
        your device. Phone and email signup are <em>also</em> available for
        people who prefer them, but they're never required. Our servers only
        see opaque ciphertext, never plaintext.
      </P>
      <P>
        <strong>Best for:</strong> people who want Signal-grade privacy
        without ever giving a phone number, and want every line of code on
        GitHub for their own (or anyone else's) audit.
      </P>
      <P>
        <strong>Trade-off:</strong> smaller user base than Signal — you'll
        need to invite the people you want to chat with. We think that's a
        feature, not a bug, but we're upfront about it.
      </P>

      <H2 id="threema">4. Threema — the Swiss option</H2>
      <P>
        <strong>Phone number:</strong> optional · <strong>Open source:</strong>{" "}
        yes (since 2020) · <strong>Owner:</strong> Threema GmbH (Switzerland)
        · <strong>Cost:</strong> ~$5 one-time purchase.
      </P>
      <P>
        Threema has been around since 2012 and is built and hosted entirely
        in Switzerland, under Swiss data-protection law <Cite n={4} />. You
        get an 8-character Threema ID at install time — you don't need to
        provide a phone number or email <Cite n={3} />. Cryptography
        whitepaper is published and unchanged for years <Cite n={3} />.
      </P>
      <P>
        <strong>Best for:</strong> people who want a paid (and therefore
        unambiguously customer-aligned) app, and who like the Swiss legal
        backdrop.
      </P>
      <P>
        <strong>Trade-off:</strong> the one-time fee is a tiny barrier for
        casual users; smaller user base than Signal in most countries.
      </P>

      <H2 id="session">5. Session — no identifiers at all</H2>
      <P>
        <strong>Phone number:</strong> none · <strong>Open source:</strong>{" "}
        yes · <strong>Owner:</strong> Oxen Privacy Tech Foundation
        (Australia) · <strong>Cost:</strong> free.
      </P>
      <P>
        Session is a fork of Signal that strips out the phone-number
        requirement and routes messages over a Tor-like onion network of
        community-run nodes <Cite n={5} />
        <Cite n={6} />. Your account is a 66-character cryptographic ID; the
        server doesn't know your IP, doesn't know your phone, doesn't know
        your name.
      </P>
      <P>
        <strong>Best for:</strong> users with a high-paranoia threat model
        who want decentralization too.
      </P>
      <P>
        <strong>Trade-off:</strong> the onion routing makes message delivery
        slower; the giant cryptographic ID is awkward to share via voice;
        feature pace is slower than Signal.
      </P>

      <H2 id="simplex">6. SimpleX — no user IDs, period</H2>
      <P>
        <strong>Phone number:</strong> none · <strong>Open source:</strong>{" "}
        yes · <strong>Owner:</strong> SimpleX Chat Ltd (UK) ·{" "}
        <strong>Cost:</strong> free.
      </P>
      <P>
        SimpleX takes a different angle entirely: instead of giving each user
        a permanent identifier, it uses one-time message-queue addresses.
        Even SimpleX's own servers cannot link two messages to the same user
        unless that user explicitly chooses to be linkable <Cite n={7} />
        <Cite n={8} />. It's the most aggressive approach to metadata
        minimization in the industry.
      </P>
      <P>
        <strong>Best for:</strong> threat models where even the existence of
        a stable account is a problem (whistleblowing, journalism, certain
        activism).
      </P>
      <P>
        <strong>Trade-off:</strong> the conceptual model is the most
        unfamiliar in this list — there is no "username" to share, only QR
        codes and one-time invite links. There is a learning curve.
      </P>

      <H2 id="briar">7. Briar — peer-to-peer over Tor</H2>
      <P>
        <strong>Phone number:</strong> none · <strong>Open source:</strong>{" "}
        yes · <strong>Owner:</strong> Briar Project (UK non-profit) ·{" "}
        <strong>Cost:</strong> free.
      </P>
      <P>
        Briar is the only app on this list that doesn't use central servers
        at all <Cite n={9} />. Messages are delivered peer-to-peer over Tor
        (or, when there's no internet, over Bluetooth or a local Wi-Fi
        network — useful in protests and during state-led internet shutdowns).
        Independently audited by Cure53 in 2017 <Cite n={10} />.
      </P>
      <P>
        <strong>Best for:</strong> protesters, journalists in repressive
        regimes, disaster-response teams, anyone who needs to message when
        there <em>isn't</em> a working internet.
      </P>
      <P>
        <strong>Trade-off:</strong> Android only at the time of writing; both
        users have to be online (or near each other) for a message to arrive;
        not the right pick for casual everyday chat.
      </P>

      <H2 id="wire">8. Wire — open-source for teams</H2>
      <P>
        <strong>Phone number:</strong> optional ·{" "}
        <strong>Open source:</strong> yes <Cite n={12} /> ·{" "}
        <strong>Owner:</strong> Wire Swiss GmbH · <strong>Cost:</strong> free
        for personal use, paid plans for teams.
      </P>
      <P>
        Wire is interesting because it implements the new IETF{" "}
        <strong>Messaging Layer Security</strong> standard (RFC 9420) for
        large-group end-to-end encryption <Cite n={19} />, which scales the
        Signal Protocol's guarantees to groups of thousands. Strong choice
        for organizations that need encrypted Slack-style chat <Cite n={11} />.
      </P>
      <P>
        <strong>Best for:</strong> teams, businesses, and NGOs who want
        encrypted-by-default group collaboration.
      </P>
      <P>
        <strong>Trade-off:</strong> consumer side is less polished than
        Signal; the freemium business model means features can move behind a
        paywall.
      </P>

      <H2 id="imessage">9. iMessage — only if you're all-Apple</H2>
      <P>
        <strong>Phone number/email:</strong> required · <strong>Open
        source:</strong> no · <strong>Owner:</strong> Apple Inc. ·{" "}
        <strong>Cost:</strong> bundled with the device.
      </P>
      <P>
        iMessage is genuinely end-to-end encrypted between Apple devices
        <Cite n={16} />, and Apple's optional <em>Advanced Data Protection</em>
        extends end-to-end encryption to your iCloud backups too — including
        Messages history <Cite n={17} />. That's a serious privacy upgrade
        most users don't enable. Without it, your iCloud-backed message
        history is decryptable by Apple under legal process.
      </P>
      <P>
        <strong>Best for:</strong> people who already live entirely inside
        Apple's ecosystem and only message other Apple users — and who turn
        on Advanced Data Protection.
      </P>
      <P>
        <strong>Trade-off:</strong> messages to Android users fall back to
        SMS or RCS without iMessage's E2EE; closed-source; not portable.
      </P>

      <H2 id="skip">10. The ones to skip (and why)</H2>
      <H3>Telegram</H3>
      <P>
        Telegram is often listed as a "secure messenger" because it markets
        itself that way. In reality, only Telegram's "Secret Chats" mode
        offers end-to-end encryption, and it is <em>not</em> the default
        <Cite n={14} />. Group chats, channels, and ordinary one-to-one
        chats are merely encrypted in transit and on the server, where
        Telegram itself can read them. Telegram's privacy policy is also
        explicit about what it can disclose under legal process <Cite n={15} />.
      </P>
      <H3>WhatsApp</H3>
      <P>
        WhatsApp's encryption is genuinely good — but the surrounding system
        is a metadata firehose into Meta's ad-tech graph, and the company is
        rolling out in-app advertising in 2025–2026 <Cite n={13} />. We
        covered the full breakdown in our{" "}
        <a href="/blog/signal-vs-whatsapp" className="text-[#2E6F40] underline">
          Signal vs WhatsApp comparison
        </a>
        .
      </P>
      <H3>Anything from a major ad-tech company without E2EE by default</H3>
      <P>
        Meta Messenger only end-to-end encrypts when both users opt in; SMS
        and RCS without a Google-only stack are not end-to-end encrypted at
        all. Treat them as postcards.
      </P>

      <H2 id="comparison">11. Full comparison table</H2>
      <CompareTable
        columns={[
          "Phone #?",
          "Open source",
          "Default E2EE",
          "Metadata",
          "Owner",
          "Cost",
        ]}
        rows={[
          { label: "Signal", cells: ["Yes (username optional)", "Yes", "Yes", "Minimal", "Non-profit", "Free"] },
          { label: "VeilChat", cells: ["No (optional)", "Yes", "Yes", "Minimal (opaque ciphertext)", "Independent", "Free"] },
          { label: "Threema", cells: ["No", "Yes", "Yes", "Minimal", "Threema GmbH (CH)", "~$5 once"] },
          { label: "Session", cells: ["No", "Yes", "Yes", "Onion-routed", "Oxen Foundation", "Free"] },
          { label: "SimpleX", cells: ["No", "Yes", "Yes", "No persistent IDs", "SimpleX Ltd", "Free"] },
          { label: "Briar", cells: ["No", "Yes", "Yes", "P2P over Tor / no servers", "Non-profit (UK)", "Free"] },
          { label: "Wire", cells: ["Optional", "Yes", "Yes (MLS)", "Some metadata", "Wire Swiss", "Free / paid"] },
          { label: "iMessage", cells: ["Yes", "No", "Yes (Apple↔Apple)", "Apple-controlled", "Apple Inc.", "Bundled"] },
          { label: "WhatsApp", cells: ["Yes", "No", "Yes", "Heavy", "Meta Platforms", "Free (ads coming)"] },
          { label: "Telegram", cells: ["Yes", "Partial", "No (opt-in only)", "Heavy", "Telegram FZ-LLC", "Free / Premium"] },
        ]}
      />

      <H2 id="verdict">12. Our recommendation</H2>
      <P>
        For most people: <strong>install Signal today</strong>. It's free, it
        works, and it gets you 90% of the privacy benefit for very little
        effort.
      </P>
      <P>
        For people who don't want their phone number linked to a chat
        account: <strong>install VeilChat</strong>{" "}
        (
        <a href="/welcome" className="text-[#2E6F40] underline">
          veilchat.me/welcome
        </a>
        ). You'll get a private ID, a recovery phrase that exists only on
        your device, and a server that genuinely cannot read your messages.
      </P>
      <P>
        For people with the highest threat models: layer{" "}
        <strong>Briar or SimpleX</strong> on top, depending on whether you
        prioritize peer-to-peer resilience (Briar) or zero persistent
        identifiers (SimpleX).
      </P>
      <P>
        Whatever you pick — pick something. The worst option is the one you
        already have installed because everybody else uses it.
      </P>
    </BlogLayout>
  );
}
