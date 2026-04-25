import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import {
  SettingsRow,
  Avatar,
  Pill,
  ErrorMessage,
  LockIcon,
  PrimaryButton,
  SecondaryButton,
  FieldLabel,
  TextInput,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { ScheduledMessagesSheet } from "../components/ScheduledMessagesSheet";
import { SignInActivitySheet } from "../components/SignInActivitySheet";
import { useThemeStore, THEME_META } from "../lib/themeStore";
import {
  useWallpaperStore,
  getWallpaperStyle,
  fileToCompressedDataUrl,
  SOLID_PALETTE,
  DOT_PALETTE,
  type WallpaperKind,
} from "../lib/wallpaperStore";
import { ensurePushSubscription, disablePushSubscription } from "../lib/push";
import { clearIdentity, loadIdentity } from "../lib/db";
import { useStealthPrefs } from "../lib/stealthPrefs";
import { useFocusState, formatFocusEnds, focusReasonLabel } from "../lib/focusMode";
import { useKeyboardPrefs, isCoarsePointerDevice } from "../lib/keyboardPrefs";
import { feedback } from "../lib/feedback";
import { resizeAvatarToDataUrl } from "../lib/avatar";
import { RecoveryKitDownloadCard } from "../components/RecoveryKitDownloadCard";
import { PasskeySetupCard } from "../components/PasskeySetupCard";
import { isPasskeySupported } from "../lib/passkey";
import { humanizeErrorMessage } from "../lib/humanizeError";
import { encryptRecoveryPhraseForServer } from "../lib/unlock";

/**
 * Wireframe of the Settings surface.
 *
 *   ┌──────────── AppBar ──────────────────────────────────┐
 *   │  Chats │ People │ Settings ◀ active tab               │
 *   ├──────────────┬──────────────────────────────────────┤
 *   │ Profile card │                                       │
 *   │              │                                       │
 *   │ ▸ Profile    │     Selected category content         │
 *   │ ▸ Account    │     (each row preserved verbatim)     │
 *   │ ▸ Security   │                                       │
 *   │ ▸ Privacy    │                                       │
 *   │ ▸ Appearance │                                       │
 *   │ ▸ Notifs     │                                       │
 *   │ ▸ Transp.    │                                       │
 *   │ ▸ Session    │                                       │
 *   │  legal foot  │                                       │
 *   └──────────────┴──────────────────────────────────────┘
 *
 * Responsive behavior
 *   - md+ (≥768px) — sidebar (w-80) + content panel side by side. The
 *     sidebar is permanently visible. With no category selected we
 *     show a quiet empty-state inviting the user to pick one.
 *   - mobile (<768px) — sidebar OR content, never both. The category
 *     list at /settings is the index. Tapping a category routes to
 *     /settings/<id> and replaces the view; a back arrow returns home.
 *
 * Routing
 *   - The route is registered as /settings/* so this page handles its
 *     own sub-paths. The active category id is derived from the URL,
 *     so deep links (and the browser Back button) work naturally.
 *
 * Preservation guarantee
 *   - Every row, link, and action that existed on the legacy single-
 *     page settings is rendered by exactly one section below. Nothing
 *     was deleted; only re-grouped.
 */

interface SettingsSection {
  id: string;
  label: string;
  desc: string;
  icon: string;
  render: () => React.ReactNode;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearUnlock = useUnlockStore((s) => s.clear);
  const identity = useUnlockStore((s) => s.identity);

  const meQuery = trpc.me.get.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const prekeyStatus = trpc.prekeys.status.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });
  const logout = trpc.auth.logout.useMutation();
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const scheduledList = trpc.scheduled.list.useQuery(undefined, {
    enabled: !!accessToken,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const pendingScheduledCount =
    scheduledList.data?.scheduled.filter((s) => s.status === "pending")
      .length ?? 0;

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  const otpkCount = prekeyStatus.data?.oneTimePreKeyCount ?? 0;
  const hasSpk = prekeyStatus.data?.hasSignedPreKey ?? false;

  async function onLogout() {
    if (!confirm("Log out of VeilChat on this browser?")) return;
    try {
      await logout.mutateAsync();
    } catch {
      /* ignore */
    }
    await clearUnlock();
    clearAuth();
    navigate("/");
  }

  async function onWipeDevice() {
    if (
      !confirm(
        "This wipes ALL local data on this browser (identity, chats, sessions). You'll need your PIN or recovery phrase to log back in. Continue?",
      )
    )
      return;
    await clearIdentity();
    await clearUnlock();
    clearAuth();
    navigate("/");
  }

  const me = meQuery.data;
  const headline =
    me?.displayName?.trim() ||
    (me?.username ? `@${me.username}` : "Your account");
  const subtitle = me?.username ? `@${me.username}` : null;

  // Section catalog — order matters: matches the order in the sidebar
  // and dictates the visual hierarchy of the page. Every row that lived
  // on the legacy single-page settings has a home in exactly one of
  // these sections; nothing was removed.
  const sections: SettingsSection[] = useMemo(
    () => [
      {
        id: "profile",
        label: "Profile",
        desc: "Name, photo, bio, and username",
        icon: "👤",
        render: () => (
          <SettingsSectionPanel>
            <UsernameRow username={me?.username ?? null} />
            <ProfileEditor />
          </SettingsSectionPanel>
        ),
      },
      {
        id: "account",
        label: "Account",
        desc: "Connections, invites, scheduled messages",
        icon: "🪪",
        render: () => (
          <SettingsSectionPanel>
            <SettingsRow
              icon={<LockIcon />}
              label="Encryption"
              sub={
                hasSpk
                  ? `Signed prekey · ${otpkCount} one-time keys`
                  : "No prekeys uploaded yet"
              }
            />
            <SettingsRow
              label="People"
              sub="Manage your connections"
              to="/connections"
            />
            <SettingsRow
              label="Invite someone"
              sub="Generate a private link or QR"
              to="/invite"
            />
            <SettingsRow
              label="Scheduled messages"
              sub={
                pendingScheduledCount && pendingScheduledCount > 0
                  ? `${pendingScheduledCount} pending across all chats`
                  : "View and manage messages waiting to send"
              }
              onClick={() => setScheduledOpen(true)}
            />
            {me && (
              <SettingsRow
                label="Member since"
                sub={new Date(me.createdAt).toLocaleDateString()}
              />
            )}
          </SettingsSectionPanel>
        ),
      },
      {
        id: "security",
        label: "Security",
        desc: "Passwords, recovery, passkeys, sign-ins",
        icon: "🔒",
        render: () => (
          <SettingsSectionPanel>
            <ChangeLoginPasswordEditor />
            <DailyPasswordEditor />
            <RecoveryKeyRow username={me?.username ?? null} />
            <PasskeyRow />
            <SignInActivityRow />
          </SettingsSectionPanel>
        ),
      },
      {
        id: "privacy",
        label: "Privacy",
        desc: "Read receipts, blocking, vault, keyboard",
        icon: "🛡️",
        render: () => (
          <SettingsSectionPanel>
            <PrivacyRows />
            <LastSeenPrivacyRow />
            <DiscoverabilityRow />
            <BlockedContactsRow />
            <VeilKeyboardRow />
            <SettingsRow
              label="Vault"
              sub="Hide chats behind your fingerprint or face"
              to="/vault"
            />
          </SettingsSectionPanel>
        ),
      },
      {
        id: "appearance",
        label: "Appearance",
        desc: "Theme and chat wallpaper",
        icon: "🎨",
        render: () => (
          <SettingsSectionPanel>
            <ThemeRow />
            <WallpaperRow />
          </SettingsSectionPanel>
        ),
      },
      {
        id: "notifications",
        label: "Notifications & feel",
        desc: "Focus mode, sounds, haptics, push",
        icon: "🔔",
        render: () => (
          <SettingsSectionPanel>
            <FocusModeStatusRow />
            <SettingsRow
              label="Sound & feel"
              sub="Master volume, haptics, and per-motif previews"
              to="/sound"
            />
            <PushRow />
          </SettingsSectionPanel>
        ),
      },
      {
        id: "transparency",
        label: "Transparency",
        desc: "Promises, privacy reports, what we store",
        icon: "📋",
        render: () => (
          <SettingsSectionPanel>
            <SettingsRow
              label="Our promises"
              sub="No ads, no data sharing, local-first, open source — in plain words"
              to="/promises"
            />
            <SettingsRow
              label="Daily privacy report"
              sub="See what VeilChat protected today"
              to="/privacy-report"
            />
            <SettingsRow
              label="Under the hood"
              sub="Live cipher suite, keys on this device, and your session state"
              to="/under-the-hood"
            />
            <SettingsRow
              label="What we store"
              sub="Field-by-field: ciphertext vs metadata in our database"
              to="/what-we-store"
            />
          </SettingsSectionPanel>
        ),
      },
      {
        id: "session",
        label: "Session",
        desc: "Log out or wipe this device",
        icon: "⏻",
        render: () => (
          <SettingsSectionPanel>
            <SettingsRow
              label="Log out"
              sub="Sign out of this browser"
              onClick={onLogout}
            />
            <SettingsRow
              label="Wipe local data"
              sub="Removes identity & chats from this device"
              onClick={onWipeDevice}
              danger
            />
          </SettingsSectionPanel>
        ),
      },
    ],
    // We intentionally close over the latest props/handlers each render.
    // The render functions are tiny and re-creating them is cheaper than
    // memoizing — and avoids subtle staleness bugs in the row data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, hasSpk, otpkCount, pendingScheduledCount],
  );

  // Active category derived from the URL, e.g. /settings/security → "security"
  const activeId = (() => {
    const m = location.pathname.match(/^\/settings\/([^/]+)/);
    return m ? m[1] : null;
  })();
  const active = sections.find((s) => s.id === activeId) ?? null;

  return (
    <MainShell active="settings" title="Settings">
      <div className="flex flex-1 min-h-0">
        {/* ─────────────────── Sidebar ─────────────────── */}
        <aside
          aria-label="Settings categories"
          className={
            "bg-panel md:w-80 md:shrink-0 md:border-r md:border-line/60 md:block " +
            (active ? "hidden md:block" : "block w-full")
          }
        >
          {/* Profile card — anchors the sidebar with identity + state */}
          <div className="flex items-center gap-4 px-4 py-5 border-b border-line">
            {me?.avatarDataUrl ? (
              <img
                src={me.avatarDataUrl}
                alt=""
                className="w-16 h-16 rounded-full object-cover ring-2 ring-line shrink-0"
              />
            ) : (
              <Avatar
                seed={me?.username || user?.id || "self"}
                label={(me?.displayName || me?.username || "?").slice(0, 2)}
                size={64}
              />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-text text-lg truncate">
                {headline}
              </div>
              {subtitle && (
                <div className="text-sm text-text-muted truncate">
                  {subtitle}
                </div>
              )}
              {me?.bio && (
                <div className="text-xs text-text-muted truncate mt-0.5">
                  {me.bio}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2">
                {identity ? (
                  <Pill tone="ok">unlocked</Pill>
                ) : (
                  <Pill tone="warn">locked</Pill>
                )}
              </div>
            </div>
          </div>

          {/* Category list */}
          <nav className="py-2" aria-label="Settings categories list">
            {sections.map((s) => (
              <CategoryLink
                key={s.id}
                id={s.id}
                label={s.label}
                desc={s.desc}
                icon={s.icon}
                isActive={active?.id === s.id}
              />
            ))}
          </nav>

          {/* Surface-level error from the me query — kept in the
              sidebar so users always see it regardless of which
              category they're in. */}
          {meQuery.error && (
            <div className="p-4">
              <ErrorMessage>{meQuery.error.message}</ErrorMessage>
            </div>
          )}

          <p className="text-[11px] text-text-faint text-center py-6 px-6 leading-relaxed">
            VeilChat · End-to-end encrypted messaging.
            <br />
            Sessions stay signed in for 90 days. PIN once per browser.
          </p>
        </aside>

        {/* ─────────────────── Content ─────────────────── */}
        <section
          aria-label="Settings content"
          className={
            "flex-1 min-w-0 bg-bg " + (active ? "block" : "hidden md:block")
          }
        >
          {active ? (
            <>
              {/* Mobile sub-header with back-to-list. Desktop already
                  shows both panels at once, so the back affordance is
                  unnecessary there. */}
              <div className="md:hidden sticky top-[6.5rem] z-[5] bg-panel/95 backdrop-blur border-b border-line/60 px-2 py-2 flex items-center gap-1">
                <button
                  onClick={() => navigate("/settings")}
                  className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center wa-tap"
                  aria-label="Back to settings categories"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="text-base font-semibold truncate">
                  {active.label}
                </span>
              </div>

              {/* Desktop section header — gives content its own title
                  even though the sidebar already shows the active
                  state. Helps when the sidebar scrolls out of view. */}
              <div className="hidden md:flex items-baseline gap-3 px-6 pt-6 pb-3 border-b border-line/60">
                <h2 className="text-xl font-semibold text-text">
                  {active.label}
                </h2>
                <span className="text-sm text-text-muted truncate">
                  {active.desc}
                </span>
              </div>

              {active.render()}
            </>
          ) : (
            // Desktop empty-state placeholder. (On mobile this branch
            // is hidden because the sidebar fills the viewport.)
            <div className="hidden md:flex flex-col items-center justify-center text-center p-16 text-text-muted h-full min-h-[60vh]">
              <div className="size-16 rounded-full bg-surface flex items-center justify-center mb-4 text-3xl">
                ⚙
              </div>
              <h2 className="text-text font-semibold mb-1">
                Choose a category
              </h2>
              <p className="text-sm max-w-sm">
                Pick a section from the left to manage your account, security,
                privacy, and more.
              </p>
            </div>
          )}
        </section>
      </div>

      {scheduledOpen && (
        <ScheduledMessagesSheet
          peerId={null}
          onClose={() => setScheduledOpen(false)}
        />
      )}
    </MainShell>
  );
}

/**
 * Sidebar entry. Renders as a router Link so deep-links work; the
 * active state is purely visual (the URL is the source of truth).
 */
function CategoryLink({
  id,
  label,
  desc,
  icon,
  isActive,
}: {
  id: string;
  label: string;
  desc: string;
  icon: string;
  isActive: boolean;
}) {
  return (
    <Link
      to={`/settings/${id}`}
      aria-current={isActive ? "page" : undefined}
      className={
        "flex items-center gap-3 px-4 py-3 wa-tap transition-colors " +
        "border-l-[3px] " +
        (isActive
          ? "bg-wa-green/10 border-wa-green text-text"
          : "border-transparent text-text hover:bg-surface/60")
      }
    >
      <span
        className={
          "size-10 rounded-full flex items-center justify-center text-lg shrink-0 " +
          (isActive ? "bg-wa-green/15" : "bg-surface")
        }
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[15px] leading-tight">
          {label}
        </span>
        <span className="block text-xs text-text-muted truncate mt-0.5">
          {desc}
        </span>
      </span>
      <ChevronRightIcon className="w-4 h-4 text-text-muted md:hidden shrink-0" />
    </Link>
  );
}

/**
 * Thin container for a settings category panel. Keeps the visual
 * styling consistent across categories without each section having to
 * remember the right background and dividers.
 */
function SettingsSectionPanel({ children }: { children: React.ReactNode }) {
  return <div className="bg-panel md:bg-bg">{children}</div>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-5 pb-1 text-[11px] uppercase tracking-widest text-text-muted bg-panel">
      {children}
    </div>
  );
}

/* ─────────── Username display (read-only, copyable) ─────────── */

function UsernameRow({ username }: { username: string | null }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable */
    }
  }
  return (
    <div className="px-4 py-3 bg-panel border-b border-line/60 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-text font-medium">Username</div>
        <div className="text-sm text-wa-green font-mono truncate">
          {username ? `@${username}` : "—"}
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          People can find and add you using this handle.
        </div>
      </div>
      {username && (
        <button
          onClick={copy}
          className="shrink-0 text-sm px-3 py-1.5 rounded-full border border-line text-text hover:bg-white/5 wa-tap"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

/* ─────────── Recovery key download ─────────── */

function RecoveryKeyRow({ username }: { username: string | null }) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  async function openModal() {
    setUnsupported(false);
    setPhrase(null);
    setOpen(true);
    try {
      const rec = await loadIdentity();
      if (!rec) {
        setUnsupported(true);
        return;
      }
      if (rec.recoveryPhrase) {
        setPhrase(rec.recoveryPhrase);
      } else {
        // Either a PIN-encrypted account (no phrase exists) or a Random
        // ID account that signed in before we started persisting the
        // phrase locally.
        setUnsupported(true);
      }
    } catch {
      setUnsupported(true);
    }
  }

  return (
    <>
      <SettingsRow
        label="Recovery kit"
        sub="Download your unique recovery PDF. You'll need it to log in on a new device."
        onClick={openModal}
      />
      {open && (
        <Modal
          title="Recovery kit"
          onClose={() => {
            setOpen(false);
          }}
        >
          {unsupported ? (
            <div className="space-y-3">
              <p className="text-sm text-text">
                Your recovery kit isn't stored on this device.
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                If this is a Random ID account, sign in once with your 12-word
                phrase and we'll save a copy here so you can re-download the
                kit from this screen later. PIN-protected accounts don't have
                a recovery phrase.
              </p>
              <div className="flex justify-end mt-4">
                <PrimaryButton onClick={() => setOpen(false)}>OK</PrimaryButton>
              </div>
            </div>
          ) : !phrase ? (
            <div className="text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-text-muted leading-relaxed">
                Your recovery kit is a single PDF that contains your 12-word
                phrase and a scannable QR code. Anyone with this file can log
                in as you — store it somewhere only you can reach.
              </p>

              <RecoveryKitDownloadCard
                username={username ?? "account"}
                phrase={phrase}
              />

              <div className="flex flex-wrap gap-2 pt-2 justify-end">
                <SecondaryButton onClick={() => setOpen(false)}>
                  Close
                </SecondaryButton>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

/* ─────────── Passkeys ─────────── */

function PasskeyRow() {
  const supported = isPasskeySupported();
  const [open, setOpen] = useState(false);
  const list = trpc.passkey.list.useQuery(undefined, {
    enabled: open,
    retry: false,
  });
  const utils = trpc.useUtils();
  const rename = trpc.passkey.rename.useMutation({
    onSuccess: () => utils.passkey.list.invalidate(),
  });
  const del = trpc.passkey.delete.useMutation({
    onSuccess: () => utils.passkey.list.invalidate(),
  });

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doRename() {
    if (!renaming) return;
    setError(null);
    try {
      await rename.mutateAsync({
        id: renaming.id,
        deviceName: renaming.name.trim() || "This device",
      });
      setRenaming(null);
      feedback.success();
    } catch (e) {
      setError(humanizeErrorMessage(e));
      feedback.error();
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setError(null);
    try {
      await del.mutateAsync({ id: confirmDelete.id });
      setConfirmDelete(null);
      feedback.success();
    } catch (e) {
      setError(humanizeErrorMessage(e));
      feedback.error();
    }
  }

  const items = list.data ?? [];
  const sub = !supported
    ? "Not supported on this browser"
    : list.data
      ? items.length === 0
        ? "No passkeys yet — sign in without a password"
        : items.length === 1
          ? "1 passkey"
          : `${items.length} passkeys`
    : "Sign in without a password using Face ID, Touch ID or Windows Hello";

  return (
    <>
      <SettingsRow
        label="Passkeys"
        sub={sub}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      />
      {open && (
        <Modal
          title="Passkeys"
          onClose={() => {
            setOpen(false);
            setRenaming(null);
            setConfirmDelete(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Passkeys let you sign in to VeilChat without a password. Each device
              gets its own passkey. Removing one only removes it from this
              account — your device will still have it locally until you
              delete it from the system passkey manager.
            </p>

            <PasskeySetupCard />

            {list.isLoading ? (
              <div className="text-sm text-text-muted">Loading…</div>
            ) : items.length === 0 ? null : (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-text-muted">
                  Saved passkeys
                </div>
                <ul className="rounded-2xl border border-line divide-y divide-line overflow-hidden">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-3 bg-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-text truncate">
                          {p.deviceName}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {p.lastUsedAt
                            ? `Last used ${new Date(p.lastUsedAt).toLocaleDateString()}`
                            : `Added ${new Date(p.createdAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setRenaming({ id: p.id, name: p.deviceName })
                        }
                        className="text-xs px-3 py-1.5 rounded-full border border-line text-text hover:bg-white/5 wa-tap"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            id: p.id,
                            name: p.deviceName,
                          })
                        }
                        className="text-xs px-3 py-1.5 rounded-full border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 wa-tap"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <SecondaryButton onClick={() => setOpen(false)}>
                Close
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      )}

      {renaming && (
        <Modal
          title="Rename passkey"
          onClose={() => setRenaming(null)}
        >
          <div className="space-y-3">
            <FieldLabel>Device name</FieldLabel>
            <TextInput
              autoFocus
              value={renaming.name}
              onChange={(e) =>
                setRenaming({ ...renaming, name: e.target.value.slice(0, 60) })
              }
              placeholder="e.g. iPhone, Work laptop"
            />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setRenaming(null)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onClick={doRename}
                loading={rename.isPending}
                disabled={!renaming.name.trim()}
              >
                Save
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Remove passkey?"
          onClose={() => setConfirmDelete(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-text">
              Remove the passkey on{" "}
              <span className="font-semibold">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-text-muted">
              You won't be able to sign in with this passkey anymore. You can
              always add a new one later.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setConfirmDelete(null)}>
                Cancel
              </SecondaryButton>
              <button
                type="button"
                onClick={doDelete}
                disabled={del.isPending}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 transition disabled:opacity-60 wa-tap"
              >
                {del.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─────────── Sign-in activity row ─────────── */

function SignInActivityRow() {
  const [open, setOpen] = useState(false);
  const list = trpc.auth.listSessions.useQuery(undefined, {
    enabled: open,
    retry: false,
  });
  const sub = (() => {
    if (!open || !list.data) {
      return "See devices signed in to your account";
    }
    const n = list.data.length;
    if (n === 0) return "No active sessions";
    if (n === 1) return "1 active session";
    return `${n} active sessions`;
  })();

  return (
    <>
      <SettingsRow
        label="Sign-in activity"
        sub={sub}
        onClick={() => setOpen(true)}
      />
      {open && (
        <Modal title="Sign-in activity" onClose={() => setOpen(false)}>
          <SignInActivitySheet onClose={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

/* ─────────── Profile editor (name / bio / photo) ─────────── */

function ProfileEditor() {
  const meQuery = trpc.me.get.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const update = trpc.me.updateProfile.useMutation({
    onSuccess: () => utils.me.get.invalidate(),
  });

  const [editing, setEditing] = useState<null | "name" | "bio" | "photo">(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const me = meQuery.data;

  function openName() {
    setDisplayName(me?.displayName ?? "");
    setError(null);
    setEditing("name");
  }
  function openBio() {
    setBio(me?.bio ?? "");
    setError(null);
    setEditing("bio");
  }
  function openPhoto() {
    setAvatarDataUrl(me?.avatarDataUrl ?? null);
    setError(null);
    setEditing("photo");
  }

  async function saveName() {
    setError(null);
    setBusy(true);
    try {
      await update.mutateAsync({ displayName: displayName.trim() || null });
      setEditing(null);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function saveBio() {
    setError(null);
    setBusy(true);
    try {
      await update.mutateAsync({ bio: bio.trim() || null });
      setEditing(null);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function savePhoto() {
    setError(null);
    setBusy(true);
    try {
      await update.mutateAsync({ avatarDataUrl: avatarDataUrl ?? null });
      setEditing(null);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const url = await resizeAvatarToDataUrl(file);
      setAvatarDataUrl(url);
    } catch (ex) {
      setError((ex as Error).message ?? "Could not load image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsRow
        label="Name"
        sub={me?.displayName?.trim() || "Add your display name"}
        onClick={openName}
      />
      <SettingsRow
        label="Bio"
        sub={me?.bio?.trim() || "Add a short bio"}
        onClick={openBio}
      />
      <SettingsRow
        label="Profile photo"
        sub={me?.avatarDataUrl ? "Tap to change or remove" : "Add a photo"}
        onClick={openPhoto}
      />

      {editing && (
        <Modal title={modalTitle(editing)} onClose={() => setEditing(null)}>
          {editing === "name" && (
            <>
              <FieldLabel>Display name</FieldLabel>
              <TextInput
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                placeholder="Jane Doe"
                autoComplete="name"
              />
              <p className="text-xs text-text-faint mt-1">
                Optional. Up to 60 characters.
              </p>
              <ErrorMessage>{error}</ErrorMessage>
              <div className="flex gap-2 mt-4">
                <SecondaryButton onClick={() => setEditing(null)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={saveName} loading={busy}>
                  Save
                </PrimaryButton>
              </div>
            </>
          )}

          {editing === "bio" && (
            <>
              <FieldLabel>Bio</FieldLabel>
              <textarea
                autoFocus
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                placeholder="Tell people a little about yourself"
                className="w-full rounded-xl bg-surface border border-line text-text px-4 py-3 outline-none focus:border-wa-green transition resize-none text-sm"
              />
              <p className="text-xs text-text-faint text-right mt-1">
                {bio.length}/160
              </p>
              <ErrorMessage>{error}</ErrorMessage>
              <div className="flex gap-2 mt-4">
                <SecondaryButton onClick={() => setEditing(null)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={saveBio} loading={busy}>
                  Save
                </PrimaryButton>
              </div>
            </>
          )}

          {editing === "photo" && (
            <>
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 rounded-full overflow-hidden ring-2 ring-line bg-surface flex items-center justify-center">
                  {avatarDataUrl ? (
                    <img
                      src={avatarDataUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-semibold text-text-muted">
                      {(me?.displayName || me?.username || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SecondaryButton onClick={() => fileRef.current?.click()}>
                    {avatarDataUrl ? "Change photo" : "Choose photo"}
                  </SecondaryButton>
                  {avatarDataUrl && (
                    <SecondaryButton onClick={() => setAvatarDataUrl(null)}>
                      Remove
                    </SecondaryButton>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                  disabled={busy}
                />
                <p className="text-xs text-text-faint text-center">
                  We'll resize it to 256×256.
                </p>
              </div>
              <ErrorMessage>{error}</ErrorMessage>
              <div className="flex gap-2 mt-4">
                <SecondaryButton onClick={() => setEditing(null)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={savePhoto} loading={busy}>
                  Save
                </PrimaryButton>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function modalTitle(s: "name" | "bio" | "photo"): string {
  if (s === "name") return "Edit name";
  if (s === "bio") return "Edit bio";
  return "Profile photo";
}

/* ─────────── Change login password ─────────── */

function ChangeLoginPasswordEditor() {
  const change = trpc.auth.changePassword.useMutation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirmNext("");
    setShow(false);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!current) {
      setError("Please enter your current password.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirmNext) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from your current password.");
      return;
    }
    try {
      await change.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });
      setOkMsg("Your password has been updated successfully.");
      setOpen(false);
      reset();
      feedback.success();
    } catch (e) {
      setError(humanizeErrorMessage(e));
      feedback.error();
    }
  }

  return (
    <>
      <SettingsRow
        label="Change Your Password"
        sub={okMsg ?? "Update the password you use to sign in."}
        onClick={() => {
          reset();
          setOkMsg(null);
          setOpen(true);
        }}
      />

      {open && (
        <Modal
          title="Change Your Password"
          onClose={() => {
            setOpen(false);
            reset();
          }}
        >
          <div>
            <FieldLabel>Current password</FieldLabel>
            <TextInput
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <div className="mt-3">
            <FieldLabel>New password</FieldLabel>
            <TextInput
              type={show ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div className="mt-3">
            <FieldLabel>Confirm new password</FieldLabel>
            <TextInput
              type={show ? "text" : "password"}
              value={confirmNext}
              onChange={(e) => setConfirmNext(e.target.value)}
              placeholder="Type it again"
              autoComplete="new-password"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted mt-3">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="accent-wa-green"
            />
            Show passwords
          </label>

          <ErrorMessage>{error}</ErrorMessage>

          <div className="flex gap-2 mt-4">
            <SecondaryButton
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={save} loading={change.isPending}>
              Update password
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─────────── Daily verification password ─────────── */

function DailyPasswordEditor() {
  const set = trpc.auth.setVerificationPassword.useMutation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirmNext("");
    setShow(false);
    setError(null);
  }

  async function save() {
    setError(null);
    setOkMsg(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirmNext) {
      setError("Passwords don't match.");
      return;
    }
    try {
      // Re-encrypt the local recovery phrase under the NEW daily
      // password so the server-side encrypted backup stays in sync.
      // Without this, a future new-device login with the new daily
      // password could not decrypt the old blob.
      let encryptedRecoveryPhrase: Awaited<
        ReturnType<typeof encryptRecoveryPhraseForServer>
      > | undefined;
      try {
        const rec = await loadIdentity();
        if (rec?.recoveryPhrase) {
          encryptedRecoveryPhrase = await encryptRecoveryPhraseForServer(
            rec.recoveryPhrase,
            next,
          );
        }
      } catch {
        /* if we can't read the phrase, server will clear the blob */
      }
      await set.mutateAsync({
        currentPassword: current || undefined,
        newPassword: next,
        encryptedRecoveryPhrase,
      });
      setOkMsg("Daily verification password updated.");
      setOpen(false);
      reset();
    } catch (e) {
      setError(
        (e as { message?: string })?.message ?? "Could not update password.",
      );
    }
  }

  return (
    <>
      <SettingsRow
        label="Daily verification password"
        sub={
          okMsg ??
          "Used every 24 hours to unlock the app. Tap to change."
        }
        onClick={() => {
          reset();
          setOkMsg(null);
          setOpen(true);
        }}
      />

      {open && (
        <Modal
          title="Change daily verification password"
          onClose={() => {
            setOpen(false);
            reset();
          }}
        >
          <div>
            <FieldLabel>Current verification password</FieldLabel>
            <TextInput
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Leave blank if you never set one"
              autoComplete="current-password"
            />
          </div>

          <div className="mt-3">
            <FieldLabel>New verification password</FieldLabel>
            <TextInput
              type={show ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div className="mt-3">
            <FieldLabel>Confirm new password</FieldLabel>
            <TextInput
              type={show ? "text" : "password"}
              value={confirmNext}
              onChange={(e) => setConfirmNext(e.target.value)}
              placeholder="Type it again"
              autoComplete="new-password"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted mt-3">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="accent-wa-green"
            />
            Show passwords
          </label>

          <ErrorMessage>{error}</ErrorMessage>

          <div className="flex gap-2 mt-4">
            <SecondaryButton
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={save} loading={set.isPending}>
              Save
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─────────── Generic modal ─────────── */

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-bg border border-line p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─────────── Existing rows (unchanged) ─────────── */

/**
 * One settings row that doubles as a live status badge for Focus Mode
 * (Principle #4). When focus is active, the row turns into a calm
 * green pill that tells the user *why* it's active and *until when*,
 * so they never have to guess whether VeilChat is going to interrupt them.
 */
function FocusModeStatusRow() {
  const state = useFocusState();
  const right = state.active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-wa-green/15 text-wa-green-dark dark:text-wa-green text-[11px] font-semibold px-2.5 py-1 border border-wa-green/30">
      <span className="relative inline-flex">
        <span className="absolute inset-0 rounded-full bg-wa-green/40 animate-ping" />
        <span className="relative size-1.5 rounded-full bg-wa-green" />
      </span>
      On
    </span>
  ) : (
    <span className="text-[11.5px] text-text-faint">Off</span>
  );
  return (
    <SettingsRow
      label="Focus Mode"
      sub={
        state.active
          ? `${focusReasonLabel(state.reason)} · ${formatFocusEnds(state.endsAt)}`
          : "Quiet hours, snooze, or do-not-disturb on demand"
      }
      right={right}
      to="/focus-mode"
    />
  );
}

function PushRow() {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [perm, setPerm] = useState<NotificationPermission | "unknown">(
    supported ? Notification.permission : "unknown",
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setSubscribed(!!sub);
      } catch {
        setSubscribed(false);
      }
    })();
  }, [supported]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    const r = await ensurePushSubscription({ requestPermission: true });
    setPerm(supported ? Notification.permission : "unknown");
    if (r.state === "ok") {
      setSubscribed(true);
      setMsg("Notifications enabled.");
    } else if (r.state === "denied") {
      setMsg("Notification permission was denied. Enable it in your browser settings.");
    } else if (r.state === "not_configured") {
      setMsg("Push isn't configured on the server yet.");
    } else if (r.state === "unsupported") {
      setMsg("Your browser doesn't support web push.");
    } else {
      setMsg(r.message);
    }
    setBusy(false);
  }
  async function disable() {
    setBusy(true);
    setMsg(null);
    await disablePushSubscription();
    setSubscribed(false);
    setMsg("Notifications disabled.");
    setBusy(false);
  }

  if (!supported) {
    return (
      <div className="px-4 py-3 bg-panel">
        <div className="text-text font-medium">Push notifications</div>
        <div className="text-xs text-text-muted">
          Not supported by this browser.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-text font-medium">Push notifications</div>
          <div className="text-xs text-text-muted">
            Generic alerts only. Message contents stay on your device.
          </div>
        </div>
        {subscribed ? (
          <button
            disabled={busy}
            onClick={disable}
            className="text-sm px-3 py-1.5 rounded-full border border-line text-text hover:bg-white/5 disabled:opacity-50"
          >
            Disable
          </button>
        ) : (
          <button
            disabled={busy || perm === "denied"}
            onClick={enable}
            className="text-sm px-3 py-1.5 rounded-full bg-wa-green text-text-oncolor disabled:opacity-50"
          >
            Enable
          </button>
        )}
      </div>
      {msg && <div className="text-[11px] text-text-muted mt-2">{msg}</div>}
    </div>
  );
}

function PrivacyRows() {
  const prefs = useStealthPrefs((s) => s.prefs);
  const setPrefs = useStealthPrefs((s) => s.set);
  const hydrate = useStealthPrefs((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (!prefs) {
    return (
      <div className="px-4 py-3 bg-panel text-xs text-text-muted">Loading…</div>
    );
  }
  const rows: {
    key: keyof typeof prefs;
    label: string;
    sub: string;
  }[] = [
    {
      key: "readReceiptsEnabled",
      label: "Read receipts",
      sub: "Let people see when you've opened their messages.",
    },
    {
      key: "typingIndicatorsEnabled",
      label: "Typing indicators",
      sub: "Show others when you're composing a reply.",
    },
    {
      key: "screenshotBlurEnabled",
      label: "Blur on app switch",
      sub: "Hide content when this tab loses focus, so screenshots and app-switcher previews show only a blur.",
    },
    {
      key: "soundEnabled",
      label: "Sounds",
      sub: "Play the VeilChat 3-note send and receive motifs, plus quiet tap blips for buttons.",
    },
    {
      key: "hapticsEnabled",
      label: "Haptics",
      sub: "Short matched vibrations on send, receive and taps. Mobile devices only.",
    },
  ];
  return (
    <>
      {rows.map((r) => (
        <ToggleRow
          key={r.key}
          label={r.label}
          sub={r.sub}
          value={Boolean(prefs[r.key])}
          onChange={(v) => void setPrefs({ [r.key]: v } as Partial<typeof prefs>)}
        />
      ))}
    </>
  );
}

function LastSeenPrivacyRow() {
  const q = trpc.privacy.getLastSeenPrivacy.useQuery(undefined, {
    retry: false,
  });
  const m = trpc.privacy.setLastSeenPrivacy.useMutation({
    onSuccess: () => q.refetch(),
  });
  const value = q.data?.value ?? "contacts";
  const options: { value: "everyone" | "contacts" | "nobody"; label: string }[] = [
    { value: "everyone", label: "Everyone" },
    { value: "contacts", label: "Contacts" },
    { value: "nobody", label: "Nobody" },
  ];
  return (
    <div className="px-4 py-3 bg-panel border-b border-line/60">
      <div className="text-text font-medium">Last seen</div>
      <div className="text-xs text-text-muted mb-2">
        Choose who can see when you were last online.
      </div>
      <div className="inline-flex rounded-full bg-surface border border-line p-1">
        {options.map((o) => {
          const isActive = value === o.value;
          return (
            <button
              key={o.value}
              disabled={m.isPending || q.isLoading}
              onClick={() => m.mutate({ value: o.value })}
              className={
                "px-3 py-1.5 text-sm rounded-full transition wa-tap " +
                (isActive
                  ? "bg-wa-green text-text-oncolor shadow"
                  : "text-text-muted hover:text-text")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BlockedContactsRow() {
  const q = trpc.privacy.listBlocked.useQuery(undefined, { retry: false });
  const unblock = trpc.privacy.unblock.useMutation({
    onSuccess: () => q.refetch(),
  });
  const blocked = q.data ?? [];
  return (
    <div className="px-4 py-3 bg-panel border-b border-line/60">
      <div className="text-text font-medium">Blocked contacts</div>
      <div className="text-xs text-text-muted mb-2">
        Blocked people can't message you and you can't message them.
      </div>
      {q.isLoading ? (
        <div className="text-xs text-text-muted">Loading…</div>
      ) : blocked.length === 0 ? (
        <div className="text-xs text-text-muted">No one is blocked.</div>
      ) : (
        <ul className="space-y-1">
          {blocked.map((b) => (
            <li
              key={b.peer.id}
              className="flex items-center justify-between gap-2 bg-surface rounded-md px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-text font-mono truncate">
                  {b.peer.fingerprint || b.peer.id.slice(0, 12) + "…"}
                </div>
                <div className="text-[11px] text-text-muted">
                  Blocked {new Date(b.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                disabled={unblock.isPending}
                onClick={() => {
                  if (confirm("Unblock this contact?")) {
                    unblock.mutate({ peerId: b.peer.id });
                  }
                }}
                className="text-sm px-3 py-1 rounded-full border border-line text-text hover:bg-white/5 disabled:opacity-50"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VeilKeyboardRow() {
  const useVeilKb = useKeyboardPrefs((s) => s.useVeilKeyboard);
  const showSwitch = useKeyboardPrefs((s) => s.showComposerSwitch);
  const setPrefs = useKeyboardPrefs((s) => s.set);
  const [isCoarse] = useState(() => isCoarsePointerDevice());

  return (
    <div className="px-4 py-4 bg-panel border-b border-line/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-text font-medium flex items-center gap-2">
            <span aria-hidden>⌨️</span>
            <span>VeilChat keyboard</span>
            <span className="text-[10px] uppercase tracking-wide font-semibold text-wa-green border border-wa-green/40 rounded-full px-1.5 py-0.5">
              Beta
            </span>
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            Type with our private on-screen keyboard instead of your phone's
            default. Keystrokes never pass through a third-party keyboard
            app, so they can't be logged or sent to the cloud.
          </div>
        </div>
        <button
          role="switch"
          aria-checked={useVeilKb}
          onClick={() => {
            feedback.success();
            setPrefs({ useVeilKeyboard: !useVeilKb });
          }}
          className={
            "shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full wa-tap " +
            (useVeilKb ? "bg-wa-green" : "bg-line")
          }
        >
          <span
            className={
              "inline-block size-5 rounded-full bg-white shadow transform transition-transform duration-180 ease-veil-spring " +
              (useVeilKb ? "translate-x-5" : "translate-x-0.5")
            }
          />
        </button>
      </div>

      {/* Sub-row: per-chat switch toggle. Hidden until master is on. */}
      {useVeilKb && (
        <div className="mt-3 flex items-start justify-between gap-3 pl-7">
          <div className="min-w-0">
            <div className="text-text text-sm">Quick switch in composer</div>
            <div className="text-xs text-text-muted">
              Show a small ⌨ button in each chat so you can flip back to your
              system keyboard for one chat at a time.
            </div>
          </div>
          <button
            role="switch"
            aria-checked={showSwitch}
            onClick={() => {
              feedback.tap();
              setPrefs({ showComposerSwitch: !showSwitch });
            }}
            className={
              "shrink-0 mt-0.5 inline-flex h-5 w-9 items-center rounded-full wa-tap " +
              (showSwitch ? "bg-wa-green" : "bg-line")
            }
          >
            <span
              className={
                "inline-block size-4 rounded-full bg-white shadow transform transition-transform duration-180 ease-veil-spring " +
                (showSwitch ? "translate-x-4" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      )}

      {/* Helpful disclosure when there's no touch input */}
      {!isCoarse && (
        <div className="mt-2 text-[11px] text-text-faint">
          On this device the VeilChat keyboard opens as a click-to-type panel
          inside each chat — your physical keyboard keeps working, so you
          can mix mouse-clicks and key presses for sensitive characters.
        </div>
      )}
    </div>
  );
}

/**
 * Opt-in for the public "Discover people" directory. Defaults to off
 * for every account — users only show up after explicitly flipping
 * this on. Toggling it off removes them from the directory immediately
 * (the server filters by this column on every list query).
 */
function DiscoverabilityRow() {
  const q = trpc.discover.getDiscoverability.useQuery(undefined, {
    retry: false,
  });
  const utils = trpc.useUtils();
  const m = trpc.discover.setDiscoverability.useMutation({
    onSuccess: () => {
      void utils.discover.getDiscoverability.invalidate();
    },
  });
  // Optimistic local view so the toggle feels instant.
  const value = m.isPending
    ? Boolean(m.variables?.enabled)
    : (q.data?.enabled ?? false);
  return (
    <ToggleRow
      label="Show me in Discover people"
      sub="When on, anyone on VeilChat can find your profile and send you a chat request. You'll still need to confirm each request."
      value={value}
      onChange={(v) => m.mutate({ enabled: v })}
    />
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="px-4 py-3 bg-panel border-b border-line/60 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-text font-medium">{label}</div>
        <div className="text-xs text-text-muted">{sub}</div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => {
          // Soft success ack — the tactile "click" you'd want from a
          // physical toggle, plus a tiny haptic on mobile.
          feedback.success();
          onChange(!value);
        }}
        className={
          "shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full wa-tap " +
          (value ? "bg-wa-green" : "bg-line")
        }
      >
        <span
          className={
            "inline-block size-5 rounded-full bg-white shadow transform transition-transform duration-180 ease-veil-spring " +
            (value ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}

function ThemeRow() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div className="px-4 py-4 border-b border-line/60">
      <div className="font-medium text-text mb-1">Theme</div>
      <div className="text-xs text-text-muted mb-3">
        VeilChat always opens in the Light theme. Pick a different palette below if
        you'd like — we'll remember your choice on this device.
      </div>

      {/* Theme card grid */}
      <div className="grid grid-cols-2 gap-2">
        {THEME_META.map((t) => {
          const isActive = mode === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setMode(t.value)}
              className={
                "flex flex-col items-start gap-2 rounded-xl border p-3 text-left wa-tap transition " +
                (isActive
                  ? "border-wa-green ring-2 ring-wa-green/30 bg-surface"
                  : "border-line bg-surface hover:border-text-muted/40")
              }
              aria-pressed={isActive}
            >
              <div className="w-full flex items-center justify-between">
                <span className="flex -space-x-1.5">
                  {t.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="size-5 rounded-full border-2 border-surface shadow-sm"
                      style={{ background: c }}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                {isActive && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-wa-green">
                    Active
                  </span>
                )}
              </div>
              <span className="block">
                <span className="block text-sm font-medium text-text">
                  {t.label}
                </span>
                <span className="block text-[11px] text-text-muted leading-tight">
                  {t.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WallpaperRow() {
  const pref = useWallpaperStore((s) => s.pref);
  const setPref = useWallpaperStore((s) => s.setPref);
  const reset = useWallpaperStore((s) => s.reset);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewStyle = useMemo(() => getWallpaperStyle(pref), [pref]);

  const kindOptions: { value: WallpaperKind; label: string; hint: string }[] = [
    { value: "default", label: "Plain", hint: "No pattern" },
    { value: "solid", label: "Solid", hint: "Flat color" },
    { value: "dots", label: "Dotted", hint: "Pick the dot color" },
    { value: "image", label: "Image", hint: "Upload your own" },
  ];

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPref({ kind: "image", imageData: dataUrl });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Couldn't save that image. Try a smaller one.";
      setError(msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="px-4 py-4 border-b border-line/60">
      <div className="font-medium text-text mb-1">Chat wallpaper</div>
      <div className="text-xs text-text-muted mb-3">
        Customize the background behind your messages. Stored only on this
        device.
      </div>

      {/* Preview — shows the current wallpaper with two sample bubbles */}
      <div
        className="relative h-28 rounded-xl border border-line overflow-hidden mb-3"
        style={previewStyle}
        aria-label="Wallpaper preview"
      >
        <div className="absolute left-3 top-3 max-w-[55%] rounded-lg rounded-tl-sm bg-wa-bubble-in text-text text-xs px-2.5 py-1.5 shadow-bubble">
          Hey there 👋
        </div>
        <div className="absolute right-3 bottom-3 max-w-[55%] rounded-lg rounded-br-sm bg-wa-bubble-out text-text text-xs px-2.5 py-1.5 shadow-bubble">
          Looking good!
        </div>
      </div>

      {/* Kind segmented control */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {kindOptions.map((o) => {
          const isActive = pref.kind === o.value;
          return (
            <button
              key={o.value}
              onClick={() => {
                setError(null);
                if (o.value === "image") {
                  fileInputRef.current?.click();
                } else if (o.value === "solid") {
                  setPref({ kind: "solid", color: pref.color ?? SOLID_PALETTE[0]!.value });
                } else if (o.value === "dots") {
                  setPref({ kind: "dots", color: pref.color ?? DOT_PALETTE[0]!.value });
                } else {
                  setPref({ kind: "default" });
                }
              }}
              className={
                "flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 border text-center wa-tap transition " +
                (isActive
                  ? "border-wa-green bg-wa-green-soft/40 text-text"
                  : "border-line bg-surface text-text-muted hover:text-text")
              }
              aria-pressed={isActive}
            >
              <span className="text-xs font-medium leading-tight">
                {o.label}
              </span>
              <span className="text-[10px] text-text-faint leading-tight">
                {o.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hidden file input — triggered by the "Image" segmented button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Per-kind controls */}
      {pref.kind === "solid" && (
        <ColorSwatchPicker
          options={SOLID_PALETTE}
          selected={pref.color}
          onPick={(c) => setPref({ kind: "solid", color: c })}
        />
      )}

      {pref.kind === "dots" && (
        <ColorSwatchPicker
          options={DOT_PALETTE}
          selected={pref.color}
          onPick={(c) => setPref({ kind: "dots", color: c })}
        />
      )}

      {pref.kind === "image" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface text-text hover:bg-elevated wa-tap disabled:opacity-60"
          >
            {pref.imageData ? "Replace image" : "Choose image…"}
          </button>
          {pref.imageData && (
            <button
              onClick={() => reset()}
              className="text-xs px-3 py-1.5 rounded-full text-text-muted hover:text-text wa-tap"
            >
              Remove
            </button>
          )}
          {busy && (
            <span className="text-[11px] text-text-muted">Processing…</span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-[11px] text-red-500" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function ColorSwatchPicker({
  options,
  selected,
  onPick,
}: {
  options: { value: string; label: string }[];
  selected: string | undefined;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isActive =
          (selected ?? "").toLowerCase() === o.value.toLowerCase();
        return (
          <button
            key={o.value}
            onClick={() => onPick(o.value)}
            title={o.label}
            aria-label={o.label}
            aria-pressed={isActive}
            className={
              "size-8 rounded-full border-2 wa-tap transition " +
              (isActive
                ? "border-wa-green ring-2 ring-wa-green/30"
                : "border-line hover:border-text-muted/60")
            }
            style={{ background: o.value }}
          />
        );
      })}
    </div>
  );
}
