/**
 * The switch for the `access_point_silent` alert at an Aruba Instant On venue.
 * Off until an owner turns it on (backend `constants.py`, "never backfilled").
 *
 * The rule belongs to the organization, so it covers all its Instant On venues.
 * Silence alone never fires: an access point with no guests sends nothing. It
 * needs a guest the AP never signed off when the traffic stopped.
 *
 * All this can see is that RADIUS traffic stopped. It cannot tell a power cut
 * from a lost internet line, so the copy never says "offline" or "down". A read
 * that fails shows no switch: an unknown state must not read as "off".
 */
import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Panel } from "@/components/customer/console";
import { Switch } from "@/components/ui/switch";
import i18n from "@/lib/i18n";
import { resolveOrgId } from "@/services/customer.service";
import { monitoringService } from "@/services/monitoring.service";
import type { AlertRule } from "@/types/monitoring";

const TARGET = "access_point_silent";
const MAX_RULE_PAGES = 5;

async function findRule(organizationId: string): Promise<AlertRule | null> {
  for (let page = 1; page <= MAX_RULE_PAGES; page += 1) {
    const res = await monitoringService.listAlertRules({ organizationId, page, pageSize: 100 });
    const hit = res.items.find((rule) => rule.targetComponent === TARGET);
    if (hit) return hit;
    if (!res.hasNext) return null;
  }
  // More rules than we read: "none found" would be a guess, and turning the
  // switch on from it could create a duplicate.
  throw new Error("too many alert rules to read");
}

export function ArubaSilenceAlertCard() {
  const { t } = useTranslation("alerts", { i18n });
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rule, setRule] = useState<AlertRule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const organizationId = await resolveOrgId();
        const found = await findRule(organizationId);
        if (cancelled) return;
        setOrgId(organizationId);
        setRule(found);
        setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (on: boolean) => {
      if (!orgId) return;
      setSaving(true);
      try {
        const next = rule
          ? await monitoringService.updateAlertRule(rule.id, { isActive: on }, orgId)
          : await monitoringService.createAlertRule({
              name: "Aruba Instant On access points stopped reporting",
              organizationId: orgId,
              triggerType: "health_status_change",
              targetComponent: TARGET,
              // Guest evidence only. Open Hours stay off: a quiet open venue
              // can simply have no guests.
              conditionConfig: { expected_status: "silent", per_access_point: true },
              severity: "warning",
              isActive: true,
              notificationChannelIds: [],
            });
        setRule(next);
        toast.success(
          on
            ? t("silence.turnedOn", "Access point alert is on.")
            : t("silence.turnedOff", "Access point alert is off."),
        );
      } catch {
        toast.error(
          t("silence.saveFailed", "Could not change this alert. Nothing has changed. Try again."),
        );
      } finally {
        setSaving(false);
      }
    },
    [orgId, rule, t],
  );

  const on = rule?.isActive === true;
  const label = t("silence.switch", "Alert me when access points stop reporting");

  return (
    <div data-testid="aruba-silence-alert">
      <Panel title={label}>
        <div className="flex items-start gap-3">
          <BellRing aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wy-text-faint)]" />
          <div className="min-w-0 flex-1 space-y-1 text-xs text-[var(--wy-text-muted)]">
            <p>
              {t(
                "silence.body",
                "An alert appears on this page if your Aruba Instant On access points go quiet for 30 minutes while guests were still connected, or if one goes quiet for 2 hours while another at the venue is serving guests. Applies to all your Aruba venues.",
              )}
            </p>
            <p>
              {t(
                "silence.limits",
                "No guests means no traffic, so a quiet venue does not raise an alert, and an outage with no guests connected will not either. Wyfy can't tell a power cut from a lost internet line; check the Instant On app.",
              )}
            </p>
          </div>
          {state === "ready" && (
            <Switch
              aria-label={label}
              checked={on}
              disabled={saving}
              onCheckedChange={(next) => void toggle(next)}
            />
          )}
        </div>
        {state === "failed" && (
          <p className="mt-2 text-xs text-[var(--wy-crit)]" role="alert">
            {t(
              "silence.loadFailed",
              "Could not check whether this alert is on. Reload the page to try again.",
            )}
          </p>
        )}
      </Panel>
    </div>
  );
}
