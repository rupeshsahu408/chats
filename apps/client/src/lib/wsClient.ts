import type { WsServerEvent } from "@veil/shared";
import { useAuthStore } from "./store";

/**
 * Lightweight WebSocket client for live message delivery and receipts.
 *
 * - Single connection per browser tab.
 * - Exponential backoff reconnect (capped) when the server drops us.
 * - Subscribers receive parsed `WsServerEvent`s.
 *
 * The transport URL is derived from `VITE_API_BASE_URL` (https → wss).
 */

type Listener = (event: WsServerEvent) => void;

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

function wsUrl(token: string): string {
  let httpBase: string;
  if (/^https?:\/\//.test(baseUrl)) {
    httpBase = baseUrl;
  } else {
    httpBase = `${window.location.origin}${
      baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`
    }`;
  }
  const u = new URL(httpBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  // Strip the trailing /trpc-style suffix; the WS endpoint lives next to /trpc.
  u.pathname = u.pathname.replace(/\/$/, "") + "/ws";
  u.searchParams.set("token", token);
  return u.toString();
}

class VeilWebSocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private wantOpen = false;
  private currentToken: string | null = null;
  private lastIncomingAt = 0;

  start(): void {
    this.wantOpen = true;
    this.connect();
  }

  stop(): void {
    this.wantOpen = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close(1000, "client stop");
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  send(payload: unknown): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  isOpen(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  /** Force reconnect (e.g. after the access token rotates). */
  refreshToken(token: string | null): void {
    if (token === this.currentToken) return;
    this.currentToken = token;
    if (this.wantOpen) {
      if (this.socket) {
        try {
          this.socket.close(4000, "token refresh");
        } catch {
          /* ignore */
        }
      }
      this.connect();
    }
  }

  private connect(): void {
    if (!this.wantOpen) return;
    const token =
      this.currentToken ?? useAuthStore.getState().accessToken ?? null;
    if (!token) {
      // No token yet — try again shortly.
      this.scheduleReconnect();
      return;
    }
    this.currentToken = token;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(token));
    } catch (e) {
      console.warn("WS construction failed", e);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.lastIncomingAt = Date.now();
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        this.send({ type: "ping", t: Date.now() });
      }, 25_000);
      // Watchdog: if we haven't heard anything (including pong) for 70s,
      // the socket is a zombie — force-close so we reconnect cleanly.
      if (this.watchdogTimer) clearInterval(this.watchdogTimer);
      this.watchdogTimer = setInterval(() => {
        if (Date.now() - this.lastIncomingAt > 70_000 && this.socket) {
          try {
            this.socket.close(4001, "watchdog");
          } catch {
            /* ignore */
          }
        }
      }, 15_000);
    };

    socket.onmessage = (ev) => {
      this.lastIncomingAt = Date.now();
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const event = parsed as WsServerEvent;
      for (const fn of this.listeners) {
        try {
          fn(event);
        } catch (e) {
          console.error("WS listener threw", e);
        }
      }
    };

    socket.onclose = () => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      if (this.watchdogTimer) {
        clearInterval(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.socket = null;
      if (this.wantOpen) this.scheduleReconnect();
    };

    socket.onerror = () => {
      // The close handler will fire next and trigger reconnect.
    };
  }

  private scheduleReconnect(): void {
    if (!this.wantOpen) return;
    if (this.reconnectTimer) return;
    const attempt = this.reconnectAttempt++;
    const delay = Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const wsClient = new VeilWebSocketClient();

/** Notify the server that the listed inbox messages have been persisted. */
export function wsMarkDelivered(ids: string[]): boolean {
  if (ids.length === 0) return true;
  return wsClient.send({ type: "mark_delivered", ids });
}

/** Notify the server that the listed messages have been opened (read). */
export function wsMarkRead(ids: string[]): boolean {
  if (ids.length === 0) return true;
  return wsClient.send({ type: "mark_read", ids });
}

/** Send an ephemeral typing indicator to a peer. Best-effort; not retried. */
export function wsTyping(to: string, typing: boolean): boolean {
  return wsClient.send({ type: "typing", to, typing });
}
