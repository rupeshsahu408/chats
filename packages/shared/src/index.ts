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
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthResultSchema = z.object({
  user: PublicUserSchema,
  accessToken: z.string(),
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
});
export type Peer = z.infer<typeof PeerSchema>;

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
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

export const FetchInboxResult = z.object({
  messages: z.array(InboxMessageSchema),
});

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
