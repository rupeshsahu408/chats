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
  PinIcon,
  BellOffIcon,
  PeopleIcon,
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { UnlockGate } from "../components/UnlockGate";
import { db, setChatPref } from "../lib/db";
import { peerLabel } from "../lib/peerLabel";
import { pollAndDecrypt } from "../lib/messageSync";
import { usePeersPresence } from "../lib/usePeersPresence";
import { useTypingStore, typingLabel } from "../lib/typingStore";
import { MoodSheet } from "../components/MoodSheet";
import { moodCountdownLabel, getActiveMyMood } from "../lib/moodSync";
import { useFocusState, focusReasonLabel } from "../lib/focusMode";

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
  // "What's up?" sheet — sets the user's broadcast mood. Encrypted
  // and fanned out to every 1:1 connection by `lib/moodSync`.
  const [moodOpen, setMoodOpen] = useState(false);
  const [myMoodChip, setMyMoodChip] = useState<{
    emoji: string;
    text: string;
    expiresAt: string;
  } | null>(null);
  // Re-read my own mood whenever we open / close the sheet so the
  // header chip reflects the latest broadcast.
  useEffect(() => {
    let alive = true;
    void getActiveMyMood().then((m) => {
      if (alive) setMyMoodChip(m);
    });
    return () => {
      alive = false;
    };
  }, [moodOpen]);
  // And quietly tick once a minute so the chip auto-hides when its
  // TTL lapses without needing a manual interaction.
  useEffect(() => {
    const t = setInterval(() => {
      void getActiveMyMood().then((m) => setMyMoodChip(m));
    }, 60_000);
    return () => clearInterval(t);
  }, []);
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
          <FocusChip />
          <IconButton
            label="Search"
            onClick={() => setSearching((s) => !s)}
            className="text-text-oncolor"
          >
            <SearchIcon />
          </IconButton>
          <button
            type="button"
            onClick={() => setMoodOpen(true)}
            className="px-2.5 h-8 rounded-full inline-flex items-center gap-1 text-text-oncolor hover:bg-white/10 wa-tap text-sm"
            aria-label={
              myMoodChip
                ? `Mood: ${myMoodChip.text || "set"}`
                : "Set your mood"
            }
            title={
              myMoodChip
                ? `${myMoodChip.text} · ${moodCountdownLabel(
                    myMoodChip.expiresAt,
                  )}`
                : "What's up?"
            }
          >
            <span aria-hidden="true">{myMoodChip?.emoji || "😶"}</span>
            {myMoodChip?.text && (
              <span className="hidden sm:inline max-w-[120px] truncate text-xs">
                {myMoodChip.text}
              </span>
            )}
          </button>
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
          <div className="px-4 pt-3 pb-1">
            <DirectGroupsTabs
              active="direct"
              onSelect={(t) => {
                if (t === "groups") navigate("/groups");
              }}
            />
          </div>
          {connections.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ChatIcon className="w-12 h-12" />}
              title="No chats yet"
              message="Veil connects you one person at a time. Send an invite to start your first conversation."
              action={
                <PrimaryButton onClick={() => navigate("/invite")}>
                  Create an invite
                </PrimaryButton>
              }
              tipsTitle="What you can do here"
              tips={[
                {
                  icon: <PlusIcon />,
                  title: "Invite someone",
                  body: "Share a one-time pass over any channel. Once accepted, the link burns itself.",
                },
                {
                  icon: <ChatIcon />,
                  title: "Long-press a chat",
                  body: "Pin, archive, mute, or hide it inside your Vault — all without leaving the inbox.",
                },
                {
                  icon: <ChatIcon />,
                  title: "End-to-end encrypted by default",
                  body: "Your messages are sealed on your device and only opened on your friend's. Veil's server is just a relay.",
                },
              ]}
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
                title={(() => {
                  const pref = (allChatPrefs ?? []).find(
                    (p) => p.peerId === conn.peer.id,
                  );
                  const mood =
                    pref?.peerMood &&
                    Date.parse(pref.peerMood.expiresAt) > Date.now()
                      ? pref.peerMood
                      : null;
                  return (
                    <span className="text-sm inline-flex items-center gap-1.5 min-w-0">
                      <span className="truncate">
                        {peerLabel(conn.peer)}
                      </span>
                      {mood && (
                        <span
                          className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-wa-green-soft/40 text-text-muted inline-flex items-center gap-0.5 shrink-0 max-w-[140px] truncate"
                          title={`${mood.text} · ${moodCountdownLabel(mood.expiresAt)}`}
                        >
                          <span aria-hidden="true">{mood.emoji}</span>
                          <span className="truncate">{mood.text}</span>
                        </span>
                      )}
                    </span>
                  );
                })()}
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
                  <span
                    className={
                      "inline-flex items-center gap-1.5 " +
                      (unreadPeers.has(conn.peer.id)
                        ? "text-wa-green font-semibold"
                        : "")
                    }
                  >
                    {pinnedPeers.has(conn.peer.id) && (
                      <PinIcon
                        className="size-3 text-text-muted"
                        aria-label="Pinned"
                      />
                    )}
                    {mutedPeers.has(conn.peer.id) && (
                      <BellOffIcon
                        className="size-3 text-text-muted"
                        aria-label="Muted"
                      />
                    )}
                    {last && <span>{formatTime(last.createdAt)}</span>}
                  </span>
                }
                badge={
                  unreadPeers.has(conn.peer.id) ? (
                    <span
                      title="Marked as unread"
                      aria-label="Marked as unread"
                      className={
                        "inline-block size-3 rounded-full bg-wa-green " +
                        "ring-2 ring-wa-green/25 " +
                        "animate-pulse"
                      }
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

      {moodOpen && identity && (
        <MoodSheet
          identity={identity}
          onClose={() => setMoodOpen(false)}
        />
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

/**
 * Segmented Direct/Groups switcher.
 *
 * The selected pill is the only thing that animates — a single
 * absolute element that translates between the two slots, so the
 * toggle reads as one continuous gesture instead of two buttons
 * blinking. Honors prefers-reduced-motion via Tailwind's transition
 * tokens (transitions degrade gracefully).
 */
function DirectGroupsTabs({
  active,
  onSelect,
}: {
  active: "direct" | "groups";
  onSelect: (t: "direct" | "groups") => void;
}) {
  const isDirect = active === "direct";
  return (
    <div
      className={
        "relative inline-flex w-full max-w-[260px] " +
        "rounded-full bg-surface/80 border border-line/70 " +
        "p-0.5 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]"
      }
      role="tablist"
      aria-label="Conversation type"
    >
      {/* Sliding pill */}
      <span
        aria-hidden
        className={
          "absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] " +
          "rounded-full bg-gradient-to-b from-wa-green to-wa-green-dark " +
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_4px_12px_rgba(0,168,132,0.25)] " +
          "transition-transform duration-300 ease-veil-spring " +
          (isDirect ? "translate-x-0" : "translate-x-full")
        }
      />
      <button
        type="button"
        role="tab"
        aria-selected={isDirect}
        onClick={() => onSelect("direct")}
        className={
          "relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 " +
          "h-8 rounded-full text-[13px] font-semibold wa-tap " +
          "transition-colors duration-200 " +
          (isDirect ? "text-text-oncolor" : "text-text-muted hover:text-text")
        }
      >
        <ChatIcon className="size-3.5" />
        Direct
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!isDirect}
        onClick={() => onSelect("groups")}
        className={
          "relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 " +
          "h-8 rounded-full text-[13px] font-semibold wa-tap " +
          "transition-colors duration-200 " +
          (!isDirect ? "text-text-oncolor" : "text-text-muted hover:text-text")
        }
      >
        <PeopleIcon className="size-3.5" />
        Groups
      </button>
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

/**
 * A small calm-green chip that appears in the inbox app-bar whenever
 * Focus Mode (Principle #4) is suppressing notifications. Tapping it
 * jumps straight to the Focus Mode page so the user can dismiss the
 * snooze, end quiet hours, or extend the silence with one gesture.
 *
 * Hidden entirely when focus is off — the chip should never become
 * visual noise in the default state.
 */
function FocusChip() {
  const navigate = useNavigate();
  const state = useFocusState();
  if (!state.active) return null;
  return (
    <button
      type="button"
      onClick={() => navigate("/focus-mode")}
      title={`${focusReasonLabel(state.reason)} — tap to manage`}
      className={
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full " +
        "bg-white/15 hover:bg-white/22 backdrop-blur-sm " +
        "border border-white/20 text-text-oncolor wa-tap " +
        "text-[11.5px] font-semibold tracking-wide"
      }
      aria-label="Focus Mode is on"
    >
      <span className="relative inline-flex">
        <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
        <span className="relative size-1.5 rounded-full bg-white" />
      </span>
      <span className="hidden xs:inline">Quiet</span>
    </button>
  );
}
