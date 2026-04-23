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
    // Idempotent — connect() itself bails out if a socket is already
    // open or connecting. Without this guard, calling start() on every
    // token rotation would pile up parallel sockets and trigger the
    // "WebSocket is closed before the connection is established"
    // warning storm in production.
    this.connect();
  }

  stop(): void {
    this.wantOpen = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearTransportTimers();
    if (this.socket) {
      const s = this.socket;
      this.detachHandlers(s);
      this.socket = null;
      try {
        s.close(1000, "client stop");
      } catch {
        /* ignore */
      }
    }
    this.currentToken = null;
    this.reconnectAttempt = 0;
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
      this.replaceSocket();
    }
  }

  /**
   * Tear down the current socket (if any) without letting its stale
   * `onclose` clobber the brand-new socket we're about to create. We
   * detach handlers first, then close, so the next connect() owns
   * `this.socket` cleanly.
   */
  private replaceSocket(): void {
    const stale = this.socket;
    if (stale) {
      this.detachHandlers(stale);
      try {
        stale.close(4000, "token refresh");
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.clearTransportTimers();
    this.connect();
  }

  private detachHandlers(s: WebSocket): void {
    try {
      s.onopen = null;
      s.onmessage = null;
      s.onclose = null;
      s.onerror = null;
    } catch {
      /* ignore */
    }
  }

  private clearTransportTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private connect(): void {
    if (!this.wantOpen) return;
    // Idempotent: don't pile up parallel sockets if one is already
    // alive (or still negotiating). This is what was previously causing
    // the "WebSocket is closed before the connection is established"
    // warning storm whenever start()/refreshToken() ran twice in a row.
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
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
      // Guard against stale-socket callbacks: only act if this is the
      // socket we currently own.
      if (this.socket !== socket) return;
      this.reconnectAttempt = 0;
      this.lastIncomingAt = Date.now();
      this.clearTransportTimers();
      this.heartbeatTimer = setInterval(() => {
        this.send({ type: "ping", t: Date.now() });
      }, 25_000);
      // Watchdog: if we haven't heard anything (including pong) for 70s,
      // the socket is a zombie — force-close so we reconnect cleanly.
      this.watchdogTimer = setInterval(() => {
        if (Date.now() - this.lastIncomingAt > 70_000 && this.socket === socket) {
          try {
            socket.close(4001, "watchdog");
          } catch {
            /* ignore */
          }
        }
      }, 15_000);
    };

    socket.onmessage = (ev) => {
      // Even messages on stale sockets are safe to dispatch (they
      // already passed server auth), but we update lastIncomingAt only
      // for the current one so the watchdog stays accurate.
      if (this.socket === socket) this.lastIncomingAt = Date.now();
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
      // Ignore close events from stale sockets — they would otherwise
      // null out `this.socket` (the brand-new one we just created) and
      // trigger a spurious reconnect storm.
      if (this.socket !== socket) return;
      this.clearTransportTimers();
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

/**
 * Send an ephemeral typing/activity indicator to a peer. Best-effort; not
 * retried. `kind` lets the peer's UI show "typing…", "recording…" or
 * "choosing a photo…" instead of a generic indicator.
 */
export function wsTyping(
  to: string,
  typing: boolean,
  kind?: "text" | "voice" | "photo",
): boolean {
  return wsClient.send({ type: "typing", to, typing, ...(kind ? { kind } : {}) });
}
