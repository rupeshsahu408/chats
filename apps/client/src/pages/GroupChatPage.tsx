import { useEffect, useMemo, useRef, useState } from "react";
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
  MessageInputBar,
  ErrorMessage,
  EmptyState,
  ChatIcon,
  Spinner,
  LockIcon,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import { db } from "../lib/db";
import {
  ensureMySenderKey,
  ingestGroupInboxMessage,
  sendGroupText,
} from "../lib/groupSync";
import { pollAndDecrypt } from "../lib/messageSync";

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

function GroupChatInner({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const identity = useUnlockStore((s) => s.identity)!;
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const groupQuery = trpc.groups.get.useQuery(
    { groupId },
    { retry: false },
  );

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    [],
  );

  // Restore history (decrypts everything addressable to me) once.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        await pollAndDecrypt(identity);
        const { messages: rows } = await trpcClientProxy().messages.fetchGroupHistory.query({
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

  // Make sure my sender key exists & is distributed once we have group data.
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

  const memberMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of groupQuery.data?.members ?? []) {
      m.set(mem.userId, mem.fingerprint || mem.userId.slice(0, 8) + "…");
    }
    return m;
  }, [groupQuery.data]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendGroupText(identity, groupId, text.trim());
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
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
              <span className="text-sm font-medium leading-tight">
                {group.name}
              </span>
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
            message="Say hi to the group."
          />
        ) : (
          (messages ?? []).map((m) => {
            const mine = m.senderUserId === userId;
            return (
              <div key={m.id} className="flex flex-col">
                {!mine && (
                  <span className="text-[11px] text-text-muted ml-2 mb-0.5 font-mono">
                    {memberMap.get(m.senderUserId) ??
                      m.senderUserId.slice(0, 8) + "…"}
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
                  {m.plaintext || (
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
      <MessageInputBar
        value={text}
        onChange={setText}
        onSend={send}
        sending={sending}
        placeholder="Message the group"
      />
    </>
  );
}
