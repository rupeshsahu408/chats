import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import {
  ScreenShell,
  Logo,
  PrimaryButton,
  SecondaryButton,
  FieldLabel,
  TextInput,
  ErrorMessage,
  InfoMessage,
} from "../components/Layout";
import {
  bytesToBase64,
  deriveIdentityFromPhrase,
  isValidRecoveryPhrase,
  signMessage,
} from "../lib/crypto";
import { humanizeErrorMessage } from "../lib/humanizeError";
import { toast } from "../lib/toast";

/**
 * Forgot-password flow for username accounts.
 *
 *   username → recovery key (upload or paste 12 words) →
 *   strong new password → success → optional "set up a passkey".
 *
 * The recovery phrase never leaves the device. The client signs a
 * server-issued challenge nonce with the Ed25519 key derived from
 * the phrase; the server verifies that signature against the
 * `users.identity_pubkey` it stored at signup before letting the
 * password be reset.
 *
 * No OTP, no email link — proof of phrase is the only factor.
 */
type Step = "username" | "key" | "password" | "done";
type KeyMode = "paste" | "upload";

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("username");

  /* username step */
  const [username, setUsername] = useState("");
  const cleanUsername = useMemo(
    () => username.trim().toLowerCase(),
    [username],
  );

  /* shared between server round-trips */
  const [challengeNonce, setChallengeNonce] = useState("");

  /* recovery-key step */
  const [keyMode, setKeyMode] = useState<KeyMode>("paste");
  const [phrase, setPhrase] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phraseValid = isValidRecoveryPhrase(phrase);

  /* derived during the key step, kept for the password step */
  const [identityPubkey, setIdentityPubkey] = useState("");
  const [signature, setSignature] = useState("");

  /* password step */
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordStrong = newPassword.length >= 8;
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const beginReset = trpc.auth.beginPasswordReset.useMutation();
  const completeReset = trpc.auth.completePasswordReset.useMutation();

  /* ─── handlers ──────────────────────────────────────────── */

  async function onSubmitUsername() {
    if (!cleanUsername) return;
    setError(null);
    setLoading(true);
    try {
      const r = await beginReset.mutateAsync({ username: cleanUsername });
      setChallengeNonce(r.challengeNonce);
      setStep("key");
    } catch (e) {
      setError(humanizeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function onUploadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      // Best-effort: extract a 12-word BIP-39 mnemonic from anywhere
      // in the uploaded file. Works for plain .txt dumps, JSON
      // exports, etc. PDFs aren't supported — fall back to paste.
      const candidate = extractPhrase(text);
      if (candidate && isValidRecoveryPhrase(candidate)) {
        setPhrase(candidate);
        setError(null);
        toast.success("Recovery phrase loaded.");
      } else {
        setError(
          "Couldn't find a 12-word recovery phrase in that file. Try pasting the words instead.",
        );
      }
    };
    reader.onerror = () => {
      setError("Couldn't read that file.");
    };
    reader.readAsText(file);
  }

  function onSubmitKey() {
    if (!phraseValid || !challengeNonce) return;
    setError(null);
    try {
      // Derive Ed25519 keypair, sign the server's challenge.
      // This proves possession of the phrase without sending it.
      const kp = deriveIdentityFromPhrase(phrase);
      const sig = signMessage(kp.privateKey, challengeNonce);
      setIdentityPubkey(bytesToBase64(kp.publicKey));
      setSignature(sig);
      // Wipe the phrase from React state the moment we no longer
      // need it. (It survives in the input's DOM until unmount.)
      setPhrase("");
      setStep("password");
    } catch (e) {
      setError(humanizeErrorMessage(e));
    }
  }

  async function onSubmitPassword() {
    if (!passwordStrong || !passwordsMatch) return;
    setError(null);
    setLoading(true);
    try {
      await completeReset.mutateAsync({
        challengeNonce,
        identityPubkey,
        signature,
        newPassword,
      });
      // Belt-and-suspenders: clear the secrets from state.
      setNewPassword("");
      setConfirmPassword("");
      setSignature("");
      setStep("done");
    } catch (e) {
      const msg = humanizeErrorMessage(e);
      setError(msg);
      // If the nonce was rejected, the user has to start over —
      // sending a new request gets a fresh nonce.
      if (/recovery key|expired|invalid|verify/i.test(msg)) {
        setStep("username");
        setChallengeNonce("");
        setIdentityPubkey("");
        setSignature("");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ─── render ────────────────────────────────────────────── */

  if (step === "username") {
    return (
      <ScreenShell back="/login" phase="Reset password">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Forgot your password?</h2>
          <p className="text-sm text-text-muted text-center">
            No problem — your 12-word recovery key can get you back in.
          </p>
        </div>

        <div>
          <FieldLabel>Username</FieldLabel>
          <TextInput
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cleanUsername && !loading)
                void onSubmitUsername();
            }}
            placeholder="your_username"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="off"
          />
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={() => void onSubmitUsername()}
          loading={loading}
          disabled={!cleanUsername}
        >
          Continue
        </PrimaryButton>

        <SecondaryButton onClick={() => navigate("/login/random")}>
          Back to log in
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "key") {
    return (
      <ScreenShell back="#" phase="Recovery key">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Use your recovery key</h2>
          <p className="text-sm text-text-muted text-center">
            Upload the file from your recovery kit, or paste the 12 words. Your
            recovery key never leaves this device.
          </p>
        </div>

        {/* tabs */}
        <div className="flex rounded-xl bg-surface border border-line/70 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setKeyMode("paste")}
            className={
              "flex-1 rounded-lg py-2 transition-colors " +
              (keyMode === "paste"
                ? "bg-wa-green text-text-oncolor"
                : "text-text-muted hover:text-text")
            }
          >
            Paste 12 words
          </button>
          <button
            type="button"
            onClick={() => setKeyMode("upload")}
            className={
              "flex-1 rounded-lg py-2 transition-colors " +
              (keyMode === "upload"
                ? "bg-wa-green text-text-oncolor"
                : "text-text-muted hover:text-text")
            }
          >
            Upload file
          </button>
        </div>

        {keyMode === "paste" && (
          <div>
            <FieldLabel>Recovery phrase</FieldLabel>
            <textarea
              autoFocus
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              rows={4}
              placeholder="abandon ability able about above absent absorb abstract absurd abuse access accident"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              className={
                "w-full rounded-xl bg-surface border border-line/70 " +
                "px-3 py-2.5 text-[15px] leading-relaxed " +
                "focus:outline-none focus:ring-2 focus:ring-wa-green/40 " +
                "placeholder:text-text-faint resize-none"
              }
            />
            <p className="mt-1 text-[11.5px] text-text-faint">
              {phrase.trim().split(/\s+/).filter(Boolean).length} / 12 words
              {phrase.length > 0 && !phraseValid && (
                <span className="ml-1 text-rose-500">
                  · doesn&apos;t match a valid recovery phrase
                </span>
              )}
            </p>
          </div>
        )}

        {keyMode === "upload" && (
          <div>
            <FieldLabel>Recovery key file</FieldLabel>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={
                "w-full rounded-xl border-2 border-dashed border-line/70 " +
                "bg-surface px-4 py-6 text-sm text-text-muted " +
                "hover:border-wa-green/50 hover:text-text transition-colors"
              }
            >
              {phrase && phraseValid
                ? "Recovery phrase loaded ✓ — tap to choose a different file"
                : "Tap to choose a recovery file (.txt, .json)"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,.csv,text/plain,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFile(f);
                e.target.value = "";
              }}
            />
            <InfoMessage>
              The recovery PDF isn&apos;t supported here — open it and paste the
              12 words instead.
            </InfoMessage>
          </div>
        )}

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton onClick={onSubmitKey} disabled={!phraseValid}>
          Continue
        </PrimaryButton>

        <SecondaryButton onClick={() => setStep("username")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "password") {
    return (
      <ScreenShell back="#" phase="New password">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Choose a new password</h2>
          <p className="text-sm text-text-muted text-center">
            Make it long and unique. You&apos;ll use it the next time you sign
            in.
          </p>
        </div>

        <div>
          <FieldLabel>New password</FieldLabel>
          <TextInput
            autoFocus
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div>
          <FieldLabel>Confirm password</FieldLabel>
          <TextInput
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                passwordStrong &&
                passwordsMatch &&
                !loading
              )
                void onSubmitPassword();
            }}
            placeholder="Repeat your new password"
            autoComplete="new-password"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-[11.5px] text-rose-500">
              Passwords don&apos;t match.
            </p>
          )}
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
        <PrimaryButton
          onClick={() => void onSubmitPassword()}
          loading={loading}
          disabled={!passwordStrong || !passwordsMatch}
        >
          Reset password
        </PrimaryButton>
      </ScreenShell>
    );
  }

  // step === "done"
  return (
    <ScreenShell back="#" phase="All set">
      <div className="flex flex-col items-center gap-3 mb-2">
        <SuccessCheck />
        <h2 className="text-2xl font-semibold">Password updated</h2>
        <p className="text-sm text-text-muted text-center">
          You can now sign in to{" "}
          <span className="text-wa-green">@{cleanUsername}</span> with your new
          password.
        </p>
      </div>

      <div
        className={
          "rounded-2xl border border-line/70 bg-surface p-4 text-sm " +
          "text-text-muted leading-relaxed"
        }
      >
        <div className="font-semibold text-text mb-1">
          Want to skip the password next time?
        </div>
        Set up a passkey on this device — your fingerprint or face will unlock
        Veil instantly, no password needed.
      </div>

      <PrimaryButton onClick={() => navigate("/login/random")}>
        Go to log in
      </PrimaryButton>
    </ScreenShell>
  );
}

/* ─────────── helpers ─────────── */

/**
 * Pull a 12-word lowercase BIP-39 phrase out of arbitrary text.
 * Handles JSON exports, comma-separated lists, numbered lines, etc.
 */
function extractPhrase(text: string): string | null {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length >= 3);
  // Try every 12-word window — first one that validates wins.
  for (let i = 0; i + 12 <= words.length; i++) {
    const candidate = words.slice(i, i + 12).join(" ");
    if (isValidRecoveryPhrase(candidate)) return candidate;
  }
  return null;
}

function SuccessCheck() {
  return (
    <div
      className={
        "size-16 rounded-full bg-wa-green/15 border border-wa-green/40 " +
        "flex items-center justify-center text-wa-green-dark dark:text-wa-green"
      }
    >
      <svg
        viewBox="0 0 24 24"
        width={32}
        height={32}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5l4 4L19 6.5" />
      </svg>
    </div>
  );
}
