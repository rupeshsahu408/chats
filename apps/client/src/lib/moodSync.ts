/**
 * Broadcast the current user's mood / status to every 1:1 connection.
 *
 * Each peer receives a `MoodEnvelope` through the normal Signal ratchet
 * — the server only sees ciphertext, just like a regular message. The
 * envelope is a side-effect (no chat row), and the recipient mirrors
 * it onto `chatPrefs.peerMood` via the side-effect handler in
 * messageSync.ts.
 *
 * Empty `text` + empty `emoji` is the agreed-upon "clear my mood"
 * signal — peers drop their cached `peerMood` field.
 */

import type { UnlockedIdentity } from "./signal/session";
import { encryptToPeer } from "./signal/session";
import { encodeEnvelope, type MoodEnvelope } from "./messageEnvelope";
import { trpcClientProxy } from "./trpcClientProxy";
import { setUserPrefs, getUserPrefs } from "./db";

export interface MoodPayload {
  emoji: string;
  text: string;
  /** Milliseconds from now until auto-expiry. */
  ttlMs: number;
}

/**
 * Persist + broadcast a mood. Returns the resolved
 * `expiresAt` (ISO) so callers can render countdowns immediately
 * without re-reading from Dexie.
 *
 * Failures to deliver to individual peers are swallowed — the
 * mood is best-effort, not reliable messaging. The local copy is
 * still saved so the UI stays consistent and a future call can
 * re-broadcast.
 */
export async function broadcastMood(
  identity: UnlockedIdentity,
  payload: MoodPayload,
): Promise<string> {
  const expiresAt = new Date(Date.now() + payload.ttlMs).toISOString();

  // Save locally first so a slow network doesn't block the UI.
  const trimmedText = payload.text.trim();
  const trimmedEmoji = payload.emoji.trim();
  const isCleared = trimmedText.length === 0 && trimmedEmoji.length === 0;
  await setUserPrefs({
    myMood: isCleared
      ? undefined
      : { emoji: trimmedEmoji, text: trimmedText, expiresAt },
  });

  const envelope: MoodEnvelope = {
    v: 2,
    t: "mood",
    emoji: trimmedEmoji,
    text: trimmedText,
    expiresAt,
  };
  const wire = encodeEnvelope(envelope);

  let connections: { peer: { id: string } }[] = [];
  try {
    connections = await trpcClientProxy().connections.list.query();
  } catch (err) {
    console.warn("Mood broadcast: couldn't enumerate connections", err);
    return expiresAt;
  }

  // Fan out one encrypted send per peer. We deliberately don't
  // Promise.all early-bail — partial delivery is fine. Errors are
  // logged but don't surface to the user; the mood is best-effort.
  await Promise.all(
    connections.map(async (c) => {
      try {
        const { headerB64, ciphertextB64 } = await encryptToPeer(
          identity,
          c.peer.id,
          wire,
        );
        await trpcClientProxy().messages.send.mutate({
          recipientUserId: c.peer.id,
          header: headerB64,
          ciphertext: ciphertextB64,
        });
      } catch (err) {
        console.warn("Mood delivery failed for peer", c.peer.id, err);
      }
    }),
  );

  return expiresAt;
}

/** Convenience: clear my mood (sends empty broadcast). */
export async function clearMood(identity: UnlockedIdentity): Promise<void> {
  await broadcastMood(identity, { emoji: "", text: "", ttlMs: 0 });
}

/**
 * Read the locally-cached mood, returning null if it has expired.
 * UI components use this so they don't render stale strings.
 */
export async function getActiveMyMood(): Promise<{
  emoji: string;
  text: string;
  expiresAt: string;
} | null> {
  const prefs = await getUserPrefs();
  if (!prefs.myMood) return null;
  if (Date.parse(prefs.myMood.expiresAt) <= Date.now()) return null;
  return prefs.myMood;
}

/**
 * Curated mood quick-picks. Users can also free-form a custom one.
 * The TTL is per-preset because "in a meeting" should fade fast,
 * while "on holiday" can ride through the day.
 */
export const MOOD_PRESETS: { emoji: string; text: string; ttlHours: number }[] = [
  { emoji: "📚", text: "padh raha hoon",       ttlHours: 4 },
  { emoji: "💼", text: "in a meeting",         ttlHours: 2 },
  { emoji: "🚗", text: "driving — text only",  ttlHours: 2 },
  { emoji: "🌙", text: "do not disturb",       ttlHours: 8 },
  { emoji: "🍿", text: "movie time",           ttlHours: 3 },
  { emoji: "🏋️", text: "gym",                  ttlHours: 2 },
  { emoji: "✈️", text: "on holiday",           ttlHours: 24 },
  { emoji: "🎉", text: "celebrating",          ttlHours: 6 },
];

/** Friendly "in 2h" / "in 35m" countdown for mood expiry. */
export function moodCountdownLabel(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "less than 1m";
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m left` : `${hours}h left`;
  const days = Math.round(hours / 24);
  return `${days}d left`;
}
