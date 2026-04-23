import { router } from "../init.js";
import { authRouter } from "./auth.js";
import { meRouter } from "./me.js";
import { prekeysRouter } from "./prekeys.js";
import { invitesRouter } from "./invites.js";
import { connectionsRouter } from "./connections.js";
import { messagesRouter } from "./messages.js";
import { mediaRouter } from "./media.js";
import { pushRouter } from "./push.js";
import { linkPreviewRouter } from "./linkPreview.js";
import { privacyRouter } from "./privacy.js";
import { groupsRouter } from "./groups.js";
import { scheduledRouter } from "./scheduled.js";
import { contactsRouter } from "./contacts.js";

export const appRouter = router({
  auth: authRouter,
  me: meRouter,
  prekeys: prekeysRouter,
  invites: invitesRouter,
  connections: connectionsRouter,
  messages: messagesRouter,
  media: mediaRouter,
  push: pushRouter,
  linkPreview: linkPreviewRouter,
  privacy: privacyRouter,
  groups: groupsRouter,
  scheduled: scheduledRouter,
  contacts: contactsRouter,
});

export type AppRouter = typeof appRouter;
