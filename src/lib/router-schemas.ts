import { z } from "zod";

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

    // Omada: both identifiers are optional, but they travel together. Half a
    // hardware identity is worse than none -- a real serial paired with a
    // minted MAC reads as a genuine hardware record in the fleet table and is
    // not one, so the backend refuses it and so does this.
    const serial = values.basic.serialNumber?.trim() ?? "";
    const mac = values.basic.macAddress?.trim() ?? "";
    if (Boolean(serial) !== Boolean(mac)) {
      issue(
        [serial ? "basic" : "basic", serial ? "macAddress" : "serialNumber"],
        "Enter both the serial number and the MAC address, or leave both blank for a software controller",
      );
    }
    if (mac && !MAC_PATTERN.test(mac)) {
      issue(["basic", "macAddress"], "Enter a valid MAC address (AA:BB:CC:DD:EE:FF)");
    }

    const omada = values.omada;
    const require = (path: string, value: string | undefined, message: string) => {
      if (!value || !value.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["omada", path], message });
      }
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
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["omada", "baseUrl"],
        // Client-side shape check only. The real gate is server-side SSRF
        // validation, which also rejects private/loopback/metadata hosts and
        // non-allowlisted ports -- this just stops the obvious typo before a
        // round trip.
        message: "Include the scheme, e.g. https://controller.example.com:8043",
      });
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["omada", "tlsPinnedSha256"],
          message: "Enter the certificate's SHA-256 fingerprint (64 hexadecimal characters)",
        });
      }
    }
  });

export type RouterWizardValues = z.infer<typeof routerWizardSchema>;
