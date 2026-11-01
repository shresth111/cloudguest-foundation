/** P3-SWEEP: edit an inventory item or a stock location after it was
 * created (APPS-2 `PATCH /isp/apps/inventory/items/{id}` and
 * `/inventory/locations/{id}`, both isp_apps.manage). Only the changed fields
 * are sent; the server's error (SKU taken, bag without a technician) shows in
 * the dialog. */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { AssigneeSelect, Select, useAppsMutation } from "@/components/isp-partner/apps/appsKit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { STOCK_KIND_LABEL, humanize } from "@/lib/isp-partner/apps";
import {
  itemDraft,
  itemPatch,
  locationDraft,
  locationPatch,
  nothingChanged,
  type Checked,
  type Patch,
} from "@/lib/isp-partner/inventory-edit";
import { appsService } from "@/services/isp-partner/apps";
import {
  ITEM_CATEGORIES,
  STOCK_LOCATION_KINDS,
  type InventoryItem,
  type StockLocation,
} from "@/services/isp-partner/apps-types";

function SaveFooter({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <MButton variant="outline" onClick={onClose}>
        Cancel
      </MButton>
      <MButton disabled={busy} onClick={onSave}>
        {busy && <Spinner />} Save
      </MButton>
    </>
  );
}

function useSave(send: (body: Patch) => Promise<unknown>, done: string, onClose: () => void) {
  const m = useAppsMutation(send);
  const [err, setErr] = useState<string | null>(null);
  const save = async (checked: Checked) => {
    setErr(null);
    if ("error" in checked) return setErr(checked.error);
    if (nothingChanged(checked)) return onClose();
    try {
      await m.mutateAsync(checked.body);
      toast.success(done);
      onClose();
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };
  return { save, err, busy: m.isPending };
}

export function EditItemDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [d, setD] = useState(() => itemDraft(item));
  const s = useSave((body) => appsService.patchItem(item.id, body), "Item saved.", onClose);
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Edit ${item.name}`}
      footer={
        <SaveFooter busy={s.busy} onClose={onClose} onSave={() => s.save(itemPatch(item, d))} />
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <TextField label="Name" required value={d.name} onChange={(v) => setD({ ...d, name: v })} />
        <TextField label="SKU" required value={d.sku} onChange={(v) => setD({ ...d, sku: v })} />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Category</span>
          <Select
            ariaLabel="Category"
            value={d.category}
            onChange={(v) => setD({ ...d, category: v })}
            options={ITEM_CATEGORIES.map((k) => [k, humanize(k)] as [string, string])}
          />
        </label>
        <TextField
          label="Notes (optional)"
          value={d.notes}
          onChange={(v) => setD({ ...d, notes: v })}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Units already in stock keep their serials; they show under the new name.
      </p>
      <FormError message={s.err} />
    </MDialog>
  );
}

export function EditLocationDialog({
  location,
  onClose,
}: {
  location: StockLocation;
  onClose: () => void;
}) {
  const [d, setD] = useState(() => locationDraft(location));
  const s = useSave(
    (body) => appsService.patchLocation(location.id, body as Partial<StockLocation>),
    "Location saved.",
    onClose,
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Edit ${location.name}`}
      footer={
        <SaveFooter
          busy={s.busy}
          onClose={onClose}
          onSave={() => s.save(locationPatch(location, d))}
        />
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <TextField label="Name" required value={d.name} onChange={(v) => setD({ ...d, name: v })} />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Kind</span>
          <Select
            ariaLabel="Kind"
            value={d.kind}
            onChange={(v) => setD({ ...d, kind: v })}
            options={STOCK_LOCATION_KINDS.map(
              (k) => [k, STOCK_KIND_LABEL[k] ?? humanize(k)] as [string, string],
            )}
          />
        </label>
        {d.kind === "technician_bag" && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Carried by<span className="text-destructive"> *</span>
            </span>
            <AssigneeSelect
              value={d.holder}
              onChange={(v) => setD({ ...d, holder: v })}
              allowNone={false}
              ariaLabel="Technician"
            />
          </label>
        )}
        <TextField
          label="Address (optional)"
          value={d.address}
          onChange={(v) => setD({ ...d, address: v })}
        />
        <label className="flex items-center gap-2 text-xs sm:col-span-2">
          <input
            type="checkbox"
            checked={d.active}
            onChange={(e) => setD({ ...d, active: e.target.checked })}
            aria-label="Location in use"
          />
          In use (untick and it is no longer offered when you link a unit)
        </label>
      </div>
      <FormError message={s.err} />
    </MDialog>
  );
}
