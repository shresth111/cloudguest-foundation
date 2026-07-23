import { api } from "@/services/api";
import type {
  BillingSnapshot,
  Coupon,
  CouponStatus,
  Invoice,
  Payment,
  PaymentStatus,
  Plan,
  PlanTier,
  ScheduledBillingReport,
  Subscription,
  SubscriptionStatus,
  TaxRate,
  TaxType,
  UsageRow,
} from "@/types/billing";
import type {
  BillingReportFormat,
  PaymentGateway,
  ReportFrequency,
} from "@/types/billing";

interface BackendListResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendOrg {
  id: string;
  name: string;
}

interface BackendPlanFeature {
  id: string;
  feature_key: string;
  feature_type: string;
  limit_value: string | number | null;
  is_enabled: boolean | null;
  tier_value: string | null;
}

interface BackendPlan {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  description: string | null;
  billing_cycle: string;
  base_price: string | number;
  currency: string;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  features: BackendPlanFeature[];
  created_at: string;
  updated_at: string;
}

interface BackendTaxRate {
  id: string;
  name: string;
  tax_type: string;
  rate_percentage: string | number;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toTaxRate(t: BackendTaxRate): TaxRate {
  return {
    id: t.id,
    name: t.name,
    taxType: (t.tax_type as TaxType) ?? "gst",
    ratePercentage: n(t.rate_percentage),
    countryCode: t.country_code,
    isActive: t.is_active,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

interface BackendSubscription {
  id: string;
  organization_id: string;
  license_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  started_at: string;
  cancelled_at: string | null;
  applied_coupon_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: string | number;
  currency: string | null;
  organization_id: string | null;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  applicable_plan_ids: string[];
  created_at: string;
  updated_at: string;
}

interface BackendPayment {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  amount: string | number;
  currency: string;
  status: string;
  provider: string;
  provider_payment_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  refunded_amount: string | number;
  created_at: string;
  updated_at: string;
}

interface BackendInvoiceNote {
  id: string;
  invoice_id: string;
  note_type: "credit" | "debit" | string;
  note_number: string;
  amount: string | number;
  reason: string;
  issued_at: string;
}

interface BackendInvoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  currency: string;
  notes: BackendInvoiceNote[];
  created_at: string;
  updated_at: string;
}

interface BackendUsageMetric {
  metric_key: string;
  value: string | number;
}

interface BackendUsageLimitCheck {
  metric_key: string;
  current_value: string | number;
  limit_value: string | number;
  exceeded: boolean;
}

interface BackendUsageSummary {
  organization_id: string;
  metrics: BackendUsageMetric[];
  limit_checks: BackendUsageLimitCheck[];
  any_limit_exceeded: boolean;
}

interface BackendRevenueTrendPoint {
  month: string;
  gross_amount: string | number;
  refunded_amount: string | number;
  net_amount: string | number;
}

interface BackendSuperAdminDashboard {
  revenue: {
    total_revenue: string | number;
    total_refunded: string | number;
    mrr: string | number;
    arr: string | number;
    active_paying_subscription_count: number;
    trend: BackendRevenueTrendPoint[];
  };
  subscriptions: {
    counts_by_status: Record<string, number>;
    counts_by_plan_type: Record<string, number>;
    churn: {
      active_at_period_start: number;
      cancelled_this_period: number;
      churn_rate: number | null;
    };
  };
  customers: BackendListResponse<{
    organization_id: string;
    organization_name: string;
    plan_id: string;
    plan_name: string;
    plan_slug: string;
    subscription_status: string;
    lifetime_revenue: string | number;
    outstanding_invoice_count: number;
  }>;
  failed_payments: {
    items: { payment: BackendPayment; retry_eligible: boolean }[];
    total_items: number;
  };
}

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

async function fetchAllOrganizations(): Promise<BackendOrg[]> {
  const { data } = await api.get<BackendListResponse<BackendOrg>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

// ============================================================================
// Plans -- backend has a single billing_cycle/base_price per Plan row (not
// separate monthly+annual prices) and a generic feature-key registry, not
// fixed columns. Both monthlyPrice/annualPrice are derived from the one
// real base_price so the existing Plan shape keeps working; feature flags
// are read from the matching PlanFeatureKey row when present.
// ============================================================================

const PLAN_TIERS: ReadonlySet<string> = new Set(["starter", "professional", "enterprise", "custom"]);

function planTier(planType: string): PlanTier {
  return (PLAN_TIERS.has(planType) ? planType : "custom") as PlanTier;
}

function featureLimit(features: BackendPlanFeature[], key: string): number {
  return n(features.find((f) => f.feature_key === key)?.limit_value);
}

function featureBool(features: BackendPlanFeature[], key: string): boolean {
  return features.find((f) => f.feature_key === key)?.is_enabled ?? false;
}

function supportLevelFrom(features: BackendPlanFeature[]): Plan["supportLevel"] {
  const tier = features.find((f) => f.feature_key === "support_level")?.tier_value;
  if (tier === "basic") return "email";
  if (tier === "priority") return "priority";
  if (tier === "dedicated") return "dedicated";
  return "email";
}

function toPlan(p: BackendPlan): Plan {
  const monthly = p.billing_cycle === "yearly" ? Math.round(n(p.base_price) / 12) : n(p.base_price);
  const annual = p.billing_cycle === "yearly" ? n(p.base_price) : Math.round(n(p.base_price) * 12);
  return {
    id: p.id,
    name: p.name,
    tier: planTier(p.plan_type),
    currency: p.currency,
    monthlyPrice: monthly,
    annualPrice: annual,
    includedLocations: featureLimit(p.features, "max_locations"),
    includedRouters: featureLimit(p.features, "max_routers"),
    includedGuests: featureLimit(p.features, "max_guests"),
    storageLimitGb: Math.round(featureLimit(p.features, "storage_quota_mb") / 1024),
    apiAccess: featureBool(p.features, "api_access"),
    whiteLabel: featureBool(p.features, "white_label"),
    pmsIntegration: featureBool(p.features, "pms_integration"),
    aiFeatures: featureBool(p.features, "ai_features"),
    supportLevel: supportLevelFrom(p.features),
  };
}

async function fetchAllPlans(): Promise<BackendPlan[]> {
  // list_plans defaults is_active to true -- fetch both slices to also
  // surface deactivated plans in the admin management view.
  const [active, inactive] = await Promise.all([
    api.get<BackendListResponse<BackendPlan>>("/plans", {
      params: { include_private: true, is_active: true, page_size: 100 },
    }),
    api.get<BackendListResponse<BackendPlan>>("/plans", {
      params: { include_private: true, is_active: false, page_size: 100 },
    }),
  ]);
  return [...active.data.items, ...inactive.data.items];
}

// ============================================================================
// Subscriptions -- one per organization, no bulk cross-org endpoint exists
// (GET /subscriptions/{organization_id} only), so this fans out over every
// organization the caller can reach, same convention as
// location.service.ts's fetchAllLocations.
// ============================================================================

const SUBSCRIPTION_STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "trial",
  active: "active",
  past_due: "past_due",
  paused: "paused",
  cancelled: "canceled",
};

function toSubscription(
  s: BackendSubscription,
  org: BackendOrg,
  plan: BackendPlan | undefined,
  coupon: BackendCoupon | undefined,
): Subscription {
  const status = SUBSCRIPTION_STATUS_MAP[s.status] ?? "active";
  return {
    id: s.id,
    organizationId: org.id,
    organizationName: org.name,
    planId: s.plan_id,
    planName: plan?.name ?? "Unknown plan",
    tier: plan ? planTier(plan.plan_type) : "custom",
    billingCycle: s.billing_cycle === "yearly" ? "annual" : "monthly",
    startDate: s.started_at,
    renewalDate: s.current_period_end,
    expiryDate: s.current_period_end,
    status,
    amount: plan ? n(plan.base_price) : 0,
    autoRenewal: s.auto_renew,
    paymentStatus: status === "past_due" ? "failed" : status === "trial" ? "pending" : "paid",
    locations: plan ? featureLimit(plan.features, "max_locations") : 0,
    routers: plan ? featureLimit(plan.features, "max_routers") : 0,
    maxGuests: plan ? featureLimit(plan.features, "max_guests") : 0,
    trialDays: s.trial_end ? Math.max(0, Math.round((new Date(s.trial_end).getTime() - Date.now()) / 86_400_000)) : undefined,
    discount: coupon ? n(coupon.discount_value) : undefined,
    tax: undefined,
    notes: undefined,
  };
}

async function fetchAllSubscriptions(
  orgs: BackendOrg[],
  plans: BackendPlan[],
  coupons: BackendCoupon[],
): Promise<{ sub: BackendSubscription; org: BackendOrg }[]> {
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendSubscription>(`/subscriptions/${org.id}`, {
        headers: { "X-Organization-Id": org.id },
      });
      return { sub: data, org };
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<{ sub: BackendSubscription; org: BackendOrg }> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ============================================================================
// Payments / Invoices / Usage -- also organization-scoped only (no bulk
// endpoint), same fan-out convention.
// ============================================================================

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: "pending",
  succeeded: "paid",
  failed: "failed",
  refunded: "refunded",
  partially_refunded: "refunded",
};

function toPayment(p: BackendPayment, org: BackendOrg): Payment {
  return {
    id: p.id,
    invoiceNumber: p.provider_payment_id ?? p.idempotency_key,
    organizationId: org.id,
    organizationName: org.name,
    amount: n(p.amount),
    tax: 0,
    discount: 0,
    gateway: (p.provider as PaymentGateway) ?? "stripe",
    transactionId: p.provider_payment_id ?? p.id,
    status: PAYMENT_STATUS_MAP[p.status] ?? "pending",
    paidAt: p.updated_at,
  };
}

async function fetchAllPayments(orgs: BackendOrg[]): Promise<Payment[]> {
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendPayment>>("/payments", {
        params: { page_size: 100 },
        headers: { "X-Organization-Id": org.id },
      });
      return data.items.map((p) => toPayment(p, org));
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<Payment[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

const INVOICE_STATUS_MAP: Record<string, PaymentStatus> = {
  paid: "paid",
  issued: "pending",
  draft: "pending",
  overdue: "pending",
  cancelled: "failed",
  void: "failed",
};

function toInvoice(inv: BackendInvoice, org: BackendOrg): Invoice[] {
  const base: Invoice = {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    organizationName: org.name,
    type: "tax_invoice",
    amount: n(inv.subtotal),
    tax: n(inv.tax_amount),
    total: n(inv.total_amount),
    issuedAt: inv.issue_date,
    dueAt: inv.due_date,
    status: INVOICE_STATUS_MAP[inv.status] ?? "pending",
  };
  // Credit/debit notes are separate documents attached to their parent
  // invoice on the real backend (Invoice.notes), not standalone rows --
  // flattened here so this UI's single mixed-type list keeps working.
  const notes: Invoice[] = inv.notes.map((note) => ({
    id: note.id,
    invoiceNumber: note.note_number,
    organizationName: org.name,
    type: note.note_type === "credit" ? "credit_note" : "debit_note",
    amount: n(note.amount),
    tax: 0,
    total: n(note.amount),
    issuedAt: note.issued_at,
    dueAt: note.issued_at,
    status: "paid",
  }));
  return [base, ...notes];
}

async function fetchAllInvoices(orgs: BackendOrg[]): Promise<Invoice[]> {
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendInvoice>>("/invoices", {
        params: { page_size: 100 },
        headers: { "X-Organization-Id": org.id },
      });
      return data.items.flatMap((inv) => toInvoice(inv, org));
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<Invoice[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

function usageMetric(metrics: BackendUsageMetric[], key: string): number {
  return n(metrics.find((m) => m.metric_key === key)?.value);
}

function usageLimit(checks: BackendUsageLimitCheck[], key: string): { used: number; limit: number } {
  const row = checks.find((c) => c.metric_key === key);
  return { used: n(row?.current_value), limit: n(row?.limit_value) };
}

function toUsageRow(u: BackendUsageSummary, org: BackendOrg): UsageRow {
  const locations = usageLimit(u.limit_checks, "locations");
  const routers = usageLimit(u.limit_checks, "routers");
  const storage = usageLimit(u.limit_checks, "storage_usage_mb");
  return {
    organizationId: org.id,
    organizationName: org.name,
    locationsUsed: locations.used,
    locationsLimit: locations.limit,
    routersUsed: routers.used,
    routersLimit: routers.limit,
    guestSessions: usageMetric(u.metrics, "guest_sessions"),
    smsOtp: usageMetric(u.metrics, "sms_usage"),
    emailOtp: usageMetric(u.metrics, "email_usage"),
    storageUsedGb: Math.round(storage.used / 1024),
    storageLimitGb: Math.round(storage.limit / 1024),
    apiCalls: usageMetric(u.metrics, "api_requests"),
  };
}

async function fetchAllUsage(orgs: BackendOrg[]): Promise<UsageRow[]> {
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendUsageSummary>(`/usage/${org.id}`, {
        headers: { "X-Organization-Id": org.id },
      });
      return toUsageRow(data, org);
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<UsageRow> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ============================================================================
// Coupons
// ============================================================================

function couponStatus(c: BackendCoupon): CouponStatus {
  if (!c.is_active) return "disabled";
  if (c.valid_until && new Date(c.valid_until).getTime() < Date.now()) return "expired";
  return "active";
}

function toCoupon(c: BackendCoupon): Coupon {
  return {
    id: c.id,
    code: c.code,
    discountType: c.discount_type === "flat" ? "fixed" : "percentage",
    discountValue: n(c.discount_value),
    expiryDate: c.valid_until ?? c.valid_from,
    maxUsage: c.max_uses ?? 0,
    used: c.current_uses,
    status: couponStatus(c),
  };
}

async function fetchAllCoupons(): Promise<BackendCoupon[]> {
  const { data } = await api.get<BackendListResponse<BackendCoupon>>("/coupons", {
    params: { page_size: 100 },
  });
  return data.items;
}

// ============================================================================
// Aggregate snapshot -- kpis/revenue/reminders come from the real
// /billing/dashboard/super-admin composite; subscriptions/payments/
// invoices/usage are fanned out per organization (see helpers above).
// gateways/scheduledReports/generateReport/generateInvoice/sendReminder
// have no backend equivalent (no connectable-gateway registry, no
// scheduled-report or ad-hoc report-generation endpoints exist in
// backend/app/domains/billing) -- left mocked below, unchanged.
// ============================================================================

let gatewaysStore = [
  { id: "stripe" as PaymentGateway, name: "Stripe", connected: true, lastTransactionAt: undefined as string | undefined, mode: "live" as const },
  { id: "razorpay" as PaymentGateway, name: "Razorpay", connected: true, lastTransactionAt: undefined as string | undefined, mode: "live" as const },
  { id: "paypal" as PaymentGateway, name: "PayPal", connected: false, lastTransactionAt: undefined as string | undefined, mode: "test" as const },
];

let scheduledReports: ScheduledBillingReport[] = [
  { id: "srp_1", name: "Weekly revenue digest", frequency: "weekly", recipients: ["finance@cloudguest.io"], format: "pdf", enabled: true, nextRunAt: new Date(Date.now() + 3 * 86_400_000).toISOString() },
  { id: "srp_2", name: "Monthly MRR report", frequency: "monthly", recipients: ["cfo@cloudguest.io", "ops@cloudguest.io"], format: "excel", enabled: true, nextRunAt: new Date(Date.now() + 10 * 86_400_000).toISOString() },
  { id: "srp_3", name: "Daily overdue payments", frequency: "daily", recipients: ["billing@cloudguest.io"], format: "csv", enabled: false, nextRunAt: new Date(Date.now() + 86_400_000).toISOString() },
];

async function fetchDashboard(): Promise<BackendSuperAdminDashboard> {
  const { data } = await api.get<BackendSuperAdminDashboard>("/billing/dashboard/super-admin", {
    params: { months: 12, page_size: 100 },
  });
  return data;
}

async function findSubscriptionContext(
  subscriptionId: string,
): Promise<{ org: BackendOrg; sub: BackendSubscription } | undefined> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendSubscription>(`/subscriptions/${org.id}`, {
        headers: { "X-Organization-Id": org.id },
      });
      return { org, sub: data };
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<{ org: BackendOrg; sub: BackendSubscription }> => r.status === "fulfilled")
    .map((r) => r.value)
    .find((r) => r.sub.id === subscriptionId);
}

export const billingService = {
  async getSnapshot(): Promise<BillingSnapshot> {
    const [dashboard, orgs, backendPlans, backendCoupons] = await Promise.all([
      fetchDashboard(),
      fetchAllOrganizations(),
      fetchAllPlans(),
      fetchAllCoupons(),
    ]);
    const plans = backendPlans.map(toPlan);
    const [subRecords, payments, invoices, usage] = await Promise.all([
      fetchAllSubscriptions(orgs, backendPlans, backendCoupons),
      fetchAllPayments(orgs),
      fetchAllInvoices(orgs),
      fetchAllUsage(orgs),
    ]);
    const subscriptions = subRecords.map(({ sub, org }) =>
      toSubscription(
        sub,
        org,
        backendPlans.find((p) => p.id === sub.plan_id),
        backendCoupons.find((c) => c.id === sub.applied_coupon_id),
      ),
    );

    const active = subscriptions.filter((s) => s.status === "active");
    const trial = subscriptions.filter((s) => s.status === "trial").length;
    const now = Date.now();
    const expiring = subscriptions.filter((s) => {
      const t = new Date(s.renewalDate).getTime();
      return t - now < 14 * 86_400_000 && t - now > 0;
    }).length;

    const paid = payments.filter((p) => p.status === "paid").length;
    const collectionRate = payments.length ? Math.round((paid / payments.length) * 100) : 0;
    const mrr = Math.round(n(dashboard.revenue.mrr));
    const arpo = active.length ? Math.round(mrr / active.length) : 0;

    const reminders: BillingSnapshot["reminders"] = dashboard.failed_payments.items.map((row, i) => {
      const org = orgs.find((o) => o.id === row.payment.organization_id);
      return {
        id: `fp_${row.payment.id ?? i}`,
        type: "payment_failed",
        title: row.payment.failure_reason ?? "Payment retry required",
        organizationName: org?.name ?? "Unknown organization",
        dueAt: row.payment.updated_at,
        severity: "critical",
      };
    });
    dashboard.customers.items
      .filter((c) => c.outstanding_invoice_count > 0)
      .slice(0, 10)
      .forEach((c, i) => {
        reminders.push({
          id: `inv_due_${c.organization_id}_${i}`,
          type: "invoice_due",
          title: `${c.outstanding_invoice_count} outstanding invoice(s)`,
          organizationName: c.organization_name,
          dueAt: new Date().toISOString(),
          severity: "warning",
        });
      });

    const planTierCounts = dashboard.customers.items.reduce<Record<string, number>>((acc, c) => {
      const plan = backendPlans.find((p) => p.id === c.plan_id);
      const tier = plan ? planTier(plan.plan_type) : "custom";
      acc[tier] = (acc[tier] ?? 0) + 1;
      return acc;
    }, {});

    return {
      kpis: {
        mrr,
        arr: Math.round(n(dashboard.revenue.arr)),
        activeSubscriptions: active.length,
        trialOrganizations: trial,
        expiringPlans: expiring,
        overduePayments: dashboard.failed_payments.total_items,
        totalRevenue: Math.round(n(dashboard.revenue.total_revenue)),
        collectionRate,
        arpo,
      },
      subscriptions,
      payments,
      invoices,
      coupons: backendCoupons.map(toCoupon),
      usage,
      gateways: gatewaysStore,
      revenue: {
        trend: dashboard.revenue.trend.map((pt, i, arr) => {
          const prev = i > 0 ? n(arr[i - 1].net_amount) : n(pt.net_amount);
          const growth = prev ? Math.round(((n(pt.net_amount) - prev) / prev) * 1000) / 10 : 0;
          return { label: pt.month, revenue: Math.round(n(pt.net_amount)), growth };
        }),
        planDistribution: (["starter", "professional", "enterprise", "custom"] as PlanTier[]).map((tier) => ({
          tier,
          count: planTierCounts[tier] ?? 0,
          revenue: 0,
        })),
        subscriptionDistribution: Object.entries(dashboard.subscriptions.counts_by_status).map(([status, count]) => ({
          status: SUBSCRIPTION_STATUS_MAP[status] ?? "active",
          count,
        })),
        paymentSuccessRate: [],
        churnRate: dashboard.subscriptions.churn.churn_rate === null
          ? []
          : [{ label: "Current", value: Math.round(dashboard.subscriptions.churn.churn_rate * 1000) / 10 }],
      },
      reminders,
      plans,
    };
  },

  async listOrganizations() {
    const orgs = await fetchAllOrganizations();
    return orgs.map((o) => ({ id: o.id, name: o.name }));
  },

  async createSubscription(input: Omit<Subscription, "id" | "organizationName" | "planName" | "tier" | "startDate" | "renewalDate" | "expiryDate" | "status" | "amount" | "paymentStatus">) {
    const [orgs, backendPlans, backendCoupons] = await Promise.all([
      fetchAllOrganizations(),
      fetchAllPlans(),
      fetchAllCoupons(),
    ]);
    const org = orgs.find((o) => o.id === input.organizationId);
    const plan = backendPlans.find((p) => p.id === input.planId);
    const coupon = backendCoupons.find((c) => c.id === input.notes || c.code === input.notes);
    const { data } = await api.post<BackendSubscription>(
      "/subscriptions",
      {
        organization_id: input.organizationId,
        plan_id: input.planId,
        coupon_code: coupon?.code,
      },
      { headers: { "X-Organization-Id": input.organizationId } },
    );
    return toSubscription(data, org ?? { id: input.organizationId, name: "New organization" }, plan, coupon);
  },

  async cancelSubscription(id: string) {
    const ctx = await findSubscriptionContext(id);
    if (!ctx) return false;
    await api.post(
      `/subscriptions/${id}/cancel`,
      { immediate: true },
      { headers: { "X-Organization-Id": ctx.org.id } },
    );
    return true;
  },

  async upgradeSubscription(id: string) {
    const ctx = await findSubscriptionContext(id);
    if (!ctx) return false;
    const backendPlans = await fetchAllPlans();
    const active = backendPlans.filter((p) => p.is_active).sort((a, b) => n(a.base_price) - n(b.base_price));
    const idx = active.findIndex((p) => p.id === ctx.sub.plan_id);
    const next = active[Math.min(idx + 1, active.length - 1)];
    if (!next) return false;
    await api.post(
      `/licenses/${ctx.sub.license_id}/upgrade`,
      { new_plan_id: next.id },
      { headers: { "X-Organization-Id": ctx.org.id } },
    );
    return true;
  },

  async downgradeSubscription(id: string) {
    const ctx = await findSubscriptionContext(id);
    if (!ctx) return false;
    const backendPlans = await fetchAllPlans();
    const active = backendPlans.filter((p) => p.is_active).sort((a, b) => n(a.base_price) - n(b.base_price));
    const idx = active.findIndex((p) => p.id === ctx.sub.plan_id);
    const prev = active[Math.max(idx - 1, 0)];
    if (!prev) return false;
    await api.post(
      `/licenses/${ctx.sub.license_id}/downgrade`,
      { new_plan_id: prev.id },
      { headers: { "X-Organization-Id": ctx.org.id } },
    );
    return true;
  },

  async savePlan(input: Omit<Plan, "id"> & { id?: string }) {
    const features = [
      { feature_key: "max_locations", feature_type: "limit", limit_value: input.includedLocations },
      { feature_key: "max_routers", feature_type: "limit", limit_value: input.includedRouters },
      { feature_key: "max_guests", feature_type: "limit", limit_value: input.includedGuests },
      { feature_key: "storage_quota_mb", feature_type: "limit", limit_value: input.storageLimitGb * 1024 },
      { feature_key: "api_access", feature_type: "boolean", is_enabled: input.apiAccess },
      { feature_key: "white_label", feature_type: "boolean", is_enabled: input.whiteLabel },
      { feature_key: "pms_integration", feature_type: "boolean", is_enabled: input.pmsIntegration },
      { feature_key: "ai_features", feature_type: "boolean", is_enabled: input.aiFeatures },
      {
        feature_key: "support_level",
        feature_type: "tier",
        tier_value: input.supportLevel === "email" ? "basic" : input.supportLevel === "24x7" ? "dedicated" : input.supportLevel,
      },
    ];
    if (input.id) {
      const { data } = await api.put<BackendPlan>(`/plans/${input.id}`, {
        name: input.name,
        base_price: input.monthlyPrice,
        currency: input.currency || "INR",
        features,
      });
      return toPlan(data);
    }
    const { data } = await api.post<BackendPlan>("/plans", {
      name: input.name,
      slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      plan_type: input.tier,
      billing_cycle: "monthly",
      base_price: input.monthlyPrice,
      currency: input.currency || "INR",
      is_active: true,
      is_public: true,
      sort_order: 0,
      features,
    });
    return toPlan(data);
  },

  async deletePlan(id: string) {
    // No hard delete on the backend -- deactivate is the real equivalent.
    await api.delete(`/plans/${id}`);
    return true;
  },

  async saveCoupon(input: Omit<Coupon, "id" | "used"> & { id?: string }) {
    if (input.id) {
      const { data } = await api.put<BackendCoupon>(`/coupons/${input.id}`, {
        discount_type: input.discountType === "fixed" ? "flat" : "percentage",
        discount_value: input.discountValue,
        max_uses: input.maxUsage,
        valid_until: input.expiryDate,
        is_active: input.status !== "disabled",
      });
      return toCoupon(data);
    }
    const { data } = await api.post<BackendCoupon>("/coupons", {
      code: input.code,
      discount_type: input.discountType === "fixed" ? "flat" : "percentage",
      discount_value: input.discountValue,
      max_uses: input.maxUsage || null,
      valid_from: new Date().toISOString(),
      valid_until: input.expiryDate,
      is_active: input.status !== "disabled",
      applicable_plan_ids: [],
    });
    return toCoupon(data);
  },

  async deleteCoupon(id: string) {
    // No hard delete on the backend -- deactivate is the real equivalent.
    await api.delete(`/coupons/${id}`);
    return true;
  },

  // No backend concept of a connectable/toggleable payment gateway registry
  // (PaymentProvider is just a per-payment field: stripe/razorpay) -- kept
  // mocked, no real endpoint to wire.
  async toggleGateway(id: PaymentGateway) {
    await delay(200);
    gatewaysStore = gatewaysStore.map((g) => (g.id === id ? { ...g, connected: !g.connected } : g));
    return true;
  },

  async refundPayment(id: string) {
    const orgs = await fetchAllOrganizations();
    const settled = await Promise.allSettled(
      orgs.map(async (org) => {
        const { data } = await api.get<BackendListResponse<BackendPayment>>("/payments", {
          params: { page_size: 100 },
          headers: { "X-Organization-Id": org.id },
        });
        return { org, payment: data.items.find((p) => p.id === id) };
      }),
    );
    const found = settled
      .filter((r): r is PromiseFulfilledResult<{ org: BackendOrg; payment: BackendPayment | undefined }> => r.status === "fulfilled")
      .map((r) => r.value)
      .find((r) => r.payment);
    if (!found) return false;
    await api.post(`/payments/${id}/refund`, {}, { headers: { "X-Organization-Id": found.org.id } });
    return true;
  },

  // No scheduled-report entity exists in backend/app/domains/billing --
  // kept mocked, no real endpoint to wire.
  async listScheduledReports() {
    await delay(150);
    return scheduledReports;
  },
  async createScheduledReport(input: Omit<ScheduledBillingReport, "id" | "nextRunAt">) {
    await delay(250);
    const rep: ScheduledBillingReport = {
      ...input,
      id: `srp_${Date.now()}`,
      nextRunAt: new Date(Date.now() + (input.frequency === "daily" ? 1 : input.frequency === "weekly" ? 7 : 30) * 86_400_000).toISOString(),
    };
    scheduledReports = [rep, ...scheduledReports];
    return rep;
  },
  async toggleScheduledReport(id: string, enabled: boolean) {
    await delay(150);
    scheduledReports = scheduledReports.map((r) => (r.id === id ? { ...r, enabled } : r));
    return true;
  },
  async deleteScheduledReport(id: string) {
    await delay(150);
    scheduledReports = scheduledReports.filter((r) => r.id !== id);
    return true;
  },
  // No generic ad-hoc report-generation endpoint exists -- kept mocked.
  async generateReport(type: string, format: BillingReportFormat) {
    await delay(600);
    return { fileName: `${type}-report-${Date.now()}.${format}`, size: `${Math.round(200 + Math.random() * 1800)} KB` };
  },

  async generateInvoice(id: string) {
    // GET /invoices/{id}/download returns the file directly (no shareable
    // URL concept) -- resolving to a blob URL is a real backend call.
    try {
      const response = await api.get(`/invoices/${id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      return { url, fileName: `${id}.pdf` };
    } catch {
      return { url: `#invoice-${id}`, fileName: `${id}.pdf` };
    }
  },

  // No reminder-dispatch endpoint exists in backend/app/domains/billing --
  // kept mocked.
  async sendReminder(id: string, _frequency?: ReportFrequency) {
    await delay(200);
    return { ok: true, id };
  },

  // GST / tax rate configuration -- real /tax-rates CRUD. The backend
  // computes the actual CGST/SGST/IGST split per-invoice from these rows
  // (validators.compute_tax_breakdown); this is the platform operator's
  // rate catalog, not a per-invoice control.
  async listTaxRates(): Promise<TaxRate[]> {
    const { data } = await api.get<BackendListResponse<BackendTaxRate>>("/tax-rates", {
      params: { page_size: 100 },
    });
    return data.items.map(toTaxRate);
  },

  async saveTaxRate(input: Omit<TaxRate, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<TaxRate> {
    if (input.id) {
      const { data } = await api.put<BackendTaxRate>(`/tax-rates/${input.id}`, {
        name: input.name,
        tax_type: input.taxType,
        rate_percentage: input.ratePercentage,
        country_code: input.countryCode,
        is_active: input.isActive,
      });
      return toTaxRate(data);
    }
    const { data } = await api.post<BackendTaxRate>("/tax-rates", {
      name: input.name,
      tax_type: input.taxType,
      rate_percentage: input.ratePercentage,
      country_code: input.countryCode,
      is_active: input.isActive,
    });
    return toTaxRate(data);
  },
};

export type BillingService = typeof billingService;
