import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/src/trpc/routers/index.js";
import { useAuthStore } from "./store";

/**
 * A direct tRPC proxy client (no React) so non-React code (the chat
 * crypto layer, message polling) can call procedures.
 *
 * Pulls the access token from the same Zustand store the React tRPC
 * client uses, so they stay in sync.
 */

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

let cached: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

export function trpcClientProxy() {
  if (cached) return cached;
  cached = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        transformer: superjson,
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
        headers() {
          const { accessToken, refreshToken } = useAuthStore.getState();
          const h: Record<string, string> = {};
          if (accessToken) h.authorization = `Bearer ${accessToken}`;
          // Mirror the React tRPC client: in cross-site setups (Vercel
          // client ↔ Render server) the `veil_refresh` cookie is often
          // blocked, so we always also pass the refresh token in a
          // header. Without this, every server-side call that depends
          // on the refresh cookie (e.g. `auth.checkSessionStatus`)
          // would falsely report the user as signed-out.
          if (refreshToken) h["x-refresh-token"] = refreshToken;
          return h;
        },
      }),
    ],
  });
  return cached;
}
