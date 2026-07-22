import type { PolicyStatus } from "@/types/policy";

// PolicyType.ROUTING has no typed backend schema -- it falls back to
// GenericPolicyRules (any JSON object, no shape validation; see
// backend/app/domains/policy/schemas.py). `rules` is therefore an opaque
// JSON blob here too, honestly reflecting that the backend applies no
// further validation, rather than inventing fake typed fields (e.g. a
// "firewall templates / VLAN membership / app filtering" shape) the
// backend doesn't check.
export interface RoutingPolicy {
  id: string;
  name: string;
  description?: string;
  status: PolicyStatus;
  rules: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface RoutingPolicyKpis {
  total: number;
  active: number;
  draft: number;
}

export type SaveRoutingPolicyInput = Omit<RoutingPolicy, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
