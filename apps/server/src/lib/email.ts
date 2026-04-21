import { Resend } from "resend";
import { env, isDev } from "../env.js";
import type { FastifyBaseLogger } from "fastify";

let _resend: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export interface SendOtpEmailResult {
  delivered: boolean;
  /** Set in dev when no provider is configured and we logged the code. */
  devCode?: string;
}

export async function sendOtpEmail(opts: {
  to: string;
  code: string;
  purpose: "signup" | "login";
  log: FastifyBaseLogger;
}): Promise<SendOtpEmailResult> {
  const { to, code, purpose, log } = opts;
  const client = getClient();
  const subject =
    purpose === "signup" ? "Your Veil signup code" : "Your Veil login code";
  const text = [
    `Your Veil ${purpose} code is: ${code}`,
    "",
    "It expires in 5 minutes. If you didn't request this, you can ignore this email.",
    "",
    "— Veil",
  ].join("\n");

  if (!client) {
    if (!isDev) {
      log.error(
        "RESEND_API_KEY is not set; cannot send OTP email in production.",
      );
      return { delivered: false };
    }
    // Dev fallback: log the code so the user can test without Resend.
    log.warn(
      { recipient: to.replace(/(.{2}).+(@.+)/, "$1***$2"), purpose },
      `[DEV] OTP code for ${purpose}: ${code}  (no RESEND_API_KEY set — code logged instead of emailed)`,
    );
    return { delivered: true, devCode: code };
  }

  try {
    const res = await client.emails.send({
      from: env.RESEND_FROM,
      to: [to],
      subject,
      text,
    });
    if (res.error) {
      log.error({ err: res.error }, "Resend returned an error");
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    log.error({ err }, "Failed to send OTP email via Resend");
    return { delivered: false };
  }
}
