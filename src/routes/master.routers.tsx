import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Workflow,
  WifiOff,
  Compass,
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

export const Route = createFileRoute("/master/routers")({
  // Same pattern as master.customers.tsx's `open` -- MasterSearch (the
  // header's real platform search) has nowhere to deep-link a router to but
  // this list's own local-state drawer (`sel` below), so it hands in the
  // router id here and this auto-selects it once the real fleet has loaded.
  // `advanced` (legacy alias `setup`) swaps the whole page into the
  // full-width legacy script generator for that router instead of the
  // lightweight browse drawer -- shareable/bookmarkable deep links.
  validateSearch: z.object({
    open: z.string().optional(),
    setup: z.string().optional(),
    advanced: z.string().optional(),
  }),
  component: RouterFleetScreen,
});

type Filter = "all" | "online" | "degraded" | "offline";

const FLEET_LIST_QUERY = {
  page: 1,
  pageSize: 200,
  search: "",
  status: "all" as const,
  organizationId: "all",
  locationId: "all",
};

/** Real router.status values collapse to this table's 3-way filter --
 * "degraded" covers everything that isn't cleanly online or fully offline
 * (provisioning, suspended, an unhealthy health check, etc.). */
function displayStatus(r: RouterDevice): "online" | "degraded" | "offline" {
  if (r.status === "offline" || r.status === "decommissioned") return "offline";
  if (r.status === "online" && r.healthStatus !== "unhealthy") return "online";
  return "degraded";
}

function timeAgo(iso: string | null): string {
  // Honestly still means "no check-in has ever been recorded" -- every real
  // router on this platform is in this state today, since none has yet
  // completed the router-agent enrollment/heartbeat flow (confirmed against
  // real data: 0 rows in `heartbeat_logs`, every real `Router` row has a
  // NULL `last_seen_at`). "Awaiting first check-in" reads as the expected,
  // pre-connection state a freshly-provisioned router sits in rather than
  // as a dead/broken one -- without inventing a check-in that never
  // happened.
  if (!iso) return "Awaiting first check-in";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
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
        .filter((r) => (filter === "all" ? true : displayStatus(r) === filter))
        .filter(
          (r) =>
            !q ||
            `${r.name} ${r.managementIpAddress ?? ""} ${r.publicIpAddress ?? ""} ${r.organizationName} ${r.locationName}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        ),
    [routers, filter, q],
  );

  const summary = useMemo(() => {
    let online = 0;
    let degraded = 0;
    let offline = 0;
    for (const r of routers) {
      const s = displayStatus(r);
      if (s === "online") online++;
      else if (s === "degraded") degraded++;
      else offline++;
    }
    return { total: routers.length, online, degraded, offline };
  }, [routers]);

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
  const statusLabel = (r: RouterDevice) =>
    r.status === "pending_provisioning" ? "Awaiting check-in" : r.status;

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MStat label="Total routers" value={summary.total} icon={RouterIcon} />
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
                    <MTd className="text-xs text-muted-foreground">{timeAgo(r.lastSeenAt)}</MTd>
                    <MTd>
                      <MTag
                        label={statusLabel(r)}
                        tone={r.status === "pending_provisioning" ? "pending" : undefined}
                      />
                    </MTd>
                    {!demo && (
                      <MTd className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to="/master/routers/guided/$routerId"
                            params={{ routerId: r.id }}
                            onClick={(e) => e.stopPropagation()}
                            title="Guided Setup -- ek phase, copy, Haan/Nahi. Naye router ke liye yahi use karo."
                            className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <Compass className="h-3 w-3" /> Guided
                          </Link>
                          <Link
                            to="/master/routers/setup/$routerId"
                            params={{ routerId: r.id }}
                            onClick={(e) => e.stopPropagation()}
                            title="Server-driven provisioning wizard (needs a live agent + tunnel)"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary hover:bg-accent hover:text-foreground"
                          >
                            <Workflow className="h-3 w-3" /> Wizard
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToAdvanced(r.id);
                            }}
                            title="Legacy expert MikroTik script generator"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary hover:bg-accent hover:text-foreground"
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
                      <p className="text-lg font-semibold capitalize">{statusLabel(sel)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Last seen</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {timeAgo(sel.lastSeenAt)}
                      </p>
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
                      <Link
                        to="/master/routers/guided/$routerId"
                        params={{ routerId: sel.id }}
                        className="block"
                      >
                        <MButton variant="primary" className="w-full justify-center">
                          <Compass className="h-4 w-4" /> Guided Setup (recommended)
                        </MButton>
                      </Link>
                      <Link
                        to="/master/routers/setup/$routerId"
                        params={{ routerId: sel.id }}
                        className="block"
                      >
                        <MButton variant="outline" className="w-full justify-center">
                          <Workflow className="h-4 w-4" /> Provisioning wizard
                        </MButton>
                      </Link>
                      <MButton
                        variant="outline"
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
