/**
 * What the Instant On app itself reports for an Aruba Instant On venue: access
 * points, devices and networks inside the Access points card, and alerts and
 * events on the Alerts page. Mounted only at a NAS-only venue, and shows nothing
 * until the venue's Instant On reads are switched on. After that, a read the
 * backend can't vouch for says unavailable, never a zero.
 */
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/customer/console";
import { useInstantOnView } from "@/hooks/useInstantOnView";
import i18n from "@/lib/i18n";
import { relativeTime } from "@/lib/friendly";
import {
  instantOnLabel,
  toInstantOnAlerts,
  toInstantOnAps,
  toInstantOnClients,
  toInstantOnEvents,
  toInstantOnSsids,
  type InstantOnView,
} from "@/lib/instant-on-views";

const EVENTS_SHOWN = 10;

function Row({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="flex items-center justify-between gap-3" data-testid={testid}>
      <span className="text-[var(--wy-text-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--wy-text)]">{value}</span>
    </div>
  );
}

function shown<T>(v: InstantOnView<T>, ok: (items: T[]) => string): string {
  return v.status === "ok" ? ok(v.items) : v.status === "loading" ? "…" : "—";
}

/** Inside the Access points card. */
export function InstantOnVenueData({ locationId }: { locationId: string }) {
  const { t } = useTranslation("dashboard", { i18n });
  const aps = useInstantOnView(locationId, "access-points", toInstantOnAps);
  const clients = useInstantOnView(locationId, "clients", toInstantOnClients);
  const ssids = useInstantOnView(locationId, "ssids", toInstantOnSsids);
  const views = [aps, clients, ssids];
  if (views.every((v) => v.status === "off")) return null;
  const allUnavailable = views.every((v) => v.status === "unavailable");
  const unavailable = t("aruba.instantOnUnavailable", "Data unavailable · source Instant On");
  return (
    <div
      className="space-y-1.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] px-3 py-2.5 text-xs"
      data-testid="instant-on-venue-data"
    >
      <p className="font-medium text-[var(--wy-text)]">
        {t("aruba.fromInstantOn", "Reported by the access points")}
      </p>
      {allUnavailable ? (
        <p className="text-[var(--wy-text-muted)]" data-testid="instant-on-unavailable">
          {unavailable}
        </p>
      ) : (
        <>
          <Row
            label={t("aruba.accessPoints", "Access points")}
            value={shown(aps, (items) =>
              t("aruba.apsOnline", "{{online}} of {{total}} online", {
                online: items.filter((a) => a.status === "online").length,
                total: items.length,
              }),
            )}
            testid="instant-on-aps"
          />
          <Row
            label={t("aruba.devicesConnected", "Devices connected")}
            value={shown(clients, (items) => items.length.toLocaleString())}
            testid="instant-on-clients"
          />
          <Row
            label={t("aruba.wifiNetworks", "WiFi networks")}
            value={shown(ssids, (items) =>
              items.length
                ? items.map((s) => s.name).join(", ")
                : t("aruba.noneListed", "None listed"),
            )}
            testid="instant-on-ssids"
          />
        </>
      )}
    </div>
  );
}

/** On the Alerts page, above this platform's own alerts. */
export function InstantOnActivityPanels({ locationId }: { locationId: string }) {
  const { t } = useTranslation("alerts", { i18n });
  const alerts = useInstantOnView(locationId, "alerts", toInstantOnAlerts);
  const events = useInstantOnView(locationId, "events", toInstantOnEvents);
  const unavailable = t("instantOn.unavailable", "Data unavailable · source Instant On");
  return (
    <>
      {alerts.status !== "off" && (
        <div data-testid="instant-on-alerts">
          <Panel title={t("instantOn.alertsTitle", "Alerts for the access points")}>
            {alerts.status === "loading" ? (
              <div className="h-10 animate-pulse rounded-[var(--wy-radius)] bg-muted" />
            ) : alerts.status === "unavailable" ? (
              <p
                className="text-xs text-[var(--wy-text-muted)]"
                data-testid="instant-on-alerts-unavailable"
              >
                {unavailable}
              </p>
            ) : alerts.items.length === 0 ? (
              <p className="text-xs text-[var(--wy-text-muted)]">
                {t("instantOn.noAlerts", "No alerts reported for the access points.")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--wy-border)] text-xs">
                {alerts.items.map((a, i) => (
                  <li
                    key={`${a.type}-${a.raisedAt ?? i}`}
                    className="flex items-center justify-between gap-3 py-2"
                    data-testid="instant-on-alert-row"
                  >
                    <span className="font-medium text-[var(--wy-text)]">
                      {instantOnLabel(a.type)}
                      {a.deviceName ? ` · ${a.deviceName}` : ""}
                    </span>
                    <span className="shrink-0 text-[var(--wy-text-muted)]">
                      {a.cleared
                        ? t("instantOn.cleared", "Cleared")
                        : (a.severity ?? t("instantOn.active", "Active"))}
                      {a.raisedAt ? ` · ${relativeTime(a.raisedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
      {events.status !== "off" && (
        <div data-testid="instant-on-events">
          <Panel
            title={t("instantOn.eventsTitle", "Recent events for the access points")}
            description={t(
              "instantOn.eventsCaption",
              "Only the latest events Instant On keeps. This is not a full history.",
            )}
          >
            {events.status === "loading" ? (
              <div className="h-10 animate-pulse rounded-[var(--wy-radius)] bg-muted" />
            ) : events.status === "unavailable" ? (
              <p
                className="text-xs text-[var(--wy-text-muted)]"
                data-testid="instant-on-events-unavailable"
              >
                {unavailable}
              </p>
            ) : events.items.length === 0 ? (
              <p className="text-xs text-[var(--wy-text-muted)]">
                {t("instantOn.noEvents", "Instant On reports no recent events.")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--wy-border)] text-xs">
                {events.items.slice(0, EVENTS_SHOWN).map((e, i) => (
                  <li
                    key={e.id ?? `${e.event}-${i}`}
                    className="flex items-center justify-between gap-3 py-2"
                    data-testid="instant-on-event-row"
                  >
                    <span className="font-medium text-[var(--wy-text)]">
                      {instantOnLabel(e.event)}
                      {e.networkName ? ` · ${e.networkName}` : ""}
                    </span>
                    <span className="shrink-0 text-[var(--wy-text-muted)]">
                      {e.occurredAt ? relativeTime(e.occurredAt) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
