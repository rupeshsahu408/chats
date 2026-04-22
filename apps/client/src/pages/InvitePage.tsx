import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
  InfoMessage,
  Pill,
  Divider,
  FieldLabel,
} from "../components/Layout";
import type { InviteSummary } from "@veil/shared";

export function InvitePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const utils = trpc.useUtils();
  const list = trpc.invites.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const create = trpc.invites.create.useMutation();
  const revoke = trpc.invites.revoke.useMutation();

  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState<1 | 5 | 10>(1);
  const [expiresInHours, setExpiresInHours] = useState<number>(168);
  const [justCreated, setJustCreated] = useState<InviteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  async function onCreate() {
    setError(null);
    try {
      const r = await create.mutateAsync({
        label: label.trim() || undefined,
        maxUses,
        expiresInHours,
      });
      setJustCreated(r);
      setLabel("");
      utils.invites.list.invalidate();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  async function onRevoke(id: string) {
    try {
      await revoke.mutateAsync({ inviteId: id });
      utils.invites.list.invalidate();
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  return (
    <ScreenShell back="/chats" phase="Phase 2 · Invite">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h2 className="text-2xl font-semibold">Invite someone</h2>
        <p className="text-sm text-text-muted text-center max-w-sm">
          Share the link or QR with one person. They'll see your fingerprint
          and ask to connect — you approve before anything links.
        </p>
      </div>

      {justCreated ? (
        <InviteCreatedCard
          invite={justCreated}
          onDone={() => setJustCreated(null)}
        />
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3">
            <div>
              <FieldLabel>Label (optional)</FieldLabel>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "for Alex"'
                maxLength={60}
                className="w-full rounded-xl bg-surface border border-line px-4 py-2 outline-none focus:border-wa-green transition"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Max uses</FieldLabel>
                <select
                  value={maxUses}
                  onChange={(e) =>
                    setMaxUses(Number(e.target.value) as 1 | 5 | 10)
                  }
                  className="w-full rounded-xl bg-surface border border-line px-3 py-2 outline-none focus:border-wa-green"
                >
                  <option value={1}>1 (single-use)</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <div>
                <FieldLabel>Expires in</FieldLabel>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full rounded-xl bg-surface border border-line px-3 py-2 outline-none focus:border-wa-green"
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>1 day</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
              </div>
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <PrimaryButton onClick={onCreate} loading={create.isPending}>
              Create invite
            </PrimaryButton>
          </div>
        </>
      )}

      <Divider>Your invites</Divider>
      {list.isLoading && (
        <div className="text-sm text-text-faint text-center">Loading…</div>
      )}
      {list.data && list.data.length === 0 && (
        <div className="text-sm text-text-faint text-center">
          No invites yet.
        </div>
      )}
      {list.data?.map((inv) => (
        <InviteRow
          key={inv.id}
          invite={inv}
          onRevoke={() => onRevoke(inv.id)}
        />
      ))}
    </ScreenShell>
  );
}

function InviteCreatedCard({
  invite,
  onDone,
}: {
  invite: InviteSummary;
  onDone: () => void;
}) {
  const fullUrl = useMemo(() => {
    if (!invite.url) return "";
    return `${window.location.origin}${invite.url}`;
  }, [invite.url]);
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!fullUrl) return;
    QRCode.toDataURL(fullUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280,
      color: { dark: "#ffffff", light: "#0b1437" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [fullUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-xl border border-wa-green/30 bg-wa-green/10 p-4 flex flex-col gap-3 items-center text-center">
      <div className="text-xs uppercase tracking-wider text-wa-green-dark dark:text-wa-green">
        Invite ready
      </div>
      {qr && (
        <img
          src={qr}
          alt="Invite QR"
          className="rounded-lg border border-line"
          width={240}
          height={240}
        />
      )}
      <div className="w-full">
        <div className="font-mono text-[11px] text-text-muted break-all bg-surface rounded-lg px-3 py-2 border border-line">
          {fullUrl}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        <SecondaryButton onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </SecondaryButton>
        <SecondaryButton onClick={onDone}>Done</SecondaryButton>
      </div>
      <div className="text-[11px] text-text-muted leading-relaxed">
        We won't show this link again — copy or screenshot it now. The token
        itself never leaves your device after this screen; the server only
        keeps a hash.
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  onRevoke,
}: {
  invite: InviteSummary;
  onRevoke: () => void;
}) {
  const isRevoked = !!invite.revokedAt;
  const isExpired =
    !!invite.expiresAt && new Date(invite.expiresAt) <= new Date();
  const isExhausted =
    invite.maxUses !== null &&
    invite.maxUses > 0 &&
    invite.usedCount >= invite.maxUses;
  const status = isRevoked
    ? "revoked"
    : isExpired
      ? "expired"
      : isExhausted
        ? "exhausted"
        : "active";
  const tone =
    status === "active" ? "ok" : status === "revoked" ? "danger" : "warn";

  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {invite.label ?? "Untitled invite"}
        </div>
        <div className="text-xs text-text-muted">
          Used {invite.usedCount}
          {invite.maxUses ? `/${invite.maxUses}` : ""} ·{" "}
          {invite.expiresAt
            ? `expires ${new Date(invite.expiresAt).toLocaleDateString()}`
            : "no expiry"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Pill tone={tone}>{status}</Pill>
        {status === "active" && (
          <button
            onClick={onRevoke}
            className="text-xs text-red-500 hover:text-red-200 underline"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String(
      (e as { message?: unknown }).message ?? "Something went wrong.",
    );
  }
  return "Something went wrong.";
}
