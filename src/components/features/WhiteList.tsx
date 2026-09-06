import { useEffect, useState, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Smartphone,
  Laptop,
  Calendar,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import { portalService } from "@/services/portal.service";
import { resolveOrgId } from "@/services/customer.service";
import {
  describeBlocker,
  evaluateWhitelistOnlyReadiness,
  isRuleActive,
  whitelistOnlySummary,
} from "@/lib/whitelist-only";
import type { WhitelistOnlyBlocker } from "@/lib/whitelist-only";
import type { Portal } from "@/types/portal";
import { maskMac } from "@/components/features/HeaderControls";
import type { AnyAccessRule } from "@/types/guest";

// ── helpers ─────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
// A rule with no expiry reads back as `endDate: ""` (see toEntry), and
// `new Date("")` is Invalid Date -- which this used to render, verbatim, as
// "NaN-NaN-NaN NaN:NaN" in the Access window column. Say "No end date"
// instead: that is what an empty `expires_at` actually means.
const fmtDT = (iso: string) => {
  if (!iso) return "No end date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
// <input type="datetime-local">'s value ("2026-08-01T06:49") carries no UTC
// offset -- per the HTML/ECMA-262 spec it's the *browser's local* wall-clock
// time (i.e. the real zone the person filling the form is actually in, not
// UTC). `new Date(...)` parses a zone-less date-time string exactly that
// way, so `.toISOString()` gives the real UTC instant for whatever zone the
// customer is really in -- e.g. an Asia/Kolkata user's "06:49" becomes
// "01:19:00Z", not (wrongly) "06:49:00Z". Sending the raw local string
// instead (as this used to do) both misrepresents the intended moment by
// the zone offset AND -- because the backend then received the datetime
// with no tzinfo at all -- crashed guest-access/[device-]rules' expiry
// check with an unhandled naive-vs-aware TypeError (fixed independently on
// the backend, but this is the real, zone-correct fix at the source).
const toUtcIso = (dtLocal: string) => (dtLocal ? new Date(dtLocal).toISOString() : undefined);
const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRIES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+971", label: "🇦🇪 +971" },
];
const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.

// A guest's login identifier is E.164 with the dialling code attached --
// the real captive portal submits `dialCode + nationalPhone`
// (useGuestSignIn.ts's `identifierForChannel`), and Blocked Guests stores
// the same shape ("+" + digits, see BlockUsers.tsx's parsed/chipNumbers).
// This screen had the country picker on the form and then threw it away:
// `identifier` was the bare 10 digits, so a whitelist rule keyed
// "9876543210" could never match the guest who signs in as
// "+919876543210" -- the entry saved, listed, and did nothing. Join them
// here, and split them back apart for the edit form below.
const toE164 = (dialCode: string, national: string) => `${dialCode}${national}`;
const splitE164 = (identifier: string): { cc: string; national: string } => {
  // Longest dialling code first, so "+91" never shadows a longer code that
  // happens to start with the same digits.
  const match = [...COUNTRIES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => identifier.startsWith(c.code));
  if (match) return { cc: match.code, national: identifier.slice(match.code.length) };
  // Legacy rows written before this fix carry bare national digits.
  return { cc: "+91", national: identifier.replace(/^\+/, "") };
};

type Tab = "number" | "device";
interface Entry {
  id: string;
  tab: Tab;
  identifier: string; // mobile number (number tab) or MAC (device tab)
  /** The rule's own scope. `null` means it was written org-wide, and the
   * backend's `list_matching_guest_rules` ORs `location_id IS NULL` against
   * the target location -- i.e. it applies at *every* property. The
   * whitelist-only readiness check below has to honour that, or a property
   * whose only entries are org-wide rules reads as an empty list. */
  locationId: string | null;
  name: string;
  email: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
}
type FormData = {
  mobileCC: string;
  mobile: string;
  mac: string;
  name: string;
  email: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
};
type Errors = Partial<Record<keyof FormData, string>>;

// Fixed (not Date.now()-relative) so the server-rendered HTML and the
// client's hydration pass always agree -- a relative computation baked
// into a module-level constant evaluates at two different wall-clock
// moments (server module load vs. client bundle load) and hydration-
// mismatches the instant those two moments land in different minutes.
const SEED: Entry[] = [
  {
    id: "s1",
    tab: "number",
    locationId: null,
    identifier: "9876543210",
    name: "Ravi Sharma",
    email: "ravi@example.com",
    businessUnit: "Mumbai HQ",
    startDate: "2026-07-22T10:00",
    endDate: "2026-07-26T10:00",
  },
  {
    id: "s2",
    tab: "number",
    locationId: null,
    identifier: "8765432109",
    name: "Priya Kapoor",
    email: "priya@example.com",
    businessUnit: "Delhi Office",
    startDate: "2026-07-21T09:00",
    endDate: "2026-07-30T09:00",
  },
  {
    id: "s3",
    tab: "device",
    locationId: null,
    identifier: "AA:BB:CC:DD:EE:FF",
    name: "Office Printer",
    email: "it@example.com",
    businessUnit: "Chennai Office",
    startDate: "2026-06-23T08:00",
    endDate: "2026-07-21T08:00",
  },
];

/**
 * Header-accent illustration: a trusted phone drifting clear through a
 * gate/turnstile -- the visual for "bypass the captive portal". Was a full
 * dark-hero band (viewBox 220x120, its own gradient background) -- the
 * only header in the whole Guest Access sub-section built that way, so
 * flipping between this tab and its sibling "Blocked Guests" tab (a plain
 * white card with a small corner icon, same treatment PoliciesHub.tsx's
 * own header uses) was a jarring style change for no functional reason.
 * Shrunk to the same compact corner-icon convention (viewBox 84x56, h-14)
 * used by BlockedAccessIllustration/PolicyShieldIllustration, and the
 * checkmark recolored from decorative violet to the emerald GuestBadges.tsx
 * already uses for "whitelist" and this same file's own "Active" status
 * pill -- so the illustration, the tab accent, and the status pill all
 * agree on one color for "allowed" instead of three different ones.
 * Purely decorative -- aria-hidden. The gate's pulse and the phone's
 * entrance both respect useReducedMotion.
 */
function TrustedAccessIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 56"
      className="hidden h-14 w-auto shrink-0 sm:block"
      fill="none"
    >
      {/* turnstile / gate */}
      <rect
        x="52"
        y="8"
        width="6"
        height="40"
        rx="2.5"
        fill="#241f4d"
        stroke="#a78bfa"
        strokeOpacity="0.4"
        strokeWidth="1.3"
      />
      <rect
        x="74"
        y="8"
        width="6"
        height="40"
        rx="2.5"
        fill="#241f4d"
        stroke="#a78bfa"
        strokeOpacity="0.4"
        strokeWidth="1.3"
      />
      <motion.rect
        x="52"
        y="14"
        width="28"
        height="4"
        rx="2"
        fill="#22d3ee"
        animate={shouldReduceMotion ? { opacity: 0.5 } : { opacity: [0.3, 0.7, 0.3] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* trusted phone, drifting through the gate */}
      <motion.g
        initial={shouldReduceMotion ? false : { x: -6, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <rect
          x="8"
          y="16"
          width="22"
          height="30"
          rx="4.5"
          fill="#2e2a5c"
          stroke="#a78bfa"
          strokeWidth="1.4"
        />
        <rect x="11.5" y="20.5" width="15" height="19" rx="1.5" fill="#1e1b4b" />
        <circle cx="19" cy="30" r="6" fill="#10b981" fillOpacity="0.2" />
        <motion.path
          d="M16.2 30l2 2 3.8-4"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        />
      </motion.g>

      {/* "clear" arcs trailing through the gate */}
      {[0, 1].map((i) => (
        <motion.path
          key={i}
          d={`M${36 + i * 7} 30a2.5 2.5 0 0 1 0-3`}
          stroke="#f0abfc"
          strokeOpacity="0.7"
          strokeWidth="1.8"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 1.6, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }
          }
        />
      ))}
    </svg>
  );
}

const PAGE_SIZE = 5;
// Only the table's own search box (below) still uses this hand-rolled
// className -- the form fields above now use the platform Input/Select/
// Label primitives (see the "Who's Allowed"/"Access Window" sections).
const inputCls =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";

function toEntry(r: AnyAccessRule): Entry {
  return {
    id: r.id,
    tab: r.kind === "device" ? "device" : "number",
    identifier: r.kind === "device" ? r.macAddress : r.identifier,
    locationId: r.locationId ?? null,
    name: r.reason ?? "—",
    email: r.email ?? "",
    // Real rows carry a real location_id, not a name -- resolved against
    // the caller's own `locations` list at the two call sites below
    // (the initial fetch and the create/edit paths), the same way
    // TicketsPage.tsx resolves its own businessUnit <-> locationId pair.
    businessUnit: "",
    startDate: r.createdAt.slice(0, 16),
    endDate: r.expiresAt ? r.expiresAt.slice(0, 16) : "",
  };
}

export default function WhiteList({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations, so the "Business Unit" picker below must offer
  // those instead. Same real-vs-demo split as TicketsPage.tsx's
  // units/realUnits.
  const { data: locations } = useCustomerLocations();
  const realUnits = useMemo(() => (locations ?? []).map((l) => l.name), [locations]);
  const units = demo ? UNITS : realUnits;
  const [tab, setTab] = useState<Tab>("number");
  const [entries, setEntries] = useState<Entry[]>(demo ? SEED : []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [f, setF] = useState<FormData>({
    mobileCC: "+91",
    mobile: "",
    mac: "",
    name: "",
    email: "",
    businessUnit: demo ? UNITS[0] : "",
    startDate: "",
    endDate: "",
  });
  const [errs, setErrs] = useState<Errors>({});
  const [toast, setToast] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  // Set while editing an existing row -- there's no PATCH endpoint for
  // guest/device access rules (backend/app/domains/guest_access has
  // create/list/deactivate/delete only), so "editing" a real rule means
  // creating its replacement then deleting the original, both real,
  // already-existing endpoints. See handleSubmit/handleDelete below.
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ── whitelist-only mode ───────────────────────────────────────
  // The per-property switch. Stored on that property's own captive-portal
  // config (`whitelist_only_enabled`), never on the organisation default --
  // the backend refuses the flag there outright, because a default is
  // inherited by every location without an override and one toggle would
  // close the whole estate at once.
  const [wlLocationId, setWlLocationId] = useState<string>("");
  const [wlDemoUnit, setWlDemoUnit] = useState<string>(UNITS[0]);
  const [wlConfig, setWlConfig] = useState<Portal | null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlSaving, setWlSaving] = useState(false);
  const [wlEnabled, setWlEnabled] = useState(false);
  const [wlMissingConfig, setWlMissingConfig] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);
  const [wlDenials, setWlDenials] = useState<{ count: number; capped: boolean } | null>(null);
  // Deliberately NOT seeded with example copy. A textarea that ships
  // pre-filled becomes the venue's published words on their first
  // unrelated Save -- exactly the defect PR #226 caught in the Terms
  // editor. The example lives in the placeholder, where it can be read
  // and cannot be saved.
  const [wlMessage, setWlMessage] = useState("");
  const [wlMessageDirty, setWlMessageDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const wlLocationName = demo
    ? wlDemoUnit
    : (locations?.find((l) => l.id === wlLocationId)?.name ?? "");

  // Default the switch's property picker to whichever property the page is
  // already scoped to, else the first one the account holds.
  useEffect(() => {
    if (demo || wlLocationId || !locations?.length) return;
    setWlLocationId(
      locationId && locations.some((l) => l.id === locationId) ? locationId : locations[0].id,
    );
  }, [demo, locations, locationId, wlLocationId]);

  // Read the selected property's own config, and -- when the mode is
  // already on -- how many guests it turned away in the last 24 hours.
  useEffect(() => {
    if (demo || !orgId || !wlLocationId) return;
    let cancelled = false;
    setWlLoading(true);
    setWlError(null);
    (async () => {
      try {
        const cfg = await portalService.forLocation(orgId, wlLocationId);
        if (cancelled) return;
        setWlConfig(cfg);
        setWlMissingConfig(cfg === null);
        setWlEnabled(cfg?.whitelistOnly.enabled ?? false);
        setWlMessage(cfg?.whitelistOnly.deniedMessage ?? "");
        setWlMessageDirty(false);
        if (cfg?.whitelistOnly.enabled) {
          try {
            const denials = await guestService.countWhitelistDenials(orgId, wlLocationId);
            if (!cancelled) setWlDenials(denials);
          } catch {
            // A missing count is not a reason to hide a working switch --
            // render the switch and say the count is unavailable.
            if (!cancelled) setWlDenials(null);
          }
        } else if (!cancelled) {
          setWlDenials(null);
        }
      } catch {
        if (!cancelled) setWlError("Could not read this property's settings.");
      } finally {
        if (!cancelled) setWlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, orgId, wlLocationId]);

  // Every rule that would actually be consulted at the selected property:
  // its own rules, plus the org-wide ones (`location_id IS NULL`) the
  // backend's matcher ORs in. Scoped by name in demo mode, where the seed
  // rows carry business-unit names rather than real ids.
  const wlScopedEntries = useMemo(
    () =>
      entries.filter((e) =>
        demo ? e.businessUnit === wlDemoUnit : !e.locationId || e.locationId === wlLocationId,
      ),
    [entries, demo, wlDemoUnit, wlLocationId],
  );

  const readiness = useMemo(
    () => evaluateWhitelistOnlyReadiness(wlScopedEntries),
    [wlScopedEntries],
  );

  const wlBlockers: WhitelistOnlyBlocker[] = useMemo(() => {
    const b = [...readiness.blockers];
    if (!demo && wlMissingConfig) b.push({ kind: "no-portal-config" });
    return b;
  }, [readiness.blockers, demo, wlMissingConfig]);

  const canEnable = wlBlockers.length === 0;
  const confirmMatches = confirmText.trim().toLowerCase() === wlLocationName.trim().toLowerCase();

  const persistWhitelistOnly = async (enabled: boolean, deniedMessage: string) => {
    if (demo) {
      setWlEnabled(enabled);
      setWlMessage(deniedMessage);
      setWlMessageDirty(false);
      setToast(
        enabled
          ? `Whitelist-only mode is on for ${wlLocationName}.`
          : `Whitelist-only mode is off for ${wlLocationName}.`,
      );
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!orgId || !wlConfig) return;
    setWlSaving(true);
    setWlError(null);
    try {
      const updated = await portalService.update(
        wlConfig.id,
        { whitelistOnly: { enabled, deniedMessage } },
        orgId,
      );
      setWlConfig(updated);
      setWlEnabled(updated.whitelistOnly.enabled);
      setWlMessage(updated.whitelistOnly.deniedMessage);
      setWlMessageDirty(false);
      // The moment it goes on is the moment the count starts mattering --
      // waiting for a reload to fetch it is the difference between finding
      // a mis-keyed list in the next minute and finding it in a support
      // call. Turning it off clears the count with the reason for it.
      if (updated.whitelistOnly.enabled) {
        try {
          setWlDenials(await guestService.countWhitelistDenials(orgId, wlLocationId));
        } catch {
          setWlDenials(null);
        }
      } else {
        setWlDenials(null);
      }
      setToast(
        enabled
          ? `Whitelist-only mode is on for ${wlLocationName}.`
          : `Whitelist-only mode is off for ${wlLocationName}.`,
      );
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      // Surface the server's own words. The one refusal worth reading
      // verbatim is WhitelistOnlyRequiresLocationError -- it means this
      // save was aimed at an organisation default, which must never
      // happen from here, and a generic "could not save" would hide it.
      const message = err instanceof Error ? err.message : "";
      setWlError(
        message ||
          "Could not save this setting. Nothing changed — the property is still in its previous mode.",
      );
    } finally {
      setWlSaving(false);
    }
  };

  const onSwitchChange = (next: boolean) => {
    setWlError(null);
    // Turning it OFF only ever widens access, so it needs no confirmation:
    // every guest goes back to signing in normally.
    if (!next) {
      void persistWhitelistOnly(false, wlMessage);
      return;
    }
    if (!canEnable) return;
    setConfirmText("");
    setConfirmOpen(true);
  };

  // Real rows only carry a location_id, not a display name -- resolve it
  // against the caller's own real locations, same pairing TicketsPage.tsx
  // does for its own businessUnit <-> locationId round-trip.
  const withBusinessUnit = (e: Entry, ruleLocationId: string | null | undefined): Entry => ({
    ...e,
    businessUnit: locations?.find((l) => l.id === ruleLocationId)?.name ?? "",
  });

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        // /me/organizations (membership-scoped) instead of the
        // platform-wide GET /organizations, which 403s for an ordinary
        // customer/org-owner session -- see customer.service.ts's
        // resolveOrgId doc comment.
        const org = await resolveOrgId();
        setOrgId(org);
        const rules = await guestService.listAccessRules(org);
        setEntries(
          rules
            .filter((r) => r.ruleType === "whitelist")
            .map((r) => withBusinessUnit(toEntry(r), r.locationId)),
        );
      } catch {
        // Leave entries empty -- the "no whitelist entries" state is accurate.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locationId, locations]);

  // Default the picker to the location this page is already scoped to,
  // once its real name is known (mirrors TicketsPage.tsx's equivalent effect).
  useEffect(() => {
    if (!demo && !f.businessUnit && locationId && locations) {
      const match = locations.find((l) => l.id === locationId);
      if (match) setF((p) => ({ ...p, businessUnit: match.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locations, locationId]);

  // ── filtered + paginated ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.tab === tab &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.identifier.toLowerCase().includes(q) ||
          e.businessUnit.toLowerCase().includes(q)),
    );
  }, [entries, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ── validators ────────────────────────────────────────────────
  const validate = (): Errors => {
    const e: Errors = {};
    if (tab === "number") {
      if (!f.mobile || f.mobile.length !== 10 || !/^\d{10}$/.test(f.mobile))
        e.mobile = "Mobile must be exactly 10 digits.";
    } else {
      if (!f.mac || !MAC_RE.test(f.mac))
        e.mac = "That doesn't look like a device address. Example: AA:BB:CC:DD:EE:FF";
    }
    if (!f.name) e.name = "Name is required.";
    if (!f.email || !EMAIL_RE.test(f.email)) e.email = "Enter a valid email address.";
    // No start-date validation any more: there is no start field on an
    // access rule (CreateAccessRulePayload carries only `expires_at`, and
    // the list read maps `startDate` from the rule's own createdAt), so a
    // start date could never be saved. It was required, sent nowhere, and
    // silently replaced on reload by whenever the row happened to be
    // created. The control is now read-only -- see the Access Window
    // section below.
    if (!f.endDate) e.endDate = "End date is required.";
    if (f.endDate && new Date(f.endDate).getTime() <= Date.now())
      e.endDate = "End date must be in the future.";
    return e;
  };

  const setField = (k: keyof FormData, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
  };

  // ── submit ────────────────────────────────────────────────────
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    setErrs(v);
    if (Object.keys(v).length) return;

    const identifier = tab === "number" ? toE164(f.mobileCC, f.mobile) : f.mac.toUpperCase();
    const resetForm = () =>
      setF({
        mobileCC: "+91",
        mobile: "",
        mac: "",
        name: "",
        email: "",
        businessUnit: demo ? UNITS[0] : (units[0] ?? ""),
        startDate: "",
        endDate: "",
      });
    if (demo) {
      if (editingId) {
        setEntries((p) =>
          p.map((x) =>
            x.id === editingId
              ? {
                  ...x,
                  tab,
                  identifier,
                  name: f.name,
                  email: f.email,
                  businessUnit: f.businessUnit,
                  startDate: f.startDate,
                  endDate: f.endDate,
                }
              : x,
          ),
        );
        setEditingId(null);
      } else {
        const entry: Entry = {
          id: `e${Date.now()}`,
          tab,
          identifier,
          locationId: null,
          name: f.name,
          email: f.email,
          businessUnit: f.businessUnit,
          startDate: f.startDate,
          endDate: f.endDate,
        };
        setEntries((p) => [entry, ...p]);
      }
      resetForm();
      setPage(0);
      setToast(tab === "number" ? "Number allowed." : "Device allowed.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!orgId) {
      setToast("No organization found for this session.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    // The picker lets a customer with several locations allow-list against
    // a *different* one than whichever this page happens to be scoped to
    // -- resolve the name they picked back to its real id (same
    // name<->id round-trip TicketsPage.tsx does for its own businessUnit
    // field) instead of always writing the page's own `locationId` prop,
    // which silently ignored the picker entirely.
    const matchedLoc = locations?.find((l) => l.name === f.businessUnit);
    const ruleLocationId = matchedLoc?.id ?? locationId;
    try {
      const rule = await guestService.createAccessRule({
        kind: tab === "number" ? "identifier" : "device",
        organizationId: orgId,
        locationId: ruleLocationId,
        identifier: tab === "number" ? identifier : undefined,
        macAddress: tab === "device" ? identifier : undefined,
        ruleType: "whitelist",
        reason: f.name,
        email: f.email,
        expiresAt: toUtcIso(f.endDate),
      });
      const newEntry = withBusinessUnit(toEntry(rule), ruleLocationId);
      if (editingId) {
        // No PATCH endpoint exists for access rules -- "editing" is a real
        // create of the replacement followed by a real delete of the
        // original. If the delete fails, the original is left in place
        // (both now exist) rather than silently losing either row.
        const editingEntry = entries.find((e) => e.id === editingId);
        if (editingEntry) {
          try {
            await guestService.deleteAccessRule(
              editingEntry.tab === "device" ? "device" : "identifier",
              editingEntry.id,
              orgId,
            );
          } catch {
            /* original left in place; not fatal to the edit itself */
          }
        }
        setEntries((p) => [newEntry, ...p.filter((e) => e.id !== editingId)]);
        setEditingId(null);
      } else {
        setEntries((p) => [newEntry, ...p]);
      }
      resetForm();
      setPage(0);
      setToast(tab === "number" ? "Number allowed." : "Device allowed.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not save — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const startEdit = (entry: Entry) => {
    setTab(entry.tab);
    setErrs({});
    setEditingId(entry.id);
    const phone = entry.tab === "number" ? splitE164(entry.identifier) : null;
    setF({
      mobileCC: phone?.cc ?? "+91",
      mobile: phone?.national ?? "",
      mac: entry.tab === "device" ? entry.identifier : "",
      name: entry.name === "—" ? "" : entry.name,
      email: entry.email,
      businessUnit: entry.businessUnit || (demo ? UNITS[0] : (units[0] ?? "")),
      startDate: entry.startDate,
      endDate: entry.endDate,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrs({});
    setF({
      mobileCC: "+91",
      mobile: "",
      mac: "",
      name: "",
      email: "",
      businessUnit: demo ? UNITS[0] : (units[0] ?? ""),
      startDate: "",
      endDate: "",
    });
  };

  const handleDelete = async (id: string) => {
    const prev = entries;
    const removed = entries.find((e) => e.id === id);
    setEntries((p) => p.filter((e) => e.id !== id));
    if (editingId === id) cancelEdit();
    if (!demo && removed) {
      try {
        await guestService.deleteAccessRule(
          removed.tab === "device" ? "device" : "identifier",
          id,
          orgId ?? undefined,
        );
      } catch {
        setEntries(prev);
      }
    }
  };

  // ── helpers ───────────────────────────────────────────────────
  // One definition of "live", shared with the whitelist-only readiness
  // check. A rule with no end date carries no `expires_at` at all, which
  // the backend treats as permanent -- `new Date("") > new Date()` used to
  // read that as *expired*, so the strip called a permanent allow-list
  // "Expired" and, worse, the switch below would have called a fully
  // permanent list empty.
  const isActive = (end: string) => isRuleActive(end, Date.now());
  const Err = ({ k }: { k: keyof FormData }) =>
    errs[k] ? <p className="mt-1 text-xs text-destructive">{errs[k]}</p> : null;

  // Purely-derived counts (no new fetch) scoped to the tab currently being
  // viewed -- same read-only KPI-strip pattern used this session on
  // OpenHoursView/DebuggingView/ManageTeamsPage.
  const tabEntries = useMemo(() => entries.filter((e) => e.tab === tab), [entries, tab]);
  const activeCount = tabEntries.filter((e) => isActive(e.endDate)).length;
  const expiredCount = tabEntries.length - activeCount;

  return (
    <div className="space-y-6">
      {/* header -- matches the compact icon-badge + title + corner
       * illustration convention this same page's Blocked Guests tab and
       * PoliciesHub.tsx's own header already use, instead of the one-off
       * dark hero band this used to be. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <ShieldCheck className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Always Allowed</h1>
            <p className="text-sm text-muted-foreground">
              Allow specific numbers or devices to bypass the captive portal.
            </p>
          </div>
        </div>
        <TrustedAccessIllustration />
      </div>

      {/* Whitelist-only mode -- the switch that closes this property's WiFi
       * to everyone not on the list below. Placed above the list because
       * it changes what the entire list *means*: with it off the list is a
       * convenience, with it on the list is the door. */}
      <div className="rounded-2xl border-0 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                wlEnabled ? "bg-amber-500/15" : "bg-muted",
              )}
            >
              <ShieldAlert
                className={cn(
                  "h-4.5 w-4.5",
                  wlEnabled ? "text-amber-600" : "text-muted-foreground",
                )}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Only allow the guests on this list</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {wlEnabled
                  ? `On. Only the numbers and devices below get online at ${wlLocationName || "this property"}.`
                  : `Off. Every guest signs in on the WiFi login page and gets online — this is how ${wlLocationName || "this property"} works today.`}
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Turning this on does not hide your WiFi and drops nobody. Everyone still reaches
                your login page. People on this list sign in and get through; everyone else is
                refused on that page, in your words, and is never sent a verification code.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Property picker -- this setting is stored per property, so the
             * switch has to say which one it is about. */}
            {demo ? (
              <Select value={wlDemoUnit} onValueChange={setWlDemoUnit}>
                <SelectTrigger className="h-9 w-[180px]" aria-label="Property">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={wlLocationId} onValueChange={setWlLocationId}>
                <SelectTrigger className="h-9 w-[180px]" aria-label="Property">
                  <SelectValue placeholder="Choose a property" />
                </SelectTrigger>
                <SelectContent>
                  {(locations ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {wlLoading || wlSaving ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
            <Switch
              checked={wlEnabled}
              onCheckedChange={onSwitchChange}
              disabled={wlSaving || wlLoading || (!wlEnabled && !canEnable)}
              aria-label={`Only allow the guests on this list at ${wlLocationName || "this property"}`}
              data-testid="whitelist-only-switch"
            />
          </div>
        </div>

        {/* What the switch is about to do, counted from the list itself. */}
        <p className="mt-4 text-sm font-medium" data-testid="whitelist-only-summary">
          {whitelistOnlySummary(readiness, wlLocationName)}
        </p>

        {/* Why it cannot be turned on, and what to do about it. Each of
         * these is a way the mode fails silently and expensively. */}
        {!wlEnabled && wlBlockers.length > 0 && (
          <div className="mt-3 space-y-2" data-testid="whitelist-only-blockers">
            {wlBlockers.map((blocker) => {
              const { title, detail } = describeBlocker(blocker, wlLocationName);
              return (
                <div
                  key={blocker.kind}
                  className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                      {detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Once it is on, the first question is always "who did we turn
         * away?" -- because a mis-keyed list refuses everyone while
         * looking perfectly correct on screen. */}
        {wlEnabled && (
          <div
            className="mt-3 rounded-xl border bg-muted/40 p-3"
            data-testid="whitelist-only-denials"
          >
            <p className="text-sm font-medium">
              {wlDenials === null
                ? "Refused guests: not available right now"
                : `${wlDenials.capped ? `${wlDenials.count}+` : wlDenials.count} ${
                    wlDenials.count === 1 && !wlDenials.capped ? "guest was" : "guests were"
                  } refused here in the last 24 hours`}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Every refusal is recorded against this property. A number far higher than you expect
              usually means a list entry is stored in a form that cannot match anyone — check the
              entries below still show a country code.
            </p>
          </div>
        )}

        {wlError && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {wlError}
          </p>
        )}

        {/* The venue's own refusal copy. Never pre-filled -- the example
         * lives in the placeholder so it can be read and cannot be saved
         * by accident. */}
        <div className="mt-4 border-t pt-4">
          <Label htmlFor="wl-denied-message" className="text-sm">
            What a refused guest sees
          </Label>
          <Textarea
            id="wl-denied-message"
            value={wlMessage}
            rows={2}
            maxLength={500}
            placeholder="e.g. Ask the front desk to add your number to the guest WiFi list."
            onChange={(e) => {
              setWlMessage(e.target.value);
              setWlMessageDirty(true);
            }}
            className="mt-1.5"
            data-testid="whitelist-only-message"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Shown on your WiFi login page to anyone who is not on the list. Leave it empty and
              guests see the standard message instead.
            </p>
            {wlMessageDirty && (
              <Button
                type="button"
                size="sm"
                disabled={wlSaving || (!demo && !wlConfig)}
                onClick={() => void persistWhitelistOnly(wlEnabled, wlMessage)}
              >
                Save message
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation -- named against the property, because "Are you
       * sure?" does not tell an owner with four sites which one they are
       * about to close. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Refuse everyone not on this list at {wlLocationName || "this property"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{whitelistOnlySummary(readiness, wlLocationName)}</p>
                <p>
                  From the moment you save, a guest who is not on the list still reaches your WiFi
                  login page and is refused there. They are not sent a verification code and no
                  session starts for them.
                </p>
                <p>
                  This changes {wlLocationName || "this property"} only. Your other properties keep
                  working exactly as they do now, and you can switch this back off at any time.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wl-confirm" className="text-sm">
              Type <span className="font-semibold">{wlLocationName}</span> to confirm
            </Label>
            <Input
              id="wl-confirm"
              value={confirmText}
              autoComplete="off"
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={wlLocationName}
              data-testid="whitelist-only-confirm-input"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmMatches}
              data-testid="whitelist-only-confirm-action"
              onClick={(e) => {
                if (!confirmMatches) {
                  e.preventDefault();
                  return;
                }
                void persistWhitelistOnly(true, wlMessage);
              }}
            >
              Turn on for {wlLocationName}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KPI strip -- was missing entirely; a plain form-then-table page
       * with no at-a-glance summary read closer to a generic admin
       * allowlist screen. Purely derived from `entries`, same read-only
       * pattern as the KpiRow this session added to OpenHoursView/
       * DebuggingView/ManageTeamsPage. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border-0 bg-card p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Active</p>
            <p className="truncate text-lg font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border-0 bg-card p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Expired</p>
            <p className="truncate text-lg font-bold">{expiredCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border-0 bg-card p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            {tab === "number" ? (
              <Smartphone className="h-5 w-5 text-white" />
            ) : (
              <Laptop className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Total {tab === "number" ? "numbers" : "devices"}
            </p>
            <p className="truncate text-lg font-bold">{tabEntries.length}</p>
          </div>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* tab switcher */}
      <div className="inline-flex rounded-xl border bg-muted/50 p-1 max-sm:flex">
        <button
          onClick={() => {
            setTab("number");
            setErrs({});
            setPage(0);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-sm:flex-1 max-sm:justify-center",
            tab === "number"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Smartphone className="h-4 w-4" /> Allow a Number
        </button>
        <button
          onClick={() => {
            setTab("device");
            setErrs({});
            setPage(0);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-sm:flex-1 max-sm:justify-center",
            tab === "device"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Laptop className="h-4 w-4" /> Allow a Device
        </button>
      </div>

      {/* form card */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="rounded-xl border-0 bg-card text-card-foreground shadow-sm"
      >
        <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            {tab === "number" ? (
              <Smartphone className="h-3.5 w-3.5 text-white" />
            ) : (
              <Laptop className="h-3.5 w-3.5 text-white" />
            )}
          </span>
          <CardTitle className="text-sm">
            {tab === "number" ? "Allow a number" : "Allow a device"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Who's Allowed -- identity fields grouped together (was a flat
              6-field grid with no separation from the access-window dates
              below it). */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-1 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Who's Allowed</h3>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              {tab === "number"
                ? "The number that skips the portal, and who it belongs to."
                : "The device that skips the portal, and who it belongs to."}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Mobile / MAC */}
              {tab === "number" ? (
                <div className="space-y-1.5">
                  <Label>
                    Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select value={f.mobileCC} onValueChange={(v) => setField("mobileCC", v)}>
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={f.mobile}
                      onChange={(e) =>
                        setField("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                    />
                  </div>
                  <Err k="mobile" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* "Always Allowed" in the header, "MAC Address" on the
                    control -- the rename stopped at the title. The term
                    still belongs in the hint, because that is the exact
                    phrase the owner reads off the device's WiFi settings. */}
                  <Label>
                    Device address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="AA:BB:CC:DD:EE:FF"
                    value={f.mac}
                    onChange={(e) =>
                      setField(
                        "mac",
                        e.target.value
                          .toUpperCase()
                          .replace(/[^0-9A-F]/g, "")
                          .replace(/(.{2})(?!$)/g, "$1:")
                          .slice(0, 17),
                      )
                    }
                    className="font-mono"
                  />
                  <Err k="mac" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>
                  Location <span className="text-destructive">*</span>
                </Label>
                <Select value={f.businessUnit} onValueChange={(v) => setField("businessUnit", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  {tab === "number" ? "Name" : "Device label"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder={tab === "number" ? "Guest name" : "e.g. Office Printer"}
                  value={f.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
                <Err k="name" />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={f.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
                <Err k="email" />
              </div>
            </div>
          </div>

          {/* Access Window -- the two date fields are a distinct concept
              (when the bypass is active) from who it applies to above, so
              they get their own labeled section instead of blending into
              the same flat grid. */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Access Window</h3>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              When this guest stops needing to sign in, and when that ends.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Read-only, deliberately. An access rule has no start field
                on the backend at all -- only `expires_at` -- so a start
                date typed here was never sent, and reloading the page
                replaced it with the row's creation time. Rather than leave
                a required-looking control that quietly discards what you
                type, say what actually happens. */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Starts</Label>
                <Input value="As soon as you save" disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Scheduling a later start isn&rsquo;t supported yet.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>
                  End Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={f.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                />
                <Err k="endDate" />
              </div>
            </div>
          </div>

          <hr className="my-6 border-border" />
          <div className="flex justify-center gap-2">
            {editingId && (
              <Button type="button" variant="outline" size="lg" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="lg" className="px-8">
              {editingId ? "Save Changes" : tab === "number" ? "Allow Number" : "Allow Device"}
            </Button>
          </div>
        </CardContent>
      </form>

      {/* table card */}
      <div className="rounded-xl border-0 bg-card text-card-foreground shadow-sm">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
              <ShieldCheck className="h-3.5 w-3.5 text-white" />
            </span>
            <div>
              <CardTitle className="text-sm">
                Always Allowed {tab === "number" ? "Guests" : "Devices"}
              </CardTitle>
              {/* Not "for this location": listAccessRules takes an org id
                and no location filter, so this table is every allow rule
                in the account. Saying "this location" made a rule saved
                against another site look like it applied here. */}
              <p className="text-xs text-muted-foreground">
                Everything currently allowed across your account.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className={cn(inputCls, "w-48 py-1.5 pl-8")}
            />
          </div>
        </CardHeader>
        <CardContent className={paged.length > 0 ? "px-4 pb-4 pt-0" : "p-0"}>
          {paged.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nothing allowed yet"
              description="Fill the form above to let a trusted number or device skip the portal."
              action={{
                label: "Allow a number or device",
                onClick: () => formRef.current?.querySelector<HTMLInputElement>("input")?.focus(),
              }}
            />
          ) : (
            // Card grid instead of a data table -- a table-with-search-and-
            // pagination is the single most generic-looking "admin allowlist"
            // pattern there is (and reads closest to the competitor's own
            // screen for this exact feature). Same per-entry data as before,
            // just presented as a compact card (identity + masked MAC in the
            // header row, a status pill, location + the access window, edit/
            // delete actions) -- matches the card-list treatment this session
            // already gave ManageTeamsPage's "Your Teams".
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {paged.map((e) => (
                <div key={e.id} className="rounded-xl border-0 bg-muted/40 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {tab === "number" ? (
                          <Smartphone className="h-4 w-4" />
                        ) : (
                          <Laptop className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {e.tab === "device" ? maskMac(e.identifier) : e.identifier}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isActive(e.endDate)
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isActive(e.endDate) ? "bg-emerald-500" : "bg-slate-400",
                        )}
                      />
                      {isActive(e.endDate) ? "Active" : "Expired"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        Location
                      </p>
                      <p className="truncate text-foreground">{e.businessUnit || "—"}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        Access window
                      </p>
                      <p className="truncate text-foreground">
                        {fmtDT(e.startDate)} → {fmtDT(e.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1 border-t border-border/60 pt-2">
                    <button
                      type="button"
                      aria-label={`Edit ${e.name}`}
                      onClick={() => startEdit(e)}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      aria-label={`Delete ${e.name}`}
                      onClick={() => handleDelete(e.id)}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div
              className={cn(
                "flex items-center justify-between text-xs text-muted-foreground",
                paged.length > 0 ? "mt-4 border-t pt-3" : "border-t p-3",
              )}
            >
              <span>
                Showing {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(safePage + 1)}
                  className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}
