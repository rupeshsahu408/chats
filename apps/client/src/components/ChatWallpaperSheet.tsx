import { useMemo, useRef, useState } from "react";
import {
  useWallpaperStore,
  useEffectiveWallpaper,
  getWallpaperStyle,
  fileToCompressedDataUrl,
  SOLID_PALETTE,
  DOT_PALETTE,
  type ChatScope,
  type WallpaperKind,
  type WallpaperPref,
} from "../lib/wallpaperStore";

/**
 * Sheet UI for picking a wallpaper specific to a single chat (DM or
 * group). Mirrors the Settings → Appearance picker but adds a "Use
 * default for all chats" action so the user can opt out of the
 * per-chat override and fall back to the global pick.
 */
export function ChatWallpaperSheet({
  scope,
  onClose,
  chatLabel,
}: {
  scope: ChatScope;
  onClose: () => void;
  /** Friendly name shown in the header (peer name or group name). */
  chatLabel: string;
}) {
  const { pref, hasOverride } = useEffectiveWallpaper(scope);
  const setChatPref = useWallpaperStore((s) => s.setChatPref);
  const clearChatPref = useWallpaperStore((s) => s.clearChatPref);
  const globalPref = useWallpaperStore((s) => s.pref);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewStyle = useMemo(() => getWallpaperStyle(pref), [pref]);
  const globalStyle = useMemo(
    () => getWallpaperStyle(globalPref),
    [globalPref],
  );

  const kindOptions: { value: WallpaperKind; label: string; hint: string }[] = [
    { value: "default", label: "Default", hint: "Theme dots" },
    { value: "solid", label: "Solid", hint: "Flat color" },
    { value: "dots", label: "Dotted", hint: "Pick a color" },
    { value: "image", label: "Image", hint: "Upload" },
  ];

  function applyOverride(next: WallpaperPref) {
    setError(null);
    setChatPref(scope, next);
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      applyOverride({ kind: "image", imageData: dataUrl });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Couldn't save that image. Try a smaller one.";
      setError(msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-panel w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-line/60">
          <div className="font-semibold text-text">Chat wallpaper</div>
          <div className="text-xs text-text-muted truncate">
            For your chat with{" "}
            <span className="text-text">{chatLabel}</span>
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-3">
          {/* Preview with sample bubbles */}
          <div
            className="relative h-28 rounded-xl border border-line overflow-hidden"
            style={previewStyle}
          >
            <div className="absolute left-3 top-3 max-w-[55%] rounded-lg rounded-tl-sm bg-wa-bubble-in text-text text-xs px-2.5 py-1.5 shadow-bubble">
              Hey there 👋
            </div>
            <div className="absolute right-3 bottom-3 max-w-[55%] rounded-lg rounded-br-sm bg-wa-bubble-out text-text text-xs px-2.5 py-1.5 shadow-bubble">
              Looking good!
            </div>
            {hasOverride && (
              <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wide font-semibold bg-wa-green text-text-oncolor px-1.5 py-0.5 rounded">
                Custom
              </div>
            )}
          </div>

          {/* Kind segmented control */}
          <div className="grid grid-cols-4 gap-1.5">
            {kindOptions.map((o) => {
              const isActive = hasOverride && pref.kind === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    setError(null);
                    if (o.value === "image") {
                      fileInputRef.current?.click();
                    } else if (o.value === "solid") {
                      applyOverride({
                        kind: "solid",
                        color: pref.color ?? SOLID_PALETTE[0]!.value,
                      });
                    } else if (o.value === "dots") {
                      applyOverride({
                        kind: "dots",
                        color: pref.color ?? DOT_PALETTE[0]!.value,
                      });
                    } else {
                      applyOverride({ kind: "default" });
                    }
                  }}
                  className={
                    "flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 border text-center wa-tap transition " +
                    (isActive
                      ? "border-wa-green bg-wa-green-soft/40 text-text"
                      : "border-line bg-surface text-text-muted hover:text-text")
                  }
                  aria-pressed={isActive}
                >
                  <span className="text-xs font-medium leading-tight">
                    {o.label}
                  </span>
                  <span className="text-[10px] text-text-faint leading-tight">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hidden file input for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {/* Per-kind controls (only when override is active) */}
          {hasOverride && pref.kind === "solid" && (
            <ColorSwatchPicker
              options={SOLID_PALETTE}
              selected={pref.color}
              onPick={(c) => applyOverride({ kind: "solid", color: c })}
            />
          )}

          {hasOverride && pref.kind === "dots" && (
            <ColorSwatchPicker
              options={DOT_PALETTE}
              selected={pref.color}
              onPick={(c) => applyOverride({ kind: "dots", color: c })}
            />
          )}

          {hasOverride && pref.kind === "image" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface text-text hover:bg-elevated wa-tap disabled:opacity-60"
              >
                {pref.imageData ? "Replace image" : "Choose image…"}
              </button>
              {busy && (
                <span className="text-[11px] text-text-muted">
                  Processing…
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-500" role="alert">
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-line/60 pt-3 mt-1">
            <div className="text-xs text-text-muted mb-2">
              Or use the same wallpaper as everywhere else
            </div>
            <button
              onClick={() => clearChatPref(scope)}
              disabled={!hasOverride}
              className={
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border wa-tap transition text-left " +
                (!hasOverride
                  ? "border-wa-green bg-wa-green-soft/40 text-text"
                  : "border-line bg-surface text-text hover:bg-elevated")
              }
              aria-pressed={!hasOverride}
            >
              <span
                className="size-10 rounded-lg border border-line shrink-0"
                style={globalStyle}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">
                  Use global default
                </span>
                <span className="block text-[11px] text-text-muted leading-tight">
                  Falls back to the pick from Settings → Appearance
                </span>
              </span>
              {!hasOverride && (
                <span className="text-[10px] uppercase tracking-wide font-semibold text-wa-green">
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-line/60 flex justify-end">
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

function ColorSwatchPicker({
  options,
  selected,
  onPick,
}: {
  options: { value: string; label: string }[];
  selected: string | undefined;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isActive =
          (selected ?? "").toLowerCase() === o.value.toLowerCase();
        return (
          <button
            key={o.value}
            onClick={() => onPick(o.value)}
            title={o.label}
            aria-label={o.label}
            aria-pressed={isActive}
            className={
              "size-8 rounded-full border-2 wa-tap transition " +
              (isActive
                ? "border-wa-green ring-2 ring-wa-green/30"
                : "border-line hover:border-text-muted/60")
            }
            style={{ background: o.value }}
          />
        );
      })}
    </div>
  );
}
