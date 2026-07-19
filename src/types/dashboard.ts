export interface Kpi {
  key: string;
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface RevenuePoint {
  month: string;
  mrr: number;
  arr: number;
}

export interface AuthPoint {
  date: string;
  success: number;
  failed: number;
}

export interface TopOrgUsage {
  name: string;
  usage: number;
}

export interface DeviceTypeSlice {
  type: string;
  value: number;
}

export interface GrowthPoint {
  month: string;
  orgs: number;
  locations: number;
}

export interface RouterHealth {
  online: number;
  offline: number;
  warning: number;
}

export type EntityStatus = "active" | "inactive" | "pending" | "warning" | "online" | "offline" | "paid" | "failed" | "open" | "resolved";

export interface OrgRow {
  id: string;
  name: string;
  plan: string;
  locations: number;
  createdAt: string;
  status: EntityStatus;
}

export interface LocationRow {
  id: string;
  name: string;
  org: string;
  city: string;
  addedAt: string;
  status: EntityStatus;
}

export interface RouterRow {
  id: string;
  serial: string;
  model: string;
  org: string;
  registeredAt: string;
  status: EntityStatus;
}

export interface SessionRow {
  id: string;
  guest: string;
  org: string;
  location: string;
  startedAt: string;
  duration: string;
}

export interface PaymentRow {
  id: string;
  org: string;
  amount: number;
  method: string;
  paidAt: string;
  status: EntityStatus;
}

export interface TicketRow {
  id: string;
  subject: string;
  org: string;
  priority: "low" | "medium" | "high" | "urgent";
  updatedAt: string;
  status: EntityStatus;
}

export interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export type NotificationKind = "alert" | "warning" | "billing" | "router" | "subscription" | "system";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  at: string;
  unread?: boolean;
}

export interface SearchResult {
  id: string;
  type: "organization" | "location" | "router" | "guest" | "ticket";
  title: string;
  subtitle: string;
}
