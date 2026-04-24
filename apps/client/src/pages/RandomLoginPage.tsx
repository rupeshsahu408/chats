import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { trpcClientProxy } from "../lib/trpcClientProxy";
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
 * (skippable). The final step also handles the recovery-key path
 * when the local IndexedDB doesn't yet hold a derived identity.
 */

type Step =
  | "username"
  | "password"
  | "verify"
  | "deviceConflict"
  | "mustChangePassword"
  | "passwordSuggestion"
  | "welcome"
  | "passkey"
  | "recovery";

interface PendingChallenge {
  nonce: string;
  reasons: string[];
  risk: RiskLevel;
  expiresInSeconds: number;
}

interface PendingDeviceConflict {
  conflictId: string;
  continuationNonce: string;
  expiresInSeconds: number;
  existingDevice: string | null;
  existingCity: string | null;
  existingCountry: string | null;
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
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [puzzleToken, setPuzzleToken] = useState<string | null>(null);
  const [holdDone, setHoldDone] = useState(false);
  const [lastLogin, setLastLogin] = useState<LoginContextInfo | null>(null);
  const [needsRecoveryAfter, setNeedsRecoveryAfter] = useState<
    "welcome" | "passkey" | null
  >(null);
  const [conflict, setConflict] = useState<PendingDeviceConflict | null>(null);
  const [mustChange, setMustChange] = useState<PendingMustChange | null>(null);
  /**
   * After an accepted-conflict landing we offer the user a chance
   * to refresh their password. They can skip — when they do we
   * remember it on this device so we don't nag again.
   */
  const [didReplaceDevice, setDidReplaceDevice] = useState(false);

  const beginLogin = trpc.auth.beginLoginV3.useMutation();
  const completeLogin = trpc.auth.completeLoginV2.useMutation();
  const completeAfterApproval = trpc.auth.completeAfterApproval.useMutation();
  const submitNewPassword = trpc.auth.submitNewPasswordAfterSecure.useMutation();
  const changePassword = trpc.auth.changePassword.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();
  const passkeyOptions = trpc.passkey.getAuthenticationOptions.useMutation();
  const passkeyVerify = trpc.passkey.verifyAuthentication.useMutation();
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeysAvailable = isPasskeySupported();

  const cleanUsername = username.trim().toLowerCase();
  const credsValid = cleanUsername.length >= 3 && password.length >= 8;
  const phraseValid = isValidRecoveryPhrase(phrase.trim().toLowerCase());

  /**
   * Land the freshly-issued session in the auth store, then either
   * unlock immediately (when we already have the derived identity for
   * this user on this device) or branch into the recovery-key step.
   */
  async function landSession(
    r: CompleteLoginV2Result,
    next: "welcome" | "passwordSuggestion",
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
      setStep(next);
      return;
    }
    // No local identity yet — we'll need the recovery key, but only
    // *after* the welcome / passkey screens so the flow stays smooth.
    setPendingUserId(r.user.id);
    setNeedsRecoveryAfter("passkey");
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
          conflictId: r.conflictId,
          continuationNonce: r.continuationNonce,
          expiresInSeconds: r.expiresInSeconds,
          existingDevice: r.existingDevice,
          existingCity: r.existingCity,
          existingCountry: r.existingCountry,
        });
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

  /* ─────────── deviceConflict polling ─────────── */

  // While we sit on the conflict screen, poll the server every ~2.5s
  // to find out whether the existing device has accepted, rejected,
  // or let the request expire. On accept we exchange the continuation
  // nonce for a real session in the same effect.
  const pollAttemptsRef = useRef(0);
  useEffect(() => {
    if (step !== "deviceConflict" || !conflict) {
      pollAttemptsRef.current = 0;
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      pollAttemptsRef.current += 1;
      try {
        const r = await trpcClientProxy().auth.pollLoginConflict.query({
          conflictId: conflict.conflictId,
          continuationNonce: conflict.continuationNonce,
        });
        if (cancelled) return;
        if (r.status === "accepted") {
          // Claim the session in-place.
          try {
            const session = await completeAfterApproval.mutateAsync({
              continuationNonce: conflict.continuationNonce,
            });
            setDidReplaceDevice(session.replacedSessions > 0);
            await landSession(
              {
                user: session.user,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
                refreshExpiresIn: session.refreshExpiresIn,
                expiresIn: session.expiresIn,
                lastLogin: session.lastLogin,
              },
              "passwordSuggestion",
            );
          } catch (e) {
            setError(humanizeErrorMessage(e));
            setStep("password");
          }
        } else if (r.status === "rejected") {
          setError(
            "Your other device denied this sign-in. If that wasn't you, change your password right away.",
          );
          setStep("password");
        } else if (r.status === "expired") {
          setError(
            "The other device didn't respond in time. Please try again.",
          );
          setStep("password");
        }
      } catch {
        /* swallow — keep polling */
      }
    };
    // First poll immediately, then every 2.5s.
    void tick();
    const t = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, conflict?.conflictId, conflict?.continuationNonce]);

  function cancelConflict() {
    setConflict(null);
    setStep("password");
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

  /* ─────────── passwordSuggestion (after conflict-accept) ─────────── */

  async function onChangePasswordPostLogin() {
    if (!newPasswordValid) return;
    setError(null);
    setLoading(true);
    try {
      await changePassword.mutateAsync({
        currentPassword: password,
        newPassword,
      });
      setPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
      setStep("welcome");
    } catch (e) {
      setError(humanizeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  /* ─────────── recovery step ─────────── */

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
      setError(humanizeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Called from welcome / passkey when the user is ready to enter the
   * app. If they still need to enter a recovery phrase, we route them
   * through `recovery`; otherwise we go straight in.
   */
  function continueIntoApp() {
    if (needsRecoveryAfter) {
      setStep("recovery");
    } else {
      navigate(postAuthLandingPath());
    }
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
    return (
      <ScreenShell back="#" phase="Confirming on your other device">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Spinner />
          <h2 className="text-2xl font-semibold text-center">
            Waiting for your other device
          </h2>
          <p className="text-sm text-text-muted text-center max-w-sm">
            We sent a confirmation prompt to{" "}
            <span className="text-text">
              {conflict.existingDevice ?? "your other device"}
            </span>
            {place ? <> ({place})</> : null}. Approve it there to finish
            signing in here. Only one device can be signed in at a time.
          </p>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <SecondaryButton onClick={cancelConflict}>Cancel</SecondaryButton>
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

  if (step === "passwordSuggestion") {
    return (
      <ScreenShell back="#" phase="Quick suggestion">
        <div className="flex flex-col items-center gap-3 mb-2">
          <SuccessCheck />
          <h2 className="text-2xl font-semibold text-center">
            You&apos;re signed in
          </h2>
          <p className="text-sm text-text-muted text-center max-w-sm">
            {didReplaceDevice
              ? "Your previous device has been signed out. While we have you here, you can take a moment to refresh your password — totally optional."
              : "While we have you here, you can take a moment to refresh your password — totally optional."}
          </p>
        </div>

        <div>
          <FieldLabel>New password (optional)</FieldLabel>
          <TextInput
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
          onClick={onChangePasswordPostLogin}
          loading={loading}
          disabled={!newPasswordValid}
        >
          Update password
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("welcome")}>
          Skip for now
        </SecondaryButton>
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

function Spinner() {
  return (
    <div className="w-14 h-14 rounded-full border-4 border-wa-green/20 border-t-wa-green animate-spin" />
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
