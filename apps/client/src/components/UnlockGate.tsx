import { useEffect, useState } from "react";
import { useUnlockStore } from "../lib/unlockStore";
import { useAuthStore } from "../lib/store";
import {
  unlockIdentity,
  unlockIdentityFromPhrase,
  recoverIdentityFromPhraseOnNewDevice,
  isPhraseDerived,
} from "../lib/unlock";
import { loadIdentity } from "../lib/db";
import { ErrorMessage, FieldLabel, PrimaryButton, LockIcon } from "./Layout";

/**
 * Prompts the user to enter their Backup PIN (email/phone accounts) or
 * recovery phrase (random ID accounts) to decrypt their identity keys.
 *
 * Once unlocked, the keys are cached in IndexedDB so the user only has to
 * do this once per browser (see UnlockedIdentityRecord).
 *
 * Three modes:
 *
 *   1. `phrase`  — local IDB record exists and is phrase-derived. The
 *      user types the phrase; we derive + verify against the locally
 *      stored public key.
 *   2. `pin`     — local IDB record exists and is PIN-encrypted. The
 *      user types the PIN; we decrypt and load.
 *   3. `recover` — NO local IDB record exists yet (signed in on a
 *      brand-new device / cleared site data). For Random-ID accounts
 *      we let the user paste their recovery phrase to derive a fresh
 *      identity on this device. For PIN accounts we explain that the
 *      device-local encrypted backup is required.
 *
 * Without mode 3, a brand-new-device login would land on `/chats`,
 * find no local identity, and render nothing — leaving the user
 * staring at a blank page.
 */
type Mode = "phrase" | "pin" | "recover-phrase" | "recover-no-backup" | null;

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
          user.accountType === "random" ? "recover-phrase" : "recover-no-backup",
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

  async function onUnlock() {
    setBusy(true);
    setError(null);
    try {
      let id;
      if (mode === "phrase") {
        id = await unlockIdentityFromPhrase(input);
      } else if (mode === "pin") {
        id = await unlockIdentity(input);
      } else if (mode === "recover-phrase") {
        if (!user) throw new Error("Not signed in.");
        id = await recoverIdentityFromPhraseOnNewDevice(input, user.id);
      } else {
        return;
      }
      await setIdentity(id);
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

  // Brand-new-device, PIN account: there's no recovery path because
  // the AES-GCM ciphertext lives only on the original device. Surface
  // a clear message instead of an unfixable blank page.
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

  const isPhraseMode = mode === "phrase" || mode === "recover-phrase";
  const isFreshRecover = mode === "recover-phrase";

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green flex items-center justify-center shrink-0">
          <LockIcon />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">
            {isFreshRecover ? "Recover this device" : "Unlock chats"}
          </h3>
          <p className="text-sm text-text-muted mt-0.5">
            {isFreshRecover
              ? "Enter the 12-word recovery phrase from your sign-up to set up Veil on this device. You'll only do this once."
              : isPhraseMode
                ? "Enter your 12-word recovery phrase to unlock your messaging keys. You'll only do this once on this device."
                : "Enter your Backup PIN to decrypt your messaging keys. You'll only do this once on this device."}
          </p>
        </div>
      </div>

      {isPhraseMode ? (
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
          (isPhraseMode && input.trim().split(/\s+/).length < 12)
        }
      >
        {isFreshRecover ? "Recover and unlock" : "Unlock"}
      </PrimaryButton>
    </div>
  );
}
