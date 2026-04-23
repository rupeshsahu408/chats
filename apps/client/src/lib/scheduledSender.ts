import { useEffect } from "react";
import {
  db,
  markScheduledMessageFailed,
  markScheduledMessageSent,
  purgeOldSentScheduledMessages,
} from "./db";
import { sendChatMessage } from "./messageSync";
import type { UnlockedIdentity } from "./signal/session";

/**
 * App-wide scheduled-message dispatcher.
 *
 * Runs on a single timer (regardless of which page the user is on) and
 * sends any scheduled message whose time has come. Failed sends are
 * recorded on the record so the UI can surface them.
 *
 * Tick strategy:
 *  - A short polling interval (10 s) keeps things simple and tolerant of
 *    sleeping tabs / clock drift.
 *  - On every tick we also schedule a precise `setTimeout` to the next
 *    upcoming due time so the actual send fires within ~1 s of the
 *    requested moment, not on the next 10 s boundary.
 */
export function useScheduledMessageSender(
  identity: UnlockedIdentity | null,
): void {
  useEffect(() => {
    if (!identity) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let nextDueTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let lastPurge = 0;

    async function flush() {
      if (cancelled || inFlight || !identity) return;
      inFlight = true;
      try {
        const now = Date.now();
        const pending = await db.scheduledMessages
          .filter((r) => !r.sent)
          .toArray();

        const due = pending.filter(
          (r) => new Date(r.scheduledFor).getTime() <= now,
        );

        for (const rec of due) {
          if (cancelled) break;
          if (rec.id === undefined) continue;
          try {
            await sendChatMessage(identity, rec.peerId, rec.text);
            await markScheduledMessageSent(rec.id);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(
              `[scheduledSender] send failed for #${rec.id}:`,
              msg,
            );
            await markScheduledMessageFailed(rec.id, msg);
          }
        }

        // Schedule a precise wake-up for the next upcoming message.
        if (nextDueTimer) {
          clearTimeout(nextDueTimer);
          nextDueTimer = null;
        }
        const upcoming = pending
          .map((r) => new Date(r.scheduledFor).getTime())
          .filter((t) => t > Date.now())
          .sort((a, b) => a - b)[0];
        if (upcoming !== undefined) {
          // Clamp to [500ms, 60s] so we never starve and never set huge
          // timers (which some browsers throttle to ~1s anyway).
          const delay = Math.min(
            Math.max(upcoming - Date.now(), 500),
            60_000,
          );
          nextDueTimer = setTimeout(() => void flush(), delay);
        }

        // Periodic cleanup — at most once per hour.
        if (Date.now() - lastPurge > 60 * 60 * 1000) {
          lastPurge = Date.now();
          await purgeOldSentScheduledMessages().catch(() => undefined);
        }
      } finally {
        inFlight = false;
      }
    }

    // Initial flush, then a steady polling loop as a safety net.
    void flush();
    pollTimer = setInterval(() => void flush(), 10_000);

    // Re-flush whenever the tab regains focus / network comes back, so
    // a backgrounded tab catches up promptly.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const onFocus = () => void flush();
    const onOnline = () => void flush();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (nextDueTimer) clearTimeout(nextDueTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [identity]);
}
