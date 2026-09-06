import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  HelpCircle,
  X,
  Plus,
  ChevronDown,
  Search,
  Pencil,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Network,
  MapPin,
  MapPinOff,
  Users,
  UserPlus,
} from "lucide-react";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { bandwidthPolicyService } from "@/services/bandwidth-policy.service";
import { resolveOrgId } from "@/services/customer.service";
import { guestService } from "@/services/guest.service";
// A group's "Devices Per User" field lives on a completely separate
// PolicyType.DEVICE policy from its bandwidth policy -- real per-guest
// device-count enforcement (guest/service.py's _resolve_device_limit) reads
// DevicePolicyRules.max_devices_per_guest off that policy, never
// BandwidthPolicyRules.devices_per_user (which is written but genuinely
// never read anywhere in app/domains). Mirrors the identical fix already
// shipped for LocationPolicies.tsx: a paired DEVICE policy, kept in lockstep
// with every real create/update/delete/map/unmap this file already does to
// the group's bandwidth policy. bandwidthPolicyService's own
// map/unmap/listLocationMappings/guestMappings methods are policy-type-
// agnostic (they only take a policyId and hit the generic
// /policies/{id}/assignments endpoints), so the paired DEVICE policy's
// assignments are mirrored by calling those same methods again with the
// DEVICE policy's id -- no changes to bandwidth-policy.service.ts needed.
import {
  createPolicyWithRules,
  updatePolicyRules,
  listPolicyDetails,
  latestVersion,
  deactivatePolicy,
  sessionPolicyRules,
} from "@/services/policy-engine";
import { useCustomerStore } from "@/stores/customerStore";
import type { Guest } from "@/types/guest";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

// Every field on this form now has a real backend equivalent
// (bandwidthPolicyService, backed by BandwidthPolicyRules' Group-Policies-
// specific fields -- see that schema's own doc comment). Bug report: "edit
// kaam nahi karta" traced back to session/idle timeout, devices-per-user,
// daily limit, login hours, and data limit never being persisted at all --
// they're required fields on this form, so reloading a group always blanked
// them, and clicking Edit -> Save on any already-saved group failed
// validation on fields the user never touched. The *ToMinutes/labelFrom*
// pairs below convert this form's fixed dropdown labels to/from the plain
// minute counts (and device counts) the backend actually stores.
const BANDWIDTH_KBPS: Record<string, number> = {
  "10 Mbps": 10240,
  "20 Mbps": 20480,
  "30 Mbps": 30720,
  "40 Mbps": 40960,
  "50 Mbps": 51200,
  "60 Mbps": 61440,
  "70 Mbps": 71680,
  "80 Mbps": 81920,
};
function kbpsToLabel(kbps: number): string {
  const found = Object.entries(BANDWIDTH_KBPS).find(([, v]) => v === kbps);
  return found?.[0] ?? (kbps > 0 ? `${kbps} Kbps` : "Unlimited");
}

const SESSION_TIMEOUT_MINUTES: Record<string, number> = {
  "30 min": 30,
  "1 hr": 60,
  "2 hr": 120,
  "4 hr": 240,
  "8 hr": 480,
  "24 hr": 1440,
};
const IDLE_TIMEOUT_MINUTES: Record<string, number | null> = {
  "No Limit": null,
  "5 min": 5,
  "10 min": 10,
  "15 min": 15,
  "30 min": 30,
  "1 hr": 60,
};
const DAILY_LIMIT_MINUTES: Record<string, number | null> = {
  "No Limit": null,
  "1 hr": 60,
  "2 hr": 120,
  "4 hr": 240,
  "8 hr": 480,
};
const DEVICES_COUNT: Record<string, number | null> = {
  Unlimited: null,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
};

// DevicePolicyRules.max_devices_per_guest (backend) is a required int >= 1
// -- there's no real "unlimited" value in that schema today, so "Unlimited"
// here is represented as this large practical ceiling rather than left
// unenforced (same sentinel/reasoning as LocationPolicies.tsx's own fix).
const UNLIMITED_DEVICES_SENTINEL = 9999;

function labelFromMinutes(
  minutes: number | null | undefined,
  table: Record<string, number | null>,
  fallback: string,
): string {
  const found = Object.entries(table).find(([, v]) => v === (minutes ?? null));
  return found?.[0] ?? fallback;
}

// Mirrors a group's real bandwidth-policy location/guest assignment onto
// its PAIRED policies -- the DEVICE one and, since the session-timeout fix
// below, the SESSION one. bandwidthPolicyService's mapToLocation/
// unmapFromLocation/mapGuestToLocation/unmapGuestFromLocation/
// listLocationMappings/guestMappings are policy-type-agnostic (they only
// take a policyId and hit the generic /policies/{id}/assignments
// endpoints -- see that service's own file for confirmation), so calling
// them again with a paired policy's id is the real, live mirror operation,
// not a simulation.
//
// Takes a LIST rather than one id because an unassigned SESSION policy is
// worse than useless: `resolve_effective_policy` walks assignments, so a
// session policy that exists but is mapped to nothing resolves to nothing
// and the guest silently falls back to the 240-minute platform default --
// which is the exact bug this file is fixing, one step further along. Any
// entry is undefined whenever a group predates the relevant fix and has no
// paired policy of that type yet; those are skipped rather than throwing,
// so a bandwidth mapping action still succeeds even if a mirror can't be
// attempted.
type PairedPolicyIds = (string | undefined)[];
const realIdsOf = (ids: PairedPolicyIds): string[] => ids.filter((id): id is string => !!id);

async function mirrorPairedLocationMap(
  pairedIds: PairedPolicyIds,
  locationId: string,
  organizationId: string | undefined,
): Promise<void> {
  await Promise.all(
    realIdsOf(pairedIds).map((id) =>
      bandwidthPolicyService.mapToLocation(id, locationId, organizationId),
    ),
  );
}
async function mirrorPairedLocationUnmap(
  pairedIds: PairedPolicyIds,
  locationId: string,
  organizationId: string | undefined,
): Promise<void> {
  await Promise.all(
    realIdsOf(pairedIds).map(async (id) => {
      const assignmentId = await bandwidthPolicyService.locationMapping(
        id,
        locationId,
        organizationId,
      );
      if (assignmentId)
        await bandwidthPolicyService.unmapFromLocation(id, assignmentId, organizationId);
    }),
  );
}
async function mirrorPairedGuestMap(
  pairedIds: PairedPolicyIds,
  locationId: string,
  guestId: string,
  organizationId: string | undefined,
): Promise<void> {
  await Promise.all(
    realIdsOf(pairedIds).map((id) =>
      bandwidthPolicyService.mapGuestToLocation(id, locationId, guestId, organizationId),
    ),
  );
}
async function mirrorPairedGuestUnmap(
  pairedIds: PairedPolicyIds,
  locationId: string,
  guestId: string,
  organizationId: string | undefined,
): Promise<void> {
  await Promise.all(
    realIdsOf(pairedIds).map(async (id) => {
      const mappings = await bandwidthPolicyService.guestMappings(id, locationId, organizationId);
      const match = mappings.find((m) => m.guestId === guestId);
      if (match)
        await bandwidthPolicyService.unmapGuestFromLocation(id, match.assignmentId, organizationId);
    }),
  );
}

/**
 * Small header-accent illustration: three user nodes wired into one shared
 * policy hub -- exactly what a "group" is on this page (a set of users
 * mapped to one shared network policy). Same filled-flat-shape character
 * language as the other illustrations shipped this session. Purely
 * decorative -- aria-hidden.
 */
function GroupMappingIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const users = [
    { x: 16, y: 8, color: "#22d3ee" },
    { x: 68, y: 6, color: "#f0abfc" },
    { x: 68, y: 42, color: "#a78bfa" },
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-14 w-auto shrink-0 sm:block"
      fill="none"
    >
      {users.map((u, i) => (
        <motion.line
          key={i}
          x1="42"
          y1="26"
          x2={u.x}
          y2={u.y}
          stroke={u.color}
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeDasharray="1 4"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 * i, ease: "easeOut" }}
        />
      ))}
      {users.map((u, i) => (
        <g key={i} transform={`translate(${u.x}, ${u.y})`}>
          <circle r="7" fill="#2e2a5c" stroke={u.color} strokeWidth="1.5" />
          <circle cy="-1.5" r="2.2" fill={u.color} />
          <path
            d="M-3.5 4c0-3 1.8-4.5 3.5-4.5S3.5 1 3.5 4"
            stroke={u.color}
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
      <motion.circle
        cx="42"
        cy="26"
        r="9"
        fill="#1e1b4b"
        stroke="#4f46e5"
        strokeWidth="2"
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <path d="M38 26h8M42 22v8" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const STEPS = [
  { num: 1, label: "Create tier", icon: Plus, caption: "" },
  { num: 2, label: "Map tier", icon: Network, caption: "Not started" },
  { num: 3, label: "Map guests", icon: User, caption: "Not started" },
];
const BANDWIDTH = [
  "Unlimited",
  "10 Mbps",
  "20 Mbps",
  "30 Mbps",
  "40 Mbps",
  "50 Mbps",
  "60 Mbps",
  "70 Mbps",
  "80 Mbps",
];
const SESSION_TIMEOUT = ["30 min", "1 hr", "2 hr", "4 hr", "8 hr", "24 hr"];
const IDLE_TIMEOUT = ["No Limit", "5 min", "10 min", "15 min", "30 min", "1 hr"];
const DEVICES = ["Unlimited", "1", "2", "3", "4", "5"];
const DAILY_LIMIT = ["No Limit", "1 hr", "2 hr", "4 hr", "8 hr"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATA_UNITS = ["MB", "GB"];
const RESETS = ["Per session", "Daily", "Weekly", "Monthly"];
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

interface Group {
  id: string;
  name: string;
  bandwidth: string;
  sessionTimeout: string;
  idleTimeout: string;
  devicesPerUser: string;
  dailyLimit: string;
  loginHours: { days: string[]; from: string; to: string } | null;
  dataLimit: { quota: number; unit: string; resets: string } | null;
  members: number;
  // "Map group" (stepper step 2) -- backed by the real, already-built
  // backend PolicyAssignment (scope_type="location", target_type="none").
  // null == not mapped to this location; a string is that active
  // assignment's id (needed to deactivate it again on unmap). Bug report:
  // "policies>map group nhi hora hai" -- the stepper icon had no onClick
  // at all and neither did anything below it call this endpoint, so
  // mapping a group to its location was a total dead click.
  mappedAssignmentId: string | null;
  // Every location (by id) this tier is *currently* mapped to, account-
  // wide -- not just the active one above. The backend has always
  // supported a policy having any number of independent, simultaneous
  // location assignments (bandwidthPolicyService.listLocationMappings);
  // this just surfaces that reality in the UI instead of only ever
  // describing mappedAssignmentId's single current-location slice of it.
  // Drives the "Mapped to N locations" column and seeds the "Map to
  // locations…" modal's checkboxes.
  mappedLocationIds: string[];
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Help"
        onClick={() => setOpen((p) => !p)}
        onBlur={(e) => {
          if (!ref.current?.contains(e.relatedTarget)) close();
        }}
        className="inline-flex items-center justify-center rounded text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          ref={ref}
          role="tooltip"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-800"
        >
          <p>{text}</p>
          <button
            onClick={close}
            aria-label="Close"
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </span>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  tooltip,
  caption,
  err,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  tooltip?: string;
  caption?: string;
  err?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        {label}
        {required && <span className="text-indigo-500">*</span>}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {/* Persistent caption instead of a click-to-reveal tooltip -- same
          consistency fix applied across Guest WiFi Limits and Blocked
          Guests. */}
      {caption && !err && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{caption}</p>
      )}
      {err && <p className="mt-1 text-xs text-indigo-500">{err}</p>}
    </div>
  );
}

// Location ids match customer.service.ts's own DEMO_LOCATIONS roster
// (loc-1..loc-8) so the "Map to locations…" modal's checklist and this
// table's "Mapped to N locations" count both read as a coherent demo
// account instead of referencing locations that don't exist in the picker.
const DEMO_GROUPS: Group[] = [
  {
    id: "g1",
    name: "VIP Guests",
    bandwidth: "10 Mbps",
    sessionTimeout: "24 hr",
    idleTimeout: "30 min",
    devicesPerUser: "5",
    dailyLimit: "No Limit",
    loginHours: null,
    dataLimit: { quota: 10, unit: "GB", resets: "Monthly" },
    members: 12,
    mappedAssignmentId: "demo-g1",
    mappedLocationIds: ["loc-1", "loc-2", "loc-4"],
  },
  {
    id: "g2",
    name: "Staff Network",
    bandwidth: "5 Mbps",
    sessionTimeout: "8 hr",
    idleTimeout: "15 min",
    devicesPerUser: "3",
    dailyLimit: "No Limit",
    loginHours: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], from: "09:00", to: "18:00" },
    dataLimit: null,
    members: 8,
    mappedAssignmentId: null,
    mappedLocationIds: ["loc-1"],
  },
  {
    id: "g3",
    name: "Contractors",
    bandwidth: "2 Mbps",
    sessionTimeout: "4 hr",
    idleTimeout: "10 min",
    devicesPerUser: "2",
    dailyLimit: "2 hr",
    loginHours: null,
    dataLimit: null,
    members: 5,
    mappedAssignmentId: null,
    mappedLocationIds: [],
  },
];

export default function CreateGroup({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  const [groups, setGroups] = useState<Group[]>(demo ? DEMO_GROUPS : []);
  const [orgId, setOrgId] = useState<string | null>(null);
  const activeLocationName = useCustomerStore((s) => s.activeLocation?.name);
  // Groups are reusable, account-wide templates (bandwidthPolicyService.list
  // has no location filter -- confirmed against app.domains.policy.router,
  // which only takes policy_type) -- mapping one to a location (the
  // Map/Mapped button below) is what actually varies per location, same as
  // Location Policies/User Policies picking their one active assignment out
  // of this same shared catalog. "har location ka group policy alag hoga"
  // (this table should look different per location, like the dashboard
  // does) -- default the list to this location's mapped groups, with an
  // explicit toggle to browse/map from the full account catalog.
  const [showAllGroups, setShowAllGroups] = useState(false);
  // Paired DEVICE policy id per group, keyed by group name (group names are
  // already enforced unique -- see validate()'s duplicate-name check below).
  // Populated on load (from real, is_active DEVICE policies) and kept in
  // sync by handleCreate (create/update)/handleDelete (deactivate).
  const [deviceRealIds, setDeviceRealIds] = useState<Record<string, string>>({});
  // Paired SESSION policy id per group, same name-keying and same lifecycle
  // as deviceRealIds above. This is the policy the guest login path actually
  // resolves for a session timeout -- see the handleCreate block below.
  const [sessionRealIds, setSessionRealIds] = useState<Record<string, string>>({});

  // The paired policies that must follow this group's bandwidth policy
  // everywhere it is assigned. Read straight off state so every mapping
  // handler below sends the same set and none can be forgotten.
  const pairedIdsFor = (groupName: string): PairedPolicyIds => [
    deviceRealIds[groupName],
    sessionRealIds[groupName],
  ];

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        const org = await resolveOrgId();
        setOrgId(org);
        const [real, deviceDetailsAll, sessionDetailsAll] = await Promise.all([
          bandwidthPolicyService.list(org),
          listPolicyDetails("device", org).catch(() => []),
          listPolicyDetails("session", org).catch(() => []),
        ]);
        // Backend's GET /policies has no is_active filter -- it returns
        // deactivated (deleted) policies right alongside active ones, so a
        // group removed via handleDelete's deactivatePolicy() call would
        // otherwise silently reappear here on next load/reload. Drop
        // archived entries client-side so "deleted" actually stays deleted.
        const active = real.filter((p) => p.status !== "archived");
        // Same filter for the paired DEVICE policies -- a deactivated
        // DEVICE policy has no reactivate path (see policy-engine.ts's
        // statusOf comment), so keeping a dead id keyed by name here would
        // mean the next save for a same-named group silently republished a
        // new version onto a policy resolve_effective_policy can never see.
        const deviceDetails = deviceDetailsAll.filter((d) => d.is_active);
        const deviceByName = new Map(
          deviceDetails.map((d) => [
            d.name,
            latestVersion(d)?.rules?.max_devices_per_guest as number | undefined,
          ]),
        );
        setDeviceRealIds(Object.fromEntries(deviceDetails.map((d) => [d.name, d.id])));
        // SESSION policies are name-keyed and archive-filtered exactly like
        // the DEVICE ones above, for the same reasons.
        const sessionDetails = sessionDetailsAll.filter((d) => d.is_active);
        const sessionByName = new Map(
          sessionDetails.map((d) => [
            d.name,
            latestVersion(d)?.rules?.session_timeout_minutes as number | undefined,
          ]),
        );
        setSessionRealIds(Object.fromEntries(sessionDetails.map((d) => [d.name, d.id])));
        // One assignments lookup per group -- listLocationMappings returns
        // *every* active location this group is mapped to in one call, so
        // this seeds both the "Map group" toggle's current-location state
        // (mappedAssignmentId) and the full account-wide picture
        // (mappedLocationIds) the "Mapped to N locations" column/modal
        // need, without any extra requests. Never skipped for lack of a
        // locationId -- unlike mappedAssignmentId (which has no location to
        // resolve against and stays null), mappedLocationIds is
        // location-independent and should read accurately even when
        // CreateGroup is rendered outside a location context.
        const withMapping = await Promise.all(
          active.map(async (p) => {
            let mappedAssignmentId: string | null = null;
            let mappedLocationIds: string[] = [];
            try {
              const mappings = await bandwidthPolicyService.listLocationMappings(p.id, org);
              mappedLocationIds = mappings.map((m) => m.locationId);
              if (locationId) {
                mappedAssignmentId =
                  mappings.find((m) => m.locationId === locationId)?.assignmentId ?? null;
              }
            } catch {
              mappedAssignmentId = null;
              mappedLocationIds = [];
            }
            // Real per-guest device enforcement reads the paired DEVICE
            // policy's max_devices_per_guest, never this bandwidth policy's
            // own (unread) devices_per_user field -- so the display value
            // reads back from the DEVICE policy when one exists, falling
            // back to the legacy bandwidth field only for a group that
            // predates this fix and has no paired DEVICE policy yet.
            const deviceMax = deviceByName.get(p.name);
            const devicesPerUser =
              deviceMax != null
                ? deviceMax >= UNLIMITED_DEVICES_SENTINEL
                  ? "Unlimited"
                  : String(deviceMax)
                : labelFromMinutes(p.devicesPerUser, DEVICES_COUNT, "");
            return {
              id: p.id,
              name: p.name,
              bandwidth: kbpsToLabel(p.downloadRateKbps),
              // Prefer the real SESSION policy -- that is the one the guest
              // login path resolves. A tier saved before this fix has only
              // the (unread) bandwidth copy, so fall back to it so the row
              // and the Edit form still show what was chosen; the next save
              // writes a real SESSION policy for it.
              sessionTimeout: labelFromMinutes(
                sessionByName.get(p.name) ?? p.sessionTimeoutMinutes,
                SESSION_TIMEOUT_MINUTES,
                "",
              ),
              idleTimeout: labelFromMinutes(p.idleTimeoutMinutes, IDLE_TIMEOUT_MINUTES, ""),
              devicesPerUser,
              dailyLimit: labelFromMinutes(p.dailyLimitMinutes, DAILY_LIMIT_MINUTES, "No Limit"),
              loginHours: p.loginHours ?? null,
              dataLimit: p.dataLimit ?? null,
              members: 0,
              mappedAssignmentId,
              mappedLocationIds,
            };
          }),
        );
        setGroups(withMapping);
      } catch {
        // Leave groups empty -- the "no groups yet" state is accurate.
      }
    })();
  }, [demo, locationId]);

  const [name, setName] = useState("");
  const [bw, setBw] = useState("");
  const [st, setSt] = useState("");
  const [it, setIt] = useState("");
  const [dp, setDp] = useState("");
  const [dl, setDl] = useState("No Limit");
  const [loginOn, setLoginOn] = useState(false);
  const [loginDays, setLoginDays] = useState<string[]>(
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Mon", "Tue", "Wed", "Thu", "Fri"].slice(0, 5),
  );
  const [loginFrom, setLoginFrom] = useState("09:00");
  const [loginTo, setLoginTo] = useState("18:00");
  const [dlOpen, setDlOpen] = useState(false);
  const [dlQuota, setDlQuota] = useState("");
  const [dlUnit, setDlUnit] = useState("GB");
  const [dlResets, setDlResets] = useState("Daily");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mappingBusy, setMappingBusy] = useState<Set<string>>(new Set());
  const [step3Done, setStep3Done] = useState(false);
  // The actual concurrency guard for handleToggleMap -- a ref, not the
  // mappingBusy *state* above. A same-tick double-click's second call can
  // run its guard check before React has committed the first call's
  // setMappingBusy update (state updates only take effect on the next
  // render), so checking mappingBusy itself let two rapid clicks both pass
  // the guard and each fire their own real request -- observed live as two
  // PolicyAssignment rows for one group/location instead of one. A ref
  // mutates synchronously and is visible to every call immediately,
  // closing that window; mappingBusy (state) still drives the disabled/
  // spinner UI, it's just no longer what's trusted for correctness.
  const mappingLock = useRef<Set<string>>(new Set());
  // "Map to locations…" -- the multi-select replacement for having to
  // switch the active location N times and click the single toggle above
  // N times. mapModalInitial is the *before* snapshot (locationId ->
  // assignmentId, straight from listLocationMappings when the modal opens)
  // and mapModalSelected is the working checkbox state; Save below diffs
  // the two so it only calls mapToLocation/unmapFromLocation for locations
  // that actually changed. Same ref-based concurrency guard pattern as
  // mappingLock above, for the same reason (Save is a single click but can
  // still double-fire).
  const [mapModalGroup, setMapModalGroup] = useState<Group | null>(null);
  const [mapModalInitial, setMapModalInitial] = useState<Record<string, string>>({});
  const [mapModalSelected, setMapModalSelected] = useState<Set<string>>(new Set());
  const [mapModalLoading, setMapModalLoading] = useState(false);
  const [mapModalSaving, setMapModalSaving] = useState(false);
  const [mapModalSearch, setMapModalSearch] = useState("");
  const mapModalLock = useRef(false);
  const { data: allLocations } = useCustomerLocations();
  const [step1Done, setStep1Done] = useState(false);
  // Bug report: "existing groups mai edit icon click nhi ho raha hai" --
  // the Pencil button had no onClick handler at all. Reuses handleClone's
  // own form-population logic (Edit and Clone only differ in whether the
  // saved name gets a "(copy)" suffix and whether saving creates a new
  // group or updates this one in place -- bandwidthPolicyService.save
  // already branches create-vs-update on `input.id`, so this only needs
  // to track which group is being edited).
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleDay = (d: string) =>
    setLoginDays((p) =>
      p.includes(d)
        ? p.filter((x) => x !== d)
        : [...p, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
    );
  const setField = (k: string, v: string) => {
    if (k === "name") setName(v);
    else if (k === "bw") setBw(v);
    else if (k === "st") setSt(v);
    else if (k === "it") setIt(v);
    else if (k === "dp") setDp(v);
    else if (k === "dl") setDl(v);
    setErrs((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name) e.name = "Required.";
    else if (groups.some((g) => g.id !== editingId && g.name.toLowerCase() === name.toLowerCase()))
      e.name = "A tier with this name already exists.";
    if (!bw) e.bw = "Required.";
    if (!st) e.st = "Required.";
    if (!it) e.it = "Required.";
    if (!dp) e.dp = "Required.";
    if (st && it) {
      const toMin = (v: string) => {
        const n = parseInt(v);
        return v.includes("hr") ? n * 60 : v.includes("min") ? n : Infinity;
      };
      if (toMin(it) > toMin(st)) e.it = "Idle timeout can't be longer than the session timeout.";
    }
    if (loginOn) {
      if (loginDays.length === 0) e.loginDays = "Select at least one day.";
      if (loginFrom >= loginTo) e.loginTo = "End must be after start.";
    }
    if (dlOpen && (!dlQuota || parseFloat(dlQuota) <= 0)) e.dlQuota = "Must be greater than 0.";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const resetForm = () => {
    setName("");
    setBw("");
    setSt("");
    setIt("");
    setDp("");
    setDl("No Limit");
    setLoginOn(false);
    setLoginDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setLoginFrom("09:00");
    setLoginTo("18:00");
    setDlOpen(false);
    setDlQuota("");
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    const dataLimit = dlOpen
      ? { quota: parseFloat(dlQuota) || 0, unit: dlUnit, resets: dlResets }
      : null;
    const loginHours = loginOn
      ? {
          days: [...loginDays].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
          from: loginFrom,
          to: loginTo,
        }
      : null;
    const isEdit = editingId !== null;

    if (demo) {
      setTimeout(() => {
        if (isEdit) {
          setGroups((prev) =>
            prev.map((g) =>
              g.id === editingId
                ? {
                    ...g,
                    name,
                    bandwidth: bw,
                    sessionTimeout: st,
                    idleTimeout: it,
                    devicesPerUser: dp,
                    dailyLimit: dl,
                    loginHours,
                    dataLimit,
                  }
                : g,
            ),
          );
        } else {
          setGroups((prev) => [
            {
              id: `g${Date.now()}`,
              name,
              bandwidth: bw,
              sessionTimeout: st,
              idleTimeout: it,
              devicesPerUser: dp,
              dailyLimit: dl,
              loginHours,
              dataLimit,
              members: 0,
              mappedAssignmentId: null,
              mappedLocationIds: [],
            },
            ...prev,
          ]);
        }
        setSaving(false);
        setStep1Done(true);
        setPage(0);
        resetForm();
        setToast(isEdit ? "Access tier updated." : "Access tier created.");
        setTimeout(() => setToast(null), 3500);
      }, 500);
      return;
    }

    try {
      const rateKbps = BANDWIDTH_KBPS[bw] ?? 0;
      const saved = await bandwidthPolicyService.save(
        {
          id: editingId ?? undefined,
          name,
          status: "active",
          downloadRateKbps: rateKbps,
          uploadRateKbps: rateKbps,
          sessionTimeoutMinutes: SESSION_TIMEOUT_MINUTES[st] ?? null,
          idleTimeoutMinutes: IDLE_TIMEOUT_MINUTES[it] ?? null,
          devicesPerUser: DEVICES_COUNT[dp] ?? null,
          dailyLimitMinutes: DAILY_LIMIT_MINUTES[dl] ?? null,
          loginHours,
          dataLimit,
        },
        orgId ?? undefined,
      );

      // Mirror the paired DEVICE policy -- the real, backend-enforced
      // per-guest device limit (guest/service.py's _resolve_device_limit)
      // reads DevicePolicyRules.max_devices_per_guest off this separate
      // policy, not the bandwidth policy's devices_per_user field above
      // (that field is written but never read anywhere). Only the policy's
      // own rules are created/updated here -- no location assignment,
      // matching how the bandwidth policy itself has zero real effect
      // until it's explicitly mapped via handleToggleMap/
      // handleSaveMapModal/mapGuest below.
      //
      // Paired policies created during THIS save. They start with no
      // assignments of their own, so anywhere the bandwidth policy is
      // ALREADY mapped they would resolve to nothing -- see the backfill
      // below.
      const createdPairedIds: string[] = [];

      const maxDevices = dp === "Unlimited" ? UNLIMITED_DEVICES_SENTINEL : parseInt(dp, 10);
      const deviceRules = { max_devices_per_guest: maxDevices };
      const existingDeviceId = deviceRealIds[name];
      if (existingDeviceId) {
        await updatePolicyRules({
          id: existingDeviceId,
          rules: deviceRules,
          publish: true,
          archive: false,
          organizationId: orgId ?? undefined,
        });
      } else {
        const createdDevice = await createPolicyWithRules({
          policyType: "device",
          name,
          description: null,
          rules: deviceRules,
          publish: true,
          organizationId: orgId ?? undefined,
        });
        setDeviceRealIds((prev) => ({ ...prev, [name]: createdDevice.id }));
        createdPairedIds.push(createdDevice.id);
      }

      // Session Timeout -- the real one. This form used to write
      // `session_timeout_minutes` into the BANDWIDTH policy's rules JSON
      // (`sessionTimeoutMinutes` in the bandwidthPolicyService.save call
      // above, which stays for backward-compatible reads). The backend
      // accepts that happily, and nothing on the guest side ever reads it:
      // the login path calls `resolve_effective_policy(policy_type=SESSION)`
      // and `list_candidate_assignments` filters candidates by type, so a
      // bandwidth policy is never even a candidate. The picker saved, read
      // back correctly on reload, and every guest still got the platform
      // default of 240 minutes. Identical to the LocationPolicies.tsx bug
      // fixed in d5fdd91 / PR #225; the constants and the full four-field
      // rules body are shared from policy-engine.ts rather than copied, so
      // the two screens cannot drift. Same name-keyed upsert shape as the
      // DEVICE policy directly above.
      const sessionMinutes = SESSION_TIMEOUT_MINUTES[st];
      if (sessionMinutes) {
        const sessionRules = sessionPolicyRules(sessionMinutes);
        const existingSessionId = sessionRealIds[name];
        if (existingSessionId) {
          await updatePolicyRules({
            id: existingSessionId,
            rules: sessionRules,
            publish: true,
            archive: false,
            organizationId: orgId ?? undefined,
          });
        } else {
          const createdSession = await createPolicyWithRules({
            policyType: "session",
            name,
            description: null,
            rules: sessionRules,
            publish: true,
            organizationId: orgId ?? undefined,
          });
          setSessionRealIds((prev) => ({ ...prev, [name]: createdSession.id }));
          createdPairedIds.push(createdSession.id);
        }
      }

      // Backfill: a tier that already exists is already mapped to
      // locations, and a paired policy created just now has none of those
      // assignments. `resolve_effective_policy` walks assignments, so
      // without this an operator editing an existing tier's Session Timeout
      // would get a correct SESSION policy that resolves for nobody and
      // still see every guest on 240 minutes -- the same bug one step
      // further along. Only ids created in THIS save are mapped, so this
      // can never duplicate an assignment a previous save already made, and
      // for a brand-new tier the mapping list is empty and this is a no-op.
      // Best-effort: the tier itself is already saved, so a failure here
      // must not present as "could not save" -- the next map/unmap from the
      // table repairs it through the mirror helpers.
      if (createdPairedIds.length > 0) {
        try {
          const existingMappings = await bandwidthPolicyService.listLocationMappings(
            saved.id,
            orgId ?? undefined,
          );
          await Promise.all(
            existingMappings.flatMap((m) =>
              createdPairedIds.map((policyId) =>
                bandwidthPolicyService.mapToLocation(policyId, m.locationId, orgId ?? undefined),
              ),
            ),
          );
        } catch {
          // Intentionally silent -- see above.
        }
      }

      if (isEdit) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === saved.id
              ? {
                  ...g,
                  name,
                  bandwidth: bw,
                  sessionTimeout: st,
                  idleTimeout: it,
                  devicesPerUser: dp,
                  dailyLimit: dl,
                  loginHours,
                  dataLimit,
                }
              : g,
          ),
        );
      } else {
        setGroups((prev) => [
          {
            id: saved.id,
            name,
            bandwidth: bw,
            sessionTimeout: st,
            idleTimeout: it,
            devicesPerUser: dp,
            dailyLimit: dl,
            loginHours,
            dataLimit,
            members: 0,
            mappedAssignmentId: null,
            mappedLocationIds: [],
          },
          ...prev,
        ]);
      }
      setStep1Done(true);
      setPage(0);
      resetForm();
      setToast(isEdit ? "Access tier updated." : "Access tier created.");
      setTimeout(() => setToast(null), 3500);
    } catch {
      setToast(
        isEdit
          ? "Could not update the access tier — check the connection and try again."
          : "Could not create the access tier — check the connection and try again.",
      );
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirmingId === id) {
      const prev = groups;
      const groupName = groups.find((g) => g.id === id)?.name;
      setGroups((p) => p.filter((g) => g.id !== id));
      setConfirmingId(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (!demo) {
        bandwidthPolicyService.remove(id, orgId ?? undefined).catch(() => {
          setGroups(prev);
          setToast("Could not delete on the server.");
          setTimeout(() => setToast(null), 2500);
        });
        // Removing a tier means all of its real effects go away, not just
        // bandwidth -- deactivate its paired DEVICE policy too, if one was
        // ever saved for this tier. Cleared from deviceRealIds up front
        // (before the network call settles) so a same-session re-save under
        // this same name creates a fresh DEVICE policy instead of reviving
        // the one just deactivated -- same reasoning as bandwidth's own id
        // handling via the id-in-`groups` state above.
        if (groupName) {
          const pairedIds = pairedIdsFor(groupName);
          setDeviceRealIds((prevIds) => {
            const n = { ...prevIds };
            delete n[groupName];
            return n;
          });
          setSessionRealIds((prevIds) => {
            const n = { ...prevIds };
            delete n[groupName];
            return n;
          });
          realIdsOf(pairedIds).forEach((policyId) => {
            deactivatePolicy(policyId, orgId ?? undefined).catch(() => {});
          });
        }
      }
    } else {
      setConfirmingId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
    }
  };

  // "Map group" -- toggles this group's real PolicyAssignment to the
  // current location on/off. Guarded against double-submission
  // (mappingBusy) since the backend itself doesn't reject a second active
  // assignment at the same scope -- see bandwidth-policy.service.ts's
  // mapToLocation doc comment.
  const handleToggleMap = async (g: Group) => {
    if (!locationId) {
      setToast("Select a location to map this tier.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (mappingLock.current.has(g.id)) return;
    mappingLock.current.add(g.id);
    setMappingBusy((p) => new Set(p).add(g.id));
    const wasMapped = !!g.mappedAssignmentId;
    try {
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        setGroups((prev) =>
          prev.map((x) =>
            x.id === g.id
              ? {
                  ...x,
                  mappedAssignmentId: wasMapped ? null : `demo-${g.id}`,
                  mappedLocationIds: wasMapped
                    ? x.mappedLocationIds.filter((id) => id !== locationId)
                    : [...new Set([...x.mappedLocationIds, locationId])],
                }
              : x,
          ),
        );
      } else if (wasMapped) {
        await bandwidthPolicyService.unmapFromLocation(
          g.id,
          g.mappedAssignmentId as string,
          orgId ?? undefined,
        );
        await mirrorPairedLocationUnmap(pairedIdsFor(g.name), locationId, orgId ?? undefined);
        setGroups((prev) =>
          prev.map((x) =>
            x.id === g.id
              ? {
                  ...x,
                  mappedAssignmentId: null,
                  mappedLocationIds: x.mappedLocationIds.filter((id) => id !== locationId),
                }
              : x,
          ),
        );
      } else {
        const assignmentId = await bandwidthPolicyService.mapToLocation(
          g.id,
          locationId,
          orgId ?? undefined,
        );
        await mirrorPairedLocationMap(pairedIdsFor(g.name), locationId, orgId ?? undefined);
        setGroups((prev) =>
          prev.map((x) =>
            x.id === g.id
              ? {
                  ...x,
                  mappedAssignmentId: assignmentId,
                  mappedLocationIds: [...new Set([...x.mappedLocationIds, locationId])],
                }
              : x,
          ),
        );
      }
      setToast(
        wasMapped ? `${g.name} unmapped from this location.` : `${g.name} mapped to this location.`,
      );
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast(
        `Could not ${wasMapped ? "unmap" : "map"} ${g.name} — check the connection and try again.`,
      );
      setTimeout(() => setToast(null), 2500);
    } finally {
      mappingLock.current.delete(g.id);
      setMappingBusy((p) => {
        const n = new Set(p);
        n.delete(g.id);
        return n;
      });
    }
  };

  // Opens "Map to locations…" and re-fetches this tier's mappings fresh
  // from the server (rather than trusting the table's already-loaded
  // mappedLocationIds) so the checklist can't open stale if another tab/
  // session changed something since the table last loaded.
  const openMapModal = async (g: Group) => {
    setMapModalGroup(g);
    setMapModalSearch("");
    setMapModalLoading(true);
    try {
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const initial: Record<string, string> = {};
        g.mappedLocationIds.forEach((locId) => {
          initial[locId] = `demo-${g.id}-${locId}`;
        });
        setMapModalInitial(initial);
        setMapModalSelected(new Set(g.mappedLocationIds));
      } else {
        const mappings = await bandwidthPolicyService.listLocationMappings(
          g.id,
          orgId ?? undefined,
        );
        const initial: Record<string, string> = {};
        mappings.forEach((m) => {
          initial[m.locationId] = m.assignmentId;
        });
        setMapModalInitial(initial);
        setMapModalSelected(new Set(mappings.map((m) => m.locationId)));
      }
    } catch {
      setMapModalInitial({});
      setMapModalSelected(new Set());
      setToast("Could not load this tier's current location mappings.");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setMapModalLoading(false);
    }
  };

  const closeMapModal = () => {
    if (mapModalSaving) return;
    setMapModalGroup(null);
    setMapModalInitial({});
    setMapModalSelected(new Set());
    setMapModalSearch("");
  };

  const toggleMapModalLocation = (locId: string) => {
    setMapModalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  };

  // Diffs mapModalInitial (before) against mapModalSelected (after) and
  // only calls mapToLocation/unmapFromLocation for locations whose
  // checkbox state actually changed -- not a bulk "set all" call, since
  // there isn't one on the backend and re-mapping unchanged locations
  // would just create noise (mapToLocation is idempotent but still an
  // extra request and a redundant PolicyAssignment lookup).
  const handleSaveMapModal = async () => {
    if (!mapModalGroup || mapModalLock.current) return;
    const g = mapModalGroup;
    const beforeIds = new Set(Object.keys(mapModalInitial));
    const toAdd = [...mapModalSelected].filter((id) => !beforeIds.has(id));
    const toRemove = [...beforeIds].filter((id) => !mapModalSelected.has(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      closeMapModal();
      return;
    }
    mapModalLock.current = true;
    setMapModalSaving(true);
    try {
      let finalMap: Record<string, string>;
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        finalMap = {};
        mapModalSelected.forEach((locId) => {
          finalMap[locId] = mapModalInitial[locId] ?? `demo-${g.id}-${locId}`;
        });
      } else {
        const paired = pairedIdsFor(g.name);
        const [addResults] = await Promise.all([
          Promise.all(
            toAdd.map(async (locId) => {
              const [assignmentId] = await Promise.all([
                bandwidthPolicyService.mapToLocation(g.id, locId, orgId ?? undefined),
                mirrorPairedLocationMap(paired, locId, orgId ?? undefined),
              ]);
              return { locId, assignmentId };
            }),
          ),
          Promise.all(
            toRemove.map((locId) =>
              Promise.all([
                bandwidthPolicyService.unmapFromLocation(
                  g.id,
                  mapModalInitial[locId],
                  orgId ?? undefined,
                ),
                mirrorPairedLocationUnmap(paired, locId, orgId ?? undefined),
              ]),
            ),
          ),
        ]);
        finalMap = {};
        mapModalSelected.forEach((locId) => {
          const added = addResults.find((a) => a.locId === locId);
          finalMap[locId] = added ? added.assignmentId : mapModalInitial[locId];
        });
      }
      const finalLocationIds = Object.keys(finalMap);
      setGroups((prev) =>
        prev.map((x) =>
          x.id === g.id
            ? {
                ...x,
                mappedLocationIds: finalLocationIds,
                mappedAssignmentId: locationId
                  ? (finalMap[locationId] ?? null)
                  : x.mappedAssignmentId,
              }
            : x,
        ),
      );
      const n = finalLocationIds.length;
      setToast(`${g.name} is now mapped to ${n} location${n === 1 ? "" : "s"}.`);
      setTimeout(() => setToast(null), 2500);
      closeMapModal();
    } catch {
      // Promise.all doesn't roll back calls that already succeeded before
      // one of them rejected, so this tier's real server-side state may
      // now sit somewhere between mapModalInitial and mapModalSelected.
      // Re-fetch it rather than assume either one, so the table never
      // shows a count that doesn't match reality.
      if (!demo) {
        try {
          const mappings = await bandwidthPolicyService.listLocationMappings(
            g.id,
            orgId ?? undefined,
          );
          setGroups((prev) =>
            prev.map((x) =>
              x.id === g.id
                ? {
                    ...x,
                    mappedLocationIds: mappings.map((m) => m.locationId),
                    mappedAssignmentId: locationId
                      ? (mappings.find((m) => m.locationId === locationId)?.assignmentId ?? null)
                      : x.mappedAssignmentId,
                  }
                : x,
            ),
          );
        } catch {
          // Leave the table's existing (now possibly stale) state alone --
          // better than clobbering it with another guess.
        }
      }
      setToast(
        `Could not fully update ${g.name}'s location mappings — check the connection and try again.`,
      );
      setTimeout(() => setToast(null), 3000);
    } finally {
      mapModalLock.current = false;
      setMapModalSaving(false);
    }
  };

  // "Map users" (step 3) -- assigns specific guests into a group already
  // mapped to this location, via a real GUEST-targeted PolicyAssignment
  // (backend/app/domains/policy/constants.py's PolicyAssignmentTargetType
  // .GUEST). Only reachable once the group itself is mapped (handleToggleMap
  // above) -- mirrors the flow the bug report itself described: create the
  // group, map the group, then map users into it.
  const [usersModalGroup, setUsersModalGroup] = useState<Group | null>(null);
  const [mappedGuests, setMappedGuests] = useState<
    { assignmentId: string; guestId: string; label: string }[]
  >([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [guestResults, setGuestResults] = useState<Guest[]>([]);
  const [guestSearchBusy, setGuestSearchBusy] = useState(false);
  const [guestActionBusy, setGuestActionBusy] = useState<Set<string>>(new Set());
  const guestActionLock = useRef<Set<string>>(new Set());
  // A guest may only be actively mapped into one group at a time (backend-
  // enforced -- see bandwidth-policy.service.ts's guestCurrentGroup doc
  // comment). Keyed by guestId; undefined == not looked up yet, null ==
  // not mapped anywhere. Populated per search-result batch so the modal can
  // show "Already in <group>" and offer a clean switch instead of letting
  // a second "Map" click silently fail (or worse, appear to double-map).
  const [guestCurrentGroups, setGuestCurrentGroups] = useState<
    Record<string, { policyId: string; policyName: string; assignmentId: string } | null>
  >({});
  const DEMO_GUESTS: Guest[] = [
    {
      id: "dg1",
      organizationId: "demo",
      organizationName: "Demo Org",
      locationId: locationId ?? null,
      locationName: null,
      identifier: "+91 98765 43210",
      displayName: "Aarav Shah",
      firstSeenAt: "",
      lastSeenAt: "",
      totalVisitCount: 4,
      isBlocked: false,
      blockedReason: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "dg2",
      organizationId: "demo",
      organizationName: "Demo Org",
      locationId: locationId ?? null,
      locationName: null,
      identifier: "priya@example.com",
      displayName: "Priya Nair",
      firstSeenAt: "",
      lastSeenAt: "",
      totalVisitCount: 1,
      isBlocked: false,
      blockedReason: null,
      createdAt: "",
      updatedAt: "",
    },
  ];

  const openUsersModal = async (g: Group) => {
    setUsersModalGroup(g);
    setGuestSearch("");
    setGuestResults([]);
    if (!locationId) return;
    setGuestsLoading(true);
    try {
      if (demo) {
        setMappedGuests([
          {
            assignmentId: `demo-map-${DEMO_GUESTS[0].id}`,
            guestId: DEMO_GUESTS[0].id,
            label: `${DEMO_GUESTS[0].displayName} · ${DEMO_GUESTS[0].identifier}`,
          },
        ]);
        setStep3Done(true);
      } else {
        const mappings = await bandwidthPolicyService.guestMappings(
          g.id,
          locationId,
          orgId ?? undefined,
        );
        const resolved = await Promise.all(
          mappings.map(async (m) => {
            const guest = await guestService.get(m.guestId, orgId ?? undefined).catch(() => null);
            const label = guest
              ? `${guest.displayName ?? guest.identifier} · ${guest.identifier}`
              : m.guestId;
            return { ...m, label };
          }),
        );
        setMappedGuests(resolved);
        if (resolved.length > 0) setStep3Done(true);
      }
    } catch {
      setMappedGuests([]);
    } finally {
      setGuestsLoading(false);
    }
  };

  const searchGuests = async () => {
    if (!guestSearch.trim()) {
      setGuestResults([]);
      return;
    }
    setGuestSearchBusy(true);
    try {
      if (demo) {
        const q = guestSearch.trim().toLowerCase();
        setGuestResults(
          DEMO_GUESTS.filter(
            (g) =>
              g.identifier.toLowerCase().includes(q) ||
              (g.displayName ?? "").toLowerCase().includes(q),
          ),
        );
      } else {
        const { rows } = await guestService.list({
          search: guestSearch.trim(),
          page: 1,
          pageSize: 10,
          organizationId: orgId ?? undefined,
          locationId,
        });
        const results = locationId ? rows.filter((r) => r.locationId === locationId) : rows;
        setGuestResults(results);
        // One "which group is this guest already in" lookup per result --
        // a small, bounded batch (this page size caps at 10), and the only
        // way to show "Already in <group>" before the user clicks Map.
        const entries = await Promise.all(
          results.map(
            async (g) =>
              [
                g.id,
                await bandwidthPolicyService
                  .guestCurrentGroup(g.id, orgId ?? undefined)
                  .catch(() => null),
              ] as const,
          ),
        );
        setGuestCurrentGroups((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    } catch {
      setGuestResults([]);
    } finally {
      setGuestSearchBusy(false);
    }
  };

  const mapGuest = async (guest: Guest) => {
    if (!usersModalGroup || !locationId || guestActionLock.current.has(guest.id)) return;
    // Already mapped into a *different* group -- the backend rejects this
    // (one guest, one group, see guestCurrentGroup's own doc comment), and
    // there's nothing this click should silently do about it: the caller
    // must use "Switch group" (switchGuestGroup below), which explicitly
    // unmaps the old one first.
    const other = guestCurrentGroups[guest.id];
    if (other && other.policyId !== usersModalGroup.id) return;
    guestActionLock.current.add(guest.id);
    setGuestActionBusy((p) => new Set(p).add(guest.id));
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 300));
        setMappedGuests((p) =>
          p.some((m) => m.guestId === guest.id)
            ? p
            : [
                ...p,
                {
                  assignmentId: `demo-map-${guest.id}`,
                  guestId: guest.id,
                  label: `${guest.displayName ?? guest.identifier} · ${guest.identifier}`,
                },
              ],
        );
      } else {
        const [assignmentId] = await Promise.all([
          bandwidthPolicyService.mapGuestToLocation(
            usersModalGroup.id,
            locationId,
            guest.id,
            orgId ?? undefined,
          ),
          mirrorPairedGuestMap(
            pairedIdsFor(usersModalGroup.name),
            locationId,
            guest.id,
            orgId ?? undefined,
          ),
        ]);
        setMappedGuests((p) =>
          p.some((m) => m.guestId === guest.id)
            ? p
            : [
                ...p,
                {
                  assignmentId,
                  guestId: guest.id,
                  label: `${guest.displayName ?? guest.identifier} · ${guest.identifier}`,
                },
              ],
        );
        setGuestCurrentGroups((p) => ({
          ...p,
          [guest.id]: {
            policyId: usersModalGroup.id,
            policyName: usersModalGroup.name,
            assignmentId,
          },
        }));
      }
      setStep3Done(true);
      setToast(`${guest.displayName ?? guest.identifier} mapped into ${usersModalGroup.name}.`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast(
        "Could not map this guest — they may already be in another tier, or check the connection and try again.",
      );
      setTimeout(() => setToast(null), 2500);
    } finally {
      guestActionLock.current.delete(guest.id);
      setGuestActionBusy((p) => {
        const n = new Set(p);
        n.delete(guest.id);
        return n;
      });
    }
  };

  // "Switch group" -- a guest already active in a different group: unmap
  // them from it, then map them into the one this modal is open for. Two
  // real backend calls, not a special endpoint, but presented as one
  // atomic-feeling action so the one-guest-one-group rule never reads as
  // a dead end.
  const switchGuestGroup = async (
    guest: Guest,
    other: { policyId: string; policyName: string; assignmentId: string },
  ) => {
    if (!usersModalGroup || !locationId || guestActionLock.current.has(guest.id)) return;
    guestActionLock.current.add(guest.id);
    setGuestActionBusy((p) => new Set(p).add(guest.id));
    try {
      await Promise.all([
        bandwidthPolicyService.unmapGuestFromLocation(
          other.policyId,
          other.assignmentId,
          orgId ?? undefined,
        ),
        mirrorPairedGuestUnmap(
          pairedIdsFor(other.policyName),
          locationId,
          guest.id,
          orgId ?? undefined,
        ),
      ]);
      const [assignmentId] = await Promise.all([
        bandwidthPolicyService.mapGuestToLocation(
          usersModalGroup.id,
          locationId,
          guest.id,
          orgId ?? undefined,
        ),
        mirrorPairedGuestMap(
          pairedIdsFor(usersModalGroup.name),
          locationId,
          guest.id,
          orgId ?? undefined,
        ),
      ]);
      setMappedGuests((p) =>
        p.some((m) => m.guestId === guest.id)
          ? p
          : [
              ...p,
              {
                assignmentId,
                guestId: guest.id,
                label: `${guest.displayName ?? guest.identifier} · ${guest.identifier}`,
              },
            ],
      );
      setGuestCurrentGroups((p) => ({
        ...p,
        [guest.id]: {
          policyId: usersModalGroup.id,
          policyName: usersModalGroup.name,
          assignmentId,
        },
      }));
      setStep3Done(true);
      setToast(
        `${guest.displayName ?? guest.identifier} moved from ${other.policyName} to ${usersModalGroup.name}.`,
      );
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not switch this guest's tier — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    } finally {
      guestActionLock.current.delete(guest.id);
      setGuestActionBusy((p) => {
        const n = new Set(p);
        n.delete(guest.id);
        return n;
      });
    }
  };

  const unmapGuest = async (mapping: { assignmentId: string; guestId: string; label: string }) => {
    if (!usersModalGroup || guestActionLock.current.has(mapping.guestId)) return;
    guestActionLock.current.add(mapping.guestId);
    setGuestActionBusy((p) => new Set(p).add(mapping.guestId));
    try {
      if (!demo && locationId) {
        await Promise.all([
          bandwidthPolicyService.unmapGuestFromLocation(
            usersModalGroup.id,
            mapping.assignmentId,
            orgId ?? undefined,
          ),
          mirrorPairedGuestUnmap(
            pairedIdsFor(usersModalGroup.name),
            locationId,
            mapping.guestId,
            orgId ?? undefined,
          ),
        ]);
      } else if (!demo) {
        await bandwidthPolicyService.unmapGuestFromLocation(
          usersModalGroup.id,
          mapping.assignmentId,
          orgId ?? undefined,
        );
      }
      setMappedGuests((p) => p.filter((m) => m.guestId !== mapping.guestId));
      setGuestCurrentGroups((p) => ({ ...p, [mapping.guestId]: null }));
      setToast(`${mapping.label} unmapped from ${usersModalGroup.name}.`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not unmap this guest — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    } finally {
      guestActionLock.current.delete(mapping.guestId);
      setGuestActionBusy((p) => {
        const n = new Set(p);
        n.delete(mapping.guestId);
        return n;
      });
    }
  };

  const handleClone = (g: Group) => {
    setEditingId(null);
    setName(`${g.name} (copy)`);
    setBw(g.bandwidth);
    setSt(g.sessionTimeout);
    setIt(g.idleTimeout);
    setDp(g.devicesPerUser);
    setDl(g.dailyLimit);
    if (g.loginHours) {
      setLoginOn(true);
      setLoginDays(g.loginHours.days);
      setLoginFrom(g.loginHours.from);
      setLoginTo(g.loginHours.to);
    } else {
      setLoginOn(false);
    }
    if (g.dataLimit) {
      setDlOpen(true);
      setDlQuota(String(g.dataLimit.quota));
      setDlUnit(g.dataLimit.unit);
      setDlResets(g.dataLimit.resets);
    } else {
      setDlOpen(false);
    }
    document.getElementById("create-group-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEdit = (g: Group) => {
    setEditingId(g.id);
    setName(g.name);
    setBw(g.bandwidth);
    setSt(g.sessionTimeout);
    setIt(g.idleTimeout);
    setDp(g.devicesPerUser);
    setDl(g.dailyLimit);
    if (g.loginHours) {
      setLoginOn(true);
      setLoginDays(g.loginHours.days);
      setLoginFrom(g.loginHours.from);
      setLoginTo(g.loginHours.to);
    } else {
      setLoginOn(false);
    }
    if (g.dataLimit) {
      setDlOpen(true);
      setDlQuota(String(g.dataLimit.quota));
      setDlUnit(g.dataLimit.unit);
      setDlResets(g.dataLimit.resets);
    } else {
      setDlOpen(false);
    }
    setErrs({});
    document.getElementById("create-group-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const scoped =
      !showAllGroups && locationId ? groups.filter((g) => g.mappedAssignmentId) : groups;
    return scoped.filter((g) => !q || g.name.toLowerCase().includes(q) || g.bandwidth.includes(q));
  }, [groups, search, showAllGroups, locationId]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  // Drives the "Map group" stepper's caption/color below -- true once at
  // least one group has been mapped to this location via the real "Map"
  // button in the Existing Groups table.
  const step2Done = groups.some((g) => g.mappedAssignmentId);
  // Drives "Map users"'s own caption -- true once a guest has actually been
  // mapped into a group this session (see mapGuest/unmapGuest below). Not
  // re-derived from a full per-group guest-mapping fetch on every load (that
  // would mean an extra request per group just to paint a status dot); the
  // "Users" column inside each open modal is always the real, authoritative
  // per-group state regardless of this cosmetic session flag.

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          <span>{toast}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Users className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Access Tiers</h1>
            <p className="text-sm text-muted-foreground">
              Give a group of guests their own bandwidth and access limits, separate from the
              location default.
            </p>
          </div>
        </div>
        <GroupMappingIllustration />
      </div>

      {/* Stepper wrapped in its own card with a plain-English summary of
          what "map" means for a non-technical owner underneath -- the
          three-icon row alone doesn't explain that "Map tier" is the step
          that actually chooses which location uses this tier's settings. */}
      <div className="rounded-xl border bg-card p-4">
        <ol className="flex items-center gap-0" aria-label="Progress">
          {STEPS.map((s, i) => {
            // Step 1's "done" readout is step1Done (a group was just
            // created/edited this session); step 2's is step2Done (a real,
            // persisted PolicyAssignment exists for some group at this
            // location); step 3's is step3Done (a real guest has been mapped
            // into some group's "Map users" panel -- see openUsersModal/
            // mapGuest below).
            const done = s.num === 1 ? step1Done : s.num === 2 ? step2Done : step3Done;
            const caption = s.num === 1 ? s.caption : done ? "Mapped" : "Not started";
            return (
              <li
                key={s.num}
                className="flex items-center flex-1"
                aria-current={s.num === 1 && !step1Done ? "step" : undefined}
              >
                <div className="flex flex-col items-center min-w-0">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-colors ${done ? "bg-indigo-500" : s.num === 1 ? "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]" : "bg-slate-100 dark:bg-slate-700"}`}
                  >
                    <s.icon
                      className={`h-4 w-4 ${done || s.num === 1 ? "text-white" : "text-slate-400 dark:text-slate-500"}`}
                    />
                  </div>
                  <p
                    className={`mt-1 text-xs font-medium ${s.num === 1 || done ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}
                  >
                    {s.label}
                  </p>
                  {caption && (
                    <p
                      className={`text-[10px] ${done ? "text-indigo-500" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      {caption}
                    </p>
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 ${(i === 0 && step1Done) || (i === 1 && step2Done) ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-600"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          Set a tier's limits, map it to the location(s) that should use it, then optionally assign
          specific guests to it.
        </p>
      </div>

      <Card id="create-group-form" className="border-0 shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {editingId ? "Edit Access Tier" : "Create Access Tier"}
              </h2>
              <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                Members of this tier get its bandwidth, timeout, and access settings instead of the
                location default.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="mt-5 max-w-md">
            <label
              htmlFor="g-name"
              className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Tier Name <span className="text-indigo-500">*</span>
            </label>
            <input
              id="g-name"
              type="text"
              placeholder="e.g. Staff, Long-stay guests"
              value={name}
              onChange={(e) => setField("name", e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {errs.name ? (
              <p className="mt-1 text-xs text-indigo-500">{errs.name}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                A short, recognizable name for this tier.
              </p>
            )}
          </div>

          <div className="mt-5 space-y-5">
            {/* Speed & Devices -- bandwidth, device count, and the optional
              data limit are all "how much" settings, grouped together
              (same grouping used on Guest WiFi Limits) instead of being
              scattered across a flat field grid. */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Speed &amp; Devices
              </h3>
              <p className="mb-4 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                How fast members connect, and how many devices each member can use.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="g-bw"
                  label="Bandwidth"
                  required
                  value={bw}
                  onChange={(v) => setField("bw", v)}
                  options={BANDWIDTH}
                  placeholder="Choose bandwidth"
                  caption="Maximum speed per device in this tier."
                  err={errs.bw}
                />
                <Select
                  id="g-dp"
                  label="Devices Per User"
                  required
                  value={dp}
                  onChange={(v) => setField("dp", v)}
                  options={DEVICES}
                  placeholder="Choose devices per user"
                  caption="How many devices one person can connect at the same time."
                  err={errs.dp}
                />
              </div>

              <button
                type="button"
                onClick={() => setDlOpen((p) => !p)}
                aria-expanded={dlOpen}
                aria-controls="dl-panel"
                className="mt-4 flex w-full items-center justify-between rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Plus className="h-4 w-4 text-indigo-500" /> Add a data limit{" "}
                  <span className="text-xs font-normal text-slate-400">(Optional)</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${dlOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dlOpen && (
                <div id="dl-panel" className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="g-dq"
                      className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Quota
                    </label>
                    <input
                      id="g-dq"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0"
                      value={dlQuota}
                      onChange={(e) => setDlQuota(e.target.value)}
                      className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                    {errs.dlQuota && <p className="mt-1 text-xs text-indigo-500">{errs.dlQuota}</p>}
                  </div>
                  <div>
                    <label
                      htmlFor="g-du"
                      className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Unit
                    </label>
                    <select
                      id="g-du"
                      value={dlUnit}
                      onChange={(e) => setDlUnit(e.target.value)}
                      className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {DATA_UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="g-dr"
                      className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Resets
                    </label>
                    <select
                      id="g-dr"
                      value={dlResets}
                      onChange={(e) => setDlResets(e.target.value)}
                      className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {RESETS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Time Limits -- session/idle timeout, the daily cap, and login
              hours are all "when" settings, grouped together (parallel to
              Guest WiFi Limits' own Time Limits section). */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Time Limits
              </h3>
              <p className="mb-4 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                When a member gets disconnected, has to sign in again, or can connect at all.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  id="g-st"
                  label="Session Timeout"
                  required
                  value={st}
                  onChange={(v) => setField("st", v)}
                  options={SESSION_TIMEOUT}
                  placeholder="Choose session timeout"
                  caption="Re-authenticate after this much time."
                  err={errs.st}
                />
                <Select
                  id="g-it"
                  label="Idle Timeout"
                  required
                  value={it}
                  onChange={(v) => setField("it", v)}
                  options={IDLE_TIMEOUT}
                  placeholder="Choose idle timeout"
                  caption="Disconnect after this much inactivity."
                  err={errs.it}
                />
                <Select
                  id="g-dl"
                  label="Maximum Daily Session Limit"
                  value={dl}
                  onChange={(v) => setField("dl", v)}
                  options={DAILY_LIMIT}
                  placeholder="Choose daily limit"
                  caption="Total session time allowed per day."
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md border border-dashed border-slate-300 px-3 py-2.5 dark:border-slate-600">
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Restrict login hours
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Limit when members can connect. Off means any time.
                  </p>
                </div>
                <Switch
                  checked={loginOn}
                  onCheckedChange={() => setLoginOn((p) => !p)}
                  aria-label="Restrict login hours"
                />
              </div>

              {loginOn && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${loginDays.includes(d) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  {errs.loginDays && <p className="text-xs text-indigo-500">{errs.loginDays}</p>}
                  <div className="flex gap-3">
                    <div>
                      <label
                        htmlFor="g-lf"
                        className="mb-0.5 block text-xs text-slate-500 dark:text-slate-400"
                      >
                        From
                      </label>
                      <input
                        id="g-lf"
                        type="time"
                        value={loginFrom}
                        onChange={(e) => setLoginFrom(e.target.value)}
                        className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="g-lt"
                        className="mb-0.5 block text-xs text-slate-500 dark:text-slate-400"
                      >
                        To
                      </label>
                      <input
                        id="g-lt"
                        type="time"
                        value={loginTo}
                        onChange={(e) => setLoginTo(e.target.value)}
                        className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  {errs.loginTo && <p className="text-xs text-indigo-500">{errs.loginTo}</p>}
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Members can only get online during these hours.
                  </p>
                </div>
              )}
            </div>
          </div>

          <hr className="my-6 border-slate-100 dark:border-slate-600" />
          <div className="flex justify-center">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving
                ? editingId
                  ? "Saving…"
                  : "Creating…"
                : editingId
                  ? "Save changes"
                  : "Create tier"}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Existing Access Tiers
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {!showAllGroups && locationId
                  ? `Mapped to ${activeLocationName ?? "this location"} -- other tiers in the account are hidden.`
                  : "Every tier in this account, across all locations."}{" "}
                A tier only applies to guests once it's mapped to their location below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {locationId && (
                <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-600">
                  <button
                    onClick={() => {
                      setShowAllGroups(false);
                      setPage(0);
                    }}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${!showAllGroups ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                  >
                    This location
                  </button>
                  <button
                    onClick={() => {
                      setShowAllGroups(true);
                      setPage(0);
                    }}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${showAllGroups ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                  >
                    All tiers
                  </button>
                </div>
              )}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-600">
                {PAGE_SIZE_OPTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setPageSize(n);
                      setPage(0);
                    }}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${pageSize === n ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {paged.length === 0 ? (
            <EmptyState
              icon={Network}
              title={
                !showAllGroups && locationId && groups.length > 0
                  ? "No tiers mapped to this location"
                  : "No tiers yet"
              }
              description={
                !showAllGroups && locationId && groups.length > 0
                  ? "Browse all tiers in the account to map one to this location."
                  : "Create one above to give a set of users their own policy."
              }
              action={
                !showAllGroups && locationId && groups.length > 0
                  ? { label: "Browse all tiers", onClick: () => setShowAllGroups(true) }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Tier Name</TableHead>
                    <TableHead className="text-xs font-medium">Bandwidth</TableHead>
                    <TableHead className="text-xs font-medium">Timeout</TableHead>
                    <TableHead className="text-xs font-medium">Idle</TableHead>
                    <TableHead className="text-xs font-medium">Devices</TableHead>
                    <TableHead className="text-xs font-medium">Login Hours</TableHead>
                    <TableHead className="text-xs font-medium">Data Limit</TableHead>
                    <TableHead className="text-xs font-medium">Members</TableHead>
                    <TableHead className="text-xs font-medium">Mapped to Location(s)</TableHead>
                    <TableHead className="text-xs font-medium">Users</TableHead>
                    <TableHead className="text-right text-xs font-medium">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((g) => (
                    <TableRow key={g.id} className="border-b">
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>{g.bandwidth}</TableCell>
                      <TableCell>{g.sessionTimeout}</TableCell>
                      <TableCell>{g.idleTimeout}</TableCell>
                      <TableCell>{g.devicesPerUser}</TableCell>
                      <TableCell className="text-xs">
                        {g.loginHours ? (
                          `${g.loginHours.days.slice(0, 3).join(", ")}${g.loginHours.days.length > 3 ? "…" : ""}, ${g.loginHours.from}–${g.loginHours.to}`
                        ) : (
                          <span className="text-muted-foreground">Any time</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {g.dataLimit ? (
                          `${g.dataLimit.quota} ${g.dataLimit.unit} / ${g.dataLimit.resets}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{g.members}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {/* Primary action -- the real many-to-many picture and
                        the entry point into the "Map to locations…" modal,
                        replacing the old one-location-at-a-time toggle as
                        the main way to manage this. */}
                          <button
                            aria-label={`Manage which locations ${g.name} is mapped to`}
                            title={
                              g.mappedLocationIds.length === 0
                                ? "This tier isn't mapped to any location yet."
                                : `Mapped to: ${g.mappedLocationIds.map((id) => allLocations?.find((l) => l.id === id)?.name ?? id).join(", ")}`
                            }
                            onClick={() => openMapModal(g)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {g.mappedLocationIds.length === 0
                              ? "Map to locations…"
                              : `Mapped to ${g.mappedLocationIds.length} location${g.mappedLocationIds.length === 1 ? "" : "s"}`}
                          </button>
                          {/* Quick shortcut kept for the common single-click case
                        (map/unmap just the location you're currently
                        looking at) -- same handleToggleMap this button
                        always called. */}
                          {locationId && (
                            <button
                              aria-label={
                                g.mappedAssignmentId
                                  ? `Unmap ${g.name} from this location`
                                  : `Map ${g.name} to this location`
                              }
                              disabled={mappingBusy.has(g.id)}
                              title={
                                g.mappedAssignmentId
                                  ? `In use at ${activeLocationName ?? "this location"} -- click to stop using it here.`
                                  : `Use this tier's settings at ${activeLocationName ?? "this location"}.`
                              }
                              onClick={() => handleToggleMap(g)}
                              className="inline-flex items-center gap-1 pl-0.5 text-[11px] font-medium text-indigo-600 transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:text-indigo-400"
                            >
                              {mappingBusy.has(g.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : g.mappedAssignmentId ? (
                                <MapPin className="h-3 w-3" />
                              ) : (
                                <MapPinOff className="h-3 w-3" />
                              )}
                              {g.mappedAssignmentId
                                ? `Unmap from ${activeLocationName ?? "here"}`
                                : `Quick-map to ${activeLocationName ?? "here"}`}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          aria-label={`Map users into ${g.name}`}
                          disabled={!g.mappedAssignmentId}
                          title={
                            !g.mappedAssignmentId
                              ? "Map this tier to the location first."
                              : `Assign specific guests to ${g.name} instead of the location default.`
                          }
                          onClick={() => openUsersModal(g)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Map users
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          aria-label={`Edit ${g.name}`}
                          onClick={() => handleEdit(g)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Clone ${g.name}`}
                          onClick={() => handleClone(g)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={confirmingId === g.id ? "Confirm delete" : `Delete ${g.name}`}
                          onClick={() => handleDelete(g.id)}
                          className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${confirmingId === g.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"}`}
                        >
                          {confirmingId === g.id ? (
                            <span className="text-[11px] font-medium px-1">Confirm</span>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {safePage * pageSize + 1}–
                {Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(safePage + 1)}
                  className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {usersModalGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setUsersModalGroup(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-users-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="map-users-title"
                  className="text-lg font-semibold text-slate-800 dark:text-slate-100"
                >
                  Map guests — {usersModalGroup.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  Guests mapped here get this group's policy instead of the location default.
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={() => setUsersModalGroup(null)}
                className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchGuests();
                }}
                placeholder="Search by mobile or email…"
                className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <button
                onClick={searchGuests}
                disabled={guestSearchBusy || !guestSearch.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {guestSearchBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Find
              </button>
            </div>

            {guestResults.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {guestResults.map((guest) => {
                  const already = mappedGuests.some((m) => m.guestId === guest.id);
                  // A guest may only be active in one group at a time
                  // (backend-enforced) -- `other` is that group when it's
                  // not the one this modal is already open for.
                  const other = guestCurrentGroups[guest.id];
                  const inOtherGroup = !already && !!other && other.policyId !== usersModalGroup.id;
                  return (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-600"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {guest.displayName ?? guest.identifier}
                        </p>
                        <p className="truncate text-xs text-slate-400">{guest.identifier}</p>
                        {inOtherGroup && (
                          <p className="truncate text-xs text-indigo-500">
                            Already in {other.policyName}
                          </p>
                        )}
                      </div>
                      {inOtherGroup ? (
                        <button
                          disabled={guestActionBusy.has(guest.id)}
                          onClick={() => switchGuestGroup(guest, other)}
                          title={`Unmap from ${other.policyName} and map into ${usersModalGroup.name} instead.`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:hover:bg-indigo-900/20"
                        >
                          {guestActionBusy.has(guest.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          Switch tier
                        </button>
                      ) : (
                        <button
                          disabled={already || guestActionBusy.has(guest.id)}
                          onClick={() => mapGuest(guest)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:hover:bg-indigo-900/20"
                        >
                          {guestActionBusy.has(guest.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          {already ? "Mapped" : "Map"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {guestSearch.trim() && !guestSearchBusy && guestResults.length === 0 && (
              <p className="mt-3 text-xs text-slate-400">
                No guest found for "{guestSearch.trim()}" at this location.
              </p>
            )}

            <hr className="my-4 border-slate-100 dark:border-slate-600" />
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Mapped users
            </h4>
            {guestsLoading ? (
              <LoadingSkeleton rows={2} />
            ) : mappedGuests.length === 0 ? (
              <p className="text-xs text-slate-400">No users mapped into this tier yet.</p>
            ) : (
              <div className="space-y-1.5">
                {mappedGuests.map((m) => (
                  <div
                    key={m.guestId}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
                  >
                    <p className="truncate text-sm text-slate-600 dark:text-slate-300">{m.label}</p>
                    <button
                      disabled={guestActionBusy.has(m.guestId)}
                      onClick={() => unmapGuest(m)}
                      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-slate-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      aria-label={`Unmap ${m.label}`}
                    >
                      {guestActionBusy.has(m.guestId) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* "Map to locations…" -- the searchable multi-select checklist
          replacing having to switch the active location N times and click
          the single toggle N times. Same hand-rolled modal shell as "Map
          guests" above (this file has no other shadcn Dialog usage to
          match, so its own existing modal is the real established pattern
          here); Checkbox below is the one real shadcn primitive already
          used elsewhere in this codebase for this exact "list of things
          with a checkbox" shape. */}
      {mapModalGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={closeMapModal}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-locations-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="map-locations-title"
                  className="text-lg font-semibold text-slate-800 dark:text-slate-100"
                >
                  Map to locations — {mapModalGroup.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  Select every location that should use this tier's settings, then save.
                </p>
              </div>
              <button
                aria-label="Close"
                disabled={mapModalSaving}
                onClick={closeMapModal}
                className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(allLocations?.length ?? 0) > 5 && (
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={mapModalSearch}
                  onChange={(e) => setMapModalSearch(e.target.value)}
                  placeholder="Search locations…"
                  className="block w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            )}

            <div className="mt-3">
              {mapModalLoading ? (
                <LoadingSkeleton rows={3} />
              ) : !allLocations || allLocations.length === 0 ? (
                <p className="text-xs text-slate-400">No locations found on this account.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {allLocations
                    .filter(
                      (loc) =>
                        !mapModalSearch.trim() ||
                        loc.name.toLowerCase().includes(mapModalSearch.trim().toLowerCase()) ||
                        loc.city.toLowerCase().includes(mapModalSearch.trim().toLowerCase()),
                    )
                    .map((loc) => {
                      const checked = mapModalSelected.has(loc.id);
                      return (
                        <label
                          key={loc.id}
                          htmlFor={`map-loc-${loc.id}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${checked ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-500/10" : "border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/50"}`}
                        >
                          <Checkbox
                            id={`map-loc-${loc.id}`}
                            checked={checked}
                            disabled={mapModalSaving}
                            onCheckedChange={() => toggleMapModalLocation(loc.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                              {loc.name}
                              {loc.id === locationId && (
                                <span className="ml-1.5 text-[10px] font-normal text-indigo-500">
                                  (current)
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-slate-400">
                              {loc.city}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  {allLocations.filter(
                    (loc) =>
                      !mapModalSearch.trim() ||
                      loc.name.toLowerCase().includes(mapModalSearch.trim().toLowerCase()) ||
                      loc.city.toLowerCase().includes(mapModalSearch.trim().toLowerCase()),
                  ).length === 0 && (
                    <p className="text-xs text-slate-400">
                      No location matches "{mapModalSearch.trim()}".
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-600">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {mapModalSelected.size} of {allLocations?.length ?? 0} selected
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={mapModalSaving}
                  onClick={closeMapModal}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={mapModalSaving || mapModalLoading}
                  onClick={handleSaveMapModal}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {mapModalSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {mapModalSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
