import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { trpc } from "../lib/trpc";
import { useAuthStore } from "../lib/store";
import { toast } from "../lib/toast";
import {
  db,
  setChatPref,
  type ChatPrefRecord,
} from "../lib/db";
import { ChatWallpaperSheet } from "./ChatWallpaperSheet";
import { ChatPersonalitySheet } from "./ChatPersonalitySheet";
import { ReportDialog } from "./ReportDialog";
import { ErrorMessage, Spinner } from "./Layout";
import {
  biometricSupported,
  registerBiometricCredential,
} from "../lib/biometric";
import { safetyNumberFromB64 } from "../lib/safetyNumber";
import { SafetyArt, formatSafetyRows } from "../lib/safetyArt";
import { TTL_OPTIONS } from "../pages/ChatThreadPage";

/**
 * Per-contact settings panel embedded in the contact's profile page.
 *
 * These options used to live in the chat-header three-dot menu. We
 * promoted them here so the menu can stay slim and so each setting
 * gets a more readable, organised home next to the contact's identity.
 */
export function ChatContactSettings({
  peerId,
  peerLabel,
}: {
  peerId: string;
  peerLabel: string;
}) {
  const myId = useAuthStore((s) => s.user?.id) ?? "";
  const utils = trpc.useUtils();

  const chatPref = useLiveQuery(
    () => db.chatPrefs.get(peerId),
    [peerId],
    undefined as ChatPrefRecord | undefined,
  );

  const ttlSeconds = chatPref?.ttlSeconds ?? 0;
  const seenTtlSeconds = chatPref?.seenTtlSeconds ?? 0;
  const viewOnceDefault = chatPref?.viewOnceDefault ?? false;
  const linkPreviewsEnabled = chatPref?.linkPreviewsEnabled !== false;
  const biometricCredentialId = chatPref?.biometricCredentialId;
  const pinnedToTop = !!chatPref?.pinnedToTop;
  const mutedUntilIso = chatPref?.mutedUntil ?? "";
  const isMuted =
    !!mutedUntilIso && new Date(mutedUntilIso).getTime() > Date.now();

  const blockStatus = trpc.privacy.isBlocked.useQuery(
    { peerId },
    { retry: false },
  );
  const blockedByMe = !!blockStatus.data?.blockedByMe;

  const blockMutation = trpc.privacy.block.useMutation({
    onSuccess: () => {
      void utils.privacy.isBlocked.invalidate({ peerId });
      void utils.privacy.listBlocked.invalidate();
    },
  });
  const unblockMutation = trpc.privacy.unblock.useMutation({
    onSuccess: () => {
      void utils.privacy.isBlocked.invalidate({ peerId });
      void utils.privacy.listBlocked.invalidate();
    },
  });
  const reportMutation = trpc.privacy.report.useMutation();

  type Sheet =
    | null
    | "ttl"
    | "seenTtl"
    | "snooze"
    | "wallpaper"
    | "personality"
    | "safety"
    | "report";
  const [openSheet, setOpenSheet] = useState<Sheet>(null);

  const ttlLabel = TTL_OPTIONS.find((o) => o.seconds === ttlSeconds)?.label ?? "Off";
  const seenTtlLabel = seenTtlSeconds > 0 ? formatSeenTtl(seenTtlSeconds) : "Off";
  const muteLabel = isMuted
    ? `Muted until ${new Date(mutedUntilIso).toLocaleString()}`
    : "On";

  async function onToggleBiometric() {
    if (biometricCredentialId) {
      if (!confirm("Remove biometric lock from this chat?")) return;
      await setChatPref(peerId, { biometricCredentialId: undefined });
      return;
    }
    if (!biometricSupported()) {
      toast.warning("Biometric unlock isn't supported on this device.", {
        title: "Not supported",
      });
      return;
    }
    try {
      const credId = await registerBiometricCredential(`veil:${peerId}`, peerLabel);
      await setChatPref(peerId, { biometricCredentialId: credId });
      toast.success("Biometric lock enabled for this chat.");
    } catch (e) {
      toast.error(e, { title: "Couldn't enable biometric lock" });
    }
  }

  function onToggleBlock() {
    if (blockedByMe) {
      if (!confirm(`Unblock ${peerLabel}?`)) return;
      unblockMutation.mutate({ peerId });
    } else {
      if (
        !confirm(
          `Block ${peerLabel}? They won't be able to send you messages and you won't be able to send them messages.`,
        )
      )
        return;
      blockMutation.mutate({ peerId });
    }
  }

  return (
    <>
      {/* Notifications & visibility */}
      <Section title="Notifications">
        <ToggleRow
          label="Pin chat to top"
          sub={pinnedToTop ? "Stays at the top of your chats" : "Off"}
          checked={pinnedToTop}
          onChange={() =>
            void setChatPref(peerId, { pinnedToTop: !pinnedToTop })
          }
        />
        <ToggleRow
          label="Notifications"
          sub={muteLabel}
          checked={!isMuted}
          onChange={() => {
            if (isMuted) {
              void setChatPref(peerId, { mutedUntil: "" });
            } else {
              setOpenSheet("snooze");
            }
          }}
        />
      </Section>

      {/* Chat appearance */}
      <Section title="Chat appearance">
        <NavRow
          label="Wallpaper"
          sub="Personalize the background"
          onClick={() => setOpenSheet("wallpaper")}
        />
        <NavRow
          label="Customize chat"
          sub="Accent color, sound, mood"
          onClick={() => setOpenSheet("personality")}
        />
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <NavRow
          label="Disappearing messages"
          sub={ttlLabel}
          onClick={() => setOpenSheet("ttl")}
        />
        <NavRow
          label="Auto-delete after seen"
          sub={seenTtlLabel}
          onClick={() => setOpenSheet("seenTtl")}
        />
        <ToggleRow
          label="View-once images by default"
          sub="New images you send disappear after one view"
          checked={viewOnceDefault}
          onChange={() =>
            void setChatPref(peerId, { viewOnceDefault: !viewOnceDefault })
          }
        />
        <ToggleRow
          label="Link previews"
          sub="Show preview cards for URLs you send"
          checked={linkPreviewsEnabled}
          onChange={() =>
            void setChatPref(peerId, {
              linkPreviewsEnabled: !linkPreviewsEnabled,
            })
          }
        />
      </Section>

      {/* Security */}
      <Section title="Security">
        <NavRow
          label="Verify safety number"
          sub="Confirm you're talking to the right person"
          onClick={() => setOpenSheet("safety")}
        />
        <ToggleRow
          label="Lock chat with biometrics"
          sub={
            biometricCredentialId
              ? "On — unlock required to open this chat"
              : "Off"
          }
          checked={!!biometricCredentialId}
          onChange={onToggleBiometric}
        />
      </Section>

      {/* Manage contact (danger zone) */}
      <Section title="Manage contact">
        <ActionRow
          label={blockedByMe ? "Unblock contact" : "Block contact"}
          sub={
            blockedByMe
              ? "Allow messages from this person again"
              : "They won't be able to message you"
          }
          onClick={onToggleBlock}
          danger={!blockedByMe}
        />
        <ActionRow
          label="Report contact"
          sub="Send a confidential report to VeilChat"
          onClick={() => setOpenSheet("report")}
          danger
        />
      </Section>

      {/* ───── Sub-sheets ───── */}

      {openSheet === "snooze" && (
        <SnoozeSheet
          peerLabel={peerLabel}
          onClose={() => setOpenSheet(null)}
          onPick={(untilIso) => {
            void setChatPref(peerId, { mutedUntil: untilIso });
            setOpenSheet(null);
          }}
        />
      )}
      {openSheet === "ttl" && (
        <TTLPicker
          current={ttlSeconds}
          onClose={() => setOpenSheet(null)}
          onPick={(secs) => {
            void setChatPref(peerId, { ttlSeconds: secs });
            setOpenSheet(null);
          }}
        />
      )}
      {openSheet === "seenTtl" && (
        <SeenTTLPicker
          current={seenTtlSeconds}
          onClose={() => setOpenSheet(null)}
          onPick={(secs) => {
            void setChatPref(peerId, { seenTtlSeconds: secs });
            setOpenSheet(null);
          }}
        />
      )}
      {openSheet === "wallpaper" && (
        <ChatWallpaperSheet
          scope={{ type: "dm", peerId }}
          chatLabel={peerLabel}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === "personality" && (
        <ChatPersonalitySheet
          peerId={peerId}
          chatLabel={peerLabel}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === "safety" && (
        <SafetyNumberDialog
          myId={myId}
          peerId={peerId}
          peerLabel={peerLabel}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === "report" && (
        <ReportDialog
          peerLabel={peerLabel}
          onClose={() => setOpenSheet(null)}
          onSubmit={async (reason, note, alsoBlock) => {
            await reportMutation.mutateAsync({
              peerId,
              reason,
              note: note || undefined,
              alsoBlock,
            });
            setOpenSheet(null);
            toast.success("Report submitted. Thank you.", {
              title: "Got it",
            });
          }}
        />
      )}
    </>
  );
}

/* ───────────────────────── Building blocks ───────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-panel border-b border-line mt-2">
      <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function NavRow({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 text-left border-t border-line/50 first:border-t-0 hover:bg-elevated/50 active:bg-elevated wa-tap"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text">{label}</span>
        {sub && (
          <span className="block text-[12px] text-text-muted mt-0.5 truncate">
            {sub}
          </span>
        )}
      </span>
      <svg
        viewBox="0 0 24 24"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-muted shrink-0"
        aria-hidden
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full px-4 py-3 flex items-center gap-3 text-left border-t border-line/50 first:border-t-0 hover:bg-elevated/50 active:bg-elevated wa-tap"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text">{label}</span>
        {sub && (
          <span className="block text-[12px] text-text-muted mt-0.5 truncate">
            {sub}
          </span>
        )}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        className={
          "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors " +
          (checked ? "bg-wa-green" : "bg-line")
        }
      >
        <span
          className={
            "inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-[18px]" : "translate-x-[2px]")
          }
        />
      </span>
    </button>
  );
}

function ActionRow({
  label,
  sub,
  onClick,
  danger,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full px-4 py-3 flex items-center gap-3 text-left border-t border-line/50 first:border-t-0 hover:bg-elevated/50 active:bg-elevated wa-tap " +
        (danger ? "text-red-400" : "text-text")
      }
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm">{label}</span>
        {sub && (
          <span
            className={
              "block text-[12px] mt-0.5 truncate " +
              (danger ? "text-red-400/70" : "text-text-muted")
            }
          >
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

/* ───────────────────────── Local sheet primitives ───────────────────────── */

function Sheet({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-panel w-full sm:max-w-md md:max-w-lg rounded-t-2xl sm:rounded-2xl border border-line overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-4 pt-4 pb-2 font-semibold text-text">{title}</div>
        )}
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  checked,
}: {
  label: string;
  onClick: () => void;
  checked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-line/40 text-sm flex items-center justify-between hover:bg-white/5 text-text"
    >
      <span>{label}</span>
      {checked && <span className="text-wa-green">✓</span>}
    </button>
  );
}

/* ───────────────────────── Pickers (relocated from chat thread) ───────────────────────── */

function TTLPicker({
  current,
  onClose,
  onPick,
}: {
  current: number;
  onClose: () => void;
  onPick: (secs: number) => void;
}) {
  return (
    <Sheet onClose={onClose} title="Disappearing messages">
      <div className="text-xs text-text-muted px-4 pb-2">
        New messages you send will be deleted from both devices and the server
        after the chosen time.
      </div>
      {TTL_OPTIONS.map((o) => (
        <MenuItem
          key={o.seconds}
          label={o.label}
          checked={o.seconds === current}
          onClick={() => onPick(o.seconds)}
        />
      ))}
    </Sheet>
  );
}

function SnoozeSheet({
  peerLabel,
  onClose,
  onPick,
}: {
  peerLabel: string;
  onClose: () => void;
  onPick: (untilIso: string) => void;
}) {
  const tomorrowMorning = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  })();
  const tomorrowClock = tomorrowMorning.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const options: { label: string; until: Date }[] = [
    { label: "1 hour", until: new Date(Date.now() + 60 * 60 * 1000) },
    { label: "8 hours", until: new Date(Date.now() + 8 * 60 * 60 * 1000) },
    { label: `Until tomorrow (${tomorrowClock})`, until: tomorrowMorning },
    {
      label: "1 week",
      until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    { label: "Always", until: new Date("9999-12-31T23:59:59.000Z") },
  ];
  return (
    <Sheet onClose={onClose} title={`Mute ${peerLabel}`}>
      <div className="text-xs text-text-muted px-4 pb-2">
        You won't be notified about new messages from this chat.
      </div>
      {options.map((o) => (
        <MenuItem
          key={o.label}
          label={o.label}
          onClick={() => onPick(o.until.toISOString())}
        />
      ))}
    </Sheet>
  );
}

function SeenTTLPicker({
  current,
  onClose,
  onPick,
}: {
  current: number;
  onClose: () => void;
  onPick: (secs: number) => void;
}) {
  const [hours, setHours] = useState(Math.floor(current / 3600));
  const [minutes, setMinutes] = useState(Math.floor((current % 3600) / 60));
  const [seconds, setSeconds] = useState(current % 60);

  const total = hours * 3600 + minutes * 60 + seconds;
  const preview = total > 0 ? formatSeenTtl(total) : "Off (disabled)";

  function DrumColumn({
    value,
    max,
    label,
    onChange,
  }: {
    value: number;
    max: number;
    label: string;
    onChange: (v: number) => void;
  }) {
    return (
      <div className="flex flex-col items-center gap-1 flex-1">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange(value === max ? 0 : value + 1)}
          className="size-8 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-white/10 text-lg select-none"
          aria-label={`Increase ${label}`}
        >
          ▲
        </button>
        <div className="w-14 h-10 flex items-center justify-center bg-bg rounded-lg border border-line text-text text-xl font-mono font-semibold select-none tabular-nums">
          {String(value).padStart(2, "0")}
        </div>
        <button
          type="button"
          onClick={() => onChange(value === 0 ? max : value - 1)}
          className="size-8 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-white/10 text-lg select-none"
          aria-label={`Decrease ${label}`}
        >
          ▼
        </button>
      </div>
    );
  }

  return (
    <Sheet onClose={onClose} title="Auto-delete after seen">
      <div className="px-4 pt-1 pb-4 space-y-4">
        <p className="text-xs text-text-muted leading-relaxed">
          Messages you <span className="text-text font-medium">receive</span> will
          automatically be deleted from this device after you see them, once the
          chosen time has passed. Set all to zero to disable.
        </p>

        <div className="flex items-center justify-center gap-3 py-2">
          <DrumColumn value={hours} max={23} label="Hours" onChange={setHours} />
          <span className="text-2xl text-text-muted font-bold mt-4">:</span>
          <DrumColumn value={minutes} max={59} label="Min" onChange={setMinutes} />
          <span className="text-2xl text-text-muted font-bold mt-4">:</span>
          <DrumColumn value={seconds} max={59} label="Sec" onChange={setSeconds} />
        </div>

        <div className="space-y-1">
          <div className="text-[10px] text-text-muted uppercase tracking-wider px-1">
            Quick presets
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Off", secs: 0 },
              { label: "30 sec", secs: 30 },
              { label: "1 min", secs: 60 },
              { label: "5 min", secs: 300 },
              { label: "30 min", secs: 1800 },
              { label: "1 hour", secs: 3600 },
              { label: "6 hours", secs: 21600 },
              { label: "12 hours", secs: 43200 },
              { label: "1 day", secs: 86400 },
            ].map((p) => (
              <button
                key={p.secs}
                type="button"
                onClick={() => {
                  setHours(Math.floor(p.secs / 3600));
                  setMinutes(Math.floor((p.secs % 3600) / 60));
                  setSeconds(p.secs % 60);
                }}
                className={
                  "px-2 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                  (total === p.secs
                    ? "bg-wa-green text-text-oncolor border-transparent"
                    : "bg-surface border-line text-text hover:bg-white/10")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-sm text-text-muted">
            Delete after:{" "}
            <span className={total > 0 ? "text-wa-green font-semibold" : "text-text"}>
              {preview}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onPick(total)}
            className="px-4 py-2 rounded-xl bg-wa-green text-text-oncolor text-sm font-medium hover:bg-wa-green-dark transition"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function SafetyNumberDialog({
  myId,
  peerId,
  peerLabel,
  onClose,
}: {
  myId: string;
  peerId: string;
  peerLabel: string;
  onClose: () => void;
}) {
  const [number, setNumber] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);
  const myKey = trpc.prekeys.identityKeyFor.useQuery(
    { userId: myId },
    { enabled: !!myId, retry: false },
  );
  const peerKey = trpc.prekeys.identityKeyFor.useQuery(
    { userId: peerId },
    { retry: false },
  );

  useEffect(() => {
    const myPub = myKey.data?.identityPublicKey;
    const peerPub = peerKey.data?.identityPublicKey;
    if (!myPub || !peerPub) return;
    void safetyNumberFromB64(myPub, peerPub)
      .then(setNumber)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Could not derive number."),
      );
  }, [myKey.data, peerKey.data]);

  async function copy() {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const rows = number ? formatSafetyRows(number) : [];

  return (
    <Sheet onClose={onClose} title="Safety number">
      <div className="px-5 pb-5 pt-1">
        <p className="text-xs text-text-muted text-center mb-4 max-w-xs mx-auto">
          Two devices that show the same picture and digits below are talking
          directly. If you and {peerLabel} match, no one is listening in.
        </p>

        {err ? (
          <ErrorMessage>{err}</ErrorMessage>
        ) : !number ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner />
            <div className="text-xs text-text-muted">Deriving fingerprint…</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div
              className={
                "relative rounded-2xl border border-line bg-surface p-3 shadow-sm transition-all duration-300 " +
                (verified
                  ? "ring-2 ring-wa-green ring-offset-2 ring-offset-panel"
                  : "")
              }
            >
              <SafetyArt safetyNumber={number} size={208} />
              {verified && (
                <div className="absolute -top-2 -right-2 size-9 rounded-full bg-wa-green text-text-oncolor flex items-center justify-center shadow-md animate-fade-in">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                </div>
              )}
            </div>

            <div className="w-full max-w-xs flex flex-col gap-1.5">
              {rows.map((groups, i) => (
                <div
                  key={i}
                  className="font-mono text-[15px] tracking-[0.18em] text-text text-center tabular-nums"
                  style={{ letterSpacing: "0.18em" }}
                >
                  {groups.join(" ")}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              <button
                type="button"
                onClick={copy}
                className="rounded-xl border border-line bg-surface text-text text-sm font-medium px-3 py-2 hover:bg-elevated transition wa-tap"
              >
                {copied ? "Copied" : "Copy digits"}
              </button>
              <button
                type="button"
                onClick={() => setVerified((v) => !v)}
                className={
                  "rounded-xl text-sm font-medium px-3 py-2 transition wa-tap " +
                  (verified
                    ? "bg-wa-green/15 text-wa-green-dark dark:text-wa-green border border-wa-green/40"
                    : "bg-wa-green text-text-oncolor border border-wa-green hover:opacity-90")
                }
              >
                {verified ? "✓ Marked verified" : "Mark as verified"}
              </button>
            </div>

            <p className="text-[11px] text-text-faint text-center max-w-xs leading-relaxed">
              Marking is just a personal note on this device — VeilChat never
              uploads it. Compare in person or over a video call you trust.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function formatSeenTtl(secs: number): string {
  if (secs <= 0) return "Off";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ");
}
