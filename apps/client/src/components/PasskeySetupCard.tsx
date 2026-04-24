import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import {
  isPasskeySupported,
  isPlatformAuthenticatorAvailable,
  startPasskeyRegistration,
  suggestDeviceName,
} from "../lib/passkey";
import { humanizeErrorMessage } from "../lib/humanizeError";
import { feedback } from "../lib/feedback";

/**
 * Visual, ProtonMail-style "Add a passkey" card used in signup and in
 * Settings. Shows a fingerprint emblem, a "Recommended" badge, the
 * platform-specific affordance ("Use Face ID / Touch ID / Windows
 * Hello"), and a single primary action that walks the user through
 * the WebAuthn ceremony.
 *
 * The card is self-contained: it owns its own busy / error / done
 * state, runs the full register-options → browser ceremony →
 * verify-registration round-trip, and fires `onAdded(deviceName)`
 * when a credential is successfully saved.
 */
export function PasskeySetupCard({
  onAdded,
  className,
}: {
  onAdded?: (deviceName: string) => void;
  className?: string;
}) {
  const supported = typeof window !== "undefined" && isPasskeySupported();
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [deviceName, setDeviceName] = useState<string>("");

  const utils = trpc.useUtils();
  const getOptions = trpc.passkey.getRegistrationOptions.useMutation();
  const verify = trpc.passkey.verifyRegistration.useMutation();

  useEffect(() => {
    let cancelled = false;
    if (!supported) {
      setPlatformAvailable(false);
      return;
    }
    isPlatformAuthenticatorAvailable().then((ok) => {
      if (!cancelled) setPlatformAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  async function onAdd() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const suggested = suggestDeviceName();
      const optionsResult = await getOptions.mutateAsync();
      const credential = await startPasskeyRegistration(
        (optionsResult as { options: unknown }).options,
      );
      const result = await verify.mutateAsync({
        response: credential,
        deviceName: suggested,
      });
      if (!result.ok) {
        throw new Error("Server rejected the passkey.");
      }
      setDeviceName(suggested);
      setDone(true);
      feedback.success();
      try {
        await utils.passkey.list.invalidate();
      } catch {
        /* ignore — list query may not be mounted */
      }
      onAdded?.(suggested);
    } catch (e) {
      setError(humanizeErrorMessage(e));
      feedback.error();
    } finally {
      setBusy(false);
    }
  }

  const root = `relative rounded-2xl border border-line bg-surface p-5 ${
    className ?? ""
  }`;

  if (!supported) {
    return (
      <div className={root}>
        <div className="flex items-start gap-4">
          <FingerprintIcon dim />
          <div className="min-w-0">
            <div className="text-base font-semibold text-text">
              Passkeys not available here
            </div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Your browser doesn't support passkeys yet. You can still add one
              from Settings on a newer device or browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={root + " border-wa-green/40 bg-wa-green/5"}>
        <div className="flex items-start gap-4">
          <SuccessIcon />
          <div className="min-w-0">
            <div className="text-base font-semibold text-text">
              Passkey added
            </div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Saved as <span className="text-text">{deviceName}</span>. You can
              now sign in on this device with Face ID, Touch ID, or your
              security key — no password required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={root}>
      <div className="flex items-start gap-4">
        <FingerprintIcon />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-text">Add a passkey</h3>
            <span className="text-[10px] font-bold tracking-wider uppercase text-wa-green-dark bg-wa-green/15 border border-wa-green/30 rounded-full px-2 py-0.5">
              Recommended
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted leading-relaxed">
            {platformAvailable
              ? "Sign in with Face ID, Touch ID, or Windows Hello — no password to remember, and nothing to phish."
              : "Use your security key or another device to sign in without a password."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-wa-green text-black font-semibold hover:bg-wa-green-dark transition disabled:opacity-60 disabled:cursor-not-allowed wa-tap"
      >
        {busy ? (
          <>
            <Spinner /> Setting up…
          </>
        ) : (
          <>
            <FingerprintGlyph /> Add a passkey
          </>
        )}
      </button>
    </div>
  );
}

/* ─────────── Icons ─────────── */

function FingerprintIcon({ dim }: { dim?: boolean }) {
  return (
    <div
      className={
        "shrink-0 w-12 h-12 rounded-full grid place-items-center " +
        (dim
          ? "bg-surface-2 text-text-muted border border-line"
          : "bg-wa-green/15 text-wa-green border border-wa-green/30")
      }
    >
      <FingerprintGlyph large />
    </div>
  );
}

function SuccessIcon() {
  return (
    <div className="shrink-0 w-12 h-12 rounded-full grid place-items-center bg-wa-green text-black">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5l4.5 4.5L19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function FingerprintGlyph({ large }: { large?: boolean }) {
  const s = large ? 26 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 11c0 4 .5 6.5 2 9M8.5 19c-1-2-1.5-4-1.5-7a5 5 0 0110 0v1c0 2 .3 4 1 6M5 16c-.6-1.4-1-3-1-5a8 8 0 0116 0M9 9.5A3 3 0 0115 11c0 3 .3 5 1 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
