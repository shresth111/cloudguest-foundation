/**
 * Fix a Problem at an Aruba Instant On venue. Wyfy has no router or controller
 * API here, so the page leads with what it does know (guest activity through
 * each access point), then the guest lookup, then what to try for each complaint.
 * Idle is not "down": an access point with no guests sends nothing.
 */
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, StatusBadge } from "@/components/customer/console";
import { useArubaAccessPoints } from "@/hooks/useArubaAccessPoints";
import i18n from "@/lib/i18n";
import { relativeTime } from "@/lib/friendly";
import { arubaVenueStatus } from "@/lib/aruba-dashboard";

const INSTANT_ON_PORTAL = "https://portal.instant-on.hpe.com/";

function Fact({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)] px-3 py-2">
      <p className="text-[11px] font-medium text-[var(--wy-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--wy-text)]" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

export function ArubaVenueStatusCard({
  locationId,
  guestsOnline,
}: {
  locationId?: string;
  guestsOnline: number | null;
}) {
  const { t } = useTranslation("fixProblem", { i18n });
  const state = useArubaAccessPoints(locationId);
  const status = arubaVenueStatus(state, relativeTime);
  return (
    <div data-testid="aruba-fix-status">
      <Panel
        title={status.title}
        actions={
          <StatusBadge status={status.tone === "live" ? "ok" : "offline"}>
            {status.badge}
          </StatusBadge>
        }
        bodyClassName="space-y-3"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Fact
            label={t("aruba.guestsNow", "Guests online now")}
            value={guestsOnline === null ? "—" : String(guestsOnline)}
            testId="aruba-fix-guests"
          />
          <Fact
            label={t("aruba.accessPoints", "Access points")}
            value={status.accessPoints}
            testId="aruba-fix-aps"
          />
          <Fact
            label={t("aruba.lastActivity", "Last guest activity")}
            value={status.lastActivity}
            testId="aruba-fix-activity"
          />
        </div>
        <p className="text-xs text-[var(--wy-text-muted)]">
          {t(
            "aruba.statusNote",
            "This comes from guests signing in, not from the access point itself. Idle can just mean nobody is connected. To see whether an access point is powered on, open the Instant On app.",
          )}
        </p>
      </Panel>
    </div>
  );
}

// Copy lives in fixProblem.json under aruba.help.<id>: title and step1..stepN.
const HELP = [
  { id: "noNetwork", steps: 2 },
  { id: "noLoginPage", steps: 3 },
  { id: "noCode", steps: 2 },
  { id: "noInternet", steps: 3 },
  { id: "slow", steps: 2 },
  { id: "oneSite", steps: 2 },
] as const;

export function ArubaWifiHelp() {
  const { t } = useTranslation("fixProblem", { i18n });
  return (
    <div data-testid="aruba-fix-help">
      <Panel
        title={t("aruba.helpTitle", "What's the guest seeing?")}
        actions={
          <a
            href={INSTANT_ON_PORTAL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--wy-accent)] hover:underline"
          >
            {t("aruba.openApp", "Open Instant On")}
            <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        }
      >
        <div className="divide-y divide-[var(--wy-border)]">
          {HELP.map((item) => (
            <details key={item.id} className="group py-2.5">
              <summary className="cursor-pointer text-sm font-medium text-[var(--wy-text)]">
                {t(`aruba.help.${item.id}.title`)}
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-[var(--wy-text-muted)]">
                {Array.from({ length: item.steps }, (_, i) => (
                  <li key={i}>{t(`aruba.help.${item.id}.step${i + 1}`)}</li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}
