import { useEffect, useState } from "react";
import { useUnlockStore } from "../lib/unlockStore";
import { useAuthStore } from "../lib/store";
import {
  unlockIdentity,
  unlockIdentityFromPhrase,
  recoverIdentityFromPhraseOnNewDevice,
  recoverIdentityWithDailyPassword,
  isPhraseDerived,
} from "../lib/unlock";
import { loadIdentity } from "../lib/db";
import {
  ErrorMessage,
  FieldLabel,
  PrimaryButton,
  LockIcon,
} from "./Layout";

/**
 * Prompts the user to enter their Backup PIN (email/phone accounts) or
 * recovery phrase / daily verification password (random ID accounts) to
 * decrypt their identity keys.
 *
 * Once unlocked, the keys are cached in IndexedDB so the user only has
 * to do this once per browser (see UnlockedIdentityRecord).
 *
 * Modes:
 *
 *   1. `phrase`                — local IDB record exists, phrase-derived.
 *   2. `pin`                   — local IDB record exists, PIN-encrypted.
 *   3. `recover-choose`        — no local record, Random-ID account.
 *                                User picks recovery method.
 *   4. `recover-phrase`        — paste 12-word phrase (preserves history).
 *   5. `recover-daily-password`— enter daily verification password
 *                                (decrypts the server-side encrypted
 *                                backup of the original phrase, so the
 *                                same identity and chat history are
 *                                preserved — no new phrase generated).
 *   6. `recover-no-backup`     — no local record, PIN account
 *                                (email/phone) — explain backup import.
 */
type Mode =
  | "phrase"
  | "pin"
  | "recover-choose"
  | "recover-phrase"
  | "recover-daily-password"
  | "recover-no-backup"
  | null;

export function UnlockGate({ children }: { children?: React.ReactNode }) {
  const identity = useUnlockStore((s) => s.identity);
  const setIdentity = useUnlockStore((s) => s.setIdentity);
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<Mode>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadIdentity().then((rec) => {
      if (cancelled) return;
      if (rec) {
        setMode(isPhraseDerived(rec) ? "phrase" : "pin");
      } else if (user) {
        // No local identity but we ARE signed in → fresh-device path.
        setMode(
          user.accountType === "random" ? "recover-choose" : "recover-no-backup",
        );
      }
      // (no `user` yet → wait for SessionBootstrap to populate it)
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (identity) return <>{children ?? null}</>;
  if (mode === null) return null;

  function switchMode(next: Mode) {
    setInput("");
    setError(null);
    setMode(next);
  }

  async function onUnlock() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "phrase") {
        const id = await unlockIdentityFromPhrase(input);
        await setIdentity(id);
      } else if (mode === "pin") {
        const id = await unlockIdentity(input);
        await setIdentity(id);
      } else if (mode === "recover-phrase") {
        if (!user) throw new Error("Not signed in.");
        const id = await recoverIdentityFromPhraseOnNewDevice(input, user.id);
        await setIdentity(id);
      } else if (mode === "recover-daily-password") {
        if (!user) throw new Error("Not signed in.");
        const id = await recoverIdentityWithDailyPassword(input, user.id);
        await setIdentity(id);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.includes("decrypt")
            ? "Wrong PIN."
            : e.message
          : "Couldn't unlock.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ─── Picker: which recovery method? ──────────────────────────────
  if (mode === "recover-choose") {
    return (
      <div className="rounded-2xl bg-surface border border-line p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green flex items-center justify-center shrink-0">
            <LockIcon />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text">
              Recover this device
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              Choose how you'd like to prove this is your account. You'll
              only do this once on this device.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => switchMode("recover-phrase")}
          className="text-left rounded-xl border border-line bg-bg hover:border-wa-green focus:border-wa-green focus:outline-none transition p-4 flex flex-col gap-1"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-text">
              Enter recovery phrase
            </span>
            <span className="text-[10px] uppercase tracking-wide font-semibold text-wa-green-dark dark:text-wa-green bg-wa-green/15 rounded-full px-2 py-0.5">
              Recommended
            </span>
          </div>
          <span className="text-xs text-text-muted">
            Paste your 12-word phrase. Your old chats stay readable.
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchMode("recover-daily-password")}
          className="text-left rounded-xl border border-line bg-bg hover:border-wa-green focus:border-wa-green focus:outline-none transition p-4 flex flex-col gap-1"
        >
          <span className="font-medium text-text">
            Use daily verification password
          </span>
          <span className="text-xs text-text-muted">
            For when you don't have your phrase. Your account, your
            existing recovery phrase, and your old chat history all
            stay intact.
          </span>
        </button>
      </div>
    );
  }

  // ─── Fresh-device PIN account: no recovery path possible ────────
  if (mode === "recover-no-backup") {
    return (
      <div className="rounded-2xl bg-surface border border-line p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green flex items-center justify-center shrink-0">
            <LockIcon />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text">
              Your messaging keys aren't on this device
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              You're signed in, but your end-to-end encrypted keys live in
              the browser you originally signed up on. Open Veil on that
              device, export a backup from{" "}
              <span className="text-text">Settings → Backup &amp; recovery</span>,
              then import it here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Phrase / PIN / Daily-password entry forms ──────────────────
  const isPhraseEntry = mode === "phrase" || mode === "recover-phrase";
  const isDailyPasswordEntry = mode === "recover-daily-password";
  const isFreshRecover = mode === "recover-phrase";

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green flex items-center justify-center shrink-0">
          <LockIcon />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">
            {isDailyPasswordEntry
              ? "Daily verification password"
              : isFreshRecover
                ? "Enter recovery phrase"
                : isPhraseEntry
                  ? "Unlock chats"
                  : "Unlock chats"}
          </h3>
          <p className="text-sm text-text-muted mt-0.5">
            {isDailyPasswordEntry
              ? "Enter the daily password you set at sign-up. We'll restore your original keys on this device — your recovery phrase and chat history stay exactly as they were."
              : isFreshRecover
                ? "Enter the 12-word recovery phrase from your sign-up to set up Veil on this device. You'll only do this once."
                : isPhraseEntry
                  ? "Enter your 12-word recovery phrase to unlock your messaging keys. You'll only do this once on this device."
                  : "Enter your Backup PIN to decrypt your messaging keys. You'll only do this once on this device."}
          </p>
        </div>
      </div>

      {isPhraseEntry ? (
        <div>
          <FieldLabel>Recovery phrase</FieldLabel>
          <textarea
            rows={3}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="word1 word2 word3 …"
            className="w-full rounded-xl bg-bg border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition resize-none text-sm"
          />
        </div>
      ) : isDailyPasswordEntry ? (
        <div>
          <FieldLabel>Daily verification password</FieldLabel>
          <input
            type="password"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.length >= 8) onUnlock();
            }}
            className="w-full rounded-xl bg-bg border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition"
          />
        </div>
      ) : (
        <div>
          <FieldLabel>Backup PIN</FieldLabel>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input) onUnlock();
            }}
            className="w-full rounded-xl bg-bg border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition"
          />
        </div>
      )}

      <ErrorMessage>{error}</ErrorMessage>
      <PrimaryButton
        onClick={onUnlock}
        loading={busy}
        disabled={
          !input ||
          (isPhraseEntry && input.trim().split(/\s+/).length < 12) ||
          (isDailyPasswordEntry && input.length < 8)
        }
      >
        {isDailyPasswordEntry
          ? "Verify and continue"
          : isFreshRecover
            ? "Recover and unlock"
            : "Unlock"}
      </PrimaryButton>

      {(isFreshRecover || isDailyPasswordEntry) && (
        <button
          type="button"
          onClick={() => switchMode("recover-choose")}
          className="text-sm text-text-muted hover:text-text transition self-center"
        >
          ← Use a different recovery method
        </button>
      )}
    </div>
  );
}
