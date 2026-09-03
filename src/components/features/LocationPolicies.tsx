import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  AlertTriangle,
  HelpCircle,
  Plus,
  ChevronDown,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Shield,
  Gauge,
  Clock,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { bandwidthPolicyService } from "@/services/bandwidth-policy.service";
import { resolveOrgId } from "@/services/customer.service";
import {
  createPolicyWithRules,
  updatePolicyRules,
  createPolicyAssignment,
  listPolicyDetails,
  latestVersion,
  deactivatePolicy,
} from "@/services/policy-engine";

// DevicePolicyRules.max_devices_per_guest (backend) is a required int >= 1
// -- there's no real "unlimited" value in that schema today, so "Unlimited"
// here is represented as this large practical ceiling rather than left
// unenforced (an unassigned location falls back to the platform default of
// 3, which would silently contradict what "Unlimited" promises).
const UNLIMITED_DEVICES_SENTINEL = 9999;

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

// Session/Idle/Daily Timeout are real BandwidthPolicyRules fields (see
// bandwidth-policy.service.ts's toRules) that this form was never actually
// sending -- same class of bug CreateGroup.tsx already hit and fixed for
// its own edit form (see BandwidthPolicy's own doc comment: "edit kaam
// nahi karta" once required fields always read back blank). Mirroring that
// exact fix here instead of reinventing it.
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

function labelFromMinutes(
  minutes: number | null | undefined,
  table: Record<string, number | null>,
  fallback: string,
): string {
  const found = Object.entries(table).find(([, v]) => v === (minutes ?? null));
  return found?.[0] ?? fallback;
}

// ── constants ───────────────────────────────────────────────────
const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.
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
const DAILY_LIMIT = ["No Limit", "1 hr", "2 hr", "4 hr", "8 hr"];
const IDLE_TIMEOUT = ["No Limit", "5 min", "10 min", "15 min", "30 min", "1 hr"];
const DEVICES = ["Unlimited", "1", "2", "3", "4", "5"];
const DATA_UNITS = ["MB", "GB"];
const RESETS = ["Per session", "Daily", "Weekly", "Monthly"];
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

interface Policy {
  id: string;
  businessUnit: string;
  bandwidth: string;
  sessionTimeout: string;
  dailyLimit: string;
  idleTimeout: string;
  devicesPerUser: string;
  dataLimit: { quota: number; unit: string; resets: string } | null;
}
type PolicyForm = Omit<Policy, "id">;

const SEED: Policy[] = [
  {
    id: "p1",
    businessUnit: "Mumbai HQ",
    bandwidth: "5 Mbps",
    sessionTimeout: "4 hr",
    dailyLimit: "No Limit",
    idleTimeout: "15 min",
    devicesPerUser: "3",
    dataLimit: { quota: 5, unit: "GB", resets: "Daily" },
  },
  {
    id: "p2",
    businessUnit: "Delhi Office",
    bandwidth: "2 Mbps",
    sessionTimeout: "24 hr",
    dailyLimit: "2 hr",
    idleTimeout: "30 min",
    devicesPerUser: "Unlimited",
    dataLimit: null,
  },
  {
    id: "p3",
    businessUnit: "Bangalore DC",
    bandwidth: "512 Kbps",
    sessionTimeout: "1 hr",
    dailyLimit: "1 hr",
    idleTimeout: "10 min",
    devicesPerUser: "2",
    dataLimit: { quota: 1, unit: "GB", resets: "Weekly" },
  },
];

// ── Tooltip popover ──────────────────────────────────────────────
function Tooltip({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Help for ${id}`}
        onClick={() => setOpen((p) => !p)}
        onBlur={(e) => {
          if (!ref.current?.contains(e.relatedTarget)) close();
        }}
        className="inline-flex items-center justify-center rounded text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-500 dark:hover:text-slate-300"
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
            aria-label="Close tooltip"
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-800"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </span>
  );
}

// ── Select helper ────────────────────────────────────────────────
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
        {tooltip && <Tooltip id={id} text={tooltip} />}
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
      {/* Persistent plain-English caption instead of a click-to-reveal (?)
          tooltip -- for a form whose banner above says changes take effect
          immediately for already-connected guests, the explanation
          shouldn't require a discovery click. */}
      {caption && !err && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{caption}</p>
      )}
      {err && <p className="mt-1 text-xs text-indigo-500">{err}</p>}
    </div>
  );
}

// ── component ────────────────────────────────────────────────────
export default function LocationPolicies({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations, so the "Business Unit" picker below (whose
  // value becomes the saved bandwidth policy's own name) must offer those
  // instead. Same real-vs-demo split as WhiteList.tsx's units/realUnits.
  const { data: locations } = useCustomerLocations();
  const units = demo ? UNITS : (locations ?? []).map((l) => l.name);
  // ── state ─────────────────────────────────────────────────────
  const [f, setF] = useState<PolicyForm>({
    businessUnit: "",
    bandwidth: "",
    sessionTimeout: "",
    dailyLimit: "No Limit",
    idleTimeout: "",
    devicesPerUser: "",
    dataLimit: null,
  });
  const [errs, setErrs] = useState<Partial<Record<keyof PolicyForm, string>>>({});
  const [dataLimitOpen, setDataLimitOpen] = useState(false);
  const [dlQuota, setDlQuota] = useState("");
  const [dlUnit, setDlUnit] = useState("GB");
  const [dlResets, setDlResets] = useState("Daily");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>(demo ? SEED : []);
  const [realIds, setRealIds] = useState<Record<string, string>>({}); // businessUnit(=policy name) -> real bandwidth-policy id
  const [deviceRealIds, setDeviceRealIds] = useState<Record<string, string>>({}); // businessUnit -> real DEVICE-policy id
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        const org = await resolveOrgId();
        setOrgId(org);
        const [realAll, deviceDetailsAll] = await Promise.all([
          bandwidthPolicyService.list(org),
          listPolicyDetails("device", org).catch(() => []),
        ]);
        // Deactivated (deleted) policies are excluded from both id maps --
        // bandwidthPolicyService.list()/listPolicyDetails() return every
        // policy regardless of is_active, and a deactivated policy has no
        // "reactivate" path (see policy-engine.ts's statusOf/updatePolicyRules
        // comments). Keeping a dead id in realIds/deviceRealIds meant the
        // *next* save for the same location name silently republished a new
        // version onto a policy that resolve_effective_policy's
        // list_candidate_assignments will never return (it only considers
        // active policies) -- the save toast said "saved and applied," but
        // nothing was ever really in effect. Confirmed live: org testyyy's
        // "test" bandwidth policy was exactly this -- is_active: false,
        // resolve returning platform_default with empty rules. Filtering
        // here means a save after a delete creates a genuinely fresh,
        // active policy instead of reviving the dead one.
        const real = realAll.filter((p) => p.status !== "archived");
        const deviceDetails = deviceDetailsAll.filter((d) => d.is_active);
        // Real DEVICE policies are name-keyed the same way bandwidth
        // policies are (name === the location/"Business Unit" they were
        // saved for) -- see handleSave, which creates them under that same
        // name so this lookup and the save-time upsert agree on identity.
        const deviceByName = new Map(
          deviceDetails.map((d) => [
            d.name,
            latestVersion(d)?.rules?.max_devices_per_guest as number | undefined,
          ]),
        );
        setPolicies(
          real.map((p) => {
            const maxDevices = deviceByName.get(p.name);
            const devicesPerUser =
              maxDevices == null
                ? ""
                : maxDevices >= UNLIMITED_DEVICES_SENTINEL
                  ? "Unlimited"
                  : String(maxDevices);
            return {
              id: p.id,
              businessUnit: p.name,
              bandwidth: kbpsToLabel(p.downloadRateKbps),
              sessionTimeout: labelFromMinutes(
                p.sessionTimeoutMinutes,
                SESSION_TIMEOUT_MINUTES,
                "",
              ),
              dailyLimit: labelFromMinutes(p.dailyLimitMinutes, DAILY_LIMIT_MINUTES, "No Limit"),
              idleTimeout: labelFromMinutes(p.idleTimeoutMinutes, IDLE_TIMEOUT_MINUTES, ""),
              devicesPerUser,
              dataLimit: p.dataLimit ?? null,
            };
          }),
        );
        setRealIds(Object.fromEntries(real.map((p) => [p.name, p.id])));
        setDeviceRealIds(Object.fromEntries(deviceDetails.map((d) => [d.name, d.id])));
      } catch {
        // Leave policies empty -- the "no policies yet" state is accurate.
      }
    })();
  }, [demo, locationId]);

  // Preselect the location this page is already scoped to.
  //
  // The header reads "Access Rules · <location>" and the page is reached
  // through that location, but the field underneath opened on "Choose a
  // location" and made the customer pick it again -- and picking the wrong
  // one silently writes the policy against a different location. The
  // `locationId` prop was passed in and never read.
  //
  // Two cases, in order: the scoped location when there is one, otherwise a
  // customer who only has a single location at all. Only ever fills a blank
  // field, so it cannot overwrite a choice the customer made or a policy
  // being edited.
  useEffect(() => {
    if (f.businessUnit || editingId) return;
    const scoped = locationId
      ? (locations ?? []).find((l) => l.id === locationId)?.name
      : undefined;
    const only = units.length === 1 ? units[0] : undefined;
    const preselect = scoped ?? only;
    if (preselect) setF((prev) => ({ ...prev, businessUnit: preselect }));
  }, [f.businessUnit, editingId, locationId, locations, units]);

  // ── derived ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return policies.filter(
      (p) =>
        !q ||
        Object.values(p).some((v) =>
          typeof v === "string"
            ? v.toLowerCase().includes(q)
            : v && typeof v === "object" && "resets" in v,
        ),
    );
  }, [policies, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const setField = (k: keyof PolicyForm, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
  };

  // ── validate ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errs = {};
    if (!f.businessUnit) e.businessUnit = "Required.";
    if (!f.bandwidth) e.bandwidth = "Required.";
    if (!f.sessionTimeout) e.sessionTimeout = "Required.";
    if (!f.idleTimeout) e.idleTimeout = "Required.";
    if (!f.devicesPerUser) e.devicesPerUser = "Required.";

    if (f.sessionTimeout && f.idleTimeout) {
      const toMin = (v: string) => {
        const n = parseInt(v);
        return v.includes("hr") ? n * 60 : v.includes("min") ? n : Infinity;
      };
      if (toMin(f.idleTimeout) > toMin(f.sessionTimeout))
        e.idleTimeout = "Idle timeout can't be longer than the session timeout.";
    }

    if (dataLimitOpen && (!dlQuota || parseFloat(dlQuota) <= 0)) {
      if (!errs.idleTimeout) e.dataLimit = "Quota must be greater than 0.";
    }
    setErrs(e);
    return !Object.keys(e).length;
  };

  // ── save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const dataLimit = dataLimitOpen
      ? { quota: parseFloat(dlQuota) || 0, unit: dlUnit, resets: dlResets }
      : null;

    if (demo) {
      setTimeout(() => {
        const existing = policies.findIndex((p) => p.businessUnit === f.businessUnit);
        if (existing >= 0)
          setPolicies((prev) =>
            prev.map((p, i) => (i === existing ? { ...p, ...f, dataLimit } : p)),
          );
        else setPolicies((prev) => [{ id: `p${Date.now()}`, ...f, dataLimit }, ...prev]);
        setSaving(false);
        setEditingId(null);
        setToast("Policies updated.");
        setTimeout(() => setToast(null), 2500);
      }, 600);
      return;
    }

    try {
      const rateKbps = BANDWIDTH_KBPS[f.bandwidth] ?? 0;
      const existingId = realIds[f.businessUnit];
      const saved = await bandwidthPolicyService.save(
        {
          id: existingId,
          name: f.businessUnit,
          status: "active",
          downloadRateKbps: rateKbps,
          uploadRateKbps: rateKbps,
          // Session/Idle/Daily Timeout and the optional data limit are real
          // BandwidthPolicyRules fields (toRules already maps them) that this
          // form validates as required but, until now, never actually sent --
          // exactly the gap CreateGroup.tsx already hit and fixed for its own
          // edit form ("edit kaam nahi karta" once required fields always
          // read back blank on reload).
          sessionTimeoutMinutes: SESSION_TIMEOUT_MINUTES[f.sessionTimeout] ?? null,
          idleTimeoutMinutes: IDLE_TIMEOUT_MINUTES[f.idleTimeout] ?? null,
          dailyLimitMinutes: DAILY_LIMIT_MINUTES[f.dailyLimit] ?? null,
          dataLimit,
        },
        orgId ?? undefined,
      );
      // Saving only creates/updates the policy's own rules -- it was never
      // actually applied anywhere (confirmed live: a saved policy had zero
      // rows in policy_assignments), since a Policy and its
      // location-scoped PolicyAssignment are two separate backend
      // concepts. bandwidthPolicyService.mapToLocation already exists
      // (CreateGroup.tsx's own "Map group" step uses it) and is
      // idempotent, so this is the one missing call, not new backend work.
      if (locationId) {
        await bandwidthPolicyService.mapToLocation(saved.id, locationId, orgId ?? undefined);
      }
      setRealIds((prev) => ({ ...prev, [f.businessUnit]: saved.id }));

      // Devices Per User -- same "policy exists but was never applied" gap
      // bandwidth just had, except this one was never even wired to a
      // backend policy at all: this select used to be pure local UI state,
      // so the real per-guest device-count enforcement
      // (guest/service.py's _resolve_device_limit) always fell back to the
      // platform default of 3 regardless of what was chosen here (bug
      // report: a guest was rejected for "already has 3 devices" with 5
      // configured here). DevicePolicyRules.max_devices_per_guest has no
      // real "unlimited" value, so "Unlimited" is sent as
      // UNLIMITED_DEVICES_SENTINEL rather than left unenforced.
      const maxDevices =
        f.devicesPerUser === "Unlimited"
          ? UNLIMITED_DEVICES_SENTINEL
          : parseInt(f.devicesPerUser, 10);
      const existingDeviceId = deviceRealIds[f.businessUnit];
      const deviceRules = { max_devices_per_guest: maxDevices };
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
          name: f.businessUnit,
          description: null,
          rules: deviceRules,
          publish: true,
          organizationId: orgId ?? undefined,
        });
        if (locationId) {
          await createPolicyAssignment({
            policyId: createdDevice.id,
            scopeType: "location",
            scopeId: locationId,
            organizationId: orgId ?? undefined,
          });
        }
        setDeviceRealIds((prev) => ({ ...prev, [f.businessUnit]: createdDevice.id }));
      }

      const row: Policy = { id: saved.id, ...f, dataLimit };
      setPolicies((prev) => {
        // Matched by id OR businessUnit name -- a save can return a
        // *different* id than what this location's row currently shows
        // (e.g. right after a delete, when a stale local view hadn't yet
        // learned the old id was retired), and matching by id alone would
        // add a second, stale-looking row instead of replacing the first.
        const existing = prev.findIndex(
          (p) => p.id === saved.id || p.businessUnit === f.businessUnit,
        );
        return existing >= 0 ? prev.map((p, i) => (i === existing ? row : p)) : [row, ...prev];
      });
      setEditingId(null);
      setToast(locationId ? "Policy saved and applied to this location." : "Policies updated.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not save — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  // ── edit ──────────────────────────────────────────────────────
  // Prefills the form from an already-saved row so editing doesn't mean
  // blindly re-picking every dropdown from scratch and trusting
  // name-based upsert matching -- the pencil icon previously had no
  // onClick at all (bug report: "edit button not working").
  const handleEdit = (p: Policy) => {
    setEditingId(p.id);
    setF({
      businessUnit: p.businessUnit,
      bandwidth: p.bandwidth,
      sessionTimeout: p.sessionTimeout,
      dailyLimit: p.dailyLimit,
      idleTimeout: p.idleTimeout,
      devicesPerUser: p.devicesPerUser,
      dataLimit: p.dataLimit,
    });
    setErrs({});
    if (p.dataLimit) {
      setDataLimitOpen(true);
      setDlQuota(String(p.dataLimit.quota));
      setDlUnit(p.dataLimit.unit);
      setDlResets(p.dataLimit.resets);
    } else {
      setDataLimitOpen(false);
      setDlQuota("");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── delete ────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    if (confirming === id) {
      const prev = policies;
      const businessUnit = policies.find((p) => p.id === id)?.businessUnit;
      setPolicies((p) => p.filter((x) => x.id !== id));
      // Clear the now-dead id from both maps *before* the network call
      // settles -- otherwise a save for this same location later in the
      // same session (no reload needed) would reuse the id we just
      // deactivated and silently update a policy resolve_effective_policy
      // can no longer see (the exact bug this whole change fixes).
      if (businessUnit) {
        setRealIds((prevIds) => {
          const n = { ...prevIds };
          delete n[businessUnit];
          return n;
        });
        setDeviceRealIds((prevIds) => {
          const n = { ...prevIds };
          delete n[businessUnit];
          return n;
        });
      }
      if (!demo) {
        bandwidthPolicyService.remove(id, orgId ?? undefined).catch(() => {
          setPolicies(prev);
          setToast("Could not delete on the server.");
          setTimeout(() => setToast(null), 2500);
        });
        // Deleting a location's policy row means all of its limits go away,
        // not only bandwidth -- deactivate its DEVICE policy too, if one
        // was ever saved for this location.
        const deviceId = businessUnit ? deviceRealIds[businessUnit] : undefined;
        if (deviceId) {
          deactivatePolicy(deviceId, orgId ?? undefined).catch(() => {});
        }
      }
      setConfirming(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else {
      setConfirming(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(null), 3000);
    }
  };

  // ── helpers ───────────────────────────────────────────────────
  const showToast = toast;
  const Err = ({ k }: { k: keyof PolicyForm }) =>
    errs[k] ? <p className="mt-0.5 text-xs text-indigo-500">{errs[k]}</p> : null;

  return (
    <div className="space-y-6">
      {/* toast */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {showToast}
        </div>
      )}

      {/* form card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {editingId ? `Edit Guest WiFi Limits — ${f.businessUnit}` : "Guest WiFi Limits"}
          </CardTitle>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setF({
                  businessUnit: "",
                  bandwidth: "",
                  sessionTimeout: "",
                  dailyLimit: "No Limit",
                  idleTimeout: "",
                  devicesPerUser: "",
                  dataLimit: null,
                });
                setErrs({});
                setDataLimitOpen(false);
                setDlQuota("");
              }}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Cancel edit
            </button>
          )}
        </CardHeader>
        <CardContent>
          {/* Location -- the target these settings apply to. Kept visually
            separate from the two setting groups below since it answers a
            different question ("where") than they do ("what"). */}
          <div className="max-w-md">
            <Select
              id="bu"
              label="Location"
              required
              value={f.businessUnit}
              onChange={(v) => setField("businessUnit", v)}
              options={units}
              placeholder="Choose a location"
              caption="Which location these settings apply to."
              err={errs.businessUnit}
            />
          </div>

          <div className="mt-6 space-y-5">
            {/* Speed & Devices -- bandwidth, device count, and the optional
              data limit are all "how much" settings (capacity), so they're
              grouped in one clearly-labeled section instead of being
              scattered across a flat 6-field grid alongside unrelated
              time-based settings. */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-1 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Speed &amp; Devices
                </h3>
              </div>
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                How fast guests connect, and how many devices each guest can use.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="bw"
                  label="Bandwidth"
                  required
                  value={f.bandwidth}
                  onChange={(v) => setField("bandwidth", v)}
                  options={BANDWIDTH}
                  placeholder="Choose bandwidth"
                  caption="Maximum speed per guest device."
                  err={errs.bandwidth}
                />
                <Select
                  id="dp"
                  label="Devices Per User"
                  required
                  value={f.devicesPerUser}
                  onChange={(v) => setField("devicesPerUser", v)}
                  options={DEVICES}
                  placeholder="Choose devices per user"
                  caption="How many devices the same guest can connect at once."
                  err={errs.devicesPerUser}
                />
              </div>

              {/* collapsible data limit -- a third, optional capacity setting.
                Nested inside this section (instead of floating below it
                looking unrelated) so it reads as belonging with
                Bandwidth/Devices Per User. */}
              <button
                type="button"
                onClick={() => setDataLimitOpen((p) => !p)}
                aria-expanded={dataLimitOpen}
                aria-controls="data-limit-panel"
                className="mt-4 flex w-full items-center justify-between rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Plus className="h-4 w-4 text-indigo-500" /> Add a data limit{" "}
                  <span className="text-xs font-normal text-slate-400">(Optional)</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${dataLimitOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dataLimitOpen && (
                <div id="data-limit-panel" className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="dl-quota"
                      className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Data quota
                    </label>
                    <input
                      id="dl-quota"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0"
                      value={dlQuota}
                      onChange={(e) => setDlQuota(e.target.value)}
                      className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                    {errs.dataLimit && (
                      <p className="mt-1 text-xs text-indigo-500">{errs.dataLimit}</p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="dl-unit"
                      className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Unit
                    </label>
                    <select
                      id="dl-unit"
                      value={dlUnit}
                      onChange={(e) => setDlUnit(e.target.value)}
                      className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {DATA_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="dl-resets"
                      className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Resets
                    </label>
                    <select
                      id="dl-resets"
                      value={dlResets}
                      onChange={(e) => setDlResets(e.target.value)}
                      className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {RESETS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Time Limits -- session timeout, idle timeout, and the daily
              session cap are all "when" settings (when a guest gets
              disconnected or has to sign in again), separated from the
              speed/capacity group above so an owner can scan for the kind
              of setting they actually want to change. */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Time Limits
                </h3>
              </div>
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                When a guest gets disconnected or has to sign in again.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  id="st"
                  label="Session Timeout"
                  required
                  value={f.sessionTimeout}
                  onChange={(v) => setField("sessionTimeout", v)}
                  options={SESSION_TIMEOUT}
                  placeholder="Choose session timeout"
                  caption="Re-authenticate after this much time."
                  err={errs.sessionTimeout}
                />
                <Select
                  id="it"
                  label="Idle Timeout"
                  required
                  value={f.idleTimeout}
                  onChange={(v) => setField("idleTimeout", v)}
                  options={IDLE_TIMEOUT}
                  placeholder="Choose idle timeout"
                  caption="Disconnect after this much inactivity."
                  err={errs.idleTimeout}
                />
                <Select
                  id="dl"
                  label="Maximum Daily Session Limit"
                  value={f.dailyLimit}
                  onChange={(v) => setField("dailyLimit", v)}
                  options={DAILY_LIMIT}
                  placeholder="Choose daily limit"
                  caption="Total connected time allowed per day."
                />
              </div>
            </div>
          </div>

          <hr className="my-6 border-slate-100 dark:border-slate-600" />
          {/* Immediate-effect notice -- moved off a persistent, page-length
            amber block (standing furniture every time this tab opens) into
            a slim, contextual line right where it's actually relevant: the
            moment before clicking Save. Same real warning (applies now,
            including to already-connected guests), no longer competing
            visually with the form itself. Support contact tucked behind
            the same Tooltip pattern already used for individual field
            help elsewhere on this page, instead of its own paragraph. */}
          <div className="flex flex-col items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              Applies immediately — including to guests already connected.
              <Tooltip
                id="save-immediate-effect"
                text="Double-check the limits above before saving. Need help? Contact support@wyfyguest.com."
              />
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : editingId ? "Save changes" : "Update policies"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* table card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm">Current Guest WiFi Limits</CardTitle>
            <p className="text-xs text-muted-foreground">
              The policies currently active for the selected space.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
                className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
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
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${pageSize === n ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No policies yet"
              description="Fill the form above to create the first one."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Location</TableHead>
                    <TableHead className="text-xs font-medium">Bandwidth</TableHead>
                    <TableHead className="text-xs font-medium">Session Timeout</TableHead>
                    <TableHead className="text-xs font-medium">Idle Timeout</TableHead>
                    <TableHead className="text-xs font-medium">Daily Limit</TableHead>
                    <TableHead className="text-xs font-medium">Devices</TableHead>
                    <TableHead className="text-xs font-medium">Data Limit</TableHead>
                    <TableHead className="text-right text-xs font-medium">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((p) => (
                    <TableRow key={p.id} className="border-b">
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400">
                            <MapPin className="h-3.5 w-3.5" />
                          </span>
                          {p.businessUnit}
                        </span>
                      </TableCell>
                      <TableCell>{p.bandwidth}</TableCell>
                      <TableCell>{p.sessionTimeout}</TableCell>
                      {/* "No Limit"/"Unlimited" rows are muted so a stricter,
                      set value on another row visually stands out instead
                      of every policy reading with equal weight. */}
                      <TableCell
                        className={
                          p.idleTimeout === "No Limit"
                            ? "text-slate-400 dark:text-slate-500"
                            : undefined
                        }
                      >
                        {p.idleTimeout}
                      </TableCell>
                      <TableCell
                        className={
                          p.dailyLimit === "No Limit"
                            ? "text-slate-400 dark:text-slate-500"
                            : undefined
                        }
                      >
                        {p.dailyLimit}
                      </TableCell>
                      <TableCell
                        className={
                          p.devicesPerUser === "Unlimited"
                            ? "text-slate-400 dark:text-slate-500"
                            : undefined
                        }
                      >
                        {p.devicesPerUser}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.dataLimit ? (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                            {p.dataLimit.quota} {p.dataLimit.unit} / {p.dataLimit.resets}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">No limit</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          aria-label={`Edit ${p.businessUnit}`}
                          onClick={() => handleEdit(p)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={
                            confirming === p.id ? "Confirm delete" : `Delete ${p.businessUnit}`
                          }
                          onClick={() => handleDelete(p.id)}
                          className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${confirming === p.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"}`}
                        >
                          {confirming === p.id ? (
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
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Showing {safePage * pageSize + 1}–
                {Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(safePage + 1)}
                  className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
