import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  PrimaryButton,
  SecondaryButton,
  FieldLabel,
  TextInput,
  ErrorMessage,
} from "../components/Layout";
import {
  bytesToBase64,
  isValidRecoveryPhrase,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
} from "../lib/crypto";
import { x25519PublicKeyFromPrivate } from "../lib/signal/x25519";
import { saveIdentity, loadIdentity } from "../lib/db";
import { buildPrekeyBundle } from "../lib/prekeys";
import { useUnlockStore } from "../lib/unlockStore";
import { postAuthLandingPath } from "../lib/inviteRedirect";
import {
  isPasskeySupported,
  startPasskeyAuthentication,
} from "../lib/passkey";
import { humanizeErrorMessage } from "../lib/humanizeError";

/**
 * New username + password login flow.
 *
 * Auth itself is just username + password. The recovery key is only
 * needed when the local IndexedDB doesn't already hold a derived
 * identity (i.e. fresh device or after a wipe). On a returning device
 * we skip the recovery-key step entirely.
 */
export function RandomLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUnlocked = useUnlockStore((s) => s.setIdentity);

  const [step, setStep] = useState<"credentials" | "recovery">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const loginV2 = trpc.auth.loginRandomV2.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();
  const passkeyOptions = trpc.passkey.getAuthenticationOptions.useMutation();
  const passkeyVerify = trpc.passkey.verifyAuthentication.useMutation();
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeysAvailable = isPasskeySupported();

  async function onPasskeyLogin() {
    if (passkeyBusy) return;
    setError(null);
    setPasskeyBusy(true);
    try {
      const opts = await passkeyOptions.mutateAsync();
      const credential = await startPasskeyAuthentication(opts.options);
      const r = await passkeyVerify.mutateAsync({
        sessionId: opts.sessionId,
        response: credential,
      });
      setAuth({
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        refreshExpiresIn: r.refreshExpiresIn,
        user: r.user,
      });

      // Same post-auth path as the password flow: if we already have
      // the derived identity locally we go straight in; otherwise we
      // still need the recovery key to decrypt messages on this device.
      const local = await loadIdentity().catch(() => null);
      if (
        local &&
        local.userId === r.user.id &&
        local.encX25519PrivateKey &&
        local.x25519PublicKey
      ) {
        await setUnlocked({
          userId: r.user.id,
          ed25519: {
            privateKey: base64ToBytes(local.encPrivateKey),
            publicKey: base64ToBytes(local.publicKey),
          },
          x25519: {
            privateKey: base64ToBytes(local.encX25519PrivateKey),
            publicKey: base64ToBytes(local.x25519PublicKey),
          },
        });
        navigate(postAuthLandingPath());
        return;
      }
      setPendingUserId(r.user.id);
      setStep("recovery");
    } catch (e) {
      setError(humanizeErrorMessage(e));
    } finally {
      setPasskeyBusy(false);
    }
  }

  const cleanUsername = username.trim().toLowerCase();
  const credsValid = cleanUsername.length >= 3 && password.length >= 8;
  const phraseValid = isValidRecoveryPhrase(phrase.trim().toLowerCase());

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const r = await loginV2.mutateAsync({
        username: cleanUsername,
        password,
      });
      setAuth({
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        refreshExpiresIn: r.refreshExpiresIn,
        user: r.user,
      });

      // If we already have a derived identity for this user on this
      // device, we're done. Otherwise we need the recovery key to
      // re-derive Ed25519/X25519.
      const local = await loadIdentity().catch(() => null);
      if (
        local &&
        local.userId === r.user.id &&
        local.encX25519PrivateKey &&
        local.x25519PublicKey
      ) {
        await setUnlocked({
          userId: r.user.id,
          ed25519: {
            privateKey: base64ToBytes(local.encPrivateKey),
            publicKey: base64ToBytes(local.publicKey),
          },
          x25519: {
            privateKey: base64ToBytes(local.encX25519PrivateKey),
            publicKey: base64ToBytes(local.x25519PublicKey),
          },
        });
        navigate(postAuthLandingPath());
        return;
      }
      setPendingUserId(r.user.id);
      setStep("recovery");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }

  async function onRestoreFromRecovery() {
    if (!pendingUserId) return;
    setError(null);
    setLoading(true);
    try {
      const trimmed = phrase.trim().toLowerCase();
      const ed = deriveIdentityFromPhrase(trimmed);
      const { privateKey: x25519Priv } = deriveX25519FromPhrase(trimmed);
      const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);

      await saveIdentity({
        id: "self",
        userId: pendingUserId,
        encPrivateKey: bytesToBase64(ed.privateKey),
        iv: "phrase-derived",
        salt: "phrase-derived",
        publicKey: bytesToBase64(ed.publicKey),
        encX25519PrivateKey: bytesToBase64(x25519Priv),
        iv2: "phrase-derived",
        salt2: "phrase-derived",
        x25519PublicKey: bytesToBase64(x25519Pub),
        recoveryPhrase: trimmed,
        createdAt: new Date().toISOString(),
      });

      try {
        await setX25519.mutateAsync({ publicKey: bytesToBase64(x25519Pub) });
      } catch (e) {
        console.warn("X25519 registration failed", e);
      }

      try {
        const bundle = await buildPrekeyBundle({
          identityPrivateKey: ed.privateKey,
          numOneTime: 20,
          freshStart: true,
        });
        await uploadPrekeys.mutateAsync(bundle);
      } catch (e) {
        console.warn("Prekey upload failed", e);
      }

      await setUnlocked({
        userId: pendingUserId,
        ed25519: ed,
        x25519: { privateKey: x25519Priv, publicKey: x25519Pub },
      });

      navigate(postAuthLandingPath());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }

  if (step === "recovery") {
    return (
      <ScreenShell back="#" phase="Restore on this device">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Enter your recovery key</h2>
          <p className="text-sm text-text-muted text-center">
            We don't have your encryption key on this device yet. Paste your
            12-word recovery key to decrypt your messages here.
          </p>
        </div>

        <div>
          <FieldLabel>Recovery key (12 words)</FieldLabel>
          <textarea
            autoFocus
            rows={4}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="word1 word2 word3 …"
            className="w-full rounded-xl bg-surface border border-line px-4 py-3 outline-none focus:border-wa-green transition resize-none text-sm"
          />
          {phrase.trim().length > 0 && !phraseValid && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Invalid phrase — check all 12 words are correct BIP-39 words.
            </p>
          )}
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onRestoreFromRecovery}
          loading={loading}
          disabled={!phraseValid}
        >
          Restore
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("credentials")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell back="/login" phase="Log in">
      <div className="flex flex-col items-center gap-3 mb-2">
        <Logo />
        <h2 className="text-2xl font-semibold">Log in to Veil</h2>
        <p className="text-sm text-text-muted text-center">
          Use the username and password you picked at signup.
        </p>
      </div>

      <div>
        <FieldLabel>Username</FieldLabel>
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-text-muted">
            @
          </span>
          <TextInput
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="yourname"
            autoComplete="username"
            spellCheck={false}
            className="pl-7"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Password</FieldLabel>
        <TextInput
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          className="accent-wa-green"
        />
        Show password
      </label>

      <ErrorMessage>{error}</ErrorMessage>
      <PrimaryButton onClick={onLogin} loading={loading} disabled={!credsValid}>
        Log in
      </PrimaryButton>

      {passkeysAvailable && (
        <>
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg px-3 text-xs uppercase tracking-wider text-text-muted">
                or
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onPasskeyLogin}
            disabled={passkeyBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-line bg-surface text-text font-semibold hover:bg-white/5 transition disabled:opacity-60 wa-tap"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 11c0 4 .5 6.5 2 9M8.5 19c-1-2-1.5-4-1.5-7a5 5 0 0110 0v1c0 2 .3 4 1 6M5 16c-.6-1.4-1-3-1-5a8 8 0 0116 0M9 9.5A3 3 0 0115 11c0 3 .3 5 1 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {passkeyBusy ? "Waiting for passkey…" : "Sign in with a passkey"}
          </button>
        </>
      )}

      <SecondaryButton onClick={() => navigate("/login")}>Back</SecondaryButton>
    </ScreenShell>
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String(
      (e as { message?: unknown }).message ?? "Something went wrong.",
    );
  }
  return "Something went wrong.";
}
