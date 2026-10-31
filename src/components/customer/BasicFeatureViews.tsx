/**
 * Compact, reusable customer feature views (Dashboard, Users, Analytics,
 * Devices, Audit, Help) shared by the agent dynamic dashboard. Token-driven
 * (Aurora Teal). Mock data -- the seam a per-location API call replaces.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  Activity,
  CheckCircle2,
  Wifi,
  XCircle,
  AlertTriangle,
  Printer,
  Router,
  Camera,
  HardDrive,
  Plus,
  Tag,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ControllerDevicesCard } from "@/components/customer/ControllerDevicesCard";
import { useCustomerStore } from "@/stores/customerStore";
import { ArubaInstantOnVenueCard } from "@/components/customer/ArubaInstantOnVenueCard";
import { locationIsNasOnly } from "@/lib/location-liveness";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/ui-ext/StatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEVICE_TYPES, type DeviceType } from "@/stores/deviceStore";
import { floorSuggestions, normalizeFloor } from "@/lib/device-floors";
import { DEVICE_TYPE_META, normalizeMac } from "@/lib/device-presentation";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { useControllerDevices } from "@/hooks/useControllerDevices";
import { useLocationDevices } from "@/hooks/useDeviceHealth";
import { EmptyState as ConsoleEmptyState, Panel } from "@/components/customer/console";
import { FleetSummaryStrip } from "@/components/customer/devices/FleetSummaryStrip";
import { HardwareInventory } from "@/components/customer/devices/HardwareInventory";
import { HardwareDrawer } from "@/components/customer/devices/HardwareDrawer";
import {
  NO_FILTER,
  SHOW_ROUTER_TRAFFIC_EVENT,
  bucketFromSearch,
  buildInventory,
  type InventoryFilter,
} from "@/components/customer/devices/fleet-model";
import { maskEmail, maskMac, maskPhone } from "@/components/features/HeaderControls";
import { requestErrorMessage } from "@/services/api";
import { describeAddressBinding } from "@/lib/hardware-address-binding";

/** Realistic (but fake) guest identities shared by this file's demo/preview
 * views -- see customer.service.ts's own `DEMO_GUEST_IDENTITIES` for why
 * these carry a real-looking phone number and a varied email domain rather
 * than the generic `user{n}@email.com` placeholders these views used to
 * show (no phone field existed at all). Kept as its own small copy here
 * rather than importing customer.service.ts's list -- this file's views are
 * pure local mock data with no `isDemo()`/API seam, used only by the
 * per-agent preview dashboard (`/agent`), and importing from a `services/`
 * module would wrongly imply these views participate in that data-fetching
 * path. */
const GUEST_IDENTITIES: { name: string; email: string; phone: string }[] = [
  { name: "John Doe", email: "john.doe83@gmail.com", phone: "+91 98765 43210" },
  { name: "Jane Smith", email: "jane.smith22@yahoo.com", phone: "+91 91234 56780" },
  { name: "Raj Kumar", email: "raj.kumar99@outlook.com", phone: "+91 90000 12345" },
  { name: "Priya Sharma", email: "priya.sharma7@gmail.com", phone: "+91 88888 22334" },
  { name: "Alex Chen", email: "alex.chen@hotmail.com", phone: "+91 99887 76655" },
  { name: "Sarah Wilson", email: "sarah.wilson1@gmail.com", phone: "+91 97654 32109" },
];

export function BasicDashboardView({
  locationId,
  masked = true,
}: {
  locationId?: string;
  masked?: boolean;
}) {
  void locationId;
  const kpis = [
    { l: "Online Users", v: "1,247", t: "primary" as const },
    { l: "Active Sessions", v: "892", t: "info" as const },
    { l: "Routers Online", v: "18/20", t: "success" as const },
    { l: "Today's Guests", v: "456", t: "primary" as const },
    { l: "Avg Session", v: "34m", t: "info" as const },
    { l: "SLA Uptime", v: "99.9%", t: "success" as const },
  ];
  const users = [
    { n: GUEST_IDENTITIES[0].name, e: GUEST_IDENTITIES[0].email, t: "2m ago", s: "online" },
    { n: GUEST_IDENTITIES[1].name, e: GUEST_IDENTITIES[1].email, t: "5m ago", s: "online" },
    { n: GUEST_IDENTITIES[2].name, e: GUEST_IDENTITIES[2].email, t: "12m ago", s: "online" },
    { n: GUEST_IDENTITIES[4].name, e: GUEST_IDENTITIES[4].email, t: "25m ago", s: "offline" },
  ];
  const alerts = [
    { t: "warning", m: "GW-02 signal degradation" },
    { t: "success", m: "ISP failover completed" },
    { t: "error", m: "Bandwidth threshold exceeded" },
    { t: "info", m: "Firmware update available" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Design v3 Part 4: one Border Beam highlight on the single
         * genuinely-hero KPI tile ("Online Users" -- the same headline
         * number c.index.tsx's own hero calls "Online right now"), not on
         * every tile in the row. */}
        {kpis.map((k, i) => (
          <StatCard key={k.l} label={k.l} value={k.v} tone={k.t} highlight={i === 0} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.n}>
                    <TableCell>
                      <p className="text-sm font-medium">{u.n}</p>
                      <p className="text-xs text-muted-foreground">
                        {masked ? maskEmail(u.e) : u.e}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.t}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          u.s === "online" ? "text-emerald-500" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            u.s === "online" ? "bg-emerald-500" : "bg-muted-foreground",
                          )}
                        />
                        {u.s}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {alerts.map((a) => (
              <div key={a.m} className="flex items-start gap-3 py-3">
                {a.t === "error" ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                ) : a.t === "warning" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                ) : a.t === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                )}
                <p className="text-sm">{a.m}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * `masked` reflects the *currently previewed* staff member's per-agent
 * data-masking setting (`AgentRecord.dataMasking`, toggled from the owner's
 * Staff Access page -- see AgentsPage.tsx -- and threaded in from
 * agent.index.tsx's "Preview as staff" flow via `renderFeature`'s `masked`
 * ctx). Previously this always called `maskEmail`/`maskMac` unconditionally,
 * so flipping that switch had no visible effect here at all -- the one place
 * meant to demonstrate the feature working. Defaults to `true` (masked) so
 * any other caller that doesn't pass it keeps the previous, safer-by-default
 * behavior. MAC stays passed through `maskMac` regardless of `masked`, same
 * as everywhere else in the app -- see that function's own comment: MAC is
 * never masked, by product decision, so it isn't part of this toggle. */
export function BasicUsersView({ masked = true }: { masked?: boolean } = {}) {
  const { t } = useTranslation("guests", { i18n });
  const [q, setQ] = useState("");
  const all = Array.from({ length: 12 }, (_, i) => {
    const identity = GUEST_IDENTITIES[i % GUEST_IDENTITIES.length];
    return {
      id: `u-${i}`,
      name: identity.name,
      email: identity.email,
      phone: identity.phone,
      mac: `00:1A:${10 + i}`,
      duration: `${15 + (i % 6) * 10}m`,
      status: ["online", "online", "online", "idle", "offline", "online"][i % 6],
    };
  });
  const rows = all.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <Input
        placeholder={t("searchPlaceholder", "Search guests…")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-10 max-w-xs"
      />
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colUser", "Guest")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colPhone", "Phone")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colMac", "MAC")}</TableHead>
                <TableHead>{t("colDuration", "Duration")}</TableHead>
                <TableHead>{t("colStatus", "Status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {masked ? maskEmail(u.email) : u.email}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-xs sm:table-cell">
                    {masked ? maskPhone(u.phone) : u.phone}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {maskMac(u.mac)}
                  </TableCell>
                  <TableCell className="text-xs">{u.duration}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        u.status === "online"
                          ? "text-emerald-500"
                          : u.status === "idle"
                            ? "text-amber-500"
                            : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          u.status === "online"
                            ? "bg-emerald-500"
                            : u.status === "idle"
                              ? "bg-amber-500"
                              : "bg-muted-foreground",
                        )}
                      />
                      {u.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function BasicAnalyticsView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { l: "Total Sessions", v: "1,892" },
        { l: "Unique Guests", v: "847" },
        { l: "Return Rate", v: "34%" },
        { l: "Avg Duration", v: "28 min" },
      ].map((k) => (
        <StatCard key={k.l} label={k.l} value={k.v} tone="primary" />
      ))}
    </div>
  );
}

export function BasicDevicesView() {
  const devices = [
    { m: "00:1A:2B:3C:4D:5E", i: "10.0.1.42", d: "iPhone 15", ls: "Just now" },
    { m: "AA:BB:CC:DD:EE:FF", i: "10.0.1.87", d: "MacBook Pro", ls: "2 min ago" },
    { m: "11:22:33:44:55:66", i: "10.0.2.15", d: "Galaxy S24", ls: "5 min ago" },
  ];
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Connected Devices</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MAC</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.m}>
                <TableCell className="font-mono text-xs">{maskMac(d.m)}</TableCell>
                <TableCell className="font-mono text-xs">{d.i}</TableCell>
                <TableCell>{d.d}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{d.ls}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Per-device-type icon + color tint so the hardware table reads at a
 * glance instead of every row sharing one identical indigo-violet badge
 * (an owner scanning a mixed list of APs/printers/cameras couldn't tell
 * types apart by color before -- only by the small text label next to
 * the name). Hue choice is otherwise arbitrary; kept distinct per type. */
// Moved to @/lib/device-presentation -- three other modules imported these
// two for a constant and a pure function, and each import pulled this whole
// 800-line module into the pre-login bundle graph. Imported back for this
// module's own use, and re-exported so existing callers keep working.
export { DEVICE_TYPE_META, normalizeMac };

// Floor is optional and free text -- see AddDeviceDialog's own note and
// @/lib/device-floors. No guessed default.
const emptyHardwareForm = {
  name: "",
  mac: "",
  type: "Access Point" as DeviceType,
  floor: "",
};

const STRICT_MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

/** The empty state for a venue with no registered hardware. Says what
 * adding one will (and, at a controller or Aruba venue, will not) do. */
function HardwareEmptyState({
  controllerManaged,
  nasOnly = false,
  onAdd,
}: {
  controllerManaged: boolean;
  nasOnly?: boolean;
  onAdd: () => void;
}) {
  return (
    <ConsoleEmptyState
      compact
      icon={HardDrive}
      title="No hardware added yet"
      description={
        nasOnly
          ? "Add a device by MAC address to keep a record of it. Wyfy doesn't see the status of Aruba Instant On access points; the Instant On app does."
          : controllerManaged
            ? // "start monitoring it" is a promise this venue cannot be
              // given: the liveness sweep only probes through an
              // agent-managed uplink, and this one has none.
              "Add a device by MAC address to keep a record of it. Status for your access points comes from your controller, above."
            : "Add an access point, printer or camera by MAC address to start monitoring it. Your router is already tracked above."
      }
      action={
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add device
        </Button>
      }
    />
  );
}

type HardwareRow = ReturnType<typeof useMonitoredHardware>["devices"][number];

/**
 * The Devices page's hardware half: fleet strip, the controller / Aruba
 * notice for venues whose access points this platform does not probe, and
 * the inventory (routers + registered hardware) with its detail drawer and
 * the Add Device dialog.
 *
 * Reads: `useMonitoredHardware` (registered hardware), the active venue's
 * liveness already in the store (its routers), `useLocationDevices` (the
 * same query + key the traffic panel below makes, so no extra request) for
 * router model/MAC, and `useControllerDevices` once for both the controller
 * card and the copy that depends on it.
 */
export function NetworkHardwareView({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("devices", { i18n });
  const { devices, loading, addDevice, removeDevice } = useMonitoredHardware(locationId);
  const activeLocation = useCustomerStore((st) => st.activeLocation);
  // Owned here, not inside `ControllerDevicesCard`, because both cards need
  // the answer and one GET should serve both. See that component's own note.
  // An Aruba Instant On venue has no controller inventory to read (no API to
  // Instant On, no network integration), so it is never asked for one; the
  // venue card below stands where the Omada access-point list would.
  const nasOnlyVenue = locationIsNasOnly(activeLocation?.liveness);
  const controllerInventory = useControllerDevices(nasOnlyVenue ? undefined : locationId);
  // Whether this venue's network is run by a vendor controller. Taken from
  // the inventory read rather than guessed from the hardware rows, so the
  // answer is the same before any hardware has been registered -- which is
  // exactly when the "add a device to start monitoring it" empty state would
  // otherwise make a promise this venue cannot keep.
  const controllerManaged =
    nasOnlyVenue ||
    (!controllerInventory.loading && controllerInventory.status !== "no_controller");
  // The venue's routers. Only when the store's venue IS this page's venue:
  // the /agent preview can pass a different location id.
  const venueLiveness =
    activeLocation && (!locationId || activeLocation.id === locationId)
      ? (activeLocation.liveness ?? null)
      : null;
  const routerDevices = useLocationDevices(locationId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyHardwareForm);
  const [macError, setMacError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // `?status=down` (etc.) from the Overview card pre-filters the inventory.
  const [filter, setFilter] = useState<InventoryFilter>(() => {
    const b = bucketFromSearch(typeof window === "undefined" ? null : window.location.search);
    return b ? { ...NO_FILTER, bucket: b } : NO_FILTER;
  });
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      buildInventory({
        routers: venueLiveness?.routers ?? [],
        routerDevices: Array.isArray(routerDevices.data) ? routerDevices.data : [],
        hardware: devices as HardwareRow[],
      }),
    [venueLiveness, routerDevices.data, devices],
  );
  const openRow = openKey ? (rows.find((r) => r.key === openKey) ?? null) : null;
  const routersUnread = venueLiveness == null || venueLiveness.routersTotal == null;

  const startAdd = () => {
    setMacError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      toast.error("Select a location first.");
      return;
    }
    const normalizedMac = normalizeMac(form.mac);
    if (!normalizedMac || !STRICT_MAC_RE.test(normalizedMac)) {
      const msg = "Enter a valid MAC address, e.g. AA:BB:CC:DD:EE:FF";
      setMacError(msg);
      toast.error(msg);
      return;
    }
    if (devices.some((d) => d.mac.toUpperCase() === normalizedMac)) {
      const msg = "A device with this MAC is already set up.";
      setMacError(msg);
      toast.error(msg);
      return;
    }
    setMacError(null);
    setSubmitting(true);
    try {
      const created = await addDevice(
        locationId,
        form.name.trim(),
        normalizedMac,
        form.type,
        form.floor,
      );
      toast.success(form.floor ? `${form.type} added on ${form.floor}` : `${form.type} added`);
      const binding = describeAddressBinding(created?.addressBinding);
      if (binding) toast[binding.tone](binding.message);
      // Registration succeeds either way; this only says up front why the
      // row may stay "Never observed" (prod had one AP added at 3 venues).
      if (created?.duplicateLocations?.length) {
        toast.warning(
          `This MAC is also added at ${created.duplicateLocations.join(", ")}. ` +
            "Only the location whose router it is plugged into can show its status.",
        );
      } else if (created?.registeredElsewhere) {
        toast.warning(
          "This MAC is also registered at another venue. If this location never sees it, " +
            "check the MAC address.",
        );
      }
      setForm(emptyHardwareForm);
      setOpen(false);
    } catch (err) {
      // The backend enforces org-wide MAC uniqueness for real (see
      // DuplicateMonitoredHardwareError) -- the client-side check above
      // only catches this location's own devices, so a genuine duplicate
      // at a different location of the same org still needs this real
      // error surfaced, not silently swallowed.
      toast.error(requestErrorMessage(err, "Could not add this device."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeDevice(id);
      toast.success(`${name} removed`);
      setOpenKey(null);
    } catch (err) {
      toast.error(requestErrorMessage(err, "Could not remove this device."));
    }
  };

  const showTraffic = (routerId: string) => {
    window.dispatchEvent(new CustomEvent(SHOW_ROUTER_TRAFFIC_EVENT, { detail: { routerId } }));
  };

  // What the hardware half of this page says about where status comes from.
  // At a controller-managed venue nothing here pings these MACs (the
  // liveness sweep only dials agent-managed uplinks), so the old copy -- "so
  // Device Monitoring can track them" -- was a promise the platform cannot
  // keep. The access points themselves are listed by the controller.
  const sourceNote = nasOnlyVenue
    ? "Keep a record of other hardware at this location by MAC address and floor. Wyfy doesn't see the status of Aruba Instant On access points; the Instant On app does."
    : controllerManaged
      ? "Keep a record of other hardware at this location by MAC address and floor. Your access points are listed above, reported by your controller."
      : "Routers report in on their own. Access points, printers and cameras you add by MAC address are checked through your router.";

  return (
    <div className="space-y-4">
      {/* Fleet strip + the page's primary action. */}
      <section aria-labelledby="hw-fleet-title" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 id="hw-fleet-title" className="text-[13px] font-semibold">
              {t("fleet.title", "Network hardware")}
            </h2>
            <p className="text-xs text-[var(--wy-text-muted)]">{sourceNote}</p>
          </div>
          <Button size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4" />
            {t("add.button", "Add device")}
          </Button>
        </div>
        <FleetSummaryStrip
          rows={rows}
          filter={filter}
          routersUnread={routersUnread}
          onFilter={(kind, bucket) => {
            setFilter({ ...NO_FILTER, query: filter.query, kind, bucket });
            document
              .getElementById("hw-inventory")
              ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }}
        />
      </section>

      {/* Read-only controller inventory (Omada venues); renders nothing for a
          MikroTik venue. An Aruba Instant On venue gets its own card. */}
      {nasOnlyVenue && locationId ? (
        <ArubaInstantOnVenueCard locationId={locationId} />
      ) : (
        <ControllerDevicesCard inventory={controllerInventory} />
      )}

      <Panel
        className="scroll-mt-20"
        flush
        title={<span id="hw-inventory">{t("inventory.title", "Inventory")}</span>}
        description={
          loading
            ? t("inventory.loading", "Loading devices…")
            : t("inventory.meta", "{{count}} devices · click a row for details", {
                count: rows.length,
              })
        }
      >
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-[var(--wy-surface-2)] motion-reduce:animate-none" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <HardwareEmptyState
            controllerManaged={controllerManaged}
            nasOnly={nasOnlyVenue}
            onAdd={startAdd}
          />
        ) : (
          <>
            <HardwareInventory
              rows={rows}
              filter={filter}
              onFilter={setFilter}
              onOpen={(r) => setOpenKey(r.key)}
            />
            {!loading && devices.length === 0 && (
              <div className="border-t border-[var(--wy-border)]">
                <HardwareEmptyState
                  controllerManaged={controllerManaged}
                  nasOnly={nasOnlyVenue}
                  onAdd={startAdd}
                />
              </div>
            )}
          </>
        )}
      </Panel>

      {/* Status, the check behind it, port + link facts, the 24 h strip
          (HardwareHealthDetails), duplicate-MAC notices, Remove. A row
          nothing measures shows the explanation (live.explanation, carried
          as `row.explanation`) and no reading -- see hardwareLivenessIsMeasured. */}
      <HardwareDrawer
        row={openRow}
        onOpenChange={(o) => !o && setOpenKey(null)}
        onRemove={async (r) => {
          if (r.hardware) await handleRemove(r.hardware.id, r.name);
        }}
        onShowTraffic={showTraffic}
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setMacError(null);
        }}
      >
        <DialogContent className="wy-console border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add network hardware</DialogTitle>
            <DialogDescription className="text-[var(--wy-text-muted)]">
              {nasOnlyVenue
                ? "Enter the device's MAC address, type, and the floor it's installed on. This keeps a record of it — Wyfy doesn't see the status of hardware at this venue."
                : controllerManaged
                  ? "Enter the device's MAC address, type, and the floor it's installed on. This keeps a record of it — status for this venue's hardware comes from your controller, not from this platform."
                  : "Enter the device's MAC address, type, and the floor it's installed on."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="space-y-3 rounded-[var(--wy-radius)] border border-[var(--wy-border)] p-4">
              <legend className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
                <Tag aria-hidden className="h-3 w-3" />
                Identify the device
              </legend>
              <div className="space-y-1.5">
                <Label htmlFor="hw-name">Device name</Label>
                <Input
                  id="hw-name"
                  placeholder="e.g. AP Lobby North"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <p className="text-[11px] text-[var(--wy-text-faint)]">
                  Shown across the dashboard instead of the raw MAC address.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hw-mac">MAC address</Label>
                <Input
                  id="hw-mac"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={form.mac}
                  onChange={(e) => {
                    setForm({ ...form, mac: e.target.value });
                    if (macError) setMacError(null);
                  }}
                  className={cn(
                    "font-[family-name:var(--wy-font-mono)]",
                    macError && "border-destructive focus-visible:ring-destructive/20",
                  )}
                  aria-invalid={!!macError}
                  aria-describedby={macError ? "hw-mac-error" : "hw-mac-hint"}
                />
                <p id="hw-mac-hint" className="text-[11px] text-[var(--wy-text-faint)]">
                  Dashes, spaces, or no separators are fine too -- e.g. AA-BB-CC-DD-EE-FF.
                </p>
                {macError && (
                  <p id="hw-mac-error" role="alert" className="text-xs font-medium text-[var(--wy-crit)]">
                    {macError}
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-[var(--wy-radius)] border border-[var(--wy-border)] p-4">
              <legend className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
                <MapPin aria-hidden className="h-3 w-3" />
                Type &amp; location
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hw-type">Device type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v as DeviceType })}
                  >
                    <SelectTrigger id="hw-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="wy-console">
                      {DEVICE_TYPES.map((dt) => {
                        const Icon = DEVICE_TYPE_META[dt].icon;
                        return (
                          <SelectItem key={dt} value={dt}>
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" />
                              {dt}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hardware-floor">Floor</Label>
                  <Input
                    id="hardware-floor"
                    list="hardware-floor-suggestions"
                    value={form.floor}
                    placeholder="Optional — e.g. GF, 3F, B1"
                    maxLength={50}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    onBlur={(e) => setForm({ ...form, floor: normalizeFloor(e.target.value) })}
                  />
                  <datalist id="hardware-floor-suggestions">
                    {floorSuggestions(devices).map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>
            </fieldset>

            {/* What registering does to the device's IP. Only where a
                RouterOS lease table exists; describeAddressBinding then says
                what actually happened, in a toast, once it is added. */}
            {!controllerManaged && (
              <p className="rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)] px-3 py-2 text-[11px] leading-relaxed text-[var(--wy-text-muted)]">
                When you add it, the device's current IP address is made static on your router, so it
                keeps the same address.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding…" : "Add device"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** `masked` -- same per-agent `dataMasking` ctx `renderFeature` threads into
 * every other guest-PII view (see `BasicUsersView` above) -- only the first
 * row's "guest@email.com" is a real guest email (the other three actors are
 * staff/system, never masked). Defaults to `true` so an unmasked demo guest
 * address doesn't leak through this view regardless of the previewed
 * agent's setting. */
export function BasicAuditView({ masked = true }: { masked?: boolean } = {}) {
  const items = [
    { a: "Guest login via OTP", w: "guest@email.com", t: "2 min ago", guest: true },
    { a: "Voucher batch created", w: "reception", t: "18 min ago", guest: false },
    { a: "Router restart completed", w: "system", t: "1 hour ago", guest: false },
    { a: "Portal branding updated", w: "manager", t: "3 hours ago", guest: false },
  ];
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Audit Trail</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {items.map((ev, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{ev.a}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ev.guest && masked ? maskEmail(ev.w) : ev.w} · {ev.t}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BasicHelpView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { n: "Documentation", d: "Guides and API reference" },
        { n: "FAQs", d: "Frequently asked questions" },
        { n: "Raise Ticket", d: "Contact support" },
      ].map((h) => (
        <Card key={h.n} className="rounded-2xl transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <p className="font-semibold">{h.n}</p>
            <p className="mt-1 text-xs text-muted-foreground">{h.d}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-xs"
              onClick={() => toast.success(`Opening ${h.n}`)}
            >
              Open
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
