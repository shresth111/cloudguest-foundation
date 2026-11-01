/** PPPoE sessions across the ISP's customers (lane JAZE-6). Refreshes every
 * 30 s; a session is "live" until RADIUS accounting says it stopped. */
import { useState } from "react";
import { Cable } from "lucide-react";
import { MEmptyState, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { PppoeSessionTable } from "@/components/isp-partner/pppoe/PppoeSessionTable";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { usePppoeSessions } from "@/hooks/isp-partner/usePppoe";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { PppoeSessionStatus } from "@/services/isp-partner/pppoe-types";

export function PppoeSessionsView() {
  const customers = useIspCustomerOptions();
  const [status, setStatus] = useState<PppoeSessionStatus | "all">("active");
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = usePppoeSessions({
    status: status === "all" ? undefined : status,
    isp_customer_id: customerId || undefined,
    search: debounced || undefined,
    page,
    page_size: 50,
  });
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MSeg<PppoeSessionStatus | "all">
          value={status}
          onChange={reset(setStatus)}
          options={[
            { value: "active", label: "Live" },
            { value: "closed", label: "Ended" },
            { value: "all", label: "All" },
          ]}
        />
        <div className="w-full max-w-[220px]">
          <CustomerSelect
            value={customerId}
            onChange={reset(setCustomerId)}
            customers={customers.data}
          />
        </div>
        <input
          className={`${M_INPUT} w-full max-w-[240px]`}
          placeholder="Username, IP or MAC"
          value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          aria-label="Search sessions"
        />
      </div>
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="PPPoE sessions" />
      ) : q.data && q.data.items.length === 0 ? (
        <MEmptyState
          icon={Cable}
          title={status === "active" ? "Nobody is on PPPoE right now" : "No sessions"}
          description="Sessions appear once a router runs the PPPoE server step and a subscriber signs in."
        />
      ) : (
        <>
          <PppoeSessionTable sessions={q.data?.items ?? []} loading={q.isLoading} />
          {q.data && q.data.pages > 1 && (
            <Pager page={q.data.page} pages={q.data.pages} total={q.data.total} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}
