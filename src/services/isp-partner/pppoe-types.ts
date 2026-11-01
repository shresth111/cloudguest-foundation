/** Phase 2b PPPoE (lane JAZE-6, ADDENDUM_02 §2b). Mirrors
 * `isp_partner/pppoe_router.py` + `pppoe_service.py` (BE branch
 * `feat/isp-jaze6-pppoe`). Every route 404s while `ISP_PPPOE_ENABLED` is off. */

/** `GET /isp/pppoe/status` (only answers when the feature is on). */
export interface PppoeStatus {
  enabled: true;
  defaults: {
    interface: string;
    local_address: string;
    pool_range: string;
    pool_cidr: string;
  };
}

export type PppoeSessionStatus = "active" | "closed";

/** `IspPppoeService.session_view`. */
export interface PppoeSession {
  id: string;
  subscriber_id: string | null;
  customer_id: string;
  location_id: string | null;
  router_id: string | null;
  username: string;
  acct_session_id: string;
  mac: string | null;
  ip: string | null;
  ipv6_prefix: string | null;
  delegated_ipv6_prefix: string | null;
  nas_port_id: string | null;
  started_at: string | null;
  last_update_at: string | null;
  stopped_at: string | null;
  status: PppoeSessionStatus | string;
  bytes_uploaded: number;
  bytes_downloaded: number;
  terminate_cause: string | null;
}

export type PppoeCredentialStatus = "active" | "disabled";

/** One router-side removal attempt (`IspPppoeService._kick`). */
export interface PppoeKickResult {
  session_id: string;
  ended: boolean;
  detail: string | null;
}

/** `GET /isp/subscribers/{id}/pppoe` (`credential_view`). */
export type PppoeCredential =
  | { configured: false; subscriber_id: string }
  | {
      configured: true;
      subscriber_id: string;
      username: string;
      status: PppoeCredentialStatus | string;
      static_ip: string | null;
      ip_pool_name: string | null;
      password_set_at: string | null;
      last_auth_at: string | null;
      /** "accepted" or a reject reason (see `AUTH_RESULT_LABEL`). */
      last_auth_result: string | null;
      last_mac: string | null;
      online: boolean;
      active_sessions: PppoeSession[];
    };

/** PUT response: the view, plus `password` exactly once when this call set
 * or generated it. Enable/disable add `disconnects`. */
export type PppoeCredentialSaved = PppoeCredential & {
  password?: string;
  disconnects?: PppoeKickResult[];
};

/** `PppoeCredentialBody` (extra=forbid). Omitted keys are left unchanged. */
export interface PppoeCredentialBody {
  username?: string | null;
  password?: string | null;
  generate_password?: boolean;
  static_ip?: string | null;
  ip_pool_name?: string | null;
}

export interface PppoeSessionQuery {
  isp_customer_id?: string;
  status?: PppoeSessionStatus;
  search?: string;
  page?: number;
  page_size?: number;
}

/** Query params of `GET /isp/pppoe/routers/{id}/script` (all optional;
 * blanks fall back to the `PppoeStatus.defaults`). */
export interface PppoeScriptParams {
  interface?: string;
  local_address?: string;
  pool_range?: string;
  pool_cidr?: string;
  /** Comma separated. */
  dns_servers?: string;
}
