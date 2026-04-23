import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

/**
 * Slide-to-verify bot challenge.
 *
 * Renders a colourful gradient background as an inline SVG with a
 * piece-shaped hole at a random X position, plus the matching piece
 * (also as an inline SVG) for the client to drag horizontally. The
 * server keeps an in-memory map from challengeId → expected gapX +
 * issued-at, so verification is just an integer comparison with a
 * small slop window.
 *
 * Successful verifications mint a short-lived HMAC token that the
 * signup mutation requires. Tokens are single-use (also tracked in
 * memory) to prevent a single solve from gating an unlimited number
 * of accounts.
 */

export const PUZZLE_WIDTH = 320;
export const PUZZLE_HEIGHT = 180;
export const PIECE_WIDTH = 50;
export const PIECE_HEIGHT = 50;
export const PIECE_Y = 70;
const SLIP_TOLERANCE_PX = 6;
const CHALLENGE_TTL_MS = 2 * 60_000;
const TOKEN_TTL_MS = 5 * 60_000;
const MAX_CHALLENGES = 10_000;

interface ChallengeRecord {
  gapX: number;
  expiresAt: number;
}

const challenges = new Map<string, ChallengeRecord>();
const usedTokens = new Map<string, number>();

function gc() {
  const now = Date.now();
  if (challenges.size > MAX_CHALLENGES) {
    for (const [k, v] of challenges) {
      if (v.expiresAt <= now) challenges.delete(k);
    }
  }
  if (usedTokens.size > MAX_CHALLENGES) {
    for (const [k, exp] of usedTokens) {
      if (exp <= now) usedTokens.delete(k);
    }
  }
}

function tokenKey(): Buffer {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return Buffer.from(`bot-challenge:${env.JWT_SECRET}`);
}

/**
 * SVG path for a classic jigsaw-style piece with a knob on the right
 * and a smooth body, sized PIECE_WIDTH × PIECE_HEIGHT, anchored at
 * (0,0). Used for both the hole (background) and the draggable piece.
 */
function piecePath(): string {
  const w = PIECE_WIDTH;
  const h = PIECE_HEIGHT;
  const k = 8; // knob radius
  return [
    `M0 0`,
    `H${w / 2 - k}`,
    `a${k} ${k} 0 0 1 ${2 * k} 0`,
    `H${w}`,
    `V${h}`,
    `H0`,
    `V${h / 2 + k}`,
    `a${k} ${k} 0 0 0 0 -${2 * k}`,
    `Z`,
  ].join(" ");
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function randInt(min: number, maxInclusive: number): number {
  const span = maxInclusive - min + 1;
  return min + Math.floor(Math.random() * span);
}

function pickGradient(): { from: string; to: string } {
  const palettes = [
    { from: "#0ea5e9", to: "#6366f1" },
    { from: "#22c55e", to: "#0ea5e9" },
    { from: "#f43f5e", to: "#a855f7" },
    { from: "#f59e0b", to: "#ef4444" },
    { from: "#14b8a6", to: "#3b82f6" },
    { from: "#a855f7", to: "#ec4899" },
  ];
  return palettes[randInt(0, palettes.length - 1)]!;
}

function buildBackgroundSvg(gapX: number): string {
  const { from, to } = pickGradient();
  const path = piecePath();
  // A soft, decorative SVG with a few translucent circles and the
  // jigsaw-shaped hole punched out via an even-odd mask.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PUZZLE_WIDTH}" height="${PUZZLE_HEIGHT}" viewBox="0 0 ${PUZZLE_WIDTH} ${PUZZLE_HEIGHT}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <mask id="hole" maskUnits="userSpaceOnUse">
      <rect width="${PUZZLE_WIDTH}" height="${PUZZLE_HEIGHT}" fill="white"/>
      <g transform="translate(${gapX} ${PIECE_Y})">
        <path d="${path}" fill="black"/>
      </g>
    </mask>
  </defs>
  <g mask="url(#hole)">
    <rect width="${PUZZLE_WIDTH}" height="${PUZZLE_HEIGHT}" fill="url(#g)"/>
    <circle cx="60" cy="40" r="46" fill="white" fill-opacity="0.18"/>
    <circle cx="260" cy="140" r="60" fill="white" fill-opacity="0.14"/>
    <circle cx="180" cy="60" r="20" fill="white" fill-opacity="0.22"/>
  </g>
  <g transform="translate(${gapX} ${PIECE_Y})" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1">
    <path d="${path}"/>
  </g>
</svg>`;
}

function buildPieceSvg(gapX: number): string {
  const { from, to } = pickGradient();
  const path = piecePath();
  // The piece displays the same gradient as the background, sampled at
  // its original coordinates (so dropping it into the gap is visually
  // satisfying even though we don't actually have to align colours).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIECE_WIDTH}" height="${PIECE_HEIGHT}" viewBox="0 0 ${PIECE_WIDTH} ${PIECE_HEIGHT}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <path d="${path}" fill="url(#g)" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
</svg>`;
}

export function issueBotChallenge() {
  gc();
  const challengeId = randomBytes(16).toString("base64url");
  const gapX = randInt(80, PUZZLE_WIDTH - PIECE_WIDTH - 10);
  challenges.set(challengeId, {
    gapX,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return {
    challengeId,
    background: svgDataUrl(buildBackgroundSvg(gapX)),
    piece: svgDataUrl(buildPieceSvg(gapX)),
    puzzleWidth: PUZZLE_WIDTH,
    puzzleHeight: PUZZLE_HEIGHT,
    pieceWidth: PIECE_WIDTH,
    pieceHeight: PIECE_HEIGHT,
    pieceY: PIECE_Y,
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

function signToken(challengeId: string, expiresAt: number): string {
  const payload = `${challengeId}.${expiresAt}`;
  const sig = createHmac("sha256", tokenKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyBotChallenge(
  challengeId: string,
  guessX: number,
): { ok: boolean; token: string | null } {
  gc();
  const rec = challenges.get(challengeId);
  if (!rec) return { ok: false, token: null };
  // Single attempt per challenge — solved or not, it's burned.
  challenges.delete(challengeId);
  if (rec.expiresAt <= Date.now()) return { ok: false, token: null };
  if (Math.abs(guessX - rec.gapX) > SLIP_TOLERANCE_PX) {
    return { ok: false, token: null };
  }
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signToken(challengeId, expiresAt);
  return { ok: true, token };
}

/**
 * Verify a token returned by `verifyBotChallenge` and burn it.
 * Returns true exactly once per token.
 */
export function consumeBotToken(token: string): boolean {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const lastDot = token.lastIndexOf(".");
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac("sha256", tokenKey()).update(payload).digest("base64url");
  let ok = false;
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    ok = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    ok = false;
  }
  if (!ok) return false;
  const [challengeId, expStr] = payload.split(".");
  if (!challengeId || !expStr) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  if (usedTokens.has(token)) return false;
  usedTokens.set(token, exp);
  return true;
}
