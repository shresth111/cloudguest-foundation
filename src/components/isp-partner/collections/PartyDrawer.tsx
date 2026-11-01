/** One subscriber's (or directly billed customer's) collections view: why
 * the risk is what it is, the timeline (notes, promises, bills, payments,
 * reminders), and the three actions: add a note, take a promise to pay,
 * record cash. */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HandCoins, NotebookPen, Phone, Printer, CalendarClock } from "lucide-react";
import { MButton, MDrawer, MField, MTag, M_INPUT } from "@/components/master/MasterKit";
import { ErrorBlock, FormError, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useCollectionsMutation, useTimeline } from "@/hooks/isp-partner/useCollections";
import {
  BAND_LABEL,
  OUTCOMES,
  OUTCOME_LABEL,
  PROMISE_LABEL,
  bandTone,
  eventLabel,
  newIdempotencyKey,
  partyOf,
  promiseDateError,
  promiseTone,
  telHref,
} from "@/lib/isp-partner/collections";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate, formatDateTime, isoDay } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { collectionsService } from "@/services/isp-partner/collections";
import type {
  CashResult,
  NoteOutcome,
  OverdueItem,
  PartyRef,
} from "@/services/isp-partner/collections-types";

type Mode = "note" | "promise" | "cash" | null;

export function PartyDrawer({ item, onClose }: { item: OverdueItem; onClose: () => void }) {
  const { can } = usePartner();
  const party = useMemo(() => partyOf(item), [item]);
  const tl = useTimeline(party);
  const [mode, setMode] = useState<Mode>(null);
  const tel = telHref(item.phone);
  const overdue = tl.data?.overdue_paise ?? item.overdue_paise;

  return (
    <MDrawer
      open
      onClose={onClose}
      title={item.name ?? "Overdue"}
      subtitle={[item.identifier, item.customer_name].filter(Boolean).join(" · ")}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Overdue</div>
            <div className="text-lg font-semibold tabular-nums">{formatRupees(overdue)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Oldest bill due</div>
            <div>
              {formatDate(item.oldest_due_date)} ({item.days_overdue} days)
            </div>
          </div>
        </div>
        <div>
          <MTag
            label={`${BAND_LABEL[item.risk.band]} · score ${item.risk.score}`}
            tone={bandTone(item.risk.band)}
          />
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {item.risk.reasons.map((r) => (
              <li key={r.code}>
                {r.text}{" "}
                <span className="tabular-nums">
                  ({r.points > 0 ? "+" : ""}
                  {r.points})
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {tel && (
            <a href={tel}>
              <MButton variant="outline" type="button">
                <Phone /> Call
              </MButton>
            </a>
          )}
          {can("isp_collections.collect") && (
            <MButton
              variant={mode === "cash" ? "primary" : "outline"}
              onClick={() => setMode("cash")}
            >
              <HandCoins /> Record cash
            </MButton>
          )}
          {can("isp_collections.update") && (
            <>
              <MButton
                variant={mode === "promise" ? "primary" : "outline"}
                onClick={() => setMode("promise")}
              >
                <CalendarClock /> Promise to pay
              </MButton>
              <MButton
                variant={mode === "note" ? "primary" : "outline"}
                onClick={() => setMode("note")}
              >
                <NotebookPen /> Add note
              </MButton>
            </>
          )}
        </div>
        {mode === "note" && <NoteForm party={party} onDone={() => setMode(null)} />}
        {mode === "promise" && (
          <PromiseForm party={party} overduePaise={overdue} onDone={() => setMode(null)} />
        )}
        {mode === "cash" && <CashForm party={party} overduePaise={overdue} />}

        {tl.data?.open_promise && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <MTag label={PROMISE_LABEL.open} tone={promiseTone("open")} /> to pay{" "}
            {formatRupees(tl.data.open_promise.target_paise)} by{" "}
            {formatDate(tl.data.open_promise.promised_on)}
            {tl.data.open_promise.note && (
              <div className="mt-1 text-xs text-muted-foreground">{tl.data.open_promise.note}</div>
            )}
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
          {tl.error ? (
            <ErrorBlock error={tl.error} onRetry={() => tl.refetch()} what="the timeline" />
          ) : tl.isLoading ? (
            <LoadingBlock />
          ) : (tl.data?.items ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {tl.data?.items.map((e) => (
                <li key={`${e.source}-${e.id}-${e.kind}`} className="border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{eventLabel(e.kind)}</span>
                    {e.outcome && <MTag label={OUTCOME_LABEL[e.outcome]} />}
                    <span className="text-muted-foreground">{formatDateTime(e.at)}</span>
                    {e.actor?.name && (
                      <span className="text-muted-foreground">· {e.actor.name}</span>
                    )}
                  </div>
                  {e.body && <p className="mt-0.5 whitespace-pre-wrap text-xs">{e.body}</p>}
                  {typeof e.detail.amount_paise === "number" && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatRupees(e.detail.amount_paise)}
                    </p>
                  )}
                  {typeof e.detail.total_paise === "number" && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatRupees(e.detail.total_paise)}
                      {typeof e.detail.balance_paise === "number" &&
                        ` · balance ${formatRupees(e.detail.balance_paise)}`}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </MDrawer>
  );
}

function NoteForm({ party, onDone }: { party: PartyRef; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState<NoteOutcome | "">("called");
  const m = useCollectionsMutation(() =>
    collectionsService.addNote(party, body.trim(), outcome || null),
  );
  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(undefined, {
          onSuccess: () => {
            toast.success("Note added");
            onDone();
          },
        });
      }}
    >
      <MField label="What happened">
        <select
          className={M_INPUT}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as NoteOutcome | "")}
        >
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABEL[o]}
            </option>
          ))}
        </select>
      </MField>
      <MField label="Note">
        <textarea
          className={M_INPUT}
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </MField>
      <FormError message={m.error ? ispErrorMessage(m.error) : null} />
      <MButton type="submit" disabled={!body.trim() || m.isPending}>
        Save note
      </MButton>
    </form>
  );
}

function PromiseForm({
  party,
  overduePaise,
  onDone,
}: {
  party: PartyRef;
  overduePaise: number;
  onDone: () => void;
}) {
  const today = isoDay(new Date());
  const [day, setDay] = useState(today);
  const [amount, setAmount] = useState(paiseToInput(overduePaise));
  const [note, setNote] = useState("");
  const paise = amount.trim() ? parseRupeesToPaise(amount) : null;
  const dateErr = promiseDateError(day, today);
  const amountErr =
    amount.trim() && (paise === null || paise <= 0) ? "Enter an amount in rupees." : null;
  const m = useCollectionsMutation(() =>
    collectionsService.createPromise(party, {
      promised_on: day,
      amount_paise: paise,
      note: note.trim() || null,
    }),
  );
  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(undefined, {
          onSuccess: () => {
            toast.success("Promise recorded. A missed date raises a follow-up task.");
            onDone();
          },
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <MField label="Will pay by">
          <input
            className={M_INPUT}
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </MField>
        <MField label="Amount (₹)">
          <input
            className={M_INPUT}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </MField>
      </div>
      <MField label="Note (optional)">
        <input
          className={M_INPUT}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </MField>
      <p className="text-xs text-muted-foreground">
        A new promise replaces the open one. It counts as kept when this much is paid by the end of
        that day.
      </p>
      <FormError message={dateErr ?? amountErr ?? (m.error ? ispErrorMessage(m.error) : null)} />
      <MButton type="submit" disabled={!!dateErr || !!amountErr || m.isPending}>
        Save promise
      </MButton>
    </form>
  );
}

function CashForm({ party, overduePaise }: { party: PartyRef; overduePaise: number }) {
  const [amount, setAmount] = useState(paiseToInput(overduePaise));
  const [note, setNote] = useState("");
  const [key] = useState(newIdempotencyKey);
  const [done, setDone] = useState<CashResult | null>(null);
  const paise = parseRupeesToPaise(amount);
  const m = useCollectionsMutation(() =>
    collectionsService.collectCash(
      party,
      { amount_paise: paise as number, note: note.trim() || null },
      key,
    ),
  );
  const slip = async (width: 58 | 80) => {
    if (!done) return;
    try {
      const f = await collectionsService.slip(done.payment.id, done.payment.receipt_number, width);
      saveBlob(f.blob, f.filename);
    } catch (err) {
      toast.error(ispErrorMessage(err, "Could not make the slip."));
    }
  };
  if (done) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
        <div className="font-medium">
          {formatRupees(done.payment.amount_paise)} recorded · receipt {done.payment.receipt_number}
        </div>
        {done.allocations.length > 0 && (
          <ul className="text-xs text-muted-foreground">
            {done.allocations.map((a) => (
              <li key={a.invoice_number}>
                {a.invoice_number}: {formatRupees(a.amount_paise)}
              </li>
            ))}
          </ul>
        )}
        {done.payment.unallocated_paise > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatRupees(done.payment.unallocated_paise)} kept as advance for the next bill.
          </p>
        )}
        {done.promise_kept && <MTag label="Promise kept" tone="paid" />}
        <div className="flex gap-2">
          <MButton variant="outline" onClick={() => slip(80)}>
            <Printer /> Slip 80 mm
          </MButton>
          <MButton variant="outline" onClick={() => slip(58)}>
            <Printer /> Slip 58 mm
          </MButton>
        </div>
        <p className="text-xs text-muted-foreground">
          Hand this cash over at the end of the day from Cash &amp; handovers.
        </p>
      </div>
    );
  }
  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(undefined, {
          onSuccess: (r) => {
            setDone(r);
            toast.success(r.repeat ? "Already recorded" : "Cash recorded");
          },
        });
      }}
    >
      <MField label="Cash received (₹)">
        <input
          className={M_INPUT}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
      <p className="text-xs text-muted-foreground">
        Pays the oldest bill first, then the next. Anything above the dues stays as advance.
      </p>
      <FormError
        message={
          paise === null || paise <= 0
            ? amount.trim()
              ? "Enter an amount in rupees."
              : null
            : m.error
              ? ispErrorMessage(m.error)
              : null
        }
      />
      <MButton type="submit" disabled={paise === null || paise <= 0 || m.isPending}>
        <HandCoins /> Record {paise ? formatRupees(paise) : ""} cash
      </MButton>
    </form>
  );
}
