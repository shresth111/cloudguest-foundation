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
import { Router, Wifi, Network } from "lucide-react";
import {
  Callout,
  DataTable,
  Panel,
  StatusBadge,
  type DataTableColumn,
} from "@/components/customer/console";
import type { ConsoleStatus } from "@/components/customer/console";
import type { useControllerDevices } from "@/hooks/useControllerDevices";
import { formatDuration } from "@/lib/device-liveness";
import type { ControllerDeviceRow } from "@/services/controllerDevices.service";

/** Em dash, for a field the controller did not send. Never `0`, never "—"
 * standing in for a zero: this is absence, and the footnotes name it. */
const ABSENT = "—";

/** The controller's own status word -> console tone. An unrecognised word is
 * neutral grey, never a fault. */
function statusTone(status: string): ConsoleStatus {
  const s = status.toLowerCase();
  if (s === "connected" || s === "online" || s === "ok") return "ok";
  if (s === "pending" || s === "provisioning" || s === "adopting") return "warn";
  if (s === "disconnected" || s === "offline") return "crit";
  return "offline";
}

function ControllerStatus({ status }: { status: string }) {
  return (
    // The title is where "who says so" lives, so the badge itself stays
    // short enough to scan a column of them.
    <span title="Reported by your Omada controller. This platform does not probe these devices.">
      <StatusBadge status={statusTone(status)} className="capitalize">
        {status}
      </StatusBadge>
    </span>
  );
}

const MUTED_CELL = "text-xs text-[var(--wy-text-muted)]";

function AccessPointTable({ devices }: { devices: ControllerDeviceRow[] }) {
  // One decision for the whole column, not per row: if this controller's API
  // reports no client counts at all, the column would be a wall of dashes
  // that reads as broken. Drop it and say why in the footnote instead.
  const anyClientCount = devices.some((d) => d.clientCount != null);
  const anyUptime = devices.some((d) => d.uptimeSeconds != null);

  const columns: DataTableColumn<ControllerDeviceRow>[] = [
    {
      id: "name",
      header: "Access point",
      mobile: "title",
      className: "whitespace-normal",
      cell: (device) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--wy-radius)] bg-[var(--wy-accent-soft)] text-[var(--wy-accent)]"
          >
            <Wifi className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{device.name || device.mac}</span>
            {device.model && (
              <span className="block text-[11px] font-normal text-[var(--wy-text-faint)]">
                {device.model}
              </span>
            )}
          </span>
        </span>
      ),
    },
    { id: "mac", header: "MAC", mono: true, cell: (device) => device.mac },
    { id: "ip", header: "IP", mono: true, cell: (device) => device.ipAddress ?? ABSENT },
    ...(anyClientCount
      ? [
          {
            id: "clients",
            header: "Clients",
            className: MUTED_CELL,
            cell: (device: ControllerDeviceRow) => device.clientCount ?? ABSENT,
          },
        ]
      : []),
    {
      id: "uptime",
      header: "Uptime",
      className: MUTED_CELL,
      cell: (device) =>
        device.uptimeSeconds != null ? formatDuration(device.uptimeSeconds) : ABSENT,
    },
    {
      id: "firmware",
      header: "Firmware",
      className: MUTED_CELL,
      visibleFrom: "lg",
      cell: (device) => device.firmwareVersion ?? ABSENT,
    },
    {
      id: "status",
      header: "Status",
      cell: (device) => <ControllerStatus status={device.status} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={devices}
        rowKey={(device) => device.mac}
        ariaLabel="Access points at this location"
      />
      <div className="space-y-1 pt-3 text-[11px] text-[var(--wy-text-faint)]">
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
    <div className="flex items-center justify-between gap-3 rounded-[var(--wy-radius)] border border-[var(--wy-border)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {isSwitch ? (
          <Network aria-hidden className="h-4 w-4 shrink-0 text-[var(--wy-text-faint)]" />
        ) : (
          <Router aria-hidden className="h-4 w-4 shrink-0 text-[var(--wy-text-faint)]" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">
            {device.name || device.model || device.mac}
          </p>
          <p className="truncate text-xs text-[var(--wy-text-muted)]">
            {device.model ? `${device.model} · ` : ""}
            <span className="font-[family-name:var(--wy-font-mono)]">{device.mac}</span>
            {device.ipAddress ? ` · ${device.ipAddress}` : ""}
          </p>
        </div>
      </div>
      <ControllerStatus status={device.status} />
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
    <Panel
      className="mb-4"
      title="Access points at this location"
      description="Read from your Omada controller. View only — this platform never changes your controller's settings."
    >
      <p className="sr-only">
        Every device your Omada controller manages here, read from the controller itself.
      </p>
      {loading ? (
        <p role="status" className="text-[13px] text-[var(--wy-text-muted)]">
          Reading your controller…
        </p>
      ) : status === "unreachable" ? (
        <Callout tone="warn">
          Couldn&apos;t reach your controller just now. This view is read-only and will refresh when
          it&apos;s back.
        </Callout>
      ) : devices.length === 0 ? (
        <p className="text-[13px] text-[var(--wy-text-muted)]">
          Your controller is connected but isn&apos;t managing any devices yet.
        </p>
      ) : (
        <div className="space-y-4">
          {accessPoints.length > 0 ? (
            <AccessPointTable devices={accessPoints} />
          ) : (
            <p className="text-[13px] text-[var(--wy-text-muted)]">
              Your controller is connected but hasn&apos;t adopted any access points yet.
            </p>
          )}
          {infrastructure.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
                Other devices on your controller
              </p>
              {infrastructure.map((device) => (
                <InfrastructureRow key={device.mac} device={device} />
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
