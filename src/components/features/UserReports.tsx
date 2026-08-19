import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileBarChart,
  Download,
  Printer,
  FileDown,
  Info,
  Quote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import {
  resolveOrgId,
  identityFromGuest,
  deviceLabelFrom,
  type RawGuest,
} from "@/services/customer.service";
import { useCustomerLocations, useIsDemo } from "@/hooks/useCustomerDashboard";
import { maskEmail, maskMac, maskPhone } from "@/components/features/HeaderControls";
import { voucherService } from "@/services/voucher.service";
import type { VoucherBatch } from "@/types/voucher";

const CATEGORIES = [
  "Guest Activity Report",
  "Voucher Redemption Report",
  "Campaign Engagement Report",
  "Bandwidth & Cost Report",
  "OTP & SMS Delivery Report",
] as const;
type Category = (typeof CATEGORIES)[number];

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const TEAMS = ["Sales Team", "Executive VIP", "Contractors", "Maintenance Staff"];
const CAMPAIGN_TYPES = [
  "All Types",
  "Banner Campaign",
  "Survey/Feedback Campaign",
  "Redirect Campaign",
];

interface ReportType {
  id: string;
  label: string;
  desc: string;
}
interface ColumnDef {
  key: string;
  label: string;
  sortType: "string" | "number" | "date";
}
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
const inputCls =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";
const NAMES = [
  "Ravi Sharma",
  "Priya Kapoor",
  "Amit Patel",
  "Sana Khan",
  "John Doe",
  "Meera Nair",
  "Vikram Singh",
  "Ananya Reddy",
  "Arun Kumar",
  "Neha Gupta",
  "Rohan Desai",
  "Kavita Joshi",
];
const phone = (i: number) => `+9198${String(70000000 + i * 1111111).slice(0, 10)}`;

// ── report catalogs, one per category ──────────────────────────────
const USER_REPORT_TYPES: ReportType[] = [
  {
    id: "user-data",
    label: "Guest Data Usage By Date Range",
    desc: "How much data each user pulled over a chosen period.",
  },
  {
    id: "user-sessions",
    label: "Guest Dwell Time By Date Range",
    desc: "Every login session with start, end and duration.",
  },
  {
    id: "user-presence",
    label: "Hourly Guest Traffic (Single-Day Snapshot)",
    desc: "Hour-by-hour presence for a single day.",
  },
  {
    id: "top-users",
    label: "Heaviest Data Users (This Month)",
    desc: "The heaviest data users this month.",
  },
  {
    id: "daywise-data",
    label: "Daily Guest Data Trend",
    desc: "Daily data totals across the period.",
  },
  {
    id: "daywise-unique",
    label: "Daily Guest & Device Footfall",
    desc: "Distinct users and devices seen each day.",
  },
  { id: "team-report", label: "Team Usage Breakdown", desc: "Usage rolled up by group or team." },
];
const VOUCHER_REPORT_TYPES: ReportType[] = [
  {
    id: "voucher-usage",
    label: "Voucher Redemption Log By Date Range",
    desc: "Every voucher redeemed, by whom and when.",
  },
  {
    id: "voucher-batch",
    label: "Voucher Batch Redemption Rate",
    desc: "Redemption rate for each generated batch.",
  },
  {
    id: "top-vouchers",
    label: "Most Redeemed Vouchers (This Month)",
    desc: "The most-used vouchers this month.",
  },
];
const CAMPAIGN_REPORT_TYPES: ReportType[] = [
  {
    id: "campaign-performance",
    label: "Campaign Funnel By Date Range",
    desc: "Sent, delivered, opened and clicked per campaign.",
  },
  {
    id: "campaign-daywise",
    label: "Daily Campaign Engagement Trend",
    desc: "Daily send/deliver/open totals across the period.",
  },
  {
    id: "top-campaigns",
    label: "Top Campaigns By Click-Through Rate (This Month)",
    desc: "Best-performing campaigns by click-through rate.",
  },
];
const DATA_REPORT_TYPES: ReportType[] = [
  {
    id: "data-consumption",
    label: "Bandwidth Usage & Cost By Date Range",
    desc: "Upload/download totals and peak throughput per day.",
  },
  {
    id: "data-by-location",
    label: "Bandwidth Usage By Location",
    desc: "Total and average data usage broken down by location.",
  },
];
const SMS_REPORT_TYPES: ReportType[] = [
  {
    id: "otp-delivery",
    label: "OTP Delivery & Latency By Date Range",
    desc: "Every OTP sent, its delivery status and latency.",
  },
  {
    id: "sms-daywise",
    label: "Daily SMS Delivery Rate",
    desc: "Daily sent/delivered/failed totals across the period.",
  },
];

// "Network Activity Log" -- Support & Logs' own nav item
// (src/lib/customerNav.ts's "network-activity" entry), a distinct page from
// this file's own "Reports" categories above, not a sixth CATEGORIES tab.
// Rendered by NetworkActivityLog.tsx via the exported ReportPanel below --
// see docs/ipdr-logs-syslog-spec.md §5 for why this is named "Network
// Activity Log," not "IPDR Logs": it's session-level (who/when/how much),
// never per-flow (what destination/port), and that distinction is
// deliberately kept out of the product copy until real per-flow capture
// exists. Exported (not folded into CATEGORY_CONFIG) because this report
// group lives on its own page/nav item, gated owner-only, rather than as a
// tab inside the general Reports page.
export const NETWORK_ACTIVITY_REPORT_TYPES: ReportType[] = [
  {
    id: "guest-session-log",
    label: "Guest Session Log",
    desc: "Every guest connection: identity, device, IP, auth method, duration and data used.",
  },
  {
    id: "login-access-log",
    label: "Login/Access Attempt Log",
    desc: "Every login attempt -- success or failure -- with identifier, IP and reason.",
  },
];

const COLUMNS: Record<string, ColumnDef[]> = {
  "user-data": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "name", label: "Name", sortType: "string" },
    { key: "mobile", label: "Mobile Number", sortType: "string" },
    { key: "devices", label: "Devices", sortType: "number" },
    { key: "data", label: "Data Used", sortType: "number" },
    { key: "lastSeen", label: "Last Seen", sortType: "date" },
  ],
  "user-sessions": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "name", label: "Name", sortType: "string" },
    { key: "mobile", label: "Mobile Number", sortType: "string" },
    { key: "device", label: "Device", sortType: "string" },
    { key: "sessionStart", label: "Session Start", sortType: "date" },
    { key: "sessionEnd", label: "Session End", sortType: "date" },
    { key: "duration", label: "Duration", sortType: "number" },
    { key: "data", label: "Data Used", sortType: "number" },
  ],
  "user-presence": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "name", label: "Name", sortType: "string" },
    { key: "mobile", label: "Mobile Number", sortType: "string" },
    { key: "firstSeen", label: "First Seen", sortType: "date" },
    { key: "lastSeen", label: "Last Seen", sortType: "date" },
    { key: "totalPresence", label: "Total Presence", sortType: "string" },
    { key: "sessions", label: "Sessions", sortType: "number" },
  ],
  "top-users": [
    { key: "rank", label: "Rank", sortType: "number" },
    { key: "name", label: "Name", sortType: "string" },
    { key: "mobile", label: "Mobile Number", sortType: "string" },
    { key: "data", label: "Data Used", sortType: "number" },
    { key: "sessions", label: "Sessions", sortType: "number" },
  ],
  "daywise-data": [
    { key: "date", label: "Date", sortType: "date" },
    { key: "totalData", label: "Total Data", sortType: "number" },
    { key: "users", label: "Users", sortType: "number" },
    { key: "avgPerUser", label: "Avg Per User", sortType: "number" },
  ],
  "daywise-unique": [
    { key: "date", label: "Date", sortType: "date" },
    { key: "uniqueUsers", label: "Unique Users", sortType: "number" },
    { key: "uniqueDevices", label: "Unique Devices", sortType: "number" },
    { key: "newUsers", label: "New Users", sortType: "number" },
  ],
  "team-report": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "team", label: "Team", sortType: "string" },
    { key: "members", label: "Members", sortType: "number" },
    { key: "data", label: "Data Used", sortType: "number" },
    { key: "sessions", label: "Sessions", sortType: "number" },
    { key: "avgPerMember", label: "Avg Per Member", sortType: "number" },
  ],

  "voucher-usage": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "code", label: "Voucher Code", sortType: "string" },
    { key: "batch", label: "Batch", sortType: "string" },
    { key: "value", label: "Value", sortType: "string" },
    { key: "redeemedBy", label: "Redeemed By", sortType: "string" },
    { key: "redeemedAt", label: "Redeemed At", sortType: "date" },
  ],
  "voucher-batch": [
    { key: "batch", label: "Batch", sortType: "string" },
    { key: "generated", label: "Generated", sortType: "number" },
    { key: "redeemed", label: "Redeemed", sortType: "number" },
    { key: "expired", label: "Expired", sortType: "number" },
    { key: "rate", label: "Redemption Rate", sortType: "string" },
  ],
  "top-vouchers": [
    { key: "rank", label: "Rank", sortType: "number" },
    { key: "code", label: "Voucher Code", sortType: "string" },
    { key: "redeemedBy", label: "Redeemed By", sortType: "string" },
    { key: "value", label: "Value", sortType: "string" },
    { key: "redeemedAt", label: "Redeemed At", sortType: "date" },
  ],

  "campaign-performance": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "campaign", label: "Campaign", sortType: "string" },
    { key: "type", label: "Type", sortType: "string" },
    { key: "sent", label: "Sent", sortType: "number" },
    { key: "delivered", label: "Delivered", sortType: "number" },
    { key: "opened", label: "Opened", sortType: "number" },
    { key: "clicked", label: "Clicked", sortType: "number" },
    { key: "ctr", label: "CTR", sortType: "string" },
  ],
  "campaign-daywise": [
    { key: "date", label: "Date", sortType: "date" },
    { key: "type", label: "Type", sortType: "string" },
    { key: "sent", label: "Sent", sortType: "number" },
    { key: "delivered", label: "Delivered", sortType: "number" },
    { key: "opened", label: "Opened", sortType: "number" },
  ],
  "top-campaigns": [
    { key: "rank", label: "Rank", sortType: "number" },
    { key: "campaign", label: "Campaign", sortType: "string" },
    { key: "type", label: "Type", sortType: "string" },
    { key: "reach", label: "Reach", sortType: "number" },
    { key: "ctr", label: "CTR", sortType: "string" },
  ],

  "data-consumption": [
    { key: "date", label: "Date", sortType: "date" },
    { key: "uploadGB", label: "Upload", sortType: "number" },
    { key: "downloadGB", label: "Download", sortType: "number" },
    { key: "totalGB", label: "Total", sortType: "number" },
    { key: "peakMbps", label: "Peak Throughput", sortType: "number" },
    { key: "cost", label: "Est. Cost", sortType: "number" },
  ],
  // "Avg Per Session", not "Avg Per User" -- no per-guest identity is
  // available to realDataByLocation (same limitation this app cites
  // elsewhere for gating other report types), so this is genuinely bytes
  // per session, not per unique guest; a guest with 3 sessions would
  // otherwise inflate the denominator and understate the true per-guest
  // average shown to the customer. Labeling it honestly instead of as
  // something it isn't.
  "data-by-location": [
    { key: "businessUnit", label: "Business Unit", sortType: "string" },
    { key: "totalData", label: "Total Data", sortType: "number" },
    { key: "avgPerUser", label: "Avg Per Session", sortType: "number" },
    { key: "peakHour", label: "Peak Hour", sortType: "string" },
    { key: "cost", label: "Est. Cost", sortType: "number" },
  ],

  "otp-delivery": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "mobile", label: "Mobile Number", sortType: "string" },
    { key: "sentAt", label: "Sent At", sortType: "date" },
    { key: "status", label: "Status", sortType: "string" },
    { key: "latencyMs", label: "Latency (ms)", sortType: "number" },
  ],
  "sms-daywise": [
    { key: "date", label: "Date", sortType: "date" },
    { key: "sent", label: "Sent", sortType: "number" },
    { key: "delivered", label: "Delivered", sortType: "number" },
    { key: "failed", label: "Failed", sortType: "number" },
    { key: "rate", label: "Delivery Rate", sortType: "string" },
  ],

  // "Network Activity Log" columns -- see NETWORK_ACTIVITY_REPORT_TYPES
  // above. `ip`/`mac` are deliberately never masked (see fmtCell below):
  // this report's whole purpose is "who had IP X at time T," the actual
  // record a law-enforcement request would ask for (docs/ipdr-logs-syslog-
  // spec.md §5) -- masking the one column the report exists to show would
  // defeat it.
  "guest-session-log": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "name", label: "Name", sortType: "string" },
    { key: "mobile", label: "Mobile Number", sortType: "string" },
    { key: "ip", label: "IP Address", sortType: "string" },
    { key: "mac", label: "Device MAC", sortType: "string" },
    { key: "device", label: "Device", sortType: "string" },
    { key: "authMethod", label: "Auth Method", sortType: "string" },
    { key: "sessionStart", label: "Session Start", sortType: "date" },
    { key: "sessionEnd", label: "Session End", sortType: "date" },
    { key: "duration", label: "Duration", sortType: "number" },
    { key: "bytesUp", label: "Uploaded", sortType: "number" },
    { key: "bytesDown", label: "Downloaded", sortType: "number" },
    { key: "disconnectReason", label: "Disconnect Reason", sortType: "string" },
  ],
  "login-access-log": [
    { key: "rank", label: "#", sortType: "number" },
    { key: "identifier", label: "Identifier", sortType: "string" },
    { key: "ip", label: "IP Address", sortType: "string" },
    { key: "authMethod", label: "Auth Method", sortType: "string" },
    { key: "status", label: "Status", sortType: "string" },
    { key: "failureReason", label: "Failure Reason", sortType: "string" },
    { key: "attemptedAt", label: "Attempted At", sortType: "date" },
  ],
};

const NEEDS_TEAM = new Set(["team-report"]);
const NEEDS_SINGLE = new Set(["user-presence"]);
const NEEDS_RANGE = new Set([
  "user-data",
  "user-sessions",
  "daywise-data",
  "daywise-unique",
  "voucher-usage",
  "voucher-batch",
  "campaign-performance",
  "campaign-daywise",
  "data-consumption",
  "data-by-location",
  "otp-delivery",
  "sms-daywise",
  "guest-session-log",
  "login-access-log",
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

const MAC_ADDRESS_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

/** Standard CSV/Excel formula-injection trigger characters -- a cell whose
 * value starts with any of these is interpreted by Excel/Sheets as a
 * formula, not text, when the file is opened (e.g. `=cmd|'/c calc'!A1` or
 * `+HYPERLINK(...)`). `redeemed_identifier` (Voucher Redemption reports)
 * and `display_name` (Guest Activity reports, via identityFromGuest) are
 * both guest-self-reported free text with no server-side shape validation
 * (see `normalize_redeemed_identifier` in
 * backend/app/domains/voucher/validators.py, which only strips whitespace,
 * by design) -- a guest can redeem/register with either one set to a
 * formula payload. Used both by `csvField` below (export-time escaping,
 * every CSV field) and by `maskRedeemedIdentifier`'s own fallback (so the
 * masked *display* value doesn't echo a live trigger character either). */
const CSV_FORMULA_TRIGGER_RE = /^[=+\-@]/;

/** "redeemedBy" specifically (Voucher Redemption reports) is `Voucher
 * .redeemed_identifier`, which per that column's own backend docstring
 * (backend/app/domains/voucher/models.py) is "phone/email/device-MAC, or
 * whatever the redeeming guest self-reports" -- not restricted to a phone
 * number the way `maskPhone` assumes. Routing it straight through
 * `maskPhone` left an email (0-1 digits, under `maskPhone`'s own <=5-digit
 * no-op threshold) fully unmasked even with Data masking ON -- a real
 * guest-PII leak in exactly the code path this feature's own PHONE_COLUMNS
 * comment above says was added to fix. Classify by shape and mask with the
 * matching helper instead: a device MAC is deliberately left unmasked
 * (`maskMac`'s own no-op, matching the backend's identical `mask_mac`
 * policy -- customers need the real address to identify a device for
 * support), and anything unclassifiable is redacted the same "some
 * structure survives, PII doesn't" way `maskEmail` does rather than shown
 * raw, since the entire reason this dispatch exists is to not leak
 * whatever a guest self-reported. */
function maskRedeemedIdentifier(value: string): string {
  if (value.includes("@")) return maskEmail(value);
  if (MAC_ADDRESS_RE.test(value)) return maskMac(value);
  const digitCount = (value.match(/\d/g) ?? []).length;
  if (digitCount > 5) return maskPhone(value);
  // Fallback for anything unclassifiable: show a short visible prefix,
  // redact the rest. If a guest's self-reported identifier starts with a
  // CSV/Excel formula-injection trigger character (see
  // CSV_FORMULA_TRIGGER_RE above), that prefix must never be echoed
  // verbatim -- "=cmd..." masked to "=c••••••" is still a live formula
  // when the export is opened in Excel/Sheets, even with masking ON.
  // Redact the prefix too in that case rather than relying solely on
  // export-time escaping (csvField), so the masked display value itself
  // never carries a live trigger character.
  if (value.length <= 2)
    return CSV_FORMULA_TRIGGER_RE.test(value) ? "•".repeat(value.length) : value;
  const rawPrefix = value.slice(0, 2);
  const prefix = CSV_FORMULA_TRIGGER_RE.test(rawPrefix) ? "••" : rawPrefix;
  return `${prefix}${"•".repeat(Math.max(3, value.length - 2))}`;
}

function mockRow(
  reportType: string,
  i: number,
  count: number,
  campaignType?: string,
  ratePerGb?: number,
): Row {
  const r: Row = { rank: i + 1 };
  const pickCampaignType = () =>
    campaignType && campaignType !== "All Types" ? campaignType : CAMPAIGN_TYPES[1 + (i % 3)];
  switch (reportType) {
    case "user-data":
      r.name = NAMES[i % NAMES.length];
      r.mobile = phone(i);
      r.devices = Math.floor(Math.random() * 4) + 1;
      r.data = Math.random() * 5000;
      r.lastSeen = new Date(Date.now() - Math.random() * 86400000 * 7).toISOString();
      break;
    case "user-sessions":
      r.name = NAMES[i % NAMES.length];
      r.mobile = phone(i);
      r.device = ["iPhone 15", "Samsung S24", "MacBook Pro", "Pixel 8", "iPad Air"][i % 5];
      r.sessionStart = new Date(Date.now() - Math.random() * 86400000 * 14).toISOString();
      r.sessionEnd = new Date(Date.now() - Math.random() * 86400000 * 7).toISOString();
      r.duration = Math.floor(Math.random() * 240) + 10;
      r.data = Math.random() * 2000;
      break;
    case "user-presence":
      r.name = NAMES[i % NAMES.length];
      r.mobile = phone(i);
      r.firstSeen = new Date(Date.now() - Math.random() * 86400000 * 30).toISOString();
      r.lastSeen = new Date(Date.now() - Math.random() * 86400000).toISOString();
      r.totalPresence = `${Math.floor(Math.random() * 8) + 1}h ${Math.floor(Math.random() * 60)}m`;
      r.sessions = Math.floor(Math.random() * 20) + 1;
      break;
    case "top-users":
      r.name = NAMES[i % NAMES.length];
      r.mobile = phone(i);
      r.data = Math.random() * 10000;
      r.sessions = Math.floor(Math.random() * 50) + 1;
      break;
    case "daywise-data":
      r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10);
      r.totalData = Math.random() * 15000;
      r.users = Math.floor(Math.random() * 80) + 10;
      r.avgPerUser = (r.totalData as number) / (r.users as number);
      break;
    case "daywise-unique":
      r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10);
      r.uniqueUsers = Math.floor(Math.random() * 100) + 20;
      r.uniqueDevices = Math.floor(Math.random() * 120) + 15;
      r.newUsers = Math.floor(Math.random() * 15);
      break;
    case "team-report":
      r.team = TEAMS[i % TEAMS.length];
      r.members = Math.floor(Math.random() * 15) + 3;
      r.data = Math.random() * 20000;
      r.sessions = Math.floor(Math.random() * 200) + 20;
      r.avgPerMember = (r.data as number) / (r.members as number);
      break;

    case "voucher-usage":
      r.code = `ZW-${1000 + i}`;
      r.batch = ["Front Desk", "Cafe Launch", "Weekend Promo"][i % 3];
      r.value = ["1 Hour", "1 Day", "500 MB"][i % 3];
      r.redeemedBy = phone(i);
      r.redeemedAt = new Date(Date.now() - Math.random() * 86400000 * 10).toISOString();
      break;
    case "voucher-batch": {
      const gen = Math.floor(Math.random() * 400) + 100;
      const red = Math.floor(Math.random() * gen);
      r.batch = ["Front Desk", "Cafe Launch", "Weekend Promo", "Conference Pack"][i % 4];
      r.generated = gen;
      r.redeemed = red;
      r.expired = Math.floor((gen - red) * 0.3);
      r.rate = `${((red / gen) * 100).toFixed(0)}%`;
      break;
    }
    case "top-vouchers":
      r.code = `ZW-${2000 + i}`;
      r.redeemedBy = phone(i);
      r.value = ["1 Day", "1 Week", "1 GB"][i % 3];
      r.redeemedAt = new Date(Date.now() - Math.random() * 86400000 * 5).toISOString();
      break;

    case "campaign-performance": {
      const sent = Math.floor(Math.random() * 5000) + 500;
      const delivered = Math.floor(sent * (0.9 + Math.random() * 0.09));
      const opened = Math.floor(delivered * Math.random() * 0.6);
      const clicked = Math.floor(opened * Math.random() * 0.4);
      r.campaign = ["Welcome Back Offer", "Weekend Special", "New Menu Launch", "Loyalty Reward"][
        i % 4
      ];
      r.type = pickCampaignType();
      r.sent = sent;
      r.delivered = delivered;
      r.opened = opened;
      r.clicked = clicked;
      r.ctr = `${((clicked / sent) * 100).toFixed(1)}%`;
      break;
    }
    case "campaign-daywise": {
      const sent = Math.floor(Math.random() * 800) + 100;
      r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10);
      r.type = pickCampaignType();
      r.sent = sent;
      r.delivered = Math.floor(sent * 0.95);
      r.opened = Math.floor(sent * Math.random() * 0.5);
      break;
    }
    case "top-campaigns": {
      const reach = Math.floor(Math.random() * 8000) + 1000;
      r.campaign = ["Welcome Back Offer", "Weekend Special", "New Menu Launch"][i % 3];
      r.type = pickCampaignType();
      r.reach = reach;
      r.ctr = `${(Math.random() * 12 + 2).toFixed(1)}%`;
      break;
    }

    case "data-consumption": {
      const up = Math.random() * 40 + 5;
      const down = Math.random() * 200 + 40;
      const total = up + down;
      r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10);
      r.uploadGB = up;
      r.downloadGB = down;
      r.totalGB = total;
      r.peakMbps = Math.random() * 400 + 50;
      r.cost = ratePerGb ? total * ratePerGb : null;
      break;
    }
    case "data-by-location": {
      const totalData = Math.random() * 50000 + 5000;
      r.businessUnit = UNITS[i % UNITS.length];
      r.totalData = totalData;
      r.avgPerUser = Math.random() * 2000 + 200;
      r.peakHour = `${Math.floor(Math.random() * 12) + 8}:00`;
      r.cost = ratePerGb ? (totalData / 1000) * ratePerGb : null;
      break;
    }

    case "otp-delivery":
      r.mobile = phone(i);
      r.sentAt = new Date(Date.now() - Math.random() * 86400000 * 3).toISOString();
      r.status = Math.random() > 0.08 ? "Delivered" : "Failed";
      r.latencyMs = Math.floor(Math.random() * 4000) + 300;
      break;
    case "sms-daywise": {
      const sent = Math.floor(Math.random() * 1200) + 200;
      const failed = Math.floor(sent * Math.random() * 0.06);
      r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10);
      r.sent = sent;
      r.delivered = sent - failed;
      r.failed = failed;
      r.rate = `${(((sent - failed) / sent) * 100).toFixed(1)}%`;
      break;
    }

    case "guest-session-log": {
      r.name = NAMES[i % NAMES.length];
      r.mobile = phone(i);
      r.ip = `10.0.${(i % 4) + 1}.${(i % 250) + 2}`;
      r.mac = ["00:1A:2B:3C:4D:5E", "AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66", "AB:CD:EF:01:23:45"][
        i % 4
      ];
      r.device = ["iPhone 15", "Samsung S24", "MacBook Pro", "Pixel 8", "iPad Air"][i % 5];
      r.authMethod = ["otp", "voucher", "mac-auth"][i % 3];
      const start = new Date(Date.now() - Math.random() * 86400000 * 14);
      const end = new Date(start.getTime() + (Math.floor(Math.random() * 180) + 5) * 60000);
      r.sessionStart = start.toISOString();
      r.sessionEnd = end.toISOString();
      r.duration = Math.round((end.getTime() - start.getTime()) / 60000);
      r.bytesUp = Math.random() * 200;
      r.bytesDown = Math.random() * 1500;
      r.disconnectReason = ["guest-logout", "idle-timeout", "data-limit-reached"][i % 3];
      break;
    }
    case "login-access-log": {
      r.identifier = phone(i);
      r.ip = `10.0.${(i % 4) + 1}.${(i % 250) + 2}`;
      r.authMethod = ["otp", "voucher"][i % 2];
      const ok = Math.random() > 0.15;
      r.status = ok ? "Success" : "Failed";
      r.failureReason = ok ? null : ["Invalid OTP", "OTP expired", "Voucher already used"][i % 3];
      r.attemptedAt = new Date(Date.now() - Math.random() * 86400000 * 10).toISOString();
      break;
    }
  }
  return r;
}

function mockRun(reportType: string, campaignType?: string, ratePerGb?: number): Promise<Row[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const count =
        reportType === "team-report"
          ? 4
          : reportType === "top-users" ||
              reportType === "top-vouchers" ||
              reportType === "top-campaigns"
            ? 10
            : reportType === "voucher-batch"
              ? 4
              : reportType === "data-by-location"
                ? UNITS.length
                : Math.floor(Math.random() * 24) + 3;
      resolve(
        Array.from({ length: count }, (_, i) =>
          mockRow(reportType, i, count, campaignType, ratePerGb),
        ),
      );
    }, 700);
  });
}

// ── real reports for a real account ──────────────────────────────────
// Every report type above used Math.random() unconditionally, for every
// account, demo or real -- a real customer running "User Sessions By Date
// Range" for their own business saw entirely fabricated names, mobile
// numbers and data totals with no real backend call anywhere.
//
// The four "Guest Activity" per-guest reports (user-data/user-sessions/
// user-presence/top-users) were previously listed in UNAVAILABLE_REASON
// below on the claim that "per-guest identity (name/mobile) isn't exposed
// by the real session data this account can access." That claim went stale
// once identityFromGuest() (customer.service.ts) landed: GET /guests
// genuinely does return real Guest.identifier/display_name for this
// account, already joined to /guest-sessions rows by guest_id in
// getUsers()'s own Connected Guests table. These four reports now do the
// same bulk /guest-sessions + /guests fetch-and-join (see
// fetchRealGuestsById/realUserData/realUserSessions/realUserPresence/
// realTopUsers below) and aggregate client-side, the same pattern already
// used for data-consumption/data-by-location's day/location rollups.
//
// "voucher-usage"/"top-vouchers" moved out of UNAVAILABLE_REASON below --
// GET /analytics/voucher-redemptions/log (backend/app/domains/analytics)
// now backs both real report types, see realVoucherRedemptionLog/
// realTopRedeemedVouchers above.
//
// "daywise-data"/"daywise-unique" were previously listed in
// UNAVAILABLE_REASON below on the claim that per-guest/per-day breakdown
// "isn't exposed"/"isn't tracked" by the real backend. That claim was
// already stale by the time it was written: GET /guest-sessions -- the
// same endpoint fetchRealSessions/realDataConsumption above already call
// successfully -- returns guest_id and device_id on every row
// (GuestSessionResponse, backend/app/domains/guest/schemas.py), so both
// reports are just the identical paginated fetch bucketed by day and
// counted for distinct guest_id/device_id, same aggregation shape as
// realDataConsumption's own byte-total rollup. See realDaywiseData/
// realDaywiseUnique below. "New Users" (daywise-unique) additionally
// cross-references each distinct guest's Guest.created_at (now on
// RawGuest, see customer.service.ts) against the day bucket, since a
// guest is only meaningfully "new" on the one day matching when their
// Guest record was actually created.
//
// "voucher-batch" was similarly listed on the claim that "per-batch
// issued-vs-redeemed rate isn't computed in the real backend yet." GET
// /voucher-batches (org-scoped list) and GET /voucher-batches/{id}/stats
// (total/unused/active/exhausted/expired/revoked/redemption_rate) already
// exist and already back the real Vouchers tab (voucher.service.ts's
// listBatches/getStats) -- this report just wasn't wired to them. See
// realVoucherBatchRate below for how "Redeemed" is derived (there's no
// literal "redeemed" field in VoucherBatchStatsResponse).
//
// Every remaining report type still needs either engagement/redemption
// event data (campaign opens/clicks, team rosters) with no backing
// endpoint anywhere in this codebase's real data paths, or a real
// aggregate the backend doesn't compute in a shape this report's columns
// can use without a copy/product decision (see the corrected, still-
// unavailable reasons below for campaign-performance/top-campaigns and
// otp-delivery specifically). Those stay honestly unavailable for real
// accounts rather than fabricated -- see UNAVAILABLE_REASON below.
// "guest-session-log" and "login-access-log" back the Network Activity Log
// page (NetworkActivityLog.tsx / NETWORK_ACTIVITY_REPORT_TYPES above), per
// docs/ipdr-logs-syslog-spec.md §7's documented FE/BE contract:
//
// - "guest-session-log" reuses the existing, already-real GET
//   /guest-sessions (fetchRealSessions below, same endpoint every other
//   real report in this file already calls) for every column except the
//   resolved device MAC. **Assumption, flagged here and in this feature's
//   PR**: the spec leaves that MAC gap to be closed one of two ways -- a
//   bulk GET /guest-devices endpoint, or denormalizing `mac_address`
//   directly onto GuestSessionResponse via a join -- and defers the choice
//   to whichever the backend engineer finds less invasive. This code
//   assumes the denormalized-field approach (see RealGuestSession's own
//   `mac_address` doc comment below): if the backend ships the bulk
//   endpoint instead, `mac_address` simply stays absent on every row and
//   the Device MAC column honestly renders "--" (fmtCell's existing null
//   handling) until this file is updated to call that endpoint too --
//   never a fabricated MAC either way.
// - "login-access-log" calls `GET /guest-login-history`, confirmed missing
//   from the real backend as of this spec (§7: "New endpoint needed,
//   confirmed missing"). Written against that section's documented
//   contract (`location_id`/`start_date`/`end_date`/`page`/`page_size`
//   query params, `{items, has_next}` response shape mirroring
//   GET /guest-sessions exactly) since a BE engineer is adding it in
//   parallel -- **assumption flagged here and in this feature's PR**: if
//   the shipped endpoint's param names or response envelope differ,
//   fetchRealLoginHistory below is the only place that needs to change.
const REAL_REPORT_TYPES = new Set([
  "data-consumption",
  "data-by-location",
  "voucher-usage",
  "top-vouchers",
  "user-data",
  "user-sessions",
  "user-presence",
  "top-users",
  "daywise-data",
  "daywise-unique",
  "voucher-batch",
  "guest-session-log",
  "login-access-log",
]);

const UNAVAILABLE_REASON: Record<string, string> = {
  "team-report": "Guest teams aren't tied to usage totals in the real backend yet.",
  "campaign-performance":
    "GET /campaigns/{id}/results now returns real engagement counts (impressions/responses/skipped/clicked), but this report's Sent/Delivered/Opened/Clicked columns have no backend equivalent -- campaigns are served in-session, not through a delivery channel with those stages. Needs a column relabel (e.g. Impressions/Responses/Skipped/Clicked) before it can show real data honestly.",
  "campaign-daywise":
    "Campaign delivery/open/click metrics aren't tracked in the real backend yet.",
  "top-campaigns":
    "GET /campaigns/{id}/results now returns real engagement counts (impressions/responses/skipped/clicked), but this report's Reach/CTR columns assume delivery-channel semantics campaigns don't have -- campaigns are served in-session, not through a delivery channel. Needs a column relabel before it can show real data honestly.",
  "otp-delivery":
    "GET /otp/requests returns real per-request rows (identifier, channel, created_at, verified_at, is_consumed), but this report needs three things that endpoint doesn't have yet: start_date/end_date query params for server-side date filtering, a true provider delivery-status field (a delivered-but-never-verified request looks identical to one that never arrived in this data), and a latency field.",
  "sms-daywise": "Per-message SMS delivery status isn't logged in the real backend yet.",
};

// Same real /guest-sessions row shape as customer.service.ts's own
// RawGuestSession -- guest_id/device_id/user_agent are already returned by
// this endpoint (getUsers() and getDashboard() already read them), just
// never previously requested by this file's own narrower type.
interface RealGuestSession {
  started_at: string;
  ended_at?: string | null;
  bytes_uploaded?: number;
  bytes_downloaded?: number;
  guest_id?: string | null;
  device_id?: string | null;
  user_agent?: string | null;
  // The four fields below are already on the real GuestSessionResponse
  // (backend/app/domains/guest/schemas.py) and already returned by GET
  // /guest-sessions today -- just never previously requested by this
  // file's own narrower type, same story as user_agent's own doc comment
  // above. Added for the Guest Session Log report (realGuestSessionLog
  // below); every other real report in this file keeps working unchanged
  // since these are additive optional fields.
  ip_address?: string | null;
  auth_method?: string | null;
  disconnect_reason?: string | null;
  // NOT on GuestSessionResponse as of this writing -- see REAL_REPORT_TYPES'
  // own doc comment above for the two ways the backend might close this gap
  // and why this field is written as optional/best-effort rather than
  // assumed present.
  mac_address?: string | null;
}

// GET /guest-sessions caps page_size at 100 (backend/app/domains/guest/router.py's
// `page_size: int = Query(default=25, ge=1, le=100)`) -- a single page_size=500
// request 422s outright, which silently turned every real Bandwidth & Cost Report into
// either a fabricated "Could not load this report" error or a false "0 MB"
// once the per-location Promise.allSettled in realDataByLocation swallowed
// the rejection. Page through in 100-row chunks via has_next instead.
//
// start_date/end_date are now sent to the backend (GET /guest-sessions'
// real, server-side [start_date, end_date) filter on started_at --
// GuestService.list_sessions_in_range) instead of over-fetching the most
// recent N sessions and filtering client-side. The old client-side-filter
// approach silently truncated any older-but-in-range day once a location's
// session volume exceeded the old page cap, which could make a real,
// populated date range render as a false "no data" empty report with no
// error -- see that endpoint's own docstring.
//
// MAX_REPORT_PAGES below is no longer a truncation boundary (the query is
// now bounded by the real date range, not an arbitrary row count) -- it's
// only a circuit breaker against a runaway loop if `has_next` were ever
// wrong, generous enough (50k rows) that no legitimate real-account report
// should ever hit it.
const SESSIONS_PAGE_SIZE = 100;
const MAX_REPORT_PAGES = 500;

async function fetchRealSessions(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<RealGuestSession[]> {
  const all: RealGuestSession[] = [];
  for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
    const { data } = await api.get<{ items: RealGuestSession[]; has_next?: boolean }>(
      "/guest-sessions",
      {
        params: {
          location_id: locationId,
          start_date: new Date(from).toISOString(),
          end_date: new Date(new Date(to).getTime() + 86400000).toISOString(),
          page,
          page_size: SESSIONS_PAGE_SIZE,
        },
        headers: { "X-Organization-Id": orgId },
      },
    );
    all.push(...(data?.items ?? []));
    if (!data?.has_next) break;
  }
  return all;
}

async function realDataConsumption(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
  ratePerGb?: number,
): Promise<Row[]> {
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
      return {
        date,
        uploadGB: upGB,
        downloadGB: downGB,
        totalGB,
        peakMbps: null,
        cost: ratePerGb ? totalGB * ratePerGb : null,
      };
    });
}

async function realDataByLocation(
  orgId: string,
  locations: { id: string; name: string }[],
  from: string,
  to: string,
  ratePerGb?: number,
): Promise<Row[]> {
  const settled = await Promise.allSettled(
    locations.map((l) => fetchRealSessions(orgId, l.id, from, to)),
  );
  return locations.map((l, i) => {
    const sessions =
      settled[i].status === "fulfilled"
        ? (settled[i] as PromiseFulfilledResult<RealGuestSession[]>).value
        : [];
    const totalBytes = sessions.reduce(
      (sum, s) => sum + (s.bytes_uploaded ?? 0) + (s.bytes_downloaded ?? 0),
      0,
    );
    const totalData = totalBytes / 1e6; // MB, matches fmtBytes()
    const avgPerUser = sessions.length ? totalData / sessions.length : 0;
    return {
      businessUnit: l.name,
      totalData,
      avgPerUser,
      peakHour: "—",
      cost: ratePerGb ? (totalData / 1000) * ratePerGb : null,
    };
  });
}

// Bulk guest-identity lookup for this location, matched to /guest-sessions
// rows client-side by guest_id -- same "one bulk fetch, matched by
// guest_id" shape as customer.service.ts's own getUsers()/getDashboard(),
// just paged with has_next (like fetchRealSessions/
// fetchRealVoucherRedemptions above) rather than capped at a single
// page_size=100 request, since a report covering a wide date range can
// genuinely span more distinct guests than one page's worth. Best-effort:
// a guest_id with no matching row here (fetch failed, or a guest created
// after this page loaded) just falls back to identityFromGuest's own
// "Guest" placeholder, same honest-fallback contract as everywhere else
// this join happens.
async function fetchRealGuestsById(
  orgId: string,
  locationId: string,
): Promise<Map<string, RawGuest>> {
  const guestsById = new Map<string, RawGuest>();
  for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
    const { data } = await api.get<{ items: RawGuest[]; has_next?: boolean }>("/guests", {
      params: { location_id: locationId, page, page_size: SESSIONS_PAGE_SIZE },
      headers: { "X-Organization-Id": orgId },
    });
    for (const g of data?.items ?? []) guestsById.set(g.id, g);
    if (!data?.has_next) break;
  }
  return guestsById;
}

/** "Guest Dwell Time By Date Range" -- one row per real session, newest
 * first, joined to the guest who ran it via identityFromGuest (same
 * name/phone resolution as the real Connected Guests table). */
async function realUserSessions(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const [sessions, guestsById] = await Promise.all([
    fetchRealSessions(orgId, locationId, from, to),
    fetchRealGuestsById(orgId, locationId),
  ]);
  return sessions
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .map((s, i) => {
      const identity = identityFromGuest(s.guest_id ? guestsById.get(s.guest_id) : undefined);
      const duration = s.ended_at
        ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000)
        : null; // still-active session -- honest "—" (fmtCell's null handling), not a fabricated duration.
      return {
        rank: i + 1,
        name: identity.name,
        mobile: identity.phone || null,
        device: deviceLabelFrom(s.user_agent),
        sessionStart: s.started_at,
        sessionEnd: s.ended_at ?? null,
        duration,
        data: ((s.bytes_uploaded ?? 0) + (s.bytes_downloaded ?? 0)) / 1e6, // MB, matches fmtCell's "data" formatting
      };
    });
}

/** "Guest Session Log" -- the Network Activity Log's session-level record,
 * the "who had IP X at time T" row a law-enforcement request would ask for
 * (docs/ipdr-logs-syslog-spec.md §5). Same fetch+join as realUserSessions
 * above; kept as its own function rather than reused because this report's
 * columns are a real superset (IP, device MAC, auth method, disconnect
 * reason) -- see COLUMNS["guest-session-log"] and RealGuestSession's own
 * ip_address/auth_method/disconnect_reason/mac_address doc comments. */
async function realGuestSessionLog(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const [sessions, guestsById] = await Promise.all([
    fetchRealSessions(orgId, locationId, from, to),
    fetchRealGuestsById(orgId, locationId),
  ]);
  return sessions
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .map((s, i) => {
      const identity = identityFromGuest(s.guest_id ? guestsById.get(s.guest_id) : undefined);
      const duration = s.ended_at
        ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000)
        : null; // still-active session -- honest "—", not a fabricated duration (see realUserSessions' identical comment).
      return {
        rank: i + 1,
        name: identity.name,
        mobile: identity.phone || null,
        ip: s.ip_address ?? null,
        mac: s.mac_address ?? null, // "--" until the backend closes this gap -- see RealGuestSession's own doc comment.
        device: deviceLabelFrom(s.user_agent),
        authMethod: s.auth_method ?? null,
        sessionStart: s.started_at,
        sessionEnd: s.ended_at ?? null,
        duration,
        bytesUp: (s.bytes_uploaded ?? 0) / 1e6, // MB, matches fmtCell's fmtBytes routing
        bytesDown: (s.bytes_downloaded ?? 0) / 1e6,
        disconnectReason: s.disconnect_reason ?? null,
      };
    });
}

/** Real per-guest aggregate over sessions in a date range -- shared by
 * "Guest Data Usage By Date Range" (realUserData) and "Heaviest Data Users
 * (This Month)" (realTopUsers) below, which differ only in date window and
 * result shape. Sessions with no guest_id (never linked to a real Guest
 * row) are skipped rather than lumped into one fake "Guest" aggregate row --
 * see identityFromGuest's own "Guest" placeholder, which is honest for a
 * single row but would misleadingly merge unrelated guests together here. */
function aggregateSessionsByGuest(sessions: RealGuestSession[]) {
  const byGuest = new Map<
    string,
    { data: number; devices: Set<string>; sessions: number; lastSeen: string }
  >();
  for (const s of sessions) {
    if (!s.guest_id) continue;
    const bucket = byGuest.get(s.guest_id) ?? {
      data: 0,
      devices: new Set<string>(),
      sessions: 0,
      lastSeen: s.started_at,
    };
    bucket.data += (s.bytes_uploaded ?? 0) + (s.bytes_downloaded ?? 0);
    bucket.sessions += 1;
    if (s.device_id) bucket.devices.add(s.device_id);
    const seenAt = s.ended_at ?? s.started_at;
    if (new Date(seenAt).getTime() > new Date(bucket.lastSeen).getTime()) bucket.lastSeen = seenAt;
    byGuest.set(s.guest_id, bucket);
  }
  return byGuest;
}

/** "Guest Data Usage By Date Range" -- per-guest totals (data, distinct
 * device count, last-seen) over the picked range, heaviest first. */
async function realUserData(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const [sessions, guestsById] = await Promise.all([
    fetchRealSessions(orgId, locationId, from, to),
    fetchRealGuestsById(orgId, locationId),
  ]);
  const byGuest = aggregateSessionsByGuest(sessions);
  return Array.from(byGuest.entries())
    .sort(([, a], [, b]) => b.data - a.data)
    .map(([guestId, bucket], i) => {
      const identity = identityFromGuest(guestsById.get(guestId));
      return {
        rank: i + 1,
        name: identity.name,
        mobile: identity.phone || null,
        devices: bucket.devices.size,
        data: bucket.data / 1e6,
        lastSeen: bucket.lastSeen,
      };
    });
}

const TOP_USERS_LIMIT = 10;

/** "Heaviest Data Users (This Month)" -- same per-guest aggregate as
 * realUserData above, scoped to the current month and capped to the top
 * TOP_USERS_LIMIT, same "(This Month)"/top-N convention as
 * realTopRedeemedVouchers. */
async function realTopUsers(orgId: string, locationId: string): Promise<Row[]> {
  const { from, to } = currentMonthBounds();
  const [sessions, guestsById] = await Promise.all([
    fetchRealSessions(orgId, locationId, from, to),
    fetchRealGuestsById(orgId, locationId),
  ]);
  const byGuest = aggregateSessionsByGuest(sessions);
  return Array.from(byGuest.entries())
    .sort(([, a], [, b]) => b.data - a.data)
    .slice(0, TOP_USERS_LIMIT)
    .map(([guestId, bucket], i) => {
      const identity = identityFromGuest(guestsById.get(guestId));
      return {
        rank: i + 1,
        name: identity.name,
        mobile: identity.phone || null,
        data: bucket.data / 1e6,
        sessions: bucket.sessions,
      };
    });
}

/** "Hourly Guest Traffic (Single-Day Snapshot)" -- despite the label, this
 * report's own columns (see COLUMNS["user-presence"]) are a per-guest
 * same-day rollup (first/last seen, total presence, session count), not an
 * hour-by-hour histogram -- matching the existing mock fixture's shape,
 * which this real implementation reproduces faithfully rather than
 * reinterpreting. `date` is used as both the from and to bound of a single
 * real day (see fetchRealSessions' own [start, end) day-window math). */
async function realUserPresence(orgId: string, locationId: string, date: string): Promise<Row[]> {
  const [sessions, guestsById] = await Promise.all([
    fetchRealSessions(orgId, locationId, date, date),
    fetchRealGuestsById(orgId, locationId),
  ]);
  const byGuest = new Map<
    string,
    { firstSeen: string; lastSeen: string; totalMs: number; sessions: number }
  >();
  for (const s of sessions) {
    if (!s.guest_id) continue;
    const startMs = new Date(s.started_at).getTime();
    const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    const lastCandidate = s.ended_at ?? s.started_at;
    const bucket = byGuest.get(s.guest_id) ?? {
      firstSeen: s.started_at,
      lastSeen: lastCandidate,
      totalMs: 0,
      sessions: 0,
    };
    if (startMs < new Date(bucket.firstSeen).getTime()) bucket.firstSeen = s.started_at;
    if (new Date(lastCandidate).getTime() > new Date(bucket.lastSeen).getTime())
      bucket.lastSeen = lastCandidate;
    bucket.totalMs += Math.max(0, endMs - startMs);
    bucket.sessions += 1;
    byGuest.set(s.guest_id, bucket);
  }
  return Array.from(byGuest.entries())
    .sort(([, a], [, b]) => b.totalMs - a.totalMs)
    .map(([guestId, bucket], i) => {
      const identity = identityFromGuest(guestsById.get(guestId));
      return {
        rank: i + 1,
        name: identity.name,
        mobile: identity.phone || null,
        firstSeen: bucket.firstSeen,
        lastSeen: bucket.lastSeen,
        totalPresence: fmtDur(Math.round(bucket.totalMs / 60_000)),
        sessions: bucket.sessions,
      };
    });
}

/** "Daily Guest Data Trend" -- same fetchRealSessions call and per-day
 * bucketing realDataConsumption above already does for byte totals, plus a
 * distinct-guest count per day for "Users"/"Avg Per User" (guest_id is
 * present on every real /guest-sessions row per GuestSessionResponse, see
 * RealGuestSession's own doc comment above -- the `if (s.guest_id)` guard
 * below is defensive, matching aggregateSessionsByGuest's identical
 * posture, not an expected real-world skip). */
async function realDaywiseData(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const sessions = await fetchRealSessions(orgId, locationId, from, to);
  const byDay = new Map<string, { data: number; guests: Set<string> }>();
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    const bucket = byDay.get(day) ?? { data: 0, guests: new Set<string>() };
    bucket.data += (s.bytes_uploaded ?? 0) + (s.bytes_downloaded ?? 0);
    if (s.guest_id) bucket.guests.add(s.guest_id);
    byDay.set(day, bucket);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { data, guests }]) => {
      const totalData = data / 1e6; // MB, matches fmtBytes()
      const users = guests.size;
      return { date, totalData, users, avgPerUser: users ? totalData / users : 0 };
    });
}

/** "Daily Guest & Device Footfall" -- same per-day session bucketing as
 * realDaywiseData above, tracking distinct guest_id/device_id per day
 * instead of bytes.
 *
 * "New Users" is the one column that needs more than /guest-sessions alone
 * provides: telling a guest seen today apart from one merely *returning*
 * today requires knowing when that guest first ever showed up, which this
 * endpoint's rows don't carry. Guest.created_at (now on RawGuest, see its
 * own doc comment in customer.service.ts) is that signal -- a guest counts
 * as "new" on the one day matching their own created_at, via the same bulk
 * /guests lookup (fetchRealGuestsById) every other real per-guest report in
 * this file already does. A guest_id with no matching row in guestsById
 * (fetch failed, or created after that page loaded) is conservatively left
 * uncounted rather than guessed, same best-effort-undercount posture
 * fetchRealGuestsById's own doc comment describes for its "Guest" fallback. */
async function realDaywiseUnique(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const [sessions, guestsById] = await Promise.all([
    fetchRealSessions(orgId, locationId, from, to),
    fetchRealGuestsById(orgId, locationId),
  ]);
  const byDay = new Map<string, { guests: Set<string>; devices: Set<string> }>();
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    const bucket = byDay.get(day) ?? { guests: new Set<string>(), devices: new Set<string>() };
    if (s.guest_id) bucket.guests.add(s.guest_id);
    if (s.device_id) bucket.devices.add(s.device_id);
    byDay.set(day, bucket);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { guests, devices }]) => {
      let newUsers = 0;
      for (const guestId of guests) {
        const createdAt = guestsById.get(guestId)?.created_at;
        if (createdAt && createdAt.slice(0, 10) === date) newUsers += 1;
      }
      return { date, uniqueUsers: guests.size, uniqueDevices: devices.size, newUsers };
    });
}

interface RealVoucherRedemption {
  code: string;
  batch_name: string;
  plan_name: string | null;
  redeemed_identifier: string | null;
  redeemed_at: string;
}

// GET /analytics/voucher-redemptions/log is the row-level counterpart to
// the aggregate-only /analytics/voucher-redemptions this domain already
// had -- see backend/app/domains/analytics/router.py's own docstring on
// that endpoint. Same 100-row-page/has_next pagination discipline as
// fetchRealSessions above (MAX_REPORT_PAGES/SESSIONS_PAGE_SIZE), same
// reason: one real customer's full date range shouldn't need an unbounded
// single request.
async function fetchRealVoucherRedemptions(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
  sort: "recent" | "most_used",
): Promise<RealVoucherRedemption[]> {
  const all: RealVoucherRedemption[] = [];
  for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
    const { data } = await api.get<{ items: RealVoucherRedemption[]; has_next?: boolean }>(
      "/analytics/voucher-redemptions/log",
      {
        params: {
          location_id: locationId,
          start_date: new Date(from).toISOString(),
          end_date: new Date(new Date(to).getTime() + 86400000).toISOString(),
          page,
          page_size: SESSIONS_PAGE_SIZE,
          sort,
        },
        headers: { "X-Organization-Id": orgId },
      },
    );
    all.push(...(data?.items ?? []));
    if (!data?.has_next) break;
  }
  return all;
}

async function realVoucherRedemptionLog(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const redemptions = await fetchRealVoucherRedemptions(orgId, locationId, from, to, "recent");
  return redemptions.map((r, i) => ({
    rank: i + 1,
    code: r.code,
    batch: r.batch_name,
    value: r.plan_name ?? "—",
    redeemedBy: r.redeemed_identifier,
    redeemedAt: r.redeemed_at,
  }));
}

// "(This Month)" per TOP_VOUCHERS's own label -- there's no date picker for
// this report type (not in NEEDS_RANGE), so the window is computed here,
// not taken from `from`/`to` state (which stay empty for this reportType).
function currentMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

const TOP_VOUCHERS_LIMIT = 10;

async function realTopRedeemedVouchers(orgId: string, locationId: string): Promise<Row[]> {
  const { from, to } = currentMonthBounds();
  const redemptions = await fetchRealVoucherRedemptions(orgId, locationId, from, to, "most_used");
  return redemptions.slice(0, TOP_VOUCHERS_LIMIT).map((r, i) => ({
    rank: i + 1,
    code: r.code,
    redeemedBy: r.redeemed_identifier,
    value: r.plan_name ?? "—",
    redeemedAt: r.redeemed_at,
  }));
}

/** "Voucher Batch Redemption Rate" -- per-batch issued-vs-redeemed rollup,
 * built from the same voucherService.listBatches()/getStats() the real
 * Vouchers tab already calls (voucher.service.ts), not a new fetch path.
 *
 * GET /voucher-batches has no server-side `location_id` filter (backend/
 * app/domains/voucher/router.py's own `list_voucher_batches`), so batches
 * are paged in full for the org (has_next, same discipline as
 * fetchRealGuestsById/fetchRealSessions above) and filtered client-side on
 * `batch.locationId`. There's also no server-side date filter, so batches
 * are further filtered client-side to `createdAt` falling within the
 * picked [from, to) window -- "voucher-batch" is in NEEDS_RANGE, so its
 * date pickers are real controls here, not dead ones, using the same
 * day-window math as fetchRealSessions.
 *
 * "Redeemed" is deliberately `stats.total - stats.unused`, mirroring the
 * backend's own `redemption_rate` calculation exactly
 * (VoucherService.get_batch_stats, voucher/service.py: `redeemed = total -
 * unused; redemption_rate = redeemed / total`) rather than a different
 * bucket. VoucherStatus.ACTIVE means "redeemed at least once, uses
 * remaining" (voucher/constants.py's own docstring) -- not "never
 * redeemed" -- so `unused` is the only status that means "not yet
 * redeemed"; active/exhausted/expired/revoked all already happened via at
 * least one real redemption. This also keeps the displayed "Redeemed"
 * count numerically consistent with the displayed "Redemption Rate" --
 * both derive from the same total-minus-unused delta the backend already
 * computes, rather than two independently-guessed numbers that could
 * disagree.
 *
 * Per-batch stats fetches run independently (Promise.allSettled, like
 * realDataByLocation above); a batch whose stats call fails is dropped
 * from the result rather than shown with a fabricated 0% rate. */
async function realVoucherBatchRate(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const allBatches: VoucherBatch[] = [];
  for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
    const { rows: batchRows, hasNext } = await voucherService.listBatches(
      page,
      SESSIONS_PAGE_SIZE,
      orgId,
    );
    allBatches.push(...batchRows);
    if (!hasNext) break;
  }
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime() + 86400000; // inclusive end-of-day, same [from, to) convention as fetchRealSessions
  const matching = allBatches.filter((b) => {
    if (b.locationId !== locationId) return false;
    const createdMs = new Date(b.createdAt).getTime();
    return createdMs >= fromMs && createdMs < toMs;
  });
  const settled = await Promise.allSettled(
    matching.map((b) => voucherService.getStats(b.id, orgId)),
  );
  const rows: Row[] = [];
  matching.forEach((b, i) => {
    const result = settled[i];
    if (result.status !== "fulfilled") return;
    const stats = result.value;
    const redeemed = stats.total - stats.unused;
    rows.push({
      batch: b.name,
      generated: stats.total,
      redeemed,
      expired: stats.expired,
      rate: `${Math.round(stats.redemptionRate * 100)}%`,
    });
  });
  return rows;
}

interface RealGuestLoginAttempt {
  identifier: string;
  ip_address?: string | null;
  auth_method: string;
  success: boolean;
  failure_reason?: string | null;
  attempted_at: string;
}

// GET /guest-login-history -- confirmed missing from the real backend as of
// this report's own spec (docs/ipdr-logs-syslog-spec.md §7: "New endpoint
// needed, confirmed missing" -- GuestLoginHistory today is only consumed
// internally by analytics aggregates, e.g. OTP success rate, never listed
// through its own route). Written against that section's documented
// contract exactly -- same location_id/start_date/end_date/page/page_size
// query params and {items, has_next} response envelope as GET
// /guest-sessions, since a BE engineer is adding this endpoint in parallel.
// **Assumption flagged in this feature's PR**: if the shipped endpoint's
// param names or response shape differ from this contract, this function is
// the only place that needs to change. Same 100-row-page/has_next
// pagination discipline as fetchRealSessions/fetchRealVoucherRedemptions.
async function fetchRealLoginHistory(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<RealGuestLoginAttempt[]> {
  const all: RealGuestLoginAttempt[] = [];
  for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
    const { data } = await api.get<{ items: RealGuestLoginAttempt[]; has_next?: boolean }>(
      "/guest-login-history",
      {
        params: {
          location_id: locationId,
          start_date: new Date(from).toISOString(),
          end_date: new Date(new Date(to).getTime() + 86400000).toISOString(),
          page,
          page_size: SESSIONS_PAGE_SIZE,
        },
        headers: { "X-Organization-Id": orgId },
      },
    );
    all.push(...(data?.items ?? []));
    if (!data?.has_next) break;
  }
  return all;
}

/** "Login/Access Attempt Log" -- one row per real GuestLoginHistory entry,
 * newest first. Captures failed-access attempts the session log alone
 * wouldn't show -- the security angle docs/ipdr-logs-syslog-spec.md §5
 * calls out (repeated failed logins from one IP/identifier). */
async function realLoginAccessLog(
  orgId: string,
  locationId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const attempts = await fetchRealLoginHistory(orgId, locationId, from, to);
  return attempts
    .slice()
    .sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime())
    .map((a, i) => ({
      rank: i + 1,
      identifier: a.identifier,
      ip: a.ip_address ?? null,
      authMethod: a.auth_method,
      status: a.success ? "Success" : "Failed",
      failureReason: a.failure_reason ?? null,
      attemptedAt: a.attempted_at,
    }));
}

// ── one reusable panel: business unit + report-type picker + date range + results table ──
/** `masked` is the current viewer's data-masking state -- the owner's own
 * (always-on, see CustomerHeader's read-only OtpMaskToggle) or, when this
 * page renders inside the `/agent` staff-preview dashboard via
 * `renderFeature`, the previewed agent's real per-agent `dataMasking` flag
 * (AgentsPage.tsx's "Data masking" switch). Defaults to `true` so any other
 * caller keeps the safer-by-default behavior every other guest-PII view in
 * this app already follows. */
export function ReportPanel({
  reportTypes,
  csvPrefix,
  masked = true,
}: {
  reportTypes: ReportType[];
  csvPrefix: string;
  masked?: boolean;
}) {
  // UNITS ("Marina Bay Hotel" etc.) is demo-only seed data -- a real
  // customer only has their own real locations, same real-vs-demo split
  // WhiteList.tsx/TicketsPage.tsx already use for their own "Business
  // Unit" pickers.
  const demo = useIsDemo();
  const { data: customerLocations } = useCustomerLocations();
  const realUnits = useMemo(
    () => (customerLocations ?? []).map((l) => l.name),
    [customerLocations],
  );
  const locationsByName = useMemo(
    () => new Map((customerLocations ?? []).map((l) => [l.name, l])),
    [customerLocations],
  );
  const units = demo ? UNITS : realUnits;

  const [bu, setBu] = useState("");
  const [reportType, setReportType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [team, setTeam] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [ratePerGb, setRatePerGb] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboFilter, setComboFilter] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const comboRef = useRef<HTMLDivElement>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [searchTxt, setSearchTxt] = useState("");
  const [sortKey, setSortKey] = useState<string>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const runCount = useRef(0);

  // Reset all per-report state when the category (and therefore its report list) changes.
  useEffect(() => {
    setBu("");
    setReportType("");
    setFrom("");
    setTo("");
    setSingleDate("");
    setTeam("");
    setCampaignType("");
    setRatePerGb("");
    setErrs({});
    setRows(null);
    setUnavailable(null);
    setSearchTxt("");
    setPage(0);
  }, [reportTypes]);

  const rt = reportTypes.find((r) => r.id === reportType);
  const needsRange = NEEDS_RANGE.has(reportType);
  const needsSingle = NEEDS_SINGLE.has(reportType);
  const needsTeam = NEEDS_TEAM.has(reportType);
  const needsCampaignType = NEEDS_CAMPAIGN_TYPE.has(reportType);
  const needsRate = NEEDS_RATE.has(reportType);

  const filteredCombos = useMemo(() => {
    const q = comboFilter.toLowerCase();
    return reportTypes.filter(
      (r) => r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q),
    );
  }, [comboFilter, reportTypes]);

  const setQuick = (days: number) => {
    const toD = new Date();
    const fromD = new Date(Date.now() - days * 86400000);
    setFrom(fromD.toISOString().slice(0, 10));
    setTo(toD.toISOString().slice(0, 10));
  };

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(0);
  };

  const cols = reportType ? COLUMNS[reportType] || [] : [];

  // Defined ahead of sortedRows below (rather than where fmtCell used to
  // sit, right before the JSX that renders each cell) because the filter
  // predicate now needs it too -- see that comment for why. useCallback'd
  // (keyed only on `masked`, its one external input) so it stays a stable
  // reference across renders, same as `cols`/`rows` already are, instead of
  // busting sortedRows' memoization on every render once it's a dependency.
  const fmtCell = useCallback(
    (key: string, val: string | number | null): string => {
      if (val == null) return "—";
      // "identifier" (Login/Access Attempt Log) is the same shape of
      // guest-self-reported free text as "redeemedBy" (phone/email, no
      // server-side shape validation -- see login_via_otp/login_via_voucher's
      // shared `normalize_identifier`), so it's masked and formula-injection
      // -neutralized the same way.
      if (key === "redeemedBy" || key === "identifier")
        return masked ? maskRedeemedIdentifier(String(val)) : String(val);
      if (PHONE_COLUMNS.has(key)) return masked ? maskPhone(String(val)) : String(val);
      // "mac" (Guest Session Log) always routes through maskMac, matching
      // every other MAC display in this app (WhiteList.tsx, CustomerFeaturePage
      // .tsx's Devices table) -- currently a deliberate no-op (see maskMac's
      // own doc comment: customers/compliance need the real address), called
      // explicitly rather than skipped so a future policy change here applies
      // automatically.
      if (key === "mac") return maskMac(String(val));
      // "ip" (Guest Session Log, Login/Access Attempt Log) is intentionally
      // never masked -- see COLUMNS["guest-session-log"]'s own doc comment
      // just above: this report's reason to exist is showing real IP-to-guest
      // mapping.
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
      if (["data", "totalData", "avgPerUser", "avgPerMember", "bytesUp", "bytesDown"].includes(key))
        return fmtBytes(+val);
      if (key === "duration") return fmtDur(+val);
      if (
        [
          "sessionStart",
          "sessionEnd",
          "firstSeen",
          "lastSeen",
          "redeemedAt",
          "sentAt",
          "attemptedAt",
        ].includes(key)
      )
        return fmtDT(String(val));
      return String(val);
    },
    [masked],
  );

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    const q = searchTxt.toLowerCase();
    // Filter against the same masked/formatted strings the table actually
    // renders (fmtCell), NOT the raw Row values. Matching raw values let
    // the filter box work as a confirmation oracle with masking ON: typing
    // a guessed phone number/email/identifier surfaced (and kept visible)
    // any row whose *raw* value matched, de-anonymizing that field -- and,
    // since a row's other columns stay visible alongside it, positionally
    // correlating every other still-masked-looking field on that row too.
    // Routing through fmtCell means a query only matches what masking
    // actually left on screen, same as a sighted user manually scanning
    // the table would see.
    let filtered = q
      ? rows.filter((r) =>
          cols.some((c) =>
            fmtCell(c.key, r[c.key] ?? null)
              .toLowerCase()
              .includes(q),
          ),
        )
      : rows;
    const col = cols.find((c) => c.key === sortKey);
    if (col) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (col.sortType === "number") return sortDir === "asc" ? +av - +bv : +bv - +av;
        if (col.sortType === "date")
          return sortDir === "asc"
            ? new Date(String(av)).getTime() - new Date(String(bv)).getTime()
            : new Date(String(bv)).getTime() - new Date(String(av)).getTime();
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return filtered;
  }, [rows, searchTxt, sortKey, sortDir, cols, fmtCell]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sortedRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleRun = useCallback(async () => {
    const e: Record<string, string> = {};
    if (!bu) e.bu = "Select a business unit.";
    if (!reportType) e.reportType = "Select a report type.";
    if (needsRange) {
      if (!from) e.from = "Required.";
      if (!to) e.to = "Required.";
      if (from && to && to < from) e.to = "End must be after start.";
      if (from && to && (new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 90)
        e.to = "Pick a range of 90 days or less.";
    }
    if (needsSingle && !singleDate) e.singleDate = "Required.";
    if (needsTeam && !team) e.team = "Select a team.";
    if (needsCampaignType && !campaignType) e.campaignType = "Select a campaign type.";
    if (needsRate && ratePerGb && parseFloat(ratePerGb) < 0)
      e.ratePerGb = "Rate can't be negative.";
    if (from > today()) e.from = "Pick today's date or earlier.";
    if (to > today()) e.to = "Pick today's date or earlier.";
    if (singleDate > today()) e.singleDate = "Pick today's date or earlier.";
    setErrs(e);
    if (Object.keys(e).length) return;

    runCount.current += 1;
    const mark = runCount.current;
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
        const loc = locationsByName.get(bu);
        if (reportType === "data-consumption") {
          data = loc ? await realDataConsumption(orgId, loc.id, from, to, rate) : [];
        } else if (reportType === "voucher-usage") {
          data = loc ? await realVoucherRedemptionLog(orgId, loc.id, from, to) : [];
        } else if (reportType === "top-vouchers") {
          data = loc ? await realTopRedeemedVouchers(orgId, loc.id) : [];
        } else if (reportType === "user-data") {
          data = loc ? await realUserData(orgId, loc.id, from, to) : [];
        } else if (reportType === "user-sessions") {
          data = loc ? await realUserSessions(orgId, loc.id, from, to) : [];
        } else if (reportType === "user-presence") {
          data = loc ? await realUserPresence(orgId, loc.id, singleDate) : [];
        } else if (reportType === "top-users") {
          data = loc ? await realTopUsers(orgId, loc.id) : [];
        } else if (reportType === "daywise-data") {
          data = loc ? await realDaywiseData(orgId, loc.id, from, to) : [];
        } else if (reportType === "daywise-unique") {
          data = loc ? await realDaywiseUnique(orgId, loc.id, from, to) : [];
        } else if (reportType === "voucher-batch") {
          data = loc ? await realVoucherBatchRate(orgId, loc.id, from, to) : [];
        } else if (reportType === "guest-session-log") {
          data = loc ? await realGuestSessionLog(orgId, loc.id, from, to) : [];
        } else if (reportType === "login-access-log") {
          data = loc ? await realLoginAccessLog(orgId, loc.id, from, to) : [];
        } else {
          data = await realDataByLocation(orgId, customerLocations ?? [], from, to, rate);
        }
      } else {
        reason =
          UNAVAILABLE_REASON[reportType] ?? "This report isn't available for real accounts yet.";
      }
    } catch {
      reason = "Could not load this report -- check the connection and try again.";
    }
    if (mark !== runCount.current) return;
    setRows(data);
    setUnavailable(reason);
    setRunning(false);
    setPage(0);
    setSearchTxt("");
  }, [
    demo,
    bu,
    reportType,
    from,
    to,
    singleDate,
    team,
    campaignType,
    ratePerGb,
    needsRange,
    needsSingle,
    needsTeam,
    needsCampaignType,
    needsRate,
    locationsByName,
    customerLocations,
  ]);

  // Real batch/plan names (VoucherBatch.name etc.) are free text a
  // customer typed -- e.g. "Front Desk, Lobby" -- so a plain unquoted
  // `.join(",")` misaligns every column in the exported file from that row
  // on when opened in Excel/Sheets. Quote every field and escape embedded
  // quotes/newlines per RFC 4180, same as any real CSV writer would;
  // mock/demo data never exercises this (fixed values, no commas) which is
  // why it went unnoticed there.
  //
  // Every field passed through here also gets CSV/Excel formula-injection
  // neutralized (see CSV_FORMULA_TRIGGER_RE above) -- not just
  // `redeemedBy`. This function wraps every column of every exported row
  // (see exportCsv below: `cols.map((c) => csvField(fmtCell(...)))`), so a
  // guest-controlled free-text column starting with =, +, -, or @ --
  // `redeemed_identifier` (Voucher Redemption reports) or `display_name`
  // (Guest Activity reports, now wired to real guest identity) -- is
  // caught here regardless of which column it lands in, and regardless of
  // whether masking is on (fmtCell's masked output for an unclassifiable
  // identifier can still start with a trigger character -- see
  // maskRedeemedIdentifier above -- so this check runs on the
  // already-masked value, not just the raw one). A leading single quote is
  // the standard mitigation: Excel/Sheets render the cell as plain text
  // from the character after it, so a legitimate value is unaffected and
  // exports byte-for-byte as displayed.
  const csvField = (val: string): string => {
    const safe = CSV_FORMULA_TRIGGER_RE.test(val) ? `'${val}` : val;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const exportCsv = () => {
    if (!rows || !rows.length) return;
    const header = cols.map((c) => csvField(c.label)).join(",") + "\n";
    const data = sortedRows
      .map((r) => cols.map((c) => csvField(fmtCell(c.key, r[c.key] ?? null))).join(","))
      .join("\n");
    const blob = new Blob([header + data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvPrefix}-${reportType}-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Both print and "download PDF" hand off to the browser's print dialog --
  // every major browser offers "Save as PDF" as a destination there, so this
  // covers both without pulling in a PDF-generation dependency.
  const handlePrint = () => window.print();

  useEffect(() => {
    if (!comboboxOpen) return;
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboboxOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [comboboxOpen]);

  const Err = ({ k }: { k: string }) =>
    errs[k] ? <p className="mt-1 text-xs text-destructive">{errs[k]}</p> : null;

  return (
    <>
      <div className="print:hidden rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ur-bu" className={labelCls}>
              Business Unit <span className="text-destructive">*</span>
            </label>
            <select
              id="ur-bu"
              value={bu}
              onChange={(e) => {
                setBu(e.target.value);
                setRows(null);
                setErrs((p) => {
                  const n = { ...p };
                  delete n.bu;
                  return n;
                });
              }}
              className={inputCls}
            >
              <option value="">Choose business unit</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <Err k="bu" />
          </div>

          <div ref={comboRef} className="relative">
            <label className={labelCls}>
              Report Type <span className="text-destructive">*</span>
            </label>
            <button
              type="button"
              role="combobox"
              aria-expanded={comboboxOpen}
              aria-haspopup="listbox"
              onClick={() => setComboboxOpen(!comboboxOpen)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  setComboboxOpen(true);
                }
                if (e.key === "Escape") setComboboxOpen(false);
              }}
              className={cn(
                inputCls,
                "flex items-center justify-between",
                comboboxOpen && "border-primary ring-2 ring-primary/15",
              )}
            >
              <span className={rt ? "text-foreground" : "text-muted-foreground"}>
                {rt ? rt.label : "Choose report type"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${comboboxOpen ? "rotate-180" : ""}`}
              />
            </button>
            <Err k="reportType" />
            {comboboxOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border bg-popover shadow-lg">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Filter reports…"
                    value={comboFilter}
                    onChange={(e) => {
                      setComboFilter(e.target.value);
                      setActiveIdx(0);
                    }}
                    className={inputCls}
                    autoFocus
                  />
                </div>
                <ul role="listbox" className="max-h-60 overflow-y-auto pb-1">
                  {filteredCombos.length === 0 ? (
                    <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No report matches that.
                    </li>
                  ) : (
                    filteredCombos.map((r, i) => (
                      <li
                        key={r.id}
                        role="option"
                        aria-selected={r.id === reportType}
                        className={cn(
                          "cursor-pointer rounded-lg mx-1 px-3 py-2 transition-colors",
                          i === activeIdx || r.id === reportType
                            ? "bg-primary/10"
                            : "hover:bg-accent",
                        )}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => {
                          setReportType(r.id);
                          setComboboxOpen(false);
                          setRows(null);
                          setComboFilter("");
                          setErrs((p) => {
                            const n = { ...p };
                            delete n.reportType;
                            return n;
                          });
                        }}
                      >
                        <p className="text-sm font-medium text-foreground">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {reportType && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {needsTeam && (
              <div>
                <label htmlFor="ur-team" className={labelCls}>
                  Team <span className="text-destructive">*</span>
                </label>
                <select
                  id="ur-team"
                  value={team}
                  onChange={(e) => {
                    setTeam(e.target.value);
                    setErrs((p) => {
                      const n = { ...p };
                      delete n.team;
                      return n;
                    });
                  }}
                  className={inputCls}
                >
                  <option value="">Choose team</option>
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Err k="team" />
              </div>
            )}
            {needsCampaignType && (
              <div>
                <label htmlFor="ur-ct" className={labelCls}>
                  Campaign Type <span className="text-destructive">*</span>
                </label>
                <select
                  id="ur-ct"
                  value={campaignType}
                  onChange={(e) => {
                    setCampaignType(e.target.value);
                    setRows(null);
                    setErrs((p) => {
                      const n = { ...p };
                      delete n.campaignType;
                      return n;
                    });
                  }}
                  className={inputCls}
                >
                  <option value="">Choose campaign type</option>
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Err k="campaignType" />
              </div>
            )}
            {needsRate && (
              <div>
                <label htmlFor="ur-rate" className={labelCls}>
                  Rate Per GB{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional, ₹)</span>
                </label>
                <input
                  id="ur-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 40"
                  value={ratePerGb}
                  onChange={(e) => {
                    setRatePerGb(e.target.value);
                    setRows(null);
                    setErrs((p) => {
                      const n = { ...p };
                      delete n.ratePerGb;
                      return n;
                    });
                  }}
                  className={inputCls}
                />
                <Err k="ratePerGb" />
              </div>
            )}
            {needsSingle && (
              <div>
                <label htmlFor="ur-sd" className={labelCls}>
                  Date <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    id="ur-sd"
                    type="date"
                    value={singleDate}
                    onChange={(e) => {
                      setSingleDate(e.target.value);
                      setRows(null);
                      setErrs((p) => {
                        const n = { ...p };
                        delete n.singleDate;
                        return n;
                      });
                    }}
                    max={today()}
                    className={cn(inputCls, "pr-9")}
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Err k="singleDate" />
              </div>
            )}
            {needsRange && (
              <>
                <div>
                  <label htmlFor="ur-fr" className={labelCls}>
                    From <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="ur-fr"
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setRows(null);
                        setErrs((p) => {
                          const n = { ...p };
                          delete n.from;
                          return n;
                        });
                      }}
                      max={today()}
                      className={cn(inputCls, "pr-9")}
                    />
                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <Err k="from" />
                </div>
                <div>
                  <label htmlFor="ur-to" className={labelCls}>
                    To <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="ur-to"
                      type="date"
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setRows(null);
                        setErrs((p) => {
                          const n = { ...p };
                          delete n.to;
                          return n;
                        });
                      }}
                      max={today()}
                      className={cn(inputCls, "pr-9")}
                    />
                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <Err k="to" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xs text-muted-foreground">Quick: </span>
                  {[
                    ["Last 7 days", 7],
                    ["Last 30 days", 30],
                  ].map(([label, days]) => (
                    <button
                      key={label}
                      onClick={() => setQuick(days as number)}
                      className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const d = new Date();
                      setFrom(
                        new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10),
                      );
                      setTo(d.toISOString().slice(0, 10));
                    }}
                    className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    This month
                  </button>
                </div>
              </>
            )}
            {(reportType === "top-users" ||
              reportType === "top-vouchers" ||
              reportType === "top-campaigns") && (
              <p className="text-xs text-muted-foreground md:col-span-2">
                This report always covers the current month.
              </p>
            )}
          </div>
        )}

        <hr className="my-6 border-border" />
        <div className="flex justify-center">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {running ? "Running…" : "Search"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {rows === null && !running && (
          <EmptyState
            icon={FileBarChart}
            title="No report run yet"
            description="Choose a report type and press Search to see results."
          />
        )}
        {running && <LoadingSkeleton rows={5} />}
        {!running && rows !== null && rows.length === 0 && unavailable && (
          <EmptyState icon={Info} title="Not available yet" description={unavailable} />
        )}
        {!running && rows !== null && rows.length === 0 && !unavailable && (
          <EmptyState
            icon={FileBarChart}
            title="No data for this report"
            description="Try a wider date range or a different location."
          />
        )}
        {!running && rows && rows.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="print:hidden flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-sm">{rt?.label}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {bu} ·{" "}
                  {needsRange ? `${from} to ${to}` : needsSingle ? singleDate : "Current month"} ·{" "}
                  {sortedRows.length} rows
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={searchTxt}
                    onChange={(e) => {
                      setSearchTxt(e.target.value);
                      setPage(0);
                    }}
                    className={cn(inputCls, "w-40 py-1.5 pl-8")}
                  />
                </div>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="hidden print:block mb-4">
                <h3 className="text-base font-semibold tracking-tight">{rt?.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {bu} ·{" "}
                  {needsRange ? `${from} to ${to}` : needsSingle ? singleDate : "Current month"} ·{" "}
                  {sortedRows.length} rows
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      {cols.map((c) => {
                        const active = sortKey === c.key;
                        return (
                          <TableHead
                            key={c.key}
                            className={cn(
                              "text-xs font-medium uppercase tracking-wide cursor-pointer select-none print:cursor-default",
                              c.key === "rank" && "w-8",
                            )}
                            onClick={() => toggleSort(c.key)}
                            aria-sort={
                              active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                            }
                          >
                            <span className="inline-flex items-center gap-1">
                              {c.label}
                              {active ? (
                                <ChevronUp className="h-3 w-3 text-primary print:hidden" />
                              ) : null}
                            </span>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((r, i) => (
                      <TableRow key={i} className="border-b">
                        {cols.map((c) => (
                          <TableCell key={c.key} className="text-xs text-foreground">
                            {fmtCell(c.key, r[c.key] ?? null)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {sortedRows.length > 0 && (
                <div className="print:hidden mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing {safePage * PAGE_SIZE + 1}–
                    {Math.min((safePage + 1) * PAGE_SIZE, sortedRows.length)} of {sortedRows.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={safePage === 0}
                      onClick={() => setPage(safePage - 1)}
                      className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      disabled={safePage >= totalPages - 1}
                      onClick={() => setPage(safePage + 1)}
                      className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
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
  "Campaign Engagement Report": {
    reportTypes: CAMPAIGN_REPORT_TYPES,
    csvPrefix: "campaign-report",
  },
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
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <FileBarChart className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
              Your data, on demand
            </p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Reports
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Run and export usage, voucher, campaign, data, and SMS reports.
            </p>
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
        {/* whitespace-nowrap: the container already opts into horizontal
            scroll (overflow-x-auto) for narrow viewports, but without this
            each button's own text wrapped instead of the row scrolling --
            on the longer labels ("Campaign Engagement Report") that meant
            three ragged text lines and a much taller tab bar even on a
            full-width desktop viewport, well before scrolling was ever
            needed. flex-1's default min-width:auto already keeps a
            nowrap'd button from shrinking below its own text, so this
            alone is enough to fall back to the intended scroll. */}
        <div className="flex min-w-[500px] gap-1">
          {CATEGORIES.map((label) => {
            const active = label === category;
            return (
              <button
                key={label}
                onClick={() => setCategory(label)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-[#4f46e5] shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
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
