/**
 * Settings → Zone tree (ZONE-1): put zones under other zones, any depth.
 * Add a sub-zone, move, rename, delete (only an empty zone with no
 * sub-zones). Contact, address, GSTIN and the operator name shown on
 * invoices stay in Finance tools → Zones (JAZE-4's zone profile).
 *
 * Renders nothing while zones are switched off for this ISP (tree 404), so
 * the flat Zones card above stays the only zone UI.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CornerDownRight, FolderTree, MoveRight, Pencil, Plus, Trash2 } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useZoneTree, useZoneTreeMutation } from "@/hooks/isp-partner/useZoneTree";
import { zoneTreeService } from "@/services/isp-partner/zones";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import { ispFormMessage } from "@/lib/isp-partner/form-errors";
import {
  allowedParents,
  buildZoneTree,
  zonePathLabel,
  type ZoneTreeItem,
} from "@/lib/isp-partner/zones";
import type { ZoneNode } from "@/services/isp-partner/zones-types";
import { ZoneCouponRightControl } from "@/components/isp-partner/zones/ZoneCouponRightControl"; // RAKESH-P1

type Action =
  | { kind: "add"; parent: ZoneNode | null }
  | { kind: "rename"; zone: ZoneNode }
  | { kind: "move"; zone: ZoneNode }
  | { kind: "delete"; zone: ZoneNode };

function Rows({
  items,
  manage,
  onAction,
}: {
  items: ZoneTreeItem[];
  manage: boolean;
  onAction: (a: Action) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ node, children }) => (
        <li key={node.id}>
          <div className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50">
            {node.depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-sm font-medium">{node.name}</span>
            {node.city && <span className="text-xs text-muted-foreground">{node.city}</span>}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {node.customers} customers · {node.subscribers} subscribers
              {node.children > 0 &&
                ` (with sub-zones: ${node.subtree_customers} · ${node.subtree_subscribers})`}
            </span>
            <ZoneCouponRightControl zoneId={node.id} zoneName={node.name} manage={manage} />{" "}
            {/* RAKESH-P1 */}
            {manage && (
              <span className="ml-auto flex gap-0.5">
                <MButton
                  variant="ghost"
                  title="Add a sub-zone"
                  aria-label={`Add a sub-zone under ${node.name}`}
                  onClick={() => onAction({ kind: "add", parent: node })}
                >
                  <Plus />
                </MButton>
                <MButton
                  variant="ghost"
                  title="Rename"
                  aria-label={`Rename ${node.name}`}
                  onClick={() => onAction({ kind: "rename", zone: node })}
                >
                  <Pencil />
                </MButton>
                <MButton
                  variant="ghost"
                  title="Move"
                  aria-label={`Move ${node.name}`}
                  onClick={() => onAction({ kind: "move", zone: node })}
                >
                  <MoveRight />
                </MButton>
                <MButton
                  variant="ghost"
                  title={
                    node.can_delete
                      ? "Delete"
                      : "Only an empty zone without sub-zones can be deleted"
                  }
                  aria-label={`Delete ${node.name}`}
                  disabled={!node.can_delete}
                  onClick={() => onAction({ kind: "delete", zone: node })}
                >
                  <Trash2 />
                </MButton>
              </span>
            )}
          </div>
          {children.length > 0 && (
            <div className="ml-4 border-l border-border pl-2">
              <Rows items={children} manage={manage} onAction={onAction} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActionDialog({
  action,
  nodes,
  onClose,
}: {
  action: Action;
  nodes: ZoneNode[];
  onClose: () => void;
}) {
  const [name, setName] = useState(action.kind === "rename" ? action.zone.name : "");
  const [city, setCity] = useState("");
  const [parentId, setParentId] = useState(
    action.kind === "move" ? (action.zone.parent_id ?? "") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const run = useZoneTreeMutation(async () => {
    if (action.kind === "add")
      return zoneTreeService.create({
        name: name.trim(),
        parent_id: action.parent?.id ?? null,
        city: city.trim() || null,
      });
    if (action.kind === "rename") return zoneTreeService.rename(action.zone.id, name.trim());
    if (action.kind === "move") return zoneTreeService.move(action.zone.id, parentId || null);
    return zoneTreeService.remove(action.zone.id);
  });
  const parents = action.kind === "move" ? allowedParents(nodes, action.zone.id) : [];
  const title =
    action.kind === "add"
      ? action.parent
        ? `Add a sub-zone under ${action.parent.name}`
        : "Add a top-level zone"
      : action.kind === "rename"
        ? `Rename ${action.zone.name}`
        : action.kind === "move"
          ? `Move ${action.zone.name}`
          : `Delete ${action.zone.name}?`;

  const submit = async () => {
    if ((action.kind === "add" || action.kind === "rename") && !name.trim())
      return setError("A name is required.");
    if ((action.kind === "add" || action.kind === "rename") && name.trim().length > 100)
      return setError("At most 100 characters.");
    setError(null);
    try {
      await run.mutateAsync(undefined);
      toast.success(
        action.kind === "add"
          ? "Zone added."
          : action.kind === "rename"
            ? "Zone renamed."
            : action.kind === "move"
              ? "Zone moved."
              : "Zone deleted.",
      );
      onClose();
    } catch (err) {
      setError(ispFormMessage(err, { name: "Name", parent_id: "Parent zone" }));
    }
  };

  return (
    <MDialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            className={action.kind === "delete" ? "bg-destructive text-destructive-foreground" : ""}
            disabled={run.isPending}
            onClick={submit}
          >
            {run.isPending && <Spinner />} {action.kind === "delete" ? "Delete" : "Save"}
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {(action.kind === "add" || action.kind === "rename") && (
          <TextField label="Name" value={name} onChange={setName} required />
        )}
        {action.kind === "add" && (
          <TextField label="City (optional)" value={city} onChange={setCity} />
        )}
        {action.kind === "move" && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">New parent</span>
            <select
              className={M_INPUT}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (top level)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {zonePathLabel(p)}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-muted-foreground">
              Its sub-zones move with it. A zone cannot go under itself or its own sub-zones.
            </span>
          </label>
        )}
        {action.kind === "delete" && (
          <p className="text-muted-foreground">
            The zone has no sub-zones, customers or subscribers, so nothing else changes.
          </p>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function ZoneTreeCard() {
  const { can } = usePartner();
  const manage = can("isp_zones.manage");
  const q = useZoneTree();
  const [action, setAction] = useState<Action | null>(null);
  const nodes = useMemo(() => q.data?.items ?? [], [q.data]);
  const forest = useMemo(() => buildZoneTree(nodes), [nodes]);
  if (ispErrorStatus(q.error) === 404) return null;

  return (
    <Card
      title="Zone tree"
      actions={
        manage && (
          <MButton variant="outline" onClick={() => setAction({ kind: "add", parent: null })}>
            <Plus /> Add zone
          </MButton>
        )
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Put zones under other zones to match your areas. Choosing a zone with Switch zone shows it
        together with everything under it. Zones have no login of their own.
        {q.data?.ledger_enabled && (
          <>
            {" "}
            Contact, address, GSTIN and the name printed on invoices are set in{" "}
            <Link to="/partner/finance" className="text-primary hover:underline">
              Finance tools
            </Link>
            .
          </>
        )}
      </p>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the zone tree" />
      ) : forest.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderTree className="h-4 w-4" /> No zones yet.
        </p>
      ) : (
        <Rows items={forest} manage={manage} onAction={setAction} />
      )}
      {action && <ActionDialog action={action} nodes={nodes} onClose={() => setAction(null)} />}
    </Card>
  );
}
