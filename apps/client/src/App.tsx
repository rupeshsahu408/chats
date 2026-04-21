import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./lib/trpc";
import { useAuthStore } from "./lib/store";
import { WelcomePage } from "./pages/WelcomePage";
import { EmailSignupPage } from "./pages/EmailSignupPage";
import { LoginPage } from "./pages/LoginPage";
import { ChatsPage } from "./pages/ChatsPage";
import { ChatThreadPage } from "./pages/ChatThreadPage";
import { InvitePage } from "./pages/InvitePage";
import { InviteRedeemPage } from "./pages/InviteRedeemPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";

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

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionBootstrap />
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/signup/email" element={<EmailSignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:peerId" element={<ChatThreadPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/i/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<WelcomePage />} />
        </Routes>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * On app start, attempt to silently refresh the session via the
 * httpOnly refresh-token cookie. If it succeeds, we get a fresh access
 * token without the user re-entering anything.
 */
function SessionBootstrap() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const refresh = trpc.auth.refresh.useMutation();
  const ran = useMemo(() => ({ done: false }), []);

  useEffect(() => {
    if (ran.done) return;
    ran.done = true;
    refresh
      .mutateAsync()
      .then((r) => {
        setAuth({ accessToken: r.accessToken, user: r.user });
        // If the user landed on `/?invite=…` while logged out, hop them
        // back to the redeem page now that they have a session.
        const params = new URLSearchParams(window.location.search);
        const inviteFromQuery = params.get("invite");
        const inviteFromStorage = (() => {
          try {
            return sessionStorage.getItem("veil:pending_invite");
          } catch {
            return null;
          }
        })();
        const pending = inviteFromQuery ?? inviteFromStorage;
        if (pending && window.location.pathname === "/") {
          window.history.replaceState({}, "", `/i/${encodeURIComponent(pending)}`);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      })
      .catch(() => {
        // No valid refresh cookie → stay logged out.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// Keep navigate utility in case we need it elsewhere.
export { useNavigate };
