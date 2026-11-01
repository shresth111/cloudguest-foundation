/** INCIDENTS-1 endpoints. All 404 while ISP_INCIDENTS_ENABLED is off.
 * A broadcast only ever goes out through the backend's WhatsApp automation
 * path; this file never builds or sends a message itself. */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type {
  BroadcastKind,
  BroadcastResult,
  GraceResult,
  IncidentDetail,
  IncidentPage,
  IncidentPreview,
  IncidentSeverity,
  IncidentStatus,
  IncidentTarget,
  NetworkHealth,
  RfoReason,
} from "@/services/isp-partner/incidents-types";

const BASE = "/isp/incidents";

export const incidentsService = {
  async health(): Promise<NetworkHealth> {
    const { data } = await api.get<NetworkHealth>(`${BASE}/health`);
    return data;
  },
  async list(q: {
    status?: IncidentStatus;
    open_only?: boolean;
    date_from?: string;
    date_to?: string;
    page?: number;
  }): Promise<IncidentPage> {
    const params: Record<string, string | number | boolean> = { page_size: 50 };
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") params[k] = v;
    const { data } = await api.get<IncidentPage>(BASE, { params });
    return data;
  },
  async preview(t: IncidentTarget): Promise<IncidentPreview> {
    const { data } = await api.get<IncidentPreview>(`${BASE}/preview`, { params: t });
    return data;
  },
  async create(
    body: IncidentTarget & {
      title?: string;
      severity: IncidentSeverity;
      started_at?: string;
      note?: string;
    },
  ): Promise<IncidentDetail> {
    const { data } = await api.post<IncidentDetail>(BASE, body);
    return data;
  },
  async detail(id: string): Promise<IncidentDetail> {
    const { data } = await api.get<IncidentDetail>(`${BASE}/${id}`);
    return data;
  },
  async setStatus(
    id: string,
    body: {
      status: "identified" | "resolved";
      note?: string;
      rfo_reason?: RfoReason;
      rfo_note?: string;
    },
  ): Promise<IncidentDetail> {
    const { data } = await api.post<IncidentDetail>(`${BASE}/${id}/status`, body);
    return data;
  },
  async addNote(id: string, body: string): Promise<IncidentDetail> {
    const { data } = await api.post<IncidentDetail>(`${BASE}/${id}/notes`, { body });
    return data;
  },
  async refresh(id: string): Promise<IncidentDetail> {
    const { data } = await api.post<IncidentDetail>(`${BASE}/${id}/refresh`, {});
    return data;
  },
  async grace(id: string, hours: number, dryRun: boolean): Promise<GraceResult> {
    const { data } = await api.post<GraceResult>(`${BASE}/${id}/grace`, {
      hours,
      dry_run: dryRun,
    });
    return data;
  },
  async broadcast(id: string, kind: BroadcastKind, dryRun: boolean): Promise<BroadcastResult> {
    const { data } = await api.post<BroadcastResult>(`${BASE}/${id}/broadcast`, {
      kind,
      dry_run: dryRun,
    });
    return data;
  },
  affectedCsv(id: string, code: string): Promise<FileDownload> {
    return downloadFile(`${BASE}/${id}/affected.csv`, {}, `${code}-affected.csv`);
  },
};
