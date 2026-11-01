/** J22 fiber plant registry (lane JAZE-6 B). Mirrors
 * `isp_partner/fiber_router.py` + `fiber_service.py` (BE branch
 * `feat/isp-jaze6-pppoe`). Every route 404s while `ISP_FIBER_ENABLED` is off. */

export const FIBER_KINDS = ["olt", "pole", "splitter", "joint_closure", "ont", "other"] as const;
export type FiberKind = (typeof FIBER_KINDS)[number];
export const FIBER_STATUSES = ["active", "planned", "retired"] as const;
export type FiberStatus = (typeof FIBER_STATUSES)[number];

/** `node_view`. */
export interface FiberNode {
  id: string;
  kind: FiberKind | string;
  name: string;
  code: string | null;
  status: FiberStatus | string;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  address: string | null;
  parent_id: string | null;
  parent_port: number | null;
  port_count: number | null;
  spec: string | null;
  isp_customer_id: string | null;
  notes: string | null;
  created_at: string | null;
}

/** One hop of `route` (root first). */
export interface FiberRouteHop {
  id: string;
  kind: FiberKind | string;
  name: string;
  code: string | null;
  parent_port: number | null;
  maps_url: string | null;
}

/** `GET /fiber/nodes/{id}`. */
export interface FiberNodeDetail extends FiberNode {
  child_count: number;
  ports_assigned: number;
  route: FiberRouteHop[];
}

export type FiberPort =
  | { port_no: number; state: "free" }
  | { port_no: number; state: "node"; node: { id: string; kind: string; name: string } }
  | {
      port_no: number;
      state: "subscriber";
      /** null = in use by a subscriber outside the caller's scope. */
      subscriber: {
        id: string;
        label: string;
        identifier: string;
        isp_customer_id: string;
      } | null;
      assignment_id?: string;
      notes?: string | null;
    };

/** `GET /fiber/nodes/{id}/downstream`. */
export interface FiberDownstream {
  node: { id: string; kind: string; name: string };
  downstream_nodes: number;
  downstream_by_kind: Record<string, number>;
  subscriber_count: number;
  subscribers: {
    subscriber_id: string;
    label: string;
    identifier: string;
    phone: string | null;
    status: string;
    isp_customer_id: string;
    node_id: string;
    node_name: string;
    port_no: number;
  }[];
}

/** `GET /fiber/subscribers/{id}`. */
export interface FiberSubscriberLocation {
  subscriber_id: string;
  assigned: boolean;
  node_id: string | null;
  port_no: number | null;
  route: FiberRouteHop[];
}

/** `IspFiberNodeCreateRequest` (extra=forbid). `IspFiberNodePatch` is the
 * same with every key optional; kind/name/status may not be null. Latitude
 * and longitude go together or not at all. */
export interface FiberNodeBody {
  kind?: FiberKind;
  name?: string;
  code?: string | null;
  address?: string | null;
  parent_id?: string | null;
  parent_port?: number | null;
  port_count?: number | null;
  spec?: string | null;
  status?: FiberStatus;
  isp_customer_id?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface FiberNodeQuery {
  kind?: FiberKind;
  parent_id?: string;
  roots_only?: boolean;
  isp_customer_id?: string;
  status?: FiberStatus;
  search?: string;
  page?: number;
  page_size?: number;
}
