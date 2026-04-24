import { z } from "zod";

/* ─────────── Health ─────────── */

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/* ─────────── Common ─────────── */

export const UserIdSchema = z.string().uuid();
export type UserId = z.infer<typeof UserIdSchema>;

export const AccountTypeSchema = z.enum(["email", "phone", "random"]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(255)
  .email();

export const OtpCodeSchema = z.string().regex(/^\d{6}$/, "Must be 6 digits");

export const OtpPurposeSchema = z.enum(["signup", "login"]);
export type OtpPurpose = z.infer<typeof OtpPurposeSchema>;

/** Base64-encoded raw 32-byte Ed25519 public key. */
export const IdentityPublicKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]+=*$/)
  .min(40)
  .max(64);

/** Base64 of an Ed25519 signature (64 bytes → ~88 chars). */
export const SignatureBase64Schema = z
  .string()
  .regex(/^[A-Za-z0-9+/]+=*$/)
  .min(80)
  .max(100);

/* ─────────── Auth: requestEmailOtp ─────────── */

export const RequestEmailOtpInput = z.object({
  email: EmailSchema,
  purpose: OtpPurposeSchema,
});
export type RequestEmailOtpInput = z.infer<typeof RequestEmailOtpInput>;

export const RequestEmailOtpResult = z.object({
  delivered: z.boolean(),
  /** Only present in dev when no email provider is configured. */
  devCode: z.string().optional(),
  expiresInSeconds: z.number().int().positive(),
});
export type RequestEmailOtpResult = z.infer<typeof RequestEmailOtpResult>;

/* ─────────── Auth: verifyEmailOtp ─────────── */

export const VerifyEmailOtpInput = z.object({
  email: EmailSchema,
  code: OtpCodeSchema,
  purpose: OtpPurposeSchema,
  /** Required on signup, ignored on login. */
  identityPublicKey: IdentityPublicKeySchema.optional(),
});
export type VerifyEmailOtpInput = z.infer<typeof VerifyEmailOtpInput>;

export const PublicUserSchema = z.object({
  id: UserIdSchema,
  accountType: AccountTypeSchema,
  createdAt: z.string(),
  /** Public Instagram-style handle. Null only for legacy accounts. */
  username: z.string().nullable().optional(),
  /** Optional human-friendly display name (first + last, free text). */
  displayName: z.string().nullable().optional(),
  /** Optional bio (max 160 chars). */
  bio: z.string().nullable().optional(),
  /** Optional inline base64 data URL for the profile photo. */
  avatarDataUrl: z.string().nullable().optional(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthResultSchema = z.object({
  user: PublicUserSchema,
  accessToken: z.string(),
  /**
   * Long-lived refresh token. Also set as an httpOnly cookie when the
   * browser allows it, but returned here so cross-site clients (e.g. a
   * Vercel-hosted UI calling a Render-hosted API) can persist it in
   * localStorage and survive third-party-cookie blocking.
   */
  refreshToken: z.string(),
  /** Seconds until the refresh token expires. */
  refreshExpiresIn: z.number().int().positive(),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
});
export type AuthResult = z.infer<typeof AuthResultSchema>;

/* ─────────── Prekeys ─────────── */
/*
 * Phase 2: Ed25519-based placeholder bundle so the wire format is
 * settled before Phase 3 swaps the curve underneath.
 */

export const SignedPreKeyInput = z.object({
  keyId: z.number().int().min(0).max(0xffffff),
  publicKey: IdentityPublicKeySchema,
  signature: SignatureBase64Schema,
});
export type SignedPreKeyInput = z.infer<typeof SignedPreKeyInput>;

export const OneTimePreKeyInput = z.object({
  keyId: z.number().int().min(0).max(0xffffff),
  publicKey: IdentityPublicKeySchema,
});
export type OneTimePreKeyInput = z.infer<typeof OneTimePreKeyInput>;

export const UploadPrekeysInput = z.object({
  signedPreKey: SignedPreKeyInput,
  /** 0–100 one-time keys per upload. Server caps total per user at 100. */
  oneTimePreKeys: z.array(OneTimePreKeyInput).max(100),
});
export type UploadPrekeysInput = z.infer<typeof UploadPrekeysInput>;

export const PrekeyStatusSchema = z.object({
  hasSignedPreKey: z.boolean(),
  signedPreKeyId: z.number().int().nullable(),
  oneTimePreKeyCount: z.number().int().min(0),
});
export type PrekeyStatus = z.infer<typeof PrekeyStatusSchema>;

export const PrekeyBundleSchema = z.object({
  userId: UserIdSchema,
  identityPublicKey: IdentityPublicKeySchema,
  signedPreKey: SignedPreKeyInput,
  /** May be null if the peer has run out of one-time keys. */
  oneTimePreKey: OneTimePreKeyInput.nullable(),
});
export type PrekeyBundle = z.infer<typeof PrekeyBundleSchema>;

/* ─────────── Invites ─────────── */

export const InviteIdSchema = z.string().uuid();
export const InviteTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .min(8)
  .max(64);
export type InviteToken = z.infer<typeof InviteTokenSchema>;

export const CreateInviteInput = z.object({
  label: z.string().trim().max(60).optional(),
  /** 1, 5, 10, or null (unlimited). Defaults to 1 (single-use). */
  maxUses: z
    .union([z.literal(1), z.literal(5), z.literal(10), z.null()])
    .default(1),
  /** Hours until expiry. Null = no expiry. Defaults to 168 (7 days). */
  expiresInHours: z
    .union([z.number().int().positive().max(24 * 90), z.null()])
    .default(168),
});
export type CreateInviteInput = z.infer<typeof CreateInviteInput>;

export const InviteSummarySchema = z.object({
  id: InviteIdSchema,
  label: z.string().nullable(),
  maxUses: z.number().int().nullable(),
  usedCount: z.number().int(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  /** Only returned on the create call — never re-shown. */
  url: z.string().optional(),
  token: z.string().optional(),
});
export type InviteSummary = z.infer<typeof InviteSummarySchema>;

export const InvitePreviewSchema = z.object({
  inviter: z.object({
    id: UserIdSchema,
    accountType: AccountTypeSchema,
    /** Short hex fingerprint of the identity key (8 chars). */
    fingerprint: z.string(),
    createdAt: z.string(),
  }),
  /** "valid" means redeemable. */
  state: z.enum(["valid", "expired", "exhausted", "revoked", "not_found"]),
});
export type InvitePreview = z.infer<typeof InvitePreviewSchema>;

export const RedeemInviteInput = z.object({
  token: InviteTokenSchema,
  note: z.string().trim().max(140).optional(),
});
export type RedeemInviteInput = z.infer<typeof RedeemInviteInput>;

/* ─────────── Connections ─────────── */

export const ConnectionRequestIdSchema = z.string().uuid();

export const PeerSchema = z.object({
  id: UserIdSchema,
  accountType: AccountTypeSchema,
  fingerprint: z.string(),
  createdAt: z.string(),
  /** Optional public profile fields, mirrored from the users table. */
  username: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatarDataUrl: z.string().nullable().optional(),
  /**
   * Private nickname the requesting user has saved for this peer
   * (WhatsApp-style "saved contact name"). Visible only to the
   * requester; never affects the peer's public username/displayName.
   */
  contactName: z.string().nullable().optional(),
});
export type Peer = z.infer<typeof PeerSchema>;

/* ─────────── Private contact names ─────────── */

export const ContactNameSchema = z
  .string()
  .trim()
  .min(1, "Contact name can't be empty")
  .max(60, "Contact name must be 60 characters or fewer");
export type ContactName = z.infer<typeof ContactNameSchema>;

export const SetContactNameInput = z.object({
  peerId: UserIdSchema,
  /** Pass `null` to clear the saved name and fall back to defaults. */
  customName: ContactNameSchema.nullable(),
});
export type SetContactNameInput = z.infer<typeof SetContactNameInput>;

export const ContactNameEntrySchema = z.object({
  peerId: UserIdSchema,
  customName: z.string(),
  updatedAt: z.string(),
});
export type ContactNameEntry = z.infer<typeof ContactNameEntrySchema>;

export const IncomingRequestSchema = z.object({
  id: ConnectionRequestIdSchema,
  from: PeerSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type IncomingRequest = z.infer<typeof IncomingRequestSchema>;

export const OutgoingRequestSchema = z.object({
  id: ConnectionRequestIdSchema,
  to: PeerSchema,
  note: z.string().nullable(),
  status: z.enum(["pending", "accepted", "rejected", "canceled", "expired"]),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type OutgoingRequest = z.infer<typeof OutgoingRequestSchema>;

export const ConnectionSchema = z.object({
  id: z.string().uuid(),
  peer: PeerSchema,
  createdAt: z.string(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const RequestIdInput = z.object({
  requestId: ConnectionRequestIdSchema,
});
export const PeerIdInput = z.object({ peerId: UserIdSchema });

export const OkSchema = z.object({ ok: z.literal(true) });

/* ─────────── X25519 identity (Phase 3) ─────────── */

export const SetX25519IdentityInput = z.object({
  publicKey: IdentityPublicKeySchema,
});
export type SetX25519IdentityInput = z.infer<typeof SetX25519IdentityInput>;

/* ─────────── Messages (Phase 3) ─────────── */

export const Base64BytesSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]+=*$/)
  .max(64 * 1024); // 48 KB raw cap; plenty for text + small media metadata.

export const SendMessageInput = z.object({
  recipientUserId: UserIdSchema,
  /** Base64-encoded plaintext header (ratchet pub + counters + X3DH metadata). */
  header: Base64BytesSchema,
  /** Base64-encoded AES-GCM ciphertext (≤ ~30 KB plaintext). */
  ciphertext: Base64BytesSchema,
  /**
   * Optional disappearing-message TTL. If set, server stamps
   * `expires_at = now + this` and a periodic sweep hard-deletes the
   * row. Cap is 30 days. The actual semantics (text vs media,
   * view-once etc.) live inside the encrypted envelope; the server
   * never inspects them.
   */
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const SendMessageResult = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
});

export const InboxMessageSchema = z.object({
  id: z.string().uuid(),
  senderUserId: UserIdSchema,
  header: Base64BytesSchema,
  ciphertext: Base64BytesSchema,
  createdAt: z.string(),
  /** ISO timestamp after which the server will hard-delete this row. */
  expiresAt: z.string().nullable().optional(),
  /** Phase 7: present when this fan-out leg belongs to a group message. */
  groupId: z.string().uuid().nullable().optional(),
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

export const FetchInboxResult = z.object({
  messages: z.array(InboxMessageSchema),
});

export const MarkDeliveredInput = z.object({
  ids: z.array(z.string().uuid()).max(500),
});
export type MarkDeliveredInput = z.infer<typeof MarkDeliveredInput>;

/* History (full record incl. own outbound, for restore on a fresh device). */

export const HistoryMessageSchema = z.object({
  id: z.string().uuid(),
  senderUserId: UserIdSchema,
  recipientUserId: UserIdSchema,
  header: Base64BytesSchema,
  ciphertext: Base64BytesSchema,
  createdAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  /** When the recipient's device acknowledged receipt. */
  deliveredAt: z.string().nullable().optional(),
  /** When the recipient opened the message. */
  readAt: z.string().nullable().optional(),
});
export type HistoryMessage = z.infer<typeof HistoryMessageSchema>;

export const MarkReadInput = z.object({
  ids: z.array(z.string().uuid()).max(500),
});
export type MarkReadInput = z.infer<typeof MarkReadInput>;

/* Receipt catch-up: poll the latest delivered/read state for a batch of
 * outbound messages. Used to recover after a missed WS event. */
export const FetchReceiptsInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});
export type FetchReceiptsInput = z.infer<typeof FetchReceiptsInput>;

export const MessageReceiptSchema = z.object({
  id: z.string().uuid(),
  deliveredAt: z.string().nullable(),
  readAt: z.string().nullable(),
});
export type MessageReceipt = z.infer<typeof MessageReceiptSchema>;

export const FetchReceiptsResult = z.object({
  receipts: z.array(MessageReceiptSchema),
});
export type FetchReceiptsResult = z.infer<typeof FetchReceiptsResult>;

/* "Delete for everyone" — sender wipes the persisted ciphertext on the
 * server so a fresh device's history restore won't bring the message
 * back. The encrypted "del" envelope sent through the ratchet handles
 * the live tombstone on already-online recipients. */
export const DeleteForEveryoneInput = z.object({
  id: z.string().uuid(),
});
export type DeleteForEveryoneInput = z.infer<typeof DeleteForEveryoneInput>;

export const FetchHistoryInput = z.object({
  peerId: UserIdSchema,
  /** ISO timestamp; only return messages created strictly before this. */
  before: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
export type FetchHistoryInput = z.infer<typeof FetchHistoryInput>;

export const FetchHistoryResult = z.object({
  messages: z.array(HistoryMessageSchema),
  /** True if there are more older messages beyond this page. */
  hasMore: z.boolean(),
});
export type FetchHistoryResult = z.infer<typeof FetchHistoryResult>;

/* ─────────── Scheduled messages (server-side queue) ─────────── */

export const CreateScheduledMessageInput = z.object({
  recipientUserId: UserIdSchema,
  /** Already-encrypted header (base64). */
  header: Base64BytesSchema,
  /** Already-encrypted ciphertext (base64). */
  ciphertext: Base64BytesSchema,
  /** ISO timestamp at which the server should release the message. */
  scheduledFor: z.string(),
  /** Optional disappearing-message TTL applied at delivery time. */
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional(),
  /**
   * Optional client-side cached preview of the plaintext, encrypted only
   * to the sender (so they can see what they scheduled in their list).
   * Keep short — the whole point is to never store plaintext server-side.
   * Stored as a base64 ciphertext blob the client decrypts locally.
   */
});
export type CreateScheduledMessageInput = z.infer<
  typeof CreateScheduledMessageInput
>;

export const ScheduledMessageSchema = z.object({
  id: z.string().uuid(),
  recipientUserId: UserIdSchema,
  scheduledFor: z.string(),
  status: z.enum(["pending", "delivered", "cancelled", "failed"]),
  attempts: z.number().int().nonnegative(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable().optional(),
  failReason: z.string().nullable().optional(),
});
export type ScheduledMessage = z.infer<typeof ScheduledMessageSchema>;

export const CreateScheduledMessageResult = z.object({
  id: z.string().uuid(),
  scheduledFor: z.string(),
});

export const ListScheduledMessagesResult = z.object({
  scheduled: z.array(ScheduledMessageSchema),
});
export type ListScheduledMessagesResult = z.infer<
  typeof ListScheduledMessagesResult
>;

export const CancelScheduledMessageInput = z.object({
  id: z.string().uuid(),
});
export type CancelScheduledMessageInput = z.infer<
  typeof CancelScheduledMessageInput
>;

/* WebSocket envelope (used by /ws). */

export const WsServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), userId: UserIdSchema }),
  z.object({ type: z.literal("new_message"), message: InboxMessageSchema }),
  z.object({
    type: z.literal("delivery_receipt"),
    messageId: z.string().uuid(),
    by: UserIdSchema,
    at: z.string(),
  }),
  z.object({
    type: z.literal("read_receipt"),
    messageId: z.string().uuid(),
    by: UserIdSchema,
    at: z.string(),
  }),
  z.object({
    /** Ephemeral typing/activity indicator from a peer. Never persisted. */
    type: z.literal("typing"),
    from: UserIdSchema,
    /** True = activity started, false = stopped. */
    typing: z.boolean(),
    /**
     * What kind of activity is happening. Defaults to "text" when omitted
     * so older clients keep working unchanged.
     */
    kind: z.enum(["text", "voice", "photo"]).optional(),
  }),
  z.object({ type: z.literal("pong"), t: z.number() }),
  /** Phase 7: a group I'm in changed (members, name, role, etc.). Client should refetch. */
  z.object({ type: z.literal("group_changed"), groupId: z.string().uuid() }),
  /** Presence: a connected peer came online or went offline. */
  z.object({
    type: z.literal("presence"),
    userId: UserIdSchema,
    online: z.boolean(),
  }),
]);
export type WsServerEvent = z.infer<typeof WsServerEventSchema>;

export const WsClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping"), t: z.number() }),
  z.object({
    type: z.literal("mark_delivered"),
    ids: z.array(z.string().uuid()).max(500),
  }),
  z.object({
    type: z.literal("mark_read"),
    ids: z.array(z.string().uuid()).max(500),
  }),
  z.object({
    type: z.literal("typing"),
    /** The peer to notify. */
    to: UserIdSchema,
    typing: z.boolean(),
    /** Activity kind — what the local user is doing right now. */
    kind: z.enum(["text", "voice", "photo"]).optional(),
  }),
]);
export type WsClientEvent = z.infer<typeof WsClientEventSchema>;

/* ─────────── Prekeys (Phase 3 extensions) ─────────── */

export const UploadPrekeysInputV2 = z.object({
  signedPreKey: SignedPreKeyInput,
  oneTimePreKeys: z.array(OneTimePreKeyInput).max(100),
  /** When true, server clears all existing one-time prekeys before inserting the new batch. */
  replaceOneTime: z.boolean().default(false),
});
export type UploadPrekeysInputV2 = z.infer<typeof UploadPrekeysInputV2>;

export const PrekeyBundleSchemaV2 = z.object({
  userId: UserIdSchema,
  identityPublicKey: IdentityPublicKeySchema,
  /** May be null for accounts that haven't migrated to X25519 yet. */
  identityX25519PublicKey: IdentityPublicKeySchema.nullable(),
  signedPreKey: SignedPreKeyInput,
  oneTimePreKey: OneTimePreKeyInput.nullable(),
});
export type PrekeyBundleV2 = z.infer<typeof PrekeyBundleSchemaV2>;

/* ─────────── Phase 4: Phone Auth (Firebase) ─────────── */

export const VerifyFirebasePhoneInput = z.object({
  /** Firebase ID token obtained from the client after reCAPTCHA + SMS OTP. */
  firebaseIdToken: z.string().min(1).max(4096),
  purpose: OtpPurposeSchema,
  /** Required on signup. Base64 Ed25519 public key. */
  identityPublicKey: IdentityPublicKeySchema.optional(),
});
export type VerifyFirebasePhoneInput = z.infer<typeof VerifyFirebasePhoneInput>;

/* ─────────── Phase 4: Random ID Auth ─────────── */

/** veil_ prefix + 8 random lowercase hex chars. */
export const RandomIdSchema = z
  .string()
  .regex(/^veil_[0-9a-f]{8}$/, "Must be a valid Veil random ID");
export type RandomId = z.infer<typeof RandomIdSchema>;

export const SignupRandomInput = z.object({
  randomId: RandomIdSchema,
  identityPublicKey: IdentityPublicKeySchema,
});
export type SignupRandomInput = z.infer<typeof SignupRandomInput>;

export const RequestRandomChallengeInput = z.object({
  randomId: RandomIdSchema,
});
export type RequestRandomChallengeInput = z.infer<typeof RequestRandomChallengeInput>;

export const RandomChallengeResult = z.object({
  /** Short-lived JWT the client must sign with their identity key. */
  challenge: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type RandomChallengeResult = z.infer<typeof RandomChallengeResult>;

export const LoginRandomInput = z.object({
  randomId: RandomIdSchema,
  /** The challenge JWT string returned by requestRandomChallenge. */
  challenge: z.string().min(1),
  /** Base64 Ed25519 signature over the raw challenge string bytes. */
  signature: z.string().regex(/^[A-Za-z0-9+/]+=*$/).min(80).max(100),
});
export type LoginRandomInput = z.infer<typeof LoginRandomInput>;

/* ─────────── Username / Password / Bot Challenge ─────────── */

/**
 * Instagram-style handle. Lowercase letters, digits, dot and underscore.
 * 3–24 chars. Must start with a letter or digit. Reserved against case
 * collisions server-side.
 */
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be 24 characters or fewer")
  .regex(
    /^[a-z0-9][a-z0-9._]{2,23}$/,
    "Use letters, numbers, dot or underscore only",
  );
export type Username = z.infer<typeof UsernameSchema>;

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);
export type Password = z.infer<typeof PasswordSchema>;

export const CheckUsernameInput = z.object({ username: UsernameSchema });
export const CheckUsernameResult = z.object({
  available: z.boolean(),
  reason: z.enum(["taken", "reserved"]).nullable().optional(),
});
export type CheckUsernameResult = z.infer<typeof CheckUsernameResult>;

/**
 * Slide-to-verify bot challenge. The server picks a random horizontal
 * `gapX` (0..puzzleWidth-pieceWidth), renders a colourful background
 * with a piece-shaped hole at that X, and returns:
 *   - challengeId      → opaque server-state handle
 *   - background       → SVG data URL with the hole
 *   - piece            → SVG data URL of the piece to drag
 *   - puzzleWidth/Height + pieceWidth/Height for layout
 *   - expiresInSeconds
 * The client lets the user drag the piece horizontally and posts the
 * final X to verifyBotChallenge, which returns a one-time token good
 * for the next signup attempt.
 */
export const IssueBotChallengeResult = z.object({
  challengeId: z.string(),
  background: z.string(),
  piece: z.string(),
  puzzleWidth: z.number().int().positive(),
  puzzleHeight: z.number().int().positive(),
  pieceWidth: z.number().int().positive(),
  pieceHeight: z.number().int().positive(),
  /** Y of the piece (fixed by the server). */
  pieceY: z.number().int().nonnegative(),
  expiresInSeconds: z.number().int().positive(),
});
export type IssueBotChallengeResult = z.infer<typeof IssueBotChallengeResult>;

export const VerifyBotChallengeInput = z.object({
  challengeId: z.string(),
  /** The X position the user dropped the piece at. */
  guessX: z.number().int().nonnegative(),
});
export const VerifyBotChallengeResult = z.object({
  ok: z.boolean(),
  /** One-shot, short-lived token to attach to the next signup mutation. */
  token: z.string().nullable().optional(),
});
export type VerifyBotChallengeResult = z.infer<typeof VerifyBotChallengeResult>;

export const SignupRandomV2Input = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  /**
   * Daily verification password. Required again every 24 hours
   * before the user can access the main app.
   */
  verificationPassword: PasswordSchema,
  identityPublicKey: IdentityPublicKeySchema,
  /** Token issued by verifyBotChallenge. */
  botToken: z.string(),
});
export type SignupRandomV2Input = z.infer<typeof SignupRandomV2Input>;

export const LoginRandomV2Input = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});
export type LoginRandomV2Input = z.infer<typeof LoginRandomV2Input>;

/** Daily verification password check (24-hour gate). */
export const VerifyDailyPasswordInput = z.object({
  password: PasswordSchema,
});
export type VerifyDailyPasswordInput = z.infer<typeof VerifyDailyPasswordInput>;

/** Change the daily verification password (requires current one if set). */
export const SetVerificationPasswordInput = z.object({
  /**
   * Current verification password. Required when one is already set.
   * Can be omitted only by accounts that never picked one (legacy).
   */
  currentPassword: PasswordSchema.optional(),
  newPassword: PasswordSchema,
});
export type SetVerificationPasswordInput = z.infer<
  typeof SetVerificationPasswordInput
>;

export const SetVerificationPasswordResult = z.object({
  ok: z.boolean(),
  /** Server time the new password was stored, ISO 8601. */
  updatedAt: z.string(),
});
export type SetVerificationPasswordResult = z.infer<
  typeof SetVerificationPasswordResult
>;

export const VerifyDailyPasswordResult = z.object({
  ok: z.boolean(),
  /** Server time the verification was accepted, ISO 8601. */
  verifiedAt: z.string(),
});
export type VerifyDailyPasswordResult = z.infer<typeof VerifyDailyPasswordResult>;

/**
 * Change the account's login password.
 * Requires the current password and a new password (≥ 8 chars).
 * Only meaningful for accounts that signed up with username + password.
 */
export const ChangePasswordInput = z.object({
  currentPassword: PasswordSchema,
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const ChangePasswordResult = z.object({
  ok: z.boolean(),
  /** Server time the password was updated, ISO 8601. */
  updatedAt: z.string(),
});
export type ChangePasswordResult = z.infer<typeof ChangePasswordResult>;

/* ─────────── Auth: premium login flow (V3) ─────────── */

/**
 * Step 1 of the new login flow. Verifies the username + password and
 * silently classifies the request risk based on device + network +
 * recent behaviour.
 *
 * - On low risk: returns a full session immediately.
 * - On medium/high risk: returns a short-lived challenge nonce. The
 *   caller must then complete a bot puzzle and call
 *   `auth.completeLoginV2` with the nonce + bot token.
 */
export const BeginLoginV2Input = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  password: PasswordSchema,
});
export type BeginLoginV2Input = z.infer<typeof BeginLoginV2Input>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const LoginContextInfo = z.object({
  /** City name from IP geolocation, or null when unknown. */
  city: z.string().nullable(),
  /** Country name from IP geolocation, or null when unknown. */
  country: z.string().nullable(),
  /** Friendly device label e.g. "Chrome on macOS". */
  device: z.string(),
  /** ISO timestamp; null when this is the user's first sign-in. */
  at: z.string().nullable(),
});
export type LoginContextInfo = z.infer<typeof LoginContextInfo>;

export const BeginLoginV2Result = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    /**
     * Information about the user's previous successful sign-in (last
     * city + device). Shown on the welcome step after a low-risk login.
     */
    lastLogin: LoginContextInfo.nullable(),
    /** Full session — same shape as AuthResult. */
    user: PublicUserSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
    refreshExpiresIn: z.number().int().positive(),
    expiresIn: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("challenge"),
    /** Why we asked the user to verify. Plain, friendly strings. */
    reasons: z.array(z.string()),
    risk: RiskLevelSchema,
    /** Short-lived nonce (≤2 min) the client returns with the bot token. */
    challengeNonce: z.string().min(8).max(200),
    challengeExpiresInSeconds: z.number().int().positive(),
  }),
]);
export type BeginLoginV2Result = z.infer<typeof BeginLoginV2Result>;

export const CompleteLoginV2Input = z.object({
  challengeNonce: z.string().min(8).max(200),
  /** One-shot HMAC token returned by `auth.verifyBotChallenge`. */
  botToken: z.string().min(8).max(400),
});
export type CompleteLoginV2Input = z.infer<typeof CompleteLoginV2Input>;

export const CompleteLoginV2Result = z.object({
  user: PublicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  refreshExpiresIn: z.number().int().positive(),
  expiresIn: z.number().int().positive(),
  lastLogin: LoginContextInfo.nullable(),
});
export type CompleteLoginV2Result = z.infer<typeof CompleteLoginV2Result>;

export const LastLoginInfoResult = LoginContextInfo.nullable();

/* ─────────── Sign-in activity (Settings → Security) ─────────── */

/**
 * One row in the user-facing "Sign-in activity" list. Always lives
 * alongside the actual session row; `id` here is the session id. We
 * never expose the raw refresh token hash or the full IP — just the
 * coarse city/country and the friendly device label.
 */
export const SignInActivityEntry = z.object({
  id: z.string().uuid(),
  device: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
});
export type SignInActivityEntry = z.infer<typeof SignInActivityEntry>;

export const ListSessionsResult = z.array(SignInActivityEntry);
export type ListSessionsResult = z.infer<typeof ListSessionsResult>;

export const RevokeSessionInput = z.object({
  sessionId: z.string().uuid(),
});
export type RevokeSessionInput = z.infer<typeof RevokeSessionInput>;

export const RevokeSessionResult = z.object({
  ok: z.literal(true),
  /** Number of session rows removed (0 if it didn't exist or wasn't yours). */
  removed: z.number().int().min(0),
});
export type RevokeSessionResult = z.infer<typeof RevokeSessionResult>;
export type LastLoginInfoResult = z.infer<typeof LastLoginInfoResult>;

/* ─────────── Profile ─────────── */

export const UpdateProfileInput = z.object({
  displayName: z.string().trim().max(60).nullable().optional(),
  bio: z.string().trim().max(160).nullable().optional(),
  /**
   * Base64 data URL (image/png, image/jpeg, image/webp). Capped at
   * ~64 KB after the client resizes to ≤256×256. Pass `null` to clear.
   */
  avatarDataUrl: z
    .string()
    .max(96 * 1024)
    .nullable()
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

/* ─────────── Phase 4: Contact Discovery ─────────── */

export const GetDiscoverySaltResult = z.object({
  saltId: z.string().uuid(),
  /** Base64 HMAC-SHA256 salt to use for hashing phone numbers. */
  salt: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type GetDiscoverySaltResult = z.infer<typeof GetDiscoverySaltResult>;

export const DiscoverContactsInput = z.object({
  saltId: z.string().uuid(),
  /** Array of Base64 HMAC-SHA256 hashes of E.164 phone numbers. */
  hashes: z.array(z.string().min(1).max(64)).max(500),
});
export type DiscoverContactsInput = z.infer<typeof DiscoverContactsInput>;

export const DiscoverContactsResult = z.object({
  /** Maps each hash that matched to the Veil user ID. */
  matches: z.record(z.string(), UserIdSchema),
});
export type DiscoverContactsResult = z.infer<typeof DiscoverContactsResult>;

/* ─────────── Phase 5: Encrypted media (R2 presigned) ─────────── */

/** MIME hints we accept for end-to-end encrypted media. */
export const MediaMimeSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^(image|audio|video|application)\/[a-z0-9.+\-]+(?:\s*;\s*[a-z0-9.+\-]+\s*=\s*[a-z0-9.+\-"]+)*$/i,
  );

export const RequestMediaUploadInput = z.object({
  mime: MediaMimeSchema,
  /** Ciphertext byte count the client intends to upload. */
  sizeBytes: z.number().int().positive(),
});
export type RequestMediaUploadInput = z.infer<typeof RequestMediaUploadInput>;

export const RequestMediaUploadResult = z.object({
  blobId: z.string().uuid(),
  /** Presigned PUT URL the client uploads ciphertext to (direct to R2). */
  uploadUrl: z.string().url(),
  /** Header the client MUST send with the PUT (matches what was signed). */
  uploadContentType: z.string(),
  /** ISO timestamp after which the presigned URL stops working. */
  uploadExpiresAt: z.string(),
});
export type RequestMediaUploadResult = z.infer<typeof RequestMediaUploadResult>;

export const FinalizeMediaUploadInput = z.object({
  blobId: z.string().uuid(),
});
export type FinalizeMediaUploadInput = z.infer<typeof FinalizeMediaUploadInput>;

export const FinalizeMediaUploadResult = z.object({
  blobId: z.string().uuid(),
  sizeBytes: z.number().int().nonnegative(),
  expiresAt: z.string(),
});
export type FinalizeMediaUploadResult = z.infer<
  typeof FinalizeMediaUploadResult
>;

export const DownloadMediaInput = z.object({
  blobId: z.string().uuid(),
});
export type DownloadMediaInput = z.infer<typeof DownloadMediaInput>;

export const DownloadMediaResult = z.object({
  /** Presigned GET URL the client fetches ciphertext from (direct from R2). */
  downloadUrl: z.string().url(),
  mime: MediaMimeSchema,
  sizeBytes: z.number().int().nonnegative(),
  /** ISO timestamp after which the presigned URL stops working. */
  expiresAt: z.string(),
});
export type DownloadMediaResult = z.infer<typeof DownloadMediaResult>;

/* ─────────── Phase 5: Web Push ─────────── */

export const PushPublicKeyResult = z.object({
  /** URL-safe base64 VAPID public key, or null if push isn't configured. */
  publicKey: z.string().nullable(),
});
export type PushPublicKeyResult = z.infer<typeof PushPublicKeyResult>;

export const SubscribePushInput = z.object({
  endpoint: z.string().url().max(2048),
  /** URL-safe base64 of the subscription's p256dh public key. */
  p256dh: z.string().min(20).max(200),
  /** URL-safe base64 of the subscription's auth secret. */
  auth: z.string().min(8).max(200),
  userAgent: z.string().max(512).optional(),
});
export type SubscribePushInput = z.infer<typeof SubscribePushInput>;

export const UnsubscribePushInput = z.object({
  endpoint: z.string().url().max(2048),
});
export type UnsubscribePushInput = z.infer<typeof UnsubscribePushInput>;

/* ─────────── Phase 2: Link Previews ─────────── */
/*
 * Server fetches OG metadata anonymously on the sender's behalf so the
 * recipient never reveals their IP to third-party sites by hot-loading
 * URLs out of an incoming chat. The preview travels inside the
 * encrypted envelope.
 */

export const LinkPreviewInput = z.object({
  url: z.string().url().max(2048),
});
export type LinkPreviewInput = z.infer<typeof LinkPreviewInput>;

export const LinkPreviewSchema = z.object({
  url: z.string().url(),
  /** Final canonical URL after redirects. */
  resolvedUrl: z.string().url().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  siteName: z.string().nullable(),
  /**
   * Absolute URL of the OG image, if one was found. Kept for diagnostics
   * only — clients MUST NOT render it directly because doing so would
   * leak the recipient's IP to the third-party site. Always prefer
   * `imageDataUrl` when rendering.
   */
  imageUrl: z.string().url().nullable(),
  /**
   * Server-fetched OG image, inlined as a `data:` URL so the recipient
   * never makes a network request to the third party. Capped server-side.
   */
  imageDataUrl: z.string().nullable(),
  /** Server-fetched favicon, inlined as a `data:` URL. Same privacy reason. */
  iconDataUrl: z.string().nullable(),
});
export type LinkPreview = z.infer<typeof LinkPreviewSchema>;

/* ─────────── Phase 7: Group Chats ─────────── */

export const GroupRoleSchema = z.enum(["admin", "member"]);
export type GroupRole = z.infer<typeof GroupRoleSchema>;

export const GroupNameSchema = z.string().trim().min(1).max(80);
export const GroupDescriptionSchema = z.string().trim().max(280);

export const GroupMemberSchema = z.object({
  userId: UserIdSchema,
  role: GroupRoleSchema,
  joinedAt: z.string(),
  fingerprint: z.string().nullable(),
  /** Public profile fields, mirrored from the users table. */
  username: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  avatarDataUrl: z.string().nullable().optional(),
  /**
   * Private nickname the requesting user has saved for this member
   * (WhatsApp-style "saved contact name"). Null when nothing's saved.
   */
  contactName: z.string().nullable().optional(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  epoch: z.number().int().nonnegative(),
  myRole: GroupRoleSchema,
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GroupSummary = z.infer<typeof GroupSummarySchema>;

export const GroupDetailSchema = GroupSummarySchema.extend({
  createdByUserId: UserIdSchema,
  members: z.array(GroupMemberSchema),
});
export type GroupDetail = z.infer<typeof GroupDetailSchema>;

export const CreateGroupInput = z.object({
  name: GroupNameSchema,
  description: GroupDescriptionSchema.optional(),
  memberPeerIds: z.array(UserIdSchema).min(1).max(99),
});
export type CreateGroupInput = z.infer<typeof CreateGroupInput>;

export const GroupIdInput = z.object({ groupId: z.string().uuid() });

export const AddGroupMembersInput = z.object({
  groupId: z.string().uuid(),
  peerIds: z.array(UserIdSchema).min(1).max(50),
});

export const RemoveGroupMemberInput = z.object({
  groupId: z.string().uuid(),
  userId: UserIdSchema,
});

export const UpdateGroupMetaInput = z.object({
  groupId: z.string().uuid(),
  name: GroupNameSchema.optional(),
  description: GroupDescriptionSchema.nullable().optional(),
});

export const SetGroupRoleInput = z.object({
  groupId: z.string().uuid(),
  userId: UserIdSchema,
  role: GroupRoleSchema,
});

export const GroupRecipientCipherSchema = z.object({
  recipientUserId: UserIdSchema,
  header: Base64BytesSchema,
  ciphertext: Base64BytesSchema,
});
export type GroupRecipientCipher = z.infer<typeof GroupRecipientCipherSchema>;

export const SendGroupMessageInput = z.object({
  groupId: z.string().uuid(),
  recipients: z.array(GroupRecipientCipherSchema).min(1).max(99),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional(),
});
export type SendGroupMessageInput = z.infer<typeof SendGroupMessageInput>;

export const SendGroupMessageResult = z.object({
  createdAt: z.string(),
  /** Per-recipient delivered row id, in the same order as input.recipients. */
  ids: z.array(z.string().uuid()),
});
export type SendGroupMessageResult = z.infer<typeof SendGroupMessageResult>;

/**
 * WhatsApp-style group broadcast: client supplies one sender-key
 * ciphertext + header and the server fans it out to every current
 * group member based purely on group membership. Replaces the older
 * per-recipient `recipients` list which forced clients to maintain
 * a (sometimes stale) member cache.
 */
export const SendGroupBroadcastInput = z.object({
  groupId: z.string().uuid(),
  header: Base64BytesSchema,
  ciphertext: Base64BytesSchema,
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional(),
});
export type SendGroupBroadcastInput = z.infer<typeof SendGroupBroadcastInput>;

export const SendGroupBroadcastResult = z.object({
  createdAt: z.string(),
  /** First fan-out row id; clients use this as the canonical server id for the message. */
  id: z.string().uuid(),
  /** Number of recipients the server fanned out to (excludes the sender). */
  fanout: z.number().int().nonnegative(),
});
export type SendGroupBroadcastResult = z.infer<typeof SendGroupBroadcastResult>;

export const FetchGroupHistoryInput = z.object({
  groupId: z.string().uuid(),
  before: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
export type FetchGroupHistoryInput = z.infer<typeof FetchGroupHistoryInput>;

export const GroupHistoryMessageSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  senderUserId: UserIdSchema,
  header: Base64BytesSchema,
  ciphertext: Base64BytesSchema,
  createdAt: z.string(),
  expiresAt: z.string().nullable().optional(),
});
export type GroupHistoryMessage = z.infer<typeof GroupHistoryMessageSchema>;

export const FetchGroupHistoryResult = z.object({
  messages: z.array(GroupHistoryMessageSchema),
  hasMore: z.boolean(),
});
export type FetchGroupHistoryResult = z.infer<typeof FetchGroupHistoryResult>;
