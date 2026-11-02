/**
 * `/partner/fiber` (J22, lane JAZE-6 B): the fiber plant registry. OLTs,
 * poles, splitters, joint closures and ONTs, each hanging off an upstream
 * node's port, with a map link, the subscriber on each port, and "who is
 * affected" for any node. Every route 404s while `ISP_FIBER_ENABLED` is off.
 */
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Network, Pencil, Plus, Trash2 } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSectionHeader,
  MTag,
  M_INPUT,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock, Pager, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { FiberDownstreamCard } from "@/components/isp-partner/fiber/FiberDownstreamCard";
import { FiberNodeDialog } from "@/components/isp-partner/fiber/FiberNodeDialog";
import { FiberPortsCard } from "@/components/isp-partner/fiber/FiberPortsCard";
import { useFiberMutation, useFiberNode, useFiberNodes } from "@/hooks/isp-partner/useFiber";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isNotFound } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { KIND_LABEL, STATUS_LABEL, kindLabel, statusTone } from "@/lib/isp-partner/fiber";
import { fiberService } from "@/services/isp-partner/fiber";
import {
  FIBER_KINDS,
  FIBER_STATUSES,
  type FiberKind,
  type FiberNode,
  type FiberStatus,
} from "@/services/isp-partner/fiber-types";

export function FiberPage({
  nodeId,
  onNode,
}: {
  nodeId: string | null;
  onNode: (id: string | null) => void;
}) {
  const { can } = usePartner();
  const [kind, setKind] = useState<FiberKind | "">("");
  const [status, setStatus] = useState<FiberStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<{ parentId?: string } | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useFiberNodes({
    kind: kind || undefined,
    status: status || undefined,
    search: debounced || undefined,
    page,
    page_size: 50,
  });
  const off = q.error && isNotFound(q.error);

  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Network"
        title="Fiber plant"
        description="Your OLTs, splitters and drops: what feeds what, where it is, and who is on each port."
        actions={
          can("isp_partner.update") && !off ? (
            <MButton onClick={() => setAdding({})}>
              <Plus /> Add node
            </MButton>
          ) : undefined
        }
      />
      {off ? (
        <MEmptyState
          icon={Network}
          title="The fiber registry is not switched on"
          description="Ask Wyfy Guest support to turn it on for your network."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card title="Nodes">
            <div className="space-y-2">
              <input
                className={M_INPUT}
                placeholder="Search name, code or address"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search nodes"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={M_INPUT}
                  value={kind}
                  aria-label="Type"
                  onChange={(e) => {
                    setKind(e.target.value as FiberKind | "");
                    setPage(1);
                  }}
                >
                  <option value="">All types</option>
                  {FIBER_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <select
                  className={M_INPUT}
                  value={status}
                  aria-label="Status"
                  onChange={(e) => {
                    setStatus(e.target.value as FiberStatus | "");
                    setPage(1);
                  }}
                >
                  <option value="">Any status</option>
                  {FIBER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {q.error ? (
              <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the fiber plant" />
            ) : q.isLoading ? (
              <LoadingBlock />
            ) : (q.data?.items ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing yet. Start with the OLT, then add splitters under it.
              </p>
            ) : (
              <ul className="mt-2 max-h-[32rem] space-y-0.5 overflow-y-auto">
                {q.data?.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${nodeId === n.id ? "bg-muted font-medium" : ""}`}
                      onClick={() => onNode(n.id)}
                    >
                      {n.name}
                      <span className="block text-xs text-muted-foreground">
                        {kindLabel(n.kind)}
                        {n.code ? ` · ${n.code}` : ""}
                        {n.port_count ? ` · ${n.port_count} ports` : ""}
                        {n.status !== "active"
                          ? ` · ${STATUS_LABEL[n.status as FiberStatus] ?? n.status}`
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.data && q.data.pages > 1 && (
              <Pager
                page={q.data.page}
                pages={q.data.pages}
                total={q.data.total}
                onPage={setPage}
              />
            )}
          </Card>
          {nodeId ? (
            <NodeDetail
              key={nodeId}
              nodeId={nodeId}
              onOpen={onNode}
              onAddChild={(id) => setAdding({ parentId: id })}
            />
          ) : (
            <Card>
              <p className="text-sm text-muted-foreground">Pick a node to see its ports.</p>
            </Card>
          )}
        </div>
      )}
      {adding && (
        <FiberNodeDialog
          node={null}
          parentId={adding.parentId}
          onClose={() => setAdding(null)}
          onSaved={(n) => onNode(n.id)}
        />
      )}
    </div>
  );
}

function NodeDetail({
  nodeId,
  onOpen,
  onAddChild,
}: {
  nodeId: string;
  onOpen: (id: string | null) => void;
  onAddChild: (parentId: string) => void;
}) {
  const { can } = usePartner();
  const q = useFiberNode(nodeId);
  const [editing, setEditing] = useState<FiberNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const del = useFiberMutation(() => fiberService.remove(nodeId));
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this node" />;
  const n = q.data;
  return (
    <div className="space-y-4">
      <Card
        title={n.name}
        actions={
          <>
            <MTag label={kindLabel(n.kind)} />
            <MTag
              label={STATUS_LABEL[n.status as FiberStatus] ?? n.status}
              tone={statusTone(n.status)}
            />
            {can("isp_partner.update") && (
              <>
                <MButton variant="outline" onClick={() => setEditing(n)}>
                  <Pencil /> Edit
                </MButton>
                {n.kind !== "ont" && (
                  <MButton variant="outline" onClick={() => onAddChild(n.id)}>
                    <Plus /> Add below
                  </MButton>
                )}
              </>
            )}
            {can("isp_partner.manage") && (
              <MButton variant="ghost" title="Delete" onClick={() => setDeleting(true)}>
                <Trash2 />
              </MButton>
            )}
          </>
        }
      >
        {n.route.length > 1 && (
          <ol className="mb-3 flex flex-wrap items-center gap-1 text-xs">
            {n.route.map((h, i) => (
              <li key={h.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">›</span>}
                {h.id === n.id ? (
                  <span className="font-medium">
                    {h.name}
                    {h.parent_port ? ` (port ${h.parent_port})` : ""}
                  </span>
                ) : (
                  <button type="button" className="hover:underline" onClick={() => onOpen(h.id)}>
                    {h.name}
                    {i > 0 && h.parent_port ? ` (port ${h.parent_port})` : ""}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Code</dt>
          <dd>{n.code ?? "–"}</dd>
          <dt className="text-muted-foreground">Spec</dt>
          <dd>{n.spec ?? "–"}</dd>
          <dt className="text-muted-foreground">Ports</dt>
          <dd>
            {n.port_count ? `${n.ports_assigned} subscribers on ${n.port_count}` : "–"}
            {n.child_count ? ` · ${n.child_count} node(s) below` : ""}
          </dd>
          <dt className="text-muted-foreground">Location</dt>
          <dd>
            {n.address ?? ""}
            {n.maps_url && (
              <a
                href={n.maps_url}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
              >
                <MapPin className="size-3" /> Open in Google Maps
              </a>
            )}
            {!n.address && !n.maps_url && "–"}
          </dd>
          {n.notes && (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{n.notes}</dd>
            </>
          )}
        </dl>
      </Card>
      <FiberPortsCard node={n} onOpenNode={(id) => onOpen(id)} />
      <FiberDownstreamCard nodeId={n.id} />
      {editing && <FiberNodeDialog node={editing} onClose={() => setEditing(null)} />}
      <MDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${n.name}?`}
        footer={
          <>
            <MButton variant="outline" onClick={() => setDeleting(false)}>
              Cancel
            </MButton>
            <MButton
              className="bg-rose-600 hover:bg-rose-700"
              disabled={del.isPending}
              onClick={async () => {
                try {
                  await del.mutateAsync(undefined);
                  toast.success("Deleted.");
                  setDeleting(false);
                  onOpen(null);
                } catch (e) {
                  ispToastError(e);
                }
              }}
            >
              {del.isPending && <Spinner />} Delete
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          The API refuses while anything still hangs below it or a subscriber is on one of its
          ports; move those first.
        </p>
      </MDialog>
    </div>
  );
}
