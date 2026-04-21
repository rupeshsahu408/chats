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
          const token = useAuthStore.getState().accessToken;
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
