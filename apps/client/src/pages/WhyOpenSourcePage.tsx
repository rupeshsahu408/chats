import {
  BlogLayout,
  Cite,
  H2,
  H3,
  P,
  Callout,
  type BlogSource,
  type BlogTocItem,
} from "../components/BlogLayout";
import { useDocumentMeta, SEO_SITE_URL } from "../lib/useDocumentMeta";

const SOURCES: BlogSource[] = [
  { n: 1, title: "Reflections on Trusting Trust", publisher: "Ken Thompson, Communications of the ACM", url: "https://dl.acm.org/doi/10.1145/358198.358210", date: "Aug 1984" },
  { n: 2, title: "Heartbleed Bug — official advisory", publisher: "Codenomicon / OpenSSL", url: "https://heartbleed.com/", date: "Apr 2014" },
  { n: 3, title: "log4shell (CVE-2021-44228)", publisher: "Apache Software Foundation", url: "https://logging.apache.org/log4j/2.x/security.html", date: "Dec 2021" },
  { n: 4, title: "Signal Source Code", publisher: "GitHub", url: "https://github.com/signalapp" },
  { n: 5, title: "Threema open-sources its apps", publisher: "Threema Blog", url: "https://threema.ch/en/blog/posts/threema-open-source-und-multi-device", date: "Dec 2020" },
  { n: 6, title: "WhatsApp client source code policy", publisher: "Meta", url: "https://github.com/WhatsApp" },
  { n: 7, title: "Reproducible Builds project", publisher: "reproducible-builds.org", url: "https://reproducible-builds.org/" },
  { n: 8, title: "TextSecure: A Security Analysis", publisher: "Frosch et al., IEEE Security & Privacy", url: "https://www.ieee-security.org/TC/EuroSP2016/papers/16-Frosch.pdf", date: "2016" },
  { n: 9, title: "On Post-Compromise Security", publisher: "Cohn-Gordon, Cremers, Garratt", url: "https://eprint.iacr.org/2016/221.pdf", date: "2016" },
  { n: 10, title: "Audit of Cryptocat by iSEC Partners", publisher: "Cryptocat / iSEC Partners", url: "https://www.nccgroup.com/us/research-blog/cryptocat-2-audit/", date: "2013" },
  { n: 11, title: "Pegasus spyware — The Citizen Lab", publisher: "The Citizen Lab", url: "https://citizenlab.ca/category/research/targeted-threats/" },
  { n: 12, title: "ProtonMail open-sources its iOS app", publisher: "Proton Blog", url: "https://proton.me/blog/ios-open-source", date: "Apr 2019" },
  { n: 13, title: "Mozilla Manifesto", publisher: "Mozilla", url: "https://www.mozilla.org/en-US/about/manifesto/" },
  { n: 14, title: "Apple iOS Security Guide", publisher: "Apple", url: "https://support.apple.com/guide/security/welcome/web" },
  { n: 15, title: "F-Droid — Free and Open Source Android Apps", publisher: "F-Droid Project", url: "https://f-droid.org/" },
  { n: 16, title: "OpenSSL post-Heartbleed audit", publisher: "Linux Foundation Core Infrastructure Initiative", url: "https://www.linuxfoundation.org/about/projects" },
  { n: 17, title: "WhatsApp end-to-end encryption white paper", publisher: "WhatsApp", url: "https://www.whatsapp.com/security/" },
  { n: 18, title: "Telegram Privacy Policy", publisher: "Telegram", url: "https://telegram.org/privacy" },
  { n: 19, title: "Why we keep Wire open source", publisher: "Wire Blog", url: "https://wire.com/en/blog" },
  { n: 20, title: "Signal Protocol Documentation", publisher: "Signal", url: "https://signal.org/docs/" },
];

const TOC: BlogTocItem[] = [
  { id: "tldr", label: "TL;DR — why bother caring?" },
  { id: "trust-claim", label: "1. The difference between a claim and a proof" },
  { id: "trusting-trust", label: "2. The Reflections-on-Trusting-Trust problem" },
  { id: "audits", label: "3. Audits, in public, again, again, again" },
  { id: "history", label: "4. A short history of bugs caught by openness" },
  { id: "reproducible", label: "5. Reproducible builds — the next layer" },
  { id: "objections", label: "6. The honest counter-arguments" },
  { id: "license", label: "7. Open source ≠ free for the taking" },
  { id: "signals", label: "8. How to tell real openness from openwashing" },
  { id: "veilchat", label: "9. How VeilChat handles this" },
  { id: "verdict", label: "10. The verdict" },
];

export function WhyOpenSourcePage() {
  const TITLE = "Why open source matters in private messaging (2026)";
  const DESC =
    "If you can't read the code, the only thing standing between you and a marketing-claim privacy app is trust. Open source replaces that trust with proof. Here's why it matters more in messaging than in any other category.";

  useDocumentMeta({
    title: `${TITLE} | VeilChat`,
    description: DESC,
    canonical: "/blog/why-open-source-matters-in-messaging",
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESC,
      image: `${SEO_SITE_URL}/og-image.png`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SEO_SITE_URL}/blog/why-open-source-matters-in-messaging`,
      },
      author: { "@type": "Organization", name: "VeilChat" },
      publisher: {
        "@type": "Organization",
        name: "VeilChat",
        logo: { "@type": "ImageObject", url: `${SEO_SITE_URL}/icon-512.svg` },
      },
      inLanguage: "en",
      datePublished: "2026-03-08",
      dateModified: "2026-04-29",
      keywords:
        "open source messenger, why open source matters, encrypted messaging, code audit, reproducible builds, Signal, VeilChat, software trust",
    },
  });

  return (
    <BlogLayout
      slug="why-open-source-matters-in-messaging"
      badge="Essay · Updated 2026"
      title={
        <>
          Why{" "}
          <span className="italic" style={{ color: "#2E6F40" }}>
            open source
          </span>{" "}
          matters in private messaging
        </>
      }
      lead={
        <>
          <p>
            Every messaging app on your phone makes the same promise. "Your
            messages are end-to-end encrypted. Only you and the person you
            are messaging can read them." It's the same sentence, on every
            marketing page, in every privacy policy.
          </p>
          <p>
            The question is: <em>do you have any way to verify that?</em> If
            the answer is no — if the only thing standing between you and a
            marketing claim is trust — you're not buying privacy. You're
            buying a brand. Open source is what turns the brand back into a
            verifiable promise.
          </p>
        </>
      }
      readingMinutes={11}
      toc={TOC}
      sources={SOURCES}
      related={[
        {
          href: "/blog/best-encrypted-messengers-2026",
          title: "Best end-to-end encrypted messengers in 2026",
          description:
            "An independent ranking of the top private messengers in 2026 — and what to skip.",
        },
        {
          href: "/blog/signal-vs-whatsapp",
          title: "Signal vs WhatsApp — which one is actually private?",
          description:
            "Same encryption protocol. Wildly different surrounding systems.",
        },
      ]}
    >
      <H2 id="tldr">TL;DR — why bother caring?</H2>
      <ul className="mt-4 space-y-2 list-disc list-inside marker:text-[#2E6F40]">
        <li>
          <strong>Closed source = take our word for it.</strong> The company
          says they don't read your messages. You have no way to check.
        </li>
        <li>
          <strong>Open source = anyone can check, and many people have.</strong>{" "}
          Independent academics <Cite n={8} />, security firms <Cite n={10} />
          , and individual researchers can — and do — audit the code line by
          line. This is uniquely important for messaging because the entire
          product <em>is</em> a security claim.
        </li>
        <li>
          <strong>Reproducible builds &gt; "trust me bro" builds.</strong>{" "}
          Open source plus reproducible builds means the binary on your
          phone provably matches the source code on GitHub <Cite n={7} />.
        </li>
        <li>
          The major bugs in cryptographic software in the last decade —
          Heartbleed <Cite n={2} />, log4shell <Cite n={3} /> — were caught
          and fixed because the code was open.
        </li>
      </ul>

      <H2 id="trust-claim">1. The difference between a claim and a proof</H2>
      <P>
        WhatsApp's published end-to-end encryption white paper <Cite n={17} />
        describes a perfectly reasonable cryptographic design. Signal's
        protocol documentation <Cite n={20} /> describes essentially the
        same one. Both papers, on paper, are excellent.
      </P>
      <P>
        But a paper is not a program. The program is the code that actually
        runs on your phone. With Signal, that code is on GitHub <Cite n={4} />
         and matches the paper. With WhatsApp, the code is in a binary that
        Meta ships every two weeks <Cite n={6} /> and no one outside Meta
        has read line-for-line. The marketing page is the same. The
        verifiability is not.
      </P>
      <Callout title="Why messaging is different from other apps">
        For most apps, "trust me" is a reasonable default. If a calculator
        secretly logs your inputs, the worst case is mildly creepy. In a
        messaging app, the inputs <em>are</em> the most personal and
        consequential things you'll write that month — to your partner,
        your doctor, your lawyer, your dissident friend. The cost of being
        wrong is asymmetric.
      </Callout>

      <H2 id="trusting-trust">2. The Reflections-on-Trusting-Trust problem</H2>
      <P>
        In 1984 Ken Thompson — yes, the inventor of Unix — gave a famous
        Turing Award lecture called <em>Reflections on Trusting Trust</em>
        <Cite n={1} />. The argument, in one sentence: even if you read every
        line of source code, you still have to trust the compiler that
        turned that source into the program on your machine. And you have
        to trust the compiler that compiled <em>that</em> compiler. And so
        on, all the way down.
      </P>
      <P>
        This is a real problem, and there is no clean solution to it. But
        open source is the <em>floor</em> of the problem, not the ceiling.
        With closed source you don't even have the option of inspection.
        With open source you can:
      </P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>Read the code yourself.</li>
        <li>
          Run a reproducible build that <em>proves</em> the binary on your
          phone came from that exact source <Cite n={7} />.
        </li>
        <li>
          Compile and run your own build, bypassing the company entirely.
        </li>
      </ol>
      <P>
        Closed source removes all three options at once. You're left
        squinting at marketing copy.
      </P>

      <H2 id="audits">3. Audits, in public, again, again, again</H2>
      <P>
        Open-source messengers get audited continuously, by people the
        company doesn't pay. The Signal protocol has been the subject of
        peer-reviewed academic papers in IEEE Security &amp; Privacy
        <Cite n={8} /> and at IACR conferences <Cite n={9} />. Cryptocat,
        when it shipped its second version, had a public audit by iSEC
        Partners <Cite n={10} />. Threema commissioned and published full
        third-party audits when it open-sourced its apps <Cite n={5} />.
      </P>
      <P>
        Audits of closed-source messengers, by contrast, are rare and
        narrow. They're usually under NDA, the report is private, and the
        scope is whatever the vendor chose to put in front of the auditor.
        That's still better than nothing — but it's not the same thing as
        the entire internet being able to look.
      </P>

      <H2 id="history">4. A short history of bugs caught by openness</H2>
      <H3>Heartbleed (2014)</H3>
      <P>
        A two-line bug in OpenSSL allowed any attacker to read 64KB of
        private memory from millions of servers — including, in some cases,
        private TLS keys <Cite n={2} />. The bug had been in the wild for
        two years before being noticed. It was found by a Google engineer
        and a Codenomicon researcher reading the source code{" "}
        <em>independently</em> and within days of each other. After the
        fix, the Linux Foundation set up the{" "}
        <em>Core Infrastructure Initiative</em> to fund continuous audits
        of critical open-source projects <Cite n={16} />. None of that
        would have been possible if OpenSSL had been closed source.
      </P>
      <H3>log4shell (2021)</H3>
      <P>
        A remote-code-execution bug in the log4j logging library — a
        dependency in millions of Java applications — was discovered by an
        Alibaba security researcher reading the open-source code
        <Cite n={3} />. The fix was published within days; closed-source
        equivalents would have taken much longer to surface, if they ever
        did.
      </P>
      <H3>Pegasus and the encrypted-messenger ecosystem</H3>
      <P>
        The Citizen Lab's ongoing research into Pegasus, Predator and
        Graphite spyware <Cite n={11} /> is possible only because the
        targeted apps' code is auditable. When researchers can see how a
        legitimate Signal client behaves, they can detect the moment it
        starts behaving like an instrumented one.
      </P>

      <H2 id="reproducible">5. Reproducible builds — the next layer</H2>
      <P>
        Open source by itself is necessary but not sufficient. The bytes on
        your phone are produced by a build process — and a malicious build
        server could quietly insert backdoors that aren't in the source.
        That's where <strong>reproducible builds</strong> come in: the
        build process is deterministic, so anyone can re-run it from the
        public source and confirm they got the same binary the company is
        shipping <Cite n={7} />.
      </P>
      <P>
        F-Droid, the open-source Android app store, requires reproducible
        builds for many of its apps for exactly this reason <Cite n={15} />.
        It's the difference between "the source is open" and "the binary
        you're running provably came from that open source".
      </P>

      <H2 id="objections">6. The honest counter-arguments</H2>
      <H3>"Most users will never read the code."</H3>
      <P>
        Correct — and irrelevant. The point of open source isn't that{" "}
        <em>you</em> personally read the code. It's that <em>someone you
        will never meet</em> read it, and would have published a blog post
        about it the moment they found something wrong. The aggregate
        oversight is the product.
      </P>
      <H3>"Closed-source apps from big companies have huge security teams."</H3>
      <P>
        Also correct, and also not enough. Apple's iOS security guide
        <Cite n={14} /> describes a genuinely impressive engineering effort.
        But <em>genuinely impressive</em> isn't the same as{" "}
        <em>independently verifiable</em>. Trust in a company is a function
        of who's running the company today. Code is permanent.
      </P>
      <H3>"Open source means attackers can read the code too."</H3>
      <P>
        This is the oldest objection in security and it's been disproved for
        forty years. Cryptography is built on Kerckhoffs's principle —{" "}
        <em>the security of a system should depend only on the secrecy of
        the key, not the algorithm</em>. If your messaging app stops being
        secure the moment someone reads its source, it was never secure to
        begin with.
      </P>

      <H2 id="license">7. Open source ≠ free for the taking</H2>
      <P>
        Open source is about <em>verifiability</em>, not about giving away
        the product. Signal is free because the Foundation is a non-profit;
        Threema is paid and open source <Cite n={5} />; ProtonMail is paid
        and open source <Cite n={12} />. You can absolutely build a
        sustainable business around open code — Wire is the standing example
        in our category <Cite n={19} />.
      </P>

      <H2 id="signals">8. How to tell real openness from openwashing</H2>
      <P>Look for all of the following:</P>
      <ol className="mt-4 space-y-2 list-decimal list-inside marker:text-[#2E6F40]">
        <li>
          <strong>The whole stack is open</strong> — client <em>and</em>{" "}
          server <em>and</em> crypto layer. Some apps publish only the
          client and call themselves "open source"; the server is where
          most metadata lives.
        </li>
        <li>
          <strong>The repo is updated as the app updates.</strong> If
          GitHub is six months behind the App Store, you're auditing
          fiction.
        </li>
        <li>
          <strong>The license is permissive enough to actually use</strong>{" "}
          (MIT, Apache 2.0, AGPLv3, GPLv3 — anything OSI-approved).
        </li>
        <li>
          <strong>External, named audits</strong> are published, ideally
          annually.
        </li>
        <li>
          <strong>Reproducible builds</strong>, or at the very least, a
          public, scriptable build pipeline.
        </li>
      </ol>

      <H2 id="veilchat">9. How VeilChat handles this</H2>
      <P>
        Every line of VeilChat — client, server, crypto layer — is on{" "}
        <a href="/open-source" className="text-[#2E6F40] underline">
          GitHub
        </a>{" "}
        under a permissive license. The build process is published; the
        cryptographic primitives are standard, peer-reviewed designs (X25519
        for keys, AES-GCM for content, Ed25519 for signatures, the Signal
        Protocol for sessions). Our <a href="/encryption" className="text-[#2E6F40] underline">encryption page</a> walks through exactly what the
        server can and cannot see, in plain English.
      </P>
      <P>
        We don't ask you to take any of this on trust. You can clone the
        repo, run the build, point it at our server, and verify for
        yourself.
      </P>

      <H2 id="verdict">10. The verdict</H2>
      <P>
        Open source isn't a marketing checkbox. In a category whose entire
        value proposition is <em>"only you and the people you talk to can
        read this"</em>, it's the only thing that turns the claim into a
        proof.
      </P>
      <P>
        If a messenger isn't open source — client and server — and isn't
        publishing audits, treat its privacy claims as a marketing brochure.
        It might be a good marketing brochure! But that's not the same as
        privacy.
      </P>
      <P>
        For a messenger that <em>is</em> verifiable, end to end, install{" "}
        <a href="/welcome" className="text-[#2E6F40] underline">
          VeilChat
        </a>{" "}
        — or, if you prefer the larger network, install{" "}
        <a
          href="https://signal.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2E6F40] underline"
        >
          Signal
        </a>
        . Either way, pick something whose privacy promise can survive a
        cold reading by a stranger with a code editor.
      </P>
    </BlogLayout>
  );
}
