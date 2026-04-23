import { useEffect } from "react";
import { db, purgeOldSentScheduledMessages } from "./db";
import type { UnlockedIdentity } from "./signal/session";

/**
 * Legacy hook from the v1 (client-only) scheduler. Scheduled messages
 * now live on the server (see `lib/scheduledServer.ts`), so this hook
 * just garbage-collects any stale local DB rows from the previous
 * implementation. Kept as a hook so SessionSync's mount point stays
 * stable.
 */
export function useScheduledMessageSender(
  identity: UnlockedIdentity | null,
): void {
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;

    async function sweepLegacy() {
      if (cancelled) return;
      try {
        // Drop any rows from the old client-only scheduler so they don't
        // hang around forever. Server-side scheduling supersedes them.
        await db.scheduledMessages.clear();
      } catch {
        /* ignore */
      }
      try {
        await purgeOldSentScheduledMessages();
      } catch {
        /* ignore */
      }
    }

    void sweepLegacy();
    return () => {
      cancelled = true;
    };
  }, [identity]);
}
