import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  customType,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountType = pgEnum("account_type", [
  "email",
  "phone",
  "random",
]);

export const otpPurpose = pgEnum("otp_purpose", ["signup", "login"]);

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountType: accountType("account_type").notNull(),
    /** HMAC-SHA256 of normalised email (hex). NULL for non-email accounts. */
    emailHash: text("email_hash"),
    /** HMAC-SHA256 of E.164 phone (hex). NULL for non-phone accounts. */
    phoneHash: text("phone_hash"),
    /** Random user ID for Option C accounts. */
    randomId: text("random_id"),
    /** Raw Ed25519 identity public key (32 bytes). */
    identityPubkey: bytea("identity_pubkey").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => ({
    emailHashIdx: uniqueIndex("users_email_hash_idx")
      .on(t.emailHash)
      .where(sql`${t.emailHash} IS NOT NULL`),
    phoneHashIdx: uniqueIndex("users_phone_hash_idx")
      .on(t.phoneHash)
      .where(sql`${t.phoneHash} IS NOT NULL`),
    randomIdIdx: uniqueIndex("users_random_id_idx")
      .on(t.randomId)
      .where(sql`${t.randomId} IS NOT NULL`),
  }),
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** HMAC of the email/phone identifier. */
    identifierHash: text("identifier_hash").notNull(),
    /** bcrypt hash of the 6-digit OTP code. */
    codeHash: text("code_hash").notNull(),
    purpose: otpPurpose("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumed: boolean("consumed").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    identifierIdx: index("otp_identifier_idx").on(t.identifierHash),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 hash of the refresh token (we never store it raw). */
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    deviceLabel: text("device_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export type UserRow = typeof users.$inferSelect;
