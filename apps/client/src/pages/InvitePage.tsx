import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Pill,
  Divider,
  FieldLabel,
  EmptyState,
  PlusIcon,
  LockIcon,
} from "../components/Layout";
import type { InviteSummary } from "@veil/shared";
import { loadIdentity } from "../lib/db";
import { base64ToBytes, publicKeyFingerprint } from "../lib/crypto";

export function InvitePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const utils = trpc.useUtils();
  const list = trpc.invites.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const me = trpc.me.get.useQuery(undefined, {
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

  const activeInvites = list.data ?? [];
  const noInvites = list.data && list.data.length === 0;

  return (
    <ScreenShell back="/chats" phase="Phase 2 · Invite">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h2 className="text-2xl font-semibold">Invite someone</h2>
        <p className="text-sm text-text-muted text-center max-w-sm">
          Share the pass below with one person. They'll see your fingerprint
          and ask to connect — you approve before anything links.
        </p>
      </div>

      {justCreated ? (
        <InviteCreatedCard
          invite={justCreated}
          inviter={{
            displayName: me.data?.displayName ?? null,
            username: me.data?.username ?? "",
            avatarDataUrl: me.data?.avatarDataUrl ?? null,
          }}
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
      {noInvites && !justCreated && (
        <EmptyState
          icon={<PlusIcon />}
          title="No invites yet"
          message="Each invite is a one-shot pass that lets one person connect with you."
          tipsTitle="What an invite does"
          tips={[
            {
              icon: <LockIcon />,
              title: "Proves it's you",
              body: "Your unique fingerprint is baked into the link, so the recipient knows the invite came from your device.",
            },
            {
              icon: <PlusIcon />,
              title: "One-time by default",
              body: "A 1-use pass is consumed the moment it's accepted. You can also issue 5- or 10-use passes for events.",
            },
            {
              icon: <LockIcon />,
              title: "Server only sees a hash",
              body: "The invite token itself never leaves your device after creation. Lose the link, lose the access.",
            },
          ]}
        />
      )}
      {activeInvites.map((inv) => (
        <InviteRow
          key={inv.id}
          invite={inv}
          onRevoke={() => onRevoke(inv.id)}
        />
      ))}
    </ScreenShell>
  );
}

interface Inviter {
  displayName: string | null;
  username: string;
  avatarDataUrl: string | null;
}

function InviteCreatedCard({
  invite,
  inviter,
  onDone,
}: {
  invite: InviteSummary;
  inviter: Inviter;
  onDone: () => void;
}) {
  const fullUrl = useMemo(() => {
    if (!invite.url) return "";
    return `${window.location.origin}${invite.url}`;
  }, [invite.url]);
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [fingerprint, setFingerprint] = useState<string>("");

  const initial = (
    inviter.displayName?.trim()?.[0] ??
    inviter.username?.[0] ??
    "?"
  ).toUpperCase();
  const handle = inviter.username ? `@${inviter.username}` : "";
  const niceName = inviter.displayName?.trim() || handle || "Someone";

  // QR over a high-contrast background that prints/screenshots well in
  // both light and dark; the card around it provides the colour mood.
  useEffect(() => {
    if (!fullUrl) return;
    QRCode.toDataURL(fullUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#0b1437", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [fullUrl]);

  // Compute the inviter's identity fingerprint so the recipient can
  // see (later, on the redeem screen) the same xxxx-xxxx pair we
  // surfaced here. Loaded asynchronously from the local Dexie store.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const id = await loadIdentity();
        if (!id?.publicKey) return;
        const fp = await publicKeyFingerprint(base64ToBytes(id.publicKey));
        if (!cancelled) setFingerprint(fp);
      } catch {
        /* ignore — fingerprint is decorative on this screen */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    if (!navigator.share) {
      void copy();
      return;
    }
    try {
      await navigator.share({
        title: `${niceName} invited you to Veil`,
        text: `${niceName} (${handle}) invited you to a private, end-to-end encrypted chat on Veil.`,
        url: fullUrl,
      });
    } catch {
      /* user cancelled or share failed — silent */
    }
  }

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* The "pass" — a passport-style card the recipient can recognize. */}
      <div className="rounded-3xl overflow-hidden border border-wa-green/30 bg-gradient-to-b from-wa-green/15 via-panel to-panel shadow-lg">
        {/* Header band */}
        <div className="bg-wa-green/15 border-b border-wa-green/25 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-semibold text-wa-green-dark dark:text-wa-green">
            <span className="size-1.5 rounded-full bg-wa-green animate-pulse" />
            Veil · Invite Pass
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-wa-green-dark/70 dark:text-wa-green/80">
            {invite.maxUses === 1 ? "Single-use" : `${invite.maxUses}-use`}
          </div>
        </div>

        {/* Inviter identity */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="size-14 rounded-full overflow-hidden ring-2 ring-wa-green/40 bg-surface flex items-center justify-center shrink-0">
            {inviter.avatarDataUrl ? (
              <img
                src={inviter.avatarDataUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-text-muted">
                {initial}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-text-faint">
              From
            </div>
            <div className="text-base font-semibold text-text truncate">
              {niceName}
            </div>
            {handle && niceName !== handle && (
              <div className="text-[12px] text-text-muted font-mono truncate">
                {handle}
              </div>
            )}
          </div>
          {fingerprint && (
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-text-faint">
                Key
              </div>
              <div className="font-mono text-[11px] text-text-muted">
                {fingerprint}
              </div>
            </div>
          )}
        </div>

        {/* QR */}
        <div className="px-5 pb-2 flex justify-center">
          <div className="rounded-2xl bg-white p-3 border border-line shadow-inner">
            {qr ? (
              <img src={qr} alt="Scan to accept" width={200} height={200} />
            ) : (
              <div className="size-[200px] grid place-items-center text-text-faint text-xs">
                Generating QR…
              </div>
            )}
          </div>
        </div>

        {/* Trust handshake bullets */}
        <div className="px-5 py-4 mt-1 flex flex-col gap-2 border-t border-wa-green/20">
          <TrustBullet>
            End-to-end encrypted from your first hello.
          </TrustBullet>
          <TrustBullet>
            Veil never sees your contacts — only this one-time pass.
          </TrustBullet>
          <TrustBullet>
            You approve the connection before anything links.
          </TrustBullet>
        </div>

        {/* Footer link */}
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-surface/60 border border-line/60 px-3 py-2 text-[11px] font-mono text-text-muted break-all">
            {fullUrl}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className={
          "grid gap-2 " + (canShare ? "grid-cols-3" : "grid-cols-2")
        }
      >
        <SecondaryButton onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </SecondaryButton>
        {canShare && (
          <SecondaryButton onClick={share}>Share…</SecondaryButton>
        )}
        <SecondaryButton onClick={onDone}>Done</SecondaryButton>
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed text-center px-2">
        We won't show this pass again — copy or share it now. The token
        itself never leaves your device after this screen; the server only
        keeps a hash.
      </p>
    </div>
  );
}

function TrustBullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12.5px] leading-snug text-text">
      <span className="mt-1 size-1.5 rounded-full bg-wa-green shrink-0" />
      <span>{children}</span>
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
