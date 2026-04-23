import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  deleteScheduledMessage,
  type ScheduledMessageRecord,
} from "../lib/db";
import { trpc } from "../lib/trpc";

/**
 * Bottom sheet listing scheduled messages.
 *
 *  - When `peerId` is provided, only that conversation's pending messages
 *    are shown.
 *  - When `peerId` is `null`, every pending scheduled message across all
 *    chats is shown, grouped by recipient.
 *
 * Every row updates in real time as the global scheduledSender flips
 * records from pending → sent or stamps a `lastError`.
 */
export function ScheduledMessagesSheet({
  peerId,
  onClose,
}: {
  peerId: string | null;
  onClose: () => void;
}) {
  // Live list of pending records, sorted by scheduled time.
  const scheduled = useLiveQuery(
    async () => {
      const all = await db.scheduledMessages
        .filter((r) => !r.sent)
        .toArray();
      const filtered =
        peerId === null ? all : all.filter((r) => r.peerId === peerId);
      filtered.sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime(),
      );
      return filtered;
    },
    [peerId],
    [] as ScheduledMessageRecord[],
  );

  // Lazily fetch connections so we can render real names in global view.
  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: peerId === null,
    retry: false,
  });
  const peerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of connections.data ?? []) {
      const label =
        c.peer.fingerprint || `${c.peer.id.slice(0, 8)}…`;
      m.set(c.peer.id, label);
    }
    return m;
  }, [connections.data]);

  // Re-render every 30s so countdowns stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const empty = !scheduled || scheduled.length === 0;
  const title = peerId === null ? "All scheduled messages" : "Scheduled messages";

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
          {!empty && (
            <span className="ml-auto text-[11px] font-normal text-text-muted">
              {scheduled.length} pending
            </span>
          )}
        </div>

        {empty ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            <div className="text-2xl mb-2">📭</div>
            {peerId === null
              ? "You don't have any scheduled messages."
              : "No scheduled messages for this chat."}
          </div>
        ) : (
          scheduled.map((rec) => (
            <ScheduledRow
              key={rec.id}
              rec={rec}
              showPeer={peerId === null}
              peerLabel={peerLabelById.get(rec.peerId)}
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
  showPeer,
  peerLabel,
}: {
  rec: ScheduledMessageRecord;
  showPeer: boolean;
  peerLabel: string | undefined;
}) {
  const due = new Date(rec.scheduledFor).getTime();
  const now = Date.now();
  const overdue = due <= now;
  const hasError = !!rec.lastError;

  return (
    <div className="px-4 py-3 border-b border-line/60 last:border-b-0 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        {showPeer && (
          <div className="text-[11px] font-medium text-text mb-0.5 truncate">
            To {peerLabel ?? `${rec.peerId.slice(0, 8)}…`}
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
          {rec.text}
        </div>
        {hasError && (
          <div className="text-[11px] text-red-400/80 mt-1 truncate">
            {rec.lastError}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={async () => {
          if (rec.id !== undefined) await deleteScheduledMessage(rec.id);
        }}
        className="shrink-0 text-text-muted hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-white/5"
        aria-label="Cancel scheduled message"
      >
        Cancel
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

  // Within the next 6 days → "Mon 9:00 AM"
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
