import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import {
  db,
  type ChatMessageRecord,
  getChatPref,
  setChatPref,
  type ChatPrefRecord,
  deleteChatMessageById,
  tombstoneChatMessageById,
  setChatMessageStarred,
  setChatMessagePinned,
  clearChatHistory,
} from "../lib/db";
import { ScheduledMessagesSheet } from "../components/ScheduledMessagesSheet";
import {
  consumeViewOnce,
  notifyViewOnceScreenshot,
  pollAndDecrypt,
  reportRead,
  sendChatEnvelope,
  sendChatMessage,
  sendReaction,
  deleteMessageForEveryone,
  editChatMessage,
} from "../lib/messageSync";
import { EmojiPicker, ReactionPicker } from "../components/EmojiPicker";
import { wsClient, wsTyping } from "../lib/wsClient";
import { usePresenceStore } from "../lib/presenceStore";
import { formatLastSeen } from "../lib/lastSeen";
import {
  AppBar,
  Avatar,
  IconButton,
  MoreVerticalIcon,
  MessageBubble,
  ErrorMessage,
  EmptyState,
  LockIcon,
  PaperclipIcon,
  MicIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  TrashIcon,
  SendIcon,
  Spinner,
  ReplyIcon,
  SmileIcon,
  StarIcon,
  PinIcon,
  CopyIcon,
  ForwardIcon,
  InfoIcon,
  EditIcon,
  BellOffIcon,
  FlagIcon,
  SearchIcon,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import { peerLabel, peerSubLabel } from "../lib/peerLabel";
import {
  downscaleImage,
  fetchAndDecryptMedia,
  makeThumbnail,
  uploadEncryptedMedia,
  type MediaAttachment,
} from "../lib/media";
import {
  firstUrl,
  envelopePreview,
  type EnvelopeLinkPreview,
  type EnvelopeReplyRef,
} from "../lib/messageEnvelope";
import { trpcClientProxy } from "../lib/trpcClientProxy";
import { useStealthPrefs } from "../lib/stealthPrefs";
import { useEffectiveWallpaper, getWallpaperStyle } from "../lib/wallpaperStore";
import { ChatWallpaperSheet } from "../components/ChatWallpaperSheet";
import { ChatPersonalitySheet } from "../components/ChatPersonalitySheet";
import { getAccentSwatch } from "../lib/chatPersonality";
import { moodCountdownLabel } from "../lib/moodSync";
import { VeilKeyboard } from "../components/VeilKeyboard";
import { useKeyboardPrefs, isCoarsePointerDevice } from "../lib/keyboardPrefs";
import { safetyNumberFromB64 } from "../lib/safetyNumber";
import {
  biometricSupported,
  registerBiometricCredential,
  verifyBiometric,
} from "../lib/biometric";
import { MessageText } from "../lib/markdown";

const POLL_MS = 3000;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VOICE_MS = 2 * 60 * 1000;
export const TTL_OPTIONS: { label: string; seconds: number }[] = [
  { label: "Off", seconds: 0 },
  { label: "24 hours", seconds: 60 * 60 * 24 },
  { label: "7 days", seconds: 60 * 60 * 24 * 7 },
  { label: "30 days", seconds: 60 * 60 * 24 * 30 },
];

export function ChatThreadPage() {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  if (!peerId) {
    return (
      <main className="min-h-full flex flex-col bg-bg text-text">
        <AppBar title="Chat" back="/chats" />
        <div className="p-4">
          <ErrorMessage>Missing peer id.</ErrorMessage>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex flex-col bg-bg text-text">
      {!identity ? (
        <>
          <AppBar title="Chat" back="/chats" />
          <div className="p-4">
            <UnlockGate />
          </div>
        </>
      ) : (
        <ChatThreadInner peerId={peerId} />
      )}
    </main>
  );
}

function ChatThreadInner({ peerId }: { peerId: string }) {
  const identity = useUnlockStore((s) => s.identity)!;
  const myId = useAuthStore((s) => s.user?.id) ?? "";
  const navigate = useNavigate();
  const connections = trpc.connections.list.useQuery(undefined, {
    retry: false,
  });
  const peer = useMemo(
    () => connections.data?.find((c) => c.peer.id === peerId) ?? null,
    [connections.data, peerId],
  );
  const fingerprint = peer?.peer.fingerprint ?? "";
  const displayName = peer?.peer
    ? peerLabel(peer.peer)
    : fingerprint || `${peerId.slice(0, 8)}…`;
  const subDisplay = peer?.peer ? peerSubLabel(peer.peer) : null;

  // Per-peer prefs (TTL, biometric, view-once default).
  const chatPref = useLiveQuery(
    () => db.chatPrefs.get(peerId),
    [peerId],
    undefined as ChatPrefRecord | undefined,
  );
  // Opening the conversation is the canonical "I've seen this"
  // action, so we clear the manual unread flag here. We only write
  // when the flag is actually set so we don't churn updatedAt and
  // re-trigger every other useLiveQuery that watches chatPrefs.
  useEffect(() => {
    if (chatPref?.markedUnread) {
      void setChatPref(peerId, { markedUnread: false });
    }
  }, [peerId, chatPref?.markedUnread]);
  const ttlSeconds = chatPref?.ttlSeconds ?? 0;
  const seenTtlSeconds = chatPref?.seenTtlSeconds ?? 0;
  const viewOnceDefault = chatPref?.viewOnceDefault ?? false;
  // Default-on. Only treat as off when the user has explicitly disabled it.
  const linkPreviewsEnabled = chatPref?.linkPreviewsEnabled !== false;
  const biometricCredentialId = chatPref?.biometricCredentialId;
  const pinnedToTop = !!chatPref?.pinnedToTop;
  const mutedUntilIso = chatPref?.mutedUntil ?? "";
  const isMuted =
    !!mutedUntilIso && new Date(mutedUntilIso).getTime() > Date.now();

  // Biometric gate — must verify per visit if a credential is registered.
  const [unlocked, setUnlocked] = useState<boolean>(!biometricCredentialId);
  const [bioError, setBioError] = useState<string | null>(null);
  useEffect(() => {
    if (!biometricCredentialId) {
      setUnlocked(true);
      return;
    }
    setUnlocked(false);
    setBioError(null);
    void verifyBiometric(biometricCredentialId).then((ok) => {
      if (ok) setUnlocked(true);
      else setBioError("Authentication required to open this chat.");
    });
  }, [biometricCredentialId, peerId]);

  const messages = useLiveQuery(
    () => db.chatMessages.where("peerId").equals(peerId).sortBy("createdAt"),
    [peerId],
    [],
  );

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<
    | null
    | "main"
    | "ttl"
    | "seenTtl"
    | "safety"
    | "report"
    | "starred"
    | "scheduledList"
    | "wallpaper"
    | "personality"
    | "snooze"
  >(null);
  /** Header search bar (in-chat search) visibility + query. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Per-message UX state: which message currently has the floating
  // action bar open, which one is showing the reaction picker, and the
  // pending reply attachment for the next outgoing message.
  const [actionFor, setActionFor] = useState<ChatMessageRecord | null>(null);
  const [reactFor, setReactFor] = useState<ChatMessageRecord | null>(null);
  const [deleteFor, setDeleteFor] = useState<ChatMessageRecord | null>(null);
  const [editFor, setEditFor] = useState<ChatMessageRecord | null>(null);
  const [infoFor, setInfoFor] = useState<ChatMessageRecord | null>(null);
  const [replyTo, setReplyTo] = useState<{
    row: ChatMessageRecord;
    ref: EnvelopeReplyRef;
  } | null>(null);
  // One-shot view-once: when on, the next outgoing message (text or
  // image) is sent with `vo: true`. Toggle resets after the send.
  const [oneShotViewOnce, setOneShotViewOnce] = useState(false);

  // Bulk selection mode (top-menu → "Select messages"). Holds the
  // local `id`s of the selected rows; the action bar at the bottom
  // shows Delete/Unsend depending on what's been ticked.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);
  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** The single pinned message in this thread, if any (WhatsApp-style). */
  const pinnedMessage = useMemo(
    () => (messages ?? []).find((m) => m.pinned && !m.deleted) ?? null,
    [messages],
  );

  /** Filter messages by the current in-chat search query (case-insensitive). */
  const filteredMessages = useMemo(() => {
    if (!searchOpen || !searchQuery.trim()) return messages ?? [];
    const q = searchQuery.trim().toLowerCase();
    return (messages ?? []).filter((m) =>
      (m.plaintext ?? "").toLowerCase().includes(q),
    );
  }, [messages, searchOpen, searchQuery]);

  /** Build a reply ref from a row the user just tapped "Reply" on. */
  const buildReplyRef = useCallback(
    (row: ChatMessageRecord): EnvelopeReplyRef => {
      const preview = row.deleted
        ? "Deleted message"
        : row.attachment?.kind === "image"
          ? row.plaintext
            ? `📷 ${row.plaintext}`
            : "📷 Photo"
          : row.attachment?.kind === "voice"
            ? "🎤 Voice message"
            : (row.plaintext ?? "");
      return {
        // We need the *server* id so the recipient can look it up. If
        // it's still pending, we fall back to a synthetic id and the
        // tap-to-jump won't work for the peer; the visual chip still
        // renders fine.
        id: row.serverId ?? `local-${row.id ?? "?"}`,
        body: preview.slice(0, 140),
        // Sender POV: replying to my own message → "out", to peer → "in"
        dir: row.direction,
      };
    },
    [],
  );

  /** Smooth-scroll a bubble into view by its server id. */
  const onScrollToMessage = useCallback((serverId: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-server-id="${CSS.escape(serverId)}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-wa-green");
    setTimeout(() => el.classList.remove("ring-2", "ring-wa-green"), 1200);
  }, []);

  // Block / report state: query the live block status so the UI reflects
  // actions taken on another device.
  const blockStatus = trpc.privacy.isBlocked.useQuery(
    { peerId },
    { enabled: !!peerId, retry: false, refetchOnWindowFocus: true },
  );
  const blockedByMe = blockStatus.data?.blockedByMe ?? false;
  const blockedMe = blockStatus.data?.blockedMe ?? false;
  const blockMutation = trpc.privacy.block.useMutation({
    onSuccess: () => blockStatus.refetch(),
  });
  const unblockMutation = trpc.privacy.unblock.useMutation({
    onSuccess: () => blockStatus.refetch(),
  });
  const reportMutation = trpc.privacy.report.useMutation({
    onSuccess: () => blockStatus.refetch(),
  });
  const [pendingPreview, setPendingPreview] = useState<EnvelopeLinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pref: wallpaperPref } = useEffectiveWallpaper({
    type: "dm",
    peerId,
  });
  const wallpaperStyle = useMemo(
    () => getWallpaperStyle(wallpaperPref),
    [wallpaperPref],
  );

  // Peer online status — seeded from REST query, kept live via WS presence events.
  const peerOnlineQuery = trpc.me.peerOnline.useQuery(
    { peerId },
    { enabled: !!peerId, refetchOnWindowFocus: true, staleTime: 30_000 },
  );
  const setPresenceOnline = usePresenceStore((s) => s.setOnline);
  useEffect(() => {
    if (peerOnlineQuery.data !== undefined) {
      setPresenceOnline(peerId, peerOnlineQuery.data.online);
    }
  }, [peerOnlineQuery.data, peerId, setPresenceOnline]);
  const peerOnline = usePresenceStore((s) => s.online[peerId] === true);

  // Last seen timestamp — respects the peer's privacy setting.
  const peerLastSeenQuery = trpc.me.peerLastSeen.useQuery(
    { peerId },
    { enabled: !!peerId, staleTime: 60_000, refetchOnWindowFocus: true },
  );
  const lastSeenLabel = peerLastSeenQuery.data?.lastSeenAt
    ? formatLastSeen(peerLastSeenQuery.data.lastSeenAt)
    : null;

  // Peer activity (typing / recording / choosing a photo).
  type ActivityKind = "text" | "voice" | "photo";
  const [peerActivity, setPeerActivity] = useState<{
    typing: boolean;
    kind: ActivityKind;
  }>({ typing: false, kind: "text" });
  const peerTyping = peerActivity.typing;
  useEffect(() => {
    let clear: ReturnType<typeof setTimeout> | null = null;
    const unsub = wsClient.subscribe((event) => {
      if (event.type === "typing" && event.from === peerId) {
        const kind = (event.kind ?? "text") as ActivityKind;
        if (event.typing) {
          setPeerActivity({ typing: true, kind });
          if (clear) clearTimeout(clear);
          // Voice/photo activities can legitimately last longer than text
          // typing — give them a more generous safety timeout.
          const ms = kind === "text" ? 5000 : 12000;
          clear = setTimeout(
            () => setPeerActivity((a) => ({ ...a, typing: false })),
            ms,
          );
        } else {
          setPeerActivity((a) => ({ ...a, typing: false }));
        }
      }
    });
    return () => {
      unsub();
      if (clear) clearTimeout(clear);
    };
  }, [peerId]);

  // Outgoing activity indicator (debounced + kind-aware).
  const typingPrefs = useStealthPrefs((s) => s.prefs?.typingIndicatorsEnabled);
  const lastTypingRef = useRef(0);
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which kind is currently "live" so we can cleanly cancel it before
  // switching (e.g. text → voice) and never leave a stale indicator hanging.
  const activeKindRef = useRef<ActivityKind | null>(null);
  const sendActivity = useCallback(
    (typing: boolean, kind: ActivityKind = "text") => {
      if (!typingPrefs) return;
      if (typing) {
        if (activeKindRef.current && activeKindRef.current !== kind) {
          wsTyping(peerId, false, activeKindRef.current);
        }
        activeKindRef.current = kind;
        wsTyping(peerId, true, kind);
      } else {
        const k = activeKindRef.current ?? kind;
        activeKindRef.current = null;
        wsTyping(peerId, false, k);
      }
    },
    [peerId, typingPrefs],
  );
  function onDraftChange(v: string) {
    setDraft(v);
    if (!typingPrefs) return;
    const now = Date.now();
    if (now - lastTypingRef.current > 2500) {
      lastTypingRef.current = now;
      sendActivity(true, "text");
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      lastTypingRef.current = 0;
      sendActivity(false, "text");
    }, 3500);
  }
  // Instant-hide on tab background, blur, or navigation away — no one wants
  // a stale "typing…" visible to the peer when we've put the app down.
  useEffect(() => {
    if (!typingPrefs) return;
    const stop = () => {
      if (stopTypingTimer.current) {
        clearTimeout(stopTypingTimer.current);
        stopTypingTimer.current = null;
      }
      lastTypingRef.current = 0;
      if (activeKindRef.current) sendActivity(false, activeKindRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
    };
  }, [sendActivity, typingPrefs]);
  useEffect(() => {
    return () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
      if (activeKindRef.current) sendActivity(false, activeKindRef.current);
    };
  }, [sendActivity]);

  // Poll for new messages while we're on this thread.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        await pollAndDecrypt(identity);
      } catch (e) {
        console.warn("Poll failed", e);
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [identity]);

  // Mark inbound messages as read whenever the thread is open + visible.
  // View-once messages are NOT marked read here — they're acked when the
  // user actually opens them, which also wipes them locally.
  useEffect(() => {
    if (!unlocked || !messages || messages.length === 0) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const unread = messages
      .filter((m) => m.direction === "in" && m.serverId && m.status !== "read" && !m.viewOnce)
      .map((m) => m.serverId!) as string[];
    if (unread.length === 0) return;
    void reportRead(unread).catch(() => undefined);
    // Also flip local status so the UI doesn't keep retrying.
    // Stamp expiresAt = now + (per-message seenTtl from the sender's
    // envelope, falling back to this device's chat pref). Per-message
    // wins so both sides delete in lockstep using the sender's chosen
    // duration even if the receiver has a different (or no) preference.
    const readNow = new Date().toISOString();
    const readNowMs = Date.now();
    void db.chatMessages
      .where("peerId").equals(peerId)
      .modify((rec) => {
        if (rec.direction === "in" && rec.status !== "read" && !rec.viewOnce && rec.serverId && unread.includes(rec.serverId)) {
          rec.status = "read";
          rec.readAt = readNow;
          if (!rec.expiresAt) {
            const secs = rec.seenTtlSeconds ?? seenTtlSeconds;
            if (secs > 0) {
              rec.expiresAt = new Date(readNowMs + secs * 1000).toISOString();
            }
          }
        }
      })
      .catch(() => undefined);
  }, [messages, peerId, seenTtlSeconds, unlocked]);

  // Precise per-message expiry timers. The 60s background sweep is too
  // coarse for short TTLs (e.g. 8s "Seen settings"), so for any message
  // currently in view that has an `expiresAt`, schedule a setTimeout that
  // fires exactly when it's due and reaps just that row from Dexie.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const m of messages) {
      if (!m.expiresAt || m.id === undefined) continue;
      const due = new Date(m.expiresAt).getTime();
      const delay = due - now;
      if (delay <= 0) {
        // Already past due — delete immediately.
        void db.chatMessages.delete(m.id).catch(() => undefined);
        continue;
      }
      // Cap delay to avoid setTimeout overflow (~24.8 days).
      const safeDelay = Math.min(delay, 2_147_000_000);
      const id = m.id;
      const t = setTimeout(() => {
        void db.chatMessages.delete(id).catch(() => undefined);
      }, safeDelay);
      timers.push(t);
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [messages]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, peerTyping]);

  // Tick every 30s so TTL countdown labels refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Detect URL in draft → fetch link preview lazily. The server fetches
  // both the OG metadata AND the OG image + favicon, then inlines the
  // images as data URLs. The recipient never makes a network request to
  // the linked site, so neither party leaks their IP. Gated on the
  // per-chat "Link previews" toggle.
  useEffect(() => {
    if (!linkPreviewsEnabled) {
      setPendingPreview(null);
      return;
    }
    const url = firstUrl(draft);
    if (!url) {
      setPendingPreview(null);
      return;
    }
    if (pendingPreview && pendingPreview.url === url) return;
    // Debounce 300ms so we don't fire while the user is still typing.
    setPreviewLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
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
            imageDataUrl: lp.imageDataUrl,
            iconDataUrl: lp.iconDataUrl,
          });
        } catch {
          if (!cancelled) setPendingPreview(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, linkPreviewsEnabled]);

  async function onSendText() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await sendChatMessage(identity, peerId, text, {
        ttlSeconds: ttlSeconds || undefined,
        seenTtlSeconds: seenTtlSeconds || undefined,
        linkPreview: pendingPreview ?? undefined,
        replyTo: replyTo?.ref,
        viewOnce: oneShotViewOnce || undefined,
      });
      setDraft("");
      setPendingPreview(null);
      setReplyTo(null);
      setOneShotViewOnce(false);
      sendActivity(false, "text");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  }

  // Schedule a message to be sent later. The encrypted payload is queued
  // on the server, which releases it at the requested time even if this
  // tab is closed. Plaintext stays on this device only.
  async function onScheduleMessage(text: string, scheduledFor: string) {
    if (!identity) {
      throw new Error("You need to unlock your account to schedule messages.");
    }
    const { scheduleServerMessage } = await import("../lib/scheduledServer");
    const result = await scheduleServerMessage(
      identity,
      peerId,
      text,
      scheduledFor,
    );
    const when = new Date(result.scheduledFor);
    const whenStr = when.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    setError(null);
    setNotice(`Scheduled — will send ${whenStr}`);
    window.setTimeout(() => {
      setNotice((n) => (n && n.startsWith("Scheduled —") ? null : n));
    }, 5000);
  }

  async function onPickImage(file: File) {
    setSending(true);
    setError(null);
    try {
      const caption = draft.trim();
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
      await sendChatEnvelope(identity, peerId, {
        v: 2,
        t: "image",
        ...(caption ? { body: caption } : {}),
        media,
        ...(ttlSeconds ? { ttl: ttlSeconds } : {}),
        ...(seenTtlSeconds > 0 ? { sttl: seenTtlSeconds } : {}),
        ...(viewOnceDefault || oneShotViewOnce ? { vo: true } : {}),
        ...(replyTo ? { re: replyTo.ref } : {}),
      });
      setDraft("");
      setReplyTo(null);
      setOneShotViewOnce(false);
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
      await sendChatEnvelope(identity, peerId, {
        v: 2,
        t: "voice",
        media,
        ...(ttlSeconds ? { ttl: ttlSeconds } : {}),
        ...(seenTtlSeconds > 0 ? { sttl: seenTtlSeconds } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send voice note.");
    } finally {
      setSending(false);
    }
  }

  async function onToggleBiometric() {
    if (biometricCredentialId) {
      if (!confirm("Remove biometric lock from this chat?")) return;
      await setChatPref(peerId, { biometricCredentialId: undefined });
      return;
    }
    if (!biometricSupported()) {
      alert("Biometric unlock isn't supported on this device.");
      return;
    }
    try {
      const credId = await registerBiometricCredential(`veil:${peerId}`, displayName);
      await setChatPref(peerId, { biometricCredentialId: credId });
      alert("Biometric lock enabled for this chat.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not enable biometric lock.");
    }
  }

  const ttlLabel = TTL_OPTIONS.find((o) => o.seconds === ttlSeconds)?.label ?? "Off";
  const seenTtlLabel = seenTtlSeconds > 0 ? formatSeenTtl(seenTtlSeconds) : "Off";

  if (!unlocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <AppBar
          title={
            <div className="flex items-center gap-2">
              <Avatar seed={peerId} label={displayName.slice(0, 2)} size={36} />
              <div className="font-semibold text-base truncate font-mono">
                {displayName}
              </div>
            </div>
          }
          back="/chats"
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <LockIcon className="w-12 h-12 text-text-muted" />
          <div className="text-text font-semibold">Chat is locked</div>
          <div className="text-sm text-text-muted max-w-xs">
            Use your device biometrics or passkey to view this conversation.
          </div>
          {bioError && <ErrorMessage>{bioError}</ErrorMessage>}
          <button
            onClick={async () => {
              if (!biometricCredentialId) return;
              setBioError(null);
              const ok = await verifyBiometric(biometricCredentialId);
              if (ok) setUnlocked(true);
              else setBioError("Authentication failed.");
            }}
            className="px-4 py-2 rounded-full bg-wa-green text-text-oncolor font-medium"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // Per-contact accent: if the user picked a chat-specific color in
  // "Customize chat", inject a scoped <style> block that retints the
  // outgoing bubble + send button only inside this thread. Doing it
  // via a unique data attribute (rather than mutating Tailwind classes)
  // means we don't touch the global stylesheet or trigger a rebuild.
  const accentSwatch = chatPref?.chatAccent
    ? getAccentSwatch(chatPref.chatAccent)
    : null;
  const accentScopeId = `vc-${peerId.replace(/[^a-zA-Z0-9]/g, "")}`;

  // Peer's broadcast mood — auto-hide once expired so a stale
  // "in a meeting" doesn't linger on the header for hours.
  const peerMoodActive =
    chatPref?.peerMood &&
    Date.parse(chatPref.peerMood.expiresAt) > Date.now()
      ? chatPref.peerMood
      : null;

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      data-veil-accent={accentSwatch ? accentScopeId : undefined}
    >
      {accentSwatch && (
        <style>{`
          [data-veil-accent="${accentScopeId}"] .bg-wa-bubble-out {
            background-color: ${accentSwatch.hex} !important;
            color: #ffffff !important;
          }
          [data-veil-accent="${accentScopeId}"] .bg-wa-bubble-out .text-text,
          [data-veil-accent="${accentScopeId}"] .bg-wa-bubble-out .text-text-muted {
            color: rgba(255,255,255,0.92) !important;
          }
          [data-veil-accent="${accentScopeId}"] [data-veil-send-btn] {
            background-color: ${accentSwatch.hex} !important;
          }
          [data-veil-accent="${accentScopeId}"] [data-veil-send-btn]:hover {
            background-color: ${accentSwatch.hexDark} !important;
          }
        `}</style>
      )}
      <AppBar
        title={
          <button
            type="button"
            onClick={() => navigate(`/profile/${peerId}`)}
            className="flex items-center gap-2 w-full text-left wa-tap"
            aria-label="View contact info"
          >
            <Avatar
              seed={peer?.peer.username || peerId}
              src={peer?.peer.avatarDataUrl ?? null}
              label={displayName.slice(0, 2)}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base truncate">
                {displayName}
                {subDisplay && (
                  <span className="ml-2 text-[11px] font-normal text-text-oncolor/70 font-mono">
                    {subDisplay}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-oncolor/80 truncate inline-flex items-center gap-1">
                {peerTyping ? (
                  <span>
                    {peerActivity.kind === "voice"
                      ? "recording…"
                      : peerActivity.kind === "photo"
                        ? "choosing a photo…"
                        : "typing…"}
                  </span>
                ) : peerMoodActive ? (
                  <span className="inline-flex items-center gap-1 truncate">
                    <span aria-hidden="true">{peerMoodActive.emoji}</span>
                    <span className="truncate">{peerMoodActive.text}</span>
                    <span className="text-text-oncolor/60 shrink-0">
                      · {moodCountdownLabel(peerMoodActive.expiresAt)}
                    </span>
                  </span>
                ) : peerOnline ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Online
                  </span>
                ) : lastSeenLabel ? (
                  <span>Last seen {lastSeenLabel}</span>
                ) : (
                  <>
                    <LockIcon className="w-3 h-3" /> end-to-end encrypted
                    {ttlSeconds > 0 && <span>· ⏱ {ttlLabel}</span>}
                    {biometricCredentialId && <span>· 🔒</span>}
                  </>
                )}
              </div>
            </div>
          </button>
        }
        back="/chats"
        right={
          <div className="flex items-center gap-1">
            {isMuted && (
              <span
                className="text-text-oncolor/80"
                title={`Muted until ${new Date(mutedUntilIso).toLocaleString()}`}
              >
                <BellOffIcon className="w-4 h-4" />
              </span>
            )}
            <IconButton
              label="Search"
              className="text-text-oncolor"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <SearchIcon />
            </IconButton>
            <IconButton
              label="More"
              className="text-text-oncolor"
              onClick={() => setMenuOpen("main")}
            >
              <MoreVerticalIcon />
            </IconButton>
          </div>
        }
      />

      {selectMode && (
        <SelectionTopBar
          count={selectedIds.size}
          allSelected={(() => {
            const ids = (filteredMessages ?? [])
              .map((m) => m.id)
              .filter((x): x is number => x !== undefined);
            return ids.length > 0 && ids.every((id) => selectedIds.has(id));
          })()}
          onSelectAll={() => {
            const ids = (filteredMessages ?? [])
              .map((m) => m.id)
              .filter((x): x is number => x !== undefined);
            const all = ids.length > 0 && ids.every((id) => selectedIds.has(id));
            setSelectedIds(all ? new Set() : new Set(ids));
          }}
          onCancel={exitSelectMode}
        />
      )}

      {pinnedMessage && (
        <PinnedMessageBanner
          row={pinnedMessage}
          onJump={() => pinnedMessage.serverId && onScrollToMessage(pinnedMessage.serverId)}
          onUnpin={async () => {
            if (pinnedMessage.id !== undefined)
              await setChatMessagePinned(pinnedMessage.id, peerId, false);
          }}
        />
      )}

      {peer?.peer && !peer.peer.contactName && (
        <AddContactBanner
          peerId={peerId}
          peerLabel={peer.peer.username ? `@${peer.peer.username}` : displayName}
          onSaved={async () => {
            await connections.refetch();
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
            placeholder="Search in this chat…"
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

      <div
        ref={scrollRef}
        style={wallpaperStyle}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
      >
        {!filteredMessages || filteredMessages.length === 0 ? (
          <EmptyState
            title={searchOpen && searchQuery ? "No matches" : "No messages yet"}
            message={
              searchOpen && searchQuery
                ? "Try a different search term."
                : "Say hi to start the conversation."
            }
          />
        ) : (
          (() => {
            // Index of the most-recent outbound "read" message — the
            // only one that gets a "Seen X ago" caption (Instagram-style).
            let lastReadOutIdx = -1;
            for (let i = filteredMessages.length - 1; i >= 0; i--) {
              const mm = filteredMessages[i]!;
              if (mm.direction === "out" && mm.status === "read" && mm.readAt) {
                lastReadOutIdx = i;
                break;
              }
            }
            return filteredMessages.map((m, i) => (
              <MessageRowSlot
                key={m.id}
                m={m}
                myUserId={myId}
                onAction={(row) => setActionFor(row)}
                onQuickReply={(row) => setReplyTo({ row, ref: buildReplyRef(row) })}
                onQuickReact={(row) => setReactFor(row)}
                onJumpTo={onScrollToMessage}
                showSeenAfter={i === lastReadOutIdx && m.readAt ? m.readAt : null}
                selectMode={selectMode}
                selected={m.id !== undefined && selectedIds.has(m.id)}
                onToggleSelect={() => {
                  if (m.id !== undefined) toggleSelected(m.id);
                }}
              />
            ));
          })()
        )}
        {peerTyping && (
          <div className="self-start text-xs text-text-muted bg-wa-bubble-in rounded-2xl rounded-tl-sm px-3 py-1.5 shadow-bubble animate-bubble-in-in">
            {peerActivity.kind === "voice" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex gap-0.5 items-end">
                  <RecBar d={0} />
                  <RecBar d={120} />
                  <RecBar d={240} />
                  <RecBar d={360} />
                </span>
                <span>recording</span>
              </span>
            ) : peerActivity.kind === "photo" ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>📷</span>
                <span>choosing a photo</span>
              </span>
            ) : (
              <span className="inline-flex gap-0.5 items-end">
                <Dot d={0} /><Dot d={150} /><Dot d={300} />
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 pb-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {notice && (
        <div className="px-3 pb-2">
          <div className="rounded-lg border border-wa-green/40 bg-wa-green/10 text-wa-green text-xs px-3 py-2 flex items-center gap-2">
            <span>✓</span>
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-wa-green/70 hover:text-wa-green px-1"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {pendingPreview && (
        <LinkPreviewCard
          preview={pendingPreview}
          loading={previewLoading}
          onDismiss={() => setPendingPreview(null)}
        />
      )}

      {selectMode ? (
        <SelectionActionBar
          count={selectedIds.size}
          busy={bulkBusy}
          canUnsend={(() => {
            if (selectedIds.size === 0) return false;
            const byId = new Map<number, ChatMessageRecord>();
            for (const m of messages ?? []) {
              if (m.id !== undefined) byId.set(m.id, m);
            }
            for (const id of selectedIds) {
              const row = byId.get(id);
              // Hide Unsend the moment any selected row is inbound
              // or has no serverId (never reached the server, so
              // there is nothing to recall on the peer).
              if (!row || row.direction !== "out" || !row.serverId) return false;
              if (row.deleted) return false;
            }
            return true;
          })()}
          onDeleteLocal={async () => {
            if (selectedIds.size === 0) return;
            setBulkBusy(true);
            try {
              for (const id of selectedIds) {
                await deleteChatMessageById(id);
              }
              exitSelectMode();
            } catch (e) {
              setError(
                e instanceof Error
                  ? `Delete failed: ${e.message}`
                  : "Delete failed.",
              );
            } finally {
              setBulkBusy(false);
            }
          }}
          onUnsend={async () => {
            if (selectedIds.size === 0) return;
            setBulkBusy(true);
            const byId = new Map<number, ChatMessageRecord>();
            for (const m of messages ?? []) {
              if (m.id !== undefined) byId.set(m.id, m);
            }
            try {
              for (const id of selectedIds) {
                const row = byId.get(id);
                if (!row) continue;
                try {
                  await deleteMessageForEveryone(identity, peerId, row);
                } catch {
                  // Best-effort fallback: at least remove the row
                  // locally so it disappears from this device.
                  await deleteChatMessageById(id);
                }
              }
              exitSelectMode();
            } finally {
              setBulkBusy(false);
            }
          }}
          onCancel={exitSelectMode}
        />
      ) : (
        <Composer
          draft={draft}
          setDraft={onDraftChange}
          sending={sending}
          onSendText={onSendText}
          onPickImage={(f) => {
            // Whatever they picked, the "choosing a photo" activity is over
            // before the encrypted upload starts.
            sendActivity(false, "photo");
            onPickImage(f);
          }}
          onSendVoice={onSendVoice}
          viewOnceDefault={viewOnceDefault}
          oneShotViewOnce={oneShotViewOnce}
          onToggleOneShotViewOnce={() => setOneShotViewOnce((v) => !v)}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onSchedule={onScheduleMessage}
          onActivity={sendActivity}
        />
      )}

      {actionFor && (
        <MessageActionMenu
          row={actionFor}
          onClose={() => setActionFor(null)}
          onReply={() => {
            setReplyTo({
              row: actionFor,
              ref: buildReplyRef(actionFor),
            });
            setActionFor(null);
          }}
          onReact={() => {
            setReactFor(actionFor);
            setActionFor(null);
          }}
          onEdit={() => {
            setEditFor(actionFor);
            setActionFor(null);
          }}
          onCopy={async () => {
            const text = actionFor.plaintext ?? "";
            setActionFor(null);
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              setError("Couldn't copy to clipboard.");
            }
          }}
          onStar={async () => {
            const id = actionFor.id;
            const next = !actionFor.starred;
            setActionFor(null);
            if (id !== undefined) await setChatMessageStarred(id, next);
          }}
          onPin={async () => {
            const id = actionFor.id;
            const next = !actionFor.pinned;
            setActionFor(null);
            if (id !== undefined) await setChatMessagePinned(id, peerId, next);
          }}
          onInfo={() => {
            setInfoFor(actionFor);
            setActionFor(null);
          }}
          onDelete={() => {
            setDeleteFor(actionFor);
            setActionFor(null);
          }}
          onForward={() => {
            const text = actionFor.plaintext ?? "";
            setActionFor(null);
            // Lightweight forward: pre-fill the composer. Full
            // contact-picker forward is a Phase 2 feature.
            if (text) setDraft((d) => (d ? d + "\n" + text : text));
          }}
          onReport={() => {
            setActionFor(null);
            setMenuOpen("report");
          }}
        />
      )}

      {editFor && (
        <EditMessageDialog
          row={editFor}
          onClose={() => setEditFor(null)}
          onSubmit={async (newBody) => {
            const target = editFor;
            setEditFor(null);
            try {
              await editChatMessage(identity, peerId, target, newBody);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Couldn't edit message.");
            }
          }}
        />
      )}

      {infoFor && (
        <MessageInfoDialog row={infoFor} onClose={() => setInfoFor(null)} />
      )}

      {menuOpen === "starred" && (
        <StarredMessagesDialog
          peerId={peerId}
          onClose={() => setMenuOpen(null)}
          onJump={(serverId) => {
            setMenuOpen(null);
            onScrollToMessage(serverId);
          }}
        />
      )}

      {menuOpen === "scheduledList" && (
        <ScheduledMessagesSheet
          peerId={peerId}
          onClose={() => setMenuOpen(null)}
        />
      )}

      {reactFor && (
        <ReactionPickerSheet
          row={reactFor}
          myUserId={myId}
          onClose={() => setReactFor(null)}
          onPick={async (emoji) => {
            const target = reactFor.serverId;
            setReactFor(null);
            if (!target) return;
            try {
              await sendReaction(identity, peerId, myId, target, emoji);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Couldn't react.");
            }
          }}
        />
      )}

      {deleteFor && (
        <DeleteMessageDialog
          row={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeleteForMe={async () => {
            const id = deleteFor.id;
            setDeleteFor(null);
            if (id === undefined) return;
            // Mine-only: drop the local row but keep the peer's copy.
            await deleteChatMessageById(id);
          }}
          onDeleteForEveryone={async () => {
            const row = deleteFor;
            setDeleteFor(null);
            try {
              await deleteMessageForEveryone(identity, peerId, row);
            } catch (e) {
              // Fall back to local-only so the message at least
              // disappears from this device.
              if (row.id !== undefined) await deleteChatMessageById(row.id);
              setError(
                e instanceof Error
                  ? `Unsend failed: ${e.message}`
                  : "Unsend failed.",
              );
            }
          }}
        />
      )}

      {menuOpen === "main" && (
        <ChatMenu
          onClose={() => setMenuOpen(null)}
          ttlLabel={ttlLabel}
          onTTL={() => setMenuOpen("ttl")}
          seenTtlLabel={seenTtlLabel}
          onSeenTtl={() => setMenuOpen("seenTtl")}
          onSafety={() => setMenuOpen("safety")}
          onToggleBiometric={onToggleBiometric}
          biometricEnabled={!!biometricCredentialId}
          viewOnceDefault={viewOnceDefault}
          onToggleViewOnce={() =>
            void setChatPref(peerId, { viewOnceDefault: !viewOnceDefault })
          }
          linkPreviewsEnabled={linkPreviewsEnabled}
          onToggleLinkPreviews={() =>
            void setChatPref(peerId, {
              linkPreviewsEnabled: !linkPreviewsEnabled,
            })
          }
          blockedByMe={blockedByMe}
          onToggleBlock={() => {
            setMenuOpen(null);
            if (blockedByMe) {
              if (!confirm(`Unblock ${displayName}?`)) return;
              unblockMutation.mutate({ peerId });
            } else {
              if (
                !confirm(
                  `Block ${displayName}? They won't be able to send you messages and you won't be able to send them messages.`,
                )
              )
                return;
              blockMutation.mutate({ peerId });
            }
          }}
          onReport={() => setMenuOpen("report")}
          pinnedToTop={pinnedToTop}
          onTogglePinChat={() =>
            void setChatPref(peerId, { pinnedToTop: !pinnedToTop })
          }
          isMuted={isMuted}
          onToggleMute={() => {
            if (isMuted) {
              // Already muted → unmute is a one-tap action, no sheet.
              void setChatPref(peerId, { mutedUntil: "" });
            } else {
              // Surface the surgical-snooze options: 1h / 8h / until
              // tomorrow morning / 1 week / always. Closing the main
              // menu first prevents the two sheets from stacking.
              setMenuOpen("snooze");
            }
          }}
          onSearch={() => setSearchOpen(true)}
          onClearChat={() => {
            if (
              confirm(
                `Clear all messages with ${displayName}? This only affects this device.`,
              )
            ) {
              void clearChatHistory(peerId);
            }
            setMenuOpen(null);
          }}
          onShowStarred={() => setMenuOpen("starred")}
          onSelectMessages={() => {
            setSelectMode(true);
            setSelectedIds(new Set());
          }}
          onShowScheduled={() => setMenuOpen("scheduledList")}
          onWallpaper={() => setMenuOpen("wallpaper")}
          onCustomize={() => setMenuOpen("personality")}
        />
      )}
      {menuOpen === "wallpaper" && (
        <ChatWallpaperSheet
          scope={{ type: "dm", peerId }}
          chatLabel={displayName}
          onClose={() => setMenuOpen(null)}
        />
      )}
      {menuOpen === "personality" && (
        <ChatPersonalitySheet
          peerId={peerId}
          chatLabel={displayName}
          onClose={() => setMenuOpen(null)}
        />
      )}
      {menuOpen === "snooze" && (
        <SnoozeSheet
          peerLabel={displayName}
          onClose={() => setMenuOpen(null)}
          onPick={(untilIso) => {
            void setChatPref(peerId, { mutedUntil: untilIso });
            setMenuOpen(null);
          }}
        />
      )}
      {menuOpen === "ttl" && (
        <TTLPicker
          current={ttlSeconds}
          onClose={() => setMenuOpen(null)}
          onPick={(secs) => {
            void setChatPref(peerId, { ttlSeconds: secs });
            setMenuOpen(null);
          }}
        />
      )}
      {menuOpen === "seenTtl" && (
        <SeenTTLPicker
          current={seenTtlSeconds}
          onClose={() => setMenuOpen(null)}
          onPick={(secs) => {
            void setChatPref(peerId, { seenTtlSeconds: secs });
            setMenuOpen(null);
          }}
        />
      )}
      {menuOpen === "safety" && peer && (
        <SafetyNumberDialog
          myId={myId}
          peerId={peerId}
          peerLabel={displayName}
          onClose={() => setMenuOpen(null)}
        />
      )}
      {menuOpen === "report" && (
        <ReportDialog
          peerLabel={displayName}
          onClose={() => setMenuOpen(null)}
          onSubmit={async (reason, note, alsoBlock) => {
            await reportMutation.mutateAsync({
              peerId,
              reason,
              note: note || undefined,
              alsoBlock,
            });
            setMenuOpen(null);
            alert("Report submitted. Thank you.");
          }}
        />
      )}
      {(blockedByMe || blockedMe) && (
        <div className="px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/30 text-xs text-yellow-200 text-center">
          {blockedByMe
            ? "You have blocked this contact. Messages can't be sent."
            : "This contact is unavailable."}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Helpers ────────────────────────── */

function Dot({ d }: { d: number }) {
  return (
    <span
      className="size-1.5 rounded-full bg-text-muted animate-bounce"
      style={{ animationDelay: `${d}ms` }}
    />
  );
}

/** Animated audio-style bar used by the "recording…" peer indicator. */
function RecBar({ d }: { d: number }) {
  return (
    <span
      className="inline-block w-0.5 h-3 rounded-full bg-wa-green animate-tap-pulse"
      style={{ animationDelay: `${d}ms`, animationDuration: "900ms" }}
    />
  );
}

export function ttlRemainingLabel(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  return `${d}d`;
}

/* ────────────────────────── Seen indicator ────────────────────────── */

/**
 * Instagram-style "Seen <relative time>" caption rendered under the
 * latest read outbound message. Re-renders every 30s via the parent's
 * tick so the relative label stays fresh without a per-bubble timer.
 */
function SeenIndicator({ readAt }: { readAt: string }) {
  return (
    <div
      className="self-end text-[10.5px] text-text-muted/80 mt-0.5 mr-1 select-none"
      title={new Date(readAt).toLocaleString()}
    >
      Seen {formatSeenAgo(readAt)}
    </div>
  );
}

function formatSeenAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 2) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.round(min / 60);
  if (hr < 2) return "1 hour ago";
  if (hr < 24) return `${hr} hours ago`;
  const d = Math.round(hr / 24);
  if (d < 2) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/** Format a seenTtlSeconds value as a human-readable string, e.g. "2h 30m 10s". */
function formatSeenTtl(secs: number): string {
  if (secs <= 0) return "Off";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ");
}

/* ────────────────────────── Bubble row ────────────────────────── */

/**
 * Outer slot for a message row: owns the long-press/right-click handler
 * that opens the action menu, the `data-server-id` anchor used by
 * "scroll to original" jumps, and the optional Seen indicator caption
 * underneath the most-recent read outbound bubble.
 */
function MessageRowSlot({
  m,
  myUserId,
  onAction,
  onQuickReply,
  onQuickReact,
  onJumpTo,
  showSeenAfter,
  selectMode,
  selected,
  onToggleSelect,
}: {
  m: ChatMessageRecord;
  myUserId: string;
  onAction: (row: ChatMessageRecord) => void;
  onQuickReply: (row: ChatMessageRecord) => void;
  onQuickReact: (row: ChatMessageRecord) => void;
  onJumpTo: (serverId: string) => void;
  showSeenAfter: string | null;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  // The row owns three gestures: tap (select-mode toggle), long-press
  // (action sheet), and swipe-to-reply. Swipe wins over long-press the
  // moment the finger moves more than a few pixels horizontally — that
  // way scrolling and replying never accidentally trigger the menu.
  const pressTimer = useRef<number | null>(null);
  const movedRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const horizontalRef = useRef(false);
  const [dx, setDx] = useState(0);
  const trigger = () => {
    if (m.deleted) return;
    if (selectMode) onToggleSelect();
    else onAction(m);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  // Reply swipes inward toward the bubble: peer messages swipe right,
  // mine swipe left. Outgoing reply gesture mirrors WhatsApp.
  const mine = m.direction === "out";
  return (
    <div
      data-server-id={m.serverId ?? ""}
      className={
        "group flex flex-col transition-shadow rounded-md relative " +
        (selectMode ? "cursor-pointer " : "") +
        (selected ? "bg-wa-green/15 -mx-3 px-3" : "")
      }
      onClick={() => {
        if (selectMode) onToggleSelect();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        trigger();
      }}
      onTouchStart={(e) => {
        movedRef.current = false;
        horizontalRef.current = false;
        startXRef.current = e.touches[0]?.clientX ?? null;
        startYRef.current = e.touches[0]?.clientY ?? null;
        pressTimer.current = window.setTimeout(() => {
          if (!movedRef.current) trigger();
        }, 450);
      }}
      onTouchMove={(e) => {
        movedRef.current = true;
        if (m.deleted || selectMode) {
          cancelPress();
          return;
        }
        if (startXRef.current === null) return;
        const x = e.touches[0]?.clientX ?? startXRef.current;
        const y = e.touches[0]?.clientY ?? startYRef.current ?? x;
        const deltaX = x - startXRef.current;
        const deltaY = y - (startYRef.current ?? y);
        // Decide gesture direction once: any movement above the
        // 6px threshold cancels long-press; if the move is mostly
        // horizontal we engage swipe-to-reply.
        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) cancelPress();
        if (
          !horizontalRef.current &&
          Math.abs(deltaX) > 8 &&
          Math.abs(deltaX) > Math.abs(deltaY) * 1.4
        ) {
          horizontalRef.current = true;
        }
        if (horizontalRef.current) {
          const allowed = mine ? Math.min(0, deltaX) : Math.max(0, deltaX);
          setDx(Math.max(-90, Math.min(90, allowed)));
        }
      }}
      onTouchEnd={() => {
        cancelPress();
        if (horizontalRef.current && Math.abs(dx) > 50 && !selectMode) {
          onQuickReply(m);
        }
        setDx(0);
        startXRef.current = null;
        startYRef.current = null;
        horizontalRef.current = false;
      }}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
    >
      {Math.abs(dx) > 12 && (
        <span
          className={
            "absolute top-1/2 -translate-y-1/2 text-wa-green text-lg " +
            (mine ? "right-[-30px]" : "left-[-30px]")
          }
          aria-hidden="true"
          style={{ opacity: Math.min(1, Math.abs(dx) / 50) }}
        >
          ↩
        </span>
      )}
      <MessageRow
        m={m}
        myUserId={myUserId}
        onAction={onAction}
        onQuickReply={onQuickReply}
        onQuickReact={onQuickReact}
        onJumpTo={onJumpTo}
        selectMode={selectMode}
        selected={selected}
      />
      {showSeenAfter && <SeenIndicator readAt={showSeenAfter} />}
    </div>
  );
}

function MessageRow({
  m,
  myUserId,
  onAction,
  onQuickReply,
  onQuickReact,
  onJumpTo,
  selectMode,
  selected,
}: {
  m: ChatMessageRecord;
  myUserId: string;
  onAction: (row: ChatMessageRecord) => void;
  onQuickReply: (row: ChatMessageRecord) => void;
  onQuickReact: (row: ChatMessageRecord) => void;
  onJumpTo: (serverId: string) => void;
  selectMode: boolean;
  selected: boolean;
}) {
  // Single 3-icon toolbar reused on every bubble variant. Hidden in
  // bulk-select mode (the row tap is the only interaction then).
  const toolbar =
    !m.deleted && !selectMode ? (
      <BubbleHoverAction
        direction={m.direction}
        onMenu={() => onAction(m)}
        onReply={() => onQuickReply(m)}
        onReact={() => onQuickReact(m)}
      />
    ) : null;
  const checkmark = selectMode ? (
    <span
      aria-hidden="true"
      className={
        "self-center shrink-0 size-5 rounded-full border flex items-center justify-center text-[11px] " +
        (selected
          ? "bg-wa-green border-wa-green text-text-oncolor"
          : "border-line text-transparent")
      }
    >
      ✓
    </span>
  ) : null;
  const time = new Date(m.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const ttlLabel = ttlRemainingLabel(m.expiresAt);
  const ttlBadge = ttlLabel ? (
    <span className="ml-1 text-[10px] text-text-muted">⏱ {ttlLabel}</span>
  ) : null;

  // Tombstone wins: never reveal the body, attachment, or reactions.
  if (m.deleted) {
    return (
      <MessageBubble direction={m.direction} time={time}>
        <span className="italic text-text-muted text-sm">
          🚫 {m.direction === "out" ? "You deleted this message" : "This message was deleted"}
        </span>
      </MessageBubble>
    );
  }

  // Quoted reply chip rendered inside the bubble at the top.
  const replyChip = m.replyTo ? (
    <ReplyQuoteChip
      replyTo={m.replyTo}
      myDirection={m.direction}
      onJumpTo={onJumpTo}
    />
  ) : null;

  // Tap anywhere on the bubble (desktop) opens the action menu via the
  // small floating button revealed on hover. We attach the hover button
  // through a wrapper div outside the MessageBubble so the bubble's
  // own click target (e.g. images) keeps working.
  const reactions = m.reactions ?? {};
  const reactionsRow =
    Object.keys(reactions).length > 0 ? (
      <ReactionsStrip
        reactions={reactions}
        myUserId={myUserId}
        direction={m.direction}
        onClick={() => onAction(m)}
      />
    ) : null;

  // Pin badge + edited label live inside the bubble's footer area.
  const pinnedBadge = m.pinned ? (
    <span className="ml-1 text-[10px] text-text-muted inline-flex items-center gap-0.5" title="Pinned">
      <PinIcon className="w-3 h-3" />
    </span>
  ) : null;
  const starredBadge = m.starred ? (
    <span className="ml-1 text-[10px] text-yellow-400" title="Starred">★</span>
  ) : null;
  const editedLabel = m.editedAt ? (
    <span className="ml-1 text-[10px] text-text-muted italic">(edited)</span>
  ) : null;
  const rowDir = m.direction === "out" ? "justify-end" : "justify-start";

  if (m.viewOnce) {
    return (
      <>
        {replyChip && <div className={m.direction === "out" ? "self-end" : "self-start"}>{replyChip}</div>}
        <div className={"flex items-stretch gap-1 " + rowDir}>
          {checkmark}
          {m.direction === "out" && toolbar}
          <ViewOnceBubble m={m} time={time} />
          {m.direction === "in" && toolbar}
        </div>
        {reactionsRow}
      </>
    );
  }
  if (m.attachment?.kind === "image") {
    return (
      <>
        <div className={"flex items-stretch gap-1 " + rowDir}>
          {checkmark}
          {m.direction === "out" && toolbar}
          <MessageBubble direction={m.direction} status={m.status} time={time}>
            {replyChip}
            <ImageAttachment att={m.attachment} />
            {m.plaintext && (
              <div className="mt-1">
                <MessageText text={m.plaintext} />
              </div>
            )}
            {ttlBadge}{pinnedBadge}{starredBadge}
          </MessageBubble>
          {m.direction === "in" && toolbar}
        </div>
        {reactionsRow}
      </>
    );
  }
  if (m.attachment?.kind === "voice") {
    return (
      <>
        <div className={"flex items-stretch gap-1 " + rowDir}>
          {checkmark}
          {m.direction === "out" && toolbar}
          <MessageBubble direction={m.direction} status={m.status} time={time}>
            {replyChip}
            <VoiceAttachment att={m.attachment} />
            {ttlBadge}{pinnedBadge}{starredBadge}
          </MessageBubble>
          {m.direction === "in" && toolbar}
        </div>
        {reactionsRow}
      </>
    );
  }
  return (
    <>
      <div className={"flex items-stretch gap-1 " + rowDir}>
        {checkmark}
        {m.direction === "out" && toolbar}
        <MessageBubble direction={m.direction} status={m.status} time={time}>
          {replyChip}
          <MessageText text={m.plaintext} />
          {m.linkPreview && <LinkPreviewBlock preview={m.linkPreview} />}
          {editedLabel}{ttlBadge}{pinnedBadge}{starredBadge}
        </MessageBubble>
        {m.direction === "in" && toolbar}
      </div>
      {reactionsRow}
    </>
  );
}

/**
 * Quoted reply preview rendered at the top of a bubble. WhatsApp-style:
 * coloured left bar + author label + 1-line snippet. Tap to scroll the
 * original into view.
 */
function ReplyQuoteChip({
  replyTo,
  myDirection,
  onJumpTo,
}: {
  replyTo: NonNullable<ChatMessageRecord["replyTo"]>;
  myDirection: "in" | "out";
  onJumpTo: (serverId: string) => void;
}) {
  // From this user's POV, replyTo.dir === "out" means the quoted
  // message was originally sent by them.
  const author = replyTo.dir === "out" ? "You" : "Them";
  const accent = replyTo.dir === "out" ? "border-wa-green" : "border-pink-400";
  return (
    <button
      type="button"
      onClick={() => onJumpTo(replyTo.serverId)}
      className={
        "block w-full text-left mb-1 -mx-1 px-2 py-1 rounded bg-black/20 border-l-4 " +
        accent +
        (myDirection === "out" ? " hover:bg-black/30" : " hover:bg-black/30")
      }
    >
      <div className="text-[11px] font-medium text-text/80">{author}</div>
      <div className="text-[12px] text-text-muted truncate">
        {replyTo.body || <span className="italic">empty message</span>}
      </div>
    </button>
  );
}

/**
 * Aggregated reactions strip rendered below a bubble. Each unique emoji
 * shows once with its count; tapping the strip reopens the action menu
 * (where the user can change/remove their own reaction).
 */
function ReactionsStrip({
  reactions,
  myUserId,
  direction,
  onClick,
}: {
  reactions: Record<string, string>;
  myUserId: string;
  direction: "in" | "out";
  onClick: () => void;
}) {
  const counts = new Map<string, number>();
  for (const e of Object.values(reactions)) {
    counts.set(e, (counts.get(e) ?? 0) + 1);
  }
  const mine = reactions[myUserId];
  const entries = Array.from(counts.entries());
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-line text-xs shadow-bubble " +
        (direction === "out" ? "self-end" : "self-start")
      }
      aria-label="Reactions"
    >
      {entries.map(([e, n]) => (
        <span
          key={e}
          className={
            "inline-flex items-center gap-0.5 " +
            (e === mine ? "text-wa-green" : "text-text")
          }
        >
          <span className="text-base leading-none">{e}</span>
          {entries.length > 1 || n > 1 ? (
            <span className="text-text-muted">{n}</span>
          ) : null}
        </span>
      ))}
    </button>
  );
}

/**
 * Tiny dropdown caret rendered at the corner of a bubble on desktop
 * hover, mirroring WhatsApp's behaviour. Mobile users use long-press
 * on the surrounding row instead.
 */
/**
 * Instagram-style 3-icon toolbar shown next to a message bubble on
 * hover (desktop) or long-press (mobile). The three actions are:
 *   1. ⋮  → open the full per-message menu
 *   2. ↩  → quick reply
 *   3. 😊 → quick react
 *
 * The toolbar is rendered as a single sibling of the bubble inside a
 * `group` wrapper, so all three buttons fade in together when the user
 * hovers anywhere on the row.
 */
function BubbleHoverAction({
  direction,
  onMenu,
  onReply,
  onReact,
}: {
  direction: "in" | "out";
  onMenu: () => void;
  onReply: () => void;
  onReact: () => void;
}) {
  return (
    <div
      className={
        "flex items-center gap-1 self-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition " +
        (direction === "out" ? "order-first mr-1" : "ml-1")
      }
    >
      <button
        type="button"
        onClick={onMenu}
        aria-label="More actions"
        className="size-7 rounded-full bg-surface/90 border border-line text-text-muted hover:text-text hover:bg-surface flex items-center justify-center"
      >
        <MoreVerticalIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onReply}
        aria-label="Reply"
        className="size-7 rounded-full bg-surface/90 border border-line text-text-muted hover:text-text hover:bg-surface flex items-center justify-center"
      >
        <ReplyIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onReact}
        aria-label="React"
        className="size-7 rounded-full bg-surface/90 border border-line text-text-muted hover:text-text hover:bg-surface flex items-center justify-center"
      >
        <SmileIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Per-message view-once bubble. The compact in-thread bubble shows
 * status only; tapping opens a fullscreen viewer with a countdown that
 * wipes the message on close, on timeout, or on app blur. Best-effort
 * screenshot detection (PrintScreen / Snip key, visibility change)
 * notifies the sender through a `vo_ss` envelope.
 */
function ViewOnceBubble({ m, time }: { m: ChatMessageRecord; time: string }) {
  const identity = useUnlockStore((s) => s.identity);
  const isOut = m.direction === "out";
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  // Outbound bubble: just status. Wipe-on-view is sender-side controlled
  // by the inbound vo_seen tombstone (applyViewOnceSeenByServerId).
  if (isOut) {
    let label = "View-once sent";
    if (m.screenshotAt) label = "⚠ Screenshot taken";
    else if (m.viewedAt) label = "Opened";
    return (
      <MessageBubble direction={m.direction} status={m.status} time={time}>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>👁</span>
          <span>{label}</span>
        </div>
      </MessageBubble>
    );
  }

  async function openViewer() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      if (m.attachment) {
        const u = await fetchAndDecryptMedia({ ...m.attachment });
        setUrl(u);
      }
      setViewerOpen(true);
      if (m.serverId) {
        void reportRead([m.serverId]).catch(() => undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open.");
    } finally {
      setLoading(false);
    }
  }

  function closeViewer() {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    setUrl(null);
    setViewerOpen(false);
    if (m.id !== undefined && identity) {
      const peerId = m.peerId;
      const localId = m.id;
      void consumeViewOnce(identity, peerId, localId).catch(() => undefined);
    }
  }

  return (
    <>
      <MessageBubble direction={m.direction} status={m.status} time={time}>
        <button
          onClick={openViewer}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-text-muted disabled:opacity-50"
        >
          <span>👁</span>
          <span>
            {loading
              ? "Opening…"
              : "Tap to open · disappears after viewing"}
          </span>
        </button>
        {error && (
          <div className="mt-1 text-[11px] text-red-400">{error}</div>
        )}
      </MessageBubble>
      {viewerOpen && (
        <ViewOnceViewer
          imageUrl={url}
          text={m.plaintext}
          onClose={closeViewer}
          onScreenshot={() => {
            if (m.serverId && identity) {
              void notifyViewOnceScreenshot(
                identity,
                m.peerId,
                m.serverId,
              ).catch(() => undefined);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Fullscreen view-once viewer. Auto-closes after 10s for media or 30s
 * for text. Closes immediately if the tab loses visibility (likely
 * screenshot or app switch). Listens for PrintScreen and the Win+Shift+S
 * snip combo and notifies the sender if pressed.
 */
function ViewOnceViewer({
  imageUrl,
  text,
  onClose,
  onScreenshot,
}: {
  imageUrl: string | null;
  text: string;
  onClose: () => void;
  onScreenshot: () => void;
}) {
  const TOTAL_MS = imageUrl ? 10_000 : 30_000;
  const [remainingMs, setRemainingMs] = useState(TOTAL_MS);
  const screenshotReportedRef = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, TOTAL_MS - (Date.now() - start));
      setRemainingMs(left);
      if (left <= 0) onClose();
    }, 100);
    return () => window.clearInterval(tick);
  }, [TOTAL_MS, onClose]);

  // Close on tab hide / app switch — common when the user is about to
  // screenshot or screen-share.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) onClose();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [onClose]);

  // Best-effort screenshot detection. Browsers deliberately do not fire
  // events for OS screenshots, but PrintScreen and Win+Shift+S are
  // observable as keydowns when the page has focus.
  useEffect(() => {
    function flagScreenshot() {
      if (screenshotReportedRef.current) return;
      screenshotReportedRef.current = true;
      onScreenshot();
    }
    function onKey(e: KeyboardEvent) {
      const k = e.key;
      if (k === "PrintScreen") {
        flagScreenshot();
      } else if (
        // Win+Shift+S (Windows snip), Cmd/Ctrl+Shift+3/4/5 (macOS)
        (e.shiftKey && (e.metaKey || e.ctrlKey) &&
          (k === "3" || k === "4" || k === "5" || k.toLowerCase() === "s"))
      ) {
        flagScreenshot();
      }
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [onScreenshot]);

  // Block right-click "Save image as…" on the contained image.
  const blockContextMenu = (e: { preventDefault: () => void }) =>
    e.preventDefault();

  const pct = Math.round((remainingMs / TOTAL_MS) * 100);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
      onContextMenu={blockContextMenu}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <div className="flex items-center gap-2 text-sm">
          <span>👁</span>
          <span>View-once · {seconds}s</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="size-9 rounded-full hover:bg-white/10 flex items-center justify-center text-xl"
        >
          ✕
        </button>
      </div>
      <div className="h-1 mx-4 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-wa-green transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="max-w-md text-center text-white text-lg leading-snug whitespace-pre-wrap break-words">
            {text || <span className="italic text-white/60">empty</span>}
          </div>
        )}
      </div>
      <div className="px-4 py-3 text-center text-[11px] text-white/60">
        Screenshots can't always be detected. The sender will be notified
        if we see one.
      </div>
    </div>
  );
}

export function LinkPreviewBlock({
  preview,
}: {
  preview: NonNullable<ChatMessageRecord["linkPreview"]>;
}) {
  // Privacy invariant: NEVER render `preview.imageUrl` directly. Doing so
  // would cause the recipient's browser to GET the image from the linked
  // site, leaking their IP and undoing the entire point of the feature.
  // We only render `imageDataUrl` (which the sender's server inlined).
  const href = preview.resolvedUrl ?? preview.url;
  let domain: string | null = null;
  try {
    domain = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    /* keep null */
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-2 -mx-1 block rounded-lg overflow-hidden bg-black/20 border border-white/5 animate-soft-pop hover:border-white/15 transition-colors"
    >
      {preview.imageDataUrl && (
        <img
          src={preview.imageDataUrl}
          alt=""
          className="w-full max-h-40 object-cover bg-black/30"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="p-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-muted">
          {preview.iconDataUrl && (
            <img
              src={preview.iconDataUrl}
              alt=""
              className="w-3 h-3 rounded-sm"
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="truncate">{preview.siteName || domain || ""}</span>
        </div>
        {preview.title && (
          <div className="text-sm text-text font-medium line-clamp-2 mt-0.5">
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div className="text-xs text-text-muted line-clamp-2 mt-0.5">
            {preview.description}
          </div>
        )}
      </div>
    </a>
  );
}

export function ImageAttachment({ att }: { att: NonNullable<ChatMessageRecord["attachment"]> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    if (url || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const u = await fetchAndDecryptMedia({ ...att, kind: "image" });
      setUrl(u);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load image.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!att.thumbB64) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aspect = att.width && att.height ? att.width / att.height : 1;
  const widthCSS = aspect >= 1 ? "min(260px, 70vw)" : "min(180px, 50vw)";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (url) setOpen(true);
          else void load();
        }}
        className="block rounded-md overflow-hidden bg-black/30 -mx-1 -mt-1"
        style={{ width: widthCSS, aspectRatio: String(aspect) }}
        aria-label="Open image"
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : att.thumbB64 ? (
          <div className="relative w-full h-full">
            <img
              src={`data:image/jpeg;base64,${att.thumbB64}`}
              alt=""
              className="w-full h-full object-cover blur-sm scale-105"
              draggable={false}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {loading ? <Spinner /> : (
                <span className="px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                  Tap to decrypt
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Spinner />
          </div>
        )}
      </button>
      {err && <div className="text-xs text-red-400 mt-1">{err}</div>}
      {open && url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img src={url} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}

export function VoiceAttachment({ att }: { att: NonNullable<ChatMessageRecord["attachment"]> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function ensureLoaded() {
    if (url || loading) return url;
    setLoading(true);
    setErr(null);
    try {
      const u = await fetchAndDecryptMedia({ ...att, kind: "voice" });
      setUrl(u);
      return u;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load audio.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const u = url ?? (await ensureLoaded());
    if (!u) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio(u);
      audioRef.current = a;
      a.addEventListener("timeupdate", () => {
        if (a && a.duration) setProgress(a.currentTime / a.duration);
      });
      a.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
    }
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't play audio.");
      }
    }
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const totalSec = Math.round((att.durationMs ?? 0) / 1000);
  const elapsedSec = Math.round(totalSec * progress);

  return (
    <div className="flex items-center gap-2 -my-0.5 min-w-[180px]">
      <button
        type="button"
        onClick={toggle}
        className="size-9 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center shrink-0"
        aria-label={playing ? "Pause" : "Play"}
      >
        {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-wa-green"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="text-[10.5px] text-text-muted mt-0.5 tabular-nums">
          {fmtTime(playing ? elapsedSec : totalSec)}
        </div>
        {err && <div className="text-[10.5px] text-red-400">{err}</div>}
      </div>
    </div>
  );
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ────────────────────────── Link preview card (compose) ────────────────────────── */

export function LinkPreviewCard({
  preview,
  loading,
  onDismiss,
}: {
  preview: EnvelopeLinkPreview;
  loading: boolean;
  onDismiss: () => void;
}) {
  return (
    <div className="px-3 pb-2">
      <div className="flex gap-2 bg-surface border border-line rounded-md overflow-hidden">
        {preview.imageUrl && (
          <img
            src={preview.imageUrl}
            alt=""
            className="w-16 h-16 object-cover"
          />
        )}
        <div className="flex-1 p-2 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-text-muted truncate">
            {preview.siteName ?? new URL(preview.url).host}
          </div>
          <div className="text-sm text-text font-medium truncate">
            {loading ? "Loading preview…" : preview.title ?? preview.url}
          </div>
          {preview.description && (
            <div className="text-xs text-text-muted line-clamp-1">
              {preview.description}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="px-2 text-text-muted hover:text-text"
          aria-label="Dismiss preview"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────── Menus ────────────────────────── */

function ChatMenu({
  onClose,
  ttlLabel,
  onTTL,
  seenTtlLabel,
  onSeenTtl,
  onSafety,
  onToggleBiometric,
  biometricEnabled,
  viewOnceDefault,
  onToggleViewOnce,
  linkPreviewsEnabled,
  onToggleLinkPreviews,
  blockedByMe,
  onToggleBlock,
  onReport,
  pinnedToTop,
  onTogglePinChat,
  isMuted,
  onToggleMute,
  onSearch,
  onClearChat,
  onShowStarred,
  onSelectMessages,
  onShowScheduled,
  onWallpaper,
  onCustomize,
}: {
  onClose: () => void;
  ttlLabel: string;
  onTTL: () => void;
  seenTtlLabel: string;
  onSeenTtl: () => void;
  onSafety: () => void;
  onToggleBiometric: () => void;
  biometricEnabled: boolean;
  viewOnceDefault: boolean;
  onToggleViewOnce: () => void;
  linkPreviewsEnabled: boolean;
  onToggleLinkPreviews: () => void;
  blockedByMe: boolean;
  onToggleBlock: () => void;
  onReport: () => void;
  pinnedToTop: boolean;
  onTogglePinChat: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onSearch: () => void;
  onClearChat: () => void;
  onShowStarred: () => void;
  onSelectMessages: () => void;
  onShowScheduled: () => void;
  onWallpaper: () => void;
  onCustomize: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <MenuItem
        label="Select messages"
        onClick={() => {
          onSelectMessages();
          onClose();
        }}
      />
      <MenuItem
        label={pinnedToTop ? "Unpin chat" : "Pin chat to top"}
        onClick={() => {
          onTogglePinChat();
          onClose();
        }}
      />
      <MenuItem
        label={isMuted ? "Unmute notifications" : "Mute notifications"}
        onClick={() => {
          onToggleMute();
          onClose();
        }}
      />
      <MenuItem
        label="Search in chat"
        onClick={() => {
          onSearch();
          onClose();
        }}
      />
      <MenuItem
        label="Starred messages"
        onClick={() => {
          onShowStarred();
        }}
      />
      <MenuItem
        label="Scheduled messages"
        onClick={() => {
          onShowScheduled();
        }}
      />
      <MenuItem label="Chat wallpaper" onClick={onWallpaper} />
      <MenuItem label="Customize chat" onClick={onCustomize} />
      <MenuItem label={`Disappearing messages · ${ttlLabel}`} onClick={onTTL} />
      <MenuItem label={`Seen settings · ${seenTtlLabel}`} onClick={onSeenTtl} />
      <MenuItem
        label={`View-once images: ${viewOnceDefault ? "On" : "Off"}`}
        onClick={() => {
          onToggleViewOnce();
          onClose();
        }}
      />
      <MenuItem
        label={`Link previews: ${linkPreviewsEnabled ? "On" : "Off"}`}
        onClick={() => {
          onToggleLinkPreviews();
          onClose();
        }}
      />
      <MenuItem label="Verify safety number" onClick={onSafety} />
      <MenuItem
        label={biometricEnabled ? "Remove biometric lock" : "Lock chat with biometrics"}
        onClick={() => {
          onClose();
          onToggleBiometric();
        }}
        danger={biometricEnabled}
      />
      <MenuItem label="Clear chat" onClick={onClearChat} danger />
      <MenuItem
        label={blockedByMe ? "Unblock contact" : "Block contact"}
        onClick={onToggleBlock}
        danger={!blockedByMe}
      />
      <MenuItem label="Report contact" onClick={onReport} danger />
    </Sheet>
  );
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "impersonation", label: "Impersonation" },
  { value: "illegal", label: "Illegal activity" },
  { value: "other", label: "Other" },
];

type ReportReason = "spam" | "harassment" | "impersonation" | "illegal" | "other";

function ReportDialog({
  peerLabel,
  onClose,
  onSubmit,
}: {
  peerLabel: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, note: string, alsoBlock: boolean) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Sheet onClose={onClose} title={`Report ${peerLabel}`}>
      <div className="px-4 pb-4">
        <div className="text-xs text-text-muted mb-3">
          Veil never sees your messages. We only receive the category and
          your optional note.
        </div>
        <div className="space-y-1 mb-3">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer"
            >
              <input
                type="radio"
                name="reason"
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              <span className="text-sm text-text">{r.label}</span>
            </label>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Optional context (max 500 chars)"
          className="w-full bg-surface text-text placeholder:text-text-muted rounded-md p-2 outline-none border border-line text-sm mb-3"
        />
        <label className="flex items-center gap-2 mb-3 text-sm text-text">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
          />
          Also block this contact
        </label>
        {err && <ErrorMessage>{err}</ErrorMessage>}
        <div className="flex gap-2 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-line text-text"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await onSubmit(reason, note.trim(), alsoBlock);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Could not submit.");
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 py-2 rounded-md bg-red-500/90 text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function TTLPicker({
  current,
  onClose,
  onPick,
}: {
  current: number;
  onClose: () => void;
  onPick: (secs: number) => void;
}) {
  return (
    <Sheet onClose={onClose} title="Disappearing messages">
      <div className="text-xs text-text-muted px-4 pb-2">
        New messages you send will be deleted from both devices and the server
        after the chosen time.
      </div>
      {TTL_OPTIONS.map((o) => (
        <MenuItem
          key={o.seconds}
          label={o.label}
          checked={o.seconds === current}
          onClick={() => onPick(o.seconds)}
        />
      ))}
    </Sheet>
  );
}

/**
 * Snooze / mute-until sheet — offers WhatsApp-style fixed durations
 * (1 hour, 8 hours, until tomorrow morning, 1 week) plus an "Always"
 * option for permanent muting. Each pick yields an ISO timestamp the
 * caller writes into chatPrefs.mutedUntil; "Always" maps to a
 * far-future date so the existing isMuted check (now < mutedUntil)
 * keeps working without schema changes.
 */
function SnoozeSheet({
  peerLabel,
  onClose,
  onPick,
}: {
  peerLabel: string;
  onClose: () => void;
  onPick: (untilIso: string) => void;
}) {
  // "Tomorrow at 8 AM" reuses the device's current locale clock so the
  // user always wakes up to a freshly un-muted chat regardless of TZ.
  const tomorrowMorning = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  })();
  const tomorrowClock = tomorrowMorning.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const options: { label: string; until: Date }[] = [
    {
      label: "1 hour",
      until: new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      label: "8 hours",
      until: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
    {
      label: `Until tomorrow (${tomorrowClock})`,
      until: tomorrowMorning,
    },
    {
      label: "1 week",
      until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      label: "Always",
      // Year 9999 — effectively forever, but still a valid ISO date.
      until: new Date("9999-12-31T23:59:59.000Z"),
    },
  ];
  return (
    <Sheet onClose={onClose} title={`Mute ${peerLabel}`}>
      <div className="text-xs text-text-muted px-4 pb-2">
        You won't be notified about new messages from this chat.
      </div>
      {options.map((o) => (
        <MenuItem
          key={o.label}
          label={o.label}
          onClick={() => onPick(o.until.toISOString())}
        />
      ))}
    </Sheet>
  );
}

/**
 * Seen Settings picker — lets the user choose how long after a message is
 * read before it auto-deletes from their device. Uses H / M / S drum columns.
 */
function SeenTTLPicker({
  current,
  onClose,
  onPick,
}: {
  current: number;
  onClose: () => void;
  onPick: (secs: number) => void;
}) {
  const [hours, setHours] = useState(Math.floor(current / 3600));
  const [minutes, setMinutes] = useState(Math.floor((current % 3600) / 60));
  const [seconds, setSeconds] = useState(current % 60);

  const total = hours * 3600 + minutes * 60 + seconds;
  const preview = total > 0 ? formatSeenTtl(total) : "Off (disabled)";

  function DrumColumn({
    value,
    max,
    label,
    onChange,
  }: {
    value: number;
    max: number;
    label: string;
    onChange: (v: number) => void;
  }) {
    return (
      <div className="flex flex-col items-center gap-1 flex-1">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange(value === max ? 0 : value + 1)}
          className="size-8 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-white/10 text-lg select-none"
          aria-label={`Increase ${label}`}
        >
          ▲
        </button>
        <div className="w-14 h-10 flex items-center justify-center bg-bg rounded-lg border border-line text-text text-xl font-mono font-semibold select-none tabular-nums">
          {String(value).padStart(2, "0")}
        </div>
        <button
          type="button"
          onClick={() => onChange(value === 0 ? max : value - 1)}
          className="size-8 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-white/10 text-lg select-none"
          aria-label={`Decrease ${label}`}
        >
          ▼
        </button>
      </div>
    );
  }

  return (
    <Sheet onClose={onClose} title="Seen settings">
      <div className="px-4 pt-1 pb-4 space-y-4">
        <p className="text-xs text-text-muted leading-relaxed">
          Messages you <span className="text-text font-medium">receive</span> will
          automatically be deleted from this device after you see them, once the
          chosen time has passed. Set all to zero to disable.
        </p>

        {/* H / M / S drum columns */}
        <div className="flex items-center justify-center gap-3 py-2">
          <DrumColumn value={hours} max={23} label="Hours" onChange={setHours} />
          <span className="text-2xl text-text-muted font-bold mt-4">:</span>
          <DrumColumn value={minutes} max={59} label="Min" onChange={setMinutes} />
          <span className="text-2xl text-text-muted font-bold mt-4">:</span>
          <DrumColumn value={seconds} max={59} label="Sec" onChange={setSeconds} />
        </div>

        {/* Quick presets */}
        <div className="space-y-1">
          <div className="text-[10px] text-text-muted uppercase tracking-wider px-1">Quick presets</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Off", secs: 0 },
              { label: "30 sec", secs: 30 },
              { label: "1 min", secs: 60 },
              { label: "5 min", secs: 300 },
              { label: "30 min", secs: 1800 },
              { label: "1 hour", secs: 3600 },
              { label: "6 hours", secs: 21600 },
              { label: "12 hours", secs: 43200 },
              { label: "1 day", secs: 86400 },
            ].map((p) => (
              <button
                key={p.secs}
                type="button"
                onClick={() => {
                  setHours(Math.floor(p.secs / 3600));
                  setMinutes(Math.floor((p.secs % 3600) / 60));
                  setSeconds(p.secs % 60);
                }}
                className={
                  "px-2 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                  (total === p.secs
                    ? "bg-wa-green text-text-oncolor border-transparent"
                    : "bg-surface border-line text-text hover:bg-white/10")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview + confirm */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-sm text-text-muted">
            Delete after:{" "}
            <span className={total > 0 ? "text-wa-green font-semibold" : "text-text"}>
              {preview}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onPick(total)}
            className="px-4 py-2 rounded-xl bg-wa-green text-text-oncolor text-sm font-medium hover:bg-wa-green-dark transition"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function SafetyNumberDialog({
  myId,
  peerId,
  peerLabel,
  onClose,
}: {
  myId: string;
  peerId: string;
  peerLabel: string;
  onClose: () => void;
}) {
  const [number, setNumber] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const myKey = trpc.prekeys.identityKeyFor.useQuery({ userId: myId }, {
    enabled: !!myId,
    retry: false,
  });
  const peerKey = trpc.prekeys.identityKeyFor.useQuery({ userId: peerId }, {
    retry: false,
  });

  useEffect(() => {
    const myPub = myKey.data?.identityPublicKey;
    const peerPub = peerKey.data?.identityPublicKey;
    if (!myPub || !peerPub) return;
    void safetyNumberFromB64(myPub, peerPub)
      .then(setNumber)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Could not derive number."),
      );
  }, [myKey.data, peerKey.data]);

  return (
    <Sheet onClose={onClose} title="Verify safety number">
      <div className="px-4 pb-4">
        <div className="text-xs text-text-muted mb-3">
          Compare these 60 digits with {peerLabel} in person or over a trusted
          channel. If they match, your conversation has not been intercepted.
        </div>
        {err ? (
          <ErrorMessage>{err}</ErrorMessage>
        ) : !number ? (
          <div className="text-sm text-text-muted">Computing…</div>
        ) : (
          <div className="font-mono text-sm leading-7 tracking-wider bg-surface rounded-md p-3 break-words">
            {number}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Sheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
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
        {title && (
          <div className="px-4 pt-4 pb-2 font-semibold text-text">{title}</div>
        )}
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  checked,
  danger,
}: {
  label: string;
  onClick: () => void;
  checked?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left px-4 py-3 border-b border-line/40 text-sm flex items-center justify-between hover:bg-white/5 " +
        (danger ? "text-red-400" : "text-text")
      }
    >
      <span>{label}</span>
      {checked && <span className="text-wa-green">✓</span>}
    </button>
  );
}

/* ────────────────────────── Composer ────────────────────────── */

/**
 * Sticky top bar that takes over the chat header while the user is in
 * bulk-select mode. Shows a count, a "Select all" toggle, and an X to
 * leave selection mode.
 */
function SelectionTopBar({
  count,
  allSelected,
  onSelectAll,
  onCancel,
}: {
  count: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-3 py-2 bg-wa-green text-text-oncolor flex items-center gap-3 border-b border-line">
      <button
        type="button"
        aria-label="Cancel selection"
        onClick={onCancel}
        className="text-xl leading-none px-1"
      >
        ✕
      </button>
      <div className="flex-1 font-medium text-sm">
        {count === 0 ? "Select messages" : `${count} selected`}
      </div>
      <button
        type="button"
        onClick={onSelectAll}
        className="text-xs px-2 py-1 rounded bg-black/15 hover:bg-black/25"
      >
        {allSelected ? "Deselect all" : "Select all"}
      </button>
    </div>
  );
}

/**
 * Footer action bar shown in place of the composer while bulk-select
 * mode is active. Renders Delete (always) and Unsend (only when every
 * selected row is an outbound message that has actually been sent).
 */
function SelectionActionBar({
  count,
  busy,
  canUnsend,
  onDeleteLocal,
  onUnsend,
  onCancel,
}: {
  count: number;
  busy: boolean;
  canUnsend: boolean;
  onDeleteLocal: () => void;
  onUnsend: () => void;
  onCancel: () => void;
}) {
  const disabled = busy || count === 0;
  return (
    <div className="px-3 py-2 bg-panel border-t border-line flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="px-3 py-2 text-sm text-text-muted disabled:opacity-50"
      >
        Cancel
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onDeleteLocal}
        disabled={disabled}
        className="px-3 py-2 rounded-md bg-wa-bubble-in text-text text-sm font-medium disabled:opacity-50"
      >
        Delete{count > 0 ? ` (${count})` : ""}
      </button>
      {canUnsend && (
        <button
          type="button"
          onClick={onUnsend}
          disabled={disabled}
          className="px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-50"
        >
          Unsend{count > 0 ? ` (${count})` : ""}
        </button>
      )}
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  sending,
  onSendText,
  onPickImage,
  onSendVoice,
  viewOnceDefault,
  oneShotViewOnce,
  onToggleOneShotViewOnce,
  replyTo,
  onClearReply,
  onSchedule,
  onActivity,
}: {
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  onSendText: () => void;
  onPickImage: (f: File) => void;
  onSendVoice: (bytes: Uint8Array, mime: string, durationMs: number) => void;
  viewOnceDefault: boolean;
  oneShotViewOnce: boolean;
  onToggleOneShotViewOnce: () => void;
  replyTo: { row: ChatMessageRecord; ref: EnvelopeReplyRef } | null;
  onClearReply: () => void;
  onSchedule: (text: string, scheduledFor: string) => Promise<void>;
  onActivity?: (typing: boolean, kind: "text" | "voice" | "photo") => void;
}) {
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Auto-cancel "choosing a photo…" if the OS file dialog is dismissed —
  // we have no `cancel` event, so we rely on focus returning + a timeout.
  const photoActivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Veil keyboard ───────────────────────────────────────────────
  // The user's stored preference (off by default). Available on both
  // touch devices and desktops, but with device-adapted behavior:
  //   - Touch devices: replaces the OS soft keyboard, auto-opens on
  //     focus, and `inputMode="none"` suppresses the system IME.
  //   - Desktops/laptops: opt-in click-to-open panel that runs
  //     alongside the physical keyboard. It never auto-pops (that
  //     would be jarring when a real keyboard is present) and it
  //     doesn't disable the physical keyboard, so the user can click
  //     sensitive characters with the mouse and type the rest.
  const useVeilKbPref = useKeyboardPrefs((s) => s.useVeilKeyboard);
  const showKbSwitch = useKeyboardPrefs((s) => s.showComposerSwitch);
  const [coarsePointer] = useState(() => isCoarsePointerDevice());
  // Per-session escape hatch: tapping the ⌨ icon flips between Veil
  // keyboard and system keyboard for this composer until the user
  // navigates away, without changing the global pref.
  const [sessionUseSystem, setSessionUseSystem] = useState(false);
  const veilKbActive = useVeilKbPref && !sessionUseSystem;
  const [veilKbOpen, setVeilKbOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Insert a character at the textarea's current cursor position. */
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? draft.length;
    const end = ta?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      const pos = start + text.length;
      try {
        t.setSelectionRange(pos, pos);
      } catch {
        /* selection isn't always supported during fast typing — ignore */
      }
    });
  };

  /** Delete the character before the cursor (or selection contents). */
  const backspaceAtCursor = () => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? draft.length;
    const end = ta?.selectionEnd ?? draft.length;
    if (start === end && start === 0) return;
    const newStart = start === end ? start - 1 : start;
    const next = draft.slice(0, newStart) + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      try {
        t.setSelectionRange(newStart, newStart);
      } catch {
        /* ignore */
      }
    });
  };

  if (recording) {
    return (
      <RecordingBar
        rec={recording}
        onCancel={() => {
          recording.cancel();
          setRecording(null);
          onActivity?.(false, "voice");
        }}
        onSend={async () => {
          const result = await recording.finish();
          setRecording(null);
          onActivity?.(false, "voice");
          if (result) onSendVoice(result.bytes, result.mime, result.durationMs);
        }}
      />
    );
  }

  return (
    <>
    <div className="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-line/60">
      {replyTo && (
        <div className="px-3 py-2 border-b border-line/60 bg-surface/40 flex items-start gap-2">
          <div
            className={
              "flex-1 min-w-0 px-2 py-1 rounded border-l-4 bg-black/20 " +
              (replyTo.ref.dir === "out" ? "border-wa-green" : "border-pink-400")
            }
          >
            <div className="text-[11px] font-medium text-text/80">
              Replying to {replyTo.ref.dir === "out" ? "yourself" : "them"}
            </div>
            <div className="text-[12px] text-text-muted truncate">
              {replyTo.ref.body || <span className="italic">empty message</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="size-7 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {emojiOpen && (
        <div className="px-2 pb-2 pt-1">
          <EmojiPicker
            onPick={(e) => setDraft(draft + e)}
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
          onClick={() => {
            // Tell the peer we're "choosing a photo" the moment the OS
            // dialog opens, and auto-clear after 30s in case they cancel.
            onActivity?.(true, "photo");
            if (photoActivityTimer.current) clearTimeout(photoActivityTimer.current);
            photoActivityTimer.current = setTimeout(() => {
              onActivity?.(false, "photo");
            }, 30_000);
            fileInput.current?.click();
          }}
          disabled={sending}
          className="size-9 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label={
            viewOnceDefault || oneShotViewOnce
              ? "Attach view-once image"
              : "Attach image"
          }
          title={
            viewOnceDefault || oneShotViewOnce ? "View-once image" : "Image"
          }
        >
          {viewOnceDefault || oneShotViewOnce ? (
            <span>👁</span>
          ) : (
            <PaperclipIcon className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleOneShotViewOnce}
          disabled={sending}
          className={
            "size-9 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0 text-lg disabled:opacity-50 " +
            (oneShotViewOnce
              ? "text-wa-green bg-wa-green/15"
              : "text-text-muted hover:text-text")
          }
          aria-label={
            oneShotViewOnce
              ? "Turn off view-once for next message"
              : "Send next message as view-once"
          }
          aria-pressed={oneShotViewOnce}
          title={
            oneShotViewOnce
              ? "Next message disappears after one view"
              : "View-once mode"
          }
        >
          👁
        </button>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!sending && draft.trim()) onSendText();
            }
          }}
          onFocus={() => {
            // Auto-open only on touch devices. On desktop the user
            // already has a physical keyboard, so silently popping a
            // panel would be obnoxious — they open it explicitly via
            // the ⌨ button.
            if (veilKbActive && coarsePointer) setVeilKbOpen(true);
          }}
          rows={1}
          placeholder="Type a message"
          // Suppress the OS soft keyboard only on touch devices when
          // the Veil keyboard is active. On desktop we deliberately
          // keep the physical keyboard usable alongside the on-screen
          // panel — the user can mix mouse-clicks and key presses.
          inputMode={veilKbActive && coarsePointer ? "none" : undefined}
          className="flex-1 bg-transparent text-text placeholder:text-text-muted resize-none outline-none max-h-32 py-1.5 px-1"
          style={{ minHeight: "24px" }}
        />
        {veilKbActive && showKbSwitch && (
          <KeyboardSwitchButton
            active={true}
            onClick={() => {
              if (coarsePointer) {
                // Touch: hand control back to the OS soft keyboard.
                setSessionUseSystem(true);
                setVeilKbOpen(false);
                requestAnimationFrame(() => textareaRef.current?.focus());
              } else {
                // Desktop: just toggle the panel open/closed. The
                // physical keyboard always remains available.
                setVeilKbOpen((open) => !open);
              }
            }}
            label={
              coarsePointer
                ? "Switch to system keyboard for this chat"
                : veilKbOpen
                  ? "Hide Veil keyboard"
                  : "Show Veil keyboard"
            }
          />
        )}
        {!veilKbActive && useVeilKbPref && showKbSwitch && (
          <KeyboardSwitchButton
            active={false}
            onClick={() => {
              setSessionUseSystem(false);
              setVeilKbOpen(true);
              requestAnimationFrame(() => textareaRef.current?.focus());
            }}
            label="Switch back to Veil keyboard"
          />
        )}
      </div>
      {draft.trim() ? (
        <>
          {/* Schedule button — only visible when there's text to schedule */}
          <button
            type="button"
            onClick={() => setSchedulePickerOpen(true)}
            disabled={sending}
            className="size-10 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0 text-xl disabled:opacity-50"
            aria-label="Schedule message"
            title="Schedule message"
          >
            🕐
          </button>
          <button
            onClick={onSendText}
            disabled={sending}
            data-veil-send-btn
            className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center hover:bg-wa-green-dark transition disabled:opacity-50 wa-tap shrink-0"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </>
      ) : (
        <button
          onClick={async () => {
            const r = await startRecording();
            if (r.kind === "ok") {
              setRecording(r.state);
              onActivity?.(true, "voice");
            } else {
              alert(r.message);
            }
          }}
          disabled={sending}
          className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center hover:bg-wa-green-dark transition disabled:opacity-50 wa-tap shrink-0"
          aria-label="Record voice message"
        >
          <MicIcon className="w-6 h-6" />
        </button>
      )}
      </div>

      {veilKbActive && veilKbOpen && (
        <VeilKeyboard
          onChar={insertAtCursor}
          onBackspace={backspaceAtCursor}
          onSubmit={() => {
            if (!sending && draft.trim()) onSendText();
          }}
          onClose={() => {
            setVeilKbOpen(false);
            textareaRef.current?.blur();
          }}
        />
      )}
    </div>

    {schedulePickerOpen && draft.trim() && (
      <SchedulePickerSheet
        onClose={() => setSchedulePickerOpen(false)}
        onSchedule={async (iso) => {
          await onSchedule(draft.trim(), iso);
          setDraft("");
          setSchedulePickerOpen(false);
        }}
      />
    )}
    </>
  );
}

/**
 * Compact toggle that swaps the active keyboard between the Veil
 * private keyboard and the system keyboard for the current chat.
 * Only rendered on touch devices when the user has the Veil keyboard
 * enabled in Settings.
 */
function KeyboardSwitchButton({
  active,
  onClick,
  label,
}: {
  /** True when the Veil keyboard is currently the active keyboard. */
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "size-9 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0 wa-tap " +
        (active ? "text-wa-green" : "text-text-muted hover:text-text")
      }
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
      </svg>
    </button>
  );
}

export function RecordingBar({
  onCancel,
  onSend,
}: {
  rec: RecordingState;
  onCancel: () => void;
  onSend: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if (ms >= MAX_VOICE_MS) {
        void onSend();
      }
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sticky bottom-0 bg-bg/95 backdrop-blur px-3 py-3 border-t border-line flex items-center gap-3">
      <button
        onClick={onCancel}
        className="size-10 rounded-full text-red-500 hover:bg-white/10 flex items-center justify-center"
        aria-label="Cancel recording"
      >
        <TrashIcon />
      </button>
      <div className="flex-1 flex items-center gap-2">
        <span className="size-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm text-text tabular-nums">
          {fmtTime(Math.floor(elapsed / 1000))}
        </span>
        <span className="text-xs text-text-muted">Recording…</span>
      </div>
      <button
        onClick={onSend}
        className="size-12 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center"
        aria-label="Stop and send"
      >
        <StopIcon />
      </button>
    </div>
  );
}

/* ────────────────────────── Recording impl ────────────────────────── */

export interface RecordingState {
  cancel: () => void;
  finish: () => Promise<{ bytes: Uint8Array; mime: string; durationMs: number } | null>;
}

export async function startRecording(): Promise<
  { kind: "ok"; state: RecordingState } | { kind: "err"; message: string }
> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { kind: "err", message: "Voice messages aren't supported on this device." };
  }
  if (typeof MediaRecorder === "undefined") {
    return { kind: "err", message: "Voice recording isn't supported by this browser." };
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return {
      kind: "err",
      message: e instanceof Error ? e.message : "Microphone permission denied.",
    };
  }
  const mime = pickAudioMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  rec.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  rec.start();

  let cancelled = false;

  function stopStream() {
    for (const t of stream.getTracks()) t.stop();
  }

  return {
    kind: "ok",
    state: {
      cancel() {
        cancelled = true;
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* ignore */
        }
        stopStream();
      },
      finish() {
        return new Promise((resolve) => {
          if (cancelled) return resolve(null);
          if (rec.state === "inactive") {
            stopStream();
            return resolve(null);
          }
          rec.onstop = async () => {
            stopStream();
            if (cancelled) return resolve(null);
            const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
            const buf = await blob.arrayBuffer();
            resolve({
              bytes: new Uint8Array(buf),
              mime: rec.mimeType || "audio/webm",
              durationMs: Date.now() - startedAt,
            });
          };
          try {
            rec.stop();
          } catch {
            stopStream();
            resolve(null);
          }
        });
      },
    },
  };
}

function pickAudioMime(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

void getChatPref;
void envelopePreview;

/* ─────────────────── Per-message action overlays ─────────────────── */

/**
 * Bottom sheet shown when the user taps/long-presses a message bubble.
 * Offers Reply / React / Delete (delete only on outbound). The full
 * delete dialog and reaction picker are spawned by the parent via the
 * `onDelete` / `onReact` callbacks.
 */
/** 15-minute edit window mirrors WhatsApp's policy. Client-side only. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

function MessageActionMenu({
  row,
  onClose,
  onReply,
  onReact,
  onEdit,
  onCopy,
  onStar,
  onPin,
  onInfo,
  onDelete,
  onForward,
  onReport,
}: {
  row: ChatMessageRecord;
  onClose: () => void;
  onReply: () => void;
  onReact: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onStar: () => void;
  onPin: () => void;
  onInfo: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReport: () => void;
}) {
  const isOut = row.direction === "out";
  const hasText = !!row.plaintext && row.plaintext.length > 0;
  const isEditable =
    isOut &&
    !!row.serverId &&
    !row.deleted &&
    !row.attachment &&
    hasText &&
    Date.now() - new Date(row.createdAt).getTime() < EDIT_WINDOW_MS;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      role="dialog"
      aria-label="Message actions"
    >
      <div
        className="w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl border border-line shadow-sheet max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionRow Icon={ReplyIcon} label="Reply" onClick={onReply} />
        <ActionRow
          Icon={SmileIcon}
          label="React"
          onClick={onReact}
          disabled={!row.serverId}
          hint={!row.serverId ? "Wait until sent" : undefined}
        />
        {isEditable && (
          <ActionRow Icon={EditIcon} label="Edit" onClick={onEdit} />
        )}
        {hasText && (
          <ActionRow Icon={CopyIcon} label="Copy" onClick={onCopy} />
        )}
        <ActionRow
          Icon={(p) => <StarIcon {...p} filled={!!row.starred} />}
          label={row.starred ? "Unstar" : "Star"}
          onClick={onStar}
        />
        <ActionRow
          Icon={PinIcon}
          label={row.pinned ? "Unpin" : "Pin"}
          onClick={onPin}
          disabled={!row.serverId}
        />
        <ActionRow
          Icon={ForwardIcon}
          label="Forward"
          onClick={onForward}
        />
        {isOut && (
          <ActionRow Icon={InfoIcon} label="Info" onClick={onInfo} />
        )}
        <ActionRow
          Icon={TrashIcon}
          label={isOut ? "Delete message" : "Delete for me"}
          onClick={onDelete}
          destructive
        />
        {!isOut && (
          <ActionRow
            Icon={FlagIcon}
            label="Report"
            onClick={onReport}
            destructive
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-3 text-text-muted text-sm border-t border-line"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActionRow({
  Icon,
  label,
  onClick,
  destructive,
  disabled,
  hint,
}: {
  Icon: (props: { className?: string }) => JSX.Element;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full px-4 py-3 flex items-center gap-3 text-left border-b border-line/60 last:border-b-0 disabled:opacity-50 " +
        (destructive ? "text-red-400" : "text-text") +
        " hover:bg-white/5"
      }
    >
      <span className="w-6 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </button>
  );
}

/**
 * Floating reaction picker mounted as a centered popover. Wraps the
 * reusable `ReactionPicker` strip (with expand-to-grid) and gives it a
 * dimmed scrim so taps outside dismiss.
 */
function ReactionPickerSheet({
  row,
  myUserId,
  onClose,
  onPick,
}: {
  row: ChatMessageRecord;
  myUserId: string;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const mine = row.reactions?.[myUserId] ?? "";
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-label="React"
    >
      <div onClick={(e) => e.stopPropagation()}>
        <ReactionPicker value={mine} onPick={onPick} onClose={onClose} />
      </div>
    </div>
  );
}

/**
 * Three-button confirm dialog:
 *   [Unsend] [Delete for me] [Cancel]
 *
 * "Unsend" is hidden for inbound messages — you can only unsend your
 * own. Unsend hard-deletes the message on both devices with no
 * tombstone or "deleted" placeholder anywhere in the UI.
 */
function DeleteMessageDialog({
  row,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  row: ChatMessageRecord;
  onClose: () => void;
  onDeleteForMe: () => void | Promise<void>;
  onDeleteForEveryone: () => void | Promise<void>;
}) {
  const isOut = row.direction === "out";
  const canUnsend = isOut && !!row.serverId;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-label="Delete message"
    >
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-line shadow-sheet p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold text-text mb-1">
          Delete message?
        </div>
        <div className="text-sm text-text-muted mb-4">
          {canUnsend
            ? "Unsend removes this message from both your chat and theirs, with no trace. Delete for me only removes it from this device."
            : "This message will be removed from this device only."}
        </div>
        <div className="flex flex-col gap-2">
          {canUnsend && (
            <button
              type="button"
              onClick={() => void onDeleteForEveryone()}
              className="w-full px-4 py-2.5 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 transition text-sm font-medium"
            >
              Unsend
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDeleteForMe()}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-text hover:bg-white/10 transition text-sm font-medium"
          >
            Delete for me
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-text-muted hover:bg-white/5 transition text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Phase-1 polish components: pin banner, edit, info, starred ───────────── */

/**
 * Sticky banner under the AppBar showing the currently-pinned message.
 * Tap to scroll to the original; long-press the pin icon to unpin.
 */
export function PinnedMessageBanner({
  row,
  onJump,
  onUnpin,
}: {
  row: {
    deleted?: boolean;
    attachment?: ChatMessageRecord["attachment"];
    plaintext?: string;
  };
  onJump: () => void;
  onUnpin: () => void;
}) {
  const preview = row.deleted
    ? "Message deleted"
    : row.attachment?.kind === "image"
      ? "📷 Photo"
      : row.attachment?.kind === "voice"
        ? "🎙 Voice message"
        : (row.plaintext ?? "").slice(0, 80);
  return (
    <div className="px-3 py-2 bg-panel/90 border-b border-line flex items-center gap-2">
      <PinIcon className="w-4 h-4 text-wa-green" />
      <button
        type="button"
        onClick={onJump}
        className="flex-1 text-left min-w-0"
      >
        <div className="text-[10px] uppercase tracking-wide text-text-muted">
          Pinned message
        </div>
        <div className="text-sm text-text truncate">{preview || "—"}</div>
      </button>
      <button
        type="button"
        onClick={onUnpin}
        aria-label="Unpin"
        className="text-text-muted hover:text-text px-1"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Edit dialog for an outbound text message. Pre-fills the existing
 * body, enforces the 15-minute window client-side, and submits the
 * edit via `editChatMessage` (which transmits a `t:"edit"` envelope).
 */
export function EditMessageDialog({
  row,
  onClose,
  onSubmit,
}: {
  row: { plaintext?: string; createdAt: string };
  onClose: () => void;
  onSubmit: (newBody: string) => Promise<void>;
}) {
  const [text, setText] = useState(row.plaintext ?? "");
  const [busy, setBusy] = useState(false);
  const trimmed = text.trim();
  const unchanged = trimmed === (row.plaintext ?? "").trim();
  const tooOld =
    Date.now() - new Date(row.createdAt).getTime() >= EDIT_WINDOW_MS;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-label="Edit message"
    >
      <div
        className="w-full max-w-md bg-surface rounded-2xl border border-line shadow-sheet p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold text-text mb-1">
          Edit message
        </div>
        <div className="text-xs text-text-muted mb-3">
          Edits are visible to your contact and tagged "(edited)". You
          can edit a message for up to 15 minutes after sending.
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full bg-bg text-text rounded-md p-2 outline-none border border-line text-sm mb-3 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-text-muted hover:bg-white/5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !trimmed || unchanged || tooOld}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(trimmed);
              } finally {
                setBusy(false);
              }
            }}
            className="px-4 py-2 rounded-xl bg-wa-green text-text-oncolor disabled:opacity-50 text-sm font-medium"
          >
            {tooOld ? "Too old" : busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Read-only sheet showing delivery + read timestamps for a message. */
export function MessageInfoDialog({
  row,
  onClose,
}: {
  row: {
    createdAt: string;
    deliveredAt?: string;
    readAt?: string;
    editedAt?: string;
  };
  onClose: () => void;
}) {
  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString() : "—";
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      role="dialog"
      aria-label="Message info"
    >
      <div
        className="w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl border border-line shadow-sheet p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold text-text mb-3">
          Message info
        </div>
        <InfoLine label="Sent" value={fmt(row.createdAt)} />
        <InfoLine label="Delivered" value={fmt(row.deliveredAt)} />
        <InfoLine label="Read" value={fmt(row.readAt)} />
        {row.editedAt && <InfoLine label="Edited" value={fmt(row.editedAt)} />}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 rounded-xl text-text-muted hover:bg-white/5 text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-line/60 last:border-b-0 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}

/**
 * Browse all messages the user has starred in this conversation. Tap
 * to jump to the original location in the thread.
 */
function StarredMessagesDialog({
  peerId,
  onClose,
  onJump,
}: {
  peerId: string;
  onClose: () => void;
  onJump: (serverId: string) => void;
}) {
  const starred = useLiveQuery(
    () =>
      db.chatMessages
        .where("peerId")
        .equals(peerId)
        .reverse()
        .sortBy("createdAt")
        .then((rows) =>
          rows.filter((r) => r.starred && !r.deleted),
        ),
    [peerId],
    [] as ChatMessageRecord[],
  );
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      role="dialog"
      aria-label="Starred messages"
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-line shadow-sheet max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line text-base font-semibold text-text flex items-center gap-2">
          <StarIcon className="w-4 h-4 text-yellow-400" filled />
          Starred messages
        </div>
        {!starred || starred.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            No starred messages yet. Tap the star on any message to save it here.
          </div>
        ) : (
          starred.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => m.serverId && onJump(m.serverId)}
              disabled={!m.serverId}
              className="w-full px-4 py-3 text-left border-b border-line/60 last:border-b-0 hover:bg-white/5 disabled:opacity-50"
            >
              <div className="text-[11px] text-text-muted">
                {m.direction === "out" ? "You" : "Them"} ·{" "}
                {new Date(m.createdAt).toLocaleString()}
              </div>
              <div className="text-sm text-text truncate">
                {m.attachment?.kind === "image"
                  ? "📷 Photo"
                  : m.attachment?.kind === "voice"
                    ? "🎙 Voice message"
                    : m.plaintext || "—"}
              </div>
            </button>
          ))
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-3 text-text-muted text-sm border-t border-line"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────── Schedule picker ────────────────────────── */

/**
 * A modal sheet where the user picks a future date+time for a scheduled
 * message. Uses a native datetime-local input for simplicity.
 */
export function SchedulePickerSheet({
  onClose,
  onSchedule,
}: {
  onClose: () => void;
  onSchedule: (iso: string) => Promise<void>;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalInput = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;

  // Default to 1 hour from now, rounded to the nearest minute.
  const defaultDate = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return toLocalInput(d);
  }, []);

  const [value, setValue] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Minimum allowed datetime = 1 minute from now.
  const minDate = useMemo(
    () => toLocalInput(new Date(Date.now() + 60 * 1000)),
    [],
  );

  // Quick-pick chips: human-friendly common targets.
  const quickPicks = useMemo(() => {
    const now = new Date();
    function at(date: Date, hour: number, minute = 0) {
      const d = new Date(date);
      d.setHours(hour, minute, 0, 0);
      return d;
    }
    function plus(ms: number) {
      const d = new Date(now.getTime() + ms);
      d.setSeconds(0, 0);
      return d;
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const nextMonday = new Date(now);
    const daysUntilMon = (8 - now.getDay()) % 7 || 7;
    nextMonday.setDate(now.getDate() + daysUntilMon);
    return [
      { label: "In 1 hour", date: plus(60 * 60 * 1000) },
      { label: "In 3 hours", date: plus(3 * 60 * 60 * 1000) },
      { label: "Tomorrow 9 AM", date: at(tomorrow, 9) },
      { label: "Tomorrow 8 PM", date: at(tomorrow, 20) },
      { label: "Next Mon 9 AM", date: at(nextMonday, 9) },
    ];
  }, []);

  const previewIso = useMemo(() => {
    const ts = new Date(value).getTime();
    if (isNaN(ts)) return null;
    return new Date(ts);
  }, [value]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl border border-line p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold text-text flex items-center gap-2">
            <span>🕐</span> Schedule message
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text px-1"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1.5 block">
            Quick pick
          </label>
          <div className="flex flex-wrap gap-1.5">
            {quickPicks.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setValue(toLocalInput(q.date))}
                className="text-xs px-2.5 py-1 rounded-full border border-line text-text hover:bg-white/5"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-text-muted mb-1.5 block">
            Send at (your local time)
          </label>
          <input
            type="datetime-local"
            value={value}
            min={minDate}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-bg text-text rounded-lg px-3 py-2 border border-line outline-none text-sm"
          />
          {previewIso && (
            <div className="text-[11px] text-text-muted mt-1.5">
              Sends{" "}
              {previewIso.toLocaleString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        {err && <div className="text-xs text-red-400">{err}</div>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-text text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !value}
            onClick={async () => {
              const ts = new Date(value).getTime();
              if (isNaN(ts) || ts < Date.now() + 30_000) {
                setErr("Please pick a time at least 1 minute in the future.");
                return;
              }
              setBusy(true);
              setErr(null);
              try {
                await onSchedule(new Date(value).toISOString());
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Failed to schedule.");
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-wa-green text-text-oncolor text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddContactBanner({
  peerId,
  peerLabel: peerLabelText,
  onSaved,
}: {
  peerId: string;
  peerLabel: string;
  onSaved: () => void | Promise<void>;
}) {
  const dismissKey = `veil:add-contact-dismissed:${peerId}`;
  const [dismissed, setDismissed] = useState<boolean>(
    () =>
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem(dismissKey),
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setContactName = trpc.contacts.set.useMutation({
    onSuccess: async () => {
      setEditing(false);
      setError(null);
      await onSaved();
    },
    onError: (e) => setError(e.message),
  });

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(dismissKey, String(Date.now()));
    } catch {
      // ignore — banner will reappear next mount, no harm.
    }
    setDismissed(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError("Contact name can't be empty.");
      return;
    }
    if (trimmed.length > 60) {
      setError("Contact name must be 60 characters or fewer.");
      return;
    }
    setError(null);
    setContactName.mutate({ peerId, customName: trimmed });
  }

  return (
    <div className="px-3 py-2 bg-wa-green/10 border-b border-line text-sm">
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-text-muted">
            Save a private name for {peerLabelText}. Only you can see it.
          </div>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={60}
              placeholder="e.g. Mom, Alex from work…"
              className="flex-1 bg-surface border border-line rounded-full px-3 py-1.5 text-sm outline-none focus:border-wa-green text-text"
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button
              onClick={save}
              disabled={setContactName.isPending}
              className="px-3 py-1.5 rounded-full text-xs bg-wa-green text-text-oncolor disabled:opacity-50"
            >
              {setContactName.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1.5 rounded-full text-xs text-text-muted"
              disabled={setContactName.isPending}
            >
              Cancel
            </button>
          </div>
          {error && <div className="text-xs text-red-500">{error}</div>}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-text font-medium truncate">
              Save {peerLabelText} to your contacts?
            </div>
            <div className="text-xs text-text-muted">
              Pick a private nickname for your chat list.
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-full text-xs bg-wa-green text-text-oncolor shrink-0"
          >
            Add name
          </button>
          <button
            onClick={dismiss}
            className="px-2 py-1.5 rounded-full text-xs text-text-muted shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
