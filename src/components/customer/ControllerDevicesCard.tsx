/**
 * Read-only "your controller + its access points" card -- the AP inventory
 * for a venue whose network is run by a TP-Link Omada controller.
 *
 * Renders nothing when the location has no Omada controller
 * (`no_controller`), so a MikroTik venue's Devices screen is byte-identical
 * to what it was. It never fabricates a device; an empty `ok` says "your
 * controller manages nothing yet", which is a different, honest message from
 * having no controller at all.
 *
 * ## What this surface can and cannot say, measured
 *
 * The backend reaches a controller through TP-Link's **Open API**
 * (`GET /openapi/v1/{cid}/sites/{siteId}/devices`), and that response's
 * documented schema (`DeviceInfo`) is materially poorer than the
 * controller-internal v2 grid the Omada web UI itself uses. Measured against
 * Omada Software Controller 5.15.24.19 on 2026-09-18:
 *
 *   * name, MAC, model, IP, uptime, firmware and status are all present, so
 *     every one of them is a column here;
 *   * **per-AP client counts are not** -- `DeviceInfo` has no `clientNum`,
 *     no per-radio counts and no traffic totals. Those exist, on v2 only.
 *
 * So `clientCount` arrives as `null`, and `null` is rendered as a stated
 * absence, never as `0`. "This controller's API does not report it" and
 * "this access point has no clients" are different facts, and printing
 * `0 clients` under an EAP245 serving forty guests is the worse of the two.
 * The footnote says which one the blank means.
 *
 * ## Why every status here is labelled "reported by your controller"
 *
 * Nothing on this platform pings these devices. The status word is the
 * controller's own, relayed. That matters next to the Network Hardware card
 * below it, whose statuses ARE measured (by ICMP/ARP through a RouterOS
 * uplink) at a MikroTik venue -- and are explicitly "Not measured" at this
 * one. Two liveness columns on one screen that came from different places
 * must say so. Same rule as `routerLivenessIsMeasured` in
 * `@/lib/router-vendors`.
 *
 * Read-only, and there is no write counterpart by design: the customer
 * observes their controller, never operates it. No radio, channel, power or
 * firmware control appears here or is promised anywhere near it.
 */
import { Router, Wifi, AlertTriangle, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { useControllerDevices } from "@/hooks/useControllerDevices";
import { formatDuration } from "@/lib/device-liveness";
import { cn } from "@/lib/utils";
import type { ControllerDeviceRow } from "@/services/controllerDevices.service";

/** Em dash, for a field the controller did not send. Never `0`, never "—"
 * standing in for a zero: this is absence, and the footnotes name it. */
const ABSENT = "—";

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "connected" || s === "online" || s === "ok") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (s === "pending" || s === "provisioning" || s === "adopting") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (s === "disconnected" || s === "offline") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  return "border-border bg-muted text-muted-foreground";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      // The title is where "who says so" lives, so the badge itself stays
      // short enough to scan a column of them.
      title="Reported by your Omada controller. This platform does not probe these devices."
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
        statusTone(status),
      )}
    >
      {status}
    </span>
  );
}

function AccessPointTable({ devices }: { devices: ControllerDeviceRow[] }) {
  // One decision for the whole column, not per row: if this controller's API
  // reports no client counts at all, the column would be a wall of dashes
  // that reads as broken. Drop it and say why in the footnote instead.
  const anyClientCount = devices.some((d) => d.clientCount != null);
  const anyUptime = devices.some((d) => d.uptimeSeconds != null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Access point</TableHead>
            <TableHead>MAC</TableHead>
            <TableHead>IP</TableHead>
            {anyClientCount && <TableHead>Clients</TableHead>}
            <TableHead>Uptime</TableHead>
            <TableHead>Firmware</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.mac}>
              <TableCell>
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white">
                    <Wifi className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{device.name || device.mac}</span>
                    {device.model && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {device.model}
                      </span>
                    )}
                  </span>
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {device.mac}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {device.ipAddress ?? ABSENT}
              </TableCell>
              {anyClientCount && (
                <TableCell className="text-xs text-muted-foreground">
                  {device.clientCount ?? ABSENT}
                </TableCell>
              )}
              <TableCell className="text-xs text-muted-foreground">
                {device.uptimeSeconds != null ? formatDuration(device.uptimeSeconds) : ABSENT}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {device.firmwareVersion ?? ABSENT}
              </TableCell>
              <TableCell>
                <StatusBadge status={device.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="space-y-1 px-1 pt-3 text-[11px] text-muted-foreground">
        <p>
          Status, uptime and firmware here are reported by your Omada controller. This platform
          doesn&apos;t ping these access points itself.
        </p>
        {!anyClientCount && (
          <p>
            Per-access-point client counts aren&apos;t available from your controller&apos;s API, so
            they aren&apos;t shown. Your total client count is on the Dashboard.
          </p>
        )}
        {!anyUptime && <p>Your controller didn&apos;t report an uptime for these devices.</p>}
      </div>
    </>
  );
}

function InfrastructureRow({ device }: { device: ControllerDeviceRow }) {
  const isSwitch = device.deviceType.toLowerCase() === "switch";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {isSwitch ? (
          <Network className="h-4 w-4 text-[#4f46e5]" />
        ) : (
          <Router className="h-4 w-4 text-[#4f46e5]" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {device.name || device.model || device.mac}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {device.model ? `${device.model} · ` : ""}
            {device.mac}
            {device.ipAddress ? ` · ${device.ipAddress}` : ""}
          </p>
        </div>
      </div>
      <StatusBadge status={device.status} />
    </div>
  );
}

/**
 * The controller inventory is fetched by the PARENT (`NetworkHardwareView`)
 * and handed down, rather than fetched here.
 *
 * Both cards on that screen need the answer -- this one to list the APs, the
 * manual Network Hardware card to explain why its own rows read "Not
 * measured" -- and a second `useControllerDevices()` here would issue a
 * second identical GET on every render of the page. One owner, one request.
 */
export function ControllerDevicesCard({
  inventory,
}: {
  inventory: ReturnType<typeof useControllerDevices>;
}) {
  const { status, devices, loading } = inventory;

  // A MikroTik venue (or one not yet onboarded to a controller) gets nothing
  // here -- the manual Network Hardware card below is unchanged for them.
  if (status === "no_controller" && !loading) {
    return null;
  }

  // "ap" is the vendor-neutral type the gateway normalizes every Omada
  // device class to (`normalize_device_type`); an unrecognised class becomes
  // "unknown" and lands below rather than being guessed into the AP table.
  const accessPoints = devices.filter((d) => d.deviceType.toLowerCase() === "ap");
  const infrastructure = devices.filter((d) => d.deviceType.toLowerCase() !== "ap");

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardHeader className="space-y-0">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Wifi className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              Access points at this location
            </CardTitle>
            <CardDescription>
              Every device your Omada controller manages here, read from the controller itself. View
              only — this platform never changes your controller&apos;s settings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Reading your controller…</p>
        ) : status === "unreachable" ? (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Couldn&apos;t reach your controller just now. This view is read-only and will refresh
              when it&apos;s back.
            </span>
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your controller is connected but isn&apos;t managing any devices yet.
          </p>
        ) : (
          <div className="space-y-4">
            {accessPoints.length > 0 ? (
              <AccessPointTable devices={accessPoints} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your controller is connected but hasn&apos;t adopted any access points yet.
              </p>
            )}
            {infrastructure.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Other devices on your controller
                </p>
                {infrastructure.map((device) => (
                  <InfrastructureRow key={device.mac} device={device} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
