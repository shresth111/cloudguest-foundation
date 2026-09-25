import { useState } from "react";
import { AlertTriangle, Ban, CalendarClock, Pencil, Send, Trash2, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useCancelCampaign,
  useDeleteCampaign,
  useMarketingCampaign,
  useUnscheduleCampaign,
} from "@/hooks/useMarketing";
import type { MarketingCampaign, MarketingStatus } from "@/types/marketing";
import { CampaignStatusTag, ChannelTag, StatTile } from "../marketing-ui";
import {
  EXCLUSION_LABEL,
  formatDateTime,
  marketingErrorMessage,
  useMarketingCan,
} from "../marketing-helpers";
import { RecipientsTable } from "./RecipientsTable";
import { ScheduleDialog, TestSendDialog } from "./CampaignActions";
import { CampaignComposerSheet } from "./CampaignComposerSheet";

const CANCEL_REASON: Record<string, string> = {
  user: "Cancelled by your team.",
  addon_locked: "Cancelled because the Marketing add-on was locked for your organisation.",
  channel_unconfigured: "Cancelled because the channel stopped being available.",
};

const VARIABLE_LABEL: Record<string, string> = {
  offer_code: "Offer code",
  offer_expiry: "Valid till",
  event_name: "Event",
  event_date: "Event date",
  booking_link: "Booking link",
};

/**
 * One campaign (spec §8.1 CampaignDetailSheet, opened by `?campaign=id`):
 * status and timing, stat tiles, who was left out at dispatch, the
 * recipients log, and the actions its status allows (§5.5 state machine).
 *
 * "Accepted by provider" is the headline number, not "Delivered": no MVP
 * provider reports delivery (`delivered_is_tracked` is false), carriers
 * silently drop promotional SMS to DND numbers, and a Delivered % built on
 * that would be a number this platform cannot stand behind.
 */
export function CampaignDetailSheet({
  campaignId,
  status,
  locationId,
  onClose,
}: {
  campaignId: string | null;
  status: MarketingStatus;
  locationId: string | null;
  onClose: () => void;
}) {
  const can = useMarketingCan();
  const q = useMarketingCampaign(campaignId);
  const c = q.data;
  const cancel = useCancelCampaign();
  const unschedule = useUnscheduleCampaign();
  const remove = useDeleteCampaign();
  const [testOpen, setTestOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later" | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string, fail: string, after?: () => void) => {
    try {
      await fn();
      toast.success(ok);
      after?.();
    } catch (err) {
      toast.error(marketingErrorMessage(err, fail));
      void q.refetch();
    }
  };

  const started = !!c && c.status !== "draft" && c.status !== "scheduled";
  const ex = c?.stats.excluded_at_dispatch;

  return (
    <Sheet open={!!campaignId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {q.isLoading ? (
          <div className="pt-8">
            <LoadingSkeleton rows={6} />
          </div>
        ) : q.isError ? (
          <div className="pt-8">
            <ErrorState
              title="Couldn't load this campaign"
              description={marketingErrorMessage(q.error)}
              onRetry={() => void q.refetch()}
            />
          </div>
        ) : c ? (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle className="pr-6">{c.name}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <CampaignStatusTag status={c.status} />
                  <ChannelTag channel={c.channel} />
                  <span className="text-xs">{c.template.name}</span>
                </div>
              </SheetDescription>
            </SheetHeader>

            <Timeline c={c} />

            {c.last_error && (
              <p className="flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {c.last_error}
              </p>
            )}
            {c.status === "cancelled" && c.cancel_reason && (
              <p className="rounded-md bg-muted p-2 text-sm">
                {CANCEL_REASON[c.cancel_reason] ?? c.cancel_reason}
              </p>
            )}
            {c.paused_until && c.status === "sending" && (
              <p className="rounded-md bg-muted p-2 text-sm">
                Paused for quiet hours; resumes {formatDateTime(c.paused_until)}.
              </p>
            )}

            {Object.keys(c.variables ?? {}).length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                {Object.entries(c.variables).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{VARIABLE_LABEL[k] ?? k}</dt>
                    <dd className="break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {/* Actions allowed by the state machine (§5.5), and only those
                the caller's role holds (§8.2). */}
            <div className="flex flex-wrap gap-2">
              {c.status === "draft" && can("update") && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              {c.status !== "cancelled" && can("execute") && (
                <Button variant="outline" onClick={() => setTestOpen(true)}>
                  <Send className="h-4 w-4" /> Send a test
                </Button>
              )}
              {c.status === "draft" && can("execute") && (
                <>
                  <Button variant="outline" onClick={() => setScheduleMode("later")}>
                    <CalendarClock className="h-4 w-4" /> Schedule
                  </Button>
                  <Button onClick={() => setScheduleMode("now")}>
                    <Zap className="h-4 w-4" /> Send now
                  </Button>
                </>
              )}
              {c.status === "scheduled" && can("execute") && (
                <Button
                  variant="outline"
                  disabled={unschedule.isPending}
                  onClick={() =>
                    void act(
                      () => unschedule.mutateAsync(c.id),
                      "Moved back to drafts",
                      "Couldn't unschedule.",
                    )
                  }
                >
                  <Undo2 className="h-4 w-4" /> Unschedule
                </Button>
              )}
              {(c.status === "scheduled" || c.status === "sending") && can("execute") && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setConfirm("cancel")}
                >
                  <Ban className="h-4 w-4" /> Cancel
                </Button>
              )}
              {(c.status === "draft" || c.status === "cancelled") && can("delete") && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirm("delete")}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>

            {started ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatTile
                    label="Recipients"
                    value={c.stats.recipients}
                    hint="Opted in when sending started"
                  />
                  <StatTile label="Accepted by provider" value={c.stats.submitted} tone="good" />
                  {c.stats.delivered_is_tracked ? (
                    <StatTile label="Delivered" value={c.stats.delivered} tone="good" />
                  ) : (
                    <StatTile label="Delivered" value={null} hint="Not reported by this provider" />
                  )}
                  <StatTile label="Waiting" value={c.stats.pending} />
                  <StatTile
                    label="Failed"
                    value={c.stats.failed}
                    tone={c.stats.failed ? "bad" : "default"}
                  />
                  <StatTile
                    label="Skipped"
                    value={c.stats.skipped}
                    tone={c.stats.skipped ? "warn" : "default"}
                    hint="Opted out or blocked after the start"
                  />
                </div>
                {ex && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Left out when sending started
                    </p>
                    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
                      {Object.entries(ex).map(([k, n]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted-foreground">{EXCLUSION_LABEL[k] ?? k}</dt>
                          <dd className="text-right tabular-nums">{n.toLocaleString()}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                <RecipientsTable campaignId={c.id} live={c.status === "sending"} />
              </>
            ) : (
              <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                {c.status === "scheduled"
                  ? "Recipients are picked when sending starts, from guests who are opted in at that moment. Numbers appear here then."
                  : "This is a draft. Nothing has been sent."}
              </p>
            )}

            <TestSendDialog campaign={c} open={testOpen} onOpenChange={setTestOpen} />
            <ScheduleDialog
              campaign={c}
              status={status}
              mode={scheduleMode ?? "later"}
              open={scheduleMode !== null}
              onOpenChange={(o) => !o && setScheduleMode(null)}
              onScheduled={() => void q.refetch()}
            />
            <CampaignComposerSheet
              open={editOpen}
              onOpenChange={setEditOpen}
              status={status}
              locationId={locationId}
              draft={c}
            />
            <ConfirmDialog
              open={confirm === "cancel"}
              onOpenChange={(o) => !o && setConfirm(null)}
              title="Cancel this campaign?"
              description="Messages already accepted by the provider can't be recalled. Everyone still waiting is skipped."
              confirmLabel="Cancel campaign"
              cancelLabel="Keep it"
              destructive
              onConfirm={() =>
                void act(() => cancel.mutateAsync(c.id), "Campaign cancelled", "Couldn't cancel.")
              }
            />
            <ConfirmDialog
              open={confirm === "delete"}
              onOpenChange={(o) => !o && setConfirm(null)}
              title={`Delete “${c.name}”?`}
              confirmLabel="Delete"
              destructive
              onConfirm={() =>
                void act(
                  () => remove.mutateAsync(c.id),
                  "Campaign deleted",
                  "Couldn't delete.",
                  onClose,
                )
              }
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Timeline({ c }: { c: MarketingCampaign }) {
  const rows: [string, string | null][] = [
    ["Created", c.created_at],
    ["Scheduled for", c.scheduled_at],
    ["Started", c.started_at],
    ["Finished", c.completed_at],
    ["Cancelled", c.cancelled_at],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {rows
        .filter(([, v]) => !!v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{formatDateTime(v)}</dd>
          </div>
        ))}
      {c.created_by && (
        <div className="contents">
          <dt className="text-muted-foreground">By</dt>
          <dd>{c.created_by.name}</dd>
        </div>
      )}
    </dl>
  );
}
