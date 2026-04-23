import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ErrorMessage,
  InfoMessage,
  FieldLabel,
  Pill,
  PrimaryButton,
  Avatar,
  EmptyState,
  Spinner,
  FAB,
  PlusIcon,
  PeopleIcon,
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { bytesToBase64 } from "../lib/crypto";
import type { Peer } from "@veil/shared";
import { peerLabel, peerSubLabel } from "../lib/peerLabel";

type Tab = "people" | "incoming" | "outgoing" | "find";

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
    <MainShell active="people" title="People">
      <div className="bg-bar text-text-oncolor px-2 grid grid-cols-4 text-xs font-medium uppercase tracking-wide">
        <SubTab
          active={tab === "people"}
          onClick={() => setTab("people")}
          label="People"
          count={list.data?.length ?? 0}
        />
        <SubTab
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label="Pending"
          count={incomingCount}
          highlight={incomingCount > 0}
        />
        <SubTab
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label="Sent"
          count={outgoingPendingCount}
        />
        <SubTab
          active={tab === "find"}
          onClick={() => setTab("find")}
          label="Find"
        />
      </div>

      <div className="flex-1 bg-panel">
        {error && (
          <div className="px-4 pt-3">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}

        {tab === "people" && (
          <div>
            {list.isLoading && (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )}
            {list.data && list.data.length === 0 && (
              <EmptyState
                icon={<PeopleIcon className="w-12 h-12" />}
                title="No connections yet"
                message="Invite someone to start chatting privately."
                action={
                  <PrimaryButton onClick={() => navigate("/invite")}>
                    Create an invite
                  </PrimaryButton>
                }
              />
            )}
            {list.data?.map((c) => (
              <PersonRow
                key={c.id}
                peer={c.peer}
                sub={`Connected ${new Date(c.createdAt).toLocaleDateString()}`}
                right={
                  <div className="flex gap-2">
                    <RowButton onClick={() => navigate(`/chats/${c.peer.id}`)}>
                      Chat
                    </RowButton>
                    <RowButton onClick={() => onRemove(c.peer.id)} danger>
                      Remove
                    </RowButton>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {tab === "incoming" && (
          <div>
            {incoming.isLoading && (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )}
            {incoming.data && incoming.data.length === 0 && (
              <EmptyState title="No pending requests" />
            )}
            {incoming.data?.map((r) => (
              <PersonRow
                key={r.id}
                peer={r.from}
                sub={
                  r.note
                    ? `"${r.note}"`
                    : `Sent ${new Date(r.createdAt).toLocaleString()}`
                }
                right={
                  <div className="flex gap-2">
                    <RowButton onClick={() => onReject(r.id)}>Reject</RowButton>
                    <RowButton onClick={() => onAccept(r.id)} primary>
                      Accept
                    </RowButton>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {tab === "outgoing" && (
          <div>
            {outgoing.isLoading && (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )}
            {outgoing.data && outgoing.data.length === 0 && (
              <EmptyState title="No outgoing requests" />
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
                      <RowButton onClick={() => onCancel(r.id)}>
                        Cancel
                      </RowButton>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}

        {tab === "find" && <FindFriendsPanel />}
      </div>

      <FAB to="/invite" label="Invite someone">
        <PlusIcon />
      </FAB>
    </MainShell>
  );
}

function SubTab({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-11 wa-tap relative inline-flex items-center justify-center gap-1.5 transition " +
        (active
          ? "text-text-oncolor"
          : "text-text-oncolor/70 hover:text-text-oncolor")
      }
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span
          className={
            "text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center " +
            (highlight
              ? "bg-wa-green-light text-wa-green-dark"
              : "bg-text-oncolor/15 text-text-oncolor")
          }
        >
          {count}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-text-oncolor rounded-t" />
      )}
    </button>
  );
}

function RowButton({
  children,
  onClick,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const cls = primary
    ? "bg-wa-green text-text-oncolor hover:bg-wa-green-dark"
    : danger
      ? "border border-line text-red-500 hover:bg-elevated"
      : "border border-line text-text-muted hover:bg-elevated";
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full transition wa-tap ${cls}`}
    >
      {children}
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
    <div className="px-4 py-3 flex items-center gap-3 border-b border-line/60">
      <Avatar
        seed={peer.username || peer.id}
        label={(peer.displayName || peer.username || peer.fingerprint).slice(0, 2)}
        size={48}
        src={peer.avatarDataUrl ?? null}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm flex items-center gap-2">
          <span className="text-text truncate font-medium">
            {peerLabel(peer)}
          </span>
          <Pill tone="neutral">{peer.accountType}</Pill>
        </div>
        {peerSubLabel(peer) && (
          <div className="text-[11px] text-text-faint font-mono truncate">
            {peerSubLabel(peer)}
          </div>
        )}
        <div className="text-xs text-text-muted truncate">{sub}</div>
      </div>
      {right}
    </div>
  );
}

/* ───────────── Phone-contact discovery ───────────── */

type Match = { hash: string; peerId: string; rawNumber: string };

function FindFriendsPanel() {
  const utils = trpc.useUtils();
  const [raw, setRaw] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const getSalt = trpc.connections.getDiscoverySalt.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const discover = trpc.connections.discoverContacts.useMutation();
  const requestPeer = trpc.connections.requestByPeerId.useMutation();

  function parseNumbers(input: string): string[] {
    const seen = new Set<string>();
    for (const piece of input.split(/[\n,;]+/)) {
      const norm = normalizePhone(piece);
      if (norm) seen.add(norm);
    }
    return [...seen];
  }

  async function onScan() {
    setError(null);
    setInfo(null);
    setMatches(null);
    const numbers = parseNumbers(raw);
    if (numbers.length === 0) {
      setError(
        "Enter at least one phone number with country code (e.g. +14155550100).",
      );
      return;
    }
    if (numbers.length > 500) {
      setError("Too many numbers — please scan 500 or fewer at a time.");
      return;
    }
    setScanning(true);
    try {
      const salt = await getSalt.refetch();
      if (!salt.data)
        throw new Error(salt.error?.message ?? "Couldn't fetch salt.");
      const hashes: string[] = [];
      const hashToNumber = new Map<string, string>();
      for (const n of numbers) {
        const h = await deriveContactHash(n, salt.data.salt);
        hashes.push(h);
        hashToNumber.set(h, n);
      }
      const result = await discover.mutateAsync({
        saltId: salt.data.saltId,
        hashes,
      });
      const found: Match[] = Object.entries(result.matches).map(
        ([hash, peerId]) => ({
          hash,
          peerId,
          rawNumber: hashToNumber.get(hash) ?? "",
        }),
      );
      setMatches(found);
      if (found.length === 0) {
        setInfo(
          `No matches found among ${numbers.length} number${numbers.length === 1 ? "" : "s"}. Your contacts aren't on Veil yet.`,
        );
      } else {
        setInfo(
          `Found ${found.length} contact${found.length === 1 ? "" : "s"} on Veil out of ${numbers.length}.`,
        );
      }
    } catch (e: unknown) {
      setError(messageOf(e));
    } finally {
      setScanning(false);
    }
  }

  async function onConnect(m: Match) {
    setSending(m.peerId);
    setError(null);
    try {
      await requestPeer.mutateAsync({
        peerId: m.peerId,
        note: `From contacts (${m.rawNumber.slice(0, 4)}…)`,
      });
      setSent((s) => new Set(s).add(m.peerId));
      utils.connections.listOutgoing.invalidate();
    } catch (e: unknown) {
      setError(messageOf(e));
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        We hash each number on this device with a server salt that rotates every
        5 minutes. The server only learns which hashed contacts already use
        Veil — never your full address book.
      </p>
      <div>
        <FieldLabel>Phone numbers (one per line, with country code)</FieldLabel>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder={"+14155550100\n+442071838750"}
          className="w-full rounded-xl bg-surface border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition font-mono text-sm"
        />
      </div>
      <PrimaryButton onClick={onScan} loading={scanning} disabled={!raw.trim()}>
        Scan for matches
      </PrimaryButton>
      <InfoMessage>{info}</InfoMessage>
      <ErrorMessage>{error}</ErrorMessage>
      {matches && matches.length > 0 && (
        <div className="flex flex-col gap-2">
          {matches.map((m) => (
            <div
              key={m.peerId}
              className="rounded-xl border border-line bg-surface p-3 flex items-center gap-3"
            >
              <Avatar seed={m.peerId} size={40} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-text truncate">
                  {m.rawNumber}
                </div>
                <div className="text-[10px] text-text-faint truncate">
                  Veil id {m.peerId}
                </div>
              </div>
              {sent.has(m.peerId) ? (
                <Pill tone="ok">Requested</Pill>
              ) : (
                <RowButton primary onClick={() => onConnect(m)}>
                  {sending === m.peerId ? "…" : "Connect"}
                </RowButton>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!cleaned.startsWith("+")) return null;
  if (cleaned.length < 8 || cleaned.length > 16) return null;
  return cleaned;
}

async function deriveContactHash(
  phoneE164: string,
  saltB64: string,
): Promise<string> {
  const canonical = `phone:${phoneE164.trim().toLowerCase()}`;
  const shaBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  const phoneShaHex = bytesToHex(new Uint8Array(shaBuf));

  const saltAb = toArrayBuffer(base64ToBytesLocal(saltB64));
  const key = await crypto.subtle.importKey(
    "raw",
    saltAb,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const msgAb = toArrayBuffer(new TextEncoder().encode(phoneShaHex));
  const sig = await crypto.subtle.sign("HMAC", key, msgAb);
  return bytesToBase64(new Uint8Array(sig));
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, "0");
  return s;
}

function base64ToBytesLocal(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
