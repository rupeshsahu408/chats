import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { IconButton, MoreVerticalIcon } from "./Layout";

/**
 * App-bar 3-dot menu used by the primary tabs (Chats / People / Settings).
 *
 * Renders a small popover with discovery-related entry points:
 *   - Discover people  → public directory
 *   - Chat requests    → incoming connection requests inbox
 *
 * Closes on outside-click, Escape, or selection. Shows a small badge
 * on the trigger when there are pending incoming requests.
 */
export function HeaderMenu() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const incoming = trpc.connections.listIncoming.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
    refetchInterval: 60_000,
  });
  const pendingCount = incoming.data?.length ?? 0;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <IconButton
        label="More"
        className="text-text-oncolor"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVerticalIcon />
        {pendingCount > 0 && (
          <span
            aria-hidden
            className={
              "absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 " +
              "rounded-full bg-red-500 text-[10px] font-bold text-white " +
              "flex items-center justify-center " +
              "ring-2 ring-bar shadow"
            }
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </IconButton>

      {open && (
        <div
          role="menu"
          className={
            "absolute right-0 top-full mt-1 w-56 z-30 " +
            "rounded-xl bg-surface border border-line " +
            "shadow-[0_8px_24px_rgba(11,20,26,0.18),0_2px_6px_rgba(11,20,26,0.10)] " +
            "overflow-hidden animate-fade-in"
          }
        >
          <MenuItem
            to="/discover"
            label="Discover people"
            sub="Browse everyone on VeilChat"
            icon={<CompassIcon />}
            onClick={() => setOpen(false)}
          />
          <div className="border-t border-line/60" />
          <MenuItem
            to="/connections?tab=incoming"
            label="Chat requests"
            sub={
              pendingCount > 0
                ? `${pendingCount} pending`
                : "Nothing pending"
            }
            icon={<InboxIcon />}
            badge={pendingCount > 0 ? pendingCount : undefined}
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  to,
  label,
  sub,
  icon,
  badge,
  onClick,
}: {
  to: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className={
        "flex items-center gap-3 px-3.5 py-2.5 " +
        "text-text hover:bg-elevated/70 active:bg-elevated " +
        "transition-colors duration-100 wa-tap"
      }
    >
      {icon && (
        <span className="size-9 rounded-full bg-elevated text-text-muted grid place-items-center shrink-0">
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">
          {label}
        </span>
        {sub && (
          <span className="block text-[12px] text-text-muted leading-tight mt-0.5 truncate">
            {sub}
          </span>
        )}
      </span>
      {badge !== undefined && (
        <span className="text-[11px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-3.5 5L8 15l1.5-4.5L14 9z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 13h4l1.5 2.5h7L17 13h4" />
      <path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5 5z" />
    </svg>
  );
}
