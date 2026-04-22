import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { WsClientEventSchema } from "@veil/shared";
import { verifyAccessToken } from "./jwt.js";
import { getDb, schema } from "../db/index.js";
import {
  publish,
  registerSocket,
  unregisterSocket,
} from "./wsHub.js";

/**
 * Real-time relay used by `/ws`. Clients connect with their access token
 * either as the `?token=...` query string or the `Sec-WebSocket-Protocol`
 * header (browsers can only set the latter via the `protocols` array).
 *
 * On connect we send `{type:"hello", userId}`. The client may then send
 * `ping` (responded with `pong`) or `mark_delivered` (marks server rows
 * delivered and notifies the original sender).
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
      }
    });

    socket.on("close", () => {
      clearInterval(heartbeat);
      unregisterSocket(userId, socket);
    });
    socket.on("error", () => {
      clearInterval(heartbeat);
      unregisterSocket(userId, socket);
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
