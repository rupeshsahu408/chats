import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { useAuthStore } from "../lib/store";
import { AppBar, Pill } from "../components/Layout";
import {
  computeDailyPrivacyReport,
  type PrivacyReport,
} from "../lib/privacyReport";

/**
 * Daily Privacy Report — a calm, glanceable summary of the
 * encryption work Veil did for the user today, plus the
 * always-true architectural guarantees they should be reminded of.
 *
 * Everything is computed locally from Dexie. There is no server
 * call and no telemetry — the page itself respects the privacy it
 * reports on.
 */
export function PrivacyReportPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [report, setReport] = useState<PrivacyReport | null>(null);
  const userPrefs = useLiveQuery(() => db.userPrefs.get("self"), [], undefined);

  useEffect(() => {
    if (!accessToken) navigate("/");
  }, [accessToken, navigate]);

  // Recompute on mount, and whenever any chat or group message table
  // gains a row — Dexie's `useLiveQuery` is the cheapest signal we
  // have for that. We use a count() as a tripwire and trigger a
  // recompute, since computeDailyPrivacyReport itself wants to
  // do range scans we don't need to repeat live.
  const tripwire = useLiveQuery(
    async () =>
      (await db.chatMessages.count()) + (await db.groupMessages.count()),
    [],
    0,
  );
  useEffect(() => {
    let cancelled = false;
    void computeDailyPrivacyReport().then((r) => {
      if (!cancelled) setReport(r);
    });
    return () => {
      cancelled = true;
    };
  }, [tripwire]);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppBar title="Privacy Report" back={() => navigate(-1)} />

      <div className="flex-1 bg-panel pb-10">
        {/* ─── Hero ─── */}
        <div className="px-5 pt-7 pb-6 text-center bg-gradient-to-b from-wa-green/8 to-transparent">
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold">
            {todayLabel}
          </div>
          <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-text leading-tight">
            Your conversations stayed private today.
          </h2>
          <p className="mt-2 text-[13px] text-text-muted leading-relaxed max-w-md mx-auto">
            A daily summary of what Veil protected — computed entirely on
            this device.
          </p>
        </div>

        {/* ─── Top-line stats ─── */}
        <div className="grid grid-cols-2 gap-3 px-4 mt-2">
          <BigStat
            label="Messages encrypted"
            value={report?.messagesEncrypted ?? 0}
            sublabel={
              report
                ? `${report.messagesSent} sent · ${report.messagesReceived} received`
                : "—"
            }
            tone="primary"
          />
          <BigStat
            label="Active conversations"
            value={report?.activeConversations ?? 0}
            sublabel="Today"
          />
          <BigStat
            label="Photos secured"
            value={report?.photosSecured ?? 0}
            sublabel="End-to-end encrypted"
          />
          <BigStat
            label="Voice notes secured"
            value={report?.voiceNotesSecured ?? 0}
            sublabel="End-to-end encrypted"
          />
        </div>

        {/* ─── Always-zero guarantees ─── */}
        <SectionHeader>Always-zero</SectionHeader>
        <div className="mx-4 veil-card shadow-card p-1 divide-y divide-line/40">
          <GuaranteeRow
            label="Cloud uploads of your messages"
            value="0"
            note="Veil's server never sees readable text."
          />
          <GuaranteeRow
            label="Server-readable plaintext"
            value="0"
            note="All bodies are sealed before they leave your device."
          />
          <GuaranteeRow
            label="Trackers loaded"
            value="0"
            note="No analytics, no third-party scripts."
          />
          <GuaranteeRow
            label="Days since metadata leak"
            value="∞"
            note="None ever recorded on this device."
          />
        </div>

        {/* ─── Encryption posture ─── */}
        <SectionHeader>Encryption posture</SectionHeader>
        <div className="mx-4 veil-card shadow-card p-4 space-y-3">
          <PostureRow
            label="Cipher suite"
            value={
              report?.encryptionScheme ??
              "X25519 + AES-256-GCM (Double Ratchet)"
            }
          />
          <PostureRow
            label="App lock"
            value={
              userPrefs?.appLockEnabled ? (
                <Pill tone="ok">Enabled</Pill>
              ) : (
                <Pill tone="warn">Off</Pill>
              )
            }
          />
          <PostureRow
            label="Vault"
            value={
              userPrefs?.vaultEnabled ? (
                <Pill tone="ok">Enabled</Pill>
              ) : (
                <Pill tone="warn">Off</Pill>
              )
            }
          />
          <PostureRow
            label="Screenshot blur"
            value={
              userPrefs?.screenshotBlurEnabled !== false ? (
                <Pill tone="ok">On</Pill>
              ) : (
                <Pill tone="warn">Off</Pill>
              )
            }
          />
        </div>

        {/* ─── 7-day trend ─── */}
        <SectionHeader>This week</SectionHeader>
        <div className="mx-4 veil-card shadow-card p-4">
          <WeekTrend data={report?.weekTrend ?? []} />
          <div className="mt-3 text-[11.5px] text-text-faint leading-relaxed text-center">
            Encrypted messages handled per day on this device.
          </div>
        </div>

        <p className="px-6 pt-7 text-[11px] text-text-faint text-center leading-relaxed">
          This report is generated locally on your device. No part of it
          is sent to Veil's servers.
        </p>
      </div>
    </div>
  );
}

/* ───────────── sub-components ───────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-6 pb-2 text-[11px] uppercase tracking-widest text-text-muted font-semibold">
      {children}
    </div>
  );
}

function BigStat({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: number;
  sublabel?: string;
  tone?: "primary";
}) {
  const isPrimary = tone === "primary";
  return (
    <div
      className={
        "veil-card shadow-card p-4 " +
        (isPrimary
          ? "bg-gradient-to-b from-wa-green/12 to-wa-green/4 border-wa-green/25"
          : "")
      }
    >
      <div className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">
        {label}
      </div>
      <div
        className={
          "mt-1 text-[28px] font-bold tracking-tight tabular-nums leading-none " +
          (isPrimary ? "text-wa-green" : "text-text")
        }
      >
        {value.toLocaleString()}
      </div>
      {sublabel && (
        <div className="mt-1.5 text-[11.5px] text-text-faint leading-snug">
          {sublabel}
        </div>
      )}
    </div>
  );
}

function GuaranteeRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="px-3 py-3 flex items-center gap-3">
      <div className="size-9 rounded-full bg-wa-green/12 text-wa-green grid place-items-center font-bold text-[14px]">
        ✓
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-text">{label}</div>
        {note && (
          <div className="text-[11.5px] text-text-faint mt-0.5 leading-snug">
            {note}
          </div>
        )}
      </div>
      <div className="text-[16px] font-bold text-wa-green tabular-nums">
        {value}
      </div>
    </div>
  );
}

function PostureRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[13px] text-text-muted">{label}</div>
      <div className="text-[13px] text-text font-medium text-right">
        {value}
      </div>
    </div>
  );
}

function WeekTrend({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const dt = new Date(d.date);
        const isToday = i === data.length - 1;
        const dayLetter = dt.toLocaleDateString(undefined, {
          weekday: "narrow",
        });
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1 min-w-0"
          >
            <div className="flex-1 w-full flex items-end">
              <div
                className={
                  "w-full rounded-md transition-all duration-300 ease-veil-soft " +
                  (isToday ? "bg-wa-green" : "bg-line/70")
                }
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${d.count} messages`}
              />
            </div>
            <div
              className={
                "text-[10px] tracking-tight " +
                (isToday ? "text-wa-green font-semibold" : "text-text-faint")
              }
            >
              {dayLetter}
            </div>
          </div>
        );
      })}
    </div>
  );
}
