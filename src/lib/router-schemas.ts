import { z } from "zod";
import type { ControllerOnboardFields } from "@/types/router";

/**
 * The vendors the device-add wizard can register.
 *
 * `vendor` is not new plumbing: `routers.vendor` exists in the database with
 * `default="mikrotik"`, `RouterCreateRequest.vendor` already accepts it, and
 * `CreateRouterPayload.vendor` already sends it. What was missing was a way
 * for an operator to *choose*, which is what this enum backs.
 *
 * MikroTik and TP-Link Omada are parallel deployments, not a mixed topology:
 * a venue is one or the other, and at an Omada venue there is no MikroTik
 * router in the path at all. That is why the wizard branches on this value
 * rather than showing both vendors' fields at once.
 */
export const ROUTER_VENDORS = ["mikrotik", "tplink_omada"] as const;
export type RouterVendorId = (typeof ROUTER_VENDORS)[number];

export const routerBasicSchema = z.object({
  name: z.string().trim().min(2, "Router name is required").max(120),
  locationId: z.string().min(1, "Select a location"),
  model: z.string().min(2, "Model is required"),
  /**
   * Optional HERE and made required per-vendor by {@link routerWizardSchema}'s
   * `superRefine`, which is the same pattern {@link omadaControllerSchema}
   * uses and for the same reason.
   *
   * A MikroTik has a serial plate and a burned-in MAC, and registering one
   * without them produces a fleet row nothing can ever be matched to -- so
   * that path still requires both. An Omada *software* controller running in
   * a VM has neither, and demanding them would force an operator to invent a
   * value, which is the one outcome that must not happen: `routers.mac_address`
   * is the join key for client lookups, MAC authorization and DHCP leases, so
   * a made-up address can collide with a real access point. The backend mints
   * a deterministic, locally-administered identity for that case instead.
   */
  serialNumber: z.string().trim().max(60).optional().or(z.literal("")),
  macAddress: z.string().trim().max(30).optional().or(z.literal("")),
  managementIpAddress: z.string().trim().max(45).optional().or(z.literal("")),
  publicIpAddress: z.string().trim().max(45).optional().or(z.literal("")),
});

const MAC_PATTERN = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export const routerCredentialsSchema = z.object({
  apiUsername: z.string().trim().max(100).optional().or(z.literal("")),
  apiSecret: z.string().max(500).optional().or(z.literal("")),
});

export const routerServicesSchema = z.object({
  freeradius: z.boolean(),
  wireguard: z.boolean(),
  captivePortal: z.boolean(),
  guestWifi: z.boolean(),
  monitoring: z.boolean(),
  analytics: z.boolean(),
});

/**
 * The Omada controller section of the wizard.
 *
 * Every field is optional at the type level and made conditionally required
 * by {@link routerWizardSchema}'s `superRefine`. That is deliberate: the
 * wizard holds one form object for both vendors, so a MikroTik registration
 * must not be blocked by empty Omada fields, and an Omada registration must
 * not be waved through with empty ones. Doing it in a refinement keeps a
 * single schema (and therefore a single `zodResolver`) instead of swapping
 * resolvers mid-flow, which react-hook-form does not do cleanly.
 *
 * `clientSecret`/`password` live here only as an in-flight draft. They are
 * never read back from the API, never persisted client-side, and are dropped
 * from the form the moment the create request settles.
 */
export const omadaControllerSchema = z.object({
  baseUrl: z.string().trim().max(300).optional().or(z.literal("")),
  authMode: z.enum(["openapi", "legacy"]),
  clientId: z.string().trim().max(200).optional().or(z.literal("")),
  clientSecret: z.string().max(500).optional().or(z.literal("")),
  username: z.string().trim().max(200).optional().or(z.literal("")),
  password: z.string().max(500).optional().or(z.literal("")),
  /** Omada ID -- required only for a TP-Link cloud controller. */
  controllerId: z.string().trim().max(128).optional().or(z.literal("")),
  tlsMode: z.enum(["strict", "pinned", "insecure"]),
  tlsPinnedSha256: z.string().trim().max(200).optional().or(z.literal("")),
  /** Omada's own site identifier. In legacy mode there is nothing to list, so
   * this holds the site NAME the operator typed -- which is what Omada itself
   * puts on the portal redirect's `site` parameter and what the authorize
   * call replays back, so the name genuinely is the identifier there. */
  siteId: z.string().trim().max(200).optional().or(z.literal("")),
  siteName: z.string().trim().max(200).optional().or(z.literal("")),
  ssidId: z.string().trim().max(200).optional().or(z.literal("")),
  ssidName: z.string().trim().max(200).optional().or(z.literal("")),
});

export const routerWizardSchema = z
  .object({
    vendor: z.enum(ROUTER_VENDORS),
    basic: routerBasicSchema,
    credentials: routerCredentialsSchema,
    services: routerServicesSchema,
    omada: omadaControllerSchema,
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    if (values.vendor !== "tplink_omada") {
      // The MikroTik path is unchanged: both identifiers are required, and
      // the MAC must be well-formed. Enforced here rather than on the field
      // so the Omada branch can relax it without a second schema.
      if (!values.basic.serialNumber || values.basic.serialNumber.trim().length < 3) {
        issue(["basic", "serialNumber"], "Serial number is required");
      }
      if (!MAC_PATTERN.test(values.basic.macAddress?.trim() ?? "")) {
        issue(["basic", "macAddress"], "Enter a valid MAC address (AA:BB:CC:DD:EE:FF)");
      }
      return;
    }

    for (const found of omadaControllerIssues(values.omada, {
      serialNumber: values.basic.serialNumber,
      macAddress: values.basic.macAddress,
    })) {
      issue(
        found.section === "identity" ? ["basic", found.field] : ["omada", found.field],
        found.message,
      );
    }
  });

export type RouterWizardValues = z.infer<typeof routerWizardSchema>;

export type OmadaControllerDraft = z.infer<typeof omadaControllerSchema>;

/** One problem with an Omada controller draft. `section` says whether it is
 * about the device's own identity (serial/MAC) or its connection fields, so
 * each form can map it onto its own field names. */
export interface OmadaControllerIssue {
  section: "identity" | "omada";
  field: string;
  message: string;
}

/**
 * Everything wrong with an Omada controller draft, as a list.
 *
 * The one copy of these rules. The device-add wizard's
 * {@link routerWizardSchema} and Smart Location Provisioning's first-device
 * step both call it, so "what does a valid controller look like" cannot drift
 * between the two places a controller is registered from.
 */
export function omadaControllerIssues(
  omada: OmadaControllerDraft,
  identity: { serialNumber?: string; macAddress?: string },
): OmadaControllerIssue[] {
  const issues: OmadaControllerIssue[] = [];
  const add = (section: OmadaControllerIssue["section"], field: string, message: string) =>
    issues.push({ section, field, message });

  // Omada: both identifiers are optional, but they travel together. Half a
  // hardware identity is worse than none -- a real serial paired with a
  // minted MAC reads as a genuine hardware record in the fleet table and is
  // not one, so the backend refuses it and so does this.
  const serial = identity.serialNumber?.trim() ?? "";
  const mac = identity.macAddress?.trim() ?? "";
  if (Boolean(serial) !== Boolean(mac)) {
    add(
      "identity",
      serial ? "macAddress" : "serialNumber",
      "Enter both the serial number and the MAC address, or leave both blank for a software controller",
    );
  }
  if (mac && !MAC_PATTERN.test(mac)) {
    add("identity", "macAddress", "Enter a valid MAC address (AA:BB:CC:DD:EE:FF)");
  }

  const require = (field: string, value: string | undefined, message: string) => {
    if (!value || !value.trim()) add("omada", field, message);
  };
  // A controller with no address cannot be reached, and one with no
  // credentials can never authorise a guest -- unlike the MikroTik path,
  // where skipping credentials is a real, documented workflow (the device
  // often is not reachable yet at registration time). There is no
  // equivalent here: an Omada integration with no credentials does nothing
  // at all, so the wizard requires them rather than creating a row that
  // silently cannot work.
  require("baseUrl", omada.baseUrl, "Controller address is required");
  if (omada.baseUrl && omada.baseUrl.trim() && !/^https?:\/\//i.test(omada.baseUrl.trim())) {
    // Client-side shape check only. The real gate is server-side SSRF
    // validation, which also rejects private/loopback/metadata hosts and
    // non-allowlisted ports -- this just stops the obvious typo before a
    // round trip.
    add("omada", "baseUrl", "Include the scheme, e.g. https://controller.example.com:8043");
  }
  if (omada.authMode === "openapi") {
    require("clientId", omada.clientId, "Client ID is required");
    require("clientSecret", omada.clientSecret, "Client secret is required");
  }
  // The operator account in BOTH modes. The controller only lets a guest
  // online through its hotspot operator login; an Open API app on its own
  // lists devices and authorises nobody, so onboarding one without the
  // operator account registers a venue where no guest can get on.
  require("username", omada.username, "Operator name is required — guest sign-in uses it");
  require("password", omada.password, "Operator password is required — guest sign-in uses it");
  // Same rule as the backend's `validate_tls_trust`: pinned without a real
  // SHA-256 fingerprint is refused rather than quietly downgraded.
  if (omada.tlsMode === "pinned") {
    const pin = (omada.tlsPinnedSha256 ?? "").toLowerCase().replace(/[:\s-]/g, "");
    if (!/^[0-9a-f]{64}$/.test(pin)) {
      add(
        "omada",
        "tlsPinnedSha256",
        "Enter the certificate's SHA-256 fingerprint (64 hexadecimal characters)",
      );
    }
  }
  return issues;
}

/** An empty controller draft. `authMode` opens on "openapi" because legacy
 * operator credentials cannot read sites, SSIDs, devices or clients at all --
 * they drive the captive portal and nothing else. */
export const EMPTY_OMADA_DRAFT: OmadaControllerDraft = {
  baseUrl: "",
  authMode: "openapi",
  clientId: "",
  clientSecret: "",
  username: "",
  password: "",
  controllerId: "",
  tlsMode: "strict",
  tlsPinnedSha256: "",
  siteId: "",
  siteName: "",
  ssidId: "",
  ssidName: "",
};

/**
 * A validated controller draft, as the API payload both registration paths
 * send (Master onboarding and Smart Location Provisioning). Empty optional
 * fields become `undefined` so the serializer omits them -- "both identity
 * fields absent" is how the backend knows to generate a software
 * controller's identity.
 */
export function controllerFieldsFromDraft(
  identity: { name: string; model: string; serialNumber?: string; macAddress?: string },
  omada: OmadaControllerDraft,
): ControllerOnboardFields {
  return {
    name: identity.name,
    controllerModel: identity.model,
    baseUrl: omada.baseUrl?.trim() ?? "",
    authMode: omada.authMode,
    clientId: omada.clientId || undefined,
    clientSecret: omada.clientSecret || undefined,
    username: omada.username || undefined,
    password: omada.password || undefined,
    serialNumber: identity.serialNumber?.trim() || undefined,
    macAddress: identity.macAddress?.trim() || undefined,
    controllerId: omada.controllerId || undefined,
    tlsMode: omada.tlsMode,
    tlsPinnedSha256: omada.tlsPinnedSha256 || undefined,
  };
}
