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
  type ArubaRegistration,
  type ArubaSetupStatus,
} from "@/lib/aruba-instant-on-setup";

export const arubaInstantOnService = {
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

  /** §5. Removes the hub stanza through the agent and soft-deletes the row. */
  async deregister(nasId: string): Promise<void> {
    await api.delete(`/radius/nas/${nasId}`);
  },
};
