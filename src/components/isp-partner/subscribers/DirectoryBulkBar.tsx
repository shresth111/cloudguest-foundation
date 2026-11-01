/**
 * DIR-2: bulk actions + export on the subscriber directory. Every action
 * runs a dry run first ("N will change, M skipped and why"); only an explicit
 * confirm applies it, with a fresh bulk key so a retried click never renews
 * anyone twice. Each action needs the same key as its single action:
 * renew = isp_invoices.create, block/unblock/freeze/unfreeze =
 * isp_subscribers.update, move = isp_subscribers.manage.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CyclesSelect } from "@/components/isp-partner/plans/CyclesSelect";
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
  onClose,
}: {
  action: Action;
  selection: BulkSelection;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const customers = useIspCustomerOptions();
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [cycles, setCycles] = useState(1);
  const [preview, setPreview] = useState<BulkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = (dry: boolean) => {
    const run = dry
      ? { dry_run: true }
      : { dry_run: false, bulk_key: idempotencyKey().slice(0, 40) };
    if (action === "renew") return dir2Service.renew(selection, run, { cycles });
    if (action === "move") return dir2Service.move(selection, run, target, reason);
    return dir2Service.status(selection, run, action, reason);
  };
  const go = async (dry: boolean) => {
    if (action === "move" && !target) return setError("Pick the customer to move them to.");
    setBusy(true);
    setError(null);
    try {
      const r = await call(dry);
      if (dry) setPreview(r);
      else {
        qc.invalidateQueries({ queryKey: ["isp", "sub360"] });
        toast.success(
          `${ACTION_LABEL[action]}: ${r.applied ?? 0} done` +
            (r.failed?.length ? `, ${r.failed.length} failed` : "") +
            (r.skipped.length ? `, ${r.skipped.length} skipped` : "") +
            ".",
        );
        onClose();
      }
    } catch (e) {
      setError(ispErrorMessage(e, "The bulk action failed."));
    } finally {
      setBusy(false);
    }
  };

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
            <MButton onClick={() => go(false)} disabled={busy || preview.eligible === 0}>
              {busy && <Spinner />} {ACTION_LABEL[action]} {preview.eligible}
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
          {selection.subscriber_ids
            ? `${selection.subscriber_ids.length} selected subscriber(s).`
            : "Everyone matching the current filters."}
          {action === "renew" &&
            " One unpaid invoice each at their package (or override) price; record payments separately."}
          {action === "block" && " Temporary block; live sessions are ended."}
          {action === "freeze" && " Validity is paused; live sessions are ended."}
        </p>
        {action === "renew" && <CyclesSelect value={cycles} onChange={setCycles} />}
        {action === "move" && (
          <CustomerSelect
            value={target}
            onChange={setTarget}
            customers={customers.data}
            allLabel={null}
          />
        )}
        {action !== "renew" && action !== "unblock" && action !== "unfreeze" && (
          <TextField label="Reason (optional)" value={reason} onChange={setReason} />
        )}
        {preview && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <p>
              <strong>{preview.eligible}</strong> of {preview.matched} will change.
            </p>
            {skipSummary(preview).length > 0 && (
              <p className="text-muted-foreground">Skipped: {skipSummary(preview).join(", ")}.</p>
            )}
          </div>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function DirectoryBulkBar({
  selectedIds,
  filter,
  onClear,
}: {
  selectedIds: string[];
  filter: DirFilter;
  onClear: () => void;
}) {
  const { can } = usePartner();
  const [action, setAction] = useState<Action | null>(null);
  const [scope, setScope] = useState<"selected" | "filter">("selected");
  const useSelected = scope === "selected" && selectedIds.length > 0;
  const selection: BulkSelection = useSelected ? { subscriber_ids: selectedIds } : { filter };
  const allowed: Action[] = [
    ...(can("isp_invoices.create") ? (["renew"] as Action[]) : []),
    ...(can("isp_subscribers.update")
      ? (["block", "unblock", "freeze", "unfreeze"] as Action[])
      : []),
    ...(can("isp_subscribers.manage") ? (["move"] as Action[]) : []),
  ];
  const exportAs = async (format: "csv" | "xlsx") => {
    try {
      const { blob, filename } = await dir2Service.exportDirectory(filter, format);
      saveBlob(blob, filename);
    } catch (e) {
      toast.error(ispErrorMessage(e));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs">
      <select
        className={`${M_INPUT} w-auto`}
        value={useSelected ? "selected" : "filter"}
        onChange={(e) => setScope(e.target.value as "selected" | "filter")}
        aria-label="Apply to"
      >
        <option value="selected" disabled={selectedIds.length === 0}>
          {selectedIds.length} selected
        </option>
        <option value="filter">All matching the filters</option>
      </select>
      {allowed.map((a) => (
        <MButton key={a} variant="outline" onClick={() => setAction(a)}>
          {ACTION_LABEL[a]}
        </MButton>
      ))}
      {selectedIds.length > 0 && (
        <MButton variant="ghost" onClick={onClear}>
          Clear selection
        </MButton>
      )}
      <span className="ml-auto flex gap-1">
        <MButton variant="outline" onClick={() => exportAs("csv")}>
          <Download /> CSV
        </MButton>
        <MButton variant="outline" onClick={() => exportAs("xlsx")}>
          <Download /> Excel
        </MButton>
      </span>
      {action && (
        <BulkDialog action={action} selection={selection} onClose={() => setAction(null)} />
      )}
    </div>
  );
}
