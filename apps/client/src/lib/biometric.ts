/**
 * Per-chat (and global) biometric / passkey lock built on WebAuthn.
 *
 * We don't actually use the credential to encrypt anything in this
 * release — that would require WebAuthn PRF, which isn't universally
 * supported. Instead we use a "presence" check: if a credential is
 * registered for this chat, we require a successful `get()` (i.e. the
 * user proved presence with biometrics or a security key) before the
 * messages render. The encryption keys themselves remain protected by
 * the PIN-derived key in IndexedDB.
 */

const RP_NAME = "Veil";

export function biometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === "function"
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(b);
  return b;
}

function toBuffer(b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(b.length));
  out.set(b);
  return out;
}

/**
 * Register a new platform credential, returning its base64url id which
 * the caller persists. `userHandle` should be a stable identifier for
 * the chat / app (e.g. the peer id or "self").
 */
export async function registerBiometricCredential(
  userHandle: string,
  displayName: string,
): Promise<string> {
  if (!biometricSupported()) {
    throw new Error("Biometric authentication isn't supported on this device.");
  }
  const userIdBytes = toBuffer(new TextEncoder().encode(userHandle));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: RP_NAME },
      user: {
        id: userIdBytes,
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Registration was canceled.");
  return bytesToBase64Url(new Uint8Array(cred.rawId));
}

/**
 * Prompt the user to authenticate with the previously-registered
 * credential. Resolves true on success, false on user cancel / error.
 */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  if (!biometricSupported()) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [
          {
            id: toBuffer(base64UrlToBytes(credentialId)),
            type: "public-key",
          },
        ],
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
