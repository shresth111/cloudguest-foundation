/** SMALL-5: auto-opened incident marks keyed by incident id (404 off -> none). */
import { useQuery } from "@tanstack/react-query";
import { AUTO_INCIDENT_KEYS } from "@/lib/isp-partner/incident-auto";
import { incidentAutoService, type AutoIncidentMark } from "@/services/isp-partner/incident-auto";

export function useAutoIncidentMarks() {
  return useQuery({
    queryKey: AUTO_INCIDENT_KEYS.marks,
    queryFn: async () => {
      const { items } = await incidentAutoService.marks();
      return new Map<string, AutoIncidentMark>(items.map((m) => [m.incident_id, m]));
    },
    retry: false,
    refetchInterval: 60_000,
  });
}
