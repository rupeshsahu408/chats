import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { verifyAccessToken } from "../lib/jwt.js";

export interface Context {
  req: CreateFastifyContextOptions["req"];
  res: CreateFastifyContextOptions["res"];
  userId: string | null;
  ip: string;
}

export async function createContext({
  req,
  res,
}: CreateFastifyContextOptions): Promise<Context> {
  let userId: string | null = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    try {
      const claims = await verifyAccessToken(token);
      userId = claims.sub;
    } catch {
      // invalid token → leave userId null
    }
  }
  // Fastify exposes req.ip with proxy parsing when trustProxy is enabled.
  const ip = req.ip ?? "unknown";
  return { req, res, userId, ip };
}
