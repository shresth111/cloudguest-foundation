import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  StatTile as ConsoleStatTile,
  StatusBadge,
  TablePager,
  type ConsoleStatus,
} from "@/components/customer/console";
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
        "inline-flex h-5 items-center gap-1.5 rounded-[calc(var(--wy-radius)-2px)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 text-[11px] font-medium text-[var(--wy-text-muted)]",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label(channel)}
    </span>
  );
}

/** Campaign state -> console status (docs/design/console-tokens.md). Neutral
 * for a state that is nobody's fault (draft, cancelled), info while it is
 * queued or going out, ok when done, crit when it failed. Never the accent. */
const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, ConsoleStatus> = {
  draft: "offline",
  scheduled: "info",
  sending: "info",
  sent: "ok",
  failed: "crit",
  cancelled: "offline",
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
    <StatusBadge status={CAMPAIGN_STATUS_TONE[status] ?? "offline"} pulse={status === "sending"}>
      {t(`campaignStatus.${status}`, CAMPAIGN_STATUS_FALLBACK[status] ?? status)}
    </StatusBadge>
  );
}

const RECIPIENT_STATUS_TONE: Record<RecipientStatus, ConsoleStatus> = {
  pending: "offline",
  sending: "info",
  submitted: "info",
  delivered: "ok",
  failed: "crit",
  skipped: "warn",
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
    <StatusBadge status={RECIPIENT_STATUS_TONE[status] ?? "offline"} pulse={status === "sending"}>
      {t(`recipientStatus.${status}`, RECIPIENT_STATUS_FALLBACK[status] ?? status)}
    </StatusBadge>
  );
}

// ── Pager ──────────────────────────────────────────────────────────────

export function Pager({
  page,
  totalPages,
  totalItems,
  onPage,
  busy,
  inTable,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPage: (p: number) => void;
  busy?: boolean;
  /** In a DataTable footer: the console TablePager row instead of the loose line. */
  inTable?: boolean;
}) {
  if (inTable) {
    return totalPages <= 1 ? (
      totalItems > 0 ? (
        <p className="px-3 py-2.5 text-xs tabular-nums text-[var(--wy-text-muted)]">
          {totalItems.toLocaleString()} total
        </p>
      ) : null
    ) : (
      <TablePager
        summary={`Page ${page} of ${totalPages} · ${totalItems.toLocaleString()} total`}
        previousLabel={
          <>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only">Previous page</span>
          </>
        }
        nextLabel={
          <>
            <ChevronRight className="h-4 w-4" aria-hidden />
            <span className="sr-only">Next page</span>
          </>
        }
        hasPrevious={!busy && page > 1}
        hasNext={!busy && page < totalPages}
        onPrevious={() => onPage(page - 1)}
        onNext={() => onPage(page + 1)}
      />
    );
  }
  if (totalPages <= 1) {
    return totalItems > 0 ? (
      <p className="px-1 pt-3 text-xs tabular-nums text-[var(--wy-text-faint)]">
        {totalItems.toLocaleString()} total
      </p>
    ) : null;
  }
  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-3 text-xs tabular-nums text-[var(--wy-text-muted)]">
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
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** A labelled number tile: the console StatTile, with the value's tone on a
 * status token. `value` null renders "—" (not measured), never 0. */
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
    <ConsoleStatTile
      label={label}
      hint={hint}
      value={
        <span
          className={cn(
            tone === "good" && "text-[var(--wy-ok)]",
            tone === "bad" && "text-[var(--wy-crit)]",
            tone === "warn" && "text-[var(--wy-warn)]",
          )}
        >
          {formatCount(value)}
        </span>
      }
    />
  );
}
