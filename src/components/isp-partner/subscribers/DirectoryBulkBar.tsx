/**
 * DIR-2: bulk actions + export on the subscriber directory.
 *
 * BULKBAR (founder-approved): the bar exists only while rows are ticked
 * (export lives in DirectoryExportButtons, always shown). "All matching the
 * filters" is a second step after ticking the whole page, labelled with the
 * dry run's exact count. Block / Move above 10 need the count typed in. On a
 * phone the bar is a bottom sheet; the page leaves room under the table.
 * Rules: src/lib/isp-partner/bulkbar.ts. Every action
 * runs a dry run first ("N will change, M skipped and why"); only an explicit
 * confirm applies it, with a fresh bulk key so a retried click never renews
 * anyone twice. Each action needs the same key as its single action:
 * renew = isp_invoices.create, block/unblock/freeze/unfreeze =
 * isp_subscribers.update, move = isp_subscribers.manage.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CyclesSelect } from "@/components/isp-partner/plans/CyclesSelect";
import {
  BulkDiscountCodeInput,
  BulkDiscountPreview,
} from "@/components/isp-partner/subscribers/BulkDiscountPreview";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { idempotencyKey } from "@/lib/isp-partner/subscribers360";
import {
  dir2Service,
  SKIP_REASON_LABEL,
  type BulkResult,
  type BulkSelection,
  type BulkStatusAction,
  type DirFilter,
} from "@/services/isp-partner/dir2";
import {
  canApply,
  canOfferSelectAllMatching,
  needsTypedConfirm,
  scopeAfterSelectAllMatching,
  type BulkScope,
} from "@/lib/isp-partner/bulkbar";

type Action = "renew" | BulkStatusAction | "move";

const ACTION_LABEL: Record<Action, string> = {
  renew: "Renew",
  block: "Block",
  unblock: "Unblock",
  freeze: "Freeze",
  unfreeze: "Unfreeze",
  move: "Move",
};

function skipSummary(r: BulkResult): string[] {
  const by = new Map<string, number>();
  for (const s of r.skipped) by.set(s.reason, (by.get(s.reason) ?? 0) + 1);
  return [...by.entries()].map(([k, n]) => `${n} ${SKIP_REASON_LABEL[k] ?? k}`);
}

function BulkDialog({
  action,
  selection,
  scopeLabel,
  onClose,
  onDone,
}: {
  action: Action;
  selection: BulkSelection;
  scopeLabel: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const customers = useIspCustomerOptions();
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [cycles, setCycles] = useState(1);
  const [discountCode, setDiscountCode] = useState("");
  const [preview, setPreview] = useState<BulkResult | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = (dry: boolean) => {
    const run = dry
      ? { dry_run: true }
      : { dry_run: false, bulk_key: idempotencyKey().slice(0, 40) };
    if (action === "renew")
      return dir2Service.renew(selection, run, { cycles, discount_code: discountCode });
    if (action === "move") return dir2Service.move(selection, run, target, reason);
    return dir2Service.status(selection, run, action, reason);
  };
  const go = async (dry: boolean) => {
    if (action === "move" && !target) return setError("Pick the customer to move them to.");
    setBusy(true);
    setError(null);
    try {
      const r = await call(dry);
      if (dry) {
        setPreview(r);
        setTyped("");
      } else {
        qc.invalidateQueries({ queryKey: ["isp", "sub360"] });
        toast.success(
          `${ACTION_LABEL[action]}: ${r.applied ?? 0} done` +
            (r.failed?.length ? `, ${r.failed.length} failed` : "") +
            (r.skipped.length ? `, ${r.skipped.length} skipped` : "") +
            ".",
        );
        onDone();
      }
    } catch (e) {
      setError(ispErrorMessage(e, "The bulk action failed."));
    } finally {
      setBusy(false);
    }
  };
  // A changed input invalidates the dry run: check again before applying.
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPreview(null);
    };
  const typedNeeded = !!preview && needsTypedConfirm(action, preview.eligible);

  return (
    <MDialog
      open
      onClose={onClose}
      title={`${ACTION_LABEL[action]} subscribers`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          {preview ? (
            <MButton
              onClick={() => go(false)}
              disabled={busy || !canApply(action, preview, typed)}
              className={
                action === "block" || action === "freeze"
                  ? "bg-destructive text-destructive-foreground"
                  : undefined
              }
            >
              {busy && <Spinner />} {ACTION_LABEL[action]}{" "}
              {preview.eligible.toLocaleString("en-IN")}
            </MButton>
          ) : (
            <MButton onClick={() => go(true)} disabled={busy}>
              {busy && <Spinner />} Check first
            </MButton>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {scopeLabel}
          {action === "renew" &&
            " One unpaid invoice each at their package (or override) price; record payments separately."}
          {action === "block" && " Temporary block; live sessions are ended."}
          {action === "freeze" && " Validity is paused; live sessions are ended."}
        </p>
        {action === "renew" && <CyclesSelect value={cycles} onChange={edit(setCycles)} />}
        {action === "renew" && (
          <BulkDiscountCodeInput value={discountCode} onChange={edit(setDiscountCode)} />
        )}
        {action === "move" && (
          <CustomerSelect
            value={target}
            onChange={edit(setTarget)}
            customers={customers.data}
            allLabel={null}
          />
        )}
        {action !== "renew" && action !== "unblock" && action !== "unfreeze" && (
          <TextField label="Reason (optional)" value={reason} onChange={setReason} />
        )}
        {preview && (
          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Matched</dt>
              <dd className="text-base font-semibold tabular-nums">
                {preview.matched.toLocaleString("en-IN")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Will change</dt>
              <dd className="text-base font-semibold tabular-nums">
                {preview.eligible.toLocaleString("en-IN")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Skipped</dt>
              <dd className="text-base font-semibold tabular-nums">
                {preview.skipped.length.toLocaleString("en-IN")}
              </dd>
            </div>
            {skipSummary(preview).length > 0 && (
              <p className="col-span-3 text-muted-foreground">
                Skipped: {skipSummary(preview).join(", ")}.
              </p>
            )}
          </dl>
        )}
        {preview?.discount && <BulkDiscountPreview summary={preview.discount} />}
        {typedNeeded && preview && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">
              This affects {preview.eligible.toLocaleString("en-IN")} subscribers. Type{" "}
              <strong className="tabular-nums">{preview.eligible}</strong> or{" "}
              <strong>{action.toUpperCase()}</strong> to confirm.
            </span>
            <input
              className={M_INPUT}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={`Type ${preview.eligible} or ${action.toUpperCase()} to confirm`}
              autoComplete="off"
            />
          </label>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

/** Directory export: always available, independent of any selection. */
export function DirectoryExportButtons({ filter }: { filter: DirFilter }) {
  const exportAs = async (format: "csv" | "xlsx") => {
    try {
      const { blob, filename } = await dir2Service.exportDirectory(filter, format);
      saveBlob(blob, filename);
    } catch (e) {
      toast.error(ispErrorMessage(e));
    }
  };
  return (
    <span className="flex gap-1">
      <MButton variant="outline" onClick={() => exportAs("csv")}>
        <Download /> CSV
      </MButton>
      <MButton variant="outline" onClick={() => exportAs("xlsx")}>
        <Download /> Excel
      </MButton>
    </span>
  );
}

/** Rendered by the directory only while at least one row is ticked
 * (`bulkBarVisible`), keyed by the filters so a filter change starts over. */
export function DirectoryBulkBar({
  selectedIds,
  filter,
  allOnPage,
  total,
  onClear,
}: {
  selectedIds: string[];
  filter: DirFilter;
  allOnPage: boolean;
  total: number | undefined;
  onClear: () => void;
}) {
  const { can } = usePartner();
  const [action, setAction] = useState<Action | null>(null);
  const [scope, setScope] = useState<BulkScope>("selected");
  const allowed: Action[] = [
    ...(can("isp_invoices.create") ? (["renew"] as Action[]) : []),
    ...(can("isp_subscribers.update")
      ? (["block", "unblock", "freeze", "unfreeze"] as Action[])
      : []),
    ...(can("isp_subscribers.manage") ? (["move"] as Action[]) : []),
  ];
  const n = selectedIds.length;
  const offer = { scope, allOnPage, selectedCount: n, total };
  const offering = canOfferSelectAllMatching(offer);
  // The exact count for "Select all N matching" comes from a dry run (no
  // change is made), so it is the number the action itself will see.
  const probe = allowed.find((a) => a !== "move" && a !== "renew") ?? allowed[0];
  const matching = useQuery({
    queryKey: ["isp", "dir2-matching", filter, probe],
    enabled: !!probe && (offering || scope === "filter"),
    staleTime: 30_000,
    queryFn: () =>
      probe === "renew"
        ? dir2Service.renew({ filter }, { dry_run: true }, { cycles: 1 })
        : dir2Service.status({ filter }, { dry_run: true }, probe as BulkStatusAction, ""),
  });
  const matched = matching.data?.matched;
  if (allowed.length === 0) return null;
  const selection: BulkSelection =
    scope === "filter" ? { filter } : { subscriber_ids: selectedIds };
  const scopeLabel =
    scope === "filter"
      ? `All ${matched !== undefined ? matched.toLocaleString("en-IN") : ""} subscribers matching the current filters.`
      : `${n.toLocaleString("en-IN")} selected subscriber${n === 1 ? "" : "s"}.`;
  const done = () => {
    setAction(null);
    setScope("selected");
    onClear();
  };

  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className="fixed inset-x-0 bottom-0 z-40 space-y-2 rounded-t-2xl border-t border-border bg-card p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-xs shadow-2xl sm:static sm:z-auto sm:rounded-lg sm:border sm:bg-muted/30 sm:p-2 sm:shadow-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums text-foreground" aria-live="polite">
            {scope === "filter"
              ? `All ${matched !== undefined ? matched.toLocaleString("en-IN") : "…"} matching selected`
              : `${n.toLocaleString("en-IN")} selected`}
          </span>
          {offering && (
            <button
              type="button"
              className="font-medium text-primary hover:underline disabled:opacity-60"
              disabled={matched === undefined}
              onClick={() => setScope(scopeAfterSelectAllMatching(offer))}
            >
              {matched === undefined
                ? "Counting matches…"
                : `Select all ${matched.toLocaleString("en-IN")} matching`}
            </button>
          )}
          {scope === "filter" && (
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setScope("selected")}
            >
              Only the {n.toLocaleString("en-IN")} ticked
            </button>
          )}
          <MButton variant="ghost" className="ml-auto" onClick={done}>
            Clear selection
          </MButton>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowed.map((a) => (
            <MButton key={a} variant="outline" onClick={() => setAction(a)}>
              {ACTION_LABEL[a]}
            </MButton>
          ))}
        </div>
      </div>
      {action && (
        <BulkDialog
          action={action}
          selection={selection}
          scopeLabel={scopeLabel}
          onClose={() => setAction(null)}
          onDone={done}
        />
      )}
    </>
  );
}
