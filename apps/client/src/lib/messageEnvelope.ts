/**
 * Wire envelope used as the *plaintext* of every Signal-encrypted chat
 * message. Lets us send text, image, or voice through the same Double
 * Ratchet pipeline without needing a separate transport for media.
 *
 *   v1 envelope = JSON object on a single line.
 *
 *   { v: 1, t: "text",  body: "hello" }
 *   { v: 1, t: "image", body?: "caption", media: { ... } }
 *   { v: 1, t: "voice", media: { ... } }
 *
 * For backwards compatibility, an incoming plaintext that isn't valid
 * envelope JSON is treated as a v0 plain text message.
 */

import type { MediaAttachment } from "./media";

export type ChatEnvelope =
  | { v: 1; t: "text"; body: string }
  | { v: 1; t: "image"; body?: string; media: MediaAttachment }
  | { v: 1; t: "voice"; media: MediaAttachment };

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
    if (parsed && parsed.v === 1) {
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
  if (env.t === "text") return env.body;
  if (env.t === "image") return env.body ? `📷 ${env.body}` : "📷 Photo";
  if (env.t === "voice") return "🎤 Voice message";
  return "";
}
