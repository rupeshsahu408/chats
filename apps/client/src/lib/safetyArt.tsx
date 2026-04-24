/**
 * Safety-number art — turn the 60-digit Signal-style safety number into a
 * deterministic, visually distinctive Identicon-style fingerprint.
 *
 * Two devices that share the same safety number render the exact same
 * art piece, so users can compare a *picture* in one glance instead of
 * eyeballing 60 digits side-by-side. Cryptography as the aesthetic.
 *
 * The art is an 8×8 grid mirrored horizontally (4 unique columns,
 * mirror around the centerline) — same recipe GitHub identicons use,
 * which gives a pleasing, organic-looking shape with a strong sense of
 * symmetry. Two HSL accent hues are derived from the first/last digit
 * groups so each conversation has its own colour identity.
 */

import type { CSSProperties, ReactNode } from "react";

/** Strip spaces and parse an array of digit ints. */
function digits(safetyNumber: string): number[] {
  const out: number[] = [];
  for (const ch of safetyNumber) {
    if (ch >= "0" && ch <= "9") out.push(ch.charCodeAt(0) - 48);
  }
  return out;
}

/** Cheap deterministic 32-bit hash (FNV-1a), good enough for art seeds. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export interface SafetyArtTheme {
  /** Primary accent hue — the filled cells. */
  primary: string;
  /** Secondary accent hue — used for the halo + corner accent cells. */
  secondary: string;
  /** Background tile color (subtle, behind the grid). */
  background: string;
}

export function deriveTheme(safetyNumber: string): SafetyArtTheme {
  const ds = digits(safetyNumber);
  // First 6 digits → primary hue; last 6 digits → secondary.
  const head = ds.slice(0, 6).reduce((a, d) => a * 10 + d, 0);
  const tail = ds.slice(-6).reduce((a, d) => a * 10 + d, 0);
  const primaryHue = head % 360;
  // Force secondary into a complementary band (90°–180° apart) so the
  // two colours don't blur into each other on busy backgrounds.
  const offset = 90 + (tail % 90);
  const secondaryHue = (primaryHue + offset) % 360;
  return {
    primary: `hsl(${primaryHue} 70% 55%)`,
    secondary: `hsl(${secondaryHue} 65% 60%)`,
    background: `hsl(${primaryHue} 35% 96%)`,
  };
}

/** Build the 8×8 fill mask, mirrored horizontally. */
function buildMask(safetyNumber: string): boolean[][] {
  const seed = fnv1a(safetyNumber);
  // Use the seed plus walking-bit positions so adjacent safety numbers
  // produce visibly different art.
  const bits: boolean[] = [];
  for (let i = 0; i < 32; i++) {
    bits.push(((seed >> i) & 1) === 1);
  }
  // 4 unique columns × 8 rows = 32 bits exactly.
  const mask: boolean[][] = Array.from({ length: 8 }, () =>
    new Array<boolean>(8).fill(false),
  );
  let bi = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const on = bits[bi++]!;
      mask[row]![col] = on;
      mask[row]![7 - col] = on; // mirror
    }
  }
  return mask;
}

/**
 * Render the art piece as inline SVG. Pure visual — no event handlers
 * so it composes safely inside dialogs, cards, anywhere.
 */
export function SafetyArt({
  safetyNumber,
  size = 220,
  className = "",
  style,
}: {
  safetyNumber: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = deriveTheme(safetyNumber);
  const mask = buildMask(safetyNumber);

  const grid = 8;
  const padding = size * 0.1;
  const cell = (size - padding * 2) / grid;
  const radius = cell * 0.18;

  const cells: ReactNode[] = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      if (!mask[row]![col]) continue;
      // Edge cells get the secondary colour for a subtle border accent.
      const isEdge = row === 0 || row === 7 || col === 0 || col === 7;
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={padding + col * cell + 1}
          y={padding + row * cell + 1}
          width={cell - 2}
          height={cell - 2}
          rx={radius}
          ry={radius}
          fill={isEdge ? theme.secondary : theme.primary}
        />,
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={style}
      aria-hidden
    >
      <defs>
        <radialGradient id="safetyArtHalo" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={theme.primary} stopOpacity="0.18" />
          <stop offset="80%" stopColor={theme.primary} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="safetyArtBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.background} stopOpacity="1" />
          <stop offset="100%" stopColor={theme.background} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect
        x={0}
        y={0}
        width={size}
        height={size}
        rx={size * 0.12}
        fill="url(#safetyArtBg)"
      />
      <circle cx={size / 2} cy={size / 2} r={size * 0.5} fill="url(#safetyArtHalo)" />
      {cells}
    </svg>
  );
}

/**
 * Format the 60-digit safety number into 4 readable rows of 15 digits
 * each (3 groups of 5 per row). Returns an array of rows, each an array
 * of three 5-digit strings — easy for the dialog to render with spacing
 * and accent colour per row.
 */
export function formatSafetyRows(safetyNumber: string): string[][] {
  const groups = safetyNumber.trim().split(/\s+/);
  const rows: string[][] = [];
  for (let i = 0; i < groups.length; i += 3) {
    rows.push(groups.slice(i, i + 3));
  }
  return rows;
}
