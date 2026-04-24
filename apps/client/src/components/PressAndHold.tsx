import { useEffect, useRef, useState } from "react";

/**
 * Press-and-hold confirmation control. The user must hold a pointer
 * (or finger) on the button for `holdMs` continuous milliseconds; on
 * completion `onComplete` fires exactly once. Releasing or moving off
 * the control mid-hold cancels and resets the progress smoothly.
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
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function tick() {
    if (startRef.current == null) return;
    const elapsed = Date.now() - startRef.current;
    const next = Math.min(1, elapsed / holdMs);
    setProgress(next);
    if (next >= 1) {
      if (!completedRef.current) {
        completedRef.current = true;
        setDone(true);
        setHolding(false);
        onComplete();
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startHold() {
    if (disabled || done) return;
    setHolding(true);
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (done) return;
    setHolding(false);
    startRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Smoothly drain progress back to 0.
    setProgress(0);
  }

  // Tailwind-friendly conic-gradient progress ring rendered behind the button.
  const ringStyle: React.CSSProperties = {
    background: done
      ? "conic-gradient(var(--tw-color-wa-green, #25d366) 360deg, transparent 0)"
      : `conic-gradient(var(--tw-color-wa-green, #25d366) ${progress * 360}deg, rgba(255,255,255,0.06) 0)`,
    transition: holding ? "none" : "background 200ms ease",
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || done}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full max-w-xs h-14 rounded-full select-none touch-none flex items-center justify-center font-semibold transition-colors ${
          done
            ? "text-white"
            : holding
              ? "text-white"
              : "text-text"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full p-[3px]"
          style={ringStyle}
        >
          <span
            className={`block w-full h-full rounded-full ${
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
      <p className="text-xs text-text-muted text-center">
        {done
          ? "Thanks — you can continue."
          : holding
            ? "Keep holding…"
            : "Tap and hold for 2 seconds"}
      </p>
    </div>
  );
}
