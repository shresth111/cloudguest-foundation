export type PlanTier = "starter" | "professional" | "enterprise" | "custom";
export type BillingCycle = "monthly" | "annual";
export type SupportLevel = "email" | "priority" | "24x7" | "dedicated";

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused";

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";
export type PaymentGateway = "stripe" | "razorpay" | "paypal";
export type InvoiceType = "tax_invoice" | "credit_note" | "debit_note";
export type DiscountType = "percentage" | "fixed";
export type CouponStatus = "active" | "expired" | "disabled";
export type ReportFrequency = "daily" | "weekly" | "monthly";
export type BillingReportFormat = "pdf" | "excel" | "csv";

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  currency: string;
  monthlyPrice: number;
  annualPrice: number;
  includedLocations: number;
  includedRouters: number;
  includedGuests: number;
  storageLimitGb: number;
  apiAccess: boolean;
  whiteLabel: boolean;
  pmsIntegration: boolean;
  aiFeatures: boolean;
  supportLevel: SupportLevel;
  popular?: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  organizationName: string;
  planId: string;
  planName: string;
  tier: PlanTier;
  billingCycle: BillingCycle;
  startDate: string;
  renewalDate: string;
  expiryDate: string;
  status: SubscriptionStatus;
  amount: number;
  autoRenewal: boolean;
  paymentStatus: PaymentStatus;
  locations: number;
  routers: number;
  maxGuests: number;
  trialDays?: number;
  discount?: number;
  tax?: number;
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  tax: number;
  discount: number;
  gateway: PaymentGateway;
  transactionId: string;
  status: PaymentStatus;
  paidAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationName: string;
  type: InvoiceType;
  amount: number;
  tax: number;
  total: number;
  issuedAt: string;
  dueAt: string;
  status: PaymentStatus;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  expiryDate: string;
  maxUsage: number;
  used: number;
  status: CouponStatus;
}

export interface UsageRow {
  organizationId: string;
  organizationName: string;
  locationsUsed: number;
  locationsLimit: number;
  routersUsed: number;
  routersLimit: number;
  guestSessions: number;
  smsOtp: number;
  emailOtp: number;
  storageUsedGb: number;
  storageLimitGb: number;
  apiCalls: number;
}

export interface PaymentGatewayConfig {
  id: PaymentGateway;
  name: string;
  connected: boolean;
  lastTransactionAt?: string;
  mode: "test" | "live";
}

export interface BillingKpis {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  trialOrganizations: number;
  expiringPlans: number;
  overduePayments: number;
  totalRevenue: number;
  collectionRate: number;
  arpo: number;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  growth: number;
}

export interface PlanDistribution {
  tier: PlanTier;
  count: number;
  revenue: number;
}

export interface RevenueAnalytics {
  trend: RevenuePoint[];
  planDistribution: PlanDistribution[];
  subscriptionDistribution: { status: SubscriptionStatus; count: number }[];
  paymentSuccessRate: { label: string; success: number; failed: number }[];
  churnRate: { label: string; value: number }[];
}

export type TaxType = "gst" | "vat" | "sales_tax" | "none";

export interface TaxRate {
  id: string;
  name: string;
  taxType: TaxType;
  ratePercentage: number;
  countryCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  type: "expiry" | "invoice_due" | "payment_failed" | "trial_ending";
  title: string;
  organizationName: string;
  dueAt: string;
  severity: "info" | "warning" | "critical";
}

export interface ScheduledBillingReport {
  id: string;
  name: string;
  frequency: ReportFrequency;
  recipients: string[];
  format: BillingReportFormat;
  enabled: boolean;
  nextRunAt: string;
}

export interface BillingSnapshot {
  kpis: BillingKpis;
  subscriptions: Subscription[];
  payments: Payment[];
  invoices: Invoice[];
  coupons: Coupon[];
  usage: UsageRow[];
  gateways: PaymentGatewayConfig[];
  revenue: RevenueAnalytics;
  reminders: Reminder[];
  plans: Plan[];
}

/** One organization's own usage-vs-limit reading, used by the tenant-facing
 * (not Super Admin) Subscription/Billing pages. */
export interface MyUsageMetric {
  key: string;
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

/** The tenant-facing "my billing" summary -- backed by the real, org-scoped
 * `GET /billing/dashboard/me` endpoint (see billingService.getMyBillingDashboard).
 * Distinct from BillingSnapshot, which is the platform-wide Super Admin view
 * and requires a GLOBAL-scoped role an ordinary organization user does not have. */
export interface MyBillingSummary {
  plan: Plan;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  renewalDate: string;
  autoRenewal: boolean;
  usage: MyUsageMetric[];
  recentInvoices: Invoice[];
  recentPayments: Payment[];
}
