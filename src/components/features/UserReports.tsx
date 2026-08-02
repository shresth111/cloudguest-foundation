import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Calendar, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Loader2, FileBarChart, Download, Printer, FileDown, Info, Quote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import { useCustomerLocations, useIsDemo } from "@/hooks/useCustomerDashboard";
import { maskPhone } from "@/components/features/HeaderControls";

const CATEGORIES = ["Guest Activity Report", "Voucher Redemption Report", "Campaign Engagement Report", "Bandwidth & Cost Report", "OTP & SMS Delivery Report"] as const;
type Category = (typeof CATEGORIES)[number];

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const TEAMS = ["Sales Team", "Executive VIP", "Contractors", "Maintenance Staff"];
const CAMPAIGN_TYPES = ["All Types", "Banner Campaign", "Survey/Feedback Campaign", "Redirect Campaign"];

interface ReportType { id: string; label: string; desc: string }
interface ColumnDef { key: string; label: string; sortType: "string" | "number" | "date" }
type Row = { [key: string]: string | number | null };

function fmtBytes(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}
function fmtDur(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}m`;
}
function fmtDT(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const today = () => new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 15;
const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";
const NAMES = ["Ravi Sharma", "Priya Kapoor", "Amit Patel", "Sana Khan", "John Doe", "Meera Nair", "Vikram Singh", "Ananya Reddy", "Arun Kumar", "Neha Gupta", "Rohan Desai", "Kavita Joshi"];
const phone = (i: number) => `+9198${String(70000000 + i * 1111111).slice(0, 10)}`;

// ── report catalogs, one per category ──────────────────────────────
const USER_REPORT_TYPES: ReportType[] = [
  { id: "user-data", label: "Guest Data Usage By Date Range", desc: "How much data each user pulled over a chosen period." },
  { id: "user-sessions", label: "Guest Dwell Time By Date Range", desc: "Every login session with start, end and duration." },
  { id: "user-presence", label: "Hourly Guest Traffic (Single-Day Snapshot)", desc: "Hour-by-hour presence for a single day." },
  { id: "top-users", label: "Heaviest Data Users (This Month)", desc: "The heaviest data users this month." },
  { id: "daywise-data", label: "Daily Guest Data Trend", desc: "Daily data totals across the period." },
  { id: "daywise-unique", label: "Daily Guest & Device Footfall", desc: "Distinct users and devices seen each day." },
  { id: "team-report", label: "Team Usage Breakdown", desc: "Usage rolled up by group or team." },
];
const VOUCHER_REPORT_TYPES: ReportType[] = [
  { id: "voucher-usage", label: "Voucher Redemption Log By Date Range", desc: "Every voucher redeemed, by whom and when." },
  { id: "voucher-batch", label: "Voucher Batch Redemption Rate", desc: "Redemption rate for each generated batch." },
  { id: "top-vouchers", label: "Most Redeemed Vouchers (This Month)", desc: "The most-used vouchers this month." },
];
const CAMPAIGN_REPORT_TYPES: ReportType[] = [
  { id: "campaign-performance", label: "Campaign Funnel By Date Range", desc: "Sent, delivered, opened and clicked per campaign." },
  { id: "campaign-daywise", label: "Daily Campaign Engagement Trend", desc: "Daily send/deliver/open totals across the period." },
  { id: "top-campaigns", label: "Top Campaigns By Click-Through Rate (This Month)", desc: "Best-performing campaigns by click-through rate." },
];
const DATA_REPORT_TYPES: ReportType[] = [
  { id: "data-consumption", label: "Bandwidth Usage & Cost By Date Range", desc: "Upload/download totals and peak throughput per day." },
  { id: "data-by-location", label: "Bandwidth Usage By Location", desc: "Total and average data usage broken down by location." },
];
const SMS_REPORT_TYPES: ReportType[] = [
  { id: "otp-delivery", label: "OTP Delivery & Latency By Date Range", desc: "Every OTP sent, its delivery status and latency." },
  { id: "sms-daywise", label: "Daily SMS Delivery Rate", desc: "Daily sent/delivered/failed totals across the period." },
];

const COLUMNS: Record<string, ColumnDef[]> = {
  "user-data": [{ key: "rank", label: "#", sortType: "number" }, { key: "name", label: "Name", sortType: "string" }, { key: "mobile", label: "Mobile Number", sortType: "string" }, { key: "devices", label: "Devices", sortType: "number" }, { key: "data", label: "Data Used", sortType: "number" }, { key: "lastSeen", label: "Last Seen", sortType: "date" }],
  "user-sessions": [{ key: "rank", label: "#", sortType: "number" }, { key: "name", label: "Name", sortType: "string" }, { key: "mobile", label: "Mobile Number", sortType: "string" }, { key: "device", label: "Device", sortType: "string" }, { key: "sessionStart", label: "Session Start", sortType: "date" }, { key: "sessionEnd", label: "Session End", sortType: "date" }, { key: "duration", label: "Duration", sortType: "number" }, { key: "data", label: "Data Used", sortType: "number" }],
  "user-presence": [{ key: "rank", label: "#", sortType: "number" }, { key: "name", label: "Name", sortType: "string" }, { key: "mobile", label: "Mobile Number", sortType: "string" }, { key: "firstSeen", label: "First Seen", sortType: "date" }, { key: "lastSeen", label: "Last Seen", sortType: "date" }, { key: "totalPresence", label: "Total Presence", sortType: "string" }, { key: "sessions", label: "Sessions", sortType: "number" }],
  "top-users": [{ key: "rank", label: "Rank", sortType: "number" }, { key: "name", label: "Name", sortType: "string" }, { key: "mobile", label: "Mobile Number", sortType: "string" }, { key: "data", label: "Data Used", sortType: "number" }, { key: "sessions", label: "Sessions", sortType: "number" }],
  "daywise-data": [{ key: "date", label: "Date", sortType: "date" }, { key: "totalData", label: "Total Data", sortType: "number" }, { key: "users", label: "Users", sortType: "number" }, { key: "avgPerUser", label: "Avg Per User", sortType: "number" }],
  "daywise-unique": [{ key: "date", label: "Date", sortType: "date" }, { key: "uniqueUsers", label: "Unique Users", sortType: "number" }, { key: "uniqueDevices", label: "Unique Devices", sortType: "number" }, { key: "newUsers", label: "New Users", sortType: "number" }],
  "team-report": [{ key: "rank", label: "#", sortType: "number" }, { key: "team", label: "Team", sortType: "string" }, { key: "members", label: "Members", sortType: "number" }, { key: "data", label: "Data Used", sortType: "number" }, { key: "sessions", label: "Sessions", sortType: "number" }, { key: "avgPerMember", label: "Avg Per Member", sortType: "number" }],

  "voucher-usage": [{ key: "rank", label: "#", sortType: "number" }, { key: "code", label: "Voucher Code", sortType: "string" }, { key: "batch", label: "Batch", sortType: "string" }, { key: "value", label: "Value", sortType: "string" }, { key: "redeemedBy", label: "Redeemed By", sortType: "string" }, { key: "redeemedAt", label: "Redeemed At", sortType: "date" }],
  "voucher-batch": [{ key: "batch", label: "Batch", sortType: "string" }, { key: "generated", label: "Generated", sortType: "number" }, { key: "redeemed", label: "Redeemed", sortType: "number" }, { key: "expired", label: "Expired", sortType: "number" }, { key: "rate", label: "Redemption Rate", sortType: "string" }],
  "top-vouchers": [{ key: "rank", label: "Rank", sortType: "number" }, { key: "code", label: "Voucher Code", sortType: "string" }, { key: "redeemedBy", label: "Redeemed By", sortType: "string" }, { key: "value", label: "Value", sortType: "string" }, { key: "redeemedAt", label: "Redeemed At", sortType: "date" }],

  "campaign-performance": [{ key: "rank", label: "#", sortType: "number" }, { key: "campaign", label: "Campaign", sortType: "string" }, { key: "type", label: "Type", sortType: "string" }, { key: "sent", label: "Sent", sortType: "number" }, { key: "delivered", label: "Delivered", sortType: "number" }, { key: "opened", label: "Opened", sortType: "number" }, { key: "clicked", label: "Clicked", sortType: "number" }, { key: "ctr", label: "CTR", sortType: "string" }],
  "campaign-daywise": [{ key: "date", label: "Date", sortType: "date" }, { key: "type", label: "Type", sortType: "string" }, { key: "sent", label: "Sent", sortType: "number" }, { key: "delivered", label: "Delivered", sortType: "number" }, { key: "opened", label: "Opened", sortType: "number" }],
  "top-campaigns": [{ key: "rank", label: "Rank", sortType: "number" }, { key: "campaign", label: "Campaign", sortType: "string" }, { key: "type", label: "Type", sortType: "string" }, { key: "reach", label: "Reach", sortType: "number" }, { key: "ctr", label: "CTR", sortType: "string" }],

  "data-consumption": [{ key: "date", label: "Date", sortType: "date" }, { key: "uploadGB", label: "Upload", sortType: "number" }, { key: "downloadGB", label: "Download", sortType: "number" }, { key: "totalGB", label: "Total", sortType: "number" }, { key: "peakMbps", label: "Peak Throughput", sortType: "number" }, { key: "cost", label: "Est. Cost", sortType: "number" }],
  "data-by-location": [{ key: "businessUnit", label: "Business Unit", sortType: "string" }, { key: "totalData", label: "Total Data", sortType: "number" }, { key: "avgPerUser", label: "Avg Per User", sortType: "number" }, { key: "peakHour", label: "Peak Hour", sortType: "string" }, { key: "cost", label: "Est. Cost", sortType: "number" }],

  "otp-delivery": [{ key: "rank", label: "#", sortType: "number" }, { key: "mobile", label: "Mobile Number", sortType: "string" }, { key: "sentAt", label: "Sent At", sortType: "date" }, { key: "status", label: "Status", sortType: "string" }, { key: "latencyMs", label: "Latency (ms)", sortType: "number" }],
  "sms-daywise": [{ key: "date", label: "Date", sortType: "date" }, { key: "sent", label: "Sent", sortType: "number" }, { key: "delivered", label: "Delivered", sortType: "number" }, { key: "failed", label: "Failed", sortType: "number" }, { key: "rate", label: "Delivery Rate", sortType: "string" }],
};

const NEEDS_TEAM = new Set(["team-report"]);
const NEEDS_SINGLE = new Set(["user-presence"]);
const NEEDS_RANGE = new Set([
  "user-data", "user-sessions", "daywise-data", "daywise-unique",
  "voucher-usage", "voucher-batch", "campaign-performance", "campaign-daywise",
  "data-consumption", "data-by-location", "otp-delivery", "sms-daywise",
]);
const NEEDS_CAMPAIGN_TYPE = new Set(["campaign-performance", "campaign-daywise", "top-campaigns"]);
const NEEDS_RATE = new Set(["data-consumption", "data-by-location"]);

/** Columns that carry a real guest phone number ("mobile" -- Guest Activity
 * and OTP & SMS reports -- and "redeemedBy" -- Voucher Redemption reports,
 * see `phone(i)` in `mockRow` above) rather than an opaque code/id. Masked
 * the same way every other guest phone display in this app is (see
 * `maskPhone`, `BasicUsersView`/`customer.$locationId.users.tsx`) whenever
 * this report is viewed with masking on -- previously these reports never
 * masked anything at all, unmasked or not, so an agent previewing with
 * "Data masking" ON still saw every guest's real number here. */
const PHONE_COLUMNS = new Set(["mobile", "redeemedBy"]);

function mockRow(reportType: string, i: number, count: number, campaignType?: string, ratePerGb?: number): Row {
  const r: Row = { rank: i + 1 };
  const pickCampaignType = () => (campaignType && campaignType !== "All Types" ? campaignType : CAMPAIGN_TYPES[1 + (i % 3)]);
  switch (reportType) {
    case "user-data": r.name = NAMES[i % NAMES.length]; r.mobile = phone(i); r.devices = Math.floor(Math.random() * 4) + 1; r.data = Math.random() * 5000; r.lastSeen = new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(); break;
    case "user-sessions": r.name = NAMES[i % NAMES.length]; r.mobile = phone(i); r.device = ["iPhone 15", "Samsung S24", "MacBook Pro", "Pixel 8", "iPad Air"][i % 5]; r.sessionStart = new Date(Date.now() - Math.random() * 86400000 * 14).toISOString(); r.sessionEnd = new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(); r.duration = Math.floor(Math.random() * 240) + 10; r.data = Math.random() * 2000; break;
    case "user-presence": r.name = NAMES[i % NAMES.length]; r.mobile = phone(i); r.firstSeen = new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(); r.lastSeen = new Date(Date.now() - Math.random() * 86400000).toISOString(); r.totalPresence = `${Math.floor(Math.random() * 8) + 1}h ${Math.floor(Math.random() * 60)}m`; r.sessions = Math.floor(Math.random() * 20) + 1; break;
    case "top-users": r.name = NAMES[i % NAMES.length]; r.mobile = phone(i); r.data = Math.random() * 10000; r.sessions = Math.floor(Math.random() * 50) + 1; break;
    case "daywise-data": r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.totalData = Math.random() * 15000; r.users = Math.floor(Math.random() * 80) + 10; r.avgPerUser = (r.totalData as number) / (r.users as number); break;
    case "daywise-unique": r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.uniqueUsers = Math.floor(Math.random() * 100) + 20; r.uniqueDevices = Math.floor(Math.random() * 120) + 15; r.newUsers = Math.floor(Math.random() * 15); break;
    case "team-report": r.team = TEAMS[i % TEAMS.length]; r.members = Math.floor(Math.random() * 15) + 3; r.data = Math.random() * 20000; r.sessions = Math.floor(Math.random() * 200) + 20; r.avgPerMember = (r.data as number) / (r.members as number); break;

    case "voucher-usage": r.code = `ZW-${1000 + i}`; r.batch = ["Front Desk", "Cafe Launch", "Weekend Promo"][i % 3]; r.value = ["1 Hour", "1 Day", "500 MB"][i % 3]; r.redeemedBy = phone(i); r.redeemedAt = new Date(Date.now() - Math.random() * 86400000 * 10).toISOString(); break;
    case "voucher-batch": { const gen = Math.floor(Math.random() * 400) + 100; const red = Math.floor(Math.random() * gen); r.batch = ["Front Desk", "Cafe Launch", "Weekend Promo", "Conference Pack"][i % 4]; r.generated = gen; r.redeemed = red; r.expired = Math.floor((gen - red) * 0.3); r.rate = `${((red / gen) * 100).toFixed(0)}%`; break; }
    case "top-vouchers": r.code = `ZW-${2000 + i}`; r.redeemedBy = phone(i); r.value = ["1 Day", "1 Week", "1 GB"][i % 3]; r.redeemedAt = new Date(Date.now() - Math.random() * 86400000 * 5).toISOString(); break;

    case "campaign-performance": { const sent = Math.floor(Math.random() * 5000) + 500; const delivered = Math.floor(sent * (0.9 + Math.random() * 0.09)); const opened = Math.floor(delivered * Math.random() * 0.6); const clicked = Math.floor(opened * Math.random() * 0.4); r.campaign = ["Welcome Back Offer", "Weekend Special", "New Menu Launch", "Loyalty Reward"][i % 4]; r.type = pickCampaignType(); r.sent = sent; r.delivered = delivered; r.opened = opened; r.clicked = clicked; r.ctr = `${((clicked / sent) * 100).toFixed(1)}%`; break; }
    case "campaign-daywise": { const sent = Math.floor(Math.random() * 800) + 100; r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.type = pickCampaignType(); r.sent = sent; r.delivered = Math.floor(sent * 0.95); r.opened = Math.floor(sent * Math.random() * 0.5); break; }
    case "top-campaigns": { const reach = Math.floor(Math.random() * 8000) + 1000; r.campaign = ["Welcome Back Offer", "Weekend Special", "New Menu Launch"][i % 3]; r.type = pickCampaignType(); r.reach = reach; r.ctr = `${(Math.random() * 12 + 2).toFixed(1)}%`; break; }

    case "data-consumption": { const up = Math.random() * 40 + 5; const down = Math.random() * 200 + 40; const total = up + down; r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.uploadGB = up; r.downloadGB = down; r.totalGB = total; r.peakMbps = Math.random() * 400 + 50; r.cost = ratePerGb ? total * ratePerGb : null; break; }
    case "data-by-location": { const totalData = Math.random() * 50000 + 5000; r.businessUnit = UNITS[i % UNITS.length]; r.totalData = totalData; r.avgPerUser = Math.random() * 2000 + 200; r.peakHour = `${(Math.floor(Math.random() * 12) + 8)}:00`; r.cost = ratePerGb ? (totalData / 1000) * ratePerGb : null; break; }

    case "otp-delivery": r.mobile = phone(i); r.sentAt = new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(); r.status = Math.random() > 0.08 ? "Delivered" : "Failed"; r.latencyMs = Math.floor(Math.random() * 4000) + 300; break;
    case "sms-daywise": { const sent = Math.floor(Math.random() * 1200) + 200; const failed = Math.floor(sent * Math.random() * 0.06); r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.sent = sent; r.delivered = sent - failed; r.failed = failed; r.rate = `${(((sent - failed) / sent) * 100).toFixed(1)}%`; break; }
  }
  return r;
}

function mockRun(reportType: string, campaignType?: string, ratePerGb?: number): Promise<Row[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const count = reportType === "team-report" ? 4 : reportType === "top-users" || reportType === "top-vouchers" || reportType === "top-campaigns" ? 10 : reportType === "voucher-batch" ? 4 : reportType === "data-by-location" ? UNITS.length : Math.floor(Math.random() * 24) + 3;
      resolve(Array.from({ length: count }, (_, i) => mockRow(reportType, i, count, campaignType, ratePerGb)));
    }, 700);
  });
}

// ── real reports for a real account ──────────────────────────────────
// Every report type above used Math.random() unconditionally, for every
// account, demo or real -- a real customer running "User Sessions By Date
// Range" for their own business saw entirely fabricated names, mobile
// numbers and data totals with no real backend call anywhere. Two report
// types are genuinely, honestly buildable from data the backend actually
// exposes to this session (GET /guest-sessions' bytes_uploaded/
// bytes_downloaded per real location -- see customer.service.ts's
// RawGuestSession): both "Bandwidth & Cost Report" sub-reports, which need no
// per-guest identity at all. Every other report type needs either
// per-guest PII the guest-sessions list doesn't expose (name/mobile --
// see customer.service.ts's own getUsers(), which hardcodes
// name: "Guest", email: "" for the same reason) or engagement/redemption
// event data (campaign opens/clicks, individual voucher redemptions, OTP
// delivery logs, team rosters) with no backing endpoint anywhere in this
// codebase's real data paths. Those stay honestly unavailable for real
// accounts rather than fabricated -- see UNAVAILABLE_REASON below.
const REAL_REPORT_TYPES = new Set(["data-consumption", "data-by-location"]);

const UNAVAILABLE_REASON: Record<string, string> = {
  "user-data": "Per-guest identity (name/mobile) isn't exposed by the real session data this account can access.",
  "user-sessions": "Per-guest identity (name/mobile) isn't exposed by the real session data this account can access.",
  "user-presence": "Per-guest identity isn't exposed by the real session data this account can access.",
  "top-users": "Per-guest identity isn't exposed by the real session data this account can access.",
  "daywise-data": "Aggregated day-wise totals need the same per-guest breakdown the backend doesn't expose yet -- see Bandwidth & Cost Report for real day-wise totals.",
  "daywise-unique": "Unique user/device counts aren't tracked per day in the real backend yet.",
  "team-report": "Guest teams aren't tied to usage totals in the real backend yet.",
  "voucher-usage": "Individual voucher redemption events aren't exposed by the real backend yet -- only batch-level counts are.",
  "top-vouchers": "Individual voucher redemption events aren't exposed by the real backend yet.",
  "campaign-performance": "Campaign delivery/open/click metrics aren't tracked in the real backend yet.",
  "campaign-daywise": "Campaign delivery/open/click metrics aren't tracked in the real backend yet.",
  "top-campaigns": "Campaign reach/click metrics aren't tracked in the real backend yet.",
  "otp-delivery": "Per-message OTP delivery status/latency isn't logged in the real backend yet.",
  "sms-daywise": "Per-message SMS delivery status isn't logged in the real backend yet.",
};

interface RealGuestSession { started_at: string; ended_at?: string | null; bytes_uploaded?: number; bytes_downloaded?: number }

// GET /guest-sessions caps page_size at 100 (backend/app/domains/guest/router.py's
// `page_size: int = Query(default=25, ge=1, le=100)`) -- a single page_size=500
// request 422s outright, which silently turned every real Bandwidth & Cost Report into
// either a fabricated "Could not load this report" error or a false "0 MB"
// once the per-location Promise.allSettled in realDataByLocation swallowed
// the rejection. Page through in 100-row chunks via has_next instead, capped
// at 20 pages (2000 sessions) so one location with an unbounded history can't
// hang the report -- generous for a <=90-day range (this form's own cap).
const SESSIONS_PAGE_SIZE = 100;
const MAX_SESSION_PAGES = 20;

async function fetchRealSessions(orgId: string, locationId: string, from: string, to: string): Promise<RealGuestSession[]> {
  const fromT = new Date(from).getTime();
  const toT = new Date(to).getTime() + 86400000;
  const all: RealGuestSession[] = [];
  for (let page = 1; page <= MAX_SESSION_PAGES; page++) {
    const { data } = await api.get<{ items: RealGuestSession[]; has_next?: boolean }>("/guest-sessions", {
      params: { location_id: locationId, page, page_size: SESSIONS_PAGE_SIZE },
      headers: { "X-Organization-Id": orgId },
    });
    all.push(...(data?.items ?? []));
    if (!data?.has_next) break;
  }
  return all.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= fromT && t < toT;
  });
}

async function realDataConsumption(orgId: string, locationId: string, from: string, to: string, ratePerGb?: number): Promise<Row[]> {
  const sessions = await fetchRealSessions(orgId, locationId, from, to);
  const byDay = new Map<string, { up: number; down: number }>();
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    const bucket = byDay.get(day) ?? { up: 0, down: 0 };
    bucket.up += s.bytes_uploaded ?? 0;
    bucket.down += s.bytes_downloaded ?? 0;
    byDay.set(day, bucket);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { up, down }]) => {
      const upGB = up / 1e9;
      const downGB = down / 1e9;
      const totalGB = upGB + downGB;
      // peakMbps: null, not 0 -- the backend doesn't track per-day peak
      // throughput anywhere in guest-sessions, so a real 0 would be
      // fabricated. fmtCell already renders null as "--" for every other
      // honestly-unavailable field (see `cost` below); do the same here
      // instead of a made-up zero that reads as a real (if bad) measurement.
      return { date, uploadGB: upGB, downloadGB: downGB, totalGB, peakMbps: null, cost: ratePerGb ? totalGB * ratePerGb : null };
    });
}

async function realDataByLocation(orgId: string, locations: { id: string; name: string }[], from: string, to: string, ratePerGb?: number): Promise<Row[]> {
  const settled = await Promise.allSettled(locations.map((l) => fetchRealSessions(orgId, l.id, from, to)));
  return locations.map((l, i) => {
    const sessions = settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<RealGuestSession[]>).value : [];
    const totalBytes = sessions.reduce((sum, s) => sum + (s.bytes_uploaded ?? 0) + (s.bytes_downloaded ?? 0), 0);
    const totalData = totalBytes / 1e6; // MB, matches fmtBytes()
    const avgPerUser = sessions.length ? totalData / sessions.length : 0;
    return { businessUnit: l.name, totalData, avgPerUser, peakHour: "—", cost: ratePerGb ? (totalData / 1000) * ratePerGb : null };
  });
}

// ── one reusable panel: business unit + report-type picker + date range + results table ──
/** `masked` is the current viewer's data-masking state -- the owner's own
 * (always-on, see CustomerHeader's read-only OtpMaskToggle) or, when this
 * page renders inside the `/agent` staff-preview dashboard via
 * `renderFeature`, the previewed agent's real per-agent `dataMasking` flag
 * (AgentsPage.tsx's "Data masking" switch). Defaults to `true` so any other
 * caller keeps the safer-by-default behavior every other guest-PII view in
 * this app already follows. */
function ReportPanel({ reportTypes, csvPrefix, masked = true }: { reportTypes: ReportType[]; csvPrefix: string; masked?: boolean }) {
  // UNITS ("Marina Bay Hotel" etc.) is demo-only seed data -- a real
  // customer only has their own real locations, same real-vs-demo split
  // WhiteList.tsx/TicketsPage.tsx already use for their own "Business
  // Unit" pickers.
  const demo = useIsDemo();
  const { data: customerLocations } = useCustomerLocations();
  const realUnits = useMemo(() => (customerLocations ?? []).map((l) => l.name), [customerLocations]);
  const locationsByName = useMemo(() => new Map((customerLocations ?? []).map((l) => [l.name, l])), [customerLocations]);
  const units = demo ? UNITS : realUnits;

  const [bu, setBu] = useState(""); const [reportType, setReportType] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [singleDate, setSingleDate] = useState(""); const [team, setTeam] = useState("");
  const [campaignType, setCampaignType] = useState(""); const [ratePerGb, setRatePerGb] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false); const [comboFilter, setComboFilter] = useState(""); const [activeIdx, setActiveIdx] = useState(0); const comboRef = useRef<HTMLDivElement>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false); const [rows, setRows] = useState<Row[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [searchTxt, setSearchTxt] = useState(""); const [sortKey, setSortKey] = useState<string>("rank"); const [sortDir, setSortDir] = useState<"asc" | "desc">("asc"); const [page, setPage] = useState(0);
  const runCount = useRef(0);

  // Reset all per-report state when the category (and therefore its report list) changes.
  useEffect(() => {
    setBu(""); setReportType(""); setFrom(""); setTo(""); setSingleDate(""); setTeam(""); setCampaignType(""); setRatePerGb("");
    setErrs({}); setRows(null); setUnavailable(null); setSearchTxt(""); setPage(0);
  }, [reportTypes]);

  const rt = reportTypes.find((r) => r.id === reportType);
  const needsRange = NEEDS_RANGE.has(reportType);
  const needsSingle = NEEDS_SINGLE.has(reportType);
  const needsTeam = NEEDS_TEAM.has(reportType);
  const needsCampaignType = NEEDS_CAMPAIGN_TYPE.has(reportType);
  const needsRate = NEEDS_RATE.has(reportType);

  const filteredCombos = useMemo(() => {
    const q = comboFilter.toLowerCase();
    return reportTypes.filter((r) => r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
  }, [comboFilter, reportTypes]);

  const setQuick = (days: number) => {
    const toD = new Date(); const fromD = new Date(Date.now() - days * 86400000);
    setFrom(fromD.toISOString().slice(0, 10)); setTo(toD.toISOString().slice(0, 10));
  };

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); } setPage(0);
  };

  const cols = reportType ? COLUMNS[reportType] || [] : [];
  const sortedRows = useMemo(() => {
    if (!rows) return [];
    const q = searchTxt.toLowerCase();
    let filtered = q ? rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : rows;
    const col = cols.find((c) => c.key === sortKey);
    if (col) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey];
        if (av == null) return 1; if (bv == null) return -1;
        if (col.sortType === "number") return sortDir === "asc" ? (+av) - (+bv) : (+bv) - (+av);
        if (col.sortType === "date") return sortDir === "asc" ? new Date(String(av)).getTime() - new Date(String(bv)).getTime() : new Date(String(bv)).getTime() - new Date(String(av)).getTime();
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return filtered;
  }, [rows, searchTxt, sortKey, sortDir, cols]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sortedRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const fmtCell = (key: string, val: string | number | null): string => {
    if (val == null) return "—";
    if (PHONE_COLUMNS.has(key)) return masked ? maskPhone(String(val)) : String(val);
    if (key === "cost") return `₹${(+val).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    if (key === "peakMbps") return `${(+val).toFixed(1)} Mbps`;
    // uploadGB/downloadGB/totalGB are computed in GB (see realDataConsumption),
    // but a fixed one-decimal GB display rounds every real account under
    // ~50 MB/day straight to "0.0 GB" across the whole row -- indistinguishable
    // from a broken report for a normal (non-enterprise-scale) real account.
    // Route through the same adaptive MB/GB formatter data-by-location's
    // totalData/avgPerUser already use (fmtBytes, MB in, "6 MB" or "1.2 GB"
    // out) instead of losing all resolution below 100 MB.
    if (["totalGB", "uploadGB", "downloadGB"].includes(key)) return fmtBytes(+val * 1000);
    if (["data", "totalData", "avgPerUser", "avgPerMember"].includes(key)) return fmtBytes(+val);
    if (key === "duration") return fmtDur(+val);
    if (["sessionStart", "sessionEnd", "firstSeen", "lastSeen", "redeemedAt", "sentAt"].includes(key)) return fmtDT(String(val));
    return String(val);
  };

  const handleRun = useCallback(async () => {
    const e: Record<string, string> = {};
    if (!bu) e.bu = "Select a business unit.";
    if (!reportType) e.reportType = "Select a report type.";
    if (needsRange) { if (!from) e.from = "Required."; if (!to) e.to = "Required."; if (from && to && to < from) e.to = "End must be after start."; if (from && to && (new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 90) e.to = "Pick a range of 90 days or less."; }
    if (needsSingle && !singleDate) e.singleDate = "Required.";
    if (needsTeam && !team) e.team = "Select a team.";
    if (needsCampaignType && !campaignType) e.campaignType = "Select a campaign type.";
    if (needsRate && ratePerGb && parseFloat(ratePerGb) < 0) e.ratePerGb = "Rate can't be negative.";
    if (from > today()) e.from = "Pick today's date or earlier."; if (to > today()) e.to = "Pick today's date or earlier."; if (singleDate > today()) e.singleDate = "Pick today's date or earlier.";
    setErrs(e); if (Object.keys(e).length) return;

    runCount.current += 1; const mark = runCount.current;
    setRunning(true);
    setUnavailable(null);
    const rate = ratePerGb ? parseFloat(ratePerGb) : undefined;
    let data: Row[] = [];
    let reason: string | null = null;
    try {
      if (demo) {
        data = await mockRun(reportType, campaignType, rate);
      } else if (REAL_REPORT_TYPES.has(reportType)) {
        const orgId = await resolveOrgId();
        if (reportType === "data-consumption") {
          const loc = locationsByName.get(bu);
          data = loc ? await realDataConsumption(orgId, loc.id, from, to, rate) : [];
        } else {
          data = await realDataByLocation(orgId, customerLocations ?? [], from, to, rate);
        }
      } else {
        reason = UNAVAILABLE_REASON[reportType] ?? "This report isn't available for real accounts yet.";
      }
    } catch {
      reason = "Could not load this report -- check the connection and try again.";
    }
    if (mark !== runCount.current) return;
    setRows(data); setUnavailable(reason); setRunning(false); setPage(0); setSearchTxt("");
  }, [demo, bu, reportType, from, to, singleDate, team, campaignType, ratePerGb, needsRange, needsSingle, needsTeam, needsCampaignType, needsRate, locationsByName, customerLocations]);

  const exportCsv = () => {
    if (!rows || !rows.length) return;
    const header = cols.map((c) => c.label).join(",") + "\n";
    const data = sortedRows.map((r) => cols.map((c) => fmtCell(c.key, r[c.key] ?? null)).join(",")).join("\n");
    const blob = new Blob([header + data], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${csvPrefix}-${reportType}-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Both print and "download PDF" hand off to the browser's print dialog --
  // every major browser offers "Save as PDF" as a destination there, so this
  // covers both without pulling in a PDF-generation dependency.
  const handlePrint = () => window.print();

  useEffect(() => {
    if (!comboboxOpen) return;
    const handler = (e: MouseEvent) => { if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboboxOpen(false); };
    document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler);
  }, [comboboxOpen]);

  const Err = ({ k }: { k: string }) => errs[k] ? <p className="mt-1 text-xs text-destructive">{errs[k]}</p> : null;

  return (
    <>
      <div className="print:hidden rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ur-bu" className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
            <select id="ur-bu" value={bu} onChange={(e) => { setBu(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.bu; return n; }); }} className={inputCls}><option value="">Choose business unit</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            <Err k="bu" />
          </div>

          <div ref={comboRef} className="relative">
            <label className={labelCls}>Report Type <span className="text-destructive">*</span></label>
            <button type="button" role="combobox" aria-expanded={comboboxOpen} aria-haspopup="listbox" onClick={() => setComboboxOpen(!comboboxOpen)} onKeyDown={(e) => { if (e.key === "ArrowDown") { setComboboxOpen(true); } if (e.key === "Escape") setComboboxOpen(false); }} className={cn(inputCls, "flex items-center justify-between", comboboxOpen && "border-primary ring-2 ring-primary/15")}>
              <span className={rt ? "text-foreground" : "text-muted-foreground"}>{rt ? rt.label : "Choose report type"}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${comboboxOpen ? "rotate-180" : ""}`} />
            </button>
            <Err k="reportType" />
            {comboboxOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border bg-popover shadow-lg">
                <div className="p-2"><input type="text" placeholder="Filter reports…" value={comboFilter} onChange={(e) => { setComboFilter(e.target.value); setActiveIdx(0); }} className={inputCls} autoFocus /></div>
                <ul role="listbox" className="max-h-60 overflow-y-auto pb-1">
                  {filteredCombos.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">No report matches that.</li> : filteredCombos.map((r, i) => (
                    <li key={r.id} role="option" aria-selected={r.id === reportType} className={cn("cursor-pointer rounded-lg mx-1 px-3 py-2 transition-colors", i === activeIdx || r.id === reportType ? "bg-primary/10" : "hover:bg-accent")}
                      onMouseEnter={() => setActiveIdx(i)} onClick={() => { setReportType(r.id); setComboboxOpen(false); setRows(null); setComboFilter(""); setErrs((p) => { const n = { ...p }; delete n.reportType; return n; }); }}>
                      <p className="text-sm font-medium text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {reportType && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {needsTeam && (
              <div><label htmlFor="ur-team" className={labelCls}>Team <span className="text-destructive">*</span></label>
              <select id="ur-team" value={team} onChange={(e) => { setTeam(e.target.value); setErrs((p) => { const n = { ...p }; delete n.team; return n; }); }} className={inputCls}><option value="">Choose team</option>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}</select><Err k="team" /></div>
            )}
            {needsCampaignType && (
              <div><label htmlFor="ur-ct" className={labelCls}>Campaign Type <span className="text-destructive">*</span></label>
              <select id="ur-ct" value={campaignType} onChange={(e) => { setCampaignType(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.campaignType; return n; }); }} className={inputCls}><option value="">Choose campaign type</option>{CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select><Err k="campaignType" /></div>
            )}
            {needsRate && (
              <div><label htmlFor="ur-rate" className={labelCls}>Rate Per GB <span className="text-xs font-normal text-muted-foreground">(optional, ₹)</span></label>
              <input id="ur-rate" type="number" min={0} step="0.01" inputMode="decimal" placeholder="e.g. 40" value={ratePerGb} onChange={(e) => { setRatePerGb(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.ratePerGb; return n; }); }} className={inputCls} /><Err k="ratePerGb" /></div>
            )}
            {needsSingle && (
              <div><label htmlFor="ur-sd" className={labelCls}>Date <span className="text-destructive">*</span></label>
              <div className="relative"><input id="ur-sd" type="date" value={singleDate} onChange={(e) => { setSingleDate(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.singleDate; return n; }); }} max={today()} className={cn(inputCls, "pr-9")} /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div><Err k="singleDate" /></div>
            )}
            {needsRange && (
              <>
                <div><label htmlFor="ur-fr" className={labelCls}>From <span className="text-destructive">*</span></label>
                  <div className="relative"><input id="ur-fr" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.from; return n; }); }} max={today()} className={cn(inputCls, "pr-9")} /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div><Err k="from" /></div>
                <div><label htmlFor="ur-to" className={labelCls}>To <span className="text-destructive">*</span></label>
                  <div className="relative"><input id="ur-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.to; return n; }); }} max={today()} className={cn(inputCls, "pr-9")} /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div><Err k="to" /></div>
                <div className="flex items-end gap-2"><span className="text-xs text-muted-foreground">Quick: </span>{[["Last 7 days", 7], ["Last 30 days", 30]].map(([label, days]) => (
                  <button key={label} onClick={() => setQuick(days as number)} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">{label}</button>
                ))}<button onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10)); }} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">This month</button></div>
              </>
            )}
            {(reportType === "top-users" || reportType === "top-vouchers" || reportType === "top-campaigns") && <p className="text-xs text-muted-foreground md:col-span-2">This report always covers the current month.</p>}
          </div>
        )}

        <hr className="my-6 border-border" />
        <div className="flex justify-center">
          <button onClick={handleRun} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{running ? "Running…" : "Search"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {rows === null && !running && (
          <EmptyState icon={FileBarChart} title="No report run yet" description="Choose a report type and press Search to see results." />
        )}
        {running && <LoadingSkeleton rows={5} />}
        {!running && rows !== null && rows.length === 0 && unavailable && (
          <EmptyState icon={Info} title="Not available yet" description={unavailable} />
        )}
        {!running && rows !== null && rows.length === 0 && !unavailable && (
          <EmptyState icon={FileBarChart} title="No data for this report" description="Try a wider date range or a different location." />
        )}
        {!running && rows && rows.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="print:hidden flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div><CardTitle className="text-sm">{rt?.label}</CardTitle><p className="text-xs text-muted-foreground">{bu} · {needsRange ? `${from} to ${to}` : needsSingle ? singleDate : "Current month"} · {sortedRows.length} rows</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Filter…" value={searchTxt} onChange={(e) => { setSearchTxt(e.target.value); setPage(0); }} className={cn(inputCls, "w-40 py-1.5 pl-8")} /></div>
                <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Download className="h-4 w-4" />CSV</button>
                <button onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Printer className="h-4 w-4" />Print</button>
                <button onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><FileDown className="h-4 w-4" />PDF</button>
              </div>
            </CardHeader>
            <CardContent>
            <div className="hidden print:block mb-4"><h3 className="text-base font-semibold tracking-tight">{rt?.label}</h3><p className="text-xs text-muted-foreground">{bu} · {needsRange ? `${from} to ${to}` : needsSingle ? singleDate : "Current month"} · {sortedRows.length} rows</p></div>
            <div className="overflow-x-auto rounded-xl border">
              <Table className="min-w-[900px]">
                <TableHeader><TableRow>{cols.map((c) => {
                  const active = sortKey === c.key;
                  return <TableHead key={c.key} className={cn("text-xs font-medium uppercase tracking-wide cursor-pointer select-none print:cursor-default", c.key === "rank" && "w-8")} onClick={() => toggleSort(c.key)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <span className="inline-flex items-center gap-1">{c.label}{active ? <ChevronUp className="h-3 w-3 text-primary print:hidden" /> : null}</span>
                  </TableHead>;
                })}</TableRow></TableHeader>
                <TableBody>{paged.map((r, i) => (
                  <TableRow key={i} className="border-b">
                    {cols.map((c) => (
                      <TableCell key={c.key} className="text-xs text-foreground">{fmtCell(c.key, r[c.key] ?? null)}</TableCell>
                    ))}
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            {sortedRows.length > 0 && <div className="print:hidden mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sortedRows.length)} of {sortedRows.length}</span><div className="flex gap-1"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/** Operator-voice lines, not fabricated testimonials -- same rotating-quote
 * pattern as the Dashboard hero, written for this page's own subject
 * (checking your own numbers) rather than reused WiFi-uptime lines. */
const REPORTS_QUOTES = [
  "The report you never run is the trend you never catch.",
  "Real data beats a good guess, every time.",
  "Export it -- don't just eyeball it.",
  "A number nobody checks might as well not exist.",
  "Yesterday's data only helps if you actually open it.",
  "Guesswork is expensive. Reports are free.",
];

const CATEGORY_CONFIG: Record<Category, { reportTypes: ReportType[]; csvPrefix: string }> = {
  "Guest Activity Report": { reportTypes: USER_REPORT_TYPES, csvPrefix: "user-report" },
  "Voucher Redemption Report": { reportTypes: VOUCHER_REPORT_TYPES, csvPrefix: "voucher-report" },
  "Campaign Engagement Report": { reportTypes: CAMPAIGN_REPORT_TYPES, csvPrefix: "campaign-report" },
  "Bandwidth & Cost Report": { reportTypes: DATA_REPORT_TYPES, csvPrefix: "data-report" },
  "OTP & SMS Delivery Report": { reportTypes: SMS_REPORT_TYPES, csvPrefix: "sms-report" },
};

/** `masked` -- see `ReportPanel`'s own doc comment just above it -- is
 * threaded in from both real call sites: the owner's Reports feature page
 * (`customer.$locationId.$feature.tsx`'s own `masked` header state, always
 * `true` for the owner by design) and the `/agent` staff-preview dashboard
 * (`renderFeature`'s `masked` ctx, the previewed agent's real
 * `dataMasking` flag). Defaults to `true`, matching `ReportPanel`. */
export default function UserReports({ masked = true }: { masked?: boolean } = {}) {
  const [category, setCategory] = useState<Category>("Guest Activity Report");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const cfg = CATEGORY_CONFIG[category];

  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((i) => (i + 1) % REPORTS_QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      {/* A right-sized banner, not a full glance-dashboard hero -- this is
       * a utility tool (pick a report, run it, export it), so the dark
       * treatment carries the framing and a rotating quote rather than big
       * KPI numbers this page doesn't have. */}
      <div className="print:hidden relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-6 text-white shadow-xl shadow-indigo-950/30 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <FileBarChart className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">Your data, on demand</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-white/70">Run and export usage, voucher, campaign, data, and SMS reports.</p>
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/50">
          <Quote className="h-3 w-3 shrink-0 text-white/30" />
          <AnimatePresence mode="wait">
            <motion.span
              key={quoteIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4 }}
            >
              {REPORTS_QUOTES[quoteIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      <div className="print:hidden overflow-x-auto rounded-xl border bg-muted/40 p-1">
        <div className="flex min-w-[500px] gap-1">
          {CATEGORIES.map((label) => {
            const active = label === category;
            return (
              <button key={label} onClick={() => setCategory(label)} aria-current={active ? "page" : undefined}
                className={cn("relative flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors", active ? "bg-card text-[#4f46e5] shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={category}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ReportPanel reportTypes={cfg.reportTypes} csvPrefix={cfg.csvPrefix} masked={masked} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
