import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  isDailyVerificationDue,
  markDailyVerified,
} from "../lib/dailyVerification";
import {
  Logo,
  PrimaryButton,
  FieldLabel,
  TextInput,
  ErrorMessage,
} from "./Layout";

/**
 * Routes the gate should NOT cover. Anything not in this list is
 * considered "main app surface" and requires a fresh daily check.
 */
const PUBLIC_PREFIXES = [
  "/",
  "/welcome",
  "/login",
  "/signup",
  "/i/",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/welcome") return true;
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/i/")
  );
}

export function DailyVerificationGate() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const verify = trpc.auth.verifyDailyPassword.useMutation();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  // Re-evaluate whether the gate should appear whenever the user,
  // route, or focus changes. Reopening the tab after sleep should
  // immediately re-prompt if the 24h window has elapsed.
  useEffect(() => {
    function evaluate() {
      if (!user) {
        setOpen(false);
        return;
      }
      if (isPublicPath(location.pathname)) {
        setOpen(false);
        return;
      }
      setOpen(isDailyVerificationDue(user.id));
    }
    evaluate();
    window.addEventListener("focus", evaluate);
    document.addEventListener("visibilitychange", evaluate);
    return () => {
      window.removeEventListener("focus", evaluate);
      document.removeEventListener("visibilitychange", evaluate);
    };
  }, [user, location.pathname]);

  if (!open || !user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8 || !user) return;
    setError(null);
    try {
      await verify.mutateAsync({ password });
      markDailyVerified(user.id);
      setPassword("");
      setOpen(false);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ??
        "Wrong verification password.";
      setError(msg);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-bg border border-line p-6 flex flex-col gap-4 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <h2 className="text-xl font-semibold text-text">
            Daily verification
          </h2>
          <p className="text-sm text-text-muted">
            For your security, please re-enter your daily verification
            password to continue.
          </p>
        </div>

        <div>
          <FieldLabel>Verification password</FieldLabel>
          <TextInput
            autoFocus
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your verification password"
            autoComplete="current-password"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="accent-wa-green"
          />
          Show password
        </label>

        <PrimaryButton
          type="submit"
          loading={verify.isPending}
          disabled={password.length < 8 || verify.isPending}
        >
          Unlock
        </PrimaryButton>

        <ErrorMessage>{error}</ErrorMessage>
      </form>
    </div>
  );
}
