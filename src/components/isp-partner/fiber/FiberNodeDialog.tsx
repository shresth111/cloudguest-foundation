/** Add / edit a fiber plant node (J22). Upstream = the node this one hangs
 * off (and which of its ports); Ports = how many numbered outputs it has. */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useFiberMutation, useFiberNodes } from "@/hooks/isp-partner/useFiber";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import {
  KIND_LABEL,
  STATUS_LABEL,
  kindLabel,
  kindTakesPorts,
  nodeBody,
  nodeDraft,
  type NodeDraft,
} from "@/lib/isp-partner/fiber";
import { fiberService } from "@/services/isp-partner/fiber";
import {
  FIBER_KINDS,
  FIBER_STATUSES,
  type FiberNode,
  type FiberNodeBody,
} from "@/services/isp-partner/fiber-types";

export function FiberNodeDialog({
  node,
  parentId,
  onClose,
  onSaved,
}: {
  /** null = add. */
  node: FiberNode | null;
  parentId?: string;
  onClose: () => void;
  onSaved?: (n: FiberNode) => void;
}) {
  const [d, setD] = useState<NodeDraft>(() => nodeDraft(node, parentId));
  const [err, setErr] = useState<string | null>(null);
  const customers = useIspCustomerOptions();
  const parents = useFiberNodes({ page: 1, page_size: 100 });
  const save = useFiberMutation((body: FiberNodeBody) =>
    node ? fiberService.update(node.id, body) : fiberService.create(body),
  );
  const set =
    <K extends keyof NodeDraft>(k: K) =>
    (v: NodeDraft[K]) =>
      setD((x) => ({ ...x, [k]: v }));
  const parentOptions = (parents.data?.items ?? []).filter(
    (p) => p.id !== node?.id && kindTakesPorts(p.kind),
  );
  const parent = parentOptions.find((p) => p.id === d.parent_id);

  const onSave = async () => {
    setErr(null);
    const r = nodeBody(d, node);
    if ("error" in r) return setErr(r.error);
    if (node && Object.keys(r.body).length === 0) return onClose();
    try {
      const out = await save.mutateAsync(r.body);
      toast.success(node ? "Saved." : "Added.");
      onSaved?.(out);
      onClose();
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };

  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title={node ? `Edit ${node.name}` : "Add to the fiber plant"}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton onClick={onSave} disabled={save.isPending}>
            {save.isPending && <Spinner />} {node ? "Save" : "Add"}
          </MButton>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select
            className={M_INPUT}
            value={d.kind}
            onChange={(e) => set("kind")(e.target.value as NodeDraft["kind"])}
          >
            {FIBER_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <select
            className={M_INPUT}
            value={d.status}
            onChange={(e) => set("status")(e.target.value as NodeDraft["status"])}
          >
            {FIBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Name" required value={d.name} onChange={set("name")} />
        <TextField
          label="Code (optional)"
          value={d.code}
          onChange={set("code")}
          hint="Your tag on the box, unique per ISP."
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Upstream node</span>
          <select
            className={M_INPUT}
            value={d.parent_id}
            onChange={(e) => {
              set("parent_id")(e.target.value);
              if (!e.target.value) set("parent_port")("");
            }}
          >
            <option value="">None (top of the plant)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {kindLabel(p.kind)} · {p.name}
                {p.code ? ` (${p.code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Upstream port"
          value={d.parent_port}
          onChange={set("parent_port")}
          disabled={!d.parent_id}
          hint={
            parent?.port_count
              ? `1-${parent.port_count} on ${parent.name}`
              : d.parent_id
                ? "That node has no numbered ports"
                : undefined
          }
        />
        {kindTakesPorts(d.kind) && (
          <TextField
            label="Ports"
            value={d.port_count}
            onChange={set("port_count")}
            hint="Numbered outputs, e.g. 8 for a 1:8 splitter."
          />
        )}
        <TextField
          label="Spec (optional)"
          value={d.spec}
          onChange={set("spec")}
          placeholder="e.g. 1:8 PLC, 16-port GPON"
        />
        <TextField label="Latitude" value={d.latitude} onChange={set("latitude")} />
        <TextField label="Longitude" value={d.longitude} onChange={set("longitude")} />
        <div className="sm:col-span-2">
          <TextField label="Address / landmark" value={d.address} onChange={set("address")} />
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Customer (optional)</span>
          <CustomerSelect
            value={d.isp_customer_id}
            onChange={set("isp_customer_id")}
            customers={customers.data}
            allLabel="Shared plant (no customer)"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          <textarea
            className={`${M_INPUT} min-h-[64px]`}
            value={d.notes}
            onChange={(e) => set("notes")(e.target.value)}
          />
        </label>
      </div>
      <FormError message={err} />
    </MDialog>
  );
}
