/**
 * The choices and advice the TP-Link Omada controller form shows, shared by
 * Routers -> Add router and Smart Location Provisioning's first-device step
 * (see `components/routers/OmadaControllerFields.tsx`). Kept out of the
 * component module so that file exports only components.
 */

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

/** Why a controller's serial and MAC are optional, said once. */
export const OMADA_IDENTITY_NOTE =
  "An OC200 or OC300 has both printed on it — enter them so the fleet record matches the hardware. A software controller has neither: leave both blank and an identifier is generated for it. Nothing is invented in between, so enter both or neither.";
