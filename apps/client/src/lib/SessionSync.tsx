import { useEffect, useRef } from "react";
import { useAuthStore } from "./store";
import { useUnlockStore } from "./unlockStore";
import { wsClient } from "./wsClient";
import { applyReadReceipt, ingestInboxMessage, pollAndDecrypt, restorePeerHistory } from "./messageSync";
import { useStealthPrefs } from "./stealthPrefs";
import { deleteExpiredChatMessages } from "./db";
import { trpcClientProxy } from "./trpcClientProxy";
import { reapExpiredGroupMessages, rotateMySenderKeyIfNeeded } from "./groupSync";

/**
 * App-wide background sync.
 *
 *  - Opens the WS as soon as we have an access token. Closes on logout.
 *  - When the identity is unlocked, drains the inbox once and listens
 *    for live `new_message` events.
 *  - Restores conversation history (5 pages per peer) on the first
 *    unlock per session, so a user logging in on a fresh browser gets
 *    their messages back.
 *  - Falls back to a 10s poll while the WS is closed.
 */
export function SessionSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const identity = useUnlockStore((s) => s.identity);
  const restoredRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket lifecycle.
  useEffect(() => {
    if (!accessToken) {
      wsClient.stop();
      return;
    }
    wsClient.refreshToken(accessToken);
    wsClient.start();
    return () => {
      // Don't stop on token rotation; only stop when the token clears.
    };
  }, [accessToken]);

  // Subscribe to live events whenever identity is available.
  useEffect(() => {
    if (!identity) return;
    const unsub = wsClient.subscribe((event) => {
      if (event.type === "new_message") {
        void ingestInboxMessage(identity, event.message);
      } else if (event.type === "read_receipt") {
        void applyReadReceipt(event.messageId, event.at).catch(() => undefined);
      } else if (event.type === "group_changed") {
        // Group epoch may have bumped — proactively refresh & re-distribute
        // our sender key so other members can decrypt our next message.
        void rotateMySenderKeyIfNeeded(identity, event.groupId).catch(() =>
          undefined,
        );
      }
    });
    return unsub;
  }, [identity]);

  // Hydrate global privacy/stealth prefs once.
  useEffect(() => {
    void useStealthPrefs.getState().hydrate();
  }, []);

  // Reap locally-expired messages on a 60s tick (also runs on inbox poll).
  useEffect(() => {
    if (!identity) return;
    const t = setInterval(() => {
      void deleteExpiredChatMessages().catch(() => undefined);
      void reapExpiredGroupMessages().catch(() => undefined);
    }, 60_000);
    return () => clearInterval(t);
  }, [identity]);

  // Drain the inbox + restore history once after unlock.
  useEffect(() => {
    if (!identity || !userId) return;
    if (restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        await pollAndDecrypt(identity);
      } catch (e) {
        console.warn("Initial inbox drain failed", e);
      }
      try {
        const list = await trpcClientProxy().connections.list.query();
        for (const c of list) {
          try {
            await restorePeerHistory(identity, c.peer.id, userId);
          } catch (e) {
            console.warn("History restore failed for", c.peer.id, e);
          }
        }
      } catch (e) {
        console.warn("Couldn't enumerate connections for history restore", e);
      }
    })();
  }, [identity, userId]);

  // Polling fallback while the WS is down (also catches anything missed).
  useEffect(() => {
    if (!identity) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (wsClient.isOpen()) return;
      void pollAndDecrypt(identity).catch(() => undefined);
    }, 10_000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [identity]);

  return null;
}
