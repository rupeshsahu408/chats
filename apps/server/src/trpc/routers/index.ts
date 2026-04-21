import { router } from "../init.js";
import { authRouter } from "./auth.js";
import { meRouter } from "./me.js";

export const appRouter = router({
  auth: authRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;
