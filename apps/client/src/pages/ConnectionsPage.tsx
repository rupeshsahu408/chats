import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  ErrorMessage,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "../components/Layout";
import type { Peer } from "@veil/shared";

type Tab = "people" | "incoming" | "outgoing";

export function ConnectionsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("people");
  const [error, setError] = useState<string | null>(null);

  const list = trpc.connections.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const incoming = trpc.connections.listIncoming.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const outgoing = trpc.connections.listOutgoing.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });

  const accept = trpc.connections.accept.useMutation();
  const reject = trpc.connections.reject.useMutation();
  const cancel = trpc.connections.cancel.useMutation();
  const remove = trpc.connections.remove.useMutation();

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  function refresh() {
    utils.connections.list.invalidate();
    utils.connections.listIncoming.invalidate();
    utils.connections.listOutgoing.invalidate();
  }

  async function onAccept(id: string) {
    setError(null);
    try {
      await accept.mutateAsync({ requestId: id });
      refresh();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }
  async function onReject(id: string) {
    setError(null);
    try {
      await reject.mutateAsync({ requestId: id });
      refresh();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }
  async function onCancel(id: string) {
    setError(null);
    try {
      await cancel.mutateAsync({ requestId: id });
      refresh();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }
  async function onRemove(peerId: string) {
    setError(null);
    if (!confirm("Disconnect from this person? This can't be undone.")) return;
    try {
      await remove.mutateAsync({ peerId });
      refresh();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  const incomingCount = incoming.data?.length ?? 0;
  const outgoingPendingCount =
    outgoing.data?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <ScreenShell back="/chats" phase="Phase 2 · People">
      <div className="flex flex-col items-center gap-2">
        <Logo />
        <h2 className="text-2xl font-semibold">Your people</h2>
        <p className="text-xs text-white/50 text-center">
          Connections require mutual consent. You can disconnect anytime.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-white/10 bg-white/5 text-sm">
        <TabButton
          active={tab === "people"}
          onClick={() => setTab("people")}
          label="People"
          count={list.data?.length ?? 0}
        />
        <TabButton
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label="Pending"
          count={incomingCount}
          highlight={incomingCount > 0}
        />
        <TabButton
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label="Sent"
          count={outgoingPendingCount}
        />
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      {tab === "people" && (
        <div className="flex flex-col gap-2">
          {list.isLoading && (
            <div className="text-sm text-white/40 text-center">Loading…</div>
          )}
          {list.data && list.data.length === 0 && (
            <div className="text-sm text-white/40 text-center py-4">
              No connections yet. Invite someone to start.
              <div className="mt-3">
                <PrimaryButton onClick={() => navigate("/invite")}>
                  Create an invite
                </PrimaryButton>
              </div>
            </div>
          )}
          {list.data?.map((c) => (
            <PersonRow
              key={c.id}
              peer={c.peer}
              right={
                <button
                  onClick={() => onRemove(c.peer.id)}
                  className="text-xs text-red-300 hover:text-red-200 underline"
                >
                  Disconnect
                </button>
              }
              sub={`Connected ${new Date(c.createdAt).toLocaleDateString()}`}
            />
          ))}
        </div>
      )}

      {tab === "incoming" && (
        <div className="flex flex-col gap-2">
          {incoming.isLoading && (
            <div className="text-sm text-white/40 text-center">Loading…</div>
          )}
          {incoming.data && incoming.data.length === 0 && (
            <div className="text-sm text-white/40 text-center py-4">
              No pending requests.
            </div>
          )}
          {incoming.data?.map((r) => (
            <PersonRow
              key={r.id}
              peer={r.from}
              sub={
                r.note
                  ? `“${r.note}”`
                  : `Sent ${new Date(r.createdAt).toLocaleString()}`
              }
              right={
                <div className="flex gap-2">
                  <button
                    onClick={() => onReject(r.id)}
                    className="text-xs px-2 py-1 rounded-lg border border-white/15 text-white/70 hover:bg-white/10"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => onAccept(r.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-accent text-white hover:bg-accent-soft"
                  >
                    Accept
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {tab === "outgoing" && (
        <div className="flex flex-col gap-2">
          {outgoing.isLoading && (
            <div className="text-sm text-white/40 text-center">Loading…</div>
          )}
          {outgoing.data && outgoing.data.length === 0 && (
            <div className="text-sm text-white/40 text-center py-4">
              You haven't sent any requests.
            </div>
          )}
          {outgoing.data?.map((r) => (
            <PersonRow
              key={r.id}
              peer={r.to}
              sub={
                r.status === "pending"
                  ? `Sent ${new Date(r.createdAt).toLocaleString()}`
                  : `${capitalize(r.status)} ${
                      r.decidedAt
                        ? new Date(r.decidedAt).toLocaleDateString()
                        : ""
                    }`
              }
              right={
                <div className="flex items-center gap-2">
                  <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                  {r.status === "pending" && (
                    <button
                      onClick={() => onCancel(r.id)}
                      className="text-xs text-white/50 hover:text-white underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      <SecondaryButton onClick={() => navigate("/invite")}>
        Invite someone
      </SecondaryButton>
    </ScreenShell>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-lg px-2 py-2 text-center transition " +
        (active
          ? "bg-accent/30 text-white"
          : "text-white/60 hover:text-white hover:bg-white/5")
      }
    >
      {label}
      <span
        className={
          "ml-1.5 text-[10px] " +
          (highlight && !active ? "text-accent-soft font-semibold" : "")
        }
      >
        {count}
      </span>
    </button>
  );
}

function PersonRow({
  peer,
  sub,
  right,
}: {
  peer: Peer;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
      <div className="size-10 rounded-full bg-gradient-to-br from-accent/60 to-midnight flex items-center justify-center font-mono text-xs text-white">
        {peer.fingerprint.split("-")[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm flex items-center gap-2">
          <span className="font-mono text-white/90">{peer.fingerprint}</span>
          <Pill tone="neutral">{peer.accountType}</Pill>
        </div>
        <div className="text-xs text-white/50 truncate">{sub}</div>
      </div>
      {right}
    </div>
  );
}

function statusTone(s: string): "accent" | "ok" | "danger" | "warn" | "neutral" {
  if (s === "pending") return "accent";
  if (s === "accepted") return "ok";
  if (s === "rejected") return "danger";
  if (s === "canceled") return "warn";
  return "neutral";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String(
      (e as { message?: unknown }).message ?? "Something went wrong.",
    );
  }
  return "Something went wrong.";
}
