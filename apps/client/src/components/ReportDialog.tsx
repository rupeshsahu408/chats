import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ReportReason =
  | "spam"
  | "harassment"
  | "impersonation"
  | "illegal"
  | "other";

interface ReasonMeta {
  value: ReportReason;
  label: string;
  description: string;
  icon: string;
}

const REASONS: ReasonMeta[] = [
  {
    value: "spam",
    label: "Spam",
    description: "Unsolicited messages, scams, or repetitive promotion.",
    icon: "M3 8h18M3 12h18M3 16h12",
  },
  {
    value: "harassment",
    label: "Harassment or bullying",
    description: "Threats, slurs, or repeated unwanted contact.",
    icon: "M12 9v4m0 4h.01M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    value: "impersonation",
    label: "Impersonation",
    description: "Pretending to be someone else or a trusted brand.",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    value: "illegal",
    label: "Illegal activity",
    description: "Anything that violates the law or platform rules.",
    icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  },
  {
    value: "other",
    label: "Something else",
    description: "Tell us in your own words.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.97-4.03 9-9 9a9.04 9.04 0 01-4-1L3 21l1-4a9 9 0 1117-5z",
  },
];

export interface ReportDialogProps {
  /** The display name of the person being reported, e.g. "Jordan". */
  peerLabel: string;
  /** Optional sub-line shown under the title — e.g. "@jordan". */
  peerHandle?: string | null;
  /** Optional avatar element rendered above the title. */
  avatar?: React.ReactNode;
  /** Whether the "Also block" toggle should default to on (recommended: true). */
  defaultAlsoBlock?: boolean;
  /** Whether to show the "Also block" suggestion at all. */
  showBlockOption?: boolean;
  /** Custom verb shown in the submit button — defaults to "Submit report". */
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (
    reason: ReportReason,
    note: string,
    alsoBlock: boolean,
  ) => Promise<void>;
}

/**
 * Premium, branded dialog for submitting an abuse report. Used wherever
 * the app exposes "Report contact / Report sender / Report request":
 * direct chats, group chats, and incoming connection requests.
 *
 * Designed as a centered modal on tablets/desktop and an iOS-style
 * bottom sheet on phones, with a soft entrance animation.
 */
export function ReportDialog({
  peerLabel,
  peerHandle,
  avatar,
  defaultAlsoBlock = true,
  showBlockOption = true,
  submitLabel = "Submit report",
  onClose,
  onSubmit,
}: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(defaultAlsoBlock);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Esc to close, lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, busy]);

  async function handleSubmit() {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(reason, note.trim(), alsoBlock);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit. Please try again.");
      setBusy(false);
    }
  }

  const node = (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={sheetRef}
        className="
          relative w-full sm:max-w-md md:max-w-lg
          bg-panel text-text
          rounded-t-3xl sm:rounded-2xl
          border border-line shadow-popover
          overflow-hidden
          animate-slide-up
          max-h-[92vh] flex flex-col
        "
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile aesthetic) */}
        <div className="sm:hidden pt-3 pb-1 grid place-items-center">
          <div className="h-1 w-10 rounded-full bg-line/80" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 sm:pt-6 pb-4 text-center border-b border-line/50 bg-gradient-to-b from-red-500/8 to-transparent">
          {avatar && (
            <div className="flex justify-center mb-3">{avatar}</div>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            Report
          </div>
          <h2 className="text-[20px] font-bold tracking-tight leading-tight text-text">
            Report {peerLabel}
          </h2>
          {peerHandle && (
            <div className="mt-0.5 text-[13px] text-text-muted">{peerHandle}</div>
          )}
          <p className="mt-2 text-[12.5px] text-text-muted leading-relaxed max-w-sm mx-auto">
            Veil never sees your messages. We only receive the category
            you pick and any note you choose to add.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-bold mb-2 px-1">
            Reason
          </div>
          <div className="grid gap-2">
            {REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={
                    "w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-180 ease-veil-soft " +
                    (selected
                      ? "border-brand bg-brand/8 shadow-[0_0_0_3px_rgb(var(--wa-green)/0.12)]"
                      : "border-line hover:border-brand/40 hover:bg-brand/4 active:scale-[0.99]")
                  }
                  aria-pressed={selected}
                >
                  <span
                    className={
                      "mt-0.5 grid place-items-center size-8 rounded-lg shrink-0 " +
                      (selected
                        ? "bg-brand text-text-oncolor"
                        : "bg-line/60 text-text-muted")
                    }
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={r.icon} />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={
                        "block text-[14.5px] font-bold tracking-tight " +
                        (selected ? "text-text" : "text-text")
                      }
                    >
                      {r.label}
                    </span>
                    <span className="block mt-0.5 text-[12.5px] text-text-muted leading-snug">
                      {r.description}
                    </span>
                  </span>
                  <span
                    className={
                      "shrink-0 size-5 rounded-full grid place-items-center transition-all " +
                      (selected
                        ? "bg-brand text-text-oncolor scale-100"
                        : "border border-line bg-transparent scale-90")
                    }
                    aria-hidden
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-bold">
                Add a note
                <span className="ml-1.5 normal-case tracking-normal text-text-faint font-medium">
                  optional
                </span>
              </div>
              <div className="text-[11px] tabular-nums text-text-faint">
                {note.length}/500
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="Anything our team should know? (optional)"
              className="w-full bg-surface text-text placeholder:text-text-faint rounded-xl p-3 outline-none border border-line text-[14px] leading-relaxed resize-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15 transition"
            />
          </div>

          {showBlockOption && (
            <label
              className={
                "mt-4 flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-180 ease-veil-soft " +
                (alsoBlock
                  ? "border-brand bg-brand/8"
                  : "border-line hover:border-brand/40 hover:bg-brand/4")
              }
            >
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
                className="sr-only peer"
              />
              <span
                className={
                  "mt-0.5 size-5 shrink-0 rounded-md grid place-items-center border-2 transition-colors " +
                  (alsoBlock
                    ? "bg-brand border-brand text-text-oncolor"
                    : "bg-transparent border-line")
                }
                aria-hidden
              >
                {alsoBlock && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-bold tracking-tight text-text">
                  Also block this contact
                </span>
                <span className="block mt-0.5 text-[12.5px] text-text-muted leading-snug">
                  Recommended. They won't be able to message you or
                  appear in search again.
                </span>
              </span>
            </label>
          )}

          {err && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-500 font-medium">
              {err}
            </div>
          )}
        </div>

        {/* Footer / actions */}
        <div className="px-5 py-4 bg-bg/50 border-t border-line/60 flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="
              flex-1 h-11 rounded-full border border-line
              text-[14.5px] font-bold tracking-tight text-text
              hover:bg-surface active:scale-[0.99]
              disabled:opacity-50
              transition wa-tap
            "
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="
              flex-1 h-11 rounded-full
              bg-red-500 text-white
              text-[14.5px] font-bold tracking-tight
              shadow-[0_2px_8px_rgba(239,68,68,0.30)]
              hover:brightness-105 active:brightness-95 active:scale-[0.99]
              disabled:opacity-60 disabled:cursor-not-allowed
              transition wa-tap
              inline-flex items-center justify-center gap-2
            "
          >
            {busy ? (
              <>
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
