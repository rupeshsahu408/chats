import { useEffect, useState } from "react";
import {
  MOOD_PRESETS,
  broadcastMood,
  clearMood,
  moodCountdownLabel,
  getActiveMyMood,
} from "../lib/moodSync";
import type { UnlockedIdentity } from "../lib/signal/session";
import { feedback } from "../lib/feedback";

/**
 * Sheet for setting "what you're up to" — a small mood + free-form
 * status that broadcasts to every 1:1 contact and auto-expires.
 *
 * Inspired by WhatsApp's "About" but ephemeral, with a TTL picker
 * so "in a meeting" actually clears itself when the meeting ends.
 *
 * No server-side state — `lib/moodSync` fans out an encrypted
 * MoodEnvelope to each connection.
 */
export function MoodSheet({
  identity,
  onClose,
}: {
  identity: UnlockedIdentity;
  onClose: () => void;
}) {
  const [emoji, setEmoji] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [ttlHours, setTtlHours] = useState<number>(4);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<{
    emoji: string;
    text: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    getActiveMyMood().then((m) => {
      if (!alive) return;
      setActive(m);
      if (m) {
        setEmoji(m.emoji);
        setText(m.text);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  function pickPreset(p: { emoji: string; text: string; ttlHours: number }) {
    setEmoji(p.emoji);
    setText(p.text);
    setTtlHours(p.ttlHours);
  }

  async function commit() {
    if (!emoji.trim() && !text.trim()) return;
    setBusy(true);
    try {
      const expiresAt = await broadcastMood(identity, {
        emoji,
        text,
        ttlMs: Math.max(1, ttlHours) * 60 * 60 * 1000,
      });
      setActive({ emoji, text: text.trim(), expiresAt });
      feedback.success();
      onClose();
    } catch (err) {
      console.error("Mood broadcast failed", err);
      feedback.error();
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await clearMood(identity);
      setActive(null);
      setEmoji("");
      setText("");
      feedback.success();
      onClose();
    } catch (err) {
      console.error("Clear mood failed", err);
      feedback.error();
    } finally {
      setBusy(false);
    }
  }

  const ttlOptions = [
    { hours: 1,  label: "1 hour" },
    { hours: 2,  label: "2 hours" },
    { hours: 4,  label: "4 hours" },
    { hours: 8,  label: "8 hours" },
    { hours: 24, label: "1 day" },
  ];

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-panel w-full sm:max-w-md md:max-w-lg rounded-t-2xl sm:rounded-2xl border border-line overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 border-b border-line/60">
          <div className="font-semibold text-text">What's up?</div>
          <div className="text-xs text-text-muted">
            Share a quick status. It auto-clears when the timer ends.
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-4">
          {/* Active mood banner */}
          {active && (
            <div className="rounded-xl border border-wa-green/40 bg-wa-green-soft/30 px-3 py-2 flex items-center gap-2">
              <span className="text-lg leading-none">{active.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {active.text || "Status set"}
                </div>
                <div className="text-[11px] text-text-muted">
                  {moodCountdownLabel(active.expiresAt)}
                </div>
              </div>
              <button
                onClick={handleClear}
                disabled={busy}
                className="text-[11px] px-2.5 py-1 rounded-full border border-line bg-surface text-text-muted hover:text-text wa-tap disabled:opacity-60"
              >
                Clear now
              </button>
            </div>
          )}

          {/* Free-form input */}
          <section className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">
              Custom status
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                placeholder="🙂"
                aria-label="Emoji"
                className="w-14 text-center text-lg rounded-lg border border-line bg-surface px-2 py-2 focus:outline-none focus:border-wa-green"
              />
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 80))}
                placeholder="padh raha hoon"
                aria-label="Status text"
                className="flex-1 min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:border-wa-green"
              />
            </div>
            <div className="text-[10px] text-text-faint text-right">
              {text.length}/80
            </div>
          </section>

          {/* Presets */}
          <section className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">
              Quick picks
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MOOD_PRESETS.map((p) => {
                const isActive =
                  emoji === p.emoji && text.trim() === p.text;
                return (
                  <button
                    key={p.text}
                    onClick={() => pickPreset(p)}
                    aria-pressed={isActive}
                    className={
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 border wa-tap transition text-left " +
                      (isActive
                        ? "border-wa-green bg-wa-green-soft/30 text-text"
                        : "border-line bg-surface text-text hover:bg-elevated")
                    }
                  >
                    <span className="text-base leading-none shrink-0">
                      {p.emoji}
                    </span>
                    <span className="text-xs truncate flex-1 min-w-0">
                      {p.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* TTL */}
          <section className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">
              Clear after
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ttlOptions.map((opt) => {
                const isActive = ttlHours === opt.hours;
                return (
                  <button
                    key={opt.hours}
                    onClick={() => setTtlHours(opt.hours)}
                    aria-pressed={isActive}
                    className={
                      "text-xs px-3 py-1.5 rounded-full border wa-tap transition " +
                      (isActive
                        ? "border-wa-green bg-wa-green-soft/40 text-text font-medium"
                        : "border-line bg-surface text-text-muted hover:text-text")
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-line/60 flex justify-between items-center gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-sm px-3 py-1.5 rounded-full border border-line bg-surface text-text-muted hover:text-text wa-tap disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={busy || (!emoji.trim() && !text.trim())}
            className="text-sm font-medium px-4 py-1.5 rounded-full bg-wa-green text-text-oncolor wa-tap disabled:opacity-60"
          >
            {busy ? "Sending…" : active ? "Update mood" : "Share mood"}
          </button>
        </div>
      </div>
    </div>
  );
}
