import { createFileRoute } from "@tanstack/react-router";
import { LogsPage } from "@/components/isp-partner/log-views/LogsPage";
import type { LogSearch } from "@/components/isp-partner/log-views/logFilters";

/** `/partner/logs`: NetLogs, IPDR and guest sign-ins across customers. The
 * filters live in the URL (TASKS FE-8). */
export const Route = createFileRoute("/partner/logs")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): LogSearch => {
    const out: LogSearch = {};
    for (const k of ["tab", "cust", "loc", "router", "range", "sev", "cat", "q"] as const) {
      const v = search[k];
      if (typeof v === "string" && v) out[k] = v;
    }
    return out;
  },
  component: LogsPage,
});
