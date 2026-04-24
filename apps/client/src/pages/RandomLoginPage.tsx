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
import { SlidePuzzle } from "../components/SlidePuzzle";
import { PressAndHold } from "../components/PressAndHold";
import { PasskeySetupCard } from "../components/PasskeySetupCard";
import { loadIdentity } from "../lib/db";
import { useUnlockStore } from "../lib/unlockStore";
import { postAuthLandingPath } from "../lib/inviteRedirect";
import {
  isPasskeySupported,
  startPasskeyAuthentication,
} from "../lib/passkey";
import { humanizeErrorMessage } from "../lib/humanizeError";
import type {
  CompleteLoginV2Result,
  LoginContextInfo,
  RiskLevel,
} from "@veil/shared";
import { toast } from "../lib/toast";

/**
 * Premium login flow.
 *
 *   username  →  password  →  (verify if risky)  →  welcome  →  passkey?
 *
 * Each step is its own screen. Risk classification happens silently
 * on `auth.beginLoginV2`; the verify step only renders when the
 * server flags the request as medium / high risk. After a successful
 * sign-in we briefly show the user where + when their last sign-in
 * happened (for trust signal), then suggest creating a passkey
 * (skippable). If the local IndexedDB doesn't yet hold a derived
 * identity for this user, we still sign them in — but they won't
 * be able to decrypt past messages on this device until that
 * identity is brought across through a separate flow (it is no
 * longer pasted in here on the login screen).
 */

type Step =
  | "username"
  | "password"
  | "verify"
  | "deviceConflict"
  | "mustChangePassword"
  | "welcome"
  | "passkey";

interface PendingChallenge {
  nonce: string;
  reasons: string[];
  risk: RiskLevel;
  expiresInSeconds: number;
}

interface PendingDeviceConflict {
  pendingLoginToken: string;
  expiresInSeconds: number;
  existingDevice: string | null;
  existingCity: string | null;
  existingCountry: string | null;
  existingLastUsedAt: string | null;
  activeSessionCount: number;
}

interface PendingMustChange {
  mustChangeToken: string;
  expiresInSeconds: number;
}

export function RandomLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUnlocked = useUnlockStore((s) => s.setIdentity);

  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [puzzleToken, setPuzzleToken] = useState<string | null>(null);
  const [holdDone, setHoldDone] = useState(false);
  const [lastLogin, setLastLogin] = useState<LoginContextInfo | null>(null);
  const [conflict, setConflict] = useState<PendingDeviceConflict | null>(null);
  const [conflictBusy, setConflictBusy] = useState<"yes" | "no" | null>(null);
  const [mustChange, setMustChange] = useState<PendingMustChange | null>(null);

  const beginLogin = trpc.auth.beginLoginV3.useMutation();
  const completeLogin = trpc.auth.completeLoginV2.useMutation();
  const confirmReplaceSession =
    trpc.auth.confirmReplaceSession.useMutation();
  const rejectLoginAttempt = trpc.auth.rejectLoginAttempt.useMutation();
  const submitNewPassword = trpc.auth.submitNewPasswordAfterSecure.useMutation();
  const passkeyOptions = trpc.passkey.getAuthenticationOptions.useMutation();
  const passkeyVerify = trpc.passkey.verifyAuthentication.useMutation();
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeysAvailable = isPasskeySupported();

  const cleanUsername = username.trim().toLowerCase();
  const credsValid = cleanUsername.length >= 3 && password.length >= 8;

  /**
   * Land the freshly-issued session in the auth store. If we already
   * have the derived identity for this user on this device (the
   * common case for a returning user on the same browser) we unlock
   * the app's E2EE state in-place. Otherwise we just sign them in —
   * recovering the identity onto a brand-new device is a separate
   * flow and is no longer offered on the login screen.
   */
  async function landSession(
    r: CompleteLoginV2Result,
    next: "welcome",
  ): Promise<void> {
    setAuth({
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      refreshExpiresIn: r.refreshExpiresIn,
      user: r.user,
    });
    setLastLogin(r.lastLogin);

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
    }
    setStep(next);
  }

  /* ─────────── username step ─────────── */

  function onContinueFromUsername() {
    setError(null);
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    setStep("password");
  }

  /* ─────────── password step ─────────── */

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const r = await beginLogin.mutateAsync({
        username: cleanUsername,
        password,
      });
      if (r.status === "ok") {
        await landSession(
          {
            user: r.user,
            accessToken: r.accessToken,
            refreshToken: r.refreshToken,
            refreshExpiresIn: r.refreshExpiresIn,
            expiresIn: r.expiresIn,
            lastLogin: r.lastLogin,
          },
          "welcome",
        );
      } else if (r.status === "challenge") {
        setChallenge({
          nonce: r.challengeNonce,
          reasons: r.reasons,
          risk: r.risk,
          expiresInSeconds: r.challengeExpiresInSeconds,
        });
        setPuzzleToken(null);
        setHoldDone(false);
        setStep("verify");
      } else if (r.status === "deviceConflict") {
        setConflict({
          pendingLoginToken: r.pendingLoginToken,
          expiresInSeconds: r.expiresInSeconds,
          existingDevice: r.existingDevice,
          existingCity: r.existingCity,
          existingCountry: r.existingCountry,
          existingLastUsedAt: r.existingLastUsedAt,
          activeSessionCount: r.activeSessionCount,
        });
        setConflictBusy(null);
        setStep("deviceConflict");
      } else if (r.status === "mustChangePassword") {
        setMustChange({
          mustChangeToken: r.mustChangeToken,
          expiresInSeconds: r.expiresInSeconds,
        });
        setStep("mustChangePassword");
      }
    } catch (e) {
      setError(humanizeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

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
      await landSession(
        {
          user: r.user,
          accessToken: r.accessToken,
          refreshToken: r.refreshToken,
          refreshExpiresIn: r.refreshExpiresIn,
          expiresIn: r.expiresIn,
          // Passkey path doesn't currently surface lastLogin; keep null.
          lastLogin: null,
        },
        "welcome",
      );
    } catch (e) {
      setError(humanizeErrorMessage(e));
    } finally {
      setPasskeyBusy(false);
    }
  }

  /* ─────────── verify step ─────────── */

  async function onCompleteChallenge() {
    if (!challenge || !puzzleToken || !holdDone) return;
    setError(null);
    setLoading(true);
    try {
      const r = await completeLogin.mutateAsync({
        challengeNonce: challenge.nonce,
        botToken: puzzleToken,
      });
      await landSession(r, "welcome");
    } catch (e) {
      setError(humanizeErrorMessage(e));
      // Burn the puzzle token — server already consumed it. Force a
      // fresh puzzle round.
      setPuzzleToken(null);
      setHoldDone(false);
    } finally {
      setLoading(false);
    }
  }

  /* ─────────── deviceConflict (Yes / No) ─────────── */

  // "Yes — sign me in here." Calls the server, which kicks the old
  // device out + issues a session for us. We head straight for the
  // welcome screen — no extra password prompt.
  async function onConfirmReplaceSession() {
    if (!conflict || conflictBusy) return;
    setError(null);
    setConflictBusy("yes");
    try {
      const session = await confirmReplaceSession.mutateAsync({
        pendingLoginToken: conflict.pendingLoginToken,
      });
      await landSession(
        {
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          refreshExpiresIn: session.refreshExpiresIn,
          expiresIn: session.expiresIn,
          lastLogin: session.lastLogin,
        },
        "welcome",
      );
      setConflict(null);
    } catch (e) {
      setError(humanizeErrorMessage(e));
      setConflictBusy(null);
      setStep("password");
    }
  }

  // "No — that wasn't me." Calls the server (which alerts the other
  // device), then drops us back at the password screen with a soft
  // toast.
  async function onRejectLoginAttempt() {
    if (!conflict || conflictBusy) return;
    setError(null);
    setConflictBusy("no");
    try {
      await rejectLoginAttempt.mutateAsync({
        pendingLoginToken: conflict.pendingLoginToken,
      });
      toast.success(
        "Sign-in cancelled. We let your other device know.",
        { duration: 5000 },
      );
    } catch (e) {
      // Even if the alert fails to post, treat the user's "No" as
      // authoritative on this device — just let them know.
      toast.warning(humanizeErrorMessage(e), { duration: 5000 });
    } finally {
      setConflict(null);
      setConflictBusy(null);
      setStep("password");
    }
  }

  /* ─────────── mustChangePassword step ─────────── */

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const newPasswordValid =
    newPassword.length >= 8 && newPassword === confirmPassword;

  async function onSubmitNewPasswordAfterSecure() {
    if (!mustChange || !newPasswordValid) return;
    setError(null);
    setLoading(true);
    try {
      const r = await submitNewPassword.mutateAsync({
        mustChangeToken: mustChange.mustChangeToken,
        newPassword,
      });
      setPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setMustChange(null);
      await landSession(
        {
          user: r.user,
          accessToken: r.accessToken,
          refreshToken: r.refreshToken,
          refreshExpiresIn: r.refreshExpiresIn,
          expiresIn: r.expiresIn,
          lastLogin: r.lastLogin,
        },
        "welcome",
      );
    } catch (e) {
      setError(humanizeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Called from welcome / passkey when the user is ready to enter
   * the app.
   */
  function continueIntoApp() {
    navigate(postAuthLandingPath());
  }

  /* ─────────── render ─────────── */

  if (step === "username") {
    return (
      <ScreenShell back="/login" phase="Log in">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="text-sm text-text-muted text-center">
            Enter your username to continue.
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && cleanUsername.length >= 3) {
                  onContinueFromUsername();
                }
              }}
              placeholder="yourname"
              autoComplete="username"
              spellCheck={false}
              className="pl-7"
            />
          </div>
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onContinueFromUsername}
          disabled={cleanUsername.length < 3}
        >
          Continue
        </PrimaryButton>

        {passkeysAvailable && (
          <>
            <OrDivider />
            <PasskeyButton onClick={onPasskeyLogin} busy={passkeyBusy} />
          </>
        )}

        <SecondaryButton onClick={() => navigate("/login")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "password") {
    return (
      <ScreenShell back="#" phase="Log in">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">
            Hi <span className="text-wa-green">@{cleanUsername}</span>
          </h2>
          <p className="text-sm text-text-muted text-center">
            Enter your password to continue.
          </p>
        </div>

        <div>
          <FieldLabel>Password</FieldLabel>
          <TextInput
            autoFocus
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && credsValid && !loading) onLogin();
            }}
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

        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className={
            "self-center text-[13px] text-wa-green-dark dark:text-wa-green " +
            "hover:underline underline-offset-2"
          }
        >
          Forgot password?
        </button>

        {passkeysAvailable && (
          <>
            <OrDivider />
            <PasskeyButton onClick={onPasskeyLogin} busy={passkeyBusy} />
          </>
        )}

        <SecondaryButton onClick={() => setStep("username")}>
          Use a different username
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "verify") {
    const reasonText =
      challenge && challenge.reasons.length > 0
        ? challenge.reasons.join(" · ")
        : "unusual activity";
    const canSubmit = Boolean(puzzleToken) && holdDone && !loading;
    return (
      <ScreenShell back="#" phase="Quick check">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Quick check</h2>
          <p className="text-sm text-text-muted text-center">
            Unusual activity detected. Please confirm you're a real user.
          </p>
          <p className="text-[11px] text-text-faint text-center">
            ({reasonText})
          </p>
        </div>

        <div>
          <FieldLabel>Step 1 — Solve the puzzle</FieldLabel>
          {puzzleToken ? (
            <div className="rounded-xl border border-wa-green/40 bg-wa-green/5 p-3 text-sm text-wa-green-dark dark:text-wa-green text-center">
              Puzzle solved ✓
            </div>
          ) : (
            <SlidePuzzle onSolved={(t) => setPuzzleToken(t)} />
          )}
        </div>

        <div className="mt-2">
          <FieldLabel>Step 2 — Press &amp; hold</FieldLabel>
          <PressAndHold
            disabled={!puzzleToken}
            onComplete={() => setHoldDone(true)}
            label={puzzleToken ? "Press and hold to continue" : "Solve the puzzle first"}
          />
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onCompleteChallenge}
          loading={loading}
          disabled={!canSubmit}
        >
          Confirm and continue
        </PrimaryButton>

        <SecondaryButton onClick={() => setStep("password")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "deviceConflict" && conflict) {
    const place = [conflict.existingCity, conflict.existingCountry]
      .filter(Boolean)
      .join(", ");
    const otherCount = Math.max(1, conflict.activeSessionCount);
    const otherLabel =
      otherCount > 1
        ? `${otherCount} other devices are signed in`
        : `Another device is already signed in`;
    return (
      <ScreenShell back="#" phase="Already signed in elsewhere">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-center">{otherLabel}</h2>
          <p className="text-sm text-text-muted text-center max-w-sm">
            <span className="text-text">@{cleanUsername}</span> is currently
            signed in on{" "}
            <span className="text-text">
              {conflict.existingDevice ?? "another device"}
            </span>
            {place ? <> ({place})</> : null}
            {conflict.existingLastUsedAt ? (
              <>
                {" "}
                · last used{" "}
                <span className="text-text-muted">
                  {formatRelative(conflict.existingLastUsedAt)}
                </span>
              </>
            ) : null}
            . Veil only allows one device at a time.
          </p>
          <p className="text-sm text-text text-center max-w-sm">
            Was that you?
          </p>
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <PrimaryButton
          onClick={onConfirmReplaceSession}
          loading={conflictBusy === "yes"}
          disabled={conflictBusy !== null}
        >
          Yes — sign me in here
        </PrimaryButton>
        <SecondaryButton
          onClick={onRejectLoginAttempt}
          disabled={conflictBusy !== null}
        >
          {conflictBusy === "no" ? "Cancelling…" : "No — that wasn't me"}
        </SecondaryButton>

        <p className="text-[11px] text-text-faint text-center max-w-sm">
          Choosing "Yes" will instantly sign out the other device. Choosing
          "No" will alert it so you can review the attempt.
        </p>
      </ScreenShell>
    );
  }

  if (step === "mustChangePassword" && mustChange) {
    return (
      <ScreenShell back="#" phase="Choose a new password">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-center">
            Choose a new password
          </h2>
          <p className="text-sm text-text-muted text-center">
            You (or this device) recently secured this account. To finish
            signing in, please pick a new password.
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
          <FieldLabel>Confirm new password</FieldLabel>
          <TextInput
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                newPasswordValid &&
                !loading
              ) {
                void onSubmitNewPasswordAfterSecure();
              }
            }}
            placeholder="Type it again"
            autoComplete="new-password"
          />
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Passwords don&apos;t match yet.
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
          Show passwords
        </label>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onSubmitNewPasswordAfterSecure}
          loading={loading}
          disabled={!newPasswordValid}
        >
          Set new password and sign in
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "welcome") {
    return (
      <ScreenShell back="#" phase="Welcome">
        <div className="flex flex-col items-center gap-3 mb-2">
          <SuccessCheck />
          <h2 className="text-2xl font-semibold">You're signed in</h2>
          {lastLogin ? (
            <p className="text-sm text-text-muted text-center">
              Last sign-in {formatPlace(lastLogin)} on{" "}
              <span className="text-text">{lastLogin.device}</span>
              {lastLogin.at ? (
                <>
                  {" "}
                  · <span className="text-text-muted">{formatRelative(lastLogin.at)}</span>
                </>
              ) : null}
              .
            </p>
          ) : (
            <p className="text-sm text-text-muted text-center">
              Welcome to Veil — your messages stay between you.
            </p>
          )}
        </div>

        <PrimaryButton onClick={() => setStep("passkey")}>
          Continue
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "passkey") {
    return (
      <ScreenShell back="#" phase="One last thing">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Sign in faster next time</h2>
          <p className="text-sm text-text-muted text-center">
            Add a passkey to skip your password — sign in with Face ID, Touch
            ID, or your security key.
          </p>
        </div>

        <PasskeySetupCard onAdded={() => continueIntoApp()} />

        <SecondaryButton onClick={continueIntoApp}>
          Skip for now
        </SecondaryButton>
      </ScreenShell>
    );
  }

  return null;
}

/* ─────────── small helpers + presentational pieces ─────────── */

function OrDivider() {
  return (
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
  );
}

function PasskeyButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
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
      {busy ? "Waiting for passkey…" : "Sign in with a passkey"}
    </button>
  );
}

function SuccessCheck() {
  return (
    <div className="w-16 h-16 rounded-full bg-wa-green/15 border border-wa-green/40 flex items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-wa-green"
        />
      </svg>
    </div>
  );
}

function formatPlace(info: LoginContextInfo): string {
  if (info.city && info.country) return `from ${info.city}, ${info.country}`;
  if (info.city) return `from ${info.city}`;
  if (info.country) return `from ${info.country}`;
  return "from a known network";
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)} hr ago`;
  if (diffSec < 30 * 86_400) return `${Math.floor(diffSec / 86_400)} days ago`;
  return new Date(iso).toLocaleDateString();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
