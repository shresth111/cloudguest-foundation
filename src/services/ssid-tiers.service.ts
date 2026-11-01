/**
 * Speed tiers by WiFi network (backend `app/domains/guest/ssid_tier_router.py`).
 *
 * The two location routes are tenant routes: `api`'s interceptor attaches the
 * session's organization, and the backend checks the location against it and
 * against the location the permission was checked at. `syncToInstantOn` is
 * GLOBAL (Master only); a customer session gets 403 by design.
 */
import { api } from "./api";
import { guestPortalApi } from "./guest-portal-api";
import {
  toGuestSsidAccess,
  toSsidTiersBody,
  toSsidTiersView,
  type GuestSsidAccess,
  type SsidTier,
  type SsidTiersView,
} from "@/lib/ssid-tiers";

export interface InstantOnSyncItem {
  ssid: string;
  status: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  before_download_mbps: number | null;
  before_upload_mbps: number | null;
  message: string | null;
}

export interface InstantOnSyncResult {
  status: "manual" | "preview" | "applied" | "partial" | "failed";
  reason: string | null;
  manual_steps: string[];
  items: InstantOnSyncItem[];
}

export const ssidTiersService = {
  async list(locationId: string): Promise<SsidTiersView> {
    const { data } = await api.get(`/locations/${locationId}/ssid-tiers`);
    return toSsidTiersView(data);
  },

  async replace(locationId: string, items: SsidTier[]): Promise<SsidTiersView> {
    const { data } = await api.put(`/locations/${locationId}/ssid-tiers`, toSsidTiersBody(items));
    return toSsidTiersView(data);
  },

  /** Master only. `dryRun` defaults to a preview: nothing is written. */
  async syncToInstantOn(locationId: string, dryRun = true): Promise<InstantOnSyncResult> {
    const { data } = await api.post(`/locations/${locationId}/ssid-tiers/instant-on-sync`, {
      dry_run: dryRun,
    });
    return data as InstantOnSyncResult;
  },
};

/** Guest portal: may this signed-in guest join this WiFi network? `null` on
 * any failure -- the portal then proceeds and the RADIUS hub decides. */
export async function fetchGuestSsidAccess(
  sessionId: string,
  ssid: string,
): Promise<GuestSsidAccess | null> {
  try {
    const { data } = await guestPortalApi.post(
      "/guest/ssid-access",
      { session_id: sessionId, ssid },
      { timeout: 6000 },
    );
    return toGuestSsidAccess(data);
  } catch {
    return null;
  }
}
