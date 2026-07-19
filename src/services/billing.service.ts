import type {
  BillingSnapshot,
  Coupon,
  Invoice,
  Payment,
  Plan,
  ScheduledBillingReport,
  Subscription,
} from "@/types/billing";
import type {
  BillingReportFormat,
  PaymentGateway,
  ReportFrequency,
} from "@/types/billing";

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const ORG_NAMES = [
  "Nova Hospitality",
  "Beacon Retail",
  "Skyline Airports",
  "Marina Resorts",
  "Vantage Coworks",
  "Harbor Cafes",
  "Aurora Malls",
  "Summit Hotels",
  "Northwind Health",
  "Cascade Universities",
  "Meridian Stadiums",
  "Orbit Coliving",
  "Lumen Clinics",
  "Trident Marine",
  "Pinnacle Airlines",
  "Riverstone Hostels",
  "Zenith Convention",
  "Emerald Country Club",
  "Solace Spas",
  "Halcyon Cruises",
];

const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Starter",
    tier: "starter",
    monthlyPrice: 49,
    annualPrice: 490,
    includedLocations: 2,
    includedRouters: 4,
    includedGuests: 500,
    storageLimitGb: 25,
    apiAccess: false,
    whiteLabel: false,
    pmsIntegration: false,
    aiFeatures: false,
    supportLevel: "email",
  },
  {
    id: "plan_professional",
    name: "Professional",
    tier: "professional",
    monthlyPrice: 199,
    annualPrice: 1990,
    includedLocations: 10,
    includedRouters: 25,
    includedGuests: 5000,
    storageLimitGb: 100,
    apiAccess: true,
    whiteLabel: false,
    pmsIntegration: true,
    aiFeatures: false,
    supportLevel: "priority",
    popular: true,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    tier: "enterprise",
    monthlyPrice: 799,
    annualPrice: 7990,
    includedLocations: 50,
    includedRouters: 200,
    includedGuests: 50000,
    storageLimitGb: 1000,
    apiAccess: true,
    whiteLabel: true,
    pmsIntegration: true,
    aiFeatures: true,
    supportLevel: "24x7",
  },
  {
    id: "plan_custom",
    name: "Custom",
    tier: "custom",
    monthlyPrice: 0,
    annualPrice: 0,
    includedLocations: 100,
    includedRouters: 500,
    includedGuests: 100000,
    storageLimitGb: 2000,
    apiAccess: true,
    whiteLabel: true,
    pmsIntegration: true,
    aiFeatures: true,
    supportLevel: "dedicated",
  },
];

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildSubscriptions(): Subscription[] {
  const r = seeded(101);
  const statuses: Subscription["status"][] = ["active", "active", "active", "trial", "past_due", "canceled", "expired", "paused"];
  const gateways = ["stripe", "razorpay", "paypal"] as const;
  return ORG_NAMES.map((name, i) => {
    const plan = PLANS[i % 3];
    const cycle: Subscription["billingCycle"] = r() > 0.4 ? "annual" : "monthly";
    const status = statuses[Math.floor(r() * statuses.length)];
    const payStatus: Subscription["paymentStatus"] =
      status === "past_due" ? "failed" : status === "expired" ? "pending" : r() > 0.15 ? "paid" : "pending";
    const price = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    return {
      id: `sub_${1000 + i}`,
      organizationId: `org_${1000 + i}`,
      organizationName: name,
      planId: plan.id,
      planName: plan.name,
      tier: plan.tier,
      billingCycle: cycle,
      startDate: isoDaysFromNow(-Math.floor(r() * 300 + 30)),
      renewalDate: isoDaysFromNow(Math.floor(r() * 60 - 5)),
      expiryDate: isoDaysFromNow(Math.floor(r() * 300 + 30)),
      status,
      amount: price,
      autoRenewal: r() > 0.25,
      paymentStatus: payStatus,
      locations: Math.max(1, Math.floor(r() * plan.includedLocations)),
      routers: Math.max(1, Math.floor(r() * plan.includedRouters)),
      maxGuests: plan.includedGuests,
      trialDays: status === "trial" ? 14 : undefined,
      discount: Math.floor(r() * 15),
      tax: 18,
      notes: gateways[i % gateways.length],
    };
  });
}

function buildPayments(subs: Subscription[]): Payment[] {
  const r = seeded(202);
  const gateways: Payment["gateway"][] = ["stripe", "razorpay", "paypal"];
  const out: Payment[] = [];
  subs.forEach((s, i) => {
    const count = 2 + Math.floor(r() * 3);
    for (let j = 0; j < count; j++) {
      const gross = s.amount;
      const disc = Math.round((s.discount ?? 0) * 0.01 * gross);
      const tax = Math.round(((s.tax ?? 18) * (gross - disc)) / 100);
      const status: Payment["status"] =
        j === 0 && s.paymentStatus === "failed" ? "failed" : r() > 0.9 ? "refunded" : r() > 0.08 ? "paid" : "pending";
      out.push({
        id: `pay_${i}_${j}`,
        invoiceNumber: `INV-${2025}-${String(3000 + i * 5 + j).padStart(5, "0")}`,
        organizationId: s.organizationId,
        organizationName: s.organizationName,
        amount: gross,
        tax,
        discount: disc,
        gateway: gateways[(i + j) % gateways.length],
        transactionId: `txn_${Math.floor(r() * 1e10).toString(36)}`,
        status,
        paidAt: isoDaysFromNow(-Math.floor(r() * 180)),
      });
    }
  });
  return out.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

function buildInvoices(payments: Payment[]): Invoice[] {
  return payments.slice(0, 40).map((p, i) => ({
    id: `inv_${i}`,
    invoiceNumber: p.invoiceNumber,
    organizationName: p.organizationName,
    type: i % 9 === 0 ? "credit_note" : i % 11 === 0 ? "debit_note" : "tax_invoice",
    amount: p.amount,
    tax: p.tax,
    total: p.amount + p.tax - p.discount,
    issuedAt: p.paidAt,
    dueAt: isoDaysFromNow(14 - (i % 30)),
    status: p.status,
  }));
}

const COUPONS: Coupon[] = [
  { id: "c1", code: "WELCOME10", discountType: "percentage", discountValue: 10, expiryDate: isoDaysFromNow(90), maxUsage: 500, used: 128, status: "active" },
  { id: "c2", code: "SUMMER25", discountType: "percentage", discountValue: 25, expiryDate: isoDaysFromNow(30), maxUsage: 200, used: 92, status: "active" },
  { id: "c3", code: "FLAT50", discountType: "fixed", discountValue: 50, expiryDate: isoDaysFromNow(-5), maxUsage: 100, used: 100, status: "expired" },
  { id: "c4", code: "PARTNER15", discountType: "percentage", discountValue: 15, expiryDate: isoDaysFromNow(120), maxUsage: 1000, used: 341, status: "active" },
  { id: "c5", code: "ENT200", discountType: "fixed", discountValue: 200, expiryDate: isoDaysFromNow(60), maxUsage: 50, used: 7, status: "disabled" },
];

function buildUsage(subs: Subscription[]) {
  const r = seeded(303);
  return subs.slice(0, 12).map((s) => {
    const plan = PLANS.find((p) => p.id === s.planId)!;
    return {
      organizationId: s.organizationId,
      organizationName: s.organizationName,
      locationsUsed: Math.max(1, Math.floor(r() * plan.includedLocations)),
      locationsLimit: plan.includedLocations,
      routersUsed: Math.max(1, Math.floor(r() * plan.includedRouters)),
      routersLimit: plan.includedRouters,
      guestSessions: Math.floor(r() * plan.includedGuests),
      smsOtp: Math.floor(r() * 2000),
      emailOtp: Math.floor(r() * 8000),
      storageUsedGb: Math.floor(r() * plan.storageLimitGb),
      storageLimitGb: plan.storageLimitGb,
      apiCalls: Math.floor(r() * 250000),
    };
  });
}

const GATEWAYS = [
  { id: "stripe" as PaymentGateway, name: "Stripe", connected: true, lastTransactionAt: isoDaysFromNow(-1), mode: "live" as const },
  { id: "razorpay" as PaymentGateway, name: "Razorpay", connected: true, lastTransactionAt: isoDaysFromNow(-3), mode: "live" as const },
  { id: "paypal" as PaymentGateway, name: "PayPal", connected: false, lastTransactionAt: undefined, mode: "test" as const },
];

function buildRevenue() {
  const r = seeded(404);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let base = 42000;
  const trend = months.map((m) => {
    const growth = -3 + r() * 12;
    base = Math.round(base * (1 + growth / 100));
    return { label: m, revenue: base, growth: Math.round(growth * 10) / 10 };
  });
  return {
    trend,
    planDistribution: [
      { tier: "starter" as const, count: 42, revenue: 8400 },
      { tier: "professional" as const, count: 71, revenue: 42000 },
      { tier: "enterprise" as const, count: 18, revenue: 96000 },
      { tier: "custom" as const, count: 4, revenue: 32000 },
    ],
    subscriptionDistribution: [
      { status: "active" as const, count: 96 },
      { status: "trial" as const, count: 21 },
      { status: "past_due" as const, count: 9 },
      { status: "canceled" as const, count: 7 },
      { status: "expired" as const, count: 4 },
      { status: "paused" as const, count: 3 },
    ],
    paymentSuccessRate: months.slice(-6).map((m) => ({
      label: m,
      success: 85 + Math.floor(r() * 12),
      failed: 3 + Math.floor(r() * 10),
    })),
    churnRate: months.slice(-6).map((m) => ({ label: m, value: Math.round(r() * 5 * 10) / 10 })),
  };
}

function buildReminders(subs: Subscription[]): BillingSnapshot["reminders"] {
  return [
    { id: "r1", type: "expiry", title: "Subscription expiring in 5 days", organizationName: subs[3].organizationName, dueAt: isoDaysFromNow(5), severity: "warning" },
    { id: "r2", type: "invoice_due", title: "Invoice INV-2025-03011 due", organizationName: subs[7].organizationName, dueAt: isoDaysFromNow(2), severity: "warning" },
    { id: "r3", type: "payment_failed", title: "Payment retry required", organizationName: subs[4].organizationName, dueAt: isoDaysFromNow(-1), severity: "critical" },
    { id: "r4", type: "trial_ending", title: "Trial ends in 3 days", organizationName: subs[9].organizationName, dueAt: isoDaysFromNow(3), severity: "info" },
    { id: "r5", type: "expiry", title: "Annual renewal upcoming", organizationName: subs[12].organizationName, dueAt: isoDaysFromNow(14), severity: "info" },
    { id: "r6", type: "payment_failed", title: "Card declined – action needed", organizationName: subs[15].organizationName, dueAt: isoDaysFromNow(-4), severity: "critical" },
  ];
}

// --- Mutable stores (module-scope, mock) ---
let subscriptionsStore = buildSubscriptions();
const paymentsStore = buildPayments(subscriptionsStore);
const invoicesStore = buildInvoices(paymentsStore);
let couponsStore: Coupon[] = [...COUPONS];
let plansStore: Plan[] = [...PLANS];
let gatewaysStore = [...GATEWAYS];
let scheduledReports: ScheduledBillingReport[] = [
  { id: "srp_1", name: "Weekly revenue digest", frequency: "weekly", recipients: ["finance@cloudguest.io"], format: "pdf", enabled: true, nextRunAt: isoDaysFromNow(3) },
  { id: "srp_2", name: "Monthly MRR report", frequency: "monthly", recipients: ["cfo@cloudguest.io", "ops@cloudguest.io"], format: "excel", enabled: true, nextRunAt: isoDaysFromNow(10) },
  { id: "srp_3", name: "Daily overdue payments", frequency: "daily", recipients: ["billing@cloudguest.io"], format: "csv", enabled: false, nextRunAt: isoDaysFromNow(1) },
];

function computeKpis(): BillingSnapshot["kpis"] {
  const active = subscriptionsStore.filter((s) => s.status === "active");
  const mrrRaw = active.reduce((sum, s) => sum + (s.billingCycle === "annual" ? s.amount / 12 : s.amount), 0);
  const mrr = Math.round(mrrRaw);
  const arr = mrr * 12;
  const trial = subscriptionsStore.filter((s) => s.status === "trial").length;
  const now = Date.now();
  const expiring = subscriptionsStore.filter((s) => {
    const t = new Date(s.renewalDate).getTime();
    return t - now < 14 * 86400000 && t - now > 0;
  }).length;
  const overdue = paymentsStore.filter((p) => p.status === "failed" || p.status === "pending").length;
  const totalRevenue = paymentsStore.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const paid = paymentsStore.filter((p) => p.status === "paid").length;
  const collectionRate = Math.round((paid / paymentsStore.length) * 100);
  const arpo = active.length ? Math.round(mrr / active.length) : 0;
  return {
    mrr,
    arr,
    activeSubscriptions: active.length,
    trialOrganizations: trial,
    expiringPlans: expiring,
    overduePayments: overdue,
    totalRevenue,
    collectionRate,
    arpo,
  };
}

export const billingService = {
  async getSnapshot(): Promise<BillingSnapshot> {
    await delay();
    return {
      kpis: computeKpis(),
      subscriptions: subscriptionsStore,
      payments: paymentsStore,
      invoices: invoicesStore,
      coupons: couponsStore,
      usage: buildUsage(subscriptionsStore),
      gateways: gatewaysStore,
      revenue: buildRevenue(),
      reminders: buildReminders(subscriptionsStore),
      plans: plansStore,
    };
  },
  async listOrganizations() {
    await delay(150);
    return ORG_NAMES.map((name, i) => ({ id: `org_${1000 + i}`, name }));
  },
  async createSubscription(input: Omit<Subscription, "id" | "organizationName" | "planName" | "tier" | "startDate" | "renewalDate" | "expiryDate" | "status" | "amount" | "paymentStatus">) {
    await delay(500);
    const plan = plansStore.find((p) => p.id === input.planId)!;
    const price = input.billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    const org = ORG_NAMES[Number(input.organizationId.split("_")[1]) - 1000] ?? "New Organization";
    const created: Subscription = {
      id: `sub_${Date.now()}`,
      organizationId: input.organizationId,
      organizationName: org,
      planId: plan.id,
      planName: plan.name,
      tier: plan.tier,
      billingCycle: input.billingCycle,
      startDate: new Date().toISOString(),
      renewalDate: isoDaysFromNow(input.billingCycle === "annual" ? 365 : 30),
      expiryDate: isoDaysFromNow(input.billingCycle === "annual" ? 365 : 30),
      status: input.trialDays && input.trialDays > 0 ? "trial" : "active",
      amount: price,
      autoRenewal: input.autoRenewal,
      paymentStatus: "paid",
      locations: input.locations,
      routers: input.routers,
      maxGuests: input.maxGuests,
      trialDays: input.trialDays,
      discount: input.discount,
      tax: input.tax,
      notes: input.notes,
    };
    subscriptionsStore = [created, ...subscriptionsStore];
    return created;
  },
  async cancelSubscription(id: string) {
    await delay(300);
    subscriptionsStore = subscriptionsStore.map((s) => (s.id === id ? { ...s, status: "canceled" as const, autoRenewal: false } : s));
    return true;
  },
  async upgradeSubscription(id: string) {
    await delay(300);
    subscriptionsStore = subscriptionsStore.map((s) => {
      if (s.id !== id) return s;
      const idx = plansStore.findIndex((p) => p.id === s.planId);
      const next = plansStore[Math.min(idx + 1, plansStore.length - 2)];
      return { ...s, planId: next.id, planName: next.name, tier: next.tier, amount: s.billingCycle === "annual" ? next.annualPrice : next.monthlyPrice };
    });
    return true;
  },
  async downgradeSubscription(id: string) {
    await delay(300);
    subscriptionsStore = subscriptionsStore.map((s) => {
      if (s.id !== id) return s;
      const idx = plansStore.findIndex((p) => p.id === s.planId);
      const next = plansStore[Math.max(idx - 1, 0)];
      return { ...s, planId: next.id, planName: next.name, tier: next.tier, amount: s.billingCycle === "annual" ? next.annualPrice : next.monthlyPrice };
    });
    return true;
  },
  async savePlan(input: Omit<Plan, "id"> & { id?: string }) {
    await delay(300);
    if (input.id) {
      plansStore = plansStore.map((p) => (p.id === input.id ? { ...p, ...input, id: input.id! } : p));
      return plansStore.find((p) => p.id === input.id)!;
    }
    const plan: Plan = { ...input, id: `plan_${Date.now()}` };
    plansStore = [...plansStore, plan];
    return plan;
  },
  async deletePlan(id: string) {
    await delay(200);
    plansStore = plansStore.filter((p) => p.id !== id);
    return true;
  },
  async saveCoupon(input: Omit<Coupon, "id" | "used"> & { id?: string }) {
    await delay(250);
    if (input.id) {
      couponsStore = couponsStore.map((c) => (c.id === input.id ? { ...c, ...input, id: input.id! } : c));
      return couponsStore.find((c) => c.id === input.id)!;
    }
    const coupon: Coupon = { ...input, id: `c_${Date.now()}`, used: 0 };
    couponsStore = [...couponsStore, coupon];
    return coupon;
  },
  async deleteCoupon(id: string) {
    await delay(200);
    couponsStore = couponsStore.filter((c) => c.id !== id);
    return true;
  },
  async toggleGateway(id: PaymentGateway) {
    await delay(200);
    gatewaysStore = gatewaysStore.map((g) => (g.id === id ? { ...g, connected: !g.connected } : g));
    return true;
  },
  async refundPayment(id: string) {
    await delay(300);
    const p = paymentsStore.find((x) => x.id === id);
    if (p) p.status = "refunded";
    return true;
  },
  async listScheduledReports() {
    await delay(150);
    return scheduledReports;
  },
  async createScheduledReport(input: Omit<ScheduledBillingReport, "id" | "nextRunAt">) {
    await delay(250);
    const rep: ScheduledBillingReport = {
      ...input,
      id: `srp_${Date.now()}`,
      nextRunAt: isoDaysFromNow(input.frequency === "daily" ? 1 : input.frequency === "weekly" ? 7 : 30),
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
  async generateReport(type: string, format: BillingReportFormat) {
    await delay(600);
    return { fileName: `${type}-report-${Date.now()}.${format}`, size: `${Math.round(200 + Math.random() * 1800)} KB` };
  },
  async generateInvoice(id: string) {
    await delay(400);
    return { url: `#invoice-${id}`, fileName: `${id}.pdf` };
  },
  async sendReminder(id: string, _frequency?: ReportFrequency) {
    await delay(200);
    return { ok: true, id };
  },
};

export type BillingService = typeof billingService;
