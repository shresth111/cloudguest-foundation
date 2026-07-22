import type { PolicyStatus } from "@/types/policy";

// Mirrors backend BandwidthPolicyRules exactly (backend/app/domains/policy/schemas.py) --
// raw rate-limit values app.domains.queue_management composes into a real
// QueueProfile. Rates are kbps, matching the backend's own unit.
export interface BandwidthPolicy {
  id: string;
  name: string;
  description?: string;
  status: PolicyStatus;
  downloadRateKbps: number;
  uploadRateKbps: number;
  burstDownloadKbps?: number;
  burstUploadKbps?: number;
  burstThresholdKbps?: number;
  burstTimeSeconds?: number;
  priority?: number; // 1-8
  createdAt: number;
  updatedAt: number;
}

export interface BandwidthPolicyKpis {
  total: number;
  active: number;
  draft: number;
}

export type SaveBandwidthPolicyInput = Omit<BandwidthPolicy, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
