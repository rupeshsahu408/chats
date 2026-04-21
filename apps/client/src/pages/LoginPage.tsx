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

type Step = "email" | "code";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestOtp = trpc.auth.requestEmailOtp.useMutation();
  const verifyOtp = trpc.auth.verifyEmailOtp.useMutation();

  async function onSendCode() {
    setError(null);
    setInfo(null);
    try {
      const r = await requestOtp.mutateAsync({ email, purpose: "login" });
      if (r.devCode) {
        setInfo(`Dev mode: code is ${r.devCode}.`);
      } else {
        setInfo("If an account exists, we sent a code to your inbox.");
      }
      setStep("code");
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  async function onVerifyCode() {
    setError(null);
    try {
      const r = await verifyOtp.mutateAsync({
        email,
        code,
        purpose: "login",
      });
      setAuth({ accessToken: r.accessToken, user: r.user });
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
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  if (step === "email") {
    return (
      <ScreenShell back="/" phase="Phase 1 · Log in">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Logo />
          <h2 className="text-2xl font-semibold">Log in to Veil</h2>
          <p className="text-sm text-white/60 text-center">
            Enter the email you signed up with.
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
        Log in
      </PrimaryButton>
      <SecondaryButton onClick={() => setStep("email")}>
        Use a different email
      </SecondaryButton>
    </ScreenShell>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: unknown }).message ?? "Something went wrong.");
  }
  return "Something went wrong.";
}
