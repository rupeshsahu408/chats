import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { trpcClientProxy } from "../lib/trpcClientProxy";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import {
  AppBar,
  Avatar,
  IconButton,
  MoreVerticalIcon,
  MessageBubble,
  ErrorMessage,
  EmptyState,
  ChatIcon,
  Spinner,
  LockIcon,
  SendIcon,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import { db, type GroupMessageRecord } from "../lib/db";
import {
  ensureMySenderKey,
  ingestGroupInboxMessage,
  sendGroupText,
  sendGroupPoll,
  sendGroupPollVote,
} from "../lib/groupSync";
import { pollAndDecrypt } from "../lib/messageSync";

/* ─────────── Public page shell ─────────── */

export function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  if (!groupId) {
    return (
      <main className="min-h-full flex flex-col bg-bg text-text">
        <AppBar title="Group" back="/groups" />
        <div className="p-4">
          <ErrorMessage>Missing group id.</ErrorMessage>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex flex-col bg-bg text-text">
      {!identity ? (
        <>
          <AppBar title="Group" back="/groups" />
          <div className="p-4">
            <UnlockGate />
          </div>
        </>
      ) : (
        <GroupChatInner groupId={groupId} />
      )}
    </main>
  );
}

/* ─────────── Mention-aware text renderer ─────────── */

function renderMentionText(
  text: string,
  fpDisplayMap: Map<string, string>,
  myFingerprint: string,
): React.ReactNode[] {
  const parts = text.split(/(@[a-f0-9]{8})/gi);
  return parts.map((part, i) => {
    const m = /^@([a-f0-9]{8})$/i.exec(part);
    if (m) {
      const fp = (m[1] ?? "").toLowerCase();
      const name = fpDisplayMap.get(fp) ?? fp;
      const isMe = fp === myFingerprint;
      return (
        <span
          key={i}
          className={
            "font-semibold rounded px-0.5 " +
            (isMe
              ? "bg-wa-green/25 text-wa-green"
              : "bg-white/10 text-text")
          }
        >
          @{name}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ─────────── Poll bubble ─────────── */

function PollBubble({
  msg,
  allMessages,
  myUserId,
  onVote,
  isMine,
}: {
  msg: GroupMessageRecord;
  allMessages: GroupMessageRecord[];
  myUserId: string;
  onVote: (pollId: string, choiceIdx: number) => void;
  isMine: boolean;
}) {
  const poll = msg.pollData!;

  const votesByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of allMessages) {
      if (m.pollVoteData?.pollId === poll.pollId) {
        if (m.pollVoteData.choiceIdx === -1) {
          map.delete(m.senderUserId);
        } else {
          map.set(m.senderUserId, m.pollVoteData.choiceIdx);
        }
      }
    }
    return map;
  }, [allMessages, poll.pollId]);

  const totalVotes = votesByUser.size;
  const myVote = votesByUser.get(myUserId) ?? -1;

  const counts = poll.choices.map((_, i) => {
    let c = 0;
    for (const v of votesByUser.values()) if (v === i) c++;
    return c;
  });

  return (
    <div
      className={
        "max-w-[82%] rounded-xl border shadow-sm overflow-hidden text-sm " +
        (isMine
          ? "self-end bg-wa-bubble-out border-wa-bubble-out/30"
          : "self-start bg-wa-bubble-in border-line/30")
      }
    >
      <div className="px-3 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wide font-medium mb-1">
          <span>📊</span>
          <span>Poll</span>
        </div>
        <div className="font-semibold text-text leading-snug">{poll.question}</div>
      </div>

      <div className="divide-y divide-white/5">
        {poll.choices.map((choice, idx) => {
          const count = counts[idx] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = myVote === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onVote(poll.pollId, voted ? -1 : idx)}
              className="w-full text-left px-3 py-2 hover:bg-white/5 relative overflow-hidden"
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
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

/* ─────────── Poll composer modal ─────────── */

function PollComposer({
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
        className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-line p-4 space-y-3 max-h-[90vh] overflow-y-auto"
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
            placeholder="Ask the group something…"
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

/* ─────────── Main inner component ─────────── */

function GroupChatInner({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const identity = useUnlockStore((s) => s.identity)!;
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const groupQuery = trpc.groups.get.useQuery({ groupId }, { retry: false });

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(0);

  const messages = useLiveQuery(
    () =>
      db.groupMessages
        .where("groupId")
        .equals(groupId)
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
        ),
    [groupId],
    [] as GroupMessageRecord[],
  );

  // Restore history once.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        await pollAndDecrypt(identity);
        const { messages: rows } =
          await trpcClientProxy().messages.fetchGroupHistory.query({
            groupId,
            limit: 200,
          });
        for (const m of rows) {
          await ingestGroupInboxMessage({
            id: m.id,
            senderUserId: m.senderUserId,
            header: m.header,
            ciphertext: m.ciphertext,
            createdAt: m.createdAt,
            expiresAt: m.expiresAt ?? null,
            groupId,
          });
        }
      } catch (e) {
        console.warn("Group history restore failed", e);
      }
    })();
  }, [groupId, identity]);

  // Ensure my sender key exists & is distributed.
  useEffect(() => {
    if (!groupQuery.data) return;
    void ensureMySenderKey(identity, groupQuery.data).catch(() => undefined);
  }, [groupQuery.data, identity]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  // memberMap: userId → display label (fingerprint or truncated id)
  const memberMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of groupQuery.data?.members ?? []) {
      m.set(mem.userId, mem.fingerprint || mem.userId.slice(0, 8) + "…");
    }
    return m;
  }, [groupQuery.data]);

  // fpDisplayMap: fingerprint → display string (for @mention rendering)
  const fpDisplayMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of groupQuery.data?.members ?? []) {
      const fp = mem.fingerprint?.toLowerCase() ?? "";
      if (fp) m.set(fp, fp);
    }
    return m;
  }, [groupQuery.data]);

  // My fingerprint (for highlighting own @mentions)
  const myFingerprint = useMemo(() => {
    const me = groupQuery.data?.members.find((m) => m.userId === userId);
    return me?.fingerprint?.toLowerCase() ?? "";
  }, [groupQuery.data, userId]);

  // Members list for autocomplete (everyone except me)
  const mentionableMembers = useMemo(
    () =>
      (groupQuery.data?.members ?? [])
        .filter((m) => m.userId !== userId)
        .map((m) => ({
          userId: m.userId,
          fingerprint: m.fingerprint?.toLowerCase() ?? m.userId.slice(0, 8),
        })),
    [groupQuery.data, userId],
  );

  // Filtered suggestions based on what's been typed after `@`
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionableMembers.filter((m) => m.fingerprint.startsWith(q));
  }, [mentionQuery, mentionableMembers]);

  // Detect @mention token as user types
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const cursor = e.target.selectionStart ?? val.length;
      setText(val);

      const textBefore = val.slice(0, cursor);
      const lastAt = textBefore.lastIndexOf("@");
      if (lastAt === -1) { setMentionQuery(null); return; }

      const charBefore = lastAt > 0 ? (textBefore[lastAt - 1] ?? " ") : " ";
      if (!/\s/.test(charBefore) && lastAt !== 0) { setMentionQuery(null); return; }

      const fragment = textBefore.slice(lastAt + 1);
      if (/^[a-f0-9]{0,8}$/i.test(fragment)) {
        setMentionQuery(fragment);
        setMentionAnchor(lastAt);
      } else {
        setMentionQuery(null);
      }
    },
    [],
  );

  // Insert chosen mention into textarea
  const insertMention = useCallback(
    (fingerprint: string) => {
      const cursor = textareaRef.current?.selectionStart ?? text.length;
      const before = text.slice(0, mentionAnchor);
      const after = text.slice(cursor);
      const inserted = `@${fingerprint} `;
      setText(before + inserted + after);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = (before + inserted).length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [text, mentionAnchor],
  );

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      await sendGroupText(identity, groupId, trimmed);
      setText("");
      setMentionQuery(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleCreatePoll(question: string, choices: string[]) {
    const pollId = crypto.randomUUID();
    await sendGroupPoll(identity, groupId, pollId, question, choices);
  }

  async function handleVote(pollId: string, choiceIdx: number) {
    try {
      await sendGroupPollVote(identity, groupId, pollId, choiceIdx);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed.");
    }
  }

  if (groupQuery.isLoading) {
    return (
      <>
        <AppBar title="Loading…" back="/groups" />
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </>
    );
  }
  if (groupQuery.error || !groupQuery.data) {
    return (
      <>
        <AppBar title="Group" back="/groups" />
        <div className="p-4">
          <ErrorMessage>
            {groupQuery.error?.message ?? "Couldn't load this group."}
          </ErrorMessage>
        </div>
      </>
    );
  }

  const group = groupQuery.data;

  return (
    <>
      <AppBar
        back="/groups"
        title={
          <button
            onClick={() => navigate(`/groups/${groupId}/settings`)}
            className="flex items-center gap-2 text-left"
          >
            <Avatar seed={group.id} size={36} />
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{group.name}</span>
              <span className="text-[11px] text-text-oncolor/70">
                {group.members.length} members · tap for info
              </span>
            </div>
          </button>
        }
        right={
          <IconButton
            label="Group info"
            onClick={() => navigate(`/groups/${groupId}/settings`)}
            className="text-text-oncolor"
          >
            <MoreVerticalIcon />
          </IconButton>
        }
      />

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 bg-bg"
      >
        <div className="self-center text-[11px] text-text-muted bg-panel border border-line rounded-full px-3 py-1 mb-2 inline-flex items-center gap-1">
          <LockIcon className="w-3 h-3" /> End-to-end encrypted · sender keys
        </div>

        {messages && messages.length === 0 ? (
          <EmptyState
            icon={<ChatIcon className="w-10 h-10" />}
            title="No messages yet"
            message="Say hi to the group — or create a poll!"
          />
        ) : (
          (messages ?? []).map((m) => {
            const mine = m.senderUserId === userId;
            const senderLabel =
              memberMap.get(m.senderUserId) ?? m.senderUserId.slice(0, 8) + "…";

            // Vote messages are silent — they update poll state only.
            if (m.pollVoteData) return null;

            // Poll bubble
            if (m.pollData) {
              return (
                <div
                  key={m.id ?? m.dedupKey}
                  className={"flex flex-col " + (mine ? "items-end" : "items-start")}
                >
                  {!mine && (
                    <span className="text-[11px] text-text-muted ml-2 mb-0.5 font-mono">
                      {senderLabel}
                    </span>
                  )}
                  <PollBubble
                    msg={m}
                    allMessages={messages ?? []}
                    myUserId={userId ?? ""}
                    onVote={handleVote}
                    isMine={mine}
                  />
                </div>
              );
            }

            // Regular text bubble
            return (
              <div key={m.id ?? m.dedupKey} className="flex flex-col">
                {!mine && (
                  <span className="text-[11px] text-text-muted ml-2 mb-0.5 font-mono">
                    {senderLabel}
                  </span>
                )}
                <MessageBubble
                  direction={mine ? "out" : "in"}
                  time={new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  status={mine ? m.status : undefined}
                >
                  {m.plaintext ? (
                    renderMentionText(m.plaintext, fpDisplayMap, myFingerprint)
                  ) : (
                    <span className="italic text-text-muted">[empty]</span>
                  )}
                </MessageBubble>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div className="px-3 py-1">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {/* @mention autocomplete dropdown */}
      {mentionQuery !== null && mentionSuggestions.length > 0 && (
        <div className="mx-2 mb-1 z-30 bg-surface border border-line rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto">
          {mentionSuggestions.map((m) => (
            <button
              key={m.userId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m.fingerprint);
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 font-mono text-text border-b border-line/40 last:border-b-0 flex items-center gap-2"
            >
              <Avatar seed={m.userId} size={22} />
              <span>@{m.fingerprint}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-line px-2 py-2 flex items-end gap-2">
        {/* Poll button */}
        <button
          type="button"
          onClick={() => setPollOpen(true)}
          className="size-10 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0 text-xl"
          aria-label="Create poll"
          title="Create poll"
        >
          📊
        </button>

        {/* Text area */}
        <div className="flex-1 bg-surface rounded-3xl px-4 py-2 flex items-end">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && text.trim()) void send();
              }
              if (e.key === "Escape") setMentionQuery(null);
            }}
            rows={1}
            placeholder="Message the group — type @ to mention"
            className="w-full bg-transparent text-text placeholder:text-text-muted resize-none outline-none max-h-32"
            style={{ minHeight: "24px" }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center hover:bg-wa-green-dark transition disabled:opacity-50 wa-tap shrink-0"
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>

      {/* Poll composer modal */}
      {pollOpen && (
        <PollComposer
          onClose={() => setPollOpen(false)}
          onSubmit={handleCreatePoll}
        />
      )}
    </>
  );
}
