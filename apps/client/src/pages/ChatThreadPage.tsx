import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { db, type ChatMessageRecord } from "../lib/db";
import { pollAndDecrypt, sendChatEnvelope, sendChatMessage } from "../lib/messageSync";
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

const POLL_MS = 3000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB upload ceiling
const MAX_VOICE_MS = 2 * 60 * 1000; // 2-minute voice notes

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
  const connections = trpc.connections.list.useQuery(undefined, {
    retry: false,
  });
  const peer = useMemo(
    () => connections.data?.find((c) => c.peer.id === peerId) ?? null,
    [connections.data, peerId],
  );
  const fingerprint = peer?.peer.fingerprint ?? "";
  const displayName = fingerprint || `${peerId.slice(0, 8)}…`;

  const messages = useLiveQuery(
    () => db.chatMessages.where("peerId").equals(peerId).sortBy("createdAt"),
    [peerId],
    [],
  );

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function onSendText() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await sendChatMessage(identity, peerId, text);
      setDraft("");
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
        v: 1,
        t: "image",
        ...(caption ? { body: caption } : {}),
        media,
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
      await sendChatEnvelope(identity, peerId, { v: 1, t: "voice", media });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send voice note.");
    } finally {
      setSending(false);
    }
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
                <LockIcon className="w-3 h-3" /> end-to-end encrypted
              </div>
            </div>
          </div>
        }
        back="/chats"
        right={
          <IconButton label="More" className="text-text-oncolor">
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
      </div>

      {error && (
        <div className="px-3 pb-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      <Composer
        draft={draft}
        setDraft={setDraft}
        sending={sending}
        onSendText={onSendText}
        onPickImage={onPickImage}
        onSendVoice={onSendVoice}
      />
    </div>
  );
}

/* ────────────────────────── Bubble row ────────────────────────── */

function MessageRow({ m }: { m: ChatMessageRecord }) {
  const time = new Date(m.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (m.attachment?.kind === "image") {
    return (
      <MessageBubble direction={m.direction} status={m.status} time={time}>
        <ImageAttachment att={m.attachment} />
        {m.plaintext && <div className="mt-1">{m.plaintext}</div>}
      </MessageBubble>
    );
  }
  if (m.attachment?.kind === "voice") {
    return (
      <MessageBubble direction={m.direction} status={m.status} time={time}>
        <VoiceAttachment att={m.attachment} />
      </MessageBubble>
    );
  }
  return (
    <MessageBubble direction={m.direction} status={m.status} time={time}>
      {m.plaintext}
    </MessageBubble>
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

  // Auto-load if no thumb is available; otherwise wait for tap.
  useEffect(() => {
    if (!att.thumbB64) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aspect =
    att.width && att.height ? att.width / att.height : 1;
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

/* ────────────────────────── Composer ────────────────────────── */

function Composer({
  draft,
  setDraft,
  sending,
  onSendText,
  onPickImage,
  onSendVoice,
}: {
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  onSendText: () => void;
  onPickImage: (f: File) => void;
  onSendVoice: (bytes: Uint8Array, mime: string, durationMs: number) => void;
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
          aria-label="Attach image"
        >
          <PaperclipIcon className="w-5 h-5" />
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
