import { useEffect, useState } from "react";
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
  Pill,
  FieldLabel,
} from "../components/Layout";

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
  const [done, setDone] = useState<{ peerId: string; alreadyConnected: boolean } | null>(null);
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
      // Token is already in sessionStorage (see effect above); the
      // signup/login flows pick it up via `postAuthLandingPath()` and
      // bring the user back to this exact invite. Sending them to
      // `/welcome` lets them choose how they want to authenticate.
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
      // Refresh the connections list so the new chat shows up immediately.
      await utils.connections.list.invalidate();
      setDone({
        peerId: res.peerId,
        alreadyConnected: res.alreadyConnected,
      });
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
        <div className="text-sm text-text-faint text-center">
          Loading invite…
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
    return (
      <ScreenShell back="/chats" phase="Phase 2 · Connected">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h2 className="text-2xl font-semibold">
            {done.alreadyConnected ? "You're already connected" : "You're connected!"}
          </h2>
          <p className="text-sm text-text-muted max-w-sm">
            {done.alreadyConnected
              ? "Open the chat to keep the conversation going."
              : "Your end-to-end encrypted chat is ready. Say hi!"}
          </p>
          <PrimaryButton onClick={() => navigate(`/chats/${done.peerId}`)}>
            Open chat
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate("/chats")}>
            All chats
          </SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  // Self-invite check (UX only — server also rejects).
  const isSelf = !!me && me.id === data.inviter.id;

  return (
    <ScreenShell back="/" phase="Phase 2 · Invite">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h2 className="text-2xl font-semibold">You've been invited</h2>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Account type</span>
          <Pill tone="accent">{data.inviter.accountType}</Pill>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Identity fingerprint</span>
          <span className="font-mono text-text">
            {data.inviter.fingerprint}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">User since</span>
          <span className="text-text">
            {new Date(data.inviter.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">User ID</span>
          <span className="font-mono text-[10px] text-text-muted truncate max-w-[55%]">
            {data.inviter.id}
          </span>
        </div>
      </div>

      {isSelf && (
        <ErrorMessage>This is your own invite.</ErrorMessage>
      )}

      {!accessToken && (
        <InfoMessage>
          You'll need an account first. After you sign up or log in, we'll
          bring you back here automatically.
        </InfoMessage>
      )}

      <div>
        <FieldLabel>Optional note (≤140 chars)</FieldLabel>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={140}
          placeholder="Hey, this is Alex from work"
          rows={2}
          className="w-full rounded-xl bg-surface border border-line px-4 py-2 outline-none focus:border-wa-green transition resize-none"
        />
        <div className="text-[10px] text-text-faint text-right mt-1">
          {note.length}/140
        </div>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      <PrimaryButton
        onClick={onAccept}
        loading={redeem.isPending}
        disabled={isSelf}
      >
        {accessToken ? "Connect" : "Continue to sign up"}
      </PrimaryButton>
    </ScreenShell>
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
