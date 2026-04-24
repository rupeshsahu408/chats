import { useState, useCallback } from "react";
import { feedback } from "../lib/feedback";

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
    (char: string) => {
      feedback.tap();
      const out =
        mode === "letters" && shift !== "off" ? char.toUpperCase() : char;
      onChar(out);
      // One-shot shift resets after a single character.
      if (mode === "letters" && shift === "on") setShift("off");
    },
    [mode, shift, onChar],
  );

  const handleShift = () => {
    feedback.tap();
    setShift((s) => (s === "off" ? "on" : s === "on" ? "lock" : "off"));
  };

  const handleBackspace = () => {
    feedback.tap();
    onBackspace();
  };

  const handleSubmit = () => {
    feedback.tap();
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
      className="bg-elevated border-t border-line/60 select-none"
      role="group"
      aria-label="Veil private keyboard"
    >
      {/* Privacy badge — always visible so the user *sees* the guarantee */}
      <div className="flex items-center justify-between px-3 pt-1.5 pb-1 text-[10.5px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <LockMiniIcon />
          <span>Private input · stays on this device</span>
        </span>
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={() => {
              feedback.tap();
              onClose();
            }}
            className="size-6 rounded-full hover:bg-text/10 grid place-items-center text-text-muted hover:text-text wa-tap"
            aria-label="Hide keyboard"
            title="Hide keyboard"
          >
            <ChevronDownMini />
          </button>
        )}
      </div>

      <div className="px-1.5 pb-2 flex flex-col gap-1.5">
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
        <div className="flex items-stretch gap-1.5">
          <ModeKey
            label={mode === "letters" ? "123" : mode === "numbers" ? "abc" : "abc"}
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
  onTap: (char: string) => void;
  onShift: () => void;
  onBackspace: () => void;
}) {
  // Middle row in letter mode is indented by half a key — the classic
  // "asdfghjkl" stagger, which gives the layout its phone keyboard feel.
  const indent =
    mode === "letters" && rowIndex === 1 ? "px-[6%]" : "px-0";

  return (
    <div className={`flex items-stretch gap-1 ${indent}`}>
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
        <KeyCap key={k} char={k} display={renderChar(k, mode, shift)} onTap={onTap} />
      ))}
      {(isLastLetterRow || isLastSymbolRow) && (
        <ModifierKey label="⌫" onClick={onBackspace} wide />
      )}
    </div>
  );
}

function renderChar(char: string, mode: KeyboardMode, shift: ShiftState): string {
  if (mode !== "letters") return char;
  return shift === "off" ? char : char.toUpperCase();
}

function KeyCap({
  char,
  display,
  onTap,
}: {
  char: string;
  display: string;
  onTap: (char: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTap(char)}
      className={
        "flex-1 min-w-0 h-11 rounded-lg bg-surface text-text text-[17px] font-medium " +
        "shadow-bubble border border-line/40 active:bg-elevated wa-tap"
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-11 rounded-lg text-[17px] font-medium border shadow-bubble wa-tap " +
        (wide ? "px-3 min-w-[44px] " : "px-2 ") +
        (locked
          ? "bg-wa-green text-text-oncolor border-wa-green "
          : active
            ? "bg-wa-green-soft/60 text-text border-wa-green/40 "
            : "bg-elevated text-text border-line/60 ")
      }
      aria-pressed={active}
    >
      {label}
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
      onClick={onClick}
      className={
        "h-11 rounded-lg bg-elevated text-text text-[14px] font-semibold border border-line/60 shadow-bubble wa-tap " +
        (wide ? "px-3 min-w-[52px]" : "px-2")
      }
    >
      {label}
    </button>
  );
}

function SpaceKey({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 h-11 rounded-lg bg-surface text-text-muted text-[13px] border border-line/40 shadow-bubble wa-tap"
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
      onClick={onClick}
      className="h-11 px-4 min-w-[64px] rounded-lg bg-wa-green text-text-oncolor text-[13px] font-semibold shadow-bubble wa-tap"
      aria-label="Send"
    >
      send
    </button>
  );
}

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
