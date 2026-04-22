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
  generateRecoveryPhrase,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
  generateRandomId,
} from "../lib/crypto";
import { x25519PublicKeyFromPrivate } from "../lib/signal/x25519";
import { saveIdentity } from "../lib/db";
import { buildPrekeyBundle } from "../lib/prekeys";
import { useUnlockStore } from "../lib/unlockStore";
import { postAuthLandingPath } from "../lib/inviteRedirect";

type Step = "generate" | "confirm" | "done";

export function RandomIdSignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUnlocked = useUnlockStore((s) => s.setIdentity);

  const [step, setStep] = useState<Step>("generate");
  const [randomId] = useState(() => generateRandomId());
  const [phrase] = useState(() => generateRecoveryPhrase());
  const words = phrase.split(" ");

  const [confirmInput, setConfirmInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signup = trpc.auth.signupRandom.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();

  async function onConfirm() {
    setError(null);
    const entered = confirmInput.trim().toLowerCase();
    const expected = phrase.trim().toLowerCase();
    if (entered !== expected) {
      setError(
        "The phrase you entered doesn't match. Please try again.",
      );
      return;
    }

    setLoading(true);
    try {
      const ed = deriveIdentityFromPhrase(phrase);
      const { privateKey: x25519Priv } = deriveX25519FromPhrase(phrase);
      const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);
      const x25519Kp = { privateKey: x25519Priv, publicKey: x25519Pub };

      const r = await signup.mutateAsync({
        randomId,
        identityPublicKey: bytesToBase64(ed.publicKey),
      });
      setAuth({ accessToken: r.accessToken, user: r.user });

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

      setStep("done");
    } catch (e: unknown) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }

  if (step === "generate") {
    return (
      <ScreenShell back="/" phase="Random ID">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">Your Veil ID</h2>
          <p className="text-sm text-text-muted text-center">
            No email, no phone. Your identity is a random ID protected by a
            12-word recovery phrase.
          </p>
        </div>

        <div className="w-full rounded-xl bg-surface border border-line px-4 py-3">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1">
            Your ID
          </p>
          <p className="font-mono text-lg tracking-wider text-wa-green-dark dark:text-wa-green">
            {randomId}
          </p>
        </div>

        <div className="w-full">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-2">
            Recovery phrase (12 words)
          </p>
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
            ⚠ Write these 12 words down and store them safely. You cannot
            recover your account without them. We will never show them again.
          </p>
        </div>

        <PrimaryButton onClick={() => setStep("confirm")}>
          I've saved my phrase
        </PrimaryButton>
      </ScreenShell>
    );
  }

  if (step === "confirm") {
    return (
      <ScreenShell back="/signup/random" phase="Confirm phrase">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold text-text">Confirm your phrase</h2>
          <p className="text-sm text-text-muted text-center">
            Type all 12 words in order to confirm you've saved them.
          </p>
        </div>

        <div>
          <FieldLabel>Enter your 12-word recovery phrase</FieldLabel>
          <textarea
            autoFocus
            rows={4}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="word1 word2 word3 …"
            className="w-full rounded-xl bg-surface border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition resize-none text-sm"
          />
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onConfirm}
          loading={loading}
          disabled={confirmInput.trim().split(/\s+/).length < 12}
        >
          Create account
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("generate")}>
          Back
        </SecondaryButton>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell phase="Done">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo size={72} />
        <h2 className="text-2xl font-semibold text-text">Welcome to Veil</h2>
        <div className="w-full rounded-xl bg-surface border border-line px-4 py-3">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1">
            Your ID
          </p>
          <p className="font-mono text-lg tracking-wider text-wa-green-dark dark:text-wa-green">
            {randomId}
          </p>
        </div>
        <p className="text-sm text-text-muted">
          Share your ID with people who want to connect with you. Your recovery
          phrase is the only way to access your account on a new device.
        </p>
        <PrimaryButton onClick={() => navigate(postAuthLandingPath())}>
          Continue
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}

// Keep the unused-but-shared TextInput import alive for future polish.
void TextInput;

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: unknown }).message ?? "Something went wrong.");
  }
  return "Something went wrong.";
}
