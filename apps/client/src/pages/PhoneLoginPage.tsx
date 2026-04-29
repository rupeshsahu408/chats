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
  createRecaptchaVerifier,
  isFirebaseConfigured,
  sendPhoneOtp,
} from "../lib/firebase";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { postAuthLandingPath } from "../lib/inviteRedirect";
import { useNoindex } from "../lib/useDocumentMeta";

type Step = "phone" | "code";

export function PhoneLoginPage() {
  useNoindex("Sign in with phone · VeilChat");
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const verifyPhone = trpc.auth.verifyFirebasePhone.useMutation();

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    recaptchaRef.current = createRecaptchaVerifier("recaptcha-container");
    return () => {
      recaptchaRef.current?.clear();
    };
  }, []);

  if (!isFirebaseConfigured()) {
    return (
      <ScreenShell back="/login" phase="Log in · Phone">
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo />
          <h2 className="text-2xl font-semibold">Phone login</h2>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 text-left w-full">
            <p className="font-medium mb-1">Firebase not configured</p>
            <p className="text-amber-700 dark:text-amber-700 dark:text-amber-300 text-xs">
              Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and
              VITE_FIREBASE_PROJECT_ID to enable phone login.
            </p>
          </div>
          <SecondaryButton onClick={() => navigate("/login")}>Back</SecondaryButton>
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

      const r = await verifyPhone.mutateAsync({
        firebaseIdToken: idToken,
        purpose: "login",
      });
      setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, refreshExpiresIn: r.refreshExpiresIn, user: r.user });
      navigate(postAuthLandingPath());
    } catch (e: unknown) {
      setError(messageOf(e));
    } finally {
      setVerifying(false);
    }
  }

  if (step === "phone") {
    return (
      <ScreenShell back="/login" phase="Log in · Phone">
        <div id="recaptcha-container" />
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Log in with phone</h2>
          <p className="text-sm text-text-muted text-center">
            Enter the phone number you used to sign up.
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
        <SecondaryButton onClick={() => navigate("/login")}>Back</SecondaryButton>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell back="/login" phase="Log in · Verify">
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
        Log in
      </PrimaryButton>
      <SecondaryButton onClick={() => setStep("phone")}>
        Use a different number
      </SecondaryButton>
    </ScreenShell>
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
