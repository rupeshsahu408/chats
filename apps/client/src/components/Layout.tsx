import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
 * WhatsApp-style design primitives.
 *
 * The names ScreenShell / Logo / PrimaryButton / SecondaryButton /
 * FieldLabel / ErrorMessage / InfoMessage / NavCard / Pill / Divider
 * are kept for compatibility with existing pages; their visual style
 * is now WhatsApp.
 * ─────────────────────────────────────────────────────────────*/

/** Centered single-column shell (signup/login/invite screens). */
export function ScreenShell({
  children,
  back,
  phase,
}: {
  children: ReactNode;
  back?: string;
  phase?: string;
}) {
  return (
    <main className="min-h-full flex flex-col bg-bg text-text">
      {(back || phase) && (
        <header className="h-14 px-4 flex items-center justify-between bg-bar text-text-oncolor shadow-bar">
          {back ? (
            <Link
              to={back}
              className="flex items-center gap-2 text-text-oncolor/90 hover:text-text-oncolor wa-tap"
            >
              <ChevronLeftIcon />
              <span className="text-sm font-medium">Back</span>
            </Link>
          ) : (
            <span />
          )}
          {phase && (
            <span className="text-xs uppercase tracking-wider text-text-oncolor/80">
              {phase}
            </span>
          )}
        </header>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md flex flex-col gap-5">{children}</div>
      </div>
    </main>
  );
}

/** WhatsApp-style logo (white speech bubble with phone, on green). */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-wa-green flex items-center justify-center shadow-lg"
    >
      <svg viewBox="0 0 32 32" className="w-3/5 h-3/5" aria-hidden="true">
        <path
          d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.6 1.9 6.5L4 29l7.7-1.9C13.5 28 14.7 28.3 16 28.3c6.6 0 12-5.4 12-12.3S22.6 3 16 3z"
          fill="white"
        />
        <path
          d="M22.6 19.4c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2.1-.4 0-.5-.1-.2-.7-1.7-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.4 4.6.8.3 1.4.5 1.8.7.8.2 1.5.2 2 .1.6-.1 2-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.1-.3-.2-.5-.3z"
          fill="rgb(var(--wa-green))"
        />
      </svg>
    </div>
  );
}

/** Filled green pill button (WhatsApp primary action). */
export function PrimaryButton({
  children,
  loading,
  className,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={
        "w-full h-12 rounded-full bg-wa-green px-6 font-medium text-text-oncolor " +
        "hover:bg-wa-green-dark active:scale-[0.99] transition " +
        "disabled:opacity-50 disabled:cursor-not-allowed wa-tap " +
        (className ?? "")
      }
    >
      {loading ? "Working…" : children}
    </button>
  );
}

/** Outlined / ghost secondary button. */
export function SecondaryButton({
  children,
  className,
  ...props
}: {
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "w-full h-12 rounded-full border border-line bg-transparent px-6 " +
        "font-medium text-text hover:bg-surface transition " +
        "disabled:opacity-50 wa-tap " +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-medium tracking-wide text-text-muted mb-1.5">
      {children}
    </label>
  );
}

/** Standard text/number/email input with WhatsApp styling. */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl bg-surface border border-line text-text " +
        "px-4 py-3 outline-none focus:border-wa-green transition " +
        (props.className ?? "")
      }
    />
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-600 dark:text-red-300">
      {children}
    </div>
  );
}

export function InfoMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-wa-green/10 border border-wa-green/30 px-3 py-2 text-sm text-wa-green-dark dark:text-wa-green">
      {children}
    </div>
  );
}

/** Clickable card row. Used in legacy hub navigation. */
export function NavCard({
  to,
  title,
  sub,
  badge,
  onClick,
}: {
  to?: string;
  title: string;
  sub?: string;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div className="w-full text-left rounded-xl bg-surface border border-line px-4 py-3 hover:bg-elevated transition flex items-center justify-between gap-3 wa-tap">
      <div className="min-w-0">
        <div className="font-medium flex items-center gap-2 text-text">
          <span className="truncate">{title}</span>
          {badge}
        </div>
        {sub && <div className="text-xs text-text-muted truncate">{sub}</div>}
      </div>
      <ChevronRightIcon className="text-text-muted shrink-0" />
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return (
    <button onClick={onClick} className="w-full text-left">
      {inner}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "danger" | "ok";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface text-text-muted border border-line",
    accent: "bg-wa-green/15 text-wa-green-dark dark:text-wa-green",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    danger: "bg-red-500/15 text-red-700 dark:text-red-300",
    ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Divider({ children }: { children?: ReactNode }) {
  if (!children) return <div className="border-t border-line my-2" />;
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 border-t border-line" />
      <span className="text-[10px] uppercase tracking-widest text-text-muted">
        {children}
      </span>
      <div className="flex-1 border-t border-line" />
    </div>
  );
}

/* ───────────── New WhatsApp-style components ───────────── */

/** Top app bar (green in light mode, dark surface in dark mode). */
export function AppBar({
  title,
  back,
  right,
  subtitle,
}: {
  title: ReactNode;
  back?: string | (() => void);
  right?: ReactNode;
  subtitle?: ReactNode;
}) {
  const BackBtn = back && (
    typeof back === "string" ? (
      <Link
        to={back}
        className="text-text-oncolor/90 hover:text-text-oncolor wa-tap p-1 -ml-1"
        aria-label="Back"
      >
        <ChevronLeftIcon />
      </Link>
    ) : (
      <button
        onClick={back}
        className="text-text-oncolor/90 hover:text-text-oncolor wa-tap p-1 -ml-1"
        aria-label="Back"
      >
        <ChevronLeftIcon />
      </button>
    )
  );
  return (
    <header className="h-14 px-3 flex items-center gap-3 bg-bar text-text-oncolor shadow-bar sticky top-0 z-20">
      {BackBtn}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-text-oncolor/80 truncate">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </header>
  );
}

/** Round avatar bubble with deterministic color from peer fingerprint/id. */
export function Avatar({
  seed,
  label,
  size = 44,
  className,
}: {
  seed: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const initials = (label ?? seed).slice(0, 2).toUpperCase();
  const hue = stringToHue(seed);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `hsl(${hue}deg 45% 55%)`,
        fontSize: size * 0.38,
      }}
      className={
        "rounded-full flex items-center justify-center text-white font-medium shrink-0 select-none " +
        (className ?? "")
      }
    >
      {initials}
    </div>
  );
}

function stringToHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/** A row in the chats / contacts list. */
export function ChatListRow({
  to,
  onClick,
  seed,
  title,
  subtitle,
  meta,
  badge,
  right,
}: {
  to?: string;
  onClick?: () => void;
  seed: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  right?: ReactNode;
}) {
  const body = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface active:bg-elevated transition wa-tap border-b border-line/60 last:border-b-0">
      <Avatar seed={seed} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="font-medium text-text truncate flex-1">{title}</div>
          {meta && <div className="text-[11px] text-text-muted shrink-0">{meta}</div>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="text-sm text-text-muted truncate flex-1">
            {subtitle ?? <span className="italic">No messages yet</span>}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      </div>
      {right}
    </div>
  );
  if (to) return <Link to={to} className="block">{body}</Link>;
  if (onClick)
    return (
      <button onClick={onClick} className="block w-full text-left">
        {body}
      </button>
    );
  return body;
}

/** Numeric/unread badge. */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-wa-green text-text-oncolor text-[11px] font-semibold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** WhatsApp-style chat bubble. */
export function MessageBubble({
  direction,
  children,
  time,
  status,
}: {
  direction: "in" | "out";
  children: ReactNode;
  time?: string;
  status?: "pending" | "sent" | "failed" | "received" | "read";
}) {
  const isOut = direction === "out";
  return (
    <div
      className={
        "max-w-[78%] px-2.5 py-1.5 rounded-lg shadow-bubble text-[15px] leading-snug " +
        (isOut
          ? "self-end bg-wa-bubble-out text-text rounded-tr-[4px]"
          : "self-start bg-wa-bubble-in text-text rounded-tl-[4px]")
      }
    >
      <div className="whitespace-pre-wrap break-words">{children}</div>
      <div
        className={
          "flex items-center gap-1 justify-end mt-0.5 text-[10.5px] " +
          (isOut ? "text-text/55" : "text-text-muted")
        }
      >
        {time && <span>{time}</span>}
        {isOut && status && <StatusTicks status={status} />}
      </div>
    </div>
  );
}

function StatusTicks({
  status,
}: {
  status: "pending" | "sent" | "failed" | "received" | "read";
}) {
  if (status === "pending")
    return <span className="opacity-70" aria-label="Sending">⏱</span>;
  if (status === "failed")
    return <span className="text-red-500" aria-label="Failed">!</span>;
  if (status === "sent")
    return <SingleTickIcon className="text-wa-tick" />;
  if (status === "read")
    return <DoubleTickIcon style={{ color: "#3897F0" }} />;
  return <DoubleTickIcon className="text-wa-tick" />;
}

/** Sticky bottom message-composer bar. */
export function MessageInputBar({
  value,
  onChange,
  onSend,
  sending,
  placeholder = "Type a message",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="sticky bottom-0 bg-bg/95 backdrop-blur px-2 py-2 border-t border-line flex items-end gap-2">
      <div className="flex-1 bg-surface rounded-3xl px-4 py-2 flex items-end">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!sending && value.trim()) onSend();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="w-full bg-transparent text-text placeholder:text-text-muted resize-none outline-none max-h-32"
          style={{ minHeight: "24px" }}
        />
      </div>
      <button
        onClick={onSend}
        disabled={sending || !value.trim()}
        className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center hover:bg-wa-green-dark transition disabled:opacity-50 wa-tap shrink-0"
        aria-label="Send"
      >
        <SendIcon />
      </button>
    </div>
  );
}

/** Floating action button (FAB) used on chat list, etc. */
export function FAB({
  onClick,
  to,
  label,
  children,
}: {
  onClick?: () => void;
  to?: string;
  label: string;
  children: ReactNode;
}) {
  const cls =
    "fixed bottom-20 right-5 sm:bottom-6 size-14 rounded-2xl bg-wa-green text-text-oncolor shadow-sheet flex items-center justify-center hover:bg-wa-green-dark active:scale-95 transition wa-tap z-30";
  if (to)
    return (
      <Link to={to} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  return (
    <button onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

/** Round icon button (used inside app bars). */
export function IconButton({
  onClick,
  label,
  children,
  className,
}: {
  onClick?: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={
        "size-10 rounded-full flex items-center justify-center hover:bg-white/10 transition wa-tap " +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

/** Empty-state placeholder. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 text-text-muted">
      {icon && <div className="text-text-faint">{icon}</div>}
      <div className="text-text font-medium text-lg">{title}</div>
      {message && <div className="text-sm max-w-sm">{message}</div>}
      {action && <div className="mt-2 w-full max-w-xs">{action}</div>}
    </div>
  );
}

/** Inline spinner. */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="animate-spin text-text-muted"
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeOpacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Settings list row (icon · label · sub · right). */
export function SettingsRow({
  icon,
  label,
  sub,
  right,
  onClick,
  to,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}) {
  const body = (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-surface active:bg-elevated transition wa-tap">
      {icon && <div className="text-text-muted shrink-0 w-6 flex justify-center">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className={"font-medium " + (danger ? "text-red-500" : "text-text")}>
          {label}
        </div>
        {sub && <div className="text-xs text-text-muted truncate">{sub}</div>}
      </div>
      {right}
    </div>
  );
  if (to) return <Link to={to} className="block border-b border-line/60 last:border-b-0">{body}</Link>;
  if (onClick)
    return (
      <button
        onClick={onClick}
        className="block w-full text-left border-b border-line/60 last:border-b-0"
      >
        {body}
      </button>
    );
  return <div className="border-b border-line/60 last:border-b-0">{body}</div>;
}

/* ───────────── Icons (inline SVG, currentColor) ───────────── */

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-6 h-6 " + (className ?? "")} fill="currentColor" aria-hidden="true">
      <path d="M2.5 21l19-9-19-9 0 7 13 2-13 2z" />
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-6 h-6 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-6 h-6 " + (className ?? "")} fill="currentColor" aria-hidden="true">
      <path d="M5 3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8.5L4 21v-3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
    </svg>
  );
}

export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-6 h-6 " + (className ?? "")} fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <circle cx="17" cy="9" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1z" />
      <path d="M22 20c0-2.5-2.2-4.5-5-4.5-.7 0-1.4.1-2 .4 1.2 1.1 2 2.6 2 4.1V21h5v-1z" />
    </svg>
  );
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-6 h-6 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

export function DoubleTickIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 18 12"
      className={"w-4 h-3 " + (className ?? "")}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 6.5 5 10.5 12 1.5" />
      <polyline points="6.5 6.5 10 10 17 1" />
    </svg>
  );
}

export function SingleTickIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={"w-3 h-3 " + (className ?? "")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 6 4.5 10 11 1" />
    </svg>
  );
}

export function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className ?? "w-6 h-6"} aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.48-8.48l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.34a2 2 0 0 1-2.83-2.83L15.07 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "w-6 h-6"} aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "w-5 h-5"} aria-hidden>
      <path d="M6 4l14 8-14 8z" />
    </svg>
  );
}

export function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "w-5 h-5"} aria-hidden>
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

export function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "w-5 h-5"} aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className ?? "w-5 h-5"} aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-4 h-4 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
