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
    /**
     * Public profile fields, used by the invitee-facing preview UI to
     * show *who* sent the invite (instead of just an opaque user-id +
     * fingerprint). All optional — older accounts and accounts that
     * never set a profile leave these null, and the UI falls back to
     * the username (or the random-id account type).
     */
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    avatarDataUrl: z.string().nullable(),
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
  /**
   * A new security alert was created — show the user the "Suspicious
   * sign-in attempt" sheet. In the new-device-decides flow this is
   * how the *old* device finds out that someone tried to sign in
   * elsewhere and was denied.
   */
  z.object({
    type: z.literal("security_alert"),
    alertId: z.string().uuid(),
    kind: z.enum(["rejected_login_attempt", "account_secured"]),
  }),
  /**
   * A session for this user just got revoked. Recipients should call
   * `auth.checkSessionStatus`; if their own session was the one
   * revoked, they clear local auth state and show a calm "you've
   * been signed out from another device" toast.
   */
  z.object({
    type: z.literal("session_revoked"),
    /**
     * "replaced_by_new_device" — the user signed in on a new device
     *                            and chose to replace this one.
     * "secured"                — user invoked "Secure account".
     * "manual"                 — user signed it out from Settings.
     */
    reason: z.enum(["replaced_by_new_device", "secured", "manual"]),
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

/**
 * Returns the *caller's own* signed prekey + identity public key as
 * the server has them stored. Lets the client verify, after unlock,
 * that the signed prekey on file is still signed by the same identity
 * key the client holds — and re-upload fresh prekeys if not. This
 * auto-heals accounts whose stored SPK signature drifted out of sync
 * with their identity (a real bug seen in early multi-device / phase-
 * migration flows).
 */
export const MySignedPreKeyResultSchema = z.object({
  identityPublicKey: IdentityPublicKeySchema,
  signedPreKey: SignedPreKeyInput.nullable(),
});
export type MySignedPreKeyResult = z.infer<typeof MySignedPreKeyResultSchema>;

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

/**
 * Encrypted backup of the user's BIP-39 recovery phrase, encrypted
 * client-side with a key derived from the daily verification password
 * (Argon2id + AES-GCM). Server never sees plaintext — it just stores
 * the three base64 strings and hands them back after a successful
 * password check, letting the client decrypt and restore the SAME
 * identity on a new device (no rotation, chat history preserved).
 */
export const EncryptedRecoveryPhraseSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
});
export type EncryptedRecoveryPhrase = z.infer<
  typeof EncryptedRecoveryPhraseSchema
>;

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
  /**
   * Recovery phrase encrypted with the daily verification password.
   * Optional only for backwards compatibility with older clients;
   * new clients always send it so daily-password recovery on a new
   * device can restore the original identity.
   */
  encryptedRecoveryPhrase: EncryptedRecoveryPhraseSchema.optional(),
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
  /**
   * Optional encrypted-phrase backup. The client opportunistically
   * sends this whenever the daily check succeeds so legacy accounts
   * (created before the recovery-backup feature) get back-filled
   * automatically — the server only stores it if the row currently
   * has none, never overwriting an existing backup. Re-encryption
   * with a NEW password goes through `setVerificationPassword`
   * instead, which performs an unconditional update.
   */
  encryptedRecoveryPhrase: EncryptedRecoveryPhraseSchema.optional(),
});
export type VerifyDailyPasswordInput = z.infer<typeof VerifyDailyPasswordInput>;

/**
 * Daily-password recovery on a new device: trade the daily verification
 * password for the encrypted backup of the user's recovery phrase. The
 * client decrypts it locally to restore the SAME identity (no rotation,
 * chat history preserved). PRECONDITION_FAILED if the account has no
 * backup yet (legacy account that hasn't refreshed it post-update).
 */
export const FetchEncryptedRecoveryPhraseInput = z.object({
  verificationPassword: PasswordSchema,
});
export type FetchEncryptedRecoveryPhraseInput = z.infer<
  typeof FetchEncryptedRecoveryPhraseInput
>;

export const FetchEncryptedRecoveryPhraseResult = z.object({
  encryptedRecoveryPhrase: EncryptedRecoveryPhraseSchema,
});
export type FetchEncryptedRecoveryPhraseResult = z.infer<
  typeof FetchEncryptedRecoveryPhraseResult
>;

/** Change the daily verification password (requires current one if set). */
export const SetVerificationPasswordInput = z.object({
  /**
   * Current verification password. Required when one is already set.
   * Can be omitted only by accounts that never picked one (legacy).
   */
  currentPassword: PasswordSchema.optional(),
  newPassword: PasswordSchema,
  /**
   * Recovery phrase, re-encrypted with the NEW daily password. Always
   * sent by current clients (they already have the phrase locally,
   * either from sign-up or from a previous recovery). Optional only
   * so older clients don't fail closed; on omission the server clears
   * the backup so an out-of-sync ciphertext can never linger.
   */
  encryptedRecoveryPhrase: EncryptedRecoveryPhraseSchema.optional(),
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

/* ─────────── Single-active-session login (V3) ─────────── */

/**
 * Replaces the original BeginLoginV2Result discriminator. Possible
 * outcomes after the username + password is verified:
 *
 *   - "ok"               — no other active session, low risk:
 *                          immediate session.
 *   - "challenge"        — risky context: solve puzzle + hold, then
 *                          call `auth.completeLoginV2` with the
 *                          returned `challengeNonce`.
 *   - "deviceConflict"     — another device is already signed in.
 *                            The NEW device decides what to do via
 *                            `auth.confirmReplaceSession` (kick the
 *                            old one out and sign in here) or
 *                            `auth.rejectLoginAttempt` (back off and
 *                            warn the old device that someone tried).
 *   - "mustChangePassword" — the user previously triggered "Secure
 *                            account"; they must choose a new password
 *                            before any session is issued.
 */
export const BeginLoginV3Input = BeginLoginV2Input;
export type BeginLoginV3Input = z.infer<typeof BeginLoginV3Input>;

export const BeginLoginV3Result = z.discriminatedUnion("status", [
  AuthResultSchema.extend({
    status: z.literal("ok"),
    lastLogin: LoginContextInfo.nullable(),
  }),
  z.object({
    status: z.literal("challenge"),
    risk: RiskLevelSchema,
    reasons: z.array(z.string()),
    challengeNonce: z.string(),
    challengeExpiresInSeconds: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("deviceConflict"),
    /**
     * Stateless, HMAC-bound, single-use token. Encodes the requester
     * device + IP prefix + location so the follow-up
     * `confirmReplaceSession` / `rejectLoginAttempt` calls don't need
     * a DB row.
     */
    pendingLoginToken: z.string(),
    expiresInSeconds: z.number().int().positive(),
    /** Human-friendly description of the device that's currently signed in. */
    existingDevice: z.string().nullable(),
    existingCity: z.string().nullable(),
    existingCountry: z.string().nullable(),
    /**
     * `lastUsedAt` of the most-recently-active session, ISO string.
     * Helps the new device say "Active 3 minutes ago" so the user
     * can decide whether it's really their other device.
     */
    existingLastUsedAt: z.string().nullable(),
    /** How many other sessions are currently active for this account. */
    activeSessionCount: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("mustChangePassword"),
    /** HMAC-bound token to redeem at `auth.submitNewPasswordAfterSecure`. */
    mustChangeToken: z.string(),
    expiresInSeconds: z.number().int().positive(),
  }),
]);
export type BeginLoginV3Result = z.infer<typeof BeginLoginV3Result>;

/* New-device side: "Yes, sign me in here, kill the other one." */
export const ConfirmReplaceSessionInput = z.object({
  pendingLoginToken: z.string().min(1),
});
export type ConfirmReplaceSessionInput = z.infer<typeof ConfirmReplaceSessionInput>;

export const ConfirmReplaceSessionResult = AuthResultSchema.extend({
  lastLogin: LoginContextInfo.nullable(),
  /**
   * Number of other sessions terminated as part of this confirmation.
   * Surfaced to the client so the post-login screen can show
   * something like "Your previous device has been signed out."
   */
  replacedSessions: z.number().int().min(0),
});
export type ConfirmReplaceSessionResult = z.infer<
  typeof ConfirmReplaceSessionResult
>;

/* New-device side: "No, that wasn't me — alert my other device." */
export const RejectLoginAttemptInput = z.object({
  pendingLoginToken: z.string().min(1),
});
export type RejectLoginAttemptInput = z.infer<typeof RejectLoginAttemptInput>;

export const RejectLoginAttemptResult = z.object({
  ok: z.literal(true),
});
export type RejectLoginAttemptResult = z.infer<typeof RejectLoginAttemptResult>;

/* Security alerts — the inbox shown on the existing device. */
export const SecurityAlertEntry = z.object({
  id: z.string().uuid(),
  kind: z.enum(["rejected_login_attempt", "account_secured"]),
  device: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  at: z.string(),
  createdAt: z.string(),
});
export type SecurityAlertEntry = z.infer<typeof SecurityAlertEntry>;

export const ListSecurityAlertsResult = z.array(SecurityAlertEntry);
export type ListSecurityAlertsResult = z.infer<typeof ListSecurityAlertsResult>;

export const AcknowledgeSecurityAlertInput = z.object({
  alertId: z.string().uuid(),
  /**
   *   "dismiss" → user confirms it was them; just clear the alert.
   *   "secure"  → user wants to log out everywhere AND require a new
   *               password on next sign-in.
   */
  action: z.enum(["dismiss", "secure"]),
});
export type AcknowledgeSecurityAlertInput = z.infer<
  typeof AcknowledgeSecurityAlertInput
>;

export const AcknowledgeSecurityAlertResult = z.object({
  ok: z.literal(true),
  action: z.enum(["dismiss", "secure"]),
});
export type AcknowledgeSecurityAlertResult = z.infer<
  typeof AcknowledgeSecurityAlertResult
>;

/* Force-logout detection. */
export const CheckSessionStatusResult = z.object({
  /** Whether the caller's refresh-cookie session row still exists server-side. */
  active: z.boolean(),
  /** When inactive, why (informational only). */
  reason: z.enum(["ok", "no_cookie", "revoked"]),
});
export type CheckSessionStatusResult = z.infer<typeof CheckSessionStatusResult>;

/* Secure-account → password change flow. */
export const SubmitNewPasswordAfterSecureInput = z.object({
  mustChangeToken: z.string().min(1),
  newPassword: PasswordSchema,
});
export type SubmitNewPasswordAfterSecureInput = z.infer<
  typeof SubmitNewPasswordAfterSecureInput
>;

export const SubmitNewPasswordAfterSecureResult = AuthResultSchema.extend({
  lastLogin: LoginContextInfo.nullable(),
});
export type SubmitNewPasswordAfterSecureResult = z.infer<
  typeof SubmitNewPasswordAfterSecureResult
>;

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

/* ─────────── Forgot password (recovery-key reset) ─────────── */

/**
 * Step 1: user enters their username. Server returns an HMAC-bound
 * challenge nonce (always — even for unknown usernames, to prevent
 * enumeration). The client must sign that nonce with the Ed25519
 * private key derived from the user's 12-word recovery phrase, then
 * call `auth.completePasswordReset` with the signature, public key,
 * and new password.
 */
export const BeginPasswordResetInput = z.object({
  username: UsernameSchema,
});
export type BeginPasswordResetInput = z.infer<typeof BeginPasswordResetInput>;

export const BeginPasswordResetResult = z.object({
  challengeNonce: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
});
export type BeginPasswordResetResult = z.infer<
  typeof BeginPasswordResetResult
>;

/**
 * Step 2: client proves ownership of the recovery phrase by signing
 * the challenge nonce with the derived Ed25519 private key. The
 * server verifies the signature against the public key it stored on
 * the user row at signup.
 *
 * The recovery phrase itself never leaves the device.
 */
export const CompletePasswordResetInput = z.object({
  challengeNonce: z.string().min(1),
  /** Base64 of the 32-byte Ed25519 public key derived from the phrase. */
  identityPubkey: z.string().min(1),
  /** Base64 of the 64-byte Ed25519 signature over the challenge nonce. */
  signature: z.string().min(1),
  newPassword: PasswordSchema,
});
export type CompletePasswordResetInput = z.infer<
  typeof CompletePasswordResetInput
>;

export const CompletePasswordResetResult = z.object({
  ok: z.literal(true),
});
export type CompletePasswordResetResult = z.infer<
  typeof CompletePasswordResetResult
>;

/* ─────────── Discover (public people directory) ─────────── */

/**
 * Public-directory shape of a single user. Mirrors PublicUserSchema
 * but lives in its own type so we can extend it (e.g. with relationship
 * hints or last-active timestamps) without bloating PublicUser.
 */
export const DiscoverableUserSchema = z.object({
  id: UserIdSchema,
  accountType: AccountTypeSchema,
  createdAt: z.string(),
  username: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatarDataUrl: z.string().nullable().optional(),
});
export type DiscoverableUser = z.infer<typeof DiscoverableUserSchema>;

export const ListDiscoverableUsersInput = z.object({
  /** Free-text search across username and display name (case-insensitive). */
  search: z.string().trim().max(60).optional(),
  /** Opaque cursor returned from a previous call. */
  cursor: z.string().max(200).optional(),
});
export type ListDiscoverableUsersInput = z.infer<
  typeof ListDiscoverableUsersInput
>;

export const ListDiscoverableUsersResult = z.object({
  users: z.array(DiscoverableUserSchema),
  /** Null when there are no more pages. */
  nextCursor: z.string().nullable(),
});
export type ListDiscoverableUsersResult = z.infer<
  typeof ListDiscoverableUsersResult
>;

export const GetDiscoverableUserInput = z.object({
  userId: UserIdSchema,
});
export type GetDiscoverableUserInput = z.infer<
  typeof GetDiscoverableUserInput
>;

/**
 * `relationship` lets the UI pick the right CTA on the profile page:
 *   - "none"        → Send chat request
 *   - "pending_out" → Request sent (waiting)
 *   - "pending_in"  → Respond to their request
 *   - "connected"   → Open chat
 */
export const GetDiscoverableUserResult = z.object({
  user: DiscoverableUserSchema,
  relationship: z.enum(["none", "connected", "pending_out", "pending_in"]),
});
export type GetDiscoverableUserResult = z.infer<
  typeof GetDiscoverableUserResult
>;

export const GetDiscoverabilityResult = z.object({
  enabled: z.boolean(),
});
export type GetDiscoverabilityResult = z.infer<
  typeof GetDiscoverabilityResult
>;

export const SetDiscoverabilityInput = z.object({
  enabled: z.boolean(),
});
export type SetDiscoverabilityInput = z.infer<typeof SetDiscoverabilityInput>;

export const SetDiscoverabilityResult = z.object({
  ok: z.literal(true),
  enabled: z.boolean(),
});
export type SetDiscoverabilityResult = z.infer<
  typeof SetDiscoverabilityResult
>;
