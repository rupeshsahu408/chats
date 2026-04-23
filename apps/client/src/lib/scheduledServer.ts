import { trpcClientProxy } from "./trpcClientProxy";
import { encryptToPeer } from "./signal/session";
import type { UnlockedIdentity } from "./signal/session";
import { encodeEnvelope, type ChatEnvelope } from "./messageEnvelope";
import { db } from "./db";

/**
 * Local mirror of a server-side scheduled message. The server only ever
 * sees the ciphertext; this row holds the plaintext we'll show in the
 * "Scheduled messages" sheet so the user can see what they queued.
 *
 * Keyed by the server's row id, which is also returned from create.
 */
export interface ScheduledMirrorRecord {
  id: string;
  peerId: string;
  text: string;
  scheduledFor: string;
  createdAt: string;
}

const MIRROR_KEY = "veil.scheduled.mirror.v1";

function loadMirror(): Record<string, ScheduledMirrorRecord> {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function saveMirror(map: Record<string, ScheduledMirrorRecord>): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function getScheduledMirror(id: string): ScheduledMirrorRecord | null {
  const map = loadMirror();
  return map[id] ?? null;
}

export function getAllScheduledMirrors(): Record<
  string,
  ScheduledMirrorRecord
> {
  return loadMirror();
}

export function deleteScheduledMirror(id: string): void {
  const map = loadMirror();
  if (id in map) {
    delete map[id];
    saveMirror(map);
  }
}

function setScheduledMirror(rec: ScheduledMirrorRecord): void {
  const map = loadMirror();
  map[rec.id] = rec;
  saveMirror(map);
}

/**
 * Schedule a text message for future delivery via the server.
 *
 *  1. Encrypt the message *now* using the current ratchet state.
 *  2. Upload the ciphertext + scheduled-for time to the server.
 *  3. Cache the plaintext locally so the user can see what they queued.
 *
 * The server holds the opaque ciphertext (E2EE preserved) and releases
 * it at the requested time even if this browser tab is closed.
 */
export async function scheduleServerMessage(
  identity: UnlockedIdentity,
  peerId: string,
  plaintext: string,
  scheduledForIso: string,
  opts: { ttlSeconds?: number } = {},
): Promise<{ id: string; scheduledFor: string }> {
  const env: ChatEnvelope = { v: 2, t: "text", body: plaintext };
  if (opts.ttlSeconds && opts.ttlSeconds > 0) env.ttl = opts.ttlSeconds;

  const wire = encodeEnvelope(env);
  const { headerB64, ciphertextB64 } = await encryptToPeer(
    identity,
    peerId,
    wire,
  );

  const result = await trpcClientProxy().scheduled.create.mutate({
    recipientUserId: peerId,
    header: headerB64,
    ciphertext: ciphertextB64,
    scheduledFor: scheduledForIso,
    ...(opts.ttlSeconds && opts.ttlSeconds > 0
      ? { expiresInSeconds: opts.ttlSeconds }
      : {}),
  });

  setScheduledMirror({
    id: result.id,
    peerId,
    text: plaintext,
    scheduledFor: result.scheduledFor,
    createdAt: new Date().toISOString(),
  });

  return result;
}

/**
 * Cancel a server-side scheduled message. Idempotent — succeeds even if
 * the message has already been delivered or cancelled.
 */
export async function cancelServerScheduledMessage(id: string): Promise<void> {
  try {
    await trpcClientProxy().scheduled.cancel.mutate({ id });
  } finally {
    deleteScheduledMirror(id);
  }
}

/**
 * Best-effort: drop mirror entries for ids the server no longer reports.
 * Called after fetching the list so we don't accumulate stale plaintexts
 * forever.
 */
export function reconcileMirror(serverIds: ReadonlySet<string>): void {
  const map = loadMirror();
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!serverIds.has(id)) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) saveMirror(map);
}

// Avoid unused-import warning during type checking.
void db;
