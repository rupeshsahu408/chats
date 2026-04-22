import type { WebSocket } from "@fastify/websocket";
import type { WsServerEvent } from "@veil/shared";

/**
 * In-memory pub/sub for live message delivery and presence.
 *
 * Single-process only — fine while we're on a single Render instance.
 * If we ever scale horizontally, swap this out for Redis pub/sub.
 */

const sockets = new Map<string, Set<WebSocket>>();

export function registerSocket(userId: string, ws: WebSocket): void {
  let bucket = sockets.get(userId);
  if (!bucket) {
    bucket = new Set();
    sockets.set(userId, bucket);
  }
  bucket.add(ws);
}

export function unregisterSocket(userId: string, ws: WebSocket): void {
  const bucket = sockets.get(userId);
  if (!bucket) return;
  bucket.delete(ws);
  if (bucket.size === 0) sockets.delete(userId);
}

export function isOnline(userId: string): boolean {
  const bucket = sockets.get(userId);
  return !!bucket && bucket.size > 0;
}

export function publish(userId: string, event: WsServerEvent): number {
  const bucket = sockets.get(userId);
  if (!bucket || bucket.size === 0) return 0;
  const payload = JSON.stringify(event);
  let sent = 0;
  for (const ws of bucket) {
    try {
      ws.send(payload);
      sent += 1;
    } catch {
      // Will be cleaned up by close handler.
    }
  }
  return sent;
}
