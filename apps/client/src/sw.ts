/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

/** Generic, content-free push payload. The server never sends message text. */
type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    if (event.data) payload = event.data.json() as PushPayload;
  } catch {
    /* ignore — server may send empty data */
  }
  const title = payload.title ?? "New message";
  const body = payload.body ?? "Open Veil to read it.";
  const url = payload.url ?? "/chats";
  const tag = payload.tag ?? "veil-message";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? "/chats";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        try {
          if ("focus" in c) {
            await c.focus();
            if ("navigate" in c) {
              try {
                await (c as WindowClient).navigate(target);
              } catch {
                /* ignore */
              }
            }
            return;
          }
        } catch {
          /* ignore */
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
