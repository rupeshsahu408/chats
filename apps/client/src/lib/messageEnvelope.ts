/**
 * Wire envelope used as the *plaintext* of every Signal-encrypted chat
 * message. Lets us send text, image, voice, view-once media or a link
 * preview through the same Double Ratchet pipeline without needing a
 * separate transport per type.
 *
 *   v1 envelope = JSON object on a single line.
 *
 *     { v: 1, t: "text",  body: "hello" }
 *     { v: 1, t: "image", body?: "caption", media: { ... } }
 *     { v: 1, t: "voice", media: { ... } }
 *
 *   v2 envelope = same union plus optional fields:
 *     - `ttl`: disappearing-message TTL in seconds (mirrored to server)
 *     - `vo`:  view-once flag (client deletes after first view)
 *     - `lp`:  link preview (server-fetched OG metadata)
 *
 * For backwards compatibility, an incoming plaintext that isn't valid
 * envelope JSON is treated as a v0 plain text message.
 */

import type { MediaAttachment } from "./media";

export interface EnvelopeLinkPreview {
  url: string;
  resolvedUrl?: string | null;
  title?: string | null;
  description?: string | null;
  siteName?: string | null;
  imageUrl?: string | null;
}

/**
 * Reply reference attached to a chat envelope. Points at the original
 * message by its server id and includes a short snippet so the
 * recipient can render the quoted preview without needing the original
 * decrypted message in their local log (useful on a fresh device).
 */
export interface EnvelopeReplyRef {
  /** Server message id of the message being replied to. */
  id: string;
  /** Short preview of the quoted body (≤ 140 chars). */
  body: string;
  /**
   * Direction of the quoted message *from the sender's POV*. Receiver
   * mirrors it: my-out = peer's "in", my-in = peer's "out".
   */
  dir: "in" | "out";
}

export interface EnvelopeExtras {
  /** Disappearing-message TTL, seconds. */
  ttl?: number;
  /** View-once. */
  vo?: boolean;
  /** Link preview metadata. */
  lp?: EnvelopeLinkPreview;
  /** Reply-to reference. */
  re?: EnvelopeReplyRef;
}

/**
 * Phase 7: Sender-Key Distribution Message — sent through the existing
 * 1:1 ratchet to share a per-(group, epoch) chain key. Recipients store
 * the chainKey indexed by (groupId, senderUserId, epoch); subsequent
 * group messages from that sender are decryptable.
 */
export type SenderKeyDistribution = {
  v: 2;
  t: "skdm";
  /** Group id. */
  gid: string;
  /** Group epoch this key is valid for. */
  ep: number;
  /** Base64 32-byte initial chain key. */
  ck: string;
} & EnvelopeExtras;

/**
 * Tombstone sent through the ratchet when the sender hits "Delete for
 * everyone". The receiver replaces their local row for `target` with a
 * "This message was deleted" placeholder; the server-side ciphertext
 * is also wiped via `messages.deleteForEveryone`.
 */
export type DeleteForEveryone = {
  v: 2;
  t: "del";
  /** Server message id of the original message being unsent. */
  target: string;
};

/**
 * Reaction add/remove. Empty `emoji` means "remove my reaction".
 * Reactions are stored as a per-(message, sender) single emoji slot to
 * match WhatsApp's behaviour.
 */
export type ReactionEnvelope = {
  v: 2;
  t: "rxn";
  /** Server message id of the message being reacted to. */
  target: string;
  /** Single emoji grapheme; empty string clears the reaction. */
  emoji: string;
};

/**
 * Edit a previously-sent text message. Sender stamps the new body and
 * an `editedAt` timestamp; the recipient overwrites the local row's
 * `plaintext` and shows an "(edited)" marker.
 *
 * WhatsApp limits edits to ~15 minutes after send; we mirror that on
 * the client UI but do not enforce it server-side (the server never
 * sees the body so it cannot validate).
 */
export type EditMessage = {
  v: 2;
  t: "edit";
  /** Server message id of the original message being edited. */
  target: string;
  /** New text body (replaces the original `body`). */
  body: string;
  /** ISO timestamp of when the edit was made. */
  editedAt: string;
};

export type ChatEnvelope =
  | ({ v: 1 | 2; t: "text"; body: string } & EnvelopeExtras)
  | ({ v: 1 | 2; t: "image"; body?: string; media: MediaAttachment } & EnvelopeExtras)
  | ({ v: 1 | 2; t: "voice"; media: MediaAttachment } & EnvelopeExtras)
  | SenderKeyDistribution
  | DeleteForEveryone
  | ReactionEnvelope
  | EditMessage;

export function encodeEnvelope(env: ChatEnvelope): string {
  return JSON.stringify(env);
}

export function decodeEnvelope(plaintext: string): ChatEnvelope {
  if (!plaintext.startsWith("{")) {
    return { v: 1, t: "text", body: plaintext };
  }
  try {
    const parsed = JSON.parse(plaintext) as Partial<ChatEnvelope> & {
      v?: number;
      t?: string;
    };
    if (parsed && (parsed.v === 1 || parsed.v === 2)) {
      if (parsed.t === "text" && typeof (parsed as { body?: unknown }).body === "string") {
        return parsed as ChatEnvelope;
      }
      if (
        (parsed.t === "image" || parsed.t === "voice") &&
        (parsed as { media?: unknown }).media &&
        typeof ((parsed as { media: { blobId?: unknown } }).media.blobId) === "string"
      ) {
        return parsed as ChatEnvelope;
      }
      if (
        parsed.t === "skdm" &&
        typeof (parsed as { gid?: unknown }).gid === "string" &&
        typeof (parsed as { ep?: unknown }).ep === "number" &&
        typeof (parsed as { ck?: unknown }).ck === "string"
      ) {
        return parsed as ChatEnvelope;
      }
      if (
        parsed.t === "del" &&
        typeof (parsed as { target?: unknown }).target === "string"
      ) {
        return parsed as ChatEnvelope;
      }
      if (
        parsed.t === "rxn" &&
        typeof (parsed as { target?: unknown }).target === "string" &&
        typeof (parsed as { emoji?: unknown }).emoji === "string"
      ) {
        return parsed as ChatEnvelope;
      }
      if (
        parsed.t === "edit" &&
        typeof (parsed as { target?: unknown }).target === "string" &&
        typeof (parsed as { body?: unknown }).body === "string" &&
        typeof (parsed as { editedAt?: unknown }).editedAt === "string"
      ) {
        return parsed as ChatEnvelope;
      }
    }
  } catch {
    /* fall through to plain text */
  }
  return { v: 1, t: "text", body: plaintext };
}

export function envelopePreview(env: ChatEnvelope): string {
  if (env.t === "skdm") return "";
  if (env.t === "del") return "🗑 Message deleted";
  if (env.t === "rxn") return env.emoji ? `Reacted ${env.emoji}` : "";
  if (env.t === "edit") return env.body;
  if (env.t !== "text" && env.t !== "image" && env.t !== "voice") return "";
  if (env.vo) return "👁 View-once message";
  if (env.t === "text") return env.body;
  if (env.t === "image") return env.body ? `📷 ${env.body}` : "📷 Photo";
  if (env.t === "voice") return "🎤 Voice message";
  return "";
}

/** First http(s) URL in a string, or null. */
export function firstUrl(s: string): string | null {
  const m = /https?:\/\/[^\s<>()]+/i.exec(s);
  return m ? m[0].replace(/[).,;!?"']+$/, "") : null;
}
