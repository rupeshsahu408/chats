import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { AppBar, Avatar, Spinner } from "../components/Layout";
import { peerLabel } from "../lib/peerLabel";

export function ProfilePage() {
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
        <div className="flex-1 overflow-y-auto">
          {/* Hero: avatar + public name */}
          <div className="bg-panel py-8 flex flex-col items-center gap-3 border-b border-line">
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

          {/* Identity facts */}
          <Section title="Account">
            <Row label="User ID" value={<span className="font-mono">{peer.id}</span>} />
            <Row
              label="Account type"
              value={<span className="capitalize">{peer.accountType}</span>}
            />
            <Row
              label="Joined"
              value={new Date(peer.createdAt).toLocaleDateString()}
            />
            <Row
              label="Fingerprint"
              value={<span className="font-mono">{peer.fingerprint}</span>}
            />
          </Section>
        </div>
      )}
    </div>
  );
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
