import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to apps/server/.env",
    );
  }
  if (!_db) {
    _sql = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      prepare: false,
    });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export { schema };
