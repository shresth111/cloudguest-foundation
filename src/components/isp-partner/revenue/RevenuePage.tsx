/**
 * `/partner/revenue` (REVENUE-HUB + CHURN-RISK, ISP_REVENUE_HUB_ENABLED).
 * Read-only. Month, zone, package, tab and risk rule live in the URL. The
 * header's Switch zone (ZONE-1) still narrows everything; the hub's own zone
 * filter is one zone exactly (a leaderboard row).
 */
import { MSectionHeader, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ChurnRiskPanel } from "@/components/isp-partner/revenue/ChurnRiskPanel";
import { RevenueOverview } from "@/components/isp-partner/revenue/RevenueOverview";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { useRevenueSummary } from "@/hooks/isp-partner/useRevenue";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { monthOptions } from "@/lib/isp-partner/revenue";
import type { RevFilters, RiskReason } from "@/services/isp-partner/revenue-types";

export type RevenueTab = "overview" | "risk";

export interface RevenueSearch {
  tab?: RevenueTab;
  month?: string;
  /** A zone id, or "none" for subscribers without a zone. */
  in_zone?: string;
  package?: string;
  reason?: RiskReason;
}

export function RevenuePage({
  search,
  onSearch,
}: {
  search: RevenueSearch;
  onSearch: (next: RevenueSearch) => void;
}) {
  const { can } = usePartner();
  const tab = search.tab ?? "overview";
  const months = monthOptions();
  const filters: RevFilters = {
    month: search.month,
    months: 6,
    zone_id: search.in_zone && search.in_zone !== "none" ? search.in_zone : undefined,
    no_zone: search.in_zone === "none" || undefined,
    package_id: search.package,
  };
  const q = useRevenueSummary(filters);
  const zones = useZones(can("isp_zones.read"));
  const packages = usePackages({ page_size: 100 }, can("isp_plans.read"));
  const set = (patch: Partial<RevenueSearch>) => onSearch({ ...search, ...patch });
  const off = ispErrorStatus(q.error) === 404 && !q.data && !search.in_zone && !search.package;

  if (off)
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          The revenue hub is not switched on for your ISP. Ask Wyfy to turn it on.
        </p>
      </Card>
    );

  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Money"
        title="Revenue"
        description={
          q.data
            ? `Read-only, from your invoices, payments and subscribers. Updated ${formatDateTime(q.data.as_of)}.`
            : "Read-only, from your invoices, payments and subscribers."
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <MSeg<RevenueTab>
          value={tab}
          onChange={(t) => set({ tab: t })}
          options={[
            { value: "overview", label: "Overview" },
            { value: "risk", label: "Churn risk" },
          ]}
        />
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Month"
          value={search.month ?? months[0].value}
          onChange={(e) =>
            set({ month: e.target.value === months[0].value ? undefined : e.target.value })
          }
        >
          {months.map((m, i) => (
            <option key={m.value} value={m.value}>
              {i === 0 ? `${m.label} (this month)` : m.label}
            </option>
          ))}
        </select>
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Zone"
          value={search.in_zone ?? ""}
          onChange={(e) => set({ in_zone: e.target.value || undefined })}
        >
          <option value="">All zones</option>
          <option value="none">No zone</option>
          {(zones.data ?? []).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Package"
          value={search.package ?? ""}
          onChange={(e) => set({ package: e.target.value || undefined })}
        >
          <option value="">All packages</option>
          {(packages.data?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {(search.in_zone || search.package || search.month) && (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onSearch({ tab: search.tab, reason: search.reason })}
          >
            Clear filters
          </button>
        )}
      </div>
      {tab === "risk" ? (
        <ChurnRiskPanel
          filters={filters}
          reason={search.reason ?? null}
          onReason={(r) => set({ reason: r ?? undefined })}
        />
      ) : q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the revenue hub" />
      ) : !q.data ? (
        <LoadingBlock />
      ) : (
        <RevenueOverview
          d={q.data}
          filters={filters}
          onZone={(z) => set({ in_zone: z ?? undefined })}
          onPackage={(p) => set({ package: p })}
        />
      )}
    </div>
  );
}
