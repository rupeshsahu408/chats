import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Tiny offline emoji picker. Rendered as a popover anchored to the
 * caller; the parent positions and gates visibility. Two flavours:
 *
 *  - `mode="composer"` shows a tabbed grid (~200 emojis) for inserting
 *    into the message draft.
 *  - `mode="reactions"` shows a single horizontal strip of WhatsApp's
 *    six quick reactions plus a "+" that flips to the full grid.
 *
 * No external deps so we don't bloat the bundle; the curated lists
 * cover the long tail well enough for chat use.
 */

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

const CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","🥹","😅","😂","🤣","😊",
      "😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙",
      "😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎",
      "🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁",
      "☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠",
      "😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥",
      "😓","🫣","🤗","🫡","🤔","🫢","🤭","🤫","🤥","😶",
      "😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱",
      "😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷",
      "🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍","👎","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘",
      "🤙","🫵","🫱","🫲","🫳","🫴","👈","👉","👆","🖕",
      "👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🫶",
      "🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂",
    ],
  },
  {
    label: "Animals",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
      "🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆",
      "🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋",
      "🐌","🐞","🐢","🐍","🦖","🐙","🦀","🐠","🐟","🐬",
    ],
  },
  {
    label: "Food",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐",
      "🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦",
      "🌶️","🫑","🌽","🥕","🥔","🍠","🥐","🥯","🍞","🧀",
      "🍗","🍖","🍔","🍟","🍕","🌭","🌮","🌯","🥗","🍣",
      "🍱","🍜","🍝","🍰","🎂","🍩","🍪","🍫","🍿","🍺",
    ],
  },
  {
    label: "Activities",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱",
      "🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🏹",
      "🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌",
      "🎿","⛷️","🏂","🏋️","🤼","🤸","🤺","⛹️","🤾","🏌️",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶",
      "💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧",
      "🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧲","🔫",
      "💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "✅","❌","⭕","🚫","💯","🔥","⭐","🌟","✨","⚡",
      "☀️","🌈","☁️","❄️","🌊","🎉","🎊","🎁","🎈","🪄",
      "❓","❗","‼️","⁉️","💭","💬","🗯️","🔔","🔕","🎵",
      "🎶","♻️","🆕","🆗","🆙","🆒","🆓","🆖","🔝","🔚",
    ],
  },
];

/**
 * Strip-only picker used for reactions. Renders the quick row plus a
 * "+" that swaps to the full grid in-place.
 */
export function ReactionPicker({
  value,
  onPick,
  onClose,
}: {
  /** Currently active reaction (mine), to highlight; empty string = none. */
  value: string;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(ref, onClose);

  if (expanded) {
    return (
      <div ref={ref}>
        <EmojiGrid
          onPick={(e) => {
            onPick(e === value ? "" : e);
            onClose();
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="bg-surface border border-line rounded-full shadow-sheet flex items-center gap-1 px-2 py-1.5"
      role="toolbar"
      aria-label="React with emoji"
    >
      {QUICK_REACTIONS.map((e) => {
        const active = e === value;
        return (
          <button
            key={e}
            type="button"
            onClick={() => {
              onPick(active ? "" : e);
              onClose();
            }}
            className={
              "size-9 rounded-full text-xl flex items-center justify-center hover:bg-white/10 transition " +
              (active ? "bg-wa-green/30" : "")
            }
            aria-label={`React ${e}`}
            aria-pressed={active}
          >
            {e}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="size-9 rounded-full text-text-muted text-lg flex items-center justify-center hover:bg-white/10 transition"
        aria-label="More emojis"
      >
        +
      </button>
    </div>
  );
}

/**
 * Composer-side full picker. Mounts a tabbed grid; consumer calls
 * `onPick(emoji)` to append to draft. `onClose` triggers on outside
 * click or Escape.
 */
export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(ref, onClose);
  return (
    <div
      ref={ref}
      className="bg-surface border border-line rounded-2xl shadow-sheet w-[320px] sm:w-[360px] md:w-[420px] max-w-[90vw]"
      role="dialog"
      aria-label="Emoji picker"
    >
      <EmojiGrid onPick={onPick} />
    </div>
  );
}

function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  const [tab, setTab] = useState(0);
  const cat = CATEGORIES[tab]!;
  const tabs = useMemo(() => CATEGORIES.map((c) => c.label), []);
  return (
    <div>
      <div className="flex gap-1 px-2 pt-2 overflow-x-auto no-scrollbar text-xs">
        {tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className={
              "px-2 py-1 rounded-full whitespace-nowrap transition " +
              (i === tab
                ? "bg-wa-green text-text-oncolor"
                : "text-text-muted hover:bg-white/5")
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-9 md:grid-cols-10 gap-0.5 p-2 max-h-56 md:max-h-72 overflow-y-auto">
        {cat.emojis.map((e, idx) => (
          <button
            key={`${e}-${idx}`}
            type="button"
            onClick={() => onPick(e)}
            className="size-8 rounded-md text-xl flex items-center justify-center hover:bg-white/10 transition"
            aria-label={`Insert ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function useDismissOnOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    function onDoc(ev: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      if (ev.target instanceof Node && el.contains(ev.target)) return;
      onClose();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    // Defer one tick so the click that opened us doesn't immediately
    // close us via the same document handler.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("touchstart", onDoc, { passive: true });
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose]);
}
