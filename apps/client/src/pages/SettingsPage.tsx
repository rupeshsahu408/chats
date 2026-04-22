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
