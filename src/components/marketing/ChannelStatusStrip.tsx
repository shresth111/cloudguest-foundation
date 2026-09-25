import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChannelStatus } from "@/types/marketing";
import { CHANNEL_ICON, useChannelLabel } from "./marketing-helpers";

/**
 * Three chips -- SMS, WhatsApp, Email -- each "Live" or "Not set up" with
 * the backend's own `reason` (spec §8.1, §8.2 "Channel not configured").
 *
 * `configured` is the only thing that makes a chip say Live. A provider in
 * `logging` mode is NOT live (spec D8): it logs and returns success, so a
 * campaign through it would report "sent" while nothing left the building.
 * The backend already reports that as `configured: false`; this strip adds
 * no judgement of its own.
 */
export function ChannelStatusStrip({ channels }: { channels: ChannelStatus[] }) {
  const { t } = useTranslation("marketing", { i18n });
  const label = useChannelLabel();
  const noneLive = channels.length > 0 && channels.every((c) => !c.configured);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {channels.map((c) => {
          const Icon = CHANNEL_ICON[c.channel];
          return (
            <div
              key={c.channel}
              title={c.reason ?? undefined}
              className={cn(
                "flex min-w-0 max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                c.configured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="font-medium text-foreground">{label(c.channel)}</span>
              {c.configured ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  Live
                </span>
              ) : (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                  <span className="truncate">
                    {t("notConfigured", "Not set up")}
                    {c.reason ? <span className="hidden sm:inline"> · {c.reason}</span> : null}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {noneLive && (
        <p className="text-xs text-muted-foreground">
          No channel can send yet. Wyfy support sets up each channel (sender registration and
          approvals) before it goes live; you can prepare templates and draft campaigns meanwhile.
        </p>
      )}
    </div>
  );
}
