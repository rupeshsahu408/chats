import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore, getStoredRefreshExpiresAt } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { AppBar, Pill } from "../components/Layout";
import { loadIdentity } from "../lib/db";

/**
 * Under the hood — radical transparency about the live cryptographic
 * + technical state of the user's session. Everything is read live
 * from the local stores and a single tRPC status call. There is no
 * editing here; this page exists purely so the user can see the
 * machine they're running.
 */
export function UnderTheHoodPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  // The refresh-token expiry lives in localStorage (not the Zustand
  // store) so we re-read it once per minute. That's the same cadence
  // the rest of the page refreshes at and is more than enough
  // resolution for the human-readable countdown shown below.
  const [refreshExp, setRefreshExp] = useState<number | null>(() =>
    getStoredRefreshExpiresAt(),
  );
  useEffect(() => {
    const tick = () => setRefreshExp(getStoredRefreshExpiresAt());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const identity = useUnlockStore((s) => s.identity);

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  const prekeyStatus = trpc.prekeys.status.useQuery(undefined, {
    enabled: !!accessToken,
    refetchInterval: 60_000,
    retry: false,
  });

  const [identityFingerprint, setIdentityFingerprint] = useState<string | null>(
    null,
  );
  const [identityCreatedAt, setIdentityCreatedAt] = useState<string | null>(
    null,
  );

  // Pull the local identity record so we can show the public-key
  // fingerprint and the local creation timestamp without sending
  // anything anywhere.
  useEffect(() => {
    let cancelled = false;
    void loadIdentity().then((rec) => {
      if (cancelled || !rec) return;
      setIdentityFingerprint(formatFingerprint(rec.publicKey));
      if (rec.createdAt) setIdentityCreatedAt(rec.createdAt);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "/api";
  const apiHost = useMemo(() => prettyHost(apiBase), [apiBase]);
  const buildMode =
    (import.meta.env.MODE as string | undefined) ?? "production";
  const refreshExpiresHuman = useMemo(
    () => formatRefreshExpiry(refreshExp),
    [refreshExp],
  );

  const otpkCount = prekeyStatus.data?.oneTimePreKeyCount ?? 0;
  const hasSpk = prekeyStatus.data?.hasSignedPreKey ?? false;
  const cipherSuite = "X25519 + AES-256-GCM (Double Ratchet)";

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="Under the hood" back={() => navigate(-1)} />

      <div className="flex-1 bg-panel pb-10 w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:shadow-card lg:overflow-hidden">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-7 pb-5 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="inline-flex items-center gap-2 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            <DotPulse /> Live status
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text leading-tight">
            What's running on your device
          </h2>
          <p className="mt-2 text-[13px] text-text-muted leading-relaxed max-w-md mx-auto">
            The exact cryptographic state of your session, refreshed in
            real time. Nothing on this page is reported back to us.
          </p>
        </div>

        {/* ─── Cryptography ─── */}
        <SectionHeader>Cryptography</SectionHeader>
        <Card>
          <KVRow
            label="Cipher suite"
            value={
              <span className="font-mono text-[12px]">{cipherSuite}</span>
            }
            sub="Forward-secret per-message ratcheting (Signal protocol)."
          />
          <KVRow
            label="Identity key"
            value={
              identity ? (
                <Pill tone="ok">unlocked</Pill>
              ) : (
                <Pill tone="warn">locked</Pill>
              )
            }
            sub={
              identity
                ? "Loaded into memory only. Cleared when you log out."
                : "Encrypted at rest on this device until you unlock."
            }
          />
          <KVRow
            label="Public fingerprint"
            value={
              identityFingerprint ? (
                <span className="font-mono text-[11.5px] text-text">
                  {identityFingerprint}
                </span>
              ) : (
                <span className="text-text-faint text-[12px]">—</span>
              )
            }
            sub="Share this out-of-band to verify you're talking to the right person."
            multiline
          />
          <KVRow
            label="Signed prekey"
            value={
              hasSpk ? (
                <Pill tone="ok">uploaded</Pill>
              ) : (
                <Pill tone="warn">missing</Pill>
              )
            }
            sub="Lets new contacts start an X3DH session with you."
          />
          <KVRow
            label="One-time prekeys on server"
            value={
              <span className="font-mono tabular-nums text-text font-semibold">
                {otpkCount}
              </span>
            }
            sub="Each one is consumed by a brand-new conversation."
          />
        </Card>

        {/* ─── Connection ─── */}
        <SectionHeader>Connection</SectionHeader>
        <Card>
          <KVRow
            label="Server endpoint"
            value={
              <span className="font-mono text-[12px] text-text break-all">
                {apiHost}
              </span>
            }
            sub="Where ciphertext is relayed. It never holds the plaintext."
            multiline
          />
          <KVRow
            label="Transport"
            value={
              <span className="font-mono text-[12px]">HTTPS · WSS · tRPC</span>
            }
            sub="TLS handles the wire; payloads are pre-encrypted on top."
          />
          <KVRow
            label="Session"
            value={
              accessToken ? (
                <Pill tone="ok">signed in</Pill>
              ) : (
                <Pill tone="warn">guest</Pill>
              )
            }
            sub={
              user ? `User ID ${shortId(user.id)}` : "No active session."
            }
          />
          <KVRow
            label="Refresh token expires"
            value={
              <span className="text-text font-medium text-[13px]">
                {refreshExpiresHuman}
              </span>
            }
            sub="The browser will silently rotate sessions until then."
          />
        </Card>

        {/* ─── Build ─── */}
        <SectionHeader>Build</SectionHeader>
        <Card>
          <KVRow
            label="App"
            value={
              <span className="font-mono text-[12px] text-text">VeilChat web</span>
            }
            sub="React · Vite · tRPC client · Dexie · libsodium"
          />
          <KVRow
            label="Mode"
            value={
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                  (buildMode === "production"
                    ? "bg-wa-green/15 text-wa-green-dark dark:text-wa-green"
                    : "bg-amber-500/15 text-amber-500")
                }
              >
                {buildMode}
              </span>
            }
            sub="Production builds skip dev assertions and verbose logging."
          />
          <KVRow
            label="Identity created"
            value={
              <span className="text-text font-medium text-[13px]">
                {identityCreatedAt
                  ? new Date(identityCreatedAt).toLocaleString()
                  : "—"}
              </span>
            }
            sub="Local timestamp from your IndexedDB record."
          />
        </Card>

        <p className="px-6 pt-7 text-[11px] text-text-faint text-center leading-relaxed">
          This page is generated locally on your device. No part of it
          is sent to VeilChat's servers.
        </p>
      </div>
    </div>
  );
}

/* ───────────── sub-components ───────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-6 pb-2 text-[11px] uppercase tracking-widest text-text-muted font-semibold">
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 veil-card shadow-card divide-y divide-line/40">
      {children}
    </div>
  );
}

function KVRow({
  label,
  value,
  sub,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  multiline?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div
        className={
          multiline
            ? "flex flex-col gap-1.5"
            : "flex items-center justify-between gap-3"
        }
      >
        <div className="text-[12.5px] text-text-muted font-medium">
          {label}
        </div>
        <div className={multiline ? "text-text" : "text-text text-right"}>
          {value}
        </div>
      </div>
      {sub && (
        <div className="text-[11.5px] text-text-faint mt-1 leading-snug">
          {sub}
        </div>
      )}
    </div>
  );
}

function DotPulse() {
  return (
    <span className="relative flex size-1.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-wa-green opacity-60 animate-ping" />
      <span className="relative inline-flex size-1.5 rounded-full bg-wa-green" />
    </span>
  );
}

/* ───────────── helpers ───────────── */

function prettyHost(url: string): string {
  if (!url || url === "/api") return window.location.host + " (same origin)";
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url;
  }
}

function shortId(id: string): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

/**
 * Render a refresh-token expiry epoch as a human-relative string.
 * Accepts the absolute epoch-ms value pulled from localStorage and
 * derives the remaining duration on the fly so the caller doesn't
 * have to keep a ticking countdown — the page re-reads this every
 * minute, which is plenty of resolution for a "in 6 days" label.
 */
function formatRefreshExpiry(expiresAt: number | null | undefined): string {
  if (!expiresAt) return "—";
  const remaining = Math.floor((expiresAt - Date.now()) / 1000);
  if (remaining <= 0) return "expired";
  const days = Math.floor(remaining / 86400);
  if (days >= 1) return `in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(remaining / 3600);
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const mins = Math.floor(remaining / 60);
  return `in ${Math.max(mins, 1)} min${mins === 1 ? "" : "s"}`;
}

/**
 * Format a base64 ed25519 public key as a human-readable group of
 * 4-char chunks across two lines, for visual fingerprint comparison.
 */
function formatFingerprint(b64: string): string {
  if (!b64) return "—";
  const cleaned = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const chunks = cleaned.match(/.{1,4}/g) ?? [];
  return chunks.join(" ");
}
