/** SMALL-5: auto incidents from router DOWN (INCIDENTS flag; 404 off). */
import api from "@/services/api";

export interface AutoIncidentSettings {
  enabled: boolean;
  down_minutes: number;
  up_minutes: number;
}

export interface AutoIncidentMark {
  incident_id: string;
  router_id: string;
  down_since: string;
  opened_at: string;
  closed_at: string | null;
  auto_resolved: boolean;
  auto_grace_allowed: boolean;
}

const BASE = "/isp/incident-auto";

export const incidentAutoService = {
  async settings(): Promise<AutoIncidentSettings> {
    const { data } = await api.get<AutoIncidentSettings>(`${BASE}/settings`);
    return data;
  },
  async putSettings(body: Partial<AutoIncidentSettings>): Promise<AutoIncidentSettings> {
    const { data } = await api.put<AutoIncidentSettings>(`${BASE}/settings`, body);
    return data;
  },
  async marks(): Promise<{ items: AutoIncidentMark[] }> {
    const { data } = await api.get<{ items: AutoIncidentMark[] }>(`${BASE}/marks`);
    return data;
  },
};
