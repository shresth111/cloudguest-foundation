import type { PolicyStatus } from "@/types/policy";

// Mirrors backend BandwidthPolicyRules exactly (backend/app/domains/policy/schemas.py) --
// raw rate-limit values app.domains.queue_management composes into a real
// QueueProfile. Rates are kbps, matching the backend's own unit.
//
// sessionTimeoutMinutes/idleTimeoutMinutes/devicesPerUser/dailyLimitMinutes/
// loginHours/dataLimit are Group Policies' (CreateGroup.tsx) own per-group
// settings, not a queue_management concern -- see BandwidthPolicyRules'
// own doc comment for why they live on this same schema. Before these
// existed, CreateGroup.tsx never sent them to the backend at all, so
// reloading a group's data always read them back blank -- and since
// Session Timeout/Idle Timeout/Devices Per User are *required* fields on
// the edit form, that blanked every already-saved group's Edit button
// (bug report: "edit kaam nahi karta").
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
  sessionTimeoutMinutes?: number | null;
  idleTimeoutMinutes?: number | null;
  devicesPerUser?: number | null;
  dailyLimitMinutes?: number | null;
  loginHours?: { days: string[]; from: string; to: string } | null;
  dataLimit?: { quota: number; unit: string; resets: string } | null;
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
