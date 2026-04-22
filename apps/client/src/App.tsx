import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./lib/trpc";
import { useAuthStore } from "./lib/store";
import {
  loadCachedUnlockedIdentity,
  useUnlockStore,
} from "./lib/unlockStore";
import { installSystemThemeListener } from "./lib/themeStore";
import { ensurePushSubscription } from "./lib/push";
import { readPendingInvite, clearPendingInvite } from "./lib/inviteRedirect";
import { WelcomePage } from "./pages/WelcomePage";
import { EmailSignupPage } from "./pages/EmailSignupPage";
import { PhoneSignupPage } from "./pages/PhoneSignupPage";
import { RandomIdSignupPage } from "./pages/RandomIdSignupPage";
import { LoginPage } from "./pages/LoginPage";
import { RandomLoginPage } from "./pages/RandomLoginPage";
import { PhoneLoginPage } from "./pages/PhoneLoginPage";
import { ChatsPage } from "./pages/ChatsPage";
import { ChatThreadPage } from "./pages/ChatThreadPage";
import { InvitePage } from "./pages/InvitePage";
import { InviteRedeemPage } from "./pages/InviteRedeemPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SessionSync } from "./lib/SessionSync";

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );
  const [trpcClient] = useState(() => makeTrpcClient());

  // System theme listener — keeps "system" mode in sync with OS toggle.
  useEffect(() => installSystemThemeListener(), []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionBootstrap />
        <SessionSync />
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/signup/email" element={<EmailSignupPage />} />
          <Route path="/signup/phone" element={<PhoneSignupPage />} />
          <Route path="/signup/random" element={<RandomIdSignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/phone" element={<PhoneLoginPage />} />
          <Route path="/login/random" element={<RandomLoginPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:peerId" element={<ChatThreadPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/i/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<WelcomePage />} />
        </Routes>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * Runs once on mount:
 *  - hydrate unlocked identity from IndexedDB (PIN-once-per-browser),
 *  - refresh the auth session via the long-lived refresh cookie,
 *  - if there's a pending invite + we're now signed in, jump straight
 *    to the invite redeem page no matter what path we landed on.
 */
function SessionBootstrap() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const hydrate = useUnlockStore((s) => s.hydrate);
  const navigate = useNavigate();
  const location = useLocation();
  const refresh = trpc.auth.refresh.useMutation();
  const ran = useMemo(() => ({ done: false }), []);

  useEffect(() => {
    if (ran.done) return;
    ran.done = true;

    // Try to reload the cached, already-decrypted identity so the user
    // doesn't have to re-enter their PIN on every refresh.
    void loadCachedUnlockedIdentity().then((id) => {
      if (id) hydrate(id);
    });

    // Silently re-bind any pre-existing push subscription. We never
    // prompt for permission here — that happens on user action (a
    // dedicated toggle on the Settings screen).
    void ensurePushSubscription({ requestPermission: false });

    // Use the long-lived refresh cookie to mint a new access token.
    refresh
      .mutateAsync()
      .then((r) => {
        setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, refreshExpiresIn: r.refreshExpiresIn, user: r.user });
        const pending = readPendingInvite();
        const onAuthLandingPath =
          location.pathname === "/" ||
          location.pathname === "/login" ||
          location.pathname === "/signup/email" ||
          location.pathname === "/signup/phone" ||
          location.pathname === "/signup/random";
        if (pending) {
          clearPendingInvite();
          navigate(`/i/${encodeURIComponent(pending)}`, { replace: true });
        } else if (onAuthLandingPath) {
          // Already signed in but on a pre-auth screen — push them to chats.
          navigate("/chats", { replace: true });
        }
      })
      .catch(() => {
        /* No valid refresh cookie → user stays on the current page. */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export { useNavigate };
