import { useEffect, useRef, useState } from "react";
import type { PendingLoginRequestEntry } from "@veil/shared";
import { trpc } from "../lib/trpc";
import { toast } from "../lib/toast";
import { humanizeErrorMessage } from "../lib/humanizeError";

interface Props {
  request: PendingLoginRequestEntry;
  onResolved: () => void;
}

/**
 * Full-screen "is this you?" sheet shown on the device that's
 * currently signed in when a *different* device tries to sign in to
 * the same account. Modeled after WhatsApp's confirm prompt: huge
 * device + location header, two clear actions, and a live countdown
 * so the user knows the other device isn't waiting forever.
 *
 * Accept → server marks the conflict accepted, *this* session gets
 * revoked, the other device claims the new session. Reject → the
 * other device is denied and a security alert is queued for review.
 */
export function IncomingLoginRequestModal({ request, onResolved }: Props) {
  const resolve = trpc.auth.resolveLoginRequest.useMutation();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  const expiresMs = new Date(request.expiresAt).getTime();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)),
  );

  // Keep a stable ref to onResolved so the countdown interval below
  // doesn't restart every time the parent re-renders (which would
  // happen every time SessionGuard re-renders, since onResolved is an
  // inline arrow function). The interval only needs to restart when
  // expiresMs actually changes (i.e., when the conflict itself changes).
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(t);
        // Local timeout — let the guard re-poll & dismiss.
        onResolvedRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresMs]);

  async function decide(decision: "accept" | "reject") {
    if (busy) return;
    setBusy(decision);
    try {
      await resolve.mutateAsync({ conflictId: request.id, decision });
      onResolved();
      if (decision === "accept") {
        // We expect to be force-logged-out within seconds. Show a
        // calm heads-up so the user isn't surprised.
        toast.info("Signing you out so the other device can sign in…");
      } else {
        toast.success("Sign-in denied. We'll keep an eye out for follow-ups.");
      }
    } catch (e) {
      toast.error(e, { title: "Couldn't update that request" });
      setBusy(null);
      humanizeErrorMessage(e); // (kept to match other call sites' style)
    }
  }

  const place = [request.city, request.country].filter(Boolean).join(", ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 pb-4 sm:p-6"
    >
      <div className="w-full max-w-md rounded-3xl bg-bg border border-line shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center border-b border-line bg-amber-500/5">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8v5m0 3.5h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-600 dark:text-amber-400"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">A new device is trying to sign in</h2>
          <p className="mt-1 text-sm text-text-muted">
            Only one device can be signed in to your account. Approve only
            if it&apos;s you.
          </p>
        </div>

        <dl className="px-6 py-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-muted">Device</dt>
          <dd className="text-text font-medium">{request.device}</dd>
          {place ? (
            <>
              <dt className="text-text-muted">Approx. location</dt>
              <dd className="text-text">{place}</dd>
            </>
          ) : null}
          <dt className="text-text-muted">Expires in</dt>
          <dd className="text-text">
            {secondsLeft > 60
              ? `${Math.ceil(secondsLeft / 60)} min`
              : `${secondsLeft}s`}
          </dd>
        </dl>

        <div className="px-6 pb-6 grid gap-2">
          <button
            type="button"
            onClick={() => decide("reject")}
            disabled={!!busy}
            className="w-full px-4 py-3 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-500 transition disabled:opacity-60 wa-tap"
          >
            {busy === "reject" ? "Denying…" : "Not me — deny"}
          </button>
          <button
            type="button"
            onClick={() => decide("accept")}
            disabled={!!busy}
            className="w-full px-4 py-3 rounded-xl border border-line bg-surface text-text font-semibold hover:bg-white/5 transition disabled:opacity-60 wa-tap"
          >
            {busy === "accept"
              ? "Approving…"
              : "It's me — sign me out and let it in"}
          </button>
          <p className="text-[11px] text-text-faint text-center mt-1">
            Approving signs out this device. Denying keeps you signed in here
            and adds a security alert you can review.
          </p>
        </div>
      </div>
    </div>
  );
}
