/**
 * Router page network block (ADDENDUM_05 J13/J20): live health (CPU per core,
 * memory, uptime, RouterOS, interface rates and packet rates), the CPU /
 * memory / traffic history graphs, and the active sessions on this router.
 *
 * The live read talks to the router, so it runs only on "Read now". An
 * unreachable or not-set-up router is said plainly; nothing is invented.
 */
import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, RefreshCw } from "lucide-react";
import { MButton, MSeg, MStat, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import {
  useRouterHealthLive,
  useRouterHistory,
  useRouterSessions,
} from "@/hooks/isp-partner/useNetwork";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/isp-partner/format";
import { ROUTER_UNREACHABLE_LABEL, formatBps } from "@/lib/isp-partner/network";
import type { RouterHealthLive } from "@/services/isp-partner/network-types";

const RouterHistoryCharts = lazy(
  () => import("@/components/isp-partner/network/RouterHistoryCharts"),
);

function LiveFacts({ h }: { h: RouterHealthLive }) {
  const ifaces = [...h.interfaces].sort(
    (a, b) => Number(b.running) - Number(a.running) || a.name.localeCompare(b.name),
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MStat
          label="CPU"
          value={h.cpu_load_percent !== null ? `${h.cpu_load_percent}%` : "–"}
          tone={h.cpu_load_percent !== null && h.cpu_load_percent >= 85 ? "warning" : "default"}
        />
        <MStat
          label="Memory used"
          value={h.memory_used_percent !== null ? `${h.memory_used_percent}%` : "–"}
          delta={
            h.memory_total_bytes !== null ? `of ${formatBytes(h.memory_total_bytes)}` : undefined
          }
        />
        <MStat label="Uptime" value={formatDuration(h.uptime_seconds)} />
        <MStat label="RouterOS" value={h.version ?? "–"} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Board</dt>
        <dd>
          {[h.model ?? h.board_name, h.architecture, h.cpu_model].filter(Boolean).join(" · ") ||
            "–"}
        </dd>
        {h.cpu_cores.length > 0 && (
          <>
            <dt className="text-muted-foreground">CPU per core</dt>
            <dd className="flex flex-wrap gap-x-3">
              {h.cpu_cores.map((c, i) => (
                <span key={c.cpu ?? i} className="tabular-nums">
                  {c.cpu ?? `cpu${i}`}: {c.load_percent ?? "–"}%
                </span>
              ))}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Read at</dt>
        <dd>{formatDateTime(h.read_at)}</dd>
      </dl>
      <MTable
        head={
          <>
            <MTh>Interface</MTh>
            <MTh>Link</MTh>
            <MTh className="text-right">Rx</MTh>
            <MTh className="text-right">Tx</MTh>
            <MTh className="text-right">Rx pps</MTh>
            <MTh className="text-right">Tx pps</MTh>
            <MTh className="text-right">Errors / drops</MTh>
          </>
        }
      >
        {ifaces.map((i) => (
          <MTr key={i.name}>
            <MTd className="font-mono text-xs">
              {i.name}
              {i.type && <span className="ml-1 text-muted-foreground">({i.type})</span>}
            </MTd>
            <MTd>
              <MTag
                label={i.disabled ? "Disabled" : i.running ? "Up" : "Down"}
                tone={i.disabled ? undefined : i.running ? "online" : "offline"}
              />
            </MTd>
            <MTd className="text-right tabular-nums">{formatBps(i.rx_bps)}</MTd>
            <MTd className="text-right tabular-nums">{formatBps(i.tx_bps)}</MTd>
            <MTd className="text-right tabular-nums">{i.rx_pps ?? "–"}</MTd>
            <MTd className="text-right tabular-nums">{i.tx_pps ?? "–"}</MTd>
            <MTd className="text-right tabular-nums text-xs">
              {(i.rx_errors ?? 0) + (i.tx_errors ?? 0)} / {(i.rx_drops ?? 0) + (i.tx_drops ?? 0)}
            </MTd>
          </MTr>
        ))}
      </MTable>
    </div>
  );
}

function LiveHealth({ routerId }: { routerId: string }) {
  const [asked, setAsked] = useState(false);
  const q = useRouterHealthLive(routerId, asked);
  return (
    <Card
      title="Live health"
      actions={
        <MButton
          variant="outline"
          disabled={q.isFetching}
          onClick={() => (asked ? q.refetch() : setAsked(true))}
        >
          {q.isFetching ? <Spinner /> : <RefreshCw />} {asked ? "Read again" : "Read now"}
        </MButton>
      }
    >
      {!asked ? (
        <p className="text-sm text-muted-foreground">
          Reads CPU, memory, uptime and every interface&apos;s current rate from the router. It
          takes a couple of seconds.
        </p>
      ) : q.isLoading ? (
        <LoadingBlock label="Reading the router…" />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the router's health" />
      ) : q.data.reachable ? (
        <LiveFacts h={q.data} />
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">Not reachable</p>
          <p className="text-xs text-muted-foreground">
            {ROUTER_UNREACHABLE_LABEL[q.data.reason] ?? q.data.reason}
          </p>
        </div>
      )}
    </Card>
  );
}

const HOURS: { value: string; label: string }[] = [
  { value: "6", label: "6 h" },
  { value: "24", label: "24 h" },
  { value: "168", label: "7 d" },
];

function History({ routerId }: { routerId: string }) {
  const [hours, setHours] = useState("24");
  const q = useRouterHistory(routerId, Number(hours));
  return (
    <Card
      title="History"
      actions={<MSeg<string> value={hours} onChange={setHours} options={HOURS} />}
    >
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the router's history" />
      ) : q.data.points.length === 0 && q.data.interfaces_source === "none" ? (
        <p className="text-sm text-muted-foreground">
          No health readings in this window. Readings start once the router is set up and reachable.
        </p>
      ) : (
        <Suspense fallback={<LoadingBlock label="Loading charts…" />}>
          <RouterHistoryCharts key={hours} history={q.data} />
        </Suspense>
      )}
    </Card>
  );
}

function ActiveSessions({ routerId }: { routerId: string }) {
  const q = useRouterSessions(routerId);
  const rows = q.data?.sessions ?? [];
  return (
    <Card title={`Active sessions${q.data ? ` (${rows.length})` : ""}`}>
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="active sessions" />
      ) : !q.isLoading && rows.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" /> Nobody is online on this router.
        </p>
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Who</MTh>
              <MTh>Type</MTh>
              <MTh>IP / MAC</MTh>
              <MTh className="text-right">Online for</MTh>
              <MTh className="text-right">Down / up</MTh>
            </>
          }
        >
          {rows.map((s) => (
            <MTr key={s.session_id}>
              <MTd className="text-xs">
                {s.guest ?? "–"}
                {s.circuit_id != null && (
                  <span className="ml-1 text-muted-foreground">· circuit {s.circuit_id}</span>
                )}
              </MTd>
              <MTd>
                <MTag label={s.kind === "pppoe" ? "PPPoE" : "Hotspot"} />
              </MTd>
              <MTd className="font-mono text-xs">
                {s.ip ?? "–"}
                <span className="block text-muted-foreground">{s.mac ?? ""}</span>
              </MTd>
              <MTd className="text-right tabular-nums text-xs">
                {formatDuration(s.uptime_seconds)}
              </MTd>
              <MTd className="text-right tabular-nums text-xs">
                {formatBytes(s.bytes_down)} / {formatBytes(s.bytes_up)}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {rows.some((s) => s.subscriber_id) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Subscribers are listed under{" "}
          <Link to="/partner/plans" className="text-primary hover:underline">
            Plans → Subscribers
          </Link>
          .
        </p>
      )}
    </Card>
  );
}

export function RouterNetworkPanel({ routerId }: { routerId: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Health and traffic</h2>
      <LiveHealth routerId={routerId} />
      <History routerId={routerId} />
      <ActiveSessions routerId={routerId} />
    </section>
  );
}
