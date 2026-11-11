/** IPLOGS-SELFSERVE endpoints. All 404 while ISP_IPLOGS_SELFSERVE_ENABLED is off. */
import api from "@/services/api";

export type IpLogsPipeState =
  | "receiving"
  | "silent"
  | "awaiting_first"
  | "not_set_up"
  | "collector_off";

export type IpLogsState =
  | "logs_arriving"
  | "waiting"
  | "not_set_up"
  | "offline"
  | "silent"
  | "needs_link"
  | "not_supported"
  /** [POSTFIX-1] D12: some pipes arrive, a set-up pipe stopped or never started. */
  | "partial";

export interface IpLogsPipe {
  state: IpLogsPipeState;
  last_at: string | null;
  last_at_ist: string | null;
  count_last_hour: number;
}

export interface IpLogsWarning {
  code: string;
  message: string;
}

export interface IpLogsStatus {
  isp_router_id: string;
  router_name: string;
  isp_customer_id: string;
  customer_name: string | null;
  isp_location_id: string | null;
  location_name: string | null;
  router_status: string;
  routeros_version: string | null;
  state: IpLogsState;
  state_label: string;
  blocker: "needs_link" | "not_mikrotik" | null;
  blocker_hint?: string | null;
  /** FR-IPLOGS-ZONE: sent to a franchisee only. false = the router is outside
   * its zones (e.g. a shared site), so the switch is read-only. */
  can_change?: boolean;
  set_up: boolean;
  set_up_at: string | null;
  /** DEFAULT-LOGS: the ISP's recorded choice; null = router added before it
   * (nothing switched on silently). Absent on an older backend. */
  wanted?: boolean | null;
  /** DEFAULT-LOGS: what the "IP logs: ON / OFF" switch shows. */
  switch_on?: boolean;
  collectors: { syslog: boolean; flows: boolean };
  pipes: { syslog: IpLogsPipe; flows: IpLogsPipe; nat: IpLogsPipe };
  warnings?: IpLogsWarning[];
  clock_offset_seconds?: number | null;
}

export interface IpLogsScript {
  isp_router_id: string;
  available: boolean;
  blocker: "needs_link" | "not_mikrotik" | null;
  enable_script: string[] | null;
  disable_script: string[] | null;
  /** DEFAULT-LOGS: the same lines in the form the setup script embeds. */
  setup_lines?: string[] | null;
  filename: string | null;
  router_name_on_device: string;
  tag: string;
}

export interface IpLogsFleet {
  items: IpLogsStatus[];
  summary: Partial<Record<IpLogsState, number>>;
  collectors: { syslog: boolean; flows: boolean };
}

/** DEFAULT-LOGS probe (`GET /isp/ip-logs/features`). */
export interface IpLogsFeatures {
  default_on_add_router: boolean;
  setup_script_lines: boolean;
  switch: boolean;
}

export const ipLogsService = {
  async features(): Promise<IpLogsFeatures> {
    const { data } = await api.get<IpLogsFeatures>("/isp/ip-logs/features");
    return data;
  },
  async status(ispRouterId: string): Promise<IpLogsStatus> {
    const { data } = await api.get<IpLogsStatus>(`/isp/routers/${ispRouterId}/ip-logs`);
    return data;
  },
  async script(ispRouterId: string): Promise<IpLogsScript> {
    const { data } = await api.get<IpLogsScript>(`/isp/routers/${ispRouterId}/ip-logs/script`);
    return data;
  },
  async enable(ispRouterId: string): Promise<IpLogsStatus> {
    const { data } = await api.post<IpLogsStatus>(`/isp/routers/${ispRouterId}/ip-logs/enable`);
    return data;
  },
  async disable(ispRouterId: string): Promise<IpLogsStatus> {
    const { data } = await api.post<IpLogsStatus>(`/isp/routers/${ispRouterId}/ip-logs/disable`);
    return data;
  },
  async fleet(ispCustomerId?: string): Promise<IpLogsFleet> {
    const { data } = await api.get<IpLogsFleet>("/isp/ip-logs/routers", {
      params: ispCustomerId ? { isp_customer_id: ispCustomerId } : {},
    });
    return data;
  },
};
