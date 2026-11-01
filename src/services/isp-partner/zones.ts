/** ZONE-1 endpoints. `/isp/zones/*` never carries `scope_zone_id`. */
import api from "@/services/api";
import type {
  ZoneCreateBody,
  ZoneNode,
  ZoneSubtree,
  ZoneTotals,
  ZoneTree,
} from "@/services/isp-partner/zones-types";

export const zoneTreeService = {
  async tree(): Promise<ZoneTree> {
    const { data } = await api.get<ZoneTree>("/isp/zones/tree");
    return { items: data?.items ?? [], ledger_enabled: !!data?.ledger_enabled };
  },
  async create(body: ZoneCreateBody): Promise<ZoneNode> {
    const { data } = await api.post<ZoneNode>("/isp/zones/tree", body);
    return data;
  },
  async rename(zoneId: string, name: string): Promise<void> {
    await api.patch(`/isp/zones/${zoneId}`, { name });
  },
  async move(zoneId: string, parentId: string | null): Promise<ZoneNode> {
    const { data } = await api.put<ZoneNode>(`/isp/zones/${zoneId}/parent`, {
      parent_id: parentId,
    });
    return data;
  },
  async remove(zoneId: string): Promise<void> {
    await api.delete(`/isp/zones/${zoneId}/tree`);
  },
  async subtree(zoneId: string): Promise<ZoneSubtree> {
    const { data } = await api.get<ZoneSubtree>(`/isp/zones/${zoneId}/subtree`);
    return data;
  },
  /** Plain `YYYY-MM-DD` dates (the invoices P0 rule). */
  async totals(dateFrom: string, dateTo: string): Promise<ZoneTotals> {
    const { data } = await api.get<ZoneTotals>("/isp/zones/totals", {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return { items: data?.items ?? [], ledger_enabled: !!data?.ledger_enabled };
  },
};
