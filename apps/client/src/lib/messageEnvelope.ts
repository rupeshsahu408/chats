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

export interface EnvelopeExtras {
  /** Disappearing-message TTL, seconds. */
  ttl?: number;
  /** View-once. */
  vo?: boolean;
  /** Link preview metadata. */
  lp?: EnvelopeLinkPreview;
}

export type ChatEnvelope =
  | ({ v: 1 | 2; t: "text"; body: string } & EnvelopeExtras)
  | ({ v: 1 | 2; t: "image"; body?: string; media: MediaAttachment } & EnvelopeExtras)
  | ({ v: 1 | 2; t: "voice"; media: MediaAttachment } & EnvelopeExtras);

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
    }
  } catch {
    /* fall through to plain text */
  }
  return { v: 1, t: "text", body: plaintext };
}

export function envelopePreview(env: ChatEnvelope): string {
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
