import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  ErrorMessage,
  InfoMessage,
  FieldLabel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Divider,
} from "../components/Layout";
import { bytesToBase64 } from "../lib/crypto";
import type { Peer } from "@veil/shared";

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
    <ScreenShell back="/chats" phase="Phase 2 · People">
      <div className="flex flex-col items-center gap-2">
        <Logo />
        <h2 className="text-2xl font-semibold">Your people</h2>
        <p className="text-xs text-white/50 text-center">
          Connections require mutual consent. You can disconnect anytime.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border border-white/10 bg-white/5 text-sm">
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
        <TabButton
          active={tab === "find"}
          onClick={() => setTab("find")}
          label="Find"
          count={0}
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

      {tab === "find" && <FindFriendsPanel />}

      <SecondaryButton onClick={() => navigate("/invite")}>
        Invite someone
      </SecondaryButton>
    </ScreenShell>
  );
}

/* ───────────── Phone-contact discovery (Phase 4) ───────────── */

type Match = {
  hash: string;
  peerId: string;
  rawNumber: string;
};

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
      setError("Enter at least one phone number with country code (e.g. +14155550100).");
      return;
    }
    if (numbers.length > 500) {
      setError("Too many numbers — please scan 500 or fewer at a time.");
      return;
    }
    setScanning(true);
    try {
      const salt = await getSalt.refetch();
      if (!salt.data) throw new Error(salt.error?.message ?? "Couldn't fetch salt.");
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
          `No matches found among ${numbers.length} number${
            numbers.length === 1 ? "" : "s"
          }. Your contacts aren't on Veil yet.`,
        );
      } else {
        setInfo(
          `Found ${found.length} contact${
            found.length === 1 ? "" : "s"
          } on Veil out of ${numbers.length}.`,
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
    <div className="flex flex-col gap-3">
      <Divider>Find friends from your contacts</Divider>
      <p className="text-xs text-white/55">
        We hash each number on this device with a server salt that rotates every
        5 minutes. The server only learns which hashed contacts already use
        Veil — never your full address book.
      </p>
      <div>
        <FieldLabel>
          Phone numbers (one per line, include country code)
        </FieldLabel>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder={"+14155550100\n+442071838750"}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-accent transition font-mono text-sm"
        />
      </div>
      <PrimaryButton
        onClick={onScan}
        loading={scanning}
        disabled={!raw.trim()}
      >
        Scan for matches
      </PrimaryButton>
      <InfoMessage>{info}</InfoMessage>
      <ErrorMessage>{error}</ErrorMessage>
      {matches && matches.length > 0 && (
        <div className="flex flex-col gap-2">
          {matches.map((m) => (
            <div
              key={m.peerId}
              className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3"
            >
              <div className="size-10 rounded-full bg-gradient-to-br from-accent/60 to-midnight flex items-center justify-center font-mono text-[10px] text-white">
                {m.peerId.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-white/90 truncate">
                  {m.rawNumber}
                </div>
                <div className="text-[10px] text-white/45 truncate">
                  Veil id {m.peerId}
                </div>
              </div>
              {sent.has(m.peerId) ? (
                <Pill tone="ok">Requested</Pill>
              ) : (
                <button
                  onClick={() => onConnect(m)}
                  disabled={sending === m.peerId}
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-soft disabled:opacity-50"
                >
                  {sending === m.peerId ? "Sending…" : "Connect"}
                </button>
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
  // Strip everything but leading + and digits.
  const cleaned = trimmed
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");
  if (!cleaned.startsWith("+")) return null;
  if (cleaned.length < 8 || cleaned.length > 16) return null;
  return cleaned;
}

async function deriveContactHash(
  phoneE164: string,
  saltB64: string,
): Promise<string> {
  // Mirror the server: phoneSha = SHA256("phone:" + lowercase(E.164)) (hex).
  // Then send HMAC(salt, phoneShaHex) — server re-derives the same value
  // for each phone user it stores and compares.
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
  for (let i = 0; i < b.length; i++) {
    s += b[i]!.toString(16).padStart(2, "0");
  }
  return s;
}

function base64ToBytesLocal(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
