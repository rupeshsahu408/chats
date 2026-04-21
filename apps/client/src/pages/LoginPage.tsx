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
import { isFirebaseConfigured } from "../lib/firebase";

type Step = "method" | "email-input" | "email-code";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>("method");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestOtp = trpc.auth.requestEmailOtp.useMutation();
  const verifyOtp = trpc.auth.verifyEmailOtp.useMutation();

  function navigateAfterLogin() {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem("veil:pending_invite");
    } catch {}
    if (pending) {
      try {
        sessionStorage.removeItem("veil:pending_invite");
      } catch {}
      navigate(`/i/${encodeURIComponent(pending)}`);
    } else {
      navigate("/chats");
    }
  }

  async function onSendEmailCode() {
    setError(null);
    setInfo(null);
    try {
      const r = await requestOtp.mutateAsync({ email, purpose: "login" });
      if (r.devCode) {
        setInfo(`Dev mode: code is ${r.devCode}.`);
      } else {
        setInfo("If an account exists, we sent a code to your inbox.");
      }
      setStep("email-code");
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  async function onVerifyEmailCode() {
    setError(null);
    try {
      const r = await verifyOtp.mutateAsync({ email, code, purpose: "login" });
      setAuth({ accessToken: r.accessToken, user: r.user });
      navigateAfterLogin();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  if (step === "method") {
    return (
      <ScreenShell back="/" phase="Log in">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Log in to Veil</h2>
          <p className="text-sm text-white/60 text-center">
            Choose how you signed up.
          </p>
        </div>
        <div className="w-full grid gap-3">
          <LoginOption
            title="Email"
            sub="6-digit OTP to your inbox"
            onClick={() => setStep("email-input")}
          />
          <LoginOption
            title="Phone"
            sub={
              isFirebaseConfigured()
                ? "SMS verification"
                : "Firebase not configured — see .env.example"
            }
            onClick={() => navigate("/login/phone")}
            disabled={!isFirebaseConfigured()}
          />
          <LoginOption
            title="Random ID"
            sub="Use your 12-word recovery phrase"
            onClick={() => navigate("/login/random")}
          />
        </div>
      </ScreenShell>
    );
  }

  if (step === "email-input") {
    return (
      <ScreenShell back="/" phase="Log in · Email">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Log in with email</h2>
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
          onClick={onSendEmailCode}
          loading={requestOtp.isPending}
          disabled={!email.trim()}
        >
          Send code
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("method")}>Back</SecondaryButton>
      </ScreenShell>
    );
  }

  if (step === "email-code") {
    return (
      <ScreenShell back="/" phase="Log in · Verify">
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
          onClick={onVerifyEmailCode}
          loading={verifyOtp.isPending}
          disabled={code.length !== 6}
        >
          Log in
        </PrimaryButton>
        <SecondaryButton onClick={() => setStep("email-input")}>
          Use a different email
        </SecondaryButton>
      </ScreenShell>
    );
  }

  return null;
}

function LoginOption({
  title,
  sub,
  onClick,
  disabled,
}: {
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none"
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-white/50">{sub}</div>
      </div>
      <span className="text-white/40">→</span>
    </button>
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
