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
  /**
   * Total venue speed -- the most all guests together can use at the venue
   * this policy is assigned to (`venue_download_rate_kbps` /
   * `venue_upload_rate_kbps`). Only Guest WiFi Limits sets it.
   *
   * THREE STATES, AND THE DIFFERENCE IS LOAD-BEARING ON SAVE:
   *   a number    that cap, in kbps;
   *   `null`      no cap -- a real choice, written as `null`;
   *   `undefined` the caller has no opinion (every screen that predates the
   *               field), and `bandwidthPolicyService.save` keeps whatever
   *               the policy already holds instead of erasing it.
   * A read always resolves to a number or `null`.
   */
  venueDownloadRateKbps?: number | null;
  venueUploadRateKbps?: number | null;
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
