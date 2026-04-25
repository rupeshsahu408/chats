import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env.js";
import type { FastifyBaseLogger } from "fastify";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return _transporter;
}

export interface ReportEmailPayload {
  reporter: { id: string; username: string | null; displayName: string | null };
  reported: { id: string; username: string | null; displayName: string | null };
  reason: string;
  note: string | null;
  alsoBlock: boolean;
  createdAt: Date;
}

function fmtUser(u: { id: string; username: string | null; displayName: string | null }) {
  const handle = u.username ? `@${u.username}` : "(no username)";
  const name = u.displayName ?? "(no display name)";
  return `${name} · ${handle} · ${u.id}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Mirror an abuse report to the operator's inbox over SMTP. Failures are
 * logged but never thrown — submitting a report must always succeed for
 * the user even if our outbound mail is misconfigured.
 */
export async function sendReportEmail(opts: {
  payload: ReportEmailPayload;
  log: FastifyBaseLogger;
}): Promise<void> {
  const { payload, log } = opts;
  const to = env.REPORT_EMAIL_TO;
  if (!to) {
    log.warn("REPORT_EMAIL_TO is not set — skipping report email.");
    return;
  }
  const transporter = getTransporter();
  if (!transporter) {
    log.warn("SMTP not fully configured — skipping report email.");
    return;
  }

  const subject = `[Veil] New abuse report: ${payload.reason}`;
  const lines = [
    `A new abuse report was submitted on Veil.`,
    ``,
    `Reason:    ${payload.reason}`,
    `Submitted: ${payload.createdAt.toISOString()}`,
    `Also blocked: ${payload.alsoBlock ? "yes" : "no"}`,
    ``,
    `Reporter:  ${fmtUser(payload.reporter)}`,
    `Reported:  ${fmtUser(payload.reported)}`,
    ``,
    `Reporter's note:`,
    payload.note ? payload.note : "(none provided)",
    ``,
    `— Veil server`,
  ];
  const text = lines.join("\n");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b141a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#667781;font-weight:600;">New abuse report</div>
      <h1 style="margin:6px 0 18px;font-size:22px;font-weight:700;letter-spacing:-0.01em;">Reason: ${escapeHtml(payload.reason)}</h1>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#667781;width:140px;">Submitted</td><td style="padding:6px 0;">${escapeHtml(payload.createdAt.toISOString())}</td></tr>
        <tr><td style="padding:6px 0;color:#667781;">Also blocked</td><td style="padding:6px 0;">${payload.alsoBlock ? "Yes" : "No"}</td></tr>
        <tr><td style="padding:6px 0;color:#667781;">Reporter</td><td style="padding:6px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(fmtUser(payload.reporter))}</td></tr>
        <tr><td style="padding:6px 0;color:#667781;">Reported</td><td style="padding:6px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(fmtUser(payload.reported))}</td></tr>
      </table>

      <div style="margin-top:20px;padding:14px 16px;background:#f3f4f6;border-radius:10px;border:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#667781;font-weight:600;margin-bottom:6px;">Reporter's note</div>
        <div style="white-space:pre-wrap;font-size:14px;color:#0b141a;">${
          payload.note ? escapeHtml(payload.note) : "<span style='color:#9ca3af'>(none provided)</span>"
        }</div>
      </div>

      <div style="margin-top:24px;font-size:12px;color:#9ca3af;">— Veil server</div>
    </div>
  `;

  try {
    const from = env.SMTP_FROM ?? env.SMTP_USER!;
    const info = await transporter.sendMail({ from, to, subject, text, html });
    log.info(
      { messageId: info.messageId, accepted: info.accepted, to },
      "Report email dispatched.",
    );
  } catch (err) {
    log.error({ err }, "Failed to send report email via SMTP.");
  }
}
