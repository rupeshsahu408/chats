import { useCallback, useEffect, useRef, useState } from "react";

/**
 * VeilChat — Full 5-minute animated explainer video.
 *
 * Renders a 1280x720 landscape canvas at 30 fps over a 300-second
 * timeline, with a synchronised Web Audio score (ambient pad + soft
 * chapter chimes + accents). The MediaRecorder API is used to capture
 * the canvas + the audio destination stream into a real downloadable
 * .mp4 / .webm video file with sound.
 *
 * No celebrity, no avatar, no human face — typography-driven motion
 * graphics that explain the product end to end.
 *
 * Chapters (timestamps in seconds):
 *   1.   0 – 25   Cold open
 *   2.  25 – 60   The metadata problem
 *   3.  60 – 90   Introducing VeilChat
 *   4.  90 – 195  Core features (six feature beats)
 *   5. 195 – 250  How it works (architecture)
 *   6. 250 – 280  Honest analysis
 *   7. 280 – 300  Call to action
 */

/* ───────────────────────── Constants ───────────────────────── */

const VIDEO_W = 1280;
const VIDEO_H = 720;
const FPS = 30;
const DURATION = 300; // 5:00

const CREAM = "#FCF5EB";
const CREAM_2 = "#F4E9D6";
const FOREST = "#2E6F40";
const FOREST_DEEP = "#1F5230";
const DARK = "#253D2C";
const PALE = "#CFFFDC";
const PALE_2 = "#E5FFEC";
const MID = "#3C5A47";
const MID_SOFT = "#6B8474";
const ACCENT = "#68BA7F";
const WARM = "#C9492E";
const WARM_DIM = "#8C2B14";

type Chapter = {
  key: string;
  start: number;
  end: number;
  label: string;
};

const CHAPTERS: Chapter[] = [
  { key: "cold", start: 0, end: 25, label: "Cold open" },
  { key: "problem", start: 25, end: 60, label: "The privacy problem" },
  { key: "intro", start: 60, end: 90, label: "Introducing VeilChat" },
  { key: "features", start: 90, end: 195, label: "Core features" },
  { key: "how", start: 195, end: 250, label: "How it works" },
  { key: "analysis", start: 250, end: 280, label: "Honest analysis" },
  { key: "cta", start: 280, end: 300, label: "Get VeilChat" },
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
const phase = (t: number, start: number, end: number) =>
  clamp01((t - start) / (end - start));

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

function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: string | number = 600,
  family: "sans" | "serif" = "sans",
) {
  const fam =
    family === "serif"
      ? "'Fraunces', 'Times New Roman', serif"
      : "'Inter', 'Helvetica Neue', Arial, sans-serif";
  ctx.font = `${weight} ${size}px ${fam}`;
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

/* Draw text staggering character-by-character with a cubic ease. */
function drawStaggered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  localT: number,
  charDelay = 0.025,
  duration = 0.55,
  align: CanvasTextAlign = "left",
) {
  ctx.textAlign = align;
  const chars = [...text];
  if (align === "center") {
    const total = ctx.measureText(text).width;
    let cursor = x - total / 2;
    chars.forEach((ch, i) => {
      const start = i * charDelay;
      const p = clamp01((localT - start) / duration);
      const e = easeOut(p);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(cursor, y + (1 - e) * 18);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      cursor += ctx.measureText(ch).width;
    });
  } else if (align === "right") {
    const total = ctx.measureText(text).width;
    let cursor = x - total;
    chars.forEach((ch, i) => {
      const start = i * charDelay;
      const p = clamp01((localT - start) / duration);
      const e = easeOut(p);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(cursor, y + (1 - e) * 18);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      cursor += ctx.measureText(ch).width;
    });
  } else {
    let cursor = x;
    chars.forEach((ch, i) => {
      const start = i * charDelay;
      const p = clamp01((localT - start) / duration);
      const e = easeOut(p);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(cursor, y + (1 - e) * 18);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      cursor += ctx.measureText(ch).width;
    });
  }
}

/* Draw multi-line wrapped text with a soft fade-up per line. */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  localT: number,
  lineDelay = 0.18,
  align: CanvasTextAlign = "left",
) {
  ctx.textAlign = align;
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((ln, i) => {
    const start = i * lineDelay;
    const p = clamp01((localT - start) / 0.7);
    const e = easeOut(p);
    ctx.save();
    ctx.globalAlpha = e;
    ctx.translate(0, (1 - e) * 14);
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
    { hue: PALE, size: 520, speed: 0.04, phase: 0 },
    { hue: ACCENT, size: 460, speed: 0.035, phase: 1.7 },
    { hue: "#E8DCC4", size: 540, speed: 0.028, phase: 3.1 },
  ];
  blobs.forEach((b) => {
    const cx = VIDEO_W * (0.5 + 0.4 * Math.sin(t * b.speed + b.phase));
    const cy = VIDEO_H * (0.5 + 0.32 * Math.cos(t * b.speed * 0.8 + b.phase));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.size);
    g.addColorStop(0, `${b.hue}55`);
    g.addColorStop(1, `${b.hue}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  });

  // Subtle dot grid.
  ctx.save();
  ctx.fillStyle = `${MID_SOFT}14`;
  for (let gy = 32; gy < VIDEO_H; gy += 64) {
    for (let gx = 32; gx < VIDEO_W; gx += 64) {
      fillCircle(ctx, gx, gy, 1.2);
    }
  }
  ctx.restore();
}

/* Always-on ambient floaters: small icons (locks, dots) drifting up. */
function drawAmbientFloaters(ctx: CanvasRenderingContext2D, t: number) {
  const motes = 14;
  for (let i = 0; i < motes; i++) {
    const seed = i * 137.5;
    const cycle = 18 + (i % 5) * 4;
    const local = ((t + seed * 0.03) % cycle) / cycle;
    const x = ((seed * 73) % VIDEO_W) + Math.sin(t * 0.3 + i) * 24;
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
 * VeilChat brand mark — the rounded forest-green square with a white
 * checkmark. Drawn at any scale, opacity, and centered on (cx, cy).
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
  ctx.fillStyle = "#fff";
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
  ctx.strokeStyle = "#fff";
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
  // Shackle.
  ctx.lineWidth = size * 0.1;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.2, w * 0.4, Math.PI, 0);
  ctx.stroke();
  // Body.
  roundRect(ctx, cx - w / 2, cy - h * 0.15, w, h, w * 0.18);
  ctx.fillStyle = color;
  ctx.fill();
  // Keyhole.
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
  // Tail.
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.18, cy + h * 0.4);
  ctx.lineTo(cx - w * 0.32, cy + h * 0.62);
  ctx.lineTo(cx - w * 0.04, cy + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawKeyIcon(
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
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  // Bow.
  ctx.beginPath();
  ctx.arc(cx - size * 0.3, cy, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  // Shaft.
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.02, cy);
  ctx.lineTo(cx + size * 0.55, cy);
  ctx.stroke();
  // Teeth.
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.42, cy);
  ctx.lineTo(cx + size * 0.42, cy + size * 0.18);
  ctx.moveTo(cx + size * 0.55, cy);
  ctx.lineTo(cx + size * 0.55, cy + size * 0.22);
  ctx.stroke();
  ctx.restore();
}

function drawPhoneIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color = DARK,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Body.
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, w * 0.18);
  ctx.fillStyle = color;
  ctx.fill();
  // Screen.
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
    // status dot.
    ctx.fillStyle = i === 1 ? ACCENT : "#fff";
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
  ctx.strokeStyle = "#fff";
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
  // outer ring.
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  // hand.
  const ang = -Math.PI / 2 + spin * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ang) * size * 0.36, cy + Math.sin(ang) * size * 0.36);
  ctx.stroke();
  // top knob.
  ctx.fillStyle = color;
  roundRect(ctx, cx - size * 0.08, cy - size * 0.55, size * 0.16, size * 0.08, 2);
  ctx.fill();
  ctx.restore();
}

function drawGroupIcon(
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
  // Three overlapping head-and-shoulder silhouettes.
  const positions = [
    { x: cx - size * 0.36, y: cy, s: 0.85 },
    { x: cx + size * 0.36, y: cy, s: 0.85 },
    { x: cx, y: cy - size * 0.04, s: 1 },
  ];
  positions.forEach((p) => {
    fillCircle(ctx, p.x, p.y - size * 0.16 * p.s, size * 0.16 * p.s);
    roundRect(
      ctx,
      p.x - size * 0.22 * p.s,
      p.y + size * 0.02 * p.s,
      size * 0.44 * p.s,
      size * 0.26 * p.s,
      size * 0.12 * p.s,
    );
    ctx.fill();
  });
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

/* ───────────────────────── Section labels ───────────────────────── */

/**
 * Section indicator chip in the top-left — chapter label plus a tiny
 * progress dot showing position within the chapter.
 */
function drawChapterChip(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS.find((c) => t >= c.start && t < c.end) ?? CHAPTERS[0]!;
  const localT = t - ch.start;
  const enter = clamp01(localT / 0.5);
  const exit = clamp01((ch.end - t) / 0.5);
  const a = Math.min(enter, exit) * 0.85;
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  setFont(ctx, 14, 700);
  const label = ch.label.toUpperCase();
  const labelW = ctx.measureText(label).width;
  const padX = 14;
  const padY = 8;
  const dotW = 22;
  const w = labelW + padX * 2 + dotW + 12;
  const h = 32;
  const x = 56;
  const y = 48;
  // pill.
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "#ffffffd9";
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

/* Watermark in the bottom-right with the wordmark + tiny URL. */
function drawWatermark(ctx: CanvasRenderingContext2D, t: number) {
  const a = 0.45 + 0.1 * Math.sin(t * 0.6);
  ctx.save();
  ctx.globalAlpha = a;
  drawLogo(ctx, VIDEO_W - 78, VIDEO_H - 60, 28);
  setFont(ctx, 14, 700);
  ctx.fillStyle = DARK;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText("VeilChat", VIDEO_W - 100, VIDEO_H - 64);
  setFont(ctx, 11, 500);
  ctx.fillStyle = MID;
  ctx.fillText("private by default", VIDEO_W - 100, VIDEO_H - 48);
  ctx.restore();
}

/* ───────────────────────── Chapter 1 — Cold open ───────────────────────── */

function drawColdOpen(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[0]!;
  const lt = t - ch.start;

  // Lock that morphs into a chat bubble. Lifecycle:
  //   0–6s  lock pulses center, line 1 staggers in below
  //   6–14s lock morphs into chat bubble; line 2 below
  //   14–25s bubble pulses; line 3 below with WARM accent
  const morph = clamp01((lt - 6) / 1.6);
  const cx = VIDEO_W / 2;
  const iconY = 230;
  const pulse = 1 + Math.sin(lt * 1.1) * 0.025;
  const baseSize = 130;

  // Lock fades while morph progresses.
  const lockAlpha = (1 - morph) * band(lt, 0.4, 25, 0.6, 0.4);
  drawLockIcon(ctx, cx, iconY, baseSize * pulse, FOREST, lockAlpha);
  // Bubble fades in as morph progresses.
  const bubbleAlpha = morph * band(lt, 0.4, 25, 0.6, 0.4);
  drawChatBubbleIcon(ctx, cx, iconY, baseSize * pulse, FOREST, bubbleAlpha);

  // Concentric pulse rings to make the icon feel alive throughout.
  for (let i = 0; i < 3; i++) {
    const ringT = ((lt + i * 0.7) % 2.4) / 2.4;
    const r = 80 + ringT * 120;
    const a = (1 - ringT) * 0.18;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = FOREST;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, iconY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Three lines, each with its own window.
  const lineWindows: { text: string; start: number; end: number; warm?: boolean }[] = [
    { text: "Every day, you have private conversations.", start: 1.5, end: 7.5 },
    { text: "The kind you trust to one person.", start: 8.5, end: 14.5 },
    { text: "But you're not the only one in the room.", start: 16.0, end: 24.5, warm: true },
  ];

  lineWindows.forEach((w) => {
    if (lt < w.start) return;
    const local = lt - w.start;
    const out = clamp01((w.end - lt) / 0.8);
    setFont(ctx, 44, 600, "serif");
    ctx.fillStyle = w.warm ? WARM_DIM : DARK;
    ctx.save();
    ctx.globalAlpha = out;
    drawStaggered(ctx, w.text, cx, 460, local, 0.022, 0.5, "center");
    ctx.restore();
  });

  // Subtle ascender line under the icon for grounding.
  const lineA = band(lt, 0.6, 24.6, 0.6, 0.5) * 0.18;
  ctx.save();
  ctx.globalAlpha = lineA;
  ctx.strokeStyle = FOREST;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 90, 330);
  ctx.lineTo(cx + 90, 330);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── Chapter 2 — The problem ───────────────────────── */

function drawProblem(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[1]!;
  const lt = t - ch.start;

  // Layout: headline at top, three rectangular "messenger" tiles in
  // the middle leaking metadata tags, big METADATA word at bottom.
  const headlineWindow = band(lt, 0.4, 32, 0.7, 0.6);

  // Headline.
  ctx.save();
  ctx.globalAlpha = headlineWindow;
  setFont(ctx, 52, 600, "serif");
  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";
  drawStaggered(
    ctx,
    "Most messengers leak everything",
    VIDEO_W / 2,
    100,
    lt,
    0.018,
    0.45,
    "center",
  );
  if (lt > 1.2) {
    setFont(ctx, 52, 600, "serif");
    ctx.fillStyle = FOREST;
    drawStaggered(
      ctx,
      "except your message.",
      VIDEO_W / 2,
      164,
      lt - 1.2,
      0.022,
      0.45,
      "center",
    );
  }
  ctx.restore();

  // Three messenger tiles.
  const tileY = 280;
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
      leaks: ["Group memberships", "Last-seen", "Linked email"],
    },
  ];

  tiles.forEach((tile, i) => {
    const enter = clamp01((lt - 3 - i * 0.4) / 0.7);
    const e = easeOut(enter);
    if (e <= 0.01) return;
    const x = startX + i * (tileW + gap);
    const offsetY = (1 - e) * 30;

    ctx.save();
    ctx.globalAlpha = e;

    // Card.
    roundRect(ctx, x, tileY + offsetY, tileW, tileH, 22);
    ctx.fillStyle = "#ffffffee";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `${DARK}1a`;
    ctx.stroke();

    // Header bar with mock device chrome.
    ctx.fillStyle = `${MID}10`;
    roundRect(ctx, x + 12, tileY + 12 + offsetY, tileW - 24, 38, 12);
    ctx.fill();
    setFont(ctx, 14, 700);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(tile.label, x + 28, tileY + 31 + offsetY);

    // Leaking tags appear staggered and tinted warm to feel like alerts.
    tile.leaks.forEach((leak, j) => {
      const leakStart = 4 + i * 0.4 + j * 0.45;
      const lp = clamp01((lt - leakStart) / 0.55);
      if (lp <= 0) return;
      const le = easeOut(lp);
      const ty = tileY + 70 + j * 42 + offsetY + (1 - le) * 8;
      ctx.save();
      ctx.globalAlpha = e * le;
      // Warm tag.
      setFont(ctx, 14, 600);
      const tagW = ctx.measureText(leak).width + 36;
      roundRect(ctx, x + 24, ty, tagW, 30, 14);
      ctx.fillStyle = `${WARM}18`;
      ctx.fill();
      ctx.strokeStyle = `${WARM}55`;
      ctx.lineWidth = 1;
      ctx.stroke();
      // dot.
      ctx.fillStyle = WARM;
      fillCircle(ctx, x + 24 + 14, ty + 15, 4);
      ctx.fillStyle = WARM_DIM;
      ctx.textBaseline = "middle";
      ctx.fillText(leak, x + 24 + 24, ty + 16);
      ctx.restore();

      // Outgoing arrow leaking to the right edge.
      if (le > 0.6) {
        const arrowP = clamp01((lt - leakStart - 0.3) / 1.6);
        ctx.save();
        ctx.globalAlpha = e * (1 - arrowP) * 0.65;
        ctx.strokeStyle = WARM;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x + 24 + tagW, ty + 15);
        ctx.lineTo(x + 24 + tagW + 60 + arrowP * 80, ty + 15);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    ctx.restore();
  });

  // Bottom: huge METADATA word reveal.
  if (lt > 14) {
    const local = lt - 14;
    const out = clamp01((30 - lt) / 1.2);
    setFont(ctx, 96, 800, "sans");
    ctx.fillStyle = WARM_DIM;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = out;
    drawStaggered(
      ctx,
      "M E T A D A T A",
      VIDEO_W / 2,
      612,
      local,
      0.06,
      0.6,
      "center",
    );
    ctx.restore();

    if (lt > 16) {
      setFont(ctx, 22, 500, "sans");
      ctx.fillStyle = MID;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.save();
      ctx.globalAlpha = out * easeOut(clamp01((lt - 16) / 1.2));
      ctx.fillText(
        "Who you talk to.  When.  Where from.  How often.",
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
  const cx = VIDEO_W / 2;

  // Logo lifts in from below with bounce, settles at center.
  const logoEnter = clamp01(lt / 1.4);
  const logoY = lerp(VIDEO_H + 200, 250, easeOut(logoEnter));
  const logoScale = lerp(0.6, 1, easeOut(logoEnter));
  const float = Math.sin(lt * 0.7) * 6;
  drawLogo(ctx, cx, logoY + float, 180 * logoScale, easeOut(logoEnter));

  // Wordmark.
  if (lt > 1.2) {
    const local = lt - 1.2;
    setFont(ctx, 92, 700, "serif");
    ctx.fillStyle = DARK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    drawStaggered(ctx, "VeilChat", cx, 410, local, 0.05, 0.6, "center");
  }

  // Tagline.
  if (lt > 3.2) {
    const local = lt - 3.2;
    const out = clamp01((28 - lt) / 1.0);
    setFont(ctx, 30, 500, "serif");
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = out;
    drawWrapped(
      ctx,
      "Message privately. Built for the people you actually trust.",
      cx,
      490,
      900,
      42,
      local,
      0.2,
      "center",
    );
    ctx.restore();
  }

  // Chips: open source / no phone / free forever.
  const chipsStart = 6;
  if (lt > chipsStart) {
    const chips = [
      { label: "Open source · AGPL-3.0" },
      { label: "No phone number" },
      { label: "Free, forever" },
    ];
    const chipY = 590;
    setFont(ctx, 16, 700);
    const widths = chips.map((c) => ctx.measureText(c.label).width + 44);
    const gap = 18;
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let cursor = (VIDEO_W - totalW) / 2;
    chips.forEach((c, i) => {
      const local = lt - chipsStart - i * 0.25;
      const p = clamp01(local / 0.6);
      const e = easeOut(p);
      if (e <= 0) return;
      const out = clamp01((28 - lt) / 1.0);
      const w = widths[i]!;
      ctx.save();
      ctx.globalAlpha = e * out;
      ctx.translate(0, (1 - e) * 12);
      roundRect(ctx, cursor, chipY, w, 38, 19);
      ctx.fillStyle = PALE;
      ctx.fill();
      ctx.strokeStyle = `${ACCENT}88`;
      ctx.lineWidth = 1;
      ctx.stroke();
      // dot.
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

/* ───────────────────────── Chapter 4 — Core features ───────────────────────── */

type FeatureBeat = {
  start: number; // seconds within chapter
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
    duration: 17,
    title: "End-to-end encrypted by default",
    body:
      "Every message, voice call, photo, and file is locked on your device with a key only you and your friend share. Not on our servers. Not in our backups. Nowhere else.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawLockIcon(ctx, cx, cy, size, FOREST, alpha),
  },
  {
    start: 17,
    duration: 17,
    title: "No phone number required",
    body:
      "Sign up with a username — that's it. There's no number that ties your conversations to your real-world identity, and no number for someone to look you up with.",
    drawIcon: (ctx, cx, cy, size, alpha, lt) => {
      // Ghost-phone with a strikethrough.
      drawPhoneIcon(ctx, cx, cy, size * 0.7, size, DARK, alpha);
      ctx.save();
      ctx.globalAlpha = alpha;
      const sweep = clamp01(lt / 0.6);
      ctx.strokeStyle = WARM;
      ctx.lineWidth = size * 0.06;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.6, cy + size * 0.5);
      ctx.lineTo(
        cx - size * 0.6 + sweep * size * 1.2,
        cy + size * 0.5 - sweep * size,
      );
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    start: 34,
    duration: 17,
    title: "Disappearing messages",
    body:
      "Pick a timer — five seconds, an hour, a week — and your message is gone from both devices when it expires. No screenshots. No permanent record.",
    drawIcon: (ctx, cx, cy, size, alpha, lt) =>
      drawTimerIcon(ctx, cx, cy, size, FOREST, alpha, lt * 0.8),
  },
  {
    start: 51,
    duration: 17,
    title: "Verified contacts",
    body:
      "Compare a small safety code with your friend in person or over a call. If the codes match, you know the conversation is sealed between exactly the two of you.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawCheckBadge(ctx, cx, cy, size, ACCENT, alpha),
  },
  {
    start: 68,
    duration: 17,
    title: "Group chats, voice and video calls",
    body:
      "Same encryption protocol, no exceptions. Group conversations, voice notes, and video calls all travel sealed end to end.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawGroupIcon(ctx, cx, cy, size, FOREST, alpha),
  },
  {
    start: 85,
    duration: 20,
    title: "Works on every device",
    body:
      "Phone, tablet, laptop. Android, iOS, web, desktop. Install it as an app from your browser in two seconds — no app store account, no review queue.",
    drawIcon: (ctx, cx, cy, size, alpha) =>
      drawDevicesIcon(ctx, cx, cy, size, FOREST, alpha),
  },
];

function drawFeatures(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[3]!;
  const lt = t - ch.start;

  // Section header — small, persistent.
  const headerA = band(lt, 0, ch.end - ch.start, 1.0, 1.0);
  ctx.save();
  ctx.globalAlpha = headerA * 0.85;
  setFont(ctx, 14, 700);
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("CORE FEATURES", 92, 120);
  ctx.restore();

  // Step indicator dots (1..6) at top-right.
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
    const enter = clamp01(localT / 0.5);
    const exit = clamp01((f.duration - localT) / 0.4);
    const a = Math.min(enter, exit);
    if (a <= 0.01) return;

    // Slight slide direction alternates each beat to add rhythm.
    const dir = i % 2 === 0 ? 1 : -1;
    const slide = (1 - enter) * 60 * dir;

    // Layout: icon left third, text right two-thirds.
    const iconCx = 360;
    const iconCy = 380;
    const iconSize = 220;

    // Icon backplate.
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(slide, 0);
    const plateScale = 0.94 + Math.sin(localT * 1.4) * 0.025;
    roundRect(
      ctx,
      iconCx - 150 * plateScale,
      iconCy - 150 * plateScale,
      300 * plateScale,
      300 * plateScale,
      40,
    );
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = `${DARK}12`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // soft glow.
    const g = ctx.createRadialGradient(
      iconCx,
      iconCy,
      20,
      iconCx,
      iconCy,
      220,
    );
    g.addColorStop(0, `${ACCENT}22`);
    g.addColorStop(1, `${ACCENT}00`);
    ctx.fillStyle = g;
    ctx.fillRect(iconCx - 220, iconCy - 220, 440, 440);
    f.drawIcon(ctx, iconCx, iconCy, iconSize, a, Math.max(0, localT));
    ctx.restore();

    // Index label "0X / 06".
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.translate(-slide, 0);
    setFont(ctx, 14, 700, "sans");
    ctx.fillStyle = MID;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(
      `${String(i + 1).padStart(2, "0")} / ${String(FEATURES.length).padStart(
        2,
        "0",
      )}`,
      640,
      210,
    );
    ctx.restore();

    // Title.
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(-slide, 0);
    setFont(ctx, 50, 600, "serif");
    ctx.fillStyle = DARK;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    drawWrapped(ctx, f.title, 640, 246, 540, 58, localT, 0.12, "left");
    ctx.restore();

    // Body.
    if (localT > 0.6) {
      const bodyT = localT - 0.6;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(-slide, 0);
      setFont(ctx, 22, 400, "sans");
      ctx.fillStyle = MID;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      drawWrapped(ctx, f.body, 640, 408, 540, 36, bodyT, 0.08, "left");
      ctx.restore();
    }

    // Underline accent that draws across.
    if (localT > 0.2) {
      const drawP = clamp01((localT - 0.2) / 0.8);
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

/* ───────────────────────── Chapter 5 — How it works ───────────────────────── */

function drawHowItWorks(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[4]!;
  const lt = t - ch.start;

  // Heading.
  setFont(ctx, 48, 600, "serif");
  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.save();
  ctx.globalAlpha = band(lt, 0.3, ch.end - ch.start, 0.7, 0.6);
  drawStaggered(ctx, "How it works", 92, 110, lt - 0.3, 0.025, 0.5, "left");
  ctx.restore();

  // Sub heading.
  if (lt > 1.4) {
    setFont(ctx, 22, 500);
    ctx.fillStyle = MID;
    ctx.textBaseline = "top";
    ctx.save();
    ctx.globalAlpha = band(lt - 1.4, 0, 50, 0.6, 0.6);
    ctx.fillText("Three things happen the moment you press send.", 92, 174);
    ctx.restore();
  }

  // Diagram: device  →  server (locked)  →  device.
  // Layout coordinates.
  const baseY = 410;
  const phoneA_x = 220;
  const phoneB_x = VIDEO_W - 220;
  const serverX = VIDEO_W / 2;
  const phoneW = 130;
  const phoneH = 180;

  // Persistent phones + server (always present once stage 0 begins).
  const stage = lt;
  const stage0In = clamp01((stage - 3) / 0.8);
  const stageA = easeOut(stage0In);
  drawPhoneIcon(ctx, phoneA_x, baseY, phoneW, phoneH, DARK, stageA);
  drawPhoneIcon(ctx, phoneB_x, baseY, phoneW, phoneH, DARK, stageA);
  drawServerIcon(ctx, serverX, baseY - 10, 120, MID, stageA);

  // Captions under each.
  setFont(ctx, 14, 700);
  ctx.fillStyle = MID;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.save();
  ctx.globalAlpha = stageA;
  ctx.fillText("YOUR DEVICE", phoneA_x, baseY + phoneH / 2 + 18);
  ctx.fillText("VEILCHAT SERVER", serverX, baseY + 70);
  ctx.fillText("FRIEND'S DEVICE", phoneB_x, baseY + phoneH / 2 + 18);
  ctx.restore();

  // Stage 1: typed message appears in left phone.
  if (lt > 5) {
    const m = clamp01((lt - 5) / 0.6);
    ctx.save();
    ctx.globalAlpha = m * stageA;
    setFont(ctx, 12, 600);
    ctx.fillStyle = "#fff";
    roundRect(ctx, phoneA_x - phoneW / 2 + 16, baseY - 30, phoneW - 32, 22, 8);
    ctx.fillStyle = FOREST;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("Hello!", phoneA_x, baseY - 19);
    ctx.restore();
  }

  // Stage 2: encryption seal → packet flies to server.
  // Stage 3: at the server, content is shown as gibberish + lock badge.
  // Stage 4: packet flies to right phone, decrypts to "Hello!".
  // The flight is keyed off lt: depart 7s, reach server 9s, depart 11s, arrive 13s.
  const flightAlpha = stageA;
  const drawFlight = (
    fromX: number,
    toX: number,
    startSec: number,
    durSec: number,
    encrypted: boolean,
  ) => {
    if (lt < startSec) return;
    const p = clamp01((lt - startSec) / durSec);
    if (p >= 1) return;
    const e = easeInOut(p);
    const x = lerp(fromX, toX, e);
    const arc = baseY - 30 - Math.sin(p * Math.PI) * 80;
    ctx.save();
    ctx.globalAlpha = flightAlpha;
    if (encrypted) {
      // Sealed lozenge.
      roundRect(ctx, x - 60, arc - 18, 120, 36, 18);
      const grd = ctx.createLinearGradient(x - 60, arc, x + 60, arc);
      grd.addColorStop(0, FOREST);
      grd.addColorStop(1, FOREST_DEEP);
      ctx.fillStyle = grd;
      ctx.fill();
      // tiny lock + scrambled text.
      drawLockIcon(ctx, x - 38, arc, 24, "#fff", 1);
      setFont(ctx, 11, 700, "sans");
      ctx.fillStyle = "#ffffffcc";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("· · · · · ·", x - 18, arc);
      // motion-trail dashes.
      ctx.strokeStyle = `${FOREST}44`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fromX + 70, baseY - 30);
      ctx.lineTo(x - 70, arc);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Plain bubble (only used after decryption — unused here).
      roundRect(ctx, x - 50, arc - 14, 100, 28, 14);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      setFont(ctx, 12, 600);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText("Hello!", x, arc);
    }
    ctx.restore();
  };

  drawFlight(phoneA_x, serverX, 7, 2.0, true);
  drawFlight(serverX, phoneB_x, 11, 2.0, true);

  // At the server (between 9s and 11s) show the "we never see this" beat.
  if (lt > 9 && lt < 11.6) {
    const local = lt - 9;
    const a = easeOut(clamp01(local / 0.4)) * easeOut(clamp01((11.6 - lt) / 0.4));
    ctx.save();
    ctx.globalAlpha = a;
    setFont(ctx, 14, 700);
    ctx.fillStyle = WARM_DIM;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("· · · · UNREADABLE HERE · · · ·", serverX, baseY - 110);
    // small server-pulse ring.
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
  if (lt > 13) {
    const m = clamp01((lt - 13) / 0.6);
    ctx.save();
    ctx.globalAlpha = m * stageA;
    setFont(ctx, 12, 600);
    roundRect(ctx, phoneB_x - phoneW / 2 + 16, baseY - 30, phoneW - 32, 22, 8);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("Hello!", phoneB_x, baseY - 19);
    ctx.restore();
  }

  // Lower section: three takeaway points appear after the flight finishes.
  const points: { start: number; head: string; body: string }[] = [
    {
      start: 16,
      head: "Keys live on your devices.",
      body: "Generated locally. Never uploaded. Never recoverable from our side.",
    },
    {
      start: 22,
      head: "Forward secrecy.",
      body: "Keys rotate constantly. Yesterday's messages stay sealed even if today's keys leak.",
    },
    {
      start: 28,
      head: "Calls travel peer-to-peer.",
      body: "Voice and video set up their own encrypted channel. Audio never sits on a server.",
    },
  ];
  points.forEach((p, i) => {
    if (lt < p.start) return;
    const local = lt - p.start;
    const a = easeOut(clamp01(local / 0.5));
    const tileX = 92 + i * 372;
    const tileY = 580;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 16);
    // small lock badge.
    drawLockIcon(ctx, tileX + 16, tileY + 16, 32, FOREST, 1);
    setFont(ctx, 18, 700, "sans");
    ctx.fillStyle = DARK;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(p.head, tileX + 44, tileY + 6);
    setFont(ctx, 14, 400, "sans");
    ctx.fillStyle = MID;
    drawWrapped(
      ctx,
      p.body,
      tileX + 44,
      tileY + 32,
      300,
      20,
      Math.max(0, local - 0.2),
      0.1,
      "left",
    );
    ctx.restore();
  });
}

/* ───────────────────────── Chapter 6 — Honest analysis ───────────────────────── */

function drawAnalysis(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[5]!;
  const lt = t - ch.start;

  // Title.
  ctx.save();
  ctx.globalAlpha = band(lt, 0.2, ch.end - ch.start, 0.6, 0.6);
  setFont(ctx, 48, 600, "serif");
  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  drawStaggered(
    ctx,
    "An honest look",
    VIDEO_W / 2,
    102,
    lt,
    0.025,
    0.5,
    "center",
  );
  ctx.restore();

  if (lt > 1.2) {
    setFont(ctx, 20, 500);
    ctx.fillStyle = MID;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = band(lt - 1.2, 0, ch.end - ch.start, 0.5, 0.6);
    ctx.fillText(
      "Where we are today, told straight.",
      VIDEO_W / 2,
      168,
    );
    ctx.restore();
  }

  // Two columns.
  const colTopY = 240;
  const colW = 480;
  const gap = 60;
  const colsX = (VIDEO_W - (colW * 2 + gap)) / 2;
  const cols: {
    title: string;
    accent: string;
    items: string[];
    iconKind: "check" | "dot";
  }[] = [
    {
      title: "What works well",
      accent: FOREST,
      iconKind: "check",
      items: [
        "End-to-end encryption is on by default",
        "Source code is public — auditable under AGPL-3.0",
        "No phone number, no email, no personal data needed",
        "Calm, ad-free interface — no engagement traps",
      ],
    },
    {
      title: "Still building",
      accent: WARM,
      iconKind: "dot",
      items: [
        "Network is small — invite the people you trust first",
        "No payments or sticker marketplace yet",
        "We ship features deliberately, not constantly",
      ],
    },
  ];

  cols.forEach((col, ci) => {
    const x = colsX + ci * (colW + gap);
    // Card.
    ctx.save();
    ctx.globalAlpha = band(lt - 2, 0, ch.end - ch.start, 0.5, 0.6);
    roundRect(ctx, x, colTopY, colW, 320, 24);
    ctx.fillStyle = "#ffffffee";
    ctx.fill();
    ctx.strokeStyle = `${DARK}14`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Title bar.
    setFont(ctx, 14, 700);
    ctx.fillStyle = col.accent;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(col.title.toUpperCase(), x + 28, colTopY + 22);
    // Underline.
    ctx.fillStyle = col.accent;
    ctx.fillRect(x + 28, colTopY + 44, 36, 3);
    ctx.restore();

    // Items.
    col.items.forEach((it, i) => {
      const itemStart = 2.6 + ci * 0.4 + i * 0.45;
      if (lt < itemStart) return;
      const local = lt - itemStart;
      const a = easeOut(clamp01(local / 0.5));
      const out = band(lt, ch.start - ch.start, ch.end - ch.start, 0.5, 0.5);
      ctx.save();
      ctx.globalAlpha = a * out;
      ctx.translate(0, (1 - a) * 10);
      const iy = colTopY + 78 + i * 56;
      // Icon.
      if (col.iconKind === "check") {
        drawCheckBadge(ctx, x + 42, iy + 12, 26, col.accent, 1);
      } else {
        ctx.fillStyle = col.accent;
        fillCircle(ctx, x + 42, iy + 12, 7);
        ctx.strokeStyle = `${col.accent}55`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x + 42, iy + 12, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      setFont(ctx, 18, 500);
      ctx.fillStyle = DARK;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      drawWrapped(ctx, it, x + 78, iy + 4, colW - 110, 26, local, 0.05, "left");
      ctx.restore();
    });
  });
}

/* ───────────────────────── Chapter 7 — CTA ───────────────────────── */

function drawCTA(ctx: CanvasRenderingContext2D, t: number) {
  const ch = CHAPTERS[6]!;
  const lt = t - ch.start;
  const cx = VIDEO_W / 2;

  // Logo center, big, with slow rotate-glow.
  const enter = clamp01(lt / 1.0);
  const e = easeOut(enter);
  const float = Math.sin(lt * 0.8) * 5;
  drawLogo(ctx, cx, 240 + float, 200 * (0.85 + 0.15 * e), e);

  // Wordmark.
  if (lt > 1.0) {
    setFont(ctx, 88, 700, "serif");
    ctx.fillStyle = DARK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    drawStaggered(ctx, "VeilChat", cx, 410, lt - 1.0, 0.05, 0.6, "center");
  }

  // Tagline.
  if (lt > 2.6) {
    setFont(ctx, 28, 500, "serif");
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = easeOut(clamp01((lt - 2.6) / 0.8));
    ctx.fillText("Take your conversations back.", cx, 482);
    ctx.restore();
  }

  // URL pill.
  if (lt > 4.4) {
    const p = easeOut(clamp01((lt - 4.4) / 0.8));
    setFont(ctx, 22, 700);
    const url = "chats-client-vert.vercel.app";
    const w = ctx.measureText(url).width + 84;
    const h = 60;
    const x = cx - w / 2;
    const y = 538;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 14);
    roundRect(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, FOREST);
    g.addColorStop(1, FOREST_DEEP);
    ctx.fillStyle = g;
    ctx.fill();
    // URL text.
    setFont(ctx, 22, 700);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(url, cx, y + h / 2 + 1);
    ctx.restore();
  }

  // Footnote.
  if (lt > 6.5) {
    setFont(ctx, 14, 600);
    ctx.fillStyle = MID;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.save();
    ctx.globalAlpha = easeOut(clamp01((lt - 6.5) / 0.8));
    ctx.fillText(
      "Free, forever  ·  Open source  ·  No phone number",
      cx,
      630,
    );
    ctx.restore();
  }

  // Outro shimmer ring around logo.
  const ringP = (lt % 3) / 3;
  ctx.save();
  ctx.globalAlpha = (1 - ringP) * 0.35;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, 240 + float, 130 + ringP * 80, 0, Math.PI * 2);
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
    case "features":
      drawFeatures(ctx, t);
      break;
    case "how":
      drawHowItWorks(ctx, t);
      break;
    case "analysis":
      drawAnalysis(ctx, t);
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

  /**
   * Long, evolving ambient pad for the whole runtime. Three sine
   * voices on a warm major chord with slow detune LFOs so the
   * sustain never sounds static; soft attack and release at the
   * boundaries of each chapter so chapter chimes can shine through.
   */
  pad(start: number, end: number) {
    const notes = [
      { f: 196.0, type: "sine" as OscillatorType, gain: 0.018 },   // G3
      { f: 246.94, type: "sine" as OscillatorType, gain: 0.014 },  // B3
      { f: 293.66, type: "sine" as OscillatorType, gain: 0.012 },  // D4
      { f: 98.0, type: "triangle" as OscillatorType, gain: 0.010 }, // G2 sub
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

  /** Generic enveloped oscillator. */
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

  /** Soft three-note chime to mark a chapter transition. */
  chapterChime(when: number) {
    const notes = [659.25, 880.0, 1174.66]; // E5, A5, D6
    notes.forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.07, 1.4, 0.06, 0.012),
    );
  }

  /** Short bright glint used to accent feature reveals. */
  glint(when: number) {
    [1760, 2349.32].forEach((f, i) =>
      this.envOsc("triangle", f, when + i * 0.025, 0.22, 0.045, 0.004),
    );
  }

  /** Low warm pulse used during problem chapter to create gravity. */
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

  /** Soft heartbeat thump used in the how-it-works chapter. */
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

  /** Quick metallic click for lock seals. */
  lockClick(when: number) {
    this.envOsc("square", 1700, when, 0.04, 0.05, 0.001);
    this.envOsc("triangle", 800, when + 0.005, 0.08, 0.04, 0.002);
  }

  /** Closing chime — ascending major arpeggio. */
  outroChime(when: number) {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
      this.envOsc("sine", f, when + i * 0.11, 1.8, 0.09, 0.018),
    );
  }
}

/**
 * Schedules the entire audio score at audioStart (an AudioContext
 * timestamp). Mirrors the timeline used by drawFrame.
 */
function scheduleAudio(engine: ExplainerAudio, audioStart: number) {
  // Continuous pad for the whole piece.
  engine.pad(audioStart, audioStart + DURATION - 0.5);

  // Chapter transition chimes.
  CHAPTERS.forEach((c) => {
    if (c.start === 0) return;
    engine.chapterChime(audioStart + c.start);
  });

  // Cold open accents.
  engine.glint(audioStart + 1.5);
  engine.heartbeat(audioStart + 8.5);
  engine.warmPulse(audioStart + 16.0);

  // Problem chapter — warm pulses on tile arrivals + metadata reveal.
  for (let i = 0; i < 3; i++) {
    engine.warmPulse(audioStart + 25 + 3 + i * 0.4);
  }
  engine.warmPulse(audioStart + 25 + 14.0);
  engine.warmPulse(audioStart + 25 + 16.0);

  // Intro chapter — sparkle on logo arrival, glint on chips.
  engine.glint(audioStart + 60 + 0.3);
  engine.glint(audioStart + 60 + 1.4);
  for (let i = 0; i < 3; i++) {
    engine.glint(audioStart + 60 + 6 + i * 0.25);
  }

  // Features chapter — one glint as each feature beat opens.
  FEATURES.forEach((f) => {
    engine.glint(audioStart + 90 + f.start + 0.15);
    engine.lockClick(audioStart + 90 + f.start + 0.5);
  });

  // How it works — heartbeat under the diagram, lock clicks as the
  // sealed packet flies in/out.
  engine.heartbeat(audioStart + 195 + 3.2);
  engine.lockClick(audioStart + 195 + 7.0);
  engine.lockClick(audioStart + 195 + 9.0);
  engine.lockClick(audioStart + 195 + 11.0);
  engine.lockClick(audioStart + 195 + 13.0);
  for (let i = 0; i < 3; i++) {
    engine.heartbeat(audioStart + 195 + 16 + i * 6);
  }

  // Honest analysis — soft glints as items appear.
  for (let ci = 0; ci < 2; ci++) {
    for (let i = 0; i < 4; i++) {
      engine.glint(audioStart + 250 + 2.6 + ci * 0.4 + i * 0.45);
    }
  }

  // CTA — final outro arpeggio.
  engine.outroChime(audioStart + 280 + 4.4);
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

  // Initial poster — render first frame of the introducing chapter
  // so the canvas isn't empty before the user presses play.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, CHAPTERS[2]!.start + 1.6);
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
      const t = (performance.now() - start) / 1000;
      const frameT = Math.min(t, DURATION);
      drawFrame(ctx, frameT);
      setProgress(clamp01(t / DURATION));
      setCurrentT(frameT);
      if (t < DURATION) {
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
              "radial-gradient(circle, rgba(207,255,220,0.65), rgba(207,255,220,0) 65%)",
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
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.18em] uppercase text-[#2E6F40] bg-[#CFFFDC] border border-[#68BA7F]/40 rounded-full px-3 py-1.5">
            New · 5-minute explainer · drawn live with sound
          </div>
          <h2
            className="mt-5 text-[32px] sm:text-[42px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#253D2C]"
            style={{
              fontFamily: "'Fraunces', 'Inter', serif",
              fontWeight: 600,
            }}
          >
            The full story of VeilChat,{" "}
            <span className="italic" style={{ color: "#2E6F40" }}>
              in five minutes.
            </span>
          </h2>
          <p className="mt-4 text-[16px] sm:text-[18px] text-[#3C5A47] max-w-2xl mx-auto leading-[1.55]">
            A typography-driven walkthrough of what VeilChat is, the
            problem it solves, every core feature, how the encryption
            works, and an honest look at where we are today. Generated
            fresh on your device with a custom soundtrack — press
            record to download a real video file with sound.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Player */}
          <div className="lg:col-span-8 order-2 lg:order-1">
            <div
              className="relative mx-auto rounded-[28px] overflow-hidden border border-[#253D2C]/15 bg-[#0F1B14] shadow-[0_50px_100px_-40px_rgba(37,61,44,0.5),0_20px_40px_-20px_rgba(17,27,33,0.25)]"
              data-no-tap-scroll
              style={{ aspectRatio: `${VIDEO_W} / ${VIDEO_H}` }}
            >
              <canvas
                ref={canvasRef}
                width={VIDEO_W}
                height={VIDEO_H}
                className="block w-full h-full bg-[#FCF5EB]"
                aria-label="VeilChat 5-minute explainer video"
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
                    ? "bg-white border border-[#253D2C]/15 text-[#253D2C] hover:bg-[#FCF5EB]"
                    : "bg-gradient-to-b from-[#3A8550] to-[#2E6F40] hover:from-[#2E6F40] hover:to-[#253D2C] text-white shadow-[0_18px_36px_-14px_rgba(46,111,64,0.55),inset_0_1px_0_rgba(255,255,255,0.22)]"
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
                className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-[#FCF5EB] border border-[#253D2C]/15 text-[#253D2C] font-semibold text-[15px] px-6 py-3.5 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-4px_rgba(17,27,33,0.08)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_12px_28px_-12px_rgba(46,111,64,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="grid place-items-center w-5 h-5 rounded-full bg-[#C9492E]/15">
                  <span className="block w-2 h-2 rounded-full bg-[#C9492E]" />
                </span>
                {status === "recording" ? "Recording…" : "Record video file (with sound)"}
              </button>

              {download && (
                <button
                  type="button"
                  onClick={triggerDownload}
                  className="inline-flex items-center justify-center gap-2.5 bg-[#253D2C] hover:bg-[#1F3325] text-white font-semibold text-[15px] px-6 py-3.5 rounded-full transition-all"
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
              <p className="mt-4 text-center text-[13px] text-[#C9492E]">
                Your browser doesn't support recording. The preview still
                plays — try the latest Chrome, Edge, Safari, or Firefox to
                download the file.
              </p>
            )}
            {errorMsg && (
              <p className="mt-4 text-center text-[13px] text-[#C9492E]">{errorMsg}</p>
            )}
            {status === "recording" && (
              <p className="mt-4 text-center text-[13px] text-[#3C5A47]">
                Generating a real video file with sound. This takes the
                full five minutes — keep this tab open and active.
              </p>
            )}
          </div>

          {/* Chapter list + script download */}
          <aside className="lg:col-span-4 order-1 lg:order-2">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#3C5A47]/70 mb-3">
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
                        ? "bg-[#253D2C] border-transparent shadow-[0_10px_24px_-12px_rgba(37,61,44,0.45)]"
                        : "bg-white border-[#253D2C]/10"
                    }`}
                  >
                    <span
                      className={`text-[10.5px] font-bold tracking-[0.18em] uppercase tabular-nums ${
                        active ? "text-[#CFFFDC]" : "text-[#2E6F40]"
                      }`}
                    >
                      {formatTime(c.start)}
                    </span>
                    <span
                      className={`text-[14px] font-semibold leading-tight flex-1 ${
                        active ? "text-white" : "text-[#253D2C]"
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
              className="mt-5 inline-flex items-center justify-center gap-2 w-full bg-white hover:bg-[#FCF5EB] border border-[#253D2C]/12 text-[#253D2C] font-semibold text-[14px] px-5 py-3 rounded-full transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              Download the full narration script
            </a>

            <p className="mt-4 text-[12.5px] text-[#3C5A47]/75 leading-relaxed">
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
