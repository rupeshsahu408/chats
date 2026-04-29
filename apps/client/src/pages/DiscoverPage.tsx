import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { AppBar, Avatar, Spinner } from "../components/Layout";
import { useNoindex } from "../lib/useDocumentMeta";

/**
 * Public "Discover people" directory.
 *
 * Shows every user who has flipped the "Show me in Discover people"
 * toggle in Settings. Tapping a row opens the public profile page
 * where the viewer can send a chat request.
 *
 * Features:
 *   - Live, debounced search across username + display name.
 *   - 30-per-page cursor pagination (server-side).
 *   - Empty state nudges the viewer to enable their own listing.
 */
export function DiscoverPage() {
  useNoindex("Discover · VeilChat");
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  // Redirect to login if the page was opened without an active session
  // (e.g. via a deep link from a chat-request push notification).
  useEffect(() => {
    if (!accessToken) navigate("/welcome", { replace: true });
  }, [accessToken, navigate]);

  // Debounce search input so we aren't firing a query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const list = trpc.discover.listUsers.useInfiniteQuery(
    { search: query || undefined },
    {
      enabled: !!accessToken,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      // The server already filters out blocked / self; no need to
      // re-fetch this every focus.
      refetchOnWindowFocus: false,
    },
  );

  const users = useMemo(
    () => list.data?.pages.flatMap((p) => p.users) ?? [],
    [list.data],
  );

  return (
    <main className="min-h-full flex flex-col bg-bg text-text">
      <AppBar title="Discover people" back="/chats" />

      <div className="px-4 pt-3 pb-2 w-full mx-auto lg:max-w-2xl">
        <label className="relative block">
          <span className="sr-only">Search people</span>
          <input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search by name or username"
            className={
              "w-full h-11 pl-11 pr-3 rounded-full bg-surface " +
              "border border-line text-[15px] " +
              "placeholder:text-text-muted focus:outline-none " +
              "focus:ring-2 focus:ring-brand/50"
            }
            autoFocus
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            <SearchIcon />
          </span>
        </label>
      </div>

      <div className="flex-1 w-full mx-auto lg:max-w-2xl lg:my-2 lg:rounded-2xl lg:border lg:border-line/60 lg:bg-panel lg:shadow-card lg:overflow-hidden">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Spinner />
          </div>
        ) : list.isError ? (
          <p className="px-4 py-8 text-center text-text-muted text-sm">
            Couldn't load the directory right now. Please try again.
          </p>
        ) : users.length === 0 ? (
          <EmptyDirectory hasQuery={query.length > 0} />
        ) : (
          <ul className="divide-y divide-line/60">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/discover/${u.id}`}
                  className={
                    "flex items-center gap-3 px-4 py-3 " +
                    "hover:bg-elevated/60 active:bg-elevated " +
                    "transition-colors duration-100 wa-tap"
                  }
                >
                  <Avatar
                    seed={u.id}
                    label={u.displayName ?? u.username ?? u.id}
                    src={u.avatarDataUrl ?? undefined}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold truncate">
                      {u.displayName ?? u.username ?? "VeilChat user"}
                    </div>
                    <div className="text-[13px] text-text-muted truncate">
                      {u.bio?.trim()
                        ? u.bio
                        : u.username
                          ? `@${u.username}`
                          : "On VeilChat"}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {list.hasNextPage && (
          <div className="flex justify-center py-5">
            <button
              onClick={() => void list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
              className={
                "h-10 px-5 rounded-full bg-elevated text-text " +
                "border border-line text-sm font-semibold " +
                "hover:bg-elevated/80 disabled:opacity-60 wa-tap"
              }
            >
              {list.isFetchingNextPage ? "Loading…" : "Show more"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyDirectory({ hasQuery }: { hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="px-6 py-16 text-center text-text-muted">
        <p className="text-[15px]">No one matches that search.</p>
        <p className="text-[13px] mt-1.5">
          Try a different name or username.
        </p>
      </div>
    );
  }
  return (
    <div className="px-6 py-16 text-center">
      <div className="text-[15px] text-text">
        No one is here yet.
      </div>
      <p className="text-[13px] text-text-muted mt-2">
        Want to be findable? Open{" "}
        <Link to="/settings" className="text-brand font-semibold">
          Settings
        </Link>{" "}
        and turn on “Show me in Discover people.”
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
