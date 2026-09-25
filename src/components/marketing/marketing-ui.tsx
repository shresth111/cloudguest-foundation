import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CHANNEL_ICON, formatCount, useChannelLabel } from "./marketing-helpers";
import type { CampaignStatus, MarketingChannel, RecipientStatus } from "@/types/marketing";

/**
 * Small shared pieces for the Marketing screens: channel glyphs and labels,
 * status pills, the error-code → sentence table, permission checks, and a
 * pager. Nothing here holds data; every number these render is passed in
 * from an API response.
 */

export function ChannelTag({
  channel,
  className,
}: {
  channel: MarketingChannel;
  className?: string;
}) {
  const label = useChannelLabel();
  const Icon = CHANNEL_ICON[channel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label(channel)}
    </span>
  );
}

const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  sending: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  cancelled: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

const CAMPAIGN_STATUS_FALLBACK: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function CampaignStatusTag({ status }: { status: CampaignStatus }) {
  const { t } = useTranslation("marketing", { i18n });
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        CAMPAIGN_STATUS_STYLE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {t(`campaignStatus.${status}`, CAMPAIGN_STATUS_FALLBACK[status] ?? status)}
    </span>
  );
}

const RECIPIENT_STATUS_STYLE: Record<RecipientStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  sending: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  submitted: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  skipped: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

const RECIPIENT_STATUS_FALLBACK: Record<RecipientStatus, string> = {
  pending: "Pending",
  sending: "Sending",
  submitted: "Sent to provider",
  delivered: "Delivered",
  failed: "Failed",
  skipped: "Skipped",
};

export function RecipientStatusTag({ status }: { status: RecipientStatus }) {
  const { t } = useTranslation("marketing", { i18n });
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        RECIPIENT_STATUS_STYLE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {t(`recipientStatus.${status}`, RECIPIENT_STATUS_FALLBACK[status] ?? status)}
    </span>
  );
}

// ── Pager ──────────────────────────────────────────────────────────────

export function Pager({
  page,
  totalPages,
  totalItems,
  onPage,
  busy,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPage: (p: number) => void;
  busy?: boolean;
}) {
  if (totalPages <= 1) {
    return totalItems > 0 ? (
      <p className="px-1 pt-3 text-xs text-muted-foreground">{totalItems.toLocaleString()} total</p>
    ) : null;
  }
  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-3 text-xs text-muted-foreground">
      <span>
        Page {page} of {totalPages} · {totalItems.toLocaleString()} total
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** A labelled number tile. `value` null renders "—" (not measured), never 0. */
export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | null;
  hint?: ReactNode;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
          tone === "warn" && "text-amber-600",
        )}
      >
        {formatCount(value)}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
