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
          const token = useAuthStore.getState().accessToken;
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
  return cached;
}
