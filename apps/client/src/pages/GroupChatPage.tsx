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
import {
  db,
  deleteGroupMessageById,
  setGroupMessageStarred,
  type GroupMessageRecord,
} from "../lib/db";
import {
  ensureMySenderKey,
  ingestGroupInboxMessage,
  sendGroupChat,
  sendGroupText,
  sendGroupPoll,
  sendGroupPollVote,
  sendGroupReaction,
  sendGroupEdit,
  sendGroupDeleteForEveryone,
} from "../lib/groupSync";
import type { ChatEnvelope } from "../lib/messageEnvelope";
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

  // Phase 1 parity state.
  const [replyTo, setReplyTo] = useState<GroupMessageRecord | null>(null);
  const [actionFor, setActionFor] = useState<GroupMessageRecord | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [starredOpen, setStarredOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  const inSelectionMode = selection.size > 0;
  const toggleSelected = useCallback((id: number) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelection(new Set()), []);

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
      if (replyTo && replyTo.serverId) {
        const env: ChatEnvelope = {
          v: 2,
          t: "text",
          body: trimmed,
          re: {
            id: replyTo.serverId,
            body: (replyTo.plaintext || "[attachment]").slice(0, 120),
          },
        };
        await sendGroupChat(identity, groupId, env);
      } else {
        await sendGroupText(identity, groupId, trimmed);
      }
      setText("");
      setReplyTo(null);
      setMentionQuery(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  /* ---- Per-message actions ---- */

  const handleReply = useCallback((m: GroupMessageRecord) => {
    setReplyTo(m);
    setActionFor(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleReact = useCallback(
    async (m: GroupMessageRecord, emoji: string) => {
      if (!m.serverId) {
        showToast("Wait for the message to send first.");
        return;
      }
      const mine = m.senderUserId === userId;
      const current = m.reactions?.[userId ?? ""] ?? "";
      // Toggling the same emoji clears it.
      const next = current === emoji ? "" : emoji;
      setActionFor(null);
      try {
        await sendGroupReaction(identity, groupId, m.serverId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reaction failed.");
      }
      void mine;
    },
    [identity, groupId, userId, showToast],
  );

  const handleStar = useCallback(
    async (m: GroupMessageRecord) => {
      if (m.id === undefined) return;
      await setGroupMessageStarred(m.id, !m.starred);
      setActionFor(null);
      showToast(m.starred ? "Unstarred" : "Starred");
    },
    [showToast],
  );

  const handleCopy = useCallback(
    async (m: GroupMessageRecord) => {
      try {
        await navigator.clipboard.writeText(m.plaintext || "");
        showToast("Copied");
      } catch {
        showToast("Copy failed");
      }
      setActionFor(null);
    },
    [showToast],
  );

  const handleDeleteForMe = useCallback(
    async (m: GroupMessageRecord) => {
      if (m.id === undefined) return;
      await deleteGroupMessageById(m.id);
      setActionFor(null);
    },
    [],
  );

  const handleUnsend = useCallback(
    async (m: GroupMessageRecord) => {
      setActionFor(null);
      try {
        await sendGroupDeleteForEveryone(identity, groupId, m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't unsend.");
      }
    },
    [identity, groupId],
  );

  /* ---- Bulk actions ---- */

  const bulkRows = useMemo(
    () => (messages ?? []).filter((m) => m.id !== undefined && selection.has(m.id)),
    [messages, selection],
  );

  const bulkDelete = useCallback(async () => {
    for (const m of bulkRows) {
      if (m.id !== undefined) await deleteGroupMessageById(m.id);
    }
    clearSelection();
  }, [bulkRows, clearSelection]);

  const bulkStar = useCallback(async () => {
    const allStarred = bulkRows.every((m) => m.starred);
    for (const m of bulkRows) {
      if (m.id !== undefined) await setGroupMessageStarred(m.id, !allStarred);
    }
    clearSelection();
    showToast(allStarred ? "Unstarred" : "Starred");
  }, [bulkRows, clearSelection, showToast]);

  const bulkCopy = useCallback(async () => {
    const blob = bulkRows
      .filter((m) => !m.deleted)
      .map((m) => m.plaintext)
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(blob);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
    clearSelection();
  }, [bulkRows, clearSelection, showToast]);

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
      {inSelectionMode ? (
        <AppBar
          title={
            <span className="text-sm font-medium">
              {selection.size} selected
            </span>
          }
          back={undefined as unknown as string}
          right={
            <div className="flex items-center gap-1">
              <IconButton
                label="Star"
                onClick={() => void bulkStar()}
                className="text-text-oncolor"
              >
                <span className="text-lg">★</span>
              </IconButton>
              <IconButton
                label="Copy"
                onClick={() => void bulkCopy()}
                className="text-text-oncolor"
              >
                <span className="text-base">⧉</span>
              </IconButton>
              <IconButton
                label="Delete"
                onClick={() => void bulkDelete()}
                className="text-text-oncolor"
              >
                <span className="text-base">🗑</span>
              </IconButton>
              <IconButton
                label="Cancel"
                onClick={clearSelection}
                className="text-text-oncolor"
              >
                <span className="text-lg">✕</span>
              </IconButton>
            </div>
          }
        />
      ) : (
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
            <div className="flex items-center gap-1">
              <IconButton
                label="Starred messages"
                onClick={() => setStarredOpen(true)}
                className="text-text-oncolor"
              >
                <span className="text-lg">★</span>
              </IconButton>
              <IconButton
                label="Group info"
                onClick={() => navigate(`/groups/${groupId}/settings`)}
                className="text-text-oncolor"
              >
                <MoreVerticalIcon />
              </IconButton>
            </div>
          }
        />
      )}

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

            const selected = m.id !== undefined && selection.has(m.id);
            const onRowClick = () => {
              if (inSelectionMode && m.id !== undefined) toggleSelected(m.id);
              else setActionFor(m);
            };
            const onRowLongPress = () => {
              if (m.id !== undefined) toggleSelected(m.id);
            };

            // Poll bubble
            if (m.pollData) {
              return (
                <div
                  key={m.id ?? m.dedupKey}
                  className={
                    "flex flex-col rounded-md transition-colors " +
                    (mine ? "items-end " : "items-start ") +
                    (selected ? "bg-wa-green/15" : "")
                  }
                  onClick={onRowClick}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onRowLongPress();
                  }}
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

            const reactionEntries = Object.entries(m.reactions ?? {});
            const reactionGroups = new Map<string, number>();
            for (const [, e] of reactionEntries) {
              reactionGroups.set(e, (reactionGroups.get(e) ?? 0) + 1);
            }
            const myReaction = m.reactions?.[userId ?? ""] ?? null;

            return (
              <div
                key={m.id ?? m.dedupKey}
                className={
                  "flex flex-col rounded-md transition-colors " +
                  (selected ? "bg-wa-green/15" : "")
                }
                onClick={onRowClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onRowLongPress();
                }}
              >
                {!mine && (
                  <span className="text-[11px] text-text-muted ml-2 mb-0.5 font-mono">
                    {senderLabel}
                  </span>
                )}
                <MessageBubble
                  direction={mine ? "out" : "in"}
                  time={
                    new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) + (m.editedAt ? " · edited" : "")
                  }
                  status={mine ? m.status : undefined}
                >
                  {m.deleted ? (
                    <span className="italic text-text-muted">
                      🚫 This message was deleted
                    </span>
                  ) : (
                    <>
                      {m.replyTo && (
                        <div className="mb-1 -mx-1 px-2 py-1 rounded-md bg-black/15 border-l-2 border-wa-green text-[11.5px] leading-snug">
                          <div className="text-wa-green font-medium">
                            {m.replyTo.senderUserId === userId
                              ? "You"
                              : memberMap.get(m.replyTo.senderUserId) ??
                                "Unknown"}
                          </div>
                          <div className="text-text-muted truncate max-w-[260px]">
                            {m.replyTo.body || "[message]"}
                          </div>
                        </div>
                      )}
                      {m.starred && (
                        <span className="inline-block mr-1 text-yellow-300">
                          ★
                        </span>
                      )}
                      {m.plaintext ? (
                        renderMentionText(
                          m.plaintext,
                          fpDisplayMap,
                          myFingerprint,
                        )
                      ) : (
                        <span className="italic text-text-muted">[empty]</span>
                      )}
                    </>
                  )}
                </MessageBubble>
                {reactionGroups.size > 0 && !m.deleted && (
                  <div
                    className={
                      "mt-1 flex gap-1 " + (mine ? "justify-end mr-2" : "ml-2")
                    }
                  >
                    {[...reactionGroups.entries()].map(([emo, count]) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          void handleReact(m, emo);
                        }}
                        className={
                          "px-1.5 py-0.5 rounded-full text-[11px] border " +
                          (myReaction === emo
                            ? "bg-wa-green/30 border-wa-green text-text"
                            : "bg-surface border-line/50 text-text")
                        }
                      >
                        {emo} {count > 1 ? count : ""}
                      </button>
                    ))}
                  </div>
                )}
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

      {/* Reply chip above composer */}
      {replyTo && (
        <div className="px-3 pt-2 -mb-1">
          <div className="bg-surface border-l-2 border-wa-green rounded-md px-3 py-2 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-wa-green font-medium">
                Replying to{" "}
                {replyTo.senderUserId === userId
                  ? "yourself"
                  : memberMap.get(replyTo.senderUserId) ?? "Unknown"}
              </div>
              <div className="text-xs text-text-muted truncate">
                {replyTo.deleted
                  ? "[deleted]"
                  : replyTo.plaintext || "[attachment]"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-text-muted hover:text-text px-1"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
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

      {/* Per-message action sheet */}
      {actionFor && (
        <MessageActionSheet
          msg={actionFor}
          mine={actionFor.senderUserId === userId}
          onClose={() => setActionFor(null)}
          onReply={() => handleReply(actionFor)}
          onReact={(emoji) => void handleReact(actionFor, emoji)}
          onStar={() => void handleStar(actionFor)}
          onCopy={() => void handleCopy(actionFor)}
          onSelect={() => {
            if (actionFor.id !== undefined) toggleSelected(actionFor.id);
            setActionFor(null);
          }}
          onDeleteForMe={() => void handleDeleteForMe(actionFor)}
          onUnsend={() => void handleUnsend(actionFor)}
        />
      )}

      {/* Starred messages sheet */}
      {starredOpen && (
        <StarredSheet
          groupId={groupId}
          memberMap={memberMap}
          fpDisplayMap={fpDisplayMap}
          myFingerprint={myFingerprint}
          myUserId={userId ?? ""}
          onClose={() => setStarredOpen(false)}
          onUnstar={(m) => {
            if (m.id !== undefined) void setGroupMessageStarred(m.id, false);
          }}
        />
      )}

      {/* Lightweight toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
          {toast}
        </div>
      )}
    </>
  );
}

/* ─────────── Action sheet (per-message) ─────────── */

const QUICK_REACTS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageActionSheet({
  msg,
  mine,
  onClose,
  onReply,
  onReact,
  onStar,
  onCopy,
  onSelect,
  onDeleteForMe,
  onUnsend,
}: {
  msg: GroupMessageRecord;
  mine: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onStar: () => void;
  onCopy: () => void;
  onSelect: () => void;
  onDeleteForMe: () => void;
  onUnsend: () => void;
}) {
  const canCopy = !!msg.plaintext && !msg.deleted;
  const canReply = !msg.deleted && !!msg.serverId;
  const canReact = !msg.deleted && !!msg.serverId;
  const canUnsend = mine && !!msg.serverId && !msg.deleted;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl border-t border-line p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {canReact && (
          <div className="flex justify-around py-1">
            {QUICK_REACTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className="text-2xl size-11 rounded-full hover:bg-white/10 flex items-center justify-center"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="divide-y divide-line/40">
          {canReply && (
            <SheetItem icon="↩" label="Reply" onClick={onReply} />
          )}
          <SheetItem
            icon={msg.starred ? "★" : "☆"}
            label={msg.starred ? "Unstar" : "Star"}
            onClick={onStar}
          />
          {canCopy && <SheetItem icon="⧉" label="Copy" onClick={onCopy} />}
          <SheetItem icon="☑" label="Select" onClick={onSelect} />
          <SheetItem
            icon="🗑"
            label="Delete for me"
            onClick={onDeleteForMe}
            danger
          />
          {canUnsend && (
            <SheetItem
              icon="🚫"
              label="Unsend for everyone"
              onClick={onUnsend}
              danger
            />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center py-2 text-sm text-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SheetItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full px-3 py-3 text-left flex items-center gap-3 text-sm hover:bg-white/5 " +
        (danger ? "text-red-400" : "text-text")
      }
    >
      <span className="w-6 text-center text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ─────────── Starred messages sheet ─────────── */

function StarredSheet({
  groupId,
  memberMap,
  fpDisplayMap,
  myFingerprint,
  myUserId,
  onClose,
  onUnstar,
}: {
  groupId: string;
  memberMap: Map<string, string>;
  fpDisplayMap: Map<string, string>;
  myFingerprint: string;
  myUserId: string;
  onClose: () => void;
  onUnstar: (m: GroupMessageRecord) => void;
}) {
  const rows = useLiveQuery(
    () =>
      db.groupMessages
        .where("groupId")
        .equals(groupId)
        .filter((m) => m.starred === true)
        .toArray()
        .then((r) => r.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))),
    [groupId],
    [] as GroupMessageRecord[],
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-line max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="font-semibold text-text flex items-center gap-2">
            <span className="text-yellow-300">★</span> Starred messages
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text px-1"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          {rows.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-12">
              No starred messages yet. Long-press a message to star it.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((m) => (
                <li
                  key={m.id ?? m.dedupKey}
                  className="bg-bg border border-line rounded-lg p-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
                    <span className="font-mono">
                      {m.senderUserId === myUserId
                        ? "You"
                        : memberMap.get(m.senderUserId) ??
                          m.senderUserId.slice(0, 8) + "…"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUnstar(m)}
                      className="text-yellow-300 hover:text-yellow-400"
                      title="Unstar"
                    >
                      ★
                    </button>
                  </div>
                  <div className="text-sm text-text break-words">
                    {m.deleted ? (
                      <span className="italic text-text-muted">
                        🚫 deleted
                      </span>
                    ) : (
                      renderMentionText(
                        m.plaintext || "[message]",
                        fpDisplayMap,
                        myFingerprint,
                      )
                    )}
                  </div>
                  <div className="text-[10.5px] text-text-muted mt-1">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
