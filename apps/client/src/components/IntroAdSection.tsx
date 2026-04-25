import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cinematic VeilChat intro ad. Renders to a `<canvas>` with synced
 * Web Audio so it can be both *played* on the landing page and
 * *recorded* into a downloadable video file (with sound).
 *
 * Beat sheet (≈18s):
 *   0.0 – 2.6s  Brand splash: logo zooms in, "VeilChat" wordmark, tagline
 *   2.6 – 3.4s  Phone rises into view, header "online" pulse appears
 *   3.4 – 4.6s  Alex types (animated three-dot bubble + tick clicks)
 *   4.6s        Message 1 arrives with chime
 *   5.2 – 6.4s  User types in their input bar
 *   6.4s        Message 2 sent with pop
 *   6.4 – 7.1s  ✓ → ✓✓ → blue ✓✓ read-receipt animation
 *   7.2 – 8.3s  Alex types
 *   8.3s        Message 3 arrives
 *   8.9s        Heart reaction floats up onto Message 3
 *   9.4 – 10.5s User records, sends a voice note
 *  10.5 – 11.1s Voice note sent + read receipts update
 *  11.2 – 12.0s Alex types
 *  12.0s        Message 5 arrives
 *  12.6 – 14.0s Encryption badge pulses ("end-to-end encrypted")
 *  14.0 – 18.0s Outro: cross-fade to logo, wordmark, tagline, CTA pill
 */

const VIDEO_W = 720;
const VIDEO_H = 1280;
const FPS = 30;
const DURATION_SEC = 18;

/* ───────────────────────── timeline ───────────────────────── */

type Side = "in" | "out";
type Tick = "none" | "sent" | "delivered" | "read";

type MessageEvent = {
  kind: "message";
  id: string;
  side: Side;
  variant: "text" | "voice";
  text?: string;
  duration?: number; // for voice note (seconds)
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
  { kind: "typing", side: "in", start: 3.4, end: 4.6 },
  {
    kind: "message",
    id: "m1",
    side: "in",
    variant: "text",
    text: "Hey! 👋 are we still on for Saturday?",
    at: 4.6,
  },

  { kind: "typing", side: "out", start: 5.2, end: 6.4 },
  {
    kind: "message",
    id: "m2",
    side: "out",
    variant: "text",
    text: "Wouldn't miss it. 7pm at the place by the park?",
    at: 6.4,
  },
  { kind: "tick", id: "m2", stage: "sent", at: 6.45 },
  { kind: "tick", id: "m2", stage: "delivered", at: 6.75 },
  { kind: "tick", id: "m2", stage: "read", at: 7.05 },

  { kind: "typing", side: "in", start: 7.2, end: 8.3 },
  {
    kind: "message",
    id: "m3",
    side: "in",
    variant: "text",
    text: "Perfect. I'll bring the playlist. 🎶",
    at: 8.3,
  },
  { kind: "reaction", id: "m3", emoji: "❤", at: 8.9 },

  { kind: "typing", side: "out", start: 9.4, end: 10.5 },
  {
    kind: "message",
    id: "m4",
    side: "out",
    variant: "voice",
    duration: 8,
    at: 10.5,
  },
  { kind: "tick", id: "m4", stage: "sent", at: 10.55 },
  { kind: "tick", id: "m4", stage: "delivered", at: 10.75 },
  { kind: "tick", id: "m4", stage: "read", at: 11.05 },

  { kind: "typing", side: "in", start: 11.2, end: 12.0 },
  {
    kind: "message",
    id: "m5",
    side: "in",
    variant: "text",
    text: "Can't wait!",
    at: 12.0,
  },
];

const ENCRYPTION_HIGHLIGHT = { start: 12.6, end: 14.0 } as const;
const INTRO = { start: 0, end: 2.6 } as const;
const PHONE_IN = { start: 2.6, end: 3.4 } as const;
const OUTRO = { start: 14.0, end: 18.0 } as const;

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

  // subtle inner highlight
  ctx.save();
  const grd = ctx.createLinearGradient(x, y, x, y + size);
  grd.addColorStop(0, "rgba(255,255,255,0.18)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.restore();

  // V mark
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
  roundRect(ctx, x, y + h * 0.35, w, h * 0.65, size * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.35, w * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── phone shell + chrome ───────────────────────── */

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
  // outer frame
  ctx.save();
  ctx.shadowColor = "rgba(17,27,33,0.4)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 36;
  ctx.fillStyle = "#0F1A1F";
  roundRect(ctx, PHONE.x, PHONE.y, PHONE.w, PHONE.h, 76);
  ctx.fill();
  ctx.restore();

  // inner bezel highlight
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, PHONE.x + 2, PHONE.y + 2, PHONE.w - 4, PHONE.h - 4, 74);
  ctx.stroke();
  ctx.restore();

  // side button (mute switch)
  ctx.fillStyle = "#1A2A30";
  ctx.fillRect(PHONE.x - 3, PHONE.y + 130, 4, 40);
  ctx.fillRect(PHONE.x - 3, PHONE.y + 200, 4, 64);
  ctx.fillRect(PHONE.x - 3, PHONE.y + 280, 4, 64);
  ctx.fillRect(PHONE.x + PHONE.w - 1, PHONE.y + 180, 4, 100);

  // screen background
  ctx.save();
  roundRect(ctx, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, 64);
  ctx.clip();
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
  ctx.restore();
}

function drawNotch(ctx: CanvasRenderingContext2D) {
  // dynamic-island-style pill at the top of the screen
  const w = 200;
  const h = 32;
  const x = SCREEN.x + (SCREEN.w - w) / 2;
  const y = SCREEN.y + 14;
  ctx.save();
  ctx.fillStyle = "#0F1A1F";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  // tiny camera dot
  ctx.fillStyle = "#1A2A30";
  ctx.beginPath();
  ctx.arc(x + w - 14, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStatusBar(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "rgba(37,61,44,0.72)";
  ctx.font = "600 22px Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("9:41", SCREEN.x + 38, SCREEN.y + 30);

  // signal + battery indicators
  ctx.textAlign = "right";
  ctx.fillText("100%", SCREEN.x + SCREEN.w - 42, SCREEN.y + 30);

  // battery glyph
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
  // bg
  ctx.fillStyle = "#2E6F40";
  ctx.fillRect(SCREEN.x, HEADER_Y, SCREEN.w, HEADER_H);

  // back chevron
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

  // avatar
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

  // online dot with pulse
  const pulseR = 6 + Math.sin(t * 3.5) * 1.5;
  ctx.fillStyle = "rgba(104,186,127,0.45)";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, pulseR + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#68BA7F";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, 7.5, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2E6F40";
  ctx.stroke();
  ctx.fillStyle = "#68BA7F";
  ctx.beginPath();
  ctx.arc(avatarX + 22, avatarY + 22, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // title + subtitle
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 26px Inter, sans-serif";
  ctx.fillText("Alex Mendoza", avatarX + 46, avatarY - 4);

  // status — "online" or "typing…" depending on whether Alex is typing
  const alexTyping = isTypingAt(t, "in");
  ctx.fillStyle = "#CFFFDC";
  ctx.font = "500 18px Inter, sans-serif";
  ctx.fillText(
    alexTyping ? "typing…" : "online",
    avatarX + 46,
    avatarY + 22,
  );

  // call icons (right side)
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // video icon
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

  // phone icon
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

function drawInputBar(ctx: CanvasRenderingContext2D, t: number) {
  const barY = SCREEN.y + SCREEN.h - INPUT_H;
  ctx.fillStyle = "#FCF5EB";
  ctx.fillRect(SCREEN.x, barY, SCREEN.w, INPUT_H);

  // upward divider
  ctx.fillStyle = "rgba(37,61,44,0.08)";
  ctx.fillRect(SCREEN.x, barY, SCREEN.w, 1);

  // input pill
  const pad = 24;
  const pillX = SCREEN.x + pad + 6;
  const pillY = barY + 22;
  const pillW = SCREEN.w - pad * 2 - 80;
  const pillH = 56;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, pillX, pillY, pillW, pillH, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(37,61,44,0.12)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, pillX, pillY, pillW, pillH, 28);
  ctx.stroke();

  // emoji + plus icons inside the pill
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

  // typing simulation in the pill — show a draft text being typed when
  // the *user* (out side) is "typing"
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
    // truncate if too wide
    let display = visible;
    while (ctx.measureText(display).width > pillW - 80 && display.length > 4) {
      display = "…" + display.slice(-Math.floor(display.length * 0.8));
    }
    ctx.fillText(display, textX, textY + 1);

    // blinking caret
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
    ctx.fillText("Message", pillX + 60, pillY + pillH / 2 + 1);
  }

  // attachment / camera icon at right of pill
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

  // send / mic button on right
  const btnCx = SCREEN.x + SCREEN.w - 50;
  const btnCy = barY + INPUT_H / 2;
  ctx.fillStyle = "#2E6F40";
  ctx.beginPath();
  ctx.arc(btnCx, btnCy, 28, 0, Math.PI * 2);
  ctx.fill();

  // show send arrow when user is typing, else mic icon
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
  } else {
    // mic icon
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
    return { msg: m, lines: [], w: 240, h: 64 };
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
  const color =
    stage === "read" ? "#0EA5E9" : "rgba(60,90,71,0.6)";
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
  const bx = side === "in" ? SCREEN.x + SIDE_PAD : SCREEN.x + SCREEN.w - SIDE_PAD - w;

  ctx.save();
  ctx.globalAlpha = alpha;

  // shadow
  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, y + 3, w, h, 23);
  ctx.fill();

  // bubble
  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, y, w, h, 23);
  ctx.fill();

  // 3 bouncing dots
  for (let i = 0; i < 3; i++) {
    const phase = t * 7 - i * 0.7;
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

  // shadow + bubble
  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, by + 3, w, h, 22);
  ctx.fill();
  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, by, w, h, 22);
  ctx.fill();

  // play triangle
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

  // waveform bars
  const wfX = bx + 52;
  const wfY = by + h / 2;
  const wfW = w - 100;
  const bars = 22;
  const elapsed = Math.max(0, t - appearAt);
  const playProgress = clamp01(elapsed / 1.5);
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

  // duration text
  ctx.fillStyle = "rgba(60,90,71,0.7)";
  ctx.font = "500 15px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`0:0${duration}`, bx + 52, by + h - 8);

  // timestamp + tick
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

  // shadow
  ctx.fillStyle = "rgba(17,27,33,0.06)";
  roundRect(ctx, bx, by + 3, w, h, 22);
  ctx.fill();

  // bubble
  ctx.fillStyle = side === "in" ? "#FFFFFF" : "#CFFFDC";
  roundRect(ctx, bx, by, w, h, 22);
  ctx.fill();

  // text
  ctx.fillStyle = "#111B21";
  ctx.font = `400 ${BUBBLE_FONT}px Inter, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    ctx.fillText(line, bx + BUBBLE_PAD_X, by + BUBBLE_PAD_Y + i * BUBBLE_LH);
  }

  // timestamp + tick (only outgoing show ticks)
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

function drawConversation(ctx: CanvasRenderingContext2D, t: number) {
  // chat body bg
  ctx.save();
  roundRect(ctx, SCREEN.x, BODY_Y, SCREEN.w, BODY_BOTTOM - BODY_Y, 0);
  ctx.clip();
  ctx.fillStyle = "#E6FFDA";
  ctx.fillRect(SCREEN.x, BODY_Y, SCREEN.w, BODY_BOTTOM - BODY_Y);

  // subtle ornamental pattern
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

  // encryption highlight effect
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
  ctx.fillStyle = pillGlow > 0
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

  // pre-layout all messages
  const layouts: Layout[] = EVENTS.filter(
    (e): e is MessageEvent => e.kind === "message",
  ).map((m) => layoutMessage(ctx, m));

  // draw messages in their slots
  let cursorY = pillY + pillH + 24;
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i]!;
    const m = layout.msg;
    const local = clamp01((t - m.at) / 0.4);
    const visible = local > 0;

    if (!visible) {
      // reserve space anyway so future messages have stable Y
      cursorY += layout.h + BUBBLE_GAP;
      continue;
    }

    const eased = easeOut(local);
    const slideY = (1 - eased) * 30;
    const alpha = eased;

    const bx =
      m.side === "in"
        ? SCREEN.x + SIDE_PAD
        : SCREEN.x + SCREEN.w - SIDE_PAD - layout.w;
    const by = cursorY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, slideY);

    if (m.variant === "voice") {
      drawVoiceNoteBubble(ctx, layout, bx, by, t, m.at);
    } else {
      drawTextBubble(ctx, layout, bx, by, t);
    }

    ctx.restore();

    // reaction floating up onto this bubble
    const rxn = reactionAt(t, m.id);
    if (rxn) {
      const reactionLocal = clamp01(rxn.age / 0.6);
      const reactionAlpha =
        reactionLocal < 0.8
          ? easeOut(reactionLocal / 0.8)
          : 1;
      const reactionScale = 0.6 + easeOut(Math.min(1, reactionLocal * 1.4)) * 0.5;
      const rxX = m.side === "in" ? bx + layout.w - 8 : bx + 8;
      const rxY = by + layout.h - 4 + (1 - reactionLocal) * 8;
      ctx.save();
      ctx.globalAlpha = reactionAlpha;
      ctx.translate(rxX, rxY);
      ctx.scale(reactionScale, reactionScale);
      // pill background
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(17,27,33,0.18)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#E11D48";
      // heart shape
      ctx.beginPath();
      const s = 1;
      ctx.moveTo(0, 5 * s);
      ctx.bezierCurveTo(-10 * s, -2 * s, -10 * s, -10 * s, 0, -4 * s);
      ctx.bezierCurveTo(10 * s, -10 * s, 10 * s, -2 * s, 0, 5 * s);
      ctx.fill();
      ctx.restore();
    }

    cursorY += layout.h + BUBBLE_GAP;
  }

  // typing indicator (drawn at the next slot if active)
  for (const side of ["in", "out"] as const) {
    if (side === "out") continue; // user typing is shown in input bar instead
    const evt = currentTypingEvent(t, side);
    if (!evt) continue;
    const fadeIn = clamp01((t - evt.start) / 0.18);
    const fadeOut = 1 - clamp01((t - evt.end + 0.15) / 0.18);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;
    drawTypingBubble(ctx, side, cursorY, t, alpha);
  }

  ctx.restore(); // unclip body
}

/* ───────────────────────── full frame ───────────────────────── */

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

  /* — intro splash — */
  if (t < INTRO.end + 0.4) {
    const local = clamp01(t / 1.0);
    const fade = 1 - clamp01((t - 2.1) / 0.5);
    if (fade > 0) {
      ctx.save();
      ctx.globalAlpha = fade;
      const scale = 0.6 + easeOut(local) * 0.4;
      const cx = VIDEO_W / 2;
      const cy = VIDEO_H / 2 - 70;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      drawLogoMark(ctx, cx, cy, 200, true);
      ctx.restore();

      // wordmark + tagline (delayed)
      const wordAlpha = clamp01((t - 0.7) / 0.5) * fade;
      if (wordAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = wordAlpha;
        ctx.fillStyle = "#253D2C";
        ctx.font = "italic 600 64px 'Fraunces', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("VeilChat", VIDEO_W / 2, VIDEO_H / 2 + 80);

        ctx.fillStyle = "#3C5A47";
        ctx.font = "500 26px Inter, sans-serif";
        ctx.fillText(
          "Private by design.",
          VIDEO_W / 2,
          VIDEO_H / 2 + 130,
        );
        ctx.restore();
      }
    }
  }

  /* — phone + chat — */
  if (t >= PHONE_IN.start && t <= OUTRO.start + 0.6) {
    const rise = clamp01((t - PHONE_IN.start) / 0.7);
    const fadeOut = 1 - clamp01((t - OUTRO.start) / 0.5);
    const alpha = easeOut(rise) * fadeOut;
    const ty = (1 - easeOut(rise)) * 100;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, ty);
    drawPhoneBody(ctx);
    drawNotch(ctx);
    drawStatusBar(ctx);
    drawHeader(ctx, t);
    drawConversation(ctx, t);
    drawInputBar(ctx, t);
    ctx.restore();
  }

  /* — outro card — */
  if (t >= OUTRO.start - 0.2) {
    const fade = clamp01((t - OUTRO.start + 0.2) / 0.6);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#FCF5EB";
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

    // slow zoom on logo
    const zoomLocal = clamp01((t - OUTRO.start) / (OUTRO.end - OUTRO.start));
    const scale = 1 + easeInOut(zoomLocal) * 0.06;
    const cx = VIDEO_W / 2;
    const cy = VIDEO_H / 2 - 140;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    drawLogoMark(ctx, cx, cy, 180, true);
    ctx.restore();

    ctx.fillStyle = "#253D2C";
    ctx.font = "italic 600 80px 'Fraunces', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Message privately.", VIDEO_W / 2, VIDEO_H / 2 + 10);

    ctx.fillStyle = "#3C5A47";
    ctx.font = "500 30px Inter, sans-serif";
    ctx.fillText(
      "VeilChat · End-to-end encrypted",
      VIDEO_W / 2,
      VIDEO_H / 2 + 80,
    );

    // CTA pill
    const pillW = 360;
    const pillH = 84;
    const px = (VIDEO_W - pillW) / 2;
    const py = VIDEO_H / 2 + 160;
    const pillScale = 0.96 + Math.sin(t * 4) * 0.02;
    ctx.save();
    ctx.translate(VIDEO_W / 2, py + pillH / 2);
    ctx.scale(pillScale, pillScale);
    ctx.translate(-VIDEO_W / 2, -(py + pillH / 2));
    ctx.fillStyle = "#2E6F40";
    ctx.shadowColor = "rgba(46,111,64,0.4)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, px, py, pillW, pillH, 42);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 28px Inter, sans-serif";
    ctx.fillText("Get VeilChat — it's free", VIDEO_W / 2, py + pillH / 2 + 2);

    // small lock badge below
    ctx.fillStyle = "rgba(60,90,71,0.7)";
    ctx.font = "500 20px Inter, sans-serif";
    ctx.fillText(
      "veilchat.app",
      VIDEO_W / 2,
      py + pillH + 50,
    );

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
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + duration,
    );
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
    // soft two-note "ding" — bright, friendly notification
    [880, 1320].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.06, 0.28, 0.18, 0.005),
    );
  }

  playSend(when: number) {
    // upward swoop "pop" — outgoing whoosh
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(560, t);
        osc.frequency.exponentialRampToValueAtTime(1180, t + 0.13);
      },
      when,
      0.18,
      0.25,
      0.005,
    );
  }

  playTick(when: number) {
    // subtle UI tick (used for read-receipt updates)
    this.envOsc("triangle", 1500, when, 0.05, 0.07, 0.002);
  }

  playTypeClick(when: number) {
    // very short keyboard click
    this.envOsc("square", 1100, when, 0.025, 0.04, 0.001);
  }

  playReaction(when: number) {
    [880, 1100, 1320].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.04, 0.18, 0.16, 0.005),
    );
  }

  playOutroChime(when: number) {
    // gentle major arpeggio C-E-G
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.09, 1.4, 0.18, 0.02),
    );
  }

  playAmbientPad(start: number, end: number) {
    // soft sustained chord across the whole intro
    const notes = [261.63, 329.63, 392.0]; // C major
    notes.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.025, start + 1.2);
      gain.gain.setValueAtTime(0.025, end - 1.4);
      gain.gain.linearRampToValueAtTime(0, end);

      // gentle slow LFO for warmth
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.18;
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
  // ambient background pad
  engine.playAmbientPad(audioStart + 0.0, audioStart + DURATION_SEC - 0.2);

  // intro shimmer
  engine.playReaction(audioStart + 0.4);

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

  // typing clicks for all typing events
  for (const e of EVENTS) {
    if (e.kind !== "typing") continue;
    const dur = e.end - e.start;
    const count = Math.max(4, Math.floor(dur / 0.13));
    for (let i = 0; i < count; i++) {
      const when =
        audioStart + e.start + (i / count) * dur + (Math.random() * 0.04);
      engine.playTypeClick(when);
    }
  }

  // message arrival sounds
  for (const e of EVENTS) {
    if (e.kind !== "message") continue;
    if (e.side === "in") {
      engine.playReceive(audioStart + e.at);
    } else {
      engine.playSend(audioStart + e.at);
    }
  }

  // tick clicks
  for (const e of EVENTS) {
    if (e.kind === "tick") engine.playTick(audioStart + e.at);
  }

  // reaction pop
  for (const e of EVENTS) {
    if (e.kind === "reaction") engine.playReaction(audioStart + e.at);
  }

  // encryption highlight little chime
  engine.envOsc(
    "sine",
    1320,
    audioStart + ENCRYPTION_HIGHLIGHT.start + 0.2,
    0.4,
    0.15,
    0.04,
  );

  // outro chime
  engine.playOutroChime(audioStart + OUTRO.start + 0.3);
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

  // initial poster frame
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, 0.6);
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

  const runAnimation = useCallback(
    (onDone: () => void) => {
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
      }, 180);
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
            New · Animated intro · With sound
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
            A cinematic 18-second story of two friends chatting on
            VeilChat — typing indicators, voice notes, reactions,
            read receipts and a brand-built soundtrack. Generated fresh
            on your device, ready to download as a real video file with
            sound.
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
                aria-label="VeilChat animated intro preview"
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

            {/* feature chips under the player */}
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-[460px] mx-auto">
              {[
                "Typing indicators",
                "Read receipts",
                "Voice note",
                "Heart reaction",
                "Brand soundtrack",
                "Encryption highlight",
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
              Yours to keep — with sound.
            </h3>
            <p className="mt-2 text-[15px] sm:text-[16px] text-[#3C5A47] leading-relaxed">
              The intro is rendered fresh on your device every time, so
              the file you download is brand-new — no servers, no
              watermarks. Pop it on your reels, your pitch, or your own
              site.
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
                Real chat behaviour: Alex types, you reply, ticks turn
                blue, hearts fly.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                Custom soundtrack: warm pad, send/receive chimes, tick
                clicks and an outro arpeggio.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#CFFFDC] text-[#2E6F40] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                Your VeilChat brand mark front and centre, in intro and
                outro.
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
