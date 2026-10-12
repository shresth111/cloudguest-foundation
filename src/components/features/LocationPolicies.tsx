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
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { isLocationNamedPolicy } from "@/lib/policy-scope";
import {
  BANDWIDTH,
  DAILY_LIMIT,
  DAILY_LIMIT_MINUTES,
  DEFAULT_IDLE_TIMEOUT_LABEL,
  DEVICES,
  IDLE_TIMEOUT,
  IDLE_TIMEOUT_MINUTES,
  SESSION_TIMEOUT,
  SESSION_TIMEOUT_MINUTES,
  UNLIMITED_DEVICES_SENTINEL,
  bandwidthRatesForChoice,
  blankLimitsForm,
  limitsFormFromRow,
  limitsRowFromSaved,
  optionsWithCurrent,
  prefillDecision,
  prefillKey,
  type GuestWifiLimitsForm,
  type GuestWifiLimitsRow,
} from "@/lib/guest-wifi-limits";
import {
  VENUE_SPEED_NO_LIMIT,
  venueRates,
  venueRatesEqual,
  venueRatesForChoice,
  venueSpeedLabel,
  venueSpeedOptions,
  venueSpeedProblem,
  venueSpeedServerError,
  type VenueRates,
} from "@/lib/venue-speed-cap";
import { bandwidthPolicyService } from "@/services/bandwidth-policy.service";
import { useClientControls } from "@/hooks/useClientControls";
import { ControllerControlNotice } from "@/components/customer/ControllerControlNotice";
import { resolveOrgId } from "@/services/customer.service";
import {
  createPolicyWithRules,
  updatePolicyRules,
  createPolicyAssignment,
  listPolicyDetails,
  latestVersion,
  deactivatePolicy,
  sessionPolicyRules,
  fupPolicyRules,
  fupDataLimitFromRules,
  FUP_DATA_RESET_PERIODS,
} from "@/services/policy-engine";

// The dropdowns' choice tables, and the mapping from a venue's saved limits to
// what the form and the table show, live in lib/guest-wifi-limits.ts so a
// test can run them. Total venue speed has its own module beside it.
type Policy = GuestWifiLimitsRow;
type PolicyForm = GuestWifiLimitsForm;

// Session Timeout is a SESSION policy, not a bandwidth one -- the constants
// and the full-rules helper now live in policy-engine.ts, next to the
// create/update calls that send them, because the identical bug turned out
// to exist on CreateGroup.tsx too and two copies of those three numbers is
// exactly how they drift. That comment is the long-form version of why this
// is a separate policy and why the three companion fields mirror
// guest/constants.py rather than policy/constants.py; read it there.

// THE "NOT ENFORCED YET" NOTE IS GONE, BECAUSE NOTHING ON THIS FORM IS.
//
// It used to sit on three controls, all of which had the same defect: the
// value was written into the BANDWIDTH policy's rules JSON, where the schema
// declares the field, the API returns 201, the value reads back on reload --
// and nothing anywhere reads it. The only consumer of a BANDWIDTH resolve is
// queue_management, and it reads download_rate_kbps and upload_rate_kbps.
//
// All three are now written to the policy type that really is read:
//
//   * Idle Timeout      -> SESSION policy's `idle_timeout_minutes`, sent as
//                          the RFC 2865 Idle-Timeout attribute on the guest's
//                          RADIUS Access-Accept.
//   * Max Daily Session -> FUP policy's `daily_time_limit_minutes`, accrued
//                          into GuestQuotaUsage.minutes_used by the
//                          five-minutely sweep and enforced at login.
//   * Data limit        -> FUP policy's `daily`/`weekly`/`monthly_data_limit
//                          _mb`, bumped by every RADIUS Interim-Update and by
//                          the Omada usage backfill, and enforced in two
//                          places: `record_usage` ends the session the moment
//                          a cap is crossed, and `_enforce_fup_quota` refuses
//                          the next login until the period rolls over.
//
// Removing the constant rather than keeping it unused is deliberate. A
// disclaimer sitting in the file with no renderer is a disclaimer waiting to
// be attached to the wrong thing; the guard in
// scripts/test-session-rules-enforcement.mjs now asserts its absence and
// asserts the data-limit control is aimed at the fields that are read.

// ── constants ───────────────────────────────────────────────────
const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.
const DATA_UNITS = ["MB", "GB"];
// "Per session" is deliberately NOT here any more, and its absence is the
// honest half of making this control real -- the same trade IDLE_TIMEOUT made
// when it lost "No Limit".
//
// A data cap is metered against GuestQuotaUsage, which exists per guest per
// QuotaPeriodType, and that enum has exactly three members: DAILY, WEEKLY,
// MONTHLY. There is no venue-level per-session data allowance anywhere on this
// platform. The one per-session cap that does exist is
// GuestSession.data_limit_mb, copied off a redeemed voucher batch at login --
// a Vouchers screen setting, on a per-batch basis, not a venue-wide one.
//
// So "Per session" could not be honoured, and it is the dangerous kind of
// unhonourable: it reads as a PROMISE OF LESS (guests are capped tighter than
// any of the other options), which is the direction an operator will not go
// looking to verify. Sourced from the same constant the write path uses, so
// the list on screen and the fields written can never drift.
const RESETS: readonly string[] = FUP_DATA_RESET_PERIODS;
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

const SEED: Policy[] = [
  {
    id: "p1",
    businessUnit: "Mumbai HQ",
    bandwidth: "5 Mbps",
    venueSpeed: "100 Mbps",
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
    venueSpeed: VENUE_SPEED_NO_LIMIT,
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
    venueSpeed: VENUE_SPEED_NO_LIMIT,
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
  disabled,
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
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-1 flex items-center gap-1 text-sm font-medium ${disabled ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}`}
      >
        {label}
        {required && !disabled && <span className="text-indigo-500">*</span>}
        {tooltip && <Tooltip id={id} text={tooltip} />}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
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
  // Which of this form's controls can actually reach a device at this venue.
  // At a MikroTik venue both verdicts are `available` with a null reason, so
  // the notices render nothing, `speedUsable` is true, and this screen is the
  // one that shipped before, line for line.
  //
  // At a controller venue the answer is now the BACKEND'S, not a guess: the
  // venue's declared `set_rate_limit` capability decides it, and where that is
  // false the sentence rendered beside the greyed field is the backend's own.
  // An Open API venue gets the field live with a caveat, because
  // `queue_management.apply_queue` routes a controller-managed router to its
  // controller (cloud-guest #270) instead of writing a RouterOS queue nothing
  // would have read.
  const clientControls = useClientControls();
  // WHILE WE ARE STILL ASKING, WE SAY NOTHING.
  //
  // The capabilities read is in flight on every load of this screen at a
  // controller venue, and until it lands `capabilities` is null -- which the
  // ladder reads as "we could not ask" and answers with a full sentence. So
  // the owner met a greyed field and a paragraph about their controller on
  // every page load, for as long as the request took, and then watched it
  // vanish when the answer arrived and the field went live.
  //
  // `useClientControls` already carries `loading` for exactly this and
  // documents it: a control renders disabled but WITHOUT a reason during the
  // read, because we do not have one yet and inventing one is a sentence
  // about a venue we have not finished asking about. This screen was the one
  // caller not reading it.
  const speedVerdict = clientControls.verdict("speed-limit");
  const speedAsking = clientControls.loading;
  const speedUsable = !speedAsking && speedVerdict.availability !== "unavailable";
  const sessionTimeoutVerdict = clientControls.verdict("session-timeout");
  // TOTAL VENUE SPEED -- gated like the speed above it, by the same ladder.
  // Where the venue's hardware cannot hold all guests to a combined total,
  // the control is greyed with one line saying so and a save leaves whatever
  // is stored untouched; it never becomes a field that saves and does nothing.
  const venueSpeedVerdict = clientControls.verdict("venue-speed-limit");
  const venueSpeedUsable = !speedAsking && venueSpeedVerdict.availability !== "unavailable";
  const { t } = useTranslation("accessRules", { i18n });
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations, so the "Business Unit" picker below (whose
  // value becomes the saved bandwidth policy's own name) must offer those
  // instead. Same real-vs-demo split as WhiteList.tsx's units/realUnits.
  const { data: locations } = useCustomerLocations();
  const units = demo ? UNITS : (locations ?? []).map((l) => l.name);
  // This screen's identity rule -- see lib/policy-scope.ts. Both halves
  // below read it: the table (which rows are a location's own limits, as
  // opposed to an Access Tier) and handleSave (which real location the
  // chosen name resolves to).
  const locationNames = useMemo(() => new Set((locations ?? []).map((l) => l.name)), [locations]);
  // ── state ─────────────────────────────────────────────────────
  const [f, setF] = useState<PolicyForm>(() => blankLimitsForm());
  const [errs, setErrs] = useState<Partial<Record<keyof PolicyForm, string>>>({});
  const [dataLimitOpen, setDataLimitOpen] = useState(false);
  const [dlQuota, setDlQuota] = useState("");
  const [dlUnit, setDlUnit] = useState("GB");
  const [dlResets, setDlResets] = useState("Daily");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>(demo ? SEED : []);
  const [realIds, setRealIds] = useState<Record<string, string>>({}); // businessUnit(=policy name) -> real bandwidth-policy id
  // The rates this location is ALREADY saved with, by policy name.
  //
  // Read by handleSave for one purpose: a greyed Bandwidth control must not
  // write. When `speedUsable` is false the select is disabled, `f.bandwidth`
  // is the empty string, and `validate()` deliberately skips its required
  // check -- so `BANDWIDTH_KBPS[""] ?? 0` resolved to 0 and every save at a
  // controller venue silently overwrote whatever rate the policy held with
  // "no limit". Nothing on screen showed it: the form field is greyed and the
  // table cell prints "Not applied here", so the only way to see the damage
  // was for the gate to lift later and every guest to come back uncapped.
  //
  // Preserving is the right repair rather than defaulting to some number:
  // a control the owner cannot touch has expressed no opinion, and the
  // honest write for "no opinion" is the value that was already there.
  const [savedRates, setSavedRates] = useState<Record<string, { down: number; up: number }>>({});
  // The venue total each location is ALREADY saved with, by policy name. Same
  // job as `savedRates` one line up, for the same reason: a greyed control
  // writes nothing, and a control the owner left where it was writes back
  // exactly the pair it was showing.
  const [savedVenueRates, setSavedVenueRates] = useState<Record<string, VenueRates>>({});
  // Which saved row the form is mirroring right now (`prefillKey`), or null
  // when what is in it is the owner's own typing. See `prefillDecision`.
  const shownFor = useRef<string | null>(null);
  const [deviceRealIds, setDeviceRealIds] = useState<Record<string, string>>({}); // businessUnit -> real DEVICE-policy id
  const [sessionRealIds, setSessionRealIds] = useState<Record<string, string>>({}); // businessUnit -> real SESSION-policy id
  const [fupRealIds, setFupRealIds] = useState<Record<string, string>>({}); // businessUnit -> real FUP-policy id
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
        const [realAll, deviceDetailsAll, sessionDetailsAll, fupDetailsAll] = await Promise.all([
          bandwidthPolicyService.list(org),
          listPolicyDetails("device", org).catch(() => []),
          listPolicyDetails("session", org).catch(() => []),
          listPolicyDetails("fup", org).catch(() => []),
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
        //
        // The second half of the filter is this screen's own identity rule
        // (lib/policy-scope.ts): `GET /policies` returns every BANDWIDTH
        // policy on the account, including every Access Tier, and a tier
        // listed here read as one more location. Tiers are managed on their
        // own tab; only policies named after one of this account's real
        // locations are a location's limits.
        const real = realAll.filter(
          (p) => p.status !== "archived" && isLocationNamedPolicy(p.name, locationNames),
        );
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
        // SESSION policies are name-keyed the same way -- see handleSave.
        const sessionDetails = sessionDetailsAll.filter((d) => d.is_active);
        const sessionByName = new Map(
          sessionDetails.map((d) => [
            d.name,
            latestVersion(d)?.rules?.session_timeout_minutes as number | undefined,
          ]),
        );
        // Idle Timeout rides on the same SESSION policy as the session
        // length -- one policy, two settings, one lookup on the guest side.
        const idleByName = new Map(
          sessionDetails.map((d) => [
            d.name,
            latestVersion(d)?.rules?.idle_timeout_minutes as number | undefined,
          ]),
        );
        // FUP policies are name-keyed the same way -- see handleSave.
        const fupDetails = fupDetailsAll.filter((d) => d.is_active);
        // Keyed on presence, not on truthiness -- `null` is a real, chosen
        // value here ("No Limit"), not an absent one. Reading it with `??`
        // would fall through to the stale bandwidth copy and show a venue
        // the cap they had just cleared, which is the same class of bug as
        // writing to a field nothing reads.
        const dailyByName = new Map<string, number | null>(
          fupDetails.map((d) => [
            d.name,
            (latestVersion(d)?.rules?.daily_time_limit_minutes ?? null) as number | null,
          ]),
        );
        // The data cap, off the same FUP policy and for the same reason: it is
        // the one the login gate and the mid-session usage tracker resolve.
        // Keyed on presence like the daily time limit above, not truthiness --
        // `null` is a venue that has cleared its cap, and reading it with `??`
        // would fall through to the stale (and never-enforced) bandwidth copy
        // and show them a limit they had just removed.
        const dataByName = new Map(
          fupDetails.map((d) => [d.name, fupDataLimitFromRules(latestVersion(d)?.rules)]),
        );
        setPolicies(
          real.map((p) =>
            limitsRowFromSaved({
              id: p.id,
              name: p.name,
              downloadRateKbps: p.downloadRateKbps,
              venue: venueRates(p.venueDownloadRateKbps, p.venueUploadRateKbps),
              // Prefer the real SESSION policy -- that is the one the guest
              // login path resolves. A location saved before that fix has
              // only the (unread) bandwidth copy, so fall back to it so
              // the row and the form still show what was chosen; the
              // next save writes a real SESSION policy for it.
              sessionTimeoutMinutes: sessionByName.get(p.name) ?? p.sessionTimeoutMinutes,
              // Same shape for the idle timeout, against the SESSION policy.
              idleTimeoutMinutes: idleByName.get(p.name) ?? p.idleTimeoutMinutes,
              // Prefer the real FUP policy -- that is the one the accrual
              // sweep and the login gate resolve. Keyed on presence: `null`
              // there is a chosen "No Limit", not an absent value.
              dailyLimitMinutes: dailyByName.has(p.name)
                ? dailyByName.get(p.name)
                : p.dailyLimitMinutes,
              maxDevices: deviceByName.get(p.name),
              // Prefer the real FUP policy -- the same preference the session
              // timeout and daily limit above make, and for the same reason.
              //
              // The fallback is narrower than theirs, though, and deliberately
              // so. A location saved before this fix holds its choice only in
              // the bandwidth policy's `data_limit`, which was enforced by
              // nothing; showing it back keeps the venue's own words on screen
              // so the next save can make them real. But a legacy value whose
              // `resets` is "Per session" is dropped rather than shown,
              // because there is no period to write it to (see RESETS) -- and
              // re-displaying a cap this platform cannot express would be the
              // same promise, made a second time, by a screen that has just
              // stopped being able to keep it. Those rows read "No limit",
              // which is what their guests have had all along.
              dataLimit: dataByName.has(p.name)
                ? (dataByName.get(p.name) ?? null)
                : p.dataLimit && RESETS.includes(p.dataLimit.resets)
                  ? p.dataLimit
                  : null,
            }),
          ),
        );
        setRealIds(Object.fromEntries(real.map((p) => [p.name, p.id])));
        setSavedRates(
          Object.fromEntries(
            real.map((p) => [p.name, { down: p.downloadRateKbps, up: p.uploadRateKbps }]),
          ),
        );
        setSavedVenueRates(
          Object.fromEntries(
            real.map((p) => [p.name, venueRates(p.venueDownloadRateKbps, p.venueUploadRateKbps)]),
          ),
        );
        setDeviceRealIds(Object.fromEntries(deviceDetails.map((d) => [d.name, d.id])));
        setSessionRealIds(Object.fromEntries(sessionDetails.map((d) => [d.name, d.id])));
        setFupRealIds(Object.fromEntries(fupDetails.map((d) => [d.name, d.id])));
      } catch {
        // Leave policies empty -- the "no policies yet" state is accurate.
      }
    })();
  }, [demo, locationId, locationNames]);

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

  // Put one saved row into the form -- every control, and the data-limit
  // panel's own three pieces of state, which live outside `f`.
  const showRow = useCallback((p: Policy) => {
    setEditingId(p.id);
    setF(limitsFormFromRow(p));
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
    shownFor.current = prefillKey(p);
  }, []);

  // THE FORM OPENS ON THE CHOSEN VENUE'S CURRENT VALUES.
  //
  // It used to open blank and stay blank until the pencil in the table below
  // was pressed, so a venue saved at 40 Mbps / Unlimited devices / 24 hr read
  // "Choose bandwidth", "Choose devices per user", "Choose session timeout" --
  // three required fields apparently unset -- beside an Idle Timeout and a
  // Daily Limit that only LOOKED loaded because the blank form's defaults
  // happened to match. Filling the three back in and pressing Update would
  // have written those two defaults over whatever the venue really had and,
  // with the data-limit panel starting closed, removed its data cap unseen.
  //
  // The decision itself is `prefillDecision`, in a module a test can run.
  useEffect(() => {
    const decision = prefillDecision({
      location: f.businessUnit,
      rows: policies,
      shownFor: shownFor.current,
    });
    if (decision.kind === "fill") {
      showRow(decision.row);
    } else if (decision.kind === "clear") {
      shownFor.current = null;
      setEditingId(null);
      setF((prev) => blankLimitsForm(prev.businessUnit));
      setErrs({});
      setDataLimitOpen(false);
      setDlQuota("");
    }
  }, [f.businessUnit, policies, showRow]);

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

  // What this form will write for the two speeds, worked out in ONE place so
  // the check before the click and the write after it cannot disagree.
  const speedsToWrite = () => {
    // A GREYED CONTROL DOES NOT WRITE.
    //
    // `downloadRateKbps`/`uploadRateKbps` are required numbers on
    // `SaveBandwidthPolicyInput`, so there is no "omit it" -- the choice is
    // between a number the owner chose and a number nobody chose. Where the
    // control is live, it is theirs. Where it is greyed, it is whatever the
    // policy already holds, so saving the four settings that DO work here
    // cannot quietly uncap the venue on the way past.
    const heldRate = savedRates[f.businessUnit];
    const rates = speedUsable
      ? bandwidthRatesForChoice(f.bandwidth, heldRate)
      : { down: heldRate?.down ?? 0, up: heldRate?.up ?? 0 };
    // The venue total follows the same rule with one difference: its keys are
    // optional, so "no opinion" is expressed by leaving them out, and the
    // service carries the stored pair forward (see bandwidthPolicyService.save).
    const venue = venueSpeedUsable
      ? venueRatesForChoice(f.venueSpeed, savedVenueRates[f.businessUnit])
      : undefined;
    return { rates, venue };
  };

  // ── validate ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errs = {};
    if (!f.businessUnit) e.businessUnit = "Required.";
    // Not required when it cannot be honoured. Leaving the asterisk on a
    // disabled control would make the whole form unsavable at a controller
    // venue, taking the session timeout, device count and daily limit --
    // all of which work there -- down with the one field that does not.
    if (!f.bandwidth && speedUsable) e.bandwidth = "Required.";
    if (!f.sessionTimeout) e.sessionTimeout = "Required.";
    if (!f.devicesPerUser) e.devicesPerUser = "Required.";
    // Idle Timeout is required again, and the "idle can't exceed session"
    // cross-check with it. Both were dropped when the control was disabled
    // for being unenforced -- a required field nobody can fill blocks every
    // save. Now that the value reaches the router, the checks earn their
    // place back: an idle timeout longer than the session timeout can never
    // fire, because the session ends first, so saving one is silently
    // choosing "no idle timeout" by a route the form does not admit to.
    //
    // The data-limit quota check is back, for the same reason the idle
    // cross-check is: the value now reaches guests. An open panel with a blank
    // or zero quota would write `*_data_limit_mb: 0`, and `is_fup_usage_
    // exceeded` treats zero as a cap that is already met -- so the venue would
    // have saved an accidental "no internet for anybody", refused at the very
    // next login, from a field they left empty.
    if (!f.idleTimeout) e.idleTimeout = "Required.";
    if (dataLimitOpen) {
      const quota = parseFloat(dlQuota);
      if (!Number.isFinite(quota) || quota <= 0) {
        e.dataLimit = "Enter how much data each guest gets, or remove the limit.";
      }
    }
    const idleMins = IDLE_TIMEOUT_MINUTES[f.idleTimeout];
    const sessionMins = SESSION_TIMEOUT_MINUTES[f.sessionTimeout];
    if (idleMins && sessionMins && idleMins > sessionMins) {
      e.idleTimeout = "Must not be longer than the session timeout.";
    }
    // The server refuses a venue total below the per-guest speed. Said here,
    // under the field, before the click -- not as a failed save afterwards.
    const { rates, venue } = speedsToWrite();
    const problem = venue ? venueSpeedProblem(venue, rates) : null;
    if (problem?.code === "belowPerGuest") {
      e.venueSpeed = t(
        "venueSpeed.errorBelowPerGuest",
        "Must be at least the per-guest speed ({{perGuest}}).",
        { perGuest: problem.perGuest },
      );
    } else if (problem?.code === "range") {
      e.venueSpeed = t("venueSpeed.errorRange", "Must be between 1 Mbps and 10,000 Mbps.");
    }
    setErrs(e);
    return !Object.keys(e).length;
  };

  // ── save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    // `validate()` has already refused a non-positive quota, so this cannot
    // produce the accidental zero-cap described there.
    const dataLimit = dataLimitOpen
      ? { quota: parseFloat(dlQuota), unit: dlUnit, resets: dlResets }
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
      // The location these limits are FOR -- the one picked in the form
      // above, resolved to its real id.
      //
      // This used to be `locationId`, the page's own scope, which is a
      // different thing. The dropdown offers every location on the account,
      // so an operator scoped to Mumbai who picked Delhi saved the policy
      // named "Delhi Office" and then assigned it to Mumbai. And when the
      // page is opened with no location scope at all -- the sidebar route
      // rather than the per-location one -- `locationId` is undefined, so
      // nothing was assigned anywhere: the limits saved, the table listed
      // them, the toast said "Policies updated", and every guest kept the
      // speed they had. Bug report: "Guest WiFi Limit not controlling the
      // bandwidth". Both halves are this one line.
      const targetLocationId = (locations ?? []).find((l) => l.name === f.businessUnit)?.id;
      // Both speeds, exactly as `validate()` just checked them.
      const { rates, venue } = speedsToWrite();
      const existingId = realIds[f.businessUnit];
      const saved = await bandwidthPolicyService.save(
        {
          id: existingId,
          name: f.businessUnit,
          status: "active",
          downloadRateKbps: rates.down,
          uploadRateKbps: rates.up,
          // `undefined` where the control is greyed: the service then keeps
          // the stored pair. `null` is a real choice -- "No limit".
          venueDownloadRateKbps: venue?.down,
          venueUploadRateKbps: venue?.up,
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
      if (targetLocationId) {
        await bandwidthPolicyService.mapToLocation(saved.id, targetLocationId, orgId ?? undefined);
      }
      setRealIds((prev) => ({ ...prev, [f.businessUnit]: saved.id }));
      // Keep the preserved-rate map in step with what was just written, so a
      // second save in the same session preserves the same number rather than
      // the one this location had when the page loaded.
      setSavedRates((prev) => ({ ...prev, [f.businessUnit]: rates }));
      // WHAT THE SERVER NOW HOLDS, NOT WHAT WAS CHOSEN. `saved` is a fresh read
      // of the policy after the write, so this is the venue total as stored.
      // The row, the form and the preserved pair all take it from here.
      const storedVenue = venueRates(saved.venueDownloadRateKbps, saved.venueUploadRateKbps);
      const venueKept = venue === undefined || venueRatesEqual(venue, storedVenue);
      setSavedVenueRates((prev) => ({ ...prev, [f.businessUnit]: storedVenue }));

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
        if (targetLocationId) {
          await createPolicyAssignment({
            policyId: createdDevice.id,
            scopeType: "location",
            scopeId: targetLocationId,
            organizationId: orgId ?? undefined,
          });
        }
        setDeviceRealIds((prev) => ({ ...prev, [f.businessUnit]: createdDevice.id }));
      }

      // Session Timeout and Idle Timeout -- the real ones. See
      // sessionPolicyRules / SESSION_POLICY_DEFAULTS in policy-engine.ts for
      // why this is a separate policy rather than a field on the bandwidth
      // one. Same name-keyed upsert + location assignment shape as the
      // DEVICE policy directly above.
      //
      // The idle timeout goes onto this same SESSION policy rather than a
      // policy of its own: it is resolved by the same guest-login lookup,
      // out of the same memoized read, and splitting it across two policy
      // types would mean two assignments to keep in step for one screen.
      const sessionMinutes = SESSION_TIMEOUT_MINUTES[f.sessionTimeout];
      if (sessionMinutes) {
        const existingSessionId = sessionRealIds[f.businessUnit];
        const sessionRules = sessionPolicyRules(
          sessionMinutes,
          IDLE_TIMEOUT_MINUTES[f.idleTimeout] ?? IDLE_TIMEOUT_MINUTES[DEFAULT_IDLE_TIMEOUT_LABEL],
        );
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
            name: f.businessUnit,
            description: null,
            rules: sessionRules,
            publish: true,
            organizationId: orgId ?? undefined,
          });
          if (targetLocationId) {
            await createPolicyAssignment({
              policyId: createdSession.id,
              scopeType: "location",
              scopeId: targetLocationId,
              organizationId: orgId ?? undefined,
            });
          }
          setSessionRealIds((prev) => ({ ...prev, [f.businessUnit]: createdSession.id }));
        }
      }

      // Maximum Daily Session Limit AND the data limit -- the real ones. One
      // FUP policy carrying both, because `daily_time_limit_minutes` and
      // `daily`/`weekly`/`monthly_data_limit_mb` are the fields the backend
      // actually reads; the bandwidth policy's `daily_limit_minutes` and
      // `data_limit` (both still written above for backward-compatible reads)
      // have no consumer anywhere. See fupPolicyRules in policy-engine.ts for
      // why it is one helper and one write rather than two.
      //
      // Not guarded by a truthiness check, unlike the session block above:
      // "No Limit" and "no data cap" are real, selectable answers here and map
      // to null, and an operator clearing a limit they previously set must
      // produce a new policy version that says so. Skipping the write on a
      // falsy value would leave the old cap standing and make the limit
      // impossible to remove -- the mirror image of the bug this whole change
      // fixes.
      const dailyMinutes = DAILY_LIMIT_MINUTES[f.dailyLimit] ?? null;
      const existingFupId = fupRealIds[f.businessUnit];
      const fupRules = fupPolicyRules({
        dailyTimeLimitMinutes: dailyMinutes,
        dataLimit,
      });
      if (existingFupId) {
        await updatePolicyRules({
          id: existingFupId,
          rules: fupRules,
          publish: true,
          archive: false,
          organizationId: orgId ?? undefined,
        });
      } else if (dailyMinutes !== null || dataLimit !== null) {
        // Only worth creating a policy for a real cap. A brand-new location
        // choosing "No Limit" and no data cap already has neither; writing an
        // FUP policy full of nulls to say so would add a resolvable policy and
        // an assignment that change nothing.
        const createdFup = await createPolicyWithRules({
          policyType: "fup",
          name: f.businessUnit,
          description: null,
          rules: fupRules,
          publish: true,
          organizationId: orgId ?? undefined,
        });
        if (targetLocationId) {
          await createPolicyAssignment({
            policyId: createdFup.id,
            scopeType: "location",
            scopeId: targetLocationId,
            organizationId: orgId ?? undefined,
          });
        }
        setFupRealIds((prev) => ({ ...prev, [f.businessUnit]: createdFup.id }));
      }

      const row: Policy = {
        id: saved.id,
        ...f,
        venueSpeed: venueSpeedLabel(storedVenue),
        dataLimit,
      };
      // The form follows the row, so a venue total the server did not keep is
      // not left sitting in the dropdown as if it had been.
      setF((prev) => ({ ...prev, venueSpeed: row.venueSpeed }));
      shownFor.current = prefillKey(row);
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
      setEditingId(row.id);
      // Say where it landed, and say when it landed nowhere. The old copy
      // read "Policies updated." whenever there was no page scope -- which is
      // exactly the case where nothing was assigned and no guest was
      // affected. A save that cannot reach a location is a real outcome and
      // has to read like one.
      // "Saved and APPLIED" contradicted the line the owner had just read
      // three inches above the button -- "Applies the next time each guest
      // connects -- anyone online right now keeps their current limits until
      // then." Two sentences on one screen, one save apart, disagreeing about
      // whether anything had reached a guest yet.
      //
      // The footer is the true one: every setting here is resolved on the
      // guest's own login. So the toast now reports what it can actually see
      // -- the policy is stored and pointed at this location -- and defers the
      // "when" to the sentence that already states it correctly, rather than
      // asserting a second, stronger answer beside it.
      //
      // SPEED IS NOT "NEXT CONNECT" ANY MORE. Publishing a bandwidth policy
      // re-applies it to the guests who are online, so the toast names speed
      // on the "now" side with the data limit and leaves timeouts and device
      // count on the "next connect" side, where they still are.
      setToast(
        !venueKept
          ? t(
              "venueSpeed.notSaved",
              "Limits saved for {{location}}, but the total venue speed was not — it reads back as {{actual}}.",
              { location: f.businessUnit, actual: row.venueSpeed },
            )
          : targetLocationId
            ? dataLimit
              ? `Limits saved for ${f.businessUnit} — speed and the data limit reach guests online now; the rest apply as each guest next connects.`
              : `Limits saved for ${f.businessUnit} — speed reaches guests online now; the rest apply as each guest next connects.`
            : "Limits saved, but not applied to any location — reopen this page from the location you want them on.",
      );
      setTimeout(() => setToast(null), venueKept ? 2500 : 6000);
    } catch (err) {
      // The server's own sentence when it is the venue total it refused --
      // under the field, where the owner can act on it -- rather than a line
      // about the connection, which is not what went wrong.
      const refused = venueSpeedServerError(err);
      if (refused) {
        setErrs((prev) => ({ ...prev, venueSpeed: refused }));
        setToast(t("venueSpeed.rejected", "Could not save — {{message}}", { message: refused }));
        setTimeout(() => setToast(null), 6000);
      } else {
        setToast("Could not save — check the connection and try again.");
        setTimeout(() => setToast(null), 2500);
      }
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
    showRow(p);
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
        // The held rate dies with the policy it was read off. Keeping it would
        // mean the next save for this same name silently reinstated a cap the
        // owner had just deleted -- the mirror image of the overwrite this map
        // exists to prevent.
        setSavedRates((prevRates) => {
          const n = { ...prevRates };
          delete n[businessUnit];
          return n;
        });
        // The held venue total dies with it too, for the same reason.
        setSavedVenueRates((prevRates) => {
          const n = { ...prevRates };
          delete n[businessUnit];
          return n;
        });
        setSessionRealIds((prevIds) => {
          const n = { ...prevIds };
          delete n[businessUnit];
          return n;
        });
        // The FUP id dies with the policy too. Left behind, the next save for
        // this same location name would republish onto a policy
        // `resolve_effective_policy` can no longer see -- the exact trap the
        // bandwidth and device ids above already document, and the one that
        // now also decides whether a data cap is real.
        setFupRealIds((prevIds) => {
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
        // Same for the SESSION policy -- otherwise a deleted location's
        // session length stays in force, and the next save for that same
        // name republishes onto a policy `resolve_effective_policy` can no
        // longer see (the exact trap the bandwidth/device ids already
        // document above).
        const sessionId = businessUnit ? sessionRealIds[businessUnit] : undefined;
        if (sessionId) {
          deactivatePolicy(sessionId, orgId ?? undefined).catch(() => {});
        }
        // And the FUP policy, for the same reason and with sharper teeth:
        // a daily time limit or a data cap left in force after its location
        // was deleted does not merely linger, it locks guests out --
        // `_enforce_fup_quota` refuses the login of anyone who has already
        // spent either allowance, and there would no longer be a screen
        // anywhere showing that a cap exists to explain why.
        const fupId = businessUnit ? fupRealIds[businessUnit] : undefined;
        if (fupId) {
          deactivatePolicy(fupId, orgId ?? undefined).catch(() => {});
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
                // Back to what is saved, not to an empty form: the same row
                // is shown again, with whatever was changed thrown away. An
                // empty form over a venue that has limits is the state this
                // screen no longer opens in.
                const savedRow = policies.find((p) => p.id === editingId);
                if (savedRow) {
                  showRow(savedRow);
                  return;
                }
                shownFor.current = null;
                setEditingId(null);
                setF(blankLimitsForm());
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
                {/* THE CONTROL THAT WAS SAVING INTO NOTHING.
                    A bandwidth policy is consumed by exactly one thing on
                    this platform -- `queue_management`, which writes RouterOS
                    `/queue simple` and additionally emits the MikroTik
                    `Mikrotik-Rate-Limit` reply attribute at Access-Accept.
                    Both are MikroTik-only: `_QUEUE_ADAPTERS` has one vendor
                    in it and a controller's synthetic router row has no API
                    credentials, so `_assign_guest_queue` fails and is
                    swallowed. The number was accepted, stored, read back and
                    shown as active, and never reached a device.
                    Disabled rather than hidden, and disabled rather than left
                    live, for the reason `ControllerManagedFeatureNotice`
                    gives: an absence cannot be asked a question. Everything
                    else in this section and the next still works at a
                    controller venue and stays editable -- which is exactly
                    why this screen is NOT replaced wholesale. */}
                <div>
                  <Select
                    id="bw"
                    label="Bandwidth"
                    required
                    disabled={!speedUsable}
                    value={f.bandwidth}
                    onChange={(v) => setField("bandwidth", v)}
                    options={optionsWithCurrent(BANDWIDTH, f.bandwidth)}
                    placeholder="Choose bandwidth"
                    caption="Maximum speed per guest device."
                    err={errs.bandwidth}
                  />
                  {/* Suppressed while the capabilities read is still in
                    flight. The control above is already greyed for the same
                    reason; a sentence would be an answer, and we do not have
                    one yet. */}
                  {!speedAsking && <ControllerControlNotice verdict={speedVerdict} />}
                </div>
                <Select
                  id="dp"
                  label="Devices Per User"
                  required
                  value={f.devicesPerUser}
                  onChange={(v) => setField("devicesPerUser", v)}
                  options={optionsWithCurrent(DEVICES, f.devicesPerUser)}
                  placeholder="Choose devices per user"
                  caption="How many devices the same guest can connect at once."
                  err={errs.devicesPerUser}
                />
                {/* TOTAL VENUE SPEED -- the same dropdown as Bandwidth, directly
                    under it, because it is the same kind of answer one level
                    up: Bandwidth is the most ONE guest gets, this is the most
                    ALL of them get together. One value for both directions,
                    like the control above; "No limit" is the default and is
                    written as no cap at all, never as zero.
                    Not required, so it carries no asterisk and cannot block a
                    save. Greyed with one plain line where this venue's
                    hardware cannot hold guests to a combined total -- and a
                    greyed control writes nothing (see `speedsToWrite`). */}
                <div>
                  <Select
                    id="vs"
                    label={t("venueSpeed.label", "Total venue speed")}
                    disabled={!venueSpeedUsable}
                    value={f.venueSpeed}
                    onChange={(v) => setField("venueSpeed", v)}
                    options={venueSpeedOptions(savedVenueRates[f.businessUnit])}
                    caption={t(
                      "venueSpeed.caption",
                      "The most all guests together can use at this venue.",
                    )}
                    err={errs.venueSpeed}
                  />
                  {!speedAsking && !venueSpeedUsable && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t("venueSpeed.unavailable", "Not available on this venue's hardware.")}
                    </p>
                  )}
                </div>
              </div>

              {/* collapsible data limit -- a third, optional capacity setting.
                Nested inside this section (instead of floating below it
                looking unrelated) so it reads as belonging with
                Bandwidth/Devices Per User. */}
              {/* LIVE AGAIN, BECAUSE IT NOW WRITES WHERE THE READ HAPPENS.
                This was disabled for a release with "Not enforced yet --
                saving this has no effect on guests", which was true: the
                fields underneath saved and read back perfectly into the
                bandwidth policy's `data_limit`, which nothing resolves. The
                cap is now written to the FUP policy's `*_data_limit_mb`, which
                `record_usage` acts on mid-session and `_enforce_fup_quota`
                gates the next login with. Same control, different destination.

                Enabled rather than left disabled because the machinery was
                never the missing part -- see policy-engine.ts's own write-up
                -- and "2 GB per guest" is an ordinary thing for a venue to
                want. Unlike Bandwidth directly above, this needs nothing from
                the device: the accounting arrives from RADIUS at a MikroTik
                venue and from the Omada usage backfill at a controller one, so
                there is no vendor gate to render here and none is faked. */}
              <button
                type="button"
                onClick={() => setDataLimitOpen((prev) => !prev)}
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
                <>
                  {/* Said here, in full, once. This is the only setting on the
                    form that ends a session someone is currently using, and
                    the only one whose consequence a guest meets rather than an
                    operator. Burying either half behind the (?) tooltip
                    pattern would be hiding the part that generates the support
                    call. */}
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Each guest gets this much data per period. When they reach it their session ends
                    and they are signed out — at a controller-managed venue the controller cuts the
                    device off, and a device that reconnects lands back on the sign-in page. They
                    cannot sign in again until the period resets.
                  </p>
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
                </>
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
                {/* LEFT LIVE, DELIBERATELY. Unlike the bandwidth above, a
                    session timeout does not depend on a device adapter: the
                    platform's own `enforce_session_timeouts` sweep expires the
                    row, and its docstring names an Omada guest as the case it
                    exists for. What a controller does not do is count the
                    minutes down itself, so the guest is signed out on our side
                    and the device may linger -- which is the disconnect gap,
                    said here rather than discovered later. A caveat, not a
                    refusal, so it renders as a note and not as a lock. */}
                <div>
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
                  <ControllerControlNotice verdict={sessionTimeoutVerdict} />
                </div>
                <Select
                  id="it"
                  label="Idle Timeout"
                  required
                  value={f.idleTimeout}
                  onChange={(v) => setField("idleTimeout", v)}
                  options={IDLE_TIMEOUT}
                  placeholder="Choose idle timeout"
                  caption="Sign a device out after this much inactivity."
                  err={errs.idleTimeout}
                />
                <Select
                  id="dl"
                  label="Maximum Daily Session Limit"
                  value={f.dailyLimit}
                  onChange={(v) => setField("dailyLimit", v)}
                  options={DAILY_LIMIT}
                  placeholder="Choose daily limit"
                  caption="Total time one guest may be online per day."
                />
              </div>
            </div>
          </div>

          <hr className="my-6 border-slate-100 dark:border-slate-600" />
          {/* When-it-applies notice -- a slim, contextual line right where
            it's relevant: the moment before clicking Save. Support contact
            tucked behind the same Tooltip pattern already used for
            individual field help elsewhere on this page.

            This used to read "Applies immediately -- including to guests
            already connected", and that was not true of a single setting
            on this form. Every one of them is resolved on the guest's own
            login: the session and idle timeouts are written onto the
            session row at that moment, and the bandwidth becomes a
            SESSION-scoped queue assignment then too. Nothing on the
            platform revisits a guest who is sitting connected, so a venue
            that raised a speed and watched a guest's phone for a change
            saw none, and the screen had told them to expect one.

            The distinction is not pedantic. Bug report: "speed is only set
            to 20 and not updating" -- and the backend half of that (a
            returning guest whose session was reused never had their queue
            re-resolved at all, so the speed was pinned to whatever applied
            when they first signed in, for as long as they kept using the
            network) is fixed alongside this.

            AND IT IS NO LONGER TRUE OF EVERY FIELD, SO IT NO LONGER SAYS
            EVERY FIELD. Wiring the data limit made this footer's blanket
            promise false for exactly one control -- the one whose whole point
            is to act on a guest who is using the network right now. A data cap
            is resolved live: `_track_fup_data_usage` runs on every RADIUS
            Interim-Update and on every Omada usage poll, against whatever the
            policy says at that moment, so a cap added or lowered at 3pm is
            measured against usage the guest has ALREADY spent today and can
            end their session within minutes. Not on save -- on the next
            accounting update, which is why the sentence says "within minutes"
            rather than "immediately".

            Leaving the old line in place would have been the cheaper edit and
            the wrong one: this screen has spent three releases removing
            sentences that were true of most of the form. */}
          <div className="flex flex-col items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              {/* SPEED LEFT THE "NEXT CONNECT" LIST. Publishing a speed
                  re-applies it to the guests who are online -- the per-guest
                  speed and the venue total alike -- so the old opening,
                  "Speed, timeouts and device count apply the next time each
                  guest connects", understated the one setting an owner is
                  most likely to be watching a phone for. Timeouts and device
                  count are still resolved at sign-in and stay where they
                  were. "usually within a minute" and not "immediately": the
                  write goes to the venue's hardware and is not instant. */}
              {t(
                "limitsApplyNote",
                "A speed change reaches guests who are already online, usually within a minute. Timeouts and device count apply the next time each guest connects — anyone online right now keeps those until then. A data limit is different: it counts usage guests have already spent this period, so adding or lowering one can sign someone out within minutes.",
              )}
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
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Location</TableHead>
                    <TableHead className="text-xs font-medium">Bandwidth</TableHead>
                    <TableHead className="text-xs font-medium">
                      {t("venueSpeed.column", "Venue speed")}
                    </TableHead>
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
                      {/* THE SAME LIE, IN A SECOND PLACE. A row saved before
                          this venue's router became a controller still holds
                          "20 Mbps", and printing it here states a speed that
                          nothing applies -- the form above can be greyed and
                          this cell would still promise it. `—` with the reason
                          on hover is the same posture `lastContactLabel` takes
                          for a measurement we do not have. */}
                      <TableCell>
                        {speedUsable ? (
                          p.bandwidth
                        ) : (
                          <span
                            className="text-slate-400 dark:text-slate-500"
                            title={speedVerdict.reason ?? undefined}
                          >
                            Not applied here
                          </span>
                        )}
                      </TableCell>
                      {/* Same posture as the Bandwidth cell beside it: where
                          this venue cannot apply a total, the stored number
                          is not restated as if something enforced it. "No
                          limit" is muted like the other unset values so a
                          venue that HAS a total stands out. */}
                      <TableCell
                        className={
                          !venueSpeedUsable || p.venueSpeed === VENUE_SPEED_NO_LIMIT
                            ? "text-slate-400 dark:text-slate-500"
                            : undefined
                        }
                      >
                        {venueSpeedUsable
                          ? p.venueSpeed
                          : t("venueSpeed.notApplied", "Not applied here")}
                      </TableCell>
                      <TableCell>{p.sessionTimeout}</TableCell>
                      {/* "No Limit"/"Unlimited" rows are muted so a stricter,
                      set value on another row visually stands out instead
                      of every policy reading with equal weight.

                      Idle Timeout has no "No Limit" any more (see
                      IDLE_TIMEOUT_MINUTES), so the muting there now marks
                      the default instead: a location still on the platform
                      default is the one nobody has made a decision about,
                      which is the same "nothing set here" signal the muting
                      existed to give. */}
                      <TableCell
                        className={
                          p.idleTimeout === DEFAULT_IDLE_TIMEOUT_LABEL
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
