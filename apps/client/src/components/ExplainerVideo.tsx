import { useCallback, useEffect, useRef, useState } from "react";

/**
 * VeilChat — Animated explainer video.
 *
 * Renders a 1280x720 landscape canvas at 30 fps with a synchronised
 * Web Audio score (ambient pad + soft chapter chimes + accents).
 * The MediaRecorder API is used to capture the canvas + the audio
 * destination stream into a real downloadable .mp4 / .webm file.
 *
 * Typography-driven motion graphics — no faces, no celebrities.
 *
 * Chapters (timeline seconds, played back at SPEED× of real time):
 *   1.   0 – 12   Cold open
 *   2.  12 – 30   The privacy problem
 *   3.  30 – 44   Introducing VeilChat
 *   4.  44 – 72   A real conversation (two-user chat)
 *   5.  72 –132   Core features
 *   6. 132 –162   How it works
 *   7. 162 –170   Open source proof (GitHub mark, AGPL-3.0, repo URL)
 *   8. 170 –188   Get VeilChat
 *
 * Real wall-clock playback time is `DURATION / SPEED` ≈ 125 s
 * (~2 min 05 s) with the default SPEED of 1.5.
 */

/* ───────────────────────── Constants ───────────────────────── */

const VIDEO_W = 1280;
const VIDEO_H = 720;
const FPS = 30;
/**
 * Playback speed multiplier. Visuals advance at SPEED× of real time,
 * and `scheduleAudio` scales every audio offset by 1/SPEED so the
 * soundtrack stays glued to the visuals. The whole timeline finishes
 * in `DURATION / SPEED` real seconds.
 *
 * Bumped from 1.0 → 1.5 to make the explainer feel snappier — chapters
 * change at a brisker pace without text becoming unreadable.
 */
const SPEED = 1.5;
const DURATION = 188; // 3:08 of timeline; ~2:05 real time at SPEED 1.5
const REAL_DURATION = DURATION / SPEED;

// Refined palette — 5 colors used consistently across every chapter.
const INK = "#0F1B14";       // deepest text & device chrome
const DARK = "#1A2D22";      // primary text
const MID = "#506A57";       // secondary text
const MID_SOFT = "#8DA294";  // tertiary text & dot grid
const FOREST = "#2E6F40";    // primary brand
const FOREST_DEEP = "#1F5230"; // gradient pair
const ACCENT = "#68BA7F";    // accent highlights & sent bubble
const PALE = "#D9F5DF";      // soft tints
const PALE_2 = "#EDFBF1";    // softer tints
const CREAM = "#FCF6EC";     // base background
const CREAM_2 = "#F4E9D5";   // background gradient pair
const WARM = "#D45C3F";      // warning / leak color
const WARM_DIM = "#8A2E18";  // deep warm
const WHITE = "#FFFFFF";

type Chapter = {
  key: string;
  start: number;
  end: number;
  label: string;
};

const CHAPTERS: Chapter[] = [
  { key: "cold", start: 0, end: 12, label: "Cold open" },
  { key: "problem", start: 12, end: 30, label: "The privacy problem" },
  { key: "intro", start: 30, end: 44, label: "Introducing VeilChat" },
  { key: "chat", start: 44, end: 72, label: "A real conversation" },
  { key: "features", start: 72, end: 132, label: "Core features" },
  { key: "how", start: 132, end: 162, label: "How it works" },
  { key: "open", start: 162, end: 170, label: "Open source" },
  { key: "cta", start: 170, end: 188, label: "Get VeilChat" },
];

/* ───────────────────────── Math helpers ───────────────────────── */

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 3);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};
const easeOutBack = (t: number) => {
  const x = clamp01(t);
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

/* Linear ramp that holds at full between fadeIn and fadeOut. */
function band(
  t: number,
  start: number,
  end: number,
  fadeIn = 0.4,
  fadeOut = 0.4,
): number {
  if (t < start || t > end) return 0;
  const a = clamp01((t - start) / fadeIn);
  const b = clamp01((end - t) / fadeOut);
  return Math.min(a, b);
}

/* ───────────────────────── Canvas helpers ───────────────────────── */

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
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Set a font with optional letter-spacing emulation. All callers
 * route through this so the typographic system stays consistent.
 */
function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: string | number = 600,
  family: "sans" | "serif" = "sans",
  letterSpacing = 0,
) {
  const fam =
    family === "serif"
      ? "'Fraunces', 'Times New Roman', serif"
      : "'Inter', 'Helvetica Neue', Arial, sans-serif";
  ctx.font = `${weight} ${size}px ${fam}`;
  // letterSpacing is supported on modern Canvas2D — silently ignored elsewhere.
  type LSCtx = CanvasRenderingContext2D & { letterSpacing?: string };
  const lsCtx = ctx as LSCtx;
  if ("letterSpacing" in ctx) {
    lsCtx.letterSpacing = `${letterSpacing}px`;
  }
}

/* Measure word-wrapped text into lines for the current font. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* Draw text staggering character-by-character with a cubic ease.
 * IMPORTANT: multiplies its per-char alpha with the OUTER globalAlpha,
 * so callers can fade an entire staggered block in/out at once. */
function drawStaggered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  localT: number,
  charDelay = 0.022,
  duration = 0.5,
  align: CanvasTextAlign = "left",
) {
  const baseAlpha = ctx.globalAlpha;
  if (baseAlpha <= 0.001) return;
  ctx.textAlign = align;
  const chars = [...text];
  let cursor: number;
  if (align === "center") {
    const total = ctx.measureText(text).width;
    cursor = x - total / 2;
  } else if (align === "right") {
    const total = ctx.measureText(text).width;
    cursor = x - total;
  } else {
    cursor = x;
  }
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    const start = i * charDelay;
    const p = clamp01((localT - start) / duration);
    const e = easeOut(p);
    ctx.save();
    ctx.globalAlpha = baseAlpha * e;
    ctx.translate(cursor, y + (1 - e) * 14);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cursor += ctx.measureText(ch).width;
  });
}

/* Draw multi-line wrapped text with a soft fade-up per line.
 * Like drawStaggered, multiplies with the outer globalAlpha. */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  localT: number,
  lineDelay = 0.16,
  align: CanvasTextAlign = "left",
) {
  const baseAlpha = ctx.globalAlpha;
  if (baseAlpha <= 0.001) return;
  ctx.textAlign = align;
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((ln, i) => {
    const start = i * lineDelay;
    const p = clamp01((localT - start) / 0.5);
    const e = easeOut(p);
    ctx.save();
    ctx.globalAlpha = baseAlpha * e;
    ctx.translate(0, (1 - e) * 10);
    ctx.fillText(ln, x, y + i * lineHeight);
    ctx.restore();
  });
}

/* ───────────────────────── Persistent backdrop ───────────────────────── */

/**
 * Persistent ambient backdrop shared by every chapter. Three soft
 * blobs drift slowly across the screen; a low-contrast noise dot
 * pattern adds texture. This layer is alive on every captured frame
 * so the export never reads as frozen.
 */
function drawBackdrop(ctx: CanvasRenderingContext2D, t: number) {
  // Base cream wash with subtle vertical gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
  grad.addColorStop(0, CREAM);
  grad.addColorStop(1, CREAM_2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

  // Drifting soft glows.
  const blobs = [
    { hue: PALE, size: 540, speed: 0.05, phase: 0 },
    { hue: ACCENT, size: 480, speed: 0.04, phase: 1.7 },
    { hue: "#E8DCC4", size: 560, speed: 0.032, phase: 3.1 },
  ];
  blobs.forEach((b) => {
    const cx = VIDEO_W * (0.5 + 0.42 * Math.sin(t * b.speed + b.phase));
    const cy = VIDEO_H * (0.5 + 0.34 * Math.cos(t * b.speed * 0.8 + b.phase));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.size);
    g.addColorStop(0, `${b.hue}55`);
    g.addColorStop(1, `${b.hue}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  });

  // Subtle dot grid for texture.
  ctx.save();
  ctx.fillStyle = `${MID_SOFT}1c`;
  for (let gy = 32; gy < VIDEO_H; gy += 64) {
    for (let gx = 32; gx < VIDEO_W; gx += 64) {
      fillCircle(ctx, gx, gy, 1.2);
    }
  }
  ctx.restore();
}

/* Always-on ambient floaters: small dots drifting up. */
function drawAmbientFloaters(ctx: CanvasRenderingContext2D, t: number) {
  const motes = 14;
  for (let i = 0; i < motes; i++) {
    const seed = i * 137.5;
    const cycle = 14 + (i % 5) * 3;
    const local = ((t + seed * 0.03) % cycle) / cycle;
    const x = ((seed * 73) % VIDEO_W) + Math.sin(t * 0.4 + i) * 24;
    const y = VIDEO_H * (1 - local) - 20;
    const a = Math.sin(local * Math.PI) * 0.18;
    if (a <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = FOREST;
    fillCircle(ctx, x, y, 2.2);
    ctx.restore();
  }
}

/* ───────────────────────── Logo & icons ───────────────────────── */

/**
 * VeilChat brand mark — rounded forest-green square with white check.
 */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  alpha = 1,
) {
  if (alpha <= 0) return;
  const half = size / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Glow underlay.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.4);
  glow.addColorStop(0, `${ACCENT}55`);
  glow.addColorStop(1, `${ACCENT}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - size * 1.4, cy - size * 1.4, size * 2.8, size * 2.8);
  // Body.
  roundRect(ctx, cx - half, cy - half, size, size, size * 0.24);
  const body = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
  body.addColorStop(0, FOREST);
  body.addColorStop(1, FOREST_DEEP);
  ctx.fillStyle = body;
  ctx.fill();
  // Inner highlight.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = WHITE;
  roundRect(
    ctx,
    cx - half + size * 0.08,
    cy - half + size * 0.08,
    size * 0.84,
    size * 0.32,
    size * 0.18,
  );
  ctx.fill();
  ctx.restore();
  // Checkmark.
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.24, cy + size * 0.04);
  ctx.lineTo(cx - size * 0.04, cy + size * 0.22);
  ctx.lineTo(cx + size * 0.28, cy - size * 0.18);
  ctx.lineWidth = size * 0.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  ctx.restore();
}

function drawLockIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = FOREST,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const w = size * 0.7;
  const h = size * 0.6;
  ctx.lineWidth = size * 0.1;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.2, w * 0.4, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, cx - w / 2, cy - h * 0.15, w, h, w * 0.18);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = CREAM;
  ctx.arc(cx, cy + h * 0.1, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - w * 0.05, cy + h * 0.1, w * 0.1, h * 0.18);
  ctx.restore();
}

function drawChatBubbleIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = FOREST,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const w = size * 1.1;
  const h = size * 0.78;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.32);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.18, cy + h * 0.4);
  ctx.lineTo(cx - w * 0.32, cy + h * 0.62);
  ctx.lineTo(cx - w * 0.04, cy + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPhoneIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color = INK,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, w * 0.18);
  ctx.fillStyle = color;
  ctx.fill();
  roundRect(
    ctx,
    cx - w / 2 + w * 0.08,
    cy - h / 2 + h * 0.08,
    w * 0.84,
    h * 0.84,
    w * 0.1,
  );
  ctx.fillStyle = PALE_2;
  ctx.fill();
  ctx.restore();
}

function drawServerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = MID,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const y = cy - size * 0.42 + i * (size * 0.34);
    roundRect(ctx, cx - size * 0.5, y, size, size * 0.24, size * 0.06);
    ctx.fill();
    ctx.fillStyle = i === 1 ? ACCENT : WHITE;
    fillCircle(ctx, cx + size * 0.36, y + size * 0.12, size * 0.04);
    ctx.fillStyle = color;
  }
  ctx.restore();
}

function drawCheckBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = ACCENT,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  fillCircle(ctx, cx, cy, size / 2);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.18, cy + size * 0.02);
  ctx.lineTo(cx - size * 0.04, cy + size * 0.16);
  ctx.lineTo(cx + size * 0.22, cy - size * 0.14);
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  ctx.restore();
}

function drawTimerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = FOREST,
  alpha = 1,
  spin = 0,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  const ang = -Math.PI / 2 + spin * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ang) * size * 0.36, cy + Math.sin(ang) * size * 0.36);
  ctx.stroke();
  ctx.fillStyle = color;
  roundRect(ctx, cx - size * 0.08, cy - size * 0.55, size * 0.16, size * 0.08, 2);
  ctx.fill();
  ctx.restore();
}

function drawDevicesIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = FOREST,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // Laptop.
  roundRect(ctx, cx - size * 0.5, cy - size * 0.18, size * 0.8, size * 0.42, size * 0.04);
  ctx.fill();
  ctx.fillStyle = PALE_2;
  roundRect(ctx, cx - size * 0.46, cy - size * 0.14, size * 0.72, size * 0.34, size * 0.03);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, cx - size * 0.55, cy + size * 0.24, size * 0.9, size * 0.06, size * 0.03);
  ctx.fill();
  // Phone in front-right.
  roundRect(ctx, cx + size * 0.18, cy - size * 0.04, size * 0.26, size * 0.4, size * 0.05);
  ctx.fill();
  ctx.fillStyle = PALE_2;
  roundRect(ctx, cx + size * 0.21, cy + size * 0.0, size * 0.2, size * 0.32, size * 0.03);
  ctx.fill();
  ctx.restore();
}

function drawAtIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = FOREST,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = size * 0.075;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  // Outer arc: open at the bottom-right (≈30°)
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, -Math.PI * 0.92, Math.PI * 0.16, false);
  ctx.stroke();
  // Inner ring.
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  // Small horizontal stem connecting inner ring to the outer arc.
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.18, cy - size * 0.02);
  ctx.lineTo(cx + size * 0.42, cy - size * 0.02);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── Section labels ───────────────────────── */

/** Section indicator chip in the top-left. */
function drawChapterChip(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS.find((c) => t >= c.start && t < c.end) ?? CHAPTERS[0]!;
  const localT = t - ch.start;
  const enter = clamp01(localT / 0.5);
  const exit = clamp01((ch.end - t) / 0.5);
  const a = Math.min(enter, exit) * 0.85;
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  setFont(ctx, 13, 700, "sans", 1.4);
  const label = ch.label.toUpperCase();
  const labelW = ctx.measureText(label).width;
  const padX = 14;
  const dotW = 22;
  const w = labelW + padX * 2 + dotW + 12;
  const h = 32;
  const x = 56;
  const y = 48;
  // pill.
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "#ffffffe6";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `${DARK}1f`;
  ctx.stroke();
  // text.
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, x + padX, y + h / 2 + 1);
  // progress arc.
  const arcCx = x + w - padX - dotW / 2;
  const arcCy = y + h / 2;
  const r = 7;
  ctx.beginPath();
  ctx.strokeStyle = `${FOREST}33`;
  ctx.lineWidth = 2;
  ctx.arc(arcCx, arcCy, r, 0, Math.PI * 2);
  ctx.stroke();
  const p = clamp01(localT / (ch.end - ch.start));
  ctx.beginPath();
  ctx.strokeStyle = FOREST;
  ctx.lineCap = "round";
  ctx.arc(arcCx, arcCy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* Watermark in the bottom-right with the wordmark + tiny tagline. */
function drawWatermark(ctx: CanvasRenderingContext2D, t: number) {
  const a = 0.55 + 0.12 * Math.sin(t * 0.6);
  ctx.save();
  ctx.globalAlpha = a;
  drawLogo(ctx, VIDEO_W - 78, VIDEO_H - 60, 28);
  setFont(ctx, 14, 700, "sans", -0.2);
  ctx.fillStyle = DARK;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText("VeilChat", VIDEO_W - 100, VIDEO_H - 64);
  setFont(ctx, 11, 500, "sans", 0.8);
  ctx.fillStyle = MID;
  ctx.fillText("PRIVATE BY DEFAULT", VIDEO_W - 100, VIDEO_H - 48);
  ctx.restore();
}

/* ───────────────────────── Chapter 1 — Cold open ───────────────────────── */

function drawColdOpen(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[0]!;
  const lt = t - ch.start;
  const len = ch.end - ch.start; // 12

  // Lock that morphs into a chat bubble (morph happens at 4s).
  const morph = clamp01((lt - 4) / 1.0);
  const cx = VIDEO_W / 2;
  const iconY = 240;
  const pulse = 1 + Math.sin(lt * 2.0) * 0.04;
  const baseSize = 130;

  // Icon stays visible for almost the whole chapter, exiting in last 0.5s.
  const iconWindow = band(lt, 0.3, len, 0.4, 0.5);
  const lockAlpha = (1 - morph) * iconWindow;
  drawLockIcon(ctx, cx, iconY, baseSize * pulse, FOREST, lockAlpha);
  const bubbleAlpha = morph * iconWindow;
  drawChatBubbleIcon(ctx, cx, iconY, baseSize * pulse, FOREST, bubbleAlpha);

  // Concentric pulse rings.
  for (let i = 0; i < 3; i++) {
    const ringT = ((lt + i * 0.55) % 1.7) / 1.7;
    const r = 80 + ringT * 110;
    const a = (1 - ringT) * 0.18 * iconWindow;
    if (a <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = FOREST;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, iconY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Three text beats — each cleanly enters AND exits before the next begins.
  // Window timings (start, hold, fadeOut) ensure no overlap:
  //   line 1: 0.4 → 3.4 (3s on)
  //   line 2: 3.8 → 7.0 (3.2s on)
  //   line 3: 7.4 → 11.4 (4s on, slightly longer for the punch)
  const lineWindows: {
    text: string;
    start: number;
    end: number;
    warm?: boolean;
  }[] = [
    { text: "Every day, you have private conversations.", start: 0.4, end: 3.4 },
    { text: "The kind you trust to one person.", start: 3.8, end: 7.0 },
    { text: "But you're not the only one in the room.", start: 7.4, end: 11.4, warm: true },
  ];

  lineWindows.forEach((w) => {
    if (lt < w.start || lt > w.end) return;
    const local = lt - w.start;
    const fadeIn = clamp01(local / 0.35);
    const fadeOut = clamp01((w.end - lt) / 0.4);
    const a = Math.min(fadeIn, fadeOut);
    if (a <= 0.01) return;
    setFont(ctx, 44, 600, "serif", -0.3);
    ctx.fillStyle = w.warm ? WARM_DIM : DARK;
    ctx.save();
    ctx.globalAlpha = a;
    drawStaggered(ctx, w.text, cx, 460, local, 0.018, 0.4, "center");
    ctx.restore();
  });

  // Subtle ascender line under the icon.
  const lineA = iconWindow * 0.18;
  if (lineA > 0.01) {
    ctx.save();
    ctx.globalAlpha = lineA;
    ctx.strokeStyle = FOREST;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 90, 340);
    ctx.lineTo(cx + 90, 340);
    ctx.stroke();
    ctx.restore();
  }
}

/* ───────────────────────── Chapter 2 — The problem ───────────────────────── */

function drawProblem(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[1]!;
  const lt = t - ch.start;
  const len = ch.end - ch.start; // 18

  // Whole-chapter window so everything fades together at the end.
  const chapterWindow = band(lt, 0, len, 0.4, 0.5);

  // Headline.
  ctx.save();
  ctx.globalAlpha = chapterWindow;
  setFont(ctx, 50, 600, "serif", -0.4);
  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";
  drawStaggered(
    ctx,
    "Most messengers leak everything",
    VIDEO_W / 2,
    100,
    lt,
    0.016,
    0.35,
    "center",
  );
  if (lt > 0.7) {
    setFont(ctx, 50, 600, "serif", -0.4);
    ctx.fillStyle = FOREST;
    drawStaggered(
      ctx,
      "except your message.",
      VIDEO_W / 2,
      162,
      lt - 0.7,
      0.018,
      0.35,
      "center",
    );
  }
  ctx.restore();

  // Three messenger tiles.
  const tileY = 260;
  const tileH = 220;
  const tileW = 280;
  const gap = 36;
  const totalW = tileW * 3 + gap * 2;
  const startX = (VIDEO_W - totalW) / 2;
  const tiles = [
    {
      label: "App A",
      leaks: ["Phone number", "Contact graph", "Online status"],
    },
    {
      label: "App B",
      leaks: ["Login times", "IP address", "Device model"],
    },
    {
      label: "App C",
      leaks: ["Group memberships", "Last seen", "Linked email"],
    },
  ];

  tiles.forEach((tile, i) => {
    const enter = clamp01((lt - 1.8 - i * 0.22) / 0.45);
    const e = easeOut(enter) * chapterWindow;
    if (e <= 0.01) return;
    const x = startX + i * (tileW + gap);
    const offsetY = (1 - easeOut(clamp01((lt - 1.8 - i * 0.22) / 0.45))) * 26;

    ctx.save();
    ctx.globalAlpha = e;

    // Card with shadow.
    ctx.save();
    ctx.shadowColor = `${INK}22`;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, tileY + offsetY, tileW, tileH, 22);
    ctx.fillStyle = "#ffffffee";
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `${DARK}14`;
    ctx.stroke();

    // Header bar.
    ctx.fillStyle = `${MID}10`;
    roundRect(ctx, x + 12, tileY + 12 + offsetY, tileW - 24, 38, 12);
    ctx.fill();
    setFont(ctx, 14, 700, "sans", 0.6);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(tile.label.toUpperCase(), x + 28, tileY + 31 + offsetY);

    // Leaking tags.
    tile.leaks.forEach((leak, j) => {
      const leakStart = 3.0 + i * 0.3 + j * 0.35;
      const lp = clamp01((lt - leakStart) / 0.5);
      if (lp <= 0) return;
      const le = easeOut(lp);
      const ty = tileY + 70 + j * 42 + offsetY + (1 - le) * 8;
      ctx.save();
      ctx.globalAlpha = e * le;
      setFont(ctx, 14, 600, "sans");
      const tagW = ctx.measureText(leak).width + 36;
      roundRect(ctx, x + 24, ty, tagW, 30, 14);
      ctx.fillStyle = `${WARM}18`;
      ctx.fill();
      ctx.strokeStyle = `${WARM}55`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = WARM;
      fillCircle(ctx, x + 24 + 14, ty + 15, 4);
      ctx.fillStyle = WARM_DIM;
      ctx.textBaseline = "middle";
      ctx.fillText(leak, x + 24 + 24, ty + 16);
      ctx.restore();

      if (le > 0.6) {
        const arrowP = clamp01((lt - leakStart - 0.25) / 1.3);
        ctx.save();
        ctx.globalAlpha = e * (1 - arrowP) * 0.65;
        ctx.strokeStyle = WARM;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x + 24 + tagW, ty + 15);
        ctx.lineTo(x + 24 + tagW + 50 + arrowP * 70, ty + 15);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    ctx.restore();
  });

  // Bottom: huge METADATA word reveal — punchier, lands at lt=8s.
  if (lt > 8) {
    const local = lt - 8;
    const out = chapterWindow;
    setFont(ctx, 92, 800, "sans", 4);
    ctx.fillStyle = WARM_DIM;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = out;
    drawStaggered(
      ctx,
      "METADATA",
      VIDEO_W / 2,
      612,
      local,
      0.04,
      0.4,
      "center",
    );
    ctx.restore();

    if (lt > 10) {
      setFont(ctx, 22, 500, "sans", 0.2);
      ctx.fillStyle = MID;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.save();
      ctx.globalAlpha = out * easeOut(clamp01((lt - 10) / 0.6));
      ctx.fillText(
        "Who you talk to. When. Where from. How often.",
        VIDEO_W / 2,
        666,
      );
      ctx.restore();
    }
  }
}

/* ───────────────────────── Chapter 3 — Introducing ───────────────────────── */

function drawIntroducing(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[2]!;
  const lt = t - ch.start;
  const len = ch.end - ch.start; // 14
  const cx = VIDEO_W / 2;

  // Whole-chapter window so every element fades together at the end.
  const chapterWindow = band(lt, 0, len, 0, 0.5);

  // Logo enters with a little spring.
  const logoEnter = clamp01(lt / 0.9);
  const logoY = lerp(VIDEO_H + 200, 240, easeOutBack(logoEnter));
  const logoScale = lerp(0.7, 1, easeOut(logoEnter));
  const float = Math.sin(lt * 0.8) * 5;
  drawLogo(ctx, cx, logoY + float, 170 * logoScale, easeOut(logoEnter) * chapterWindow);

  // Wordmark.
  if (lt > 0.7) {
    const local = lt - 0.7;
    setFont(ctx, 92, 700, "serif", -2);
    ctx.fillStyle = DARK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = chapterWindow;
    drawStaggered(ctx, "VeilChat", cx, 400, local, 0.035, 0.4, "center");
    ctx.restore();
  }

  // Tagline.
  if (lt > 1.8) {
    const local = lt - 1.8;
    setFont(ctx, 30, 500, "serif", -0.2);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = chapterWindow;
    drawWrapped(
      ctx,
      "Message privately. Built for the people you actually trust.",
      cx,
      478,
      900,
      40,
      local,
      0.14,
      "center",
    );
    ctx.restore();
  }

  // Chips.
  const chipsStart = 3.4;
  if (lt > chipsStart) {
    const chips = [
      { label: "End-to-end encrypted" },
      { label: "Open source" },
      { label: "No phone number" },
    ];
    const chipY = 580;
    setFont(ctx, 15, 700, "sans", 0.4);
    const widths = chips.map((c) => ctx.measureText(c.label).width + 44);
    const gap = 16;
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let cursor = (VIDEO_W - totalW) / 2;
    chips.forEach((c, i) => {
      const local = lt - chipsStart - i * 0.15;
      const p = clamp01(local / 0.4);
      const e = easeOut(p);
      if (e <= 0) return;
      const w = widths[i]!;
      ctx.save();
      ctx.globalAlpha = e * chapterWindow;
      ctx.translate(0, (1 - e) * 10);
      roundRect(ctx, cursor, chipY, w, 38, 19);
      ctx.fillStyle = PALE;
      ctx.fill();
      ctx.strokeStyle = `${ACCENT}88`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = FOREST;
      fillCircle(ctx, cursor + 16, chipY + 19, 3.5);
      ctx.fillStyle = FOREST;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(c.label, cursor + 26, chipY + 20);
      ctx.restore();
      cursor += w + gap;
    });
  }
}

/* ───────────────────────── Chapter 4 — A real conversation ───────────────────────── */
/*
 * Two-user chat scene: a centered phone-shaped chat panel with
 * Maya (left bubbles) and You (right bubbles) exchanging messages.
 * Encrypted shimmer crosses each bubble; checkmarks animate;
 * a heart reaction floats up; a disappearing-timer badge appears
 * on one message; a "screenshot blocked" toast lands at the end.
 */

type ChatMsg = {
  side: "left" | "right";
  text: string;
  /** Time when the typing indicator starts. */
  typeStart: number;
  /** Time when the bubble appears. */
  appear: number;
  /** Optional disappearing-timer badge. */
  timer?: boolean;
};

const CHAT_MESSAGES: ChatMsg[] = [
  { side: "left", text: "Hey, are we still on for Saturday?", typeStart: 0.8, appear: 2.6 },
  { side: "right", text: "Wouldn't miss it. 7pm at the park?", typeStart: 3.4, appear: 5.4 },
  { side: "left", text: "Perfect. I'll bring the playlist.", typeStart: 6.2, appear: 8.2 },
  { side: "right", text: "You always do.", typeStart: 8.8, appear: 10.4 },
  { side: "left", text: "And here's the address — gone in 30s.", typeStart: 11.0, appear: 13.0, timer: true },
];

function drawChat(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[3]!;
  const lt = t - ch.start;
  const len = ch.end - ch.start; // 28

  // Layout: phone-shaped chat panel on the right, callouts on the left.
  const panelW = 520;
  const panelH = 600;
  const panelX = VIDEO_W - panelW - 72;
  const panelY = (VIDEO_H - panelH) / 2;

  const panelEnter = clamp01(lt / 0.8);
  const pe = easeOut(panelEnter);
  const panelOut = clamp01((len - lt) / 0.7);

  // ── Section heading on the left.
  ctx.save();
  ctx.globalAlpha = panelOut;
  setFont(ctx, 12, 700, "sans", 1.6);
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("A REAL CONVERSATION", 92, 110);
  ctx.restore();

  setFont(ctx, 54, 600, "serif", -0.6);
  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";
  ctx.save();
  ctx.globalAlpha = panelOut;
  drawStaggered(ctx, "Two people.", 92, 152, lt, 0.022, 0.45, "left");
  if (lt > 0.7) {
    drawStaggered(ctx, "One sealed channel.", 92, 220, lt - 0.7, 0.022, 0.45, "left");
  }
  ctx.restore();

  // Left-side feature callouts that fade in over time.
  const callouts: { start: number; head: string; body: string }[] = [
    {
      start: 2.6,
      head: "Encrypted on send",
      body: "Each message is sealed on your device before it leaves.",
    },
    {
      start: 7.0,
      head: "Delivered & read",
      body: "Quiet receipts confirm delivery — never tracked anywhere else.",
    },
    {
      start: 13.0,
      head: "Disappearing on a timer",
      body: "Pick a window. Both copies vanish when it expires.",
    },
  ];
  callouts.forEach((c, i) => {
    if (lt < c.start) return;
    const a = easeOut(clamp01((lt - c.start) / 0.6));
    const out = clamp01((len - lt) / 0.7);
    const cy = 320 + i * 92;
    ctx.save();
    ctx.globalAlpha = a * out;
    ctx.translate(0, (1 - a) * 12);
    // dot.
    ctx.fillStyle = ACCENT;
    fillCircle(ctx, 104, cy + 12, 5);
    setFont(ctx, 19, 700, "sans", -0.1);
    ctx.fillStyle = DARK;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(c.head, 124, cy);
    setFont(ctx, 15, 400, "sans", 0.1);
    ctx.fillStyle = MID;
    drawWrapped(ctx, c.body, 124, cy + 26, 360, 22, lt - c.start, 0.05, "left");
    ctx.restore();
  });

  // ── Phone panel.
  ctx.save();
  ctx.globalAlpha = pe * panelOut;
  ctx.translate(0, (1 - pe) * 30);

  // Phone shadow.
  ctx.save();
  ctx.shadowColor = `${INK}44`;
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, panelX, panelY, panelW, panelH, 36);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();

  // Phone screen.
  const screenX = panelX + 12;
  const screenY = panelY + 14;
  const screenW = panelW - 24;
  const screenH = panelH - 28;
  roundRect(ctx, screenX, screenY, screenW, screenH, 26);
  ctx.fillStyle = CREAM;
  ctx.fill();

  // Header bar.
  const headerH = 76;
  roundRect(ctx, screenX, screenY, screenW, headerH, 26);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.fillRect(screenX, screenY + headerH - 18, screenW, 18);
  ctx.lineWidth = 1;
  ctx.strokeStyle = `${INK}10`;
  ctx.beginPath();
  ctx.moveTo(screenX, screenY + headerH);
  ctx.lineTo(screenX + screenW, screenY + headerH);
  ctx.stroke();

  // Avatar circle (Maya).
  const avX = screenX + 26;
  const avY = screenY + headerH / 2 + 4;
  const avR = 22;
  ctx.beginPath();
  ctx.fillStyle = PALE;
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `${ACCENT}aa`;
  ctx.stroke();
  setFont(ctx, 18, 700, "sans", 0);
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("M", avX, avY + 1);

  // Name + status.
  setFont(ctx, 17, 700, "sans", -0.1);
  ctx.fillStyle = DARK;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText("Maya", avX + avR + 14, avY - 2);
  // Verified badge.
  drawCheckBadge(ctx, avX + avR + 14 + 50, avY - 6, 14, ACCENT, 1);

  setFont(ctx, 12, 600, "sans", 0.4);
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("END-TO-END ENCRYPTED", avX + avR + 14, avY + 14);

  // Lock icon top right.
  drawLockIcon(ctx, screenX + screenW - 36, avY, 22, FOREST, 0.85);

  // Encryption banner pill (centered under header).
  const bannerY = screenY + headerH + 14;
  const bannerW = 320;
  const bannerH = 28;
  const bannerX = screenX + (screenW - bannerW) / 2;
  ctx.save();
  ctx.globalAlpha = 0.9;
  roundRect(ctx, bannerX, bannerY, bannerW, bannerH, bannerH / 2);
  ctx.fillStyle = `${PALE_2}`;
  ctx.fill();
  ctx.strokeStyle = `${ACCENT}66`;
  ctx.lineWidth = 1;
  ctx.stroke();
  setFont(ctx, 11, 700, "sans", 0.6);
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(
    "MESSAGES IN THIS CHAT ARE ENCRYPTED",
    bannerX + bannerW / 2,
    bannerY + bannerH / 2,
  );
  ctx.restore();

  // ── Message timeline.
  const msgAreaTop = bannerY + bannerH + 18;
  const msgAreaBottom = screenY + screenH - 78;
  const msgAreaH = msgAreaBottom - msgAreaTop;

  // Compute current bubble heights to lay them out from the bottom up.
  setFont(ctx, 15, 500, "sans", 0);
  type Layout = {
    msg: ChatMsg;
    h: number;
    width: number;
    lines: string[];
  };
  const maxBubbleW = screenW - 80;
  const layouts: Layout[] = CHAT_MESSAGES.map((m) => {
    const lines = wrapLines(ctx, m.text, maxBubbleW - 36);
    const lineH = 20;
    const padY = 12;
    const h = padY * 2 + lines.length * lineH + (m.timer ? 16 : 0);
    let widest = 0;
    for (const l of lines) {
      widest = Math.max(widest, ctx.measureText(l).width);
    }
    return { msg: m, h, width: widest + 32, lines };
  });

  // Current vertical cursor — bubbles flow top-down using their appear time.
  let cursorY = msgAreaTop;
  layouts.forEach((L, i) => {
    const m = L.msg;
    // Show typing indicator before bubble appears.
    if (lt < m.typeStart) return;
    const isTyping = lt < m.appear;
    const bubbleAppearP = clamp01((lt - m.appear) / 0.5);

    // Typing bubble (small).
    if (isTyping) {
      const tx = m.side === "left" ? screenX + 28 : screenX + screenW - 28 - 56;
      drawTypingBubble(ctx, tx, cursorY, m.side, lt - m.typeStart);
      // Reserve typing space (so the layout doesn't jump when it converts).
      cursorY += 38;
      return;
    }

    const e = easeOutBack(bubbleAppearP);
    const settle = easeOut(bubbleAppearP);

    // Compute bubble x.
    const bx = m.side === "left"
      ? screenX + 28
      : screenX + screenW - 28 - L.width;
    const by = cursorY + (1 - settle) * 8;

    // Wider entrance scale around the bubble's anchor.
    const scaleX = lerp(0.6, 1, e);
    const scaleY = lerp(0.6, 1, e);

    ctx.save();
    const anchorX = m.side === "left" ? bx : bx + L.width;
    const anchorY = by + L.h / 2;
    ctx.translate(anchorX, anchorY);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-anchorX, -anchorY);
    ctx.globalAlpha = settle;

    // Bubble fill.
    roundRect(ctx, bx, by, L.width, L.h, 18);
    if (m.side === "left") {
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.strokeStyle = `${INK}10`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const grd = ctx.createLinearGradient(bx, by, bx + L.width, by + L.h);
      grd.addColorStop(0, ACCENT);
      grd.addColorStop(1, FOREST);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Text.
    setFont(ctx, 15, 500, "sans", 0);
    ctx.fillStyle = m.side === "left" ? DARK : WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    L.lines.forEach((ln, k) => {
      ctx.fillText(ln, bx + 16, by + 12 + k * 20);
    });

    // Disappearing timer badge inside bubble.
    if (m.timer) {
      const badgeY = by + L.h - 18;
      drawTimerIcon(ctx, bx + 18, badgeY + 2, 14, m.side === "left" ? FOREST : WHITE, 0.9, ((lt - m.appear) % 1.5) / 1.5);
      setFont(ctx, 11, 700, "sans", 0.4);
      ctx.fillStyle = m.side === "left" ? FOREST : WHITE;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("VANISHES IN 30s", bx + 32, badgeY + 4);
    }

    // Encrypted shimmer sweep across the bubble during its first 0.7s.
    const shimmerP = clamp01((lt - m.appear) / 0.7);
    if (shimmerP > 0 && shimmerP < 1) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = (1 - shimmerP) * 0.6;
      const shimmerX = bx + lerp(-30, L.width + 30, shimmerP);
      const sg = ctx.createLinearGradient(shimmerX - 30, 0, shimmerX + 30, 0);
      sg.addColorStop(0, "#ffffff00");
      sg.addColorStop(0.5, "#ffffffaa");
      sg.addColorStop(1, "#ffffff00");
      ctx.fillStyle = sg;
      ctx.fillRect(bx, by, L.width, L.h);
      ctx.restore();
    }

    ctx.restore();

    // Status row (right side messages get checkmarks, left side gets a tail timestamp).
    if (m.side === "right") {
      const checks = clamp01((lt - m.appear) / 1.2); // becomes single, then double, then read.
      const cx2 = bx + L.width - 6;
      const cy2 = by + L.h + 14;
      setFont(ctx, 11, 600, "sans", 0.3);
      ctx.fillStyle = MID;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText("Encrypted", cx2 - 30, cy2);
      // Checkmarks: always render two; second appears at p>0.4; both turn ACCENT (read) at p>0.85.
      const colorA = checks > 0.85 ? ACCENT : MID;
      const colorB = checks > 0.85 ? ACCENT : (checks > 0.4 ? MID : "#00000000");
      drawTinyCheck(ctx, cx2 - 18, cy2, colorA, easeOut(clamp01(checks / 0.4)));
      drawTinyCheck(ctx, cx2 - 10, cy2, colorB, easeOut(clamp01((checks - 0.4) / 0.4)));
    } else {
      const cx2 = bx + L.width + 8;
      const cy2 = by + L.h - 14;
      setFont(ctx, 11, 600, "sans", 0.3);
      ctx.fillStyle = MID;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("9:41", cx2, cy2);
    }

    cursorY += L.h + 30;
  });

  // Heart reaction floating up over message #2 around lt 6.0..7.6.
  if (lt > 6.0 && lt < 7.6) {
    const hp = clamp01((lt - 6.0) / 1.5);
    const hx = panelX + panelW / 2 + 80;
    const hy = lerp(panelY + 320, panelY + 200, hp);
    ctx.save();
    ctx.globalAlpha = (1 - hp) * 0.95;
    ctx.translate(hx, hy);
    ctx.scale(1 + hp * 0.6, 1 + hp * 0.6);
    drawHeart(ctx, 0, 0, 18, WARM);
    ctx.restore();
  }

  // Composer at the bottom of the screen.
  const composerY = screenY + screenH - 56;
  const composerH = 44;
  const composerX = screenX + 16;
  const composerW = screenW - 32;
  roundRect(ctx, composerX, composerY, composerW, composerH, composerH / 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = `${INK}10`;
  ctx.lineWidth = 1;
  ctx.stroke();
  setFont(ctx, 14, 500, "sans");
  ctx.fillStyle = MID_SOFT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Type a message…", composerX + 22, composerY + composerH / 2);
  // Send button.
  const sendCx = composerX + composerW - composerH / 2 - 6;
  const sendCy = composerY + composerH / 2;
  fillCircleGradient(ctx, sendCx, sendCy, composerH / 2 - 6, FOREST, FOREST_DEEP);
  // Triangle.
  ctx.beginPath();
  ctx.moveTo(sendCx - 4, sendCy - 5);
  ctx.lineTo(sendCx + 6, sendCy);
  ctx.lineTo(sendCx - 4, sendCy + 5);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();

  ctx.restore(); // panel transform

  // "Screenshot blocked" toast near the end of chapter (lt 18–25).
  if (lt > 18 && lt < 25) {
    const local = lt - 18;
    const a = easeOut(clamp01(local / 0.35)) * easeOut(clamp01((25 - lt) / 0.5));
    const tw = 360;
    const th = 56;
    const tx = panelX + panelW / 2 - tw / 2;
    const ty = panelY + 80;
    ctx.save();
    ctx.globalAlpha = a;
    roundRect(ctx, tx, ty, tw, th, 18);
    ctx.fillStyle = INK;
    ctx.fill();
    drawLockIcon(ctx, tx + 28, ty + th / 2 + 2, 22, WHITE, 1);
    setFont(ctx, 14, 700, "sans", 0.2);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText("Screenshot blocked", tx + 56, ty + 24);
    setFont(ctx, 11, 500, "sans", 0.3);
    ctx.fillStyle = "#ffffffaa";
    ctx.fillText("Recipient won't be able to capture this chat.", tx + 56, ty + 42);
    ctx.restore();
  }
}

function drawTypingBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: "left" | "right",
  localT: number,
) {
  const w = 56;
  const h = 28;
  const bx = side === "right" ? x : x;
  ctx.save();
  roundRect(ctx, bx, y, w, h, 14);
  ctx.fillStyle = side === "left" ? WHITE : `${ACCENT}33`;
  ctx.fill();
  ctx.strokeStyle = `${INK}10`;
  ctx.lineWidth = 1;
  ctx.stroke();
  // 3 dots.
  for (let i = 0; i < 3; i++) {
    const phase = (localT * 1.4 + i * 0.18) % 1;
    const dy = Math.sin(phase * Math.PI * 2) * 2.5;
    ctx.fillStyle = side === "left" ? MID : FOREST;
    fillCircle(ctx, bx + 14 + i * 12, y + h / 2 + dy, 3);
  }
  ctx.restore();
}

function drawTinyCheck(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy + 0);
  ctx.lineTo(cx - 1, cy + 3);
  ctx.lineTo(cx + 4, cy - 3);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.6);
  ctx.bezierCurveTo(
    cx + size * 1.0, cy + size * 0.1,
    cx + size * 0.6, cy - size * 0.7,
    cx, cy - size * 0.2,
  );
  ctx.bezierCurveTo(
    cx - size * 0.6, cy - size * 0.7,
    cx - size * 1.0, cy + size * 0.1,
    cx, cy + size * 0.6,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fillCircleGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  c1: string,
  c2: string,
) {
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/* ───────────────────────── Chapter 5 — Core features ───────────────────────── */

type FeatureBeat = {
  start: number;
  duration: number;
  title: string;
  body: string;
  drawIcon: (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    alpha: number,
    localT: number,
  ) => void;
};

const FEATURES: FeatureBeat[] = [
  {
    start: 0,
    duration: 12,
    title: "End-to-end encrypted by default",
    body:
      "Every message, photo, and file is sealed on your device with a key only you and your friend share. Not on our servers. Nowhere else.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawLockIcon(ctx, cx, cy, size, FOREST, alpha),
  },
  {
    start: 12,
    duration: 12,
    title: "No phone number required",
    body:
      "Sign up with a username — that's it. Nothing ties your conversations to your real-world identity, and no number to look you up with.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawAtIcon(ctx, cx, cy, size, FOREST, alpha),
  },
  {
    start: 24,
    duration: 12,
    title: "Disappearing messages",
    body:
      "Pick a timer — five seconds, an hour, a week — and your message is gone from both devices when it expires. No permanent record.",
    drawIcon: (ctx, cx, cy, size, alpha, lt) =>
      drawTimerIcon(ctx, cx, cy, size, FOREST, alpha, lt * 0.8),
  },
  {
    start: 36,
    duration: 12,
    title: "Verified contacts",
    body:
      "Compare a small safety code with your friend in person. If the codes match, the conversation is sealed between exactly the two of you.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawCheckBadge(ctx, cx, cy, size, ACCENT, alpha),
  },
  {
    start: 48,
    duration: 12,
    title: "Works on every device",
    body:
      "Phone, tablet, laptop. Android, iOS, web, desktop. Install it as an app from your browser in seconds — no app store, no review queue.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawDevicesIcon(ctx, cx, cy, size, FOREST, alpha),
  },
];

function drawFeatures(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[4]!;
  const lt = t - ch.start;

  // Section header.
  const headerA = band(lt, 0, ch.end - ch.start, 0.8, 0.8);
  ctx.save();
  ctx.globalAlpha = headerA * 0.85;
  setFont(ctx, 13, 700, "sans", 1.6);
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("CORE FEATURES", 92, 120);
  ctx.restore();

  // Step indicator dots.
  const activeIdx = FEATURES.findIndex(
    (f) => lt >= f.start && lt < f.start + f.duration,
  );
  const idx = activeIdx === -1 ? FEATURES.length - 1 : activeIdx;
  const dotsX = VIDEO_W - 92;
  const dotsY = 124;
  const dotGap = 18;
  ctx.save();
  ctx.globalAlpha = headerA;
  for (let i = 0; i < FEATURES.length; i++) {
    const x = dotsX - (FEATURES.length - 1 - i) * dotGap;
    if (i === idx) {
      roundRect(ctx, x - 12, dotsY - 4, 26, 8, 4);
      ctx.fillStyle = FOREST;
      ctx.fill();
    } else {
      ctx.fillStyle = i < idx ? `${FOREST}66` : `${MID}33`;
      fillCircle(ctx, x, dotsY, 3.5);
    }
  }
  ctx.restore();

  // Render the active feature beat.
  FEATURES.forEach((f, i) => {
    const localT = lt - f.start;
    if (localT < -0.4 || localT > f.duration + 0.4) return;
    const enter = clamp01(localT / 0.45);
    const exit = clamp01((f.duration - localT) / 0.4);
    const a = Math.min(enter, exit);
    if (a <= 0.01) return;

    const dir = i % 2 === 0 ? 1 : -1;
    const slide = (1 - enter) * 50 * dir;

    const iconCx = 360;
    const iconCy = 380;
    const iconSize = 220;

    // Icon backplate.
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(slide, 0);
    const plateScale = 0.94 + Math.sin(localT * 1.5) * 0.025;
    roundRect(
      ctx,
      iconCx - 150 * plateScale,
      iconCy - 150 * plateScale,
      300 * plateScale,
      300 * plateScale,
      40,
    );
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = `${DARK}12`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const g = ctx.createRadialGradient(iconCx, iconCy, 20, iconCx, iconCy, 220);
    g.addColorStop(0, `${ACCENT}22`);
    g.addColorStop(1, `${ACCENT}00`);
    ctx.fillStyle = g;
    ctx.fillRect(iconCx - 220, iconCy - 220, 440, 440);
    f.drawIcon(ctx, iconCx, iconCy, iconSize, a, Math.max(0, localT));
    ctx.restore();

    // Index label.
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.translate(-slide, 0);
    setFont(ctx, 13, 700, "sans", 1.6);
    ctx.fillStyle = MID;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(
      `${String(i + 1).padStart(2, "0")} / ${String(FEATURES.length).padStart(2, "0")}`,
      640,
      210,
    );
    ctx.restore();

    // Title.
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(-slide, 0);
    setFont(ctx, 48, 600, "serif", -0.6);
    ctx.fillStyle = DARK;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    drawWrapped(ctx, f.title, 640, 246, 540, 56, localT, 0.1, "left");
    ctx.restore();

    // Body.
    if (localT > 0.5) {
      const bodyT = localT - 0.5;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(-slide, 0);
      setFont(ctx, 21, 400, "sans", 0.1);
      ctx.fillStyle = MID;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      drawWrapped(ctx, f.body, 640, 396, 540, 34, bodyT, 0.07, "left");
      ctx.restore();
    }

    // Underline accent.
    if (localT > 0.18) {
      const drawP = clamp01((localT - 0.18) / 0.7);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(640, 226);
      ctx.lineTo(640 + 80 * drawP, 226);
      ctx.stroke();
      ctx.restore();
    }
  });
}

/* ───────────────────────── Chapter 6 — How it works ───────────────────────── */

function drawHowItWorks(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[5]!;
  const lt = t - ch.start;
  const len = ch.end - ch.start; // 30
  const chapterWindow = band(lt, 0, len, 0.4, 0.5);

  // Heading.
  setFont(ctx, 48, 600, "serif", -0.6);
  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.save();
  ctx.globalAlpha = chapterWindow;
  drawStaggered(ctx, "How it works", 92, 110, lt, 0.02, 0.4, "left");
  ctx.restore();

  // Sub heading.
  if (lt > 0.7) {
    setFont(ctx, 22, 500, "sans", 0.1);
    ctx.fillStyle = MID;
    ctx.textBaseline = "top";
    ctx.save();
    ctx.globalAlpha = chapterWindow * easeOut(clamp01((lt - 0.7) / 0.4));
    ctx.fillText("Three things happen the moment you press send.", 92, 174);
    ctx.restore();
  }

  // Diagram coordinates.
  const baseY = 380;
  const phoneA_x = 220;
  const phoneB_x = VIDEO_W - 220;
  const serverX = VIDEO_W / 2;
  const phoneW = 130;
  const phoneH = 180;

  // Diagram fades in then fades out around lt=14 to make room for the takeaways.
  const stage0In = clamp01((lt - 2.0) / 0.6);
  const diagramHold = 1 - clamp01((lt - 14) / 1.0);
  const stageA = easeOut(stage0In) * diagramHold * chapterWindow;
  drawPhoneIcon(ctx, phoneA_x, baseY, phoneW, phoneH, INK, stageA);
  drawPhoneIcon(ctx, phoneB_x, baseY, phoneW, phoneH, INK, stageA);
  drawServerIcon(ctx, serverX, baseY - 10, 120, MID, stageA);

  // Captions.
  setFont(ctx, 12, 700, "sans", 1.4);
  ctx.fillStyle = MID;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.save();
  ctx.globalAlpha = stageA;
  ctx.fillText("YOUR DEVICE", phoneA_x, baseY + phoneH / 2 + 18);
  ctx.fillText("VEILCHAT SERVER", serverX, baseY + 70);
  ctx.fillText("FRIEND'S DEVICE", phoneB_x, baseY + phoneH / 2 + 18);
  ctx.restore();

  // Stage 1: typed message in left phone.
  if (lt > 4) {
    const m = clamp01((lt - 4) / 0.5);
    ctx.save();
    ctx.globalAlpha = m * stageA;
    setFont(ctx, 12, 600, "sans");
    roundRect(ctx, phoneA_x - phoneW / 2 + 16, baseY - 30, phoneW - 32, 22, 8);
    ctx.fillStyle = FOREST;
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("Hello!", phoneA_x, baseY - 19);
    ctx.restore();
  }

  // Sealed packet flight: depart 5.5s, reach server 7s, depart 9s, arrive 10.5s.
  const flightAlpha = stageA;
  const drawFlight = (
    fromX: number,
    toX: number,
    startSec: number,
    durSec: number,
  ) => {
    if (lt < startSec) return;
    const p = clamp01((lt - startSec) / durSec);
    if (p >= 1) return;
    const e = easeInOut(p);
    const x = lerp(fromX, toX, e);
    const arc = baseY - 30 - Math.sin(p * Math.PI) * 80;
    ctx.save();
    ctx.globalAlpha = flightAlpha;
    roundRect(ctx, x - 60, arc - 18, 120, 36, 18);
    const grd = ctx.createLinearGradient(x - 60, arc, x + 60, arc);
    grd.addColorStop(0, FOREST);
    grd.addColorStop(1, FOREST_DEEP);
    ctx.fillStyle = grd;
    ctx.fill();
    drawLockIcon(ctx, x - 38, arc, 24, WHITE, 1);
    setFont(ctx, 11, 700, "sans", 1.4);
    ctx.fillStyle = "#ffffffcc";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("· · · · · ·", x - 18, arc);
    ctx.strokeStyle = `${FOREST}44`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(fromX + 70, baseY - 30);
    ctx.lineTo(x - 70, arc);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  drawFlight(phoneA_x, serverX, 5.5, 1.5);
  drawFlight(serverX, phoneB_x, 9, 1.5);

  // At the server (between 7s and 9s) show the "we never see this" beat.
  if (lt > 7 && lt < 9.6) {
    const local = lt - 7;
    const a = easeOut(clamp01(local / 0.4)) * easeOut(clamp01((9.6 - lt) / 0.4));
    ctx.save();
    ctx.globalAlpha = a;
    setFont(ctx, 13, 700, "sans", 1.4);
    ctx.fillStyle = WARM_DIM;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("· · · UNREADABLE HERE · · ·", serverX, baseY - 110);
    const ring = (local % 1.0) / 1.0;
    ctx.strokeStyle = `${WARM}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(serverX, baseY + 4, 90 + ring * 50, 0, Math.PI * 2);
    ctx.globalAlpha = a * (1 - ring) * 0.6;
    ctx.stroke();
    ctx.restore();
  }

  // Final: arriving message decrypts on right phone.
  if (lt > 10.5) {
    const m = clamp01((lt - 10.5) / 0.5);
    ctx.save();
    ctx.globalAlpha = m * stageA;
    setFont(ctx, 12, 600, "sans");
    roundRect(ctx, phoneB_x - phoneW / 2 + 16, baseY - 30, phoneW - 32, 22, 8);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("Hello!", phoneB_x, baseY - 19);
    ctx.restore();
  }

  // Lower section: three takeaway points (no calls reference).
  const points: { start: number; head: string; body: string }[] = [
    {
      start: 13,
      head: "Keys live on your devices.",
      body: "Generated locally. Never uploaded. Never recoverable from our side.",
    },
    {
      start: 18,
      head: "Forward secrecy.",
      body: "Keys rotate constantly. Yesterday's messages stay sealed even if today's keys leak.",
    },
    {
      start: 23,
      head: "Open and auditable.",
      body: "Source code is public under AGPL-3.0. Anyone can verify exactly what runs on your device.",
    },
  ];
  points.forEach((p, i) => {
    if (lt < p.start) return;
    const local = lt - p.start;
    const a = easeOut(clamp01(local / 0.5)) * chapterWindow;
    if (a <= 0.01) return;
    const tileX = 92 + i * 372;
    const tileY = 560;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - easeOut(clamp01(local / 0.5))) * 14);
    drawLockIcon(ctx, tileX + 16, tileY + 16, 32, FOREST, 1);
    setFont(ctx, 18, 700, "sans", -0.1);
    ctx.fillStyle = DARK;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(p.head, tileX + 44, tileY + 6);
    setFont(ctx, 14, 400, "sans", 0.1);
    ctx.fillStyle = MID;
    drawWrapped(
      ctx,
      p.body,
      tileX + 44,
      tileY + 32,
      300,
      20,
      Math.max(0, local - 0.2),
      0.08,
      "left",
    );
    ctx.restore();
  });
}

/* ───────────────────────── Chapter 7 — Open source proof ───────────────────────── */
/*
 * Eight-second beat that lands the open-source story in plain sight:
 * a hand-drawn GitHub Octocat mark scales in with a soft "vault
 * unlocking" sweep, the headline types in, an AGPL-3.0 pill chimes,
 * the public repo URL slides up, and three proof chips
 * (Public source / Self-hostable / Forward secrecy) tick into place
 * before a closing "Audit every line. Verify every claim." footer.
 */

function drawGithubMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  alpha = 1,
) {
  if (alpha <= 0) return;
  const r = size / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // soft glow underlay
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.2);
  glow.addColorStop(0, `${ACCENT}55`);
  glow.addColorStop(1, `${ACCENT}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - size * 1.2, cy - size * 1.2, size * 2.4, size * 2.4);
  // disc
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const body = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  body.addColorStop(0, INK);
  body.addColorStop(1, DARK);
  ctx.fillStyle = body;
  ctx.fill();
  // octocat silhouette — simplified, drawn with arcs + paths in cream
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  // head (rounded blob)
  ctx.arc(0, -6, 26, 0, Math.PI * 2);
  ctx.fill();
  // body / tentacles
  ctx.beginPath();
  ctx.moveTo(-22, 8);
  ctx.quadraticCurveTo(-30, 22, -22, 32);
  ctx.quadraticCurveTo(-12, 34, -8, 24);
  ctx.lineTo(-2, 34);
  ctx.quadraticCurveTo(4, 38, 10, 32);
  ctx.lineTo(14, 24);
  ctx.quadraticCurveTo(20, 32, 24, 28);
  ctx.quadraticCurveTo(30, 18, 22, 8);
  ctx.closePath();
  ctx.fill();
  // eyes (negative space)
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-9, -8, 3.4, 0, Math.PI * 2);
  ctx.arc(9, -8, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOpenSourceScene(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[6]!; // open
  const lt = t - ch.start;
  const len = ch.end - ch.start; // 8
  const cx = VIDEO_W / 2;

  // chapter window so the whole beat fades together at the end
  const chapterWindow = band(lt, 0, len, 0, 0.6);

  // GitHub mark — springs in from below with a little bounce.
  const markEnter = clamp01(lt / 0.9);
  const markScale = lerp(0.7, 1, easeOutBack(markEnter));
  const markY = lerp(VIDEO_H + 160, 200, easeOutBack(markEnter));
  const float = Math.sin(lt * 1.2) * 4;
  drawGithubMark(
    ctx,
    cx,
    markY + float,
    140 * markScale,
    easeOut(markEnter) * chapterWindow,
  );

  // Headline — staggered chars.
  if (lt > 0.55) {
    const local = lt - 0.55;
    setFont(ctx, 64, 700, "serif", -1.5);
    ctx.fillStyle = DARK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = chapterWindow;
    drawStaggered(ctx, "Open source.", cx, 360, local, 0.03, 0.45, "center");
    ctx.restore();
  }

  // AGPL-3.0 pill — chime at 1.4s.
  if (lt > 1.35) {
    const p = easeOut(clamp01((lt - 1.35) / 0.45));
    setFont(ctx, 16, 700, "sans", 0.6);
    const label = "AGPL-3.0 LICENCE";
    const w = ctx.measureText(label).width + 36;
    const h = 36;
    const x = cx - w / 2;
    const y = 412;
    ctx.save();
    ctx.globalAlpha = p * chapterWindow;
    ctx.translate(0, (1 - p) * 8);
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = PALE_2;
    ctx.fill();
    ctx.strokeStyle = `${ACCENT}aa`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // tiny dot
    ctx.fillStyle = FOREST;
    fillCircle(ctx, x + 14, y + h / 2, 3.5);
    // label
    ctx.fillStyle = FOREST;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 24, y + h / 2 + 1);
    ctx.restore();
  }

  // Repo URL pill (slides up at 1.95s).
  if (lt > 1.95) {
    const p = easeOut(clamp01((lt - 1.95) / 0.55));
    setFont(ctx, 22, 700, "sans", 0.4);
    const url = "github.com/rupeshsahu408/VeilChat";
    const w = ctx.measureText(url).width + 80;
    const h = 56;
    const x = cx - w / 2;
    const y = 470;
    ctx.save();
    ctx.globalAlpha = p * chapterWindow;
    ctx.translate(0, (1 - p) * 14);
    roundRect(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, FOREST);
    g.addColorStop(1, FOREST_DEEP);
    ctx.fillStyle = g;
    ctx.fill();
    setFont(ctx, 22, 700, "sans", 0.4);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(url, cx, y + h / 2 + 1);
    ctx.restore();
  }

  // Three proof chips, slightly staggered.
  const chipsStart = 2.15;
  if (lt > chipsStart) {
    const chips = ["Public source", "Self-hostable", "Forward secrecy"];
    const chipY = 558;
    setFont(ctx, 14, 700, "sans", 0.4);
    const widths = chips.map((c) => ctx.measureText(c).width + 40);
    const gap = 14;
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let cursor = (VIDEO_W - totalW) / 2;
    chips.forEach((c, i) => {
      const local = lt - chipsStart - i * 0.18;
      const p = clamp01(local / 0.4);
      const e = easeOut(p);
      if (e <= 0) return;
      const w = widths[i]!;
      ctx.save();
      ctx.globalAlpha = e * chapterWindow;
      ctx.translate(0, (1 - e) * 10);
      roundRect(ctx, cursor, chipY, w, 34, 17);
      ctx.fillStyle = PALE;
      ctx.fill();
      ctx.strokeStyle = `${ACCENT}88`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = FOREST;
      fillCircle(ctx, cursor + 14, chipY + 17, 3);
      ctx.fillStyle = FOREST;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(c, cursor + 24, chipY + 18);
      ctx.restore();
      cursor += w + gap;
    });
  }

  // Footer line.
  if (lt > 3.4) {
    setFont(ctx, 18, 600, "serif", -0.2);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = easeOut(clamp01((lt - 3.4) / 0.7)) * chapterWindow;
    ctx.fillText("Audit every line. Verify every claim.", cx, 624);
    ctx.restore();
  }
}

function drawCTA(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[7]!;
  const lt = t - ch.start;
  const cx = VIDEO_W / 2;

  const enter = clamp01(lt / 1.0);
  const e = easeOut(enter);
  const float = Math.sin(lt * 0.8) * 5;
  drawLogo(ctx, cx, 230 + float, 200 * (0.85 + 0.15 * e), e);

  if (lt > 0.8) {
    setFont(ctx, 88, 700, "serif", -2);
    ctx.fillStyle = DARK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    drawStaggered(ctx, "VeilChat", cx, 400, lt - 0.8, 0.045, 0.55, "center");
  }

  if (lt > 2.2) {
    setFont(ctx, 28, 500, "serif", -0.2);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = easeOut(clamp01((lt - 2.2) / 0.7));
    ctx.fillText("Take your conversations back.", cx, 472);
    ctx.restore();
  }

  // URL pill.
  if (lt > 3.6) {
    const p = easeOut(clamp01((lt - 3.6) / 0.7));
    setFont(ctx, 22, 700, "sans", 0.4);
    const url = "chats-client-vert.vercel.app";
    const w = ctx.measureText(url).width + 84;
    const h = 60;
    const x = cx - w / 2;
    const y = 528;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 12);
    roundRect(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, FOREST);
    g.addColorStop(1, FOREST_DEEP);
    ctx.fillStyle = g;
    ctx.fill();
    setFont(ctx, 22, 700, "sans", 0.4);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(url, cx, y + h / 2 + 1);
    ctx.restore();
  }

  // Footnote.
  if (lt > 5.4) {
    setFont(ctx, 14, 600, "sans", 1.2);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = easeOut(clamp01((lt - 5.4) / 0.7));
    ctx.fillText(
      "FREE FOREVER  ·  OPEN SOURCE  ·  NO PHONE NUMBER",
      cx,
      618,
    );
    ctx.restore();
  }

  // Outro shimmer ring around logo.
  const ringP = (lt % 2.4) / 2.4;
  ctx.save();
  ctx.globalAlpha = (1 - ringP) * 0.35;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, 230 + float, 130 + ringP * 80, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── Master draw ───────────────────────── */

function drawFrame(ctx: CanvasRenderingContext2D, t: number) {
  drawBackdrop(ctx, t);
  drawAmbientFloaters(ctx, t);

  const ch = CHAPTERS.find((c) => t >= c.start && t < c.end);
  switch (ch?.key) {
    case "cold":
      drawColdOpen(ctx, t);
      break;
    case "problem":
      drawProblem(ctx, t);
      break;
    case "intro":
      drawIntroducing(ctx, t);
      break;
    case "chat":
      drawChat(ctx, t);
      break;
    case "features":
      drawFeatures(ctx, t);
      break;
    case "how":
      drawHowItWorks(ctx, t);
      break;
    case "open":
      drawOpenSourceScene(ctx, t);
      break;
    case "cta":
      drawCTA(ctx, t);
      break;
    default:
      drawCTA(ctx, DURATION - 0.01);
  }

  drawChapterChip(ctx, t);
  drawWatermark(ctx, t);
}

/* ───────────────────────── Audio engine ───────────────────────── */

type AnyAudioContext = AudioContext & { state: AudioContextState };

class ExplainerAudio {
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
    this.master.gain.value = 0.85;
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

  pad(start: number, end: number) {
    const notes = [
      { f: 196.0, type: "sine" as OscillatorType, gain: 0.018 },
      { f: 246.94, type: "sine" as OscillatorType, gain: 0.014 },
      { f: 293.66, type: "sine" as OscillatorType, gain: 0.012 },
      { f: 98.0, type: "triangle" as OscillatorType, gain: 0.010 },
    ];
    notes.forEach((n, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(n.gain, start + 2.0);
      gain.gain.setValueAtTime(n.gain, end - 2.0);
      gain.gain.linearRampToValueAtTime(0, end);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.13 + i * 0.04;
      lfoGain.gain.value = 0.7;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(start);
      lfo.stop(end + 0.2);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(end + 0.2);

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

  chapterChime(when: number) {
    const notes = [659.25, 880.0, 1174.66];
    notes.forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.07, 1.4, 0.06, 0.012),
    );
  }

  /** Soft ping for incoming chat message. */
  messagePing(when: number, incoming: boolean) {
    const f = incoming ? 880 : 1174.66;
    this.envOsc("sine", f, when, 0.32, 0.055, 0.005);
    this.envOsc("triangle", f * 1.5, when + 0.04, 0.18, 0.025, 0.003);
  }

  /** Quick light typing tap. */
  typeTap(when: number) {
    this.envOsc("triangle", 1320, when, 0.06, 0.02, 0.002);
  }

  glint(when: number) {
    [1760, 2349.32].forEach((f, i) =>
      this.envOsc("triangle", f, when + i * 0.025, 0.22, 0.045, 0.004),
    );
  }

  warmPulse(when: number) {
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.4);
      },
      when,
      0.5,
      0.08,
      0.01,
    );
  }

  heartbeat(when: number) {
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      },
      when,
      0.22,
      0.085,
      0.01,
    );
    this.envOsc(
      "sine",
      (osc, t) => {
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
      },
      when + 0.28,
      0.22,
      0.075,
      0.01,
    );
  }

  lockClick(when: number) {
    this.envOsc("square", 1700, when, 0.04, 0.05, 0.001);
    this.envOsc("triangle", 800, when + 0.005, 0.08, 0.04, 0.002);
  }

  outroChime(when: number) {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.11, 1.8, 0.09, 0.018),
    );
  }
}

/**
 * Schedules the entire audio score at audioStart (an AudioContext
 * timestamp). Mirrors the timeline used by drawFrame.
 *
 * Audio offsets are scaled by 1/SPEED so the soundtrack stays glued
 * to the (sped-up) visuals.
 */
function scheduleAudio(engine: ExplainerAudio, audioStart: number) {
  // Convert a *timeline* offset (in seconds, the same units used by
  // CHAPTERS / draw* functions) into a real audio-clock time.
  const at = (offset: number) => audioStart + offset / SPEED;

  // Continuous pad for the whole piece.
  engine.pad(at(0), at(DURATION - 0.5));

  // Chapter transition chimes.
  CHAPTERS.forEach((c) => {
    if (c.start === 0) return;
    engine.chapterChime(at(c.start));
  });

  // Chapter offsets matching CHAPTERS array.
  const COLD = 0;
  const PROBLEM = 12;
  const INTRO = 30;
  const CHAT = 44;
  const FEAT = 72;
  const HOW = 132;
  const OPEN = 162;
  const CTA = 170;

  // Cold open accents.
  engine.glint(at(COLD + 0.5));
  engine.heartbeat(at(COLD + 4.0));
  engine.warmPulse(at(COLD + 7.5));

  // Problem chapter — warm pulses on tile reveals + metadata.
  for (let i = 0; i < 3; i++) {
    engine.warmPulse(at(PROBLEM + 1.8 + i * 0.22));
  }
  engine.warmPulse(at(PROBLEM + 8.2));
  engine.warmPulse(at(PROBLEM + 10.2));

  // Intro chapter — sparkle on logo arrival, glints on chips.
  engine.glint(at(INTRO + 0.2));
  engine.glint(at(INTRO + 0.9));
  for (let i = 0; i < 3; i++) {
    engine.glint(at(INTRO + 3.4 + i * 0.15));
  }

  // Chat chapter — taps on typing starts, soft pings on bubble appearance.
  CHAT_MESSAGES.forEach((m) => {
    for (let k = 0; k < 4; k++) {
      engine.typeTap(at(CHAT + m.typeStart + 0.25 + k * 0.16));
    }
    engine.messagePing(at(CHAT + m.appear), m.side === "left");
  });
  engine.glint(at(CHAT + 6.2)); // heart float
  engine.lockClick(at(CHAT + 18.2)); // screenshot toast

  // Features chapter — glint + lock click on each beat opening.
  FEATURES.forEach((f) => {
    engine.glint(at(FEAT + f.start + 0.1));
    engine.lockClick(at(FEAT + f.start + 0.35));
  });

  // How it works — heartbeat under the diagram, lock clicks on packet flight.
  engine.heartbeat(at(HOW + 2.4));
  engine.lockClick(at(HOW + 5.5));
  engine.lockClick(at(HOW + 7.0));
  engine.lockClick(at(HOW + 9.0));
  engine.lockClick(at(HOW + 10.5));
  for (let i = 0; i < 3; i++) {
    engine.heartbeat(at(HOW + 13 + i * 5));
  }

  // ── Open source proof scene ─────────────────────────────────
  // soft "vault unlocking" sweep as the GitHub mark scales up
  engine.envOsc(
    "sine",
    (osc, t) => {
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.5);
    },
    at(OPEN + 0.15),
    0.55,
    0.10,
    0.03,
  );
  // sparkle as the headline types in
  engine.glint(at(OPEN + 0.55));
  // AGPL chip + repo pill chime
  engine.envOsc("sine", 880, at(OPEN + 1.4), 0.18, 0.13, 0.01);
  engine.envOsc("sine", 1320, at(OPEN + 1.46), 0.28, 0.10, 0.02);
  // three quick chip ticks as proof chips slide in
  engine.typeTap(at(OPEN + 2.20));
  engine.typeTap(at(OPEN + 2.55));
  engine.typeTap(at(OPEN + 2.90));
  // soft confirming chime when the footer line lands
  engine.envOsc("sine", 660, at(OPEN + 3.4), 0.32, 0.10, 0.04);

  // CTA — final outro arpeggio.
  engine.outroChime(at(CTA + 3.6));
}

/* ───────────────────────── Recording helpers ───────────────────────── */

const FORMAT_CANDIDATES: { mimeType: string; ext: "mp4" | "webm" }[] = [
  { mimeType: "video/mp4;codecs=h264,aac", ext: "mp4" },
  { mimeType: "video/mp4", ext: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", ext: "webm" },
  { mimeType: "video/webm", ext: "webm" },
];

function pickRecordingFormat(): { mimeType: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of FORMAT_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/* ───────────────────────── Component ───────────────────────── */

type Status = "idle" | "playing" | "recording" | "ready" | "error";

export function ExplainerVideo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<ExplainerAudio | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [currentT, setCurrentT] = useState(0);
  const [muted, setMuted] = useState(false);
  const [download, setDownload] = useState<{
    url: string;
    ext: "mp4" | "webm";
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // Initial poster — render an early frame of the introducing chapter.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, CHAPTERS[2]!.start + 1.4);
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

  const ensureAudio = useCallback(async (): Promise<ExplainerAudio | null> => {
    try {
      if (!audioRef.current) audioRef.current = new ExplainerAudio();
      await audioRef.current.resume();
      audioRef.current.master.gain.value = muted ? 0 : 0.85;
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
      const tReal = (performance.now() - start) / 1000;
      // Visuals advance at SPEED× of real time so the timeline finishes
      // in REAL_DURATION wall-clock seconds.
      const frameT = Math.min(tReal * SPEED, DURATION);
      drawFrame(ctx, frameT);
      setProgress(clamp01(tReal / REAL_DURATION));
      setCurrentT(frameT);
      if (tReal < REAL_DURATION) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioRef.current?.stopAll();
  }, []);

  const play = useCallback(async () => {
    if (status === "playing" || status === "recording") {
      stopAnimation();
      setStatus("idle");
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
    audio?.stopAll();
    if (audio) scheduleAudio(audio, audio.ctx.currentTime + 0.1);
    setStatus("playing");
    setErrorMsg(null);
    runAnimation(() => setStatus("idle"));
  }, [ensureAudio, runAnimation, status, stopAnimation]);

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
        videoBitsPerSecond: 3_500_000,
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
    scheduleAudio(audio, audio.ctx.currentTime + 0.1);
    recorder.start(500);
    runAnimation(() => {
      setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }, 280);
    });
  }, [download, ensureAudio, runAnimation, status]);

  const triggerDownload = useCallback(() => {
    if (!download) return;
    const a = document.createElement("a");
    a.href = download.url;
    a.download = `veilchat-explainer.${download.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [download]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.master.gain.value = muted ? 0 : 0.85;
    }
  }, [muted]);

  const isBusy = status === "playing" || status === "recording";
  const activeChapterIdx =
    CHAPTERS.findIndex((c) => currentT >= c.start && currentT < c.end) || 0;

  return (
    <section
      id="watch"
      className="relative py-20 sm:py-28 px-5 sm:px-8 overflow-hidden"
      style={{ backgroundColor: "#FCF5EB" }}
      data-no-tap-scroll
    >
      {/* Soft ambient backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
      >
        <div
          className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(217,245,223,0.65), rgba(217,245,223,0) 65%)",
          }}
        />
        <div
          className="absolute bottom-0 -right-32 w-[480px] h-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(104,186,127,0.18), rgba(104,186,127,0) 65%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.18em] uppercase text-[#2E6F40] bg-[#D9F5DF] border border-[#68BA7F]/40 rounded-full px-3 py-1.5">
            New · 2-minute explainer · drawn live with sound
          </div>
          <h2
            className="mt-5 text-[32px] sm:text-[42px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#1A2D22]"
            style={{
              fontFamily: "'Fraunces', 'Inter', serif",
              fontWeight: 600,
            }}
          >
            The full story of VeilChat,{" "}
            <span className="italic" style={{ color: "#2E6F40" }}>
              in two minutes.
            </span>
          </h2>
          <p className="mt-4 text-[16px] sm:text-[18px] text-[#506A57] max-w-2xl mx-auto leading-[1.55]">
            A typography-driven walkthrough of what VeilChat is, the
            problem it solves, what a real conversation looks like, every
            core feature, how the encryption works, and the open-source
            proof that backs every claim. Generated fresh on your device
            with a custom soundtrack — press record to download a real
            video file with sound.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Player */}
          <div className="lg:col-span-8 order-2 lg:order-1">
            <div
              className="relative mx-auto rounded-[28px] overflow-hidden border border-[#1A2D22]/15 bg-[#0F1B14] shadow-[0_50px_100px_-40px_rgba(26,45,34,0.5),0_20px_40px_-20px_rgba(15,27,20,0.25)]"
              data-no-tap-scroll
              style={{ aspectRatio: `${VIDEO_W} / ${VIDEO_H}` }}
            >
              <canvas
                ref={canvasRef}
                width={VIDEO_W}
                height={VIDEO_H}
                className="block w-full h-full bg-[#FCF6EC]"
                aria-label="VeilChat 2-minute explainer video"
              />

              {/* Mute toggle */}
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

              {/* Progress + time */}
              <div className="absolute left-0 right-0 bottom-0">
                <div className="flex items-center justify-between px-4 pb-2 text-[11px] font-semibold tracking-wide text-white/70">
                  <span>{formatTime(currentT)}</span>
                  <span>{formatTime(DURATION)}</span>
                </div>
                <div className="h-1 bg-white/10">
                  <div
                    className="h-full bg-[#68BA7F] transition-[width] duration-100"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>

              {/* Big play overlay when idle */}
              {status === "idle" && progress === 0 && (
                <button
                  type="button"
                  onClick={play}
                  aria-label="Play the VeilChat explainer"
                  data-no-tap-scroll
                  className="group absolute inset-0 grid place-items-center bg-gradient-to-br from-[#0F1B14]/35 via-transparent to-[#0F1B14]/30"
                >
                  <span className="grid place-items-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/95 text-[#2E6F40] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </button>
              )}
            </div>

            {/* Player controls */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-center">
              <button
                type="button"
                onClick={play}
                disabled={status === "recording"}
                className={`inline-flex items-center justify-center gap-2.5 font-semibold text-[15px] px-6 py-3.5 rounded-full transition-all ${
                  isBusy && status === "playing"
                    ? "bg-white border border-[#1A2D22]/15 text-[#1A2D22] hover:bg-[#FCF6EC]"
                    : "bg-gradient-to-b from-[#3A8550] to-[#2E6F40] hover:from-[#2E6F40] hover:to-[#1A2D22] text-white shadow-[0_18px_36px_-14px_rgba(46,111,64,0.55),inset_0_1px_0_rgba(255,255,255,0.22)]"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {status === "playing" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    Stop preview
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    Play preview
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={recordAndDownload}
                disabled={!supported || isBusy}
                className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-[#FCF6EC] border border-[#1A2D22]/15 text-[#1A2D22] font-semibold text-[15px] px-6 py-3.5 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-4px_rgba(15,27,20,0.08)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_12px_28px_-12px_rgba(46,111,64,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#D45C3F]/15">
                  <span className="block w-2 h-2 rounded-full bg-[#D45C3F]" />
                </span>
                {status === "recording" ? "Recording…" : "Record video file (with sound)"}
              </button>

              {download && (
                <button
                  type="button"
                  onClick={triggerDownload}
                  className="inline-flex items-center justify-center gap-2.5 bg-[#1A2D22] hover:bg-[#0F1B14] text-white font-semibold text-[15px] px-6 py-3.5 rounded-full transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v12" />
                    <path d="M6 12l6 6 6-6" />
                    <path d="M5 20h14" />
                  </svg>
                  Download .{download.ext}
                </button>
              )}
            </div>

            {!supported && (
              <p className="mt-4 text-center text-[13px] text-[#D45C3F]">
                Your browser doesn't support recording. The preview still
                plays — try the latest Chrome, Edge, Safari, or Firefox to
                download the file.
              </p>
            )}
            {errorMsg && (
              <p className="mt-4 text-center text-[13px] text-[#D45C3F]">{errorMsg}</p>
            )}
            {status === "recording" && (
              <p className="mt-4 text-center text-[13px] text-[#506A57]">
                Generating a real video file with sound. This takes the
                full {Math.round(DURATION / 60)} minutes — keep this tab
                open and active.
              </p>
            )}
          </div>

          {/* Chapter list + script download */}
          <aside className="lg:col-span-4 order-1 lg:order-2">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#506A57]/70 mb-3">
              Chapters
            </div>
            <ol className="space-y-2">
              {CHAPTERS.map((c, i) => {
                const active = i === activeChapterIdx && (status === "playing" || status === "recording");
                return (
                  <li
                    key={c.key}
                    className={`flex items-baseline gap-3 rounded-2xl px-4 py-3 border transition-all ${
                      active
                        ? "bg-[#1A2D22] border-transparent shadow-[0_10px_24px_-12px_rgba(26,45,34,0.45)]"
                        : "bg-white border-[#1A2D22]/10"
                    }`}
                  >
                    <span
                      className={`text-[10.5px] font-bold tracking-[0.18em] uppercase tabular-nums ${
                        active ? "text-[#D9F5DF]" : "text-[#2E6F40]"
                      }`}
                    >
                      {formatTime(c.start)}
                    </span>
                    <span
                      className={`text-[14px] font-semibold leading-tight flex-1 ${
                        active ? "text-white" : "text-[#1A2D22]"
                      }`}
                    >
                      {c.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <a
              href="/docs/veilchat-explainer-script.md"
              download="VeilChat-Explainer-Script.md"
              className="mt-5 inline-flex items-center justify-center gap-2 w-full bg-white hover:bg-[#FCF6EC] border border-[#1A2D22]/12 text-[#1A2D22] font-semibold text-[14px] px-5 py-3 rounded-full transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              Download the full narration script
            </a>

            <p className="mt-4 text-[12.5px] text-[#506A57]/75 leading-relaxed">
              The video is rendered live in your browser — no upload, no
              tracking. Press <strong>Record</strong> to capture it as a
              real .mp4 (or .webm in some browsers) file with the music
              and accents baked in.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
