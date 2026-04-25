import { useEffect, useRef } from "react";
import { useAuthStore } from "./store";
import { useUnlockStore } from "./unlockStore";
import { wsClient } from "./wsClient";
import { applyDeliveryReceipt, applyReadReceipt, ingestInboxMessage, pollAndDecrypt, restorePeerHistory, syncOutboundReceipts } from "./messageSync";
import { useStealthPrefs } from "./stealthPrefs";
import { deleteExpiredChatMessages } from "./db";
import { trpcClientProxy } from "./trpcClientProxy";
import {
  ensureMySenderKey,
  reapExpiredGroupMessages,
  restoreGroupHistory,
  rotateMySenderKeyIfNeeded,
} from "./groupSync";
import { usePresenceStore } from "./presenceStore";
import { useTypingStore } from "./typingStore";
import { useScheduledMessageSender } from "./scheduledSender";
import { useSessionEventsStore } from "./sessionEventsStore";

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
      } else if (event.type === "delivery_receipt") {
        void applyDeliveryReceipt(event.messageId, event.at).catch(() => undefined);
      } else if (event.type === "read_receipt") {
        void applyReadReceipt(event.messageId, event.at).catch(() => undefined);
      } else if (event.type === "group_changed") {
        // Group epoch may have bumped — proactively refresh & re-distribute
        // our sender key so other members can decrypt our next message.
        void rotateMySenderKeyIfNeeded(identity, event.groupId).catch(() =>
          undefined,
        );
      } else if (event.type === "presence") {
        usePresenceStore.getState().setOnline(event.userId, event.online);
      } else if (event.type === "typing") {
        // Mirror the peer's typing/recording/photo activity into the
        // global typing store so the chat-list row can show "typing…"
        // without the user having to open the conversation first.
        useTypingStore
          .getState()
          .setTyping(event.from, event.typing, event.kind);
      }
    });
    return unsub;
  }, [identity]);

  // Single-active-session events. These are NOT gated on `identity`
  // because they have to fire even when the user hasn't unlocked yet
  // (e.g. they signed in on a new device + haven't entered their
  // recovery key). We still need an `accessToken` so the WS itself
  // is open.
  useEffect(() => {
    if (!accessToken) return;
    const ev = useSessionEventsStore.getState();
    const unsub = wsClient.subscribe((event) => {
      if (event.type === "security_alert") ev.bumpAlert();
      else if (event.type === "session_revoked") ev.bumpRevoked(event.reason);
    });
    return unsub;
  }, [accessToken]);

  // Hydrate global privacy/stealth prefs once.
  useEffect(() => {
    void useStealthPrefs.getState().hydrate();
  }, []);

  // Proactive access-token refresh.
  //
  // Access tokens expire after 15 minutes (see `apps/server/src/lib/jwt.ts`).
  // Without a periodic refresh, every authenticated request — REST,
  // tRPC, and the WebSocket — starts failing with 401 the moment the
  // token expires, even though the long-lived refresh token is still
  // valid. We renew every 10 minutes so the access token is always
  // fresh while the user is around.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const renew = async () => {
      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) return;
      try {
        const r = await trpcClientProxy().auth.refresh.mutate();
        if (cancelled) return;
        useAuthStore.getState().setAuth({
          accessToken: r.accessToken,
          refreshToken: r.refreshToken,
          refreshExpiresIn: r.refreshExpiresIn,
          user: r.user,
        });
      } catch {
        /* network blip or genuinely expired refresh token —
           SessionGuard will pick up real revocations. */
      }
    };
    const t = setInterval(renew, 10 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [accessToken]);

  // App-wide scheduled-message dispatcher. Runs whenever the identity
  // is unlocked, regardless of which page the user is currently on.
  useScheduledMessageSender(identity);

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
      // Restore 1:1 peer history.
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
      // Restore group history for every group the user belongs to.
      // We fetch up to 5 pages × 100 messages per group, same as peer
      // history. Messages we can't decrypt get a "[encrypted — couldn't
      // decrypt on this device]" placeholder so the user sees the gap.
      try {
        const groups = await trpcClientProxy().groups.list.query();
        for (const g of groups) {
          try {
            await restoreGroupHistory(identity, g.id);
          } catch (e) {
            console.warn("Group history restore failed for", g.id, e);
          }
          // Proactively (re-)distribute our sender key for every group
          // we belong to. Covers the case where we were added while
          // offline (so we never received the `group_changed` push) and
          // also self-heals any prior partial-distribution failures.
          try {
            const detail = await trpcClientProxy().groups.get.query({
              groupId: g.id,
            });
            await ensureMySenderKey(identity, detail);
          } catch (e) {
            console.warn("Sender-key bootstrap failed for", g.id, e);
          }
        }
      } catch (e) {
        console.warn("Couldn't enumerate groups for history restore", e);
      }
    })();
  }, [identity, userId]);

  // Belt-and-braces inbox polling.
  //
  // The WebSocket *should* deliver every message live, but in production
  // (Vercel ↔ Render, mobile Safari, suspended tabs, flaky proxies)
  // sockets often enter a "zombie" state where `readyState === OPEN` but
  // the server has already dropped the connection — so live `new_message`
  // events silently never arrive. To stay correct we always poll on a
  // background interval (slow when the WS looks healthy, fast when it
  // doesn't) and also drain the inbox the moment the tab regains focus
  // or the network comes back.
  useEffect(() => {
    if (!identity) return;

    const drain = () => {
      void pollAndDecrypt(identity).catch(() => undefined);
      void syncOutboundReceipts().catch(() => undefined);
    };

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      // Always poll; just slow down when the WS looks alive.
      drain();
    }, wsClient.isOpen() ? 20_000 : 8_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") drain();
    };
    const onFocus = () => drain();
    const onOnline = () => drain();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // Trigger an immediate drain when this effect first runs (covers the
    // case where the user navigates back to a previously-loaded tab).
    drain();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [identity]);

  return null;
}
