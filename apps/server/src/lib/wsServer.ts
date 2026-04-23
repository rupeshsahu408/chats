import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import { eq, inArray, and, isNull, or } from "drizzle-orm";
import { WsClientEventSchema } from "@veil/shared";
import { verifyAccessToken } from "./jwt.js";
import { getDb, schema } from "../db/index.js";
import {
  publish,
  registerSocket,
  unregisterSocket,
} from "./wsHub.js";

/** Look up all accepted connection peer IDs for a given user. */
async function getConnectionPeerIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userAId: schema.connections.userAId, userBId: schema.connections.userBId })
    .from(schema.connections)
    .where(
      or(
        eq(schema.connections.userAId, userId),
        eq(schema.connections.userBId, userId),
      ),
    );
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

/** Broadcast online/offline presence to all connected peers of a user. */
async function broadcastPresence(userId: string, online: boolean): Promise<void> {
  try {
    const peerIds = await getConnectionPeerIds(userId);
    for (const peerId of peerIds) {
      publish(peerId, { type: "presence", userId, online });
    }
  } catch {
    // Best-effort — don't crash the WS handler if DB is unavailable.
  }
}

/**
 * Real-time relay used by `/ws`. Clients connect with their access token
 * either as the `?token=...` query string or the `Sec-WebSocket-Protocol`
 * header (browsers can only set the latter via the `protocols` array).
 *
 * On connect we send `{type:"hello", userId}`. The client may then send
 *   - `ping` (responded with `pong`)
 *   - `mark_delivered` (records delivery receipts + notifies sender)
 *   - `mark_read` (records read receipts + notifies sender)
 *   - `typing` (relayed ephemerally to the named peer; never persisted)
 *
 * Outbound `new_message` events are published from `messages.send`.
 */
export async function registerWebSocketRoutes(
  app: FastifyInstance,
): Promise<void> {
  await app.register(websocketPlugin, {
    options: { maxPayload: 1024 * 256 },
  });

  app.get("/ws", { websocket: true }, async (socket, req) => {
    const token = extractToken(req);
    if (!token) {
      try {
        socket.send(
          JSON.stringify({ type: "error", message: "missing token" }),
        );
      } catch {
        /* ignore */
      }
      socket.close(4401, "missing token");
      return;
    }
    let userId: string;
    try {
      const claims = await verifyAccessToken(token);
      userId = claims.sub;
    } catch {
      socket.close(4401, "invalid token");
      return;
    }

    registerSocket(userId, socket);
    void broadcastPresence(userId, true);
    try {
      socket.send(JSON.stringify({ type: "hello", userId }));
    } catch {
      /* ignore */
    }

    const heartbeat = setInterval(() => {
      try {
        socket.ping();
      } catch {
        /* ignore */
      }
    }, 30_000);

    socket.on("message", async (raw: Buffer) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString("utf8"));
      } catch {
        return;
      }
      const result = WsClientEventSchema.safeParse(parsed);
      if (!result.success) return;
      const event = result.data;

      if (event.type === "ping") {
        try {
          socket.send(JSON.stringify({ type: "pong", t: event.t }));
        } catch {
          /* ignore */
        }
        return;
      }

      if (event.type === "mark_delivered") {
        if (event.ids.length === 0) return;
        const db = getDb();
        const now = new Date();
        const updated = await db
          .update(schema.messages)
          .set({ deliveredAt: now })
          .where(
            and(
              inArray(schema.messages.id, event.ids),
              eq(schema.messages.recipientUserId, userId),
              isNull(schema.messages.deliveredAt),
            ),
          )
          .returning({
            id: schema.messages.id,
            sender: schema.messages.senderUserId,
          });
        for (const row of updated) {
          publish(row.sender, {
            type: "delivery_receipt",
            messageId: row.id,
            by: userId,
            at: now.toISOString(),
          });
        }
        return;
      }

      if (event.type === "mark_read") {
        if (event.ids.length === 0) return;
        const db = getDb();
        const now = new Date();
        const updated = await db
          .update(schema.messages)
          .set({ readAt: now })
          .where(
            and(
              inArray(schema.messages.id, event.ids),
              eq(schema.messages.recipientUserId, userId),
              isNull(schema.messages.readAt),
            ),
          )
          .returning({
            id: schema.messages.id,
            sender: schema.messages.senderUserId,
          });
        for (const row of updated) {
          publish(row.sender, {
            type: "read_receipt",
            messageId: row.id,
            by: userId,
            at: now.toISOString(),
          });
        }
        return;
      }

      if (event.type === "typing") {
        if (event.to === userId) return;
        publish(event.to, {
          type: "typing",
          from: userId,
          typing: event.typing,
        });
        return;
      }
    });

    socket.on("close", () => {
      clearInterval(heartbeat);
      unregisterSocket(userId, socket);
      void broadcastPresence(userId, false);
      // Stamp lastSeenAt so the peer's "last seen" header shows an accurate time.
      void getDb()
        .update(schema.users)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.users.id, userId))
        .catch(() => undefined);
    });
    socket.on("error", () => {
      clearInterval(heartbeat);
      unregisterSocket(userId, socket);
      void broadcastPresence(userId, false);
    });
  });
}

function extractToken(req: {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  if (req.url) {
    try {
      const u = new URL(req.url, "http://localhost");
      const t = u.searchParams.get("token");
      if (t) return t;
    } catch {
      /* ignore */
    }
  }
  const proto = req.headers["sec-websocket-protocol"];
  if (typeof proto === "string") {
    const parts = proto.split(",").map((s) => s.trim());
    for (const p of parts) {
      if (p.startsWith("veil-token.")) return p.slice("veil-token.".length);
    }
  }
  return null;
}
