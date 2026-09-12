import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  Search,
  Power,
  TerminalSquare,
  Router as RouterIcon,
  Loader2,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  WifiOff,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MSeg,
  MTag,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MButton,
  MStat,
} from "@/components/master/MasterKit";
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
import { RemoteAccessCard } from "@/components/routers/RouterDetailTabs";
import {
  DEVICE_VENDORS,
  inputCls,
  RouterSetupDrilldown,
} from "@/components/routers/RouterSetupScriptAdvanced";
import { VendorChangeDialog, VendorSelect } from "@/components/routers/VendorChangeGuard";
import type { PendingVendorChange } from "@/components/routers/VendorChangeGuard";
import { routerService } from "@/services/router.service";
import { isDemo } from "@/services/customer.service";
import { useRouters, useUpdateRouterVendor } from "@/hooks/useRouters";
import type { AppError } from "@/services/api";
import type { RouterDevice } from "@/types/router";
import type { NetworkIntegration } from "@/types/network-integration";
import { deriveRouterLiveness, lastContactLabel } from "@/lib/location-liveness";
import type { RouterLivenessState } from "@/lib/location-liveness";
import { isControllerManaged, routerVendorLabel } from "@/lib/router-vendors";
import { deriveIntegrationSetup } from "@/lib/network-integration-readiness";
import { networkIntegrationService } from "@/services/network-integration.service";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/master/routers")({
  // Same pattern as master.customers.tsx's `open` -- MasterSearch (the
  // header's real platform search) has nowhere to deep-link a router to but
  // this list's own local-state drawer (`sel` below), so it hands in the
  // router id here and this auto-selects it once the real fleet has loaded.
  // `advanced` (legacy alias `setup`) swaps the whole page into the
  // full-width setup script generator for that router instead of the
  // lightweight browse drawer -- shareable/bookmarkable deep links. It is
  // also where the retired `/master/routers/guided/$id` and
  // `/master/routers/setup/$id` routes now land, and where the customer
  // dashboard's "Setup Script has moved" button points.
  //
  // Not "legacy": this panel is the fleet's ONLY provisioning entry point
  // as of the Router Fleet cleanup. Calling it legacy in three places is
  // part of what sent operators to a wizard that cannot finish on a fresh
  // box.
  validateSearch: z.object({
    open: z.string().optional(),
    setup: z.string().optional(),
    advanced: z.string().optional(),
  }),
  component: RouterFleetRoute,
});

/** This route has children (`/master/routers/setup/$routerId` and
 * `/master/routers/guided/$routerId`) but `RouterFleetScreen` never
 * rendered an `<Outlet/>`, so navigating to one just re-rendered the
 * fleet list -- the child route was unreachable. Both children are
 * full-page surfaces, so when a child match exists this defers to it
 * entirely instead of embedding it below the list. Kept as a wrapper
 * component (not an early return inside `RouterFleetScreen`) so the
 * screen's own hooks never change order across renders.
 *
 * Both children are now redirect-only (they throw in `beforeLoad` and
 * land on `?advanced=<id>` here), so in practice no child ever renders.
 * The `<Outlet/>` stays anyway: it costs nothing, and it is what makes
 * this parent correct if a real child surface is ever added back. */
function RouterFleetRoute() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <RouterFleetScreen />;
}

type Filter = "all" | "online" | "degraded" | "offline" | "controller";

const FLEET_LIST_QUERY = {
  page: 1,
  pageSize: 200,
  search: "",
  status: "all" as const,
  organizationId: "all",
  locationId: "all",
};

/**
 * This table's 3-way filter, derived the same way the customer dashboard
 * derives it -- through `deriveRouterLiveness`, not from `r.status` alone.
 *
 * WHY THIS CANNOT READ `r.status === "online"` AND STOP THERE. `online` is
 * written by exactly one thing, `RouterService.heartbeat`, and NOTHING in
 * the backend ever writes it back to `offline` when the heartbeats stop --
 * there is no such beat task. `offline` is written in one place only:
 * reinstating a suspended router. So the previous version of this function
 * reported a router that died weeks ago as Online, indefinitely, on the
 * one screen whose whole job is to tell an operator which routers need
 * attention. Liveness has to come from `last_seen_at` staleness.
 *
 * `unknown` deliberately lands in `degraded` rather than `online`: this
 * filter has no fourth bucket, and the one thing an unreadable router must
 * never do is sit in the group an operator scrolls past.
 */
function displayStatus(
  r: RouterDevice,
  now: Date,
): "online" | "degraded" | "offline" | "controller" {
  const live = deriveRouterLiveness(
    { id: r.id, name: r.name, status: r.status, last_seen_at: r.lastSeenAt, vendor: r.vendor },
    now,
  );
  // An unhealthy health check still demotes a router that is otherwise
  // live. It is independent evidence, and it was the one honest signal the
  // old implementation had.
  // Contract §11.5. The fourth bucket exists because the three above are all
  // claims about a device this platform measures, and there is no honest
  // answer here among them: a controller-managed row is not online (nothing
  // proved it), not offline (nothing said it stopped), and emphatically not
  // degraded (nothing is wrong). Before this bucket existed it fell through
  // to `degraded` and every Omada venue sat permanently in the group an
  // operator is meant to act on -- which is how a "needs attention" filter
  // stops being read at all.
  if (live.state === "not-applicable") return "controller";
  if (live.status === "pass") return r.healthStatus === "unhealthy" ? "degraded" : "online";
  if (live.state === "setup-not-started" || live.state === "went-silent") return "offline";
  return "degraded";
}

/**
 * What the router's timestamp actually means, rather than what it looks
 * like. `lastContactLabel` distinguishes a heartbeat from the enrolment
 * handshake, because `RouterService.check_in` -- the provisioning-token
 * exchange -- stamps `last_seen_at` too, and the only transition OUT of
 * `provisioning` is a heartbeat. So on a provisioning router the timestamp
 * is by construction the enrolment, and calling it a check-in is the most
 * misleading thing this column could say.
 *
 * The previous comment here recorded that every real router had a NULL
 * `last_seen_at` and printed "Awaiting first check-in" for all of them.
 * That stopped being true the moment a router enrolled: the founder's hEX
 * carried a 3-hour-old timestamp having never once sent a heartbeat.
 */
function contactLabel(r: RouterDevice, now: Date): string {
  return lastContactLabel(
    deriveRouterLiveness(
      { id: r.id, name: r.name, status: r.status, last_seen_at: r.lastSeenAt, vendor: r.vendor },
      now,
    ),
    now,
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  disabledReason,
}: {
  icon: typeof Power;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why it is disabled, when it is disabled for a reason other than the
   * default one. A disabled control with no explanation is the thing this
   * screen keeps being fixed for; optional so every existing call site
   * keeps the wording it had. */
  disabledReason?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? (disabledReason ??
            "Real device control isn't wired up yet -- use Device Console for real commands.")
          : undefined
      }
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-background"
    >
      <Icon className="h-4 w-4 text-primary" /> {label}
    </button>
  );
}

function RouterFleetScreen() {
  const navigate = useNavigate();
  const {
    open: openRouterId,
    setup: setupRouterId,
    advanced: advancedRouterId,
  } = Route.useSearch();
  const advancedId = advancedRouterId ?? setupRouterId;
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<RouterDevice | null>(null);
  /** The vendor change waiting on a confirmation, or in flight. Null means
   * every vendor control shows the value the server last gave us. */
  const [vendorChange, setVendorChange] = useState<PendingVendorChange | null>(null);
  const [rebootTarget, setRebootTarget] = useState<RouterDevice | null>(null);
  const [rebooting, setRebooting] = useState(false);
  const demo = isDemo();

  // A TICKING CLOCK, NOT A RENDER-TIME `new Date()`. Liveness here is an
  // AGE, so a page left open on a wall display would otherwise freeze every
  // router at whatever it was when the query last resolved -- a router that
  // went quiet an hour ago would still read Live. One minute is finer than
  // the 5/15-minute thresholds it feeds, so a transition is never more than
  // a minute late, and it re-renders a list, not a fetch.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const fleetQuery = useRouters(FLEET_LIST_QUERY);
  const updateVendor = useUpdateRouterVendor();
  const routers = fleetQuery.data?.rows ?? [];
  const loading = fleetQuery.isLoading;

  /**
   * A controller row's real answer lives on its network integration, and the
   * worst thing that integration can be is half-configured: connected, and
   * authorising nobody (see `lib/network-integration-readiness.ts`). From
   * this table such a venue is indistinguishable from a working one -- a
   * controller row looks the same either way, by design, because nothing
   * here measures it.
   *
   * Fetched only when the fleet actually contains a controller, so a
   * MikroTik-only estate issues no extra cross-tenant request. `retry: false`
   * and no toast: an operator without `network_integrations.read` gets a 403,
   * and the honest response to "we could not look" is to say nothing extra,
   * not to raise an error about a feature they were not using.
   */
  const hasController = routers.some((r) => isControllerManaged(r.vendor));
  const integrations = useQuery({
    queryKey: ["master", "network-integrations", "fleet-join"],
    queryFn: () => networkIntegrationService.listPlatformIntegrations({ page: 1, pageSize: 200 }),
    enabled: !demo && hasController,
    staleTime: 30_000,
    retry: false,
  });

  /** locationId -> that venue's integrations. `null` -- not an empty map --
   * when we could not read them, so "no integration for this venue" and "we
   * did not look" stay different answers. */
  const integrationsByLocation = useMemo(() => {
    if (!integrations.data) return null;
    const map = new Map<string, NetworkIntegration[]>();
    for (const row of integrations.data.rows) {
      if (!row.locationId) continue;
      const at = map.get(row.locationId) ?? [];
      at.push(row);
      map.set(row.locationId, at);
    }
    return map;
  }, [integrations.data]);

  /** Whether that map is the WHOLE picture. One page of 200 covers every
   * estate this platform has today, but "I did not see it in the first 200"
   * is not the same fact as "it does not exist" -- and the difference decides
   * whether "No integration" below is a statement or a guess. */
  const sawEveryIntegration = integrations.data ? !integrations.data.hasNext : false;

  /**
   * What to say next to a controller row, or null for "nothing to add".
   *
   * Three genuinely different answers, and the third is the one that has to
   * stay separate: not knowing is not the same as knowing nothing is wrong.
   */
  function controllerWarning(r: RouterDevice): string | null {
    if (!isControllerManaged(r.vendor)) return null;
    if (!integrationsByLocation) return null; // we could not look
    const here = integrationsByLocation.get(r.locationId) ?? [];
    // Absence is only evidence when the list was complete. Otherwise this
    // says nothing rather than accusing a working venue of having no
    // integration at all.
    if (here.length === 0) return sawEveryIntegration ? "No integration" : null;
    return here.every((i) => deriveIntegrationSetup(i).isHalfConfigured)
      ? "Authorising nobody"
      : null;
  }

  useEffect(() => {
    if (fleetQuery.isError) {
      toast.error("Could not load the router fleet from the server.");
    }
  }, [fleetQuery.isError]);

  /**
   * Asking to change a vendor, which is now all a `<select>` can do.
   *
   * Until 2026-09-11 this WAS the write: `onChange` went straight to
   * `PUT /routers/{id}`, with no confirmation and no undo. Looking for the
   * TP-Link option, the platform owner relabelled seven real rows --
   * including the live lab hEX lite -- as `tplink_omada`, and each one
   * silently left the online fleet count, lost its setup script and had
   * reboot and every other agent action disabled. See
   * `@/lib/router-vendor-change` for the full list and for the rules the
   * dialog enforces.
   *
   * Both vendor controls on this page (the drilldown's, and the fleet
   * drawer's) funnel through here, so there is exactly one place that can
   * write a vendor and exactly one guard in front of it.
   */
  function requestVendorChange(router: RouterDevice, vendor: string) {
    // A "change" to the value already stored is not a change, and must not
    // put a confirmation in front of someone who selected what was already
    // selected -- that is how guards get trained out of people.
    if (vendor === (router.vendor || "mikrotik")) return;
    setVendorChange({ router, next: vendor, phase: "confirming" });
  }

  function commitVendorChange() {
    if (!vendorChange) return;
    const { router, next } = vendorChange;
    // Stays set, as `saving`, for the whole request: it is what keeps the
    // dropdown showing the value being written instead of flicking back to
    // the old one and then forward again when the list refetches.
    setVendorChange({ router, next, phase: "saving" });
    updateVendor.mutate(
      { id: router.id, vendor: next },
      {
        onSuccess: () => {
          setSel((prev) => (prev && prev.id === router.id ? { ...prev, vendor: next } : prev));
          setVendorChange(null);
          toast.success(
            `${router.name}: vendor changed to ${routerVendorLabel(next)}. Nothing on the device changed.`,
          );
        },
        onError: (err) => {
          // Clearing the pending change is what reverts the dropdown: with
          // nothing pending it renders the server's value again, which the
          // failed request means is still the old one.
          setVendorChange(null);
          toast.error(err.message || "Could not update vendor");
        },
      },
    );
  }

  /** What the control for this row should display, or null for "the stored
   * value". */
  function pendingVendorFor(routerId: string): string | null {
    return vendorChange && vendorChange.router.id === routerId ? vendorChange.next : null;
  }

  const confirmReboot = async () => {
    if (!rebootTarget) return;
    setRebooting(true);
    try {
      await routerService.reboot(rebootTarget.id);
      toast.success(`${rebootTarget.name}: reboot command sent — back online in ~1-2 minutes`);
    } catch (err) {
      toast.error((err as AppError).message || "Could not reach the device to reboot it");
    } finally {
      setRebooting(false);
      setRebootTarget(null);
    }
  };

  useEffect(() => {
    if (!openRouterId || routers.length === 0) return;
    const match = routers.find((r) => r.id === openRouterId);
    if (match) setSel(match);
    navigate({ to: "/master/routers", search: {}, replace: true });
  }, [openRouterId, routers, navigate]);

  const rows = useMemo(
    () =>
      routers
        .filter((r) => (filter === "all" ? true : displayStatus(r, now) === filter))
        .filter(
          (r) =>
            !q ||
            `${r.name} ${r.managementIpAddress ?? ""} ${r.publicIpAddress ?? ""} ${r.organizationName} ${r.locationName}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        ),
    [routers, filter, q, now],
  );

  const summary = useMemo(() => {
    let online = 0;
    let degraded = 0;
    let offline = 0;
    let controller = 0;
    for (const r of routers) {
      const s = displayStatus(r, now);
      if (s === "online") online++;
      else if (s === "degraded") degraded++;
      else if (s === "controller") controller++;
      else offline++;
    }
    return { total: routers.length, online, degraded, offline, controller };
  }, [routers, now]);

  const advancedRouter = useMemo(
    () => (advancedId ? (routers.find((r) => r.id === advancedId) ?? null) : null),
    [advancedId, routers],
  );

  function goToAdvanced(id: string) {
    setSel(null);
    navigate({ to: "/master/routers", search: { advanced: id } });
  }

  function backToFleet() {
    navigate({ to: "/master/routers", search: {} });
  }

  const act = (msg: string) => toast.success(msg);
  // THE BADGE PRINTED THE RAW BACKEND STATUS, so a router that died weeks
  // ago rendered the literal word "online" -- the same lie as the filter
  // above, in the one cell an operator actually reads. It now says what is
  // true of the device, and `tone` follows the same verdict rather than
  // being decided separately (they disagreed: a router could read "online"
  // in grey-green while the summary counted it as offline).
  // KEYED BY THE UNION, NOT BY `string`, AND DELIBERATELY SO. As
  // `Record<string, ...>` this map compiled happily while missing entries,
  // and every miss fell through to the `?? { label: r.status }` fallback
  // below, which prints the raw backend enum. #258 filled in the one key it
  // needed (`not-applicable`) but left the hole itself open, so the SAME
  // defect was still live on `never-checked-in` -- an enrolled MikroTik
  // whose heartbeat has never arrived, which is the most common field
  // failure on this fleet and the exact case `location-liveness.ts` was
  // written for. It rendered the literal word `provisioning` to an operator.
  //
  // `Record<RouterLivenessState, ...>` makes tsc refuse this file if a state
  // is ever added to the union without a badge, so the next one cannot
  // repeat this quietly. Verified by deleting a key: tsc fails with TS2741.
  const LIVENESS_BADGE: Record<RouterLivenessState, { label: string; tone: string }> = {
    online: { label: "Live", tone: "online" },
    "heartbeat-late": { label: "Check-in late", tone: "warning" },
    "went-silent": { label: "Gone quiet", tone: "offline" },
    // The two never-been-up states are NOT interchangeable, and collapsing
    // them costs an operator the one thing this badge is for -- what to do
    // next. `setup-not-started` means the setup script was never run; the
    // job is to go run it. `never-checked-in` means enrolment succeeded and
    // the heartbeat never followed -- the "pasted the script, a syntax error
    // ate the Heartbeat block" failure this module exists for: the device is
    // on site and configured, and the job is to re-run that one block.
    //
    // Before this, `setup-not-started` wore the words "Never checked in"
    // while the state actually NAMED `never-checked-in` had no entry at all,
    // so the two were simultaneously indistinguishable and mislabelled.
    "never-checked-in": { label: "Never checked in", tone: "offline" },
    "setup-not-started": { label: "Setup not started", tone: "offline" },
    suspended: { label: "Suspended", tone: "suspended" },
    retired: { label: "Retired", tone: "normal" },
    // Not "offline". An unreadable router is not a dead one, and painting
    // it red sends an operator to a site that may be perfectly fine.
    unknown: { label: "Can't tell", tone: "normal" },
    // Contract §11.5, and the one key whose absence was itself the bug.
    // Without it `statusBadge` fell through to the `?? { label: r.status }`
    // below and printed the raw enum -- so a working Omada controller
    // rendered the literal string `pending_provisioning` in the Status cell
    // and again on the drawer's Status tile. Wording and tone match the
    // "Via controller" summary tile above: neutral, because these rows are
    // neither healthy nor unhealthy from here and colouring them either way
    // asserts a measurement nobody took.
    "not-applicable": { label: "Via controller", tone: "normal" },
  };
  const statusBadge = (r: RouterDevice) => {
    const live = deriveRouterLiveness(
      { id: r.id, name: r.name, status: r.status, last_seen_at: r.lastSeenAt, vendor: r.vendor },
      now,
    );
    // No `??` fallback any more. It was there to catch a missing key, but a
    // fallback that prints `r.status` turns a rendering gap into a leaked
    // database enum on the operator's screen -- it is the mechanism of this
    // bug, not a safety net. With the map keyed by the union there is no key
    // to miss, and the compiler is what catches the next one.
    return LIVENESS_BADGE[live.state];
  };

  return (
    <MasterShell title="Router Fleet">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title={advancedRouter ? `Advanced setup script — ${advancedRouter.name}` : "Router Fleet"}
          actions={
            advancedRouter ? (
              <MButton variant="outline" onClick={backToFleet}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Router Fleet
              </MButton>
            ) : undefined
          }
        />

        {advancedId && !advancedRouter ? (
          loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading router…
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <p>Couldn't find that router -- it may have been removed.</p>
              <MButton variant="outline" onClick={backToFleet}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Router Fleet
              </MButton>
            </div>
          )
        ) : advancedRouter ? (
          <RouterSetupDrilldown
            router={advancedRouter}
            demo={demo}
            vendorSaving={updateVendor.isPending}
            vendorPending={pendingVendorFor(advancedRouter.id)}
            onVendorChange={(vendor) => requestVendorChange(advancedRouter, vendor)}
          />
        ) : (
          <>
            {/* "At active locations", not "Total routers".
                This page and the Platform Overview / Global Analytics tiles
                disagree about the fleet size (8 here vs 11 there) and they are
                NOT the same quantity, so they must not be labeled as though
                they were. The two counts come from different places:

                  * /dashboard/super-admin/unified counts the `routers` table
                    directly -- `Router.is_deleted = False`, GROUP BY status,
                    with no join to Location or Organization at all
                    (AnalyticsRepository.count_routers_by_status).
                  * this page fans `GET /locations/{id}/routers` out over the
                    live organization -> location tree, and RouterService
                    .list_routers 404s for an archived location because its own
                    `get_location(..., include_deleted=False)` guard rejects it.

                Archiving a Location or an Organization soft-deletes that row
                but does NOT cascade to the `routers` underneath it, so those
                routers keep `is_deleted = False`: still counted platform-wide,
                and permanently unreachable from this screen. The gap is those
                orphans -- it is not access points (there is no device_type
                column anywhere in the backend; the "... AP 1" rows are
                ordinary `routers` rows and are counted identically by both
                paths) and it is not a page_size cap (this fetches 100 per
                location against single-digit real counts).

                The backend aggregate now performs that join (cloud-guest
                #134), so the two agree again -- Platform Overview reads 7/8
                against this page's 8, verified live on 2026-09-04. The label
                stays as it is anyway: it says what this number can actually
                see, which remains true whether or not the other tile happens
                to match today. The orphaned routers themselves still exist;
                they are excluded from both counts now rather than resolved. */}
            <div
              className={cn(
                "grid grid-cols-2 gap-3",
                summary.controller > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4",
              )}
            >
              <MStat label="At active locations" value={summary.total} icon={RouterIcon} />
              <MStat label="Online" value={summary.online} tone="success" icon={CheckCircle2} />
              <MStat
                label="Degraded"
                value={summary.degraded}
                tone="warning"
                icon={AlertTriangle}
              />
              <MStat label="Offline" value={summary.offline} tone="danger" icon={WifiOff} />
              {/* Contract §11.5. Shown only when the fleet actually has one,
               * and with no tone: these rows are neither healthy nor
               * unhealthy from here, and colouring them either way would be
               * this platform asserting something it never measured. The
               * live answer is on the venue's network integration. */}
              {summary.controller > 0 && (
                <MStat label="Via controller" value={summary.controller} icon={Server} />
              )}
            </div>

            {/* A short list and a complete one look identical, so say when
                it is short. `fetchAllRouters` keeps the page up when one
                location's read fails -- right -- but it used to drop those
                silently, and a router missing from a fleet list is the one
                thing nobody notices. */}
            {(fleetQuery.data?.unreachableLocationCount ?? 0) > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {fleetQuery.data?.unreachableLocationCount} location
                {fleetQuery.data?.unreachableLocationCount === 1 ? "" : "s"} could not be read, so
                any routers there are missing from this list. The counts above cover only what
                loaded.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <MSeg
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "online", label: "Online" },
                  { value: "degraded", label: "Degraded" },
                  { value: "offline", label: "Offline" },
                  // Only offered once there is something to filter to, so a
                  // MikroTik-only fleet's controls look exactly as they did.
                  ...(summary.controller > 0
                    ? [{ value: "controller" as const, label: "Controllers" }]
                    : []),
                ]}
              />
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, IP, customer…"
                  className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <MTable
              loading={loading}
              head={
                <>
                  <MTh>Router</MTh>
                  <MTh className="hidden md:table-cell">Model</MTh>
                  <MTh className="hidden sm:table-cell">Customer</MTh>
                  <MTh>RouterOS</MTh>
                  <MTh>Last seen</MTh>
                  <MTh>Status</MTh>
                  {!demo && <MTh className="text-right">Actions</MTh>}
                </>
              }
            >
              {!loading &&
                rows.map((r) => (
                  <MTr key={r.id} onClick={() => setSel(r)}>
                    <MTd>
                      <p className="font-semibold">{r.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.managementIpAddress ?? r.publicIpAddress ?? "IP not yet assigned"} ·{" "}
                        {r.locationName}
                      </p>
                    </MTd>
                    <MTd className="hidden text-sm md:table-cell">{r.model}</MTd>
                    <MTd className="hidden text-sm sm:table-cell">{r.organizationName}</MTd>
                    <MTd>
                      {/* A controller does not run RouterOS, so "—" (this
                          column's "we have no version on file") would put it
                          in the same cell as a MikroTik that simply has not
                          reported one yet. The drawer already refuses to
                          conflate those two -- it relabels the tile
                          "Software / On its controller" -- and this list,
                          which links to that drawer, must not disagree. */}
                      {isControllerManaged(r.vendor) ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="A controller does not run RouterOS. Its own software version lives on its controller."
                        >
                          Not applicable
                        </span>
                      ) : (
                        <span className="font-mono text-xs">{r.routerOsVersion ?? "—"}</span>
                      )}
                    </MTd>
                    <MTd className="text-xs text-muted-foreground">{contactLabel(r, now)}</MTd>
                    <MTd>
                      <div className="flex flex-wrap items-center gap-1">
                        <MTag label={statusBadge(r).label} tone={statusBadge(r).tone} />
                        {controllerWarning(r) && (
                          <MTag label={controllerWarning(r)!} tone="offline" />
                        )}
                      </div>
                    </MTd>
                    {!demo && (
                      <MTd className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* THE ONLY PROVISIONING ENTRY POINT. This row
                           * carried three (Guided / Wizard / Advanced) and
                           * now carries one. The other two routes still
                           * exist but redirect here -- see
                           * `master.routers.guided.$routerId.tsx` and
                           * `master.routers.setup.$routerId.tsx` for why.
                           *
                           * Not offered on a controller: it emits RouterOS
                           * for an agent that device will never run, which is
                           * the MikroTik-shaped detail drawer's defect one
                           * click away. */}
                          {!isControllerManaged(r.vendor) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToAdvanced(r.id);
                              }}
                              title="MikroTik setup script generator"
                              className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              <FileCode2 className="h-3 w-3" /> Advanced
                            </button>
                          )}
                        </div>
                      </MTd>
                    )}
                  </MTr>
                ))}
            </MTable>
            {!loading && rows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {routers.length === 0
                  ? "No routers provisioned yet."
                  : "No routers match your filter."}
              </p>
            )}

            <MDrawer
              open={!!sel}
              onClose={() => setSel(null)}
              title={sel?.name ?? ""}
              subtitle={
                sel
                  ? `${sel.model} · ${sel.managementIpAddress ?? sel.publicIpAddress ?? "IP not yet assigned"} · ${sel.organizationName} / ${sel.locationName}`
                  : ""
              }
              footer={
                sel &&
                (demo ? (
                  <MButton
                    variant="primary"
                    className="w-full justify-center"
                    onClick={() => act(`Opening remote console for ${sel.name}`)}
                  >
                    <TerminalSquare /> Open Device Console
                  </MButton>
                ) : (
                  <Link to="/master/console" className="w-full">
                    <MButton variant="primary" className="w-full justify-center">
                      <TerminalSquare /> Open Device Console
                    </MButton>
                  </Link>
                ))
              }
            >
              {sel && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                      <p className="text-lg font-semibold">{statusBadge(sel).label}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Last seen</p>
                      <p className="text-lg font-semibold tabular-nums">{contactLabel(sel, now)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {isControllerManaged(sel.vendor) ? "Software" : "RouterOS"}
                      </p>
                      <p className="text-lg font-semibold">
                        {isControllerManaged(sel.vendor)
                          ? "On its controller"
                          : (sel.routerOsVersion ?? "—")}
                      </p>
                    </div>
                  </div>

                  {/* The controller row itself can say almost nothing true
                      (contract §11.5). What it CAN say is whether the venue's
                      integration is actually letting anyone on. */}
                  {controllerWarning(sel) && (
                    <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs">
                      <p className="font-medium text-destructive">{controllerWarning(sel)}</p>
                      <p className="text-muted-foreground">
                        {controllerWarning(sel) === "No integration"
                          ? "This controller is registered in the fleet but this venue has no network integration, so nothing authorises its guests at all."
                          : "This venue's network integration was connected and never finished, so guests here can complete the whole sign-in and still have no internet."}
                      </p>
                      <Link to="/master/integrations" search={{ q: sel.locationName || sel.name }}>
                        <MButton variant="outline" className="mt-1">
                          Open network integration
                        </MButton>
                      </Link>
                    </div>
                  )}

                  {!demo && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                      Restart/Upgrade/Sync Config aren't wired to real device control yet -- use
                      Device Console for those. Reboot is real.
                    </p>
                  )}

                  {!demo && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Vendor
                      </label>
                      <VendorSelect
                        className={inputCls}
                        value={sel.vendor || "mikrotik"}
                        pending={pendingVendorFor(sel.id)}
                        vendors={DEVICE_VENDORS}
                        disabled={updateVendor.isPending}
                        onRequestChange={(vendor) => requestVendorChange(sel, vendor)}
                      />
                    </div>
                  )}

                  {!demo && !isControllerManaged(sel.vendor) && (
                    <div className="space-y-2">
                      <MButton
                        variant="primary"
                        className="w-full justify-center"
                        onClick={() => goToAdvanced(sel.id)}
                      >
                        <FileCode2 className="h-4 w-4" /> Advanced setup script
                      </MButton>
                    </div>
                  )}

                  {/* Remote access (WinBox/SSH over the platform's own
                      tunnel) is an agent verb: it reaches the device through
                      the hub, and a controller has no peer and never will --
                      `wireguard/validators.py` refuses to allocate one with a
                      422. Not merely hidden: mounting `RemoteAccessCard`
                      would also fire its own read at a router that cannot
                      answer. Replaced with the reason, per §11.5's rule that
                      an excluded affordance is named rather than vanished. */}
                  {!demo &&
                    (sel.managementIpAddress || sel.publicIpAddress) &&
                    (isControllerManaged(sel.vendor) ? (
                      <p className="rounded-lg border border-border p-2.5 text-xs text-muted-foreground">
                        Remote access runs over this platform's own tunnel to the router agent. A{" "}
                        {routerVendorLabel(sel.vendor)} controller runs no agent and has no tunnel,
                        so there is nothing here to connect to. Reach it through its own controller.
                      </p>
                    ) : (
                      <RemoteAccessCard routerId={sel.id} />
                    ))}

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Power</p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Disabled, not removed. `POST /routers/{id}/reboot`
                          is an agent command, and its own confirm copy
                          promises to "immediately restart the physical
                          device" -- which for a controller row is a promise
                          about hardware this platform cannot touch. An
                          operator who cannot find Reboot files a ticket; one
                          who sees why it is greyed out does not. */}
                      <ControlButton
                        icon={Power}
                        label="Reboot"
                        disabled={isControllerManaged(sel.vendor)}
                        disabledReason={`Reboot is sent to the router agent, which a ${routerVendorLabel(sel.vendor)} controller does not run. Restart it from its own controller.`}
                        onClick={() =>
                          demo ? act(`${sel.name}: reboot queued`) : setRebootTarget(sel)
                        }
                      />
                    </div>
                  </div>

                  {!demo && (
                    <Link to="/routers/$routerId" params={{ routerId: sel.id }} className="block">
                      <MButton variant="outline" className="w-full justify-center">
                        Manage this router <RouterIcon className="h-3.5 w-3.5" />
                      </MButton>
                      {/* This subtitle advertised the destination's eleven
                          tabs. For a controller the destination renders two
                          (`CONTROLLER_MANAGED_TAB_KEYS`), and every single
                          thing named here is one of the nine it drops -- so
                          the button promised four features and delivered
                          none of them, one click away. */}
                      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                        {isControllerManaged(sel.vendor)
                          ? "The full router screen carries this controller's own record and its audit log. Tunnel, config rollback, diagnostics and connected devices are agent features and do not apply to a controller."
                          : "WireGuard tunnel, config rollback/backup, diagnostics, connected devices, and the audit log all live on the full router screen."}
                      </p>
                    </Link>
                  )}
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RouterIcon className="h-3.5 w-3.5" /> Safe business-level operations only.
                  </p>
                </div>
              )}
            </MDrawer>
          </>
        )}

        <AlertDialog
          open={!!rebootTarget}
          onOpenChange={(o) => !o && !rebooting && setRebootTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reboot {rebootTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This immediately restarts the physical device. Every guest currently connected at{" "}
                {rebootTarget?.locationName} will be disconnected, and the router will be
                unreachable for its normal 1-2 minute boot cycle. Use with caution — this cannot be
                undone once sent.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={rebooting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmReboot();
                }}
                disabled={rebooting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {rebooting ? "Rebooting…" : "Reboot device"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* One guard for both vendor controls on this page -- the drilldown's
            and the fleet drawer's -- because there is one handler behind
            them. A second copy is a second place to get the wording wrong. */}
        <VendorChangeDialog
          change={vendorChange}
          onConfirm={commitVendorChange}
          onCancel={() => setVendorChange(null)}
        />
      </MPageShell>
    </MasterShell>
  );
}
