import { useEffect, useState } from "react";
import {
  ACCENT_SWATCHES,
  SOUND_PACKS,
  getAccentSwatch,
} from "../lib/chatPersonality";
import { getChatPref, setChatPref, type ChatPrefRecord } from "../lib/db";
import { feedback } from "../lib/feedback";

/**
 * Per-contact "Customize chat" sheet.
 *
 * Two pickers in one panel:
 *   • Accent — tints outgoing bubbles + send button inside this chat.
 *   • Notification sound — pack played on inbound messages from this peer.
 *
 * Both fall back to "Default" (the global theme + Veil's standard motif)
 * when set to that value, which lets the user opt out cleanly.
 */
export function ChatPersonalitySheet({
  peerId,
  chatLabel,
  onClose,
}: {
  peerId: string;
  chatLabel: string;
  onClose: () => void;
}) {
  const [pref, setPref] = useState<ChatPrefRecord | null>(null);

  useEffect(() => {
    let alive = true;
    getChatPref(peerId).then((p) => {
      if (alive) setPref(p ?? null);
    });
    return () => {
      alive = false;
    };
  }, [peerId]);

  const accentValue = pref?.chatAccent ?? "default";
  const soundValue = pref?.notificationSound ?? "default";
  const accent = getAccentSwatch(accentValue);

  async function pickAccent(value: string) {
    await setChatPref(peerId, {
      chatAccent: value === "default" ? undefined : value,
    });
    const next = await getChatPref(peerId);
    setPref(next ?? null);
  }

  async function pickSound(value: string) {
    await setChatPref(peerId, {
      notificationSound: value === "default" ? undefined : value,
    });
    const next = await getChatPref(peerId);
    setPref(next ?? null);
    // Preview the chosen pack so the user knows what they picked.
    feedback.receive(value);
  }

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
          <div className="font-semibold text-text">Customize chat</div>
          <div className="text-xs text-text-muted truncate">
            For your chat with{" "}
            <span className="text-text">{chatLabel}</span>
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-5">
          {/* Bubble preview */}
          <div className="rounded-xl border border-line bg-surface p-3 flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">
              Preview
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="self-start max-w-[70%] rounded-lg rounded-tl-sm bg-wa-bubble-in text-text text-xs px-2.5 py-1.5 shadow-bubble">
                Hey 👋
              </div>
              <div
                className="self-end max-w-[70%] rounded-lg rounded-br-sm text-white text-xs px-2.5 py-1.5 shadow-bubble"
                style={{ backgroundColor: accent.hex }}
              >
                Look at this color!
              </div>
            </div>
          </div>

          {/* Accent picker */}
          <section className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">
              Accent color
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SWATCHES.map((s) => {
                const isActive = accentValue === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => pickAccent(s.value)}
                    title={s.label}
                    aria-label={s.label}
                    aria-pressed={isActive}
                    className={
                      "relative size-9 rounded-full border-2 wa-tap transition " +
                      (isActive
                        ? "border-text ring-2 ring-text/20"
                        : "border-line hover:border-text-muted/60")
                    }
                    style={{ backgroundColor: s.hex }}
                  >
                    {s.value === "default" && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow"
                        aria-hidden="true"
                      >
                        AUTO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-text-muted">
              {accentValue === "default"
                ? "Using the global theme color."
                : `${accent.label} — only inside this chat.`}
            </div>
          </section>

          {/* Sound pack picker */}
          <section className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">
              Notification sound
            </div>
            <div className="flex flex-col gap-1.5">
              {SOUND_PACKS.map((p) => {
                const isActive = soundValue === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => pickSound(p.value)}
                    aria-pressed={isActive}
                    className={
                      "w-full flex items-center justify-between rounded-xl px-3 py-2 border wa-tap transition text-left " +
                      (isActive
                        ? "border-wa-green bg-wa-green-soft/30 text-text"
                        : "border-line bg-surface text-text hover:bg-elevated")
                    }
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        {p.label}
                      </span>
                      <span className="text-[11px] text-text-muted truncate">
                        {p.description}
                      </span>
                    </div>
                    {isActive ? (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-wa-green shrink-0">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-text-faint shrink-0">
                        Tap to test
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-text-muted">
              Sounds are played locally — your contact never knows what
              pack you picked.
            </div>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-line/60 flex justify-between items-center">
          <button
            onClick={async () => {
              await setChatPref(peerId, {
                chatAccent: undefined,
                notificationSound: undefined,
              });
              const next = await getChatPref(peerId);
              setPref(next ?? null);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface text-text-muted hover:text-text wa-tap"
          >
            Reset to default
          </button>
          <button
            onClick={onClose}
            className="text-sm font-medium px-4 py-1.5 rounded-full bg-wa-green text-text-oncolor wa-tap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
