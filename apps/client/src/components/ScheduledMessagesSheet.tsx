import { useEffect, useMemo, useState } from "react";
import { trpc } from "../lib/trpc";
import {
  cancelServerScheduledMessage,
  getAllScheduledMirrors,
  reconcileMirror,
  type ScheduledMirrorRecord,
} from "../lib/scheduledServer";
import type { ScheduledMessage } from "@veil/shared";

/**
 * Bottom sheet listing scheduled messages held by the server.
 *
 *  - When `peerId` is provided, only that conversation's pending messages
 *    are shown.
 *  - When `peerId` is `null`, every pending scheduled message across all
 *    chats is shown, grouped by recipient.
 *
 * The list is fetched from the server every few seconds, so status flips
 * (pending → delivered → cancelled) update on their own.
 */
export function ScheduledMessagesSheet({
  peerId,
  onClose,
}: {
  peerId: string | null;
  onClose: () => void;
}) {
  const list = trpc.scheduled.list.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Reconcile our local plaintext mirror with what the server still has
  // — drops stale entries for delivered/cancelled rows the server has
  // garbage-collected.
  useEffect(() => {
    if (!list.data) return;
    reconcileMirror(new Set(list.data.scheduled.map((s) => s.id)));
  }, [list.data]);

  // Re-render every 30s so live countdowns stay fresh between fetches.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const mirror = useMemo(() => getAllScheduledMirrors(), [list.data]);

  // Lazily fetch connections for the global "to whom" labels.
  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: peerId === null,
    retry: false,
  });
  const peerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of connections.data ?? []) {
      const label = c.peer.fingerprint || `${c.peer.id.slice(0, 8)}…`;
      m.set(c.peer.id, label);
    }
    return m;
  }, [connections.data]);

  const pending = useMemo(() => {
    const all = (list.data?.scheduled ?? []).filter(
      (s) => s.status === "pending",
    );
    const filtered =
      peerId === null
        ? all
        : all.filter((s) => s.recipientUserId === peerId);
    return filtered;
  }, [list.data, peerId]);

  const empty = pending.length === 0 && !list.isLoading;
  const title =
    peerId === null ? "All scheduled messages" : "Scheduled messages";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-line shadow-sheet max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line text-base font-semibold text-text flex items-center gap-2 sticky top-0 bg-surface z-10">
          <span>🕐</span> {title}
          {!empty && pending.length > 0 && (
            <span className="ml-auto text-[11px] font-normal text-text-muted">
              {pending.length} pending
            </span>
          )}
        </div>

        {list.isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            Loading…
          </div>
        ) : list.isError ? (
          <div className="px-4 py-10 text-center text-sm text-red-400">
            Couldn't load scheduled messages. Check your connection.
          </div>
        ) : empty ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            <div className="text-2xl mb-2">📭</div>
            {peerId === null
              ? "You don't have any scheduled messages."
              : "No scheduled messages for this chat."}
          </div>
        ) : (
          pending.map((rec) => (
            <ScheduledRow
              key={rec.id}
              rec={rec}
              mirror={mirror[rec.id]}
              showPeer={peerId === null}
              peerLabel={peerLabelById.get(rec.recipientUserId)}
              onCancelled={() => list.refetch()}
            />
          ))
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-3 text-text-muted text-sm border-t border-line sticky bottom-0 bg-surface"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ScheduledRow({
  rec,
  mirror,
  showPeer,
  peerLabel,
  onCancelled,
}: {
  rec: ScheduledMessage;
  mirror: ScheduledMirrorRecord | undefined;
  showPeer: boolean;
  peerLabel: string | undefined;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const due = new Date(rec.scheduledFor).getTime();
  const now = Date.now();
  const overdue = due <= now;
  const hasError = !!rec.failReason && rec.attempts > 0;

  return (
    <div className="px-4 py-3 border-b border-line/60 last:border-b-0 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        {showPeer && (
          <div className="text-[11px] font-medium text-text mb-0.5 truncate">
            To {peerLabel ?? `${rec.recipientUserId.slice(0, 8)}…`}
          </div>
        )}
        <div
          className={
            "text-[11px] mb-0.5 flex items-center gap-1.5 " +
            (hasError
              ? "text-red-400"
              : overdue
                ? "text-amber-400"
                : "text-text-muted")
          }
        >
          {hasError ? (
            <>
              <span>⚠️</span>
              <span>Send failed — will retry</span>
            </>
          ) : overdue ? (
            <>
              <span>⏳</span>
              <span>Sending now…</span>
            </>
          ) : (
            <>
              <span>🕐</span>
              <span>
                {formatScheduledFor(due)} · {relativeIn(due - now)}
              </span>
            </>
          )}
        </div>
        <div className="text-sm text-text break-words line-clamp-3">
          {mirror?.text ?? (
            <span className="italic text-text-muted">
              Encrypted (scheduled from another device)
            </span>
          )}
        </div>
        {hasError && rec.failReason && (
          <div className="text-[11px] text-red-400/80 mt-1 truncate">
            {rec.failReason}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await cancelServerScheduledMessage(rec.id);
            onCancelled();
          } catch (e) {
            console.warn("cancel scheduled failed", e);
          } finally {
            setBusy(false);
          }
        }}
        className="shrink-0 text-text-muted hover:text-red-400 disabled:opacity-50 text-xs px-2 py-1 rounded hover:bg-white/5"
        aria-label="Cancel scheduled message"
      >
        {busy ? "…" : "Cancel"}
      </button>
    </div>
  );
}

/** "Today 3:42 PM", "Tomorrow 9:00 AM", "Mon Apr 28, 9:00 AM". */
function formatScheduledFor(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const time = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay(d, today)) return `Today ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow ${time}`;

  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diffDays >= 0 && diffDays < 7) {
    const wd = d.toLocaleDateString([], { weekday: "short" });
    return `${wd} ${time}`;
  }
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** "in 5m", "in 2h 15m", "in 3d". */
function relativeIn(deltaMs: number): string {
  if (deltaMs <= 0) return "now";
  const s = Math.round(deltaMs / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM ? `in ${h}h ${remM}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return `in ${d}d`;
}
