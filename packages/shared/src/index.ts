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
