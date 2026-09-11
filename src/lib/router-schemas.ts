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

// The device-type, authentication and certificate choices, with their copy.
// Here rather than in RouterWizard because the Master console's customer
// wizard offers the same choices, and two copies of an operator-facing
// sentence about what a credential can and cannot do is how one of them
// comes to be wrong.

export const VENDOR_CHOICES = [
  {
    id: "mikrotik" as const,
    label: "MikroTik router",
    description: "Provisioned and managed by this platform's own agent.",
  },
  {
    id: "tplink_omada" as const,
    label: "TP-Link Omada controller",
    description: "Managed through its own controller; this platform integrates with it.",
  },
];

export const AUTH_MODE_CHOICES = [
  {
    id: "openapi" as const,
    label: "Open API client",
    // The operational difference, not the marketing one. Legacy credentials
    // authorise guests but cannot read inventory at all, so a venue that picks
    // them gets a working captive portal and permanently empty device/client
    // tabs -- worth knowing before choosing rather than after.
    // Needs the hotspot operator account as well -- the controller lets
    // guests online only through that login, whatever lists its inventory.
    description:
      "Controller v5.13+. Lists devices, clients and sites; guest sign-in still uses the hotspot operator account below.",
  },
  {
    id: "legacy" as const,
    label: "Hotspot operator",
    description: "Older controllers. Authorises guests, but lists no devices or clients.",
  },
];

// Certificate trust, per controller. Same three modes and the same advice as
// the customer page (`CONTROLLER_TLS_MODE_SUMMARY`), shortened for a form
// that has less room. A self-hosted controller presents a self-signed
// certificate and cannot pass the default check -- it needs `pinned`.
export const TLS_MODE_CHOICES = [
  {
    id: "strict" as const,
    label: "Standard certificate check",
    description: "A public-CA certificate: TP-Link cloud, or a controller behind your own HTTPS.",
  },
  {
    id: "pinned" as const,
    label: "Pinned certificate",
    description:
      "Self-hosted controllers (self-signed). Refuses any other certificate from then on.",
  },
  {
    id: "insecure" as const,
    label: "No certificate check",
    description: "Last resort. Accepts any certificate, including one from somebody in the middle.",
  },
];

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

export type OmadaControllerValues = z.infer<typeof omadaControllerSchema>;

/**
 * The address shape the backend's `parse_controller_url` accepts, checked
 * before any request is made: https, a host, and nothing after the port.
 *
 * Client-side and syntactic only -- the real gate stays server-side, where
 * the SSRF rules also refuse private hosts and non-allowlisted ports. It
 * exists because the customer wizard connects a controller AFTER the
 * customer is already created, so a typo the backend would refuse no longer
 * costs one round trip: it costs a half-onboarded customer. Catching the
 * refusable shapes here keeps that failure to the cases only the controller
 * itself can reveal.
 */
export function controllerAddressProblem(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return "Controller address is required";
  if (!/^https?:\/\//i.test(value)) {
    return "Include the scheme, e.g. https://controller.example.com:8043";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "This is not a valid address, e.g. https://controller.example.com:8043";
  }
  // Same order and substance as the backend's own refusals.
  if (url.protocol !== "https:") {
    return "Use https:// — the controller credentials would otherwise cross the network in the clear";
  }
  if (url.username || url.password) return "Do not put credentials in the address";
  if (url.pathname !== "/" || url.search || url.hash || /[?#]/.test(value)) {
    return "Scheme, host and port only — no path, e.g. https://controller.example.com:8043";
  }
  return null;
}

type OmadaIssue = { path: ["basic" | "omada", string]; message: string };

/**
 * Every rule an Omada controller draft must pass before it is sent, as a
 * list of issues rather than a zod refinement.
 *
 * Shared by the two wizards that onboard a controller -- the Router Fleet's
 * device wizard (through {@link routerWizardSchema}) and the Master
 * console's customer wizard, which keeps plain state rather than a
 * react-hook-form object -- so the second one cannot drift into a weaker
 * copy of the first. Paths are the device wizard's field names; a caller
 * with a different form maps them.
 */
export function omadaControllerIssues(draft: {
  serialNumber?: string;
  macAddress?: string;
  omada: OmadaControllerValues;
}): OmadaIssue[] {
  const issues: OmadaIssue[] = [];
  const issue = (path: OmadaIssue["path"], message: string) => issues.push({ path, message });

  // Both identifiers are optional, but they travel together. Half a
  // hardware identity is worse than none -- a real serial paired with a
  // minted MAC reads as a genuine hardware record in the fleet table and is
  // not one, so the backend refuses it and so does this.
  const serial = draft.serialNumber?.trim() ?? "";
  const mac = draft.macAddress?.trim() ?? "";
  if (Boolean(serial) !== Boolean(mac)) {
    issue(
      ["basic", serial ? "macAddress" : "serialNumber"],
      "Enter both the serial number and the MAC address, or leave both blank for a software controller",
    );
  }
  if (mac && !MAC_PATTERN.test(mac)) {
    issue(["basic", "macAddress"], "Enter a valid MAC address (AA:BB:CC:DD:EE:FF)");
  }

  const omada = draft.omada;
  const require = (path: string, value: string | undefined, message: string) => {
    if (!value || !value.trim()) issue(["omada", path], message);
  };
  // A controller with no address cannot be reached, and one with no
  // credentials can never authorise a guest -- unlike the MikroTik path,
  // where skipping credentials is a real, documented workflow (the device
  // often is not reachable yet at registration time). There is no
  // equivalent here: an Omada integration with no credentials does nothing
  // at all, so the wizard requires them rather than creating a row that
  // silently cannot work.
  const addressProblem = controllerAddressProblem(omada.baseUrl);
  if (addressProblem) issue(["omada", "baseUrl"], addressProblem);
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
      issue(
        ["omada", "tlsPinnedSha256"],
        "Enter the certificate's SHA-256 fingerprint (64 hexadecimal characters)",
      );
    }
  }
  return issues;
}

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

    for (const i of omadaControllerIssues({
      serialNumber: values.basic.serialNumber,
      macAddress: values.basic.macAddress,
      omada: values.omada,
    })) {
      issue(i.path, i.message);
    }
  });

export type RouterWizardValues = z.infer<typeof routerWizardSchema>;
