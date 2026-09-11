import type { ControllerOnboardFields } from "@/types/router";

/**
 * The wire body for one controller -- `ControllerOnboardFields` on the
 * backend. One serializer for both paths that send it (Master onboarding and
 * Smart Location Provisioning's `network_controller`), so the rules below
 * cannot drift between them. A plain module rather than a member of
 * `routerService`, so `location.service.ts` can use it without depending on
 * the router service (and without every test that stubs that service having
 * to learn a new export).
 */
export function controllerOnboardBody(fields: ControllerOnboardFields): Record<string, unknown> {
  return {
    provider: "omada",
    name: fields.name,
    controller_model: fields.controllerModel,
    base_url: fields.baseUrl,
    auth_mode: fields.authMode,
    // Top-level, matching `_CredentialFields` on the backend -- see
    // `network-integration.service.ts`'s note on why a nested object here
    // is silently dropped rather than rejected. The app pair goes only
    // with Open API; the hotspot operator pair goes with BOTH modes,
    // because the controller only lets a guest online through the
    // operator login -- an Open API controller onboarded without it
    // could never authorise anyone (see `credentialsForMode`).
    ...(fields.authMode === "openapi"
      ? {
          ...(fields.clientId ? { client_id: fields.clientId } : {}),
          ...(fields.clientSecret ? { client_secret: fields.clientSecret } : {}),
        }
      : {}),
    ...(fields.username ? { username: fields.username } : {}),
    ...(fields.password ? { password: fields.password } : {}),
    // Certificate trust and the Omada ID, omitted unless set so the
    // backend's `strict` default stands.
    ...(fields.controllerId?.trim() ? { controller_id: fields.controllerId.trim() } : {}),
    ...(fields.tlsMode ? { tls_mode: fields.tlsMode } : {}),
    ...(fields.tlsMode === "pinned" && fields.tlsPinnedSha256
      ? { tls_pinned_sha256: fields.tlsPinnedSha256 }
      : {}),
    // Omitted entirely rather than sent as null when absent: the backend
    // reads "both absent" as "software controller, mint an identity", and
    // an explicit null would take the same branch but says something
    // different about intent.
    ...(fields.serialNumber ? { serial_number: fields.serialNumber } : {}),
    ...(fields.macAddress ? { mac_address: fields.macAddress } : {}),
  };
}
