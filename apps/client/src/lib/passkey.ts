/**
 * WebAuthn / passkey client helpers.
 *
 * Thin wrapper around `@simplewebauthn/browser` that:
 *   • surfaces a feature-detection check so we can hide the option on
 *     unsupported browsers / platforms,
 *   • turns the trickier WebAuthn errors into friendlier strings, and
 *   • picks a sensible default device label (e.g. "iPhone", "Mac",
 *     "Windows PC") from the user-agent so the user doesn't have to
 *     name their authenticator unless they want to.
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

export function isPasskeySupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

/**
 * Best-effort guess at a friendly device name from the user-agent so
 * the Settings list reads "iPhone" instead of "Mozilla/5.0 (iPhone…)".
 * Always overrideable by the user before the credential is saved.
 */
export function suggestDeviceName(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows NT/i.test(ua)) return "Windows PC";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux PC";
  return "This device";
}

/**
 * Run the browser-side passkey registration ceremony. Throws with a
 * human-readable message on cancel / unsupported / timeout.
 *
 * `options` is the JSON returned by the server-side
 * `passkey.getRegistrationOptions` mutation.
 */
export async function startPasskeyRegistration(options: unknown) {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys aren't supported on this device.");
  }
  try {
    return await startRegistration({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      optionsJSON: options as any,
    });
  } catch (e) {
    throw friendlyError(e);
  }
}

export async function startPasskeyAuthentication(options: unknown) {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys aren't supported on this device.");
  }
  try {
    return await startAuthentication({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      optionsJSON: options as any,
    });
  } catch (e) {
    throw friendlyError(e);
  }
}

function friendlyError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  if (
    name === "NotAllowedError" ||
    /not allowed|cancel|timed out/i.test(msg)
  ) {
    return new Error("Passkey prompt was cancelled or timed out.");
  }
  if (name === "InvalidStateError") {
    return new Error("This device already has a passkey registered.");
  }
  if (/excludecredentials|already registered/i.test(msg)) {
    return new Error("This device already has a passkey registered.");
  }
  if (/secure context|https/i.test(msg)) {
    return new Error("Passkeys require a secure (HTTPS) connection.");
  }
  return new Error(msg || "Passkey could not be set up.");
}
