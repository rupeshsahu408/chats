import { useEffect, useMemo, useRef, useState } from "react";
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
import { RecoveryKitDownloadCard } from "../components/RecoveryKitDownloadCard";
import { PasskeySetupCard } from "../components/PasskeySetupCard";
import { isPasskeySupported } from "../lib/passkey";
import {
  bytesToBase64,
  generateRecoveryPhrase,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
} from "../lib/crypto";
import { x25519PublicKeyFromPrivate } from "../lib/signal/x25519";
import { saveIdentity } from "../lib/db";
import { buildPrekeyBundle } from "../lib/prekeys";
import { useUnlockStore } from "../lib/unlockStore";
import { postAuthLandingPath } from "../lib/inviteRedirect";
import { resizeAvatarToDataUrl } from "../lib/avatar";
import { markDailyVerified } from "../lib/dailyVerification";
import { encryptRecoveryPhraseForServer } from "../lib/unlock";

type Step =
  | "username"
  | "password"
  | "verification"
  | "puzzle"
  | "ceremony"
  | "recovery"
  | "passkey"
  | "name"
  | "bio"
  | "photo"
  | "welcome";

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{2,23}$/;

function localUsernameError(value: string): string | null {
  if (!value) return null;
  if (value.length < 3) return "At least 3 characters.";
  if (value.length > 24) return "At most 24 characters.";
  if (!USERNAME_RE.test(value)) {
    return "Only letters, numbers, dot or underscore. Must start with a letter or number.";
  }
  return null;
}

export function RandomIdSignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUnlocked = useUnlockStore((s) => s.setIdentity);

  const [step, setStep] = useState<Step>("username");

  // Step 1 — username
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Step 2 — password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 — daily verification password
  const [verificationPassword, setVerificationPassword] = useState("");
  const [confirmVerificationPassword, setConfirmVerificationPassword] =
    useState("");
  const [showVerificationPassword, setShowVerificationPassword] =
    useState(false);

  // Step 4 — puzzle
  const [botToken, setBotToken] = useState<string | null>(null);

  // Step 4 — recovery key (generated lazily once username+password+puzzle pass)
  const [phrase, setPhrase] = useState<string | null>(null);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);

  // Step 5..7 — optional profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Step 8 — final account creation/done
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trpcUtils = trpc.useUtils();
  const signup = trpc.auth.signupRandomV2.useMutation();
  const updateProfile = trpc.me.updateProfile.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();

  const localUsernameProblem = useMemo(
    () => localUsernameError(username),
    [username],
  );

  // Debounced username availability check
  useEffect(() => {
    setUsernameAvailable(null);
    setUsernameError(localUsernameProblem);
    if (!username || localUsernameProblem) return;
    const handle = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const r = await trpcUtils.auth.checkUsername.fetch({ username });
        setUsernameAvailable(r.available);
        if (!r.available) {
          setUsernameError(
            r.reason === "reserved"
              ? "That username is reserved."
              : "That username is already taken.",
          );
        }
      } catch {
        // Ignore — user can retry on Continue.
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, localUsernameProblem]);

  /**
   * Notification fired by `RecoveryKitDownloadCard` once the user
   * has actually saved the PDF — gates the "I've saved it" CTA.
   */
  function markRecoveryDownloaded() {
    setRecoveryDownloaded(true);
  }

  async function createAccount(): Promise<boolean> {
    if (!phrase || !botToken) return false;
    setError(null);
    setCreating(true);
    try {
      const ed = deriveIdentityFromPhrase(phrase);
      const { privateKey: x25519Priv } = deriveX25519FromPhrase(phrase);
      const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);
      const x25519Kp = { privateKey: x25519Priv, publicKey: x25519Pub };

      // Encrypt the recovery phrase with the daily verification password
      // so the server can hand it back when the user later signs in on a
      // new device with only their daily password (no rotation needed —
      // the original identity is restored from the decrypted phrase).
      const encryptedRecoveryPhrase = await encryptRecoveryPhraseForServer(
        phrase,
        verificationPassword,
      );

      const r = await signup.mutateAsync({
        username,
        password,
        verificationPassword,
        identityPublicKey: bytesToBase64(ed.publicKey),
        botToken,
        encryptedRecoveryPhrase,
      });
      setAuth({
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        refreshExpiresIn: r.refreshExpiresIn,
        user: r.user,
      });
      // Just verified during signup — start the 24h clock from now
      // so the gate doesn't trigger immediately on first login.
      try {
        markDailyVerified(r.user.id);
      } catch {
        /* localStorage may be disabled */
      }

      await saveIdentity({
        id: "self",
        userId: r.user.id,
        encPrivateKey: bytesToBase64(ed.privateKey),
        iv: "phrase-derived",
        salt: "phrase-derived",
        publicKey: bytesToBase64(ed.publicKey),
        encX25519PrivateKey: bytesToBase64(x25519Priv),
        iv2: "phrase-derived",
        salt2: "phrase-derived",
        x25519PublicKey: bytesToBase64(x25519Pub),
        recoveryPhrase: phrase,
        createdAt: new Date().toISOString(),
      });

      try {
        await setX25519.mutateAsync({ publicKey: bytesToBase64(x25519Pub) });
      } catch (e) {
        console.warn("Failed to register X25519 identity", e);
      }

      try {
        const bundle = await buildPrekeyBundle({
          identityPrivateKey: ed.privateKey,
          numOneTime: 20,
          freshStart: true,
        });
        await uploadPrekeys.mutateAsync(bundle);
      } catch (e) {
        console.warn("Prekey bootstrap failed", e);
      }

      await setUnlocked({
        userId: r.user.id,
        ed25519: ed,
        x25519: x25519Kp,
      });

      return true;
    } catch (e) {
      setError(messageOf(e));
      // Burn the bot token; user has to redo the puzzle.
      setBotToken(null);
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function flushOptionalProfile() {
    const patch: {
      displayName?: string | null;
      bio?: string | null;
      avatarDataUrl?: string | null;
    } = {};
    const dn = displayName.trim();
    const b = bio.trim();
    if (dn) patch.displayName = dn;
    if (b) patch.bio = b;
    if (avatarDataUrl) patch.avatarDataUrl = avatarDataUrl;
    if (Object.keys(patch).length === 0) return;
    try {
      await updateProfile.mutateAsync(patch);
    } catch (e) {
      console.warn("Profile update failed (continuing)", e);
    }
  }

  /* ─────────── Step UIs ─────────── */

  if (step === "username") {
    // Don't block Continue on the availability check — the server will
    // reject duplicates when the user finishes signup. This avoids a
    // permanently-disabled button whenever the check is slow, blocked,
    // or the deployed server doesn't expose this endpoint yet.
    const canContinue =
      !!username && !localUsernameProblem && usernameAvailable !== false;
    return (
      <ScreenShell back="/" phase="Step 1 of 10 · Username">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">Pick a username</h2>
          <p className="text-sm text-text-muted text-center">
            This is how friends find you on Veil. It's permanent — you can't
            change it later.
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
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().slice(0, 24))
              }
              placeholder="yourname"
              autoComplete="off"
              className="pl-7"
              spellCheck={false}
            />
          </div>
          <div className="mt-2 min-h-[1.25rem] text-xs">
            {usernameError ? (
              <span className="text-red-500">{usernameError}</span>
            ) : checkingUsername ? (
              <span className="text-text-muted">Checking…</span>
            ) : usernameAvailable === true ? (
              <span className="text-wa-green-dark dark:text-wa-green">
                @{username} is available ✓
              </span>
            ) : (
              <span className="text-text-faint">
                3–24 chars, letters/numbers/dot/underscore.
              </span>
            )}
          </div>
        </div>

        <PrimaryButton
          onClick={() => setStep("password")}
          disabled={!canContinue}
        >
          Continue
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "password") {
    const tooShort = password.length > 0 && password.length < 8;
    const mismatch =
      confirmPassword.length > 0 && confirmPassword !== password;
    const canContinue =
      password.length >= 8 && confirmPassword === password && !mismatch;
    return (
      <ScreenShell back="#" phase="Step 2 of 10 · Password">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">Set a password</h2>
          <p className="text-sm text-text-muted text-center">
            You'll use this to sign in on this device. Your messages are
            protected by a separate recovery key (next step).
          </p>
        </div>

        <div>
          <FieldLabel>Password</FieldLabel>
          <TextInput
            autoFocus
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          {tooShort && (
            <p className="text-xs text-red-500 mt-1">
              At least 8 characters.
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Confirm password</FieldLabel>
          <TextInput
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
            autoComplete="new-password"
          />
          {mismatch && (
            <p className="text-xs text-red-500 mt-1">
              Passwords don't match.
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

        <PrimaryButton
          onClick={() => setStep("verification")}
          disabled={!canContinue}
        >
          Continue
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("username")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "verification") {
    const tooShort =
      verificationPassword.length > 0 && verificationPassword.length < 8;
    const sameAsLogin =
      verificationPassword.length >= 8 && verificationPassword === password;
    const mismatch =
      confirmVerificationPassword.length > 0 &&
      confirmVerificationPassword !== verificationPassword;
    const canContinue =
      verificationPassword.length >= 8 &&
      confirmVerificationPassword === verificationPassword &&
      !mismatch;
    return (
      <ScreenShell back="#" phase="Step 3 of 10 · Daily verification">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">
            Set a daily verification password
          </h2>
          <p className="text-sm text-text-muted text-center">
            For extra security, you'll be asked to enter this password
            every 24 hours before opening the app. Make it different from
            your login password.
          </p>
        </div>

        <div>
          <FieldLabel>Verification password</FieldLabel>
          <TextInput
            autoFocus
            type={showVerificationPassword ? "text" : "password"}
            value={verificationPassword}
            onChange={(e) => setVerificationPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          {tooShort && (
            <p className="text-xs text-red-500 mt-1">
              At least 8 characters.
            </p>
          )}
          {!tooShort && sameAsLogin && (
            <p className="text-xs text-amber-500 mt-1">
              Tip: pick something different from your login password.
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Confirm verification password</FieldLabel>
          <TextInput
            type={showVerificationPassword ? "text" : "password"}
            value={confirmVerificationPassword}
            onChange={(e) =>
              setConfirmVerificationPassword(e.target.value)
            }
            placeholder="Type it again"
            autoComplete="new-password"
          />
          {mismatch && (
            <p className="text-xs text-red-500 mt-1">
              Passwords don't match.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={showVerificationPassword}
            onChange={(e) => setShowVerificationPassword(e.target.checked)}
            className="accent-wa-green"
          />
          Show password
        </label>

        <PrimaryButton
          onClick={() => setStep("puzzle")}
          disabled={!canContinue}
        >
          Continue
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("password")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "puzzle") {
    return (
      <ScreenShell back="#" phase="Step 4 of 10 · Human check">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">
            Quick human check
          </h2>
          <p className="text-sm text-text-muted text-center">
            Slide the piece into the matching hole.
          </p>
        </div>

        <SlidePuzzle
          onSolved={(token) => {
            setBotToken(token);
          }}
        />

        <PrimaryButton
          onClick={() => setStep("ceremony")}
          disabled={!botToken}
        >
          Continue
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("verification")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "ceremony") {
    return (
      <ScreenShell phase="Step 5 of 10 · Forging your identity">
        <KeyCeremony
          onReady={() => {
            // Generate the recovery phrase deterministically once the
            // ceremony lands. We do it at the very end so the user has
            // a sense of "the keys just appeared" instead of seeing
            // them blank-then-filled.
            if (!phrase) setPhrase(generateRecoveryPhrase());
          }}
          onContinue={() => setStep("recovery")}
        />
      </ScreenShell>
    );
  }

  if (step === "recovery") {
    const words = phrase ? phrase.split(" ") : [];
    return (
      <ScreenShell back="#" phase="Step 6 of 10 · Recovery key">
        <RecoveryReveal
          words={words}
          username={username}
          downloaded={recoveryDownloaded}
          creating={creating}
          error={error}
          onDownload={markRecoveryDownloaded}
          onConfirm={async () => {
            const ok = await createAccount();
            if (ok) setStep("passkey");
          }}
        />
      </ScreenShell>
    );
  }

  if (step === "passkey") {
    const supported = isPasskeySupported();
    return (
      <ScreenShell phase="Step 7 of 10 · Passkey">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">
            Add a passkey
          </h2>
          <p className="text-sm text-text-muted text-center">
            Recommended. Sign in on this device with Face ID, Touch ID, or
            Windows Hello — no password to remember, nothing to phish. You can
            always add or remove passkeys later in Settings.
          </p>
        </div>

        <PasskeySetupCard onAdded={() => setStep("name")} />

        <button
          type="button"
          onClick={() => setStep("name")}
          className="mt-2 w-full text-sm text-text-muted hover:text-text underline underline-offset-4 wa-tap py-2"
        >
          {supported ? "Skip for now" : "Continue"}
        </button>
      </ScreenShell>
    );
  }

  if (step === "name") {
    return (
      <ScreenShell phase="Step 8 of 10 · Your name">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">
            What should we call you?
          </h2>
          <p className="text-sm text-text-muted text-center">
            Optional. This is what people will see in chats. You can change
            it any time.
          </p>
        </div>
        <div>
          <FieldLabel>Display name</FieldLabel>
          <TextInput
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </div>
        <PrimaryButton onClick={() => setStep("bio")}>
          {displayName.trim() ? "Continue" : "Skip"}
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "bio") {
    return (
      <ScreenShell phase="Step 9 of 10 · Bio">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">
            Add a short bio
          </h2>
          <p className="text-sm text-text-muted text-center">
            Optional. Up to 160 characters. You can change it any time.
          </p>
        </div>
        <div>
          <FieldLabel>Bio</FieldLabel>
          <textarea
            autoFocus
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            placeholder="Tell people a little about yourself"
            className="w-full rounded-xl bg-surface border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition resize-none text-sm"
          />
          <p className="text-xs text-text-faint text-right mt-1">
            {bio.length}/160
          </p>
        </div>
        <PrimaryButton onClick={() => setStep("photo")}>
          {bio.trim() ? "Continue" : "Skip"}
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "photo") {
    return (
      <ScreenShell phase="Step 10 of 10 · Photo">
        <PhotoStep
          username={username}
          avatarDataUrl={avatarDataUrl}
          setAvatarDataUrl={setAvatarDataUrl}
          busy={photoBusy}
          setBusy={setPhotoBusy}
        />
        <PrimaryButton
          onClick={async () => {
            await flushOptionalProfile();
            setStep("welcome");
          }}
          loading={photoBusy}
          disabled={photoBusy}
        >
          {avatarDataUrl ? "Continue" : "Skip"}
        </PrimaryButton>
      </ScreenShell>
    );
  }

  // Welcome — final celebration screen, paced reveals so it feels
  // like an arrival rather than another form.
  return (
    <ScreenShell phase="Welcome">
      <WelcomeCeremony
        displayName={displayName.trim() || `@${username}`}
        username={username}
        onContinue={() => navigate(postAuthLandingPath())}
      />
    </ScreenShell>
  );
}

/* ─────────── Ceremony components ─────────── */

/**
 * Mid-signup ceremony: the moment the cryptographic identity is
 * "forged". Three named stages reveal sequentially with checkmarks,
 * over a calm pulsing emblem. No real key derivation happens here —
 * the actual signing keys come from the recovery phrase generated at
 * the end of this animation, and from the server when the account is
 * created. The animation's job is to give the user a felt sense of a
 * real, deliberate cryptographic event happening on their device.
 */
function KeyCeremony({
  onReady,
  onContinue,
}: {
  onReady: () => void;
  onContinue: () => void;
}) {
  const stages = [
    {
      title: "Generating your identity key",
      sub: "A unique signing key only you control",
    },
    {
      title: "Forging your recovery phrase",
      sub: "12 words that can rebuild your account anywhere",
    },
    {
      title: "Sealing your prekey bundle",
      sub: "So friends can write to you while you're offline",
    },
    {
      title: "Identity ready",
      sub: "Your keys exist only on this device",
    },
  ];
  const [stageIndex, setStageIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (stageIndex >= stages.length - 1) {
      // Last stage shown — call the ready hook (generates the
      // recovery phrase) and unlock the Continue button after a
      // small breathing pause.
      onReady();
      const t = setTimeout(() => setDone(true), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStageIndex(stageIndex + 1), 950);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIndex]);

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Pulsing concentric rings */}
        <div
          className="absolute inset-0 rounded-full border border-wa-green/30 animate-ping"
          style={{ animationDuration: "2.4s" }}
        />
        <div
          className="absolute inset-2 rounded-full border border-wa-green/40 animate-ping"
          style={{ animationDuration: "2.8s", animationDelay: "0.3s" }}
        />
        <div className="absolute inset-5 rounded-full bg-wa-green/12" />
        <div className="absolute inset-7 rounded-full bg-wa-green/20 backdrop-blur-sm flex items-center justify-center">
          {done ? (
            <svg viewBox="0 0 24 24" className="size-9 text-wa-green-dark dark:text-wa-green animate-fade-in" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-9 text-wa-green-dark dark:text-wa-green" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2l.9-5.5-4-3.9L9.5 7z" />
            </svg>
          )}
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-semibold text-text">
          Forging your identity
        </h2>
        <p className="text-sm text-text-muted mt-1 max-w-xs mx-auto">
          We're putting together the cryptographic pieces that make you,
          you. This happens entirely on your device.
        </p>
      </div>

      <ul className="w-full max-w-sm flex flex-col gap-2">
        {stages.map((s, i) => {
          const reached = i <= stageIndex;
          const completed = i < stageIndex || (i === stages.length - 1 && done);
          return (
            <li
              key={s.title}
              className={
                "rounded-2xl border px-4 py-3 flex items-start gap-3 transition-all duration-500 ease-out " +
                (reached
                  ? "bg-surface border-line opacity-100 translate-y-0"
                  : "bg-surface/40 border-line/40 opacity-40 translate-y-1")
              }
            >
              <div className="shrink-0 mt-0.5 size-6 rounded-full flex items-center justify-center bg-wa-green/15">
                {completed ? (
                  <svg viewBox="0 0 24 24" className="size-3.5 text-wa-green-dark dark:text-wa-green" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                ) : reached ? (
                  <span className="size-1.5 rounded-full bg-wa-green animate-pulse" />
                ) : (
                  <span className="size-1.5 rounded-full bg-text-faint/50" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-text">
                  {s.title}
                </div>
                <div className="text-[12px] text-text-muted mt-0.5">
                  {s.sub}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <PrimaryButton onClick={onContinue} disabled={!done}>
        {done ? "Reveal my recovery key" : "Forging…"}
      </PrimaryButton>
    </div>
  );
}

/**
 * Recovery key reveal — the most sacred moment of identity creation.
 *
 * The 12 words land like deliberate cards (staggered fade-up), an
 * emblematic key icon anchors the screen, and the safety guidance
 * lives in a soft callout instead of red error text. The CTAs are
 * re-ordered so "I've saved it" is the gating primary action and the
 * download lives below it as a secondary, since the user has to
 * download before confirming anyway.
 */
function RecoveryReveal({
  words,
  username,
  downloaded,
  creating,
  error,
  onDownload,
  onConfirm,
}: {
  words: string[];
  username: string;
  downloaded: boolean;
  creating: boolean;
  error: string | null;
  onDownload: () => void;
  onConfirm: () => void;
}) {
  const phrase = words.join(" ");

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Hero emblem — a calm key icon with an ambient halo so the
          page reads as ceremonial rather than transactional. */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-wa-green/15 blur-xl scale-[1.6]"
        />
        <div
          className={
            "relative size-16 rounded-2xl grid place-items-center " +
            "bg-gradient-to-b from-wa-green to-wa-green-dark text-text-oncolor " +
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_8px_24px_rgba(0,168,132,0.28)]"
          }
        >
          <RecoveryKeyIcon />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-[22px] font-semibold tracking-tight text-text">
          Your recovery kit
        </h2>
        <p className="text-[13.5px] text-text-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
          Download your unique kit — a single PDF that holds your
          12-word recovery phrase and a scannable QR code. Save it
          somewhere safe; we can't show it to you again.
        </p>
      </div>

      {/* The visual download card — replaces the old text grid. */}
      <RecoveryKitDownloadCard
        username={username}
        phrase={phrase}
        onDownloaded={onDownload}
        className="w-full"
      />

      {/* Safety callout — soft accent panel, not a red warning. */}
      <div
        className={
          "w-full rounded-2xl border border-wa-green/25 " +
          "bg-wa-green/[0.06] px-4 py-3.5 flex items-start gap-3"
        }
      >
        <div className="shrink-0 mt-0.5 size-7 rounded-full bg-wa-green/15 grid place-items-center text-wa-green-dark dark:text-wa-green">
          <ShieldIcon />
        </div>
        <div className="min-w-0 text-[12.5px] leading-snug">
          <div className="font-semibold text-text">Treat this like a key</div>
          <p className="text-text-muted mt-0.5">
            Anyone with this PDF can read your messages. A password
            manager or an encrypted folder both work well.
          </p>
        </div>
      </div>

      {/* Actions — download is the means, confirm is the moment. */}
      <div className="w-full flex flex-col gap-2.5">
        <PrimaryButton
          onClick={onConfirm}
          loading={creating}
          disabled={!downloaded || creating}
        >
          {downloaded
            ? "I've saved it — create my account"
            : "Download your kit to continue"}
        </PrimaryButton>
      </div>

      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}

/* ─────────── Recovery-screen icons ─────────── */

function RecoveryKeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={26}
      height={26}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="12" r="3.5" />
      <path d="M12.5 12h7.5" />
      <path d="M17 12v3" />
      <path d="M20 12v2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l8 3v6c0 4.5-3.4 8.5-8 9-4.6-.5-8-4.5-8-9V6l8-3z" />
    </svg>
  );
}

/**
 * Final welcome screen — paced reveals so the moment actually lands.
 */
function WelcomeCeremony({
  displayName,
  username,
  onContinue,
}: {
  displayName: string;
  username: string;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-wa-green/20 blur-2xl scale-150" />
        <div className="relative">
          <Logo size={88} />
        </div>
      </div>
      <div
        className={
          "transition-all duration-500 " +
          (phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
        }
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
          ✦ Identity ready
        </div>
      </div>
      <h2
        className={
          "text-2xl font-semibold text-text transition-all duration-500 " +
          (phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
        }
      >
        Hello, {displayName}
      </h2>
      <p
        className={
          "text-sm text-text-muted max-w-xs transition-all duration-500 " +
          (phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
        }
      >
        Your account is end-to-end encrypted. No ads, no tracking, no email
        required. Share <span className="font-mono">@{username}</span> with
        friends to start chatting.
      </p>
      <div
        className={
          "w-full transition-all duration-500 " +
          (phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
        }
      >
        <PrimaryButton onClick={onContinue}>Open Veil</PrimaryButton>
      </div>
    </div>
  );
}

function PhotoStep({
  username,
  avatarDataUrl,
  setAvatarDataUrl,
  busy,
  setBusy,
}: {
  username: string;
  avatarDataUrl: string | null;
  setAvatarDataUrl: (v: string | null) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const initial = (username || "?").charAt(0).toUpperCase();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const url = await resizeAvatarToDataUrl(file);
      setAvatarDataUrl(url);
    } catch (ex) {
      setErr((ex as Error).message ?? "Could not load image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 mb-2">
        <Logo />
        <h2 className="text-2xl font-semibold text-text">
          Add a profile photo
        </h2>
        <p className="text-sm text-text-muted text-center">
          Optional. We'll resize it to 256×256.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative w-32 h-32 rounded-full overflow-hidden ring-2 ring-line bg-surface flex items-center justify-center">
          {avatarDataUrl ? (
            <img
              src={avatarDataUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-4xl font-semibold text-text-muted">
              {initial}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton onClick={() => inputRef.current?.click()}>
            {avatarDataUrl ? "Change photo" : "Choose photo"}
          </SecondaryButton>
          {avatarDataUrl && (
            <SecondaryButton onClick={() => setAvatarDataUrl(null)}>
              Remove
            </SecondaryButton>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
          disabled={busy}
        />
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    </>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String(
      (e as { message?: unknown }).message ?? "Something went wrong.",
    );
  }
  return "Something went wrong.";
}
