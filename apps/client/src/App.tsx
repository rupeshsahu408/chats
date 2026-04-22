import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./lib/trpc";
import { useAuthStore } from "./lib/store";
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
          <Route path="/i/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<WelcomePage />} />
        </Routes>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

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
          window.history.replaceState(
            {},
            "",
            `/i/${encodeURIComponent(pending)}`,
          );
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export { useNavigate };
