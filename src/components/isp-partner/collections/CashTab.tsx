/** Cash in the field and the end-of-day handover.
 *
 * * Collectors (`isp_collections.collect`) see the cash they recorded on a
 *   day, print slips again, and hand the day's cash over with the amount
 *   they are handing in.
 * * Approvers (`isp_collections.approve`, owner/admin) see every handover,
 *   count the cash and approve it (any shortfall is shown) or send it back.
 *   Nobody approves their own.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Printer } from "lucide-react";
import {
  MButton,
  MDrawer,
  MEmptyState,
  MField,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useCollectionsMutation,
  useHandover,
  useHandovers,
  useMyCash,
} from "@/hooks/isp-partner/useCollections";
import {
  HANDOVER_LABEL,
  differenceText,
  handoverDateError,
  handoverTone,
} from "@/lib/isp-partner/collections";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { formatDate, formatDateTime, isoDay } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { collectionsService } from "@/services/isp-partner/collections";
import type { CollectionPayment, HandoverStatus } from "@/services/isp-partner/collections-types";

export function CashTab() {
  const { can } = usePartner();
  const collector = can("isp_collections.collect");
  return (
    <div className="space-y-4">
      {collector && <MyCashCard />}
      <HandoversCard />
    </div>
  );
}

async function printSlip(p: CollectionPayment, width: 58 | 80) {
  try {
    const f = await collectionsService.slip(p.id, p.receipt_number, width);
    saveBlob(f.blob, f.filename);
  } catch (err) {
    ispToastError(err, "Could not make the slip.");
  }
}

function MyCashCard() {
  const today = isoDay(new Date());
  const [day, setDay] = useState(today);
  const q = useMyCash(day);
  const [declared, setDeclared] = useState("");
  const [note, setNote] = useState("");
  const declaredPaise = parseRupeesToPaise(declared);
  const dateErr = handoverDateError(day, today);
  const submit = useCollectionsMutation(() =>
    collectionsService.submitHandover({
      business_date: day,
      declared_paise: declaredPaise as number,
      note: note.trim() || null,
    }),
  );
  const pending = q.data?.pending_handover_paise ?? 0;
  return (
    <Card
      title="My cash"
      actions={
        <input
          type="date"
          className={M_INPUT}
          aria-label="Day"
          value={day}
          max={today}
          onChange={(e) => {
            setDay(e.target.value);
            setDeclared("");
          }}
        />
      }
    >
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="your cash" />
      ) : q.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Collected {formatRupees(q.data?.total_paise ?? 0)} on {formatDate(day)}.{" "}
            <span className="font-medium">
              {formatRupees(pending)} in {q.data?.pending_handover_count ?? 0} receipt
              {q.data?.pending_handover_count === 1 ? "" : "s"} not handed over yet.
            </span>
          </p>
          {(q.data?.items ?? []).length > 0 && (
            <MTable
              head={
                <>
                  <MTh>Receipt</MTh>
                  <MTh>From</MTh>
                  <MTh className="text-right">Amount (₹)</MTh>
                  <MTh>Handover</MTh>
                  <MTh />
                </>
              }
            >
              {q.data?.items.map((p) => (
                <MTr key={p.id}>
                  <MTd className="font-mono text-xs">{p.receipt_number}</MTd>
                  <MTd className="text-xs">{p.customer_name ?? "–"}</MTd>
                  <MTd className="text-right tabular-nums">
                    {formatRupees(p.amount_paise)}
                    {p.status === "voided" && <MTag label="Voided" tone="overdue" />}
                  </MTd>
                  <MTd>
                    {p.handover_status ? (
                      <MTag
                        label={HANDOVER_LABEL[p.handover_status]}
                        tone={handoverTone(p.handover_status)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not yet</span>
                    )}
                  </MTd>
                  <MTd className="text-right">
                    <MButton
                      variant="ghost"
                      aria-label={`Print slip ${p.receipt_number}`}
                      onClick={() => printSlip(p, 80)}
                    >
                      <Printer />
                    </MButton>
                  </MTd>
                </MTr>
              ))}
            </MTable>
          )}
          {pending > 0 && (
            <form
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate(undefined, {
                  onSuccess: (h) => {
                    toast.success(
                      `Handover sent: ${formatRupees(h.declared_paise)} (${differenceText(
                        h.declared_difference_paise,
                        formatRupees,
                      )})`,
                    );
                    setDeclared("");
                    setNote("");
                  },
                });
              }}
            >
              <MField label="Cash I am handing in (₹)">
                <input
                  className={M_INPUT}
                  inputMode="decimal"
                  placeholder={paiseToInput(pending)}
                  value={declared}
                  onChange={(e) => setDeclared(e.target.value)}
                />
              </MField>
              <MField label="Note (optional)">
                <input
                  className={M_INPUT}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </MField>
              <MButton
                type="submit"
                disabled={declaredPaise === null || !!dateErr || submit.isPending}
              >
                <Banknote /> Hand over
              </MButton>
              {declaredPaise !== null && (
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  Expected {formatRupees(pending)}:{" "}
                  {differenceText(declaredPaise - pending, formatRupees)}.
                </p>
              )}
              <div className="sm:col-span-3">
                <FormError
                  message={dateErr ?? (submit.error ? ispErrorMessage(submit.error) : null)}
                />
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

function HandoversCard() {
  const { me } = usePartner();
  const [status, setStatus] = useState<HandoverStatus | "all">("submitted");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useHandovers({ status: status === "all" ? undefined : status, page });
  const items = q.data?.items ?? [];
  return (
    <Card title={q.data?.can_approve ? "Handovers to check" : "My handovers"}>
      <div className="mb-3">
        <MSeg<HandoverStatus | "all">
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "submitted", label: "Waiting" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Sent back" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="handovers" />
      ) : !q.isLoading && items.length === 0 ? (
        <MEmptyState icon={Banknote} title="No handovers here" description="" />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Day</MTh>
              <MTh>Collector</MTh>
              <MTh className="text-right">Expected (₹)</MTh>
              <MTh className="text-right">Handed in (₹)</MTh>
              <MTh className="text-right">Counted (₹)</MTh>
              <MTh>Status</MTh>
            </>
          }
        >
          {items.map((h) => (
            <MTr key={h.id} onClick={() => setOpen(h.id)}>
              <MTd>{formatDate(h.business_date)}</MTd>
              <MTd>
                {h.collector.name ?? "–"}
                {h.collector.id === me?.user.id && (
                  <span className="text-xs text-muted-foreground"> (you)</span>
                )}
              </MTd>
              <MTd className="text-right tabular-nums">{formatRupees(h.expected_paise)}</MTd>
              <MTd className="text-right tabular-nums">
                {formatRupees(h.declared_paise)}
                <div className="text-xs text-muted-foreground">
                  {differenceText(h.declared_difference_paise, formatRupees)}
                </div>
              </MTd>
              <MTd className="text-right tabular-nums">
                {h.received_paise === null ? "–" : formatRupees(h.received_paise)}
                {h.variance_paise !== null && (
                  <div className="text-xs text-muted-foreground">
                    {differenceText(h.variance_paise, formatRupees)}
                  </div>
                )}
              </MTd>
              <MTd>
                <MTag label={HANDOVER_LABEL[h.status]} tone={handoverTone(h.status)} />
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <div className="mt-2">
          <Pager
            page={page}
            pages={Math.max(1, Math.ceil(q.data.total / 50))}
            total={q.data.total}
            onPage={setPage}
          />
        </div>
      )}
      {open && (
        <HandoverDrawer
          id={open}
          canApprove={!!q.data?.can_approve}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  );
}

function HandoverDrawer({
  id,
  canApprove,
  onClose,
}: {
  id: string;
  canApprove: boolean;
  onClose: () => void;
}) {
  const { me } = usePartner();
  const q = useHandover(id);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const countedPaise = parseRupeesToPaise(counted);
  const approve = useCollectionsMutation(() =>
    collectionsService.approveHandover(id, countedPaise as number, note.trim() || null),
  );
  const reject = useCollectionsMutation(() => collectionsService.rejectHandover(id, note.trim()));
  const h = q.data;
  const decidable = !!h && canApprove && h.status === "submitted" && h.collector.id !== me?.user.id;
  const err = approve.error ?? reject.error;
  return (
    <MDrawer
      open
      onClose={onClose}
      title="Cash handover"
      subtitle={h ? `${h.collector.name ?? ""} · ${formatDate(h.business_date)}` : undefined}
      footer={
        decidable ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <MField label="Cash counted (₹)">
                <input
                  className={M_INPUT}
                  inputMode="decimal"
                  placeholder={paiseToInput(h?.expected_now_paise ?? 0)}
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                />
              </MField>
              <MField label="Note (needed to send back)">
                <input
                  className={M_INPUT}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </MField>
            </div>
            {countedPaise !== null && h && (
              <p className="text-xs text-muted-foreground">
                Against {formatRupees(h.expected_paise)} expected:{" "}
                {differenceText(countedPaise - h.expected_paise, formatRupees)}.
              </p>
            )}
            <FormError message={err ? ispErrorMessage(err) : null} />
            <div className="flex justify-end gap-2">
              <MButton
                variant="outline"
                disabled={!note.trim() || reject.isPending}
                onClick={() =>
                  reject.mutate(undefined, {
                    onSuccess: () => {
                      toast.success("Sent back to the collector");
                      onClose();
                    },
                  })
                }
              >
                Send back
              </MButton>
              <MButton
                disabled={countedPaise === null || approve.isPending}
                onClick={() =>
                  approve.mutate(undefined, {
                    onSuccess: () => {
                      toast.success("Handover approved");
                      onClose();
                    },
                  })
                }
              >
                Approve
              </MButton>
            </div>
          </div>
        ) : undefined
      }
    >
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this handover" />
      ) : !h ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-3 text-sm">
          <MTag label={HANDOVER_LABEL[h.status]} tone={handoverTone(h.status)} />
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-muted-foreground">Expected</dt>
            <dd className="text-right tabular-nums">{formatRupees(h.expected_paise)}</dd>
            <dt className="text-muted-foreground">Handed in</dt>
            <dd className="text-right tabular-nums">{formatRupees(h.declared_paise)}</dd>
            {h.received_paise !== null && (
              <>
                <dt className="text-muted-foreground">Counted</dt>
                <dd className="text-right tabular-nums">{formatRupees(h.received_paise)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Submitted</dt>
            <dd className="text-right">{formatDateTime(h.submitted_at)}</dd>
          </dl>
          {h.note && <p className="text-xs">Collector: {h.note}</p>}
          {h.decision_note && (
            <p className="text-xs">
              {h.decided_by?.name ?? "Approver"}: {h.decision_note}
            </p>
          )}
          {h.voided_since_submit.length > 0 && (
            <p className="rounded-lg border border-border p-2 text-xs">
              {h.voided_since_submit.length} receipt(s) in this handover were voided after it was
              sent. Cash expected now: {formatRupees(h.expected_now_paise)}.
            </p>
          )}
          <MTable
            head={
              <>
                <MTh>Receipt</MTh>
                <MTh>From</MTh>
                <MTh className="text-right">Amount (₹)</MTh>
              </>
            }
          >
            {h.items.map((p) => (
              <MTr key={p.id}>
                <MTd className="font-mono text-xs">{p.receipt_number}</MTd>
                <MTd className="text-xs">{p.customer_name ?? "–"}</MTd>
                <MTd className="text-right tabular-nums">
                  {formatRupees(p.amount_paise)}
                  {p.status === "voided" && <MTag label="Voided" tone="overdue" />}
                </MTd>
              </MTr>
            ))}
          </MTable>
        </div>
      )}
    </MDrawer>
  );
}
