import { useEffect, useRef, useState } from "react";

/**
 * Press-and-hold confirmation control. The user must hold a pointer
 * (or finger) on the button for `holdMs` continuous milliseconds; on
 * completion `onComplete` fires exactly once. Releasing or moving off
 * the control mid-hold cancels and the ring smoothly drains back to
 * zero (rather than snapping), so brief mis-taps don't feel jarring.
 *
 * Used as the second half of the human-verification flow that runs
 * for medium / high risk logins, after the user has solved the slide
 * puzzle.
 */
export function PressAndHold({
  holdMs = 2000,
  onComplete,
  label = "Press and hold to continue",
  doneLabel = "Verified",
  disabled = false,
}: {
  holdMs?: number;
  onComplete: () => void;
  label?: string;
  doneLabel?: string;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  // Single rAF loop handles BOTH ramping up while holding AND smoothly
  // draining back to zero on cancel. `direction` flips between the two.
  const directionRef = useRef<"hold" | "drain" | null>(null);
  // Track the elapsed equivalent on the ring (in ms), so a quick
  // press-then-release drains from wherever we got to — not from full.
  const ringMsRef = useRef(0);
  const lastTickRef = useRef<number>(0);
  // Drain at ~3× the speed we filled at: a short, smooth "release"
  // motion that doesn't keep the user waiting if they let go early.
  const DRAIN_FACTOR = 3;
  // Hold-button friendly seconds for the helper text below the ring.
  const seconds = Math.max(1, Math.round(holdMs / 1000));

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function tick(now: number) {
    const dt = now - lastTickRef.current;
    lastTickRef.current = now;
    const dir = directionRef.current;
    if (dir === "hold") {
      ringMsRef.current = Math.min(holdMs, ringMsRef.current + dt);
      const next = ringMsRef.current / holdMs;
      setProgress(next);
      if (next >= 1) {
        if (!completedRef.current) {
          completedRef.current = true;
          setDone(true);
          setHolding(false);
          directionRef.current = null;
          rafRef.current = null;
          onComplete();
        }
        return;
      }
    } else if (dir === "drain") {
      ringMsRef.current = Math.max(0, ringMsRef.current - dt * DRAIN_FACTOR);
      const next = ringMsRef.current / holdMs;
      setProgress(next);
      if (next <= 0) {
        directionRef.current = null;
        rafRef.current = null;
        return;
      }
    } else {
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (rafRef.current !== null) return;
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }

  function startHold(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || done) return;
    // Pointer capture keeps the gesture alive even if the user's finger
    // drifts slightly off the edge — common on touch screens.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* not all browsers; harmless */
    }
    setHolding(true);
    directionRef.current = "hold";
    ensureLoop();
  }

  function cancelHold(e?: React.PointerEvent<HTMLButtonElement>) {
    if (done) return;
    if (e) {
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (directionRef.current === "hold") {
      setHolding(false);
      directionRef.current = "drain";
      ensureLoop();
    }
  }

  // Tailwind-friendly conic-gradient progress ring rendered behind the button.
  const ringStyle: React.CSSProperties = {
    background: done
      ? "conic-gradient(var(--tw-color-wa-green, #25d366) 360deg, transparent 0)"
      : `conic-gradient(var(--tw-color-wa-green, #25d366) ${progress * 360}deg, rgba(255,255,255,0.06) 0)`,
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || done}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        // NOTE: deliberately not handling `onPointerLeave` — pointer
        // capture keeps the gesture bound to this element even if the
        // user's finger drifts slightly off the edge mid-hold.
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full max-w-xs h-14 rounded-full select-none touch-none flex items-center justify-center font-semibold transition-colors ${
          done
            ? "text-white"
            : holding
              ? "text-white"
              : "text-text"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ WebkitTapHighlightColor: "transparent" }}
        aria-label={done ? doneLabel : label}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full p-[3px]"
          style={ringStyle}
        >
          <span
            className={`block w-full h-full rounded-full transition-colors ${
              done
                ? "bg-wa-green"
                : holding
                  ? "bg-wa-green/80"
                  : "bg-surface border border-line"
            }`}
          />
        </span>
        <span className="relative z-10 px-6 text-sm">
          {done ? doneLabel : label}
        </span>
      </button>
      <p className="text-xs text-text-muted text-center" aria-live="polite">
        {done
          ? "Thanks — you can continue."
          : holding
            ? "Keep holding…"
            : `Tap and hold for ${seconds} second${seconds === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
