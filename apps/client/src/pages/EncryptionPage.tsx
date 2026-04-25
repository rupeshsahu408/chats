import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AppBar, PrimaryButton } from "../components/Layout";

/**
 * "End-to-end encryption" — the explainer reached from the yellow
 * banner at the top of every chat (and the small pill at the top of
 * every group). Mirrors WhatsApp's "Tap to learn more" page in spirit,
 * but written in VeilChat's voice.
 *
 * The copy intentionally runs long — users tapping this link have
 * opted in to a deeper read. We use plain language, short paragraphs,
 * and a few concrete examples so a non-technical reader still leaves
 * understanding *why* their messages are safe, not just *that* they are.
 */
export function EncryptionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="End-to-end encryption" back={() => navigate(-1)} />

      <div className="flex-1 bg-panel pb-16 w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:shadow-card lg:overflow-hidden">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-9 pb-7 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="mx-auto size-16 rounded-2xl grid place-items-center bg-gradient-to-b from-wa-green to-wa-green-dark text-text-oncolor [box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_4px_12px_rgba(0,168,132,0.32)]">
            <BigLockIcon />
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-wa-green/12 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            <DotPulse /> Private by default
          </div>
          <h2 className="mt-4 text-[26px] font-semibold tracking-tight text-text leading-[1.15] max-w-md mx-auto">
            Your messages are{" "}
            <span className="text-wa-green-dark dark:text-wa-green">
              locked end‑to‑end
            </span>
            .
          </h2>
          <p className="mt-3 text-[14px] text-text-muted leading-relaxed max-w-md mx-auto">
            Every message, photo, voice note and call you send on VeilChat is
            scrambled on your device and only unscrambled on the device of
            the person you sent it to. Nobody in the middle — not your
            internet provider, not the network you're on, not even our
            own servers — can read what's inside.
          </p>
        </div>

        {/* ─── What it actually means ─── */}
        <Section
          eyebrow="01 · The promise"
          title="What end‑to‑end encryption actually means"
        >
          <p>
            "End‑to‑end" means the two ends of the conversation — your
            device and your friend's device — are the only places where
            your message exists in a readable form. The instant you hit
            send, VeilChat seals your message inside a digital envelope that
            can only be opened by the recipient's device. Until it gets
            there, it's gibberish to everyone else.
          </p>
          <p>
            Think of it like a sealed letter that re‑seals itself the
            moment it leaves your hand, and only your friend has the
            key. The post office (us) can carry it across the world,
            but we can't open it, copy it, or even tell what's written
            inside.
          </p>
        </Section>

        {/* ─── How it works ─── */}
        <Section
          eyebrow="02 · How it works"
          title="A quick look under the hood"
          accent
        >
          <p>
            When you create your VeilChat account, your device generates a
            pair of cryptographic keys: a <strong>public key</strong> it
            shares with the world, and a <strong>private key</strong> it
            keeps secret and never sends anywhere. Your friend's device
            does the same.
          </p>
          <p>
            When you send a message, VeilChat uses your friend's public key
            to lock it. Once locked, it can only be unlocked by their
            matching private key — which lives on their device, and
            their device alone. Even if a copy of your message were
            stolen mid‑flight, without that private key it's just
            random noise.
          </p>
          <p>
            For each new chat, the keys also rotate forward. So even if
            someone somehow got hold of an old key in the future, your
            past conversations stay protected. Cryptographers call this{" "}
            <em>forward secrecy</em>; you can just call it peace of mind.
          </p>
        </Section>

        {/* ─── What is and isn't covered ─── */}
        <Section
          eyebrow="03 · What's covered"
          title="The full envelope"
        >
          <BulletList>
            <Bullet ok>Text messages — every word, every emoji.</Bullet>
            <Bullet ok>Photos, videos, files and voice notes.</Bullet>
            <Bullet ok>Replies, reactions, edits and deletes.</Bullet>
            <Bullet ok>Voice and video calls (one‑to‑one and group).</Bullet>
            <Bullet ok>
              Group chats — using per‑sender keys, so each member's
              messages are individually sealed.
            </Bullet>
            <Bullet ok>Disappearing messages and view‑once media.</Bullet>
          </BulletList>
          <p className="mt-4">
            What we <em>can</em> see, by necessity, is the bare minimum
            needed to deliver a message: that something was sent, who it
            was sent to, and roughly when. We can't see what was sent,
            and we delete that delivery metadata as soon as we don't
            need it anymore. The "What we store" page lists every
            single field we hold on our servers.
          </p>
        </Section>

        {/* ─── Why it matters ─── */}
        <Section
          eyebrow="04 · Why it matters"
          title="Privacy isn't paranoia — it's the default"
        >
          <p>
            People send things on a messenger that they would never
            shout across a room: a doctor's note, a bank detail, a
            confession to a friend, a goodnight to their kid. Without
            end‑to‑end encryption, every one of those messages would
            pass through systems that could log them, leak them, or be
            forced to hand them over.
          </p>
          <p>
            With end‑to‑end encryption, that whole category of risk
            simply doesn't exist. We <em>can't</em> read your messages,
            so we can't be bribed, hacked, subpoenaed or pressured into
            handing them over. The mathematics is on your side.
          </p>
        </Section>

        {/* ─── Verifying the lock ─── */}
        <Section
          eyebrow="05 · Trust, but verify"
          title="You don't have to take our word for it"
          accent
        >
          <p>
            Every chat in VeilChat has a <strong>security code</strong> — a
            short fingerprint of the keys you and your friend are
            using. You can compare it in person, over a video call, or
            by scanning a QR code from each other's device. If both
            codes match, you have mathematical proof that nobody has
            slipped in between you.
          </p>
          <p>
            If the code ever changes (for example, if your friend
            reinstalls the app on a new phone), VeilChat will let you know
            so you can verify it again. This protects you against the
            rare but real risk of someone trying to impersonate one
            side of the conversation.
          </p>
          <p>
            And because VeilChat is open source, you don't have to trust
            the description on this page — you can read the actual
            code that does the sealing and unsealing.
          </p>
        </Section>

        {/* ─── Honest limits ─── */}
        <Section
          eyebrow="06 · The honest part"
          title="What encryption can't protect you from"
        >
          <p>
            End‑to‑end encryption protects messages <em>in transit</em>,
            but once a message arrives on a device, the person holding
            that device can see it. So:
          </p>
          <BulletList>
            <Bullet>
              If someone is looking over your shoulder, they can read
              what's on your screen.
            </Bullet>
            <Bullet>
              If someone unlocks your phone, they can open your chats —
              the same way they could open your email or photo gallery.
            </Bullet>
            <Bullet>
              The person you're talking to can always screenshot,
              forward, or simply remember what you wrote.
            </Bullet>
          </BulletList>
          <p className="mt-4">
            That's why VeilChat also gives you tools that go beyond
            encryption: app lock, screenshot blur when the app loses
            focus, disappearing messages, view‑once media and a stealth
            mode. Strong encryption is the floor, not the ceiling.
          </p>
        </Section>

        {/* ─── Closing ─── */}
        <div className="mt-10 px-6 text-center">
          <p className="text-[13.5px] text-text-muted leading-relaxed max-w-md mx-auto">
            Privacy shouldn't be a feature you have to find in a
            settings menu.{" "}
            <span className="text-text">
              On VeilChat, it's the only mode that exists.
            </span>
          </p>
        </div>

        <div className="mt-7 px-4 flex flex-wrap gap-2 justify-center">
          <PrimaryButton onClick={() => navigate("/promises")}>
            Read our promises
          </PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("/what-we-store")}
            className="px-4 py-2.5 rounded-xl bg-surface border border-line text-text text-[13px] font-semibold hover:bg-elevated/60 wa-tap"
          >
            What we store
          </button>
          <button
            type="button"
            onClick={() => navigate("/under-the-hood")}
            className="px-4 py-2.5 rounded-xl bg-surface border border-line text-text text-[13px] font-semibold hover:bg-elevated/60 wa-tap"
          >
            Under the hood
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── building blocks ─────────── */

function Section({
  eyebrow,
  title,
  children,
  accent,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section className="px-4 mt-5">
      <div
        className={
          "rounded-2xl border px-5 py-5 " +
          (accent
            ? "bg-gradient-to-b from-wa-green/[0.10] to-wa-green/[0.04] border-wa-green/30"
            : "bg-surface border-line/60")
        }
      >
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-wa-green-dark dark:text-wa-green tabular-nums">
          {eyebrow}
        </div>
        <h3 className="text-[18px] font-semibold tracking-tight text-text leading-tight mt-1.5">
          {title}
        </h3>
        <div className="mt-3 space-y-3 text-[13.5px] text-text leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="mt-2 space-y-2">{children}</ul>;
}

function Bullet({ children, ok }: { children: ReactNode; ok?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px] text-text leading-relaxed">
      {ok ? <CheckIcon /> : <DotIcon />}
      <span>{children}</span>
    </li>
  );
}

function DotPulse() {
  return (
    <span className="relative inline-flex">
      <span className="absolute inset-0 rounded-full bg-wa-green/40 animate-ping" />
      <span className="relative size-1.5 rounded-full bg-wa-green" />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-wa-green-dark dark:text-wa-green mt-0.5 shrink-0"
    >
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

function DotIcon() {
  return (
    <span className="mt-[7px] size-1.5 rounded-full bg-text-muted shrink-0" />
  );
}

function BigLockIcon() {
  return (
    <svg
      width="28"
      height="32"
      viewBox="0 0 28 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 14V10a8 8 0 1 1 16 0v4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <rect
        x="3"
        y="14"
        width="22"
        height="16"
        rx="4"
        fill="currentColor"
        opacity="0.98"
      />
      <circle cx="14" cy="21" r="2.2" fill="white" opacity="0.95" />
      <rect
        x="12.9"
        y="21.5"
        width="2.2"
        height="4.4"
        rx="1"
        fill="white"
        opacity="0.95"
      />
    </svg>
  );
}
