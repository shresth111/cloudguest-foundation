/** "If this goes dark, who is affected?" (J22): every node below it and the
 * subscribers on their ports. On demand, since it walks the subtree. */
import { useState } from "react";
import { MButton, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { useFiberDownstream } from "@/hooks/isp-partner/useFiber";
import { kindLabel } from "@/lib/isp-partner/fiber";

export function FiberDownstreamCard({ nodeId }: { nodeId: string }) {
  const [on, setOn] = useState(false);
  const q = useFiberDownstream(nodeId, on);
  return (
    <Card
      title="Affected if this fails"
      actions={
        !on ? (
          <MButton variant="outline" onClick={() => setOn(true)}>
            Show affected subscribers
          </MButton>
        ) : undefined
      }
    >
      {!on ? (
        <p className="text-xs text-muted-foreground">
          Lists every subscriber fed through this node, for an outage message or a fault ticket.
        </p>
      ) : q.isLoading ? (
        <Spinner />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the affected list" />
      ) : (
        <div className="space-y-2">
          <p className="text-xs">
            <span className="font-semibold tabular-nums">{q.data.subscriber_count}</span> subscriber
            {q.data.subscriber_count === 1 ? "" : "s"} and{" "}
            <span className="font-semibold tabular-nums">{q.data.downstream_nodes}</span> node
            {q.data.downstream_nodes === 1 ? "" : "s"} below
            {Object.keys(q.data.downstream_by_kind).length > 0 &&
              ` (${Object.entries(q.data.downstream_by_kind)
                .map(([k, n]) => `${n} ${kindLabel(k)}`)
                .join(", ")})`}
            .
          </p>
          {q.data.subscribers.length > 0 && (
            <MTable
              head={
                <>
                  <MTh>Subscriber</MTh>
                  <MTh>Mobile</MTh>
                  <MTh>On</MTh>
                  <MTh>Status</MTh>
                </>
              }
            >
              {q.data.subscribers.map((s) => (
                <MTr key={s.subscriber_id}>
                  <MTd className="text-xs">
                    {s.label}
                    <p className="font-mono text-muted-foreground">{s.identifier}</p>
                  </MTd>
                  <MTd className="text-xs">{s.phone ?? "–"}</MTd>
                  <MTd className="text-xs">
                    {s.node_name} · port {s.port_no}
                  </MTd>
                  <MTd>
                    <MTag label={s.status} />
                  </MTd>
                </MTr>
              ))}
            </MTable>
          )}
        </div>
      )}
    </Card>
  );
}
