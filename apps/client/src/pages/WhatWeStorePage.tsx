import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { AppBar } from "../components/Layout";

/**
 * What we store — radical transparency about exactly what fields exist
 * in Veil's server database, what is encrypted, and what is plaintext.
 *
 * This page is intentionally honest about metadata: the server *does*
 * see who you talk to and when, even though it never sees what you
 * said. Hiding that would be dishonest; surfacing it is the move that
 * earns trust.
 *
 * Source of truth: apps/server/src/db/schema.ts. Update both when the
 * schema changes.
 */
export function WhatWeStorePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="What we store" back={() => navigate(-1)} />

      <div className="flex-1 bg-panel pb-10 w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:shadow-card lg:overflow-hidden">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-7 pb-5 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            ✦ Field-by-field
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text leading-tight">
            Every field, on the record
          </h2>
          <p className="mt-2 text-[13px] text-text-muted leading-relaxed max-w-md mx-auto">
            This is exactly what lives in Veil's database. We separate
            ciphertext (we can't read it) from plaintext metadata (we
            can). Knowing the difference is the whole point.
          </p>
        </div>

        <Legend />

        {/* ─── Account ─── */}
        <Group
          title="Your account"
          intro="One row per user. Required to route messages and let people add you."
        >
          <Row tone="plain" name="username" desc="Public handle, e.g. @yourname." />
          <Row tone="plain" name="display name, bio, avatar" desc="If you set them. Shown in chat headers." />
          <Row tone="plain" name="public identity keys" desc="Ed25519 + X25519. Other users need these to start an encrypted session." />
          <Row tone="hashed" name="email or phone" desc="If you signed up with one — we keep an HMAC fingerprint, not the address itself." />
          <Row tone="hashed" name="password" desc="Argon2id hash. Even an attacker with a database dump can't recover the password." />
          <Row tone="plain" name="account created at, last seen at" desc='"Last seen" follows your privacy setting (everyone / contacts / nobody).' />
          <Row tone="never" name="your real name, address, IP history" desc="We never collect them and there are no fields for them." />
        </Group>

        {/* ─── Messages ─── */}
        <Group
          title="Your messages"
          intro="One row per delivered message. Hard-deleted after delivery + your retention window."
        >
          <Row tone="cipher" name="message body" desc="AES-256-GCM ciphertext. The server has no way to decrypt this." />
          <Row tone="cipher" name="ratchet header" desc="Encrypted Signal-protocol metadata (counters, ephemeral key)." />
          <Row tone="meta" name="sender + recipient user IDs" desc="Required to route the envelope to the right inbox." />
          <Row tone="meta" name="conversation ID" desc="A canonical pair-of-IDs string, so your devices can fetch one thread efficiently." />
          <Row tone="meta" name="created / delivered / read timestamps" desc='Power "sent · delivered · read" indicators. Read receipts honour your privacy setting.' />
          <Row tone="meta" name="expires at" desc="If you turned on disappearing messages, the row is hard-deleted at this time." />
          <Row tone="never" name="message text, attachments, reactions" desc="Stored only as ciphertext above. Never as plaintext, ever." />
        </Group>

        {/* ─── Media ─── */}
        <Group
          title="Photos, voice notes, files"
          intro="Stored as opaque ciphertext blobs in object storage, with a small DB row pointing at them."
        >
          <Row tone="cipher" name="the file itself" desc="AES-GCM ciphertext in R2 storage. Decryption key travels inside an encrypted message — the server never holds it." />
          <Row tone="meta" name="owner user ID, size in bytes, mime hint" desc={`The mime is a hint chosen by the uploader (e.g. "image/jpeg"); we don't inspect bytes.`} />
          <Row tone="meta" name="created at, expires at" desc="Default 24-hour TTL. The sweeper deletes the blob and the row when it expires." />
          <Row tone="never" name="thumbnails, previews, content scans" desc="There is no server-side preview pipeline. We can't generate one — we can't decrypt the file." />
        </Group>

        {/* ─── Prekeys ─── */}
        <Group
          title="Prekeys"
          intro="Tiny public keys we hand out when someone wants to start a new conversation with you."
        >
          <Row tone="plain" name="signed prekey (one)" desc="Long-lived, signed by your identity key. Used in X3DH handshakes." />
          <Row tone="plain" name="one-time prekeys (a small pool)" desc="Each one is consumed by exactly one new conversation, then deleted server-side." />
          <Row tone="never" name="any private key, ever" desc="All private keys are derived from your recovery phrase and stay on your device." />
        </Group>

        {/* ─── Connections + push ─── */}
        <Group
          title="Connections & notifications"
          intro="Just enough state to deliver pushes and let you build a contact list."
        >
          <Row tone="plain" name="who you're connected to" desc="A row per accepted contact. Required so unknown users can't message you." />
          <Row tone="plain" name="invite tokens you generated" desc="Random short codes. Expire automatically; revoked when used." />
          <Row tone="plain" name="push subscription endpoints" desc="The browser-issued URL we POST to when a new message arrives. The push payload itself contains no message text." />
          <Row tone="never" name="your contact list" desc="Phone-book matching uses a peppered hash exchange — neither side learns the other's address book." />
        </Group>

        {/* ─── Things we deliberately don't have ─── */}
        <SectionHeader>Things we deliberately don't have</SectionHeader>
        <div className="mx-4 veil-card shadow-card divide-y divide-line/40">
          <NeverRow text="No analytics SDK, no third-party scripts." />
          <NeverRow text="No advertising IDs, no behavioural profiles." />
          <NeverRow text="No device fingerprinting beyond what your browser sends to load a webpage." />
          <NeverRow text="No backups of your chats on our servers — they live only on your devices." />
          <NeverRow text="No way for us to read your messages, even if a court demanded it. We literally don't have the keys." />
        </div>

        <p className="px-6 pt-7 text-[11px] text-text-faint text-center leading-relaxed">
          Schema source of truth lives at{" "}
          <span className="font-mono">apps/server/src/db/schema.ts</span> in
          our repo. If you find a gap between this page and reality, it's
          a bug — please tell us.
        </p>
      </div>
    </div>
  );
}

/* ───────────── sub-components ───────────── */

type Tone = "cipher" | "plain" | "hashed" | "meta" | "never";

const TONE_META: Record<
  Tone,
  { label: string; cls: string; dotCls: string }
> = {
  cipher: {
    label: "Encrypted",
    cls: "bg-wa-green/15 text-wa-green-dark dark:text-wa-green",
    dotCls: "bg-wa-green",
  },
  hashed: {
    label: "Hashed",
    cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    dotCls: "bg-sky-500",
  },
  plain: {
    label: "Plaintext",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dotCls: "bg-amber-500",
  },
  meta: {
    label: "Metadata",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dotCls: "bg-amber-500",
  },
  never: {
    label: "Not stored",
    cls: "bg-text-faint/15 text-text-muted",
    dotCls: "bg-text-faint",
  },
};

function Legend() {
  return (
    <div className="mx-4 mt-2 grid grid-cols-2 gap-2">
      <LegendChip tone="cipher" desc="We can't read it" />
      <LegendChip tone="hashed" desc="One-way hash only" />
      <LegendChip tone="meta" desc="Server can see this" />
      <LegendChip tone="never" desc="Not collected at all" />
    </div>
  );
}

function LegendChip({ tone, desc }: { tone: Tone; desc: string }) {
  const meta = TONE_META[tone];
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 flex items-center gap-2">
      <span className={"size-1.5 rounded-full " + meta.dotCls} />
      <div className="min-w-0 leading-tight">
        <div className="text-[11.5px] font-semibold text-text">
          {meta.label}
        </div>
        <div className="text-[10.5px] text-text-faint truncate">{desc}</div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-6 pb-2 text-[11px] uppercase tracking-widest text-text-muted font-semibold">
      {children}
    </div>
  );
}

function Group({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SectionHeader>{title}</SectionHeader>
      <div className="px-5 -mt-1 mb-2 text-[12px] text-text-faint leading-snug">
        {intro}
      </div>
      <div className="mx-4 veil-card shadow-card divide-y divide-line/40">
        {children}
      </div>
    </>
  );
}

function Row({
  tone,
  name,
  desc,
}: {
  tone: Tone;
  name: string;
  desc: string;
}) {
  const meta = TONE_META[tone];
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-text">{name}</div>
          <div className="text-[12px] text-text-muted mt-0.5 leading-snug">
            {desc}
          </div>
        </div>
        <span
          className={
            "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider " +
            meta.cls
          }
        >
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function NeverRow({ text }: { text: string }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="shrink-0 mt-0.5 size-7 rounded-full bg-wa-green/12 text-wa-green-dark dark:text-wa-green grid place-items-center">
        <svg
          viewBox="0 0 24 24"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </div>
      <div className="text-[13px] text-text leading-snug">{text}</div>
    </div>
  );
}
