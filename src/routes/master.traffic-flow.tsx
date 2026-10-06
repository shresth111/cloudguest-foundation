import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2, RefreshCw, Settings2, Waypoints } from "lucide-react";
import { MasterShell, useOperatorCaps } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
  MDialog,
  MEmptyState,
  MSeg,
} from "@/components/master/MasterKit";
import { trafficFlowService } from "@/services/traffic-flow.service";
import { formatBytes } from "@/lib/traffic-flow";
import {
  TRAFFIC_FLOW_STATE_HELP,
  TRAFFIC_FLOW_STATE_LABEL,
  TRAFFIC_FLOW_STATE_TONE,
  type TrafficFlowApplyResult,
  type TrafficFlowConfigPreview,
  type TrafficFlowOverview,
  type TrafficFlowRouter,
} from "@/types/traffic-flow";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master/traffic-flow")({
  component: TrafficFlowScreen,
});

type Period = "60" | "360" | "1440";
const PERIODS: { value: Period; label: string }[] = [
  { value: "60", label: "Last hour" },
  { value: "360", label: "6 h" },
  { value: "1440", label: "24 h" },
];

function errMsg(err: unknown, fallback: string) {
  return (err as AppError)?.message || fallback;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const MATCH_LABEL = {
  session: "Guest session",
  ambiguous: "Ambiguous (IP reused)",
  none: "Not a guest session",
} as const;

function TrafficFlowScreen() {
  const caps = useOperatorCaps();
  const [period, setPeriod] = useState<Period>("60");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overview, setOverview] = useState<TrafficFlowOverview | null>(null);
  const [configFor, setConfigFor] = useState<TrafficFlowRouter | null>(null);

  async function refetch(p: Period = period) {
    setLoading(true);
    setLoadError(null);
    try {
      setOverview(await trafficFlowService.overview(Number(p)));
    } catch (err) {
      // Never fall back to an empty table: an error reads as an error.
      setOverview(null);
      setLoadError(errMsg(err, "Could not load traffic flow data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <MasterShell title="Traffic Flow">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title="Traffic Flow (NetFlow / IPFIX)"
          description="Top talkers and top destinations per venue, from MikroTik traffic-flow export. Operator-only."
          actions={
            <>
              <MSeg options={PERIODS} value={period} onChange={setPeriod} />
              <MButton variant="outline" onClick={() => refetch()} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
              </MButton>
            </>
          }
        />

        <HonestyNote />

        {loadError && (
          <Banner tone="error" title="Traffic flow data could not be loaded">
            {loadError}
          </Banner>
        )}

        {overview && <PipelineStatus overview={overview} />}

        {!loading && overview && overview.routers.length === 0 && (
          <MEmptyState
            icon={Waypoints}
            title="No router is allowlisted or exporting"
            description="Add a MikroTik router's id to CLOUDGUEST_TRAFFIC_FLOW_ROUTER_IDS on this backend, then use Config on its card to dry-run and apply the export."
          />
        )}

        {overview?.routers.map((r) => (
          <RouterCard
            key={r.routerId}
            router={r}
            onConfig={() => setConfigFor(r)}
            canConfigure={caps.has("traffic-flow")}
          />
        ))}

        {configFor && (
          <ConfigDialog
            router={configFor}
            canApply={caps.has("traffic-flow.apply")}
            onClose={() => setConfigFor(null)}
          />
        )}
      </MPageShell>
    </MasterShell>
  );
}

function HonestyNote() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        Addresses, not applications: IPFIX carries IPs and ports, and there is no DPI, so this page
        never names an app. Talkers and destinations are two independent lists; nothing stored says
        which guest reached which destination. Lists are merged from each 5-minute window&apos;s top
        10, so they are approximate. Per-guest byte totals of record come from RADIUS accounting,
        not from here. MikroTik only. Omada and Aruba Instant On do not export flows.
      </p>
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "error" | "warning" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        {children && <div className="mt-0.5 text-xs">{children}</div>}
      </div>
    </div>
  );
}

function PipelineStatus({ overview }: { overview: TrafficFlowOverview }) {
  return (
    <div className="space-y-2">
      {!overview.enabled && (
        <Banner tone="info" title="Traffic flow is disabled on this backend">
          CLOUDGUEST_TRAFFIC_FLOW_ENABLED is off. Nothing is pulled from the hub and the generator
          renders no traffic-flow section.
        </Banner>
      )}
      {overview.enabled && !overview.agentConfigured && (
        <Banner tone="warning" title="Hub flow agent not configured">
          CLOUDGUEST_TRAFFIC_FLOW_AGENT_URL / _SECRET are unset, so no window can be pulled. The
          collector on the hub may not be installed yet.
        </Banner>
      )}
      {overview.lastPullOk === false && (
        <Banner tone="error" title={`Last pull from the hub failed (${when(overview.lastPullAt)})`}>
          {overview.lastError ?? "No error text was recorded."}
        </Banner>
      )}
      {overview.unknownExporters.length > 0 && (
        <Banner tone="warning" title="Flows from exporters that match no router">
          {overview.unknownExporters.join(", ")} -- these tunnel addresses map to no active
          WireGuard peer (for example an orphaned hub peer). Their traffic is not attributed to any
          venue.
        </Banner>
      )}
      <p className="text-xs text-muted-foreground">
        Last pull: {when(overview.lastPullAt)} · newest window ingested:{" "}
        {when(overview.lastWindowStart)} · window {overview.windowSeconds}s
      </p>
    </div>
  );
}

function RouterCard({
  router: r,
  onConfig,
  canConfigure,
}: {
  router: TrafficFlowRouter;
  onConfig: () => void;
  canConfigure: boolean;
}) {
  const hasData = r.windows > 0;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{r.routerName ?? r.routerId}</h3>
            <MTag
              label={TRAFFIC_FLOW_STATE_LABEL[r.state]}
              tone={TRAFFIC_FLOW_STATE_TONE[r.state]}
            />
            {!r.allowlisted && <MTag label="Not allowlisted" tone="warning" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {r.organizationName ?? "—"} / {r.locationName ?? "—"} · {r.vendor ?? "unknown vendor"}
          </p>
        </div>
        {canConfigure && (
          <MButton variant="outline" onClick={onConfig}>
            <Settings2 /> Config
          </MButton>
        )}
      </div>

      {r.state !== "ok" && (
        <p className="text-xs text-muted-foreground">{TRAFFIC_FLOW_STATE_HELP[r.state]}</p>
      )}

      {hasData && (
        <>
          <p className="text-xs text-muted-foreground">
            {formatBytes(r.bytesTotal)} in {r.windows} window{r.windows === 1 ? "" : "s"} · newest{" "}
            {when(r.newestWindowStart)} · internal (LAN/tunnel) {formatBytes(r.bytesInternal)}
            {r.bytesUnclassified > 0 && ` · unclassified ${formatBytes(r.bytesUnclassified)}`}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Top talkers (local addresses)
              </h4>
              <MTable
                head={
                  <>
                    <MTh>Address</MTh>
                    <MTh>Up</MTh>
                    <MTh>Down</MTh>
                    <MTh className="hidden md:table-cell">Matched to</MTh>
                  </>
                }
              >
                {r.talkers.map((t) => (
                  <MTr key={t.ip}>
                    <MTd className="font-mono text-xs">{t.ip}</MTd>
                    <MTd className="text-xs">{formatBytes(t.bytesUp)}</MTd>
                    <MTd className="text-xs">{formatBytes(t.bytesDown)}</MTd>
                    <MTd className="hidden text-xs md:table-cell">
                      {MATCH_LABEL[t.match]}
                      {t.guestSessionId && (
                        <span className="ml-1 font-mono text-muted-foreground">
                          {t.guestSessionId.slice(0, 8)}
                        </span>
                      )}
                    </MTd>
                  </MTr>
                ))}
              </MTable>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Top destinations (remote addresses)
              </h4>
              <MTable
                head={
                  <>
                    <MTh>Address</MTh>
                    <MTh>Bytes</MTh>
                    <MTh>Flows</MTh>
                  </>
                }
              >
                {r.destinations.map((d) => (
                  <MTr key={d.ip}>
                    <MTd className="font-mono text-xs">{d.ip}</MTd>
                    <MTd className="text-xs">{formatBytes(d.bytes)}</MTd>
                    <MTd className="text-xs">{d.flows}</MTd>
                  </MTr>
                ))}
              </MTable>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ConfigDialog({
  router,
  canApply,
  onClose,
}: {
  router: TrafficFlowRouter;
  canApply: boolean;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<TrafficFlowConfigPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrafficFlowApplyResult | null>(null);

  useEffect(() => {
    trafficFlowService
      .config(router.routerId)
      .then(setPreview)
      .catch((err) => setError(errMsg(err, "Could not load the config preview.")));
  }, [router.routerId]);

  async function run(enabled: boolean, dryRun: boolean) {
    if (!dryRun) {
      const what = enabled
        ? "turn ON traffic-flow export (IPFIX to the hub over the tunnel)"
        : "turn OFF traffic-flow export and remove the platform's export target";
      if (
        !window.confirm(
          `This writes to the router "${router.routerName ?? router.routerId}" now: ${what}.\n\n` +
            "Staging / lab routers only until hardware verification passes. Continue?",
        )
      )
        return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await trafficFlowService.apply(router.routerId, { enabled, dryRun });
      setResult(res);
      if (!dryRun) {
        if (res.matches) toast.success("Applied and read back: router matches");
        else toast.warning("Written, but the read-back does not match -- see below");
      }
    } catch (err) {
      toast.error(errMsg(err, "The router could not be read or written."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MDialog open onClose={onClose} title={`Traffic flow config — ${router.routerName ?? ""}`} wide>
      <div className="space-y-3 text-sm">
        {error && <Banner tone="error" title={error} />}
        {!preview && !error && <Loader2 className="h-4 w-4 animate-spin" />}
        {preview && (
          <>
            {preview.blockers.length > 0 ? (
              <Banner tone="warning" title="Not eligible yet">
                <ul className="list-disc pl-4">
                  {preview.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </Banner>
            ) : (
              <p className="text-xs text-muted-foreground">
                Exports to {preview.collectorAddress}:{preview.collectorPort} from{" "}
                {preview.sourceAddress} (RouterOS {preview.routerosVersion ?? "unknown"}).
              </p>
            )}
            {preview.lines.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">
                  The same lines the network-config push renders. The paste script does not include
                  them.
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
                  {preview.lines.join("\n")}
                </pre>
              </>
            )}
            {canApply && (
              <div className="flex flex-wrap gap-2">
                <MButton variant="outline" disabled={busy} onClick={() => run(true, true)}>
                  Dry run (read only)
                </MButton>
                <MButton
                  variant="primary"
                  disabled={busy || !preview.eligible}
                  onClick={() => run(true, false)}
                >
                  Apply export
                </MButton>
                <MButton variant="ghost" disabled={busy} onClick={() => run(false, false)}>
                  Turn export off
                </MButton>
              </div>
            )}
            {result && <ApplyResult result={result} />}
          </>
        )}
      </div>
    </MDialog>
  );
}

function ApplyResult({ result }: { result: TrafficFlowApplyResult }) {
  const lines = result.dryRun ? result.plannedWrites : result.writes;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
      <div className="font-semibold">
        {result.dryRun
          ? `Dry run: ${lines?.length ?? 0} write(s) would be issued`
          : `${lines?.length ?? 0} write(s) issued · read-back ${
              result.matches ? "matches" : "DOES NOT MATCH"
            }`}
      </div>
      {lines && lines.length > 0 && (
        <pre className="overflow-auto whitespace-pre-wrap font-mono">{lines.join("\n")}</pre>
      )}
      {(result.dryRun ? result.differences : result.mismatches)?.map((m) => (
        <div key={m} className="text-muted-foreground">
          {m}
        </div>
      ))}
    </div>
  );
}
