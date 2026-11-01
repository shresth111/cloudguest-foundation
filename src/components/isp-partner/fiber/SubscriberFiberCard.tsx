/** Where one subscriber sits in the fiber plant (J22). Self-contained so the
 * Subscriber 360 page (JAZE-1) can mount it: `<SubscriberFiberCard
 * subscriberId=… />`. Renders nothing while the registry is switched off. */
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/isp-partner/kit";
import { useFiberSubscriberLocation } from "@/hooks/isp-partner/useFiber";
import { kindLabel } from "@/lib/isp-partner/fiber";

export function SubscriberFiberCard({ subscriberId }: { subscriberId: string }) {
  const q = useFiberSubscriberLocation(subscriberId);
  if (!q.data) return null;
  const loc = q.data;
  return (
    <Card title="Fiber route">
      {!loc.assigned ? (
        <p className="text-xs text-muted-foreground">Not on a splitter port yet.</p>
      ) : (
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {loc.route.map((h, i) => (
            <li key={h.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">›</span>}
              <Link
                to="/partner/fiber"
                search={{ node: h.id }}
                className="hover:underline"
                title={kindLabel(h.kind)}
              >
                {h.name}
                {i > 0 && h.parent_port ? ` (port ${h.parent_port})` : ""}
              </Link>
            </li>
          ))}
          <li className="text-muted-foreground">› port {loc.port_no}</li>
        </ol>
      )}
    </Card>
  );
}
