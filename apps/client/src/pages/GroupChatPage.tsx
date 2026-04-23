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
  UnlockIcon,
  SendIcon,
  SearchIcon,
  PaperclipIcon,
  MicIcon,
  StarIcon,
  CopyIcon,
  TrashIcon,
  InfoIcon,
  TimerIcon,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import { EmojiPicker } from "../components/EmojiPicker";
import {
  db,
  deleteGroupMessageById,
  setGroupMessageStarred,
  setGroupMessagePinned,
  clearGroupHistory,
  getChatPref,
  setChatPref,
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
import { sendChatEnvelope } from "../lib/messageSync";
import {
  type ChatEnvelope,
  type EnvelopeLinkPreview,
  firstUrl,
} from "../lib/messageEnvelope";
import { pollAndDecrypt } from "../lib/messageSync";
import {
  uploadEncryptedMedia,
  downscaleImage,
  makeThumbnail,
  type MediaAttachment,
} from "../lib/media";
import {
  biometricSupported,
  registerBiometricCredential,
  verifyBiometric,
} from "../lib/biometric";
import {
  ImageAttachment,
  VoiceAttachment,
  LinkPreviewBlock,
  LinkPreviewCard,
  PinnedMessageBanner,
  MessageInfoDialog,
  EditMessageDialog,
  RecordingBar,
  startRecording,
  type RecordingState,
  TTL_OPTIONS,
  MAX_IMAGE_BYTES,
  EDIT_WINDOW_MS,
  ttlRemainingLabel,
} from "./ChatThreadPage";

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

  // Group prefs are stored under a namespaced peerId so they share the
  // existing chatPrefs table without colliding with 1:1 chats.
  const prefKey = `g:${groupId}`;

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
  const [editFor, setEditFor] = useState<GroupMessageRecord | null>(null);
  const [infoFor, setInfoFor] = useState<GroupMessageRecord | null>(null);
  const [forwardFor, setForwardFor] = useState<GroupMessageRecord | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [starredOpen, setStarredOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ttlPickerOpen, setTtlPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Per-thread prefs (TTL, biometric, etc.) loaded from chatPrefs.
  const [ttlSeconds, setTtlSecondsState] = useState(0);
  const [bioCredId, setBioCredId] = useState<string | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Composer extras
  const [pendingPreview, setPendingPreview] =
    useState<EnvelopeLinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    void getChatPref(prefKey).then((p) => {
      setTtlSecondsState(p?.ttlSeconds ?? 0);
      setBioCredId(p?.biometricCredentialId);
      setUnlocked(!p?.biometricCredentialId);
    });
  }, [prefKey]);

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

  // Pinned banner (one per thread).
  const pinnedMessage = useMemo(
    () => (messages ?? []).find((m) => m.pinned && !m.deleted) ?? null,
    [messages],
  );

  // Filtered list (search).
  const filteredMessages = useMemo(() => {
    if (!searchOpen || !searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return (messages ?? []).filter((m) =>
      (m.plaintext ?? "").toLowerCase().includes(q),
    );
  }, [messages, searchOpen, searchQuery]);

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

  // Re-render every 30s to refresh TTL countdowns.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Detect URL in draft → fetch link preview lazily.
  useEffect(() => {
    const url = firstUrl(text);
    if (!url) {
      setPendingPreview(null);
      return;
    }
    if (pendingPreview && pendingPreview.url === url) return;
    setPreviewLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const lp = await trpcClientProxy().linkPreview.fetch.mutate({ url });
        if (cancelled) return;
        setPendingPreview({
          url: lp.url,
          resolvedUrl: lp.resolvedUrl,
          title: lp.title,
          description: lp.description,
          siteName: lp.siteName,
          imageUrl: lp.imageUrl,
        });
      } catch {
        if (!cancelled) setPendingPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

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

  /* ---- Send handlers ---- */

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const env: ChatEnvelope = { v: 2, t: "text", body: trimmed };
      if (replyTo && replyTo.serverId) {
        env.re = {
          id: replyTo.serverId,
          body: (replyTo.plaintext || "[attachment]").slice(0, 120),
          dir: replyTo.senderUserId === userId ? "out" : "in",
        };
      }
      if (ttlSeconds > 0) env.ttl = ttlSeconds;
      if (pendingPreview) env.lp = pendingPreview;
      await sendGroupChat(identity, groupId, env);
      setText("");
      setReplyTo(null);
      setMentionQuery(null);
      setPendingPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function onPickImage(file: File) {
    setSending(true);
    setError(null);
    try {
      const caption = text.trim();
      const down = await downscaleImage(file);
      if (down.bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error("Image is too large after compression (max 8 MB).");
      }
      const thumb = await makeThumbnail(
        new Blob([down.bytes.slice().buffer], { type: down.mime }),
      );
      const upload = await uploadEncryptedMedia(down.bytes, down.mime);
      const media: MediaAttachment = {
        kind: "image",
        blobId: upload.blobId,
        key: upload.key,
        mime: down.mime,
        sizeBytes: upload.sizeBytes,
        width: down.width,
        height: down.height,
        thumbB64: thumb?.thumbB64,
      };
      const env: ChatEnvelope = {
        v: 2,
        t: "image",
        ...(caption ? { body: caption } : {}),
        media,
      };
      if (ttlSeconds > 0) env.ttl = ttlSeconds;
      if (replyTo && replyTo.serverId) {
        env.re = {
          id: replyTo.serverId,
          body: (replyTo.plaintext || "[attachment]").slice(0, 120),
          dir: replyTo.senderUserId === userId ? "out" : "in",
        };
      }
      await sendGroupChat(identity, groupId, env);
      setText("");
      setReplyTo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send image.");
    } finally {
      setSending(false);
    }
  }

  async function onSendVoice(bytes: Uint8Array, mime: string, durationMs: number) {
    setSending(true);
    setError(null);
    try {
      const upload = await uploadEncryptedMedia(bytes, mime);
      const media: MediaAttachment = {
        kind: "voice",
        blobId: upload.blobId,
        key: upload.key,
        mime,
        sizeBytes: upload.sizeBytes,
        durationMs,
      };
      const env: ChatEnvelope = { v: 2, t: "voice", media };
      if (ttlSeconds > 0) env.ttl = ttlSeconds;
      await sendGroupChat(identity, groupId, env);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send voice note.");
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
      const current = m.reactions?.[userId ?? ""] ?? "";
      const next = current === emoji ? "" : emoji;
      setActionFor(null);
      try {
        await sendGroupReaction(identity, groupId, m.serverId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reaction failed.");
      }
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

  const handlePin = useCallback(
    async (m: GroupMessageRecord) => {
      if (m.id === undefined) return;
      await setGroupMessagePinned(m.id, groupId, !m.pinned);
      setActionFor(null);
      showToast(m.pinned ? "Unpinned" : "Pinned");
    },
    [groupId, showToast],
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

  async function handleEditSubmit(newBody: string) {
    if (!editFor || !editFor.serverId) return;
    try {
      await sendGroupEdit(identity, groupId, editFor, newBody);
      setEditFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed.");
    }
  }

  async function handleBlockSender(senderUserId: string) {
    if (!confirm("Block this sender? You won't see their messages anymore.")) return;
    try {
      await trpcClientProxy().privacy.block.mutate({ peerId: senderUserId });
      showToast("Blocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Block failed.");
    }
  }

  async function handleReportSender(senderUserId: string) {
    const note = prompt("Add details (optional):") ?? "";
    try {
      await trpcClientProxy().privacy.report.mutate({
        peerId: senderUserId,
        reason: "other",
        ...(note ? { note } : {}),
      });
      showToast("Reported");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed.");
    }
  }

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

  async function applyTtl(secs: number) {
    setTtlSecondsState(secs);
    await setChatPref(prefKey, { ttlSeconds: secs });
    setTtlPickerOpen(false);
    showToast(secs > 0 ? `Disappearing in ${ttlLabel(secs)}` : "Disappearing off");
  }

  async function onToggleBiometric() {
    if (bioCredId) {
      if (!confirm("Remove biometric lock from this group?")) return;
      await setChatPref(prefKey, { biometricCredentialId: undefined });
      setBioCredId(undefined);
      return;
    }
    if (!biometricSupported()) {
      alert("Biometric unlock isn't supported on this device.");
      return;
    }
    try {
      const credId = await registerBiometricCredential(
        `veil:g:${groupId}`,
        groupQuery.data?.name ?? "Group",
      );
      await setChatPref(prefKey, { biometricCredentialId: credId });
      setBioCredId(credId);
      alert("Biometric lock enabled for this group.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not enable biometric lock.");
    }
  }

  function onScrollToMessage(serverId: string) {
    const el = document.querySelector(`[data-server-id="${serverId}"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-wa-green");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-wa-green"), 1500);
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

  if (!unlocked && bioCredId) {
    return (
      <>
        <AppBar
          title={
            <div className="flex items-center gap-2">
              <Avatar seed={group.id} size={36} />
              <div className="font-semibold text-base truncate">{group.name}</div>
            </div>
          }
          back="/groups"
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <LockIcon className="w-12 h-12 text-text-muted" />
          <div className="text-text font-semibold">Group is locked</div>
          <div className="text-sm text-text-muted max-w-xs">
            Use your device biometrics to view this conversation.
          </div>
          {bioError && <ErrorMessage>{bioError}</ErrorMessage>}
          <button
            onClick={async () => {
              setBioError(null);
              const ok = await verifyBiometric(bioCredId);
              if (ok) setUnlocked(true);
              else setBioError("Authentication failed.");
            }}
            className="px-4 py-2 rounded-full bg-wa-green text-text-oncolor font-medium"
          >
            Unlock
          </button>
        </div>
      </>
    );
  }

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
              <IconButton label="Star" onClick={() => void bulkStar()} className="text-text-oncolor">
                <StarIcon className="w-5 h-5" />
              </IconButton>
              <IconButton label="Copy" onClick={() => void bulkCopy()} className="text-text-oncolor">
                <CopyIcon className="w-5 h-5" />
              </IconButton>
              <IconButton label="Delete" onClick={() => void bulkDelete()} className="text-text-oncolor">
                <TrashIcon className="w-5 h-5" />
              </IconButton>
              <IconButton label="Cancel" onClick={clearSelection} className="text-text-oncolor">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
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
                <span className="text-[11px] text-text-oncolor/70 truncate inline-flex items-center gap-1">
                  <span>{group.members.length} members</span>
                  {ttlSeconds > 0 && (
                    <>
                      <span>·</span>
                      <TimerIcon className="w-3 h-3" />
                      <span>{ttlLabel(ttlSeconds)}</span>
                    </>
                  )}
                  {bioCredId && (
                    <>
                      <span>·</span>
                      <LockIcon className="w-3 h-3" />
                    </>
                  )}
                </span>
              </div>
            </button>
          }
          right={
            <div className="flex items-center gap-1">
              <IconButton
                label="Search"
                onClick={() => setSearchOpen((v) => !v)}
                className="text-text-oncolor"
              >
                <SearchIcon />
              </IconButton>
              <IconButton
                label="More"
                onClick={() => setMenuOpen(true)}
                className="text-text-oncolor"
              >
                <MoreVerticalIcon />
              </IconButton>
            </div>
          }
        />
      )}

      {pinnedMessage && (
        <PinnedMessageBanner
          row={pinnedMessage}
          onJump={() => pinnedMessage.serverId && onScrollToMessage(pinnedMessage.serverId)}
          onUnpin={async () => {
            if (pinnedMessage.id !== undefined)
              await setGroupMessagePinned(pinnedMessage.id, groupId, false);
          }}
        />
      )}

      {searchOpen && (
        <div className="px-3 py-2 bg-panel border-b border-line flex items-center gap-2">
          <SearchIcon className="text-text-muted" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in this group…"
            className="flex-1 bg-transparent text-text placeholder:text-text-muted outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="text-text-muted text-xs px-2 py-1"
          >
            Close
          </button>
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 bg-bg"
      >
        <div className="self-center text-[11px] text-text-muted bg-panel border border-line rounded-full px-3 py-1 mb-2 inline-flex items-center gap-1">
          <LockIcon className="w-3 h-3" /> End-to-end encrypted · sender keys
        </div>

        {filteredMessages && filteredMessages.length === 0 ? (
          <EmptyState
            icon={<ChatIcon className="w-10 h-10" />}
            title={searchOpen && searchQuery ? "No matches" : "No messages yet"}
            message={
              searchOpen && searchQuery
                ? "Try a different word."
                : "Say hi to the group — or create a poll!"
            }
          />
        ) : (
          (filteredMessages ?? []).map((m) => {
            // Vote messages are silent — they update poll state only.
            if (m.pollVoteData) return null;

            const mine = m.senderUserId === userId;
            const senderLabel =
              memberMap.get(m.senderUserId) ?? m.senderUserId.slice(0, 8) + "…";
            const selected = m.id !== undefined && selection.has(m.id);

            return (
              <MessageRowSwipe
                key={m.id ?? m.dedupKey}
                m={m}
                mine={mine}
                selected={selected}
                inSelectionMode={inSelectionMode}
                onTap={() => {
                  if (inSelectionMode && m.id !== undefined) toggleSelected(m.id);
                  else setActionFor(m);
                }}
                onLongPress={() => {
                  if (m.id !== undefined) toggleSelected(m.id);
                }}
                onSwipeReply={() => handleReply(m)}
              >
                {!mine && (
                  <span className="text-[11px] text-text-muted ml-2 mb-0.5 font-mono">
                    {senderLabel}
                  </span>
                )}
                {m.pollData ? (
                  <PollBubble
                    msg={m}
                    allMessages={messages ?? []}
                    myUserId={userId ?? ""}
                    onVote={handleVote}
                    isMine={mine}
                  />
                ) : (
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
                          <span className="inline-block mr-1 text-yellow-300">★</span>
                        )}
                        {m.pinned && (
                          <span className="inline-block mr-1 text-wa-green">📌</span>
                        )}
                        {m.attachment?.kind === "image" && (
                          <ImageAttachment att={m.attachment} />
                        )}
                        {m.attachment?.kind === "voice" && (
                          <VoiceAttachment att={m.attachment} />
                        )}
                        {m.plaintext ? (
                          <div className={m.attachment ? "mt-1" : undefined}>
                            {renderMentionText(m.plaintext, fpDisplayMap, myFingerprint)}
                          </div>
                        ) : !m.attachment ? (
                          <span className="italic text-text-muted">[empty]</span>
                        ) : null}
                        {m.linkPreview && (
                          <LinkPreviewBlock preview={m.linkPreview} />
                        )}
                        {ttlRemainingLabel(m.expiresAt) && (
                          <span className="ml-1 text-[10px] text-text-muted">
                            ⏱ {ttlRemainingLabel(m.expiresAt)}
                          </span>
                        )}
                      </>
                    )}
                  </MessageBubble>
                )}
                <Reactions
                  m={m}
                  mine={mine}
                  myUserId={userId ?? ""}
                  onReact={(emo) => void handleReact(m, emo)}
                />
              </MessageRowSwipe>
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

      {/* Compose link preview card */}
      {pendingPreview && (
        <LinkPreviewCard
          preview={pendingPreview}
          loading={previewLoading}
          onDismiss={() => setPendingPreview(null)}
        />
      )}

      {/* Composer */}
      <Composer
        text={text}
        sending={sending}
        onTextChange={handleTextChange}
        textareaRef={textareaRef}
        onSend={() => void send()}
        onPickImage={(f) => void onPickImage(f)}
        onSendVoice={(b, m, d) => void onSendVoice(b, m, d)}
        onPoll={() => setPollOpen(true)}
        onMentionEscape={() => setMentionQuery(null)}
        onPickEmoji={(e) => setText(text + e)}
      />

      {/* Poll composer modal */}
      {pollOpen && (
        <PollComposer onClose={() => setPollOpen(false)} onSubmit={handleCreatePoll} />
      )}

      {/* Per-message action sheet */}
      {actionFor && (
        <MessageActionSheet
          msg={actionFor}
          mine={actionFor.senderUserId === userId}
          editable={
            actionFor.senderUserId === userId &&
            !!actionFor.serverId &&
            !actionFor.deleted &&
            !!actionFor.plaintext &&
            Date.now() - new Date(actionFor.createdAt).getTime() < EDIT_WINDOW_MS
          }
          onClose={() => setActionFor(null)}
          onReply={() => handleReply(actionFor)}
          onReact={(emoji) => void handleReact(actionFor, emoji)}
          onStar={() => void handleStar(actionFor)}
          onPin={() => void handlePin(actionFor)}
          onForward={() => {
            setForwardFor(actionFor);
            setActionFor(null);
          }}
          onCopy={() => void handleCopy(actionFor)}
          onSelect={() => {
            if (actionFor.id !== undefined) toggleSelected(actionFor.id);
            setActionFor(null);
          }}
          onInfo={() => {
            setInfoFor(actionFor);
            setActionFor(null);
          }}
          onEdit={() => {
            setEditFor(actionFor);
            setActionFor(null);
          }}
          onDeleteForMe={() => void handleDeleteForMe(actionFor)}
          onUnsend={() => void handleUnsend(actionFor)}
          onBlockSender={() => {
            const sid = actionFor.senderUserId;
            setActionFor(null);
            void handleBlockSender(sid);
          }}
          onReportSender={() => {
            const sid = actionFor.senderUserId;
            setActionFor(null);
            void handleReportSender(sid);
          }}
        />
      )}

      {/* Edit dialog */}
      {editFor && (
        <EditMessageDialog
          row={editFor}
          onClose={() => setEditFor(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Info dialog */}
      {infoFor && (
        <MessageInfoDialog row={infoFor} onClose={() => setInfoFor(null)} />
      )}

      {/* Forward picker */}
      {forwardFor && (
        <ForwardPicker
          msg={forwardFor}
          identity={identity}
          fromGroupId={groupId}
          onClose={() => setForwardFor(null)}
          onForwarded={() => {
            setForwardFor(null);
            showToast("Forwarded");
          }}
        />
      )}

      {/* Group menu */}
      {menuOpen && (
        <GroupMenu
          onClose={() => setMenuOpen(false)}
          ttlLabel={ttlSeconds > 0 ? ttlLabel(ttlSeconds) : "Off"}
          onTTL={() => {
            setMenuOpen(false);
            setTtlPickerOpen(true);
          }}
          biometricEnabled={!!bioCredId}
          onToggleBiometric={() => {
            setMenuOpen(false);
            void onToggleBiometric();
          }}
          onSearch={() => {
            setMenuOpen(false);
            setSearchOpen(true);
          }}
          onShowStarred={() => {
            setMenuOpen(false);
            setStarredOpen(true);
          }}
          onClearChat={async () => {
            setMenuOpen(false);
            if (confirm("Clear all messages from this group on this device?")) {
              await clearGroupHistory(groupId);
              showToast("Cleared");
            }
          }}
          onGroupInfo={() => {
            setMenuOpen(false);
            navigate(`/groups/${groupId}/settings`);
          }}
        />
      )}

      {/* TTL picker */}
      {ttlPickerOpen && (
        <TtlPicker
          current={ttlSeconds}
          onClose={() => setTtlPickerOpen(false)}
          onPick={(s) => void applyTtl(s)}
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

/* ─────────── Composer ─────────── */

function Composer({
  text,
  sending,
  onTextChange,
  textareaRef,
  onSend,
  onPickImage,
  onSendVoice,
  onPoll,
  onMentionEscape,
  onPickEmoji,
}: {
  text: string;
  sending: boolean;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.Ref<HTMLTextAreaElement>;
  onSend: () => void;
  onPickImage: (f: File) => void;
  onSendVoice: (bytes: Uint8Array, mime: string, durationMs: number) => void;
  onPoll: () => void;
  onMentionEscape: () => void;
  onPickEmoji: (e: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  if (recording) {
    return (
      <RecordingBar
        rec={recording}
        onCancel={() => {
          recording.cancel();
          setRecording(null);
        }}
        onSend={async () => {
          const result = await recording.finish();
          setRecording(null);
          if (result) onSendVoice(result.bytes, result.mime, result.durationMs);
        }}
      />
    );
  }

  return (
    <div className="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-line">
      {emojiOpen && (
        <div className="px-2 pb-2 pt-1">
          <EmojiPicker
            onPick={(e) => onPickEmoji(e)}
            onClose={() => setEmojiOpen(false)}
          />
        </div>
      )}
      <div className="px-2 py-2 flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickImage(f);
            e.target.value = "";
          }}
        />
        {/* Poll */}
        <button
          type="button"
          onClick={onPoll}
          className="size-10 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0 text-xl"
          aria-label="Create poll"
          title="Create poll"
        >
          📊
        </button>
        <div className="flex-1 bg-surface rounded-3xl px-2 py-1 flex items-end gap-1">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className={
              "size-9 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0 text-xl " +
              (emojiOpen ? "text-wa-green" : "text-text-muted hover:text-text")
            }
            aria-label="Open emoji picker"
            aria-expanded={emojiOpen}
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={sending}
            className="size-9 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0 disabled:opacity-50"
            aria-label="Attach image"
            title="Image"
          >
            <PaperclipIcon className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={onTextChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && text.trim()) onSend();
              }
              if (e.key === "Escape") onMentionEscape();
            }}
            rows={1}
            placeholder="Message the group — type @ to mention"
            className="flex-1 bg-transparent text-text placeholder:text-text-muted resize-none outline-none max-h-32 py-1.5 px-1"
            style={{ minHeight: "24px" }}
          />
        </div>
        {text.trim() ? (
          <button
            onClick={onSend}
            disabled={sending}
            className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center hover:bg-wa-green-dark transition disabled:opacity-50 wa-tap shrink-0"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        ) : (
          <button
            onClick={async () => {
              const r = await startRecording();
              if (r.kind === "ok") setRecording(r.state);
              else alert(r.message);
            }}
            disabled={sending}
            className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center hover:bg-wa-green-dark transition disabled:opacity-50 wa-tap shrink-0"
            aria-label="Record voice message"
          >
            <MicIcon className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────── Swipe-to-reply row wrapper ─────────── */

function MessageRowSwipe({
  m,
  mine,
  selected,
  inSelectionMode,
  onTap,
  onLongPress,
  onSwipeReply,
  children,
}: {
  m: GroupMessageRecord;
  mine: boolean;
  selected: boolean;
  inSelectionMode: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const moved = useRef(false);

  const startPress = () => {
    moved.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (!moved.current) onLongPress();
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div
      data-server-id={m.serverId ?? undefined}
      className={
        "flex flex-col rounded-md transition-colors relative " +
        (mine ? "items-end " : "items-start ") +
        (selected ? "bg-wa-green/15" : "")
      }
      onClick={() => {
        if (Math.abs(dx) < 8) onTap();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      onTouchStart={(e) => {
        startX.current = e.touches[0]?.clientX ?? null;
        startPress();
      }}
      onTouchMove={(e) => {
        if (startX.current === null) return;
        const x = e.touches[0]?.clientX ?? startX.current;
        const delta = x - startX.current;
        if (Math.abs(delta) > 6) {
          moved.current = true;
          cancelPress();
        }
        // Only allow swiping inward (right for incoming, left for outgoing)
        const allowed = mine ? Math.min(0, delta) : Math.max(0, delta);
        setDx(Math.max(-80, Math.min(80, allowed)));
      }}
      onTouchEnd={() => {
        cancelPress();
        if (Math.abs(dx) > 50 && !inSelectionMode) onSwipeReply();
        setDx(0);
        startX.current = null;
      }}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
    >
      {Math.abs(dx) > 12 && (
        <span
          className={
            "absolute top-1/2 -translate-y-1/2 text-wa-green text-lg " +
            (mine ? "right-[-28px]" : "left-[-28px]")
          }
          aria-hidden="true"
        >
          ↩
        </span>
      )}
      {children}
    </div>
  );
}

/* ─────────── Reactions row ─────────── */

function Reactions({
  m,
  mine,
  myUserId,
  onReact,
}: {
  m: GroupMessageRecord;
  mine: boolean;
  myUserId: string;
  onReact: (emo: string) => void;
}) {
  if (m.deleted) return null;
  const entries = Object.entries(m.reactions ?? {});
  if (entries.length === 0) return null;
  const groups = new Map<string, number>();
  for (const [, e] of entries) groups.set(e, (groups.get(e) ?? 0) + 1);
  const myReaction = m.reactions?.[myUserId] ?? null;
  return (
    <div className={"mt-1 flex gap-1 " + (mine ? "justify-end mr-2" : "ml-2")}>
      {[...groups.entries()].map(([emo, count]) => (
        <button
          key={emo}
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onReact(emo);
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
  );
}

/* ─────────── Action sheet (per-message) ─────────── */

const QUICK_REACTS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageActionSheet({
  msg,
  mine,
  editable,
  onClose,
  onReply,
  onReact,
  onStar,
  onPin,
  onForward,
  onCopy,
  onSelect,
  onInfo,
  onEdit,
  onDeleteForMe,
  onUnsend,
  onBlockSender,
  onReportSender,
}: {
  msg: GroupMessageRecord;
  mine: boolean;
  editable: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onStar: () => void;
  onPin: () => void;
  onForward: () => void;
  onCopy: () => void;
  onSelect: () => void;
  onInfo: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onUnsend: () => void;
  onBlockSender: () => void;
  onReportSender: () => void;
}) {
  const canCopy = !!msg.plaintext && !msg.deleted;
  const canReply = !msg.deleted && !!msg.serverId;
  const canReact = !msg.deleted && !!msg.serverId;
  const canForward = !msg.deleted && !!msg.serverId;
  const canPin = !msg.deleted && !!msg.serverId;
  const canUnsend = mine && !!msg.serverId && !msg.deleted;
  const canModerate = !mine && !msg.deleted;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl border-t border-line p-3 space-y-2 max-h-[85vh] overflow-y-auto"
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
          {canReply && <SheetItem icon="↩" label="Reply" onClick={onReply} />}
          {canForward && <SheetItem icon="➦" label="Forward" onClick={onForward} />}
          <SheetItem
            icon={msg.starred ? "★" : "☆"}
            label={msg.starred ? "Unstar" : "Star"}
            onClick={onStar}
          />
          {canPin && (
            <SheetItem
              icon="📌"
              label={msg.pinned ? "Unpin" : "Pin"}
              onClick={onPin}
            />
          )}
          {editable && <SheetItem icon="✎" label="Edit" onClick={onEdit} />}
          {canCopy && <SheetItem icon="⧉" label="Copy" onClick={onCopy} />}
          <SheetItem icon="ℹ" label="Info" onClick={onInfo} />
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
          {canModerate && (
            <>
              <SheetItem icon="⛔" label="Block sender" onClick={onBlockSender} danger />
              <SheetItem icon="🚩" label="Report sender" onClick={onReportSender} danger />
            </>
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
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full px-4 py-3 text-left flex items-center gap-3 text-sm border-b border-line/40 last:border-b-0 hover:bg-white/5 " +
        (danger ? "text-red-400" : "text-text")
      }
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

/* ─────────── Group menu ─────────── */

function GroupMenu({
  onClose,
  ttlLabel,
  onTTL,
  biometricEnabled,
  onToggleBiometric,
  onSearch,
  onShowStarred,
  onClearChat,
  onGroupInfo,
}: {
  onClose: () => void;
  ttlLabel: string;
  onTTL: () => void;
  biometricEnabled: boolean;
  onToggleBiometric: () => void;
  onSearch: () => void;
  onShowStarred: () => void;
  onClearChat: () => void;
  onGroupInfo: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-panel w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetItem
          icon={<InfoIcon className="w-5 h-5" />}
          label="Group info"
          onClick={onGroupInfo}
        />
        <SheetItem
          icon={<SearchIcon className="w-5 h-5" />}
          label="Search in group"
          onClick={onSearch}
        />
        <SheetItem
          icon={<StarIcon className="w-5 h-5" />}
          label="Starred messages"
          onClick={onShowStarred}
        />
        <SheetItem
          icon={<TimerIcon className="w-5 h-5" />}
          label={`Disappearing messages · ${ttlLabel}`}
          onClick={onTTL}
        />
        <SheetItem
          icon={
            biometricEnabled ? (
              <UnlockIcon className="w-5 h-5" />
            ) : (
              <LockIcon className="w-5 h-5" />
            )
          }
          label={
            biometricEnabled
              ? "Remove biometric lock"
              : "Lock chat with biometrics"
          }
          onClick={onToggleBiometric}
          danger={biometricEnabled}
        />
        <SheetItem
          icon={<TrashIcon className="w-5 h-5" />}
          label="Clear chat"
          onClick={onClearChat}
          danger
        />
      </div>
    </div>
  );
}

/* ─────────── TTL picker ─────────── */

function ttlLabel(secs: number): string {
  return TTL_OPTIONS.find((o) => o.seconds === secs)?.label ?? `${secs}s`;
}

function TtlPicker({
  current,
  onClose,
  onPick,
}: {
  current: number;
  onClose: () => void;
  onPick: (secs: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl border border-line p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 text-sm font-semibold text-text">
          Disappearing messages
        </div>
        <div className="divide-y divide-line/40">
          {TTL_OPTIONS.map((o) => (
            <button
              key={o.seconds}
              type="button"
              onClick={() => onPick(o.seconds)}
              className={
                "w-full px-4 py-3 text-left text-sm flex items-center justify-between " +
                (o.seconds === current
                  ? "bg-wa-green/15 text-text"
                  : "text-text hover:bg-white/5")
              }
            >
              <span>{o.label}</span>
              {o.seconds === current && (
                <span className="text-wa-green">✓</span>
              )}
            </button>
          ))}
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

/* ─────────── Forward picker ─────────── */

function ForwardPicker({
  msg,
  identity,
  fromGroupId,
  onClose,
  onForwarded,
}: {
  msg: GroupMessageRecord;
  identity: ReturnType<typeof useUnlockStore.getState>["identity"];
  fromGroupId: string;
  onClose: () => void;
  onForwarded: () => void;
}) {
  const conns = trpc.connections.list.useQuery();
  const groups = trpc.groups.list.useQuery();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buildEnvelope(): Promise<ChatEnvelope> {
    if (msg.attachment?.kind === "image") {
      return {
        v: 2,
        t: "image",
        ...(msg.plaintext ? { body: msg.plaintext } : {}),
        media: msg.attachment as MediaAttachment,
      };
    }
    if (msg.attachment?.kind === "voice") {
      return { v: 2, t: "voice", media: msg.attachment as MediaAttachment };
    }
    return { v: 2, t: "text", body: msg.plaintext || "" };
  }

  async function forwardToPeer(peerId: string) {
    if (!identity) return;
    setBusy(true);
    setErr(null);
    try {
      const env = await buildEnvelope();
      await sendChatEnvelope(identity, peerId, env);
      onForwarded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Forward failed.");
    } finally {
      setBusy(false);
    }
  }

  async function forwardToGroup(targetGroupId: string) {
    if (!identity) return;
    setBusy(true);
    setErr(null);
    try {
      const env = await buildEnvelope();
      await sendGroupChat(identity, targetGroupId, env);
      onForwarded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Forward failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-line max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line text-base font-semibold text-text flex items-center justify-between">
          <span>Forward message</span>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text px-1"
          >
            ✕
          </button>
        </div>
        {err && (
          <div className="px-4 pt-2">
            <ErrorMessage>{err}</ErrorMessage>
          </div>
        )}
        <div className="overflow-y-auto p-2">
          {(groups.data ?? []).length > 0 && (
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-text-muted">
              Groups
            </div>
          )}
          {(groups.data ?? [])
            .filter((g) => g.id !== fromGroupId)
            .map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={busy}
                onClick={() => void forwardToGroup(g.id)}
                className="w-full text-left px-3 py-3 hover:bg-white/5 flex items-center gap-3 disabled:opacity-50"
              >
                <Avatar seed={g.id} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{g.name}</div>
                  <div className="text-[11px] text-text-muted">
                    {g.memberCount} members
                  </div>
                </div>
              </button>
            ))}
          {(conns.data ?? []).length > 0 && (
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-text-muted mt-2">
              Contacts
            </div>
          )}
          {(conns.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => void forwardToPeer(c.peer.id)}
              className="w-full text-left px-3 py-3 hover:bg-white/5 flex items-center gap-3 disabled:opacity-50"
            >
              <Avatar seed={c.peer.id} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text font-mono truncate">
                  {c.peer.fingerprint}
                </div>
                <div className="text-[11px] text-text-muted">
                  {c.peer.accountType}
                </div>
              </div>
            </button>
          ))}
          {(conns.data ?? []).length === 0 && (groups.data ?? []).length === 0 && (
            <div className="text-center text-sm text-text-muted py-12">
              No contacts or groups to forward to.
            </div>
          )}
        </div>
      </div>
    </div>
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
