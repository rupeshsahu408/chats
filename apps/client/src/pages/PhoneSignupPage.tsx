import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  PrimaryButton,
  SecondaryButton,
  FieldLabel,
  ErrorMessage,
  InfoMessage,
} from "../components/Layout";
import {
  bytesToBase64,
  generateIdentityKeyPair,
  encryptWithPin,
} from "../lib/crypto";
import { generateX25519KeyPair } from "../lib/signal/x25519";
import { saveIdentity } from "../lib/db";
import { buildPrekeyBundle } from "../lib/prekeys";
import { useUnlockStore } from "../lib/unlockStore";
import { postAuthLandingPath } from "../lib/inviteRedirect";
import {
  isFirebaseConfigured,
  createRecaptchaVerifier,
  sendPhoneOtp,
} from "../lib/firebase";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { useNoindex } from "../lib/useDocumentMeta";

type Step = "phone" | "code" | "pin" | "done";

export function PhoneSignupPage() {
  useNoindex("Sign up with phone · VeilChat");
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUnlocked = useUnlockStore((s) => s.setIdentity);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [pendingIdentity, setPendingIdentity] = useState<{
    ed25519: { privateKey: Uint8Array; publicKey: Uint8Array };
    x25519: { privateKey: Uint8Array; publicKey: Uint8Array };
  } | null>(null);
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const verifyPhone = trpc.auth.verifyFirebasePhone.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    recaptchaRef.current = createRecaptchaVerifier("recaptcha-container");
    return () => {
      recaptchaRef.current?.clear();
    };
  }, []);

  if (!isFirebaseConfigured()) {
    return (
      <ScreenShell back="/" phase="Phase 4 · Phone signup">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo />
          <h2 className="text-2xl font-semibold">Phone signup</h2>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 text-left w-full">
            <p className="font-medium mb-1">Firebase not configured</p>
            <p className="text-amber-700 dark:text-amber-700 dark:text-amber-300">
              To enable phone sign-up, set these environment variables in{" "}
              <code className="text-xs bg-elevated px-1 rounded">
                apps/client/.env
              </code>
              :
            </p>
            <ul className="mt-2 space-y-1 text-xs font-mono text-amber-700 dark:text-amber-700 dark:text-amber-300">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>VITE_FIREBASE_PROJECT_ID</li>
            </ul>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-700 dark:text-amber-300">
              And on the server: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
              FIREBASE_PRIVATE_KEY
            </p>
          </div>
          <SecondaryButton onClick={() => navigate("/")}>Back</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  async function onSendCode() {
    setError(null);
    setInfo(null);
    if (!recaptchaRef.current) {
      setError("reCAPTCHA not ready. Please refresh.");
      return;
    }
    setSending(true);
    try {
      const result = await sendPhoneOtp(phone, recaptchaRef.current);
      confirmationRef.current = result;
      setInfo("Code sent. Check your messages.");
      setStep("code");
    } catch (e: unknown) {
      setError(messageOf(e));
      recaptchaRef.current?.clear();
      recaptchaRef.current = createRecaptchaVerifier("recaptcha-container");
    } finally {
      setSending(false);
    }
  }

  async function onVerifyCode() {
    setError(null);
    if (!confirmationRef.current) {
      setError("No pending verification. Go back and try again.");
      return;
    }
    setVerifying(true);
    try {
      const userCredential = await confirmationRef.current.confirm(code);
      const idToken = await userCredential.user.getIdToken();

      const ed = generateIdentityKeyPair();
      const x = generateX25519KeyPair();
      setPendingIdentity({ ed25519: ed, x25519: x });
      setPendingIdToken(idToken);

      const r = await verifyPhone.mutateAsync({
        firebaseIdToken: idToken,
        purpose: "signup",
        identityPublicKey: bytesToBase64(ed.publicKey),
      });
      setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, refreshExpiresIn: r.refreshExpiresIn, user: r.user });
      setPendingUserId(r.user.id);
      setStep("pin");
    } catch (e: unknown) {
      setError(messageOf(e));
    } finally {
      setVerifying(false);
    }
  }

  async function onSetPin() {
    setError(null);
    if (pin.length < 6) {
      setError("PIN must be at least 6 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs don't match.");
      return;
    }
    if (!pendingIdentity || !pendingUserId) {
      setError("Missing identity. Please restart signup.");
      return;
    }
    try {
      const edBlob = await encryptWithPin(pin, pendingIdentity.ed25519.privateKey);
      const xBlob = await encryptWithPin(pin, pendingIdentity.x25519.privateKey);
      await saveIdentity({
        id: "self",
        userId: pendingUserId,
        encPrivateKey: bytesToBase64(edBlob.ciphertext),
        iv: bytesToBase64(edBlob.iv),
        salt: bytesToBase64(edBlob.salt),
        publicKey: bytesToBase64(pendingIdentity.ed25519.publicKey),
        encX25519PrivateKey: bytesToBase64(xBlob.ciphertext),
        iv2: bytesToBase64(xBlob.iv),
        salt2: bytesToBase64(xBlob.salt),
        x25519PublicKey: bytesToBase64(pendingIdentity.x25519.publicKey),
        createdAt: new Date().toISOString(),
      });

      try {
        await setX25519.mutateAsync({
          publicKey: bytesToBase64(pendingIdentity.x25519.publicKey),
        });
      } catch (e) {
        console.warn("Failed to register X25519 identity", e);
      }

      try {
        const bundle = await buildPrekeyBundle({
          identityPrivateKey: pendingIdentity.ed25519.privateKey,
          numOneTime: 20,
          freshStart: true,
        });
        await uploadPrekeys.mutateAsync(bundle);
      } catch (e) {
        console.warn("Prekey bootstrap failed", e);
      }

      await setUnlocked({
        userId: pendingUserId,
        ed25519: pendingIdentity.ed25519,
        x25519: pendingIdentity.x25519,
      });

      setStep("done");
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  if (step === "phone") {
    return (
      <ScreenShell back="/" phase="Phase 4 · Phone signup">
        <div id="recaptcha-container" />
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Your phone number</h2>
          <p className="text-sm text-text-muted text-center">
            We'll send a one-time code via SMS. Include the country code (e.g.
            +1 for US).
          </p>
        </div>
        <div>
          <FieldLabel>Phone number</FieldLabel>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
            className="w-full rounded-xl bg-surface border border-line px-4 py-3 outline-none focus:border-wa-green transition"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onSendCode}
          loading={sending}
          disabled={!phone.trim() || phone.trim().length < 7}
        >
          Send code
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "code") {
    return (
      <ScreenShell back="/" phase="Phase 4 · Verify">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Enter the code</h2>
          <p className="text-sm text-text-muted text-center">
            Sent to <span className="text-text">{phone}</span>
          </p>
        </div>
        <InfoMessage>{info}</InfoMessage>
        <div>
          <FieldLabel>6-digit code</FieldLabel>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="w-full rounded-xl bg-surface border border-line px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-wa-green transition"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onVerifyCode}
          loading={verifying}
          disabled={code.length !== 6}
        >
          Verify
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("phone")}>
          Use a different number
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "pin") {
    return (
      <ScreenShell phase="Phase 4 · Backup PIN">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Set a Backup PIN</h2>
          <p className="text-sm text-text-muted text-center">
            Your PIN encrypts your identity key on this device. You'll need it
            to restore your chats on a new device.{" "}
            <span className="text-red-500">
              We can't recover it for you.
            </span>
          </p>
        </div>
        <div>
          <FieldLabel>Backup PIN (6+ digits)</FieldLabel>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl bg-surface border border-line px-4 py-3 outline-none focus:border-wa-green transition"
          />
        </div>
        <div>
          <FieldLabel>Confirm PIN</FieldLabel>
          <input
            type="password"
            inputMode="numeric"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl bg-surface border border-line px-4 py-3 outline-none focus:border-wa-green transition"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton onClick={onSetPin} disabled={!pin || !pinConfirm}>
          Save PIN
        </PrimaryButton>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell phase="Phase 4 · Done">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo size={72} />
        <h2 className="text-2xl font-semibold">Welcome to VeilChat</h2>
        <p className="text-sm text-text-muted">
          Your account is ready. Start adding connections.
        </p>
        <PrimaryButton onClick={() => navigate(postAuthLandingPath())}>
          Continue
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: unknown }).message ?? "Something went wrong.");
  }
  return "Something went wrong.";
}
