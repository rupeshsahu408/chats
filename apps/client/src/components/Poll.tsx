import { useState } from "react";

/**
 * Modal sheet for composing a new poll. Used by both 1:1 chats and
 * group chats — caller passes the `onSubmit` that knows how to wrap
 * the question/choices into a poll envelope and send it.
 */
export function PollComposer({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (question: string, choices: string[]) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid =
    question.trim().length > 0 &&
    choices.filter((c) => c.trim().length > 0).length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md md:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-line p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold text-text">Create poll</div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text px-1"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1 block">Question</label>
          <input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            placeholder="Ask something…"
            className="w-full bg-bg text-text rounded-lg px-3 py-2 border border-line outline-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1 block">
            Options (min 2, max 8)
          </label>
          <div className="space-y-1.5">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  maxLength={100}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-bg text-text rounded-lg px-3 py-2 border border-line outline-none text-sm"
                />
                {choices.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setChoices(choices.filter((_, j) => j !== i))}
                    className="text-text-muted hover:text-red-400 text-sm px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {choices.length < 8 && (
            <button
              type="button"
              onClick={() => setChoices([...choices, ""])}
              className="mt-2 text-xs text-wa-green hover:underline"
            >
              + Add option
            </button>
          )}
        </div>

        {err && <div className="text-xs text-red-400">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-line text-text text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await onSubmit(
                  question.trim(),
                  choices.map((c) => c.trim()).filter((c) => c.length > 0),
                );
                onClose();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Failed to create poll.");
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 py-2 rounded-xl bg-wa-green text-text-oncolor text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send poll"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Stateless poll bubble. Caller computes `counts` (per choice),
 * `myVote` (-1 if not voted), and `totalVotes` from whichever
 * underlying log holds the votes (chatMessages for 1:1,
 * groupMessages for groups).
 */
export function PollCard({
  question,
  choices,
  counts,
  myVote,
  totalVotes,
  createdAt,
  isMine,
  onVote,
}: {
  question: string;
  choices: string[];
  counts: number[];
  myVote: number;
  totalVotes: number;
  createdAt: string;
  isMine: boolean;
  onVote: (choiceIdx: number) => void;
}) {
  return (
    <div
      className={
        "max-w-[78%] rounded-2xl shadow-bubble overflow-hidden text-sm " +
        (isMine
          ? "self-end bg-wa-bubble-out rounded-tr-sm"
          : "self-start bg-wa-bubble-in rounded-tl-sm")
      }
    >
      <div className="px-3 pt-2.5 pb-2 border-b border-line/40">
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wide font-medium mb-1">
          <span>📊</span>
          <span>Poll</span>
        </div>
        <div className="font-semibold text-text leading-snug">{question}</div>
      </div>

      <div className="divide-y divide-line/30">
        {choices.map((choice, idx) => {
          const count = counts[idx] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = myVote === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onVote(voted ? -1 : idx)}
              className="w-full text-left px-3 py-2 hover:bg-text/5 relative overflow-hidden"
            >
              {totalVotes > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-wa-green/15 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={
                      "size-4 rounded-full border-2 flex-shrink-0 transition-colors " +
                      (voted
                        ? "border-wa-green bg-wa-green"
                        : "border-text-muted bg-transparent")
                    }
                  />
                  <span className="text-text text-[13px] truncate">{choice}</span>
                </div>
                <span className="text-[11px] text-text-muted tabular-nums flex-shrink-0">
                  {count > 0 ? `${count} (${pct}%)` : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-3 py-1.5 text-[10.5px] text-text-muted flex justify-between">
        <span>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </span>
        <span>
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
