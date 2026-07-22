import type { PolicyStatus } from "@/types/policy";

// Mirrors backend AuthNPolicyRules exactly (backend/app/domains/policy/schemas.py) --
// rate-limiting for authentication attempts. The "OTP retry budgets / provider
// preference / MFA enforcement" copy this page used to show as a placeholder
// does not match what the backend actually validates for PolicyType.AUTHN;
// this is the honest, narrower real shape.
export interface AuthnPolicy {
  id: string;
  name: string;
  description?: string;
  status: PolicyStatus;
  maxAttemptsPerWindow: number;
  windowMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuthnPolicyKpis {
  total: number;
  active: number;
  draft: number;
}

export type SaveAuthnPolicyInput = Omit<AuthnPolicy, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
