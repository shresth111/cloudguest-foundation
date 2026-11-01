/** `/partner/pppoe` (Phase 2b, lane JAZE-6): live/ended PPPoE sessions,
 * subscriber PPPoE logins, and the router PPPoE server step. Everything
 * answers 404 while `ISP_PPPOE_ENABLED` is off; the page then says so. */
import { useState } from "react";
import { Cable } from "lucide-react";
import { MEmptyState, MSectionHeader, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { PppoeScriptPanel } from "@/components/isp-partner/pppoe/PppoeScriptPanel";
import { PppoeSessionsView } from "@/components/isp-partner/pppoe/PppoeSessionsView";
import { SubscriberPppoePanel } from "@/components/isp-partner/pppoe/SubscriberPppoePanel";
import { useIspRouters } from "@/hooks/isp-partner/useIsp";
import { useSubscribers } from "@/hooks/isp-partner/usePlans";
import { usePppoeStatus } from "@/hooks/isp-partner/usePppoe";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isNotFound } from "@/lib/isp-partner/errors";
import type { PppoeStatus } from "@/services/isp-partner/pppoe-types";

export const PPPOE_TABS = ["sessions", "logins", "routers"] as const;
export type PppoeTab = (typeof PPPOE_TABS)[number];

const LABEL: Record<PppoeTab, string> = {
  sessions: "Sessions",
  logins: "Subscriber logins",
  routers: "Router setup",
};

export function PppoePage({ tab, onTab }: { tab: PppoeTab; onTab: (t: PppoeTab) => void }) {
  const status = usePppoeStatus();
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Network"
        title="PPPoE"
        description="Subscribers who sign in over PPPoE with a username and password, checked against their package here."
      />
      {status.isLoading ? (
        <LoadingBlock />
      ) : status.error && isNotFound(status.error) ? (
        <MEmptyState
          icon={Cable}
          title="PPPoE is not switched on"
          description="PPPoE for your network is not switched on yet. Ask Wyfy Guest support to turn it on."
        />
      ) : status.error || !status.data ? (
        <ErrorBlock error={status.error} onRetry={() => status.refetch()} what="PPPoE" />
      ) : (
        <>
          <MSeg<PppoeTab>
            value={tab}
            onChange={onTab}
            options={PPPOE_TABS.map((t) => ({ value: t, label: LABEL[t] }))}
          />
          {tab === "sessions" && <PppoeSessionsView />}
          {tab === "logins" && <LoginsTab />}
          {tab === "routers" && <RoutersTab defaults={status.data.defaults} />}
        </>
      )}
    </div>
  );
}

function LoginsTab() {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const subs = useSubscribers({ search: debounced || undefined, page: 1, page_size: 20 });
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card title="Subscriber">
        <input
          className={M_INPUT}
          placeholder="Search username, name or circuit ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Find a subscriber"
        />
        {subs.error ? <ErrorBlock error={subs.error} what="subscribers" /> : null}
        <ul className="mt-2 max-h-[28rem] space-y-0.5 overflow-y-auto">
          {(subs.data?.items ?? []).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${picked === s.id ? "bg-muted font-medium" : ""}`}
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
      </Card>
      {picked ? (
        <SubscriberPppoePanel key={picked} subscriberId={picked} />
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            Pick a subscriber to set up or change their PPPoE login.
          </p>
        </Card>
      )}
    </div>
  );
}

function RoutersTab({ defaults }: { defaults: PppoeStatus["defaults"] }) {
  const routers = useIspRouters({ page: 1, page_size: 100 });
  const [routerId, setRouterId] = useState("");
  const router = routers.data?.items.find((r) => r.id === routerId);
  return (
    <div className="space-y-4">
      <Card title="Router">
        {routers.error ? (
          <ErrorBlock error={routers.error} onRetry={() => routers.refetch()} what="routers" />
        ) : (
          <select
            className={M_INPUT}
            value={routerId}
            onChange={(e) => setRouterId(e.target.value)}
            aria-label="Router"
          >
            <option value="">Pick a router…</option>
            {(routers.data?.items ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.location_name} · {r.customer_name}
              </option>
            ))}
          </select>
        )}
      </Card>
      {router && (
        <PppoeScriptPanel
          key={router.id}
          routerId={router.id}
          routerName={router.name}
          defaults={defaults}
        />
      )}
    </div>
  );
}
