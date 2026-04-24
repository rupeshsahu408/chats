import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScreenShell,
  Logo,
  SecondaryButton,
} from "../components/Layout";
import { isPasskeySupported } from "../lib/passkey";

/**
 * Method picker for the sign-in screen.
 *
 * The premium "Username + password" flow lives at /login/random — it
 * carries the silent risk-detection, slide-puzzle, press-and-hold,
 * lockout, last-location and passkey suggestion logic. We surface
 * that as the primary path, with secondary entry points for users
 * who originally signed up via phone.
 *
 * Email / SMS code flows are intentionally not part of the premium
 * sign-in story: see `/login/random` for the canonical path.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  return (
    <ScreenShell back="/" phase="Sign in">
      <div className="flex flex-col items-center gap-3 mb-2">
        <Logo />
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-sm text-text-muted text-center">
          Sign in to pick up where you left off.
        </p>
      </div>

      <div className="w-full grid gap-3">
        <LoginOption
          title="Continue with username"
          sub="Username and password — the recommended way."
          recommended
          onClick={() => navigate("/login/random")}
        />
        {passkeySupported && (
          <LoginOption
            title="Use a passkey"
            sub="Face ID, Touch ID, or your security key."
            onClick={() => navigate("/login/random?passkey=1")}
          />
        )}
        <LoginOption
          title="Continue with phone"
          sub="One-time SMS code."
          onClick={() => navigate("/login/phone")}
        />
      </div>

      <div className="text-center text-xs text-text-muted space-y-1.5">
        <div>
          New to Veil?{" "}
          <button
            type="button"
            onClick={() => navigate("/welcome")}
            className="text-wa-green hover:underline"
          >
            Create an account
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-text-muted hover:text-text hover:underline underline-offset-2"
          >
            Forgot your password?
          </button>
        </div>
      </div>

      <SecondaryButton onClick={() => navigate("/")}>Back</SecondaryButton>
    </ScreenShell>
  );
}

function LoginOption({
  title,
  sub,
  onClick,
  recommended,
}: {
  title: string;
  sub: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left rounded-xl border bg-surface px-4 py-3 " +
        "hover:bg-elevated transition flex items-center justify-between " +
        "wa-tap " +
        (recommended ? "border-wa-green/50" : "border-line")
      }
    >
      <div className="min-w-0">
        <div className="font-medium flex items-center gap-2">
          <span>{title}</span>
          {recommended && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green border border-wa-green/30">
              Recommended
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted truncate">{sub}</div>
      </div>
      <span className="text-text-faint">→</span>
    </button>
  );
}
