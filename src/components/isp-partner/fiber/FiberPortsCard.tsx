/** Ports of one node (J22): free, feeding another node, or a subscriber's
 * drop. A subscriber sits on one port at a time (free it to move them). */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog, MTag, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useFiberMutation, useFiberPorts } from "@/hooks/isp-partner/useFiber";
import { useSubscribers } from "@/hooks/isp-partner/usePlans";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { kindLabel, portSummary } from "@/lib/isp-partner/fiber";
import { fiberService } from "@/services/isp-partner/fiber";
import type { FiberNodeDetail } from "@/services/isp-partner/fiber-types";

export function FiberPortsCard({
  node,
  onOpenNode,
}: {
  node: FiberNodeDetail;
  onOpenNode: (id: string) => void;
}) {
  const { can } = usePartner();
  const editable = can("isp_partner.update");
  const q = useFiberPorts(node.id, !!node.port_count);
  const [assigning, setAssigning] = useState<number | null>(null);
  const release = useFiberMutation((port: number) => fiberService.releasePort(node.id, port));
  if (!node.port_count) return null;
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the ports" />;
  const sum = portSummary(q.data);
  return (
    <Card
      title={`Ports (${sum.free} free of ${sum.total})`}
      actions={
        <span className="text-xs text-muted-foreground">
          {sum.subscribers} subscriber{sum.subscribers === 1 ? "" : "s"} · {sum.nodes} onward
        </span>
      }
    >
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {q.data.map((p) => (
          <li
            key={p.port_no}
            className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <span className="w-8 font-mono tabular-nums text-muted-foreground">#{p.port_no}</span>
            {p.state === "free" ? (
              <>
                <MTag label="Free" tone="normal" />
                {editable && (
                  <MButton
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setAssigning(p.port_no)}
                  >
                    Assign
                  </MButton>
                )}
              </>
            ) : p.state === "node" ? (
              <button
                type="button"
                className="truncate text-left hover:underline"
                onClick={() => onOpenNode(p.node.id)}
              >
                {kindLabel(p.node.kind)} · {p.node.name}
              </button>
            ) : p.subscriber ? (
              <>
                <span className="min-w-0 truncate">
                  <span className="font-medium">{p.subscriber.label}</span>{" "}
                  <span className="font-mono text-muted-foreground">{p.subscriber.identifier}</span>
                </span>
                {editable && (
                  <MButton
                    variant="ghost"
                    className="ml-auto"
                    disabled={release.isPending}
                    onClick={async () => {
                      try {
                        await release.mutateAsync(p.port_no);
                        toast.success(`Port ${p.port_no} freed.`);
                      } catch (e) {
                        toast.error(ispErrorMessage(e));
                      }
                    }}
                  >
                    Free
                  </MButton>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">In use (a customer outside your access)</span>
            )}
          </li>
        ))}
      </ul>
      {assigning !== null && (
        <AssignDialog nodeId={node.id} port={assigning} onClose={() => setAssigning(null)} />
      )}
    </Card>
  );
}

function AssignDialog({
  nodeId,
  port,
  onClose,
}: {
  nodeId: string;
  port: number;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const subs = useSubscribers({ search: debounced || undefined, page: 1, page_size: 20 });
  const assign = useFiberMutation(() => fiberService.assignPort(nodeId, port, picked, notes));
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Assign port ${port}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={!picked || assign.isPending}
            onClick={async () => {
              setErr(null);
              try {
                await assign.mutateAsync(undefined);
                toast.success(`Port ${port} assigned.`);
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {assign.isPending && <Spinner />} Assign
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <input
          className={M_INPUT}
          placeholder="Search username, name or circuit ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Find a subscriber"
        />
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {(subs.data?.items ?? []).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-left hover:bg-muted ${picked === s.id ? "bg-muted font-medium" : ""}`}
                onClick={() => setPicked(s.id)}
              >
                {s.display_name ?? s.identifier}
                <span className="block text-xs text-muted-foreground">
                  {s.identifier}
                  {s.circuit_id != null ? ` · CID ${s.circuit_id}` : ""}
                  {s.customer_name ? ` · ${s.customer_name}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <input
          className={M_INPUT}
          placeholder="Notes (optional), e.g. drop cable colour"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
        <FormError message={err} />
      </div>
    </MDialog>
  );
}
