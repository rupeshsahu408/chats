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
  { n: 1, title: "We Kill People Based on Metadata", publisher: "Gen. Michael Hayden, former NSA director, Johns Hopkins lecture", url: "https://www.theguardian.com/world/2014/may/10/we-kill-people-based-metadata-says-ex-nsa-chief", date: "May 2014" },
  { n: 2, title: "Information for Law Enforcement Authorities", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/444002211197967" },
  { n: 3, title: "About information WhatsApp shares with other Meta companies", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1303762270462331" },
  { n: 4, title: "FBI Document — Lawful Access to Secure Messaging Apps", publisher: "Property of the People (FOIA)", url: "https://propertyofthepeople.org/document-detail/?doc-id=21114562", date: "Jan 2021" },
  { n: 5, title: "Signal Subpoena Response — Eastern Virginia", publisher: "Signal", url: "https://signal.org/bigbrother/eastern-virginia-grand-jury/", date: "Oct 2016" },
  { n: 6, title: "Signal Subpoena Response — Santa Clara County", publisher: "Signal", url: "https://signal.org/bigbrother/santa-clara-county/", date: "Apr 2021" },
  { n: 7, title: "Signal Sealed Sender", publisher: "Signal Blog", url: "https://signal.org/blog/sealed-sender/", date: "Oct 29, 2018" },
  { n: 8, title: "Signal Private Contact Discovery", publisher: "Signal Blog", url: "https://signal.org/blog/private-contact-discovery/", date: "Sep 26, 2017" },
  { n: 9, title: "Telegram Privacy Policy", publisher: "Telegram", url: "https://telegram.org/privacy" },
  { n: 10, title: "iMessage Security Overview", publisher: "Apple Platform Security", url: "https://support.apple.com/guide/security/imessage-security-overview-secd9764312f/web" },
  { n: 11, title: "iCloud data security overview", publisher: "Apple Platform Security", url: "https://support.apple.com/guide/security/icloud-data-security-overview-sec0a319b35f/web" },
  { n: 12, title: "Advanced Data Protection for iCloud", publisher: "Apple Newsroom", url: "https://www.apple.com/newsroom/2022/12/apple-advances-user-security-with-powerful-new-data-protections/", date: "Dec 7, 2022" },
  { n: 13, title: "Push Notifications Used by Governments to Surveil Users", publisher: "Reuters", url: "https://www.reuters.com/technology/cybersecurity/governments-spying-apple-google-users-through-push-notifications-us-senator-2023-12-06/", date: "Dec 6, 2023" },
  { n: 14, title: "Sen. Wyden letter to DOJ on push-notification surveillance", publisher: "U.S. Senate", url: "https://www.wyden.senate.gov/imo/media/doc/wyden_smartphone_push_notifications_letter_to_doj.pdf", date: "Dec 6, 2023" },
  { n: 15, title: "Pegasus spyware maker NSO must pay $167M in WhatsApp lawsuit", publisher: "Axios", url: "https://www.axios.com/2025/05/06/nso-group-whatsapp-jury-damages", date: "May 6, 2025" },
  { n: 16, title: "Citizen Lab — targeted threats research", publisher: "The Citizen Lab", url: "https://citizenlab.ca/category/research/targeted-threats/" },
  { n: 17, title: "GSMA — IMSI and the SS7 protocol", publisher: "GSMA", url: "https://www.gsma.com/security/" },
  { n: 18, title: "Cell-Site Simulators / IMSI Catchers", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/pages/cell-site-simulatorsimsi-catchers" },
  { n: 19, title: "BGP Hijacking Demystified", publisher: "MANRS / Internet Society", url: "https://www.manrs.org/" },
  { n: 20, title: "Tor Project — onion services protocol specification", publisher: "Tor Project", url: "https://spec.torproject.org/rend-spec-v3" },
  { n: 21, title: "Telegram Default Chats Are Not End-to-End Encrypted", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/deeplinks/2018/12/telegrams-encrypted-chats-are-not-default-2018" },
  { n: 22, title: "Apple acknowledges receipt of push-notification subpoenas", publisher: "Reuters", url: "https://www.reuters.com/technology/cybersecurity/governments-spying-apple-google-users-through-push-notifications-us-senator-2023-12-06/", date: "Dec 2023" },
  { n: 23, title: "Read receipts and the privacy paradox", publisher: "ACM Conference on Human Factors in Computing Systems (CHI)", url: "https://dl.acm.org/doi/10.1145/3025453.3025591", date: "2017" },
  { n: 24, title: "Session Whitepaper", publisher: "Session", url: "https://getsession.org/whitepaper" },
];

const TOC: BlogTocItem[] = [
  { id: "tldr", label: "TL;DR — content vs metadata" },
  { id: "definition", label: "1. What 'metadata' actually means in messaging" },
  { id: "kinds", label: "2. The seven kinds of leak" },
  { id: "ip", label: "3. Your IP address — the most under-rated leak" },
  { id: "address-book", label: "4. Your address book — the social-graph leak" },
  { id: "presence", label: "5. Online status, typing indicators, read receipts" },
  { id: "push", label: "6. Push notifications — the leak almost no one talks about" },
  { id: "backups", label: "7. Backups — your encrypted message in a plaintext drawer" },
  { id: "comparison", label: "8. How major messengers compare on metadata" },
  { id: "fix", label: "9. What you can actually do about it" },
  { id: "verdict", label: "10. The verdict" },
];

export function MessengerMetadataLeaksPage() {
  const TITLE =
    "What metadata your messenger leaks (and what to do about it)";
  const DESC =
    "End-to-end encryption hides your message content. It does not hide who you talked to, when, from where, or for how long. Here's a source-cited tour of the seven kinds of metadata your messenger leaks — and how to plug each one.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog/messenger-metadata-leaks",
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESC,
      image: `${SEO_SITE_URL}/og-image.png`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SEO_SITE_URL}/blog/messenger-metadata-leaks`,
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
        "messenger metadata, metadata leaks, end-to-end encryption metadata, WhatsApp metadata, Signal metadata, push notification surveillance, sealed sender, IMSI catcher, private messaging",
    },
  });

  return (
    <BlogLayout
      slug="messenger-metadata-leaks"
      badge="Deep dive · 2026"
      title={
        <>
          What{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            metadata
          </span>{" "}
          your messenger leaks
        </>
      }
      lead={
        <>
          <p>
            "End-to-end encrypted" is a promise about <em>content</em> —
            the words you typed. It is not a promise about <em>metadata</em>
            — who you sent the words to, when, from where, on which
            device, and for how long the call lasted.
          </p>
          <p>
            In 2014, then-NSA-director Michael Hayden put it bluntly: "We
            kill people based on metadata." <Cite n={1} /> A decade later,
            the metadata side of messaging is still where most of the
            real privacy slips happen. This is a tour of the seven
            specific leaks — and how to plug them.
          </p>
        </>
      }
      readingMinutes={12}
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
          href: "/blog/signal-vs-whatsapp",
          title: "Signal vs WhatsApp — which one is actually private?",
          description:
            "Same encryption protocol. Wildly different surrounding metadata.",
        },
      ]}
    >
      <H2 id="tldr">TL;DR — content vs metadata</H2>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Content is what you said.</strong> End-to-end encryption
          hides this from the server.
        </li>
        <li>
          <strong>Metadata is everything around what you said.</strong>{" "}
          Most servers can still see all of it: contact graph, timing,
          IPs, device fingerprints, online status, typing, read receipts,
          group memberships, push tokens, last-seen.
        </li>
        <li>
          <strong>Metadata is what gets people targeted.</strong> Almost
          every published surveillance abuse — Pegasus, Predator, the
          NSO judgment <Cite n={15} />, Citizen Lab's reporting{" "}
          <Cite n={16} /> — leans on metadata, not message content.
        </li>
        <li>
          <strong>Different apps leak wildly different amounts.</strong>{" "}
          Signal's subpoena responses are two lines long{" "}
          <Cite n={5} /> <Cite n={6} />. WhatsApp's law-enforcement guide
          runs to dozens of fields <Cite n={2} />.
        </li>
      </ul>

      <H2 id="definition">1. What "metadata" actually means in messaging</H2>
      <P>
        Metadata is the structured information your messenger needs in
        order to function — and which it can theoretically delete after
        delivery, but usually doesn't. The classic categories are:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li><strong>Identity:</strong> phone number, email, account ID, device IDs.</li>
        <li><strong>Social graph:</strong> who you message and how often.</li>
        <li><strong>Timing:</strong> when each message was sent, received, read.</li>
        <li><strong>Network:</strong> IP address, network type, geolocation hints.</li>
        <li><strong>Device:</strong> OS, model, app version, push token.</li>
        <li><strong>Behavioural:</strong> last seen, typing indicator, online status, presence.</li>
      </ul>
      <P>
        A leak isn't a single event. It's a continuous trickle. The
        question is who's at the other end of the pipe, and how long
        they keep it.
      </P>

      <H2 id="kinds">2. The seven kinds of leak</H2>
      <P>The leaks worth understanding, in rough order of severity:</P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>The contact-graph leak</li>
        <li>The IP / location leak</li>
        <li>The device-fingerprint leak</li>
        <li>The presence leak (online, typing, read)</li>
        <li>The push-notification leak</li>
        <li>The cloud-backup leak</li>
        <li>The cellular / radio-layer leak (IMSI catchers, SS7)</li>
      </ol>
      <P>
        We'll walk through the most consequential ones below.
      </P>

      <H2 id="ip">3. Your IP address — the most under-rated leak</H2>
      <P>
        Every time your messenger talks to its server, your IP is in the
        TCP/IP header. The server cannot avoid seeing it — that's how
        the response gets back to you.
      </P>
      <P>
        IP plus timing equals approximate location plus approximate
        identity. A residential IP narrows you to a household; a mobile
        IP narrows you to a carrier in a given metro area; correlated
        across hours of the day, both narrow to an individual. The
        FBI's leaked 2021 chart of "lawful access to secure messaging
        apps" <Cite n={4} /> lists IP retention as a category for every
        major messenger.
      </P>
      <H3>What helps</H3>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          A messenger that runs over Tor or a similar onion-routed
          transport (Session <Cite n={24} />) hides your IP from the
          delivery server itself.
        </li>
        <li>
          A trustworthy VPN moves the leak from <em>your ISP and the
          messenger</em> to <em>the VPN provider only</em>. Choose one
          that doesn't keep logs.
        </li>
        <li>
          Some messengers offer "hide IP in calls" / "relay calls
          through the server" so the other party can't see your raw IP
          during voice/video.
        </li>
      </ul>

      <H2 id="address-book">4. Your address book — the social-graph leak</H2>
      <P>
        When you "find friends" in a messenger, your address book is
        usually uploaded — sometimes all at once, sometimes hashed,
        sometimes encrypted. The app then matches it against its user
        database to tell you who else is on the platform.
      </P>
      <P>
        That step is the social-graph leak. Done naively, the server
        learns every phone number in your contacts — including the
        contacts who <em>aren't</em> on the app yet. Telegram's privacy
        policy <Cite n={9} /> is explicit that this happens. WhatsApp
        does the same.
      </P>
      <P>
        Two techniques make the leak much smaller:
      </P>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Hashed contact discovery:</strong> the client uploads
          short rotating hashes instead of raw numbers. Naïve hashing
          is reversible (the phone-number space is small enough to
          brute-force), so this is only good if combined with the next
          item.
        </li>
        <li>
          <strong>Trusted-execution / oblivious lookups:</strong>{" "}
          Signal's Private Contact Discovery <Cite n={8} /> uses Intel
          SGX so the server can match contacts without learning them.
          A growing number of apps now use similar tricks.
        </li>
      </ul>
      <Callout title="The defensive option">
        If you don't want to upload your contacts at all, pick a
        messenger that lets you skip phone-number discovery entirely:
        Threema, Session, and{" "}
        <a href="/" className="text-[#2E6F40] underline">VeilChat</a> are
        all designed around invite-by-ID rather than phone-book scrape.
      </Callout>

      <H2 id="presence">5. Online status, typing indicators, read receipts</H2>
      <P>
        These three features — invented to make chat feel alive — also
        broadcast a continuous stream of your behaviour to every
        conversation partner, and through them, to anyone who's watching
        them. Even academic HCI research has shown read receipts have
        non-trivial privacy and social costs <Cite n={23} />.
      </P>
      <P>
        Most major messengers let you turn each of these off
        individually. Doing so usually disables them in both
        directions — you don't see other people's read receipts either.
        Worth it.
      </P>

      <H2 id="push">6. Push notifications — the leak almost no one talks about</H2>
      <P>
        On iOS and Android, your messenger can't wake your phone
        directly. It has to ask Apple Push Notification service or
        Firebase Cloud Messaging to deliver the notification on its
        behalf.
      </P>
      <P>
        That means Apple and Google see — for every push notification —
        the recipient device, the source app, and the timestamp.
        Sometimes the title and body, too. In December 2023, US Senator
        Ron Wyden's office revealed that several governments had been
        subpoenaing Apple and Google for push-notification data{" "}
        <Cite n={13} /> <Cite n={14} />, and Apple confirmed it had
        been receiving such requests <Cite n={22} />.
      </P>
      <H3>What helps</H3>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Encrypted push payload:</strong> the messenger only
          sends "you have a message" to the OS, with the title and
          body decrypted on-device. Signal and{" "}
          <a href="/" className="text-[#2E6F40] underline">VeilChat</a>{" "}
          do this.
        </li>
        <li>
          <strong>Self-hosted push (Android only):</strong> UnifiedPush
          and similar systems route notifications through a server you
          control instead of FCM.
        </li>
        <li>
          <strong>Background polling instead of push:</strong> rare in
          mainstream apps; common in privacy-first ones. Trade-off is
          battery life.
        </li>
      </ul>

      <H2 id="backups">7. Backups — your encrypted message in a plaintext drawer</H2>
      <P>
        E2EE on the wire doesn't help if the recipient's device is
        backing up the decrypted plaintext to a cloud the messenger
        doesn't control. Apple's iCloud — without Advanced Data
        Protection enabled <Cite n={12} /> — and Google Drive backups
        for WhatsApp historically fell into this category{" "}
        <Cite n={11} />. Apple started rolling out end-to-end encrypted
        iCloud backups in late 2022 with ADP <Cite n={12} />, but it's
        opt-in, and adoption is low.
      </P>
      <H3>What to look for</H3>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>An E2EE backup option that's <em>on by default</em>.</li>
        <li>A recovery key your messenger never sees.</li>
        <li>
          Local-only backup is fine — and arguably the safest
          default — for most users.
        </li>
      </ul>

      <H2 id="comparison">8. How major messengers compare on metadata</H2>
      <CompareTable
        columns={["WhatsApp", "Signal", "iMessage", "Telegram", "Threema", "VeilChat"]}
        rows={[
          {
            label: "Server learns sender→recipient pair",
            cells: ["Yes", "Sealed sender", "Yes", "Yes", "Minimal", "Sealed sender"],
          },
          {
            label: "Server retains IP per message",
            cells: ["Yes (ToS) ", "No", "Yes (per Apple ADP doc)", "Yes", "No", "No"],
          },
          {
            label: "Address-book required",
            cells: ["Yes", "Optional (PCD)", "Apple ID required", "Yes", "Optional", "Optional"],
          },
          {
            label: "Push payload encrypted",
            cells: ["Title only", "Yes", "Apple-controlled", "No", "Yes", "Yes"],
          },
          {
            label: "Default cloud backup E2EE",
            cells: ["Off", "N/A (local)", "Off (ADP)", "N/A (cloud)", "Yes", "Yes"],
          },
          {
            label: "Volume of data returned to subpoena",
            cells: ["High", "Two lines", "Moderate", "Moderate", "Low", "Low"],
          },
        ]}
      />
      <P>
        For deeper sourcing on the WhatsApp side specifically, see our
        documentary-style{" "}
        <a
          href="/blog/whatsapp-privacy-truth"
          className="text-[#2E6F40] underline"
        >
          WhatsApp privacy investigation
        </a>
        .
      </P>

      <H2 id="fix">9. What you can actually do about it</H2>
      <P>
        You don't need to become a security professional. A few small
        changes shrink the metadata leak by a lot:
      </P>
      <ol className="mt-4 space-y-3 list-decimal list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Pick a messenger with sealed sender / minimal
          server retention</strong> for the conversations that matter.
          Signal, VeilChat, Threema all qualify.
        </li>
        <li>
          <strong>Turn off online status, typing indicators, and read
          receipts.</strong> You'll lose nothing functional and broadcast
          significantly less.
        </li>
        <li>
          <strong>Enable encrypted backups,</strong> or disable cloud
          backups entirely. Make sure your recovery key is one that
          nobody else holds.
        </li>
        <li>
          <strong>Don't upload your address book</strong> if your app
          gives you the option to skip it.
        </li>
        <li>
          <strong>Use a separate identity</strong> (anonymous ID app
          like VeilChat / Threema / Session) for the conversations
          where you don't want your real-world identity attached.
        </li>
        <li>
          <strong>Audit your push notifications:</strong> turn off
          message previews on the lock screen so the OS doesn't
          broadcast your conversations to anyone glancing at your phone
          (and reduces what's available to lawful-access push requests
          <Cite n={13} />).
        </li>
        <li>
          <strong>For maximum hostility:</strong> route your messenger
          through Tor or a no-log VPN to hide your IP from the
          messenger itself.
        </li>
      </ol>
      <Callout title="Note on cellular leaks">
        IMSI catchers <Cite n={18} /> and SS7 attacks <Cite n={17} />{" "}
        operate at the radio layer below your messenger. No app can fix
        them. The only real defence is to use Wi-Fi-over-VPN for
        sensitive conversations and treat any SMS you receive as
        unauthenticated.
      </Callout>

      <H2 id="verdict">10. The verdict</H2>
      <P>
        End-to-end encryption is necessary. It is not, by itself,
        sufficient. The companies that take metadata seriously — Signal,
        Threema, Wire, Session, VeilChat — design their servers so the
        data they don't want to hand over to a subpoena{" "}
        <em>doesn't exist in the first place</em>. That's the only
        privacy guarantee that survives a hostile lawyer.
      </P>
      <P>
        If you'd like a messenger that was built on this principle from
        the first commit — sealed sender, no phone number required,
        encrypted push, no metadata-collecting backup —{" "}
        <a href="/welcome" className="text-[#2E6F40] underline">
          install VeilChat
        </a>
        . If you want the largest network with the same philosophy,
        install{" "}
        <a
          href="https://signal.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2E6F40] underline"
        >
          Signal
        </a>
        . The worst choice, as ever, is the default one.
      </P>
    </BlogLayout>
  );
}
