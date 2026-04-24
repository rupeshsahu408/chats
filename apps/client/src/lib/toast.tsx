/**
 * Veil toast notifications.
 *
 * A tiny, dependency-free pub/sub toast system. Rendered through a
 * single `<ToastViewport />` mounted near the root of the tree. Other
 * code calls the `toast` singleton from anywhere — no context, no hook
 * required for emitting (a hook is provided for components that want
 * to react to dismissals, but it's optional).
 *
 * Visual style is deliberately premium: a frosted, layered card that
 * slides up from the bottom on mobile / top-right on desktop, with an
 * icon per variant and a soft accent stripe. Auto-dismisses after a
 * variant-specific duration; users can dismiss manually too.
 */

import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { feedback } from "./feedback";
import { humanizeError, type FriendlyError } from "./humanizeError";

export type ToastVariant = "error" | "success" | "info" | "warning";

export type ToastInput = {
  variant?: ToastVariant;
  /** Optional bold heading. */
  title?: string;
  /** Required body line. */
  message: string;
  /**
   * Override auto-dismiss. Pass 0 (or a negative) to make it sticky
   * (user must dismiss). Defaults: error 6s, warning 5s, others 3.5s.
   */
  duration?: number;
  /** Optional inline action — renders a small button on the toast. */
  action?: { label: string; onClick: () => void };
};

export type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
  createdAt: number;
};

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  // Snapshot so subscribers don't see in-place mutations.
  const snap = items.slice();
  for (const l of listeners) l(snap);
}

function nextId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultDuration(v: ToastVariant): number {
  switch (v) {
    case "error":
      return 6000;
    case "warning":
      return 5000;
    case "success":
      return 3000;
    default:
      return 3500;
  }
}

function show(input: ToastInput): string {
  const variant = input.variant ?? "info";
  const id = nextId();
  const item: ToastItem = {
    ...input,
    id,
    variant,
    createdAt: Date.now(),
  };
  items = [...items, item];
  // Cap stack to 4 — drop oldest if needed.
  if (items.length > 4) items = items.slice(items.length - 4);
  emit();

  // Subtle haptic + tone so the toast also "feels" right.
  try {
    if (variant === "error") feedback.error();
    else if (variant === "success") feedback.success();
  } catch {
    /* feedback is best-effort. */
  }

  const dur = input.duration ?? defaultDuration(variant);
  if (dur > 0) {
    window.setTimeout(() => dismiss(id), dur);
  }
  return id;
}

function dismiss(id: string) {
  const before = items.length;
  items = items.filter((t) => t.id !== id);
  if (items.length !== before) emit();
}

function dismissAll() {
  if (items.length === 0) return;
  items = [];
  emit();
}

export const toast = {
  show,
  dismiss,
  dismissAll,
  /**
   * Emit an error toast from any thrown value. The message is run
   * through `humanizeError` so technical strings become friendly.
   */
  error(err: unknown, opts?: Partial<ToastInput>): string {
    const friendly: FriendlyError = humanizeError(err);
    return show({
      variant: "error",
      title: opts?.title ?? friendly.title,
      message: opts?.message ?? friendly.message,
      duration: opts?.duration,
      action: opts?.action,
    });
  },
  success(message: string, opts?: Partial<ToastInput>): string {
    return show({
      variant: "success",
      title: opts?.title,
      message,
      duration: opts?.duration,
      action: opts?.action,
    });
  },
  info(message: string, opts?: Partial<ToastInput>): string {
    return show({
      variant: "info",
      title: opts?.title,
      message,
      duration: opts?.duration,
      action: opts?.action,
    });
  },
  warning(message: string, opts?: Partial<ToastInput>): string {
    return show({
      variant: "warning",
      title: opts?.title,
      message,
      duration: opts?.duration,
      action: opts?.action,
    });
  },
};

// Optional context — exists for test environments that want to inject
// a viewport or for components that prefer a hook over the singleton.
const ToastContext = createContext<typeof toast>(toast);
export const useToast = () => toast;
export { ToastContext };

/* ────────────────── viewport ────────────────── */

/**
 * Single viewport that renders the active toast stack. Mount once at
 * the root of the app. Uses a portal to body so it always sits above
 * page content and is never clipped by parent overflow.
 */
export function ToastViewport() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    const cb: Listener = (next) => setList(next);
    listeners.add(cb);
    cb(items);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  // SSR / first paint guard.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className={
        "veil-toast-viewport pointer-events-none fixed z-[1000] " +
        // Mobile: stack at the bottom centered. Desktop: top-right.
        "inset-x-0 bottom-0 px-3 pb-[max(env(safe-area-inset-bottom),12px)] " +
        "flex flex-col gap-2 items-center " +
        "sm:inset-auto sm:top-4 sm:right-4 sm:bottom-auto sm:items-end sm:px-0 sm:pb-0"
      }
    >
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  // Slide-in animation on mount via a one-shot class flip.
  const ref = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Force reflow so the transition kicks in.
    el.getBoundingClientRect();
    el.classList.add("veil-toast-enter");
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    // Wait for exit animation, then actually remove from store.
    window.setTimeout(() => toast.dismiss(item.id), 160);
  }

  const tone = TONES[item.variant];
  return (
    <div
      ref={ref}
      role={item.variant === "error" ? "alert" : "status"}
      className={
        "veil-toast pointer-events-auto w-[min(100%,380px)] " +
        "rounded-2xl border " +
        tone.surface +
        " " +
        "bg-surface/95 [backdrop-filter:saturate(180%)_blur(14px)] " +
        "[box-shadow:0_1px_0_rgb(255_255_255/0.04)_inset,0_10px_30px_rgb(11_20_26/0.18),0_2px_8px_rgb(11_20_26/0.10)] " +
        "overflow-hidden " +
        (closing ? "veil-toast-exit" : "")
      }
    >
      {/* Accent stripe along the leading edge. */}
      <div className="flex">
        <div className={"w-1 shrink-0 " + tone.stripe} aria-hidden />
        <div className="flex-1 p-3.5 pr-2 flex items-start gap-3 min-w-0">
          <div
            className={
              "shrink-0 size-8 rounded-full grid place-items-center " +
              tone.iconWrap
            }
            aria-hidden
          >
            <ToastIcon variant={item.variant} />
          </div>
          <div className="flex-1 min-w-0">
            {item.title && (
              <div className="font-semibold text-[14px] tracking-tight text-text leading-tight">
                {item.title}
              </div>
            )}
            <div
              className={
                "text-[13.5px] leading-snug text-text-muted " +
                (item.title ? "mt-0.5" : "")
              }
            >
              {item.message}
            </div>
            {item.action && (
              <button
                onClick={() => {
                  try {
                    item.action?.onClick();
                  } finally {
                    close();
                  }
                }}
                className={
                  "mt-2 inline-flex items-center text-[12.5px] font-semibold " +
                  "rounded-full px-3 py-1 wa-tap " +
                  tone.actionBtn
                }
              >
                {item.action.label}
              </button>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Dismiss"
            className={
              "shrink-0 size-7 -mr-1 rounded-full grid place-items-center " +
              "text-text-faint hover:text-text hover:bg-elevated/60 " +
              "transition-colors duration-150 wa-tap"
            }
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const common = {
    width: 16,
    height: 16,
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (variant === "error") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4.5" />
        <path d="M12 16v.01" />
      </svg>
    );
  }
  if (variant === "success") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.2 2.4 2.4 4.6-5" />
      </svg>
    );
  }
  if (variant === "warning") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M12 4 2.5 20h19L12 4z" />
        <path d="M12 10v4" />
        <path d="M12 17.25v.01" />
      </svg>
    );
  }
  // info
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8v.01" />
    </svg>
  );
}

const TONES: Record<
  ToastVariant,
  { surface: string; stripe: string; iconWrap: string; actionBtn: string }
> = {
  error: {
    surface: "border-red-500/25",
    stripe: "bg-gradient-to-b from-red-400 to-red-600",
    iconWrap:
      "bg-red-500/12 text-red-600 dark:text-red-300 ring-1 ring-red-500/25",
    actionBtn:
      "bg-red-500/12 text-red-700 dark:text-red-200 hover:bg-red-500/18",
  },
  success: {
    surface: "border-wa-green/25",
    stripe: "bg-gradient-to-b from-wa-green to-wa-green-dark",
    iconWrap:
      "bg-wa-green/15 text-wa-green-dark dark:text-wa-green ring-1 ring-wa-green/25",
    actionBtn:
      "bg-wa-green/15 text-wa-green-dark dark:text-wa-green hover:bg-wa-green/22",
  },
  warning: {
    surface: "border-amber-500/25",
    stripe: "bg-gradient-to-b from-amber-400 to-amber-600",
    iconWrap:
      "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25",
    actionBtn:
      "bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/22",
  },
  info: {
    surface: "border-line/60",
    stripe: "bg-gradient-to-b from-text-faint to-text-muted",
    iconWrap:
      "bg-elevated text-text-muted ring-1 ring-line/60",
    actionBtn: "bg-elevated text-text hover:bg-elevated/80",
  },
};

/* Suppress unused warning when consumers import nothing — tree-shake friendly. */
export type _UnusedReactNode = ReactNode;
