/**
 * Routers page tabs (NETMON-2, ADDENDUM_06): the router list (unchanged),
 * Traffic (one WAN card per router, day / week / month), Live sessions
 * (hotspot + PPPoE across every router) and Session history (search + CSV).
 * While ISP_NETMON_ENABLED is off the API answers 404 and only the router
 * list is shown, exactly as before.
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MButton, MSeg, MTable, MTag, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock, Pager, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispErrorStatus } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/isp-partner/format";
import { REASON_LABEL, completedError, sparkPaths } from "@/lib/isp-partner/netmon";
import {
  netmonService,
  type CompletedQuery,
  type NetSession,
  type TrafficCard,
  type TrafficRange,
} from "@/services/isp-partner/netmon";

type Tab = "list" | "traffic" | "live" | "history";
const nk = (...k: unknown[]) => ["isp", "netmon", ...k] as const;
const W = 280;
const H = 64;

function Spark({ c }: { c: TrafficCard }) {
  const { inPath, outPath, max } = sparkPaths(c.points, W, H);
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-16 w-full"
        role="img"
        aria-label={`WAN traffic on ${c.wan_interface}: peak in ${c.peak_in_mbps} Mbps, out ${c.peak_out_mbps} Mbps`}
      >
        <line x1="0" y1={H} x2={W} y2={H} stroke="var(--border)" />
        <polyline points={inPath} fill="none" stroke="var(--chart-1)" strokeWidth="2" />
        <polyline points={outPath} fill="none" stroke="var(--chart-2)" strokeWidth="2" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: "var(--chart-1)" }}
          />{" "}
          In · peak {c.peak_in_mbps ?? 0} Mbps
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: "var(--chart-2)" }}
          />{" "}
          Out · peak {c.peak_out_mbps ?? 0} Mbps
        </span>
        <span>scale 0–{max.toFixed(1)} Mbps</span>
      </figcaption>
    </figure>
  );
}

function TrafficView() {
  const [range, setRange] = useState<TrafficRange>("day");
  const q = useQuery({
    queryKey: nk("traffic", range),
    queryFn: () => netmonService.traffic(range),
    retry: retryUnless4xx,
    refetchInterval: 5 * 60_000,
  });
  return (
    <div className="space-y-3">
      <MSeg<TrafficRange>
        value={range}
        onChange={setRange}
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="router traffic" />
      ) : q.data.routers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routers yet.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {q.data.routers.map((c) => (
              <Card key={c.isp_router_id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/partner/routers/$ispRouterId"
                      params={{ ispRouterId: c.isp_router_id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.customer_name, c.location_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {c.reason && (
                    <MTag
                      label={REASON_LABEL[c.reason] ?? c.reason}
                      tone={c.readable ? undefined : "offline"}
                    />
                  )}
                </div>
                {c.points.length > 0 ? (
                  <>
                    <Spark c={c} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      WAN: {c.wan_interface}
                      {c.wan_basis === "busiest" && " (busiest interface)"}
                    </p>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    {c.hint ?? "No traffic readings in this range."}
                  </p>
                )}
                {c.last_seen_ist && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Last seen {c.last_seen_ist} IST
                  </p>
                )}
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{q.data.basis}</p>
        </>
      )}
    </div>
  );
}

function SessionRows({ items, ended }: { items: NetSession[]; ended: boolean }) {
  return (
    <MTable
      head={
        <>
          <MTh>Type</MTh>
          <MTh>Who</MTh>
          <MTh>Router</MTh>
          <MTh>MAC / IP</MTh>
          <MTh>{ended ? "Ended" : "Since"}</MTh>
          <MTh className="text-right">{ended ? "Duration" : "Uptime"}</MTh>
          <MTh className="text-right">Down / up</MTh>
        </>
      }
    >
      {items.map((s) => (
        <MTr key={`${s.kind}-${s.session_id}`}>
          <MTd>
            <MTag label={s.kind === "pppoe" ? "PPPoE" : "Hotspot"} />
          </MTd>
          <MTd className="text-xs">
            {s.subscriber_id ? (
              <Link
                to="/partner/subscribers/$subscriberId"
                params={{ subscriberId: s.subscriber_id }}
                className="text-primary hover:underline"
              >
                {s.who ?? "–"}
              </Link>
            ) : (
              (s.who ?? "–")
            )}
            {s.circuit_id != null && (
              <span className="block text-muted-foreground">circuit {s.circuit_id}</span>
            )}
          </MTd>
          <MTd className="text-xs">{s.router_name ?? "–"}</MTd>
          <MTd className="font-mono text-xs">
            {s.mac ?? "–"}
            <span className="block text-muted-foreground">{s.ip ?? ""}</span>
          </MTd>
          <MTd className="text-xs">{formatDateTime(ended ? s.ended_at : s.started_at)}</MTd>
          <MTd className="text-right text-xs tabular-nums">{formatDuration(s.uptime_seconds)}</MTd>
          <MTd className="text-right text-xs tabular-nums">
            {formatBytes(s.bytes_down)} / {formatBytes(s.bytes_up)}
          </MTd>
        </MTr>
      ))}
    </MTable>
  );
}

function LiveView() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<"" | "hotspot" | "pppoe">("");
  const q = useQuery({
    queryKey: nk("live", page, kind),
    queryFn: () => netmonService.active(page, kind || undefined),
    retry: retryUnless4xx,
    refetchInterval: 60_000,
  });
  return (
    <Card title={`Live sessions${q.data ? ` (${q.data.total})` : ""}`}>
      <div className="mb-3">
        <MSeg<"" | "hotspot" | "pppoe">
          value={kind}
          onChange={(v) => (setKind(v), setPage(1))}
          options={[
            { value: "", label: "All" },
            { value: "hotspot", label: "Hotspot" },
            { value: "pppoe", label: "PPPoE" },
          ]}
        />
      </div>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="live sessions" />
      ) : q.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody is online right now.</p>
      ) : (
        <>
          <SessionRows items={q.data.items} ended={false} />
          <Pager page={q.data.page} pages={q.data.pages} total={q.data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

function HistoryView() {
  const { can } = usePartner();
  const [f, setF] = useState<CompletedQuery>({});
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CompletedQuery, v: string) => (
    setF((x) => ({ ...x, [k]: v || undefined })),
    setPage(1)
  );
  const err = completedError(f);
  const q = useQuery({
    queryKey: nk("history", f, page),
    queryFn: () => netmonService.completed({ ...f, page, page_size: 50 }),
    retry: retryUnless4xx,
    enabled: !err,
  });
  return (
    <Card
      title="Session history"
      actions={
        can("isp_partner.export") && (
          <MButton
            variant="outline"
            disabled={busy || !!err}
            onClick={async () => {
              setBusy(true);
              try {
                const file = await netmonService.exportCompleted(f);
                saveBlob(file.blob, file.filename);
                toast.success("Exported. The export is recorded in the audit log.");
              } catch (e) {
                toast.error(ispErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : <Download />} CSV
          </MButton>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Type"
          value={f.kind ?? ""}
          onChange={(e) => set("kind", e.target.value)}
        >
          <option value="">Hotspot + PPPoE</option>
          <option value="hotspot">Hotspot</option>
          <option value="pppoe">PPPoE</option>
        </select>
        <input
          className={`${M_INPUT} w-44 py-1`}
          placeholder="Subscriber / username"
          aria-label="Search"
          value={f.search ?? ""}
          onChange={(e) => set("search", e.target.value)}
        />
        <input
          className={`${M_INPUT} w-44 py-1`}
          placeholder="MAC"
          aria-label="MAC"
          value={f.mac ?? ""}
          onChange={(e) => set("mac", e.target.value)}
        />
        <input
          className={`${M_INPUT} w-36 py-1`}
          placeholder="IP"
          aria-label="IP"
          value={f.ip ?? ""}
          onChange={(e) => set("ip", e.target.value)}
        />
        <input
          type="date"
          className={`${M_INPUT} w-auto py-1`}
          aria-label="From"
          value={f.date_from ?? ""}
          onChange={(e) => set("date_from", e.target.value)}
        />
        <input
          type="date"
          className={`${M_INPUT} w-auto py-1`}
          aria-label="To"
          value={f.date_to ?? ""}
          onChange={(e) => set("date_to", e.target.value)}
        />
      </div>
      {err ? (
        <p className="text-xs text-destructive">{err}</p>
      ) : q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="session history" />
      ) : q.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sessions match. The default range is the last 7 days.
        </p>
      ) : (
        <>
          <SessionRows items={q.data.items} ended />
          <Pager page={q.data.page} pages={q.data.pages} total={q.data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

export function NetmonTabs({ list }: { list: ReactNode }) {
  const [tab, setTab] = useState<Tab>("list");
  const probe = useQuery({
    queryKey: nk("traffic", "day"),
    queryFn: () => netmonService.traffic("day"),
    retry: retryUnless4xx,
  });
  if (ispErrorStatus(probe.error) === 404) return <>{list}</>;
  return (
    <div className="space-y-3">
      <MSeg<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "list", label: "Routers" },
          { value: "traffic", label: "Traffic" },
          { value: "live", label: "Live sessions" },
          { value: "history", label: "Session history" },
        ]}
      />
      {tab === "list" && list}
      {tab === "traffic" && <TrafficView />}
      {tab === "live" && <LiveView />}
      {tab === "history" && <HistoryView />}
    </div>
  );
}
