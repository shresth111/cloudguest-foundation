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

// This domain's own module scope is ROUTER
// (backend/app.domains.rbac.seed's MODULE_SCOPES[NETWORK_DIAGNOSTICS]),
// and RequirePermission infers GLOBAL scope whenever *no* scope header is
// present at all (see rbac/dependencies.py's _infer_scope_type) -- not
// ROUTER, and not something an ordinary org-scoped role (every real
// customer's own role) ever holds. The previous "omit X-Organization-Id"
// comment here was wrong, confirmed live the same way
// connected-device.service.ts's identical prior comment was: every call
// here 403's for a real customer with no header
// ("'network_diagnostics.execute' is required at global scope"), and
// succeeds once X-Organization-Id is sent (an ORGANIZATION-scoped role
// satisfies this router's own ROUTER scope one level down). Callers pass
// the router's own organizationId (RouterDevice.organizationId /
// Router.organization_id) -- optional only so a caller that genuinely
// holds a GLOBAL role (and has no org context to give) still works.
export const networkDiagnosticsService = {
  async ping(
    routerId: string,
    target: string,
    organizationId?: string,
    count = 4,
  ): Promise<DiagnosticRun> {
    const { data } = await api.post<BackendDiagnosticRun>(
      `/network-diagnostics/routers/${routerId}/ping`,
      { target, count },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRun(data);
  },

  async traceroute(
    routerId: string,
    target: string,
    organizationId?: string,
  ): Promise<DiagnosticRun> {
    const { data } = await api.post<BackendDiagnosticRun>(
      `/network-diagnostics/routers/${routerId}/traceroute`,
      { target },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRun(data);
  },

  async listRuns(
    routerId: string,
    organizationId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<DiagnosticRunListResult> {
    const { data } = await api.get<BackendDiagnosticRunListResponse>("/network-diagnostics/runs", {
      params: { router_id: routerId, page, page_size: pageSize },
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return { rows: data.items.map(toRun), total: data.total_items };
  },
};
