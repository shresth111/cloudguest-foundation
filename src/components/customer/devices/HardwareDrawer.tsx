/**
 * The side drawer behind an inventory row: everything this platform knows
 * about one device, in plain words, and the actions that exist for it.
 *
 *   - Registered hardware: status + why, the check behind it, the router
 *     port it sits on and that port's link facts, the last 24 h strip and
 *     its state changes, duplicate-MAC notices, and Remove.
 *   - A venue router: its liveness verdict, the next step, last contact,
 *     model/MAC, and a jump to its traffic and load charts.
 *
 * Nothing is fetched here: the row carries its source objects.
 */
import { useState, type ReactNode } from "react";
import { Activity, MapPin, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_META } from "@/lib/device-presentation";
import { formatDuration } from "@/lib/device-liveness";
import {
  formatBps,
  formatWhen,
  type DeviceHealth,
  type DeviceHealthEvent,
} from "@/lib/hardware-health";
import { HardwareHealthDetails } from "@/components/customer/HardwareHealthDetails";
import type { InventoryRow } from "./fleet-model";
import { BUCKET_TEXT, BucketDot, MONO, relTime, useBucketLabel, useDevicesT } from "./ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-[var(--wy-border)] px-5 py-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: { k: string; v: ReactNode; mono?: boolean }[] }) {
  const shown = rows.filter((r) => r.v != null && r.v !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
      {shown.map((r) => (
        <div key={r.k} className="contents">
          <dt className="text-[var(--wy-text-muted)]">{r.k}</dt>
          <dd
            className={cn("min-w-0 break-words text-[var(--wy-text)]", r.mono && `${MONO} text-xs`)}
          >
            {r.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One event of the last 24 h in words. */
function eventWords(e: DeviceHealthEvent): string {
  const word = (s: string | null) =>
    s === "up"
      ? "Up"
      : s === "down"
        ? "Down"
        : s === "degraded"
          ? "Unstable"
          : s
            ? s
            : "Not checked";
  if (e.kind === "state") return `${word(e.fromState)} → ${word(e.toState)}`;
  if (e.kind === "link_down")
    return e.count && e.count > 1 ? `Port link dropped ${e.count}×` : "Port link dropped";
  if (e.kind === "ip_changed")
    return e.detail ? `IP address changed (${e.detail})` : "IP address changed";
  return e.kind.replace(/_/g, " ");
}

function PortFacts({ h, now }: { h: DeviceHealth; now: number }) {
  const t = useDevicesT();
  return (
    <Facts
      rows={[
        { k: t("drawer.port", "Router port"), v: h.portName, mono: true },
        {
          k: t("drawer.link", "Link"),
          v:
            h.portRunning == null
              ? null
              : h.portRunning
                ? t("drawer.linkUp", "Up (cable connected)")
                : t("drawer.linkDown", "Down (no cable link)"),
        },
        {
          k: t("drawer.lastLinkDown", "Last link drop"),
          v: h.portLastLinkDownAt ? formatWhen(h.portLastLinkDownAt, now) : null,
        },
        {
          k: t("drawer.lastLinkUp", "Link back up"),
          v: h.portLastLinkUpAt ? formatWhen(h.portLastLinkUpAt, now) : null,
        },
        {
          k: t("drawer.flaps", "Link drops, 24 h"),
          v: h.portName ? String(h.linkFlaps24h) : null,
        },
        {
          k: t("drawer.clients", "Devices on port"),
          v: h.clientsBehind != null ? String(h.clientsBehind) : null,
        },
        {
          k: t("drawer.traffic", "Traffic now"),
          v:
            h.txBps != null || h.rxBps != null
              ? `↓ ${formatBps(h.txBps ?? 0)}  ↑ ${formatBps(h.rxBps ?? 0)}`
              : null,
        },
      ]}
    />
  );
}

function CheckFacts({ h, now }: { h: DeviceHealth; now: number }) {
  const t = useDevicesT();
  return (
    <Facts
      rows={[
        { k: t("drawer.checked", "Last checked"), v: formatWhen(h.checkedAt, now) },
        {
          k: t("drawer.method", "Checked by"),
          v:
            h.probeMethod === "arp"
              ? t("drawer.methodArp", "Network-level check (ARP); it ignores ping")
              : h.probeMethod === "icmp"
                ? t("drawer.methodIcmp", "Ping")
                : null,
        },
        {
          k: t("drawer.latency", "Response time"),
          v:
            h.lastRttMs != null && h.state !== "down"
              ? `${h.lastRttMs < 1 ? "<1" : Math.round(h.lastRttMs)} ms`
              : null,
        },
        {
          k: t("drawer.lastOk", "Last answered"),
          v: h.lastOkAt && h.state !== "up" ? formatWhen(h.lastOkAt, now) : null,
        },
        {
          k: t("drawer.missed", "Missed checks in a row"),
          v: h.consecutiveFailures > 0 ? String(h.consecutiveFailures) : null,
        },
      ]}
    />
  );
}

export function HardwareDrawer({
  row,
  onOpenChange,
  onRemove,
  onShowTraffic,
  now = Date.now(),
}: {
  row: InventoryRow | null;
  onOpenChange: (open: boolean) => void;
  /** Registered hardware only. Resolves when the remove finished. */
  onRemove: (row: InventoryRow) => Promise<void>;
  /** Routers only: select this router in the traffic panel. */
  onShowTraffic: (routerId: string) => void;
  now?: number;
}) {
  const t = useDevicesT();
  const bucketLabel = useBucketLabel();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hw = row?.hardware;
  const health = hw?.health ?? null;
  const Icon = hw ? DEVICE_TYPE_META[hw.type]?.icon : DEVICE_TYPE_META.Router.icon;
  const events = health
    ? [...health.events24h].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : [];

  return (
    <Sheet
      open={row != null}
      onOpenChange={(o) => {
        if (!o) setConfirming(false);
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="right"
        className="wy-console flex w-full flex-col gap-0 overflow-y-auto border-[var(--wy-border)] bg-[var(--wy-surface)] p-0 text-[var(--wy-text)] motion-reduce:animate-none motion-reduce:transition-none sm:max-w-md"
        data-wy="hw-drawer"
      >
        {row && (
          <>
            <header className="space-y-2 px-5 pb-4 pt-5 pr-12">
              <div className="flex items-center gap-2 text-xs text-[var(--wy-text-muted)]">
                {Icon && <Icon aria-hidden className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" />}
                <span>{row.typeLabel}</span>
                {row.floor && (
                  <>
                    <span aria-hidden>·</span>
                    <MapPin aria-hidden className="h-3 w-3" />
                    <span>{row.floor}</span>
                  </>
                )}
              </div>
              <SheetTitle className="break-words text-base font-semibold leading-snug text-[var(--wy-text)]">
                {row.name}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <span className="inline-flex items-center gap-1.5">
                    <BucketDot bucket={row.bucket} label={bucketLabel(row.bucket)} />
                    <span className={cn("font-semibold", BUCKET_TEXT[row.bucket])}>
                      {row.statusWord}
                    </span>
                  </span>
                  {row.detail && <span className="text-[var(--wy-text-muted)]">{row.detail}</span>}
                </div>
              </SheetDescription>
              {row.explanation && (
                <p className="rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)] px-3 py-2 text-[13px] leading-relaxed text-[var(--wy-text-muted)]">
                  {row.explanation}
                </p>
              )}
              {row.router?.nextStep && (
                <p className="text-[13px] leading-relaxed text-[var(--wy-text)]">
                  <span className="font-medium">{t("drawer.nextStep", "What to do: ")}</span>
                  {row.router.nextStep}
                </p>
              )}
            </header>

            {health && (
              <Section title={t("drawer.check", "The check")}>
                <CheckFacts h={health} now={now} />
              </Section>
            )}

            {health && (health.portName || health.clientsBehind != null) && (
              <Section title={t("drawer.portSection", "Port and link")}>
                <PortFacts h={health} now={now} />
              </Section>
            )}

            {hw &&
              row.bucket !== "unmeasured" &&
              (health || (hw.duplicateLocations?.length ?? 0) > 0 || hw.registeredElsewhere) && (
                <Section title={t("drawer.last24", "Last 24 hours")}>
                  <HardwareHealthDetails
                    health={health}
                    duplicateLocations={hw.duplicateLocations}
                    registeredElsewhere={hw.registeredElsewhere}
                    now={now}
                    showFacts={false}
                    wide
                  />
                  {events.length > 0 && (
                    <ol
                      className="mt-2 space-y-1"
                      aria-label={t("drawer.changes", "Recent changes")}
                    >
                      {events.slice(0, 12).map((e, i) => (
                        <li key={`${e.at}-${i}`} className="flex gap-3 text-xs">
                          <span className={`${MONO} w-28 shrink-0 text-[var(--wy-text-faint)]`}>
                            {formatWhen(e.at, now)}
                          </span>
                          <span className="min-w-0 text-[var(--wy-text-muted)]">
                            {eventWords(e)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {health && events.length === 0 && (
                    <p className="text-xs text-[var(--wy-text-faint)]">
                      {t("drawer.noChanges", "No state changes in the last 24 hours.")}
                    </p>
                  )}
                </Section>
              )}

            <Section title={t("drawer.identity", "Device")}>
              <Facts
                rows={[
                  { k: t("drawer.type", "Type"), v: row.typeLabel },
                  { k: t("drawer.model", "Model"), v: row.model },
                  {
                    k: t("drawer.floor", "Floor"),
                    v:
                      row.source === "hardware"
                        ? row.floor || t("drawer.noFloor", "Not recorded")
                        : null,
                  },
                  { k: t("drawer.mac", "MAC address"), v: row.mac, mono: true },
                  {
                    k: t("drawer.uptime", "Uptime"),
                    v: row.uptimeSeconds != null ? formatDuration(row.uptimeSeconds) : null,
                  },
                  {
                    k:
                      row.source === "router"
                        ? row.router?.lastContactKind === "enrolment"
                          ? t("drawer.lastContactEnrol", "Set up")
                          : t("drawer.lastContact", "Last contact")
                        : t("drawer.lastSeen", "Last seen"),
                    v: row.lastSeenAt
                      ? `${formatWhen(row.lastSeenAt, now)} (${relTime(row.lastSeenAt, now)})`
                      : null,
                  },
                ]}
              />
            </Section>

            <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--wy-border)] px-5 py-4">
              {row.source === "router" && row.router && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onShowTraffic(row.router!.key);
                    onOpenChange(false);
                  }}
                >
                  <Activity className="h-3.5 w-3.5" />
                  {t("drawer.showTraffic", "Traffic and load")}
                </Button>
              )}
              {row.source === "hardware" &&
                (confirming ? (
                  <div className="flex w-full flex-wrap items-center gap-2" role="group">
                    <span className="mr-auto text-[13px]">
                      {t("drawer.confirm", "Remove {{name}} from this venue?", { name: row.name })}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                      {t("drawer.cancel", "Cancel")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={removing}
                      onClick={async () => {
                        setRemoving(true);
                        try {
                          await onRemove(row);
                        } finally {
                          setRemoving(false);
                          setConfirming(false);
                        }
                      }}
                    >
                      {removing ? t("drawer.removing", "Removing…") : t("drawer.remove", "Remove")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[var(--wy-crit)] hover:bg-[var(--wy-crit-soft)] hover:text-[var(--wy-crit)]"
                    aria-label={`Remove ${row.name}`}
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("drawer.remove", "Remove")}
                  </Button>
                ))}
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
