import { z } from "zod";

/**
 * Placeholder shared schemas. These will grow as features are added in
 * later phases (auth, connections, messaging, etc.).
 */

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const UserIdSchema = z.string().uuid();
export type UserId = z.infer<typeof UserIdSchema>;
