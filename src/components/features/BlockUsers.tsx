import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  HelpCircle,
  X,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RotateCcw,
  Undo2,
  Ban,
  Smartphone,
  Mail,
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
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import { resolveOrgId } from "@/services/customer.service";
import type { AnyAccessRule } from "@/types/guest";
import { maskMac } from "@/components/features/HeaderControls";
import { DEFAULT_DIAL_CODE, PHONE_COUNTRIES, normalizePhoneToE164 } from "@/lib/phone-e164";
import { blockOutcomeMessage } from "@/lib/block-outcome";

// `identifier` holds a phone number, an email address, or a MAC (see
// toBlockedUser below, which -- like guest_access's own rule tables --
// doesn't keep a separate identifier-kind column) -- format-detect which
// one it is (an "@" for email, MAC_SHAPE_RE for a device rule's MAC,
// otherwise a phone number) the same way this dashboard's other
// shape-dispatching displays already do (see UserReports.tsx's own
// `value.includes("@")` / MAC-regex dispatch). A MAC is masked (currently
// a no-op passthrough -- see maskMac's own docstring), the same PII
// posture applied to every other MAC display in the customer dashboard.
const MAC_SHAPE_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

// Which shape the "Block User" textarea's contents are parsed/validated
// as. A guest's login identifier (app.domains.guest.models.Guest
// .identifier, and the identical GuestAccessRule.identifier this page's
// blocklist rules key off) is already just as valid an email address as a
// phone number -- guests can authenticate via email OTP
// (GUEST_AUTH_METHOD_LABEL.otp_email) exactly as they can via SMS/WhatsApp
// OTP -- so blocking by email is a real, first-class operation here, not
// a cosmetic addition.
type Mode = "mobile" | "email";

interface BlockedUser {
  id: string;
  name: string | null;
  identifier: string;
  businessUnit: string;
  // The rule's own location, kept so the list can be scoped to the
  // location this page is actually showing -- listAccessRules takes an
  // org id and no location filter, so the fetch returns every blocklist
  // rule in the account. A rule with no location is organization-wide and
  // applies here too.
  // Optional: the demo seed and the demo-mode optimistic rows have no
  // real location id, and the demo branch of the filter matches by name.
  locationId?: string | null;
  blockedOn: string;
  status: "Blocked" | "Unblocked";
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
          className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-800"
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

type SortKey = "name" | "identifier" | "businessUnit" | "blockedOn";

// `locationName` resolves the rule's location_id against the caller's own
// locations list -- the rule carries an id, not a name. The Location
// column used to be hardcoded to "" and was therefore blank on every real
// row, in every case except the demo seed.
function toBlockedUser(r: AnyAccessRule, locationName = ""): BlockedUser {
  return {
    id: r.id,
    name: r.reason ?? null,
    identifier: r.kind === "device" ? r.macAddress : r.identifier,
    businessUnit: locationName,
    locationId: r.locationId ?? null,
    blockedOn: r.createdAt,
    status: r.isActive ? "Blocked" : "Unblocked",
  };
}

/**
 * Small header-accent illustration: a phone with a "blocked" glyph and a
 * signal line cut off by a barrier, same filled-flat-shape character
 * language as the other illustrations shipped this session. The "no
 * entry" badge is recolored from decorative fuchsia to the rose that
 * GuestBadges.tsx and OperationsFeatures.tsx already use everywhere else
 * in this product for "blocklist"/"blocked" -- so the illustration reads
 * as *this specific state* (blocked) rather than a generic accent color,
 * and matches the same rose now used on the status pill below and the
 * Blocked Guests tab in PoliciesHub.tsx. Kept compact, inline with the
 * header row -- this page's real content is a dense number-entry form + a
 * real blocked-users table, so personality lives in a small corner
 * accent, not a full hero. Purely decorative -- aria-hidden.
 */
function BlockedAccessIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 56"
      className="hidden h-14 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="30"
        y="6"
        width="24"
        height="40"
        rx="5"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.5"
      />
      <rect x="34" y="12" width="16" height="24" rx="1.5" fill="#1e1b4b" />
      <circle cx="42" cy="40" r="1.6" fill="#a78bfa" />
      <motion.path
        d="M22 26a20 20 0 0 1 8-8"
        stroke="#22d3ee"
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 5"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <circle cx="64" cy="20" r="12" fill="#1e1b4b" stroke="#fb7185" strokeWidth="2" />
        <path
          d="M58 14l12 12M70 14l-12 12"
          stroke="#fb7185"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  );
}

export default function BlockUsers({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations. Same real-vs-demo split as WhiteList.tsx's
  // units/realUnits.
  const { data: locations } = useCustomerLocations();
  const units = demo ? UNITS : (locations ?? []).map((l) => l.name);
  // An access rule carries a location_id, not a name -- resolve it the
  // same way WhiteList.tsx's withBusinessUnit does, so the Location column
  // shows something.
  // `useCallback`, not a plain function: the fetch effect below depends on
  // it, and a fresh identity every render would either re-fetch the whole
  // blocklist on every render or -- the shape this file would otherwise
  // have taken -- sit in the dependency array as an omission the linter
  // reports and the next reader assumes is deliberate.
  const nameForLocation = useCallback(
    (id: string | null | undefined) => locations?.find((l) => l.id === id)?.name ?? "",
    [locations],
  );
  // Fixed dates, not Date.now()-relative -- see WhiteList.tsx's SEED
  // comment for why a relative computation here hydration-mismatches.
  const [blocked, setBlocked] = useState<BlockedUser[]>(
    demo
      ? [
          {
            id: "b1",
            name: "Ravi Sharma",
            identifier: "+919876543210",
            businessUnit: "Mumbai HQ",
            blockedOn: "2026-07-20T10:00:00.000Z",
            status: "Blocked",
          },
          {
            id: "b2",
            name: null,
            identifier: "+919812345678",
            businessUnit: "Delhi Office",
            blockedOn: "2026-07-18T10:00:00.000Z",
            status: "Blocked",
          },
          {
            id: "b3",
            name: "Priya Kapoor",
            identifier: "priya.kapoor@example.com",
            businessUnit: "Mumbai HQ",
            blockedOn: "2026-07-22T10:00:00.000Z",
            status: "Blocked",
          },
          {
            id: "b4",
            name: "Amit Patel",
            identifier: "+919722233344",
            businessUnit: "Bangalore DC",
            blockedOn: "2026-07-13T10:00:00.000Z",
            status: "Unblocked",
          },
          {
            id: "b5",
            name: "Sana Khan",
            identifier: "sana.khan@example.com",
            businessUnit: "Chennai Office",
            blockedOn: "2026-07-21T10:00:00.000Z",
            status: "Blocked",
          },
          {
            id: "b6",
            name: "John Doe",
            identifier: "+919655566677",
            businessUnit: "Delhi Office",
            blockedOn: "2026-07-16T10:00:00.000Z",
            status: "Blocked",
          },
        ]
      : [],
  );
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        // /me/organizations instead of the platform-wide GET /organizations
        // -- see customer.service.ts's resolveOrgId doc comment.
        const org = await resolveOrgId();
        setOrgId(org);
        const rules = await guestService.listAccessRules(org);
        setBlocked(
          rules
            .filter((r) => r.ruleType === "blocklist")
            .map((r) => toBlockedUser(r, nameForLocation(r.locationId))),
        );
      } catch {
        // Leave blocked empty -- the "no blocked numbers" state is accurate.
      }
    })();
  }, [demo, locationId, nameForLocation]);

  const [mode, setMode] = useState<Mode>("mobile");
  const [textarea, setTextarea] = useState("");
  // Which country a bare local number belongs to. This screen had no such
  // control at all -- it stored whatever digits were typed behind a bare
  // "+", so an owner entering the ten digits they know produced a rule
  // ("+9876543210") that could never match the "+919876543210" their
  // guest signs in with. Defaults to India, which is who this product
  // sells to; an explicitly typed "+<code>" still wins over it (see
  // normalizePhoneToE164).
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [bu, setBu] = useState(demo ? "Mumbai HQ" : "");

  // The textarea's contents mean something different in each mode (a raw
  // phone number vs. a raw email address) -- clear it on switch rather
  // than re-parsing stale input under the new mode's rules, the same
  // "switching context resets the in-progress input" call WhiteList.tsx's
  // own tab switcher makes for its errors/page state.
  const handleModeChange = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setTextarea("");
  };

  // "1 number" / "3 numbers" vs. "1 email address" / "3 email addresses",
  // reused everywhere a count needs the mode-appropriate noun (the ready
  // count, the toast, the primary button, the confirm modal).
  const identifierNoun = (n: number) =>
    mode === "email"
      ? n === 1
        ? "email address"
        : "email addresses"
      : n === 1
        ? "number"
        : "numbers";

  // Default "Applies to" to the location this page is already scoped to,
  // once its real name is known (mirrors WhiteList.tsx's equivalent effect).
  useEffect(() => {
    if (!demo && !bu && locationId && locations) {
      const match = locations.find((l) => l.id === locationId);
      if (match) setBu(match.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locations, locationId]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [toast, setToast] = useState<string | null>(null);
  const [undoPayload, setUndoPayload] = useState<BlockedUser[] | null>(null);
  const undoRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("blockedOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ── parsing ───────────────────────────────────────────────────
  //
  // ONE pass, not two. The buckets (`valid`/`invalid`/...) and the chip
  // row used to be computed by two near-identical loops that each had
  // their own copy of the validity rule -- which is how the chip could
  // say one thing and the submit another, and how a fix to one of them
  // silently missed the other. They are the same question asked twice, so
  // they are answered once and the chip row is derived below.
  //
  // De-duplication is by the CANONICAL value, not by the typed text: a
  // list holding both "9876543210" and "+919876543210" is one number
  // written two ways, and creating two rules for it is wrong even though
  // the strings differ.
  const parsed = useMemo(() => {
    const raw = textarea
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    // What is already on the blocklist, as stored. Compared against the
    // canonical form of what was typed, so "9876543210" is recognised as
    // the "+919876543210" that is already there.
    //
    // Deliberately NOT re-normalised: a legacy row written by the old
    // `"+" + digits` code ("+9876543210") does not block anybody, so
    // telling the owner their number "is already blocked" because such a
    // row exists would repeat the original lie. Those rows fall through
    // and a correct rule gets written alongside them.
    const blockedIdentifiers = new Set(
      blocked.filter((b) => b.status === "Blocked").map((b) => b.identifier),
    );

    const items: {
      raw: string;
      canonical: string | null;
      status: "valid" | "invalid" | "blocked";
      message?: string;
    }[] = [];
    const valid: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];
    const alreadyBlocked: string[] = [];
    const seen = new Set<string>();

    for (const entry of raw) {
      // A phone number is normalised to the E.164 identifier the guest
      // actually signs in with (see src/lib/phone-e164.ts). An email
      // address carries meaningful punctuation ("@", ".") and is the
      // identifier verbatim, so it is only ever trimmed.
      const result =
        mode === "mobile"
          ? normalizePhoneToE164(entry, dialCode)
          : EMAIL_RE.test(entry)
            ? ({ ok: true, e164: entry } as const)
            : ({
                ok: false,
                message: "Not an email address — expected something like guest@example.com.",
              } as const);

      if (!result.ok) {
        // Dedupe invalid text too, so a list repeating the same typo
        // doesn't produce the same complaint twice.
        if (seen.has(entry)) {
          duplicates.push(entry);
          continue;
        }
        seen.add(entry);
        invalid.push(entry);
        items.push({ raw: entry, canonical: null, status: "invalid", message: result.message });
        continue;
      }

      const canonical = result.e164;
      if (seen.has(canonical)) {
        duplicates.push(entry);
        continue;
      }
      seen.add(canonical);

      if (blockedIdentifiers.has(canonical)) {
        alreadyBlocked.push(canonical);
        items.push({ raw: entry, canonical, status: "blocked" });
        continue;
      }
      valid.push(canonical);
      items.push({ raw: entry, canonical, status: "valid" });
    }
    return { items, valid, invalid, duplicates, alreadyBlocked, total: raw.length };
  }, [textarea, blocked, mode, dialCode]);

  // The chip row is the same pass, presented: the canonical value for
  // anything we understood (so the owner SEES "+919876543210" before
  // committing to it, rather than discovering the stored shape later),
  // and the text they typed for anything we did not.
  const chipNumbers = parsed.items;

  const removeChip = (raw: string) => {
    const parts = textarea.split(/[,;\n]/);
    const idx = parts.findIndex((p) => p.trim() === raw.trim());
    if (idx >= 0) {
      parts.splice(idx, 1);
      setTextarea(parts.join(", "));
    }
  };

  // ── sorting ───────────────────────────────────────────────────
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;
    return (
      <TableHead
        className="cursor-pointer select-none text-xs font-medium"
        onClick={() => toggleSort(k)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className="inline-flex items-center gap-1">
          {label} <Icon className={`h-3 w-3 ${active ? "text-indigo-500" : "text-slate-300"}`} />
        </span>
      </TableHead>
    );
  };

  // ── filtered & sorted ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    // Scoped to the location this page is showing. The old comment here
    // claimed "this page is already scoped to one location via its own
    // locationId prop" -- it is not: listAccessRules takes an org id and
    // no location filter, so a multi-site customer was shown every other
    // site's blocks as if they were this site's. Demo still matches by
    // name (its seed has no ids); real rows match by location id, and a
    // rule with no location at all is organization-wide, so it belongs in
    // every location's list.
    const items = blocked.filter(
      (b) =>
        (demo
          ? b.businessUnit === bu
          : !locationId || b.locationId === null || b.locationId === locationId) &&
        (!q ||
          b.name?.toLowerCase().includes(q) ||
          b.identifier.toLowerCase().includes(q) ||
          b.businessUnit.toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q)),
    );
    items.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [blocked, bu, demo, locationId, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // ── block ─────────────────────────────────────────────────────
  const handleBlock = async () => {
    const now = new Date().toISOString();
    if (demo) {
      const newBlocked = parsed.valid.map((m) => ({
        id: `b${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: null,
        identifier: m,
        businessUnit: bu,
        blockedOn: now,
        status: "Blocked" as const,
      }));
      setUndoPayload(newBlocked);
      setBlocked((prev) => [...newBlocked, ...prev]);
      setTextarea("");
      setPage(0);
      setShowModal(false);
      setToast(`${newBlocked.length} ${identifierNoun(newBlocked.length)} blocked.`);
      if (undoRef.current) clearTimeout(undoRef.current);
      undoRef.current = setTimeout(() => setUndoPayload(null), 6000);
      setTimeout(() => setToast(null), 6500);
      return;
    }
    if (!orgId) {
      setToast("No organization found for this session.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    try {
      const created = await Promise.all(
        parsed.valid.map((m) =>
          guestService.createAccessRule({
            kind: "identifier",
            organizationId: orgId,
            locationId,
            identifier: m,
            ruleType: "blocklist",
          }),
        ),
      );
      const newBlocked = created.map((r) => toBlockedUser(r, nameForLocation(r.locationId)));
      setBlocked((prev) => [...newBlocked, ...prev]);
      setTextarea("");
      setPage(0);
      setShowModal(false);
      setToast(blockOutcomeMessage(created, identifierNoun));
      setTimeout(() => setToast(null), 6500);
    } catch {
      setToast("Could not block — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  // The primary "Block N number(s)" button used to be hard-`disabled` any
  // time parsed.valid was empty -- which covers 4 different situations
  // (nothing typed, invalid format, duplicates, already-blocked). A native
  // `disabled` button suppresses the click event entirely, so in 3 of
  // those 4 cases (anything typed at all) the click was a true dead end:
  // no toast, no request, nothing -- indistinguishable from a broken
  // button. Now the button is only really disabled when the box is empty;
  // otherwise a click with zero valid numbers explains why instead of
  // silently doing nothing.
  const handlePrimaryClick = () => {
    if (parsed.valid.length > 0) {
      setShowModal(true);
      return;
    }
    let msg = "Nothing to block.";
    if (parsed.alreadyBlocked.length > 0 && parsed.invalid.length === 0) {
      msg =
        parsed.alreadyBlocked.length === 1
          ? `That ${identifierNoun(1)} is already blocked.`
          : `Those ${identifierNoun(2)} are already blocked.`;
    } else if (parsed.invalid.length > 0) {
      // Say what is wrong with the first thing we could not read, rather
      // than a generic "check the formatting" -- normalizePhoneToE164
      // already distinguishes "too short" from "add a country code", and
      // those need different actions from the owner.
      const first = parsed.items.find((i) => i.status === "invalid");
      msg = first?.message ?? "Nothing to block.";
    }
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUndo = () => {
    if (undoPayload) {
      const ids = new Set(undoPayload.map((u) => u.id));
      setBlocked((prev) => prev.filter((b) => !ids.has(b.id)));
      setUndoPayload(null);
      setToast("Undone.");
      if (undoRef.current) clearTimeout(undoRef.current);
      setTimeout(() => setToast(null), 2500);
    }
  };

  // ── unblock / delete ──────────────────────────────────────────
  const toggleStatus = async (id: string) => {
    setBlocked((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: b.status === "Blocked" ? "Unblocked" : "Blocked" } : b,
      ),
    );
    if (demo) return;
    const row = blocked.find((b) => b.id === id);
    if (!row) return;
    try {
      if (row.status === "Blocked") {
        await guestService.deactivateAccessRule("identifier", id, orgId ?? undefined);
      } else if (orgId) {
        const created = await guestService.createAccessRule({
          kind: "identifier",
          organizationId: orgId,
          locationId,
          identifier: row.identifier,
          ruleType: "blocklist",
        });
        setBlocked((prev) =>
          prev.map((b) =>
            b.id === id ? toBlockedUser(created, nameForLocation(created.locationId)) : b,
          ),
        );
      }
    } catch {
      setToast("Could not update on the server.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleDelete = (id: string) => {
    if (confirmingId === id) {
      const prev = blocked;
      setBlocked((p) => p.filter((b) => b.id !== id));
      setConfirmingId(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (!demo) {
        guestService.deleteAccessRule("identifier", id, orgId ?? undefined).catch(() => {
          setBlocked(prev);
          setToast("Could not delete on the server.");
          setTimeout(() => setToast(null), 2500);
        });
      }
    } else {
      setConfirmingId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
    }
  };

  const fmtDT = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          <span>{toast}</span>
          {undoPayload && (
            <button
              onClick={handleUndo}
              className="font-medium text-indigo-400 underline hover:text-indigo-300 dark:text-indigo-600"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => {
            setShowModal(false);
            triggerRef.current?.focus();
          }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-modal-title"
          >
            <h3
              id="block-modal-title"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
              tabIndex={-1}
            >
              Block {parsed.valid.length} {identifierNoun(parsed.valid.length)}?
            </h3>
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
              {parsed.valid.map((n) => (
                <p key={n} className="font-mono text-sm text-slate-600 dark:text-slate-300">
                  {n}
                </p>
              ))}
            </div>
            {/* "will end" was a promise the platform cannot keep on its
              own -- ending a live session means reaching the venue's
              router, which can fail. The toast afterwards says which of
              the two actually happened; this line no longer pre-empts it. */}
            <p className="mt-3 text-sm text-slate-500">
              They will not be able to sign in again, and we will try to end any session they have
              right now.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  triggerRef.current?.focus();
                }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Block {mode === "email" ? "emails" : "numbers"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Ban className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Blocked Guests</h1>
            <p className="text-sm text-muted-foreground">
              Cut off a guest's access to your network immediately.
            </p>
          </div>
        </div>
        <BlockedAccessIllustration />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <CardTitle className="text-sm">Block User</CardTitle>
          <div>
            <label
              htmlFor="bu-select"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Applies to
            </label>
            <select
              id="bu-select"
              value={bu}
              onChange={(e) => {
                setBu(e.target.value);
                setPage(0);
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mode switcher: same pill-tab pattern WhiteList.tsx's own
            number/device tab switcher uses, scoped down to sit inline
            above one shared textarea instead of swapping full forms --
            the two modes only ever differ in how the textarea's contents
            are parsed/validated/submitted (a mobile number or an email
            address, both equally valid GuestAccessRule.identifier values -
            see this file's Mode type doc comment). */}
          <div
            role="tablist"
            aria-label="Block by"
            className="mb-4 inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "mobile"}
              onClick={() => handleModeChange("mobile")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "mobile"
                  ? "bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile number
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "email"}
              onClick={() => handleModeChange("email")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "email"
                  ? "bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              <Mail className="h-3.5 w-3.5" /> Email address
            </button>
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
              <label
                htmlFor="block-ta"
                className="block text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                {mode === "email" ? "Email addresses" : "Mobile numbers"}{" "}
                <span className="text-indigo-500">*</span>
              </label>
              {/* The country this screen never had. Access Rules has
                offered one for as long as it has had a mobile field; this
                one silently assumed the digits it was given were already
                international, which is the whole defect. Native <select>
                to match the "Applies to" control right above it. */}
              {mode === "mobile" && (
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="block-cc"
                    className="text-xs font-medium text-slate-500 dark:text-slate-400"
                  >
                    Country
                  </label>
                  <select
                    id="block-cc"
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <textarea
              id="block-ta"
              rows={6}
              placeholder={
                mode === "email"
                  ? "guest1@example.com, guest2@example.com"
                  : "9876543210, +919812345678"
              }
              value={textarea}
              onChange={(e) => setTextarea(e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {/* Persistent caption instead of a click-to-reveal tooltip -- same
              consistency fix just applied to Guest WiFi Limits: the format
              hint shouldn't require a discovery click. */}
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {mode === "email"
                ? "Paste one or more email addresses separated by commas, e.g. guest@example.com."
                : `Paste one or more numbers separated by commas. Local numbers get ${dialCode}; a number that already starts with its own country code (+441632960961) keeps it.`}
            </p>
          </div>

          <div aria-live="polite" className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {parsed.valid.length} {identifierNoun(parsed.valid.length)} ready
            </span>
            {parsed.duplicates.length > 0 && (
              <span className="text-slate-400">· {parsed.duplicates.length} duplicate removed</span>
            )}
            {parsed.invalid.length > 0 && (
              <span className="text-indigo-500">· {parsed.invalid.length} invalid</span>
            )}
            {parsed.alreadyBlocked.length > 0 && (
              <span className="text-slate-400">
                · {parsed.alreadyBlocked.length} already blocked
              </span>
            )}
          </div>

          {chipNumbers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chipNumbers.map((c, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    c.status === "valid"
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      : c.status === "blocked"
                        ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400"
                  }`}
                  title={
                    c.status === "invalid"
                      ? (c.message ?? "Invalid format")
                      : c.status === "blocked"
                        ? "Already blocked"
                        : // The chip shows the identifier that will be
                          // stored, so a number typed as bare digits is
                          // visibly resolved before it is committed.
                          `Will be blocked as ${c.canonical}`
                  }
                >
                  {/* The canonical value for anything understood, the raw
                    text for anything not -- echoing a typo back verbatim
                    is what lets the owner spot it. */}
                  {c.canonical ?? c.raw}
                  {c.status !== "blocked" && (
                    <button
                      onClick={() => removeChip(c.raw)}
                      aria-label={`Remove ${c.canonical ?? c.raw}`}
                      className="inline-flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <hr className="my-5 border-slate-100 dark:border-slate-600" />
          {/* Immediate-effect notice -- same contextual-line pattern just
            applied to Guest WiFi Limits' save warning, replacing a
            persistent amber block with a slim line right above the
            button it actually concerns. */}
          <div className="flex flex-col items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              Takes effect immediately; we also try to end any session these guests have now.
              <Tooltip text="Blocking a number or email stops that guest signing in again until unblocked, and tries to end the session they are in right now. Ending a live session needs the venue's router, so the confirmation afterwards tells you whether it actually happened." />
            </p>
            <button
              ref={triggerRef}
              disabled={textarea.trim() === ""}
              onClick={handlePrimaryClick}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              Block{" "}
              {parsed.valid.length > 0
                ? `${parsed.valid.length} ${identifierNoun(parsed.valid.length)}`
                : mode === "email"
                  ? "email addresses"
                  : "numbers"}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm">Blocked Users</CardTitle>
            <p className="text-xs text-muted-foreground">
              Everyone currently blocked at this location.
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
              icon={Ban}
              title="Nobody is blocked"
              description="Paste a number or email above to block one -- it takes effect immediately."
              action={{
                label: mode === "email" ? "Block an email" : "Block a number",
                onClick: () => document.getElementById("block-ta")?.focus(),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <SortHeader k="name" label="Name" />
                    <SortHeader k="identifier" label="Identifier" />
                    <SortHeader k="businessUnit" label="Location" />
                    <SortHeader k="blockedOn" label="Blocked On" />
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-right text-xs font-medium">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((b) => (
                    <TableRow key={b.id} className="border-b">
                      <TableCell className="font-medium">
                        {b.name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {/* A small type glyph so a mixed mobile/email list
                          stays scannable at a glance -- same "shape tells
                          you the kind" dispatch this file's own top-of-file
                          comment (and UserReports.tsx's identical
                          value.includes("@") check) already establish. */}
                        <span className="inline-flex items-center gap-1.5">
                          {b.identifier.includes("@") ? (
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                          ) : (
                            <Smartphone
                              className="h-3 w-3 shrink-0 text-slate-400"
                              aria-hidden="true"
                            />
                          )}
                          {MAC_SHAPE_RE.test(b.identifier) ? maskMac(b.identifier) : b.identifier}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{b.businessUnit}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {fmtDT(b.blockedOn)}
                      </TableCell>
                      <TableCell>
                        {/* Was an indigo pill for "Blocked" -- indigo is this
                         * page's own brand/action color (buttons, focus
                         * rings), so a "Blocked" row read as neutral instead
                         * of restrictive. Switched to the same rose dot+label
                         * WhiteList.tsx uses for its own "Active" state
                         * (mirrored, not copied verbatim) and GuestBadges.tsx
                         * already uses for "blocklist" everywhere else. */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium",
                            b.status === "Blocked"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              b.status === "Blocked" ? "bg-rose-500" : "bg-slate-400",
                            )}
                          />
                          {b.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          aria-label={
                            b.status === "Blocked"
                              ? `Unblock ${b.identifier}`
                              : `Block ${b.identifier}`
                          }
                          onClick={() => toggleStatus(b.id)}
                          className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-700"
                        >
                          {b.status === "Blocked" ? "Unblock" : "Block again"}
                        </button>
                        <button
                          aria-label={
                            confirmingId === b.id ? "Confirm delete" : `Delete ${b.identifier}`
                          }
                          onClick={() => handleDelete(b.id)}
                          className={`ml-1 inline-flex items-center justify-center rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${confirmingId === b.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-red-500 dark:hover:text-red-400"}`}
                        >
                          {confirmingId === b.id ? (
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
