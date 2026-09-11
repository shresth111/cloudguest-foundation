import {
  EMPTY_OMADA_DRAFT,
  controllerFieldsFromDraft,
  omadaControllerIssues,
  type OmadaControllerDraft,
} from "@/lib/router-schemas";
import type { ProvisionLocationPayload } from "@/types/location";
import {
  NETWORK_INTEGRATION_ERROR_COPY,
  describeIntegrationError,
} from "@/types/network-integration";

/**
 * Smart Location Provisioning's first-device step: a MikroTik router, or a
 * TP-Link Omada controller for a venue that has no MikroTik at all.
 *
 * Every location is provisioned with exactly one first device, because a
 * guest session needs a fleet row at the venue (`guest_sessions.router_id`
 * is NOT NULL on the backend). Before this, the step only knew MikroTik, so a
 * new customer with only an Omada controller could be provisioned only by
 * inventing a serial number and MAC -- and that MAC is the join key for
 * client lookups, MAC authorization and DHCP leases, so an invented one can
 * collide with a real device.
 *
 * The controller branch validates with `omadaControllerIssues` and builds its
 * payload with `controllerFieldsFromDraft` -- the same two functions Routers ->
 * Add router uses -- so both places that register a controller agree on what
 * a valid one is and what gets sent.
 *
 * Pure (no React) so the rules can be tested against the shipped code.
 */

export type FirstDeviceKind = "router" | "network_controller";

export interface FirstDeviceState {
  kind: FirstDeviceKind;
  router: {
    name: string;
    serialNumber: string;
    macAddress: string;
    model: string;
    managementIpAddress: string;
  };
  controller: {
    name: string;
    model: string;
    /** Hardware controllers only (OC200/OC300); both or neither. */
    serialNumber: string;
    macAddress: string;
    omada: OmadaControllerDraft;
  };
}

export const EMPTY_FIRST_DEVICE: FirstDeviceState = {
  // MikroTik first: every location provisioned before this was one, so the
  // step opens on the path an operator usually wants and the controller is an
  // explicit choice.
  kind: "router",
  router: { name: "", serialNumber: "", macAddress: "", model: "", managementIpAddress: "" },
  controller: { name: "", model: "", serialNumber: "", macAddress: "", omada: EMPTY_OMADA_DRAFT },
};

/**
 * Field errors for the first-device step, keyed the way the wizard renders
 * them: `router.<field>`, `controller.<field>` and `controller.omada.<field>`.
 * Empty when the step is valid.
 */
export function validateFirstDevice(device: FirstDeviceState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (device.kind === "router") {
    // Unchanged from before a controller could be chosen: a MikroTik has a
    // serial plate and a burned-in MAC, and the backend requires both.
    (["name", "serialNumber", "macAddress", "model"] as const).forEach((k) => {
      if (!device.router[k].trim()) errors[`router.${k}`] = "Required";
    });
    return errors;
  }

  const controller = device.controller;
  if (!controller.name.trim()) errors["controller.name"] = "Required";
  if (!controller.model.trim()) errors["controller.model"] = "Required";
  for (const issue of omadaControllerIssues(controller.omada, {
    serialNumber: controller.serialNumber,
    macAddress: controller.macAddress,
  })) {
    const key =
      issue.section === "identity"
        ? `controller.${issue.field}`
        : `controller.omada.${issue.field}`;
    errors[key] ??= issue.message;
  }
  return errors;
}

/** The request's first device -- exactly one of `router` and
 * `networkController`, never both. */
export function firstDevicePayload(
  device: FirstDeviceState,
): Pick<ProvisionLocationPayload, "router" | "networkController"> {
  if (device.kind === "network_controller") {
    return {
      networkController: controllerFieldsFromDraft(
        {
          name: device.controller.name.trim(),
          model: device.controller.model,
          serialNumber: device.controller.serialNumber,
          macAddress: device.controller.macAddress,
        },
        device.controller.omada,
      ),
    };
  }
  return {
    router: {
      name: device.router.name,
      serialNumber: device.router.serialNumber,
      macAddress: device.router.macAddress,
      model: device.router.model,
      managementIpAddress: device.router.managementIpAddress || undefined,
    },
  };
}

/** The controller's secrets, dropped. They are an in-flight draft only: the
 * wizard calls this the moment provisioning succeeds, so they do not live on
 * in component state until the dialog happens to close. */
export function withoutControllerSecrets(device: FirstDeviceState): FirstDeviceState {
  return {
    ...device,
    controller: {
      ...device.controller,
      omada: { ...device.controller.omada, clientSecret: "", password: "" },
    },
  };
}

/** What the Review step shows for the first device. Never includes a
 * secret. */
export function describeFirstDevice(device: FirstDeviceState): Array<[string, string]> {
  if (device.kind === "router") {
    return [
      ["Device", "MikroTik router"],
      ["Name", device.router.name],
      ["Model", device.router.model],
      ["Serial", device.router.serialNumber],
      ["MAC", device.router.macAddress],
    ];
  }
  const c = device.controller;
  const hardware = Boolean(c.serialNumber.trim() && c.macAddress.trim());
  return [
    ["Device", "TP-Link Omada controller"],
    ["Name", c.name],
    ["Model", c.model],
    [
      "Identity",
      hardware ? `${c.serialNumber} · ${c.macAddress}` : "Generated (software controller)",
    ],
    ["Address", c.omada.baseUrl?.trim() ?? ""],
    [
      "Sign-in",
      c.omada.authMode === "openapi" ? "Open API client + hotspot operator" : "Hotspot operator",
    ],
    [
      "Certificate",
      c.omada.tlsMode === "pinned"
        ? "Pinned"
        : c.omada.tlsMode === "insecure"
          ? "No check"
          : "Standard",
    ],
  ];
}

/**
 * The sentence the wizard shows when provisioning fails.
 *
 * For a controller, the errors that matter come from the network integration
 * domain (an address the SSRF rules refuse, credentials that do not fit the
 * mode, the #224 refusal to encrypt under the public default key) and carry
 * that domain's code in `data.code`. Those get the same operator-facing copy
 * the Network Integrations page uses. Everything else -- including every
 * router failure -- keeps the backend's own message verbatim, because on
 * this endpoint that message is what says whether anything was saved.
 */
export function describeProvisioningFailure(
  error: { status: number | null; message: string; data?: Record<string, unknown> },
  kind: FirstDeviceKind,
): string {
  if (kind !== "network_controller") return error.message || "Provisioning failed";
  if (error.status === 403) {
    return "Registering a Wi-Fi controller needs the network integrations permission as well as location management. Nothing was saved.";
  }
  const code = typeof error.data?.code === "string" ? error.data.code : null;
  if (code && code in NETWORK_INTEGRATION_ERROR_COPY) {
    // URL_REJECTED is the one code whose backend message is the better
    // sentence: the backend also files a credential set that does not fit
    // the auth mode under it, and its message names which field is wrong,
    // where the generic copy would wrongly blame the address.
    const copy =
      code === "NETWORK_INTEGRATION_URL_REJECTED" && error.message.trim()
        ? error.message.trim()
        : describeIntegrationError(code, error.message);
    // Provisioning is one transaction: a refusal here rolled everything back.
    return /nothing was saved/i.test(copy)
      ? copy
      : `${copy} Nothing was saved, so you can correct it and provision again.`;
  }
  return error.message || "Provisioning failed";
}
