import { useEffect, useState } from "react";
import { useUnlockStore } from "../lib/unlockStore";
import { unlockIdentity, unlockIdentityFromPhrase, isPhraseDerived } from "../lib/unlock";
import { loadIdentity } from "../lib/db";
import { ErrorMessage, FieldLabel, PrimaryButton } from "./Layout";

/**
 * Prompts the user to enter their Backup PIN (email/phone accounts) or
 * recovery phrase (random ID accounts) to decrypt their identity keys.
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
      setIdentity(id);
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

  if (accountIsPhraseDerived) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold">Unlock chats</h3>
          <p className="text-sm text-white/60 mt-1">
            Enter your 12-word recovery phrase to unlock your messaging keys.
          </p>
        </div>
        <div>
          <FieldLabel>Recovery phrase</FieldLabel>
          <textarea
            rows={3}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="word1 word2 word3 …"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition resize-none text-sm"
          />
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton
          onClick={onUnlock}
          loading={busy}
          disabled={input.trim().split(/\s+/).length < 12}
        >
          Unlock
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold">Unlock chats</h3>
        <p className="text-sm text-white/60 mt-1">
          Enter your Backup PIN to decrypt your messaging keys on this device.
        </p>
      </div>
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
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition"
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <PrimaryButton onClick={onUnlock} loading={busy} disabled={!input}>
        Unlock
      </PrimaryButton>
    </div>
  );
}
