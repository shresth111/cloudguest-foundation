/**
 * Read-only "your controller + its APs" card. Shows what the venue's Omada
 * controller actually manages -- the controller itself and every AP adopted
 * under it -- from the customer-scoped `useControllerDevices` read.
 *
 * Renders nothing when the location has no Omada controller (`no_controller`),
 * so a MikroTik venue's dashboard is unchanged. It never fabricates a device;
 * an empty `ok` says "your controller manages nothing yet", which is a
 * different, honest message from having no controller at all.
 */
import { Router, Wifi, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useControllerDevices } from "@/hooks/useControllerDevices";
import type { ControllerDeviceRow } from "@/services/controllerDevices.service";

function deviceIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("controller") || t.includes("gateway") || t.includes("router")) {
    return <Router className="h-4 w-4 text-[#4f46e5]" />;
  }
  return <Wifi className="h-4 w-4 text-[#4f46e5]" />;
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "connected" || s === "online" || s === "ok") {
    return "text-emerald-600";
  }
  if (s === "pending" || s === "provisioning" || s === "adopting") {
    return "text-amber-600";
  }
  return "text-muted-foreground";
}

function DeviceRow({ device }: { device: ControllerDeviceRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {deviceIcon(device.deviceType)}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {device.name || device.model || device.mac}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {device.model ? `${device.model} · ` : ""}
            {device.mac}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {device.clientCount != null && (
          <span className="text-muted-foreground">
            {device.clientCount} client{device.clientCount === 1 ? "" : "s"}
          </span>
        )}
        <span className={`font-medium capitalize ${statusTone(device.status)}`}>
          {device.status}
        </span>
      </div>
    </div>
  );
}

export function ControllerDevicesCard({ locationId }: { locationId?: string }) {
  const { status, devices, loading } = useControllerDevices(locationId);

  // A MikroTik venue (or one not yet onboarded to a controller) gets nothing
  // here -- the manual Network Hardware card below is unchanged for them.
  if (status === "no_controller" && !loading) {
    return null;
  }

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardHeader className="space-y-0">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Router className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              Your controller &amp; access points
            </CardTitle>
            <CardDescription>
              Devices your Omada controller manages, read from the controller itself.
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
          <div className="space-y-2">
            {devices.map((device) => (
              <DeviceRow key={device.mac} device={device} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
