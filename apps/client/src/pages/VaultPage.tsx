import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { useUnlockStore } from "../lib/unlockStore";
import { useVaultStore } from "../lib/vaultStore";
import {
  AppBar,
  ChatListRow,
  EmptyState,
  IconButton,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
  Spinner,
  Avatar,
  LockIcon,
} from "../components/Layout";
import { peerLabel } from "../lib/peerLabel";
import {
  biometricSupported,
  registerBiometricCredential,
  verifyBiometric,
} from "../lib/biometric";
import { usePeersPresence } from "../lib/usePeersPresence";

/**
 * The Vault — a biometric-locked private space for hidden chats.
 *
 * Three states it can be in:
 *   1. Not enrolled (`vaultEnabled === false`) — show a hero pitch and
 *      a "Set up your Vault" button that registers a platform
 *      WebAuthn credential.
 *   2. Enrolled but session-locked — show a calm lock screen and a
 *      single "Unlock with biometrics" button.
 *   3. Unlocked — show the list of vaulted chats and a "+ Add chats"
 *      button that opens the connections picker.
 *
 * The vault re-locks automatically when the tab is closed (the
 * unlocked flag lives only in `vaultStore`, never persisted).
 */
export function VaultPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const identity = useUnlockStore((s) => s.identity);
  const unlocked = useVaultStore((s) => s.unlocked);
  const setUnlocked = useVaultStore((s) => s.unlock);
  const lockVault = useVaultStore((s) => s.lock);

  const userPrefs = useLiveQuery(() => db.userPrefs.get("self"), [], undefined);
  const allChatPrefs = useLiveQuery(() => db.chatPrefs.toArray(), [], []);
  const connections = trpc.connections.list.useQuery(undefined, {
    enabled: !!accessToken,
    retry: false,
  });

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  const vaultEnabled = userPrefs?.vaultEnabled === true;
  const vaultCredentialId = userPrefs?.vaultCredentialId ?? null;

  const vaultedPeers = useMemo(() => {
    const set = new Set<string>();
    for (const p of allChatPrefs ?? []) if (p.vaulted) set.add(p.peerId);
    return set;
  }, [allChatPrefs]);

  const vaultedConns = useMemo(() => {
    return (connections.data ?? []).filter((c) => vaultedPeers.has(c.peer.id));
  }, [connections.data, vaultedPeers]);

  const vaultedPeerIds = useMemo(
    () => vaultedConns.map((c) => c.peer.id),
    [vaultedConns],
  );
  const { isOnline } = usePeersPresence(unlocked ? vaultedPeerIds : []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [enrollErr, setEnrollErr] = useState<string | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEnroll() {
    setEnrollErr(null);
    if (!biometricSupported()) {
      setEnrollErr(
        "This browser doesn't support biometric authentication. Try a recent version of Safari, Chrome, or Edge on a device with Touch ID, Face ID, Windows Hello, or a security key.",
      );
      return;
    }
    setBusy(true);
    try {
      const credentialId = await registerBiometricCredential(
        identity?.userId ? `vault:${identity.userId}` : "vault:self",
        "Veil Vault",
      );
      await db.userPrefs.put({
        id: "self",
        readReceiptsEnabled: userPrefs?.readReceiptsEnabled ?? true,
        typingIndicatorsEnabled: userPrefs?.typingIndicatorsEnabled ?? true,
        screenshotBlurEnabled: userPrefs?.screenshotBlurEnabled ?? true,
        appLockEnabled: userPrefs?.appLockEnabled ?? false,
        soundEnabled: userPrefs?.soundEnabled,
        hapticsEnabled: userPrefs?.hapticsEnabled,
        vaultEnabled: true,
        vaultCredentialId: credentialId,
        updatedAt: new Date().toISOString(),
      });
      setUnlocked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't register biometrics.";
      setEnrollErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setVerifyErr(null);
    if (!vaultCredentialId) return;
    setBusy(true);
    try {
      const ok = await verifyBiometric(vaultCredentialId);
      if (ok) setUnlocked();
      else setVerifyErr("Authentication didn't complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /* ─────────── render ─────────── */

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar
        title="Vault"
        back={() => navigate(-1)}
        right={
          vaultEnabled && unlocked ? (
            <IconButton
              label="Lock vault"
              onClick={lockVault}
              className="text-text-oncolor"
            >
              <LockIcon />
            </IconButton>
          ) : undefined
        }
      />

      {!vaultEnabled ? (
        <VaultIntro busy={busy} onEnroll={handleEnroll} error={enrollErr} />
      ) : !unlocked ? (
        <VaultLockScreen
          busy={busy}
          onUnlock={handleUnlock}
          error={verifyErr}
        />
      ) : (
        <div className="bg-panel flex-1 animate-fade-in">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-text">
                Hidden chats
              </div>
              <div className="text-[12px] text-text-muted mt-0.5">
                Visible only to you, only on this device.
              </div>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="text-[13px] font-semibold text-wa-green wa-tap"
            >
              + Add chats
            </button>
          </div>

          {connections.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : vaultedConns.length === 0 ? (
            <EmptyState
              icon={<LockIcon />}
              title="Your vault is empty"
              message="Add any chat to keep it out of the main inbox. Hidden chats stay encrypted and synced — they just don't appear anywhere else."
              action={
                <PrimaryButton onClick={() => setPickerOpen(true)}>
                  Add chats to vault
                </PrimaryButton>
              }
            />
          ) : (
            vaultedConns.map((conn) => (
              <ChatListRow
                key={conn.id}
                to={`/chats/${conn.peer.id}`}
                seed={conn.peer.username || conn.peer.id}
                avatarSrc={conn.peer.avatarDataUrl ?? null}
                online={isOnline(conn.peer.id)}
                title={
                  <span className="text-sm">{peerLabel(conn.peer)}</span>
                }
                subtitle={
                  <span className="italic text-text-faint">
                    Hidden · biometric-locked
                  </span>
                }
                right={
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await setChatVaulted(conn.peer.id, false);
                    }}
                    className="text-[11px] font-semibold text-text-muted hover:text-text px-2 py-1 rounded-full border border-line/70 hover:border-line wa-tap"
                  >
                    Remove
                  </button>
                }
              />
            ))
          )}

          <div className="px-4 py-6 text-[11.5px] text-text-faint leading-relaxed">
            <span className="font-semibold text-text-muted">Tip — </span>
            The vault re-locks automatically when you close this tab. Anyone
            who picks up your phone won't see the chats inside without your
            biometric.
          </div>
        </div>
      )}

      {pickerOpen && (
        <VaultPickerSheet
          allConns={connections.data ?? []}
          vaultedPeers={vaultedPeers}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ────────── helpers + sub-components ────────── */

async function setChatVaulted(peerId: string, vaulted: boolean) {
  const prev = await db.chatPrefs.get(peerId);
  await db.chatPrefs.put({
    peerId,
    ttlSeconds: prev?.ttlSeconds,
    seenTtlSeconds: prev?.seenTtlSeconds,
    viewOnceDefault: prev?.viewOnceDefault,
    biometricCredentialId: prev?.biometricCredentialId,
    pinnedToTop: prev?.pinnedToTop,
    mutedUntil: prev?.mutedUntil,
    linkPreviewsEnabled: prev?.linkPreviewsEnabled,
    vaulted,
    updatedAt: new Date().toISOString(),
  });
}

function VaultIntro({
  busy,
  onEnroll,
  error,
}: {
  busy: boolean;
  onEnroll: () => void;
  error: string | null;
}) {
  return (
    <div className="bg-panel flex-1 flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
      <div
        className={
          "size-20 rounded-3xl bg-gradient-to-b from-wa-green to-wa-green-dark " +
          "flex items-center justify-center text-text-oncolor mb-6 " +
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.2),0_14px_40px_rgba(0,168,132,0.30)]"
        }
      >
        <LockIcon className="size-8" />
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight text-text">
        A private space for hidden chats
      </h2>
      <p className="mt-3 text-[14px] text-text-muted leading-relaxed max-w-sm">
        Move sensitive conversations into the Vault and they disappear from
        your main chat list. Only you, with your fingerprint or face, can open
        them again.
      </p>

      <ul className="mt-7 w-full max-w-sm text-left space-y-3 text-[13.5px] text-text">
        <VaultBullet>
          Hidden chats don't appear in your inbox or notifications previews.
        </VaultBullet>
        <VaultBullet>
          Re-locks automatically when you close this tab.
        </VaultBullet>
        <VaultBullet>
          Uses your device's biometrics — Veil never sees your fingerprint.
        </VaultBullet>
      </ul>

      <div className="mt-8 w-full max-w-sm">
        <PrimaryButton loading={busy} onClick={onEnroll}>
          Set up your vault
        </PrimaryButton>
        {error && (
          <div className="mt-3">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </div>
    </div>
  );
}

function VaultBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-[3px] size-4 shrink-0 rounded-full bg-wa-green/15 text-wa-green grid place-items-center text-[10px] font-bold">
        ✓
      </span>
      <span className="text-text-muted leading-relaxed">{children}</span>
    </li>
  );
}

function VaultLockScreen({
  busy,
  onUnlock,
  error,
}: {
  busy: boolean;
  onUnlock: () => void;
  error: string | null;
}) {
  // Auto-prompt once on first arrival — feels more like iOS unlock.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!busy) onUnlock();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-panel flex-1 flex flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
      <div
        className={
          "size-20 rounded-full bg-surface border border-line/70 " +
          "flex items-center justify-center text-text mb-6 " +
          "[box-shadow:0_1px_2px_rgba(11,20,26,0.06),0_10px_30px_rgba(11,20,26,0.06)]"
        }
      >
        <LockIcon className="size-8" />
      </div>
      <h2 className="text-[20px] font-semibold tracking-tight text-text">
        Vault is locked
      </h2>
      <p className="mt-2 text-[13.5px] text-text-muted max-w-xs">
        Authenticate to view your hidden chats.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <PrimaryButton loading={busy} onClick={onUnlock}>
          Unlock with biometrics
        </PrimaryButton>
        {error && (
          <div className="mt-3">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnLite {
  id: string;
  peer: {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarDataUrl?: string | null;
  };
}

function VaultPickerSheet({
  allConns,
  vaultedPeers,
  onClose,
}: {
  allConns: ConnLite[];
  vaultedPeers: Set<string>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Only show chats that aren't already in the vault.
  const candidates = useMemo(
    () => allConns.filter((c) => !vaultedPeers.has(c.peer.id)),
    [allConns, vaultedPeers],
  );

  function toggle(peerId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      return next;
    });
  }

  async function commit() {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const peerId of selected) {
        await setChatVaulted(peerId, true);
      }
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-panel w-full rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-line/50">
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-text">
              Add chats to vault
            </div>
            <div className="text-[12px] text-text-muted mt-0.5">
              {selected.size > 0
                ? `${selected.size} selected`
                : "Tap to select chats to hide"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[13px] font-semibold text-text-muted wa-tap px-2 py-1"
          >
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="px-6 py-10 text-center text-[13px] text-text-muted">
              All your chats are already in the vault.
            </div>
          ) : (
            candidates.map((c) => {
              const isSel = selected.has(c.peer.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.peer.id)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-3 text-left wa-tap " +
                    "border-b border-line/40 last:border-b-0 " +
                    (isSel
                      ? "bg-wa-green/8"
                      : "hover:bg-surface/70")
                  }
                >
                  <Avatar
                    seed={c.peer.username || c.peer.id}
                    src={c.peer.avatarDataUrl ?? null}
                    size={42}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-medium tracking-tight text-text truncate">
                      {c.peer.displayName ||
                        (c.peer.username ? "@" + c.peer.username : c.peer.id)}
                    </div>
                  </div>
                  <span
                    className={
                      "size-6 rounded-full grid place-items-center text-[12px] font-bold " +
                      (isSel
                        ? "bg-wa-green text-text-oncolor"
                        : "border border-line/80 text-text-faint")
                    }
                  >
                    {isSel ? "✓" : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-line/50 grid grid-cols-2 gap-3">
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton
            loading={saving}
            onClick={commit}
            className={selected.size === 0 ? "opacity-60" : ""}
          >
            {selected.size === 0
              ? "Done"
              : `Hide ${selected.size} chat${selected.size === 1 ? "" : "s"}`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
