/** RAKESH-FS: `/isp/workflow/*` (BE flag ISP_WORKFLOW_ENABLED; 404 while off). */
import api from "@/services/api";

export interface WorkflowFeatures {
  data_limit_unit: "GB";
  mb_per_gb: number;
  router_zones: boolean;
  auto_placement: boolean;
  franchisee_logins: boolean;
  is_franchisee: boolean;
}

export const workflowService = {
  async features(): Promise<WorkflowFeatures> {
    const { data } = await api.get<WorkflowFeatures>("/isp/workflow/features");
    return data;
  },
};
