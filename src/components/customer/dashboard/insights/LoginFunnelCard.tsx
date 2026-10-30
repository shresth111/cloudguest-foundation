import { AlertTriangle, Info, KeyRound } from "lucide-react";
import { formatCount, methodLabel, rangeLabel } from "./insights.format";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  CardHead,
  INSIGHT_PRIMARY,
  InsightCard,
  InsightDemoNote,
  InsightEmpty,
  InsightError,
  InsightSkeleton,
} from "./InsightCard";
import { useLoginFunnel } from "./useInsights";
import {
  DEFAULT_INSIGHT_RANGE_DAYS,
  type InsightRangeDays,
  type LoginFunnelData,
} from "./insights.types";

function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part * 100) / whole) : 0;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Tracking began after the window opened, so the stage's count covers only
 * part of it and must not be compared with the full-window stages. */
function startsInsideWindow(trackedSince: string | null, windowStart: string): boolean {
  if (!trackedSince) return true;
  if (!windowStart) return false;
  return new Date(trackedSince).getTime() > new Date(windowStart).getTime();
}

export function LoginFunnelCard({
  locationId,
  days = DEFAULT_INSIGHT_RANGE_DAYS,
  className,
}: {
  locationId: string;
  days?: InsightRangeDays;
  className?: string;
}) {
  const { t } = useTranslation("insights", { i18n });
  const q = useLoginFunnel(locationId, days);
  const empty =
    q.data &&
    q.data.otp_requested_guests === 0 &&
    q.data.methods.length === 0 &&
    !(q.data.portal_opened.available && q.data.portal_opened.count > 0);

  return (
    <InsightCard className={className} testId="insight-login-funnel">
      <CardHead
        icon={<KeyRound className="h-4 w-4" />}
        title={t("funnel.title", "Guest login funnel")}
        subtitle={rangeLabel(days)}
      />
      {q.isDemo ? (
        <InsightDemoNote />
      ) : q.isLoading ? (
        <InsightSkeleton rows={5} />
      ) : q.isError || !q.data ? (
        <InsightError onRetry={q.refetch} />
      ) : empty ? (
        <InsightEmpty label={t("funnel.empty", "No guest logins in this period yet.")} />
      ) : (
        <Funnel data={q.data} />
      )}
    </InsightCard>
  );
}

function Funnel({ data }: { data: LoginFunnelData }) {
  const { t } = useTranslation("insights", { i18n });
  const base = data.otp_requested_guests;
  const portal = data.portal_opened;
  const online = data.internet_confirmed;
  const stages = [
    {
      key: "requested",
      label: t("funnel.requested", "Asked for an OTP"),
      value: data.otp_requested_guests,
    },
    {
      key: "verified",
      label: t("funnel.verified", "Entered the right OTP"),
      value: data.otp_verified_guests,
    },
    {
      key: "signedIn",
      label: t("funnel.signedIn", "Signed in"),
      value: data.otp_signed_in_guests,
    },
  ];
  const verifiedNotSignedIn = Math.max(data.otp_verified_guests - data.otp_signed_in_guests, 0);
  const totalSuccess = data.methods.reduce((s, m) => s + m.successful_logins, 0);

  const onlinePartial =
    online.available && startsInsideWindow(online.tracked_since, data.window_start);
  // The "OTP verified but no internet" incident class. Only claimed when the
  // stage covers the whole window and every router can report it; otherwise
  // the difference would just be the untracked part.
  const signedInNotOnline =
    online.available && !onlinePartial && !online.note
      ? Math.max(data.otp_signed_in_guests - online.otp_guests, 0)
      : 0;
  const portalPartial =
    portal.available && startsInsideWindow(portal.tracked_since, data.window_start);

  return (
    <div className="space-y-5">
      <div data-testid="funnel-portal">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span>{t("funnel.portalOpened", "Opened the login page")}</span>
          {portal.available ? (
            <span className="tabular-nums">
              <span className="font-semibold">{formatCount(portal.count)}</span>{" "}
              <span className="text-muted-foreground">
                {t("funnel.portalDevices", "{{count}} devices", { count: portal.devices })}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t("funnel.notTracked", "Not tracked")}</span>
          )}
        </div>
        {portal.available ? (
          portalPartial && (
            <p className="mt-1 text-[11px] text-muted-foreground" data-testid="funnel-portal-since">
              {portal.tracked_since
                ? t(
                    "funnel.trackingSince",
                    "Tracking since {{date}}, so this covers part of the period.",
                    {
                      date: dateLabel(portal.tracked_since),
                    },
                  )
                : t("funnel.trackingNotStarted", "Tracking has started; nothing recorded yet.")}
            </p>
          )
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">{portal.message}</p>
        )}
      </div>

      {base > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("funnel.otpHeading", "OTP logins · guests")}
          </p>
          <ol className="space-y-2">
            {stages.map((s) => {
              const pct = pctOf(s.value, base);
              return (
                <li key={s.key} data-testid={`funnel-${s.key}`}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span>{s.label}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{formatCount(s.value)}</span>{" "}
                      <span className="text-muted-foreground">{pct}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${pct}%`,
                        minWidth: s.value > 0 ? 4 : 0,
                        backgroundColor: INSIGHT_PRIMARY,
                      }}
                    />
                  </div>
                </li>
              );
            })}
            <li data-testid="funnel-online">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>{t("funnel.internetConfirmed", "Internet confirmed by the router")}</span>
                {online.available ? (
                  <span className="tabular-nums">
                    <span className="font-semibold">{formatCount(online.otp_guests)}</span>{" "}
                    <span className="text-muted-foreground">{pctOf(online.otp_guests, base)}%</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("funnel.notTracked", "Not tracked")}
                  </span>
                )}
              </div>
              {online.available && (
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${pctOf(online.otp_guests, base)}%`,
                      minWidth: online.otp_guests > 0 ? 4 : 0,
                      backgroundColor: INSIGHT_PRIMARY,
                    }}
                  />
                </div>
              )}
              {!online.available && (
                <p className="mt-1 text-[11px] text-muted-foreground">{online.message}</p>
              )}
              {online.available && onlinePartial && (
                <p
                  className="mt-1 text-[11px] text-muted-foreground"
                  data-testid="funnel-online-since"
                >
                  {online.tracked_since
                    ? t(
                        "funnel.trackingSince",
                        "Tracking since {{date}}, so this covers part of the period.",
                        {
                          date: dateLabel(online.tracked_since),
                        },
                      )
                    : t("funnel.trackingNotStarted", "Tracking has started; nothing recorded yet.")}
                </p>
              )}
              {online.available && online.note && (
                <p className="mt-1 text-[11px] text-muted-foreground">{online.note}</p>
              )}
            </li>
          </ol>
          {verifiedNotSignedIn > 0 && (
            <p
              className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
              data-testid="funnel-gap"
            >
              {t(
                "funnel.gap",
                "{{count}} guests entered the right OTP but no login was recorded for them. If this keeps happening, contact Wyfy support.",
                { count: verifiedNotSignedIn },
              )}
            </p>
          )}
          {signedInNotOnline > 0 && (
            <p
              className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
              data-testid="funnel-online-gap"
            >
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
              {t(
                "funnel.onlineGap",
                "{{count}} guests signed in but their router never reported them online. They may have had no internet after login. If this keeps happening, contact Wyfy support.",
                { count: signedInNotOnline },
              )}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("funnel.codesSent", "{{count}} codes sent, including resends.", {
              count: data.otp_codes_sent,
            })}
          </p>
        </div>
      )}

      {data.methods.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("funnel.methodsHeading", "How guests logged in")}
          </p>
          <ul className="space-y-1.5">
            {data.methods.map((m) => (
              <li
                key={m.auth_method}
                className="flex items-baseline justify-between gap-2 text-xs"
                data-testid={`method-${m.auth_method}`}
              >
                <span>{methodLabel(m.auth_method)}</span>
                <span className="tabular-nums">
                  <span className="font-semibold">{formatCount(m.successful_logins)}</span>{" "}
                  <span className="text-muted-foreground">
                    {pctOf(m.successful_logins, totalSuccess)}%
                  </span>
                  {m.failed_logins > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      {t("funnel.failed", "{{count}} failed", { count: m.failed_logins })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {online.available && (
        <div className="border-t border-border/60 pt-3" data-testid="funnel-online-total">
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            {t(
              "funnel.onlineAllMethods",
              "Across every login method, {{count}} guests were confirmed online by the router.",
              { count: online.count },
            )}
          </p>
        </div>
      )}
    </div>
  );
}
