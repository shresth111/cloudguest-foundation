/** NETMON-2 endpoints (ADDENDUM_06). All 404 while ISP_NETMON_ENABLED is off. */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export type TrafficRange = "day" | "week" | "month";

export interface TrafficPoint {
  at: string;
  in_mbps: number;
  out_mbps: number;
}

export interface TrafficCard {
  isp_router_id: string;
  name: string;
  customer_name: string | null;
  location_name: string | null;
  status: string;
  last_seen_ist: string | null;
  readable: boolean;
  reason:
    | "not_set_up"
    | "offline"
    | "monitoring_off"
    | "poll_failed"
    | "no_data_yet"
    | "controller_managed"
    | null;
  hint: string | null;
  wan_interface: string | null;
  wan_basis: "name" | "busiest" | "none";
  points: TrafficPoint[];
  peak_in_mbps: number | null;
  peak_out_mbps: number | null;
}

export interface TrafficOverview {
  range: TrafficRange;
  since: string;
  until: string;
  routers: TrafficCard[];
  basis: string;
}

export interface NetSession {
  kind: "hotspot" | "pppoe";
  session_id: string;
  isp_router_id: string | null;
  router_name: string | null;
  who: string | null;
  subscriber_id: string | null;
  circuit_id: number | null;
  mac: string | null;
  ip: string | null;
  started_at: string | null;
  ended_at: string | null;
  uptime_seconds: number | null;
  bytes_down: number;
  bytes_up: number;
  end_reason: string | null;
}

export interface NetSessionPage {
  items: NetSession[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  capped?: boolean;
}

export interface CompletedQuery {
  kind?: "hotspot" | "pppoe";
  search?: string;
  mac?: string;
  ip?: string;
  subscriber_id?: string;
  /** Plain YYYY-MM-DD. */
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

const clean = (q: object) =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== "" && v !== null),
  ) as Record<string, string>;

export const netmonService = {
  async traffic(range: TrafficRange): Promise<TrafficOverview> {
    const { data } = await api.get<TrafficOverview>("/isp/netmon/traffic", { params: { range } });
    return data;
  },
  async active(page: number, kind?: "hotspot" | "pppoe"): Promise<NetSessionPage> {
    const { data } = await api.get<NetSessionPage>("/isp/netmon/sessions/active", {
      params: clean({ page, page_size: 50, kind }),
    });
    return data;
  },
  async completed(q: CompletedQuery): Promise<NetSessionPage> {
    const { data } = await api.get<NetSessionPage>("/isp/netmon/sessions/completed", {
      params: clean(q),
    });
    return data;
  },
  exportCompleted(q: CompletedQuery): Promise<FileDownload> {
    const { page: _p, page_size: _s, ...rest } = q;
    return downloadFile("/isp/netmon/sessions/completed/export.csv", clean(rest), "sessions.csv");
  },
};
