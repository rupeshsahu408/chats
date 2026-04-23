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

type Step =
  | "username"
  | "password"
  | "verification"
  | "puzzle"
  | "recovery"
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

  const checkUsername = trpc.auth.checkUsername.useMutation();
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
        const r = await checkUsername.mutateAsync({ username });
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

  function downloadRecoveryFile() {
    if (!phrase) return;
    const blob = new Blob(
      [
        `Veil recovery key for @${username}\n\n` +
          `${phrase}\n\n` +
          `Keep this file safe and offline. Anyone with these 12 words ` +
          `can decrypt your messages on a new device.\n`,
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `veil-recovery-${username}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
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

      const r = await signup.mutateAsync({
        username,
        password,
        verificationPassword,
        identityPublicKey: bytesToBase64(ed.publicKey),
        botToken,
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
    const canContinue =
      !!username && !localUsernameProblem && usernameAvailable === true;
    return (
      <ScreenShell back="/" phase="Step 1 of 8 · Username">
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
      <ScreenShell back="#" phase="Step 2 of 8 · Password">
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
      <ScreenShell back="#" phase="Step 3 of 8 · Daily verification">
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
      <ScreenShell back="#" phase="Step 4 of 8 · Verify">
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
            // Generate the recovery phrase right when the user clears
            // the bot check, so it's ready for the next step.
            if (!phrase) setPhrase(generateRecoveryPhrase());
          }}
        />

        <PrimaryButton
          onClick={() => setStep("recovery")}
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

  if (step === "recovery") {
    const words = phrase ? phrase.split(" ") : [];
    return (
      <ScreenShell back="#" phase="Step 5 of 8 · Recovery key">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">
            Save your recovery key
          </h2>
          <p className="text-sm text-text-muted text-center">
            These 12 words let you decrypt your messages on a new device.
            We can't show them again — download the file before continuing.
          </p>
        </div>

        <div className="w-full">
          <div className="grid grid-cols-3 gap-2">
            {words.map((word, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface border border-line px-3 py-2 text-sm flex items-center gap-2"
              >
                <span className="text-text-faint text-xs w-4 shrink-0">
                  {i + 1}.
                </span>
                <span className="text-text">{word}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-red-500">
            ⚠ Anyone with these words can read your messages. Store the
            file offline (a password manager or a USB stick is great).
          </p>
        </div>

        <PrimaryButton onClick={downloadRecoveryFile}>
          {recoveryDownloaded ? "Download again" : "Download recovery key"}
        </PrimaryButton>

        <PrimaryButton
          onClick={async () => {
            const ok = await createAccount();
            if (ok) setStep("name");
          }}
          loading={creating}
          disabled={!recoveryDownloaded || creating}
        >
          {recoveryDownloaded
            ? "I've saved it — create my account"
            : "Download the file to continue"}
        </PrimaryButton>
        <ErrorMessage>{error}</ErrorMessage>
      </ScreenShell>
    );
  }

  if (step === "name") {
    return (
      <ScreenShell phase="Step 6 of 8 · Your name">
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
      <ScreenShell phase="Step 7 of 8 · Bio">
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
      <ScreenShell phase="Step 8 of 8 · Photo">
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

  // Welcome
  return (
    <ScreenShell phase="Welcome">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo size={80} />
        <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green px-3 py-1 text-xs font-semibold uppercase tracking-widest">
          ✦ Welcome to Veil
        </div>
        <h2 className="text-2xl font-semibold text-text">
          Hello, {displayName.trim() || `@${username}`}
        </h2>
        <p className="text-sm text-text-muted">
          Your account is end-to-end encrypted. No ads, no tracking, no email
          required. Share <span className="font-mono">@{username}</span> with
          friends to start chatting.
        </p>
        <PrimaryButton onClick={() => navigate(postAuthLandingPath())}>
          Open Veil
        </PrimaryButton>
      </div>
    </ScreenShell>
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
