import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import {
  ScreenShell,
  Logo,
  SecondaryButton,
  ErrorMessage,
  NavCard,
  Pill,
  Divider,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import { clearIdentity, db } from "../lib/db";
import { pollAndDecrypt } from "../lib/messageSync";

export function ChatsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const identity = useUnlockStore((s) => s.identity);
  const clearUnlock = useUnlockStore((s) => s.clear);
  const logout = trpc.auth.logout.useMutation();
  const meQuery = trpc.me.get.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const incoming = trpc.connections.listIncoming.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const prekeyStatus = trpc.prekeys.status.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });

  // All locally-known messages (latest per peer).
  const allMessages = useLiveQuery(
    () => db.chatMessages.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  // Background poll while unlocked, every 5s.
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

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      /* ignore */
    }
    clearUnlock();
    clearAuth();
    navigate("/");
  }

  async function onWipeDevice() {
    await clearIdentity();
    clearUnlock();
    clearAuth();
    navigate("/");
  }

  const incomingCount = incoming.data?.length ?? 0;
  const connCount = connections.data?.length ?? 0;
  const otpkCount = prekeyStatus.data?.oneTimePreKeyCount ?? 0;
  const hasSpk = prekeyStatus.data?.hasSignedPreKey ?? false;

  // Build a "last message per peer" map.
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

  return (
    <ScreenShell phase="Phase 3 · Chat">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h2 className="text-2xl font-semibold">Veil</h2>
        <p className="text-sm text-white/60 text-center max-w-sm">
          End-to-end encrypted, single-device. Tap a connection to start
          chatting.
        </p>
      </div>

      {!identity && <UnlockGate />}

      {identity && (
        <>
          <Divider>Conversations</Divider>
          {connections.data && connections.data.length > 0 ? (
            <div className="flex flex-col gap-2">
              {connections.data.map((c) => {
                const last = lastByPeer.get(c.peer.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chats/${c.peer.id}`)}
                    className="text-left rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">
                        {c.peer.id.slice(0, 8)}…
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">
                        {c.peer.fingerprint}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 mt-0.5 truncate">
                      {last
                        ? `${last.direction === "out" ? "you: " : ""}${last.plaintext}`
                        : "No messages yet · tap to chat"}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-sm text-white/50 py-4">
              No connections yet — invite someone below.
            </div>
          )}
        </>
      )}

      <Divider>Hub</Divider>
      <div className="flex flex-col gap-2">
        <NavCard
          to="/connections"
          title="People"
          sub={`${connCount} connection${connCount === 1 ? "" : "s"}${
            incomingCount ? ` · ${incomingCount} pending` : ""
          }`}
          badge={
            incomingCount > 0 ? <Pill tone="accent">{incomingCount}</Pill> : null
          }
        />
        <NavCard
          to="/invite"
          title="Invite someone"
          sub="Generate a private link or QR code"
        />
      </div>

      <Divider>Account</Divider>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-white/60">User ID</span>
          <span className="font-mono text-xs text-white/80 truncate max-w-[60%]">
            {user?.id ?? "—"}
          </span>
        </div>
        <div className="flex justify-between gap-2 mt-1">
          <span className="text-white/60">Type</span>
          <span className="text-white/80">{user?.accountType ?? "—"}</span>
        </div>
        {meQuery.data && (
          <div className="flex justify-between gap-2 mt-1">
            <span className="text-white/60">Created</span>
            <span className="text-white/80">
              {new Date(meQuery.data.createdAt).toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex justify-between gap-2 mt-1">
          <span className="text-white/60">Prekeys</span>
          <span className="text-white/80">
            {hasSpk ? (
              <Pill tone="ok">signed · {otpkCount} one-time</Pill>
            ) : (
              <Pill tone="warn">none uploaded</Pill>
            )}
          </span>
        </div>
        <div className="flex justify-between gap-2 mt-1">
          <span className="text-white/60">Chat</span>
          <span className="text-white/80">
            {identity ? (
              <Pill tone="ok">unlocked</Pill>
            ) : (
              <Pill tone="warn">locked</Pill>
            )}
          </span>
        </div>
        {meQuery.error && (
          <div className="mt-2">
            <ErrorMessage>{meQuery.error.message}</ErrorMessage>
          </div>
        )}
      </div>

      <SecondaryButton onClick={onLogout}>Log out</SecondaryButton>
      <button
        onClick={onWipeDevice}
        className="text-xs text-white/40 hover:text-red-300 underline mt-2"
      >
        Wipe local identity (dev only)
      </button>
    </ScreenShell>
  );
}
