import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";
import { Link } from "react-router-dom";
import { feedback } from "../lib/feedback";

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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 md:px-10 md:py-12">
        <div className="w-full max-w-md md:max-w-lg flex flex-col gap-5">{children}</div>
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

/**
 * Primary action button.
 *
 * Premium polish: a soft accent gradient + subtle inset top
 * highlight + ambient accent glow on hover gives this button real
 * presence without being loud. Active state lifts off slightly so
 * the press feels physical.
 */
export function PrimaryButton({
  children,
  loading,
  className,
  onClick,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!(loading || props.disabled)) feedback.press();
        onClick?.(e);
      }}
      disabled={loading || props.disabled}
      className={
        "w-full h-12 rounded-full px-6 " +
        "font-semibold text-[15px] tracking-tight text-text-oncolor " +
        "bg-gradient-to-b from-wa-green to-wa-green-dark " +
        "shadow-card hover:shadow-glow-accent " +
        "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(11,20,26,0.06),0_1px_1px_rgba(11,20,26,0.04)] " +
        "hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_8px_24px_rgba(0,168,132,0.28),0_2px_6px_rgba(0,168,132,0.18)] " +
        "transition-[box-shadow,transform] duration-180 ease-veil-soft " +
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none " +
        "wa-tap " +
        (className ?? "")
      }
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner size={16} />
          <span>Working…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Outlined / ghost secondary button. Carries a hairline border and
 * a soft hover lift so it reads as a real surface, not just text.
 */
export function SecondaryButton({
  children,
  className,
  onClick,
  ...props
}: {
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!props.disabled) feedback.tap();
        onClick?.(e);
      }}
      className={
        "w-full h-12 rounded-full border border-line/80 " +
        "bg-surface/60 backdrop-blur-sm " +
        "px-6 font-semibold text-[15px] tracking-tight text-text " +
        "hover:bg-surface hover:border-line " +
        "transition-[background-color,border-color,box-shadow] duration-150 ease-veil-soft " +
        "disabled:opacity-50 disabled:cursor-not-allowed " +
        "wa-tap " +
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

/**
 * Standard text/number/email input.
 *
 * Premium polish: a soft accent halo on focus instead of a hard
 * border swap, plus a subtle inner shadow so the input reads as a
 * recessed surface rather than a flat panel.
 */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl bg-surface border border-line/80 text-text " +
        "placeholder:text-text-faint " +
        "px-4 py-3 outline-none veil-focus-ring " +
        "transition-[box-shadow,border-color] duration-150 ease-veil-soft " +
        "[box-shadow:inset_0_1px_0_rgb(11_20_26/0.02)] " +
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
    <div
      className={
        "w-full text-left rounded-2xl bg-surface " +
        "border border-line/70 shadow-card hover:shadow-card-hover " +
        "px-4 py-3.5 flex items-center justify-between gap-3 " +
        "transition-[box-shadow,background-color,transform] duration-180 ease-veil-soft " +
        "wa-tap wa-tap-soft"
      }
    >
      <div className="min-w-0">
        <div className="font-semibold tracking-tight flex items-center gap-2 text-text">
          <span className="truncate">{title}</span>
          {badge}
        </div>
        {sub && (
          <div className="text-[12.5px] text-text-muted truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      <ChevronRightIcon className="text-text-faint shrink-0" />
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
    neutral: "bg-surface/80 text-text-muted border-line/80",
    accent:
      "bg-wa-green/12 text-wa-green-dark dark:text-wa-green border-wa-green/25",
    warn:
      "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
    danger:
      "bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/25",
    ok:
      "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  };
  return (
    <span
      className={
        "inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] " +
        "px-2 py-[3px] rounded-full border " +
        tones[tone]
      }
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

/**
 * Top app bar.
 *
 * Premium polish: lays a subtle gradient over the brand color so the
 * bar reads as a real material with depth, plus a hairline bottom
 * shadow for separation that doesn't compete with the content below.
 * The back button gets a slightly larger tap target and a softer
 * resting opacity so it disappears into the bar until reached for.
 */
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
        className="text-text-oncolor/85 hover:text-text-oncolor hover:bg-white/10 active:bg-white/15 wa-tap size-9 -ml-1 grid place-items-center rounded-full transition-colors duration-150"
        aria-label="Back"
      >
        <ChevronLeftIcon />
      </Link>
    ) : (
      <button
        onClick={back}
        className="text-text-oncolor/85 hover:text-text-oncolor hover:bg-white/10 active:bg-white/15 wa-tap size-9 -ml-1 grid place-items-center rounded-full transition-colors duration-150"
        aria-label="Back"
      >
        <ChevronLeftIcon />
      </button>
    )
  );
  return (
    <header
      className={
        "h-14 px-3 flex items-center gap-3 sticky top-0 z-20 " +
        "bg-bar text-text-oncolor " +
        "bg-gradient-to-b from-bar to-bar/95 " +
        "[box-shadow:0_1px_0_rgba(11,20,26,0.06),0_4px_12px_rgba(11,20,26,0.06)] " +
        "[backdrop-filter:saturate(140%)_blur(6px)]"
      }
    >
      {BackBtn}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[16px] tracking-tight truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-[11.5px] text-text-oncolor/75 truncate -mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {right && <div className="flex items-center gap-0.5">{right}</div>}
    </header>
  );
}

/**
 * Round avatar bubble with deterministic gradient from peer
 * fingerprint/id.
 *
 * Premium polish: replaces the flat HSL fill with a soft diagonal
 * gradient that gives every avatar a subtle 3D feel. The hue is
 * still deterministic from the seed, so the same person always gets
 * the same avatar. Initials are tightened with a slight letter-
 * spacing pull for a confident, designed look.
 *
 * When `online` is true, a small green presence dot sits at the
 * bottom-right with a ring in the surrounding bg color so it reads
 * as if the dot is sitting *outside* the avatar. This is the
 * universal "alive at a glance" signal in modern messengers.
 */
export function Avatar({
  seed,
  label,
  size = 44,
  className,
  src,
  online,
}: {
  seed: string;
  label?: string;
  size?: number;
  className?: string;
  /** Optional profile photo data URL or http(s) URL. */
  src?: string | null;
  /** When true, shows a small green presence dot. */
  online?: boolean;
}) {
  // Dot scales with avatar so it stays visually consistent at every size.
  const dotSize = Math.max(10, Math.round(size * 0.26));
  const ringWidth = Math.max(2, Math.round(size * 0.05));

  const dot = online ? (
    <span
      aria-hidden
      title="Online"
      style={{
        width: dotSize,
        height: dotSize,
        bottom: 0,
        right: 0,
        boxShadow: `0 0 0 ${ringWidth}px rgb(var(--wa-bg)), 0 0 8px rgb(0 168 132 / 0.5)`,
      }}
      className="absolute rounded-full bg-wa-green"
    />
  ) : null;

  if (src) {
    return (
      <span className="relative inline-block shrink-0">
        <img
          src={src}
          alt=""
          style={{ width: size, height: size }}
          className={
            "rounded-full object-cover select-none " +
            "ring-1 ring-line/50 " +
            (className ?? "")
          }
        />
        {dot}
      </span>
    );
  }
  const initials = (label ?? seed).slice(0, 2).toUpperCase();
  const hue = stringToHue(seed);
  return (
    <span className="relative inline-block shrink-0">
      <div
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, hsl(${hue}deg 55% 62%) 0%, hsl(${(hue + 28) % 360}deg 50% 48%) 100%)`,
          fontSize: size * 0.38,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(11,20,26,0.08)",
        }}
        className={
          "rounded-full flex items-center justify-center text-white " +
          "font-semibold tracking-tight select-none " +
          (className ?? "")
        }
      >
        {initials}
      </div>
      {dot}
    </span>
  );
}

function stringToHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/**
 * A row in the chats / contacts list.
 *
 * Premium polish: larger avatar, refined typography rhythm, hairline
 * dividers that fade at the edges, and a softer hover/active state
 * that feels intentional rather than reactive. When `online` is set
 * the avatar wears a green presence dot and the meta column reveals
 * a subtle "online" pill in place of the timestamp — a quiet "alive
 * at a glance" cue without crowding the row.
 */
export function ChatListRow({
  to,
  onClick,
  seed,
  avatarSrc,
  title,
  subtitle,
  meta,
  badge,
  right,
  online,
}: {
  to?: string;
  onClick?: () => void;
  seed: string;
  avatarSrc?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  right?: ReactNode;
  /** When true, shows a green presence dot on the avatar. */
  online?: boolean;
}) {
  const body = (
    <div
      className={
        "flex items-center gap-3.5 px-4 py-3 " +
        "hover:bg-surface/70 active:bg-elevated/80 " +
        "transition-colors duration-150 ease-veil-soft " +
        "wa-tap wa-tap-soft " +
        "border-b border-line/40 last:border-b-0"
      }
    >
      <Avatar seed={seed} src={avatarSrc} size={48} online={online} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="font-semibold text-[15px] tracking-tight text-text truncate flex-1">
            {title}
          </div>
          {meta && (
            <div className="text-[11px] text-text-faint shrink-0 tabular-nums">
              {meta}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="text-[13.5px] text-text-muted truncate flex-1 leading-snug">
            {subtitle ?? (
              <span className="italic text-text-faint">No messages yet</span>
            )}
          </div>
          {online && (
            <span
              title="Online now"
              className={
                "shrink-0 inline-flex items-center gap-1 " +
                "text-[10.5px] font-semibold uppercase tracking-[0.06em] " +
                "text-wa-green"
              }
            >
              <span className="size-1.5 rounded-full bg-wa-green" />
              <span>online</span>
            </span>
          )}
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

/**
 * Chat bubble.
 *
 * Premium polish: slightly larger radius, refined padding rhythm,
 * a soft layered shadow (ambient + tight contact) that gives the
 * bubble a sense of resting on the chat surface, and a tighter
 * timestamp row that reads as metadata, not as part of the message.
 */
export function MessageBubble({
  direction,
  children,
  time,
  status,
}: {
  direction: "in" | "out";
  children: ReactNode;
  time?: string;
  status?: "pending" | "sent" | "delivered" | "failed" | "received" | "read";
}) {
  const isOut = direction === "out";
  return (
    <div
      className={
        "max-w-[78%] px-3 py-2 rounded-[18px] text-[14.5px] leading-[1.4] " +
        "[box-shadow:0_1px_2px_rgba(11,20,26,0.08),0_0.5px_0.5px_rgba(11,20,26,0.04)] " +
        (isOut
          ? "self-end bg-wa-bubble-out text-text rounded-tr-[6px] veil-bubble-out"
          : "self-start bg-wa-bubble-in text-text rounded-tl-[6px] veil-bubble-in")
      }
    >
      <div className="whitespace-pre-wrap break-words">{children}</div>
      <div
        className={
          "flex items-center gap-1 justify-end mt-1 text-[10.5px] tabular-nums " +
          (isOut ? "text-text/55" : "text-text-muted/80")
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
  status: "pending" | "sent" | "delivered" | "failed" | "received" | "read";
}) {
  if (status === "pending")
    return <span className="opacity-70 text-[10px]" aria-label="Sending">⏱</span>;
  if (status === "failed")
    return <span className="text-red-500 text-[10px]" aria-label="Failed">!</span>;
  if (status === "sent")
    return <SingleTickIcon className="text-wa-tick" />;
  if (status === "delivered")
    return <DoubleTickIcon className="text-wa-tick" />;
  if (status === "read")
    return <ReadDoubleTickIcon />;
  return null;
}

/**
 * Sticky bottom message-composer bar.
 *
 * Premium polish: a frosted backdrop with a hairline top border so
 * the composer feels like a separate plane floating over the chat,
 * a more generous pill-shaped textarea wrapper, and a send button
 * with a soft accent glow when armed.
 */
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
  const armed = !sending && !!value.trim();
  return (
    <div
      className={
        "sticky bottom-0 px-2.5 pt-2 pb-2.5 flex items-end gap-2 " +
        "bg-bg/85 [backdrop-filter:saturate(160%)_blur(12px)] " +
        "border-t border-line/50"
      }
    >
      <div
        className={
          "flex-1 bg-surface/90 rounded-[22px] px-4 py-2 flex items-end " +
          "border border-line/60 " +
          "[box-shadow:inset_0_1px_0_rgb(11_20_26/0.02),0_1px_2px_rgb(11_20_26/0.04)] " +
          "focus-within:border-wa-green/50 focus-within:[box-shadow:0_0_0_3px_rgb(0_168_132/0.15),0_1px_2px_rgb(11_20_26/0.04)] " +
          "transition-[box-shadow,border-color] duration-150 ease-veil-soft"
        }
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (armed) onSend();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="w-full bg-transparent text-text placeholder:text-text-faint resize-none outline-none max-h-32 leading-snug"
          style={{ minHeight: "24px" }}
        />
      </div>
      <button
        onClick={() => {
          if (!armed) return;
          // We deliberately don't fire `feedback.press()` here —
          // `sendChatMessage` plays the proper rising 3-note "send"
          // motif once the encrypted envelope actually leaves the
          // device, which is the moment the user wants confirmed.
          onSend();
        }}
        disabled={!armed}
        className={
          "size-12 rounded-full text-text-oncolor flex items-center justify-center shrink-0 wa-tap " +
          "bg-gradient-to-b from-wa-green to-wa-green-dark " +
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(11,20,26,0.08)] " +
          (armed
            ? "hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_8px_22px_rgba(0,168,132,0.30)] "
            : "opacity-55 cursor-not-allowed ") +
          "transition-[box-shadow,opacity] duration-180 ease-veil-soft"
        }
        aria-label="Send"
      >
        <SendIcon />
      </button>
    </div>
  );
}

/**
 * Floating action button (FAB).
 *
 * Premium polish: rounded-full (more iOS-like than rounded-2xl),
 * accent gradient, layered ambient shadow + soft accent glow on
 * hover, and a slight lift on hover that anchors the button as a
 * floating element.
 */
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
    "fixed bottom-20 right-5 sm:bottom-6 size-14 rounded-full text-text-oncolor " +
    "bg-gradient-to-b from-wa-green to-wa-green-dark " +
    "flex items-center justify-center wa-tap z-30 " +
    "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_10px_28px_rgba(0,168,132,0.30),0_4px_10px_rgba(11,20,26,0.10)] " +
    "hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),0_14px_36px_rgba(0,168,132,0.38),0_6px_14px_rgba(11,20,26,0.12)] " +
    "hover:-translate-y-[1px] " +
    "transition-[box-shadow,transform] duration-200 ease-veil-soft";
  if (to)
    return (
      <Link to={to} aria-label={label} className={cls} onClick={() => feedback.tap()}>
        {children}
      </Link>
    );
  return (
    <button
      onClick={() => {
        feedback.tap();
        onClick?.();
      }}
      aria-label={label}
      className={cls}
    >
      {children}
    </button>
  );
}

/**
 * Round icon button (used inside app bars).
 *
 * Premium polish: a quiet hover wash and a slightly more pronounced
 * active state that match the bar's material.
 */
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
      onClick={(e) => {
        feedback.tap();
        onClick?.();
        // Stop synthetic propagation chain from triggering twice.
        e.stopPropagation();
      }}
      aria-label={label}
      className={
        "size-10 rounded-full flex items-center justify-center wa-tap " +
        "hover:bg-white/12 active:bg-white/18 " +
        "transition-colors duration-150 " +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

/**
 * Empty-state placeholder.
 *
 * Premium polish: refined type hierarchy with a measured display
 * size, softer surrounding muted text, and a more breathable layout.
 */
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
    <div className="flex flex-col items-center justify-center text-center gap-3 py-20 px-6 text-text-muted animate-fade-in">
      {icon && (
        <div className="text-text-faint mb-1 [&>svg]:size-12">{icon}</div>
      )}
      <div className="text-text font-semibold text-[19px] tracking-tight">
        {title}
      </div>
      {message && (
        <div className="text-[13.5px] max-w-sm leading-relaxed text-text-muted">
          {message}
        </div>
      )}
      {action && <div className="mt-3 w-full max-w-xs">{action}</div>}
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

/**
 * Settings list row (icon · label · sub · right).
 *
 * Premium polish: a subtle accent-tinted icon container, refined
 * type rhythm, and a softer divider treatment for a more curated
 * settings list feel.
 */
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
    <div
      className={
        "flex items-center gap-3.5 px-4 py-3.5 " +
        "hover:bg-surface/70 active:bg-elevated/80 " +
        "transition-colors duration-150 ease-veil-soft wa-tap wa-tap-soft"
      }
    >
      {icon && (
        <div
          className={
            "size-9 rounded-xl shrink-0 grid place-items-center " +
            (danger
              ? "bg-red-500/10 text-red-500"
              : "bg-surface/80 text-text-muted border border-line/50")
          }
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={
            "font-medium tracking-tight text-[15px] " +
            (danger ? "text-red-500" : "text-text")
          }
        >
          {label}
        </div>
        {sub && (
          <div className="text-[12.5px] text-text-muted truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      {right}
    </div>
  );
  const wrapCls =
    "block border-b border-line/40 last:border-b-0";
  if (to) return <Link to={to} className={wrapCls}>{body}</Link>;
  if (onClick)
    return (
      <button onClick={onClick} className={wrapCls + " w-full text-left"}>
        {body}
      </button>
    );
  return <div className={wrapCls}>{body}</div>;
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

/**
 * Double-tick shown when the peer has read the message.
 * Uses a pink-to-magenta gradient: rgb(247,52,130) → rgb(220,40,180).
 */
function ReadDoubleTickIcon() {
  return (
    <svg
      viewBox="0 0 18 12"
      className="w-4 h-3"
      fill="none"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="veil-read-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(247,52,130)" />
          <stop offset="100%" stopColor="rgb(220,40,180)" />
        </linearGradient>
      </defs>
      <polyline points="1 6.5 5 10.5 12 1.5" stroke="url(#veil-read-grad)" />
      <polyline points="6.5 6.5 10 10 17 1" stroke="url(#veil-read-grad)" />
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

export function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

export function SmileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-2-4V5H7v8z" />
    </svg>
  );
}

export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ForwardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function EditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function BellOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
      <path d="M5 16l.6 1.6L7 18l-1.4.4L5 20l-.6-1.6L3 18l1.4-.4z" />
    </svg>
  );
}

export function PollIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-5 h-5 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="20" x2="6" y2="11" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="14" />
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

export function UnlockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-4 h-4 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.45-2" />
    </svg>
  );
}

export function TimerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"w-4 h-4 " + (className ?? "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 2h6" />
    </svg>
  );
}
