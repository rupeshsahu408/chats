import { useEffect, useMemo } from "react";
import { trpc } from "./trpc";
import { usePresenceStore } from "./presenceStore";

/**
 * Subscribe to live online status for a set of peers.
 *
 * Strategy:
 *   1. Issue a single batched `peersOnline` query — one round-trip
 *      regardless of how many contacts are in the chat list.
 *   2. Seed the global `presenceStore` with the result so every
 *      consumer (chat list, chat header, group header) sees the same
 *      state without re-querying.
 *   3. From that point on the WebSocket presence events flowing
 *      through `SessionSync` keep the store live; this hook just
 *      reads from the store, so toggling online/offline propagates
 *      with no extra requests.
 *
 * Returns a `Map<peerId, boolean>` of online status, plus a small
 * convenience predicate. Memoized so consumers don't re-render on
 * every tick.
 */
export function usePeersPresence(peerIds: string[]): {
  online: Map<string, boolean>;
  isOnline: (peerId: string) => boolean;
} {
  const stableIds = useMemo(() => {
    // Stringify-key the array so the trpc query isn't re-issued
    // every render even when the parent rebuilds the array.
    return [...peerIds].sort();
  }, [peerIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOnline = usePresenceStore((s) => s.setOnline);
  const onlineMap = usePresenceStore((s) => s.online);

  const query = trpc.me.peersOnline.useQuery(
    { peerIds: stableIds },
    {
      enabled: stableIds.length > 0,
      refetchOnWindowFocus: true,
      // Online status is kept live by WS events, so we don't need
      // aggressive polling — we just want a fresh seed on focus.
      staleTime: 30_000,
    },
  );

  // Reconcile the batched response into the global store. Anyone
  // not in the `online` array is implicitly offline.
  useEffect(() => {
    if (!query.data) return;
    const onlineSet = new Set(query.data.online);
    for (const id of stableIds) {
      setOnline(id, onlineSet.has(id));
    }
  }, [query.data, stableIds, setOnline]);

  const online = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const id of stableIds) m.set(id, onlineMap[id] === true);
    return m;
  }, [stableIds, onlineMap]);

  return {
    online,
    isOnline: (peerId: string) => onlineMap[peerId] === true,
  };
}
