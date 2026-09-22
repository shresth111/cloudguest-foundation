import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "../SectionCard";

/**
 * Notification settings -- a signpost, not a form.
 *
 * ## What this used to be, and why it is gone
 *
 * This panel rendered six channel toggles, a **Slack webhook URL** input and
 * a generic **webhook endpoint** input, above a Save button that raised
 * `toast.success("Notifications updated")`.
 *
 * None of it was wired to anything. `settingsService.updateSection` is
 * `await delay(250)` followed by a mutation of a module-level `state` object
 * (see the note at the top of `services/settings.service.ts`: every slice of
 * `PlatformSettings` except API keys "has no matching backend domain and
 * stays an in-memory mock"). The value did not survive a page refresh, let
 * alone reach a database.
 *
 * For five of the six toggles that was merely useless. For the Slack webhook
 * field it was a **credential trap**: a Slack incoming-webhook URL is
 * bearer-equivalent -- anyone holding it can post into that channel -- and
 * this screen invited an operator to paste one, told them it was saved, and
 * dropped it. The believable failure is not that alerts never arrive; it is
 * that someone rotates a webhook here, believes the old one is replaced, and
 * leaves the real one live somewhere else.
 *
 * ## Why this is a signpost rather than a working form
 *
 * The obvious fix -- make the save real -- is the wrong one, because the
 * thing it would save already has a home. `POST /api/v1/notifications/channels`
 * stores a Slack/Teams/Discord/webhook destination Fernet-encrypted at rest,
 * scoped to an organization, delivers through a real `SlackNotifier`, records
 * every attempt in `notification_logs`, and can be proved with a test send
 * before anyone relies on it. That mechanism is reachable from
 * **Monitoring -> Notifications** today.
 *
 * Making this panel real would have been a *second* place to configure the
 * same webhook, and a second place is exactly how this codebase arrived at
 * several independent Slack credential paths at once. Deleting the duplicate
 * is the smaller change and the correct one.
 *
 * The tab itself is kept deliberately. Removing it would read as a lost
 * feature to anyone who used to find this screen; an honest tab that names
 * where the setting actually lives is a better answer than an absence.
 */
export function NotificationsPanel() {
  return (
    <SectionCard
      title="Notifications"
      description="Alert destinations are configured as notification channels, not here."
    >
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">
              Slack, Teams, Discord, webhook, email and SMS destinations live under Monitoring.
            </p>
            <p className="text-muted-foreground">
              Each destination is stored encrypted, belongs to one organization, and keeps a
              delivery record, so a channel that stops working says so instead of going quiet. You
              can send a test message to prove a webhook before an alert depends on it.
            </p>
            <p className="text-muted-foreground">
              This screen previously offered its own Slack webhook field. It saved nothing — the
              value was held in the browser and lost on refresh — so it has been removed rather than
              left looking like it worked. If you pasted a webhook here, it was never stored and
              does not need revoking on our side.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/monitoring">
            Go to Monitoring → Notifications
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </SectionCard>
  );
}
