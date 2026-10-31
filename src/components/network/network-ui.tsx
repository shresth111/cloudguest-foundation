/**
 * Presentation shared by the four Network › Advanced screens (IP Addresses,
 * Network Zones, Port Forwarding, Call Priority) and their master-console
 * twins. All four have the same shape: one PageHeader, three StatTiles, a
 * flush Panel with a Toolbar over a DataTable, and a create/edit dialog --
 * so the pieces that would otherwise be copied four times live here.
 *
 * Console tokens only (`--wy-*`). These screens are also mounted outside
 * the customer shell -- the master console's /network/* routes and the
 * agent view (`config/customerFeatures.tsx`) -- so `scopeRootClass` puts
 * `.wy-console` on the screen's own root. Nested inside the customer shell's
 * own `.wy-console` it resolves to the same values, so it is harmless there.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Trash2, UploadCloud } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROW_REVEAL, StatusBadge, type ConsoleStatus } from "@/components/customer/console";

export type { PageScope } from "@/components/customer/console";

/** Root classes for one of these screens (see the file comment for why it
 * always carries `.wy-console`). */
export const SCREEN_ROOT = "wy-console space-y-5";

/** Portaled dialog content has to carry the console class itself. */
export const DIALOG_CONSOLE = "wy-console";

export type PushStatus = "active" | "pending" | "failed" | "provisioning";

const PUSH_TONE: Record<PushStatus, ConsoleStatus> = {
  active: "ok",
  provisioning: "info",
  // Neutral, as before: intent saved, nothing on the device yet. The Apply
  // button beside it is what draws the eye, not a warning colour.
  pending: "offline",
  failed: "crit",
};

/**
 * "Is this on the router?" -- the device-push state of one row. A failed push
 * carries the router's own words on hover (and in the accessible name), not a
 * summary: "already have such item" tells an operator what to do.
 */
export function PushStatusBadge({
  status,
  label,
  error,
  errorPrefix,
}: {
  status: PushStatus;
  /** The word for this state on this screen ("Applied", "Not yet applied"...). */
  label: string;
  /** The device's error text, for a failed push. */
  error?: string | null;
  /** Lead-in for the error tooltip, e.g. "Couldn't apply this rule to your router:". */
  errorPrefix: string;
}) {
  const badge = (
    <StatusBadge status={PUSH_TONE[status]} pulse={status === "provisioning"}>
      {label}
    </StatusBadge>
  );
  if (status !== "failed" || !error) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${label}. ${errorPrefix} ${error}`}
          className="inline-flex cursor-default rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
        >
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {errorPrefix} {error}
      </TooltipContent>
    </Tooltip>
  );
}

/** Intent, not fact: the row's own on/off switch. Neutral when off. */
export function EnabledBadge({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation("network", { i18n });
  return (
    <StatusBadge status={enabled ? "ok" : "offline"} dot={false}>
      {enabled ? t("common.enabled", "Enabled") : t("common.disabled", "Disabled")}
    </StatusBadge>
  );
}

/**
 * A row's controls: the always-visible Apply/Re-apply (the step that reaches
 * the hardware, so it never hides), then Edit and Delete, revealed on hover or
 * keyboard focus and always shown on touch.
 */
export function RowActions({
  name,
  apply,
  onEdit,
  onDelete,
}: {
  /** The row's name, for the icon buttons' accessible names. */
  name: string;
  /** Omit for a screen whose Apply is an icon among the revealed ones. */
  apply?: {
    label: string;
    pending: boolean;
    disabled?: boolean;
    /** Already on the router: a quieter button. */
    quiet: boolean;
    onClick: () => void;
    /** Icon-only, revealed with Edit/Delete (Call Priority's original layout). */
    iconOnly?: boolean;
  };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("common", { i18n });
  const applyIcon = apply?.pending ? (
    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
  ) : (
    <UploadCloud aria-hidden className="h-3.5 w-3.5" />
  );
  return (
    <>
      {apply && !apply.iconOnly && (
        <Button
          size="sm"
          variant={apply.quiet ? "ghost" : "outline"}
          disabled={apply.disabled ?? apply.pending}
          onClick={apply.onClick}
          className="gap-1"
        >
          {applyIcon}
          {apply.label}
        </Button>
      )}
      <div className={cn("flex items-center gap-1", ROW_REVEAL)}>
        {apply?.iconOnly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${apply.label}: ${name}`}
                disabled={apply.disabled ?? apply.pending}
                onClick={apply.onClick}
              >
                {applyIcon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{apply.label}</TooltipContent>
          </Tooltip>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("edit", "Edit")}: ${name}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("delete", "Delete")}: ${name}`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden className="h-3.5 w-3.5 text-[var(--wy-crit)]" />
        </Button>
      </div>
    </>
  );
}

/** The cell under a name: a secondary line, muted and truncated. */
export function NameCell({ name, sub }: { name: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 max-w-[16rem]">
      <div className="truncate font-medium">{name}</div>
      {sub ? <div className="truncate text-xs text-[var(--wy-text-muted)]">{sub}</div> : null}
    </div>
  );
}
