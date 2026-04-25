import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'og-image.png');

const W = 1200;
const H = 630;
const cream = '#FCF5EB';
const forest = '#2E6F40';
const forestDeep = '#253D2C';
const mint = '#CFFFDC';
const mintSoft = '#E6FFDA';

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="78%" cy="50%" r="40%">
      <stop offset="0%" stop-color="${mint}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${cream}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="phoneShadow" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.04"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${cream}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <g transform="translate(72, 72)">
    <path d="M0 6 C0 2.7 2.7 0 6 0 L42 0 C45.3 0 48 2.7 48 6 L48 28 C48 44 36 56 24 60 C12 56 0 44 0 28 Z" fill="${forest}"/>
    <path d="M14 30 L21 37 L34 22" stroke="${cream}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
  <text x="138" y="115" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="700" fill="${forestDeep}" letter-spacing="-0.5">Veil</text>

  <text x="72" y="290" font-family="Fraunces, Georgia, serif" font-size="92" font-weight="600" fill="${forestDeep}" letter-spacing="-2.5">Message</text>
  <text x="72" y="390" font-family="Fraunces, Georgia, serif" font-size="92" font-weight="600" font-style="italic" fill="${forest}" letter-spacing="-2.5">privately.</text>

  <text x="74" y="448" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="400" fill="${forestDeep}" opacity="0.72" letter-spacing="-0.2">Built for the people you actually trust.</text>

  <g transform="translate(72, 500)">
    <rect width="290" height="44" rx="22" fill="${mintSoft}" stroke="${forest}" stroke-opacity="0.18"/>
    <g transform="translate(20, 13)">
      <rect x="0" y="6" width="14" height="11" rx="2" fill="none" stroke="${forest}" stroke-width="1.8"/>
      <path d="M3 6 V4 a4 4 0 0 1 8 0 V6" fill="none" stroke="${forest}" stroke-width="1.8"/>
    </g>
    <text x="50" y="29" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="${forest}" letter-spacing="2">END-TO-END ENCRYPTED</text>
  </g>

  <g transform="translate(770, 78) rotate(6 150 245)">
    <rect x="6" y="14" width="320" height="498" rx="44" fill="url(#phoneShadow)"/>
    <rect x="0" y="0" width="320" height="498" rx="42" fill="${forestDeep}"/>
    <rect x="10" y="10" width="300" height="478" rx="34" fill="${cream}"/>
    <path d="M10 44 a34 34 0 0 1 34 -34 h232 a34 34 0 0 1 34 34 v36 h-300 z" fill="${forest}"/>
    <rect x="120" y="20" width="80" height="22" rx="11" fill="${forestDeep}"/>
    <circle cx="40" cy="60" r="11" fill="${mint}" opacity="0.35"/>
    <text x="60" y="58" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="${cream}">Maya</text>
    <text x="60" y="74" font-family="Inter, system-ui, sans-serif" font-size="10" fill="${mint}" opacity="0.85">end-to-end encrypted</text>
    <g transform="translate(278, 50)" stroke="${cream}" stroke-width="1.4" fill="none">
      <rect x="0" y="6" width="12" height="10" rx="1.5" fill="${cream}"/>
      <path d="M2.5 6 V4 a3.5 3.5 0 0 1 7 0 V6"/>
    </g>

    <rect x="120" y="100" width="80" height="22" rx="11" fill="${forest}" fill-opacity="0.10"/>
    <text x="160" y="115" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600" fill="${forestDeep}" text-anchor="middle" opacity="0.7">TODAY</text>

    <rect x="20" y="142" width="200" height="46" rx="16" fill="#FFFFFF" stroke="${forest}" stroke-opacity="0.08"/>
    <text x="34" y="170" font-family="Inter, system-ui, sans-serif" font-size="13" fill="${forestDeep}">Are we still on for tonight?</text>

    <rect x="100" y="200" width="200" height="46" rx="16" fill="${mint}"/>
    <text x="114" y="228" font-family="Inter, system-ui, sans-serif" font-size="13" fill="${forestDeep}">Always. See you at 8.</text>
    <g transform="translate(272, 234)" stroke="${forest}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 4 L3 7 L9 1"/>
      <path d="M5 4 L8 7 L14 1"/>
    </g>

    <rect x="20" y="258" width="150" height="46" rx="16" fill="#FFFFFF" stroke="${forest}" stroke-opacity="0.08"/>
    <text x="34" y="286" font-family="Inter, system-ui, sans-serif" font-size="13" fill="${forestDeep}">Bring the wine?</text>

    <rect x="20" y="316" width="60" height="32" rx="14" fill="#FFFFFF" stroke="${forest}" stroke-opacity="0.08"/>
    <circle cx="34" cy="332" r="3" fill="${forest}" opacity="0.35"/>
    <circle cx="46" cy="332" r="3" fill="${forest}" opacity="0.55"/>
    <circle cx="58" cy="332" r="3" fill="${forest}" opacity="0.75"/>

    <rect x="14" y="436" width="292" height="42" rx="21" fill="#FFFFFF" stroke="${forest}" stroke-opacity="0.10"/>
    <text x="34" y="462" font-family="Inter, system-ui, sans-serif" font-size="13" fill="${forestDeep}" opacity="0.4">Message</text>
    <circle cx="288" cy="457" r="14" fill="${forest}"/>
    <path d="M283 457 L292 452 L292 462 Z" fill="${cream}"/>
  </g>

  <text x="${W - 72}" y="${H - 46}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="${forestDeep}" opacity="0.55" text-anchor="end" letter-spacing="2">VEIL · TALK FREELY</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`wrote ${OUT} ${meta.width}x${meta.height}`);
