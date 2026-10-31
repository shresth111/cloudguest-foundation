/**
 * Customer-dashboard feature views redesigned from the legacy BhaiFi
 * Cloud App screens (Business Hours, Hotspot Settings, Debugging Tools,
 * RaaS, MAC Auth, Port Forwarding, DHCP, VLANs, VOIP, ISP Routing/Details,
 * Top Up, Alerts, Admin Logs). All token-driven so they
 * pick up the Aurora Teal identity automatically. Mock data only -- these
 * are the seam a per-location backend call replaces.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  Activity,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  Network,
  Plus,
  RadioTower,
  Router,
  Shield,
  ShieldAlert,
  Signal,
  Terminal,
  Ticket,
  Trash2,
  Wifi,
  XCircle,
  Server,
  History,
  ScrollText,
  Fingerprint,
  KeyRound,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { StatTone } from "@/components/ui-ext/StatCard";
import { NumberedPagination } from "@/components/ui-ext/NumberedPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useCustomerFeatureData,
  useAdminLogsDashboardLogins,
  useAdminLogsRouterEvents,
  useAdminLogsAccountActivity,
} from "@/hooks/useCustomerDashboard";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { macAuthorizationService } from "@/services/mac-authorization.service";
import {
  businessHoursService,
  type BusinessHoursDay,
  type BusinessHoursSchedule,
  type BusinessHoursWeekday,
} from "@/services/business-hours.service";
import {
  normalizeOpenHoursDraft,
  openHoursDraftsEqual,
  openHoursOrDefault,
  openHoursEveryDay,
  validateOpenHoursSchedule,
  type OpenHoursDraft,
} from "@/lib/open-hours-draft";
import { DhcpManagement } from "@/components/network/DhcpManagement";
import { VlanManagement } from "@/components/network/VlanManagement";
import { PortForwardingManagement } from "@/components/network/PortForwardingManagement";
import { HotspotManagement } from "@/components/network/HotspotManagement";
import { QosManagement } from "@/components/network/QosManagement";
import { api } from "@/services/api";
import type { AppError } from "@/services/api";
import { cn } from "@/lib/utils";
import { getCustomerLoginRole } from "@/lib/customerNav";
import { normalizeMac } from "@/lib/device-presentation";
import { FixAProblem } from "@/components/customer/FixAProblem";
import type { PageScope } from "@/components/customer/console";

/* ---------- shared building blocks ---------- */

function FeatureHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Optional icon-badge (gradient indigo/violet box, established this
   * session on Dashboard's chart headers) shown left of the title. Omitted
   * by default so existing callers outside this polish pass render
   * unchanged. */
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
            <Icon className="h-[18px] w-[18px] text-white" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// `ToggleRow` used to live here: a switch bound to nothing but its own
// `useState`, which is how the old Notifications screen managed to look
// finished while persisting nothing. That caller is gone too (the screen
// was rewritten against the real notification-channel APIs, then removed
// from the customer dashboard along with its nav entry). The unrelated
// `ToggleRow` in components/settings/SectionCard.tsx is a different
// component and is still in use.

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  online: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  enabled: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  degraded: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  pending: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  disabled: "text-muted-foreground bg-muted",
  offline: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
  blocked: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "text-muted-foreground bg-muted",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const TONE_ICON_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
  info: "text-sky-500",
};

// Soft tone-tinted badge background so a KpiRow tile's own status (danger/
// warning/success/etc.) still reads through the icon badge, instead of a
// flat neutral circle that lost the tone's meaning -- while "primary"/
// "default" fall back to the brand gradient used everywhere else.
const TONE_ICON_BADGE: Record<StatTone, string> = {
  default: "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]",
  primary: "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]",
  success: "bg-emerald-500/15",
  warning: "bg-amber-500/15",
  danger: "bg-rose-500/15",
  info: "bg-sky-500/15",
};
const TONE_ICON_ON_BADGE: Record<StatTone, string> = {
  default: "text-white",
  primary: "text-white",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
  info: "text-sky-500",
};

function KpiRow({
  items,
}: {
  items: {
    label: string;
    value: string;
    tone?: StatTone;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((k) => {
        const tone = k.tone ?? "default";
        return (
          <div
            key={k.label}
            className="flex items-center gap-3 rounded-2xl border-0 bg-card p-4 shadow-sm"
          >
            {k.icon && (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  TONE_ICON_BADGE[tone],
                )}
              >
                <k.icon className={cn("h-5 w-5", TONE_ICON_ON_BADGE[tone])} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">{k.label}</p>
              <p className="truncate text-lg font-bold">{k.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Alerts ----------
 * Moved to components/features/AlertsView.tsx when it migrated onto the
 * console primitives (design-review §8, batch 1), so the console-styles
 * guard can hold it to the tokens while the rest of this module waits its
 * turn. Re-exported here because the feature switch lazy-loads it by name
 * from this module. */
export { AlertsView } from "@/components/features/AlertsView";

/* ---------- Open Hours (was "Business Hours") ----------
 * Renamed + visually redesigned only -- the old name/layout read too close
 * to a competitor's equivalent feature. The id ("business-hours"), route,
 * businessHoursService contract, and every field below (BH_DAYS,
 * BusinessHoursSchedule, etc.) are all untouched on purpose.
 *
 * Real, guest-facing effect (backend/app/domains/captive_portal --
 * business_hours_enabled/timezone/schedule/closed_message columns,
 * GET /captive-portal/resolve computes is_open_now live from these on
 * every real guest portal load): previously the "Apply" button only
 * showed a toast, nothing was ever persisted or read back on reload --
 * bug report "on/off karne par captive portal 'business is closed'
 * jaisa kuch nahi dikhata tha". Now a real save (PUT /captive-portal-
 * configs/{id}) and a real fetch on load, via businessHoursService.
 *
 * Edits are a local draft: nothing is sent until the explicit Save button
 * (enabled only while the draft differs from the saved baseline and passes
 * the same checks the backend runs -- see src/lib/open-hours-draft.ts).
 * Discard restores the baseline.
 */
const BH_DAYS: { key: BusinessHoursWeekday; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const DEMO_BH_SCHEDULE: BusinessHoursSchedule = Object.fromEntries(
  BH_DAYS.map((d, i) => [
    d.key,
    i < 6 ? { open: true, start: "09:00", end: "21:00" } : { open: false },
  ]),
) as BusinessHoursSchedule;

/**
 * Pickable enforcement zones for the Open Hours schedule. Mirrors the same
 * coarse list LocationWizard offers a new location (see that file's
 * TIMEZONES) plus the handful of zones an India-first captive fleet most
 * commonly needs. The default is deliberately *not* UTC: a venue that never
 * touches this select used to stay on the DB column default ("UTC") and
 * enforce 9am-9pm as UTC even when the venue was 9:30am IST -- the
 * "guests got in after closing" report this screen's timezone handling
 * was rebuilt for. A brand-new config seeds the venue's own zone via
 * `timezone` state below instead of this list's first entry.
 */
const BUSINESS_HOURS_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

/** Sun/moon motif (not a clock face) so the header art reads as "when
 * guests can get online", not a generic settings-clock -- and so it pairs
 * visually with the Sun/Moon icons this view's own status tile uses, and
 * with the Moon already on the guest-facing closed screen
 * (src/routes/portal.closed.tsx). */
function OpenHoursIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <circle cx="30" cy="26" r="13" fill="#2e2a5c" stroke="#f0abfc" strokeWidth="1.6" />
      <motion.circle
        cx="30"
        cy="26"
        r="6.5"
        fill="#fcd34d"
        animate={
          shouldReduceMotion ? { opacity: 0.95 } : { opacity: [0.75, 1, 0.75], scale: [1, 1.08, 1] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return (
          <motion.line
            key={i}
            x1={30 + 10 * Math.cos(a)}
            y1={26 + 10 * Math.sin(a)}
            x2={30 + 15.5 * Math.cos(a)}
            y2={26 + 15.5 * Math.sin(a)}
            stroke="#fcd34d"
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.05 * i, ease: "easeOut" }}
          />
        );
      })}
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <path
          d="M62 8a10 10 0 1 0 9 14.5A8 8 0 0 1 62 8z"
          fill="#1e1b4b"
          stroke="#22d3ee"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}

function MacAuthIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="8"
        y="10"
        width="26"
        height="32"
        rx="4"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.6"
      />
      <rect x="12" y="15" width="18" height="12" rx="1.5" fill="#1e1b4b" />
      <circle cx="21" cy="34" r="1.4" fill="#a78bfa" />
      <motion.path
        d="M40 26h14"
        stroke="#22d3ee"
        strokeOpacity="0.6"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1 4"
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
        <path
          d="M68 8l14 5v9c0 10-6 16-14 19-8-3-14-9-14-19v-9z"
          fill="#1e1b4b"
          stroke="#f0abfc"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M62 22l4 4 8-8"
          stroke="#f0abfc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}

function DebuggingIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="6"
        y="8"
        width="50"
        height="32"
        rx="4"
        fill="#1e1b4b"
        stroke="#a78bfa"
        strokeWidth="1.6"
      />
      <rect x="6" y="8" width="50" height="32" rx="4" fill="url(#dbg-scan)" fillOpacity="0.08" />
      <defs>
        <linearGradient id="dbg-scan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <motion.path
        d="M12 28h6l4-10 5 18 4-14 3 6h22"
        stroke="url(#dbg-scan)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <circle cx="70" cy="24" r="10" fill="#2e2a5c" stroke="#22d3ee" strokeWidth="1.8" />
        <path
          d="M66 24h3l1.5-4 2 8 1.5-4h2"
          stroke="#22d3ee"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>
    </svg>
  );
}

export function OpenHoursView({ locationId }: { locationId?: string } = {}) {
  const { t } = useTranslation("openHours", { i18n });
  // `demo` itself (a plain isDemo() read, not the SSR-safe useIsDemo()
  // hook) is fine to use in effects/handlers below -- those only ever run
  // client-side. What isn't safe is seeding useState's *initial* value
  // from it directly: isDemo() reads localStorage synchronously, so it
  // resolves differently during the server render pass (no window ->
  // false) than during the client's very first hydration pass (real
  // token -> true), and React throws a real "Hydration failed" the
  // instant that changes a day's Switch/Input's checked/value/disabled
  // attributes (exactly what happened here). Both `schedule` and
  // `loading` below now start at the same neutral value on server and
  // client; the effect fills in the demo seed (or the real fetch)
  // strictly post-mount, which is a normal state update, not a
  // hydration diff.
  const demo = isDemo();
  const [configId, setConfigId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [schedule, setSchedule] = useState<BusinessHoursSchedule>({});
  const [closedMessage, setClosedMessage] = useState(
    "We're currently closed. Please check back during business hours.",
  );
  const [isOpenNow, setIsOpenNow] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Every control on this page edits a local draft only; nothing reaches
  // the backend until Save. `saved` is the baseline the draft is compared
  // against (what the server last confirmed), so Save is enabled only
  // while there is a real difference and Discard can restore it.
  const [saved, setSaved] = useState<OpenHoursDraft | null>(null);
  // A load that failed for any reason other than "this location has no
  // portal config yet" (404) leaves the page without the real baseline.
  // Saving from there would PUT defaults over the venue's real schedule
  // (or POST a second config), so Save stays off and the error is shown.
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyDraft = (d: OpenHoursDraft) => {
    setEnabled(d.enabled);
    setTimezone(d.timezone);
    setSchedule(d.schedule);
    setClosedMessage(d.closedMessage);
  };

  useEffect(() => {
    if (demo) {
      setSchedule(DEMO_BH_SCHEDULE);
      setSaved(
        normalizeOpenHoursDraft({ enabled, timezone, schedule: DEMO_BH_SCHEDULE, closedMessage }),
      );
      setLoading(false);
      return;
    }
    if (!locationId) return;
    let cancelled = false;
    setLoadError(null);
    businessHoursService
      .get(locationId)
      .then((cfg) => {
        if (cancelled) return;
        // The venue's own stored timezone -- the one the schedule is
        // actually evaluated in -- not the admin's browser zone. Saving
        // the browser zone here used to silently re-anchor an already
        // configured schedule (an IST venue edited from a UTC browser
        // shifted every "closed" window by the offset, which is how
        // guests got through after hours).
        const { schedule: loadedSchedule, enabledDefault: defaulted } = openHoursOrDefault(
          cfg.schedule,
        );
        const loaded = normalizeOpenHoursDraft({
          // A venue whose stored schedule is empty has never configured this
          // screen. It is not "closed every day" -- it is on the 24/7 default
          // the backend has been applying all along (`is_open_now` returns
          // True the moment enforcement is off). Showing the real state is
          // also what makes the switch it depends on land in the position an
          // operator expects, so editing the day grid below actually bites.
          // See openHoursOrDefault's own note.
          enabled: defaulted ? true : cfg.enabled,
          timezone: cfg.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          schedule: loadedSchedule,
          closedMessage: cfg.closedMessage ?? closedMessage,
        });
        setConfigId(cfg.configId);
        applyDraft(loaded);
        setSaved(loaded);
        setIsOpenNow(cfg.isOpenNow);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as AppError).status === 404) {
          // No config for this location yet: the defaults on screen are
          // the honest baseline, and Save creates the config. That baseline
          // is the 24/7 default, not seven "Closed all day" rows under an
          // Off switch -- an empty schedule and a disabled switch are what a
          // venue with nothing configured actually has, and the backend has
          // always read that pair as "open 24/7" (`is_open_now`). See
          // openHoursOrDefault's own note.
          const idle = normalizeOpenHoursDraft({
            enabled: true,
            timezone,
            schedule: openHoursEveryDay(),
            closedMessage,
          });
          applyDraft(idle);
          setSaved(idle);
          return;
        }
        const message = (err as AppError).message || t("loadFailed", "Could not load open hours.");
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locationId]);

  const dayState = (key: BusinessHoursWeekday): BusinessHoursDay =>
    schedule[key] ?? { open: false };

  const setDay = (key: BusinessHoursWeekday, patch: Partial<BusinessHoursDay>) =>
    setSchedule((prev) => ({ ...prev, [key]: { ...dayState(key), ...patch } }));

  const draft = normalizeOpenHoursDraft({ enabled, timezone, schedule, closedMessage });
  const dirty = saved !== null && !openHoursDraftsEqual(draft, saved);
  const dayErrors = validateOpenHoursSchedule(draft.schedule);
  const hasErrors = Object.keys(dayErrors).length > 0;
  const canSave = dirty && !hasErrors && !saving && !loading && loadError === null;

  function handleDiscard() {
    if (saved) applyDraft(saved);
  }

  async function handleSave() {
    if (!canSave) return;
    // Snapshot what is being sent: if the admin keeps editing while the
    // request is in flight, those later edits must stay "unsaved".
    const sent = draft;
    if (demo) {
      setSaved(sent);
      toast.success(t("saved", "Open hours saved"));
      return;
    }
    if (!locationId) {
      toast.error(t("noLocation", "No location selected."));
      return;
    }
    setSaving(true);
    try {
      // A location with no captive_portal_configs row yet has nothing to
      // PUT to -- resolve returns no config and this used to refuse to
      // save at all ("No portal config found for this location yet."),
      // which is how "Open Hours not working at all" showed up on a fresh
      // venue. Lazily create the location's own config first, then save
      // the business-hours fields onto it.
      let id = configId;
      if (!id) {
        const orgId = await resolveOrgId();
        const { data } = await api.post<{ id: string }>(
          "/captive-portal-configs",
          {
            organization_id: orgId,
            location_id: locationId,
            name: "Guest WiFi Login",
          },
          { headers: { "X-Organization-Id": orgId } },
        );
        id = data.id;
        setConfigId(id);
      }
      await businessHoursService.save(id, sent);
      setSaved(sent);
      toast.success(t("saved", "Open hours saved"));
    } catch (err) {
      // The draft is left exactly as it was, so nothing typed is lost.
      toast.error((err as AppError).message || t("saveFailed", "Could not save open hours."));
      return;
    } finally {
      setSaving(false);
    }
    // Refreshing the live "Right now" tile is best-effort: the save itself
    // already succeeded, so a failed re-read must not report a failed save.
    try {
      const refreshed = await businessHoursService.get(locationId);
      setIsOpenNow(refreshed.isOpenNow);
    } catch {
      /* keep the previous live status */
    }
  }

  // Purely-derived display values (no new fields, no new fetch) -- the KPI
  // tiles below just summarize `schedule`/`enabled`/`isOpenNow`, same as
  // every other view's KpiRow in this file.
  const openDaysCount = BH_DAYS.filter(({ key }) => dayState(key).open).length;
  const liveStatusKnown = !demo && isOpenNow !== null;
  const currentlyOpen = liveStatusKnown ? isOpenNow : null;

  // Warn when the schedule is enforced in a different zone than the one the
  // admin is editing from -- the exact setup under which "I set 9am-9pm and
  // guests still got in at 11pm" used to happen (the browser zone was saved
  // over the venue zone on every save).
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const timezoneMismatch = !demo && timezone !== browserTimezone;

  // A venue whose stored zone is outside BUSINESS_HOURS_TIMEZONES must
  // still render (and stay selectable after a save round-trip) -- an
  // unlisted Select value renders as blank. Append it as its own option.
  const timezoneOptions = BUSINESS_HOURS_TIMEZONES.includes(timezone)
    ? BUSINESS_HOURS_TIMEZONES
    : [...BUSINESS_HOURS_TIMEZONES, timezone];

  const kpiItems = [
    ...(liveStatusKnown
      ? [
          {
            label: t("kpi.rightNow", "Right now"),
            value: currentlyOpen ? t("kpi.open", "Open") : t("kpi.closed", "Closed"),
            tone: (currentlyOpen ? "success" : "danger") as StatTone,
            icon: currentlyOpen ? Sun : Moon,
          },
        ]
      : []),
    {
      label: t("kpi.daysOpen", "Days open"),
      value: `${openDaysCount}/7`,
      tone: "info" as StatTone,
      icon: Clock,
    },
    {
      label: t("kpi.enforced", "Enforced"),
      value: enabled ? t("kpi.on", "On") : t("kpi.off", "Off"),
      tone: (enabled ? "primary" : "default") as StatTone,
      icon: enabled ? CheckCircle2 : XCircle,
    },
  ];

  const saveActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {dirty && (
        <span className="text-xs text-muted-foreground">
          {hasErrors
            ? t("fixDays", "Fix the highlighted days to save")
            : t("unsaved", "Unsaved changes")}
        </span>
      )}
      <Button size="sm" variant="outline" onClick={handleDiscard} disabled={!dirty || saving}>
        {t("discard", "Discard")}
      </Button>
      <Button size="sm" onClick={handleSave} disabled={!canSave}>
        {saving ? t("saving", "Saving…") : t("save", "Save")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* "outside it they are disconnected" was the same false promise
           * WhiteList.tsx made, for the same reason: Open Hours is a
           * SIGN-IN gate and nothing else. `_require_venue_open` is called
           * from every login entry point and from `check_otp_request_allowed`,
           * and `is_open_now` appears nowhere in `guest/tasks.py` -- no
           * scheduled sweep reads `business_hours_schedule`, so a guest who
           * signed in at 21:55 keeps working internet straight through a
           * 22:00 close.
           *
           * The replacement deliberately reuses the sentence shape
           * `LocationPolicies.tsx`'s save footer already settled on -- "anyone
           * online right now keeps those until then" -- rather than inventing
           * a third way to say it. Two screens describing the same
           * next-session-only behaviour in two different phrasings is how an
           * owner concludes they are two different behaviours.
           *
           * Vendor-independent: this gate is ours, in our portal, so it reads
           * identically at a MikroTik and an Omada venue and needs no gating. */}
          <FeatureHeader
            title={t("title", "Open Hours")}
            description={t(
              "description",
              "Guests can only sign in inside this schedule — outside it they see your closed message instead of the sign-in page. Anyone already online stays online until their session ends.",
            )}
            icon={Sun}
            action={saveActions}
          />
        </div>
        <OpenHoursIllustration />
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {t(
            "loadErrorBanner",
            "Could not load this location's saved open hours ({{error}}). Saving is turned off so the real schedule is not overwritten -- reload the page to try again.",
            { error: loadError },
          )}
        </div>
      )}

      {!loading && <KpiRow items={kpiItems} />}

      {timezoneMismatch && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {t(
            "timezoneMismatch",
            "This schedule is enforced in {{venueZone}} — not your browser's {{browserZone}}. Times below are the venue's local time.",
            {
              venueZone: timezone.replace(/_/g, " "),
              browserZone: browserTimezone.replace(/_/g, " "),
            },
          )}
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">{t("weekly.title", "Weekly schedule")}</CardTitle>
          <CardDescription>
            {t(
              "weekly.description",
              "Tap a day to open it, then set when it starts and ends. Times are in {{zone}}.",
              { zone: timezone.replace(/_/g, " ") },
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            /* Container queries, not `sm:`/`md:`/`xl:`. The viewport
             * breakpoints this used to carry described a width this grid
             * has never actually had: the customer shell subtracts a
             * 16rem sidebar (3rem when collapsed) and up to 4rem of
             * `main` padding before this card sees any space, and caps
             * the result at `max-w-7xl`. So at a 1280px viewport -- an
             * ordinary dashboard window -- `xl:grid-cols-7` fired on the
             * viewport crossing 1280 while the grid itself was only
             * ~960px wide, giving seven ~127px columns. A day card cannot
             * be built in 127px: the badge, the day name and the switch
             * alone overflow it, and the two time inputs underneath are
             * squeezed until the browser drops the AM/PM segment of its
             * own native control. Both reported bugs, one cause.
             *
             * `@container` measures the element that actually holds the
             * cards, so the sidebar being open or collapsed changes the
             * column count instead of silently changing the column width.
             * The thresholds are chosen so a column never falls below
             * ~17rem, which is what one card needs for two `type="time"`
             * controls showing "hh:mm AM" side by side. */
            <div className="@container">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Label htmlFor="open-hours-timezone" className="text-sm font-medium">
                  {t("timezone", "Timezone")}
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="open-hours-timezone" className="w-64">
                    <SelectValue placeholder={t("timezonePlaceholder", "Select a timezone")} />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-2 @[52rem]:grid-cols-3 @[70rem]:grid-cols-4">
                {BH_DAYS.map(({ key, label: englishLabel }) => {
                  const d = dayState(key);
                  const label = t(`days.${key}`, englishLabel);
                  // The validator (lib/open-hours-draft.ts) returns one of two
                  // fixed English sentences; show the translated one. Any
                  // other text falls through unchanged.
                  const rawError = dayErrors[key];
                  const error = !rawError
                    ? rawError
                    : rawError.startsWith("Set both")
                      ? t("dayErrors.missing", rawError)
                      : rawError.startsWith("Closing time")
                        ? t("dayErrors.order", rawError)
                        : rawError;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex flex-col gap-2.5 rounded-2xl p-3.5 shadow-sm transition-colors",
                        d.open ? "bg-card" : "bg-muted/40",
                        error && "ring-1 ring-rose-400",
                      )}
                    >
                      {/* `min-w-0` on both the row and the label group, and
                      `truncate` on the day name. A flex child defaults to
                      `min-width: auto`, so an untruncatable "Wednesday"
                      set a hard floor on this row's width -- the row
                      could not shrink to its column, and what got pushed
                      out past the card's rounded edge was the switch on
                      the end. The switch is the thing you saw escape; the
                      text is the thing that refused to give way. */}
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase",
                              d.open
                                ? "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {t(`daysShort.${key}`, englishLabel.slice(0, 2))}
                          </span>
                          <span className="truncate text-sm font-medium">{label}</span>
                        </div>
                        {/* Switching a day on seeds the times too. The two
                        inputs below render `d.start ?? "09:00"` -- a
                        display fallback that was never written to state,
                        so a day you switched on and did not otherwise
                        touch had start/end still undefined. Saving then
                        failed the guard with "set both a start and end
                        time" while the pickers plainly read 09:00 and
                        18:00. Now what you see is what is stored. */}
                        <Switch
                          checked={d.open}
                          onCheckedChange={(v) =>
                            setDay(
                              key,
                              v
                                ? { open: true, start: d.start ?? "09:00", end: d.end ?? "18:00" }
                                : { open: false },
                            )
                          }
                        />
                      </div>
                      {d.open ? (
                        <div className="space-y-1.5">
                          {/* `min-w-0 flex-1` let a native `type="time"`
                          control shrink to its padding. The browser draws
                          "09:00 AM" itself and simply clips the segment
                          that no longer fits -- AM/PM is last, so AM/PM is
                          what disappeared, and a 09:00 that will not say
                          which 09:00 is worse than no control at all.
                          `min-w-[6.5rem]` is a real floor under it, and
                          `flex-wrap` means the pair stacks rather than
                          clipping again if this card is ever narrower than
                          two of them (a locale with a longer time format,
                          or a future column count). */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Input
                              type="time"
                              className="h-8 min-w-[6.5rem] flex-1 px-2 text-xs"
                              aria-label={t("opensAria", "{{day}} opens", { day: label })}
                              aria-invalid={Boolean(error)}
                              value={d.start ?? "09:00"}
                              onChange={(e) => setDay(key, { start: e.target.value })}
                            />
                            <span className="shrink-0 text-xs text-muted-foreground">–</span>
                            <Input
                              type="time"
                              className="h-8 min-w-[6.5rem] flex-1 px-2 text-xs"
                              aria-label={t("closesAria", "{{day}} closes", { day: label })}
                              aria-invalid={Boolean(error)}
                              value={d.end ?? "18:00"}
                              onChange={(e) => setDay(key, { end: e.target.value })}
                            />
                          </div>
                          {error && (
                            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setDay(key, { start: "00:00", end: "23:59" })}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {t("openAllDay", "Open all day")}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("closedAllDay", "Closed all day")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">
              {t("guestExperience.title", "Guest experience")}
            </CardTitle>
            <CardDescription>
              {t(
                "guestExperience.description",
                "What guests see, and how strictly the schedule above is enforced.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border-0 bg-muted/40 px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t("enforce.title", "Enforce this schedule")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "enforce.description",
                      "Outside open hours, guests are shown the closed message below instead of the sign-in page.",
                    )}
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="open-hours-closed-message" className="text-xs">
                  {t("closedMessageLabel", "Message shown to guests while closed")}
                </Label>
                <Textarea
                  id="open-hours-closed-message"
                  value={closedMessage}
                  onChange={(e) => setClosedMessage(e.target.value)}
                  placeholder={t("closedMessagePlaceholder", "We're currently closed.")}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Same controls again under the form: the page is long, and the
      closed message -- the last thing edited -- sits far below the
      header's Save. */}
      {!loading && saveActions}
    </div>
  );
}

/* ---------- Top Up Data ---------- */
export function TopUpView() {
  const packs = [
    { d: "5 GB", p: "₹99", v: "7 days" },
    { d: "20 GB", p: "₹299", v: "30 days" },
    { d: "50 GB", p: "₹599", v: "30 days" },
    { d: "Unlimited", p: "₹999", v: "30 days" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="Top Up Data"
        description="Recharge data balance for a business unit or an individual guest."
      />
      <KpiRow
        items={[
          { label: "Balance", value: "128 GB", tone: "primary", icon: Gauge },
          { label: "Used (month)", value: "412 GB", tone: "info", icon: Activity },
          { label: "Active packs", value: "6", tone: "success", icon: Ticket },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {packs.map((p) => (
          <Card key={p.d} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <p className="text-lg font-semibold">{p.d}</p>
              <p className="text-xs text-muted-foreground">valid {p.v}</p>
              <p className="mt-3 text-2xl font-bold text-primary">{p.p}</p>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => toast.success(`${p.d} pack added`)}
              >
                Top up
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- ISP Details ----------
 * Moved to `@/components/customer/isp/` (the console revamp). Re-exported
 * here so every lazy import site (`lazyView(OPS, "IspDetailsView")`) keeps
 * resolving unchanged. */
export { IspDetailsView } from "@/components/customer/isp/IspDetailsView";

/* ---------- Admin Logs ---------- */

/** Small illustrated empty-state for a log section with zero real rows --
 * a dormant activity pulse, same filled-flat-shape language as
 * ChartEmptyState/UsersEmptyState elsewhere this session (each of those is
 * scoped to its own page file, not exported, so this is a local twin
 * rather than a cross-file import). Purely decorative -- aria-hidden. */
function LogsEmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 100 70" className="h-14 w-20" fill="none">
        <ellipse cx="50" cy="60" rx="32" ry="4" fill="#4f46e5" opacity="0.08" />
        <rect
          x="26"
          y="24"
          width="48"
          height="30"
          rx="6"
          className="fill-muted"
          stroke="#a78bfa"
          strokeWidth="2"
        />
        <path
          d="M34 34h32M34 41h22"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <circle cx="66" cy="20" r="4" fill="#22d3ee" opacity="0.6" />
      </svg>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Section header for one of the three log tables below -- a distinct
 * gradient hue per section (still within the established indigo/violet/
 * fuchsia brand family) so a reader can tell at a glance which of the
 * three dense tables they're scanning, without reading the title text
 * first. Left-accent bar on the card echoes the same hue. */
function LogSectionHeader({
  icon: Icon,
  title,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
          gradient,
        )}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export function AdminLogsView({ locationId }: { locationId?: string }) {
  // `tNav`, not `t`: this view already uses `t` as the tab loop variable.
  const { t: tNav } = useTranslation("nav", { i18n });
  // Owner-only, render-time check -- defense in depth alongside the
  // sidebar/route-nav guard (customerNav.ts / customer.$locationId.$feature
  // .tsx's own NAV_GROUPS) and the backend's own independent enforcement
  // (app.domains.admin_logs.router's RequireRole("organization-owner"),
  // and -- since the "Audit Log" tab's real data was folded into this
  // page's own Account Activity section below -- app.domains.audit
  // .router's matching RequireRole narrowing). A UI guard alone is
  // bypassable (a direct URL hit skips the sidebar filter entirely) --
  // this catches that case; the backend 403 is what actually keeps a
  // non-owner from ever getting the real data either way.
  const role = getCustomerLoginRole();
  // Real data only -- fetched from /admin-logs/dashboard-logins,
  // /admin-logs/router-events, and /audit/entries (all org-scoped,
  // Owner-only), each with its own real server-side page/page_size (see
  // customer.service.ts's own "Logs (real, server-side–paginated)"
  // comment) so each section's numbered pager below can jump straight to
  // any page without fetching the other two pages or the whole table. No
  // Math.random(), no fabricated rows; a failed/blocked fetch resolves to
  // an empty section, never fake log entries.
  const ADMIN_LOGS_PAGE_SIZE = 25;
  const [loginsPage, setLoginsPage] = useState(1);
  const [routerPage, setRouterPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  // Tabbed instead of three long tables stacked one after another -- each
  // section can run to 25+ rows per page, so reaching "Account Activity"
  // used to mean scrolling past two entirely unrelated tables first. All
  // three queries still run unconditionally (below), so switching tabs is
  // instant with no refetch, and each section's own page number is
  // preserved even while its tab isn't active.
  const [section, setSection] = useState<"logins" | "router" | "activity">("logins");
  const loginsQuery = useAdminLogsDashboardLogins(loginsPage, ADMIN_LOGS_PAGE_SIZE);
  const routerQuery = useAdminLogsRouterEvents(routerPage, ADMIN_LOGS_PAGE_SIZE);
  const activityQuery = useAdminLogsAccountActivity(activityPage, ADMIN_LOGS_PAGE_SIZE);

  if (role !== "owner") {
    return (
      <div className="space-y-6">
        <FeatureHeader
          title={tNav("customerItem.admin-logs", "Staff Activity")}
          description="Who logged into the dashboard and when, router activity, and account changes across every location."
          icon={ScrollText}
        />
        <Card className="border-0 shadow-sm">
          <CardContent>
            <EmptyState
              icon={ShieldAlert}
              title="Owner access only"
              description="Staff Activity shows a security-sensitive login and change-audit trail for the whole organization. Only the Organization Owner can view this page."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const logins = loginsQuery.data?.items ?? [];
  const routerLogs = routerQuery.data?.items ?? [];
  const accountActivity = activityQuery.data?.items ?? [];
  const loginsTotalPages = loginsQuery.data?.meta.totalPages ?? 0;
  const routerTotalPages = routerQuery.data?.meta.totalPages ?? 0;
  const activityTotalPages = activityQuery.data?.meta.totalPages ?? 0;

  const TABS: {
    id: typeof section;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
  }[] = [
    {
      id: "logins",
      label: "Dashboard Logins",
      icon: KeyRound,
      count: loginsQuery.data?.meta.totalItems ?? logins.length,
    },
    {
      id: "router",
      label: "Router Logs",
      icon: Router,
      count: routerQuery.data?.meta.totalItems ?? routerLogs.length,
    },
    {
      id: "activity",
      label: "Account Activity",
      icon: History,
      count: activityQuery.data?.meta.totalItems ?? accountActivity.length,
    },
  ];

  return (
    <div className="space-y-6">
      <FeatureHeader
        title={tNav("customerItem.admin-logs", "Staff Activity")}
        description="Real login activity, router events, and account/config changes across every location in your organization."
        icon={ScrollText}
      />

      <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              section === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                section === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {section === "logins" && (
        <div className="space-y-3">
          <LogSectionHeader
            icon={KeyRound}
            title="Dashboard Logins"
            gradient="from-[#4f46e5] to-[#818cf8]"
          />
          <Card className="border-0 border-l-4 border-l-[#4f46e5] shadow-sm">
            <CardContent className="p-0">
              {loginsQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={5} />
                </div>
              ) : logins.length === 0 ? (
                <LogsEmptyState label="No dashboard logins yet -- login activity for this organization will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Email</TableHead>
                      <TableHead className="text-xs font-medium">IP Address</TableHead>
                      <TableHead className="text-xs font-medium">Result</TableHead>
                      <TableHead className="text-xs font-medium">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logins.map((l) => (
                      <TableRow key={l.id} className="border-b">
                        <TableCell className="py-2 font-medium">{l.email}</TableCell>
                        <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                          {l.ipAddress}
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              l.success
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                l.success ? "bg-emerald-500" : "bg-rose-500",
                              )}
                            />
                            {l.success ? "Success" : (l.failureReason ?? "Failed")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {l.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {loginsTotalPages > 1 && (
              <div className="border-t border-border/70 px-4 py-3">
                <NumberedPagination
                  page={loginsPage}
                  totalPages={loginsTotalPages}
                  onPageChange={setLoginsPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {section === "router" && (
        <div className="space-y-3">
          <LogSectionHeader
            icon={Router}
            title="Router Logs by Location"
            gradient="from-[#7c3aed] to-[#a78bfa]"
          />
          <Card className="border-0 border-l-4 border-l-[#7c3aed] shadow-sm">
            <CardContent className="p-0">
              {routerQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={5} />
                </div>
              ) : routerLogs.length === 0 ? (
                <LogsEmptyState label="No router events yet -- router activity across your locations will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Location</TableHead>
                      <TableHead className="text-xs font-medium">Router</TableHead>
                      <TableHead className="text-xs font-medium">Event</TableHead>
                      <TableHead className="text-xs font-medium">Message</TableHead>
                      <TableHead className="text-xs font-medium">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routerLogs.map((e) => (
                      <TableRow key={e.id} className="border-b">
                        <TableCell className="py-2 font-medium">{e.locationName}</TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {e.routerName}
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium",
                              e.isError
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                e.isError ? "bg-rose-500" : "bg-slate-400",
                              )}
                            />
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {e.message ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {e.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {routerTotalPages > 1 && (
              <div className="border-t border-border/70 px-4 py-3">
                <NumberedPagination
                  page={routerPage}
                  totalPages={routerTotalPages}
                  onPageChange={setRouterPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {section === "activity" && (
        <div className="space-y-3">
          {/* Real administrative change-audit trail (role assignments,
            location/member changes, etc.) -- what used to be the
            standalone "Audit Log" tab, now merged in here as its own
            section rather than kept as a second nav entry. Same real
            /audit/entries data (app.domains.audit), same real
            server-side pagination as the two sections above -- see
            customer.service.ts's own getAdminLogsAccountActivity comment.
            Fetched with exclude_view_events=true, so this is only real
            changes -- never the "*_viewed" access-logging noise that
            would otherwise bury it. */}
          <LogSectionHeader
            icon={History}
            title="Account Activity"
            gradient="from-[#c026d3] to-[#f0abfc]"
          />
          <Card className="border-0 border-l-4 border-l-[#c026d3] shadow-sm">
            <CardContent className="p-0">
              {activityQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={5} />
                </div>
              ) : accountActivity.length === 0 ? (
                <LogsEmptyState label="No account activity yet -- role assignments and account/config changes across your organization will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Change</TableHead>
                      <TableHead className="text-xs font-medium">Actor</TableHead>
                      <TableHead className="text-xs font-medium">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountActivity.map((a) => (
                      <TableRow key={a.id} className="border-b">
                        <TableCell className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                                actionTone(a.action),
                              )}
                            >
                              {formatAuditAction(a.action)}
                            </span>
                            {a.description && (
                              <span className="text-sm text-foreground">{a.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {a.actor}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {a.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {activityTotalPages > 1 && (
              <div className="border-t border-border/70 px-4 py-3">
                <NumberedPagination
                  page={activityPage}
                  totalPages={activityTotalPages}
                  onPageChange={setActivityPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/** "role_assigned" -> "Role assigned"; title-cased just the leading word so
 * multi-word actions (the common case) still read as a sentence fragment
 * rather than shouty Title Case Everywhere. */
function formatAuditAction(action: string): string {
  const words = action.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Colors the action badge by what kind of change it was -- destructive
 * (removed/deleted/revoked/deactivated/archived) reads as rose, additive
 * (created/assigned/added/approved/activated) as emerald, everything else
 * (updated/changed/published/...) as neutral slate -- the same
 * create/destructive/neutral language the two tables above this one
 * already use for their own status pills. */
function actionTone(action: string): string {
  if (/removed|deleted|revoked|deactivated|archived|rejected|denied/.test(action)) {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
  }
  if (/created|assigned|added|approved|activated|invited|accepted|published/.test(action)) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300";
}

/* ---------- MAC Authorization ---------- */
interface MacAuthEntry {
  id: string;
  mac: string;
  type: string;
  expiresAt: string | null;
  comment: string | null;
  enabled: boolean;
}

export function MacAuthView({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("trustedDevices", { i18n });
  // `isError`/`refetch` are read because customerService.getFeatureData no
  // longer resolves with demo fixtures when the fetch fails (see its own
  // docstring). Without an error branch below, a failed load would fall
  // through to the "No trusted devices yet" empty state -- which
  // asserts this location has no trusted devices, a claim we cannot make
  // when we never got an answer. For an access-control list that is the
  // one thing worth being careful about.
  const { data, isLoading, isError, refetch } = useCustomerFeatureData(
    "mac-auth",
    locationId ?? "",
  );
  const [entries, setEntries] = useState<MacAuthEntry[]>([]);
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (data?.macAuth && !synced) {
      setEntries(data.macAuth);
      setSynced(true);
    }
  }, [data, synced]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ mac: "", type: "permanent", expiresAt: "", comment: "" });
  const [macError, setMacError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);

  const addEntry = async () => {
    // Real-world MACs get pasted in every notation (dashes, no separators,
    // mixed case -- e.g. the dash format a router's own MAC is shown in
    // elsewhere in this app). A strict colon-only regex silently rejected
    // all of those: the dialog just sat there with a transient toast as
    // the only feedback, reading as "the Add button doesn't work" (the
    // same bug already fixed in NetworkHardwareView's Add Device dialog --
    // see BasicFeatureViews.normalizeMac). Normalize first, and surface a
    // real inline error instead of only a fading toast.
    const normalizedMac = normalizeMac(form.mac);
    if (!normalizedMac) {
      const msg = t(
        "errors.badMac",
        "That doesn't look like a device address. Example: AA:BB:CC:DD:EE:FF",
      );
      setMacError(msg);
      toast.error(msg);
      return;
    }
    // "Temporary" used to send no expiry at all: `expires_at` went up as
    // null and the row came back rendering as "Never" in the Expires
    // column -- i.e. picking Temporary produced a permanent entry, which
    // on an access-control list is the worst direction to be wrong in.
    // CreateMacAuthorizationPayload.expiresAt and the service's
    // `expires_at` mapping were already there; only this dialog never
    // collected a date. Same rule the operator console's twin of this
    // screen already enforces (MacAuthorizationManagement.tsx's
    // `.refine(... "Expiry required for temporary entries")`).
    const isTemporary = form.type === "temporary";
    if (isTemporary && !form.expiresAt) {
      const msg = t("errors.noExpiry", "Pick when access should end, or choose Always.");
      setExpiryError(msg);
      toast.error(msg);
      return;
    }
    if (isTemporary && new Date(form.expiresAt).getTime() <= Date.now()) {
      const msg = t("errors.pastExpiry", "That time is in the past — pick a later one.");
      setExpiryError(msg);
      toast.error(msg);
      return;
    }
    const expiresAt = isTemporary ? new Date(form.expiresAt).toISOString() : null;
    const payload = {
      macAddress: normalizedMac,
      authorizationType: form.type as "permanent" | "temporary",
      expiresAt,
      comment: form.comment || null,
      isEnabled: true,
    };
    try {
      if (!isDemo() && locationId) {
        const created = await macAuthorizationService.create({ ...payload, locationId });
        setEntries((e) => [
          {
            id: created.id,
            mac: created.macAddress,
            type: created.authorizationType,
            expiresAt: created.expiresAt,
            comment: created.comment,
            enabled: created.isEnabled,
          },
          ...e,
        ]);
      } else {
        setEntries((e) => [
          {
            id: String(Date.now()),
            mac: payload.macAddress,
            type: payload.authorizationType,
            expiresAt: payload.expiresAt,
            comment: payload.comment,
            enabled: true,
          },
          ...e,
        ]);
      }
      toast.success(t("toast.added", "Device trusted"));
      setForm({ mac: "", type: "permanent", expiresAt: "", comment: "" });
      setMacError(null);
      setExpiryError(null);
      setOpen(false);
    } catch (err) {
      // Surface the backend's real message (e.g. its duplicate-MAC 409)
      // instead of a generic "check the connection" -- a genuine rejection
      // needs to read as a rejection, not a dead click.
      const msg =
        (err as AppError).message ||
        t("toast.saveFailed", "Could not save — check the connection and try again.");
      setMacError(msg);
      toast.error(msg);
    }
  };

  const toggleEntry = async (entry: MacAuthEntry) => {
    setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, enabled: !e.enabled } : e)));
    if (!isDemo()) {
      try {
        await macAuthorizationService.update(entry.id, { isEnabled: !entry.enabled });
      } catch {
        toast.error(t("toast.updateFailed", "Could not update on the server."));
        setEntries((es) =>
          es.map((e) => (e.id === entry.id ? { ...e, enabled: entry.enabled } : e)),
        );
      }
    }
  };

  const removeEntry = async (entry: MacAuthEntry) => {
    setEntries((es) => es.filter((e) => e.id !== entry.id));
    toast.success(t("toast.removed", "Device removed"));
    if (!isDemo()) {
      try {
        await macAuthorizationService.remove(entry.id);
      } catch {
        toast.error(t("toast.removeFailed", "Could not remove on the server."));
        setEntries((es) => [entry, ...es]);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FeatureHeader
            title={t("title", "Trusted Devices")}
            description={t(
              "description",
              "Let a few of your own devices onto the WiFi without signing in.",
            )}
            icon={Fingerprint}
            action={
              <Button
                size="sm"
                onClick={() => {
                  setMacError(null);
                  setExpiryError(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t("addDevice", "Add device")}
              </Button>
            }
          />
        </div>
        <MacAuthIllustration />
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">{t("list.title", "Trusted devices")}</CardTitle>
          <CardDescription>
            {t(
              "list.description",
              "Devices that connect straight to the WiFi without seeing the sign-in screen.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <LoadingSkeleton rows={4} />
            </div>
          ) : isError && entries.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title={t("list.errorTitle", "Couldn't load trusted devices")}
              description={t(
                "list.errorBody",
                "This list is not available right now, so we can't show which devices are authorized. Nothing has changed — try again in a moment.",
              )}
              action={{ label: t("list.tryAgain", "Try again"), onClick: () => void refetch() }}
            />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Shield}
              title={t("list.emptyTitle", "No trusted devices yet")}
              description={t(
                "list.emptyBody",
                'Click "Add device" above to let one of your own devices skip the sign-in screen.',
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">
                    {t("col.address", "Device address")}
                  </TableHead>
                  <TableHead className="text-xs font-medium">{t("col.access", "Access")}</TableHead>
                  <TableHead className="text-xs font-medium">{t("col.ends", "Ends")}</TableHead>
                  <TableHead className="text-xs font-medium">{t("col.note", "Note")}</TableHead>
                  <TableHead className="text-xs font-medium">{t("col.active", "Active")}</TableHead>
                  <TableHead className="text-right text-xs font-medium">
                    {t("col.action", "Action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className="border-b">
                    <TableCell className="font-mono text-xs">{e.mac}</TableCell>
                    <TableCell className="text-xs">
                      {e.type === "temporary"
                        ? t("access.untilDate", "Until a date")
                        : t("access.always", "Always")}
                    </TableCell>
                    {/* A row saved before the dialog collected an expiry can
                      be temporary with no date at all. That used to render
                      as "Never" -- the same word a genuinely permanent
                      entry gets -- which read as a deliberate choice
                      rather than as missing data. Say which it is. */}
                    <TableCell className="text-xs text-muted-foreground">
                      {e.expiresAt
                        ? new Date(e.expiresAt).toLocaleString()
                        : e.type === "temporary"
                          ? t("ends.notSet", "Not set — never ends")
                          : t("ends.never", "Never")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.comment || "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={e.enabled} onCheckedChange={() => toggleEntry(e)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => removeEntry(e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setMacError(null);
            setExpiryError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("dialog.title", "Add a trusted device")}</DialogTitle>
            <DialogDescription>
              {t(
                "dialog.description",
                "This device connects straight to the WiFi without the sign-in screen.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {/* "MAC Address" was the bare label on every control here while
                the page header already said "Trusted Devices" -- the plain-
                English rename reached the title and never reached the form.
                The term itself has to stay somewhere: it is the exact
                phrase printed in a phone's WiFi settings, which is where
                the owner has to go to read this value off. So: plain-
                English label, technical term in the hint that tells them
                where to find it. */}
              <Label>{t("dialog.address", "Device address")}</Label>
              <Input
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
                {t(
                  "dialog.addressHint",
                  "Its MAC address — find it under WiFi settings on the device itself. Dashes, spaces, or no separators are fine too, e.g. AA-BB-CC-DD-EE-FF.",
                )}
              </p>
              {macError && <p className="text-xs font-medium text-destructive">{macError}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t("dialog.allowAccess", "Allow access")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  setForm({ ...form, type: v, expiresAt: v === "permanent" ? "" : form.expiresAt });
                  setExpiryError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">{t("access.always", "Always")}</SelectItem>
                  <SelectItem value="temporary">{t("access.untilDate", "Until a date")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "temporary" && (
              <div className="space-y-2">
                <Label>{t("dialog.accessEnds", "Access ends")}</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => {
                    setForm({ ...form, expiresAt: e.target.value });
                    if (expiryError) setExpiryError(null);
                  }}
                  className={cn(
                    expiryError && "border-destructive focus-visible:ring-destructive/20",
                  )}
                  aria-invalid={!!expiryError}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "dialog.accessEndsHint",
                    "After this the device signs in like any other guest.",
                  )}
                </p>
                {expiryError && (
                  <p className="text-xs font-medium text-destructive">{expiryError}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("dialog.note", "Note (optional)")}</Label>
              <Input
                placeholder={t("dialog.notePlaceholder", "e.g. Front desk tablet")}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("dialog.cancel", "Cancel")}
            </Button>
            <Button onClick={addEntry}>{t("dialog.add", "Add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Port Forwarding ----------
 * Was a NetworkCrudTable over an empty hardcoded seed with a decorative Edit
 * button (no onClick at all -- a dead click, plus even Add/Delete never
 * reached a backend). The real domain already exists end-to-end
 * (app.domains.port_forwarding, the `port_forwarding_rules` table,
 * portForwardingService/usePortForwarding on the frontend) and already backs
 * PortForwardingManagement -- reused here, scoped to this location, the same
 * way DhcpView/VlansView are. */
export function PortForwardingView({
  locationId,
  scope,
}: {
  locationId?: string;
  scope?: PageScope;
}) {
  return <PortForwardingManagement locationId={locationId} scope={scope} />;
}

/* ---------- DHCP Pool ----------
 * Was a NetworkCrudTable over hardcoded seed rows with a decorative Edit
 * button (no onClick at all -- a dead click, plus even Add/Delete never
 * reached a backend). The real domain already exists end-to-end
 * (app.domains.dhcp, the `dhcp_pools` table, dhcpService/useDhcp on the
 * frontend) and already backs DhcpManagement -- reused here, scoped to
 * this location, the same way IspDetailsView/MacAuthView are. */
export function DhcpView({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
  return <DhcpManagement locationId={locationId} scope={scope} />;
}

/* ---------- VLANs ----------
 * Was a NetworkCrudTable over hardcoded seed rows with a decorative Edit
 * button (no onClick at all -- a dead click, plus even Add/Delete never
 * reached a backend). The real domain already exists end-to-end
 * (app.domains.vlan, the `vlans` table, vlanService/useVlan on the
 * frontend) and already backs VlanManagement -- reused here, scoped to
 * this location, the same way DhcpView/IspDetailsView/MacAuthView are. */
export function VlansView({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
  return <VlanManagement locationId={locationId} scope={scope} />;
}

/* ---------- VOIP Priority ----------
 * Was a page of decorative ToggleRows and a plain local useState switch --
 * "Enable / Disable VOIP Priority" and the SIP/RTP prioritization toggles
 * only ever fired a toast, nothing was ever read from or written to a
 * backend, and a reload silently discarded every change; the KPI tiles
 * above them ("Active calls", "Jitter", "Packet loss") were hardcoded
 * display values with no live source, so they're dropped here rather than
 * faked. The real domain already exists end-to-end (app.domains.qos, the
 * `qos_traffic_rules` table -- literally named "QoS & VOIP Priority" in its
 * own module docstring) -- unlike VLAN/DHCP/Port Forwarding/Hotspot/ISP
 * Routing, no frontend component existed yet to reuse, so QosManagement is
 * new (qos.service.ts/useQos.ts alongside it), scoped to this location the
 * same way DhcpView/VlansView are. */
export function VoipView({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
  return <QosManagement locationId={locationId} scope={scope} />;
}

/* ---------- Website Blocking ----------
 * No longer here. It is the "Websites & IPs" tab of Security -> Blocking
 * (components/security/BlockingView.tsx), which mounts
 * ContentFilterManagement directly rather than through this barrel -- so
 * opening it no longer fetches this chunk. The delegating
 * `WebsiteBlockingView` export that lived here had no caller left and was
 * removed with its import. */

/* ---------- "Fix a Problem" (feature id `debugging`, was "Connection
 * Tools", and "Network Diagnostics" before that) ----------
 * The implementation moved to components/customer/FixAProblem.tsx; this
 * stays as the delegating export the feature switch already imports, the
 * same shape as HotspotView/DhcpView above.
 *
 * WHY IT MOVED RATHER THAN BEING EDITED IN PLACE. The old view was a
 * ping box, a traceroute button and an input asking a cafe owner for a
 * guest's private LAN IP -- feature for feature a competitor's Network
 * Tools page, which is why renaming and restyling it once already failed
 * to shift the complaint. Rebuilding it around the venue's question
 * rather than the router's command set replaced essentially all of it,
 * and 400 lines of new page do not belong in a 5,000-line module that is
 * already eight unrelated screens.
 *
 * The real calls it always made are unchanged and still real:
 * networkDiagnosticsService.ping/traceroute against RouterOS, and
 * guestService.terminateSession. Ping and traceroute are now the
 * implementation of "can my guest open this site" instead of being
 * buttons named after themselves. */
export function DebuggingView({
  locationId,
  masked,
}: { locationId?: string; masked?: boolean } = {}) {
  return <FixAProblem locationId={locationId} masked={masked} />;
}

/* ---------- Hotspot Settings ----------
 * Was a page of decorative ToggleRows -- "Apply settings" just fired a toast,
 * nothing was ever read from or written to a backend, and a reload silently
 * discarded every change. The real domain already exists end-to-end
 * (app.domains.hotspot, the `hotspot_profiles` table,
 * hotspotService/useHotspot on the frontend) and already backs
 * HotspotManagement -- reused here, scoped to this location, the same way
 * DhcpView/VlansView/PortForwardingView are. */
export function HotspotView({ locationId }: { locationId?: string }) {
  return <HotspotManagement locationId={locationId} />;
}

/* ---------- RaaS: Dashboard ---------- */
export function RaasDashboardView() {
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="RaaS Dashboard"
        description="Reporting-as-a-Service overview across your managed business units."
        action={
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All spaces</SelectItem>
              <SelectItem value="hostel">The Hosteller</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-5 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2 text-sm/none opacity-90">
            <Server className="h-4 w-4" /> Total Users
          </div>
          <p className="mt-2 text-3xl font-bold">3,241</p>
        </div>
        <div className="rounded-2xl bg-[image:var(--gradient-accent)] p-5 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2 text-sm/none opacity-90">
            <Wifi className="h-4 w-4" /> Total Active Users
          </div>
          <p className="mt-2 text-3xl font-bold">1,188</p>
        </div>
      </div>
      <KpiRow
        items={[
          { label: "Data consumed", value: "4.2 TB", tone: "info", icon: Gauge },
          { label: "Avg session", value: "34 min", tone: "primary", icon: Clock },
          { label: "New users (7d)", value: "612", tone: "success", icon: Activity },
          { label: "Online now", value: "142", tone: "primary", icon: Signal },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business unit</TableHead>
                <TableHead>Plan expiry</TableHead>
                <TableHead>Online users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { n: "The Hosteller Marathahalli", e: "31 Dec 2026", o: "48" },
                { n: "Hosteller Staff · Marathahalli", e: "31 Dec 2026", o: "9" },
                { n: "The Hosteller Indira Nagar", e: "15 Jan 2027", o: "22" },
              ].map((r) => (
                <TableRow key={r.n}>
                  <TableCell className="font-medium">{r.n}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.e}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.o}</Badge>
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

/* ---------- RaaS: Manage Users ---------- */
export function RaasUsersView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="RaaS · Manage Users"
        description="Add single or bulk users for a business unit and review current users."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add single user</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input placeholder="+91 •••••" className="h-9" />
            </div>
            <Button
              size="sm"
              onClick={() => {
                toast.success("User created");
                setName("");
                setEmail("");
              }}
            >
              Create user
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add bulk users</CardTitle>
            <CardDescription>Upload a CSV (max ~200 records) using the template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
              <Download className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop CSV here or browse</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Download template
              </Button>
              <Button size="sm" onClick={() => toast.success("Users uploaded")}>
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { n: "Aarav Mehta", e: "aarav@stay.com", c: "12 Jul 2026", s: "active" },
                { n: "Diya Nair", e: "diya@stay.com", c: "10 Jul 2026", s: "active" },
                { n: "Kabir Rao", e: "kabir@stay.com", c: "02 Jul 2026", s: "disabled" },
              ].map((u) => (
                <TableRow key={u.e}>
                  <TableCell className="font-medium">{u.n}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.e}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.c}</TableCell>
                  <TableCell>
                    <StatusPill status={u.s} />
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

/* ---------- RaaS: Reports ---------- */
export function RaasReportsView() {
  const reports = [
    { n: "User Report", d: "Sign-ups and activity per business unit" },
    { n: "Voucher Report", d: "Issued, redeemed and expired vouchers" },
    { n: "Campaign Report", d: "Reach and conversions per campaign" },
    { n: "Data Report", d: "Consumption and charges by rate/GB" },
    { n: "OTP SMS Report", d: "Delivery success and latency" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="RaaS · Reports"
        description="Generate cross-business-unit reports in different formats."
        action={
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All report types</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.n} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <p className="font-semibold">{r.n}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.d}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => toast.success(`${r.n} · PDF`)}
                >
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => toast.success(`${r.n} · CSV`)}
                >
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- fallback for any not-yet-built feature ---------- */
export function GenericFeatureView({ feature }: { feature: string }) {
  const label = feature.replace(/-/g, " ");
  return (
    <div className="space-y-6">
      <FeatureHeader
        title={label.replace(/\b\w/g, (c) => c.toUpperCase())}
        description="This module is provisioned for your location."
      />
      <Card className="border-0 shadow-sm">
        <CardContent>
          <EmptyState
            icon={Network}
            title="Not configured yet"
            description={`Configuration for ${label} will appear here.`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
