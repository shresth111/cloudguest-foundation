/**
 * The location half of the partner Dashboard (ADDENDUM_04 B3).
 *
 * The customer's own location dashboard (`CustomerDashboardPage`) reads the
 * customer-app store, and its backend (`GET /dashboard/location`) checks the
 * CALLER's RBAC scope on the location -- which ISP staff deliberately do not
 * have. So this panel reads `GET /isp/venue/locations/{id}/overview` (the
 * original `get_location_overview`, scoped to the customer through IspScope)
 * and renders the same counts in the ISP's words.
 */
import { useQuery } from "@tanstack/react-query";
import { MStat } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { api } from "@/services/api";

interface LocationOverview {
  location: { id: string; name: string; status: string };
  router_count: number;
  connected_device_count: number;
  vlan_count: number;
  campaign_count: number;
  audit_log_count: number;
}

export function LocationOverview({ locationId, name }: { locationId: string; name: string }) {
  const q = useQuery({
    queryKey: ["isp", "venue", "location-overview", locationId],
    queryFn: async () => {
      const { data } = await api.get<LocationOverview>(
        `/isp/venue/locations/${locationId}/overview`,
      );
      return data;
    },
  });
  return (
    <Card title={`${name}: today at this location`}>
      {q.isLoading && <LoadingBlock />}
      {q.isError && (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this location's overview" />
      )}
      {q.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MStat label="Routers" value={q.data.router_count} />
          <MStat label="Connected devices" value={q.data.connected_device_count} />
          <MStat label="Network zones" value={q.data.vlan_count} />
          <MStat label="Login page offers" value={q.data.campaign_count} />
          <MStat label="Changes logged" value={q.data.audit_log_count} />
        </div>
      )}
    </Card>
  );
}
