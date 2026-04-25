import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Animated VeilChat intro ad — rendered entirely on a `<canvas>` so it
 * can be both *played* on the landing page and *recorded* into a real
 * downloadable video file (mp4 in Safari/iOS, webm everywhere else)
 * without any server-side encoding.
 *
 * Sequence (≈ 8s):
 *   0.0 – 1.5s  Brand splash fades in then out
 *   1.0 – 2.0s  Phone frame and chat header rise into view
 *   2.0 – 6.0s  Four messages slide up one after another, like a real
 *               conversation between two people
 *   6.5 – 8.0s  Outro: "VeilChat — Message privately." card
 */

const VIDEO_W = 720;
const VIDEO_H = 1280;
const FPS = 30;
const DURATION_SEC = 8;

type Side = "in" | "out";
type Msg = { side: Side; text: string; appearAt: number };

const MESSAGES: Msg[] = [
  { side: "in", text: "Hey, are we still on for Saturday?", appearAt: 2.0 },
  {
    side: "out",
    text: "Wouldn't miss it. 7pm at the place by the park?",
    appearAt: 3.2,
  },
  { side: "in", text: "Perfect. I'll bring the playlist.", appearAt: 4.4 },
  { side: "out", text: "You always do.", appearAt: 5.4 },
];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* ───────────────────────── primitives ───────────────────────── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ───────────────────────── brand mark on canvas ───────────────────────── */

function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const r = size * 0.22;
  const x = cx - size / 2;
  const y = cy - size / 2;

  ctx.save();
  ctx.fillStyle = "#2E6F40";
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();

  // V mark
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = size * 0.085;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.25, cy - size * 0.16);
  ctx.lineTo(cx, cy + size * 0.18);
  ctx.lineTo(cx + size * 0.25, cy - size * 0.16);
  ctx.stroke();

  // dot
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx + size * 0.31, cy - size * 0.30, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLockMini(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.18);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const w = size;
  const h = size * 0.95;
  const x = cx - w / 2;
  const y = cy - h / 2 + size * 0.1;
  // body
  roundRect(ctx, x, y + h * 0.35, w, h * 0.65, size * 0.18);
  ctx.stroke();
  // shackle
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.35, w * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── phone shell ───────────────────────── */

const PHONE = {
  x: VIDEO_W * 0.07,
  y: VIDEO_H * 0.08,
  w: VIDEO_W * 0.86,
  h: VIDEO_H * 0.84,
};

function drawPhoneShell(ctx: CanvasRenderingContext2D) {
  // outer body
  ctx.save();
  ctx.shadowColor = "rgba(17,27,33,0.35)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#111B21";
  roundRect(ctx, PHONE.x, PHONE.y, PHONE.w, PHONE.h, 70);
  ctx.fill();
  ctx.restore();

  // inner screen
  const inset = 12;
  const sx = PHONE.x + inset;
  const sy = PHONE.y + inset;
  const sw = PHONE.w - inset * 2;
  const sh = PHONE.h - inset * 2;

  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, 60);
  ctx.clip();

  // base bg
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(sx, sy, sw, sh);

  // status bar
  ctx.fillStyle = "rgba(37,61,44,0.7)";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("9:41", sx + 36, sy + 30);
  ctx.textAlign = "right";
  ctx.fillText("100%", sx + sw - 36, sy + 30);

  // chat header
  const headerH = 100;
  const headerY = sy + 56;
  ctx.fillStyle = "#2E6F40";
  ctx.fillRect(sx, headerY, sw, headerH);

  // back chevron
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx + 38, headerY + headerH / 2 - 12);
  ctx.lineTo(sx + 26, headerY + headerH / 2);
  ctx.lineTo(sx + 38, headerY + headerH / 2 + 12);
  ctx.stroke();

  // avatar
  const avatarX = sx + 70;
  const avatarY = headerY + headerH / 2;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 26px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", avatarX, avatarY + 1);

  // title + subtitle
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 26px Inter, sans-serif";
  ctx.fillText("Alex Mendoza", avatarX + 40, avatarY - 12);

  drawLockMini(ctx, avatarX + 50, avatarY + 16, 16, "#CFFFDC");
  ctx.fillStyle = "#CFFFDC";
  ctx.font = "500 18px Inter, sans-serif";
  ctx.fillText("end-to-end encrypted", avatarX + 64, avatarY + 16);

  // chat body bg
  const bodyY = headerY + headerH;
  const bodyH = sh - (bodyY - sy) - 110; // leave room for input bar
  ctx.fillStyle = "#E6FFDA";
  ctx.fillRect(sx, bodyY, sw, bodyH);

  // input bar
  const barY = sy + sh - 96;
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(sx, barY, sw, 96);
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, sx + 24, barY + 22, sw - 24 - 86, 52, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(37,61,44,0.12)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, sx + 24, barY + 22, sw - 24 - 86, 52, 26);
  ctx.stroke();
  ctx.fillStyle = "rgba(60,90,71,0.6)";
  ctx.font = "400 22px Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Message", sx + 50, barY + 48);

  // send button
  const sendCx = sx + sw - 50;
  const sendCy = barY + 48;
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(sendCx, sendCy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(sendCx - 10, sendCy - 10);
  ctx.lineTo(sendCx + 12, sendCy);
  ctx.lineTo(sendCx - 10, sendCy + 10);
  ctx.lineTo(sendCx - 6, sendCy);
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // unclip

  // subtle screen border
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, sx, sy, sw, sh, 60);
  ctx.stroke();
}

/* ───────────────────────── messages ───────────────────────── */

const BUBBLE_FONT_SIZE = 24;
const BUBBLE_LINE_HEIGHT = BUBBLE_FONT_SIZE * 1.35;
const BUBBLE_PAD_X = 22;
const BUBBLE_PAD_Y = 16;
const BUBBLE_MAX_TEXT_W = PHONE.w * 0.62;

type Layout = {
  side: Side;
  text: string;
  lines: string[];
  w: number;
  h: number;
  appearAt: number;
};

function layoutMessages(ctx: CanvasRenderingContext2D): Layout[] {
  ctx.font = `400 ${BUBBLE_FONT_SIZE}px Inter, sans-serif`;
  return MESSAGES.map((m) => {
    const lines = wrapText(ctx, m.text, BUBBLE_MAX_TEXT_W);
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const w = textW + BUBBLE_PAD_X * 2 + 90; // room for timestamp
    const h = lines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PAD_Y * 2;
    return { side: m.side, text: m.text, lines, w, h, appearAt: m.appearAt };
  });
}

function drawMessages(ctx: CanvasRenderingContext2D, t: number) {
  const layouts = layoutMessages(ctx);

  // chat body region (mirror of drawPhoneShell math)
  const inset = 12;
  const sx = PHONE.x + inset;
  const sy = PHONE.y + inset;
  const sw = PHONE.w - inset * 2;
  const sh = PHONE.h - inset * 2;
  const bodyTop = sy + 56 + 100; // status bar + header
  const bodyBottom = sy + sh - 96; // above input bar
  const sidePad = 26;
  const gap = 14;

  // E2E pill at top of chat body
  const pillW = 460;
  const pillH = 44;
  const pillX = sx + (sw - pillW) / 2;
  const pillY = bodyTop + 18;
  ctx.save();
  ctx.fillStyle = "rgba(207,255,220,0.85)";
  roundRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.fill();
  drawLockMini(ctx, pillX + 22, pillY + pillH / 2, 14, "#2E6F40");
  ctx.fillStyle = "#3C5A47";
  ctx.font = "500 18px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Messages and calls are end-to-end encrypted.",
    pillX + 40,
    pillY + pillH / 2 + 1,
  );
  ctx.restore();

  // Lay out bubbles top-down starting just below the pill.
  let cursorY = pillY + pillH + 24;

  for (const b of layouts) {
    const local = clamp01((t - b.appearAt) / 0.45);
    if (local <= 0) {
      cursorY += b.h + gap;
      continue;
    }
    const eased = easeOut(local);
    const slideY = (1 - eased) * 28;
    const alpha = eased;

    const bx = b.side === "in" ? sx + sidePad : sx + sw - sidePad - b.w;
    const by = cursorY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, slideY);

    // shadow
    ctx.fillStyle = "rgba(17,27,33,0.06)";
    roundRect(ctx, bx, by + 3, b.w, b.h, 22);
    ctx.fill();

    // bubble
    ctx.fillStyle = b.side === "in" ? "#FFFFFF" : "#CFFFDC";
    roundRect(ctx, bx, by, b.w, b.h, 22);
    ctx.fill();

    // text
    ctx.fillStyle = "#111B21";
    ctx.font = `400 ${BUBBLE_FONT_SIZE}px Inter, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < b.lines.length; i++) {
      const line = b.lines[i] ?? "";
      ctx.fillText(
        line,
        bx + BUBBLE_PAD_X,
        by + BUBBLE_PAD_Y + i * BUBBLE_LINE_HEIGHT,
      );
    }

    // timestamp
    ctx.fillStyle = b.side === "in" ? "rgba(60,90,71,0.6)" : "#2E6F40";
    ctx.font = "500 16px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("9:41", bx + b.w - BUBBLE_PAD_X, by + b.h - 10);

    // double-check ticks for outgoing
    if (b.side === "out") {
      const tx = bx + b.w - BUBBLE_PAD_X - 56;
      const ty = by + b.h - 18;
      ctx.strokeStyle = "#2E6F40";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 4, ty + 4);
      ctx.lineTo(tx + 12, ty - 6);
      ctx.moveTo(tx + 6, ty);
      ctx.lineTo(tx + 10, ty + 4);
      ctx.lineTo(tx + 18, ty - 6);
      ctx.stroke();
    }

    ctx.restore();

    cursorY += b.h + gap;
    if (cursorY > bodyBottom - 40) break;
  }
}

/* ───────────────────────── full frame composer ───────────────────────── */

function drawFrame(ctx: CanvasRenderingContext2D, t: number) {
  // background
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

  // soft brand glow
  const grd = ctx.createRadialGradient(
    VIDEO_W * 0.78,
    VIDEO_H * 0.12,
    40,
    VIDEO_W * 0.78,
    VIDEO_H * 0.12,
    900,
  );
  grd.addColorStop(0, "rgba(207,255,220,0.55)");
  grd.addColorStop(1, "rgba(207,255,220,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

  // intro splash (0.0 - 1.5s)
  const splashAlpha =
    (1 - clamp01((t - 1.0) / 0.5)) * clamp01(t / 0.4);
  if (splashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = splashAlpha;
    drawLogoMark(ctx, VIDEO_W / 2, VIDEO_H / 2 - 60, 160);
    ctx.fillStyle = "#253D2C";
    ctx.font = "italic 600 56px 'Fraunces', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VeilChat", VIDEO_W / 2, VIDEO_H / 2 + 60);
    ctx.fillStyle = "#3C5A47";
    ctx.font = "500 26px Inter, sans-serif";
    ctx.fillText(
      "End-to-end encrypted",
      VIDEO_W / 2,
      VIDEO_H / 2 + 110,
    );
    ctx.restore();
  }

  // phone (1.0 - 6.5s) with rise-in
  if (t >= 1.0 && t <= 7.0) {
    const rise = clamp01((t - 1.0) / 0.6);
    const fadeOut = 1 - clamp01((t - 6.5) / 0.4);
    const alpha = easeOut(rise) * fadeOut;
    const ty = (1 - easeOut(rise)) * 80;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, ty);
    drawPhoneShell(ctx);
    drawMessages(ctx, t);
    ctx.restore();
  }

  // outro card (6.5 - 8.0s)
  if (t >= 6.4) {
    const fade = clamp01((t - 6.4) / 0.6);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#FCF5EB";
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

    drawLogoMark(ctx, VIDEO_W / 2, VIDEO_H / 2 - 110, 160);

    ctx.fillStyle = "#253D2C";
    ctx.font = "italic 600 72px 'Fraunces', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Message privately.", VIDEO_W / 2, VIDEO_H / 2 + 30);

    ctx.fillStyle = "#3C5A47";
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillText(
      "VeilChat · Private by default",
      VIDEO_W / 2,
      VIDEO_H / 2 + 100,
    );

    // CTA pill
    const pillW = 320;
    const pillH = 76;
    const px = (VIDEO_W - pillW) / 2;
    const py = VIDEO_H / 2 + 160;
    ctx.fillStyle = "#2E6F40";
    roundRect(ctx, px, py, pillW, pillH, 38);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillText("Get VeilChat — free", VIDEO_W / 2, py + pillH / 2 + 2);

    ctx.restore();
  }
}

/* ───────────────────────── recorder ───────────────────────── */

type SupportedRecording = { mimeType: string; ext: "mp4" | "webm" };

function pickRecordingFormat(): SupportedRecording | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: SupportedRecording[] = [
    { mimeType: "video/mp4;codecs=avc1", ext: "mp4" },
    { mimeType: "video/mp4", ext: "mp4" },
    { mimeType: "video/webm;codecs=vp9", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8", ext: "webm" },
    { mimeType: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return null;
}

/* ───────────────────────── React component ───────────────────────── */

type Status = "idle" | "playing" | "recording" | "ready" | "error";

export function IntroAdSection() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [download, setDownload] = useState<{
    url: string;
    ext: "mp4" | "webm";
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // initial poster frame
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, 0);
  }, []);

  useEffect(() => {
    setSupported(pickRecordingFormat() !== null);
  }, []);

  // free blob URL on unmount
  useEffect(() => {
    return () => {
      if (download?.url) URL.revokeObjectURL(download.url);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [download]);

  const runAnimation = useCallback(
    (onDone: () => void, onTick?: (t: number) => void) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;

      const start = performance.now();
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        drawFrame(ctx, Math.min(t, DURATION_SEC));
        onTick?.(t);
        setProgress(clamp01(t / DURATION_SEC));
        if (t < DURATION_SEC) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          onDone();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [],
  );

  const play = useCallback(async () => {
    if (status === "playing" || status === "recording") return;
    if ("fonts" in document) {
      try {
        await (document as Document).fonts.ready;
      } catch {
        /* ignore */
      }
    }
    setStatus("playing");
    setErrorMsg(null);
    runAnimation(() => setStatus("idle"));
  }, [runAnimation, status]);

  const recordAndDownload = useCallback(async () => {
    if (status === "recording") return;
    const c = canvasRef.current;
    if (!c) return;

    const fmt = pickRecordingFormat();
    if (!fmt) {
      setErrorMsg(
        "Your browser doesn't support video recording. Try Chrome, Edge, Safari 14+, or Firefox.",
      );
      setStatus("error");
      return;
    }

    if ("fonts" in document) {
      try {
        await (document as Document).fonts.ready;
      } catch {
        /* ignore */
      }
    }

    const stream = (
      c as HTMLCanvasElement & {
        captureStream: (fps?: number) => MediaStream;
      }
    ).captureStream(FPS);

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: fmt.mimeType,
        videoBitsPerSecond: 4_000_000,
      });
    } catch (err) {
      setErrorMsg(
        `Couldn't start the recorder: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      setStatus("error");
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    if (download?.url) {
      URL.revokeObjectURL(download.url);
      setDownload(null);
    }

    setStatus("recording");
    setErrorMsg(null);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: fmt.mimeType.split(";")[0] });
      const url = URL.createObjectURL(blob);
      setDownload({ url, ext: fmt.ext });
      setStatus("ready");
    };

    recorder.start(200);
    runAnimation(() => {
      // tiny grace period so the last frame is captured
      setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }, 120);
    });
  }, [download, runAnimation, status]);

  const triggerDownload = useCallback(() => {
    if (!download) return;
    const a = document.createElement("a");
    a.href = download.url;
    a.download = `veilchat-intro.${download.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [download]);

  const isBusy = status === "playing" || status === "recording";

  return (
    <section
      id="intro-video"
      className="py-24 sm:py-32 px-5 sm:px-8"
      style={{ backgroundColor: "#FCF5EB" }}
      data-no-tap-scroll
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-[#2E6F40] bg-[#CFFFDC] border border-[#68BA7F]/40 rounded-full px-3 py-1.5">
            New · Animated intro
          </div>
          <h2
            className="mt-5 text-[32px] sm:text-[42px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#253D2C]"
            style={{
              fontFamily: "'Fraunces', 'Inter', serif",
              fontWeight: 600,
            }}
          >
            Watch the{" "}
            <span className="italic" style={{ color: "#2E6F40" }}>
              VeilChat intro.
            </span>
          </h2>
          <p className="mt-4 text-[16px] sm:text-[18px] text-[#3C5A47] max-w-2xl mx-auto leading-[1.55]">
            A short animated ad of two friends chatting on VeilChat — built
            right here in your browser. Tap play to preview, or download it
            as a video file you can share anywhere.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Player */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div
              className="relative mx-auto rounded-[2rem] overflow-hidden border border-[#253D2C]/10 bg-[#111B21] shadow-[0_40px_80px_-30px_rgba(17,27,33,0.45)]"
              style={{ maxWidth: 420 }}
              data-no-tap-scroll
            >
              <canvas
                ref={canvasRef}
                width={VIDEO_W}
                height={VIDEO_H}
                className="block w-full h-auto bg-[#FCF5EB]"
                style={{ aspectRatio: `${VIDEO_W} / ${VIDEO_H}` }}
                aria-label="VeilChat animated intro preview"
              />
              {/* progress bar */}
              <div className="absolute left-0 right-0 bottom-0 h-1 bg-white/10">
                <div
                  className="h-full bg-[#68BA7F] transition-[width] duration-100"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              {/* play overlay when idle */}
              {status === "idle" && progress === 0 && (
                <button
                  type="button"
                  onClick={play}
                  data-no-tap-scroll
                  aria-label="Play intro preview"
                  className="absolute inset-0 grid place-items-center bg-black/0 hover:bg-black/10 transition-colors"
                >
                  <span className="grid place-items-center w-20 h-20 rounded-full bg-white/95 shadow-2xl text-[#2E6F40]">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <h3
              className="text-[22px] sm:text-[26px] font-semibold text-[#253D2C]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Yours to keep.
            </h3>
            <p className="mt-2 text-[15px] sm:text-[16px] text-[#3C5A47] leading-relaxed">
              Use it on your social, your pitch, your own site. The intro is
              rendered fresh on your device each time, so the file you
              download is brand-new — no servers, no watermarks.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={play}
                disabled={isBusy}
                data-no-tap-scroll
                className="inline-flex items-center justify-center gap-2 border border-[#253D2C]/15 hover:border-[#2E6F40]/40 hover:bg-white text-[#253D2C] font-medium text-[15px] px-5 py-3 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
                {status === "playing" ? "Playing…" : "Play preview"}
              </button>

              <button
                type="button"
                onClick={recordAndDownload}
                disabled={isBusy || !supported}
                data-no-tap-scroll
                className="inline-flex items-center justify-center gap-2 bg-[#2E6F40] hover:bg-[#253D2C] text-white font-semibold text-[15px] px-5 py-3 rounded-full shadow-[0_18px_36px_-14px_rgba(46,111,64,0.55)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === "recording" ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    Recording…
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 4v12" />
                      <path d="M6 14l6 6 6-6" />
                      <path d="M5 20h14" />
                    </svg>
                    Generate &amp; download
                  </>
                )}
              </button>
            </div>

            {download && status === "ready" && (
              <div
                className="mt-5 rounded-2xl border border-[#68BA7F]/40 bg-[#CFFFDC]/40 px-4 py-3 flex items-center justify-between gap-4"
                data-no-tap-scroll
              >
                <div>
                  <div className="text-[14px] font-semibold text-[#253D2C]">
                    Your intro is ready
                  </div>
                  <div className="text-[12px] text-[#3C5A47]">
                    veilchat-intro.{download.ext} · {DURATION_SEC}s · 720×1280
                  </div>
                </div>
                <button
                  type="button"
                  onClick={triggerDownload}
                  data-no-tap-scroll
                  className="text-[14px] font-semibold text-white bg-[#2E6F40] hover:bg-[#253D2C] px-4 py-2 rounded-full transition-colors"
                >
                  Download
                </button>
              </div>
            )}

            {errorMsg && (
              <div
                className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
                data-no-tap-scroll
              >
                {errorMsg}
              </div>
            )}

            {!supported && (
              <p className="mt-4 text-[12px] text-[#3C5A47]/80">
                Heads up: your current browser can't record canvas video.
                Try the latest Chrome, Edge, Safari, or Firefox.
              </p>
            )}

            <ul className="mt-6 space-y-2 text-[13px] text-[#3C5A47]">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F40]" />
                720 × 1280 (vertical · perfect for Reels &amp; Shorts)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F40]" />
                ~{DURATION_SEC} seconds, ready to share
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F40]" />
                Saved as MP4 where supported, otherwise WebM
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
