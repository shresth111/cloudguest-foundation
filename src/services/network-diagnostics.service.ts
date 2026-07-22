import { api } from "@/services/api";
import type { DiagnosticRun, DiagnosticRunListResult } from "@/types/network-diagnostics";

interface BackendDiagnosticRun {
  id: string;
  router_id: string;
  diagnostic_type: string;
  target: string;
  status: string;
  result: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

interface BackendDiagnosticRunListResponse {
  items: BackendDiagnosticRun[];
  total_items: number;
}

function toRun(r: BackendDiagnosticRun): DiagnosticRun {
  return {
    id: r.id,
    routerId: r.router_id,
    diagnosticType: r.diagnostic_type,
    target: r.target,
    status: r.status,
    result: r.result,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  };
}

// Router-scoped calls omit X-Organization-Id -- see
// connected-device.service.ts's comment on this convention.
export const networkDiagnosticsService = {
  async ping(routerId: string, target: string, count = 4): Promise<DiagnosticRun> {
    const { data } = await api.post<BackendDiagnosticRun>(
      `/network-diagnostics/routers/${routerId}/ping`,
      { target, count },
    );
    return toRun(data);
  },

  async traceroute(routerId: string, target: string): Promise<DiagnosticRun> {
    const { data } = await api.post<BackendDiagnosticRun>(
      `/network-diagnostics/routers/${routerId}/traceroute`,
      { target },
    );
    return toRun(data);
  },

  async listRuns(routerId: string, page = 1, pageSize = 20): Promise<DiagnosticRunListResult> {
    const { data } = await api.get<BackendDiagnosticRunListResponse>(
      "/network-diagnostics/runs",
      { params: { router_id: routerId, page, page_size: pageSize } },
    );
    return { rows: data.items.map(toRun), total: data.total_items };
  },
};
