import { useEffect, useMemo, useState } from "react";
import {
  defineWord,
  suggestAction,
  translateText,
  tryCalculate,
  type Definition,
  type TranslateResult,
} from "../lib/quickActions";

type Tab = "calculate" | "define" | "translate";

/**
 * Bottom sheet shown when the user picks "Quick actions" from the
 * message action menu. Three small utilities, each computed on demand
 * (no work done unless the user opens the relevant tab).
 *
 * Privacy summary surfaced at the bottom of the sheet so the user
 * always knows what leaves their device:
 *   • Calculate → never leaves the device.
 *   • Define    → just the single word leaves the device.
 *   • Translate → either on-device, or one explicit tap to Google.
 */
export function QuickActionsSheet({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  const initial = useMemo<Tab>(() => suggestAction(text), [text]);
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-label="Quick actions"
    >
      <div
        className="w-full sm:max-w-md md:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-line shadow-sheet max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="font-semibold text-text">Quick actions</div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">
            Selected text
          </div>
          <div className="text-[13px] text-text bg-bg border border-line rounded-lg px-3 py-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
            {text}
          </div>
        </div>

        <div className="px-4 pt-1">
          <div className="flex gap-1 border-b border-line">
            <TabButton active={tab === "calculate"} onClick={() => setTab("calculate")}>
              Calculate
            </TabButton>
            <TabButton active={tab === "define"} onClick={() => setTab("define")}>
              Define
            </TabButton>
            <TabButton active={tab === "translate"} onClick={() => setTab("translate")}>
              Translate
            </TabButton>
          </div>
        </div>

        <div className="px-4 py-3 min-h-[140px]">
          {tab === "calculate" && <CalculateTab text={text} />}
          {tab === "define" && <DefineTab text={text} />}
          {tab === "translate" && <TranslateTab text={text} />}
        </div>

        <div className="px-4 pb-3 text-[11px] text-text-muted leading-snug border-t border-line pt-2">
          {tab === "calculate" && (
            <span>Maths runs on this device. Nothing is sent.</span>
          )}
          {tab === "define" && (
            <span>The single word is sent to dictionaryapi.dev. Your message stays private.</span>
          )}
          {tab === "translate" && (
            <span>
              On-device translation when supported; otherwise a one-tap link to
              Google Translate. Nothing is sent silently.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-2 text-sm border-b-2 -mb-px " +
        (active
          ? "border-wa-green text-text font-medium"
          : "border-transparent text-text-muted hover:text-text")
      }
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Calculate tab ───────────────────────── */

function CalculateTab({ text }: { text: string }) {
  const result = useMemo(() => tryCalculate(text), [text]);
  if (!result) {
    return (
      <div className="text-sm text-text-muted">
        This doesn't look like a math expression. Try something like{" "}
        <code className="text-text">12 * (3 + 4)</code> or{" "}
        <code className="text-text">2^10</code>.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-3xl font-semibold text-text tabular-nums">
        = {result.formatted}
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(result.formatted).catch(() => undefined)}
        className="text-xs px-3 py-1.5 rounded-lg border border-line text-text-muted hover:text-text hover:bg-white/5"
      >
        Copy result
      </button>
    </div>
  );
}

/* ────────────────────────── Define tab ────────────────────────── */

function DefineTab({ text }: { text: string }) {
  const word = text.trim();
  const isLookable = /^[a-z'’-]{1,40}$/i.test(word);
  const [data, setData] = useState<Definition | null | "loading" | "miss">(
    isLookable ? "loading" : "miss",
  );

  useEffect(() => {
    if (!isLookable) {
      setData("miss");
      return;
    }
    let cancelled = false;
    setData("loading");
    void defineWord(word).then((res) => {
      if (cancelled) return;
      setData(res ?? "miss");
    });
    return () => {
      cancelled = true;
    };
  }, [word, isLookable]);

  if (!isLookable) {
    return (
      <div className="text-sm text-text-muted">
        Select a single word to look up its definition.
      </div>
    );
  }
  if (data === "loading") {
    return <div className="text-sm text-text-muted">Looking up…</div>;
  }
  if (data === "miss" || data === null) {
    return (
      <div className="text-sm text-text-muted">
        No definition found for <span className="text-text">{word}</span>.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-text">{data.word}</span>
        {data.phonetic && (
          <span className="text-sm text-text-muted">{data.phonetic}</span>
        )}
      </div>
      <div className="space-y-2">
        {data.meanings.map((m, i) => (
          <div key={i}>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">
              {m.partOfSpeech}
            </div>
            <ol className="list-decimal pl-5 text-sm text-text space-y-1">
              {m.definitions.map((d, j) => (
                <li key={j}>
                  <span>{d.definition}</span>
                  {d.example && (
                    <div className="text-[12px] text-text-muted italic">
                      “{d.example}”
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────── Translate tab ──────────────────────── */

const LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
];

const TRANSLATE_LANG_KEY = "veil.translate.targetLang";

function TranslateTab({ text }: { text: string }) {
  const [lang, setLang] = useState<string>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem(TRANSLATE_LANG_KEY) ?? "en";
  });
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "result"; res: TranslateResult }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TRANSLATE_LANG_KEY, lang);
    }
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    translateText(text, lang)
      .then((res) => {
        if (cancelled) return;
        setState({ kind: "result", res });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          kind: "error",
          msg: e instanceof Error ? e.message : "Translation failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  return (
    <div className="space-y-3">
      <label className="text-xs text-text-muted block">
        Translate to
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="ml-2 bg-bg text-text rounded-md px-2 py-1 border border-line text-sm"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      {state.kind === "loading" && (
        <div className="text-sm text-text-muted">Translating…</div>
      )}
      {state.kind === "error" && (
        <div className="text-sm text-red-400">{state.msg}</div>
      )}
      {state.kind === "result" && state.res.kind === "ondevice" && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">
            On-device
          </div>
          <div className="text-sm text-text bg-bg border border-line rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
            {state.res.text}
          </div>
          <button
            type="button"
            onClick={() =>
              state.kind === "result" &&
              state.res.kind === "ondevice" &&
              navigator.clipboard?.writeText(state.res.text).catch(() => undefined)
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-line text-text-muted hover:text-text hover:bg-white/5"
          >
            Copy translation
          </button>
        </div>
      )}
      {state.kind === "result" && state.res.kind === "fallback" && (
        <div className="space-y-2">
          <div className="text-sm text-text-muted">
            On-device translation isn't available in this browser.
          </div>
          <a
            href={state.res.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs px-3 py-1.5 rounded-lg bg-wa-green text-text-oncolor font-medium"
          >
            Open in Google Translate ↗
          </a>
        </div>
      )}
    </div>
  );
}
