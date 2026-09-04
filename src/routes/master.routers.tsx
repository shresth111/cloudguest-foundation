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
} from "lucide-react";
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
import { routerService } from "@/services/router.service";
import { isDemo } from "@/services/customer.service";
import { useRouters, useUpdateRouterVendor } from "@/hooks/useRouters";
import type { AppError } from "@/services/api";
import type { RouterDevice } from "@/types/router";
import { deriveRouterLiveness, lastContactLabel } from "@/lib/location-liveness";

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

type Filter = "all" | "online" | "degraded" | "offline";

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
function displayStatus(r: RouterDevice, now: Date): "online" | "degraded" | "offline" {
  const live = deriveRouterLiveness(
    { id: r.id, name: r.name, status: r.status, last_seen_at: r.lastSeenAt },
    now,
  );
  // An unhealthy health check still demotes a router that is otherwise
  // live. It is independent evidence, and it was the one honest signal the
  // old implementation had.
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
      { id: r.id, name: r.name, status: r.status, last_seen_at: r.lastSeenAt },
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
}: {
  icon: typeof Power;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Real device control isn't wired up yet -- use Device Console for real commands."
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

  useEffect(() => {
    if (fleetQuery.isError) {
      toast.error("Could not load the router fleet from the server.");
    }
  }, [fleetQuery.isError]);

  function handleVendorChange(router: RouterDevice, vendor: string) {
    updateVendor.mutate(
      { id: router.id, vendor },
      {
        onSuccess: () => {
          setSel((prev) => (prev && prev.id === router.id ? { ...prev, vendor } : prev));
        },
        onError: (err) => {
          toast.error(err.message || "Could not update vendor");
        },
      },
    );
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
    for (const r of routers) {
      const s = displayStatus(r, now);
      if (s === "online") online++;
      else if (s === "degraded") degraded++;
      else offline++;
    }
    return { total: routers.length, online, degraded, offline };
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
  const LIVENESS_BADGE: Record<string, { label: string; tone: string }> = {
    online: { label: "Live", tone: "online" },
    "heartbeat-late": { label: "Check-in late", tone: "warning" },
    "went-silent": { label: "Gone quiet", tone: "offline" },
    "setup-not-started": { label: "Never checked in", tone: "offline" },
    suspended: { label: "Suspended", tone: "suspended" },
    retired: { label: "Retired", tone: "normal" },
    // Not "offline". An unreadable router is not a dead one, and painting
    // it red sends an operator to a site that may be perfectly fine.
    unknown: { label: "Can't tell", tone: "normal" },
  };
  const statusBadge = (r: RouterDevice) => {
    const live = deriveRouterLiveness(
      { id: r.id, name: r.name, status: r.status, last_seen_at: r.lastSeenAt },
      now,
    );
    return LIVENESS_BADGE[live.state] ?? { label: r.status, tone: "normal" };
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
            onVendorChange={(vendor) => handleVendorChange(advancedRouter, vendor)}
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

                Making the two agree needs the backend aggregate to join
                Location/Organization, which is not this repo. So the number
                here is labeled for what it can actually see. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MStat label="At active locations" value={summary.total} icon={RouterIcon} />
              <MStat label="Online" value={summary.online} tone="success" icon={CheckCircle2} />
              <MStat
                label="Degraded"
                value={summary.degraded}
                tone="warning"
                icon={AlertTriangle}
              />
              <MStat label="Offline" value={summary.offline} tone="danger" icon={WifiOff} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <MSeg
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "online", label: "Online" },
                  { value: "degraded", label: "Degraded" },
                  { value: "offline", label: "Offline" },
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
                      <span className="font-mono text-xs">{r.routerOsVersion ?? "—"}</span>
                    </MTd>
                    <MTd className="text-xs text-muted-foreground">{contactLabel(r, now)}</MTd>
                    <MTd>
                      <MTag label={statusBadge(r).label} tone={statusBadge(r).tone} />
                    </MTd>
                    {!demo && (
                      <MTd className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* THE ONLY PROVISIONING ENTRY POINT. This row
                           * carried three (Guided / Wizard / Advanced) and
                           * now carries one. The other two routes still
                           * exist but redirect here -- see
                           * `master.routers.guided.$routerId.tsx` and
                           * `master.routers.setup.$routerId.tsx` for why. */}
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
                      <p className="text-[11px] font-medium text-muted-foreground">RouterOS</p>
                      <p className="text-lg font-semibold">{sel.routerOsVersion ?? "—"}</p>
                    </div>
                  </div>

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
                      <select
                        className={inputCls}
                        value={sel.vendor || "mikrotik"}
                        disabled={updateVendor.isPending}
                        onChange={(e) => handleVendorChange(sel, e.target.value)}
                      >
                        {DEVICE_VENDORS.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!demo && (
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

                  {!demo && (sel.managementIpAddress || sel.publicIpAddress) && (
                    <RemoteAccessCard routerId={sel.id} />
                  )}

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Power</p>
                    <div className="grid grid-cols-2 gap-2">
                      <ControlButton
                        icon={Power}
                        label="Reboot"
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
                      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                        WireGuard tunnel, config rollback/backup, diagnostics, connected devices,
                        and the audit log all live on the full router screen.
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
      </MPageShell>
    </MasterShell>
  );
}
