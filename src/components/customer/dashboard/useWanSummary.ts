import { useEffect, useState } from "react";
import { isDemo } from "@/services/customer.service";
import { ispService } from "@/services/isp.service";
import type { IspHealthCheck } from "@/types/isp";
import type { WanSummaryState } from "./dashboard.types";
import { demoIspLinks } from "@/lib/demo-world";
import { demoIspChecks } from "@/components/customer/isp/isp.demo";

export function useWanSummary(locationId: string): WanSummaryState {
  const [state, setState] = useState<WanSummaryState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    if (isDemo()) {
      // The venue's own lines from the demo world -- the same rows and
      // the same recent checks the Internet Connection page shows.
      const links = demoIspLinks(locationId).slice(0, 2);
      setState(
        links.length === 0
          ? { status: "empty" }
          : {
              status: "ready",
              links,
              // Oldest first, like the real 12-row read reversed for the ticks.
              checks: Object.fromEntries(
                links.map((l) => [l.id, demoIspChecks(l.id).slice(0, 12).reverse()]),
              ),
            },
      );
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
        // One history read per uplink (at most two), so each ISP gets its
        // own timeline. A failed read only blanks that link's ticks.
        const histories = await Promise.all(
          links.map((l) =>
            ispService
              .listHealthChecks(l.id, { page: 1, pageSize: 12, locationId })
              .then((r) => r.rows)
              .catch(() => [] as IspHealthCheck[]),
          ),
        );
        const checks: Record<string, IspHealthCheck[]> = {};
        links.forEach((l, i) => {
          checks[l.id] = histories[i];
        });
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
