/** Promises to pay: missed ones first (the reminder list), then due today,
 * this week, or every open one. A missed promise already has a follow-up
 * task when Apps is on. */
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import {
  MButton,
  MDialog,
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
import { ErrorBlock, FormError, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useCollectionsMutation, usePromises } from "@/hooks/isp-partner/useCollections";
import { PROMISE_LABEL, promiseTone } from "@/lib/isp-partner/collections";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { collectionsService } from "@/services/isp-partner/collections";
import type { CollectionPromise } from "@/services/isp-partner/collections-types";

type View = "missed" | "today" | "week" | "open" | "kept";

const VIEWS: { value: View; label: string }[] = [
  { value: "missed", label: "Missed" },
  { value: "today", label: "Due today" },
  { value: "week", label: "This week" },
  { value: "open", label: "All open" },
  { value: "kept", label: "Kept" },
];

export function PromisesTab() {
  const { can } = usePartner();
  const [view, setView] = useState<View>("missed");
  const [page, setPage] = useState(1);
  const [cancel, setCancel] = useState<CollectionPromise | null>(null);
  const q = usePromises(
    view === "open" || view === "kept"
      ? { status: view, page }
      : { due: view, status: view === "missed" ? undefined : "open", page },
  );
  const items = q.data?.items ?? [];
  return (
    <div className="space-y-3">
      <MSeg<View>
        value={view}
        onChange={(v) => {
          setView(v);
          setPage(1);
        }}
        options={VIEWS}
      />
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="promises" />
      ) : !q.isLoading && items.length === 0 ? (
        <MEmptyState
          icon={CalendarCheck}
          title={view === "missed" ? "No missed promises" : "No promises here"}
          description="Take a promise to pay from a row in the Overdue list."
        />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Who</MTh>
              <MTh>Pay by</MTh>
              <MTh className="text-right">Amount (₹)</MTh>
              <MTh>Status</MTh>
              <MTh>Taken by</MTh>
              <MTh />
            </>
          }
        >
          {items.map((p) => (
            <MTr key={p.id}>
              <MTd>
                <div className="font-medium">{p.name ?? "–"}</div>
                <div className="text-xs text-muted-foreground">
                  {[p.phone, p.customer_name].filter(Boolean).join(" · ")}
                </div>
                {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
              </MTd>
              <MTd>{formatDate(p.promised_on)}</MTd>
              <MTd className="text-right tabular-nums">{formatRupees(p.target_paise)}</MTd>
              <MTd>
                <MTag label={PROMISE_LABEL[p.status]} tone={promiseTone(p.status)} />
                {p.followup_task_id && (
                  <div className="text-xs text-muted-foreground">Follow-up task raised</div>
                )}
              </MTd>
              <MTd className="text-xs">{p.created_by?.name ?? "–"}</MTd>
              <MTd className="text-right">
                {p.status === "open" && can("isp_collections.update") && (
                  <MButton variant="ghost" onClick={() => setCancel(p)}>
                    Cancel
                  </MButton>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(q.data.total / 50))}
          total={q.data.total}
          onPage={setPage}
        />
      )}
      {cancel && <CancelDialog promise={cancel} onClose={() => setCancel(null)} />}
    </div>
  );
}

function CancelDialog({ promise, onClose }: { promise: CollectionPromise; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const m = useCollectionsMutation(() =>
    collectionsService.cancelPromise(promise.id, reason.trim()),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title="Cancel this promise"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Keep it
          </MButton>
          <MButton
            disabled={!reason.trim() || m.isPending}
            onClick={() =>
              m.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Promise cancelled");
                  onClose();
                },
              })
            }
          >
            Cancel promise
          </MButton>
        </>
      }
    >
      <p className="mb-3 text-sm">
        {promise.name}: {formatRupees(promise.target_paise)} by {formatDate(promise.promised_on)}
      </p>
      <MField label="Why">
        <input
          className={M_INPUT}
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </MField>
      <div className="mt-2">
        <FormError message={m.error ? ispErrorMessage(m.error) : null} />
      </div>
    </MDialog>
  );
}
