import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { AppBar, Avatar, Spinner } from "../components/Layout";
import { toast } from "../lib/toast";

/**
 * Public profile page reached by tapping a row in /discover.
 *
 * Renders a large avatar + display name + bio + the appropriate CTA
 * for the current relationship:
 *
 *   none        → "Send chat request"  (creates a pending request)
 *   pending_out → disabled "Request sent" pill
 *   pending_in  → "Respond to request" → /connections?tab=incoming
 *   connected   → "Open chat" → /chats/:peerId
 *
 * The recipient gets a push notification when a request is sent and
 * can review / accept / block / report from the connections inbox.
 */
export function DiscoverProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!accessToken) navigate("/welcome", { replace: true });
  }, [accessToken, navigate]);

  const profile = trpc.discover.getUser.useQuery(
    { userId: userId! },
    { enabled: !!accessToken && !!userId, retry: false },
  );

  const sendRequest = trpc.connections.requestByPeerId.useMutation({
    onSuccess: () => {
      toast.success("Request sent");
      // Keep the local relationship state in sync so the button
      // immediately switches to "Request sent".
      void utils.discover.getUser.invalidate({ userId: userId! });
    },
    onError: (err) => {
      const msg =
        err instanceof TRPCClientError && err.message
          ? err.message
          : "Couldn't send the request. Please try again.";
      toast.error(msg);
    },
  });

  if (!userId) return null;

  if (profile.isLoading) {
    return (
      <main className="min-h-full flex flex-col bg-bg text-text">
        <AppBar title="Profile" back="/discover" />
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <Spinner />
        </div>
      </main>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <main className="min-h-full flex flex-col bg-bg text-text">
        <AppBar title="Profile" back="/discover" />
        <div className="px-6 py-16 text-center text-text-muted">
          <p className="text-[15px]">This profile isn't available.</p>
          <p className="text-[13px] mt-1.5">
            They may have turned off discoverability.
          </p>
        </div>
      </main>
    );
  }

  const { user, relationship } = profile.data;
  const name = user.displayName ?? user.username ?? "VeilChat user";

  return (
    <main className="min-h-full flex flex-col bg-bg text-text">
      <AppBar title="Profile" back="/discover" />

      <div className="w-full mx-auto lg:max-w-2xl lg:my-4 lg:rounded-2xl lg:border lg:border-line/60 lg:bg-panel lg:shadow-card lg:overflow-hidden">
      <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
        <Avatar
          seed={user.id}
          label={name}
          src={user.avatarDataUrl ?? undefined}
          size={132}
        />
        <h1 className="mt-5 text-[22px] font-bold leading-tight">
          {name}
        </h1>
        {user.username && (
          <p className="mt-1 text-[14px] text-text-muted">
            @{user.username}
          </p>
        )}
        {user.bio?.trim() && (
          <p className="mt-4 text-[15px] leading-snug text-text max-w-md whitespace-pre-wrap">
            {user.bio}
          </p>
        )}
      </div>

      <div className="px-5 pb-8">
        {relationship === "connected" ? (
          <button
            onClick={() => navigate(`/chats/${user.id}`)}
            className={primaryBtn}
          >
            Open chat
          </button>
        ) : relationship === "pending_out" ? (
          <button disabled className={pendingBtn}>
            Request sent · waiting
          </button>
        ) : relationship === "pending_in" ? (
          <button
            onClick={() => navigate("/connections?tab=incoming")}
            className={primaryBtn}
          >
            Respond to their request
          </button>
        ) : (
          <button
            onClick={() => sendRequest.mutate({ peerId: user.id })}
            disabled={sendRequest.isPending}
            className={primaryBtn}
          >
            {sendRequest.isPending ? "Sending…" : "Send chat request"}
          </button>
        )}

        <p className="mt-3 text-center text-[12px] text-text-muted">
          {relationship === "none" &&
            "They'll get a notification and can confirm, block, or report."}
          {relationship === "pending_out" &&
            "We'll let you know when they respond."}
          {relationship === "pending_in" &&
            "They sent you a request — confirm it to start chatting."}
          {relationship === "connected" &&
            "You're already connected on VeilChat."}
        </p>
      </div>
      </div>
    </main>
  );
}

const primaryBtn =
  "w-full h-12 rounded-full bg-brand text-text-oncolor " +
  "text-[15px] font-bold tracking-wide " +
  "shadow-[0_2px_8px_rgba(0,168,132,0.25)] " +
  "hover:brightness-105 active:brightness-95 " +
  "disabled:opacity-60 wa-tap transition";

const pendingBtn =
  "w-full h-12 rounded-full bg-elevated text-text-muted " +
  "border border-line text-[15px] font-semibold cursor-not-allowed";
