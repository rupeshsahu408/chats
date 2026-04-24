import { useState, useCallback, useRef, useEffect } from "react";
import { feedback } from "../lib/feedback";
import { hapticTap } from "../lib/haptics";

/**
 * Veil's in-app on-screen keyboard.
 *
 * A self-contained QWERTY keyboard panel that the chat composer can
 * render in place of the OS soft keyboard. Every keystroke is
 * dispatched via callbacks straight into local React state — nothing
 * touches a third-party IME. That removes Gboard/SwiftKey-style
 * keystroke logging and learned-words cloud sync from the threat
 * model on mobile.
 *
 * The keyboard is intentionally:
 *   - Stateless about the draft (the parent owns the textarea).
 *   - Layout-only: no autocomplete, no swipe-to-type, no learned
 *     dictionary. Privacy is the feature.
 *   - Three modes (letters/numbers/symbols) plus a shift key with
 *     three states: off, on (one-shot), and locked.
 *
 * Interaction polish:
 *   - Keys fire on pointerdown for zero-perceived-latency response.
 *   - Holding a character key (or backspace) repeats smoothly after
 *     a short initial delay, just like a native keyboard.
 *   - Pointer-capture means a held key keeps repeating even if the
 *     finger drifts off its bounds — release anywhere ends the repeat.
 */
export type KeyboardMode = "letters" | "numbers" | "symbols";
export type ShiftState = "off" | "on" | "lock";

const ROW_LETTERS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const ROW_NUMBERS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
  [".", ",", "?", "!", "'"],
];

const ROW_SYMBOLS: string[][] = [
  ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
  ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"],
  [".", ",", "?", "!", "'"],
];

/** Press-and-hold timing — tuned to feel like iOS/Android natives. */
const REPEAT_INITIAL_DELAY_MS = 380;
const REPEAT_INTERVAL_MS = 45;

export function VeilKeyboard({
  onChar,
  onBackspace,
  onSubmit,
  onClose,
  showCloseButton = true,
}: {
  /** Called with the character the user just pressed. */
  onChar: (char: string) => void;
  /** Called when the user presses backspace. */
  onBackspace: () => void;
  /**
   * Called when the user presses the submit/return key. Parents can
   * decide whether to send the message or just insert a newline.
   */
  onSubmit: () => void;
  /** Optional — when set, a ⌄ button collapses the keyboard. */
  onClose?: () => void;
  showCloseButton?: boolean;
}) {
  const [mode, setMode] = useState<KeyboardMode>("letters");
  const [shift, setShift] = useState<ShiftState>("on"); // start capitalised

  const tap = useCallback(
    (char: string, opts: { isRepeat?: boolean } = {}) => {
      // Suppress full feedback on repeats so a held key doesn't
      // machine-gun the speakers — light haptic only.
      if (opts.isRepeat) {
        hapticTap();
      } else {
        feedback.tap();
      }
      const out =
        mode === "letters" && shift !== "off" ? char.toUpperCase() : char;
      onChar(out);
      // One-shot shift resets after a single character (only on the
      // initial press — a held key shouldn't keep flipping shift back).
      if (!opts.isRepeat && mode === "letters" && shift === "on") {
        setShift("off");
      }
    },
    [mode, shift, onChar],
  );

  const handleShift = () => {
    feedback.tap();
    setShift((s) => (s === "off" ? "on" : s === "on" ? "lock" : "off"));
  };

  const handleBackspace = useCallback(
    (opts: { isRepeat?: boolean } = {}) => {
      if (opts.isRepeat) hapticTap();
      else feedback.tap();
      onBackspace();
    },
    [onBackspace],
  );

  const handleSubmit = () => {
    feedback.press();
    onSubmit();
  };

  const switchMode = (next: KeyboardMode) => {
    feedback.tap();
    setMode(next);
  };

  const rows =
    mode === "letters"
      ? ROW_LETTERS
      : mode === "numbers"
        ? ROW_NUMBERS
        : ROW_SYMBOLS;

  return (
    <div
      className={
        "select-none border-t border-line/60 " +
        "bg-gradient-to-b from-elevated/95 to-elevated " +
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      }
      role="group"
      aria-label="Veil private keyboard"
    >
      {/* Privacy badge — always visible so the user *sees* the guarantee */}
      <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5 text-[10.5px] text-text-muted">
        <span className="inline-flex items-center gap-1.5 tracking-wide">
          <LockMiniIcon />
          <span className="font-medium">
            Private input <span className="opacity-60">·</span> stays on this device
          </span>
        </span>
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={() => {
              feedback.tap();
              onClose();
            }}
            className={
              "size-7 rounded-full grid place-items-center text-text-muted " +
              "hover:text-text hover:bg-text/10 active:bg-text/15 " +
              "transition-colors duration-150 wa-tap"
            }
            aria-label="Hide keyboard"
            title="Hide keyboard"
          >
            <ChevronDownMini />
          </button>
        )}
      </div>

      <div className="px-2 pb-2.5 pt-0.5 flex flex-col gap-[7px]">
        {rows.map((row, idx) => (
          <KeyboardRow
            key={idx}
            keys={row}
            rowIndex={idx}
            isLastLetterRow={mode === "letters" && idx === 2}
            isLastSymbolRow={mode !== "letters" && idx === 2}
            shift={shift}
            mode={mode}
            onTap={tap}
            onShift={handleShift}
            onBackspace={handleBackspace}
          />
        ))}

        {/* Bottom bar: mode switch · space · return */}
        <div className="flex items-stretch gap-[5px] mt-0.5">
          <ModeKey
            label={mode === "letters" ? "123" : "ABC"}
            onClick={() =>
              switchMode(mode === "letters" ? "numbers" : "letters")
            }
            wide
          />
          {mode !== "letters" && (
            <ModeKey
              label={mode === "numbers" ? "#+=" : "123"}
              onClick={() =>
                switchMode(mode === "numbers" ? "symbols" : "numbers")
              }
              wide
            />
          )}
          <SpaceKey onClick={() => tap(" ")} />
          <ReturnKey onClick={handleSubmit} />
        </div>
      </div>
    </div>
  );
}

/* ───────────── Internals ───────────── */

/**
 * Press-and-hold helper. Returns a set of pointer handlers that:
 *   1. Fire `onPress()` immediately on pointerdown (no click latency).
 *   2. After REPEAT_INITIAL_DELAY_MS, start firing `onRepeat()` every
 *      REPEAT_INTERVAL_MS until the pointer is released or cancelled.
 *   3. Use pointer capture so the repeat keeps going even if the
 *      finger drifts off the key — release anywhere ends it.
 *
 * Calling preventDefault on pointerdown stops the button from
 * stealing focus from the chat textarea, which is what makes
 * cursor-aware insertion work in the parent.
 */
function useRepeatable(onPress: () => void, onRepeat: () => void) {
  const pressRef = useRef(onPress);
  const repeatRef = useRef(onRepeat);
  pressRef.current = onPress;
  repeatRef.current = onRepeat;

  const delayId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (delayId.current !== null) {
      clearTimeout(delayId.current);
      delayId.current = null;
    }
    if (intervalId.current !== null) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
  }, []);

  // Make sure timers don't outlive the component.
  useEffect(() => stop, [stop]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Only main-button mouse / touch / pen.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); // keep focus on the chat textarea
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
      pressRef.current();
      stop();
      delayId.current = setTimeout(() => {
        intervalId.current = setInterval(() => {
          repeatRef.current();
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_INITIAL_DELAY_MS);
    },
    [stop],
  );

  return {
    onPointerDown,
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    // We've already handled the press in pointerdown — swallow the
    // synthetic click so nothing fires twice on tap.
    onClick: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function KeyboardRow({
  keys,
  rowIndex,
  isLastLetterRow,
  isLastSymbolRow,
  shift,
  mode,
  onTap,
  onShift,
  onBackspace,
}: {
  keys: string[];
  rowIndex: number;
  isLastLetterRow: boolean;
  isLastSymbolRow: boolean;
  shift: ShiftState;
  mode: KeyboardMode;
  onTap: (char: string, opts?: { isRepeat?: boolean }) => void;
  onShift: () => void;
  onBackspace: (opts?: { isRepeat?: boolean }) => void;
}) {
  // Middle row in letter mode is indented by half a key — the classic
  // "asdfghjkl" stagger, which gives the layout its phone keyboard feel.
  const indent =
    mode === "letters" && rowIndex === 1 ? "px-[5.5%]" : "px-0";

  return (
    <div className={`flex items-stretch gap-[5px] ${indent}`}>
      {isLastLetterRow && (
        <ModifierKey
          label={shift === "lock" ? "⇪" : "⇧"}
          onClick={onShift}
          active={shift !== "off"}
          locked={shift === "lock"}
          wide
        />
      )}
      {keys.map((k) => (
        <KeyCap
          key={k}
          char={k}
          display={renderChar(k, mode, shift)}
          onTap={onTap}
        />
      ))}
      {(isLastLetterRow || isLastSymbolRow) && (
        <BackspaceKey onBackspace={onBackspace} />
      )}
    </div>
  );
}

function renderChar(char: string, mode: KeyboardMode, shift: ShiftState): string {
  if (mode !== "letters") return char;
  return shift === "off" ? char : char.toUpperCase();
}

/* ───────────── Visual key primitives ───────────── */

/**
 * Shared base classes for every key cap. A subtle vertical gradient
 * + soft drop shadow + 1px highlight on the top edge gives the keys
 * a tactile, slightly raised feel without looking skeuomorphic.
 */
const KEY_BASE =
  "relative h-[44px] rounded-[10px] " +
  "border border-line/40 " +
  "shadow-[0_1px_0_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] " +
  "transition-[transform,background-color,box-shadow] duration-100 ease-out " +
  "active:scale-[0.96] active:shadow-[0_0_0_rgba(0,0,0,0),inset_0_1px_2px_rgba(0,0,0,0.25)] " +
  "wa-tap select-none touch-manipulation";

function KeyCap({
  char,
  display,
  onTap,
}: {
  char: string;
  display: string;
  onTap: (char: string, opts?: { isRepeat?: boolean }) => void;
}) {
  const handlers = useRepeatable(
    () => onTap(char),
    () => onTap(char, { isRepeat: true }),
  );
  return (
    <button
      type="button"
      {...handlers}
      className={
        KEY_BASE +
        " flex-1 min-w-0 " +
        "bg-gradient-to-b from-surface to-surface/80 " +
        "text-text text-[18px] font-medium tracking-tight " +
        "active:bg-elevated"
      }
      aria-label={display}
    >
      {display}
    </button>
  );
}

function ModifierKey({
  label,
  onClick,
  active,
  locked,
  wide,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  locked?: boolean;
  wide?: boolean;
}) {
  // Modifier keys (shift) are tap-only — no repeat behavior.
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        KEY_BASE +
        " text-[16px] font-semibold " +
        (wide ? "px-3 min-w-[46px] " : "px-2 ") +
        (locked
          ? "bg-gradient-to-b from-wa-green to-wa-green/90 text-text-oncolor border-wa-green "
          : active
            ? "bg-gradient-to-b from-wa-green-soft/70 to-wa-green-soft/50 text-text border-wa-green/40 "
            : "bg-gradient-to-b from-elevated to-elevated/70 text-text border-line/50 ")
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function BackspaceKey({
  onBackspace,
}: {
  onBackspace: (opts?: { isRepeat?: boolean }) => void;
}) {
  const handlers = useRepeatable(
    () => onBackspace(),
    () => onBackspace({ isRepeat: true }),
  );
  return (
    <button
      type="button"
      {...handlers}
      className={
        KEY_BASE +
        " grid place-items-center px-3 min-w-[46px] " +
        "bg-gradient-to-b from-elevated to-elevated/70 text-text border-line/50"
      }
      aria-label="Backspace"
    >
      <BackspaceIcon />
    </button>
  );
}

function ModeKey({
  label,
  onClick,
  wide,
}: {
  label: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        KEY_BASE +
        " text-[13.5px] font-semibold tracking-wide uppercase " +
        "bg-gradient-to-b from-elevated to-elevated/70 text-text " +
        (wide ? "px-3 min-w-[54px]" : "px-2")
      }
    >
      {label}
    </button>
  );
}

function SpaceKey({ onClick }: { onClick: () => void }) {
  // Space supports repeat too — useful when padding things out.
  const handlers = useRepeatable(onClick, onClick);
  return (
    <button
      type="button"
      {...handlers}
      className={
        KEY_BASE +
        " flex-1 grid place-items-center " +
        "bg-gradient-to-b from-surface to-surface/80 " +
        "text-text-muted text-[12px] tracking-[0.18em] uppercase font-medium"
      }
      aria-label="Space"
    >
      space
    </button>
  );
}

function ReturnKey({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        KEY_BASE +
        " grid place-items-center px-4 min-w-[68px] " +
        "bg-gradient-to-b from-wa-green to-wa-green-dark " +
        "text-text-oncolor " +
        "border-wa-green/60 " +
        "shadow-[0_1px_0_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.18)]"
      }
      aria-label="Send"
    >
      <SendArrowIcon />
    </button>
  );
}

/* ───────────── Icons ───────────── */

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function ChevronDownMini() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function BackspaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M21 5H9.5a2 2 0 0 0-1.5.7L3 12l5 6.3A2 2 0 0 0 9.5 19H21a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path d="M18 9l-6 6" />
      <path d="M12 9l6 6" />
    </svg>
  );
}

function SendArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-[18px] -translate-x-[1px]"
      aria-hidden="true"
    >
      <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.18l2.1 7.04a1 1 0 0 0 .83.71l9.5 1.18c.34.04.34.54 0 .58l-9.5 1.18a1 1 0 0 0-.83.71l-2.1 7.04a1 1 0 0 0 1.39 1.18z" />
    </svg>
  );
}
