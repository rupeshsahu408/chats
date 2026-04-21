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
  ErrorMessage,
  InfoMessage,
} from "../components/Layout";
import {
  bytesToBase64,
  encryptWithPin,
  generateIdentityKeyPair,
} from "../lib/crypto";
import { generateX25519KeyPair } from "../lib/signal/x25519";
import { saveIdentity } from "../lib/db";
import { buildPrekeyBundle } from "../lib/prekeys";
import { useUnlockStore } from "../lib/unlockStore";

type Step = "email" | "code" | "pin" | "done";

export function EmailSignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingIdentity, setPendingIdentity] = useState<{
    ed25519: { privateKey: Uint8Array; publicKey: Uint8Array };
    x25519: { privateKey: Uint8Array; publicKey: Uint8Array };
  } | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const setUnlocked = useUnlockStore((s) => s.setIdentity);
  const requestOtp = trpc.auth.requestEmailOtp.useMutation();
  const verifyOtp = trpc.auth.verifyEmailOtp.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();

  async function onSendCode() {
    setError(null);
    setInfo(null);
    try {
      const r = await requestOtp.mutateAsync({ email, purpose: "signup" });
      if (r.devCode) {
        setInfo(
          `Dev mode: no email provider configured. Your code is ${r.devCode}.`,
        );
      } else {
        setInfo(`Code sent. Check your inbox (expires in ${Math.round(r.expiresInSeconds / 60)} min).`);
      }
      setStep("code");
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  async function onVerifyCode() {
    setError(null);
    try {
      // Generate Ed25519 (signing/identity) + X25519 (X3DH ECDH) locally.
      const ed = generateIdentityKeyPair();
      const x = generateX25519KeyPair();
      setPendingIdentity({ ed25519: ed, x25519: x });
      const r = await verifyOtp.mutateAsync({
        email,
        code,
        purpose: "signup",
        identityPublicKey: bytesToBase64(ed.publicKey),
      });
      setAuth({ accessToken: r.accessToken, user: r.user });
      setPendingUserId(r.user.id);
      setStep("pin");
    } catch (e: unknown) {
      setError(messageOf(e));
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
      // Encrypt both private keys with the PIN (separate blobs / salts).
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

      // Register the X25519 identity public key with the server so peers
      // can run X3DH against us.
      try {
        await setX25519.mutateAsync({
          publicKey: bytesToBase64(pendingIdentity.x25519.publicKey),
        });
      } catch (e) {
        console.warn("Failed to register X25519 identity", e);
      }

      // Phase 3: generate + upload an X25519 prekey bundle.
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

      // We just had the PIN, so we can keep the identity unlocked in
      // memory — saves the user from re-entering it immediately.
      setUnlocked({
        userId: pendingUserId,
        ed25519: pendingIdentity.ed25519,
        x25519: pendingIdentity.x25519,
      });

      setStep("done");
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  // If the user arrived via /i/:token while logged out, bring them back
  // there after they finish signup.
  function continueAfterSignup() {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem("veil:pending_invite");
    } catch {
      /* ignore */
    }
    if (pending) {
      try {
        sessionStorage.removeItem("veil:pending_invite");
      } catch {
        /* ignore */
      }
      navigate(`/i/${encodeURIComponent(pending)}`);
    } else {
      navigate("/chats");
    }
  }

  if (step === "email") {
    return (
      <ScreenShell back="/" phase="Phase 1 · Sign up">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">What's your email?</h2>
          <p className="text-sm text-white/60 text-center">
            We'll send you a 6-digit code. Your email is hashed before storage.
          </p>
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onSendCode}
          loading={requestOtp.isPending}
          disabled={!email.trim()}
        >
          Send code
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "code") {
    return (
      <ScreenShell back="/" phase="Phase 1 · Verify">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Enter the code</h2>
          <p className="text-sm text-white/60 text-center">
            Sent to <span className="text-white/90">{email}</span>
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
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-accent transition"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onVerifyCode}
          loading={verifyOtp.isPending}
          disabled={code.length !== 6}
        >
          Verify
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("email")}>
          Use a different email
        </SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "pin") {
    return (
      <ScreenShell phase="Phase 1 · Backup PIN">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Set a Backup PIN</h2>
          <p className="text-sm text-white/60 text-center">
            Your PIN encrypts your identity key on this device. You'll need it
            to restore your chats on a new device.{" "}
            <span className="text-red-300">
              We can't recover it for you. Lose it and lose all your devices →
              your history is gone forever.
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
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition"
          />
        </div>
        <div>
          <FieldLabel>Confirm PIN</FieldLabel>
          <input
            type="password"
            inputMode="numeric"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton onClick={onSetPin} disabled={!pin || !pinConfirm}>
          Save PIN
        </PrimaryButton>
      </ScreenShell>
    );
  }

  // step === 'done'
  return (
    <ScreenShell phase="Phase 1 · Done">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo size={72} />
        <h2 className="text-2xl font-semibold">Welcome to Veil</h2>
        <p className="text-sm text-white/60">
          Your account is ready. Connections and messaging arrive in the next
          phases.
        </p>
        <PrimaryButton onClick={continueAfterSignup}>Continue</PrimaryButton>
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
