import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  SecondaryButton,
  ErrorMessage,
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
    // Note: we DO NOT clear local identity on logout — that's the WhatsApp
    // model. Encrypted history & identity stay; only the session is gone.
    navigate("/");
  }

  async function onWipeDevice() {
    await clearIdentity();
    clearAuth();
    navigate("/");
  }

  return (
    <ScreenShell back="/" phase="Phase 1 · Account">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h2 className="text-2xl font-semibold">You're in.</h2>
        <p className="text-sm text-white/60 text-center max-w-sm">
          Your account is created. Connections (Phase 2) and 1:1 encrypted
          chat (Phase 3) ship next.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="text-xs uppercase tracking-wider text-white/40 mb-2">
          Account
        </div>
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
