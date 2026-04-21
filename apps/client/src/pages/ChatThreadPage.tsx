import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { db } from "../lib/db";
import { pollAndDecrypt, sendChatMessage } from "../lib/messageSync";
import {
  ScreenShell,
  ErrorMessage,
  PrimaryButton,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";

const POLL_MS = 3000;

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
      <ScreenShell back="/chats" phase="Chat">
        <ErrorMessage>Missing peer id.</ErrorMessage>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell back="/chats" phase="Phase 3 · Chat">
      {!identity ? (
        <UnlockGate />
      ) : (
        <ChatThreadInner peerId={peerId} />
      )}
    </ScreenShell>
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
        // Network blips are expected — don't show errors for polling.
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

  async function onSend() {
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

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-white/50">
          Chatting with
        </div>
        <div className="font-mono text-sm text-white/90 mt-0.5">
          {peerId.slice(0, 8)}…
        </div>
        <div className="text-xs text-white/50 mt-1">
          Fingerprint:{" "}
          <span className="font-mono text-accent/90">{fingerprint || "…"}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-[40vh] max-h-[55vh] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-2"
      >
        {!messages || messages.length === 0 ? (
          <div className="text-center text-white/40 text-sm py-12">
            No messages yet. Say hi.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                m.direction === "out"
                  ? "self-end bg-accent/20 border border-accent/30"
                  : "self-start bg-white/[0.06] border border-white/10"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">
                {m.plaintext}
              </div>
              <div
                className={`text-[10px] mt-1 ${
                  m.direction === "out" ? "text-accent/60" : "text-white/40"
                }`}
              >
                {new Date(m.createdAt).toLocaleTimeString()}
                {m.direction === "out" && m.status !== "sent" && (
                  <span className="ml-2 italic">{m.status}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition"
        />
        <PrimaryButton
          onClick={onSend}
          loading={sending}
          disabled={!draft.trim()}
        >
          Send
        </PrimaryButton>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}
