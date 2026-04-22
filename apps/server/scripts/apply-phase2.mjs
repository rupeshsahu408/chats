#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });
const text = readFileSync(new URL("../drizzle/0001_phase2.sql", import.meta.url), "utf8");
const stmts = text.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
for (const s of stmts) {
  console.log("→", s.split("\n")[0].slice(0, 80));
  await sql.unsafe(s);
}
console.log(`Applied ${stmts.length} statement(s).`);
await sql.end();
