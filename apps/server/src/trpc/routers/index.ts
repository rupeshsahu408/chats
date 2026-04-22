import { router } from "../init.js";
import { authRouter } from "./auth.js";
import { meRouter } from "./me.js";
import { prekeysRouter } from "./prekeys.js";
import { invitesRouter } from "./invites.js";
import { connectionsRouter } from "./connections.js";
import { messagesRouter } from "./messages.js";
import { mediaRouter } from "./media.js";
import { pushRouter } from "./push.js";

export const appRouter = router({
  auth: authRouter,
  me: meRouter,
  prekeys: prekeysRouter,
  invites: invitesRouter,
  connections: connectionsRouter,
  messages: messagesRouter,
  media: mediaRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
