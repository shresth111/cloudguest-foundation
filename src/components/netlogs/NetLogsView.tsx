import { Fragment, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileSearch,
  Loader2,
  PowerOff,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useCustomerLocations, useMyPermissions } from "@/hooks/useCustomerDashboard";
import { useNetLogsList, useNetLogsSummary } from "@/hooks/useNetLogs";
import { navItemAllowed } from "@/lib/customerNavPermissions";
import { resolveMarketingScope } from "@/lib/marketing-scope";
import {
  NETLOGS_CATEGORIES,
  NETLOGS_EXPORT_MAX_ROWS,
  NETLOGS_MAX_QUERY_LENGTH,
  NETLOGS_PRESETS,
  NETLOGS_PRESET_LABEL,
  NETLOGS_SEVERITIES,
  NETLOGS_STATUSES,
  STATUS_TONE_CLASS,
  categoryLabel,
  deviceHost,
  effectiveLocationId,
  filtersFromSearch,
  hasNarrowingFilters,
  messageParts,
  netLogsChartRows,
  netLogsErrorMessage,
  netLogsParams,
  netLogsWindow,
  presentCategories,
  searchFromFilters,
  severityLabel,
  severityTone,
  statusLabel,
  statusTone,
  titleCase,
  type FriendlyError,
  type NetLogsFilters,
} from "@/lib/netlogs";
import { netLogsService } from "@/services/netlogs.service";
import { requestErrorOf, resolveActiveOrganizationId } from "@/services/api";
import { routerService } from "@/services/router.service";
import { cn } from "@/lib/utils";
import type { NetLogEvent, NetLogSummary, NetLogTopRouter } from "@/types/netlogs";

const NetLogsVolumeChart = lazy(() =>
  import("@/components/netlogs/NetLogsCharts").then((m) => ({ default: m.NetLogsVolumeChart })),
);
const NetLogsErrorsChart = lazy(() =>
  import("@/components/netlogs/NetLogsCharts").then((m) => ({ default: m.NetLogsErrorsChart })),
);

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Support & Logs -> NetLogs: this account's router and sign-in log lines
 * (router syslog, RADIUS decisions, portal sign-in failures), read-only.
 *
 * Three layers, like every other gated screen: the sidebar row
 * (`network_logs.read` in customerNavPermissions.ts), this view's own check
 * of the same key, and the backend's `RequirePermission` on every route.
 *
 * Every filter lives in the URL (`lib/netlogs.ts` maps both ways), so a
 * copied link opens the same view. Location-wise and router-wise views are
 * just those filters: a click on a busy router in the summary applies it.
 *
 * What this page never shows: the router's tunnel address, WireGuard, or how
 * a line was matched to a router. The backend does not send them on this
 * surface, and nothing here may ask for them.
 */
export function NetLogsView({ locationId }: { locationId: string }) {
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const searchKey = JSON.stringify(rawSearch ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => filtersFromSearch(rawSearch), [searchKey]);
  const { roles } = useAuth();
  const org = resolveActiveOrganizationId();
  const orgWide = resolveMarketingScope(roles, org, locationId).kind === "organization";
  const { data: permissions } = useMyPermissions();
  // Fail open on "don't know" (in flight, failed, or an empty grant list),
  // exactly as the sidebar does; the backend's 403 is the real boundary.
  const permitted =
    !Array.isArray(permissions) ||
    permissions.length === 0 ||
    navItemAllowed("netlogs", new Set(permissions));

  // `now`, pinned: it moves on Refresh and on every filter change, never
  // while paging, so "Load more" stays inside the same window.
  const [at, setAt] = useState(() => Date.now());
  const effLocation = effectiveLocationId(filters, locationId, orgWide);
  // A location-scoped caller always names their venue; an organisation-wide
  // caller sends no header and narrows with `location_id` instead.
  const locationHeader = orgWide ? null : effLocation;
  const win = useMemo(() => netLogsWindow(filters, at), [filters, at]);
  const params = useMemo(
    () => netLogsParams(filters, win, effLocation),
    [filters, win, effLocation],
  );
  const summaryParams = useMemo(() => {
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      tz = "";
    }
    return tz ? { ...params, tz } : params;
  }, [params]);

  const summary = useNetLogsSummary(org, locationHeader, summaryParams, permitted);
  const logs = useNetLogsList(org, locationHeader, params, permitted);

  const apply = (patch: Partial<NetLogsFilters>) => {
    const next = { ...filters, ...patch };
    setAt(Date.now());
    void navigate({ to: "/netlogs", search: searchFromFilters(next), replace: true });
  };

  const featureOff =
    summary.data?.feature_enabled === false || logs.data?.pages[0]?.feature_enabled === false;
  const error = logs.error ?? summary.error;
  const friendly = error ? netLogsErrorMessage(requestErrorOf(error)) : null;

  if (!permitted) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to network logs"
        description="Your role doesn't include Network Logs. Ask your account owner if you need it."
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">
        What your routers and guest sign-ins recorded: addresses handed out, sign-ins accepted or
        refused, traffic the firewall stopped, and router events. Phone numbers and e-mail addresses
        are masked before lines are stored.
      </p>

      <Filters
        filters={filters}
        apply={apply}
        activeLocationId={locationId}
        effLocation={effLocation}
        orgWide={orgWide}
        org={org}
        onRefresh={() => setAt(Date.now())}
        refreshing={summary.isFetching || logs.isFetching}
        exportParams={params}
        locationHeader={locationHeader}
        exportDisabled={featureOff || !!error}
      />

      {win.clamped && (
        <p className="text-xs text-muted-foreground">
          Showing the last 2 years of that range: that is the most this page can show at once.
        </p>
      )}

      {featureOff ? (
        <EmptyState
          icon={PowerOff}
          title="NetLogs isn't switched on for your account yet"
          description="Nothing is being collected right now, so there is nothing to show. Contact Wyfy support if you'd like network logs for your venues."
        />
      ) : friendly ? (
        <ErrorPanel friendly={friendly} apply={apply} onRetry={() => setAt(Date.now())} />
      ) : (
        <>
          <SummaryCards
            summary={summary.data}
            loading={summary.isLoading}
            onPickRouter={(r) =>
              apply({
                location: r.location_id && r.location_id !== locationId ? r.location_id : "",
                router: r.router_id ?? "",
              })
            }
            activeRouter={filters.router}
          />
          <ChartsRow summary={summary.data} loading={summary.isLoading} />
          <LogTable
            items={logs.data?.pages.flatMap((p) => p.items) ?? []}
            loading={logs.isLoading}
            narrowed={hasNarrowingFilters(filters)}
            onClear={() => apply({ router: "", severity: [], category: [], status: [], q: "" })}
            hasMore={!!logs.hasNextPage}
            loadingMore={logs.isFetchingNextPage}
            onLoadMore={() => void logs.fetchNextPage()}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function Filters({
  filters,
  apply,
  activeLocationId,
  effLocation,
  orgWide,
  org,
  onRefresh,
  refreshing,
  exportParams,
  locationHeader,
  exportDisabled,
}: {
  filters: NetLogsFilters;
  apply: (patch: Partial<NetLogsFilters>) => void;
  activeLocationId: string;
  effLocation: string | null;
  orgWide: boolean;
  org: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  exportParams: Record<string, string>;
  locationHeader: string | null;
  exportDisabled: boolean;
}) {
  const locations = useCustomerLocations();
  const locationOptions = useMemo(
    () =>
      (locations.data ?? [])
        .filter((l) => !org || !l.organizationId || l.organizationId === org)
        .map((l) => ({ id: l.id, name: l.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [locations.data, org],
  );
  const routers = useQuery({
    queryKey: ["netlogs", "routers", org, effLocation],
    queryFn: () => routerService.listForLocation(effLocation as string, org as string),
    enabled: !!effLocation && !!org,
    staleTime: 60_000,
    retry: false,
  });

  const [qDraft, setQDraft] = useState(filters.q);
  useEffect(() => setQDraft(filters.q), [filters.q]);

  const [customOpen, setCustomOpen] = useState(filters.range === "custom");
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  useEffect(() => {
    setFrom(filters.from);
    setTo(filters.to);
    if (filters.range === "custom") setCustomOpen(true);
  }, [filters.from, filters.to, filters.range]);

  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try {
      const file = await netLogsService.exportCsv(exportParams, locationHeader);
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export ready", {
        description: `Saved ${file.filename}. Exports stop at ${NETLOGS_EXPORT_MAX_ROWS.toLocaleString()} lines.`,
      });
    } catch (e) {
      const f = netLogsErrorMessage(requestErrorOf(e));
      toast.error(f.title, { description: f.detail });
    } finally {
      setExporting(false);
    }
  };

  const locationValue = filters.location === "all" && orgWide ? "all" : (effLocation ?? "all");
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Time range"
          className="inline-flex flex-wrap rounded-md border bg-background p-0.5"
        >
          {NETLOGS_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={filters.range === p}
              onClick={() => {
                setCustomOpen(false);
                apply({ range: p, from: "", to: "" });
              }}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                filters.range === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {NETLOGS_PRESET_LABEL[p]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={filters.range === "custom"}
            onClick={() => setCustomOpen((o) => !o)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              filters.range === "custom"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            Custom
          </button>
        </div>

        <select
          aria-label="Location"
          className={SELECT_CLASS}
          value={locationValue}
          onChange={(e) => {
            const v = e.target.value;
            apply({ location: v === activeLocationId ? "" : v, router: "" });
          }}
        >
          {orgWide && <option value="all">All locations</option>}
          {locationOptions.length === 0 && effLocation && (
            <option value={effLocation}>This location</option>
          )}
          {locationOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Router"
          className={SELECT_CLASS}
          value={filters.router}
          disabled={!effLocation}
          title={effLocation ? undefined : "Pick a location to choose one of its routers"}
          onChange={(e) => apply({ router: e.target.value })}
        >
          <option value="">All routers</option>
          {filters.router && !(routers.data ?? []).some((r) => r.id === filters.router) && (
            <option value={filters.router}>Selected router</option>
          )}
          {(routers.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <MultiSelect
          label="Severity"
          options={NETLOGS_SEVERITIES.map((s) => ({ value: s, label: titleCase(s) }))}
          selected={filters.severity}
          onChange={(severity) => apply({ severity })}
        />
        <MultiSelect
          label="Category"
          options={NETLOGS_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
          selected={filters.category}
          onChange={(category) => apply({ category })}
        />
        <MultiSelect
          label="Status"
          options={NETLOGS_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
          selected={filters.status}
          onChange={(status) => apply({ status })}
        />

        <form
          className="flex min-w-[220px] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: qDraft.trim() });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search log lines"
              placeholder="Search text, IP, MAC…"
              className="pl-8"
              maxLength={NETLOGS_MAX_QUERY_LENGTH}
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            onClick={() => void runExport()}
            disabled={exporting || exportDisabled}
            title={`Downloads the lines matching these filters, newest first (up to ${NETLOGS_EXPORT_MAX_ROWS.toLocaleString()}).`}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {customOpen && (
        <form
          className="flex flex-wrap items-end gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!from || !to) return;
            apply({ range: "custom", from, to });
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              className="w-auto"
              value={from}
              max={to || todayIso}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              className="w-auto"
              value={to}
              min={from || undefined}
              max={todayIso}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" disabled={!from || !to}>
            Apply range
          </Button>
          <p className="text-[11px] text-muted-foreground">Up to 2 years at a time.</p>
        </form>
      )}

      <ActiveFilterChips filters={filters} apply={apply} />
    </div>
  );
}

function ActiveFilterChips({
  filters,
  apply,
}: {
  filters: NetLogsFilters;
  apply: (patch: Partial<NetLogsFilters>) => void;
}) {
  const chips: { key: string; label: string; clear: Partial<NetLogsFilters> }[] = [];
  if (filters.router) chips.push({ key: "router", label: "One router", clear: { router: "" } });
  for (const s of filters.severity)
    chips.push({
      key: `sev-${s}`,
      label: titleCase(s),
      clear: { severity: filters.severity.filter((x) => x !== s) },
    });
  for (const c of filters.category)
    chips.push({
      key: `cat-${c}`,
      label: categoryLabel(c),
      clear: { category: filters.category.filter((x) => x !== c) },
    });
  for (const s of filters.status)
    chips.push({
      key: `st-${s}`,
      label: titleCase(s),
      clear: { status: filters.status.filter((x) => x !== s) },
    });
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, clear: { q: "" } });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => apply(c.clear)}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-foreground hover:bg-muted"
          aria-label={`Remove filter ${c.label}`}
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => apply({ router: "", severity: [], category: [], status: [], q: "" })}
      >
        Clear all
      </button>
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  // Kept in the vocabulary's own order whatever order things are ticked in,
  // so the URL is stable.
  const toggle = (value: string, on: boolean) => {
    const set = new Set(selected);
    if (on) set.add(value);
    else set.delete(value);
    onChange(options.map((o) => o.value).filter((v) => set.has(v)));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1">
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onCheckedChange={(on) => toggle(o.value, on === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function ErrorPanel({
  friendly,
  apply,
  onRetry,
}: {
  friendly: FriendlyError;
  apply: (patch: Partial<NetLogsFilters>) => void;
  onRetry: () => void;
}) {
  const fix =
    friendly.clear === "location"
      ? { label: "Back to this location", patch: { location: "", router: "" } }
      : friendly.clear === "router"
        ? { label: "Show all routers", patch: { router: "" } }
        : friendly.clear === "filters"
          ? {
              label: "Clear filters",
              patch: { router: "", severity: [], category: [], status: [], q: "" },
            }
          : null;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{friendly.title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{friendly.detail}</p>
      <div className="mt-5 flex gap-2">
        {fix && <Button onClick={() => apply(fix.patch)}>{fix.label}</Button>}
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number | undefined;
  tone?: "error" | "warning";
  loading: boolean;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              tone === "error" && (value ?? 0) > 0 && "text-red-600 dark:text-red-400",
              tone === "warning" && (value ?? 0) > 0 && "text-amber-600 dark:text-amber-400",
            )}
          >
            {value === undefined ? "—" : value.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCards({
  summary,
  loading,
  onPickRouter,
  activeRouter,
}: {
  summary: NetLogSummary | undefined;
  loading: boolean;
  onPickRouter: (r: NetLogTopRouter) => void;
  activeRouter: string;
}) {
  const top = (summary?.top_routers ?? []).slice(0, 5);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total events" value={summary?.totals.events} loading={loading} />
      <StatCard label="Errors" value={summary?.totals.errors} tone="error" loading={loading} />
      <StatCard
        label="Warnings"
        value={summary?.totals.warnings}
        tone="warning"
        loading={loading}
      />
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Top routers</p>
          {loading ? (
            <div className="mt-2 h-16 animate-pulse rounded bg-muted" />
          ) : top.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No router logged anything here.</p>
          ) : (
            <ul className="mt-1.5 space-y-0.5">
              {top.map((r, i) => {
                const name =
                  r.router_name ?? (r.router_id ? "Unnamed router" : "Not tied to a router");
                const clickable = !!r.router_id;
                return (
                  <li key={r.router_id ?? `none-${i}`}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onPickRouter(r)}
                      title={clickable ? "Show only this router's lines" : undefined}
                      className={cn(
                        "flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-xs",
                        clickable ? "hover:bg-accent" : "cursor-default",
                        activeRouter && r.router_id === activeRouter && "bg-accent font-medium",
                      )}
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-foreground">{name}</span>
                        {r.location_name && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {r.location_name}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {r.total.toLocaleString()}
                        {r.errors > 0 && (
                          <span className="ml-1 text-red-600 dark:text-red-400">
                            · {r.errors.toLocaleString()} err
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChartsRow({ summary, loading }: { summary: NetLogSummary | undefined; loading: boolean }) {
  const rows = useMemo(() => netLogsChartRows(summary), [summary]);
  const categories = useMemo(() => presentCategories(summary), [summary]);
  const placeholder = (text: string) => (
    <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
      {text}
    </div>
  );
  const skeleton = <div className="h-[200px] animate-pulse rounded-lg bg-muted" />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Volume by day</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            skeleton
          ) : rows.length === 0 ? (
            placeholder("No lines in this period.")
          ) : (
            <Suspense fallback={skeleton}>
              <NetLogsVolumeChart rows={rows} categories={categories} />
            </Suspense>
          )}
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Errors by day</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            skeleton
          ) : rows.length === 0 ? (
            placeholder("No lines in this period.")
          ) : (summary?.totals.errors ?? 0) + (summary?.totals.warnings ?? 0) === 0 ? (
            placeholder("No errors or warnings in this period.")
          ) : (
            <Suspense fallback={skeleton}>
              <NetLogsErrorsChart rows={rows} />
            </Suspense>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogTable({
  items,
  loading,
  narrowed,
  onClear,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  items: NetLogEvent[];
  loading: boolean;
  narrowed: boolean;
  onClear: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title={narrowed ? "No lines match these filters" : "No lines in this period"}
        description={
          narrowed
            ? "Try a longer time range, or clear some filters."
            : "Nothing was recorded for this location in this time range. Try a longer range."
        }
        note="Lines appear here once a router has been set up to send them. If you expected lines and see none, contact Wyfy support."
        action={narrowed ? { label: "Clear filters", onClick: onClear } : undefined}
      />
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Timestamp</TableHead>
              <TableHead>Device/Host</TableHead>
              <TableHead>Source IP</TableHead>
              <TableHead>Destination IP</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[280px]">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => {
              const host = deviceHost(e);
              const msg = messageParts(e);
              const sev = severityTone(e.severity);
              const expanded = open.has(e.id);
              return (
                <Fragment key={e.id}>
                  <TableRow className="align-top">
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      <span
                        title={
                          e.device_time
                            ? `Device clock: ${formatTime(e.device_time)}`
                            : "Received by Wyfy"
                        }
                      >
                        {formatTime(e.received_at)}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px] uppercase tracking-wide",
                          sev === "error"
                            ? "text-red-600/80 dark:text-red-400/80"
                            : sev === "warning"
                              ? "text-amber-600/80 dark:text-amber-400/80"
                              : "text-muted-foreground/70",
                        )}
                      >
                        {severityLabel(e)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium text-foreground">{host.name}</span>
                      {host.location && (
                        <span className="block text-[11px] text-muted-foreground">
                          {host.location}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.src_ip ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.dst_ip ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.protocol ?? "—"}</TableCell>
                    <TableCell>
                      {e.status ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            STATUS_TONE_CLASS[statusTone(e.status)],
                          )}
                        >
                          {statusLabel(e.status)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-start gap-1.5">
                        {msg.detail ? (
                          <button
                            type="button"
                            onClick={() => toggle(e.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Hide full line" : "Show full line"}
                            className="mt-0.5 shrink-0 rounded text-muted-foreground hover:text-foreground"
                          >
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "break-words",
                              msg.detail ? "font-medium text-foreground" : "font-mono text-[11px]",
                            )}
                          >
                            {msg.headline}
                          </span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            {categoryLabel(e.category)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded && msg.detail && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={7} className="py-2">
                        <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
                          {msg.detail}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {items.length.toLocaleString()} line{items.length === 1 ? "" : "s"} shown, newest first
          </span>
          {hasMore ? (
            <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          ) : (
            <span>End of the list</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
