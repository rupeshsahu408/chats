import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  SecondaryButton,
  ErrorMessage,
  NavCard,
  Pill,
  Divider,
} from "../components/Layout";
import { clearIdentity } from "../lib/db";

export function ChatsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
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

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      /* ignore */
    }
    clearAuth();
    navigate("/");
  }

  async function onWipeDevice() {
    await clearIdentity();
    clearAuth();
    navigate("/");
  }

  const incomingCount = incoming.data?.length ?? 0;
  const connCount = connections.data?.length ?? 0;
  const otpkCount = prekeyStatus.data?.oneTimePreKeyCount ?? 0;
  const hasSpk = prekeyStatus.data?.hasSignedPreKey ?? false;

  return (
    <ScreenShell phase="Phase 2 · Hub">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h2 className="text-2xl font-semibold">You're in.</h2>
        <p className="text-sm text-white/60 text-center max-w-sm">
          1:1 encrypted chat ships in Phase 3. For now, invite someone and
          build your contact graph.
        </p>
      </div>

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
