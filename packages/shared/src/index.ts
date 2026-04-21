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
