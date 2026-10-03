/**
 * Master console calls for an Aruba Instant On fleet row. Every route here is
 * GLOBAL-scoped on the backend (~/wyfy-ops/aruba-ap21/API_CONTRACT.md); an
 * org-scoped session gets 403 by design. Nothing in the customer dashboard may
 * import this file.
 *
 * `api`'s response interceptor already unwraps the `{success, data}` envelope,
 * so `response.data` IS the payload.
 */
import { api } from "./api";
import {
  toArubaRegistration,
  toArubaSetupStatus,
  toInstantOnSitesOverview,
  type ArubaRegistration,
  type ArubaSetupStatus,
  type InstantOnSitesOverview,
} from "@/lib/aruba-instant-on-setup";
import {
  buildInstantOnSiteBody,
  toCreatedInstantOnSite,
  type AddInstantOnSiteDraft,
  type CreatedInstantOnSite,
} from "@/lib/aruba-instant-on-site";

export const arubaInstantOnService = {
  /** Add an Instant On site: one `aruba_instant_on` fleet row at the chosen
   * location. No agent, no WireGuard, no RADIUS yet -- Register on the setup
   * panel is the next step. No `X-Organization-Id`: a `/platform/` route, and
   * the organization travels in the body, where the backend checks the
   * location against it. */
  async createSite(draft: AddInstantOnSiteDraft): Promise<CreatedInstantOnSite> {
    const { data } = await api.post(
      "/platform/routers/instant-on-sites",
      buildInstantOnSiteBody(draft),
    );
    return toCreatedInstantOnSite(data);
  },

  /** Remove a mistaken Instant On row: `DELETE /routers/{id}` (GLOBAL), the
   * same decommission every fleet row uses. It deregisters the RADIUS client
   * from the hub FIRST and refuses (502, nothing changed) if the hub will
   * not drop it, so a removed row never leaves a live secret behind. */
  async removeSite(routerId: string): Promise<void> {
    await api.delete(`/routers/${routerId}`);
  },

  /** §2. Registration status, the split portal URL, the RADIUS server and the
   * allowed domains -- or the gaps that stop them being shown. Never the
   * secret. */
  async getSetup(routerId: string): Promise<ArubaSetupStatus> {
    const { data } = await api.get(`/platform/radius/nas/public/${routerId}`);
    return toArubaSetupStatus(data);
  },

  /** §3. Register, or re-register (rotate / move to a new IP). The backend
   * mints the secret, pushes the hub stanza first, writes the row second, and
   * returns the secret ONCE. */
  async register(routerId: string, nasIp: string): Promise<ArubaRegistration> {
    const { data } = await api.post(`/platform/radius/nas/register-public/${routerId}`, {
      nas_ip: nasIp,
    });
    return toArubaRegistration(data);
  },

  /** §4. Rotate on the existing NAS row: a new secret, shown once. The access
   * point keeps the old one until someone retypes it in Instant On. */
  async rotate(nasId: string): Promise<ArubaRegistration> {
    const { data } = await api.post(`/platform/radius/nas/${nasId}/regenerate-secret`);
    return toArubaRegistration(data);
  },

  /** Backend #327: the read-only poller's platform switches and every mapped
   * Instant On site with its poll state. GLOBAL (`network_integrations.read`),
   * a platform-DB read -- it never calls Instant On itself. */
  async listInstantOnSites(): Promise<InstantOnSitesOverview> {
    const { data } = await api.get("/platform/instant-on/sites");
    return toInstantOnSitesOverview(data);
  },

  /** Remove one auto-learned venue egress address: the backend deletes it
   * and re-pushes the NAS's remaining address set to the hub. The registered
   * address is not removable here (re-register to change it). */
  async removeLearnedAddress(routerId: string, ipAddress: string): Promise<void> {
    await api.delete(
      `/platform/radius/nas/public/${routerId}/learned/${encodeURIComponent(ipAddress)}`,
    );
  },

  /** §5. Removes the hub stanza through the agent and soft-deletes the row. */
  async deregister(nasId: string): Promise<void> {
    await api.delete(`/radius/nas/${nasId}`);
  },
};
