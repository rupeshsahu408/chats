import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { AppBar, Avatar, Spinner } from "../components/Layout";
import { peerLabel } from "../lib/peerLabel";
import { db } from "../lib/db";
import { ChatContactSettings } from "../components/ChatContactSettings";
import { useNoindex } from "../lib/useDocumentMeta";

export function ProfilePage() {
  useNoindex("Profile · VeilChat");
  const { peerId = "" } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });

  const peer = useMemo(
    () => connections.data?.find((c) => c.peer.id === peerId)?.peer ?? null,
    [connections.data, peerId],
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setContactName = trpc.contacts.set.useMutation({
    onSuccess: async () => {
      await utils.connections.list.invalidate();
      await utils.contacts.list.invalidate();
      setEditing(false);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  function startEdit() {
    setDraft(peer?.contactName ?? "");
    setError(null);
    setEditing(true);
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

  async function clearName() {
    if (!peer?.contactName) return;
    if (!confirm("Remove your saved name for this contact?")) return;
    setContactName.mutate({ peerId, customName: null });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-surface">
      <AppBar title="Contact info" back={`/chats/${peerId}`} />

      {connections.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      ) : !peer ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-text font-semibold">Profile unavailable</div>
          <div className="text-sm text-text-muted">
            You can only view profiles for people you're connected with.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:bg-panel lg:shadow-card">
          {/* Hero: avatar + public name */}
          <div className="bg-panel py-8 flex flex-col items-center gap-3 border-b border-line lg:rounded-t-2xl">
            <Avatar
              seed={peer.username || peer.id}
              src={peer.avatarDataUrl ?? null}
              label={(peer.username ?? peer.fingerprint).slice(0, 2)}
              size={144}
            />
            <div className="text-center">
              <div className="text-xl font-semibold text-text">
                {peer.username ? `@${peer.username}` : peer.fingerprint}
              </div>
              {peer.username && (
                <div className="text-xs text-text-muted mt-1 font-mono">
                  {peer.fingerprint}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          <Section title="About">
            {peer.bio?.trim() ? (
              <div className="px-4 py-3 text-sm text-text whitespace-pre-wrap break-words">
                {peer.bio}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-text-muted italic">
                No bio yet.
              </div>
            )}
          </Section>

          {/* Saved (private) contact name */}
          <Section title="Saved name (only you can see this)">
            {editing ? (
              <div className="px-4 py-3 flex flex-col gap-2">
                <input
                  autoFocus
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={60}
                  placeholder={`e.g. ${peerLabel(peer)}`}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-wa-green text-text"
                />
                {error && (
                  <div className="text-xs text-red-500">{error}</div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-full text-sm text-text-muted"
                    disabled={setContactName.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    disabled={setContactName.isPending}
                    className="px-4 py-1.5 rounded-full text-sm bg-wa-green text-text-oncolor disabled:opacity-50"
                  >
                    {setContactName.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {peer.contactName ? (
                    <div className="text-sm text-text truncate">
                      {peer.contactName}
                    </div>
                  ) : (
                    <div className="text-sm text-text-muted italic">
                      No saved name. The chat list will use{" "}
                      <span className="font-medium">
                        {peer.username ? `@${peer.username}` : peer.fingerprint}
                      </span>
                      .
                    </div>
                  )}
                  <div className="text-[11px] text-text-muted mt-1">
                    Like phone contacts — only visible to you.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {peer.contactName && (
                    <button
                      onClick={clearName}
                      className="px-3 py-1.5 rounded-full text-xs text-text-muted border border-line"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={startEdit}
                    className="px-3 py-1.5 rounded-full text-xs bg-wa-green text-text-oncolor"
                  >
                    {peer.contactName ? "Edit" : "Add name"}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Conversation memory — local-only stats, computed from Dexie */}
          <ConversationMemory peerId={peerId} displayName={peerLabel(peer)} />

          {/* Per-contact settings, promoted out of the chat header
              menu so it can stay slim on small screens. */}
          <ChatContactSettings peerId={peerId} peerLabel={peerLabel(peer)} />

          {/* Identity facts */}
          <Section title="Account">
            <Row
              label="Account type"
              value={<span className="capitalize">{peer.accountType}</span>}
            />
            <Row
              label="Joined"
              value={new Date(peer.createdAt).toLocaleDateString()}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

/**
 * "You and Sara · 3 months · 1,242 messages" — a quiet, local-only
 * memory of the relationship, drawn from the on-device message log.
 * Nothing leaves the device.
 */
function ConversationMemory({
  peerId,
  displayName,
}: {
  peerId: string;
  displayName: string;
}) {
  const stats = useLiveQuery(
    async () => {
      const rows = await db.chatMessages
        .where("peerId")
        .equals(peerId)
        .toArray();
      const visible = rows.filter((r) => !r.deleted);
      const total = visible.length;
      let firstAt: number | null = null;
      let lastAt: number | null = null;
      let outCount = 0;
      let inCount = 0;
      for (const r of visible) {
        const t = Date.parse(r.createdAt);
        if (!Number.isFinite(t)) continue;
        if (firstAt === null || t < firstAt) firstAt = t;
        if (lastAt === null || t > lastAt) lastAt = t;
        if (r.direction === "out") outCount++;
        else inCount++;
      }
      return { total, firstAt, lastAt, outCount, inCount };
    },
    [peerId],
    null,
  );

  const numberFmt = useMemo(() => new Intl.NumberFormat(), []);
  const subtitle = useMemo(() => {
    if (!stats) return null;
    if (stats.total === 0 || stats.firstAt === null) return null;
    const days = Math.max(
      1,
      Math.floor((Date.now() - stats.firstAt) / (24 * 60 * 60 * 1000)),
    );
    const durationLabel = formatDuration(days);
    const countLabel = `${numberFmt.format(stats.total)} ${
      stats.total === 1 ? "message" : "messages"
    }`;
    return `${durationLabel} · ${countLabel}`;
  }, [stats, numberFmt]);

  return (
    <Section title="Conversation">
      {!stats || stats.total === 0 ? (
        <div className="px-4 py-3 text-sm text-text-muted italic">
          No messages here yet — your shared timeline starts with the first one.
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="text-base text-text">
            <span className="font-semibold">You and {displayName}</span>
          </div>
          <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat
              label="From you"
              value={numberFmt.format(stats.outCount)}
            />
            <Stat
              label="From them"
              value={numberFmt.format(stats.inCount)}
            />
            <Stat
              label="Last message"
              value={
                stats.lastAt
                  ? formatRelativeShort(stats.lastAt)
                  : "—"
              }
            />
          </div>
          <div className="text-[11px] text-text-muted mt-3">
            Counts are kept on this device. Other devices have their own.
          </div>
        </div>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface/60 border border-line/60 px-3 py-2">
      <div className="text-base font-semibold text-text tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

function formatDuration(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days - years * 365) / 30);
  if (remMonths === 0) {
    return years === 1 ? "1 year" : `${years} years`;
  }
  return `${years}y ${remMonths}mo`;
}

function formatRelativeShort(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel border-b border-line mt-2">
      <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-t border-line/50 first:border-t-0">
      <div className="text-sm text-text-muted shrink-0">{label}</div>
      <div className="text-sm text-text text-right truncate min-w-0">
        {value}
      </div>
    </div>
  );
}
