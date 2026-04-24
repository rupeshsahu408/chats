/**
 * Veil Recovery Kit — visual PDF generator.
 *
 * Builds a single-page A4 PDF that contains a user's BIP-39 recovery
 * phrase laid out as numbered word cards plus a scannable QR code,
 * branded with Veil's identity. Each user gets a unique kit (their
 * handle, their words, their generation timestamp).
 *
 * Heavy dependencies (jspdf, qrcode) are lazy-loaded so the recovery
 * UI only pulls them in when the user actually requests a download —
 * keeping the main bundle small.
 */

export interface RecoveryKitInput {
  /** Username, e.g. "alice". Rendered as "@alice" inside the PDF. */
  username: string;
  /** Space-separated 12-word BIP-39 phrase. */
  phrase: string;
}

export interface RecoveryKit {
  /** The generated PDF as a Blob, ready to be downloaded or previewed. */
  blob: Blob;
  /** Suggested filename, e.g. "veil-recovery-kit-alice.pdf". */
  filename: string;
  /** Byte size of the blob, exposed so the UI can show "276 KB" etc. */
  bytes: number;
}

const VEIL_GREEN: [number, number, number] = [0, 168, 132]; // #00A884
const VEIL_GREEN_DARK: [number, number, number] = [0, 143, 113]; // #008F71
const INK: [number, number, number] = [17, 27, 33]; // dark slate
const MUTED: [number, number, number] = [100, 116, 124]; // soft slate
const PANEL_BG: [number, number, number] = [248, 250, 250];
const PANEL_BORDER: [number, number, number] = [220, 224, 226];
const SAFE_BG: [number, number, number] = [240, 250, 247];
const SAFE_BORDER: [number, number, number] = [180, 220, 207];

/**
 * Render a Veil Recovery Kit PDF for the given user. Returns a Blob
 * the caller can save with a temporary anchor download.
 */
export async function generateRecoveryKitPdf(
  input: RecoveryKitInput,
): Promise<RecoveryKit> {
  const [{ jsPDF }, QR] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);

  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const pageW = pdf.internal.pageSize.getWidth(); // 595.28
  const pageH = pdf.internal.pageSize.getHeight(); // 841.89
  const margin = 48;

  /* ─────────── header band ─────────── */
  pdf.setFillColor(...VEIL_GREEN);
  pdf.rect(0, 0, pageW, 96, "F");

  // Veil wordmark (typeset, no external font needed).
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.text("Veil", margin, 50);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(220, 240, 234);
  pdf.text("Privacy by design. Visible to no one but you.", margin, 70);

  // Pill on the right: "RECOVERY KIT".
  const pillText = "RECOVERY KIT";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  const pillW =
    pdf.getStringUnitWidth(pillText) * 9 / pdf.internal.scaleFactor + 22;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(pageW - margin - pillW, 36, pillW, 22, 11, 11, "F");
  pdf.setTextColor(...VEIL_GREEN_DARK);
  pdf.text(pillText, pageW - margin - pillW + 11, 51);

  /* ─────────── title ─────────── */
  let y = 138;
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Your Veil recovery kit", margin, y);

  y += 22;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...MUTED);
  pdf.text(
    "Use this kit to restore your account on any device. Keep the file",
    margin,
    y,
  );
  y += 14;
  pdf.text(
    "somewhere only you can reach — a password manager works well.",
    margin,
    y,
  );

  /* ─────────── meta row (handle + date) ─────────── */
  y += 28;
  drawMetaCard(pdf, margin, y, "Account", `@${input.username}`);
  drawMetaCard(
    pdf,
    margin + (pageW - margin * 2) / 2 + 8,
    y,
    "Generated",
    new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  /* ─────────── recovery phrase grid ─────────── */
  y += 64;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...INK);
  pdf.text("Your 12-word recovery phrase", margin, y);

  y += 18;
  drawWordGrid(pdf, input.phrase, margin, y, pageW - margin * 2);

  /* ─────────── QR + side caption ─────────── */
  const qrTop = y + 4 * 44 + 28;
  const qrSize = 140;
  const qrLeft = margin;
  const qrDataUrl = await QR.toDataURL(input.phrase, {
    margin: 1,
    width: qrSize * 4,
    color: { dark: rgbToHex(INK), light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
  pdf.addImage(qrDataUrl, "PNG", qrLeft, qrTop, qrSize, qrSize);

  // QR caption to the right of the code.
  const capX = qrLeft + qrSize + 20;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...INK);
  pdf.text("Scan to restore", capX, qrTop + 18);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(...MUTED);
  const lines = pdf.splitTextToSize(
    "On a new device, open Veil, choose Log in with Random ID, " +
      "then point your camera at this code (or type the 12 words above) " +
      "to recover your encrypted history.",
    pageW - margin - capX,
  );
  pdf.text(lines, capX, qrTop + 36);

  /* ─────────── safety panel ─────────── */
  const safeY = qrTop + qrSize + 22;
  const safeH = 78;
  pdf.setFillColor(...SAFE_BG);
  pdf.setDrawColor(...SAFE_BORDER);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(margin, safeY, pageW - margin * 2, safeH, 10, 10, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...VEIL_GREEN_DARK);
  pdf.text("Treat this like a key", margin + 16, safeY + 22);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  const safeLines = pdf.splitTextToSize(
    "Anyone with these 12 words can read your messages. Veil cannot " +
      "reset or recover them — they exist only here. Print this page or " +
      "store it in an encrypted password manager.",
    pageW - margin * 2 - 32,
  );
  pdf.text(safeLines, margin + 16, safeY + 38);

  /* ─────────── footer ─────────── */
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text(
    "Veil — end-to-end encrypted messaging.",
    margin,
    pageH - 32,
  );
  pdf.text(
    `Page 1 of 1 · Kit for @${input.username}`,
    pageW - margin,
    pageH - 32,
    { align: "right" },
  );

  const blob = pdf.output("blob");
  return {
    blob,
    filename: `veil-recovery-kit-${sanitize(input.username)}.pdf`,
    bytes: blob.size,
  };
}

/* ─────────── small helpers ─────────── */

function drawMetaCard(
  pdf: import("jspdf").jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  const cardW = (pdf.internal.pageSize.getWidth() - 48 * 2) / 2 - 8;
  pdf.setFillColor(...PANEL_BG);
  pdf.setDrawColor(...PANEL_BORDER);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(x, y, cardW, 50, 8, 8, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text(label.toUpperCase(), x + 12, y + 16);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...INK);
  pdf.text(value, x + 12, y + 36);
}

function drawWordGrid(
  pdf: import("jspdf").jsPDF,
  phrase: string,
  x: number,
  y: number,
  width: number,
) {
  const words = phrase.trim().split(/\s+/).slice(0, 12);
  const cols = 3;
  const rows = 4;
  const gap = 8;
  const cellW = (width - gap * (cols - 1)) / cols;
  const cellH = 38;

  for (let i = 0; i < words.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cx = x + c * (cellW + gap);
    const cy = y + r * (cellH + 6);

    // card
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...PANEL_BORDER);
    pdf.setLineWidth(0.6);
    pdf.roundedRect(cx, cy, cellW, cellH, 6, 6, "FD");

    // index
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(String(i + 1).padStart(2, "0"), cx + 10, cy + 16);

    // word
    pdf.setFont("courier", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...INK);
    pdf.text(words[i] ?? "", cx + 30, cy + 24);
  }

  // Suppress unused warning for rows when phrase is short — kept
  // for readability of the layout intent above.
  void rows;
}

function rgbToHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function sanitize(name: string): string {
  return (name || "account").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

/** Format a byte count as "276 KB" / "1.4 MB" — used by the download card. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Download a previously-generated kit by triggering an anchor click. */
export function triggerKitDownload(kit: RecoveryKit): void {
  const url = URL.createObjectURL(kit.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = kit.filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
