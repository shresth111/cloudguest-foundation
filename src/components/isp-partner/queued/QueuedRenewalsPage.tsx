/**
 * `/partner/queued-renewals` (P3-SWEEP over QUEUED-RENEWAL): every "next
 * plan" across the ISP, filtered by status, subscriber search, plan and
 * "starts within". Cancel reuses the 360 card's dialog and the
 * per-subscriber cancel route (credit note through JAZE-1 revert). Zone
 * scope: the BE narrows by each subscriber's own zone. 404s (and says so)
 * while `ISP_QUEUED_RENEWAL_ENABLED` is off; the nav item hides then too.
 */
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, LoadingBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CancelDialog } from "@/components/isp-partner/queued/QueuedRenewalCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isNotFound } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { QUEUE_STATUS_LABEL, queueTone } from "@/lib/isp-partner/queued-renewal";
import {
  QUEUED_LIST_STATUSES,
  QUEUED_LIST_STATUS_LABEL,
  STARTS_WITHIN,
  hasFilters,
  pagesOf,
  queuedListQuery,
  type QueuedListStatus,
  type QueuedSearch,
} from "@/lib/isp-partner/queued-list";
import { plansService } from "@/services/isp-partner/plans";
import { queuedRenewalService, type QueuedRenewal } from "@/services/isp-partner/queued-renewal";

export function QueuedRenewalsPage({
  search,
  onSearch,
}: {
  search: QueuedSearch;
  onSearch: (next: QueuedSearch) => void;
}) {
  const { can } = usePartner();
  const [text, setText] = useState(search.q ?? "");
  const typed = useDebouncedValue(text, 300);
  const [cancel, setCancel] = useState<QueuedRenewal | null>(null);
  // Every filter lives in the URL; a filter change goes back to page 1.
  const set = (patch: QueuedSearch) => onSearch({ ...search, ...patch, page: undefined });
  useEffect(() => {
    if ((typed.trim() || undefined) !== search.q) set({ q: typed.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced text drives this
  }, [typed]);
  const query = queuedListQuery(search);
  const q = useQuery({
    queryKey: ["isp", "queued", "all", query],
    queryFn: () => queuedRenewalService.list(query),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const pk = useQuery({
    queryKey: ["isp", "queued", "packages"],
    queryFn: () => plansService.listPackages({ page_size: 100 }),
    retry: false,
    staleTime: 5 * 60_000,
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error && isNotFound(q.error)) {
    return (
      <MEmptyState
        icon={CalendarClock}
        title="Queued renewals are not switched on"
        description="Queued renewals are not switched on for your network. Ask Wyfy Guest support to turn them on."
      />
    );
  }
  const items = q.data?.items ?? [];
  const status = search.status ?? "pending";
  const canCancel = can("isp_invoices.manage");
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Billing"
        title="Queued renewals"
        description="Plans that were billed now and start when the subscriber's current plan ends. Queue a new one from the subscriber's page."
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${M_INPUT} w-60`}
          placeholder="Search subscriber, name or phone"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Search subscriber"
        />
        <MSeg<QueuedListStatus>
          value={status}
          onChange={(v) => set({ status: v === "pending" ? undefined : v })}
          options={QUEUED_LIST_STATUSES.map((s) => ({
            value: s,
            label: QUEUED_LIST_STATUS_LABEL[s],
          }))}
        />
        {pk.data && (
          <select
            className={`${M_INPUT} w-auto`}
            value={search.package ?? ""}
            onChange={(e) => set({ package: e.target.value || undefined })}
            aria-label="Plan"
          >
            <option value="">Any plan</option>
            {pk.data.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select
          className={`${M_INPUT} w-auto`}
          value={search.within ?? ""}
          onChange={(e) => set({ within: e.target.value ? Number(e.target.value) : undefined })}
          aria-label="Starts within"
        >
          <option value="">Any start date</option>
          {STARTS_WITHIN.map((d) => (
            <option key={d} value={d}>
              Starts within {d === 1 ? "a day" : `${d} days`}
            </option>
          ))}
        </select>
        {hasFilters(search) && (
          <MButton
            variant="ghost"
            onClick={() => {
              setText("");
              onSearch({});
            }}
          >
            Clear filters
          </MButton>
        )}
      </div>
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="queued renewals" />
      ) : items.length === 0 ? (
        <MEmptyState
          icon={CalendarClock}
          title={hasFilters(search) ? "Nothing matches these filters" : "Nothing queued"}
          description={
            hasFilters(search)
              ? "Clear the filters to see every queued renewal."
              : "A queued plan is billed now and starts when today's plan ends."
          }
        />
      ) : (
        <MTable
          head={
            <>
              <MTh>Subscriber</MTh>
              <MTh>Next plan</MTh>
              <MTh>Starts</MTh>
              <MTh>Ends</MTh>
              <MTh>Invoice</MTh>
              <MTh className="text-right">Amount</MTh>
              <MTh>Status</MTh>
              {canCancel && <MTh />}
            </>
          }
        >
          {items.map((r) => (
            <MTr key={r.id}>
              <MTd>
                <Link
                  to="/partner/subscribers/$subscriberId"
                  params={{ subscriberId: r.subscriber_id }}
                  className="font-medium hover:underline"
                >
                  {r.subscriber?.name || r.subscriber?.identifier || "Subscriber"}
                </Link>
                {r.subscriber?.name && (
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {r.subscriber.identifier}
                  </div>
                )}
              </MTd>
              <MTd>
                {r.package.name ?? "–"}
                {r.cycles > 1 ? ` x ${r.cycles}` : ""}
                {r.previous_package?.name && (
                  <div className="text-[11px] text-muted-foreground">
                    after {r.previous_package.name}
                  </div>
                )}
              </MTd>
              <MTd className="text-xs">{formatDateTime(r.starts_at)}</MTd>
              <MTd className="text-xs">{formatDateTime(r.ends_at)}</MTd>
              <MTd className="font-mono text-xs">
                {r.invoice?.number ?? "–"}
                {r.invoice && (
                  <div className="font-sans text-[11px] text-muted-foreground">
                    {r.invoice.paid_paise > 0 ? "paid" : "unpaid"}
                  </div>
                )}
              </MTd>
              <MTd className="text-right tabular-nums">
                {r.invoice ? formatRupees(r.invoice.total_paise) : "–"}
              </MTd>
              <MTd>
                <MTag label={QUEUE_STATUS_LABEL[r.status] ?? r.status} tone={queueTone(r.status)} />
                {r.cancel_reason && (
                  <div className="text-[11px] text-muted-foreground">{r.cancel_reason}</div>
                )}
              </MTd>
              {canCancel && (
                <MTd className="text-right">
                  {r.status === "pending" && (
                    <MButton variant="ghost" onClick={() => setCancel(r)}>
                      Cancel
                    </MButton>
                  )}
                </MTd>
              )}
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <Pager
          page={q.data.page}
          pages={pagesOf(q.data.total, q.data.page_size)}
          total={q.data.total}
          onPage={(p) => onSearch({ ...search, page: p > 1 ? p : undefined })}
        />
      )}
      {cancel && (
        <CancelDialog
          subscriberId={cancel.subscriber_id}
          row={cancel}
          onClose={() => setCancel(null)}
        />
      )}
    </div>
  );
}
