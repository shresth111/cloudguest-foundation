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
