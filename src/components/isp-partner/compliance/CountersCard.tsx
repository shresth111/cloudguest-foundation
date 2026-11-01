/** Subscriber state tiles for the overview (J4). Each tile's tooltip is the
 * backend's own definition, so the numbers explain themselves. */
import { MStat, type MStatTone } from "@/components/master/MasterKit";
import { Card, ErrorBlock } from "@/components/isp-partner/kit";
import { useComplianceCounters } from "@/hooks/isp-partner/useCompliance";
import { formatNumber } from "@/lib/isp-partner/format";

const TILES: { key: string; label: string; tone?: MStatTone }[] = [
  { key: "online", label: "Online now", tone: "success" },
  { key: "active", label: "Active" },
  { key: "expiring_7d", label: "Expiring in 7 days", tone: "warning" },
  { key: "expired", label: "Expired" },
  { key: "suspended", label: "Suspended", tone: "danger" },
  { key: "frozen", label: "Frozen" },
  { key: "blocked", label: "Blocked", tone: "danger" },
  { key: "churned", label: "Churned" },
  { key: "new_7d", label: "New in 7 days" },
  { key: "scheduled_renewals", label: "Billing cycles due (7 days)" },
  { key: "total", label: "Total subscribers" },
];

export function CountersCard() {
  const q = useComplianceCounters();
  if (q.error)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="subscriber counts" />;
  const c = q.data?.counters as Record<string, number> | undefined;
  return (
    <Card title="Subscribers">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t) => (
          <div key={t.key} title={q.data?.definitions[t.key]}>
            <MStat
              label={t.label}
              value={c ? formatNumber(c[t.key]) : "—"}
              tone={t.tone}
              loading={q.isLoading}
            />
          </div>
        ))}
      </div>
      {q.data && (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatNumber(q.data.online_sessions)} Wi-Fi sessions are active across your customers.
          Each subscriber is counted in one state; hover a tile for its definition.
        </p>
      )}
    </Card>
  );
}
