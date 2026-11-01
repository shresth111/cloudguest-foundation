import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Info,
  ListChecks,
  XCircle,
} from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { customerFeatureHref } from "@/lib/customerNav";
import { Panel } from "@/components/customer/console";
import { PanelTitle } from "./overview/console-ui";
import { lastContactLabel } from "@/lib/location-liveness";
import { actionLabel, joinList, rowCopy } from "./needsAttentionCopy";
import {
  useNeedsAttention,
  type AttentionItem,
  type AttentionSeverity,
  type AttentionSource,
  type NeedsAttentionResult,
} from "./useNeedsAttention";
import type { WanSummaryState } from "./dashboard.types";

// Console look: the page's shared panel chrome, status tokens for severity.
const TINT: Record<AttentionSeverity, string> = {
  error: "text-[var(--wy-crit)]",
  warning: "text-[var(--wy-warn)]",
  info: "text-[var(--wy-info)]",
};

/** The left severity rail on each row. */
const RAIL: Record<AttentionSeverity, string> = {
  error: "before:bg-[var(--wy-crit)]",
  warning: "before:bg-[var(--wy-warn)]",
  info: "before:bg-[var(--wy-info)]",
};

const ICON: Record<AttentionSeverity, typeof XCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function sourceLabel(s: AttentionSource, t: TFunction): string {
  switch (s) {
    case "routers":
      return t("source.routers", "routers");
    case "alerts":
      return t("source.alerts", "alerts");
    case "devices":
      return t("source.devices", "devices");
    case "isp":
      return t("source.isp", "internet lines");
    case "staffLogins":
      return t("source.staffLogins", "staff sign-ins");
    case "plan":
      return t("source.plan", "your plan");
  }
}

function severityLabel(s: AttentionSeverity, t: TFunction): string {
  return s === "error"
    ? t("severity.error", "Problem")
    : s === "warning"
      ? t("severity.warning", "Warning")
      : t("severity.info", "Note");
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[11px] text-[var(--wy-text-muted)]">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Which routers are silent, and what to do -- folded into the routers row
 * (it used to be a separate "Partly live" panel that restated the outage). */
function RouterDetail({ item, t }: { item: AttentionItem; t: TFunction }) {
  const routers = item.routers ?? [];
  if (routers.length === 0) return null;
  const now = new Date();
  return (
    <details className="group mt-1">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-[11px] font-medium text-[var(--wy-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">
          {t("routerDetail.show", { count: routers.length, defaultValue: "Which routers?" })}
        </span>
        <span className="hidden group-open:inline">{t("routerDetail.hide", "Hide")}</span>
      </summary>
      <ul className="mt-1.5 space-y-1.5" data-testid="needs-attention-router-detail">
        {routers.map((r) => (
          <li key={r.key} className="text-[11px] leading-relaxed">
            <span className="font-medium text-[var(--wy-text)]">{r.label}</span>
            <span className="text-[var(--wy-text-muted)]">
              {" · "}
              {r.shortLabel} · {lastContactLabel(r, now)}
            </span>
            {r.nextStep && <p className="text-[var(--wy-text-muted)]">{r.nextStep}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * "What do I need to do right now at this venue?" -- a severity-ordered list
 * of real problems, each with the one page that fixes it. See
 * `useNeedsAttention` for where every row comes from. Never says "All good"
 * unless every source it could ask actually answered.
 *
 * The dashboard computes the list once (it also feeds the top bar's pill and
 * bell) and renders `NeedsAttentionCardView` with it; this wrapper asks for
 * it itself, for any caller that has not.
 */
export function NeedsAttentionCard({
  locationId,
  wan,
}: {
  locationId: string;
  wan?: WanSummaryState;
}) {
  const state = useNeedsAttention(locationId, { wan });
  return <NeedsAttentionCardView state={state} />;
}

export function NeedsAttentionCardView({ state }: { state: NeedsAttentionResult }) {
  const { t, i18n: inst } = useTranslation("needsAttention", { i18n });
  const lang = inst.language || "en";
  const { items, unchecked, pending, checked, loading } = state;
  const list = (sources: AttentionSource[]) =>
    joinList(
      sources.map((s) => sourceLabel(s, t)),
      lang,
    );

  return (
    <div className="@container" aria-busy={loading || undefined}>
      <Panel
        flush
        title={
          <PanelTitle icon={<ListChecks />} id="needs-attention-title">
            {t("title", "Needs attention")}
          </PanelTitle>
        }
        description={t("subtitle", "What to sort out at this venue right now")}
        actions={
          !loading && items.length > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                items.some((i) => i.severity === "error")
                  ? "bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]"
                  : "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
              )}
            >
              {items.length}
            </span>
          ) : undefined
        }
      >
        <div className="flex-1 p-3">
          {loading ? (
            <div
              className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3"
              role="status"
              aria-label={t("loading", "Checking your venue…")}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.length > 0 && (
                <ul
                  className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3"
                  data-testid="needs-attention-list"
                >
                  {items.map((item) => {
                    const Icon = ICON[item.severity];
                    const copy = rowCopy(item, t, lang);
                    return (
                      <li
                        key={item.kind}
                        data-severity={item.severity}
                        className={cn(
                          "relative flex flex-wrap items-start gap-2.5 overflow-hidden rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] py-2 pl-3.5 pr-2 before:absolute before:inset-y-0 before:left-0 before:w-[3px] sm:flex-nowrap",
                          RAIL[item.severity],
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                            TINT[item.severity],
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                          <span className="sr-only">{severityLabel(item.severity, t)}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{copy.title}</p>
                          {copy.detail && (
                            <p className="mt-0.5 text-[11px] text-[var(--wy-text-muted)]">
                              {copy.detail}
                            </p>
                          )}
                          <RouterDetail item={item} t={t} />
                        </div>
                        {item.actionId && (
                          <Link
                            to={customerFeatureHref(item.actionId)}
                            data-action={item.actionId}
                            className="inline-flex shrink-0 items-center gap-1 self-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--wy-text)] transition-colors duration-150 hover:border-[var(--wy-accent)] hover:text-[var(--wy-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                          >
                            {actionLabel(item.actionId, t)}
                            <ArrowRight className="h-3 w-3" aria-hidden />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {items.length === 0 &&
                unchecked.length === 0 &&
                pending.length === 0 &&
                (checked.length > 0 ? (
                  <div
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 py-1"
                    data-testid="needs-attention-all-good"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="text-sm font-medium">
                      {t("allGood", "All good — nothing needs your attention")}
                    </p>
                    <p className="text-[11px] text-[var(--wy-text-muted)]">
                      {t("checkedList", {
                        list: list(checked),
                        defaultValue: "We checked: {{list}}.",
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="py-2 text-center text-xs text-[var(--wy-text-muted)]">
                    {t("nothingToCheck", "There's nothing here we can check for your account.")}
                  </p>
                ))}

              {unchecked.length > 0 && (
                <div
                  data-testid="needs-attention-unchecked"
                  className="rounded-[var(--wy-radius)] border border-[var(--wy-warn)]/30 bg-[var(--wy-warn-soft)] p-3 text-[var(--wy-text)]"
                >
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t("couldntCheck", {
                      list: list(unchecked),
                      defaultValue: "Couldn't check: {{list}}.",
                    })}
                  </p>
                  {items.length === 0 && (
                    <p className="mt-1 text-[11px] opacity-80">
                      {t(
                        "couldntCheckBody",
                        "So we can't say everything is fine. Refresh the page in a minute.",
                      )}
                    </p>
                  )}
                </div>
              )}

              {pending.length > 0 && (
                <Note
                  icon={
                    <span className="block h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50" />
                  }
                >
                  {t("stillChecking", {
                    list: list(pending),
                    defaultValue: "Still checking: {{list}}…",
                  })}
                </Note>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
