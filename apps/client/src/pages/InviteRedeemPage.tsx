import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import {
  ScreenShell,
  Logo,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
  InfoMessage,
} from "../components/Layout";

/**
 * Invite redemption page — invitee-facing.
 *
 * Design intent
 *   The screen the invitee sees should answer one question, fast:
 *   *"who is inviting me?"* — and let them accept. The previous
 *   layout led with raw cryptographic metadata (account type chip,
 *   identity fingerprint, signup date, full UUID) which is noise to
 *   a non-technical invitee and actively confusing.
 *
 *   This redesign leads with the inviter's *profile* — avatar, name,
 *   @username, bio — like a contact card. Optional note + a single
 *   primary CTA below. Loading / invalid / done states are kept
 *   minimal and on-brand. No technical fields surfaced unless the
 *   inviter literally has nothing else to show (e.g. a fresh Random
 *   ID account with no profile yet) — in that case we fall back to a
 *   short fingerprint as a stable identifier.
 */
export function InviteRedeemPage() {
  const navigate = useNavigate();
  const { token = "" } = useParams<{ token: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);

  const preview = trpc.invites.preview.useQuery(
    { token },
    { enabled: !!token, retry: false },
  );
  const utils = trpc.useUtils();
  const redeem = trpc.invites.redeem.useMutation();

  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [done, setDone] = useState<{
    peerId: string;
    status: "pending" | "already_connected";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stash the invite token so signup/login can pick it up after auth.
  useEffect(() => {
    if (!token) return;
    try {
      sessionStorage.setItem("veil:pending_invite", token);
    } catch {
      /* ignore */
    }
  }, [token]);

  async function onAccept() {
    setError(null);
    if (!accessToken) {
      navigate("/welcome");
      return;
    }
    try {
      const res = await redeem.mutateAsync({
        token,
        note: note.trim() || undefined,
      });
      try {
        sessionStorage.removeItem("veil:pending_invite");
      } catch {
        /* ignore */
      }
      await Promise.all([
        utils.connections.list.invalidate(),
        utils.connections.listOutgoing.invalidate(),
      ]);
      setDone({ peerId: res.peerId, status: res.status });
    } catch (e: unknown) {
      setError(messageOf(e));
    }
  }

  if (!token) {
    return (
      <ScreenShell back="/" phase="Phase 2 · Invite">
        <ErrorMessage>Missing invite token.</ErrorMessage>
      </ScreenShell>
    );
  }

  if (preview.isLoading) {
    return (
      <ScreenShell back="/" phase="Phase 2 · Invite">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="h-24 w-24 rounded-full bg-surface animate-pulse" />
          <div className="h-5 w-40 rounded bg-surface animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface animate-pulse" />
        </div>
      </ScreenShell>
    );
  }

  if (preview.error) {
    return (
      <ScreenShell back="/" phase="Phase 2 · Invite">
        <ErrorMessage>{preview.error.message}</ErrorMessage>
      </ScreenShell>
    );
  }

  const data = preview.data;
  if (!data || data.state !== "valid") {
    const msg =
      data?.state === "expired"
        ? "This invite has expired."
        : data?.state === "exhausted"
          ? "This invite has already been used up."
          : data?.state === "revoked"
            ? "This invite was revoked by the sender."
            : "Invite not found.";
    return (
      <ScreenShell back="/" phase="Phase 2 · Invite">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h2 className="text-2xl font-semibold">Can't use this invite</h2>
          <p className="text-sm text-text-muted">{msg}</p>
          <SecondaryButton onClick={() => navigate("/")}>Home</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  if (done) {
    const alreadyConnected = done.status === "already_connected";
    return (
      <ScreenShell
        back="/chats"
        phase={alreadyConnected ? "Phase 2 · Connected" : "Phase 2 · Awaiting verification"}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h2 className="text-2xl font-semibold">
            {alreadyConnected ? "You're already connected" : "Request sent"}
          </h2>
          <p className="text-sm text-text-muted max-w-sm">
            {alreadyConnected
              ? "Open the chat to keep the conversation going."
              : "We've notified the person who invited you. They'll verify your identity and accept — once they do, your end-to-end encrypted chat unlocks here automatically."}
          </p>
          {alreadyConnected ? (
            <>
              <PrimaryButton onClick={() => navigate(`/chats/${done.peerId}`)}>
                Open chat
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate("/chats")}>
                All chats
              </SecondaryButton>
            </>
          ) : (
            <>
              <PrimaryButton onClick={() => navigate("/chats")}>
                Go to chats
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate("/connections")}>
                See sent requests
              </SecondaryButton>
            </>
          )}
        </div>
      </ScreenShell>
    );
  }

  // Self-invite check (UX only — server also rejects).
  const isSelf = !!me && me.id === data.inviter.id;
  const inviter = data.inviter;

  // Display name resolution — prefer the most human, fall back gracefully.
  const primaryName =
    inviter.displayName?.trim() ||
    (inviter.username ? `@${inviter.username}` : null) ||
    "VeilChat user";
  const handle = inviter.username ? `@${inviter.username}` : null;
  const showHandleLine = !!handle && handle !== primaryName;
  const initials = getInitials(inviter.displayName, inviter.username);

  return (
    <ScreenShell back="/" phase="Phase 2 · Invite">
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-xs uppercase tracking-wider text-text-faint">
          You've been invited
        </p>

        <Avatar avatarDataUrl={inviter.avatarDataUrl} initials={initials} />

        <div className="flex flex-col items-center gap-1">
          <h2 className="text-2xl font-semibold leading-tight">
            {primaryName}
          </h2>
          {showHandleLine && (
            <p className="text-sm text-text-muted">{handle}</p>
          )}
        </div>

        {inviter.bio?.trim() && (
          <p className="text-sm text-text leading-relaxed max-w-sm whitespace-pre-wrap">
            {inviter.bio.trim()}
          </p>
        )}

        <p className="text-xs text-text-faint">
          wants to chat with you on VeilChat
        </p>
      </div>

      {isSelf && <ErrorMessage>This is your own invite.</ErrorMessage>}

      {!accessToken && (
        <InfoMessage>
          You'll need a VeilChat account first. After you sign up or log in,
          we'll bring you back here automatically.
        </InfoMessage>
      )}

      {accessToken && !isSelf && (
        <div className="flex flex-col gap-2">
          {!showNote ? (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="text-sm text-text-muted hover:text-text underline-offset-4 hover:underline self-center"
            >
              Add a short note (optional)
            </button>
          ) : (
            <div>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={140}
                placeholder={`Hi ${primaryName.split(" ")[0]}, this is…`}
                rows={2}
                className="w-full rounded-xl bg-surface border border-line px-4 py-2 outline-none focus:border-wa-green transition resize-none text-sm"
              />
              <div className="text-[10px] text-text-faint text-right mt-1">
                {note.length}/140
              </div>
            </div>
          )}
        </div>
      )}

      <ErrorMessage>{error}</ErrorMessage>

      <PrimaryButton
        onClick={onAccept}
        loading={redeem.isPending}
        disabled={isSelf}
      >
        {accessToken ? "Connect" : "Continue to sign up"}
      </PrimaryButton>

      <InviterMetaFooter inviter={inviter} fallbackOnly={!hasProfile(inviter)} />
    </ScreenShell>
  );
}

/* ─────────── helpers ─────────── */

function Avatar({
  avatarDataUrl,
  initials,
}: {
  avatarDataUrl: string | null;
  initials: string;
}) {
  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt=""
        className="h-28 w-28 rounded-full object-cover ring-4 ring-surface shadow-md"
      />
    );
  }
  return (
    <div className="h-28 w-28 rounded-full bg-wa-green text-white flex items-center justify-center text-3xl font-semibold ring-4 ring-surface shadow-md">
      {initials}
    </div>
  );
}

/**
 * Tiny footer with the *technical* invite metadata (fingerprint,
 * "user since"). Kept deliberately small + low-contrast so it never
 * competes with the profile card above. Crucial for a small fraction
 * of invitees who want to verify out-of-band that the fingerprint
 * matches what the inviter told them on another channel — a real
 * security pattern we don't want to drop, just demote.
 *
 * If the inviter has no profile data at all (fresh random-id account),
 * `fallbackOnly` is true and we render a slightly more visible card
 * so the screen isn't empty.
 */
function InviterMetaFooter({
  inviter,
  fallbackOnly,
}: {
  inviter: {
    fingerprint: string;
    createdAt: string;
    accountType: string;
  };
  fallbackOnly: boolean;
}) {
  const since = useMemo(() => {
    try {
      return new Date(inviter.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [inviter.createdAt]);

  if (fallbackOnly) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-text-muted flex flex-col gap-1">
        <p>
          This person hasn't set up a profile yet, but you can still
          connect securely.
        </p>
        <p className="font-mono text-text-faint">
          Fingerprint · {inviter.fingerprint}
          {since ? ` · joined ${since}` : ""}
        </p>
      </div>
    );
  }

  return (
    <p className="text-[10px] text-text-faint text-center font-mono">
      {inviter.fingerprint}
      {since ? ` · joined ${since}` : ""}
    </p>
  );
}

function hasProfile(inviter: {
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarDataUrl: string | null;
}): boolean {
  return !!(
    (inviter.username && inviter.username.trim()) ||
    (inviter.displayName && inviter.displayName.trim()) ||
    (inviter.bio && inviter.bio.trim()) ||
    inviter.avatarDataUrl
  );
}

function getInitials(
  displayName: string | null,
  username: string | null,
): string {
  const source = (displayName || username || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String(
      (e as { message?: unknown }).message ?? "Something went wrong.",
    );
  }
  return "Something went wrong.";
}
