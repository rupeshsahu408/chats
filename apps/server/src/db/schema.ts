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

export const connectionRequestStatus = pgEnum("connection_request_status", [
  "pending",
  "accepted",
  "rejected",
  "canceled",
  "expired",
]);

export const lastSeenPrivacy = pgEnum("last_seen_privacy", [
  "everyone",
  "contacts",
  "nobody",
]);

export const reportReason = pgEnum("report_reason", [
  "spam",
  "harassment",
  "impersonation",
  "illegal",
  "other",
]);

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
});

/* ─────────── users ─────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountType: accountType("account_type").notNull(),
    /** HMAC-SHA256 of normalised email (hex). NULL for non-email accounts. */
    emailHash: text("email_hash"),
    /** HMAC-SHA256 of E.164 phone (hex). NULL for non-phone accounts. */
    phoneHash: text("phone_hash"),
    /**
     * Pepper-free SHA-256 of the canonical phone string ("phone:+E164", lower-cased).
     * Used only for contact discovery, where the client cannot know the
     * server pepper. Discovery does HMAC(salt, phoneSha) so neither party
     * learns the actual address book.
     */
    phoneSha: text("phone_sha"),
    /** Random user ID for Option C accounts. */
    randomId: text("random_id"),
    /**
     * Public, Instagram-style handle. Unique, case-insensitive,
     * permanent (cannot be changed once set). Optional only for legacy
     * accounts that pre-date the username flow.
     */
    username: text("username"),
    /** Argon2id hash of the user's password (random-ID accounts only). */
    passwordHash: text("password_hash"),
    /**
     * bcrypt hash of the user's daily verification password.
     * Required again every 24h before the user can access the main app.
     * Random-ID accounts only.
     */
    verificationPasswordHash: text("verification_password_hash"),
    /**
     * Public profile fields shown in chat headers, contact lists, etc.
     * All optional — UI falls back to the username (or random ID).
     */
    displayName: text("display_name"),
    bio: text("bio"),
    /**
     * Inline base64 data URL of the user's profile photo, capped at
     * ~64 KB after client-side resize. Inlined (rather than blob
     * storage) so it can be served alongside any user lookup with no
     * extra round-trip and no presigned URL plumbing.
     */
    avatarDataUrl: text("avatar_data_url"),
    /** Raw Ed25519 identity public key (32 bytes). Used for signatures + fingerprint. */
    identityPubkey: bytea("identity_pubkey").notNull(),
    /** Raw X25519 identity public key (32 bytes). Used for X3DH ECDH. Phase 3+. */
    identityX25519Pubkey: bytea("identity_x25519_pubkey"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Phase 6: who can see your `lastSeenAt` timestamp. */
    lastSeenPrivacy: lastSeenPrivacy("last_seen_privacy")
      .notNull()
      .default("contacts"),
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
    usernameIdx: uniqueIndex("users_username_idx")
      .on(sql`lower(${t.username})`)
      .where(sql`${t.username} IS NOT NULL`),
  }),
);

/* ─────────── otp_codes ─────────── */

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

/* ─────────── sessions ─────────── */

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

/* ─────────── signed_prekeys ─────────── */
/*
 * Phase 2 placeholder shape. In Phase 3 we'll switch to X25519 + the
 * full Signal Protocol; the wire format (id + 32-byte public key +
 * 64-byte Ed25519 signature) stays the same.
 *
 * One signed prekey per user; uploading a new one replaces the old.
 */

export const signedPrekeys = pgTable("signed_prekeys", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  keyId: integer("key_id").notNull(),
  publicKey: bytea("public_key").notNull(),
  /** Ed25519 signature over publicKey by the identity key. */
  signature: bytea("signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────── one_time_prekeys ─────────── */

export const oneTimePrekeys = pgTable(
  "one_time_prekeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyId: integer("key_id").notNull(),
    publicKey: bytea("public_key").notNull(),
    /** Set when a peer claims this key for an X3DH handshake. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimedByUserId: uuid("claimed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("otpk_user_idx").on(t.userId),
    userKeyIdx: uniqueIndex("otpk_user_key_idx").on(t.userId, t.keyId),
    /** For "give me an unclaimed key for this user" lookups. */
    unclaimedIdx: index("otpk_unclaimed_idx")
      .on(t.userId)
      .where(sql`${t.claimedAt} IS NULL`),
  }),
);

/* ─────────── invites ─────────── */

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 hash of the URL-safe invite token. The raw token is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label"),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    inviterIdx: index("invites_inviter_idx").on(t.inviterUserId),
  }),
);

/* ─────────── connection_requests ─────────── */

export const connectionRequests = pgTable(
  "connection_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The user who clicked the invite and is asking to connect. */
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The user who created the invite. */
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteId: uuid("invite_id").references(() => invites.id, {
      onDelete: "set null",
    }),
    status: connectionRequestStatus("status").notNull().default("pending"),
    /** Optional one-line note from the requester (≤140 chars). */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => ({
    toIdx: index("connreq_to_idx").on(t.toUserId, t.status),
    fromIdx: index("connreq_from_idx").on(t.fromUserId, t.status),
    /** Only one pending request per (from, to) pair at a time. */
    pendingPairIdx: uniqueIndex("connreq_pending_pair_idx")
      .on(t.fromUserId, t.toUserId)
      .where(sql`${t.status} = 'pending'`),
  }),
);

/* ─────────── connections ─────────── */
/*
 * Canonical representation: we always store with userAId < userBId
 * (lexicographic), so a single row represents the bidirectional link.
 */

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pairIdx: uniqueIndex("connections_pair_idx").on(t.userAId, t.userBId),
    aIdx: index("connections_a_idx").on(t.userAId),
    bIdx: index("connections_b_idx").on(t.userBId),
  }),
);

/* ─────────── messages ─────────── */
/*
 * Server-side encrypted message mailbox. Server only ever sees opaque
 * ciphertext + an opaque header. `fetchAndConsume` deletes the row
 * after returning it, so we don't keep messages around long-term —
 * forward secrecy lives client-side (in the ratchet state).
 */

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Phase 7: when set, this row is one fan-out leg of a group message. */
    groupId: uuid("group_id"),
    /**
     * Canonical conversation id. For 1:1: lower(userId) || ':' || higher(userId).
     * For groups: 'g:' || groupId.
     */
    conversationId: text("conversation_id").notNull(),
    /** Plaintext header bytes (typed JSON: ratchet pub, counters, X3DH metadata). */
    header: bytea("header").notNull(),
    /** AES-GCM ciphertext. */
    ciphertext: bytea("ciphertext").notNull(),
    /** When the recipient acknowledged delivery on at least one device. */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    /** When the recipient opened/read the message (Phase 2). */
    readAt: timestamp("read_at", { withTimezone: true }),
    /**
     * Optional server-side TTL (Phase 2: disappearing messages). When
     * set, the row will be hard-deleted by the message sweeper after
     * this timestamp.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    recipientIdx: index("messages_recipient_idx").on(
      t.recipientUserId,
      t.createdAt,
    ),
    /** For "give me undelivered messages for this user". */
    inboxIdx: index("messages_inbox_idx")
      .on(t.recipientUserId, t.createdAt)
      .where(sql`${t.deliveredAt} IS NULL`),
    conversationIdx: index("messages_conversation_idx").on(
      t.conversationId,
      t.createdAt,
    ),
    expiryIdx: index("messages_expires_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  }),
);

/* ─────────── media_blobs ─────────── */
/*
 * Opaque encrypted media (images, voice notes, ...). The server only
 * sees ciphertext + an opaque MIME hint chosen by the uploader; the
 * AES-GCM key is never sent to the server — it travels to the
 * recipient inside a Signal-encrypted chat message envelope.
 *
 * Rows expire after `expiresAt` (24 h by default) and are pruned by
 * the periodic sweep. The owner can also delete on demand.
 */

export const mediaBlobs = pgTable(
  "media_blobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Client-supplied MIME hint (e.g. "image/jpeg", "audio/webm"). */
    mime: text("mime").notNull(),
    /** Object key inside the R2 bucket. Ciphertext lives there, not in PG. */
    r2Key: text("r2_key").notNull(),
    /** Ciphertext byte count (set on finalize from R2 HEAD). */
    sizeBytes: integer("size_bytes").notNull().default(0),
    /** Flipped true after finalizeUpload verifies the object landed in R2. */
    uploaded: boolean("uploaded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    ownerIdx: index("media_owner_idx").on(t.ownerUserId, t.createdAt),
    expiryIdx: index("media_expiry_idx").on(t.expiresAt),
  }),
);

/* ─────────── push_subscriptions ─────────── */
/*
 * Web Push (VAPID) subscriptions per user/device. Server keeps these
 * to dispatch generic "New message" notifications when a chat arrives
 * and the recipient is offline. Notification payload never contains
 * the message text.
 */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("push_user_idx").on(t.userId),
    endpointIdx: uniqueIndex("push_endpoint_idx").on(t.endpoint),
  }),
);

/* ─────────── blocks (Phase 6) ─────────── */
/*
 * Directional block: blocker_user_id has blocked blocked_user_id.
 * Enforced server-side in `messages.send` and
 * `connections.requestByPeerId`. Existing connections are NOT removed
 * automatically — the user can do that separately — but messaging is
 * refused as long as the block is in place.
 */

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pairIdx: uniqueIndex("blocks_pair_idx").on(t.blockerUserId, t.blockedUserId),
    blockerIdx: index("blocks_blocker_idx").on(t.blockerUserId),
    blockedIdx: index("blocks_blocked_idx").on(t.blockedUserId),
  }),
);

/* ─────────── reports (Phase 6) ─────────── */
/*
 * User-submitted abuse reports. We never see message contents (E2E),
 * so the report carries only the reporter, the accused, a category,
 * and an optional plaintext note the reporter chose to share.
 */

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: uuid("reported_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    reporterIdx: index("reports_reporter_idx").on(t.reporterUserId, t.createdAt),
    reportedIdx: index("reports_reported_idx").on(t.reportedUserId),
  }),
);

/* ─────────── groups (Phase 7) ─────────── */

export const groupRole = pgEnum("group_role", ["admin", "member"]);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    /** Bumps on every membership change; clients use this to know when to re-distribute sender keys. */
    epoch: integer("epoch").notNull().default(0),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    creatorIdx: index("groups_creator_idx").on(t.createdByUserId),
  }),
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pairIdx: uniqueIndex("group_members_pair_idx").on(t.groupId, t.userId),
    groupIdx: index("group_members_group_idx").on(t.groupId),
    userIdx: index("group_members_user_idx").on(t.userId),
  }),
);

/* ─────────── scheduled_messages ─────────── */
/*
 * Server-side queue for messages the sender wants released at a future
 * time. Holds the *already-encrypted* envelope (header + ciphertext) — the
 * server still cannot read the plaintext. The scheduledSweeper promotes
 * each row into a normal `messages` row at `scheduledFor`, so delivery,
 * push, and history all reuse the existing message pipeline.
 */

export const scheduledStatus = pgEnum("scheduled_status", [
  "pending",
  "delivered",
  "cancelled",
  "failed",
]);

export const scheduledMessages = pgTable(
  "scheduled_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Canonical 1:1 conversation id. */
    conversationId: text("conversation_id").notNull(),
    /** Plaintext header bytes (ratchet pub + counters + X3DH metadata). */
    header: bytea("header").notNull(),
    /** AES-GCM ciphertext (already encrypted at scheduling time). */
    ciphertext: bytea("ciphertext").notNull(),
    /** Optional disappearing-message TTL passed to the delivered message. */
    expiresInSeconds: integer("expires_in_seconds"),
    /** When the message should be released into the inbox. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: scheduledStatus("status").notNull().default("pending"),
    /** Set once the sweeper has inserted a delivered `messages` row. */
    deliveredMessageId: uuid("delivered_message_id"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failReason: text("fail_reason"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    senderIdx: index("sched_sender_idx").on(t.senderUserId, t.status),
    /** Used by the sweeper: cheap scan for "pending and due". */
    dueIdx: index("sched_due_idx")
      .on(t.scheduledFor)
      .where(sql`${t.status} = 'pending'`),
  }),
);

export type ScheduledMessageRow = typeof scheduledMessages.$inferSelect;

export type UserRow = typeof users.$inferSelect;
export type GroupRow = typeof groups.$inferSelect;
export type GroupMemberRow = typeof groupMembers.$inferSelect;
export type BlockRow = typeof blocks.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type MediaBlobRow = typeof mediaBlobs.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type InviteRow = typeof invites.$inferSelect;
export type ConnectionRequestRow = typeof connectionRequests.$inferSelect;
export type ConnectionRow = typeof connections.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
