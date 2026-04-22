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
} from "../lib/db";
import {
  consumeViewOnce,
  pollAndDecrypt,
  reportRead,
  sendChatEnvelope,
  sendChatMessage,
} from "../lib/messageSync";
import { wsClient, wsTyping } from "../lib/wsClient";
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
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import {
  downscaleImage,
  fetchAndDecryptMedia,
  makeThumbnail,
  uploadEncryptedMedia,
  type MediaAttachment,
} from "../lib/media";
import { firstUrl, type EnvelopeLinkPreview } from "../lib/messageEnvelope";
import { trpcClientProxy } from "../lib/trpcClientProxy";
import { useStealthPrefs } from "../lib/stealthPrefs";
import { safetyNumberFromB64 } from "../lib/safetyNumber";
import {
  biometricSupported,
  registerBiometricCredential,
  verifyBiometric,
} from "../lib/biometric";

const POLL_MS = 3000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VOICE_MS = 2 * 60 * 1000;
const TTL_OPTIONS: { label: string; seconds: number }[] = [
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
  const connections = trpc.connections.list.useQuery(undefined, {
    retry: false,
  });
  const peer = useMemo(
    () => connections.data?.find((c) => c.peer.id === peerId) ?? null,
    [connections.data, peerId],
  );
  const fingerprint = peer?.peer.fingerprint ?? "";
  const displayName = fingerprint || `${peerId.slice(0, 8)}…`;

  // Per-peer prefs (TTL, biometric, view-once default).
  const chatPref = useLiveQuery(
    () => db.chatPrefs.get(peerId),
    [peerId],
    undefined as ChatPrefRecord | undefined,
  );
  const ttlSeconds = chatPref?.ttlSeconds ?? 0;
  const viewOnceDefault = chatPref?.viewOnceDefault ?? false;
  const biometricCredentialId = chatPref?.biometricCredentialId;

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
  const [menuOpen, setMenuOpen] = useState<null | "main" | "ttl" | "safety">(null);
  const [pendingPreview, setPendingPreview] = useState<EnvelopeLinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Typing indicator (peer → us).
  const [peerTyping, setPeerTyping] = useState(false);
  useEffect(() => {
    let clear: ReturnType<typeof setTimeout> | null = null;
    const unsub = wsClient.subscribe((event) => {
      if (event.type === "typing" && event.from === peerId) {
        if (event.typing) {
          setPeerTyping(true);
          if (clear) clearTimeout(clear);
          clear = setTimeout(() => setPeerTyping(false), 5000);
        } else {
          setPeerTyping(false);
        }
      }
    });
    return () => {
      unsub();
      if (clear) clearTimeout(clear);
    };
  }, [peerId]);

  // Outgoing typing indicator (debounced).
  const typingPrefs = useStealthPrefs((s) => s.prefs?.typingIndicatorsEnabled);
  const lastTypingRef = useRef(0);
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!typingPrefs) return;
      wsTyping(peerId, typing);
    },
    [peerId, typingPrefs],
  );
  function onDraftChange(v: string) {
    setDraft(v);
    if (!typingPrefs) return;
    const now = Date.now();
    if (now - lastTypingRef.current > 2500) {
      lastTypingRef.current = now;
      sendTyping(true);
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      lastTypingRef.current = 0;
      sendTyping(false);
    }, 3500);
  }
  useEffect(() => {
    return () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
      sendTyping(false);
    };
  }, [sendTyping]);

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
    void db.chatMessages
      .where("peerId").equals(peerId)
      .modify((rec) => {
        if (rec.direction === "in" && rec.status !== "read" && !rec.viewOnce && rec.serverId && unread.includes(rec.serverId)) {
          rec.status = "read";
          rec.readAt = new Date().toISOString();
        }
      })
      .catch(() => undefined);
  }, [messages, peerId, unlocked]);

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

  // Detect URL in draft → fetch link preview lazily.
  useEffect(() => {
    const url = firstUrl(draft);
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
  }, [draft]);

  async function onSendText() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await sendChatMessage(identity, peerId, text, {
        ttlSeconds: ttlSeconds || undefined,
        linkPreview: pendingPreview ?? undefined,
      });
      setDraft("");
      setPendingPreview(null);
      sendTyping(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
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
        ...(viewOnceDefault ? { vo: true } : {}),
      });
      setDraft("");
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <AppBar
        title={
          <div className="flex items-center gap-2">
            <Avatar seed={peerId} label={displayName.slice(0, 2)} size={36} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base truncate">
                <span className="font-mono">{displayName}</span>
              </div>
              <div className="text-[11px] text-text-oncolor/80 truncate inline-flex items-center gap-1">
                {peerTyping ? (
                  <span>typing…</span>
                ) : (
                  <>
                    <LockIcon className="w-3 h-3" /> end-to-end encrypted
                    {ttlSeconds > 0 && <span>· ⏱ {ttlLabel}</span>}
                    {biometricCredentialId && <span>· 🔒</span>}
                  </>
                )}
              </div>
            </div>
          </div>
        }
        back="/chats"
        right={
          <IconButton
            label="More"
            className="text-text-oncolor"
            onClick={() => setMenuOpen("main")}
          >
            <MoreVerticalIcon />
          </IconButton>
        }
      />

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto bg-bg bg-chat-wallpaper bg-wallpaper px-3 py-4 flex flex-col gap-1"
      >
        {!messages || messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            message="Say hi to start the conversation."
          />
        ) : (
          messages.map((m) => <MessageRow key={m.id} m={m} />)
        )}
        {peerTyping && (
          <div className="self-start text-xs text-text-muted bg-wa-bubble-in px-3 py-2 rounded-2xl shadow-bubble">
            <span className="inline-flex gap-0.5 items-end">
              <Dot d={0} /><Dot d={150} /><Dot d={300} />
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 pb-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {pendingPreview && (
        <LinkPreviewCard
          preview={pendingPreview}
          loading={previewLoading}
          onDismiss={() => setPendingPreview(null)}
        />
      )}

      <Composer
        draft={draft}
        setDraft={onDraftChange}
        sending={sending}
        onSendText={onSendText}
        onPickImage={onPickImage}
        onSendVoice={onSendVoice}
        viewOnceDefault={viewOnceDefault}
      />

      {menuOpen === "main" && (
        <ChatMenu
          onClose={() => setMenuOpen(null)}
          ttlLabel={ttlLabel}
          onTTL={() => setMenuOpen("ttl")}
          onSafety={() => setMenuOpen("safety")}
          onToggleBiometric={onToggleBiometric}
          biometricEnabled={!!biometricCredentialId}
          viewOnceDefault={viewOnceDefault}
          onToggleViewOnce={() =>
            void setChatPref(peerId, { viewOnceDefault: !viewOnceDefault })
          }
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
      {menuOpen === "safety" && peer && (
        <SafetyNumberDialog
          myId={myId}
          peerId={peerId}
          peerLabel={displayName}
          onClose={() => setMenuOpen(null)}
        />
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

function ttlRemainingLabel(iso?: string): string | null {
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

/* ────────────────────────── Bubble row ────────────────────────── */

function MessageRow({ m }: { m: ChatMessageRecord }) {
  const time = new Date(m.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const ttlLabel = ttlRemainingLabel(m.expiresAt);
  const ttlBadge = ttlLabel ? (
    <span className="ml-1 text-[10px] text-text-muted">⏱ {ttlLabel}</span>
  ) : null;

  if (m.viewOnce) {
    return (
      <ViewOnceBubble m={m} time={time} />
    );
  }
  if (m.attachment?.kind === "image") {
    return (
      <MessageBubble direction={m.direction} status={m.status} time={time}>
        <ImageAttachment att={m.attachment} />
        {m.plaintext && <div className="mt-1">{m.plaintext}</div>}
        {ttlBadge}
      </MessageBubble>
    );
  }
  if (m.attachment?.kind === "voice") {
    return (
      <MessageBubble direction={m.direction} status={m.status} time={time}>
        <VoiceAttachment att={m.attachment} />
        {ttlBadge}
      </MessageBubble>
    );
  }
  return (
    <MessageBubble direction={m.direction} status={m.status} time={time}>
      {m.plaintext}
      {m.linkPreview && <LinkPreviewBlock preview={m.linkPreview} />}
      {ttlBadge}
    </MessageBubble>
  );
}

function ViewOnceBubble({ m, time }: { m: ChatMessageRecord; time: string }) {
  const [opened, setOpened] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isOut = m.direction === "out";

  async function open() {
    if (loading) return;
    setLoading(true);
    try {
      if (m.attachment) {
        const u = await fetchAndDecryptMedia({ ...m.attachment });
        setUrl(u);
      }
      setOpened(true);
      // Inbound: ack + delete locally after a brief view window.
      if (!isOut && m.serverId) {
        void reportRead([m.serverId]).catch(() => undefined);
      }
      if (!isOut && m.id !== undefined) {
        setTimeout(() => {
          void consumeViewOnce(m.id!).catch(() => undefined);
        }, 8000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <MessageBubble direction={m.direction} status={m.status} time={time}>
      {!opened ? (
        <button
          onClick={open}
          className="flex items-center gap-2 text-sm text-text-muted"
        >
          <span>👁</span>
          <span>{loading ? "Opening…" : isOut ? "View-once sent" : "Tap to open · disappears after viewing"}</span>
        </button>
      ) : url ? (
        <img
          src={url}
          alt=""
          className="rounded-md max-w-[240px] max-h-[320px] object-contain"
        />
      ) : (
        <div className="text-sm text-text-muted">View-once · {m.plaintext || "media"}</div>
      )}
    </MessageBubble>
  );
}

function LinkPreviewBlock({
  preview,
}: {
  preview: NonNullable<ChatMessageRecord["linkPreview"]>;
}) {
  return (
    <a
      href={preview.resolvedUrl ?? preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-2 -mx-1 block rounded-md overflow-hidden bg-black/20 border border-white/5"
    >
      {preview.imageUrl && (
        <img
          src={preview.imageUrl}
          alt=""
          className="w-full max-h-40 object-cover"
          loading="lazy"
        />
      )}
      <div className="p-2">
        {preview.siteName && (
          <div className="text-[10px] uppercase tracking-wide text-text-muted">
            {preview.siteName}
          </div>
        )}
        {preview.title && (
          <div className="text-sm text-text font-medium line-clamp-2">{preview.title}</div>
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

function ImageAttachment({ att }: { att: NonNullable<ChatMessageRecord["attachment"]> }) {
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

function VoiceAttachment({ att }: { att: NonNullable<ChatMessageRecord["attachment"]> }) {
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

function LinkPreviewCard({
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
  onSafety,
  onToggleBiometric,
  biometricEnabled,
  viewOnceDefault,
  onToggleViewOnce,
}: {
  onClose: () => void;
  ttlLabel: string;
  onTTL: () => void;
  onSafety: () => void;
  onToggleBiometric: () => void;
  biometricEnabled: boolean;
  viewOnceDefault: boolean;
  onToggleViewOnce: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <MenuItem label={`Disappearing messages · ${ttlLabel}`} onClick={onTTL} />
      <MenuItem
        label={`View-once images: ${viewOnceDefault ? "On" : "Off"}`}
        onClick={() => {
          onToggleViewOnce();
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

function Composer({
  draft,
  setDraft,
  sending,
  onSendText,
  onPickImage,
  onSendVoice,
  viewOnceDefault,
}: {
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  onSendText: () => void;
  onPickImage: (f: File) => void;
  onSendVoice: (bytes: Uint8Array, mime: string, durationMs: number) => void;
  viewOnceDefault: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState<RecordingState | null>(null);

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
    <div className="sticky bottom-0 bg-bg/95 backdrop-blur px-2 py-2 border-t border-line flex items-end gap-2">
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
          onClick={() => fileInput.current?.click()}
          disabled={sending}
          className="size-9 rounded-full text-text-muted hover:text-text hover:bg-white/10 flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label={viewOnceDefault ? "Attach view-once image" : "Attach image"}
          title={viewOnceDefault ? "View-once image" : "Image"}
        >
          {viewOnceDefault ? <span>👁</span> : <PaperclipIcon className="w-5 h-5" />}
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!sending && draft.trim()) onSendText();
            }
          }}
          rows={1}
          placeholder="Type a message"
          className="flex-1 bg-transparent text-text placeholder:text-text-muted resize-none outline-none max-h-32 py-1.5 px-1"
          style={{ minHeight: "24px" }}
        />
      </div>
      {draft.trim() ? (
        <button
          onClick={onSendText}
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
  );
}

function RecordingBar({
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

interface RecordingState {
  cancel: () => void;
  finish: () => Promise<{ bytes: Uint8Array; mime: string; durationMs: number } | null>;
}

async function startRecording(): Promise<
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
