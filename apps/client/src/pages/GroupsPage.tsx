import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import {
  ChatListRow,
  EmptyState,
  Spinner,
  FAB,
  PlusIcon,
  ChatIcon,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
  TextInput,
  FieldLabel,
  Avatar,
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { UnlockGate } from "../components/UnlockGate";
import { db } from "../lib/db";

export function GroupsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);
  const [creating, setCreating] = useState(false);

  const groups = trpc.groups.list.useQuery(undefined, {
    enabled: !!accessToken && !!identity,
    retry: false,
  });

  const allGroupMessages = useLiveQuery(
    () => db.groupMessages.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  const lastByGroup = new Map<
    string,
    { preview: string; createdAt: string; direction: "in" | "out" }
  >();
  for (const m of allGroupMessages ?? []) {
    if (!lastByGroup.has(m.groupId)) {
      let preview = m.plaintext;
      if (m.attachment?.kind === "image")
        preview = m.plaintext ? `📷 ${m.plaintext}` : "📷 Photo";
      else if (m.attachment?.kind === "voice") preview = "🎤 Voice message";
      lastByGroup.set(m.groupId, {
        preview,
        createdAt: m.createdAt,
        direction: m.direction,
      });
    }
  }

  const rows = (groups.data ?? [])
    .map((g) => ({ g, last: lastByGroup.get(g.id) }))
    .sort((a, b) => {
      const at = a.last?.createdAt ?? a.g.createdAt;
      const bt = b.last?.createdAt ?? b.g.createdAt;
      return bt.localeCompare(at);
    });

  return (
    <MainShell active="chats">
      {!identity ? (
        <div className="p-4">
          <UnlockGate />
        </div>
      ) : (
        <div className="bg-panel flex-1">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <button
              className="px-3 py-1 rounded-full text-sm bg-surface border border-line text-text"
              onClick={() => navigate("/chats")}
            >
              Direct
            </button>
            <button
              className="px-3 py-1 rounded-full text-sm bg-wa-green text-text-oncolor"
              disabled
            >
              Groups
            </button>
          </div>
          {groups.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ChatIcon className="w-12 h-12" />}
              title="No groups yet"
              message="Create a group to chat with multiple people end-to-end encrypted."
              action={
                <PrimaryButton onClick={() => setCreating(true)}>
                  New group
                </PrimaryButton>
              }
            />
          ) : (
            rows.map(({ g, last }) => (
              <ChatListRow
                key={g.id}
                to={`/groups/${g.id}`}
                seed={g.id}
                title={<span className="text-sm font-medium">{g.name}</span>}
                subtitle={
                  last ? (
                    <span className="truncate">{last.preview}</span>
                  ) : (
                    <span className="text-text-muted">
                      {g.memberCount} members
                    </span>
                  )
                }
                meta={
                  last
                    ? formatTime(last.createdAt)
                    : formatTime(g.createdAt)
                }
              />
            ))
          )}
        </div>
      )}

      {identity && (
        <FAB onClick={() => setCreating(true)} label="New group">
          <PlusIcon />
        </FAB>
      )}

      {creating && (
        <CreateGroupDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            void groups.refetch();
            navigate(`/groups/${id}`);
          }}
        />
      )}
    </MainShell>
  );
}

function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const connections = trpc.connections.list.useQuery();
  const create = trpc.groups.create.useMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const peers = useMemo(() => connections.data ?? [], [connections.data]);

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter a group name.");
      return;
    }
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        memberPeerIds: Array.from(picked),
      });
      onCreated(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-panel rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h2 className="text-lg font-medium text-text">New group</h2>
          <button onClick={onClose} className="text-text-muted px-2">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <FieldLabel>Group name</FieldLabel>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend hikes"
              maxLength={120}
            />
          </div>
          <div>
            <FieldLabel>Description (optional)</FieldLabel>
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              maxLength={500}
            />
          </div>
          <div>
            <FieldLabel>Add members</FieldLabel>
            {connections.isLoading ? (
              <Spinner />
            ) : peers.length === 0 ? (
              <p className="text-sm text-text-muted">
                You have no connections yet. Send invites first, then create a
                group.
              </p>
            ) : (
              <ul className="divide-y divide-line border border-line rounded-lg overflow-hidden">
                {peers.map((c) => {
                  const checked = picked.has(c.peer.id);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface"
                      onClick={() => toggle(c.peer.id)}
                    >
                      <Avatar seed={c.peer.id} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono truncate">
                          {c.peer.fingerprint || c.peer.id.slice(0, 8) + "…"}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        readOnly
                        checked={checked}
                        className="w-5 h-5 accent-wa-green"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
        <div className="p-4 border-t border-line flex gap-2">
          <SecondaryButton onClick={onClose} className="flex-1">
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onClick={submit}
            disabled={create.isPending}
            className="flex-1"
          >
            {create.isPending ? "Creating…" : "Create"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((+now - +d) / 86_400_000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
