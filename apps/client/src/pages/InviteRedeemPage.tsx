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
  const redeem = trpc.invites.redeem.useMutation();

  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
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
      navigate(`/?invite=${encodeURIComponent(token)}`);
      return;
    }
    try {
      await redeem.mutateAsync({ token, note: note.trim() || undefined });
      try {
        sessionStorage.removeItem("veil:pending_invite");
      } catch {
        /* ignore */
      }
      setDone(true);
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
        <div className="text-sm text-white/40 text-center">
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
          <p className="text-sm text-white/60">{msg}</p>
          <SecondaryButton onClick={() => navigate("/")}>Home</SecondaryButton>
        </div>
      </ScreenShell>
    );
  }

  if (done) {
    return (
      <ScreenShell back="/chats" phase="Phase 2 · Sent">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h2 className="text-2xl font-semibold">Request sent</h2>
          <p className="text-sm text-white/60 max-w-sm">
            They'll see your fingerprint and decide whether to connect. You'll
            see them in your People list once they accept.
          </p>
          <PrimaryButton onClick={() => navigate("/connections")}>
            View connections
          </PrimaryButton>
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

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Account type</span>
          <Pill tone="accent">{data.inviter.accountType}</Pill>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Identity fingerprint</span>
          <span className="font-mono text-white/90">
            {data.inviter.fingerprint}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">User since</span>
          <span className="text-white/80">
            {new Date(data.inviter.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">User ID</span>
          <span className="font-mono text-[10px] text-white/50 truncate max-w-[55%]">
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
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-accent transition resize-none"
        />
        <div className="text-[10px] text-white/40 text-right mt-1">
          {note.length}/140
        </div>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      <PrimaryButton
        onClick={onAccept}
        loading={redeem.isPending}
        disabled={isSelf}
      >
        {accessToken ? "Send connection request" : "Continue to sign up"}
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
