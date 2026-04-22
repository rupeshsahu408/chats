import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { UnlockGate } from "../components/UnlockGate";
import { db } from "../lib/db";
import { pollAndDecrypt } from "../lib/messageSync";

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
    { plaintext: string; createdAt: string; direction: "in" | "out" }
  >();
  for (const m of allMessages ?? []) {
    if (!lastByPeer.has(m.peerId)) {
      lastByPeer.set(m.peerId, {
        plaintext: m.plaintext,
        createdAt: m.createdAt,
        direction: m.direction,
      });
    }
  }

  const rows = (connections.data ?? [])
    .map((c) => ({
      conn: c,
      last: lastByPeer.get(c.peer.id),
    }))
    .filter(({ conn }) => {
      if (!searching || !search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        conn.peer.id.toLowerCase().includes(q) ||
        conn.peer.fingerprint.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const at = a.last?.createdAt ?? "";
      const bt = b.last?.createdAt ?? "";
      return bt.localeCompare(at);
    });

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
            placeholder="Search by ID or fingerprint…"
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
              <ChatListRow
                key={conn.id}
                to={`/chats/${conn.peer.id}`}
                seed={conn.peer.id}
                title={
                  <span className="font-mono text-sm">
                    {conn.peer.fingerprint || conn.peer.id.slice(0, 8) + "…"}
                  </span>
                }
                subtitle={
                  last ? (
                    <span className="inline-flex items-center gap-1">
                      {last.direction === "out" && (
                        <DoubleTickIcon className="text-wa-tick" />
                      )}
                      <span className="truncate">{last.plaintext}</span>
                    </span>
                  ) : undefined
                }
                meta={last ? formatTime(last.createdAt) : undefined}
                badge={<UnreadBadge count={0} />}
              />
            ))
          )}
        </div>
      )}

      {identity && (
        <FAB to="/connections" label="New chat">
          <PlusIcon />
        </FAB>
      )}
    </MainShell>
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
