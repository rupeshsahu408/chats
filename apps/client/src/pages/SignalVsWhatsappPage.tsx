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
  { n: 2, title: "Signal Subpoena Response — 2016", publisher: "Signal", url: "https://signal.org/bigbrother/eastern-virginia-grand-jury/", date: "Oct 2016" },
  { n: 3, title: "Signal Subpoena Response — Santa Clara", publisher: "Signal", url: "https://signal.org/bigbrother/santa-clara-county/", date: "Apr 2021" },
  { n: 4, title: "Signal Sealed Sender", publisher: "Signal Blog", url: "https://signal.org/blog/sealed-sender/", date: "Oct 29, 2018" },
  { n: 5, title: "Signal Private Contact Discovery", publisher: "Signal Blog", url: "https://signal.org/blog/private-contact-discovery/", date: "Sep 26, 2017" },
  { n: 6, title: "WhatsApp Privacy Policy", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/privacy-policy" },
  { n: 7, title: "About information WhatsApp shares with other Meta companies", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1303762270462331" },
  { n: 8, title: "Information for Law Enforcement Authorities", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/444002211197967" },
  { n: 9, title: "FBI Document Says the Feds Can Get Your WhatsApp Data — in Real Time", publisher: "Rolling Stone", url: "https://www.rollingstone.com/politics/politics-features/whatsapp-imessage-facebook-apple-fbi-privacy-1261816/", date: "Dec 2021" },
  { n: 10, title: "WhatsApp Updates Tab Supplemental Privacy Policy", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/updatestab-privacy-policy" },
  { n: 11, title: "Helping You Find More Channels and Businesses on WhatsApp", publisher: "Meta Newsroom", url: "https://about.fb.com/news/2025/06/helping-you-find-more-channels-businesses-on-whatsapp/", date: "Jun 16, 2025" },
  { n: 12, title: "Signal: Technology Preview: Sealed Sender for Signal", publisher: "Signal Blog", url: "https://signal.org/blog/sealed-sender/" },
  { n: 13, title: "Brian Acton on leaving WhatsApp", publisher: "Forbes", url: "https://www.forbes.com/sites/parmyolson/2018/09/26/exclusive-whatsapp-cofounder-brian-acton-gives-the-inside-story-on-deletefacebook-and-why-he-left-50-million-behind/", date: "Sep 26, 2018" },
  { n: 14, title: "Signal Foundation 990 Filings", publisher: "ProPublica Nonprofit Explorer", url: "https://projects.propublica.org/nonprofits/organizations/824506840" },
  { n: 15, title: "WhatsApp Engineering: Building reliable infrastructure", publisher: "Meta Engineering", url: "https://engineering.fb.com/" },
  { n: 16, title: "Signal Protocol Documentation", publisher: "Signal", url: "https://signal.org/docs/" },
  { n: 17, title: "WhatsApp end-to-end encryption white paper", publisher: "WhatsApp", url: "https://www.whatsapp.com/security/" },
  { n: 18, title: "Pegasus spyware maker NSO must pay $167M in WhatsApp lawsuit", publisher: "Axios", url: "https://www.axios.com/2025/05/06/nso-group-whatsapp-jury-damages", date: "May 6, 2025" },
  { n: 19, title: "Signal source code", publisher: "GitHub", url: "https://github.com/signalapp" },
  { n: 20, title: "WhatsApp client source code policy", publisher: "Meta", url: "https://github.com/WhatsApp" },
];

const TOC: BlogTocItem[] = [
  { id: "tldr", label: "TL;DR — which one should you use?" },
  { id: "encryption", label: "1. Encryption: the same protocol, different glass" },
  { id: "metadata", label: "2. Metadata: the part Google calls you about" },
  { id: "ownership", label: "3. Who owns the company — and why it matters" },
  { id: "money", label: "4. How they make money (or don't)" },
  { id: "data-shared", label: "5. What gets shared with the government" },
  { id: "phone", label: "6. The phone-number problem (and how each handles it)" },
  { id: "features", label: "7. Feature-by-feature comparison" },
  { id: "switching", label: "8. Should you switch from WhatsApp to Signal?" },
  { id: "veilchat", label: "9. Where VeilChat fits in" },
  { id: "verdict", label: "10. The honest verdict" },
];

export function SignalVsWhatsappPage() {
  const TITLE = "Signal vs WhatsApp: which messenger is actually private in 2026?";
  const DESC =
    "An honest, fully-sourced comparison of Signal and WhatsApp in 2026: encryption, metadata, ownership, government access, and what each one actually keeps. Plus where independent alternatives like VeilChat fit in.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog/signal-vs-whatsapp",
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESC,
      image: `${SEO_SITE_URL}/og-image.png`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SEO_SITE_URL}/blog/signal-vs-whatsapp`,
      },
      author: { "@type": "Organization", name: "VeilChat" },
      publisher: {
        "@type": "Organization",
        name: "VeilChat",
        logo: { "@type": "ImageObject", url: `${SEO_SITE_URL}/icon-512.svg` },
      },
      inLanguage: "en",
      datePublished: "2026-01-12",
      dateModified: "2026-04-29",
      keywords:
        "Signal vs WhatsApp, private messenger comparison, end-to-end encryption, Signal Protocol, metadata, WhatsApp privacy, encrypted messaging app",
    },
  });

  return (
    <BlogLayout
      slug="signal-vs-whatsapp"
      badge="Comparison · Fully sourced"
      title={
        <>
          Signal vs WhatsApp:{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            which one is actually private
          </span>{" "}
          in 2026?
        </>
      }
      lead={
        <>
          <p>
            Signal and WhatsApp use the <em>same</em> end-to-end encryption
            protocol — and yet privacy researchers will tell you the two apps
            are not in the same league. The encryption is the easy part. The
            hard part is everything that surrounds it: who owns the company,
            what they collect about you, what they hand to governments, and
            what survives when you press <em>delete</em>.
          </p>
          <p>
            This is an honest, side-by-side comparison written for people who
            want a single answer to the question:{" "}
            <em>“Is Signal really better than WhatsApp, and by how much?”</em>{" "}
            Every claim is keyed to a numbered source.
          </p>
        </>
      }
      readingMinutes={14}
      toc={TOC}
      sources={SOURCES}
      related={[
        {
          href: "/blog/best-encrypted-messengers-2026",
          title: "Best end-to-end encrypted messengers in 2026",
          description:
            "We ranked the top private messengers — Signal, Threema, Session, SimpleX, Briar, Wire, and VeilChat — by what genuinely matters.",
        },
        {
          href: "/blog/why-open-source-matters-in-messaging",
          title: "Why open source matters in private messaging",
          description:
            "Closed-source apps ask you to trust a marketing claim. Open-source apps let you (or anyone) verify the claim. That difference is everything.",
        },
      ]}
    >
      <H2 id="tldr">TL;DR — which one should you use?</H2>
      <P>
        If you have to pick one of the two, <strong>Signal</strong> is the
        privacy-respecting choice for almost everyone. Its non-profit owner
        cannot legally pivot to ads, it collects almost no metadata, and it
        has repeatedly proven in court that it has nothing to hand over
        <Cite n={2} />
        <Cite n={3} />. WhatsApp uses the same encryption protocol but is owned
        by Meta, links your account to a Facebook-wide identity graph
        <Cite n={7} />, can disclose a substantial amount of metadata to law
        enforcement <Cite n={8} />, and is moving towards in-app advertising
        in 2025–2026 <Cite n={11} />.
      </P>
      <Callout title="The honest caveat">
        Both apps require your phone number, both use centralized servers, and
        both have been weaponized by spyware operators in the real world
        <Cite n={18} />. If your threat model is journalism, activism, or
        domestic-abuse safety, you should look beyond either app — see our{" "}
        <a href="/blog/best-encrypted-messengers-2026" className="text-[#2E6F40] underline">
          best encrypted messengers guide
        </a>{" "}
        for the alternatives.
      </Callout>

      <H2 id="encryption">1. Encryption: the same protocol, different glass</H2>
      <P>
        Both Signal and WhatsApp encrypt your messages using the{" "}
        <strong>Signal Protocol</strong> — the open, peer-reviewed cryptographic
        design developed by Open Whisper Systems and now maintained by the
        Signal Foundation <Cite n={16} />. WhatsApp licensed and rolled out
        the protocol across all chats in 2016 <Cite n={17} />. So far, so
        identical.
      </P>
      <P>
        The difference shows up around the cryptography, not inside it. With
        Signal, the open-source client you install <Cite n={19} /> is the same
        client everyone else in the world is auditing. With WhatsApp, the
        client is closed-source <Cite n={20} />: you have to trust that the
        binary on your phone implements the protocol the way the paper says
        it does, and that no telemetry has been bolted on around it.
      </P>
      <H3>Why this matters in plain English</H3>
      <P>
        Encryption is only useful if the program holding your keys behaves
        itself. Open-source clients can be inspected — and have been, by
        academic researchers, security firms, and the random curious developer
        — for the entire history of the project. Closed-source clients ask you
        to take the company's word for it. That's a different security model
        even when the math is identical.
      </P>

      <H2 id="metadata">2. Metadata: the part Google calls you about</H2>
      <P>
        End-to-end encryption protects the <em>contents</em> of your messages.
        It does not protect <em>metadata</em> — who you talk to, when you talk
        to them, how long the messages are, what device you used, your IP
        address, and so on. Metadata is what surveillance actually runs on.
        It is also where Signal and WhatsApp diverge most sharply.
      </P>
      <H3>What Signal keeps</H3>
      <P>
        Signal keeps the date your account was created and the date you last
        connected to its servers. That's essentially it <Cite n={1} />. They
        have proven this in court more than once: when subpoenaed, the only
        information Signal could produce about a target user was an account
        creation timestamp and a "last connected" timestamp <Cite n={2} />
        <Cite n={3} />. Signal also engineered a feature called{" "}
        <em>Sealed Sender</em> that hides who is messaging whom even from
        Signal's own servers <Cite n={4} />, and{" "}
        <em>Private Contact Discovery</em> that lets you find friends who use
        Signal without uploading your address book <Cite n={5} />.
      </P>
      <H3>What WhatsApp keeps</H3>
      <P>
        WhatsApp's privacy policy lists, among other things: your phone
        number, profile information, status, "last seen", who you chat with
        and how often, group memberships, your IP address, your device
        identifiers, your operating system, your battery level, and your
        approximate location based on IP <Cite n={6} />. Most of that
        metadata is shared inside the wider Meta family of apps for
        "infrastructure, safety, and integrity" purposes <Cite n={7} />.
      </P>
      <Callout>
        <strong>The bumper-sticker version:</strong> Signal can prove in court
        that it knows almost nothing. WhatsApp's published help-center
        document tells law enforcement exactly which categories of data are
        available with which kind of legal request <Cite n={8} />.
      </Callout>

      <H2 id="ownership">3. Who owns the company — and why it matters</H2>
      <P>
        Signal is owned and operated by the <strong>Signal Foundation</strong>
        , a registered 501(c)(3) non-profit in the United States <Cite n={14} />.
        Its bylaws prevent it from being acquired or pivoted into an ad
        business. Its first major donor was Brian Acton — one of the
        co-founders of WhatsApp who walked away from a billion dollars of
        unvested Facebook stock when Meta started preparing the ground for
        ads inside WhatsApp <Cite n={13} />.
      </P>
      <P>
        WhatsApp is a wholly-owned subsidiary of Meta Platforms, Inc., a
        publicly-traded advertising company whose primary business model is
        building behavioural profiles to sell access to. Meta is legally
        obliged to its shareholders, not to its users. Whatever WhatsApp's
        privacy policy says today, it can be revised on notice — and has
        been, repeatedly.
      </P>

      <H2 id="money">4. How they make money (or don't)</H2>
      <P>
        Signal does not run ads, sell data, or monetize the app. The
        Foundation runs on donations and a starting endowment from Brian
        Acton's $50M loan in 2018 <Cite n={13} />. Its tax filings are public
        record <Cite n={14} />.
      </P>
      <P>
        WhatsApp historically charged a $1/year subscription. That was dropped
        after the Facebook acquisition. The product was monetized first
        through "WhatsApp Business" APIs — paid messaging from companies — and
        from June 2025, through advertising in the <em>Updates</em> tab
        (Channels and Status) <Cite n={10} />
        <Cite n={11} />.
      </P>
      <Callout title="What this means for you">
        Free is rarely free. Signal is genuinely free because the people who
        pay for it are donors who don't expect anything back. WhatsApp is
        "free" because someone, somewhere, is paying to influence what you
        see — and the more they know about you, the more they pay.
      </Callout>

      <H2 id="data-shared">5. What gets shared with the government</H2>
      <P>
        Both companies will comply with valid legal process. The difference
        is what they have to hand over.
      </P>
      <P>
        Signal's response to a 2021 subpoena from Santa Clara County
        prosecutors was: account-creation date, last-connected date — that's
        all <Cite n={3} />. The 2016 Eastern District of Virginia subpoena
        produced an almost-identical disclosure <Cite n={2} />.
      </P>
      <P>
        WhatsApp's law-enforcement guide spells out a much fuller menu: basic
        subscriber records and metadata are available with a subpoena;
        message routing data and IP-address logs require a court order;
        message <em>contents</em> require a search warrant — and while the
        contents themselves are encrypted, a 2021 internal FBI document
        leaked to <em>Rolling Stone</em> noted that, uniquely among the
        major encrypted messengers, WhatsApp could supply law enforcement
        with near-real-time metadata about who a target is talking to
        <Cite n={9} />.
      </P>

      <H2 id="phone">6. The phone-number problem (and how each handles it)</H2>
      <P>
        Until 2024 both apps required you to share your phone number with
        every contact you messaged. Signal has since shipped <em>usernames</em>
        as the default discovery mechanism, so you can be reached via{" "}
        <code>@yourhandle</code> instead of leaking your number to strangers
        <Cite n={5} />. WhatsApp still treats your phone number as your
        identity and shares it with anyone you message. There is no
        username-only mode at the time of writing.
      </P>
      <P>
        For people in domestic-abuse situations, journalism, activism, or
        anyone who simply doesn't want to hand a permanent personal
        identifier to a stranger they want to chat with on Marketplace, this
        gap is significant.
      </P>

      <H2 id="features">7. Feature-by-feature comparison</H2>
      <CompareTable
        columns={["Signal", "WhatsApp"]}
        rows={[
          {
            label: "End-to-end encryption (default)",
            cells: ["✅ Yes — Signal Protocol", "✅ Yes — Signal Protocol"],
          },
          {
            label: "Open-source client",
            cells: ["✅ Yes (Android, iOS, desktop)", "❌ No (closed source)"],
          },
          {
            label: "Open-source server",
            cells: ["✅ Yes", "❌ No"],
          },
          {
            label: "Metadata collected",
            cells: [
              "Account creation + last connected",
              "Phone, contacts, IP, device, group membership, behavioural signals",
            ],
          },
          {
            label: "Username instead of phone number",
            cells: ["✅ Yes (since 2024)", "❌ No"],
          },
          {
            label: "End-to-end encrypted backups",
            cells: ["✅ Yes (encrypted by passphrase)", "Optional, off by default"],
          },
          {
            label: "Group calls",
            cells: ["Up to 50 (E2EE)", "Up to 32 (E2EE)"],
          },
          {
            label: "Owner",
            cells: ["Signal Foundation (non-profit)", "Meta Platforms (ad-tech)"],
          },
          {
            label: "Funding model",
            cells: ["Donations + endowment", "Ads (rolling out 2025+) + business APIs"],
          },
          {
            label: "Sealed-sender / metadata-minimizing routing",
            cells: ["✅ Yes", "❌ No"],
          },
        ]}
      />

      <H2 id="switching">8. Should you switch from WhatsApp to Signal?</H2>
      <P>
        For most people, yes — and the cost of switching is lower than it
        sounds. Signal supports group chats, video calls, voice notes,
        stickers, disappearing messages, and a polished desktop app. The
        feature gap that existed in 2017 has effectively closed.
      </P>
      <P>
        The only real friction is{" "}
        <em>"my friends are still on WhatsApp"</em> — which is solved the
        same way every network-effect problem is solved: invite them. The
        average WhatsApp user we've talked to underestimates how many of
        their contacts <em>also</em> have Signal installed and would happily
        switch the conversation over.
      </P>
      <Callout title="When Signal isn't enough">
        Signal still requires a phone number to register, still relies on
        centralized servers in the US, and still creates a metadata trail
        every time you sign up. If your threat model is "a nation-state
        adversary may try to identify <em>that I am a Signal user at all</em>
        ", you should additionally consider Briar (peer-to-peer over Tor) or
        SimpleX (no user identifiers).
      </Callout>

      <H2 id="veilchat">9. Where VeilChat fits in</H2>
      <P>
        We built VeilChat for the people who want Signal-grade privacy{" "}
        <em>without</em> giving up the phone number, and who want the entire
        stack — client, server, crypto layer — to be auditable and
        self-hostable. You sign up with a private ID and a recovery phrase
        that exists only on your device. The server only ever sees opaque
        ciphertext. There are no ads, no premium tiers, and no plans to
        introduce either.
      </P>
      <P>
        We're not asking you to take this on faith. Every line is on{" "}
        <a href="/open-source" className="text-[#2E6F40] underline">
          GitHub
        </a>
        , and our{" "}
        <a href="/encryption" className="text-[#2E6F40] underline">
          encryption page
        </a>{" "}
        walks through exactly what we can and cannot see in plain English.
      </P>

      <H2 id="verdict">10. The honest verdict</H2>
      <P>
        <strong>Signal beats WhatsApp on every privacy dimension that
        matters</strong> — and it's free, polished, and easy enough that
        switching is no longer a sacrifice. If you only do one thing after
        reading this article, install Signal and start migrating your closest
        contacts. You'll get most of the benefit for very little effort.
      </P>
      <P>
        If you want to go further — phone-number-free signup, fully
        self-hostable infrastructure, calmer UI — try{" "}
        <a href="/welcome" className="text-[#2E6F40] underline">
          VeilChat
        </a>
        . Either way, the worst answer is "I'll think about it later". Every
        day you stay on WhatsApp is another day of metadata being added to a
        permanent profile. That's the part you can't take back.
      </P>
    </BlogLayout>
  );
}
