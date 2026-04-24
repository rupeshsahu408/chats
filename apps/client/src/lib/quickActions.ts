/**
 * Quick actions: small, on-demand utilities available from the message
 * action menu (long-press or right-click on a bubble). Three actions:
 *
 *  • Calculate — pure on-device math expression evaluator. No network.
 *  • Define     — single-word lookup against the public Free Dictionary
 *                 API. Lookup leaves the device but no chat metadata
 *                 (sender, recipient, room) is sent.
 *  • Translate  — preferred path uses the browser's on-device
 *                 `Translator` API (Chrome / Edge). When unavailable we
 *                 surface a one-tap "Open in Google Translate" link
 *                 instead of silently shipping the user's text to a
 *                 third-party API.
 *
 * Each helper is independent and synchronous to call (the heavy ones
 * return a Promise). All errors are returned as values, not thrown.
 */

/* ────────────────────────── Calculate ────────────────────────── */

/**
 * Try to evaluate a math expression. Returns `null` if the input
 * doesn't look like math or doesn't parse. Uses a hand-rolled
 * recursive-descent evaluator — never `eval` or `Function`.
 *
 * Accepts:
 *   • numbers, decimals, scientific notation (1.5e3)
 *   • operators: + − × ÷ * / ^ %
 *   • parentheses
 *   • unary minus / plus
 *   • Common Unicode lookalikes: × ÷ − are normalised to * / -.
 *   • Trailing units after the expression are stripped ("12 + 3 km").
 */
export function tryCalculate(input: string): { value: number; formatted: string } | null {
  const cleaned = normaliseExpr(input);
  if (!cleaned) return null;
  try {
    const parser = new Parser(cleaned);
    const value = parser.parseExpression();
    parser.expectEnd();
    if (!Number.isFinite(value)) return null;
    return { value, formatted: formatNumber(value) };
  } catch {
    return null;
  }
}

function normaliseExpr(input: string): string {
  let s = input.trim();
  if (!s) return "";
  // Replace Unicode operator lookalikes.
  s = s.replace(/[×·]/g, "*").replace(/[÷]/g, "/").replace(/[−–—]/g, "-");
  // Drop a leading "=" if the user typed something like "= 12 + 3".
  s = s.replace(/^=+\s*/, "");
  // Strip trailing alphabetic units ("12 + 3 km" → "12 + 3").
  s = s.replace(/\s*[A-Za-z%]+\s*$/, "");
  // Quick reject: must contain at least one digit and one operator OR
  // a parenthesis — otherwise it's almost certainly prose.
  if (!/\d/.test(s)) return "";
  if (!/[+\-*/^()%]/.test(s)) return "";
  // Final whitelist: only digits, operators, parens, dot, e, spaces.
  if (!/^[\d+\-*/^().%eE\s]+$/.test(s)) return "";
  return s;
}

class Parser {
  private pos = 0;
  constructor(private readonly src: string) {}

  parseExpression(): number {
    return this.parseAddSub();
  }

  expectEnd(): void {
    this.skipWs();
    if (this.pos !== this.src.length) {
      throw new Error("trailing tokens");
    }
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    for (;;) {
      this.skipWs();
      const c = this.src[this.pos];
      if (c === "+" || c === "-") {
        this.pos++;
        const right = this.parseMulDiv();
        left = c === "+" ? left + right : left - right;
      } else {
        return left;
      }
    }
  }

  private parseMulDiv(): number {
    let left = this.parsePow();
    for (;;) {
      this.skipWs();
      const c = this.src[this.pos];
      if (c === "*" || c === "/" || c === "%") {
        this.pos++;
        const right = this.parsePow();
        if (c === "*") left = left * right;
        else if (c === "/") left = left / right;
        else left = left % right;
      } else {
        return left;
      }
    }
  }

  private parsePow(): number {
    const left = this.parseUnary();
    this.skipWs();
    if (this.src[this.pos] === "^") {
      this.pos++;
      const right = this.parsePow(); // right-assoc
      return Math.pow(left, right);
    }
    return left;
  }

  private parseUnary(): number {
    this.skipWs();
    const c = this.src[this.pos];
    if (c === "+") {
      this.pos++;
      return this.parseUnary();
    }
    if (c === "-") {
      this.pos++;
      return -this.parseUnary();
    }
    return this.parseAtom();
  }

  private parseAtom(): number {
    this.skipWs();
    const c = this.src[this.pos];
    if (c === "(") {
      this.pos++;
      const v = this.parseAddSub();
      this.skipWs();
      if (this.src[this.pos] !== ")") throw new Error("missing )");
      this.pos++;
      return v;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipWs();
    const start = this.pos;
    while (this.pos < this.src.length && /[\d.]/.test(this.src[this.pos]!)) {
      this.pos++;
    }
    // Optional scientific notation: e[+-]?digits
    if (
      this.pos < this.src.length &&
      (this.src[this.pos] === "e" || this.src[this.pos] === "E")
    ) {
      this.pos++;
      if (this.src[this.pos] === "+" || this.src[this.pos] === "-") this.pos++;
      while (this.pos < this.src.length && /\d/.test(this.src[this.pos]!)) {
        this.pos++;
      }
    }
    if (this.pos === start) throw new Error("number expected");
    const n = Number(this.src.slice(start, this.pos));
    if (!Number.isFinite(n)) throw new Error("not finite");
    return n;
  }

  private skipWs(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) {
      this.pos++;
    }
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  // Round to 8 sig figs to avoid 0.1+0.2 tail.
  const rounded = Number(n.toPrecision(12));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 });
}

/* ─────────────────────────── Define ─────────────────────────── */

export type Definition = {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
};

/**
 * Look up a single word in the Free Dictionary API. Returns `null` if
 * the input doesn't look like a single word, or the lookup fails.
 *
 * Privacy: only the word itself is sent — never the surrounding
 * message, sender, or recipient.
 */
export async function defineWord(input: string): Promise<Definition | null> {
  const word = input.trim().toLowerCase();
  if (!word || !/^[a-z'’-]{1,40}$/i.test(word)) return null;
  try {
    const r = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { method: "GET" },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{
      word: string;
      phonetic?: string;
      phonetics?: { text?: string }[];
      meanings?: {
        partOfSpeech?: string;
        definitions?: { definition?: string; example?: string }[];
      }[];
    }>;
    const first = data[0];
    if (!first) return null;
    const phonetic =
      first.phonetic ??
      first.phonetics?.find((p) => p.text)?.text ??
      undefined;
    const meanings = (first.meanings ?? [])
      .map((m) => ({
        partOfSpeech: m.partOfSpeech ?? "",
        definitions: (m.definitions ?? [])
          .filter((d) => typeof d.definition === "string")
          .slice(0, 2)
          .map((d) => ({
            definition: d.definition!,
            ...(d.example ? { example: d.example } : {}),
          })),
      }))
      .filter((m) => m.definitions.length > 0)
      .slice(0, 3);
    if (meanings.length === 0) return null;
    return { word: first.word ?? word, phonetic, meanings };
  } catch {
    return null;
  }
}

/* ───────────────────────── Translate ───────────────────────── */

export type TranslateResult =
  | { kind: "ondevice"; text: string; targetLang: string }
  | { kind: "fallback"; openUrl: string; targetLang: string };

/**
 * Translate `text` to `targetLang` (BCP-47 like "en", "es", "fr").
 *
 * Preferred: the browser's on-device Translator API (Chrome 138+ /
 * Edge). Runs entirely on-device — no network for translation.
 *
 * Fallback: returns a Google Translate URL the caller can open in a
 * new tab. We never silently POST the user's text anywhere.
 */
export async function translateText(
  text: string,
  targetLang: string,
): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      kind: "fallback",
      openUrl: googleTranslateUrl("", targetLang),
      targetLang,
    };
  }

  // Try the new on-device Translator API. Available in Chrome 138+
  // behind a `Translator` global (no flag needed in stable channels
  // that ship the AI APIs).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T: any = (globalThis as any).Translator;
  if (T && typeof T.create === "function") {
    try {
      // Detect source language if a LanguageDetector is around;
      // otherwise let the translator infer (some impls accept
      // sourceLanguage: "auto", others want a real BCP-47 code).
      let sourceLanguage = "en";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const D: any = (globalThis as any).LanguageDetector;
      if (D && typeof D.create === "function") {
        try {
          const det = await D.create();
          const out = await det.detect(trimmed);
          if (Array.isArray(out) && out[0]?.detectedLanguage) {
            sourceLanguage = String(out[0].detectedLanguage);
          }
        } catch {
          /* ignore — fall back to "en" */
        }
      }
      if (sourceLanguage === targetLang) {
        return { kind: "ondevice", text: trimmed, targetLang };
      }
      const translator = await T.create({
        sourceLanguage,
        targetLanguage: targetLang,
      });
      const out = await translator.translate(trimmed);
      if (typeof out === "string" && out.length > 0) {
        return { kind: "ondevice", text: out, targetLang };
      }
    } catch {
      /* fall through to Google Translate URL */
    }
  }

  return {
    kind: "fallback",
    openUrl: googleTranslateUrl(trimmed, targetLang),
    targetLang,
  };
}

function googleTranslateUrl(text: string, targetLang: string): string {
  const params = new URLSearchParams({
    sl: "auto",
    tl: targetLang,
    text,
    op: "translate",
  });
  return `https://translate.google.com/?${params.toString()}`;
}

/* ─────────────────────── Action detection ─────────────────────── */

/**
 * Decide which actions are "obvious" for the given text. The sheet
 * still shows all three, but it pre-selects the most relevant tab.
 */
export function suggestAction(
  text: string,
): "calculate" | "define" | "translate" {
  if (tryCalculate(text)) return "calculate";
  if (/^\s*[a-z'’-]{2,40}\s*$/i.test(text)) return "define";
  return "translate";
}
