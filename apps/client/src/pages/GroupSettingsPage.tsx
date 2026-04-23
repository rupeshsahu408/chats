import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { usePresenceStore } from "../lib/presenceStore";
import { formatLastSeen } from "../lib/lastSeen";
import {
  AppBar,
  Avatar,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
  Spinner,
  TextInput,
  FieldLabel,
  SettingsRow,
  ChevronRightIcon,
  ChatIcon,
} from "../components/Layout";
import { UnlockGate } from "../components/UnlockGate";
import { resetLocalGroup } from "../lib/groupSync";

export function GroupSettingsPage() {
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
        <AppBar title="Group info" back="/groups" />
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
          <AppBar title="Group info" back={`/groups/${groupId}`} />
          <div className="p-4">
            <UnlockGate />
          </div>
        </>
      ) : (
        <Inner groupId={groupId} />
      )}
    </main>
  );
}

function Inner({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const utils = trpc.useUtils();
  const groupQuery = trpc.groups.get.useQuery({ groupId }, { retry: false });
  const connections = trpc.connections.list.useQuery();

  const updateMeta = trpc.groups.updateMeta.useMutation({
    onSuccess: () => utils.groups.get.invalidate({ groupId }),
  });
  const removeMember = trpc.groups.removeMember.useMutation({
    onSuccess: () => utils.groups.get.invalidate({ groupId }),
  });
  const setRole = trpc.groups.setRole.useMutation({
    onSuccess: () => utils.groups.get.invalidate({ groupId }),
  });
  const addMembers = trpc.groups.addMembers.useMutation({
    onSuccess: () => utils.groups.get.invalidate({ groupId }),
  });
  const leave = trpc.groups.leave.useMutation();
  const rotateKeys = trpc.groups.rotateKeys.useMutation({
    onSuccess: () => utils.groups.get.invalidate({ groupId }),
  });
  const [rotateNote, setRotateNote] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pickToAdd, setPickToAdd] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (groupQuery.data && !editing) {
      setName(groupQuery.data.name);
      setDescription(groupQuery.data.description ?? "");
    }
  }, [groupQuery.data, editing]);

  const memberIds = useMemo(
    () => new Set((groupQuery.data?.members ?? []).map((m) => m.userId)),
    [groupQuery.data],
  );

  // Other members' user IDs — used to look up live presence + last seen.
  const otherMemberIds = useMemo(
    () =>
      (groupQuery.data?.members ?? [])
        .map((m) => m.userId)
        .filter((id) => id !== userId),
    [groupQuery.data, userId],
  );

  const peersOnlineQuery = trpc.me.peersOnline.useQuery(
    { peerIds: otherMemberIds },
    { enabled: otherMemberIds.length > 0, refetchInterval: 30_000 },
  );
  const peersLastSeenQuery = trpc.me.peersLastSeen.useQuery(
    { peerIds: otherMemberIds },
    { enabled: otherMemberIds.length > 0, refetchInterval: 60_000 },
  );

  const setPresenceOnline = usePresenceStore((s) => s.setOnline);
  useEffect(() => {
    const list = peersOnlineQuery.data?.online;
    if (!list) return;
    const onlineSet = new Set(list);
    for (const id of otherMemberIds) {
      setPresenceOnline(id, onlineSet.has(id));
    }
  }, [peersOnlineQuery.data, otherMemberIds, setPresenceOnline]);

  const presenceMap = usePresenceStore((s) => s.online);

  const lastSeenMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const row of peersLastSeenQuery.data?.lastSeen ?? []) {
      m.set(row.userId, row.lastSeenAt);
    }
    return m;
  }, [peersLastSeenQuery.data]);

  // Set of peer IDs the current user is connected to — controls whether
  // the "Message" swipe action is available on a member row.
  const connectedPeerIds = useMemo(
    () => new Set((connections.data ?? []).map((c) => c.peer.id)),
    [connections.data],
  );

  if (groupQuery.isLoading) {
    return (
      <>
        <AppBar title="Group info" back={`/groups/${groupId}`} />
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </>
    );
  }
  if (groupQuery.error || !groupQuery.data) {
    return (
      <>
        <AppBar title="Group info" back="/groups" />
        <div className="p-4">
          <ErrorMessage>
            {groupQuery.error?.message ?? "Couldn't load this group."}
          </ErrorMessage>
        </div>
      </>
    );
  }

  const group = groupQuery.data;
  const isAdmin = group.myRole === "admin";

  async function saveMeta() {
    setError(null);
    try {
      await updateMeta.mutateAsync({
        groupId,
        name: name.trim() || undefined,
        description: description.trim(),
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function addNow() {
    setError(null);
    try {
      await addMembers.mutateAsync({
        groupId,
        peerIds: Array.from(pickToAdd),
      });
      setPickToAdd(new Set());
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add members");
    }
  }

  async function reshareKeys() {
    if (
      !confirm(
        "Re-share encryption keys with everyone in this group? Use this if some members can't read recent messages.",
      )
    )
      return;
    setError(null);
    setRotateNote(null);
    try {
      const r = await rotateKeys.mutateAsync({ groupId });
      setRotateNote(`Keys re-shared. New epoch: ${r.epoch}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to re-share keys");
    }
  }

  async function leaveGroup() {
    if (!confirm("Leave this group? You'll lose access to new messages.")) return;
    setError(null);
    try {
      await leave.mutateAsync({ groupId });
      await resetLocalGroup(groupId);
      navigate("/groups");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave");
    }
  }

  return (
    <>
      <AppBar title="Group info" back={`/groups/${groupId}`} />
      <div className="flex-1 overflow-y-auto bg-bg">
        <div className="bg-panel border-b border-line p-5 flex flex-col items-center text-center gap-2">
          <Avatar seed={group.id} size={96} />
          {editing ? (
            <div className="w-full space-y-2 mt-2">
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
              <FieldLabel>Description</FieldLabel>
              <TextInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
              />
              <div className="flex gap-2 pt-1">
                <SecondaryButton
                  onClick={() => setEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={saveMeta}
                  disabled={updateMeta.isPending}
                  className="flex-1"
                >
                  {updateMeta.isPending ? "Saving…" : "Save"}
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-medium text-text">{group.name}</h2>
              {group.description && (
                <p className="text-sm text-text-muted">{group.description}</p>
              )}
              <p className="text-xs text-text-muted">
                {group.memberCount} members · epoch {group.epoch}
              </p>
              {isAdmin && (
                <SecondaryButton onClick={() => setEditing(true)}>
                  Edit info
                </SecondaryButton>
              )}
            </>
          )}
        </div>

        <div className="bg-panel mt-2 border-y border-line">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-medium text-text">
              Members ({group.members.length})
            </h3>
            {isAdmin && (
              <button
                onClick={() => setAdding(true)}
                className="text-sm text-wa-green font-medium"
              >
                + Add
              </button>
            )}
          </div>
          <ul className="divide-y divide-line">
            {group.members.map((m) => {
              const isMe = m.userId === userId;
              const isOnline = !isMe && presenceMap[m.userId] === true;
              const lastSeenAt = isMe ? null : lastSeenMap.get(m.userId) ?? null;
              const presenceLabel = isMe
                ? null
                : isOnline
                  ? "Online"
                  : lastSeenAt
                    ? `Last seen ${formatLastSeen(lastSeenAt)}`
                    : null;
              const canDM = !isMe && connectedPeerIds.has(m.userId);
              const memberLabel = m.fingerprint || m.userId.slice(0, 8) + "…";

              return (
                <MemberRow
                  key={m.userId}
                  canDM={canDM}
                  onDM={() => navigate(`/chats/${m.userId}`)}
                >
                  <div className="relative shrink-0">
                    <Avatar seed={m.userId} size={40} />
                    {isOnline && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-panel"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate text-text">
                      {isMe ? "You" : memberLabel}
                    </div>
                    <div className="text-xs text-text-muted capitalize truncate">
                      {presenceLabel ? (
                        <span
                          className={
                            "normal-case " +
                            (isOnline ? "text-green-400" : "text-text-muted")
                          }
                        >
                          {presenceLabel}
                          <span className="text-text-muted"> · {m.role}</span>
                        </span>
                      ) : (
                        m.role
                      )}
                    </div>
                  </div>
                  {canDM && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/chats/${m.userId}`);
                      }}
                      aria-label={`Message ${memberLabel}`}
                      className="shrink-0 w-9 h-9 rounded-full text-wa-green hover:bg-wa-green/10 flex items-center justify-center"
                    >
                      <ChatIcon className="w-5 h-5" />
                    </button>
                  )}
                  {isAdmin && !isMe && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        className="text-xs text-text-muted underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRole.mutate({
                            groupId,
                            userId: m.userId,
                            role: m.role === "admin" ? "member" : "admin",
                          });
                        }}
                      >
                        {m.role === "admin" ? "Demote" : "Make admin"}
                      </button>
                      <button
                        className="text-xs text-red-500 underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(`Remove ${memberLabel} from the group?`)
                          ) {
                            removeMember.mutate({
                              groupId,
                              userId: m.userId,
                            });
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </MemberRow>
              );
            })}
          </ul>
        </div>

        {isAdmin && (
          <div className="bg-panel mt-2 border-y border-line">
            <SettingsRow
              label={
                rotateKeys.isPending
                  ? "Re-sharing encryption keys…"
                  : "Re-share encryption keys"
              }
              onClick={rotateKeys.isPending ? undefined : reshareKeys}
              right={<ChevronRightIcon />}
            />
            {rotateNote && (
              <p className="px-4 pb-3 text-xs text-text-muted">{rotateNote}</p>
            )}
          </div>
        )}

        <div className="bg-panel mt-2 border-y border-line">
          <SettingsRow
            label="Leave group"
            danger
            onClick={leaveGroup}
            right={<ChevronRightIcon />}
          />
        </div>

        {error && (
          <div className="p-4">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-panel rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <h2 className="text-lg font-medium text-text">Add members</h2>
              <button
                onClick={() => {
                  setAdding(false);
                  setPickToAdd(new Set());
                }}
                className="text-text-muted px-2"
              >
                ✕
              </button>
            </div>
            <ul className="divide-y divide-line">
              {(connections.data ?? [])
                .filter((c) => !memberIds.has(c.peer.id))
                .map((c) => {
                  const checked = pickToAdd.has(c.peer.id);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface"
                      onClick={() => {
                        const next = new Set(pickToAdd);
                        if (next.has(c.peer.id)) next.delete(c.peer.id);
                        else next.add(c.peer.id);
                        setPickToAdd(next);
                      }}
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
              {(connections.data ?? []).filter(
                (c) => !memberIds.has(c.peer.id),
              ).length === 0 && (
                <li className="p-4 text-sm text-text-muted text-center">
                  All your connections are already in this group.
                </li>
              )}
            </ul>
            <div className="p-4 border-t border-line flex gap-2">
              <SecondaryButton
                onClick={() => {
                  setAdding(false);
                  setPickToAdd(new Set());
                }}
                className="flex-1"
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onClick={addNow}
                disabled={addMembers.isPending || pickToAdd.size === 0}
                className="flex-1"
              >
                {addMembers.isPending ? "Adding…" : "Add"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────── Swipe-to-DM member row ─────────── */

const SWIPE_REVEAL = 88; // px revealed when fully swiped
const SWIPE_TRIGGER = 56; // px needed to trigger DM on release

function MemberRow({
  canDM,
  onDM,
  children,
}: {
  canDM: boolean;
  onDM: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockedRef = useRef<"x" | "y" | null>(null);

  const reset = () => {
    setDx(0);
    startXRef.current = null;
    startYRef.current = null;
    lockedRef.current = null;
    setDragging(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!canDM) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    lockedRef.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!canDM || startXRef.current == null || startYRef.current == null) return;
    const t = e.touches[0];
    if (!t) return;
    const dxRaw = t.clientX - startXRef.current;
    const dyRaw = t.clientY - startYRef.current;

    // Decide axis on first significant movement so vertical scrolling keeps
    // working while only horizontal drags engage the swipe.
    if (lockedRef.current == null) {
      if (Math.abs(dxRaw) < 6 && Math.abs(dyRaw) < 6) return;
      lockedRef.current = Math.abs(dxRaw) > Math.abs(dyRaw) ? "x" : "y";
    }
    if (lockedRef.current !== "x") return;

    // Only allow leftward swipes; clamp to the reveal width.
    const next = Math.max(-SWIPE_REVEAL, Math.min(0, dxRaw));
    setDx(next);
  };

  const onTouchEnd = () => {
    if (!canDM) return reset();
    if (-dx >= SWIPE_TRIGGER) {
      // Snap fully open then fire — feels more responsive than waiting.
      setDx(-SWIPE_REVEAL);
      window.setTimeout(() => {
        reset();
        onDM();
      }, 80);
      return;
    }
    reset();
  };

  const revealOpacity = Math.min(1, -dx / SWIPE_TRIGGER);

  return (
    <li className="relative overflow-hidden">
      {/* Reveal action behind the row */}
      {canDM && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-wa-green text-text-oncolor"
          style={{
            width: SWIPE_REVEAL,
            opacity: revealOpacity,
          }}
        >
          <ChatIcon className="w-5 h-5" />
          <span className="ml-2 text-xs font-medium">Message</span>
        </div>
      )}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-panel"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 160ms ease",
          touchAction: "pan-y",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={reset}
      >
        {children}
      </div>
    </li>
  );
}
