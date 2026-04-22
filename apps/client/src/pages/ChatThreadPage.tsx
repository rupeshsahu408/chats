import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { db } from "../lib/db";
import { pollAndDecrypt, sendChatMessage } from "../lib/messageSync";
import {
  AppBar,
  Avatar,
  IconButton,
  MoreVerticalIcon,
  MessageBubble,
  MessageInputBar,
  ErrorMessage,
  EmptyState,
  LockIcon,
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
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              direction={m.direction}
              status={m.status}
              time={new Date(m.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            >
              {m.plaintext}
            </MessageBubble>
          ))
        )}
      </div>

      {error && (
        <div className="px-3 pb-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      <MessageInputBar
        value={draft}
        onChange={setDraft}
        onSend={onSend}
        sending={sending}
      />
    </div>
  );
}
