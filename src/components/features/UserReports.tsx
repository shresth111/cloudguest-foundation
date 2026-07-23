import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Calendar, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Loader2, FileBarChart, Download,
} from "lucide-react";

const CATEGORIES = ["User Report", "Voucher Report", "Campaign Report", "Data Report", "OTP SMS Report"] as const;
type Category = (typeof CATEGORIES)[number];

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const TEAMS = ["Sales Team", "Executive VIP", "Contractors", "Maintenance Staff"];

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
const NAMES = ["Ravi Sharma", "Priya Kapoor", "Amit Patel", "Sana Khan", "John Doe", "Meera Nair", "Vikram Singh", "Ananya Reddy", "Arun Kumar", "Neha Gupta", "Rohan Desai", "Kavita Joshi"];
const phone = (i: number) => `+9198${String(70000000 + i * 1111111).slice(0, 10)}`;

// ── report catalogs, one per category ──────────────────────────────
const USER_REPORT_TYPES: ReportType[] = [
  { id: "user-data", label: "User Data Consumption By Date Range", desc: "How much data each user pulled over a chosen period." },
  { id: "user-sessions", label: "User Sessions By Date Range", desc: "Every login session with start, end and duration." },
  { id: "user-presence", label: "Detailed User Presence Report (24 Hour Report)", desc: "Hour-by-hour presence for a single day." },
  { id: "top-users", label: "Top 10 Users For The Current Month", desc: "The heaviest data users this month." },
  { id: "daywise-data", label: "Day Wise User Data Consumption", desc: "Daily data totals across the period." },
  { id: "daywise-unique", label: "Day Wise Unique Users & Devices Count", desc: "Distinct users and devices seen each day." },
  { id: "team-report", label: "User Team Report", desc: "Usage rolled up by group or team." },
];
const VOUCHER_REPORT_TYPES: ReportType[] = [
  { id: "voucher-usage", label: "Voucher Usage By Date Range", desc: "Every voucher redeemed, by whom and when." },
  { id: "voucher-batch", label: "Batch-Wise Voucher Summary", desc: "Redemption rate for each generated batch." },
  { id: "top-vouchers", label: "Top Redeemed Vouchers This Month", desc: "The most-used vouchers this month." },
];
const CAMPAIGN_REPORT_TYPES: ReportType[] = [
  { id: "campaign-performance", label: "Campaign Performance By Date Range", desc: "Sent, delivered, opened and clicked per campaign." },
  { id: "campaign-daywise", label: "Day Wise Campaign Engagement", desc: "Daily send/deliver/open totals across the period." },
  { id: "top-campaigns", label: "Top Campaigns This Month", desc: "Best-performing campaigns by click-through rate." },
];
const DATA_REPORT_TYPES: ReportType[] = [
  { id: "data-consumption", label: "Network Data Consumption By Date Range", desc: "Upload/download totals and peak throughput per day." },
  { id: "data-by-location", label: "Data Usage By Business Unit", desc: "Total and average data usage broken down by location." },
];
const SMS_REPORT_TYPES: ReportType[] = [
  { id: "otp-delivery", label: "OTP Delivery Report By Date Range", desc: "Every OTP sent, its delivery status and latency." },
  { id: "sms-daywise", label: "Day Wise SMS Delivery Summary", desc: "Daily sent/delivered/failed totals across the period." },
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

  "campaign-performance": [{ key: "rank", label: "#", sortType: "number" }, { key: "campaign", label: "Campaign", sortType: "string" }, { key: "sent", label: "Sent", sortType: "number" }, { key: "delivered", label: "Delivered", sortType: "number" }, { key: "opened", label: "Opened", sortType: "number" }, { key: "clicked", label: "Clicked", sortType: "number" }, { key: "ctr", label: "CTR", sortType: "string" }],
  "campaign-daywise": [{ key: "date", label: "Date", sortType: "date" }, { key: "sent", label: "Sent", sortType: "number" }, { key: "delivered", label: "Delivered", sortType: "number" }, { key: "opened", label: "Opened", sortType: "number" }],
  "top-campaigns": [{ key: "rank", label: "Rank", sortType: "number" }, { key: "campaign", label: "Campaign", sortType: "string" }, { key: "reach", label: "Reach", sortType: "number" }, { key: "ctr", label: "CTR", sortType: "string" }],

  "data-consumption": [{ key: "date", label: "Date", sortType: "date" }, { key: "uploadGB", label: "Upload", sortType: "number" }, { key: "downloadGB", label: "Download", sortType: "number" }, { key: "totalGB", label: "Total", sortType: "number" }, { key: "peakMbps", label: "Peak Throughput", sortType: "number" }],
  "data-by-location": [{ key: "businessUnit", label: "Business Unit", sortType: "string" }, { key: "totalData", label: "Total Data", sortType: "number" }, { key: "avgPerUser", label: "Avg Per User", sortType: "number" }, { key: "peakHour", label: "Peak Hour", sortType: "string" }],

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

function mockRow(reportType: string, i: number, count: number): Row {
  const r: Row = { rank: i + 1 };
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

    case "campaign-performance": { const sent = Math.floor(Math.random() * 5000) + 500; const delivered = Math.floor(sent * (0.9 + Math.random() * 0.09)); const opened = Math.floor(delivered * Math.random() * 0.6); const clicked = Math.floor(opened * Math.random() * 0.4); r.campaign = ["Welcome Back Offer", "Weekend Special", "New Menu Launch", "Loyalty Reward"][i % 4]; r.sent = sent; r.delivered = delivered; r.opened = opened; r.clicked = clicked; r.ctr = `${((clicked / sent) * 100).toFixed(1)}%`; break; }
    case "campaign-daywise": { const sent = Math.floor(Math.random() * 800) + 100; r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.sent = sent; r.delivered = Math.floor(sent * 0.95); r.opened = Math.floor(sent * Math.random() * 0.5); break; }
    case "top-campaigns": { const reach = Math.floor(Math.random() * 8000) + 1000; r.campaign = ["Welcome Back Offer", "Weekend Special", "New Menu Launch"][i % 3]; r.reach = reach; r.ctr = `${(Math.random() * 12 + 2).toFixed(1)}%`; break; }

    case "data-consumption": { const up = Math.random() * 40 + 5; const down = Math.random() * 200 + 40; r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.uploadGB = up; r.downloadGB = down; r.totalGB = up + down; r.peakMbps = Math.random() * 400 + 50; break; }
    case "data-by-location": r.businessUnit = UNITS[i % UNITS.length]; r.totalData = Math.random() * 50000 + 5000; r.avgPerUser = Math.random() * 2000 + 200; r.peakHour = `${(Math.floor(Math.random() * 12) + 8)}:00`; break;

    case "otp-delivery": r.mobile = phone(i); r.sentAt = new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(); r.status = Math.random() > 0.08 ? "Delivered" : "Failed"; r.latencyMs = Math.floor(Math.random() * 4000) + 300; break;
    case "sms-daywise": { const sent = Math.floor(Math.random() * 1200) + 200; const failed = Math.floor(sent * Math.random() * 0.06); r.date = new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10); r.sent = sent; r.delivered = sent - failed; r.failed = failed; r.rate = `${(((sent - failed) / sent) * 100).toFixed(1)}%`; break; }
  }
  return r;
}

function mockRun(reportType: string): Promise<Row[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const count = reportType === "team-report" ? 4 : reportType === "top-users" || reportType === "top-vouchers" || reportType === "top-campaigns" ? 10 : reportType === "voucher-batch" ? 4 : reportType === "data-by-location" ? UNITS.length : Math.floor(Math.random() * 24) + 3;
      resolve(Array.from({ length: count }, (_, i) => mockRow(reportType, i, count)));
    }, 700);
  });
}

// ── one reusable panel: business unit + report-type picker + date range + results table ──
function ReportPanel({ reportTypes, csvPrefix }: { reportTypes: ReportType[]; csvPrefix: string }) {
  const [bu, setBu] = useState(""); const [reportType, setReportType] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [singleDate, setSingleDate] = useState(""); const [team, setTeam] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false); const [comboFilter, setComboFilter] = useState(""); const [activeIdx, setActiveIdx] = useState(0); const comboRef = useRef<HTMLDivElement>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false); const [rows, setRows] = useState<Row[] | null>(null);
  const [searchTxt, setSearchTxt] = useState(""); const [sortKey, setSortKey] = useState<string>("rank"); const [sortDir, setSortDir] = useState<"asc" | "desc">("asc"); const [page, setPage] = useState(0);
  const runCount = useRef(0);

  // Reset all per-report state when the category (and therefore its report list) changes.
  useEffect(() => {
    setBu(""); setReportType(""); setFrom(""); setTo(""); setSingleDate(""); setTeam("");
    setErrs({}); setRows(null); setSearchTxt(""); setPage(0);
  }, [reportTypes]);

  const rt = reportTypes.find((r) => r.id === reportType);
  const needsRange = NEEDS_RANGE.has(reportType);
  const needsSingle = NEEDS_SINGLE.has(reportType);
  const needsTeam = NEEDS_TEAM.has(reportType);

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
    if (["data", "totalData", "avgPerUser", "avgPerMember", "totalGB", "uploadGB", "downloadGB", "peakMbps"].includes(key)) return typeof val === "number" && ["totalGB", "uploadGB", "downloadGB", "peakMbps"].includes(key) ? `${val.toFixed(1)}${key === "peakMbps" ? " Mbps" : " GB"}` : fmtBytes(+val);
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
    if (from > today()) e.from = "Pick today's date or earlier."; if (to > today()) e.to = "Pick today's date or earlier."; if (singleDate > today()) e.singleDate = "Pick today's date or earlier.";
    setErrs(e); if (Object.keys(e).length) return;

    runCount.current += 1; const mark = runCount.current;
    setRunning(true);
    // TODO: replace with API call
    const data = await mockRun(reportType);
    if (mark !== runCount.current) return;
    setRows(data); setRunning(false); setPage(0); setSearchTxt("");
  }, [bu, reportType, from, to, singleDate, team, needsRange, needsSingle, needsTeam]);

  const exportCsv = () => {
    if (!rows || !rows.length) return;
    const header = cols.map((c) => c.label).join(",") + "\n";
    const data = sortedRows.map((r) => cols.map((c) => fmtCell(c.key, r[c.key] ?? null)).join(",")).join("\n");
    const blob = new Blob([header + data], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${csvPrefix}-${reportType}-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!comboboxOpen) return;
    const handler = (e: MouseEvent) => { if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboboxOpen(false); };
    document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler);
  }, [comboboxOpen]);

  const Err = ({ k }: { k: string }) => errs[k] ? <p className="mt-0.5 text-xs text-orange-500">{errs[k]}</p> : null;

  return (
    <>
      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <div className="mt-0 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ur-bu" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Business Unit <span className="text-orange-500">*</span></label>
            <select id="ur-bu" value={bu} onChange={(e) => { setBu(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.bu; return n; }); }} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"><option value="">Choose business unit</option>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            <Err k="bu" />
          </div>

          <div ref={comboRef} className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Report Type <span className="text-orange-500">*</span></label>
            <button type="button" role="combobox" aria-expanded={comboboxOpen} aria-haspopup="listbox" onClick={() => setComboboxOpen(!comboboxOpen)} onKeyDown={(e) => { if (e.key === "ArrowDown") { setComboboxOpen(true); } if (e.key === "Escape") setComboboxOpen(false); }} className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              <span className={rt ? "" : "text-slate-400"}>{rt ? rt.label : "Choose report type"}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${comboboxOpen ? "rotate-180" : ""}`} />
            </button>
            <Err k="reportType" />
            {comboboxOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                <div className="p-2"><input type="text" placeholder="Filter reports…" value={comboFilter} onChange={(e) => { setComboFilter(e.target.value); setActiveIdx(0); }} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" autoFocus /></div>
                <ul role="listbox" className="max-h-60 overflow-y-auto pb-1">
                  {filteredCombos.length === 0 ? <li className="px-3 py-4 text-center text-sm text-slate-400">No report matches that.</li> : filteredCombos.map((r, i) => (
                    <li key={r.id} role="option" aria-selected={r.id === reportType} className={`cursor-pointer px-3 py-2 transition-colors ${i === activeIdx ? "bg-orange-50 dark:bg-orange-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                      onMouseEnter={() => setActiveIdx(i)} onClick={() => { setReportType(r.id); setComboboxOpen(false); setRows(null); setComboFilter(""); setErrs((p) => { const n = { ...p }; delete n.reportType; return n; }); }}>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{r.desc}</p>
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
              <div><label htmlFor="ur-team" className="mb-1 block text-sm font-medium text-slate-600">Team <span className="text-orange-500">*</span></label>
              <select id="ur-team" value={team} onChange={(e) => { setTeam(e.target.value); setErrs((p) => { const n = { ...p }; delete n.team; return n; }); }} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"><option value="">Choose team</option>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}</select><Err k="team" /></div>
            )}
            {needsSingle && (
              <div><label htmlFor="ur-sd" className="mb-1 block text-sm font-medium text-slate-600">Date <span className="text-orange-500">*</span></label>
              <div className="relative"><input id="ur-sd" type="date" value={singleDate} onChange={(e) => { setSingleDate(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.singleDate; return n; }); }} max={today()} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div><Err k="singleDate" /></div>
            )}
            {needsRange && (
              <>
                <div><label htmlFor="ur-fr" className="mb-1 block text-sm font-medium text-slate-600">From <span className="text-orange-500">*</span></label>
                  <div className="relative"><input id="ur-fr" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.from; return n; }); }} max={today()} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div><Err k="from" /></div>
                <div><label htmlFor="ur-to" className="mb-1 block text-sm font-medium text-slate-600">To <span className="text-orange-500">*</span></label>
                  <div className="relative"><input id="ur-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setRows(null); setErrs((p) => { const n = { ...p }; delete n.to; return n; }); }} max={today()} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div><Err k="to" /></div>
                <div className="flex items-end gap-2"><span className="text-xs text-slate-400">Quick: </span><button onClick={() => setQuick(7)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">Last 7 days</button><button onClick={() => setQuick(30)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">Last 30 days</button><button onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10)); }} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">This month</button></div>
              </>
            )}
            {(reportType === "top-users" || reportType === "top-vouchers" || reportType === "top-campaigns") && <p className="text-xs text-slate-400 md:col-span-2">This report always covers the current month.</p>}
          </div>
        )}

        <hr className="my-5 border-slate-100 dark:border-slate-600" />
        <div className="flex justify-center">
          <button onClick={handleRun} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{running ? "Running…" : "Search"}
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {rows === null && !running && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><FileBarChart className="mb-3 h-10 w-10" /><p className="text-sm">Choose a report type and press Search to see results.</p></div>
        )}
        {running && <div className="space-y-3 animate-pulse">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-700" />)}</div>}
        {!running && rows !== null && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><p className="text-sm font-medium">No data for this report.</p><p className="mt-1 text-xs">Try a wider date range or a different location.</p></div>
        )}
        {!running && rows && rows.length > 0 && (
          <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{rt?.label}</h3><p className="text-xs text-slate-400">{bu} · {needsRange ? `${from} to ${to}` : needsSingle ? singleDate : "Current month"} · {sortedRows.length} rows</p></div>
              <div className="flex items-center gap-3"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Filter…" value={searchTxt} onChange={(e) => { setSearchTxt(e.target.value); setPage(0); }} className="w-40 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" /></div>
                <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"><Download className="h-4 w-4" />Export CSV</button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-600">{cols.map((c) => {
                  const active = sortKey === c.key;
                  return <th key={c.key} className={`pb-2 pr-3 cursor-pointer select-none ${c.key === "rank" ? "w-8" : ""}`} onClick={() => toggleSort(c.key)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <span className="inline-flex items-center gap-1">{c.label}{active ? <ChevronUp className="h-3 w-3 text-orange-500" /> : null}</span>
                  </th>;
                })}<th className="pb-2 text-right">Actions</th></tr></thead>
                <tbody>{paged.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 text-slate-700 last:border-0">
                    {cols.map((c) => (
                      <td key={c.key} className="py-2.5 pr-3 text-xs">{fmtCell(c.key, r[c.key] ?? null)}</td>
                    ))}
                    <td className="py-2.5 text-right"><button className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500" aria-label="View details"><ChevronRight className="h-4 w-4" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {sortedRows.length > 0 && <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sortedRows.length)} of {sortedRows.length}</span><div className="flex gap-1"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronLeft className="h-4 w-4" /></button><button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronRight className="h-4 w-4" /></button></div></div>}
          </div>
        )}
      </div>
    </>
  );
}

const CATEGORY_CONFIG: Record<Category, { reportTypes: ReportType[]; csvPrefix: string }> = {
  "User Report": { reportTypes: USER_REPORT_TYPES, csvPrefix: "user-report" },
  "Voucher Report": { reportTypes: VOUCHER_REPORT_TYPES, csvPrefix: "voucher-report" },
  "Campaign Report": { reportTypes: CAMPAIGN_REPORT_TYPES, csvPrefix: "campaign-report" },
  "Data Report": { reportTypes: DATA_REPORT_TYPES, csvPrefix: "data-report" },
  "OTP SMS Report": { reportTypes: SMS_REPORT_TYPES, csvPrefix: "sms-report" },
};

export default function UserReports() {
  const [category, setCategory] = useState<Category>("User Report");
  const cfg = CATEGORY_CONFIG[category];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Reports</h1>

      <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
        <div className="flex min-w-[500px]">
          {CATEGORIES.map((label) => {
            const active = label === category;
            return (
              <button key={label} onClick={() => setCategory(label)} aria-current={active ? "page" : undefined}
                className={`relative flex-1 border-r border-slate-200 px-3 py-2.5 text-center text-sm font-medium transition-colors last:border-r-0 dark:border-slate-600 ${
                  active ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-600 hover:bg-white dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}>
                {label}
                {active && <motion.span layoutId="report-tab-underline" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
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
          <ReportPanel reportTypes={cfg.reportTypes} csvPrefix={cfg.csvPrefix} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
