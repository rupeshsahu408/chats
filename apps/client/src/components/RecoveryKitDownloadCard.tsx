import { useEffect, useRef, useState } from "react";
import {
  formatBytes,
  generateRecoveryKitPdf,
  triggerKitDownload,
  type RecoveryKit,
} from "../lib/recoveryKitPdf";
import { feedback } from "../lib/feedback";
import { humanizeError } from "../lib/humanizeError";

/**
 * Visual recovery-kit download card — Veil's answer to ProtonMail's
 * "Download recovery kit" widget.
 *
 *   • Renders a small PDF "thumbnail" on the left so the user sees
 *     this is a real document, not just a button.
 *   • Lazy-builds the PDF on mount (so the file size and the
 *     download click both feel instant once the card is visible).
 *   • Calls `onDownloaded` exactly once on the user's first
 *     successful download — gating screens use this to enable
 *     their "I've saved it" CTA.
 */
export function RecoveryKitDownloadCard({
  username,
  phrase,
  onDownloaded,
  className,
}: {
  username: string;
  phrase: string;
  onDownloaded?: () => void;
  className?: string;
}) {
  const [kit, setKit] = useState<RecoveryKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadedOnce, setDownloadedOnce] = useState(false);
  // We only want to fire `onDownloaded` once even across re-renders.
  const announcedRef = useRef(false);

  // Build the PDF as soon as the card mounts so the file is ready
  // the moment the user taps download.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setKit(null);
    generateRecoveryKitPdf({ username, phrase })
      .then((built) => {
        if (!cancelled) setKit(built);
      })
      .catch((e) => {
        if (!cancelled) setError(humanizeError(e).message);
      });
    return () => {
      cancelled = true;
    };
  }, [username, phrase]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      let target = kit;
      if (!target) {
        target = await generateRecoveryKitPdf({ username, phrase });
        setKit(target);
      }
      triggerKitDownload(target);
      feedback.success();
      setDownloadedOnce(true);
      if (!announcedRef.current) {
        announcedRef.current = true;
        onDownloaded?.();
      }
    } catch (e) {
      setError(humanizeError(e).message);
    } finally {
      setDownloading(false);
    }
  }

  const filename = kit?.filename ?? `veil-recovery-kit-${username}.pdf`;
  const sizeLabel = kit ? formatBytes(kit.bytes) : "Preparing…";

  return (
    <div className={className}>
      <div
        className={
          "rounded-2xl bg-surface border border-line/70 " +
          "px-4 py-4 flex items-center gap-4 " +
          "[box-shadow:0_4px_18px_rgba(15,23,42,0.05)]"
        }
      >
        {/* Mini PDF thumbnail */}
        <PdfThumbnail />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-text">
              Download PDF
            </span>
            {downloadedOnce && (
              <span
                className={
                  "inline-flex items-center gap-1 text-[10.5px] font-semibold " +
                  "uppercase tracking-wider " +
                  "rounded-full px-2 py-0.5 " +
                  "bg-wa-green/15 text-wa-green-dark dark:text-wa-green " +
                  "border border-wa-green/35"
                }
              >
                <CheckIcon /> Saved
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-text-muted mt-0.5 truncate">
            {filename}
          </div>
          <div className="text-[11.5px] text-text-faint mt-0.5">
            {sizeLabel}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleDownload()}
          aria-label="Download recovery kit"
          disabled={downloading || (!kit && !error)}
          className={
            "shrink-0 inline-flex items-center justify-center " +
            "size-12 rounded-full wa-tap " +
            "bg-wa-green text-text-oncolor " +
            "[box-shadow:0_6px_18px_rgba(0,168,132,0.32)] " +
            "transition-transform duration-150 " +
            "hover:-translate-y-0.5 active:translate-y-0 " +
            "disabled:opacity-60 disabled:cursor-not-allowed " +
            "disabled:hover:translate-y-0"
          }
        >
          {downloading ? <Spinner /> : <DownloadArrow />}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className={
            "mt-2 rounded-xl px-3 py-2 text-[12.5px] " +
            "bg-rose-500/8 border border-rose-500/30 text-rose-700 " +
            "dark:text-rose-300"
          }
        >
          {error}
        </div>
      )}
    </div>
  );
}

/* ─────────── decorative bits ─────────── */

/**
 * Small abstract PDF preview tile — a stylised page with a QR-code-
 * style dot block, content lines, and an accent stripe. Designed to
 * read as "document" at a glance without containing any user data.
 */
function PdfThumbnail() {
  return (
    <div
      aria-hidden
      className={
        "shrink-0 relative w-[64px] h-[80px] rounded-lg " +
        "bg-gradient-to-b from-white to-[#F4F8F7] " +
        "border border-line/80 " +
        "[box-shadow:0_2px_8px_rgba(15,23,42,0.06)] " +
        "overflow-hidden"
      }
    >
      {/* "V" mark in corner */}
      <div className="absolute top-1.5 left-2 text-[8px] font-bold text-wa-green-dark dark:text-wa-green">
        V
      </div>
      <div className="absolute top-2 right-2 h-0.5 w-3 rounded-full bg-wa-green/30" />

      {/* Mock QR-dot grid */}
      <div className="absolute top-4 left-2 right-2 h-[26px] rounded-sm bg-wa-green/8 grid grid-cols-7 gap-[1px] p-[3px]">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className={
              "rounded-[1px] " +
              ((i * 7 + 3) % 5 < 2
                ? "bg-wa-green-dark/70"
                : "bg-transparent")
            }
          />
        ))}
      </div>

      {/* Content lines */}
      <div className="absolute left-2 right-2 top-[36px] space-y-1">
        <div className="h-[3px] rounded-full bg-line/90" />
        <div className="h-[3px] rounded-full bg-line/70 w-[70%]" />
        <div className="h-[3px] rounded-full bg-line/70 w-[55%]" />
      </div>

      {/* Accent stripe */}
      <div className="absolute left-2 right-2 bottom-2 h-2 rounded-full bg-wa-green/40" />
    </div>
  );
}

function DownloadArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v12" />
      <path d="M6 12l6 6 6-6" />
      <path d="M5 20h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={11}
      height={11}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4 4L19 6.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}
