import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cinematic VeilChat product tour — a ~60-second guided walkthrough rendered
 * to a `<canvas>` with a synchronised Web Audio score so it can be both
 * *played* on the landing page and *recorded* into a downloadable video
 * file (with sound).
 *
 * Beat sheet (~60s):
 *   0.0 – 1.2s   Identity scan: padlock + scan line + "Identity verified"
 *   1.2 – 3.4s   Brand splash: logo, encryption keys orbit, wordmark
 *   3.4 – 4.2s   Phone rises, header settles with Maya Patel + verified ✓
 *   4.5 – 6.3s   Maya types (slower 3-dot bubble)
 *   6.3s         Message 1 arrives with encrypted shimmer + receive ding
 *   6.55s        Self-destructing photo bubble arrives, locked
 *   7.4s         Photo unlocks (scan line reveal) — countdown begins
 *   7.0 – 8.8s   You type in the input bar
 *   8.8s         Message 2 sent — lock-seal + "Encrypting…" tag + ✓→✓✓→read
 *  10.0 – 11.8s  Maya types
 *  11.8s         Message 3 arrives with disappearing-timer badge
 *  12.4 – 14.0s  You record — recording UI in input bar
 *  14.0s         Voice note sent with lock-seal
 *  15.2 – 16.8s  Maya types final goodbye
 *  15.8 – 16.65  Photo BURNS into pixel-dust embers (with crackle)
 *  16.65–17.1s   Photo bubble collapses, freeing chat space
 *  16.8s         Final message arrives ("We never had this chat")
 *  17.4s         Heart reaction floats up
 *  18.0 – 20.5s  Encryption highlight + "Screenshot blocked" alert banner
 *  21.0 – 22.0s  Touch ripple lands on a message (long-press)
 *  22.0 – 25.5s  Long-press action menu: Reply / Forward / Pin / Edit /
 *                Schedule / Star / Delete / **Unsend**
 *  25.5 – 26.8s  Tap Unsend → message scatters into pixel particles +
 *                "Message unsent" toast
 *  26.8 – 28.0s  You start composing a new message in the input bar
 *  28.0 – 29.5s  Tap "+" → attachment grid (Photo, Camera, Document,
 *                Schedule send, Location)
 *  29.5 – 30.0s  Tap "Schedule send"
 *  30.0 – 32.5s  Schedule modal slides up: day picker (Today / Tomorrow /
 *                Custom) + time wheels (9 : 00 AM)
 *  32.5 – 33.0s  Tap "Schedule" → modal slides down with confirm chime
 *  33.0 – 34.5s  Scheduled-message bubble appears in chat with clock badge
 *  34.5 – 35.0s  Tap header 3-dot menu → dropdown opens (Search / Mute /
 *                Disappearing / **Settings**)
 *  35.0 – 35.4s  Tap Settings
 *  35.4 – 36.4s  Chat slides off-screen to the left, Settings slides in
 *  36.4 – 50.0s  Settings tour:
 *                  • Profile card (avatar + name + status + edit pencil)
 *                  • Privacy: Read receipts toggle, Disappearing default
 *                    picker, Auto-delete media picker, Screen security
 *                  • Storage: usage bars + "Clean up cache" → progress →
 *                    "Cleaned 5.2 GB" toast
 *                  • Notifications: Hide previews toggle, In-app sounds
 *                  • Account: Linked devices submenu (phone + tablet)
 *                  • Two-factor authentication toggle
 *                  • Backup: Encrypted backup
 *                  • About: version + "End-to-end encrypted ✓"
 *  50.0 – 50.8s  Tap back → settings slides off, chat slides back in
 *  50.8 – 60.0s  Outro: logo zoom, tagline, CTA pill, drifting particles
 */

const VIDEO_W = 720;
const VIDEO_H = 1280;
const FPS = 30;
const DURATION_SEC = 60;

/* ───────────────────────── timeline ───────────────────────── */

type Side = "in" | "out";
type Tick = "none" | "sent" | "delivered" | "read";

type MessageEvent = {
  kind: "message";
  id: string;
  side: Side;
  variant: "text" | "voice" | "photo";
  text?: string;
  duration?: number;
  disappearing?: boolean;
  /** When the photo bubble unlocks (scan line reveal). */
  unlockAt?: number;
  /** When the photo bubble starts burning into pixel dust. */
  burnAt?: number;
  /** How long the burn animation lasts. */
  burnDuration?: number;
  at: number;
};

type TypingEvent = {
  kind: "typing";
  side: Side;
  start: number;
  end: number;
};

type TickEvent = {
  kind: "tick";
  id: string;
  stage: Exclude<Tick, "none">;
  at: number;
};

type ReactionEvent = {
  kind: "reaction";
  id: string;
  emoji: string;
  at: number;
};

type Event = MessageEvent | TypingEvent | TickEvent | ReactionEvent;

const EVENTS: Event[] = [
  { kind: "typing", side: "in", start: 4.5, end: 6.3 },
  {
    kind: "message",
    id: "m1",
    side: "in",
    variant: "text",
    text: "I've sent you the file. Eyes only, please.",
    at: 6.3,
  },
  {
    kind: "message",
    id: "p1",
    side: "in",
    variant: "photo",
    at: 6.55,
    unlockAt: 7.4,
    burnAt: 15.8,
    burnDuration: 0.85,
  },

  { kind: "typing", side: "out", start: 7.0, end: 8.8 },
  {
    kind: "message",
    id: "m2",
    side: "out",
    variant: "text",
    text: "Vault open on my side. Reading it now.",
    at: 8.8,
  },
  { kind: "tick", id: "m2", stage: "sent", at: 8.85 },
  { kind: "tick", id: "m2", stage: "delivered", at: 9.4 },
  { kind: "tick", id: "m2", stage: "read", at: 10.0 },

  { kind: "typing", side: "in", start: 10.0, end: 11.8 },
  {
    kind: "message",
    id: "m3",
    side: "in",
    variant: "text",
    text: "Notes are inside. Burns in 24h.",
    disappearing: true,
    at: 11.8,
  },

  { kind: "typing", side: "out", start: 12.4, end: 14.0 },
  {
    kind: "message",
    id: "m4",
    side: "out",
    variant: "voice",
    duration: 12,
    at: 14.0,
  },
  { kind: "tick", id: "m4", stage: "sent", at: 14.05 },
  { kind: "tick", id: "m4", stage: "delivered", at: 14.6 },
  { kind: "tick", id: "m4", stage: "read", at: 15.2 },

  { kind: "typing", side: "in", start: 15.2, end: 16.8 },
  {
    kind: "message",
    id: "m5",
    side: "in",
    variant: "text",
    text: "Perfect. We never had this chat 🤐",
    at: 16.8,
  },
  { kind: "reaction", id: "m5", emoji: "❤", at: 17.4 },
];

const AUTH_SCAN = { start: 0.0, end: 1.3 } as const;
const INTRO = { start: 1.2, end: 3.4 } as const;
const PHONE_IN = { start: 3.4, end: 4.2 } as const;
const SCREENSHOT_BANNER = { start: 18.4, end: 20.2 } as const;
const ENCRYPTION_HIGHLIGHT = { start: 18.0, end: 20.5 } as const;

/* product-tour scenes (added) */
const TOUCH_HINT = { start: 21.0, end: 22.0 } as const;
const LONG_PRESS = { start: 22.0, end: 25.5 } as const;
const UNSEND_ACTION = { start: 25.5, end: 26.8 } as const;
const COMPOSE_HINT = { start: 26.8, end: 28.0 } as const;
const ATTACHMENT_MENU = { start: 28.0, end: 29.7 } as const;
const SCHEDULE_PICKER = { start: 29.7, end: 33.0 } as const;
const SCHEDULED_PILL = { start: 33.0, end: 34.5 } as const;
const HEADER_MENU = { start: 34.5, end: 35.4 } as const;
const SETTINGS_TRANSITION = { start: 35.4, end: 36.4 } as const;
const SETTINGS_SCENE = { start: 36.4, end: 50.0 } as const;
const SETTINGS_BACK = { start: 50.0, end: 50.8 } as const;

const OUTRO = { start: 50.8, end: 60.0 } as const;

/* ───────────────────────── easing ───────────────────────── */

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

/* ───────────────────────── brand logo ───────────────────────── */

function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  glow = false,
) {
  const r = size * 0.22;
  const x = cx - size / 2;
  const y = cy - size / 2;

  ctx.save();
  if (glow) {
    ctx.shadowColor = "rgba(46,111,64,0.55)";
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = size * 0.08;
  }
  ctx.fillStyle = "#2E6F40";
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  const grd = ctx.createLinearGradient(x, y, x, y + size);
  grd.addColorStop(0, "rgba(255,255,255,0.18)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = size * 0.085;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.25, cy - size * 0.16);
  ctx.lineTo(cx, cy + size * 0.18);
  ctx.lineTo(cx + size * 0.25, cy - size * 0.16);
  ctx.stroke();

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
  roundRect(ctx, x, y + h * 0.35, w, h * 0.65, size * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.35, w * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

function drawSealLock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  closeProgress: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.shadowColor = "rgba(46,111,64,0.6)";
  ctx.shadowBlur = size * 0.6;

  const bw = size * 0.95;
  const bh = size * 0.78;
  ctx.fillStyle = "#2E6F40";
  roundRect(ctx, cx - bw / 2, cy - bh / 2 + size * 0.12, bw, bh, size * 0.2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // outer ring
  ctx.strokeStyle = "rgba(207,255,220,0.6)";
  ctx.lineWidth = size * 0.05;
  roundRect(ctx, cx - bw / 2, cy - bh / 2 + size * 0.12, bw, bh, size * 0.2);
  ctx.stroke();

  // arc — lifts when open, settles when closed
  const archLift = (1 - closeProgress) * size * 0.32;
  ctx.strokeStyle = "#2E6F40";
  ctx.lineWidth = size * 0.13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(
    cx,
    cy - bh / 2 + size * 0.12 - archLift,
    bw * 0.32,
    Math.PI,
    0,
  );
  ctx.stroke();

  // arc highlight
  ctx.strokeStyle = "rgba(207,255,220,0.9)";
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.arc(
    cx,
    cy - bh / 2 + size * 0.12 - archLift,
    bw * 0.32,
    Math.PI,
    Math.PI * 1.4,
  );
  ctx.stroke();

  // keyhole
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.16, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - size * 0.04, cy + size * 0.16, size * 0.08, size * 0.16);

  // sparkle ring on close
  if (closeProgress > 0.7) {
    const ringProg = (closeProgress - 0.7) / 0.3;
    ctx.globalAlpha = alpha * (1 - ringProg);
    ctx.strokeStyle = "rgba(104,186,127,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.05, size * 0.5 + ringProg * size * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawVerifiedBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.save();
  ctx.fillStyle = "#0EA5E9";
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.78;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(1.5, size * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy);
  ctx.lineTo(cx - size * 0.1, cy + size * 0.32);
  ctx.lineTo(cx + size * 0.45, cy - size * 0.28);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── phone shell ───────────────────────── */

const PHONE = {
  x: VIDEO_W * 0.07,
  y: VIDEO_H * 0.06,
  w: VIDEO_W * 0.86,
  h: VIDEO_H * 0.88,
};

const SCREEN_INSET = 14;
const SCREEN = {
  x: PHONE.x + SCREEN_INSET,
  y: PHONE.y + SCREEN_INSET,
  w: PHONE.w - SCREEN_INSET * 2,
  h: PHONE.h - SCREEN_INSET * 2,
};

const HEADER_H = 110;
const STATUS_H = 56;
const INPUT_H = 100;

const HEADER_Y = SCREEN.y + STATUS_H;
const BODY_Y = HEADER_Y + HEADER_H;
const BODY_BOTTOM = SCREEN.y + SCREEN.h - INPUT_H;

function drawPhoneBody(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.shadowColor = "rgba(17,27,33,0.4)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 36;
  ctx.fillStyle = "#0F1A1F";
  roundRect(ctx, PHONE.x, PHONE.y, PHONE.w, PHONE.h, 76);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, PHONE.x + 2, PHONE.y + 2, PHONE.w - 4, PHONE.h - 4, 74);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#1A2A30";
  ctx.fillRect(PHONE.x - 3, PHONE.y + 130, 4, 40);
  ctx.fillRect(PHONE.x - 3, PHONE.y + 200, 4, 64);
  ctx.fillRect(PHONE.x - 3, PHONE.y + 280, 4, 64);
  ctx.fillRect(PHONE.x + PHONE.w - 1, PHONE.y + 180, 4, 100);

  ctx.save();
  roundRect(ctx, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, 64);
  ctx.clip();
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
  ctx.restore();
}

function drawNotch(ctx: CanvasRenderingContext2D) {
  const w = 200;
  const h = 32;
  const x = SCREEN.x + (SCREEN.w - w) / 2;
  const y = SCREEN.y + 14;
  ctx.save();
  ctx.fillStyle = "#0F1A1F";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.fillStyle = "#1A2A30";
  ctx.beginPath();
  ctx.arc(x + w - 14, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStatusBar(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  ctx.fillStyle = "rgba(37,61,44,0.72)";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("9:41", SCREEN.x + 38, SCREEN.y + 30);

  // tiny shield icon next to clock — secured channel indicator
  const sx = SCREEN.x + 96;
  const sy = SCREEN.y + 30;
  const shieldPulse = 0.6 + Math.sin(t * 2.2) * 0.25;
  ctx.fillStyle = `rgba(46,111,64,${shieldPulse})`;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 8);
  ctx.lineTo(sx - 6, sy - 4);
  ctx.lineTo(sx - 6, sy + 2);
  ctx.bezierCurveTo(sx - 6, sy + 6, sx - 2, sy + 9, sx, sy + 9);
  ctx.bezierCurveTo(sx + 2, sy + 9, sx + 6, sy + 6, sx + 6, sy + 2);
  ctx.lineTo(sx + 6, sy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("E2E", sx, sy + 1);

  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(37,61,44,0.72)";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.fillText("100%", SCREEN.x + SCREEN.w - 42, SCREEN.y + 30);

  const bx = SCREEN.x + SCREEN.w - 36;
  const by = SCREEN.y + 22;
  ctx.strokeStyle = "rgba(37,61,44,0.55)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, 24, 12, 3);
  ctx.stroke();
  ctx.fillStyle = "rgba(37,61,44,0.55)";
  ctx.fillRect(bx + 24, by + 4, 2, 4);
  ctx.fillStyle = "#2E6F40";
  ctx.fillRect(bx + 2, by + 2, 20, 8);
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#2E6F40";
  ctx.fillRect(SCREEN.x, HEADER_Y, SCREEN.w, HEADER_H);

  // header subtle gradient overlay
  const grd = ctx.createLinearGradient(SCREEN.x, HEADER_Y, SCREEN.x, HEADER_Y + HEADER_H);
  grd.addColorStop(0, "rgba(255,255,255,0.06)");
  grd.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = grd;
  ctx.fillRect(SCREEN.x, HEADER_Y, SCREEN.w, HEADER_H);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const cx = SCREEN.x + 30;
  const cy = HEADER_Y + HEADER_H / 2;
  ctx.moveTo(cx + 8, cy - 12);
  ctx.lineTo(cx - 4, cy);
  ctx.lineTo(cx + 8, cy + 12);
  ctx.stroke();
  ctx.restore();

  const avatarX = SCREEN.x + 76;
  const avatarY = HEADER_Y + HEADER_H / 2;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 28px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", avatarX, avatarY + 1);

  // online pulse
  const pulseR = 6 + Math.sin(t * 3.5) * 1.5;
  ctx.fillStyle = "rgba(104,186,127,0.45)";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, pulseR + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#68BA7F";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 26px Inter, sans-serif";
  const nameX = avatarX + 46;
  ctx.fillText("Maya Patel", nameX, avatarY - 4);

  // verified badge after the name
  const nameW = ctx.measureText("Maya Patel").width;
  drawVerifiedBadge(ctx, nameX + nameW + 14, avatarY - 12, 8);

  const alexTyping = isTypingAt(t, "in");
  ctx.fillStyle = "#CFFFDC";
  ctx.font = "500 18px Inter, sans-serif";
  ctx.fillText(
    alexTyping ? "typing…" : "online · vault open",
    nameX,
    avatarY + 22,
  );

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const vx = SCREEN.x + SCREEN.w - 110;
  const vy = HEADER_Y + HEADER_H / 2;
  roundRect(ctx, vx - 14, vy - 9, 22, 18, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(vx + 8, vy - 5);
  ctx.lineTo(vx + 18, vy - 9);
  ctx.lineTo(vx + 18, vy + 9);
  ctx.lineTo(vx + 8, vy + 5);
  ctx.closePath();
  ctx.stroke();

  const px = SCREEN.x + SCREEN.w - 50;
  const py = HEADER_Y + HEADER_H / 2;
  ctx.beginPath();
  ctx.moveTo(px - 10, py - 12);
  ctx.bezierCurveTo(px - 4, py - 12, px - 4, py - 4, px - 8, py);
  ctx.bezierCurveTo(px - 4, py + 4, px + 4, py + 12, px + 8, py + 12);
  ctx.bezierCurveTo(px + 12, py + 8, px + 12, py + 4, px + 12, py);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── input bar ───────────────────────── */

function isRecordingAt(t: number): boolean {
  const evt = currentTypingEvent(t, "out");
  if (!evt) return false;
  for (const e of EVENTS) {
    if (e.kind === "message" && e.side === "out" && e.at >= evt.start - 0.05) {
      return e.variant === "voice";
    }
  }
  return false;
}

function drawInputBar(ctx: CanvasRenderingContext2D, t: number) {
  const barY = SCREEN.y + SCREEN.h - INPUT_H;
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(SCREEN.x, barY, SCREEN.w, INPUT_H);

  ctx.fillStyle = "rgba(37,61,44,0.08)";
  ctx.fillRect(SCREEN.x, barY, SCREEN.w, 1);

  const pad = 24;
  const pillX = SCREEN.x + pad + 6;
  const pillY = barY + 22;
  const pillW = SCREEN.w - pad * 2 - 80;
  const pillH = 56;

  const recording = isRecordingAt(t);

  if (recording) {
    // recording pill — red tint, waveform animation, "Recording…" + duration
    ctx.fillStyle = "rgba(225,29,72,0.08)";
    roundRect(ctx, pillX, pillY, pillW, pillH, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(225,29,72,0.45)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, pillX, pillY, pillW, pillH, 28);
    ctx.stroke();

    // pulsing red dot
    const pulse = 0.7 + Math.sin(t * 8) * 0.3;
    ctx.fillStyle = `rgba(225,29,72,${pulse})`;
    ctx.beginPath();
    ctx.arc(pillX + 24, pillY + pillH / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // recording duration text — counts up while recording
    const recordEvt = currentTypingEvent(t, "out");
    const recElapsed = recordEvt ? Math.max(0, t - recordEvt.start) : 0;
    const mm = Math.floor(recElapsed / 60).toString().padStart(1, "0");
    const ss = Math.floor(recElapsed).toString().padStart(2, "0");

    ctx.fillStyle = "#E11D48";
    ctx.font = "600 15px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`${mm}:${ss}`, pillX + 42, pillY + pillH / 2);

    // animated waveform bars
    const wfX = pillX + 88;
    const wfW = pillW - 110;
    const bars = 28;
    for (let i = 0; i < bars; i++) {
      const phase = t * 4 + i * 0.4;
      const h = 4 + Math.abs(Math.sin(phase) * 16) + Math.abs(Math.cos(phase * 1.3) * 6);
      const x = wfX + (i / (bars - 1)) * wfW;
      ctx.fillStyle = "rgba(225,29,72,0.55)";
      ctx.fillRect(x - 1.5, pillY + pillH / 2 - h / 2, 3, h);
    }
  } else {
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, pillX, pillY, pillW, pillH, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(37,61,44,0.12)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, pillX, pillY, pillW, pillH, 28);
    ctx.stroke();

    // emoji icon
    ctx.save();
    ctx.strokeStyle = "rgba(60,90,71,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pillX + 28, pillY + pillH / 2, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pillX + 24, pillY + pillH / 2 - 3, 1.4, 0, Math.PI * 2);
    ctx.arc(pillX + 32, pillY + pillH / 2 - 3, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(60,90,71,0.55)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pillX + 28, pillY + pillH / 2 + 2, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();

    const userTyping = isTypingAt(t, "out");
    const userTypingEvent = currentTypingEvent(t, "out");
    const draftText = nextOutgoingMessageText(t);

    if (userTyping && userTypingEvent && draftText) {
      const progress = clamp01(
        (t - userTypingEvent.start) / (userTypingEvent.end - userTypingEvent.start),
      );
      const charsToShow = Math.floor(draftText.length * easeOut(progress));
      const visible = draftText.slice(0, charsToShow);
      ctx.save();
      ctx.fillStyle = "#111B21";
      ctx.font = "400 22px Inter, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const textX = pillX + 60;
      const textY = pillY + pillH / 2;
      let display = visible;
      while (
        ctx.measureText(display).width > pillW - 80 &&
        display.length > 4
      ) {
        display = "…" + display.slice(-Math.floor(display.length * 0.8));
      }
      ctx.fillText(display, textX, textY + 1);

      const caretAlpha = Math.sin(t * 14) > 0 ? 1 : 0.2;
      ctx.globalAlpha = caretAlpha;
      ctx.fillStyle = "#2E6F40";
      const caretX = textX + ctx.measureText(display).width + 4;
      ctx.fillRect(caretX, textY - 12, 2, 24);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(60,90,71,0.55)";
      ctx.font = "400 22px Inter, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("Encrypted message", pillX + 60, pillY + pillH / 2 + 1);
    }
  }

  // attachment icon
  ctx.save();
  ctx.strokeStyle = "rgba(60,90,71,0.55)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const cx = pillX + pillW - 30;
  const cy = pillY + pillH / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 6);
  ctx.lineTo(cx - 10, cy - 4);
  ctx.lineTo(cx - 4, cy - 4);
  ctx.lineTo(cx - 2, cy - 8);
  ctx.lineTo(cx + 6, cy - 8);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx + 14, cy - 4);
  ctx.lineTo(cx + 14, cy + 6);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 1, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // send / mic button
  const btnCx = SCREEN.x + SCREEN.w - 50;
  const btnCy = barY + INPUT_H / 2;
  const userTyping = isTypingAt(t, "out") && !recording;

  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(btnCx, btnCy, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = "#FFFFFF";
  ctx.fillStyle = "#FFFFFF";
  if (userTyping) {
    ctx.beginPath();
    ctx.moveTo(btnCx - 10, btnCy - 10);
    ctx.lineTo(btnCx + 12, btnCy);
    ctx.lineTo(btnCx - 10, btnCy + 10);
    ctx.lineTo(btnCx - 6, btnCy);
    ctx.closePath();
    ctx.fill();
  } else if (recording) {
    // pulsing stop square
    ctx.fillStyle = "#FFFFFF";
    const sq = 14 + Math.sin(t * 8) * 1.5;
    ctx.fillRect(btnCx - sq / 2, btnCy - sq / 2, sq, sq);
  } else {
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    roundRect(ctx, btnCx - 6, btnCy - 12, 12, 18, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(btnCx, btnCy + 6, 10, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(btnCx, btnCy + 16);
    ctx.lineTo(btnCx, btnCy + 22);
    ctx.stroke();
  }
  ctx.restore();
}

/* ───────────────────────── conversation drawing ───────────────────────── */

const BUBBLE_FONT = 24;
const BUBBLE_LH = BUBBLE_FONT * 1.35;
const BUBBLE_PAD_X = 22;
const BUBBLE_PAD_Y = 16;
const BUBBLE_GAP = 12;
const BUBBLE_MAX_TEXT_W = SCREEN.w * 0.62;
const SIDE_PAD = 26;

type Layout = {
  msg: MessageEvent;
  lines: string[];
  w: number;
  h: number;
};

function layoutMessage(
  ctx: CanvasRenderingContext2D,
  m: MessageEvent,
): Layout {
  if (m.variant === "voice") {
    return { msg: m, lines: [], w: 260, h: 70 };
  }
  if (m.variant === "photo") {
    return { msg: m, lines: [], w: 240, h: 280 };
  }
  ctx.font = `400 ${BUBBLE_FONT}px Inter, sans-serif`;
  const lines = wrapText(ctx, m.text ?? "", BUBBLE_MAX_TEXT_W);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const w = textW + BUBBLE_PAD_X * 2 + 84;
  const h = lines.length * BUBBLE_LH + BUBBLE_PAD_Y * 2;
  return { msg: m, lines, w, h };
}

function isTypingAt(t: number, side: Side): boolean {
  for (const e of EVENTS) {
    if (e.kind === "typing" && e.side === side) {
      if (t >= e.start && t <= e.end) return true;
    }
  }
  return false;
}

function currentTypingEvent(t: number, side: Side): TypingEvent | null {
  for (const e of EVENTS) {
    if (e.kind === "typing" && e.side === side) {
      if (t >= e.start && t <= e.end) return e;
    }
  }
  return null;
}

function nextOutgoingMessageText(t: number): string | null {
  for (const e of EVENTS) {
    if (e.kind === "message" && e.side === "out" && e.at >= t) {
      return e.variant === "text" ? e.text ?? null : "[Voice note]";
    }
  }
  return null;
}

function tickStateAt(t: number, id: string): Tick {
  let stage: Tick = "none";
  for (const e of EVENTS) {
    if (e.kind === "tick" && e.id === id && t >= e.at) stage = e.stage;
  }
  return stage;
}

function reactionAt(
  t: number,
  id: string,
): { emoji: string; age: number } | null {
  for (const e of EVENTS) {
    if (e.kind === "reaction" && e.id === id && t >= e.at) {
      return { emoji: e.emoji, age: t - e.at };
    }
  }
  return null;
}

function drawTickGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stage: Tick,
) {
  if (stage === "none") return;
  const color = stage === "read" ? "#0EA5E9" : "rgba(60,90,71,0.6)";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y + 4);
  ctx.lineTo(x + 12, y - 5);
  ctx.stroke();
  if (stage === "delivered" || stage === "read") {
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 10, y + 4);
    ctx.lineTo(x + 18, y - 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTypingBubble(
  ctx: CanvasRenderingContext2D,
  side: Side,
  y: number,
  t: number,
  alpha: number,
) {
  const w = 88;
  const h = 46;
  const bx =
    side === "in"
      ? SCREEN.x + SIDE_PAD
      : SCREEN.x + SCREEN.w - SIDE_PAD - w;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, y + 3, w, h, 23);
  ctx.fill();

  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, y, w, h, 23);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const phase = t * 6 - i * 0.7;
    const lift = Math.max(0, Math.sin(phase)) * 5;
    const scale = 0.85 + Math.max(0, Math.sin(phase)) * 0.3;
    const dx = bx + 24 + i * 20;
    const dy = y + h / 2 - lift;
    ctx.fillStyle = "rgba(60,90,71,0.6)";
    ctx.beginPath();
    ctx.arc(dx, dy, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEncryptedShimmer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  progress: number,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();

  const sweepX = x - 60 + progress * (w + 120);
  const grd = ctx.createLinearGradient(
    sweepX - 30,
    y,
    sweepX + 60,
    y + h,
  );
  grd.addColorStop(0, "rgba(255,255,255,0)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}

function drawDisappearingBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  appearAt: number,
) {
  const local = clamp01((t - appearAt) / 0.45);
  if (local <= 0) return;
  const alpha = local;
  const pulse = 0.85 + Math.sin((t - appearAt) * 3.2) * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;

  const pillW = 132;
  const pillH = 28;

  ctx.fillStyle = `rgba(225,29,72,${0.12 * pulse})`;
  roundRect(ctx, x, y, pillW, pillH, 14);
  ctx.fill();

  ctx.strokeStyle = `rgba(225,29,72,${0.45 * pulse})`;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, pillW, pillH, 14);
  ctx.stroke();

  // clock icon
  ctx.strokeStyle = "#E11D48";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x + 14, y + pillH / 2, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  // hand sweeps with time to feel like a countdown
  const handAngle = ((t - appearAt) * 0.8) % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(x + 14, y + pillH / 2);
  ctx.lineTo(
    x + 14 + Math.sin(handAngle) * 4,
    y + pillH / 2 - Math.cos(handAngle) * 4,
  );
  ctx.stroke();

  ctx.fillStyle = "#E11D48";
  ctx.font = "600 13px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Burns in 24h", x + 28, y + pillH / 2 + 1);

  ctx.restore();
}

function drawEncryptingTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const text = "Encrypting…";
  ctx.font = "500 12px Inter, sans-serif";
  const w = ctx.measureText(text).width + 30;
  const h = 22;

  ctx.fillStyle = "rgba(46,111,64,0.12)";
  roundRect(ctx, x, y, w, h, 11);
  ctx.fill();

  // tiny lock glyph
  ctx.strokeStyle = "#2E6F40";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x + 10, y + h / 2 - 1, 3.5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#2E6F40";
  ctx.fillRect(x + 6.5, y + h / 2 - 1, 7, 6);

  ctx.fillStyle = "#2E6F40";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 18, y + h / 2);

  ctx.restore();
}

function drawVoiceNoteBubble(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  bx: number,
  by: number,
  t: number,
  appearAt: number,
) {
  const { w, h } = layout;
  const side = layout.msg.side;
  const duration = layout.msg.duration ?? 8;

  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, by + 3, w, h, 22);
  ctx.fill();
  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, by, w, h, 22);
  ctx.fill();

  const playCx = bx + 28;
  const playCy = by + h / 2;
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(playCx, playCy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(playCx - 4, playCy - 6);
  ctx.lineTo(playCx + 6, playCy);
  ctx.lineTo(playCx - 4, playCy + 6);
  ctx.closePath();
  ctx.fill();

  const wfX = bx + 52;
  const wfY = by + h / 2;
  const wfW = w - 100;
  const bars = 24;
  const elapsed = Math.max(0, t - appearAt);
  const playProgress = clamp01(elapsed / 1.8);
  for (let i = 0; i < bars; i++) {
    const seedH =
      6 +
      Math.abs(Math.sin(i * 1.7 + 3) * 12) +
      Math.abs(Math.cos(i * 0.9) * 8);
    const x = wfX + (i / (bars - 1)) * wfW;
    const played = i / (bars - 1) <= playProgress;
    ctx.fillStyle = played ? "#2E6F40" : "rgba(60,90,71,0.35)";
    ctx.fillRect(x - 1.5, wfY - seedH / 2, 3, seedH);
  }

  ctx.fillStyle = "rgba(60,90,71,0.7)";
  ctx.font = "500 15px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`0:${duration.toString().padStart(2, "0")}`, bx + 52, by + h - 8);

  const stage =
    side === "out" ? tickStateAt(t, layout.msg.id) : "none";
  ctx.fillStyle = side === "in" ? "rgba(60,90,71,0.6)" : "#2E6F40";
  ctx.font = "500 15px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("9:41", bx + w - 14, by + h - 8);
  if (side === "out") {
    drawTickGlyph(ctx, bx + w - 56, by + h - 12, stage);
  }
}

function drawTextBubble(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  bx: number,
  by: number,
  t: number,
) {
  const { w, h, lines } = layout;
  const side = layout.msg.side;

  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, by + 3, w, h, 22);
  ctx.fill();

  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, by, w, h, 22);
  ctx.fill();

  ctx.fillStyle = "#111B21";
  ctx.font = `400 ${BUBBLE_FONT}px Inter, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    ctx.fillText(line, bx + BUBBLE_PAD_X, by + BUBBLE_PAD_Y + i * BUBBLE_LH);
  }

  ctx.fillStyle = side === "in" ? "rgba(60,90,71,0.6)" : "#2E6F40";
  ctx.font = "500 16px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("9:41", bx + w - 14, by + h - 10);
  if (side === "out") {
    const stage = tickStateAt(t, layout.msg.id);
    drawTickGlyph(ctx, bx + w - 60, by + h - 14, stage);
  }
}

/* ───────────────── self-destructing photo bubble ──────────────── */

const PHOTO_BURN_PARTICLES = (() => {
  type P = {
    x: number;
    y: number;
    jitterX: number;
    speed: number;
    delay: number;
    size: number;
  };
  const list: P[] = [];
  const cols = 24;
  const rows = 28;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = c * 13.7 + r * 17.3;
      list.push({
        x: c / (cols - 1),
        y: r / (rows - 1),
        jitterX: (Math.sin(seed * 0.91) * 0.5 + 0.5) * 28 - 14,
        speed: 40 + (Math.cos(seed * 1.3) * 0.5 + 0.5) * 80,
        delay: (Math.sin(seed * 2.7) * 0.5 + 0.5) * 0.18,
        size: 1.4 + (Math.cos(seed * 0.7) * 0.5 + 0.5) * 1.8,
      });
    }
  }
  return list;
})();

function drawPhotoContent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // paper background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, w, h);

  // top edge subtle shadow for paper feel
  const topShade = ctx.createLinearGradient(x, y, x, y + 28);
  topShade.addColorStop(0, "rgba(0,0,0,0.05)");
  topShade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(x, y, w, 28);

  // CONFIDENTIAL header bar
  ctx.fillStyle = "rgba(225,29,72,0.10)";
  ctx.fillRect(x + 12, y + 12, w - 24, 24);
  ctx.strokeStyle = "rgba(225,29,72,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 12, y + 12, w - 24, 24);
  ctx.fillStyle = "#E11D48";
  ctx.font = "700 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CONFIDENTIAL · EYES ONLY", x + w / 2, y + 24);

  // document title
  ctx.fillStyle = "#0F1A1F";
  ctx.font = "600 12px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Q2 strategy memo", x + 14, y + 52);

  // author + date subtitle
  ctx.fillStyle = "rgba(15,26,31,0.5)";
  ctx.font = "500 10px Inter, sans-serif";
  ctx.fillText("M. Patel · 25 Apr 2026", x + 14, y + 67);

  // redacted bars (simulated lines of text, blacked out)
  const barX = x + 14;
  const barY = y + 84;
  const widths = [0.78, 0.92, 0.55, 0.84, 0.42];
  for (let i = 0; i < widths.length; i++) {
    const bw = (w - 28) * (widths[i] ?? 0.7);
    // soft shadow under bar
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(barX, barY + i * 13 + 1, bw, 7);
    ctx.fillStyle = "#0F1A1F";
    ctx.fillRect(barX, barY + i * 13, bw, 7);
  }

  // mini chart panel
  const chartTop = barY + widths.length * 13 + 12;
  const chartH = 56;
  ctx.fillStyle = "rgba(46,111,64,0.07)";
  ctx.fillRect(x + 14, chartTop, w - 28, chartH);

  // grid lines
  ctx.strokeStyle = "rgba(46,111,64,0.18)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    const ly = chartTop + (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(x + 14, ly);
    ctx.lineTo(x + w - 14, ly);
    ctx.stroke();
  }

  // chart bars
  const heights = [0.4, 0.6, 0.45, 0.75, 0.55, 0.85, 0.7];
  const cw = (w - 36) / heights.length;
  for (let i = 0; i < heights.length; i++) {
    const ch = (chartH - 12) * (heights[i] ?? 0.5);
    ctx.fillStyle = "#2E6F40";
    ctx.fillRect(
      x + 18 + i * cw,
      chartTop + chartH - 6 - ch,
      Math.max(1, cw - 4),
      ch,
    );
  }

  // chart label
  ctx.fillStyle = "rgba(46,111,64,0.7)";
  ctx.font = "500 9px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Projected · weekly", x + 14, chartTop + chartH + 12);

  // footer redacted bar + page indicator
  ctx.fillStyle = "#0F1A1F";
  ctx.fillRect(x + 14, y + h - 28, (w - 28) * 0.62, 5);
  ctx.fillStyle = "rgba(15,26,31,0.45)";
  ctx.font = "500 9px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("p. 1 of 3", x + w - 14, y + h - 12);
}

function drawPhotoLocked(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
) {
  // frosted gradient background
  const grd = ctx.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, "#2E6F40");
  grd.addColorStop(0.55, "#3C5A47");
  grd.addColorStop(1, "#1F3327");
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);

  // diagonal noise dither
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let dy = 0; dy < h; dy += 6) {
    for (let dx = 0; dx < w; dx += 6) {
      const v =
        Math.sin((dx + dy) * 0.3) + Math.cos(dx * 0.13 + dy * 0.21);
      ctx.fillStyle = v > 0 ? "#FFFFFF" : "#000000";
      ctx.fillRect(x + dx, y + dy, 4, 4);
    }
  }
  ctx.restore();

  // ambient pulse glow behind padlock
  const pulse = 0.55 + Math.sin(t * 2.5) * 0.18;
  const radial = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2 - 14,
    14,
    x + w / 2,
    y + h / 2 - 14,
    w * 0.65,
  );
  radial.addColorStop(0, `rgba(207,255,220,${0.32 * pulse})`);
  radial.addColorStop(1, "rgba(207,255,220,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(x, y, w, h);

  // big padlock
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;
  drawLockMini(ctx, x + w / 2, y + h / 2 - 16, 44, "#FFFFFF");
  ctx.restore();

  // labels
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Encrypted file", x + w / 2, y + h / 2 + 32);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 11px Inter, sans-serif";
  ctx.fillText("Verifying recipient…", x + w / 2, y + h / 2 + 50);
}

function drawPhotoBurn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  burnProgress: number,
) {
  if (burnProgress <= 0) return;

  // burn front rises from below the photo to above it
  const burnY = y + h - easeOut(burnProgress) * (h + 36);
  const segments = 26;
  const wave = (i: number) =>
    Math.sin(i * 1.4 + burnProgress * 12) * 6 + Math.sin(i * 0.6) * 4;

  // ERASE everything below the burn front (destination-out)
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h + 8);
  for (let i = 0; i <= segments; i++) {
    const px = x + (i / segments) * w;
    ctx.lineTo(px, burnY + wave(i));
  }
  ctx.lineTo(x + w + 4, y + h + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (burnProgress < 0.97) {
    // outer red-orange glow along the burn line
    ctx.save();
    ctx.strokeStyle = "rgba(252,127,3,0.5)";
    ctx.shadowColor = "rgba(225,29,72,0.7)";
    ctx.shadowBlur = 22;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const px = x + (i / segments) * w;
      const py = burnY + wave(i);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // hot yellow core line
    ctx.save();
    ctx.strokeStyle = "rgba(252,211,77,0.95)";
    ctx.shadowColor = "rgba(252,211,77,0.85)";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const px = x + (i / segments) * w;
      const py = burnY + wave(i);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // pixel-dust embers rising from the burn line
  for (const p of PHOTO_BURN_PARTICLES) {
    const py0 = y + p.y * h;
    const distBelow = py0 - burnY; // positive = still under photo, negative = ignited
    if (distBelow < -22) continue;
    if (distBelow > 50) continue;
    // age: 0 = just ignited, 1 = fully faded
    const age = clamp01((22 - distBelow) / 60);
    if (age <= 0) continue;
    const px0 = x + p.x * w + p.jitterX * age;
    const py = py0 - age * 56 * (p.speed / 100);
    const alpha = (1 - age) * 0.85;
    const size = p.size * (1 - age * 0.45);

    // hot yellow core
    ctx.fillStyle = `rgba(252,211,77,${alpha})`;
    ctx.beginPath();
    ctx.arc(px0, py, size, 0, Math.PI * 2);
    ctx.fill();

    // outer red glow when fresh
    if (age < 0.35) {
      ctx.fillStyle = `rgba(252,127,3,${alpha * 0.55})`;
      ctx.beginPath();
      ctx.arc(px0, py, size * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPhotoBubble(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  bx: number,
  by: number,
  t: number,
) {
  const { w, h } = layout;
  const m = layout.msg;
  const side = m.side;

  const unlockAt = m.unlockAt ?? Infinity;
  const burnAt = m.burnAt ?? Infinity;
  const burnDuration = m.burnDuration ?? 1.0;

  const unlockProgress = clamp01((t - unlockAt) / 0.5);
  const burnProgress = t >= burnAt ? clamp01((t - burnAt) / burnDuration) : 0;

  // bubble shadow
  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, by + 3, w, h, 22);
  ctx.fill();

  // bubble background
  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, by, w, h, 22);
  ctx.fill();

  // photo area
  const photoPad = 6;
  const px = bx + photoPad;
  const py = by + photoPad;
  const pw = w - photoPad * 2;
  const ph = h - photoPad * 2 - 26; // leave space for caption strip

  ctx.save();
  roundRect(ctx, px, py, pw, ph, 16);
  ctx.clip();

  // unlocked photo content underneath
  if (unlockProgress > 0) {
    drawPhotoContent(ctx, px, py, pw, ph);
  }

  // locked overlay on top, fading as unlock progresses
  if (unlockProgress < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - unlockProgress;
    drawPhotoLocked(ctx, px, py, pw, ph, t);
    ctx.restore();
  }

  // scan line during the unlock transition
  if (unlockProgress > 0 && unlockProgress < 1) {
    const scanY = py + unlockProgress * ph;
    const scanGrd = ctx.createLinearGradient(
      px,
      scanY - 14,
      px,
      scanY + 14,
    );
    scanGrd.addColorStop(0, "rgba(104,186,127,0)");
    scanGrd.addColorStop(0.5, "rgba(104,186,127,0.7)");
    scanGrd.addColorStop(1, "rgba(104,186,127,0)");
    ctx.fillStyle = scanGrd;
    ctx.fillRect(px, scanY - 14, pw, 28);
    ctx.save();
    ctx.strokeStyle = "#68BA7F";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(104,186,127,0.85)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(px, scanY);
    ctx.lineTo(px + pw, scanY);
    ctx.stroke();
    ctx.restore();
  }

  // burn animation
  if (burnProgress > 0) {
    drawPhotoBurn(ctx, px, py, pw, ph, burnProgress);
  }

  ctx.restore(); // end photo clip

  // file watermark inside the photo (after unlock, before burn front passes)
  if (unlockProgress > 0.6 && burnProgress < 0.2) {
    ctx.save();
    ctx.globalAlpha = (unlockProgress - 0.6) / 0.4;
    ctx.fillStyle = "rgba(15,26,31,0.35)";
    ctx.font = "500 9px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("VEIL · " + m.id.toUpperCase(), bx + w - 14, by + 12);
    ctx.restore();
  }

  // caption / countdown strip at bottom
  const stripY = by + h - 30;
  const stripFadeOut = Math.max(0, 1 - burnProgress * 1.4);
  if (stripFadeOut > 0) {
    ctx.save();
    ctx.globalAlpha = stripFadeOut;

    ctx.fillStyle = "rgba(15,26,31,0.92)";
    roundRect(ctx, bx + 8, stripY, w - 16, 24, 12);
    ctx.fill();

    if (t < burnAt) {
      const remaining = Math.max(0, burnAt - t);
      const seconds = Math.ceil(remaining);
      const isUrgent = seconds <= 3;

      // pulsing red dot
      const dotPulse = isUrgent
        ? 0.65 + Math.sin(t * 14) * 0.35
        : 0.85;
      ctx.fillStyle = `rgba(225,29,72,${dotPulse})`;
      ctx.beginPath();
      ctx.arc(bx + 22, stripY + 12, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 10px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Burns in", bx + 32, stripY + 13);

      ctx.fillStyle = isUrgent ? "#FCD34D" : "#FFFFFF";
      ctx.font = "700 11px Inter, sans-serif";
      ctx.fillText(`${seconds}s`, bx + 70, stripY + 13);

      // timestamp on the right
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "500 11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("9:41", bx + w - 18, stripY + 13);
    } else if (burnProgress < 1) {
      ctx.fillStyle = "#FCD34D";
      ctx.font = "700 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BURNING…", bx + w / 2, stripY + 13);
    }

    ctx.restore();
  }
}

// captured during drawConversation so the unsend particle effect can target
// the exact bubble that "Maya" just sent.
let m5Bbox: { x: number; y: number; w: number; h: number } | null = null;

function drawConversation(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  roundRect(ctx, SCREEN.x, BODY_Y, SCREEN.w, BODY_BOTTOM - BODY_Y, 0);
  ctx.clip();
  ctx.fillStyle = "#E6FFDA";
  ctx.fillRect(SCREEN.x, BODY_Y, SCREEN.w, BODY_BOTTOM - BODY_Y);

  // ornamental dots
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#2E6F40";
  for (let y = BODY_Y + 30; y < BODY_BOTTOM; y += 70) {
    for (let x = SCREEN.x + 30; x < SCREEN.x + SCREEN.w; x += 70) {
      const off = ((Math.floor(y / 70)) % 2) * 35;
      ctx.beginPath();
      ctx.arc(x + off, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // E2E pill at top of chat body
  const pillW = 480;
  const pillH = 44;
  const pillX = SCREEN.x + (SCREEN.w - pillW) / 2;
  const pillY = BODY_Y + 18;

  let pillGlow = 0;
  if (t >= ENCRYPTION_HIGHLIGHT.start && t <= ENCRYPTION_HIGHLIGHT.end) {
    const local = (t - ENCRYPTION_HIGHLIGHT.start) /
      (ENCRYPTION_HIGHLIGHT.end - ENCRYPTION_HIGHLIGHT.start);
    pillGlow = Math.sin(local * Math.PI);
  }

  ctx.save();
  if (pillGlow > 0) {
    ctx.shadowColor = "rgba(46,111,64,0.7)";
    ctx.shadowBlur = 30 * pillGlow;
  }
  ctx.fillStyle =
    pillGlow > 0
      ? `rgba(207,255,220,${0.85 + pillGlow * 0.15})`
      : "rgba(207,255,220,0.85)";
  roundRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.fill();
  ctx.restore();

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

  const layouts: Layout[] = EVENTS.filter(
    (e): e is MessageEvent => e.kind === "message",
  ).map((m) => layoutMessage(ctx, m));

  let cursorY = pillY + pillH + 24;
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i]!;
    const m = layout.msg;
    const local = clamp01((t - m.at) / 0.45);
    const visible = local > 0;

    // Photo bubbles collapse after burning, freeing chat space smoothly
    let collapseFactor = 1;
    if (m.variant === "photo" && m.burnAt !== undefined) {
      const burnEnd = m.burnAt + (m.burnDuration ?? 1);
      if (t > burnEnd) {
        collapseFactor = 1 - easeOut(clamp01((t - burnEnd) / 0.45));
      }
    }
    const effectiveH = layout.h * collapseFactor;
    const effectiveGap = BUBBLE_GAP * collapseFactor;

    if (!visible) {
      cursorY += effectiveH + effectiveGap;
      if (m.disappearing) cursorY += 32;
      continue;
    }

    const eased = easeOut(local);
    const slideY = (1 - eased) * 36;
    const alpha = eased;

    const bx =
      m.side === "in"
        ? SCREEN.x + SIDE_PAD
        : SCREEN.x + SCREEN.w - SIDE_PAD - layout.w;
    const by = cursorY;

    // capture m5 bbox so the unsend overlay can target it precisely
    if (m.id === "m5") {
      m5Bbox = { x: bx, y: by, w: layout.w, h: layout.h };
    }

    // m5 fades out during the unsend animation
    let unsendFade = 1;
    if (m.id === "m5") {
      const ul = (t - UNSEND_ACTION.start) / 0.45;
      if (ul > 0) unsendFade = clamp01(1 - ul);
      if (t > UNSEND_ACTION.start + 0.45) unsendFade = 0;
    }
    if (unsendFade <= 0) {
      cursorY += effectiveH + effectiveGap;
      if (m.disappearing) cursorY += 32;
      continue;
    }

    ctx.save();
    ctx.globalAlpha = alpha * unsendFade;
    ctx.translate(0, slideY);

    if (m.variant === "photo") {
      // Clip-mask the bubble to its collapsing height so the burn looks like
      // it physically removes the bubble from the chat flow.
      if (collapseFactor < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          bx - 8,
          by,
          layout.w + 16,
          Math.max(0, layout.h * collapseFactor),
        );
        ctx.clip();
        ctx.globalAlpha = alpha * collapseFactor;
        drawPhotoBubble(ctx, layout, bx, by, t);
        ctx.restore();
      } else {
        drawPhotoBubble(ctx, layout, bx, by, t);
      }
    } else if (m.variant === "voice") {
      drawVoiceNoteBubble(ctx, layout, bx, by, t, m.at);
    } else {
      drawTextBubble(ctx, layout, bx, by, t);
    }

    // encryption shimmer sweep over the bubble for ~0.7s (skipped for
    // photo bubbles — they have their own scan-line reveal on unlock)
    if (m.variant !== "photo") {
      const shimmerLocal = clamp01((t - m.at) / 0.7);
      if (shimmerLocal > 0 && shimmerLocal < 1) {
        drawEncryptedShimmer(
          ctx,
          bx,
          by,
          layout.w,
          layout.h,
          22,
          shimmerLocal,
        );
      }
    }

    // lock-seal animation for outgoing messages: a small padlock that
    // closes and fades over the first ~0.55s
    if (m.side === "out") {
      const sealLocal = clamp01((t - m.at) / 0.55);
      const sealAlpha = 1 - clamp01((t - m.at - 0.35) / 0.25);
      if (sealAlpha > 0) {
        const sealCx = bx - 4;
        const sealCy = by + layout.h / 2;
        drawSealLock(
          ctx,
          sealCx,
          sealCy,
          36,
          easeOut(sealLocal),
          sealAlpha,
        );
      }

      // "Encrypting…" tag underneath, fades out
      const tagAlpha = 1 - clamp01((t - m.at - 0.5) / 0.5);
      if (tagAlpha > 0) {
        drawEncryptingTag(
          ctx,
          bx + layout.w - 110,
          by + layout.h + 6,
          tagAlpha,
        );
      }
    }

    ctx.restore();

    // disappearing badge for messages flagged as such
    if (m.disappearing) {
      drawDisappearingBadge(ctx, bx, by + layout.h + 6, t, m.at + 0.3);
    }

    // reaction floating up
    const rxn = reactionAt(t, m.id);
    if (rxn) {
      const rl = clamp01(rxn.age / 0.6);
      const reactionAlpha = rl < 0.85 ? easeOut(rl / 0.85) : 1;
      const reactionScale = 0.6 + easeOut(Math.min(1, rl * 1.4)) * 0.5;
      const rxX = m.side === "in" ? bx + layout.w - 8 : bx + 8;
      const rxY = by + layout.h - 4 + (1 - rl) * 8;
      ctx.save();
      ctx.globalAlpha = reactionAlpha;
      ctx.translate(rxX, rxY);
      ctx.scale(reactionScale, reactionScale);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(17,27,33,0.18)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#E11D48";
      const s = 1;
      ctx.beginPath();
      ctx.moveTo(0, 5 * s);
      ctx.bezierCurveTo(-10 * s, -2 * s, -10 * s, -10 * s, 0, -4 * s);
      ctx.bezierCurveTo(10 * s, -10 * s, 10 * s, -2 * s, 0, 5 * s);
      ctx.fill();
      ctx.restore();
    }

    cursorY += effectiveH + effectiveGap;
    if (m.disappearing) cursorY += 32;
  }

  // typing indicator (only for incoming side; outgoing is shown in input bar)
  for (const side of ["in"] as const) {
    const evt = currentTypingEvent(t, side);
    if (!evt) continue;
    const fadeIn = clamp01((t - evt.start) / 0.18);
    const fadeOut = 1 - clamp01((t - evt.end + 0.15) / 0.18);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;
    drawTypingBubble(ctx, side, cursorY, t, alpha);
  }

  // screenshot blocked banner overlay
  drawScreenshotBlockedBanner(ctx, t);

  ctx.restore();
}

function drawScreenshotBlockedBanner(
  ctx: CanvasRenderingContext2D,
  t: number,
) {
  const { start, end } = SCREENSHOT_BANNER;
  const local = (t - start) / (end - start);
  if (local < 0 || local > 1) return;

  let slide = 1;
  if (local < 0.18) slide = local / 0.18;
  else if (local > 0.82) slide = (1 - local) / 0.18;

  const bannerH = 56;
  const x = SCREEN.x + 24;
  const w = SCREEN.w - 48;
  const targetY = BODY_Y + 80;
  const y = targetY - (1 - easeOut(slide)) * (bannerH + 24);
  const alpha = easeOut(slide);

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(15,26,31,0.94)";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, w, bannerH, 14);
  ctx.fill();
  ctx.shadowBlur = 0;

  // shield icon
  ctx.strokeStyle = "#FCD34D";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sx = x + 30;
  const sy = y + bannerH / 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 14);
  ctx.lineTo(sx - 12, sy - 7);
  ctx.lineTo(sx - 12, sy + 4);
  ctx.bezierCurveTo(sx - 12, sy + 11, sx - 5, sy + 16, sx, sy + 16);
  ctx.bezierCurveTo(sx + 5, sy + 16, sx + 12, sy + 11, sx + 12, sy + 4);
  ctx.lineTo(sx + 12, sy - 7);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "#FCD34D";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - 4, sy - 1);
  ctx.lineTo(sx, sy + 4);
  ctx.lineTo(sx + 6, sy - 4);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 17px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Screenshot blocked", x + 60, sy - 6);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "500 13px Inter, sans-serif";
  ctx.fillText("Conversation stays in the vault", x + 60, sy + 12);

  ctx.restore();
}

/* ───────────────────────── intro auth scan + key orbit ───────────────────────── */

function drawAuthScan(ctx: CanvasRenderingContext2D, t: number) {
  const { start, end } = AUTH_SCAN;
  if (t < start || t > end + 0.2) return;
  const local = (t - start) / (end - start);

  const cx = VIDEO_W / 2;
  const cy = VIDEO_H / 2 - 60;
  const size = 160;

  const fadeIn = clamp01(local / 0.2);
  const fadeOut = 1 - clamp01((local - 0.85) / 0.15);
  const alpha = fadeIn * fadeOut;

  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // soft halo
  const halo = ctx.createRadialGradient(cx, cy, 20, cx, cy, 240);
  halo.addColorStop(0, "rgba(104,186,127,0.35)");
  halo.addColorStop(1, "rgba(104,186,127,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 240, cy - 240, 480, 480);

  // lock body
  const bw = size * 0.7;
  const bh = size * 0.55;
  ctx.fillStyle = "rgba(46,111,64,0.12)";
  roundRect(ctx, cx - bw / 2, cy - bh / 2 + size * 0.1, bw, bh, 16);
  ctx.fill();

  ctx.strokeStyle = "#2E6F40";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  roundRect(ctx, cx - bw / 2, cy - bh / 2 + size * 0.1, bw, bh, 16);
  ctx.stroke();

  // arc lifts after 0.6s
  const arcLift = clamp01((local - 0.6) / 0.25) * 30;
  ctx.beginPath();
  ctx.arc(
    cx,
    cy - bh / 2 + size * 0.1 - arcLift,
    bw * 0.32,
    Math.PI,
    0,
  );
  ctx.stroke();

  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 3, cy + size * 0.1, 6, 14);

  // scan line
  if (local >= 0.2 && local <= 0.65) {
    const scanProg = (local - 0.2) / 0.45;
    const scanY = cy - bh / 2 + size * 0.1 + scanProg * bh;
    const grd = ctx.createLinearGradient(
      cx - bw / 2,
      scanY - 14,
      cx - bw / 2,
      scanY + 14,
    );
    grd.addColorStop(0, "rgba(104,186,127,0)");
    grd.addColorStop(0.5, "rgba(104,186,127,0.7)");
    grd.addColorStop(1, "rgba(104,186,127,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(cx - bw / 2, scanY - 14, bw, 28);

    ctx.strokeStyle = "#68BA7F";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + 6, scanY);
    ctx.lineTo(cx + bw / 2 - 6, scanY);
    ctx.stroke();
  }

  // verified text after scan completes
  if (local >= 0.65) {
    const txtAlpha = clamp01((local - 0.65) / 0.2);
    ctx.globalAlpha = alpha * txtAlpha;

    drawVerifiedBadge(ctx, cx - 78, cy + size * 0.55, 9);

    ctx.fillStyle = "#2E6F40";
    ctx.font = "600 22px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Identity verified", cx - 60, cy + size * 0.55);
  }

  ctx.restore();
}

function drawKeyOrbit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  t: number,
  alpha: number,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // orbit ellipse
  ctx.strokeStyle = "rgba(104,186,127,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 0.85, radius * 0.55, Math.PI / 6, 0, Math.PI * 2);
  ctx.stroke();

  // orbiting dots
  for (let i = 0; i < 4; i++) {
    const phase = t * 1.6 + (i / 4) * Math.PI * 2;
    const r = radius + Math.sin(t * 0.8 + i) * 6;
    const x = cx + Math.cos(phase) * r;
    const y = cy + Math.sin(phase) * r * 0.5;

    // glow
    ctx.fillStyle = "rgba(104,186,127,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#68BA7F";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // tail
    for (let j = 1; j < 6; j++) {
      const trailPhase = phase - j * 0.1;
      const trailR = radius + Math.sin(t * 0.8 + i - j * 0.1) * 6;
      const tx = cx + Math.cos(trailPhase) * trailR;
      const ty = cy + Math.sin(trailPhase) * trailR * 0.5;
      ctx.fillStyle = `rgba(104,186,127,${0.45 - j * 0.07})`;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(0.5, 5 - j * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/* ───────────────────────── outro particles ───────────────────────── */

const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  xSeed: Math.sin(i * 12.9898) * 0.5 + 0.5,
  speed: 0.35 + (Math.cos(i * 78.233) * 0.5 + 0.5) * 0.7,
  size: 2 + (Math.sin(i * 7.317) * 0.5 + 0.5) * 4,
  phase: i * 0.91,
  hue: Math.sin(i * 3.7) * 0.5 + 0.5,
}));

function drawOutroParticles(ctx: CanvasRenderingContext2D, t: number) {
  if (t < OUTRO.start - 0.2) return;
  const elapsed = Math.max(0, t - OUTRO.start);

  ctx.save();
  for (const p of PARTICLES) {
    const cycle = (elapsed * p.speed * 70 + p.phase * 80) % (VIDEO_H + 200);
    const y = VIDEO_H - cycle;
    const x =
      p.xSeed * VIDEO_W + Math.sin(elapsed * 0.8 + p.phase) * 24;
    const alpha = 0.2 + Math.abs(Math.sin(elapsed * 1.4 + p.phase)) * 0.45;
    ctx.fillStyle =
      p.hue > 0.5
        ? `rgba(104,186,127,${alpha})`
        : `rgba(207,255,220,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ──────────────────── product-tour helpers ──────────────────── */

function drawChatDim(ctx: CanvasRenderingContext2D, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(15,26,31,${alpha})`;
  ctx.fillRect(SCREEN.x, HEADER_Y + HEADER_H, SCREEN.w, SCREEN.h - STATUS_H - HEADER_H);
  ctx.restore();
}

function drawTouchIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  startTime: number,
  duration = 0.9,
) {
  const local = (t - startTime) / duration;
  if (local < 0 || local > 1.2) return;
  const alpha = clamp01(1 - local);
  ctx.save();
  ctx.fillStyle = `rgba(46,111,64,${0.28 * alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, 28 + local * 18, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 2; i++) {
    const r = 24 + (local + i * 0.25) * 80;
    const ringA = clamp01(1 - (local + i * 0.25)) * 0.35;
    if (ringA <= 0) continue;
    ctx.strokeStyle = `rgba(46,111,64,${ringA})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,255,255,${0.95 * clamp01(1 - local * 0.6)})`;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(46,111,64,${0.85 * alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const LONG_PRESS_ACTIONS = [
  { icon: "↩", label: "Reply" },
  { icon: "→", label: "Forward" },
  { icon: "★", label: "Star" },
  { icon: "📌", label: "Pin" },
  { icon: "✎", label: "Edit" },
  { icon: "🗓", label: "Schedule" },
  { icon: "🗑", label: "Delete" },
  { icon: "↶", label: "Unsend" },
];

function drawLongPressMenu(ctx: CanvasRenderingContext2D, t: number) {
  if (t < LONG_PRESS.start - 0.05 || t > LONG_PRESS.end + 0.2) return;
  const inDur = 0.32;
  const outDur = 0.28;
  const inLocal = clamp01((t - LONG_PRESS.start) / inDur);
  const outLocal = clamp01((t - (LONG_PRESS.end - outDur)) / outDur);
  const visible = easeOut(inLocal) * (1 - easeOut(outLocal));
  if (visible <= 0) return;

  drawChatDim(ctx, 0.35 * visible);

  const sheetW = SCREEN.w - 40;
  const sheetH = 360;
  const sheetX = SCREEN.x + 20;
  const finalY = SCREEN.y + SCREEN.h - INPUT_H - sheetH - 16;
  const sheetY = finalY + (1 - visible) * 80;

  ctx.save();
  ctx.globalAlpha = visible;
  ctx.fillStyle = "rgba(15,26,31,0.25)";
  roundRect(ctx, sheetX, sheetY + 6, sheetW, sheetH, 24);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, sheetX, sheetY, sheetW, sheetH, 24);
  ctx.fill();

  ctx.fillStyle = "rgba(37,61,44,0.18)";
  roundRect(ctx, sheetX + sheetW / 2 - 26, sheetY + 12, 52, 5, 3);
  ctx.fill();

  const cols = 4;
  const padX = 18;
  const cellW = (sheetW - padX * 2) / cols;
  const cellH = 130;
  const gridY = sheetY + 36;

  const highlightStart = LONG_PRESS.end - 0.7;
  const highlightLocal = clamp01((t - highlightStart) / 0.5);

  for (let i = 0; i < LONG_PRESS_ACTIONS.length; i++) {
    const action = LONG_PRESS_ACTIONS[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = sheetX + padX + col * cellW + cellW / 2;
    const cy = gridY + row * cellH + cellH / 2 - 14;

    const stagger = clamp01((visible - i * 0.04) / 0.3);
    if (stagger <= 0) continue;

    ctx.save();
    ctx.globalAlpha = stagger * visible;

    const isUnsend = action.label === "Unsend";
    const isHighlighted = isUnsend && highlightLocal > 0;
    ctx.fillStyle = isHighlighted
      ? `rgba(46,111,64,${0.18 + highlightLocal * 0.18})`
      : "rgba(207,255,220,0.55)";
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();

    if (isHighlighted) {
      ctx.strokeStyle = `rgba(46,111,64,${0.6 + highlightLocal * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 32 + highlightLocal * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#253D2C";
    ctx.font = "26px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(action.icon, cx, cy);

    ctx.fillStyle = isUnsend ? "#2E6F40" : "#253D2C";
    ctx.font = `${isUnsend ? "600" : "500"} 14px Inter, sans-serif`;
    ctx.fillText(action.label, cx, cy + 50);
    ctx.restore();
  }

  // tap on Unsend (touch indicator)
  if (highlightLocal > 0) {
    const unsendIdx = LONG_PRESS_ACTIONS.findIndex((a) => a.label === "Unsend");
    const col = unsendIdx % cols;
    const row = Math.floor(unsendIdx / cols);
    const cx = sheetX + padX + col * cellW + cellW / 2;
    const cy = gridY + row * cellH + cellH / 2 - 14;
    drawTouchIndicator(ctx, cx, cy, t, highlightStart, 0.7);
  }

  // cancel pill
  const cancelY = sheetY + sheetH - 32;
  ctx.fillStyle = "rgba(37,61,44,0.06)";
  roundRect(ctx, sheetX + 24, cancelY - 18, sheetW - 48, 36, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(37,61,44,0.6)";
  ctx.font = "500 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Cancel", sheetX + sheetW / 2, cancelY);

  ctx.restore();
}

const UNSEND_PARTICLES = Array.from({ length: 220 }, (_, i) => ({
  fx: Math.sin(i * 12.9898) * 0.5 + 0.5,
  fy: Math.cos(i * 78.233) * 0.5 + 0.5,
  vx: (Math.sin(i * 3.7) - 0.5) * 280,
  vy: -120 - (Math.cos(i * 9.1) * 0.5 + 0.5) * 200,
  size: 1.5 + (Math.sin(i * 5.7) * 0.5 + 0.5) * 2,
  delay: (Math.sin(i * 11.3) * 0.5 + 0.5) * 0.2,
}));

function drawUnsendParticles(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  t: number,
  startTime: number,
) {
  const dur = 0.9;
  const local = (t - startTime) / dur;
  if (local < 0 || local > 1.4) return;
  ctx.save();
  for (const p of UNSEND_PARTICLES) {
    const pl = local - p.delay;
    if (pl < 0) continue;
    const px = bx + p.fx * bw + p.vx * pl;
    const py = by + p.fy * bh + p.vy * pl + 0.5 * 320 * pl * pl;
    const alpha = clamp01(1 - pl);
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(207,255,220,${alpha * 0.85})`;
    ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function drawToast(
  ctx: CanvasRenderingContext2D,
  text: string,
  t: number,
  startTime: number,
  duration = 1.4,
) {
  const local = (t - startTime) / duration;
  if (local < 0 || local > 1.1) return;
  const inA = clamp01(local / 0.18);
  const outA = clamp01(1 - (local - 0.78) / 0.22);
  const alpha = inA * outA;
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "500 16px Inter, sans-serif";
  const tw = ctx.measureText(text).width;
  const padX = 24;
  const w = tw + padX * 2;
  const h = 44;
  const x = SCREEN.x + (SCREEN.w - w) / 2;
  const y = SCREEN.y + SCREEN.h - INPUT_H - 80 - (1 - inA) * 18;

  ctx.fillStyle = "rgba(15,26,31,0.28)";
  roundRect(ctx, x, y + 4, w, h, 22);
  ctx.fill();
  ctx.fillStyle = "#253D2C";
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
}

const ATTACHMENT_OPTIONS = [
  { icon: "🖼", label: "Photo", color: "#7C3AED" },
  { icon: "📷", label: "Camera", color: "#E11D48" },
  { icon: "📄", label: "Document", color: "#2563EB" },
  { icon: "🗓", label: "Schedule", color: "#2E6F40" },
  { icon: "📍", label: "Location", color: "#EA580C" },
];

function drawAttachmentMenu(ctx: CanvasRenderingContext2D, t: number) {
  if (t < ATTACHMENT_MENU.start - 0.05 || t > ATTACHMENT_MENU.end + 0.2) return;
  const dur = 0.3;
  const inLocal = clamp01((t - ATTACHMENT_MENU.start) / dur);
  const outLocal = clamp01((t - (ATTACHMENT_MENU.end - dur)) / dur);
  const visible = easeOut(inLocal) * (1 - easeOut(outLocal));
  if (visible <= 0) return;

  drawChatDim(ctx, 0.28 * visible);

  const sheetW = SCREEN.w - 40;
  const sheetH = 200;
  const sheetX = SCREEN.x + 20;
  const finalY = SCREEN.y + SCREEN.h - INPUT_H - sheetH - 14;
  const sheetY = finalY + (1 - visible) * 60;

  ctx.save();
  ctx.globalAlpha = visible;
  ctx.fillStyle = "rgba(15,26,31,0.22)";
  roundRect(ctx, sheetX, sheetY + 5, sheetW, sheetH, 22);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, sheetX, sheetY, sheetW, sheetH, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(37,61,44,0.18)";
  roundRect(ctx, sheetX + sheetW / 2 - 26, sheetY + 12, 52, 5, 3);
  ctx.fill();

  const cols = 5;
  const padX = 14;
  const cellW = (sheetW - padX * 2) / cols;
  const gridY = sheetY + 36;

  const highlightStart = ATTACHMENT_MENU.end - 0.55;
  const highlightLocal = clamp01((t - highlightStart) / 0.4);

  for (let i = 0; i < ATTACHMENT_OPTIONS.length; i++) {
    const opt = ATTACHMENT_OPTIONS[i]!;
    const cx = sheetX + padX + i * cellW + cellW / 2;
    const cy = gridY + 50;
    const stagger = clamp01((visible - i * 0.05) / 0.3);
    if (stagger <= 0) continue;

    const isSchedule = opt.label === "Schedule";
    const isHighlighted = isSchedule && highlightLocal > 0;

    ctx.save();
    ctx.globalAlpha = stagger * visible;
    const r = 32 + (isHighlighted ? highlightLocal * 4 : 0);
    ctx.fillStyle = opt.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (isHighlighted) {
      ctx.strokeStyle = `rgba(46,111,64,${0.5 + highlightLocal * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "26px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opt.icon, cx, cy);
    ctx.fillStyle = "#253D2C";
    ctx.font = "500 13px Inter, sans-serif";
    ctx.fillText(opt.label, cx, cy + 56);
    ctx.restore();
  }

  // touch indicator on Schedule
  if (highlightLocal > 0) {
    const idx = ATTACHMENT_OPTIONS.findIndex((o) => o.label === "Schedule");
    const cx = sheetX + padX + idx * cellW + cellW / 2;
    const cy = gridY + 50;
    drawTouchIndicator(ctx, cx, cy, t, highlightStart, 0.5);
  }

  ctx.restore();
}

function drawTimeWheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  prev: string,
  cur: string,
  next: string,
  scrollOffset: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(207,255,220,0.4)";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();

  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.fillStyle = "rgba(46,111,64,0.12)";
  roundRect(ctx, x + 8, cy - 28, w - 16, 56, 12);
  ctx.fill();

  ctx.fillStyle = "#253D2C";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const items = [prev, cur, next];
  const itemH = 56;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 16);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const iy = cy + (i - 1) * itemH - scrollOffset;
    const dist = Math.abs(iy - cy) / 56;
    const alpha = clamp01(1 - dist * 0.7);
    const sz = i === 1 ? 32 : 24;
    ctx.globalAlpha = alpha;
    ctx.font = `${i === 1 ? "700" : "500"} ${sz}px Inter, sans-serif`;
    ctx.fillText(items[i]!, cx, iy);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // top/bottom fade overlay using bg cream
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0)");
  grad.addColorStop(0.65, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255,1)");
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 16);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.restore();
}

function drawSchedulePicker(ctx: CanvasRenderingContext2D, t: number) {
  if (t < SCHEDULE_PICKER.start - 0.05 || t > SCHEDULE_PICKER.end + 0.2) return;
  const inDur = 0.4;
  const outDur = 0.32;
  const inLocal = clamp01((t - SCHEDULE_PICKER.start) / inDur);
  const outLocal = clamp01((t - (SCHEDULE_PICKER.end - outDur)) / outDur);
  const visible = easeOut(inLocal) * (1 - easeOut(outLocal));
  if (visible <= 0) return;

  ctx.save();
  ctx.fillStyle = `rgba(15,26,31,${0.55 * visible})`;
  ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);

  const modalW = SCREEN.w - 40;
  const modalH = 540;
  const modalX = SCREEN.x + 20;
  const finalY = SCREEN.y + SCREEN.h - modalH - 30;
  const modalY = finalY + (1 - visible) * 100;

  ctx.globalAlpha = visible;
  ctx.fillStyle = "rgba(15,26,31,0.32)";
  roundRect(ctx, modalX, modalY + 8, modalW, modalH, 28);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, modalX, modalY, modalW, modalH, 28);
  ctx.fill();

  ctx.fillStyle = "rgba(37,61,44,0.18)";
  roundRect(ctx, modalX + modalW / 2 - 26, modalY + 12, 52, 5, 3);
  ctx.fill();

  ctx.fillStyle = "#253D2C";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Schedule message", modalX + modalW / 2, modalY + 46);
  ctx.fillStyle = "rgba(37,61,44,0.55)";
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillText(
    "Send when it's the right moment.",
    modalX + modalW / 2,
    modalY + 76,
  );

  const days = ["Today", "Tomorrow", "Custom"];
  const chipY = modalY + 110;
  const chipH = 44;
  const chipW = (modalW - 80) / 3;
  const sceneT = t - SCHEDULE_PICKER.start;
  const selectedDay = sceneT > 0.9 ? 1 : 0;
  for (let i = 0; i < days.length; i++) {
    const cx = modalX + 28 + i * (chipW + 12);
    const isSelected = i === selectedDay;
    if (isSelected) {
      ctx.fillStyle = "#2E6F40";
      roundRect(ctx, cx, chipY, chipW, chipH, 22);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
    } else {
      ctx.fillStyle = "rgba(207,255,220,0.55)";
      roundRect(ctx, cx, chipY, chipW, chipH, 22);
      ctx.fill();
      ctx.strokeStyle = "rgba(46,111,64,0.25)";
      ctx.lineWidth = 1;
      roundRect(ctx, cx, chipY, chipW, chipH, 22);
      ctx.stroke();
      ctx.fillStyle = "#253D2C";
    }
    ctx.font = "600 15px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(days[i]!, cx + chipW / 2, chipY + chipH / 2);
  }

  // tap on Tomorrow chip
  if (sceneT >= 0.6 && sceneT < 1.4) {
    const cx = modalX + 28 + 1 * (chipW + 12) + chipW / 2;
    drawTouchIndicator(ctx, cx, chipY + chipH / 2, t, SCHEDULE_PICKER.start + 0.6, 0.7);
  }

  // time wheels
  const wheelY = modalY + 190;
  const wheelH = 200;
  const wheelW = 100;
  const gap = 14;
  const wheelTotalW = wheelW * 3 + gap * 2 + 24;
  const wheelStartX = modalX + (modalW - wheelTotalW) / 2;

  const hourScroll = Math.min(sceneT, 1.6) * 28;
  const minScroll = Math.min(Math.max(sceneT - 0.5, 0), 1.4) * 30;
  drawTimeWheel(ctx, wheelStartX, wheelY, wheelW, wheelH, "8", "9", "10", hourScroll);
  ctx.fillStyle = "#253D2C";
  ctx.font = "700 36px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(":", wheelStartX + wheelW + gap / 2 + 6, wheelY + wheelH / 2);
  drawTimeWheel(
    ctx,
    wheelStartX + wheelW + gap + 12,
    wheelY,
    wheelW,
    wheelH,
    "55",
    "00",
    "05",
    minScroll,
  );
  drawTimeWheel(
    ctx,
    wheelStartX + wheelW * 2 + gap * 2 + 12,
    wheelY,
    wheelW,
    wheelH,
    "PM",
    "AM",
    "PM",
    0,
  );

  ctx.fillStyle = "#2E6F40";
  ctx.font = "600 16px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Sends Tomorrow · 9:00 AM",
    modalX + modalW / 2,
    wheelY + wheelH + 30,
  );

  // Schedule button
  const btnW = modalW - 60;
  const btnH = 56;
  const btnX = modalX + 30;
  const btnY = modalY + modalH - btnH - 30;
  const tapStart = SCHEDULE_PICKER.end - 0.5;
  const tapL = clamp01((t - tapStart) / 0.3);

  ctx.fillStyle = `rgba(46,111,64,${1 - tapL * 0.18})`;
  roundRect(ctx, btnX, btnY, btnW, btnH, 28);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 17px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Schedule message", btnX + btnW / 2, btnY + btnH / 2);

  if (tapL > 0) {
    drawTouchIndicator(
      ctx,
      btnX + btnW / 2,
      btnY + btnH / 2,
      t,
      tapStart,
      0.5,
    );
  }

  ctx.restore();
}

function drawScheduledBubble(ctx: CanvasRenderingContext2D, t: number) {
  if (t < SCHEDULED_PILL.start - 0.05 || t > HEADER_MENU.end + 0.4) return;
  const inDur = 0.4;
  const inLocal = clamp01((t - SCHEDULED_PILL.start) / inDur);
  const fadeOut = 1 - clamp01((t - SETTINGS_TRANSITION.start) / 0.5);
  const visible = easeOut(inLocal) * fadeOut;
  if (visible <= 0) return;

  const bubbleW = 380;
  const bubbleH = 96;
  const bubbleX = SCREEN.x + SCREEN.w - bubbleW - 28;
  const finalY = SCREEN.y + SCREEN.h - INPUT_H - bubbleH - 26;
  const bubbleY = finalY + (1 - visible) * 16;

  ctx.save();
  ctx.globalAlpha = visible;

  ctx.fillStyle = "#CFFFDC";
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 22);
  ctx.fill();

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(46,111,64,0.55)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 22);
  ctx.stroke();
  ctx.restore();

  const iconX = bubbleX + 22;
  const iconY = bubbleY + 30;
  ctx.strokeStyle = "#2E6F40";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(iconX, iconY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(iconX, iconY);
  ctx.lineTo(iconX, iconY - 6);
  ctx.moveTo(iconX, iconY);
  ctx.lineTo(iconX + 5, iconY + 2);
  ctx.stroke();

  ctx.fillStyle = "#2E6F40";
  ctx.font = "700 11px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("SCHEDULED", iconX + 18, iconY);

  ctx.fillStyle = "#253D2C";
  ctx.font = "500 15px Inter, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("See you tomorrow at 9 ☀", bubbleX + 22, bubbleY + 64);

  ctx.fillStyle = "rgba(37,61,44,0.55)";
  ctx.font = "500 11px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Tomorrow 9:00 AM", bubbleX + bubbleW - 18, bubbleY + bubbleH - 12);

  ctx.restore();
}

const HEADER_MENU_ITEMS = [
  { label: "View contact", icon: "👤" },
  { label: "Search", icon: "🔍" },
  { label: "Mute notifications", icon: "🔕" },
  { label: "Disappearing messages", icon: "⏱" },
  { label: "Settings", icon: "⚙" },
];

function drawHeaderMenuDropdown(ctx: CanvasRenderingContext2D, t: number) {
  if (t < HEADER_MENU.start - 0.05 || t > HEADER_MENU.end + 0.3) return;
  const inDur = 0.22;
  const inLocal = clamp01((t - HEADER_MENU.start) / inDur);
  const outLocal = clamp01((t - (HEADER_MENU.end - 0.18)) / 0.18);
  const visible = easeOut(inLocal) * (1 - easeOut(outLocal));
  if (visible <= 0) return;

  const w = 290;
  const rowH = 44;
  const h = HEADER_MENU_ITEMS.length * rowH + 16;
  const x = SCREEN.x + SCREEN.w - w - 24;
  const y = HEADER_Y + 64;

  ctx.save();
  ctx.translate(x + w, y);
  ctx.scale(visible, visible);
  ctx.translate(-(x + w), -y);
  ctx.globalAlpha = visible;

  ctx.fillStyle = "rgba(15,26,31,0.28)";
  roundRect(ctx, x, y + 4, w, h, 18);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();

  const highlightStart = HEADER_MENU.end - 0.4;
  const highlightLocal = clamp01((t - highlightStart) / 0.28);

  for (let i = 0; i < HEADER_MENU_ITEMS.length; i++) {
    const item = HEADER_MENU_ITEMS[i]!;
    const ry = y + 8 + i * rowH;
    const isSettings = item.label === "Settings";
    const isHl = isSettings && highlightLocal > 0;

    if (isHl) {
      ctx.fillStyle = `rgba(46,111,64,${0.12 + highlightLocal * 0.12})`;
      roundRect(ctx, x + 6, ry, w - 12, rowH, 10);
      ctx.fill();
    }

    ctx.fillStyle = isHl ? "#2E6F40" : "#253D2C";
    ctx.font = "20px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.icon, x + 22, ry + rowH / 2);

    ctx.font = `${isHl ? "600" : "500"} 15px Inter, sans-serif`;
    ctx.fillText(item.label, x + 56, ry + rowH / 2);
  }

  if (highlightLocal > 0) {
    const idx = HEADER_MENU_ITEMS.findIndex((m) => m.label === "Settings");
    const ry = y + 8 + idx * rowH + rowH / 2;
    drawTouchIndicator(ctx, x + w - 50, ry, t, highlightStart, 0.4);
  }

  ctx.restore();
}

/* ───────────────── settings screen ───────────────── */

type ToggleId =
  | "readReceipts"
  | "screenshots"
  | "hidePreviews"
  | "inAppSounds"
  | "twoFactor";

interface ToggleTimeline {
  id: ToggleId;
  flipAt: number;
  initial: boolean;
}

const TOGGLE_TIMELINE: ToggleTimeline[] = [
  { id: "readReceipts", flipAt: 38.0, initial: false },
  { id: "screenshots", flipAt: 41.4, initial: false },
  { id: "hidePreviews", flipAt: 44.0, initial: false },
  { id: "inAppSounds", flipAt: 44.7, initial: true },
  { id: "twoFactor", flipAt: 47.4, initial: false },
];

function getToggleState(
  id: ToggleId,
  t: number,
): { value: boolean; anim: number } {
  const entry = TOGGLE_TIMELINE.find((x) => x.id === id);
  if (!entry) return { value: false, anim: 0 };
  const local = (t - entry.flipAt) / 0.32;
  if (local < 0) return { value: entry.initial, anim: 0 };
  if (local >= 1) return { value: !entry.initial, anim: 1 };
  return { value: !entry.initial, anim: easeOut(local) };
}

function drawToggle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: ToggleId,
  t: number,
) {
  const { value, anim } = getToggleState(id, t);
  const w = 52;
  const h = 30;
  const t01 = value ? anim : 1 - anim;
  const r = Math.round(192 + (46 - 192) * t01);
  const g = Math.round(199 + (111 - 199) * t01);
  const b = Math.round(206 + (64 - 206) * t01);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  roundRect(ctx, x, y, w, h, 15);
  ctx.fill();

  const startX = x + 4;
  const endX = x + w - h + 4;
  const knobX = startX + (endX - startX) * (value ? anim : 1 - anim);

  ctx.fillStyle = "rgba(15,26,31,0.18)";
  ctx.beginPath();
  ctx.arc(knobX + h / 2 - 4, y + h / 2 + 1.5, h / 2 - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(knobX + h / 2 - 4, y + h / 2, h / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSettingsRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  meta: string | undefined,
  toggle: ToggleId | undefined,
  t: number,
  rightArrow: boolean,
) {
  const h = 60;
  ctx.fillStyle = "rgba(37,61,44,0.06)";
  ctx.fillRect(x + 14, y + h - 1, w - 28, 1);

  ctx.fillStyle = "#253D2C";
  ctx.font = "500 17px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 18, y + h / 2);

  if (toggle) {
    drawToggle(ctx, x + w - 18 - 52, y + h / 2 - 15, toggle, t);
  } else if (meta) {
    ctx.fillStyle = "rgba(37,61,44,0.55)";
    ctx.font = "500 15px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(meta, x + w - (rightArrow ? 32 : 18), y + h / 2);
    if (rightArrow) {
      ctx.strokeStyle = "rgba(37,61,44,0.45)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x + w - 22, y + h / 2 - 6);
      ctx.lineTo(x + w - 14, y + h / 2);
      ctx.lineTo(x + w - 22, y + h / 2 + 6);
      ctx.stroke();
    }
  } else if (rightArrow) {
    ctx.strokeStyle = "rgba(37,61,44,0.45)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + w - 22, y + h / 2 - 6);
    ctx.lineTo(x + w - 14, y + h / 2);
    ctx.lineTo(x + w - 22, y + h / 2 + 6);
    ctx.stroke();
  }
}

function drawSettingsSectionHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
) {
  ctx.fillStyle = "#2E6F40";
  ctx.font = "700 11px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), x + 22, y + 18);
}

function drawProfileCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const h = 110;
  const ax = x + 24;
  const ay = y + h / 2;
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(ax + 32, ay, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("YOU", ax + 32, ay + 1);

  ctx.fillStyle = "#253D2C";
  ctx.font = "600 20px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("You", ax + 80, ay - 12);

  ctx.fillStyle = "rgba(37,61,44,0.55)";
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillText("Tap to edit profile, name, photo", ax + 80, ay + 14);

  // edit pencil
  const px = x + w - 36;
  const py = ay;
  ctx.strokeStyle = "rgba(46,111,64,0.7)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(px - 8, py + 8);
  ctx.lineTo(px + 6, py - 6);
  ctx.lineTo(px + 10, py - 2);
  ctx.lineTo(px - 4, py + 12);
  ctx.closePath();
  ctx.stroke();
}

function drawStorageBars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  t: number,
) {
  const segments = [
    { label: "Photos", value: 1.2, color: "#2E6F40" },
    { label: "Videos", value: 3.1, color: "#68BA7F" },
    { label: "Voice", value: 0.4, color: "#A3D9B1" },
    { label: "Docs", value: 0.5, color: "#CFFFDC" },
    { label: "Other", value: 0.6, color: "rgba(46,111,64,0.35)" },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);
  const cleanLocal = clamp01((t - 42.4) / 0.8);
  const cleaned = clamp01((t - 43.2) / 0.4);

  ctx.fillStyle = "#253D2C";
  ctx.font = "600 15px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Storage usage", x + 18, y + 18);

  ctx.fillStyle = "rgba(37,61,44,0.6)";
  ctx.font = "500 13px Inter, sans-serif";
  ctx.textAlign = "right";
  const remaining = (total - cleaned * 5.2).toFixed(1);
  ctx.fillText(`${remaining} GB used`, x + w - 18, y + 18);

  // stacked bar
  const barY = y + 40;
  const barH = 12;
  ctx.fillStyle = "rgba(37,61,44,0.06)";
  roundRect(ctx, x + 18, barY, w - 36, barH, 6);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 18, barY, w - 36, barH, 6);
  ctx.clip();
  let cursor = x + 18;
  const maxW = w - 36;
  for (const seg of segments) {
    const segW = (seg.value / total) * maxW * (1 - cleaned * 0.7);
    ctx.fillStyle = seg.color;
    ctx.fillRect(cursor, barY, segW, barH);
    cursor += segW;
  }
  ctx.restore();

  // legend
  let lx = x + 18;
  const ly = y + 64;
  ctx.font = "500 11px Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const seg of segments) {
    ctx.fillStyle = seg.color;
    ctx.beginPath();
    ctx.arc(lx + 4, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(37,61,44,0.65)";
    ctx.fillText(seg.label, lx + 14, ly);
    lx += ctx.measureText(seg.label).width + 32;
  }

  // cleanup button / progress
  const btnY = y + 84;
  const btnH = 42;
  if (cleaned >= 1) {
    ctx.fillStyle = "rgba(46,111,64,0.12)";
    roundRect(ctx, x + 18, btnY, w - 36, btnH, 21);
    ctx.fill();
    ctx.fillStyle = "#2E6F40";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✓  Cleaned 5.2 GB of cache", x + w / 2, btnY + btnH / 2);
  } else if (cleanLocal > 0) {
    ctx.fillStyle = "rgba(46,111,64,0.18)";
    roundRect(ctx, x + 18, btnY, w - 36, btnH, 21);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x + 18, btnY, w - 36, btnH, 21);
    ctx.clip();
    ctx.fillStyle = "#2E6F40";
    ctx.fillRect(x + 18, btnY, (w - 36) * cleanLocal, btnH);
    ctx.restore();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `Cleaning… ${Math.round(cleanLocal * 100)}%`,
      x + w / 2,
      btnY + btnH / 2,
    );
  } else {
    ctx.fillStyle = "#2E6F40";
    roundRect(ctx, x + 18, btnY, w - 36, btnH, 21);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Clean up cache", x + w / 2, btnY + btnH / 2);
  }
}

function drawDevicesList(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const devices = [
    { label: "iPhone 15 · This device", sub: "Online now", icon: "📱", active: true },
    { label: "iPad Pro", sub: "Active 2h ago", icon: "💻", active: false },
  ];
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i]!;
    const dy = y + i * 60;
    if (i > 0) {
      ctx.fillStyle = "rgba(37,61,44,0.06)";
      ctx.fillRect(x + 18, dy, w - 36, 1);
    }
    ctx.fillStyle = "#253D2C";
    ctx.font = "20px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(d.icon, x + 28, dy + 30);

    ctx.fillStyle = "#253D2C";
    ctx.font = "500 15px Inter, sans-serif";
    ctx.fillText(d.label, x + 60, dy + 22);

    ctx.fillStyle = d.active ? "#2E6F40" : "rgba(37,61,44,0.55)";
    ctx.font = "500 12px Inter, sans-serif";
    ctx.fillText(d.sub, x + 60, dy + 42);

    if (d.active) {
      ctx.fillStyle = "#2E6F40";
      ctx.beginPath();
      ctx.arc(x + 60 - 8, dy + 42, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

type SettingsBlock = {
  kind: "profile" | "section" | "row" | "storage" | "devices" | "about" | "spacer";
  height: number;
  data?: any;
  yTop?: number;
};

function getSettingsBlocks(t: number): SettingsBlock[] {
  return [
    { kind: "spacer", height: 16 },
    { kind: "profile", height: 110 },
    { kind: "spacer", height: 18 },
    { kind: "section", height: 30, data: "Privacy" },
    { kind: "row", height: 60, data: { label: "Read receipts", toggle: "readReceipts" } },
    {
      kind: "row",
      height: 60,
      data: {
        label: "Disappearing messages",
        meta: t > 39.4 ? "24 hours" : "Off",
        arrow: true,
      },
    },
    {
      kind: "row",
      height: 60,
      data: {
        label: "Auto-delete media",
        meta: t > 40.6 ? "7 days" : "Off",
        arrow: true,
      },
    },
    { kind: "row", height: 60, data: { label: "Block screenshots", toggle: "screenshots" } },
    { kind: "spacer", height: 18 },
    { kind: "section", height: 30, data: "Storage" },
    { kind: "storage", height: 140 },
    { kind: "spacer", height: 18 },
    { kind: "section", height: 30, data: "Notifications" },
    { kind: "row", height: 60, data: { label: "Hide message previews", toggle: "hidePreviews" } },
    { kind: "row", height: 60, data: { label: "In-app sounds", toggle: "inAppSounds" } },
    { kind: "spacer", height: 18 },
    { kind: "section", height: 30, data: "Account" },
    { kind: "devices", height: 130 },
    { kind: "row", height: 60, data: { label: "Two-factor authentication", toggle: "twoFactor" } },
    { kind: "spacer", height: 18 },
    { kind: "section", height: 30, data: "Backup" },
    {
      kind: "row",
      height: 60,
      data: {
        label: "Encrypted backup",
        meta: t > 48.6 ? "Just now" : "Daily",
        arrow: true,
      },
    },
    { kind: "spacer", height: 18 },
    { kind: "section", height: 30, data: "About" },
    { kind: "about", height: 80 },
    { kind: "spacer", height: 24 },
  ];
}

function getSettingsScroll(t: number): number {
  const stops: Array<[number, number]> = [
    [36.4, 0],
    [38.0, 0],
    [40.0, 90],
    [41.5, 200],
    [43.0, 320],
    [44.0, 440],
    [45.5, 560],
    [47.0, 680],
    [48.0, 780],
    [49.0, 880],
    [50.0, 940],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (t >= a[0] && t <= b[0]) {
      const local = clamp01((t - a[0]) / (b[0] - a[0]));
      return a[1] + (b[1] - a[1]) * easeInOut(local);
    }
  }
  if (t < stops[0]![0]) return stops[0]![1];
  return stops[stops.length - 1]![1];
}

function drawSettingsTouches(
  ctx: CanvasRenderingContext2D,
  t: number,
  blocks: SettingsBlock[],
) {
  const tapEvents: Array<{ at: number; targetLabel: string; xOffset?: number }> = [
    { at: 38.0, targetLabel: "Read receipts", xOffset: -40 },
    { at: 39.2, targetLabel: "Disappearing messages", xOffset: -40 },
    { at: 40.4, targetLabel: "Auto-delete media", xOffset: -40 },
    { at: 41.4, targetLabel: "Block screenshots", xOffset: -40 },
    { at: 42.4, targetLabel: "Clean up cache" },
    { at: 44.0, targetLabel: "Hide message previews", xOffset: -40 },
    { at: 44.7, targetLabel: "In-app sounds", xOffset: -40 },
    { at: 47.4, targetLabel: "Two-factor authentication", xOffset: -40 },
    { at: 48.6, targetLabel: "Encrypted backup" },
  ];
  for (const e of tapEvents) {
    if (t < e.at - 0.05 || t > e.at + 1.0) continue;
    let foundY: number | null = null;
    let foundH = 60;
    for (const b of blocks) {
      const top = b.yTop!;
      if (b.kind === "row" && b.data?.label === e.targetLabel) {
        foundY = top;
        foundH = b.height;
        break;
      }
      if (b.kind === "storage" && e.targetLabel === "Clean up cache") {
        foundY = top + 84;
        foundH = 42;
        break;
      }
    }
    if (foundY === null) continue;
    const tapX = SCREEN.x + SCREEN.w + (e.xOffset ?? -120);
    const tapY = foundY + foundH / 2;
    drawTouchIndicator(ctx, tapX, tapY, t, e.at, 0.8);
  }
}

function drawSettingsBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#F4FBF1";
  ctx.fillRect(SCREEN.x, SCREEN.y + STATUS_H, SCREEN.w, SCREEN.h - STATUS_H);
}

function drawSettingsHeader(ctx: CanvasRenderingContext2D, _t: number) {
  ctx.fillStyle = "#2E6F40";
  ctx.fillRect(SCREEN.x, SCREEN.y + STATUS_H, SCREEN.w, HEADER_H);

  const g = ctx.createLinearGradient(
    0,
    SCREEN.y + STATUS_H,
    0,
    SCREEN.y + STATUS_H + HEADER_H,
  );
  g.addColorStop(0, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = g;
  ctx.fillRect(SCREEN.x, SCREEN.y + STATUS_H, SCREEN.w, HEADER_H);

  const ax = SCREEN.x + 32;
  const ay = SCREEN.y + STATUS_H + HEADER_H / 2 + 4;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(ax + 12, ay - 12);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + 12, ay + 12);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 26px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Settings", ax + 38, ay + 8);
}

function drawSettingsBody(ctx: CanvasRenderingContext2D, t: number) {
  const bodyTop = SCREEN.y + STATUS_H + HEADER_H;
  const bodyBottom = SCREEN.y + SCREEN.h;
  const x = SCREEN.x;
  const w = SCREEN.w;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, bodyTop, w, bodyBottom - bodyTop);
  ctx.clip();

  const scroll = getSettingsScroll(t);
  const blocks = getSettingsBlocks(t);

  // assign Y positions
  let y = bodyTop - scroll;
  for (const b of blocks) {
    b.yTop = y;
    y += b.height;
  }

  const cardX = x + 16;
  const cardW = w - 32;

  // draw card backgrounds for runs of groupable blocks
  let groupStart: number | null = null;
  let groupStartY = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const groupable =
      b.kind === "row" ||
      b.kind === "storage" ||
      b.kind === "devices" ||
      b.kind === "about" ||
      b.kind === "profile";
    if (groupable) {
      if (groupStart === null) {
        groupStart = i;
        groupStartY = b.yTop!;
      }
    } else if (groupStart !== null) {
      const last = blocks[i - 1]!;
      const total = last.yTop! + last.height - groupStartY;
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, cardX, groupStartY, cardW, total, 18);
      ctx.fill();
      groupStart = null;
    }
  }
  if (groupStart !== null) {
    const last = blocks[blocks.length - 1]!;
    const total = last.yTop! + last.height - groupStartY;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, cardX, groupStartY, cardW, total, 18);
    ctx.fill();
  }

  for (const b of blocks) {
    const by = b.yTop!;
    if (by + b.height < bodyTop || by > bodyBottom) continue;
    if (b.kind === "profile") {
      drawProfileCard(ctx, cardX, by, cardW);
    } else if (b.kind === "section") {
      drawSettingsSectionHeader(ctx, x, by, b.data);
    } else if (b.kind === "row") {
      drawSettingsRow(
        ctx,
        cardX,
        by,
        cardW,
        b.data.label,
        b.data.meta,
        b.data.toggle,
        t,
        !!b.data.arrow,
      );
    } else if (b.kind === "storage") {
      drawStorageBars(ctx, cardX, by, cardW, t);
    } else if (b.kind === "devices") {
      drawDevicesList(ctx, cardX, by, cardW);
    } else if (b.kind === "about") {
      ctx.fillStyle = "#253D2C";
      ctx.font = "600 15px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("VeilChat 2.4.0", cardX + 18, by + 24);
      ctx.fillStyle = "rgba(46,111,64,0.85)";
      ctx.font = "500 12px Inter, sans-serif";
      ctx.fillText(
        "✓  End-to-end encrypted by default",
        cardX + 18,
        by + 50,
      );
    }
  }

  drawSettingsTouches(ctx, t, blocks);

  // toasts
  if (t >= 43.5 && t <= 45.0) {
    drawToast(ctx, "Cleaned 5.2 GB of cache", t, 43.5, 1.4);
  }
  if (t >= 48.6 && t <= 50.0) {
    drawToast(ctx, "Backup synced · encrypted", t, 48.6, 1.4);
  }

  ctx.restore();
}

function drawSettingsScreen(ctx: CanvasRenderingContext2D, t: number) {
  drawSettingsBackground(ctx);
  drawSettingsHeader(ctx, t);
  drawSettingsBody(ctx, t);
}

// Soft "press-and-hold" indicator that lands on the m5 bubble before the
// long-press menu opens.
function drawLongPressHint(ctx: CanvasRenderingContext2D, t: number) {
  if (t < TOUCH_HINT.start - 0.05 || t > TOUCH_HINT.end + 0.2) return;
  if (!m5Bbox) return;
  const local = (t - TOUCH_HINT.start) / (TOUCH_HINT.end - TOUCH_HINT.start);
  const cx = m5Bbox.x + m5Bbox.w / 2;
  const cy = m5Bbox.y + m5Bbox.h / 2;
  // press-and-hold: a steady ring that fills, then releases into the menu
  ctx.save();
  ctx.globalAlpha = clamp01(1 - Math.max(0, local - 0.85) / 0.15);
  // soft hand glow under bubble
  const r = 36 + easeOut(clamp01(local * 1.4)) * 26;
  ctx.fillStyle = "rgba(46,111,64,0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fill();
  // arc that fills clockwise
  ctx.strokeStyle = "rgba(46,111,64,0.85)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(local));
  ctx.stroke();
  // central dot
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Unsend overlay: pixel particles flying out of the m5 bubble + toast pill
function drawUnsendOverlay(ctx: CanvasRenderingContext2D, t: number) {
  if (t < UNSEND_ACTION.start - 0.05 || t > UNSEND_ACTION.end + 0.4) return;
  if (m5Bbox) {
    drawUnsendParticles(
      ctx,
      m5Bbox.x,
      m5Bbox.y,
      m5Bbox.w,
      m5Bbox.h,
      t,
      UNSEND_ACTION.start,
    );
  }
  if (t >= UNSEND_ACTION.start + 0.2) {
    drawToast(ctx, "Message unsent", t, UNSEND_ACTION.start + 0.2, 1.4);
  }
}

// Schedule confirm toast — short pill above the input
function drawScheduleConfirmToast(ctx: CanvasRenderingContext2D, t: number) {
  if (t < SCHEDULED_PILL.start - 0.05 || t > SCHEDULED_PILL.start + 1.6) return;
  drawToast(ctx, "Scheduled · Tomorrow 9:00 AM", t, SCHEDULED_PILL.start, 1.4);
}

/* ───────────────────────── full frame ───────────────────────── */

function drawFrame(ctx: CanvasRenderingContext2D, t: number) {
  // background
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

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

  /* — auth scan — */
  drawAuthScan(ctx, t);

  /* — intro splash with key orbit — */
  if (t >= INTRO.start && t <= INTRO.end + 0.4) {
    const local = clamp01((t - INTRO.start) / 1.0);
    const fade = 1 - clamp01((t - INTRO.end + 0.3) / 0.5);
    if (fade > 0) {
      const cx = VIDEO_W / 2;
      const cy = VIDEO_H / 2 - 70;

      // key orbit (behind the logo)
      drawKeyOrbit(ctx, cx, cy, 200, t - INTRO.start, fade * 0.95);

      ctx.save();
      ctx.globalAlpha = fade;
      const scale = 0.6 + easeOut(local) * 0.4;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      drawLogoMark(ctx, cx, cy, 200, true);
      ctx.restore();

      // wordmark + tagline
      const wordAlpha = clamp01((t - INTRO.start - 0.7) / 0.5) * fade;
      if (wordAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = wordAlpha;
        ctx.fillStyle = "#253D2C";
        ctx.font = "italic 600 64px 'Fraunces', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("VeilChat", VIDEO_W / 2, VIDEO_H / 2 + 90);

        ctx.fillStyle = "#3C5A47";
        ctx.font = "500 24px Inter, sans-serif";
        ctx.fillText(
          "A vault for your conversations.",
          VIDEO_W / 2,
          VIDEO_H / 2 + 140,
        );
        ctx.restore();
      }
    }
  }

  /* — phone + chat + settings — */
  if (t >= PHONE_IN.start && t <= OUTRO.start + 0.6) {
    const rise = clamp01((t - PHONE_IN.start) / 0.7);
    const fadeOut = 1 - clamp01((t - OUTRO.start) / 0.5);
    const alpha = easeOut(rise) * fadeOut;
    const ty = (1 - easeOut(rise)) * 100;

    // Compute chat ↔ settings slide offsets
    let chatX = 0;
    let settingsX = SCREEN.w;
    let drawChat = true;
    let drawSettings = false;

    if (t >= SETTINGS_TRANSITION.start && t < SETTINGS_TRANSITION.end) {
      const range = SETTINGS_TRANSITION.end - SETTINGS_TRANSITION.start;
      const p = easeInOut(clamp01((t - SETTINGS_TRANSITION.start) / range));
      chatX = -SCREEN.w * p;
      settingsX = SCREEN.w * (1 - p);
      drawSettings = true;
    } else if (t >= SETTINGS_TRANSITION.end && t < SETTINGS_BACK.start) {
      drawChat = false;
      settingsX = 0;
      drawSettings = true;
    } else if (t >= SETTINGS_BACK.start && t < SETTINGS_BACK.end) {
      const range = SETTINGS_BACK.end - SETTINGS_BACK.start;
      const p = easeInOut(clamp01((t - SETTINGS_BACK.start) / range));
      settingsX = SCREEN.w * p;
      chatX = -SCREEN.w * (1 - p);
      drawSettings = true;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, ty);
    drawPhoneBody(ctx);
    drawNotch(ctx);
    drawStatusBar(ctx, t);

    // Clip everything inside the screen so slide transitions look clean
    ctx.save();
    ctx.beginPath();
    ctx.rect(SCREEN.x, SCREEN.y + STATUS_H, SCREEN.w, SCREEN.h - STATUS_H);
    ctx.clip();

    if (drawChat) {
      ctx.save();
      ctx.translate(chatX, 0);
      drawHeader(ctx, t);
      drawConversation(ctx, t);
      drawScheduledBubble(ctx, t);
      drawInputBar(ctx, t);
      // Chat-only overlays (only when chat is the focal scene)
      if (chatX === 0) {
        // Dim the background while modal-style overlays are open
        if (
          (t >= LONG_PRESS.start && t < LONG_PRESS.end + 0.3) ||
          (t >= ATTACHMENT_MENU.start && t < ATTACHMENT_MENU.end + 0.2) ||
          (t >= SCHEDULE_PICKER.start && t < SCHEDULE_PICKER.end + 0.2) ||
          (t >= HEADER_MENU.start && t < HEADER_MENU.end + 0.2)
        ) {
          drawChatDim(ctx, t);
        }
        drawLongPressHint(ctx, t);
        drawLongPressMenu(ctx, t);
        drawUnsendOverlay(ctx, t);
        drawAttachmentMenu(ctx, t);
        drawSchedulePicker(ctx, t);
        drawScheduleConfirmToast(ctx, t);
        drawHeaderMenuDropdown(ctx, t);
      }
      ctx.restore();
    }

    if (drawSettings) {
      ctx.save();
      ctx.translate(settingsX, 0);
      drawSettingsScreen(ctx, t);
      ctx.restore();
    }

    ctx.restore(); // screen clip
    ctx.restore();
  }

  /* — outro particles always behind outro card — */
  drawOutroParticles(ctx, t);

  /* — outro card — */
  if (t >= OUTRO.start - 0.2) {
    const fade = clamp01((t - OUTRO.start + 0.2) / 0.6);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(252,245,235,0.96)";
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

    // particles in front of bg overlay too
    drawOutroParticles(ctx, t);

    const zoomLocal = clamp01((t - OUTRO.start) / (OUTRO.end - OUTRO.start));
    const scale = 1 + easeInOut(zoomLocal) * 0.06;
    const cx = VIDEO_W / 2;
    const cy = VIDEO_H / 2 - 160;

    // soft orbit behind the outro logo too (slower)
    drawKeyOrbit(ctx, cx, cy, 220, (t - OUTRO.start) * 0.4, 0.45 * fade);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    drawLogoMark(ctx, cx, cy, 180, true);
    ctx.restore();

    ctx.fillStyle = "#253D2C";
    ctx.font = "italic 600 72px 'Fraunces', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Message privately.", VIDEO_W / 2, VIDEO_H / 2 - 10);
    ctx.fillText("Vanish completely.", VIDEO_W / 2, VIDEO_H / 2 + 80);

    ctx.fillStyle = "#3C5A47";
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillText(
      "VeilChat · End-to-end encrypted",
      VIDEO_W / 2,
      VIDEO_H / 2 + 160,
    );

    // CTA pill
    const pillW = 380;
    const pillH = 88;
    const px = (VIDEO_W - pillW) / 2;
    const py = VIDEO_H / 2 + 230;
    const pillScale = 0.96 + Math.sin(t * 4) * 0.02;
    ctx.save();
    ctx.translate(VIDEO_W / 2, py + pillH / 2);
    ctx.scale(pillScale, pillScale);
    ctx.translate(-VIDEO_W / 2, -(py + pillH / 2));
    ctx.fillStyle = "#2E6F40";
    ctx.shadowColor = "rgba(46,111,64,0.4)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, px, py, pillW, pillH, 44);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 28px Inter, sans-serif";
    ctx.fillText(
      "Open the vault — it's free",
      VIDEO_W / 2,
      py + pillH / 2 + 2,
    );

    ctx.fillStyle = "rgba(60,90,71,0.7)";
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("veilchat.app", VIDEO_W / 2, py + pillH + 56);

    ctx.restore();
  }
}

/* ───────────────────────── audio engine ───────────────────────── */

type AnyAudioContext = AudioContext & { state: AudioContextState };

class AudioEngine {
  ctx: AnyAudioContext;
  master: GainNode;
  dest: MediaStreamAudioDestinationNode;
  scheduled: Array<{ stop: () => void }> = [];

  constructor() {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctor() as AnyAudioContext;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.dest = this.ctx.createMediaStreamDestination();
    this.master.connect(this.ctx.destination);
    this.master.connect(this.dest);
  }

  async resume() {
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  stopAll() {
    for (const s of this.scheduled) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.scheduled = [];
  }

  envOsc(
    type: OscillatorType,
    freq: number | ((osc: OscillatorNode, t: number) => void),
    when: number,
    duration: number,
    peak: number,
    attack = 0.01,
  ) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    if (typeof freq === "number") {
      osc.frequency.setValueAtTime(freq, when);
    } else {
      freq(osc, when);
    }
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
    this.scheduled.push({
      stop: () => {
        try {
          osc.stop();
        } catch {
          /* ignore */
        }
      },
    });
  }

  playReceive(when: number) {
    [880, 1320].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.07, 0.32, 0.18, 0.005),
    );
  }

  playSend(when: number) {
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(560, t);
        osc.frequency.exponentialRampToValueAtTime(1180, t + 0.13);
      },
      when,
      0.2,
      0.22,
      0.005,
    );
  }

  playLockClick(when: number) {
    // metallic click — sharp square + short noise-like decay
    this.envOsc("square", 1700, when, 0.04, 0.18, 0.001);
    this.envOsc("triangle", 800, when + 0.005, 0.08, 0.12, 0.002);
  }

  playTick(when: number) {
    this.envOsc("triangle", 1500, when, 0.05, 0.07, 0.002);
  }

  playTypeClick(when: number) {
    this.envOsc("square", 1100, when, 0.025, 0.04, 0.001);
  }

  playReaction(when: number) {
    [880, 1100, 1320].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.04, 0.2, 0.16, 0.005),
    );
  }

  playOutroChime(when: number) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.1, 1.5, 0.18, 0.025),
    );
  }

  playAuthSweep(when: number) {
    // rising filtered tone — auth scan
    this.envOsc(
      "sawtooth",
      (osc, t) => {
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.6);
      },
      when,
      0.65,
      0.06,
      0.05,
    );
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(1320, t + 0.6);
      },
      when,
      0.65,
      0.05,
      0.05,
    );
  }

  playAuthConfirm(when: number) {
    // ascending bright chime when scan completes
    [659.25, 987.77].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.08, 0.5, 0.18, 0.01),
    );
  }

  playShimmer(when: number) {
    // gentle filtered sweep accompanying the shimmer wave
    this.envOsc(
      "triangle",
      (osc, t) => {
        osc.frequency.setValueAtTime(2200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.35);
      },
      when,
      0.4,
      0.07,
      0.005,
    );
  }

  playHeartbeat(when: number) {
    // two low pulses — secure connection feel
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      },
      when,
      0.2,
      0.32,
      0.01,
    );
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
      },
      when + 0.28,
      0.2,
      0.28,
      0.01,
    );
  }

  playSparkle(when: number) {
    [1760, 2349.32].forEach((f, i) =>
      this.envOsc("triangle", f, when + i * 0.03, 0.25, 0.1, 0.004),
    );
  }

  playPhotoBurn(when: number, duration: number) {
    // Crackling fire-like sweep: low rumble down + high sparkle bursts +
    // a final whoosh as the photo collapses.
    this.envOsc(
      "sawtooth",
      (osc, t) => {
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + duration);
      },
      when,
      duration,
      0.07,
      0.05,
    );
    // sparkle bursts spread across the burn duration
    const burstCount = 8;
    for (let i = 0; i < burstCount; i++) {
      const offset = (i / burstCount) * duration;
      const freq = 1500 + ((i * 173) % 800);
      this.envOsc(
        "triangle",
        freq,
        when + offset,
        0.12,
        0.05,
        0.005,
      );
    }
    // closing whoosh as the bubble collapses
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      },
      when + duration - 0.05,
      0.45,
      0.1,
      0.02,
    );
  }

  playAmbientPad(start: number, end: number) {
    const notes = [261.63, 329.63, 392.0, 196.0]; // C major + low octave
    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 3 ? "triangle" : "sine";
      osc.frequency.value = f;
      const peak = idx === 3 ? 0.018 : 0.024;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 1.4);
      gain.gain.setValueAtTime(peak, end - 1.6);
      gain.gain.linearRampToValueAtTime(0, end);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.16 + idx * 0.04;
      lfoGain.gain.value = 0.6;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(start);
      lfo.stop(end + 0.1);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(end + 0.1);

      this.scheduled.push({
        stop: () => {
          try {
            osc.stop();
            lfo.stop();
          } catch {
            /* ignore */
          }
        },
      });
    });
  }
}

function scheduleTimelineAudio(engine: AudioEngine, audioStart: number) {
  // ambient pad through the whole piece
  engine.playAmbientPad(audioStart + 0.0, audioStart + DURATION_SEC - 0.2);

  // auth scan
  engine.playAuthSweep(audioStart + AUTH_SCAN.start + 0.05);
  engine.playAuthConfirm(audioStart + AUTH_SCAN.start + 0.78);

  // intro logo shimmer
  engine.playReaction(audioStart + INTRO.start + 0.2);
  engine.playSparkle(audioStart + INTRO.start + 0.6);

  // phone whoosh
  engine.envOsc(
    "sine",
    (osc, t) => {
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    },
    audioStart + PHONE_IN.start,
    0.55,
    0.18,
    0.05,
  );

  // typing clicks
  for (const e of EVENTS) {
    if (e.kind !== "typing") continue;
    const dur = e.end - e.start;
    const count = Math.max(5, Math.floor(dur / 0.15));
    for (let i = 0; i < count; i++) {
      const when =
        audioStart + e.start + (i / count) * dur + Math.random() * 0.04;
      engine.playTypeClick(when);
    }
  }

  // message arrivals + their associated effects
  for (const e of EVENTS) {
    if (e.kind !== "message") continue;
    if (e.side === "in") {
      // Photo bubbles use the unlock + burn sounds rather than the
      // generic shimmer, but still get a soft receive ding on arrival.
      if (e.variant !== "photo") {
        engine.playShimmer(audioStart + e.at - 0.05);
      }
      engine.playReceive(audioStart + e.at);
    } else {
      engine.playSend(audioStart + e.at);
      engine.playShimmer(audioStart + e.at + 0.02);
      engine.playLockClick(audioStart + e.at + 0.32); // seal closes
    }
  }

  // self-destructing photo: unlock click + scan-line shimmer, then burn sweep
  for (const e of EVENTS) {
    if (e.kind !== "message" || e.variant !== "photo") continue;
    if (e.unlockAt !== undefined) {
      engine.playLockClick(audioStart + e.unlockAt);
      engine.playShimmer(audioStart + e.unlockAt + 0.05);
    }
    if (e.burnAt !== undefined) {
      engine.playPhotoBurn(audioStart + e.burnAt, e.burnDuration ?? 1);
    }
  }

  // tick clicks
  for (const e of EVENTS) {
    if (e.kind === "tick") engine.playTick(audioStart + e.at);
  }

  // reactions
  for (const e of EVENTS) {
    if (e.kind === "reaction") engine.playReaction(audioStart + e.at);
  }

  // encryption highlight: heartbeat pulses + low chime
  engine.playHeartbeat(audioStart + ENCRYPTION_HIGHLIGHT.start + 0.2);
  engine.playHeartbeat(audioStart + ENCRYPTION_HIGHLIGHT.start + 1.2);
  engine.envOsc(
    "sine",
    1320,
    audioStart + ENCRYPTION_HIGHLIGHT.start + 0.4,
    0.45,
    0.13,
    0.04,
  );

  // screenshot blocked alert tone
  engine.envOsc(
    "triangle",
    (osc, t) => {
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.18);
    },
    audioStart + SCREENSHOT_BANNER.start + 0.05,
    0.25,
    0.16,
    0.005,
  );

  // ── product-tour cues ──────────────────────────────────────────
  // press-and-hold ramp under the ring fill
  engine.envOsc(
    "sine",
    (osc, t0) => {
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.9);
    },
    audioStart + TOUCH_HINT.start + 0.05,
    0.95,
    0.06,
    0.02,
  );
  // long-press menu pop
  engine.envOsc("triangle", 720, audioStart + LONG_PRESS.start, 0.12, 0.18, 0.003);
  engine.envOsc("sine", 360, audioStart + LONG_PRESS.start + 0.02, 0.18, 0.12, 0.005);
  // tap on the "Unsend" row (just before the unsend animation kicks)
  engine.playTick(audioStart + UNSEND_ACTION.start - 0.05);
  // unsend swoosh: pixel-dust scatter
  engine.envOsc(
    "sine",
    (osc, t0) => {
      osc.frequency.setValueAtTime(900, t0);
      osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.55);
    },
    audioStart + UNSEND_ACTION.start,
    0.6,
    0.16,
    0.01,
  );
  engine.playSparkle(audioStart + UNSEND_ACTION.start + 0.05);

  // hint touch on attachment "+" button
  engine.playTick(audioStart + COMPOSE_HINT.start + 0.4);
  // attachment menu slide-up pop
  engine.envOsc("sine", 280, audioStart + ATTACHMENT_MENU.start, 0.22, 0.16, 0.01);
  engine.envOsc("triangle", 640, audioStart + ATTACHMENT_MENU.start + 0.02, 0.14, 0.12, 0.003);
  // tap on Schedule chip
  engine.playTick(audioStart + ATTACHMENT_MENU.start + 0.9);
  // schedule modal whoosh
  engine.envOsc(
    "sine",
    (osc, t0) => {
      osc.frequency.setValueAtTime(160, t0);
      osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.45);
    },
    audioStart + SCHEDULE_PICKER.start,
    0.5,
    0.16,
    0.04,
  );
  // soft wheel/chip ticks while scrubbing the picker
  for (let i = 0; i < 5; i++) {
    engine.playTypeClick(audioStart + SCHEDULE_PICKER.start + 0.55 + i * 0.18);
  }
  // schedule confirm chime
  engine.envOsc("sine", 880, audioStart + SCHEDULED_PILL.start, 0.18, 0.16, 0.01);
  engine.envOsc("sine", 1320, audioStart + SCHEDULED_PILL.start + 0.06, 0.32, 0.13, 0.02);
  engine.playSparkle(audioStart + SCHEDULED_PILL.start + 0.04);

  // header 3-dot menu pop, then tap on Settings row
  engine.envOsc("triangle", 760, audioStart + HEADER_MENU.start, 0.1, 0.15, 0.003);
  engine.envOsc("sine", 380, audioStart + HEADER_MENU.start + 0.02, 0.16, 0.1, 0.005);
  engine.playTick(audioStart + HEADER_MENU.start + 0.7);

  // settings whoosh: chat slides off, settings slides in
  engine.envOsc(
    "sine",
    (osc, t0) => {
      osc.frequency.setValueAtTime(140, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.6);
    },
    audioStart + SETTINGS_TRANSITION.start,
    0.7,
    0.16,
    0.05,
  );

  // toggle clicks at the toggle keyframes (matches drawSettings interactions)
  for (const tt of TOGGLE_TIMELINE) {
    const next = !tt.initial;
    engine.envOsc("square", 1500, audioStart + tt.flipAt, 0.04, 0.18, 0.001);
    engine.envOsc(
      "triangle",
      next ? 1100 : 700,
      audioStart + tt.flipAt + 0.01,
      0.06,
      0.12,
      0.002,
    );
  }
  // storage cleanup ding when the bar progress completes
  engine.envOsc("sine", 980, audioStart + 43.6, 0.18, 0.16, 0.02);
  engine.envOsc("sine", 1320, audioStart + 43.7, 0.32, 0.13, 0.02);
  engine.playSparkle(audioStart + 43.65);

  // settings-back whoosh
  engine.envOsc(
    "sine",
    (osc, t0) => {
      osc.frequency.setValueAtTime(420, t0);
      osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.6);
    },
    audioStart + SETTINGS_BACK.start,
    0.7,
    0.14,
    0.05,
  );

  // outro chime + sparkles
  engine.playOutroChime(audioStart + OUTRO.start + 0.3);
  for (let i = 0; i < 4; i++) {
    engine.playSparkle(audioStart + OUTRO.start + 0.6 + i * 0.7);
  }
}

/* ───────────────────────── recorder format ───────────────────────── */

type SupportedRecording = { mimeType: string; ext: "mp4" | "webm" };

function pickRecordingFormat(): SupportedRecording | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: SupportedRecording[] = [
    { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
    { mimeType: "video/mp4;codecs=avc1", ext: "mp4" },
    { mimeType: "video/mp4", ext: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", ext: "webm" },
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
  const audioRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [download, setDownload] = useState<{
    url: string;
    ext: "mp4" | "webm";
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, INTRO.start + 0.4);
  }, []);

  useEffect(() => {
    setSupported(pickRecordingFormat() !== null);
  }, []);

  useEffect(() => {
    return () => {
      if (download?.url) URL.revokeObjectURL(download.url);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.stopAll();
    };
  }, [download]);

  const ensureAudio = useCallback(async (): Promise<AudioEngine | null> => {
    try {
      if (!audioRef.current) audioRef.current = new AudioEngine();
      await audioRef.current.resume();
      audioRef.current.master.gain.value = muted ? 0 : 0.9;
      return audioRef.current;
    } catch {
      return null;
    }
  }, [muted]);

  const runAnimation = useCallback((onDone: () => void) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      drawFrame(ctx, Math.min(t, DURATION_SEC));
      setProgress(clamp01(t / DURATION_SEC));
      if (t < DURATION_SEC) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(async () => {
    if (status === "playing" || status === "recording") return;
    if ("fonts" in document) {
      try {
        await (document as Document).fonts.ready;
      } catch {
        /* ignore */
      }
    }
    const audio = await ensureAudio();
    audio?.stopAll();
    if (audio) scheduleTimelineAudio(audio, audio.ctx.currentTime + 0.1);

    setStatus("playing");
    setErrorMsg(null);
    runAnimation(() => setStatus("idle"));
  }, [ensureAudio, runAnimation, status]);

  const recordAndDownload = useCallback(async () => {
    if (status === "recording") return;
    const c = canvasRef.current;
    if (!c) return;

    const fmt = pickRecordingFormat();
    if (!fmt) {
      setErrorMsg(
        "Your browser doesn't support video recording. Try the latest Chrome, Edge, Safari, or Firefox.",
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

    const audio = await ensureAudio();
    if (!audio) {
      setErrorMsg("Couldn't initialise the audio engine.");
      setStatus("error");
      return;
    }

    const videoStream = (
      c as HTMLCanvasElement & {
        captureStream: (fps?: number) => MediaStream;
      }
    ).captureStream(FPS);

    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audio.dest.stream.getAudioTracks(),
    ]);

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combined, {
        mimeType: fmt.mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 128_000,
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

    audio.stopAll();
    scheduleTimelineAudio(audio, audio.ctx.currentTime + 0.1);
    recorder.start(200);
    runAnimation(() => {
      setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }, 220);
    });
  }, [download, ensureAudio, runAnimation, status]);

  const triggerDownload = useCallback(() => {
    if (!download) return;
    const a = document.createElement("a");
    a.href = download.url;
    a.download = `veilchat-intro.${download.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [download]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.master.gain.value = muted ? 0 : 0.9;
    }
  }, [muted]);

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
            New · Vault-grade intro · 25s with sound
          </div>
          <h2
            className="mt-5 text-[32px] sm:text-[42px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#253D2C]"
            style={{
              fontFamily: "'Fraunces', 'Inter', serif",
              fontWeight: 600,
            }}
          >
            A private exchange,{" "}
            <span className="italic" style={{ color: "#2E6F40" }}>
              sealed on screen.
            </span>
          </h2>
          <p className="mt-4 text-[16px] sm:text-[18px] text-[#3C5A47] max-w-2xl mx-auto leading-[1.55]">
            Watch a 60-second cinematic product tour of VeilChat —
            identity-scanned and vault-sealed, with voice on the wire,
            screenshots blocked, a self-destructing photo that burns
            into pixel-dust, notes that vanish in 24 hours, a long-press
            unsend, scheduled messages, and a guided walk through the
            settings panel.
            Generated fresh on your device with a custom soundtrack,
            ready to download as a real video file with sound.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Player */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div
              className="relative mx-auto rounded-[2rem] overflow-hidden border border-[#253D2C]/10 bg-[#0F1A1F] shadow-[0_40px_80px_-30px_rgba(17,27,33,0.45)]"
              style={{ maxWidth: 420 }}
              data-no-tap-scroll
            >
              <canvas
                ref={canvasRef}
                width={VIDEO_W}
                height={VIDEO_H}
                className="block w-full h-auto bg-[#FCF5EB]"
                style={{ aspectRatio: `${VIDEO_W} / ${VIDEO_H}` }}
                aria-label="VeilChat private-vault intro preview"
              />

              {/* mute toggle */}
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                data-no-tap-scroll
                className="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 text-white transition-colors backdrop-blur"
              >
                {muted ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>

              {/* progress bar */}
              <div className="absolute left-0 right-0 bottom-0 h-1 bg-white/10">
                <div
                  className="h-full bg-[#68BA7F] transition-[width] duration-100"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>

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

            {/* feature chips */}
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-[480px] mx-auto">
              {[
                "Identity scan",
                "Key orbit",
                "Vault sealing",
                "Encrypted shimmer",
                "Verified ✓",
                "Self-destructing photo",
                "Pixel-dust burn",
                "Disappearing notes",
                "Voice on the wire",
                "Screenshot blocked",
                "Heartbeat secure",
                "Long-press menu",
                "Unsend animation",
                "Attachment grid",
                "Schedule picker",
                "Scheduled bubble",
                "Settings tour",
                "Animated toggles",
                "Storage cleanup",
                "Linked devices",
                "Brand soundtrack",
              ].map((chip) => (
                <span
                  key={chip}
                  className="text-[11px] font-semibold uppercase tracking-wide text-[#2E6F40] bg-[#CFFFDC] border border-[#68BA7F]/40 rounded-full px-2.5 py-1"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <h3
              className="text-[22px] sm:text-[26px] font-semibold text-[#253D2C]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Yours to keep — sealed and signed.
            </h3>
            <p className="mt-2 text-[15px] sm:text-[16px] text-[#3C5A47] leading-relaxed">
              Every frame is rendered fresh on your device, so the file
              you download is brand-new — no servers, no watermarks. A
              cinematic 60-second product tour of privacy, ready for your reels,
              your pitch, or your own site.
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
                    Your intro is sealed and ready
                  </div>
                  <div className="text-[12px] text-[#3C5A47]">
                    veilchat-intro.{download.ext} · {DURATION_SEC}s ·
                    720×1280 · with sound
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

            <ul className="mt-7 space-y-2.5 text-[14px] text-[#3C5A47]">
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                Opens with an identity scan and orbiting encryption keys
                — pure trust theatre.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                Each outgoing message gets a real lock-and-seal animation
                with a soft metallic click.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                Disappearing-message countdown, voice-recording UI,
                read receipts and a verified ✓ on Maya.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                A "Screenshot blocked" alert flashes during the
                encryption highlight — privacy as a feature, not a promise.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                Custom soundtrack: warm pad, auth sweep, send/receive
                chimes, lock clicks, heartbeat, and outro arpeggio.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                720 × 1280 vertical, perfect for Reels, Shorts &amp;
                TikTok. MP4 where supported, WebM otherwise.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
