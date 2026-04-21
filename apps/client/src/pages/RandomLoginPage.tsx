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
} from "../components/Layout";
import {
  bytesToBase64,
  isValidRecoveryPhrase,
  deriveIdentityFromPhrase,
  deriveX25519FromPhrase,
  signMessage,
} from "../lib/crypto";
import { x25519PublicKeyFromPrivate } from "../lib/signal/x25519";
import { saveIdentity } from "../lib/db";
import { buildPrekeyBundle } from "../lib/prekeys";
import { useUnlockStore } from "../lib/unlockStore";

type Step = "credentials" | "done";

export function RandomLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUnlocked = useUnlockStore((s) => s.setIdentity);

  const [step, setStep] = useState<Step>("credentials");
  const [randomId, setRandomId] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestChallenge = trpc.auth.requestRandomChallenge.useMutation();
  const loginRandom = trpc.auth.loginRandom.useMutation();
  const setX25519 = trpc.me.setX25519Identity.useMutation();
  const uploadPrekeys = trpc.prekeys.upload.useMutation();

  const trimmedId = randomId.trim().toLowerCase();
  const trimmedPhrase = phrase.trim().toLowerCase();
  const isIdValid = /^veil_[0-9a-f]{8}$/.test(trimmedId);
  const isPhraseValid = isValidRecoveryPhrase(trimmedPhrase);

  async function onLogin() {
    setError(null);
    if (!isIdValid) {
      setError("Enter a valid Veil ID (format: veil_xxxxxxxx).");
      return;
    }
    if (!isPhraseValid) {
      setError("Recovery phrase is not valid. Check your 12 words.");
      return;
    }

    setLoading(true);
    try {
      const { challenge } = await requestChallenge.mutateAsync({
        randomId: trimmedId,
      });

      const ed = deriveIdentityFromPhrase(trimmedPhrase);
      const signature = signMessage(ed.privateKey, challenge);

      const r = await loginRandom.mutateAsync({
        randomId: trimmedId,
        challenge,
        signature,
      });

      setAuth({ accessToken: r.accessToken, user: r.user });

      const { privateKey: x25519Priv } = deriveX25519FromPhrase(trimmedPhrase);
      const x25519Pub = x25519PublicKeyFromPrivate(x25519Priv);

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

      setUnlocked({
        userId: r.user.id,
        ed25519: ed,
        x25519: { privateKey: x25519Priv, publicKey: x25519Pub },
      });

      navigate("/chats");
    } catch (e: unknown) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell back="/login" phase="Phase 4 · Random ID login">
      <div className="flex flex-col items-center gap-3 mb-2">
        <Logo />
        <h2 className="text-2xl font-semibold">Log in with Random ID</h2>
        <p className="text-sm text-white/60 text-center">
          Enter your Veil ID and 12-word recovery phrase.
        </p>
      </div>

      <div>
        <FieldLabel>Veil ID</FieldLabel>
        <input
          type="text"
          autoFocus
          value={randomId}
          onChange={(e) => setRandomId(e.target.value)}
          placeholder="veil_xxxxxxxx"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 font-mono outline-none focus:border-accent transition"
        />
      </div>

      <div>
        <FieldLabel>Recovery phrase (12 words)</FieldLabel>
        <textarea
          rows={4}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="word1 word2 word3 …"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition resize-none text-sm"
        />
        {phrase.trim().length > 0 && !isPhraseValid && (
          <p className="mt-1 text-xs text-amber-400/80">
            Invalid phrase — check all 12 words are correct BIP-39 words.
          </p>
        )}
      </div>

      <ErrorMessage>{error}</ErrorMessage>
      <PrimaryButton
        onClick={onLogin}
        loading={loading}
        disabled={!isIdValid || !isPhraseValid}
      >
        Log in
      </PrimaryButton>
      <SecondaryButton onClick={() => navigate("/login")}>Back</SecondaryButton>
    </ScreenShell>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: unknown }).message ?? "Something went wrong.");
  }
  return "Something went wrong.";
}
