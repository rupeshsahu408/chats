import { useEffect, useState } from "react";
import { useUnlockStore } from "../lib/unlockStore";
import {
  unlockIdentity,
  unlockIdentityFromPhrase,
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
 */
export function UnlockGate({ children }: { children?: React.ReactNode }) {
  const identity = useUnlockStore((s) => s.identity);
  const setIdentity = useUnlockStore((s) => s.setIdentity);

  const [accountIsPhraseDerived, setAccountIsPhraseDerived] = useState<
    boolean | null
  >(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIdentity().then((rec) => {
      if (rec) setAccountIsPhraseDerived(isPhraseDerived(rec));
    });
  }, []);

  if (identity) return <>{children ?? null}</>;
  if (accountIsPhraseDerived === null) return null;

  async function onUnlock() {
    setBusy(true);
    setError(null);
    try {
      const id = accountIsPhraseDerived
        ? await unlockIdentityFromPhrase(input)
        : await unlockIdentity(input);
      await setIdentity(id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.includes("decrypt") || e.message.includes("match")
            ? accountIsPhraseDerived
              ? "Recovery phrase doesn't match."
              : "Wrong PIN."
            : e.message
          : "Couldn't unlock.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface border border-line p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green flex items-center justify-center shrink-0">
          <LockIcon />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">Unlock chats</h3>
          <p className="text-sm text-text-muted mt-0.5">
            {accountIsPhraseDerived
              ? "Enter your 12-word recovery phrase to unlock your messaging keys. You'll only do this once on this device."
              : "Enter your Backup PIN to decrypt your messaging keys. You'll only do this once on this device."}
          </p>
        </div>
      </div>

      {accountIsPhraseDerived ? (
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
          (!!accountIsPhraseDerived &&
            input.trim().split(/\s+/).length < 12)
        }
      >
        Unlock
      </PrimaryButton>
    </div>
  );
}
