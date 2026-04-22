import { useEffect, useState } from "react";
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
} from "../components/Layout";
import { MainShell } from "../components/MainShell";
import { useThemeStore, type ThemeMode } from "../lib/themeStore";
import { ensurePushSubscription, disablePushSubscription } from "../lib/push";
import { clearIdentity } from "../lib/db";
import { useStealthPrefs } from "../lib/stealthPrefs";

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

  return (
    <MainShell active="settings" title="Settings">
      <div className="bg-panel">
        {/* Profile header */}
        <div className="flex items-center gap-4 px-4 py-5 border-b border-line">
          <Avatar seed={user?.id ?? "self"} size={64} />
          <div className="min-w-0">
            <div className="font-semibold text-text text-lg truncate">
              Your account
            </div>
            <div className="text-xs text-text-muted truncate font-mono">
              {user?.id ?? "—"}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Pill tone="accent">{user?.accountType ?? "—"}</Pill>
              {identity ? (
                <Pill tone="ok">unlocked</Pill>
              ) : (
                <Pill tone="warn">locked</Pill>
              )}
            </div>
          </div>
        </div>

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
