import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { ScheduledMessagesSheet } from "../components/ScheduledMessagesSheet";
import { useThemeStore, type ThemeMode } from "../lib/themeStore";
import { ensurePushSubscription, disablePushSubscription } from "../lib/push";
import { clearIdentity, loadIdentity } from "../lib/db";
import { useStealthPrefs } from "../lib/stealthPrefs";
import { resizeAvatarToDataUrl } from "../lib/avatar";

export function SettingsPage() {
  const navigate = useNavigate();
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
    if (!confirm("Log out of Veil on this browser?")) return;
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
  const sub = me?.username ? `@${me.username}` : null;

  return (
    <MainShell active="settings" title="Settings">
      <div className="bg-panel">
        {/* Profile header */}
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
            {sub && (
              <div className="text-sm text-text-muted truncate">{sub}</div>
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

        <SectionHeader>Profile</SectionHeader>
        <UsernameRow username={me?.username ?? null} />
        <ProfileEditor />

        <SectionHeader>Security</SectionHeader>
        <DailyPasswordEditor />
        <RecoveryKeyRow username={me?.username ?? null} />

        <SectionHeader>Appearance</SectionHeader>
        <ThemeRow />

        <SectionHeader>Privacy</SectionHeader>
        <PrivacyRows />
        <LastSeenPrivacyRow />
        <BlockedContactsRow />

        <SectionHeader>Notifications</SectionHeader>
        <PushRow />

        <SectionHeader>Account</SectionHeader>
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
        {meQuery.data && (
          <SettingsRow
            label="Member since"
            sub={new Date(meQuery.data.createdAt).toLocaleDateString()}
          />
        )}

        <SectionHeader>Session</SectionHeader>
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

        {meQuery.error && (
          <div className="p-4">
            <ErrorMessage>{meQuery.error.message}</ErrorMessage>
          </div>
        )}

        <p className="text-[11px] text-text-faint text-center py-6 px-6 leading-relaxed">
          Veil · End-to-end encrypted messaging.
          <br />
          Sessions stay signed in for 90 days. PIN once per browser.
        </p>
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
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);

  async function openModal() {
    setReveal(false);
    setCopied(false);
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

  function downloadFile() {
    if (!phrase) return;
    const handle = username ? `@${username}` : "your account";
    const text =
      `Veil recovery key for ${handle}\n\n` +
      `${phrase}\n\n` +
      `Keep this file in a safe place — anyone with these 12 words can ` +
      `log in to your Veil account from any device.\n` +
      `Generated ${new Date().toLocaleString()}.\n`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veil-recovery-${username ?? "account"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyPhrase() {
    if (!phrase) return;
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <SettingsRow
        label="Recovery key"
        sub="Download your 12-word backup. You'll need it to log in on a new device."
        onClick={openModal}
      />
      {open && (
        <Modal
          title="Recovery key"
          onClose={() => {
            setOpen(false);
            setReveal(false);
          }}
        >
          {unsupported ? (
            <div className="space-y-3">
              <p className="text-sm text-text">
                Your recovery key isn't stored on this device.
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                If this is a Random ID account, sign in once with your 12-word
                phrase and we'll save a copy here so you can re-download it
                from this screen later. PIN-protected accounts don't have a
                recovery phrase.
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
                These 12 words are the master key to your account. Anyone with
                them can log in as you. Store the file somewhere only you can
                reach.
              </p>

              <div className="relative">
                <div
                  className={
                    "grid grid-cols-3 gap-2 p-3 rounded-xl bg-surface border border-line text-sm font-mono leading-relaxed select-text " +
                    (reveal ? "" : "blur-md pointer-events-none")
                  }
                >
                  {phrase.split(" ").map((w, i) => (
                    <div key={i} className="flex gap-1.5">
                      <span className="text-text-faint w-5 text-right">
                        {i + 1}.
                      </span>
                      <span className="text-text">{w}</span>
                    </div>
                  ))}
                </div>
                {!reveal && (
                  <button
                    onClick={() => setReveal(true)}
                    className="absolute inset-0 rounded-xl flex items-center justify-center text-sm text-text bg-bg/30 hover:bg-bg/40 wa-tap"
                  >
                    Tap to reveal
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <PrimaryButton onClick={downloadFile}>
                  Download .txt
                </PrimaryButton>
                <SecondaryButton onClick={copyPhrase}>
                  {copied ? "Copied!" : "Copy to clipboard"}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => {
                    setOpen(false);
                    setReveal(false);
                  }}
                >
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
      await set.mutateAsync({
        currentPassword: current || undefined,
        newPassword: next,
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
        onClick={() => onChange(!value)}
        className={
          "shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition wa-tap " +
          (value ? "bg-wa-green" : "bg-line")
        }
      >
        <span
          className={
            "inline-block size-5 rounded-full bg-white shadow transform transition " +
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
  const options: { value: ThemeMode; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  return (
    <div className="px-4 py-3 border-b border-line/60">
      <div className="font-medium text-text mb-1">Theme</div>
      <div className="text-xs text-text-muted mb-3">
        Match your system or pick a fixed appearance.
      </div>
      <div className="inline-flex rounded-full bg-surface border border-line p-1">
        {options.map((o) => {
          const isActive = mode === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setMode(o.value)}
              className={
                "px-4 py-1.5 text-sm rounded-full transition wa-tap " +
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
