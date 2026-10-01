import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, Info, KeyRound, ShieldCheck, Activity } from "lucide-react";
import i18n from "@/lib/i18n";
import { RightDrawer } from "@/components/ui-ext/RightDrawer";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { csvDateStamp, downloadCsv } from "@/lib/csv-export";
import { fmtBytes, fmtDuration, timelineCsv } from "@/lib/session-timeline";
import { resolveOrgId } from "@/services/customer.service";
import {
  sessionTimelineService,
  type SessionTimeline,
  type TimelineEntry,
  type TimelinePhase,
} from "@/services/sessionTimeline.service";

/**
 * One guest connection, told as Authentication -> Authorization ->
 * Accounting. Opened from a Guest Session Log row on Guest Connection
 * Records.
 *
 * The backend writes every sentence in plain words and keeps the RADIUS
 * attribute values behind each step for the "Details" expander, so this
 * component never shows a venue owner `Acct-Terminate-Cause` unless they ask.
 * Step titles are translated here by `kind`; the per-step detail sentence is
 * the backend's English (a reason like "Wrong OTP entered." comes from the
 * server's own reason table).
 */

const PHASE_STYLE: Record<TimelinePhase, string> = {
  authentication: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  authorization: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  accounting: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const PHASE_LABEL: Record<TimelinePhase, [string, string]> = {
  authentication: ["sessionTimeline.phase.authentication", "Sign-in"],
  authorization: ["sessionTimeline.phase.authorization", "Allowed"],
  accounting: ["sessionTimeline.phase.accounting", "Usage"],
};

/** Translated step titles by `kind`; an unknown kind shows the backend's
 * own English title rather than nothing. */
const KIND_TITLE: Record<string, [string, string]> = {
  portal_login_success: [
    "sessionTimeline.kind.portal_login_success",
    "Signed in on the WiFi login page",
  ],
  portal_login_failed: [
    "sessionTimeline.kind.portal_login_failed",
    "Sign-in failed on the WiFi login page",
  ],
  auth_accept: ["sessionTimeline.kind.auth_accept", "Router checked with Wyfy: allowed on"],
  auth_reject: ["sessionTimeline.kind.auth_reject", "Router checked with Wyfy: refused"],
  acct_start: ["sessionTimeline.kind.acct_start", "Router started counting this connection"],
  acct_interim: ["sessionTimeline.kind.acct_interim", "Usage update from the router"],
  acct_stop: ["sessionTimeline.kind.acct_stop", "Router reported the connection ended"],
  nas_reboot: ["sessionTimeline.kind.nas_reboot", "The router restarted"],
  session_started: ["sessionTimeline.kind.session_started", "Session started (Wyfy's record)"],
  session_ended: ["sessionTimeline.kind.session_ended", "Session ended (Wyfy's record)"],
};

function fmtTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm text-foreground" title={value ?? undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Step({ entry }: { entry: TimelineEntry }) {
  const { t } = useTranslation("nav", { i18n });
  const [titleKey, titleDefault] = KIND_TITLE[entry.kind] ?? [null, entry.title];
  const [phaseKey, phaseDefault] = PHASE_LABEL[entry.phase];
  const rawEntries = Object.entries(entry.raw);
  return (
    <li className="relative pl-6">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full",
          entry.outcome === "failure"
            ? "bg-rose-500"
            : entry.outcome === "success"
              ? "bg-emerald-500"
              : "bg-muted-foreground/50",
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            PHASE_STYLE[entry.phase],
          )}
        >
          {t(phaseKey, phaseDefault)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{fmtTime(entry.at)}</span>
        {entry.repeatCount > 1 && (
          <span className="text-xs text-muted-foreground">
            {t("sessionTimeline.repeated", "×{{count}}", { count: entry.repeatCount })}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">
        {titleKey ? t(titleKey, titleDefault) : titleDefault}
      </p>
      {entry.detail && <p className="text-sm text-muted-foreground">{entry.detail}</p>}
      {rawEntries.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {t("sessionTimeline.details", "Details")}
          </summary>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-muted/40 px-3 py-2 font-mono text-[11px]">
            {rawEntries.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-all text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </li>
  );
}

function Body({ timeline }: { timeline: SessionTimeline }) {
  const { t } = useTranslation("nav", { i18n });
  const { authorization: az, accounting: ac } = timeline;
  const limit = (v: number | null, unit: string) =>
    v ? `${v} ${unit}` : t("sessionTimeline.none", "None");
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {t("sessionTimeline.authTitle", "How they got on")}
        </h3>
        <dl className="grid grid-cols-2 gap-3">
          <Fact
            label={t("sessionTimeline.method", "Sign-in method")}
            value={az.authMethodText ?? az.authMethod}
          />
          <Fact
            label={t("sessionTimeline.routerChecked", "Router checked with Wyfy")}
            value={
              az.routerChecked ? t("sessionTimeline.yes", "Yes") : t("sessionTimeline.no", "No")
            }
          />
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {t("sessionTimeline.grantTitle", "What they were allowed")}
        </h3>
        <dl className="grid grid-cols-2 gap-3">
          <Fact
            label={t("sessionTimeline.timeLimit", "Time limit")}
            value={limit(az.timeLimitMinutes, "min")}
          />
          <Fact
            label={t("sessionTimeline.idle", "Disconnect when idle")}
            value={limit(az.idleTimeoutMinutes, "min")}
          />
          <Fact
            label={t("sessionTimeline.dataCap", "Data cap")}
            value={limit(az.dataLimitMb, "MB")}
          />
          <Fact
            label={t("sessionTimeline.speed", "Speed limit")}
            value={az.speedLimit ?? t("sessionTimeline.none", "None")}
          />
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="h-4 w-4" aria-hidden="true" />
          {t("sessionTimeline.usageTitle", "What the connection did")}
        </h3>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label={t("sessionTimeline.started", "Started")} value={fmtTime(ac.startedAt)} />
          <Fact
            label={t("sessionTimeline.ended", "Ended")}
            value={
              ac.endedAt ? fmtTime(ac.endedAt) : t("sessionTimeline.stillOn", "Still connected")
            }
          />
          <Fact
            label={t("sessionTimeline.duration", "Duration")}
            value={fmtDuration(ac.durationSeconds)}
          />
          <Fact label={t("sessionTimeline.endReason", "Why it ended")} value={ac.endReasonText} />
          <Fact
            label={t("sessionTimeline.download", "Downloaded")}
            value={fmtBytes(ac.bytesDownloaded)}
          />
          <Fact
            label={t("sessionTimeline.upload", "Uploaded")}
            value={fmtBytes(ac.bytesUploaded)}
          />
          <Fact label={t("sessionTimeline.deviceIp", "Device IP")} value={ac.deviceIp} />
          <Fact label={t("sessionTimeline.mac", "Device MAC")} value={ac.deviceMac} />
          <Fact label={t("sessionTimeline.publicIp", "Venue public IP")} value={ac.venuePublicIp} />
          <Fact
            label={t("sessionTimeline.router", "Router")}
            value={ac.routerName ?? ac.nasIdentifier}
          />
        </dl>
      </section>

      {timeline.notes.length > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
          {timeline.notes.map((n) => (
            <p key={n} className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
              {n}
            </p>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("sessionTimeline.stepsTitle", "Step by step")}
        </h3>
        <ol className="space-y-4 border-l border-border/70 pl-2">
          {timeline.entries.map((e, i) => (
            <Step key={`${e.kind}-${e.at}-${i}`} entry={e} />
          ))}
        </ol>
      </section>
    </div>
  );
}

export function GuestSessionTimelineDrawer({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("nav", { i18n });
  const query = useQuery({
    queryKey: ["guest-session-timeline", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => sessionTimelineService.get(sessionId as string, await resolveOrgId()),
    staleTime: 60 * 1000,
  });
  const timeline = query.data;
  return (
    <RightDrawer
      open={Boolean(sessionId)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={t("sessionTimeline.title", "Connection timeline")}
      description={
        timeline
          ? [timeline.guestIdentifier, timeline.accounting.routerName].filter(Boolean).join(" · ")
          : undefined
      }
      footer={
        timeline ? (
          <button
            type="button"
            onClick={() =>
              downloadCsv(`connection-timeline-${csvDateStamp()}.csv`, timelineCsv(timeline))
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("sessionTimeline.csv", "Download timeline (CSV)")}
          </button>
        ) : undefined
      }
    >
      {query.isLoading && <LoadingSkeleton rows={6} />}
      {query.isError && (
        <EmptyState
          title={t("sessionTimeline.loadFailed", "Could not load this connection's timeline")}
          description={t(
            "sessionTimeline.loadFailedHint",
            "This is usually temporary. Close this panel and open the row again.",
          )}
        />
      )}
      {timeline && <Body timeline={timeline} />}
    </RightDrawer>
  );
}

export default GuestSessionTimelineDrawer;
