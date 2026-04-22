import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/src/trpc/routers/index.js";
import { useAuthStore } from "./store";

export const trpc = createTRPCReact<AppRouter>();

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function makeTrpcClient() {
  return trpc.createClient({
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
          // Sent on every request so the server can read it for /auth.refresh
          // even when third-party cookies are blocked (Vercel ↔ Render etc.).
          if (refreshToken) h["x-refresh-token"] = refreshToken;
          return h;
        },
      }),
    ],
  });
}
