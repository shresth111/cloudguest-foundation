import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSearch, RefreshCw, ServerCog } from "lucide-react";
import { MasterShell, useOperatorCaps } from "@/components/master/MasterShell";
import {
  MButton,
  MDialog,
  MPageShell,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { DeviceLogsRouterDrawer } from "@/components/master/DeviceLogsRouterDrawer";
import { useDeviceLogs, useDeviceLogsOverview } from "@/hooks/useDeviceLogs";
import { requestErrorOf } from "@/services/api";
import { routerService } from "@/services/router.service";
import {
  RECEIVING_STATE,
  SEVERITY_FILTER_OPTIONS,
  attributionNote,
  formatAgo,
  severityLabel,
  severityTone,
  verdictLabel,
} from "@/lib/device-logs-presentation";
import type { DeviceLogFilters } from "@/types/deviceLogs";

export const Route = createFileRoute("/master/device-logs")({ component: DeviceLogsScreen });

const EMPTY_FILTERS: DeviceLogFilters = {
  window: "24h",
  organizationId: "",
  locationId: "",
  routerId: "",
  maxSeverity: "",
  q: "",
  unattributed: false,
};

/**
 * Master -> Device Logs: syslog that venue routers send to the platform
 * (MikroTik only today). Read with device_logs.read; Set up / Remove on a
 * router need device_logs.manage. Both pinned to GLOBAL on the backend.
 *
 * Honest states, never a zero that reads as "all quiet": the feature
 * switched off, no router set up, a router set up but never heard from, and
 * lines that could not be tied to a router are each said in words.
 */
function DeviceLogsScreen() {
  const caps = useOperatorCaps();
  const canManage = caps.has("device-logs.manage");
  const overview = useDeviceLogsOverview();
  const [filters, setFilters] = useState<DeviceLogFilters>(EMPTY_FILTERS);
  const [qDraft, setQDraft] = useState("");
  const [at, setAt] = useState(() => Date.now());
  const [openRouter, setOpenRouter] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const logs = useDeviceLogs(filters, at);

  const routers = useMemo(() => overview.data?.routers ?? [], [overview.data]);
  const featureOn = overview.data?.feature_enabled ?? true;
  const customers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (r.organization_id) m.set(r.organization_id, r.organization_name ?? r.organization_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers]);
  const venues = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (
        r.location_id &&
        (!filters.organizationId || r.organization_id === filters.organizationId)
      )
        m.set(r.location_id, r.location_name ?? r.location_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers, filters.organizationId]);
  const routerOptions = routers.filter(
    (r) =>
      (!filters.organizationId || r.organization_id === filters.organizationId) &&
      (!filters.locationId || r.location_id === filters.locationId),
  );

  const set = (patch: Partial<DeviceLogFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  const now = Date.now();

  return (
    <MasterShell title="Device Logs">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title="Device Logs"
          description="Syslog that venue routers send to the platform over their WireGuard tunnel. MikroTik only for now. Phone numbers and e-mail addresses are masked before they are stored here."
          actions={
            <div className="flex gap-2">
              <MButton
                variant="outline"
                onClick={() => {
                  setAt(Date.now());
                  void overview.refetch();
                }}
              >
                <RefreshCw /> Refresh
              </MButton>
              <MButton onClick={() => setPicking(true)}>
                <ServerCog /> Set up a router
              </MButton>
            </div>
          }
        />

        {overview.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Couldn't load device logging status.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {requestErrorOf(overview.error)?.message ?? "The server did not answer."}
            </p>
          </div>
        ) : !featureOn ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium">{RECEIVING_STATE.feature_off.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {RECEIVING_STATE.feature_off.detail} You can still open a router to read its paste
              script.
            </p>
          </div>
        ) : null}

        <section className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold">Routers set up to send logs</h3>
          {overview.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          ) : routers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No router has been set up by Wyfy yet. Use “Set up a router” to start with one.
            </p>
          ) : (
            <MTable
              head={
                <>
                  <MTh>Router</MTh>
                  <MTh>Venue</MTh>
                  <MTh>State</MTh>
                  <MTh>Last line</MTh>
                  <MTh>Read-back</MTh>
                </>
              }
            >
              {routers.map((r) => {
                const st = RECEIVING_STATE[r.state];
                const v = verdictLabel(r.verified_ok);
                return (
                  <MTr key={r.router_id} onClick={() => setOpenRouter(r.router_id)}>
                    <MTd className="font-medium">{r.router_name ?? r.router_id}</MTd>
                    <MTd>
                      {r.location_name ?? "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {r.organization_name ?? ""}
                      </span>
                    </MTd>
                    <MTd>
                      <MTag
                        label={r.enabled ? st.label : "Removed"}
                        tone={r.enabled ? st.tone : "normal"}
                      />
                    </MTd>
                    <MTd className="text-xs">{formatAgo(r.last_received_at, now)}</MTd>
                    <MTd>
                      <MTag label={v.label} tone={v.tone} />
                    </MTd>
                  </MTr>
                );
              })}
            </MTable>
          )}
          {!!overview.data?.unattributed_last_24h && (
            <p className="text-xs text-amber-700">
              {overview.data.unattributed_last_24h} line(s) in the last 24 h could not be matched to
              any router. Show them with “Unmatched lines only” below. If every line is unmatched,
              the hub is rewriting source addresses.
            </p>
          )}
        </section>

        <section className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold">Log lines</h3>
          <div className="flex flex-wrap items-end gap-2">
            <MSeg
              options={[
                { value: "1h", label: "1 h" },
                { value: "24h", label: "24 h" },
                { value: "7d", label: "7 d" },
                { value: "30d", label: "30 d" },
              ]}
              value={filters.window}
              onChange={(w) => {
                setAt(Date.now());
                set({ window: w });
              }}
            />
            <select
              aria-label="Customer"
              className={`${M_INPUT} w-auto`}
              value={filters.organizationId}
              onChange={(e) =>
                set({ organizationId: e.target.value, locationId: "", routerId: "" })
              }
            >
              <option value="">All customers</option>
              {customers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Venue"
              className={`${M_INPUT} w-auto`}
              value={filters.locationId}
              onChange={(e) => set({ locationId: e.target.value, routerId: "" })}
            >
              <option value="">All venues</option>
              {venues.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Router"
              className={`${M_INPUT} w-auto`}
              value={filters.routerId}
              onChange={(e) => set({ routerId: e.target.value })}
            >
              <option value="">All routers</option>
              {routerOptions.map((r) => (
                <option key={r.router_id} value={r.router_id}>
                  {r.router_name ?? r.router_id}
                </option>
              ))}
            </select>
            <select
              aria-label="Minimum severity"
              className={`${M_INPUT} w-auto`}
              value={filters.maxSeverity}
              onChange={(e) => set({ maxSeverity: e.target.value })}
            >
              {SEVERITY_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                set({ q: qDraft });
              }}
            >
              <input
                aria-label="Search message text"
                placeholder="Search text, MAC, IP…"
                className={`${M_INPUT} w-56`}
                maxLength={200}
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
              />
              <MButton variant="outline" type="submit">
                Search
              </MButton>
            </form>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={filters.unattributed}
                onChange={(e) => set({ unattributed: e.target.checked })}
              />
              Unmatched lines only
            </label>
          </div>
          {filters.maxSeverity !== "" && (
            <p className="text-[11px] text-muted-foreground">
              A severity filter also hides lines that arrived without a priority.
            </p>
          )}

          {logs.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium">Couldn't load log lines.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {requestErrorOf(logs.error)?.message ?? "The server did not answer."}
              </p>
            </div>
          ) : logs.data && logs.data.pages[0] && !logs.data.pages[0].feature_enabled ? (
            <p className="text-sm text-muted-foreground">
              Nothing is collected while device logging is switched off.
            </p>
          ) : !logs.isLoading && items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm">
              <FileSearch className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="font-medium">No lines match in this window.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {routers.length === 0
                  ? "No router is set up to send logs, so an empty list means nothing has been collected, not that routers are quiet."
                  : "Check each router's state above: “No message received yet” means nothing has arrived at all."}
              </p>
            </div>
          ) : (
            <MTable
              loading={logs.isLoading}
              head={
                <>
                  <MTh>Received</MTh>
                  <MTh>Router</MTh>
                  <MTh>Severity</MTh>
                  <MTh>Topics</MTh>
                  <MTh>Message</MTh>
                </>
              }
            >
              {items.map((e) => {
                const note = attributionNote(e.attribution, e.claimed_tag);
                return (
                  <MTr key={e.id}>
                    <MTd className="whitespace-nowrap text-xs tabular-nums">
                      <span
                        title={
                          e.device_time
                            ? `Router clock: ${new Date(e.device_time).toLocaleString()}`
                            : "Router clock not readable"
                        }
                      >
                        {new Date(e.received_at).toLocaleString()}
                      </span>
                    </MTd>
                    <MTd className="text-xs">
                      {e.router_id ? (
                        <button
                          className="text-left font-medium hover:underline"
                          onClick={() => setOpenRouter(e.router_id)}
                        >
                          {e.router_name ?? e.router_id}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">Unmatched · {e.source_ip}</span>
                      )}
                      {e.location_name && (
                        <span className="block text-[11px] text-muted-foreground">
                          {e.location_name}
                        </span>
                      )}
                    </MTd>
                    <MTd>
                      <MTag label={severityLabel(e.severity)} tone={severityTone(e.severity)} />
                    </MTd>
                    <MTd className="font-mono text-[11px] text-muted-foreground">
                      {e.topics ?? "—"}
                    </MTd>
                    <MTd className="font-mono text-[11px]">
                      <span className="break-all">{e.message}</span>
                      {note && <span className="mt-1 block font-sans text-amber-700">{note}</span>}
                    </MTd>
                  </MTr>
                );
              })}
            </MTable>
          )}
          {logs.hasNextPage && (
            <MButton
              variant="outline"
              disabled={logs.isFetchingNextPage}
              onClick={() => void logs.fetchNextPage()}
            >
              {logs.isFetchingNextPage ? "Loading…" : "Load older lines"}
            </MButton>
          )}
        </section>

        <RouterPicker
          open={picking}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            setOpenRouter(id);
          }}
        />
        <DeviceLogsRouterDrawer
          routerId={openRouter}
          onClose={() => setOpenRouter(null)}
          canManage={canManage}
        />
      </MPageShell>
    </MasterShell>
  );
}

/** Pick any fleet router to open its logging drawer. The drawer says why a
 * router cannot be set up (not a MikroTik, no tunnel, no API credentials),
 * so the list is not pre-filtered by guesswork here. */
function RouterPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (routerId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const fleet = useQuery({
    queryKey: ["device-logs", "fleet-picker"],
    queryFn: () =>
      routerService.listAll({
        search: "",
        status: "all",
        organizationId: "all",
        locationId: "all",
      }),
    enabled: open,
  });
  const rows = (fleet.data?.rows ?? []).filter((r) =>
    `${r.name} ${r.locationName} ${r.organizationName}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <MDialog open={open} onClose={onClose} title="Set up a router" wide>
      <input
        aria-label="Search routers"
        placeholder="Search by router, venue or customer"
        className={M_INPUT}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-3 max-h-80 overflow-auto">
        {fleet.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : fleet.isError ? (
          <p className="text-sm text-destructive">
            {requestErrorOf(fleet.error)?.message ?? "Couldn't load the fleet."}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No router matches.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 200).map((r) => (
              <li key={r.id}>
                <button
                  className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => onPick(r.id)}
                >
                  <span>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {[r.locationName, r.organizationName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{r.vendor}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MDialog>
  );
}
