/** `/isp/fiber/*` (J22, lane JAZE-6 B). */
import api from "@/services/api";
import { cleanParams } from "@/services/isp-partner/isp";
import type { IspPage } from "@/services/isp-partner/types";
import type {
  FiberDownstream,
  FiberNode,
  FiberNodeBody,
  FiberNodeDetail,
  FiberNodeQuery,
  FiberPort,
  FiberRouteHop,
  FiberSubscriberLocation,
} from "@/services/isp-partner/fiber-types";

const N = "/isp/fiber/nodes";

export const fiberService = {
  async nodes(q: FiberNodeQuery): Promise<IspPage<FiberNode>> {
    // roots_only=false is the API default; only send it when true.
    const { roots_only, ...rest } = q;
    return (
      await api.get<IspPage<FiberNode>>(N, {
        params: cleanParams({ ...rest, roots_only: roots_only ? true : undefined }),
      })
    ).data;
  },
  async node(id: string): Promise<FiberNodeDetail> {
    return (await api.get<FiberNodeDetail>(`${N}/${id}`)).data;
  },
  async create(body: FiberNodeBody): Promise<FiberNode> {
    return (await api.post<FiberNode>(N, body)).data;
  },
  async update(id: string, body: FiberNodeBody): Promise<FiberNode> {
    return (await api.patch<FiberNode>(`${N}/${id}`, body)).data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`${N}/${id}`);
  },
  async route(id: string): Promise<FiberRouteHop[]> {
    return (await api.get<FiberRouteHop[]>(`${N}/${id}/route`)).data;
  },
  async downstream(id: string): Promise<FiberDownstream> {
    return (await api.get<FiberDownstream>(`${N}/${id}/downstream`)).data;
  },
  async ports(id: string): Promise<FiberPort[]> {
    return (await api.get<FiberPort[]>(`${N}/${id}/ports`)).data;
  },
  async assignPort(
    id: string,
    portNo: number,
    subscriberId: string,
    notes?: string | null,
  ): Promise<{ node_id: string; port_no: number; subscriber_id: string; assignment_id: string }> {
    return (
      await api.put(`${N}/${id}/ports/${portNo}`, {
        subscriber_id: subscriberId,
        notes: notes || null,
      })
    ).data as { node_id: string; port_no: number; subscriber_id: string; assignment_id: string };
  },
  async releasePort(id: string, portNo: number): Promise<void> {
    await api.delete(`${N}/${id}/ports/${portNo}`);
  },
  async subscriberLocation(subscriberId: string): Promise<FiberSubscriberLocation> {
    return (await api.get<FiberSubscriberLocation>(`/isp/fiber/subscribers/${subscriberId}`)).data;
  },
};
