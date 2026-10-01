import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Info, UserCog } from "lucide-react";
import i18n from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { useSecurityActivity } from "@/hooks/useSecurity";
import { activitySentence } from "@/lib/security-activity";
import type { SecurityActivityProtection, SecurityActivityWindow } from "@/types/security";

/**
 * "Security activity" -- what this venue's protections actually did.
 *
 * Every number is a real count read off the routers' own rule counters
 * (hourly, read-only) or from Cloudflare, and arrives with its own
 * availability. A protection that is not switched on does not appear at all;
 * one that could not be measured says why instead of showing a zero. The
 * footnote from the backend says what the numbers count (blocked packets) so
 * "attempts" is never read as more precise than it is.
 */

const WINDOWS: { value: SecurityActivityWindow; key: string; label: string }[] = [
  { value: "24h", key: "securityActivity.window.24h", label: "Last 24 hours" },
  { value: "7d", key: "securityActivity.window.7d", label: "Last 7 days" },
];

function ProtectionRow({ p }: { p: SecurityActivityProtection }) {
  const { t } = useTranslation("nav", { i18n });
  const sentence = activitySentence(t, p);
  return (
    <li className="rounded-lg border border-border/60 bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t(`securityActivity.label.${p.key}`, p.label)}
          </p>
          {sentence ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{sentence}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("securityActivity.notMeasured", "Not measured")}
              {p.unavailableReason ? ` — ${p.unavailableReason}` : ""}
            </p>
          )}
          {p.available && p.unavailableReason && (
            <p className="mt-0.5 text-xs text-muted-foreground">{p.unavailableReason}</p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 text-2xl font-semibold tabular-nums",
            p.available ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {p.available && p.count != null ? p.count.toLocaleString() : "—"}
        </span>
      </div>
      {p.topRules.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {p.topRules.map((r) => (
            <li key={r.label} className="flex justify-between gap-3">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums">{r.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
      {p.source === "router" && p.routersReporting != null && p.routersTotal != null && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("securityActivity.routersReported", "From {{a}} of {{b}} routers", {
            a: p.routersReporting,
            b: p.routersTotal,
          })}
          {p.lastReadAt
            ? ` · ${t("securityActivity.lastRead", "last read {{at}}", {
                at: new Date(p.lastReadAt).toLocaleString(),
              })}`
            : ""}
        </p>
      )}
    </li>
  );
}

export function SecurityActivityPanel() {
  const { t } = useTranslation("nav", { i18n });
  const [period, setPeriod] = useState<SecurityActivityWindow>("24h");
  const query = useSecurityActivity(period);
  const data = query.data;
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" aria-hidden="true" />
          {t("securityActivity.title", "Security activity")}
        </CardTitle>
        <div
          role="tablist"
          aria-label={t("securityActivity.windowLabel", "Time period")}
          className="flex gap-1 rounded-lg bg-muted/50 p-1"
        >
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              role="tab"
              aria-selected={period === w.value}
              onClick={() => setPeriod(w.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                period === w.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(w.key, w.label)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading && <LoadingSkeleton rows={3} />}
        {query.isError && (
          <p className="text-sm text-muted-foreground">
            {t(
              "securityActivity.loadFailed",
              "Could not load security activity right now. This is usually temporary.",
            )}
          </p>
        )}
        {data && (
          <>
            {data.protections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  "securityActivity.empty",
                  "Nothing to report yet. Counts appear about an hour after a protection is switched on.",
                )}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {data.protections.map((p) => (
                  <ProtectionRow key={p.key} p={p} />
                ))}
              </ul>
            )}

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCog className="h-4 w-4" aria-hidden="true" />
                {t("securityActivity.changesTitle", "Changes by your team")}
              </h3>
              {data.staffChanges.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    "securityActivity.noChanges",
                    "No one changed a security setting in this period.",
                  )}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.staffChanges.map((c, i) => (
                    <li
                      key={`${c.at}-${i}`}
                      className="flex items-start justify-between gap-4 py-2 text-sm"
                    >
                      <span className="text-foreground">{c.summary}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(c.at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("securityActivity.semantics", data.semantics)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SecurityActivityPanel;
