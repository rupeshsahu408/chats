import { forwardRef, useCallback } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { feedback } from "../lib/feedback";

type Variant = "tap" | "press" | "success" | "error" | "none";

interface TapButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What kind of feedback to play on click. Defaults to "tap". */
  feedback?: Variant;
  children?: ReactNode;
}

/**
 * Drop-in `<button>` that adds the VeilChat tap micro-interaction:
 *  - 80 ms spring-y press scale via the shared `wa-tap` class
 *  - matched haptic + sound on every click
 *
 * Existing buttons can opt in by simply swapping `<button>` →
 * `<TapButton>`. We keep the prop surface identical so it's a free swap.
 */
export const TapButton = forwardRef<HTMLButtonElement, TapButtonProps>(
  function TapButton(
    { feedback: variant = "tap", className, onClick, children, ...rest },
    ref,
  ) {
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (variant !== "none" && !rest.disabled) {
          feedback[variant]();
        }
        onClick?.(e);
      },
      [variant, onClick, rest.disabled],
    );
    const cls = ["wa-tap", className].filter(Boolean).join(" ");
    return (
      <button ref={ref} className={cls} onClick={handleClick} {...rest}>
        {children}
      </button>
    );
  },
);

/**
 * Imperative helper for non-button surfaces (a row, a swipe, a long-press).
 * Use when you can't change the underlying element to <TapButton>.
 */
export function fireFeedback(variant: Variant = "tap"): void {
  if (variant === "none") return;
  feedback[variant]();
}
