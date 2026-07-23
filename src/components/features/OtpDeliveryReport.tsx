import { useState, useRef, useCallback } from "react";
import { Search, Calendar, Download, Eye, EyeOff, Loader2 } from "lucide-react";

// ── helpers ─────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDT = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const today = () => new Date().toISOString().slice(0, 10);

const REPORTS = ["User Report", "Voucher Report", "Campaign Report", "Data Report", "OTP SMS Report"];

interface OtpRow {
  id: string;
  otp: string;
  sentAt: string;
  deliveredAt: string | null;
  latency: string | null;
  attempts: number;
  status: "Delivered" | "Pending" | "Failed" | "Expired";
  operatorResponse: string;
}

const OPERATOR_RESPONSES = [
  "Delivered to handset",
  "Absent subscriber",
  "Rejected — DND",
  "Awaiting DLR",
  "Invalid number",
  "Delivered to SMSC",
  "Queued for delivery",
  "Network error — retry",
];

const STATUSES: OtpRow["status"][] = ["Delivered", "Pending", "Failed", "Expired"];

// ── mock search ─────────────────────────────────────────────────
function mockSearch(mobile: string, _date: string): Promise<OtpRow[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 40 % chance of empty result
      if (Math.random() < 0.4) {
        resolve([]);
        return;
      }
      const count = Math.floor(Math.random() * 4) + 1;
      const rows: OtpRow[] = [];
      const base = new Date(`${_date}T10:00:00`);
      for (let i = 0; i < count; i++) {
        const sent = new Date(base.getTime() + i * 120_000 + Math.random() * 60_000);
        const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
        const delivered = status === "Delivered" || status === "Pending"
          ? new Date(sent.getTime() + 2_000 + Math.random() * 18_000)
          : null;
        const diff = delivered ? Math.round((delivered.getTime() - sent.getTime()) / 1000) : null;
        const lat = diff !== null
          ? (diff >= 60 ? `${Math.floor(diff / 60)}m ${diff % 60}s` : `${diff}s`)
          : null;
        rows.push({
          id: `otp-${i}`,
          otp: `${Math.floor(100000 + Math.random() * 900000)}`,
          sentAt: sent.toISOString(),
          deliveredAt: delivered?.toISOString() ?? null,
          latency: lat,
          attempts: Math.floor(Math.random() * 3) + 1,
          status,
          operatorResponse: OPERATOR_RESPONSES[Math.floor(Math.random() * OPERATOR_RESPONSES.length)],
        });
      }
      resolve(rows);
    }, 700);
  });
}

// ── component ────────────────────────────────────────────────────
interface Props {
  onNavigate?: (key: string) => void;
}

export default function OtpDeliveryReport({ onNavigate }: Props) {
  const [mobile, setMobile] = useState("");
  const [date, setDate] = useState(today());
  const [errs, setErrs] = useState<{ mobile?: string; date?: string }>({});
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<OtpRow[] | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const searchCount = useRef(0);

  const toggleReveal = (id: string) => {
    setRevealed((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleSearch = useCallback(async () => {
    const e: typeof errs = {};
    const cleaned = mobile.replace(/[\s\-\+]/g, "");
    if (!cleaned) e.mobile = "Enter the mobile number with country code.";
    else if (cleaned.length < 10 || cleaned.length > 15) e.mobile = "That doesn't look like a valid number.";
    if (!date) e.date = "Pick a date.";
    else if (date > today()) e.date = "Pick today's date or earlier.";
    setErrs(e);
    if (Object.keys(e).length) return;

    searchCount.current += 1;
    const mark = searchCount.current;
    setSearching(true);
    // TODO: replace with API call
    const data = await mockSearch(cleaned, date);
    if (mark !== searchCount.current) return; // stale
    setResults(data);
    setSearchedFor(`${cleaned} on ${pad2(parseInt(date.slice(8, 10)))}-${pad2(parseInt(date.slice(5, 7)))}-${date.slice(0, 4)}`);
    setSearching(false);
  }, [mobile, date]);

  const handleKeyDown = (ev: React.KeyboardEvent) => { if (ev.key === "Enter") handleSearch(); };

  const exportCsv = () => {
    if (!results || !results.length) return;
    const header = "OTP,Sent At,Delivered At,Latency,Attempts,Status,Operator Response\n";
    const rows = results.map(
      (r) =>
        `${r.otp},${fmtDT(r.sentAt)},${r.deliveredAt ? fmtDT(r.deliveredAt) : "—"},${r.latency ?? "—"},${r.attempts},${r.status},"${r.operatorResponse}"`,
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otp-report-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── helpers ─────────────────────────────────────────────────────
  const Err = ({ k }: { k: keyof typeof errs }) =>
    errs[k] ? <p className="mt-0.5 text-xs text-orange-500">{errs[k]}</p> : null;

  const statusPill = (s: OtpRow["status"]) => {
    const m: Record<string, string> = {
      Delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
      Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
      Failed: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
      Expired: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
    };
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${m[s] ?? m.Expired}`}>{s}</span>;
  };

  return (
    <div className="space-y-6">
      {/* title */}
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">OTP Delivery Report</h1>

      {/* tab bar */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
        <div className="flex min-w-[500px]">
          {REPORTS.map((label) => {
            const active = label === "OTP SMS Report";
            return (
              <button
                key={label}
                onClick={() => onNavigate?.(label)}
                className={`flex-1 border-r border-slate-200 px-3 py-2.5 text-center text-sm font-medium transition-colors last:border-r-0 dark:border-slate-600 ${
                  active
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* search card */}
      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Search OTP Delivery Report</h2>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          While logging into the Hotspot, OTPs are sometimes not delivered or arrive late because of the telecom operator. Track them here.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="otp-mobile" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Mobile No. <span className="text-orange-500">*</span>
            </label>
            <input
              id="otp-mobile"
              type="text"
              inputMode="numeric"
              placeholder="Mobile No. with country code"
              value={mobile}
              onChange={(e) => { setMobile(e.target.value); setErrs((p) => { const n = { ...p }; delete n.mobile; return n; }); }}
              onKeyDown={handleKeyDown}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <Err k="mobile" />
          </div>
          <div>
            <label htmlFor="otp-date" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Search Date <span className="text-orange-500">*</span>
            </label>
            <div className="relative">
              <input
                id="otp-date"
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setErrs((p) => { const n = { ...p }; delete n.date; return n; }); }}
                onKeyDown={handleKeyDown}
                max={today()}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <Err k="date" />
          </div>
        </div>

        <hr className="my-5 border-slate-100 dark:border-slate-600" />
        <div className="flex justify-center">
          <button
            onClick={handleSearch}
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* results area */}
      <div aria-live="polite">
        {/* before first search */}
        {results === null && !searching && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <Search className="mb-3 h-10 w-10" />
            <p className="text-sm">Enter a mobile number and date to see delivery status.</p>
          </div>
        )}

        {/* searching skeleton */}
        {searching && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-700" />
            ))}
          </div>
        )}

        {/* empty results */}
        {!searching && results !== null && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <p className="text-sm font-medium">No OTPs found for this number on this date.</p>
            <p className="mt-1 text-xs">Check the country code, or try the day before.</p>
          </div>
        )}

        {/* results table */}
        {!searching && results && results.length > 0 && (
          <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600">
            {/* header row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Delivery Log</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {results.length} OTP{results.length > 1 ? "s" : ""} sent to +{searchedFor}
                </p>
              </div>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            {/* table */}
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    <th className="w-8 pb-2 pr-2">#</th>
                    <th className="pb-2 pr-3">OTP Code</th>
                    <th className="pb-2 pr-3">Sent At</th>
                    <th className="pb-2 pr-3">Delivered At</th>
                    <th className="pb-2 pr-3">Latency</th>
                    <th className="pb-2 pr-3">Attempts</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2">Operator Response</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300">
                      <td className="py-2.5 pr-2 text-xs text-slate-400">{i + 1}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {revealed.has(r.id) ? r.otp : "••••"}
                          <button
                            aria-label={revealed.has(r.id) ? "Hide OTP" : "Reveal OTP"}
                            onClick={() => toggleReveal(r.id)}
                            className="inline-flex items-center justify-center rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:hover:text-slate-200"
                          >
                            {revealed.has(r.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{fmtDT(r.sentAt)}</td>
                      <td className="py-2.5 pr-3 text-xs whitespace-nowrap">
                        {r.deliveredAt ? fmtDT(r.deliveredAt) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs whitespace-nowrap">
                        {r.latency ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        <span className={r.attempts > 1 ? "font-semibold text-orange-600" : ""}>{r.attempts}</span>
                      </td>
                      <td className="py-2.5 pr-3">{statusPill(r.status)}</td>
                      <td className="max-w-[140px] truncate py-2.5 text-xs text-slate-400 dark:text-slate-500" title={r.operatorResponse}>
                        {r.operatorResponse}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
