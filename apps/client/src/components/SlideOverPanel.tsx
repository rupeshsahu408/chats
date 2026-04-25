import { useEffect, useRef, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";

/**
 * Lightweight slide-over panel anchored to the right edge of the
 * viewport. Used in place of a full-screen settings page or a heavy
 * bottom sheet — the user can dismiss it by tapping the backdrop,
 * pressing Escape, or swiping it off-screen with a drag gesture.
 *
 * The panel has a constrained width so it never feels rigid or
 * full-screen, which matters most on small phones where the previous
 * implementation forced people to resize or scroll awkwardly to see
 * everything. A subtle vertical handle on the left edge hints at the
 * swipe affordance for first-time users.
 */
export function SlideOverPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = "w-[88vw] max-w-[360px]",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Tailwind classes overriding the default panel width. */
  widthClass?: string;
}) {
  // The panel's horizontal offset is driven by a motion value so the
  // user can drag it directly under their finger while it stays in
  // perfect sync with the framer-motion animation engine.
  const x = useMotionValue(0);
  // Backdrop dim fades out as the user drags the panel away.
  const backdropOpacity = useTransform(x, [0, 320], [1, 0]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape and lock body scroll while the panel is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Reset the drag offset whenever we (re)open so the next show
  // doesn't briefly flash the panel half-way off screen.
  useEffect(() => {
    if (open) x.set(0);
  }, [open, x]);

  // Pull focus into the panel for keyboard users.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function onDragEnd(_e: unknown, info: PanInfo) {
    // Dismiss on a confident rightward swipe OR a generous final
    // offset, so both flick gestures and slow drags work.
    const shouldClose = info.offset.x > 120 || info.velocity.x > 500;
    if (shouldClose) {
      onClose();
    } else {
      // Snap back home.
      x.set(0);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/40"
            style={{ opacity: backdropOpacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : "Menu"}
            tabIndex={-1}
            className={
              "fixed right-0 top-0 bottom-0 z-50 " +
              widthClass +
              " bg-panel border-l border-line shadow-2xl " +
              "flex flex-col outline-none " +
              "rounded-l-2xl overflow-hidden " +
              "touch-pan-y " +
              "[padding-top:env(safe-area-inset-top)] " +
              "[padding-bottom:env(safe-area-inset-bottom)]"
            }
            style={{ x }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.6 }}
            dragMomentum={false}
            onDragEnd={onDragEnd}
          >
            {/* Drag affordance — a slim vertical handle on the leading
                (left) edge that hints "you can pull me away". */}
            <div
              aria-hidden
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-line/80 pointer-events-none"
            />

            {(title || subtitle) && (
              <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-line/60 shrink-0">
                <div className="min-w-0">
                  {title && (
                    <div className="text-[15px] font-semibold text-text truncate">
                      {title}
                    </div>
                  )}
                  {subtitle && (
                    <div className="text-[12px] text-text-muted mt-0.5 truncate">
                      {subtitle}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1 -mt-1 size-8 grid place-items-center rounded-full text-text-muted hover:bg-elevated/80 active:bg-elevated transition-colors wa-tap shrink-0"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={18}
                    height={18}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </header>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Standard row inside a SlideOverPanel — uses a leading icon, a
 * label, an optional sub-label, and an optional trailing element
 * (chevron, switch, badge). Tap-friendly and keyboard accessible.
 */
export function PanelRow({
  icon,
  label,
  sub,
  trailing,
  onClick,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  sub?: string;
  trailing?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full flex items-center gap-3 px-4 py-3 text-left " +
        "hover:bg-elevated/60 active:bg-elevated transition-colors wa-tap " +
        (danger ? "text-red-400" : "text-text")
      }
    >
      {icon && (
        <span
          className={
            "size-9 rounded-full grid place-items-center shrink-0 " +
            (danger
              ? "bg-red-500/10 text-red-400"
              : "bg-elevated text-text-muted")
          }
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium leading-tight truncate">
          {label}
        </span>
        {sub && (
          <span
            className={
              "block text-[12px] leading-tight mt-0.5 truncate " +
              (danger ? "text-red-400/70" : "text-text-muted")
            }
          >
            {sub}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}

/** Visual divider between groups of rows inside a SlideOverPanel. */
export function PanelGroupHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
      {label}
    </div>
  );
}
