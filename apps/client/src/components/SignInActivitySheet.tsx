import { useState } from "react";
import { trpc } from "../lib/trpc";
import { humanizeErrorMessage } from "../lib/humanizeError";
import { feedback } from "../lib/feedback";
import {
  SecondaryButton,
} from "./Layout";
import type { SignInActivityEntry } from "@veil/shared";

/**
 * Settings → Security → Sign-in activity. Lists the user's most
 * recent (up to 10) sessions with device, location, and a sign-out
 * button per entry. The current device is marked and not removable
 * here — it has to go through the regular sign-out so local state
 * gets cleared too.
 */
export function SignInActivitySheet({ onClose }: { onClose: () => void }) {
  const list = trpc.auth.listSessions.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const revoke = trpc.auth.revokeSession.useMutation({
    onSuccess: () => utils.auth.listSessions.invalidate(),
  });
  const [confirm, setConfirm] = useState<SignInActivityEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function doRevoke() {
    if (!confirm) return;
    setError(null);
    setBusyId(confirm.id);
    try {
      await revoke.mutateAsync({ sessionId: confirm.id });
      setConfirm(null);
      feedback.success();
    } catch (e) {
      setError(humanizeErrorMessage(e));
      feedback.error();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted leading-relaxed">
        Each row below is a device that's currently signed in to your
        account. Sign out anything you don't recognize — your messages
        on those devices will become unreadable until you sign in again.
      </p>

      {list.isLoading ? (
        <div className="text-sm text-text-muted">Loading…</div>
      ) : list.error ? (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
          Could not load your sign-in activity.
        </div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="text-sm text-text-muted">No active sessions.</div>
      ) : (
        <ul className="rounded-2xl border border-line divide-y divide-line overflow-hidden">
          {(list.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex items-start gap-3 px-4 py-3 bg-surface"
            >
              <div className="mt-0.5">
                <DeviceIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text truncate">
                    {s.device}
                  </span>
                  {s.isCurrent && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-wa-green/15 border border-wa-green/40 text-wa-green-dark dark:text-wa-green">
                      this device
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {formatPlace(s)} · last active {formatRelative(s.lastUsedAt)}
                </div>
                <div className="text-[10px] text-text-faint mt-0.5">
                  Signed in {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </div>
              {s.isCurrent ? (
                <span className="text-xs text-text-muted self-center">
                  Current
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirm(s);
                  }}
                  disabled={busyId === s.id}
                  className="text-xs px-3 py-1.5 rounded-full border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 wa-tap disabled:opacity-60 self-center"
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
      </div>

      {confirm && (
        <ConfirmRevokeModal
          entry={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={doRevoke}
          loading={revoke.isPending}
        />
      )}
    </div>
  );
}

/* ─────────── confirm modal ─────────── */

function ConfirmRevokeModal({
  entry,
  onCancel,
  onConfirm,
  loading,
}: {
  entry: SignInActivityEntry;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-bg border border-line p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-text">
          Sign out this device?
        </h3>
        <p className="text-sm text-text-muted">
          <span className="text-text font-medium">{entry.device}</span>
          {" "}
          {formatPlace(entry)} will be signed out immediately.
        </p>
        <p className="text-xs text-text-muted">
          You can sign in again from that device using your username and
          password, or your passkey.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 transition disabled:opacity-60 wa-tap"
          >
            {loading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── helpers ─────────── */

function DeviceIcon() {
  return (
    <div className="w-9 h-9 rounded-full bg-bg border border-line flex items-center justify-center text-text-muted">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="4"
          width="16"
          height="13"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M9 20h6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M12 17v3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

function formatPlace(info: { city: string | null; country: string | null }): string {
  if (info.city && info.country) return `from ${info.city}, ${info.country}`;
  if (info.city) return `from ${info.city}`;
  if (info.country) return `from ${info.country}`;
  return "from an unknown location";
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)} hr ago`;
  if (diffSec < 30 * 86_400) return `${Math.floor(diffSec / 86_400)} days ago`;
  return new Date(iso).toLocaleDateString();
}
