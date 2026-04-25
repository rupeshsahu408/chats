#!/usr/bin/env node
/**
 * Render apps/client/public/og-image.png from an inline SVG so social
 * link previews (WhatsApp, Twitter/X, Slack, iMessage, LinkedIn, …)
 * stay in sync with the live VeilChat brand mark. Re-run any time
 * the brand changes:
 *
 *   pnpm --filter @veil/client og
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "og-image.png");

const W = 1200;
const H = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E9F8F2"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#00A884" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#00A884" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#00A884" stop-opacity="0"/>
    </radialGradient>
    <filter id="markShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#00A884" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Backdrop -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Hairline corner accents (very subtle) -->
  <g stroke="#00A884" stroke-opacity="0.10" stroke-width="1.4" fill="none">
    <path d="M48 110 L48 48 L110 48"/>
    <path d="M${W - 110} 48 L${W - 48} 48 L${W - 48} 110"/>
    <path d="M48 ${H - 110} L48 ${H - 48} L110 ${H - 48}"/>
    <path d="M${W - 110} ${H - 48} L${W - 48} ${H - 48} L${W - 48} ${H - 110}"/>
  </g>

  <!-- Brand mark (squircle + V + dot) -->
  <g transform="translate(${W / 2 - 80} 158)" filter="url(#markShadow)">
    <rect width="160" height="160" rx="35" fill="#00A884"/>
    <path d="M40 55 L80 110 L120 55"
          fill="none" stroke="#FFFFFF" stroke-width="13.75"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="130" cy="32.5" r="10" fill="#FFFFFF"/>
  </g>

  <!-- Wordmark -->
  <text x="${W / 2}" y="402"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif"
        font-size="86" font-weight="700" letter-spacing="-2.4"
        fill="#0B141A">VeilChat</text>

  <!-- Tagline -->
  <text x="${W / 2}" y="462"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif"
        font-size="28" font-weight="500" letter-spacing="-0.2"
        fill="#54656F">Private by design. Visible to no one but you.</text>

  <!-- E2E badge -->
  <g transform="translate(${W / 2 - 169} 510)">
    <rect x="0" y="0" width="338" height="56" rx="28" fill="#00A884" fill-opacity="0.10"/>
    <rect x="0" y="0" width="338" height="56" rx="28" fill="none" stroke="#00A884" stroke-opacity="0.28" stroke-width="1.2"/>
    <g transform="translate(24 16)">
      <path d="M5 11V8a6 6 0 1 1 12 0v3"
            stroke="#00866A" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="2.5" y="11" width="17" height="13" rx="3" fill="#00866A"/>
      <circle cx="11" cy="17" r="1.7" fill="#FFFFFF"/>
      <rect x="10.15" y="17.4" width="1.7" height="3.4" rx="0.6" fill="#FFFFFF"/>
    </g>
    <text x="62" y="36"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif"
          font-size="20" font-weight="600" letter-spacing="0.4"
          fill="#00866A">END-TO-END ENCRYPTED · PRIVACY-FIRST</text>
  </g>
</svg>`;

const buffer = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(OUT, buffer);

console.log(`Wrote ${OUT} (${buffer.byteLength.toLocaleString()} bytes, ${W}×${H})`);
