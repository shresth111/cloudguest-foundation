/** DASH-1 endpoints. Zone scope is added by the ZONE-1 interceptor. */
import api from "@/services/api";
import { dashParams } from "@/lib/isp-partner/dashboard";
import type {
  DashFilters,
  DashList,
  DashTile,
  SubscriberDashboard,
} from "@/services/isp-partner/dashboard-types";

export const dashboardService = {
  async summary(f: DashFilters): Promise<SubscriberDashboard> {
    const { data } = await api.get<SubscriberDashboard>("/isp/dashboard/subscribers", {
      params: dashParams(f),
    });
    return data;
  },
  async list(f: DashFilters, tile: DashTile, page: number, pageSize = 50): Promise<DashList> {
    const { data } = await api.get<DashList>("/isp/dashboard/subscribers/list", {
      params: { ...dashParams(f), tile, page, page_size: pageSize },
    });
    return data;
  },
};
