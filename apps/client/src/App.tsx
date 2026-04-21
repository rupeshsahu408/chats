import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./lib/trpc";
import { useAuthStore } from "./lib/store";
import { WelcomePage } from "./pages/WelcomePage";
import { EmailSignupPage } from "./pages/EmailSignupPage";
import { LoginPage } from "./pages/LoginPage";
import { ChatsPage } from "./pages/ChatsPage";

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
