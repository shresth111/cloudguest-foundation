/**
 * The customer's view of an Aruba Instant On venue -- the counterpart of the
 * Omada venue's controller card (`ControllerDevicesCard`), for a vendor this
 * platform has NO API to.
 *
 * What it may show is exactly what Wyfy really knows about such a venue: its
 * own guest-session records (people online now, sign-ins today, the latest
 * sign-in). It never lists access points, never shows an AP or venue as
 * online/offline (PM_SPEC §0.4 item 5, §2.3: "Set up in Instant On", tone
 * neutral), never calls the Instant On cloud, and never prints a stand-in
 * zero: when the sessions read failed, the numbers read "—".
 *
 * Customer copy only names the Instant On app -- never RADIUS, NAS, the hub,
 * a public IP or a secret (`cloudguest_wireguard_customer_scope`).
 *
 * Data source: `useCustomerDashboard` (`GET /guest-sessions` for the last 24
 * hours, plus `/guests`), the same query and cache entry the dashboard home
 * already reads -- no new endpoint.
 */
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Panel, StatusBadge } from "@/components/customer/console";
import { useCustomerDashboard } from "@/hooks/useCustomerDashboard";
import { CONTROLLER_STATE_COPY, CONTROLLER_STATE_NEXT_STEP } from "@/lib/router-vendors";
import { ARUBA_VENUE_IN_INSTANT_ON, ARUBA_VENUE_IN_WYFY, arubaVenueStats } from "@/lib/aruba-venue";

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
        {label}
      </p>
      <p
        className="mt-1 text-base font-semibold tabular-nums text-[var(--wy-text)]"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

export function ArubaInstantOnVenueCard({ locationId }: { locationId: string }) {
  const { t } = useTranslation("dashboard", { i18n });
  const { data, isError, isLoading } = useCustomerDashboard(locationId);
  const copy = CONTROLLER_STATE_COPY.no_controller_api;
  const stats = isLoading
    ? { online: "…", today: "…", lastSignIn: "…" }
    : arubaVenueStats(data, isError);
  return (
    <div className="h-full" data-testid="aruba-venue-card">
      <Panel
        className="h-full"
        title={t("aruba.venueTitle", "Aruba Instant On access points")}
        actions={
          // Neutral grey on purpose: "set up in Instant On" is not a fault
          // and not a health claim (PM_SPEC §2.3).
          <span title={copy.sentence}>
            <StatusBadge status="offline">{copy.label}</StatusBadge>
          </span>
        }
        bodyClassName="space-y-4"
      >
        <p className="text-xs text-[var(--wy-text-muted)]">{copy.sentence}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat
            label={t("aruba.guestsOnlineNow", "Guests online now")}
            value={stats.online}
            testId="aruba-online"
          />
          <Stat
            label={t("aruba.signInsToday", "Sign-ins today")}
            value={stats.today}
            testId="aruba-today"
          />
          <Stat
            label={t("aruba.lastSignIn", "Last guest sign-in")}
            value={stats.lastSignIn}
            testId="aruba-last"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-[var(--wy-text)]">
              {t("aruba.managedHere", "Managed here, in Wyfy")}
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-[var(--wy-text-muted)]">
              {ARUBA_VENUE_IN_WYFY.map((x, i) => (
                <li key={x}>{t(`aruba.inWyfy${i + 1}`, x)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-[var(--wy-text)]">
              {t("aruba.managedInApp", "Managed in the Instant On app")}
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-[var(--wy-text-muted)]">
              {ARUBA_VENUE_IN_INSTANT_ON.map((x, i) => (
                <li key={x}>{t(`aruba.inApp${i + 1}`, x)}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-[var(--wy-text-muted)]">
          {CONTROLLER_STATE_NEXT_STEP.no_controller_api}
        </p>
      </Panel>
    </div>
  );
}
