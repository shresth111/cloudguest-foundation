import { Suspense, lazy, type ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  MapPin,
  Users,
  IndianRupee,
  Router,
  UserCheck,
  AlertTriangle,
  Sparkles,
  Plus,
  ArrowRight,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
} from "@/components/master/MasterKit";
import { CHART_BODY_H } from "@/components/master/chart-layout";
import { useAnalyticsSnapshot } from "@/hooks/useAnalytics";
import { useBillingOverview, useBillingSnapshot } from "@/hooks/useBilling";

// Both point at the same module, so this is ONE extra chunk request, not two.
const RevenueTrendChart = lazy(() =>
  import("@/components/master/PlatformOverviewCharts").then((m) => ({
    default: m.RevenueTrendChart,
  })),
);
const PlanTierChart = lazy(() =>
  import("@/components/master/PlatformOverviewCharts").then((m) => ({ default: m.PlanTierChart })),
);

export const Route = createFileRoute("/master/")({
  component: PlatformOverview,
});

// Amounts are already rupees end-to-end (Razorpay is the only gateway,
// every Plan/Subscription carries currency: "INR") -- this was just
// mislabeled with a $ prefix and US k-notation. Indian format instead:
// L for lakh (1,00,000), Cr for crore (1,00,00,000).
function money(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${n}`;
}

/** Placeholder for a chart body, at exactly the height the chart will occupy
 * (`CHART_BODY_H`, imported from the same module the chart itself reads it
 * from, so the two cannot drift). Used both as the lazy chunk's Suspense
 * fallback and as the "data hasn't arrived yet" state, so those two waits look
 * like one wait rather than two. */
function ChartPlaceholder() {
  return (
    <div
      className="shimmer w-full rounded-lg opacity-60"
      style={{ height: CHART_BODY_H }}
      aria-hidden
    />
  );
}

function ChartCard({
  title,
  className,
  ready,
  children,
}: {
  title: string;
  className?: string;
  ready: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {ready ? (
        <Suspense fallback={<ChartPlaceholder />}>{children}</Suspense>
      ) : (
        <ChartPlaceholder />
      )}
    </div>
  );
}

/** One line of the Billing Reminders card, at the height a real reminder row
 * occupies -- same padding, same two stacked text lines, same border. */
function ReminderSkeletonRow() {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 p-3.5 last:border-0">
      <div className="mt-0.5 h-4 w-4 shrink-0 rounded shimmer" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-[1lh] w-2/3 rounded shimmer text-sm" />
        <div className="h-[1lh] w-1/3 rounded shimmer text-xs" />
      </div>
    </div>
  );
}

/** A shimmer bar sized to a table cell's text line, for the columns of the
 * Organizations table that come from the (much slower) billing snapshot while
 * the analytics-backed columns of the same row are already showing real data. */
function CellSkeleton({ w }: { w: string }) {
  return <span aria-hidden className={`shimmer inline-block h-[1lh] rounded align-middle ${w}`} />;
}

/**
 * This used to be entirely static mock data from lib/masterData.ts (8
 * fixed KPI numbers, an always-identical "recent customers" table, a
 * synthetic 24h sessions curve, a "Tenants by Region" chart backed by a
 * field no real Organization row has). Real, platform-wide data for most
 * of this exists (see analytics.service.ts's own module comment for the
 * exact boundary of what GET /dashboard/super-admin/unified does and
 * doesn't cover) -- wired to that plus the real billing snapshot
 * (already real+demo-wired, see billing.service.ts) for MRR/plan mix/
 * billing reminders, which the analytics endpoint has no equivalent for.
 * "Tenants by Region" is dropped (no real region field on Organization
 * anywhere in the backend) in favor of a real plan-mix chart.
 *
 * LOADING BEHAVIOUR -- read before "simplifying" the three queries back into
 * one gate. This page reads three independent sources with wildly different
 * costs, and it used to render NOTHING until the two slowest had both
 * resolved:
 *
 *   useAnalyticsSnapshot   2 + N requests, 2 waves  (N = organizations)
 *   useBillingOverview     3 requests,     1 wave
 *   useBillingSnapshot     5 + 4N requests, 2 waves
 *
 * Measured in real Chromium against a real `.output/` build (30Mbps/40ms
 * link, 150ms/request backend, 8 concurrent, 12 orgs): the KPI numbers, both
 * charts and the reminders all appeared together at 2517ms, because a single
 * `analytics.isLoading || billing.isLoading` gate held every one of them
 * behind `useBillingSnapshot`'s per-org fan-out -- including the seven KPI
 * tiles that come from `analytics` and were ready at 1180ms. At 40 orgs that
 * gate was 9643ms. So: every card below gates on its OWN query, and every
 * loading state reserves exactly the space its loaded content will occupy.
 */
function PlatformOverview() {
  const analytics = useAnalyticsSnapshot("last30");
  const overview = useBillingOverview();
  const billing = useBillingSnapshot();

  const kpis = analytics.data?.kpis;
  const billingKpis = billing.data?.kpis;
  const orgRows = analytics.data?.organizations ?? [];
  const subscriptions = billing.data?.subscriptions ?? [];
  const reminders = billing.data?.reminders ?? [];

  const recent = orgRows.slice(0, 5).map((o) => ({
    ...o,
    sub: subscriptions.find((s) => s.organizationId === o.id),
  }));

  // Label + icon are static, so every tile renders its own frame immediately
  // and swaps only its number in. `pending` is per-tile, keyed to whichever
  // query actually supplies that number.
  const KPI_TILES: {
    key: string;
    label: string;
    value: string;
    icon: ComponentType<{ className?: string }>;
    pending: boolean;
    accent?: boolean;
  }[] = [
    {
      key: "tenants",
      label: "Tenants",
      value: String(kpis?.totalOrganizations ?? 0),
      icon: Building2,
      pending: !kpis,
    },
    {
      key: "locations",
      label: "Active Locations",
      value: String(kpis?.totalLocations ?? 0),
      icon: MapPin,
      pending: !kpis,
    },
    {
      key: "guests",
      label: "Active Sessions",
      value: (kpis?.activeGuests ?? 0).toLocaleString(),
      icon: Users,
      pending: !kpis,
    },
    {
      key: "mrr",
      label: "MRR",
      value: money(overview.data?.mrr ?? 0),
      icon: IndianRupee,
      pending: !overview.data,
    },
    {
      key: "routers",
      label: "Routers Online",
      value: `${kpis?.activeRouters ?? 0}/${kpis?.totalRouters ?? 0}`,
      icon: Router,
      pending: !kpis,
    },
    {
      key: "totalGuests",
      label: "Total Guests",
      value: (kpis?.totalGuests ?? 0).toLocaleString(),
      icon: UserCheck,
      pending: !kpis,
    },
    {
      key: "reminders",
      label: "Billing Reminders",
      value: String(reminders.length),
      icon: AlertTriangle,
      pending: !billing.data,
      accent: reminders.length > 0,
    },
    {
      key: "trials",
      label: "Trials",
      value: String(billingKpis?.trialOrganizations ?? 0),
      icon: Sparkles,
      pending: !billingKpis,
    },
  ];

  return (
    <MasterShell title="Platform Overview">
      <MPageShell>
        <MSectionHeader
          eyebrow="Wyfy Guest · Operator"
          title="Platform Overview"
          actions={
            <Link to="/master/customers">
              <MButton variant="primary">
                <Plus /> Add Customer
              </MButton>
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {KPI_TILES.map((k) => (
            <MStat
              key={k.key}
              label={k.label}
              value={k.value}
              icon={k.icon}
              accent={k.accent}
              loading={k.pending}
            />
          ))}
        </div>

        {/* Charts. Both read only `useBillingOverview` (3 requests, one wave),
            never the 5+4N snapshot -- see billingService.getOverview. */}
        <div className="grid gap-3 lg:grid-cols-3">
          <ChartCard title="Revenue Trend" className="lg:col-span-2" ready={!!overview.data}>
            <RevenueTrendChart data={overview.data?.trend ?? []} />
          </ChartCard>

          <ChartCard title="Subscribers by Plan Tier" ready={!!overview.data}>
            <PlanTierChart data={overview.data?.planDistribution ?? []} />
          </ChartCard>
        </div>

        {/* Recent customers + billing reminders */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Organizations</p>
              <Link
                to="/master/customers"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <MTable
              // Skeleton rows only while there is genuinely nothing to show.
              // The pre-existing behaviour rendered the real "No organizations
              // yet." empty state during loading, i.e. it stated something
              // false about the platform and then replaced it -- worse than a
              // blank, and the source of the row-count jump this page had.
              loading={analytics.isPending}
              skeletonRows={5}
              head={
                <>
                  <MTh>Customer</MTh>
                  <MTh>Plan</MTh>
                  <MTh className="hidden sm:table-cell">Locations</MTh>
                  <MTh>Routers</MTh>
                  <MTh>MRR</MTh>
                  <MTh>Status</MTh>
                </>
              }
            >
              {recent.map((c) => (
                <MTr key={c.id}>
                  <MTd>
                    <p className="font-semibold">{c.name}</p>
                  </MTd>
                  {/* Plan / MRR / Status come from the slow snapshot; the rest
                      of the row is already real. Each cell holds its own line
                      height so the row does not grow when they arrive. */}
                  <MTd className="text-sm">
                    {billing.isPending ? <CellSkeleton w="w-16" /> : (c.sub?.planName ?? "—")}
                  </MTd>
                  <MTd className="hidden tabular-nums sm:table-cell">{c.activeLocations}</MTd>
                  <MTd className="tabular-nums">{c.activeRouters}</MTd>
                  <MTd className="font-semibold tabular-nums">
                    {billing.isPending ? (
                      <CellSkeleton w="w-12" />
                    ) : c.sub ? (
                      money(c.sub.amount)
                    ) : (
                      "—"
                    )}
                  </MTd>
                  <MTd>
                    {billing.isPending ? (
                      <CellSkeleton w="w-14" />
                    ) : c.sub ? (
                      <MTag label={c.sub.status} />
                    ) : (
                      <MTag label="no plan" />
                    )}
                  </MTd>
                </MTr>
              ))}
              {!analytics.isPending && recent.length === 0 && (
                <MTr>
                  <MTd className="py-8 text-center text-muted-foreground">
                    No organizations yet.
                  </MTd>
                </MTr>
              )}
            </MTable>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Billing Reminders</p>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              {billing.isPending ? (
                // Four rows: the same count the loaded card caps at, so the
                // card keeps its height when the real reminders land.
                Array.from({ length: 4 }).map((_, i) => <ReminderSkeletonRow key={i} />)
              ) : reminders.length === 0 ? (
                <p className="p-3.5 text-sm text-muted-foreground">Nothing needs attention.</p>
              ) : (
                reminders.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 border-b border-border/70 p-3.5 last:border-0"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.organizationName}</p>
                    </div>
                    <MTag label={r.severity} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </MPageShell>
    </MasterShell>
  );
}
