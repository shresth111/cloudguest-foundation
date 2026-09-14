import { useEffect, useState } from "react";
import { isDemo } from "@/services/customer.service";
import { ispService } from "@/services/isp.service";
import type { WanSummaryState } from "./dashboard.types";
import { DEMO_WAN_LINK, DEMO_WAN_BACKUP_LINK, DEMO_WAN_CHECKS } from "./dashboard.types";

export function useWanSummary(locationId: string): WanSummaryState {
  const [state, setState] = useState<WanSummaryState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    if (isDemo()) {
      setState({
        status: "ready",
        links: [DEMO_WAN_LINK, DEMO_WAN_BACKUP_LINK],
        checks: DEMO_WAN_CHECKS,
      });
      return;
    }
    (async () => {
      try {
        const { rows } = await ispService.listLinks({ page: 1, pageSize: 100, locationId });
        const links = rows
          .filter((l) => l.locationId === locationId)
          .sort((a, b) => {
            if (a.isActiveUplink !== b.isActiveUplink) return a.isActiveUplink ? -1 : 1;
            if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
            return a.priority - b.priority;
          })
          .slice(0, 2);
        if (!alive) return;
        if (links.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const checks = await ispService
          .listHealthChecks(links[0].id, { page: 1, pageSize: 12, locationId })
          .then((r) => r.rows)
          .catch(() => []);
        if (!alive) return;
        setState({ status: "ready", links, checks });
      } catch {
        if (alive) setState({ status: "empty" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationId]);
  return state;
}
