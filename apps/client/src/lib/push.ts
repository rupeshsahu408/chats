/**
 * Web Push subscription lifecycle.
 *
 * Flow:
 *   1. Service worker is registered (vite-plugin-pwa does this).
 *   2. We fetch the VAPID public key from the server.
 *   3. We subscribe via PushManager and POST the subscription to the
 *      server so it can dispatch generic "New message" notifications.
 *
 * Notification payload never carries the message text — the recipient
 * sees only "New message" until they open the app and decrypt locally.
 */

import { trpcClientProxy } from "./trpcClientProxy";

const SUBSCRIBED_KEY = "veil:push:endpoint";

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const std = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToUrlB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushSetupResult =
  | { state: "ok" }
  | { state: "unsupported" }
  | { state: "denied" }
  | { state: "not_configured" }
  | { state: "error"; message: string };

export async function ensurePushSubscription(opts?: {
  /** If true, prompt the user for permission. Defaults to false (silent). */
  requestPermission?: boolean;
}): Promise<PushSetupResult> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return { state: "unsupported" };
  }

  // Permission handling.
  let perm = Notification.permission;
  if (perm === "default" && opts?.requestPermission) {
    try {
      perm = await Notification.requestPermission();
    } catch {
      return { state: "error", message: "Permission request failed." };
    }
  }
  if (perm === "denied") return { state: "denied" };
  if (perm !== "granted") return { state: "error", message: "Permission not granted." };

  let reg: ServiceWorkerRegistration | undefined;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch {
    return { state: "unsupported" };
  }
  if (!reg) return { state: "unsupported" };

  // Pull the VAPID public key.
  let publicKey: string | null = null;
  try {
    const r = await trpcClientProxy().push.publicKey.query();
    publicKey = r.publicKey;
  } catch {
    return { state: "error", message: "Couldn't reach server." };
  }
  if (!publicKey) return { state: "not_configured" };

  // Re-use an existing subscription if it matches the same key.
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const opt = sub.options.applicationServerKey;
    const optB64 = opt ? bufToUrlB64(opt as ArrayBuffer) : null;
    if (optB64 !== publicKey) {
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      sub = null;
    }
  }
  if (!sub) {
    try {
      const keyBytes = urlBase64ToUint8Array(publicKey);
      // Copy into a fresh ArrayBuffer to satisfy TS DOM types.
      const keyBuf = new ArrayBuffer(keyBytes.byteLength);
      new Uint8Array(keyBuf).set(keyBytes);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuf,
      });
    } catch (err) {
      return {
        state: "error",
        message: err instanceof Error ? err.message : "Subscribe failed.",
      };
    }
  }

  const p256dh = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!p256dh || !auth) {
    return { state: "error", message: "Subscription missing keys." };
  }

  try {
    await trpcClientProxy().push.subscribe.mutate({
      endpoint: sub.endpoint,
      p256dh: bufToUrlB64(p256dh),
      auth: bufToUrlB64(auth),
      userAgent: navigator.userAgent.slice(0, 200),
    });
    localStorage.setItem(SUBSCRIBED_KEY, sub.endpoint);
    return { state: "ok" };
  } catch (err) {
    return {
      state: "error",
      message: err instanceof Error ? err.message : "Server rejected subscription.",
    };
  }
}

export async function disablePushSubscription(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  try {
    await trpcClientProxy().push.unsubscribe.mutate({ endpoint });
  } catch {
    /* ignore */
  }
  localStorage.removeItem(SUBSCRIBED_KEY);
}
