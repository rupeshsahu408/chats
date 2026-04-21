import { useState } from "react";
import { useUnlockStore } from "../lib/unlockStore";
import { unlockIdentity } from "../lib/unlock";
import { ErrorMessage, FieldLabel, PrimaryButton } from "./Layout";

/**
 * Prompts the user to enter their Backup PIN to decrypt their identity
 * keys for chat use. If `children` is provided, renders them once the
 * identity is unlocked; otherwise renders a compact unlock card.
 */
export function UnlockGate({ children }: { children?: React.ReactNode }) {
  const identity = useUnlockStore((s) => s.identity);
  const setIdentity = useUnlockStore((s) => s.setIdentity);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (identity) return <>{children ?? null}</>;

  async function onUnlock() {
    setBusy(true);
    setError(null);
    try {
      const id = await unlockIdentity(pin);
      setIdentity(id);
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
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin) onUnlock();
          }}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition"
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <PrimaryButton onClick={onUnlock} loading={busy} disabled={!pin}>
        Unlock
      </PrimaryButton>
    </div>
  );
}
