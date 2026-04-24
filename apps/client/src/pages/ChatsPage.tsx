import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import {
  IconButton,
  ChatListRow,
  UnreadBadge,
  EmptyState,
  Spinner,
  FAB,
  PlusIcon,
  SearchIcon,
  MoreVerticalIcon,
  ChatIcon,
  PrimaryButton,
  DoubleTickIcon,
  SingleTickIcon,
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { UnlockGate } from "../components/UnlockGate";
import { db, setChatPref } from "../lib/db";
import { peerLabel } from "../lib/peerLabel";
import { pollAndDecrypt } from "../lib/messageSync";
import { usePeersPresence } from "../lib/usePeersPresence";
import { useTypingStore, typingLabel } from "../lib/typingStore";

export function ChatsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });

  const allMessages = useLiveQuery(
    () => db.chatMessages.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );
  const allChatPrefs = useLiveQuery(
    () => db.chatPrefs.toArray(),
    [],
    [],
  );
  const pinnedPeers = useMemo(() => {
    const set = new Set<string>();
    for (const p of allChatPrefs ?? []) if (p.pinnedToTop) set.add(p.peerId);
    return set;
  }, [allChatPrefs]);
  const mutedPeers = useMemo(() => {
    const set = new Set<string>();
    const now = Date.now();
    for (const p of allChatPrefs ?? []) {
      if (p.mutedUntil && new Date(p.mutedUntil).getTime() > now)
        set.add(p.peerId);
    }
    return set;
  }, [allChatPrefs]);
  // Chats moved into the Vault are hidden from the main inbox.
  // The hidden set is computed from local prefs only — the server
  // doesn't know which chats the user has chosen to hide.
  const vaultedPeers = useMemo(() => {
    const set = new Set<string>();
    for (const p of allChatPrefs ?? []) if (p.vaulted) set.add(p.peerId);
    return set;
  }, [allChatPrefs]);
  // Locally-marked-unread chats: shown with a green dot and float
  // up the list a tiny bit so they don't get lost when new chats
  // arrive. Cleared automatically once the user opens the chat.
  const unreadPeers = useMemo(() => {
    const set = new Set<string>();
    for (const p of allChatPrefs ?? []) if (p.markedUnread) set.add(p.peerId);
    return set;
  }, [allChatPrefs]);

  // Long-press → row action sheet. We track the peer the sheet is
  // bound to plus a ref-based timer so a regular tap (which still
  // navigates via the underlying <Link>) doesn't open the sheet.
  const [actionPeerId, setActionPeerId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  // Background poll while unlocked.
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        await pollAndDecrypt(identity);
      } catch (e) {
        console.warn("Background poll failed", e);
      }
      if (!cancelled) timer = setTimeout(tick, 5000);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [identity]);

  // Build "last message" map per peer.
  const lastByPeer = new Map<
    string,
    { preview: string; createdAt: string; direction: "in" | "out"; status: string }
  >();
  for (const m of allMessages ?? []) {
    if (!lastByPeer.has(m.peerId)) {
      let preview = m.plaintext;
      if (m.attachment?.kind === "image") {
        preview = m.plaintext ? `📷 ${m.plaintext}` : "📷 Photo";
      } else if (m.attachment?.kind === "voice") {
        preview = "🎤 Voice message";
      }
      lastByPeer.set(m.peerId, {
        preview,
        createdAt: m.createdAt,
        direction: m.direction,
        status: m.status,
      });
    }
  }

  const rows = (connections.data ?? [])
    .map((c) => ({
      conn: c,
      last: lastByPeer.get(c.peer.id),
    }))
    .filter(({ conn }) => {
      // Hide vaulted chats from the main inbox unconditionally.
      if (vaultedPeers.has(conn.peer.id)) return false;
      if (!searching || !search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        conn.peer.fingerprint.toLowerCase().includes(q) ||
        (conn.peer.username ?? "").toLowerCase().includes(q) ||
        (conn.peer.displayName ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Pinned chats float to the top regardless of recency.
      const ap = pinnedPeers.has(a.conn.peer.id) ? 1 : 0;
      const bp = pinnedPeers.has(b.conn.peer.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      // Manually-unread chats float above their non-unread peers
      // (within the same pinned/un-pinned tier) so the user's
      // "remind me" choice stays visible at a glance.
      const au = unreadPeers.has(a.conn.peer.id) ? 1 : 0;
      const bu = unreadPeers.has(b.conn.peer.id) ? 1 : 0;
      if (au !== bu) return bu - au;
      const at = a.last?.createdAt ?? "";
      const bt = b.last?.createdAt ?? "";
      return bt.localeCompare(at);
    });

  // Live presence for everyone in the chat list — one batched
  // request, then WS events keep it fresh in the global store.
  const peerIds = useMemo(
    () => (connections.data ?? []).map((c) => c.peer.id),
    [connections.data],
  );
  const { isOnline } = usePeersPresence(peerIds);
  // Live "typing…" / "recording…" / "sharing photo…" indicators on
  // each row, fed by the global WS subscriber in SessionSync.
  const typingByPeer = useTypingStore((s) => s.byPeer);

  return (
    <MainShell
      active="chats"
      rightActions={
        <>
          <IconButton
            label="Search"
            onClick={() => setSearching((s) => !s)}
            className="text-text-oncolor"
          >
            <SearchIcon />
          </IconButton>
          <IconButton label="Menu" className="text-text-oncolor">
            <MoreVerticalIcon />
          </IconButton>
        </>
      }
    >
      {searching && (
        <div className="bg-panel border-b border-line px-4 py-2">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, @username or fingerprint…"
            className="w-full bg-surface border border-line rounded-full px-4 py-2 text-sm outline-none focus:border-wa-green text-text"
          />
        </div>
      )}

      {!identity && (
        <div className="p-4">
          <UnlockGate />
        </div>
      )}

      {identity && (
        <div className="bg-panel flex-1">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <button
              className="px-3 py-1 rounded-full text-sm bg-wa-green text-text-oncolor"
              disabled
            >
              Direct
            </button>
            <button
              className="px-3 py-1 rounded-full text-sm bg-surface border border-line text-text"
              onClick={() => navigate("/groups")}
            >
              Groups
            </button>
          </div>
          {connections.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ChatIcon className="w-12 h-12" />}
              title="No chats yet"
              message="Invite someone to start your first end-to-end encrypted conversation."
              action={
                <PrimaryButton onClick={() => navigate("/invite")}>
                  Create an invite
                </PrimaryButton>
              }
            />
          ) : (
            rows.map(({ conn, last }) => (
              <div
                key={conn.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActionPeerId(conn.peer.id);
                }}
                onTouchStart={() => {
                  longPressFired.current = false;
                  cancelLongPress();
                  longPressTimer.current = window.setTimeout(() => {
                    longPressFired.current = true;
                    setActionPeerId(conn.peer.id);
                  }, 450);
                }}
                onTouchMove={cancelLongPress}
                onTouchEnd={cancelLongPress}
                onClickCapture={(e) => {
                  // Long-press already opened the sheet — swallow the
                  // click that the touchend would otherwise synthesize
                  // so we don't simultaneously navigate into the chat.
                  if (longPressFired.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    longPressFired.current = false;
                  }
                }}
              >
              <ChatListRow
                to={`/chats/${conn.peer.id}`}
                seed={conn.peer.username || conn.peer.id}
                avatarSrc={conn.peer.avatarDataUrl ?? null}
                online={isOnline(conn.peer.id)}
                title={
                  <span className="text-sm">
                    {peerLabel(conn.peer)}
                  </span>
                }
                subtitle={(() => {
                  // Live activity wins over the stored last-message
                  // preview: if the peer is typing right now we show
                  // that instead, in the accent color, so the row
                  // always reflects the most up-to-date intent.
                  const typingEntry = typingByPeer[conn.peer.id];
                  if (
                    typingEntry &&
                    typingEntry.expiresAt > Date.now()
                  ) {
                    return (
                      <span className="inline-flex items-center gap-1 text-wa-green animate-pulse">
                        {typingLabel(typingEntry.kind)}
                      </span>
                    );
                  }
                  if (!last) return undefined;
                  return (
                    <span className="inline-flex items-center gap-1">
                      {last.direction === "out" && (
                        last.status === "sent" ? (
                          <SingleTickIcon className="text-wa-tick shrink-0" />
                        ) : last.status === "delivered" ? (
                          <DoubleTickIcon className="text-wa-tick shrink-0" />
                        ) : last.status === "read" ? (
                          <DoubleTickIcon className="shrink-0" style={{ color: "rgb(247,52,130)" }} />
                        ) : last.status === "pending" ? (
                          <span className="text-[10px] opacity-70 shrink-0">⏱</span>
                        ) : (
                          <DoubleTickIcon className="text-wa-tick shrink-0" />
                        )
                      )}
                      <span className="truncate">{last.preview}</span>
                    </span>
                  );
                })()}
                meta={
                  <span className="inline-flex items-center gap-1">
                    {pinnedPeers.has(conn.peer.id) && (
                      <span title="Pinned" className="text-text-muted">📌</span>
                    )}
                    {mutedPeers.has(conn.peer.id) && (
                      <span title="Muted" className="text-text-muted">🔕</span>
                    )}
                    {last && <span>{formatTime(last.createdAt)}</span>}
                  </span>
                }
                badge={
                  unreadPeers.has(conn.peer.id) ? (
                    <span
                      title="Marked as unread"
                      className="inline-block size-2.5 rounded-full bg-wa-green"
                    />
                  ) : (
                    <UnreadBadge count={0} />
                  )
                }
              />
              </div>
            ))
          )}
        </div>
      )}

      {identity && (
        <FAB to="/connections" label="New chat">
          <PlusIcon />
        </FAB>
      )}

      {actionPeerId && (
        <ChatRowActionSheet
          peerId={actionPeerId}
          peerName={(() => {
            const r = (connections.data ?? []).find(
              (c) => c.peer.id === actionPeerId,
            );
            return r ? peerLabel(r.peer) : "this chat";
          })()}
          isUnread={unreadPeers.has(actionPeerId)}
          isPinned={pinnedPeers.has(actionPeerId)}
          isMuted={mutedPeers.has(actionPeerId)}
          onClose={() => setActionPeerId(null)}
        />
      )}
    </MainShell>
  );
}

/**
 * Bottom sheet shown after long-pressing a chat in the inbox.
 * Surfaces the most common per-row actions — toggle Read/Unread,
 * Pin, Mute — without forcing the user to first open the thread.
 * All writes go through `setChatPref`, which both upserts the row
 * and bumps `updatedAt` so the live query in ChatsPage re-renders.
 */
function ChatRowActionSheet({
  peerId,
  peerName,
  isUnread,
  isPinned,
  isMuted,
  onClose,
}: {
  peerId: string;
  peerName: string;
  isUnread: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onClose: () => void;
}) {
  const apply = async (patch: Parameters<typeof setChatPref>[1]) => {
    await setChatPref(peerId, patch);
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-panel rounded-t-2xl border-t border-line pb-4 max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-2 text-sm font-semibold text-text truncate">
          {peerName}
        </div>
        <button
          className="w-full text-left px-4 py-3 border-t border-line/40 text-sm hover:bg-white/5"
          onClick={() => void apply({ markedUnread: !isUnread })}
        >
          {isUnread ? "Mark as read" : "Mark as unread"}
        </button>
        <button
          className="w-full text-left px-4 py-3 border-t border-line/40 text-sm hover:bg-white/5"
          onClick={() => void apply({ pinnedToTop: !isPinned })}
        >
          {isPinned ? "Unpin from top" : "Pin to top"}
        </button>
        <button
          className="w-full text-left px-4 py-3 border-t border-line/40 text-sm hover:bg-white/5"
          onClick={() =>
            void apply({
              mutedUntil: isMuted
                ? ""
                : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            })
          }
        >
          {isMuted ? "Unmute notifications" : "Mute for 8 hours"}
        </button>
        <button
          className="w-full text-left px-4 py-3 border-t border-line/40 text-sm text-text-muted hover:bg-white/5"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = Math.floor((+now - +d) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
