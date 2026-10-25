/**
 * Compact, reusable customer feature views (Dashboard, Users, Analytics,
 * Devices, Audit, Help) shared by the agent dynamic dashboard. Token-driven
 * (Aurora Teal). Mock data -- the seam a per-location API call replaces.
 */
import { useState } from "react";
import { motion } from "framer-motion";
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
  Trash2,
  Tag,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { describeLiveness, hardwareLivenessIsMeasured } from "@/lib/device-liveness";
import { floorSuggestions, floorsInUse, normalizeFloor, unplacedCount } from "@/lib/device-floors";
import { DEVICE_TYPE_META, normalizeMac } from "@/lib/device-presentation";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { HardwareHealthDetails } from "@/components/customer/HardwareHealthDetails";
import { useControllerDevices } from "@/hooks/useControllerDevices";
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

/** Manual setup for network hardware (Access Points, Printers, etc), scoped
 * to whichever location's dashboard this is rendered inside -- a device
 * added here only ever shows up in that location's monitoring, never mixed
 * with another location's floors. Up/down status is then derived from the
 * MAC on the monitoring side; this form only records identity, type, and
 * physical floor. */
/**
 * Illustrated empty state for the Network Hardware setup card -- a dormant
 * router silhouette, same filled-flat-shape character language established
 * elsewhere this session (ChartEmptyState/UsersEmptyState/
 * DashboardWatchIllustration), themed specifically around "no hardware
 * registered yet" rather than reusing an unrelated graphic. Purely
 * decorative -- aria-hidden.
 */
function HardwareEmptyState({
  controllerManaged,
  nasOnly = false,
}: {
  controllerManaged: boolean;
  nasOnly?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <svg aria-hidden="true" viewBox="0 0 120 90" className="h-20 w-28" fill="none">
        <ellipse cx="60" cy="78" rx="40" ry="5" fill="#4f46e5" opacity="0.08" />
        <path
          d="M50 32a10 10 0 0 1 20 0"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.3"
          strokeDasharray="2 4"
        />
        <path
          d="M45 42l-6-14"
          stroke="#a78bfa"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M75 42l6-14"
          stroke="#a78bfa"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="39" cy="26" r="2" fill="#a78bfa" opacity="0.5" />
        <circle cx="81" cy="26" r="2" fill="#a78bfa" opacity="0.5" />
        <rect
          x="30"
          y="42"
          width="60"
          height="26"
          rx="8"
          className="fill-muted"
          stroke="#4f46e5"
          strokeWidth="2.5"
        />
        <circle cx="42" cy="55" r="2.2" fill="#a78bfa" />
        <circle cx="52" cy="55" r="2.2" fill="#22d3ee" />
        <circle cx="62" cy="55" r="2.2" fill="#f0abfc" />
        <rect x="72" y="51" width="10" height="8" rx="1.5" fill="#4f46e5" opacity="0.15" />
      </svg>
      <div>
        <p className="text-sm font-medium">No hardware set up yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {nasOnly
            ? "Add a device by MAC address to keep a record of it. Wyfy doesn't see the status of Aruba Instant On access points; the Instant On app does."
            : controllerManaged
              ? // "start monitoring it" is a promise this venue cannot be
                // given: the liveness sweep only probes through an
                // agent-managed uplink, and this one has none.
                "Add a device by MAC address to keep a record of it. Status for your access points comes from your controller, above."
              : "Add a device by MAC address to start monitoring it."}
        </p>
      </div>
    </div>
  );
}

type HardwareRow = ReturnType<typeof useMonitoredHardware>["devices"][number];

/**
 * Which summary bucket a row counts toward. Read straight off
 * `describeLiveness`'s tone so the summary and each row's chip can never
 * disagree: "up" and "down" are confirmed readings; "warning" is a reading
 * that is not a clean verdict (can't reach router, unstable, status stale);
 * "neutral" is "not seen yet"; and a row nothing probes is "Not measured",
 * never folded into Unknown -- Unknown says we looked.
 */
type SummaryBucket = "up" | "down" | "unconfirmed" | "unknown" | "unmeasured";

function summaryBucket(d: HardwareRow): SummaryBucket {
  if (!hardwareLivenessIsMeasured(d)) return "unmeasured";
  const tone = describeLiveness(d).tone;
  if (tone === "up") return "up";
  if (tone === "down") return "down";
  if (tone === "warning") return "unconfirmed";
  return "unknown";
}

const BUCKET_META: Record<
  SummaryBucket,
  { label: string; dot: string; text: string; always: boolean; hint: string }
> = {
  up: {
    label: "Up",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    always: true,
    hint: "Answering on the network at the last check.",
  },
  down: {
    label: "Down",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    always: true,
    hint: "Confirmed not answering at the last check.",
  },
  unconfirmed: {
    label: "Unconfirmed",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    always: false,
    hint: "A reading that is not a clean up or down: the router can't be read, the link is unstable, or the status is stale. Each row says which.",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-muted-foreground/50",
    text: "text-foreground",
    always: true,
    hint: "Not seen on the network yet, so there is no status to show.",
  },
  unmeasured: {
    label: "Not measured",
    dot: "",
    text: "text-muted-foreground",
    always: false,
    hint: "Nothing on this platform checks these devices at this venue.",
  },
};

const BUCKET_ORDER: SummaryBucket[] = ["up", "down", "unconfirmed", "unknown", "unmeasured"];

function countBuckets(rows: readonly HardwareRow[]): Record<SummaryBucket, number> {
  const counts: Record<SummaryBucket, number> = {
    up: 0,
    down: 0,
    unconfirmed: 0,
    unknown: 0,
    unmeasured: 0,
  };
  for (const d of rows) counts[summaryBucket(d)] += 1;
  return counts;
}

/** Floors in building order, then the rows with no floor recorded. A
 * heading is shown only when there is more than one group to tell apart. */
function groupHardwareByFloor(rows: readonly HardwareRow[]) {
  const floors = floorsInUse(rows);
  const groups: { floor: string | null; devices: HardwareRow[] }[] = floors.map((f) => ({
    floor: f,
    devices: rows.filter((d) => d.floor.trim() === f),
  }));
  const unplaced = rows.filter((d) => d.floor.trim() === "");
  if (unplaced.length > 0) groups.push({ floor: null, devices: unplaced });
  const showHeading = groups.length > 1 || floors.length > 0;
  return groups.map((g) => ({ ...g, showHeading }));
}

/**
 * The at-a-glance strip: one tile per status bucket, then a per-floor line.
 * Up, Down and Unknown always show (a 0 is an answer); Unconfirmed and Not
 * measured only when some row is in them.
 */
function HardwareSummary({ devices }: { devices: readonly HardwareRow[] }) {
  const counts = countBuckets(devices);
  const buckets = BUCKET_ORDER.filter((b) => BUCKET_META[b].always || counts[b] > 0);
  const floors = floorsInUse(devices);
  const unplaced = unplacedCount(devices);
  const perFloor = [
    ...floors.map((f) => ({
      label: f,
      counts: countBuckets(devices.filter((d) => d.floor.trim() === f)),
    })),
    ...(unplaced > 0 && floors.length > 0
      ? [{ label: "No floor", counts: countBuckets(devices.filter((d) => d.floor.trim() === "")) }]
      : []),
  ];

  return (
    <div className="space-y-3">
      <dl
        className={cn(
          "grid gap-2",
          buckets.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        )}
      >
        {buckets.map((b) => {
          const meta = BUCKET_META[b];
          return (
            <div key={b} title={meta.hint} className="rounded-xl border bg-muted/30 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                {meta.dot ? (
                  <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full border border-dashed border-muted-foreground/60"
                  />
                )}
                {meta.label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 text-xl font-semibold tabular-nums",
                  counts[b] > 0 ? meta.text : "text-muted-foreground",
                )}
              >
                {counts[b]}
              </dd>
            </div>
          );
        })}
      </dl>
      {perFloor.length > 1 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Status by floor">
          {perFloor.map((f) => (
            <li
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
            >
              <span className="font-semibold">{f.label}</span>
              {BUCKET_ORDER.filter((b) => f.counts[b] > 0).map((b) => (
                <span key={b} className={cn("tabular-nums", BUCKET_META[b].text)}>
                  {f.counts[b]} {BUCKET_META[b].label.toLowerCase()}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A row's status chip. The colour and words both come from describeLiveness:
 * "unknown" (not seen yet) stays neutral, a confirmed "Down" is red, and a
 * device behind a router we cannot read is amber and says so -- never "Never
 * observed" for a working AP. A row NOTHING measures -- a controller-managed
 * venue has no RouterOS session for the liveness sweep to probe through --
 * says so rather than borrowing any of those. See useMonitoredHardware's own
 * honesty note.
 */
function HardwareStatusChip({ device }: { device: HardwareRow }) {
  const live = describeLiveness(device);
  const measured = hardwareLivenessIsMeasured(device);
  return (
    <span
      title={live.explanation ?? undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        !measured
          ? "border-dashed border-border bg-transparent text-muted-foreground"
          : live.tone === "up"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : live.tone === "down"
              ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : live.tone === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-border bg-muted text-muted-foreground",
      )}
    >
      {/* No status dot for an unmeasured row: a dot is a reading, and there
       * is none. */}
      {measured && (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            live.tone === "up"
              ? "bg-emerald-500"
              : live.tone === "down"
                ? "bg-rose-500"
                : live.tone === "warning"
                  ? "bg-amber-500"
                  : "bg-muted-foreground/50",
          )}
        />
      )}
      {/* Was "Up · 4m", where 4m was the age of last_seen_at, not an uptime.
       * Each duration now names its own measurement. */}
      {live.detail ? `${live.state} · ${live.detail}` : live.state}
    </span>
  );
}

export function NetworkHardwareView({ locationId }: { locationId?: string }) {
  const { devices, loading, addDevice, removeDevice } = useMonitoredHardware(locationId);
  // Owned here, not inside `ControllerDevicesCard`, because both cards need
  // the answer and one GET should serve both. See that component's own note.
  // An Aruba Instant On venue has no controller inventory to read (no API to
  // Instant On, no network integration), so it is never asked for one; the
  // venue card below stands where the Omada access-point list would.
  const nasOnlyVenue = locationIsNasOnly(useCustomerStore((st) => st.activeLocation)?.liveness);
  const controllerInventory = useControllerDevices(nasOnlyVenue ? undefined : locationId);
  // Whether this venue's network is run by a vendor controller. Taken from
  // the inventory read rather than guessed from the hardware rows, so the
  // answer is the same before any hardware has been registered -- which is
  // exactly when the "add a device to start monitoring it" empty state would
  // otherwise make a promise this venue cannot keep.
  const controllerManaged =
    nasOnlyVenue ||
    (!controllerInventory.loading && controllerInventory.status !== "no_controller");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyHardwareForm);
  const [macError, setMacError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      toast.success(`${form.type} added on ${form.floor}`);
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
    } catch (err) {
      toast.error(requestErrorMessage(err, "Could not remove this device."));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Read-only controller inventory (Omada venues); renders nothing for a
          MikroTik venue, leaving the manual hardware card below unchanged. */}
      {nasOnlyVenue && locationId ? (
        <div className="mb-4">
          <ArubaInstantOnVenueCard locationId={locationId} />
        </div>
      ) : (
        <ControllerDevicesCard inventory={controllerInventory} />
      )}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
              <HardDrive className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Network Hardware
              </CardTitle>
              <CardDescription>
                {nasOnlyVenue
                  ? "Keep a record of other hardware at this location by MAC address and floor. Wyfy doesn't see the status of Aruba Instant On access points; the Instant On app does."
                  : controllerManaged
                    ? // At a controller-managed venue nothing here pings these
                      // MACs (the liveness sweep only dials agent-managed
                      // uplinks), so the old copy -- "so Device Monitoring can
                      // track them" -- was a promise the platform cannot keep.
                      // The access points themselves are listed above, by the
                      // controller.
                      "Keep a record of other hardware at this location by MAC address and floor. Your access points are listed above, reported by your controller."
                    : "Set up Access Points, Printers, and other hardware for this location by MAC address and floor so Device Monitoring can track them."}
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setMacError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Device
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Loading devices…
            </div>
          ) : devices.length === 0 ? (
            <HardwareEmptyState controllerManaged={controllerManaged} nasOnly={nasOnlyVenue} />
          ) : (
            <div className="space-y-5 px-4 pb-5 sm:px-6">
              <HardwareSummary devices={devices} />
              {groupHardwareByFloor(devices).map((group) => (
                <section
                  key={group.floor ?? "__no-floor"}
                  aria-label={group.floor ? `Floor ${group.floor}` : "No floor recorded"}
                  className="space-y-2"
                >
                  {group.showHeading && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.floor ?? "No floor"}
                      </h3>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {group.devices.length}
                      </span>
                      <span aria-hidden="true" className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <ul className="divide-y overflow-hidden rounded-xl border">
                    {group.devices.map((d) => {
                      const meta = DEVICE_TYPE_META[d.type];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={d.id}
                          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4 sm:px-4"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            {/* `title` sits on this span, not the icon: lucide-react
                             * icon components don't accept a `title` prop. */}
                            <span
                              title={d.type}
                              className={cn(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                                meta.gradient,
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="truncate text-sm font-medium">{d.name}</span>
                                <HardwareStatusChip device={d} />
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {d.type}
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono">{d.mac}</span>
                              </p>
                              {/* Port, latency, devices on the port, traffic, link
                               * drops, a 24h strip, and why a duplicate-MAC row can
                               * never be seen here. Nothing for a row without
                               * `health` (demo, older backend). */}
                              {hardwareLivenessIsMeasured(d) && (
                                <HardwareHealthDetails
                                  health={d.health}
                                  duplicateLocations={d.duplicateLocations}
                                  registeredElsewhere={d.registeredElsewhere}
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end sm:shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemove(d.id, d.name)}
                              aria-label={`Remove ${d.name}`}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-rose-400 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setMacError(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Network Hardware</DialogTitle>
              <DialogDescription>
                {nasOnlyVenue
                  ? "Enter the device's MAC address, type, and the floor it's installed on. This keeps a record of it — Wyfy doesn't see the status of hardware at this venue."
                  : controllerManaged
                    ? "Enter the device's MAC address, type, and the floor it's installed on. This keeps a record of it — status for this venue's hardware comes from your controller, not from this platform."
                    : "Enter the device's MAC address, type, and the floor it's installed on."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5">
              {/* Identity -- name + MAC grouped in one labeled section with a
                persistent caption under each field, matching this session's
                LocationPolicies.tsx grouping pattern, instead of the flat
                un-sectioned field stack this dialog had before. */}
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-1 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Identify the device
                  </h3>
                </div>
                <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                  A name and MAC address so this device can be told apart from every other one.
                </p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="hw-name">Device name</Label>
                    <Input
                      id="hw-name"
                      placeholder="e.g. AP Lobby North"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">
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
                        "font-mono",
                        macError && "border-destructive focus-visible:ring-destructive/20",
                      )}
                      aria-invalid={!!macError}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Dashes, spaces, or no separators are fine too -- e.g. AA-BB-CC-DD-EE-FF.
                    </p>
                    {macError && <p className="text-xs font-medium text-destructive">{macError}</p>}
                  </div>
                </div>
              </div>

              {/* Type & location -- the "what" and "where", grouped
                separately from identity above so the dialog reads as two
                clear questions instead of four unrelated-looking fields. */}
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Type &amp; location
                  </h3>
                </div>
                <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                  What kind of hardware this is, and which floor it's installed on.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Device type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v as DeviceType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((t) => {
                          const meta = DEVICE_TYPE_META[t];
                          const Icon = meta.icon;
                          return (
                            <SelectItem key={t} value={t}>
                              <span className="inline-flex items-center gap-2">
                                <Icon className={cn("h-3.5 w-3.5", meta.text)} />
                                {t}
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
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adding…" : "Add Device"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Card>
    </motion.div>
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
