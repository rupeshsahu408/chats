/**
 * humanizeError — turn technical/raw errors into polished, user-facing
 * messages. Veil surfaces a wide variety of error sources (tRPC server
 * codes, fetch/network errors, Zod validation, WebCrypto, IndexedDB,
 * Firebase, abort signals…). This module is the single place that
 * decides what the user actually sees.
 *
 * Returns a `{ title, message }` pair so UI can render a heading +
 * supporting line consistently. Use `humanizeErrorMessage` if you only
 * need the friendly one-liner.
 */

export type FriendlyError = {
  /** A short, human title. Always present. */
  title: string;
  /** A one-sentence description. Always present. */
  message: string;
  /**
   * The internal error code if we recognised one — used so callers
   * can branch on e.g. `UNAUTHORIZED` to redirect to /login.
   */
  code?: string;
};

const DEFAULT: FriendlyError = {
  title: "Something went wrong",
  message: "Please try that again. If it keeps happening, refresh the page.",
};

/**
 * Map known tRPC / HTTP-ish error codes to friendly copy. Anything not
 * in this map falls through to the cleaned-up server message (which is
 * usually already a polite English sentence on Veil's backend).
 */
const CODE_MAP: Record<string, FriendlyError> = {
  UNAUTHORIZED: {
    title: "You're signed out",
    message: "Your session has expired. Please log in again to continue.",
    code: "UNAUTHORIZED",
  },
  FORBIDDEN: {
    title: "Not allowed",
    message: "You don't have permission to do that.",
    code: "FORBIDDEN",
  },
  NOT_FOUND: {
    title: "Not found",
    message: "We couldn't find what you were looking for. It may have been removed.",
    code: "NOT_FOUND",
  },
  TIMEOUT: {
    title: "Request timed out",
    message: "The server took too long to respond. Check your connection and try again.",
    code: "TIMEOUT",
  },
  TOO_MANY_REQUESTS: {
    title: "Slow down",
    message: "You've tried that a few too many times. Please wait a moment and try again.",
    code: "TOO_MANY_REQUESTS",
  },
  PRECONDITION_FAILED: {
    title: "Setup needed",
    message:
      "The server isn't fully configured yet. If you're the developer, check your .env values and restart.",
    code: "PRECONDITION_FAILED",
  },
  CONFLICT: {
    title: "Already exists",
    message: "That action conflicts with something already on file.",
    code: "CONFLICT",
  },
  BAD_REQUEST: {
    title: "Check your input",
    message: "Something in what you sent looks off. Please double-check and try again.",
    code: "BAD_REQUEST",
  },
  PAYLOAD_TOO_LARGE: {
    title: "Too big",
    message: "That file or message is larger than we can accept.",
    code: "PAYLOAD_TOO_LARGE",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    title: "Unsupported file",
    message: "That file format isn't supported here.",
    code: "UNSUPPORTED_MEDIA_TYPE",
  },
  INTERNAL_SERVER_ERROR: {
    title: "Server hiccup",
    message: "Our server stumbled on that one. Please try again in a moment.",
    code: "INTERNAL_SERVER_ERROR",
  },
};

/**
 * Patterns we look for in raw error messages when no clean code is
 * available — typically network/fetch failures.
 */
const PATTERN_MAP: Array<{ test: RegExp; out: FriendlyError }> = [
  {
    test: /failed to fetch|networkerror|network request failed|fetch failed|load failed/i,
    out: {
      title: "Can't reach the server",
      message:
        "You appear to be offline, or the server isn't responding. Check your connection and try again.",
      code: "NETWORK",
    },
  },
  {
    test: /timeout|timed out/i,
    out: {
      title: "Request timed out",
      message: "The server took too long to respond. Please try again.",
      code: "TIMEOUT",
    },
  },
  {
    test: /aborted|abort/i,
    out: {
      title: "Canceled",
      message: "That request was canceled before it finished.",
      code: "ABORTED",
    },
  },
  {
    test: /quotaexceedederror|quota.*exceed/i,
    out: {
      title: "Storage full",
      message:
        "Your browser is out of local storage. Free up some space or clear old chats and try again.",
      code: "QUOTA",
    },
  },
  {
    test: /not allowed|notallowed/i,
    out: {
      title: "Permission denied",
      message:
        "Your browser blocked that action. Check your site permissions and try again.",
      code: "PERMISSION",
    },
  },
];

/**
 * Best-effort: extract a stable code from a tRPC client error or
 * standard Error/object shape.
 */
function extractCode(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  // tRPC v10 client error shape: { data: { code: 'UNAUTHORIZED' } }
  const data = (e as { data?: { code?: unknown } }).data;
  if (data && typeof data.code === "string") return data.code;
  // Some libs put it on shape: { shape: { data: { code } } }
  const shape = (e as { shape?: { data?: { code?: unknown } } }).shape;
  if (shape && shape.data && typeof shape.data.code === "string") {
    return shape.data.code;
  }
  // Plain { code: '...' }
  const code = (e as { code?: unknown }).code;
  if (typeof code === "string") return code;
  return undefined;
}

function extractMessage(e: unknown): string | undefined {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return undefined;
}

/**
 * Strip leading `CODE: ` prefixes that tRPC sometimes leaks through and
 * tidy whitespace, then sentence-case the first letter.
 */
function clean(raw: string): string {
  let s = raw.trim();
  // "BAD_REQUEST: Email is required." → "Email is required."
  s = s.replace(/^[A-Z_]+:\s*/, "");
  // Strip leading "Error: "
  s = s.replace(/^error:\s*/i, "");
  // Trim trailing periods/spaces, then ensure exactly one terminator.
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return s;
  if (!/[.!?]$/.test(s)) s += ".";
  // Capitalise first letter.
  const first = s.charAt(0);
  return first.toUpperCase() + s.slice(1);
}

export function humanizeError(e: unknown): FriendlyError {
  if (e == null) return DEFAULT;

  const code = extractCode(e);
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const raw = extractMessage(e);

  if (raw) {
    for (const { test, out } of PATTERN_MAP) {
      if (test.test(raw)) return out;
    }
    return {
      title: code ? friendlyTitleForCode(code) : "Something went wrong",
      message: clean(raw),
      code,
    };
  }

  return DEFAULT;
}

function friendlyTitleForCode(code: string): string {
  // "PRECONDITION_FAILED" → "Precondition failed" as a last resort.
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Convenience: just the friendly one-liner. */
export function humanizeErrorMessage(e: unknown): string {
  return humanizeError(e).message;
}
