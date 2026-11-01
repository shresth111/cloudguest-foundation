/**
 * Customer-dashboard feature views redesigned from the legacy BhaiFi
 * Cloud App screens (Business Hours, Hotspot Settings, Debugging Tools,
 * RaaS, MAC Auth, Port Forwarding, DHCP, VLANs, VOIP, ISP Routing/Details,
 * Top Up, Alerts, Admin Logs). All token-driven so they
 * pick up the Aurora Teal identity automatically. Mock data only -- these
 * are the seam a per-location backend call replaces.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { formatDateTime, formatRelative } from "@/lib/format";
import { ControllerControlNotice } from "@/components/customer/ControllerControlNotice";
import { useCustomerStore } from "@/stores/customerStore";
import { locationControllerVendor } from "@/lib/location-liveness";
import { nasOnlyLimitVerdict } from "@/lib/nas-only-access-rules";
import {
  AlertTriangle,
  Network,
  Plus,
  Router,
  Shield,
  ShieldAlert,
  Trash2,
  History,
  ScrollText,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { NumberedPagination } from "@/components/ui-ext/NumberedPagination";
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
import {
  Callout,
  DataTable,
  EmptyState,
  FormField,
  FormSection,
  FormSwitchRow,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
  StatusDot,
  SubTabs,
  type ConsoleStatus,
  type PageScope,
} from "@/components/customer/console";

/* ---------- shared building blocks ---------- */

// `ToggleRow` used to live here: a switch bound to nothing but its own
// `useState`, which is how the old Notifications screen managed to look
// finished while persisting nothing. That caller is gone too (the screen
// was rewritten against the real notification-channel APIs, then removed
// from the customer dashboard along with its nav entry). The unrelated
// `ToggleRow` in components/settings/SectionCard.tsx is a different
// component and is still in use.

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
// i18n-ignore-start: English fallbacks; the Open Hours grid renders t(`days.<key>`)
const BH_DAYS: { key: BusinessHoursWeekday; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];
// i18n-ignore-end

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

export function OpenHoursView({
  locationId,
  scope,
}: { locationId?: string; scope?: PageScope } = {}) {
  const { t } = useTranslation("openHours", { i18n });
  // The venue's vendor straight off the persisted summary -- no request (the
  // capabilities read in `useClientControls` is for controller venues and has
  // nothing to say about Open Hours).
  const openHoursVendor = locationControllerVendor(
    useCustomerStore((s) => s.activeLocation)?.liveness,
  );
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
  // tiles below just summarize `schedule`/`enabled`/`isOpenNow`.
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

  // "Right now" is shown only when the live answer is known; its dot is the
  // console status (open = ok, closed = neutral grey: closed is a schedule,
  // not a fault).
  const kpiItems: { label: string; value: string; status?: ConsoleStatus }[] = [
    ...(liveStatusKnown
      ? [
          {
            label: t("kpi.rightNow", "Right now"),
            value: currentlyOpen ? t("kpi.open", "Open") : t("kpi.closed", "Closed"),
            status: (currentlyOpen ? "ok" : "offline") as ConsoleStatus,
          },
        ]
      : []),
    { label: t("kpi.daysOpen", "Days open"), value: `${openDaysCount}/7` },
    {
      label: t("kpi.enforced", "Enforced"),
      value: enabled ? t("kpi.on", "On") : t("kpi.off", "Off"),
      status: (enabled ? "ok" : "offline") as ConsoleStatus,
    },
  ];

  const saveActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {dirty && (
        <span role="status" className="text-xs text-[var(--wy-text-muted)]">
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
    <div className="wy-console space-y-5">
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
      <PageHeader
        title={scope?.title ?? t("title", "Open Hours")}
        venue={scope?.venue}
        description={t(
          "description",
          "Guests can only sign in inside this schedule — outside it they see your closed message instead of the sign-in page. Anyone already online stays online until their session ends.",
        )}
        actions={saveActions}
      />

      {loadError && (
        <Callout tone="crit" role="alert">
          {t(
            "loadErrorBanner",
            "Could not load this location's saved open hours ({{error}}). Saving is turned off so the real schedule is not overwritten -- reload the page to try again.",
            { error: loadError },
          )}
        </Callout>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpiItems.map((k) => (
            <StatTile
              key={k.label}
              label={k.label}
              value={k.value}
              leading={
                k.status ? <StatusDot status={k.status} label={k.value} size="sm" /> : undefined
              }
            />
          ))}
        </div>
      )}

      {timezoneMismatch && (
        <Callout tone="warn" role="alert">
          {t(
            "timezoneMismatch",
            "This schedule is enforced in {{venueZone}} — not your browser's {{browserZone}}. Times below are the venue's local time.",
            {
              venueZone: timezone.replace(/_/g, " "),
              browserZone: browserTimezone.replace(/_/g, " "),
            },
          )}
        </Callout>
      )}

      <Panel
        title={t("weekly.title", "Weekly schedule")}
        description={t(
          "weekly.description",
          "Tap a day to open it, then set when it starts and ends. Times are in {{zone}}.",
          { zone: timezone.replace(/_/g, " ") },
        )}
      >
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
              <Label htmlFor="open-hours-timezone" className="text-xs font-medium">
                {t("timezone", "Timezone")}
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="open-hours-timezone" className="w-64">
                  <SelectValue placeholder={t("timezonePlaceholder", "Select a timezone")} />
                </SelectTrigger>
                <SelectContent className="wy-console">
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
                      "flex flex-col gap-2.5 rounded-[var(--wy-radius)] border p-3 transition-colors",
                      d.open
                        ? "border-[var(--wy-border)] bg-[var(--wy-surface)]"
                        : "border-[var(--wy-border)] bg-[var(--wy-surface-2)]",
                      error && "border-[var(--wy-crit)]",
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
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--wy-radius)] text-[11px] font-semibold uppercase",
                            d.open
                              ? "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]"
                              : "bg-[var(--wy-offline-soft)] text-[var(--wy-offline)]",
                          )}
                        >
                          {t(`daysShort.${key}`, englishLabel.slice(0, 2))}
                        </span>
                        <span className="truncate text-[13px] font-medium">{label}</span>
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
                        aria-label={label}
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
                          <p role="alert" className="text-xs text-[var(--wy-crit)]">
                            {error}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setDay(key, { start: "00:00", end: "23:59" })}
                          className="rounded-sm text-xs font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                        >
                          {t("openAllDay", "Open all day")}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--wy-text-muted)]">
                        {t("closedAllDay", "Closed all day")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {!loading && (
        <FormSection
          columns={1}
          title={t("guestExperience.title", "Guest experience")}
          description={t(
            "guestExperience.description",
            "What guests see, and how strictly the schedule above is enforced.",
          )}
        >
          <FormSwitchRow
            label={t("enforce.title", "Enforce this schedule")}
            description={t(
              "enforce.description",
              "Outside open hours, guests are shown the closed message below instead of the sign-in page.",
            )}
            control={<Switch checked={enabled} onCheckedChange={setEnabled} />}
          />
          {/* Aruba Instant On: the time until closing caps the session time
              the access point enforces (V1, measured 2026-10-03), so "anyone
              already online stays online" is not true there. Renders nothing
              at any other vendor. */}
          <ControllerControlNotice verdict={nasOnlyLimitVerdict("open-hours", openHoursVendor)} />
          <FormField
            label={t("closedMessageLabel", "Message shown to guests while closed")}
            htmlFor="open-hours-closed-message"
          >
            <Textarea
              id="open-hours-closed-message"
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              placeholder={t("closedMessagePlaceholder", "We're currently closed.")}
              rows={3}
              className="resize-none"
            />
          </FormField>
        </FormSection>
      )}

      {/* Same controls again under the form: the page is long, and the
      closed message -- the last thing edited -- sits far below the
      header's Save. */}
      {!loading && saveActions}
    </div>
  );
}

/* ---------- ISP Details ----------
 * Moved to `@/components/customer/isp/` (the console revamp). Re-exported
 * here so every lazy import site (`lazyView(OPS, "IspDetailsView")`) keeps
 * resolving unchanged. */
export { IspDetailsView } from "@/components/customer/isp/IspDetailsView";

/* ---------- Admin Logs ---------- */

/** A log section with zero real rows: the console EmptyState, one line. */
function LogsEmptyState({ label }: { label: string }) {
  return <EmptyState compact icon={ScrollText} title={label} />;
}

/** The console pager under a log table (server-side pages). */
function LogsPager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="px-4 py-3">
      <NumberedPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

export function AdminLogsView({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
  // `tNav`, not `t`: this view already uses `t` as the tab loop variable.
  const { t: tNav } = useTranslation("nav", { i18n });
  const { t: tLog } = useTranslation("staffActivity", { i18n });
  const when = (row: { at?: string; time: string }) =>
    row.at ? formatRelative(row.at, i18n.language, { style: "short" }) : row.time;
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

  // The page's one header, shared by the owner view and the owner-only gate.
  const header = (
    <PageHeader
      title={scope?.title ?? tNav("customerItem.admin-logs", "Staff Activity")}
      venue={scope?.venue}
      description={tLog(
        "description",
        "Who logged into the dashboard and when, router activity, and account changes across every location.",
      )}
    />
  );

  if (role !== "owner") {
    return (
      <div className="wy-console space-y-5">
        {header}
        <Panel>
          <EmptyState
            icon={ShieldAlert}
            title={tLog("ownerOnly", "Owner access only")}
            description={tLog(
              "ownerOnlyBody",
              "Staff Activity shows who signed in and what they changed across the whole organization. Only the organization owner can see this page.",
            )}
          />
        </Panel>
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
      label: tLog("tabs.logins", "Dashboard sign-ins"),
      icon: KeyRound,
      count: loginsQuery.data?.meta.totalItems ?? logins.length,
    },
    {
      id: "router",
      label: tLog("tabs.router", "Router events"),
      icon: Router,
      count: routerQuery.data?.meta.totalItems ?? routerLogs.length,
    },
    {
      id: "activity",
      label: tLog("tabs.activity", "Account changes"),
      icon: History,
      count: activityQuery.data?.meta.totalItems ?? accountActivity.length,
    },
  ];

  return (
    <div className="wy-console space-y-5">
      {header}

      {/* Three views with their counts: the console's underline SubTabs. */}
      <SubTabs
        ariaLabel={tLog("ariaLog", "Staff activity log")}
        idPrefix="staff-activity"
        value={section}
        onChange={setSection}
        options={TABS.map((t) => ({ value: t.id, label: t.label, count: t.count }))}
      />

      <div
        role="tabpanel"
        id="staff-activity-panel"
        aria-labelledby={`staff-activity-tab-${section}`}
      >
        {section === "logins" && (
          <Panel title={tLog("tabs.logins", "Dashboard sign-ins")} flush>
            <DataTable
              ariaLabel={tLog("tabs.logins", "Dashboard sign-ins")}
              rows={logins}
              rowKey={(l) => l.id}
              loading={loginsQuery.isLoading}
              loadingLabel={
                <div className="p-4 text-left">
                  <LoadingSkeleton rows={5} />
                </div>
              }
              empty={
                <LogsEmptyState
                  label={tLog(
                    "emptyLogins",
                    "No dashboard sign-ins yet — sign-ins for this organization will appear here.",
                  )}
                />
              }
              columns={[
                {
                  id: "email",
                  header: tLog("col.email", "Email"),
                  mobile: "title",
                  className: "font-medium",
                  cell: (l) => l.email,
                },
                {
                  id: "ip",
                  header: tLog("col.ip", "IP address"),
                  mono: true,
                  className: "text-[var(--wy-text-muted)]",
                  cell: (l) => l.ipAddress,
                },
                {
                  id: "result",
                  header: tLog("col.result", "Result"),
                  cell: (l) => (
                    <StatusBadge status={l.success ? "ok" : "crit"}>
                      {l.success
                        ? tLog("success", "Success")
                        : (l.failureReason ?? tLog("failed", "Failed"))}
                    </StatusBadge>
                  ),
                },
                {
                  id: "when",
                  header: tLog("col.when", "When"),
                  className: "text-[var(--wy-text-muted)]",
                  cell: (l) => when(l),
                },
              ]}
              footer={
                loginsTotalPages > 1 ? (
                  <LogsPager
                    page={loginsPage}
                    totalPages={loginsTotalPages}
                    onPageChange={setLoginsPage}
                  />
                ) : undefined
              }
            />
          </Panel>
        )}

        {section === "router" && (
          <Panel title={tLog("routerTitle", "Router events by location")} flush>
            <DataTable
              ariaLabel={tLog("routerTitle", "Router events by location")}
              rows={routerLogs}
              rowKey={(e) => e.id}
              loading={routerQuery.isLoading}
              loadingLabel={
                <div className="p-4 text-left">
                  <LoadingSkeleton rows={5} />
                </div>
              }
              empty={
                <LogsEmptyState
                  label={tLog(
                    "emptyRouter",
                    "No router events yet — router activity across your locations will appear here.",
                  )}
                />
              }
              columns={[
                {
                  id: "location",
                  header: tLog("col.location", "Location"),
                  mobile: "title",
                  className: "font-medium",
                  cell: (e) => e.locationName,
                },
                {
                  id: "router",
                  header: tLog("col.router", "Router"),
                  className: "text-[var(--wy-text-muted)]",
                  cell: (e) => e.routerName,
                },
                {
                  id: "event",
                  header: tLog("col.event", "Event"),
                  cell: (e) => (
                    <StatusBadge status={e.isError ? "crit" : "offline"} className="capitalize">
                      {e.eventType.replace(/_/g, " ")}
                    </StatusBadge>
                  ),
                },
                {
                  id: "message",
                  header: tLog("col.message", "Message"),
                  className: "whitespace-normal text-[var(--wy-text-muted)]",
                  cell: (e) => e.message ?? "—",
                },
                {
                  id: "when",
                  header: tLog("col.when", "When"),
                  className: "text-[var(--wy-text-muted)]",
                  cell: (e) => when(e),
                },
              ]}
              footer={
                routerTotalPages > 1 ? (
                  <LogsPager
                    page={routerPage}
                    totalPages={routerTotalPages}
                    onPageChange={setRouterPage}
                  />
                ) : undefined
              }
            />
          </Panel>
        )}

        {/* Real administrative change-audit trail (role assignments,
          location/member changes, etc.) -- what used to be the standalone
          "Audit Log" tab, now merged in here as its own section rather than
          kept as a second nav entry. Same real /audit/entries data
          (app.domains.audit), same real server-side pagination as the two
          sections above -- see customer.service.ts's own
          getAdminLogsAccountActivity comment. Fetched with
          exclude_view_events=true, so this is only real changes -- never
          the "*_viewed" access-logging noise that would otherwise bury it. */}
        {section === "activity" && (
          <Panel title={tLog("tabs.activity", "Account changes")} flush>
            <DataTable
              ariaLabel={tLog("tabs.activity", "Account changes")}
              rows={accountActivity}
              rowKey={(a) => a.id}
              loading={activityQuery.isLoading}
              loadingLabel={
                <div className="p-4 text-left">
                  <LoadingSkeleton rows={5} />
                </div>
              }
              empty={
                <LogsEmptyState
                  label={tLog(
                    "emptyActivity",
                    "No account changes yet — role assignments and account or settings changes across your organization will appear here.",
                  )}
                />
              }
              columns={[
                {
                  id: "change",
                  header: tLog("col.change", "Change"),
                  mobile: "title",
                  className: "whitespace-normal",
                  cell: (a) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={actionTone(a.action)} dot={false}>
                        {formatAuditAction(a.action)}
                      </StatusBadge>
                      {a.description && <span>{a.description}</span>}
                    </div>
                  ),
                },
                {
                  id: "actor",
                  header: tLog("col.actor", "Done by"),
                  className: "text-[var(--wy-text-muted)]",
                  cell: (a) => (a.actor === "System" ? tLog("system", "System") : a.actor),
                },
                {
                  id: "when",
                  header: tLog("col.when", "When"),
                  className: "text-[var(--wy-text-muted)]",
                  cell: (a) => when(a),
                },
              ]}
              footer={
                activityTotalPages > 1 ? (
                  <LogsPager
                    page={activityPage}
                    totalPages={activityTotalPages}
                    onPageChange={setActivityPage}
                  />
                ) : undefined
              }
            />
          </Panel>
        )}
      </div>
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

/** Tones the action badge by what kind of change it was -- destructive
 * (removed/deleted/revoked/deactivated/archived) reads as crit, additive
 * (created/assigned/added/approved/activated) as ok, everything else
 * (updated/changed/published/...) as the neutral grey -- the same
 * create/destructive/neutral language the two tables above this one
 * already use for their own status badges. */
function actionTone(action: string): ConsoleStatus {
  if (/removed|deleted|revoked|deactivated|archived|rejected|denied/.test(action)) return "crit";
  if (/created|assigned|added|approved|activated|invited|accepted|published/.test(action)) {
    return "ok";
  }
  return "offline";
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

export function MacAuthView({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
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
    <div className="wy-console space-y-5">
      <PageHeader
        title={scope?.title ?? t("title", "Trusted Devices")}
        venue={scope?.venue}
        description={t(
          "description",
          "Let a few of your own devices onto the WiFi without signing in.",
        )}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setMacError(null);
              setExpiryError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("addDevice", "Add device")}
          </Button>
        }
      />
      <Panel
        flush
        title={t("list.title", "Trusted devices")}
        description={t(
          "list.description",
          "Devices that connect straight to the WiFi without seeing the sign-in screen.",
        )}
      >
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
            action={
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                {t("list.tryAgain", "Try again")}
              </Button>
            }
          />
        ) : (
          <DataTable
            ariaLabel={t("list.title", "Trusted devices")}
            rows={entries}
            rowKey={(e) => e.id}
            empty={
              <EmptyState
                icon={Shield}
                title={t("list.emptyTitle", "No trusted devices yet")}
                description={t(
                  "list.emptyBody",
                  'Click "Add device" above to let one of your own devices skip the sign-in screen.',
                )}
              />
            }
            actionsLabel={t("col.action", "Action")}
            columns={[
              {
                id: "mac",
                header: t("col.address", "Device address"),
                mono: true,
                mobile: "title",
                cell: (e) => e.mac,
              },
              {
                id: "access",
                header: t("col.access", "Access"),
                cell: (e) =>
                  e.type === "temporary"
                    ? t("access.untilDate", "Until a date")
                    : t("access.always", "Always"),
              },
              // A row saved before the dialog collected an expiry can be
              // temporary with no date at all. That used to render as
              // "Never" -- the same word a genuinely permanent entry gets --
              // which read as a deliberate choice rather than as missing
              // data. Say which it is.
              {
                id: "ends",
                header: t("col.ends", "Ends"),
                className: "text-[var(--wy-text-muted)]",
                cell: (e) =>
                  e.expiresAt
                    ? formatDateTime(e.expiresAt, i18n.language)
                    : e.type === "temporary"
                      ? t("ends.notSet", "Not set — never ends")
                      : t("ends.never", "Never"),
              },
              {
                id: "note",
                header: t("col.note", "Note"),
                className: "text-[var(--wy-text-muted)]",
                cell: (e) => e.comment || "—",
              },
              // The state is said in words, not only by the switch's colour.
              {
                id: "active",
                header: t("col.active", "Active"),
                cell: (e) => (
                  <span className="inline-flex items-center gap-2">
                    <Switch
                      checked={e.enabled}
                      onCheckedChange={() => toggleEntry(e)}
                      aria-label={t("toggleAria", "Trusted access for {{mac}}", { mac: e.mac })}
                    />
                    <StatusBadge status={e.enabled ? "ok" : "offline"}>
                      {e.enabled ? t("state.on", "On") : t("state.off", "Off")}
                    </StatusBadge>
                  </span>
                ),
              },
            ]}
            rowActions={(e) => (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--wy-text-muted)] hover:text-[var(--wy-crit)]"
                aria-label={t("removeAria", "Remove {{mac}}", { mac: e.mac })}
                title={t("removeAria", "Remove {{mac}}", { mac: e.mac })}
                onClick={() => removeEntry(e)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}
          />
        )}
      </Panel>

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
        <DialogContent className="wy-console sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("dialog.title", "Add a trusted device")}</DialogTitle>
            <DialogDescription>
              {t(
                "dialog.description",
                "This device connects straight to the WiFi without the sign-in screen.",
              )}
            </DialogDescription>
          </DialogHeader>
          <FormSection variant="plain" columns={1}>
            {/* "MAC Address" was the bare label on every control here while
              the page header already said "Trusted Devices" -- the plain-
              English rename reached the title and never reached the form.
              The term itself has to stay somewhere: it is the exact
              phrase printed in a phone's WiFi settings, which is where
              the owner has to go to read this value off. So: plain-
              English label, technical term in the hint that tells them
              where to find it. */}
            <FormField
              label={t("dialog.address", "Device address")}
              htmlFor="trusted-device-mac"
              error={macError}
              hint={t(
                "dialog.addressHint",
                "Its MAC address — find it under WiFi settings on the device itself. Dashes, spaces, or no separators are fine too, e.g. AA-BB-CC-DD-EE-FF.",
              )}
            >
              <Input
                id="trusted-device-mac"
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
            </FormField>
            <FormField
              label={t("dialog.allowAccess", "Allow access")}
              htmlFor="trusted-device-access"
            >
              <Select
                value={form.type}
                onValueChange={(v) => {
                  setForm({ ...form, type: v, expiresAt: v === "permanent" ? "" : form.expiresAt });
                  setExpiryError(null);
                }}
              >
                <SelectTrigger id="trusted-device-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="wy-console">
                  <SelectItem value="permanent">{t("access.always", "Always")}</SelectItem>
                  <SelectItem value="temporary">{t("access.untilDate", "Until a date")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {form.type === "temporary" && (
              <FormField
                label={t("dialog.accessEnds", "Access ends")}
                htmlFor="trusted-device-ends"
                error={expiryError}
                hint={t(
                  "dialog.accessEndsHint",
                  "After this the device signs in like any other guest.",
                )}
              >
                <Input
                  id="trusted-device-ends"
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
              </FormField>
            )}
            <FormField label={t("dialog.note", "Note (optional)")} htmlFor="trusted-device-note">
              <Input
                id="trusted-device-note"
                placeholder={t("dialog.notePlaceholder", "e.g. Front desk tablet")}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </FormField>
          </FormSection>
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
  scope,
}: { locationId?: string; masked?: boolean; scope?: PageScope } = {}) {
  return <FixAProblem locationId={locationId} masked={masked} scope={scope} />;
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

/* ---------- fallback for any not-yet-built feature ---------- */
export function GenericFeatureView({ feature }: { feature: string }) {
  const label = feature.replace(/-/g, " ");
  return (
    <div className="wy-console space-y-5">
      <PageHeader
        title={label.replace(/\b\w/g, (c) => c.toUpperCase())}
        description="This module is provisioned for your location."
      />
      <Panel>
        <EmptyState
          icon={Network}
          title="Not configured yet"
          description={`Configuration for ${label} will appear here.`}
        />
      </Panel>
    </div>
  );
}
