import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { Avatar, ChatIcon, Spinner } from "./Layout";
import { db } from "../lib/db";
import { peerLabel } from "../lib/peerLabel";
import { usePeersPresence } from "../lib/usePeersPresence";

/**
 * Compact list of direct conversations rendered as the left column
 * of the desktop two-pane chat layout (WhatsApp-Web style). Hidden
 * below the lg breakpoint — on mobile/tablet the open thread fills
 * the whole viewport and the user navigates back to /chats to pick
 * a different conversation.
 *
 * Intentionally a slim, read-only view of the inbox: tap a row to
 * switch to that thread. The full inbox (with mood chips, search,
 * long-press actions, FAB, etc.) lives at /chats.
 */
export function InboxListPane({
  currentPeerId,
  className,
}: {
  currentPeerId?: string;
  className?: string;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);

  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });

  const allMessages = useLiveQuery(
    () => db.chatMessages.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );
  const allChatPrefs = useLiveQuery(() => db.chatPrefs.toArray(), [], []);

  const vaultedPeers = useMemo(() => {
    const set = new Set<string>();
    for (const p of allChatPrefs ?? []) if (p.vaulted) set.add(p.peerId);
    return set;
  }, [allChatPrefs]);
  const pinnedPeers = useMemo(() => {
    const set = new Set<string>();
    for (const p of allChatPrefs ?? []) if (p.pinnedToTop) set.add(p.peerId);
    return set;
  }, [allChatPrefs]);

  const lastByPeer = new Map<string, { preview: string; createdAt: string }>();
  for (const m of allMessages ?? []) {
    if (!lastByPeer.has(m.peerId)) {
      let preview = m.plaintext;
      if (m.attachment?.kind === "image") {
        preview = m.plaintext ? `📷 ${m.plaintext}` : "📷 Photo";
      } else if (m.attachment?.kind === "voice") {
        preview = "🎤 Voice message";
      }
      lastByPeer.set(m.peerId, { preview, createdAt: m.createdAt });
    }
  }

  const rows = (connections.data ?? [])
    .filter((c) => !vaultedPeers.has(c.peer.id))
    .map((c) => ({ conn: c, last: lastByPeer.get(c.peer.id) }))
    .sort((a, b) => {
      const ap = pinnedPeers.has(a.conn.peer.id) ? 1 : 0;
      const bp = pinnedPeers.has(b.conn.peer.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = a.last?.createdAt ?? "";
      const bt = b.last?.createdAt ?? "";
      return bt.localeCompare(at);
    });

  const peerIds = useMemo(
    () => (connections.data ?? []).map((c) => c.peer.id),
    [connections.data],
  );
  const { isOnline } = usePeersPresence(peerIds);

  return (
    <aside
      aria-label="Conversations"
      className={
        "h-screen sticky top-0 shrink-0 " +
        "w-[320px] xl:w-[360px] " +
        "flex-col bg-panel border-r border-line/60 " +
        (className ?? "")
      }
    >
      <PaneHeader
        title="Chats"
        subtitle={
          identity
            ? `${rows.length} conversation${rows.length === 1 ? "" : "s"}`
            : "Unlock to view"
        }
        seeAllTo="/chats"
      />
      <div className="flex-1 overflow-y-auto">
        {!identity ? (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            Unlock the app to load your chats.
          </div>
        ) : connections.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            No conversations yet.
            <div className="mt-2">
              <Link
                to="/connections"
                className="text-wa-green font-semibold hover:underline"
              >
                Find someone to chat with
              </Link>
            </div>
          </div>
        ) : (
          rows.map(({ conn, last }) => {
            const isActive = currentPeerId === conn.peer.id;
            return (
              <Link
                key={conn.id}
                to={`/chats/${conn.peer.id}`}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex items-center gap-3 px-3 py-2.5 wa-tap " +
                  "transition-colors duration-100 " +
                  (isActive
                    ? "bg-wa-green-soft"
                    : "hover:bg-elevated/60 active:bg-elevated")
                }
              >
                <div className="relative shrink-0">
                  <Avatar
                    seed={conn.peer.username || conn.peer.id}
                    src={conn.peer.avatarDataUrl ?? null}
                    label={peerLabel(conn.peer).slice(0, 2)}
                    size={44}
                  />
                  {isOnline(conn.peer.id) && (
                    <span
                      aria-label="Online"
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-panel"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={
                      "text-[14px] truncate " +
                      (isActive ? "font-bold text-text" : "font-semibold text-text")
                    }
                  >
                    {peerLabel(conn.peer)}
                  </div>
                  <div className="text-[12px] text-text-muted truncate">
                    {last?.preview ?? "Say hello"}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
      <PaneFooter to="/groups" label="Groups" icon={<ChatIcon />} />
    </aside>
  );
}

/**
 * Compact list of group conversations for the desktop two-pane
 * chat layout. Mirrors {@link InboxListPane} but for groups.
 */
export function GroupListPane({
  currentGroupId,
  className,
}: {
  currentGroupId?: string;
  className?: string;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);

  const groups = trpc.groups.list.useQuery(undefined, {
    enabled: !!accessToken && !!identity,
    retry: false,
  });

  const allGroupMessages = useLiveQuery(
    () => db.groupMessages.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );

  const lastByGroup = new Map<string, { preview: string; createdAt: string }>();
  for (const m of allGroupMessages ?? []) {
    if (!lastByGroup.has(m.groupId)) {
      let preview = m.plaintext;
      if (m.attachment?.kind === "image") {
        preview = m.plaintext ? `📷 ${m.plaintext}` : "📷 Photo";
      } else if (m.attachment?.kind === "voice") {
        preview = "🎤 Voice message";
      }
      lastByGroup.set(m.groupId, { preview, createdAt: m.createdAt });
    }
  }

  const rows = (groups.data ?? [])
    .map((g) => ({ g, last: lastByGroup.get(g.id) }))
    .sort((a, b) => {
      const at = a.last?.createdAt ?? a.g.createdAt;
      const bt = b.last?.createdAt ?? b.g.createdAt;
      return bt.localeCompare(at);
    });

  return (
    <aside
      aria-label="Groups"
      className={
        "h-screen sticky top-0 shrink-0 " +
        "w-[320px] xl:w-[360px] " +
        "flex-col bg-panel border-r border-line/60 " +
        (className ?? "")
      }
    >
      <PaneHeader
        title="Groups"
        subtitle={
          identity
            ? `${rows.length} group${rows.length === 1 ? "" : "s"}`
            : "Unlock to view"
        }
        seeAllTo="/groups"
      />
      <div className="flex-1 overflow-y-auto">
        {!identity ? (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            Unlock the app to load your groups.
          </div>
        ) : groups.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            No groups yet.
            <div className="mt-2">
              <Link
                to="/groups"
                className="text-wa-green font-semibold hover:underline"
              >
                Create a group
              </Link>
            </div>
          </div>
        ) : (
          rows.map(({ g, last }) => {
            const isActive = currentGroupId === g.id;
            return (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex items-center gap-3 px-3 py-2.5 wa-tap " +
                  "transition-colors duration-100 " +
                  (isActive
                    ? "bg-wa-green-soft"
                    : "hover:bg-elevated/60 active:bg-elevated")
                }
              >
                <Avatar seed={g.id} label={g.name?.slice(0, 2) ?? "G"} size={44} />
                <div className="min-w-0 flex-1">
                  <div
                    className={
                      "text-[14px] truncate " +
                      (isActive ? "font-bold text-text" : "font-semibold text-text")
                    }
                  >
                    {g.name ?? "Group"}
                  </div>
                  <div className="text-[12px] text-text-muted truncate">
                    {last?.preview ?? `${g.memberCount} members`}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
      <PaneFooter to="/chats" label="Direct chats" icon={<ChatIcon />} />
    </aside>
  );
}

function PaneHeader({
  title,
  subtitle,
  seeAllTo,
}: {
  title: string;
  subtitle: string;
  seeAllTo: string;
}) {
  return (
    <div className="h-16 flex items-center justify-between px-4 border-b border-line/60 shrink-0">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold tracking-tight text-text truncate">
          {title}
        </div>
        <div className="text-[11px] text-text-muted truncate">{subtitle}</div>
      </div>
      <Link
        to={seeAllTo}
        className="text-[12px] font-semibold text-wa-green hover:underline shrink-0 ml-2"
      >
        See all
      </Link>
    </div>
  );
}

function PaneFooter({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2 border-t border-line/60 shrink-0">
      <Link
        to={to}
        className={
          "flex items-center gap-2 px-3 py-2 rounded-lg " +
          "text-[13px] font-semibold text-text-muted " +
          "hover:bg-surface/70 hover:text-text wa-tap"
        }
      >
        <span className="shrink-0">{icon}</span>
        <span className="truncate">Switch to {label}</span>
      </Link>
    </div>
  );
}
