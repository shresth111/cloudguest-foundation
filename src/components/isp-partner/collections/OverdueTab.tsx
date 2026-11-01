/** The overdue list: ranked by risk band, then amount (the backend's
 * order). The score's reasons are shown, never re-derived. A row opens the
 * party drawer (timeline, note, promise, cash). */
import { useState } from "react";
import { MEmptyState, MTable, MTag, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { PartyDrawer } from "@/components/isp-partner/collections/PartyDrawer";
import { useOverdue } from "@/hooks/isp-partner/useCollections";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  BAND_LABEL,
  OUTCOME_LABEL,
  PROMISE_LABEL,
  bandTone,
  promiseTone,
} from "@/lib/isp-partner/collections";
import { formatAgo, formatDate } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { CheckCircle2 } from "lucide-react";
import type {
  OverdueItem,
  OverdueQuery,
  OverdueSort,
  PartyKind,
  RiskBand,
} from "@/services/isp-partner/collections-types";

const PAGE_SIZE = 50;

export function OverdueTab() {
  const [search, setSearch] = useState("");
  const [band, setBand] = useState<RiskBand | "">("");
  const [kind, setKind] = useState<PartyKind | "">("");
  const [promise, setPromise] = useState<OverdueQuery["promise"] | "">("");
  const [sort, setSort] = useState<OverdueSort>("priority");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<OverdueItem | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useOverdue({
    search: debounced || undefined,
    band: band || undefined,
    party_kind: kind || undefined,
    promise: promise || undefined,
    sort,
    page,
    page_size: PAGE_SIZE,
  });
  const filtered = !!(debounced || band || kind || promise);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const items = q.data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className={M_INPUT}
          placeholder="Name, username, phone or bill no."
          aria-label="Search overdue"
          value={search}
          onChange={(e) => reset(() => setSearch(e.target.value))}
        />
        <select
          className={M_INPUT}
          aria-label="Risk"
          value={band}
          onChange={(e) => reset(() => setBand(e.target.value as RiskBand | ""))}
        >
          <option value="">Any risk</option>
          <option value="high">High risk</option>
          <option value="medium">Medium risk</option>
          <option value="low">Low risk</option>
        </select>
        <select
          className={M_INPUT}
          aria-label="Who"
          value={kind}
          onChange={(e) => reset(() => setKind(e.target.value as PartyKind | ""))}
        >
          <option value="">Subscribers and customers</option>
          <option value="subscriber">Subscribers</option>
          <option value="customer">Customers billed directly</option>
        </select>
        <select
          className={M_INPUT}
          aria-label="Promise"
          value={promise}
          onChange={(e) => reset(() => setPromise(e.target.value as OverdueQuery["promise"] | ""))}
        >
          <option value="">Any promise</option>
          <option value="open">Has an open promise</option>
          <option value="broken">Missed a promise (90 days)</option>
          <option value="none">No promise</option>
        </select>
        <select
          className={M_INPUT}
          aria-label="Sort"
          value={sort}
          onChange={(e) => reset(() => setSort(e.target.value as OverdueSort))}
        >
          <option value="priority">Risk, then amount</option>
          <option value="amount">Largest amount</option>
          <option value="age">Oldest bill</option>
          <option value="score">Risk score</option>
        </select>
      </div>
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the overdue list" />
      ) : !q.isLoading && items.length === 0 ? (
        <MEmptyState
          icon={CheckCircle2}
          title={filtered ? "Nobody matches these filters" : "Nothing is overdue"}
          description={
            filtered
              ? "Clear a filter to see more."
              : "Every bill in the zone you are viewing is paid or not yet due."
          }
        />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Who</MTh>
              <MTh className="text-right">Overdue (₹)</MTh>
              <MTh className="text-right">Days</MTh>
              <MTh>Risk</MTh>
              <MTh>Promise</MTh>
              <MTh>Last contact</MTh>
            </>
          }
        >
          {items.map((i) => (
            <MTr key={i.party_key} onClick={() => setOpen(i)}>
              <MTd>
                <div className="font-medium text-foreground">{i.name ?? "–"}</div>
                <div className="text-xs text-muted-foreground">
                  {[i.identifier, i.phone, i.customer_name].filter(Boolean).join(" · ")}
                </div>
              </MTd>
              <MTd className="text-right tabular-nums">
                <div>{formatRupees(i.overdue_paise)}</div>
                <div className="text-xs text-muted-foreground">
                  {i.invoices_overdue} bill{i.invoices_overdue === 1 ? "" : "s"}
                </div>
              </MTd>
              <MTd className="text-right tabular-nums">{i.days_overdue}</MTd>
              <MTd>
                <span
                  title={i.risk.reasons
                    .map((r) => `${r.text} (${r.points > 0 ? "+" : ""}${r.points})`)
                    .join("\n")}
                >
                  <MTag
                    label={`${BAND_LABEL[i.risk.band]} · ${i.risk.score}`}
                    tone={bandTone(i.risk.band)}
                  />
                </span>
                <div className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground">
                  {i.risk.reasons[0]?.text}
                </div>
              </MTd>
              <MTd>
                {i.promise ? (
                  <>
                    <MTag
                      label={PROMISE_LABEL[i.promise.status]}
                      tone={promiseTone(i.promise.status)}
                    />
                    <div className="text-xs text-muted-foreground">
                      by {formatDate(i.promise.promised_on)}
                    </div>
                  </>
                ) : i.broken_promises_90d > 0 ? (
                  <MTag label="Missed before" tone="overdue" />
                ) : (
                  <span className="text-xs text-muted-foreground">–</span>
                )}
              </MTd>
              <MTd>
                {i.last_note ? (
                  <div className="text-xs">
                    <div>{i.last_note.outcome ? OUTCOME_LABEL[i.last_note.outcome] : "Note"}</div>
                    <div className="text-muted-foreground" title={i.last_note.at}>
                      {formatAgo(i.last_note.at)}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Never</span>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(q.data.total / PAGE_SIZE))}
          total={q.data.total}
          onPage={setPage}
        />
      )}
      {open && <PartyDrawer item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
