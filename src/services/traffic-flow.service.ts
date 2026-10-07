/**
 * Master console calls for NetFlow/IPFIX traffic flow. Every route is
 * GLOBAL-pinned on the backend (`traffic_flows.read` / `.update`); an
 * org-scoped session gets 403 by design. Nothing in the customer dashboard may
 * import this file -- per-guest traffic metadata is operator-only
 * (~/wyfy-ops/netflow/DESIGN.md §7).
 *
 * `api`'s response interceptor already unwraps the `{success, data}` envelope.
 */
import { api } from "./api";
import { toApplyResult, toConfigPreview, toTrafficFlowOverview } from "@/lib/traffic-flow";
import type {
  TrafficFlowApplyResult,
  TrafficFlowConfigPreview,
  TrafficFlowOverview,
} from "@/types/traffic-flow";

export const trafficFlowService = {
  async overview(minutes = 60): Promise<TrafficFlowOverview> {
    const { data } = await api.get("/platform/traffic-flow/overview", { params: { minutes } });
    return toTrafficFlowOverview(data ?? {});
  },

  /** The RouterOS lines the generator renders for this router, plus every
   * reason it is not eligible. Database read only. */
  async config(routerId: string): Promise<TrafficFlowConfigPreview> {
    const { data } = await api.get(`/platform/traffic-flow/routers/${routerId}/config`);
    return toConfigPreview(data ?? {});
  },

  /** `dryRun` defaults to true: the backend reads the router and returns the
   * planned writes without writing. */
  async apply(
    routerId: string,
    opts: { enabled: boolean; dryRun: boolean },
  ): Promise<TrafficFlowApplyResult> {
    const { data } = await api.post(`/platform/traffic-flow/routers/${routerId}/apply`, {
      enabled: opts.enabled,
      dry_run: opts.dryRun,
    });
    return toApplyResult(data ?? {});
  },
};
