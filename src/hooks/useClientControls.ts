/**
 * The one hook every customer screen uses to ask "may I offer this control
 * here, and if not, what do I tell them?" -- and, now that the routes exist,
 * the one place that performs the control.
 *
 * WHY A HOOK RATHER THAN A PROP DRILL
 * -----------------------------------
 * Four screens need the same answer -- Guests (Disconnect, and the per-device
 * panel), Blocked Guests, Guest WiFi Limits and Access Tiers -- and three of
 * them are nested inside a tab host (`PoliciesHub`) that has no business
 * knowing about controllers. Threading a venue capability through it would put
 * vendor logic in a component whose entire job is switching tabs.
 *
 * WHERE THE FACTS COME FROM
 * -------------------------
 * 1. Is this venue controller-managed, and what brand? Off the persisted
 *    active-venue summary, exactly as `CustomerFeaturePage` and
 *    `CustomerSidebar` already read it (`locationIsControllerManaged` /
 *    `locationControllerVendor`). No new request, and the same `every`-not-
 *    `some` gate, so a mixed venue and an unreadable venue both keep every
 *    control exactly as they have it today.
 * 2. What can we ask that controller to do? The backend, via
 *    `omada-client-controls.service.ts`, which answers with the seven declared
 *    capabilities or `null` when nothing told us.
 *
 * A MIKROTIK VENUE NEVER FETCHES ANYTHING AND NEVER CALLS ANYTHING.
 * `enabled` is false for it, so this hook adds no request to any screen that
 * does not have a controller; `capabilities` stays null, every verdict is
 * `available` with a null reason, and the four action functions below are
 * unreachable because the panel that renders them is not rendered. That is
 * every venue in production today bar one.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useCustomerStore } from "@/stores/customerStore";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  clientControlVerdict,
  deviceActionVerdict,
  type ClientActionFacts,
  type ClientControlId,
  type ClientControlVerdict,
  type ControllerClientCapabilities,
  type ControllerLiveness,
  type ControllerVenueFacts,
  type DeviceActionId,
  type DeviceActionVerdict,
} from "@/lib/omada-client-controls";
import {
  CUSTOMER_CLIENT_ROUTES_LANDED,
  omadaClientControlsService,
  type ClientSpeedRequest,
} from "@/services/omada-client-controls.service";

export interface ClientControls {
  /** True only when EVERY router at this venue is a vendor controller. */
  controllerManaged: boolean;
  /** Raw `routers.vendor`, or null. Only for copy that names a brand. */
  vendor: string | null;
  /** What the backend declared, or null when nothing told us. */
  capabilities: ControllerClientCapabilities | null;
  /**
   * Whether that controller is answering, or null when the backend said
   * nothing about liveness (a pre-#289 build, or a venue we could not ask).
   *
   * Exposed alongside the verdicts rather than folded into them because a
   * screen may want to say WHEN we last looked. The verdicts already account
   * for it -- see `controllerIsAnswering` -- so a screen must not gate a
   * control on this itself and end up with a second copy of the ladder.
   */
  controller: ControllerLiveness | null;
  /** The verdict for one screen-level control. Stable identity per render. */
  verdict: (control: ClientControlId) => ClientControlVerdict;
  /** The verdict for one per-device button, gated on its own capability. */
  deviceVerdict: (action: DeviceActionId) => DeviceActionVerdict;
  /** True while the capabilities read is in flight -- a control renders
   * disabled but WITHOUT a reason during it, because we do not have one yet
   * and inventing one would be a sentence about a venue we have not asked. */
  loading: boolean;
}

export function useClientControls(): ClientControls {
  const liveness = useCustomerStore((s) => s.activeLocation)?.liveness;
  // The store's own id rather than one off the summary: `activeLocationId` is
  // what every other customer screen routes on, and the two are set together.
  const locationId = useCustomerStore((s) => s.activeLocationId);

  const controllerManaged = locationIsControllerManaged(liveness);
  const vendor = locationControllerVendor(liveness);

  const { data: read, isLoading } = useQuery({
    queryKey: ["controller-client-capabilities", locationId],
    queryFn: () => omadaClientControlsService.readCapabilities(locationId as string),
    enabled: CUSTOMER_CLIENT_ROUTES_LANDED && controllerManaged && !!locationId,
    // A venue's controller credentials do not change between two clicks on a
    // tab strip. One read for the whole dashboard, not one per screen.
    staleTime: 5 * 60_000,
  });

  const capabilities = read?.capabilities ?? null;
  // `?? null` here too, and it means something DIFFERENT from the line above:
  // a backend older than #289 sends no `controller` block, and that must leave
  // this venue exactly as it is today rather than grey its controls on a field
  // nobody sent. `controllerIsAnswering` is where that asymmetry is decided.
  const controller = read?.controller ?? null;

  const facts: ControllerVenueFacts = useMemo(
    // `?? null` and never `?? {}`: an undefined query result means we have not
    // asked, which the verdict ladder renders differently from a controller
    // that answered "no". Collapsing the two would blame the venue's hardware
    // for a read of ours that did not come back.
    () => ({ controllerManaged, vendor, capabilities, controller }),
    [controllerManaged, vendor, capabilities, controller],
  );

  return useMemo(
    () => ({
      controllerManaged,
      vendor,
      capabilities,
      controller,
      verdict: (control: ClientControlId) => clientControlVerdict(control, facts),
      deviceVerdict: (action: DeviceActionId) => deviceActionVerdict(action, facts),
      loading: controllerManaged && isLoading,
    }),
    [controllerManaged, vendor, capabilities, controller, facts, isLoading],
  );
}

export interface DeviceActionRunner {
  block: (clientMac: string) => Promise<ClientActionFacts>;
  unblock: (clientMac: string) => Promise<ClientActionFacts>;
  disconnect: (clientMac: string) => Promise<ClientActionFacts>;
  setSpeed: (clientMac: string, request: ClientSpeedRequest) => Promise<ClientActionFacts>;
  clearSpeed: (clientMac: string) => Promise<ClientActionFacts>;
  pending: boolean;
}

/**
 * The five writes, bound to the venue the console is currently on.
 *
 * SEPARATE FROM `useClientControls` ON PURPOSE. Three of the four screens that
 * read a verdict never perform an action, and a `useMutation` in the shared
 * hook would put a mutation's identity in their render path for nothing. It
 * also keeps the read honest: a screen that only asks "may I?" cannot
 * accidentally acquire the ability to do it.
 *
 * Every call is keyed on the ACTIVE LOCATION and a MAC, and on nothing else.
 * There is no integration id to pass and none may be introduced -- see the
 * service module's header for why that is the tenancy design rather than a
 * URL style.
 */
export function useDeviceActions(): DeviceActionRunner {
  const locationId = useCustomerStore((s) => s.activeLocationId);
  const queryClient = useQueryClient();

  const run = useMutation({
    mutationFn: async (job: (locationId: string) => Promise<ClientActionFacts>) => {
      if (!locationId) throw new Error("No venue is selected.");
      return job(locationId);
    },
    onSettled: () => {
      // A block or a disconnect changes what the Guests table should say about
      // that device the next time it loads. Nothing here writes optimistically
      // -- `performed` is the outcome and it can be false on a 200.
      queryClient.invalidateQueries({ queryKey: ["customer", "users"] });
    },
  });

  const { mutateAsync } = run;
  const call = useCallback(
    (job: (locationId: string) => Promise<ClientActionFacts>) => mutateAsync(job),
    [mutateAsync],
  );

  return useMemo(
    () => ({
      block: (clientMac: string) =>
        call((loc) => omadaClientControlsService.blockClient(loc, clientMac)),
      unblock: (clientMac: string) =>
        call((loc) => omadaClientControlsService.unblockClient(loc, clientMac)),
      disconnect: (clientMac: string) =>
        call((loc) => omadaClientControlsService.disconnectClient(loc, clientMac)),
      setSpeed: (clientMac: string, request: ClientSpeedRequest) =>
        call((loc) => omadaClientControlsService.setSpeed(loc, clientMac, request)),
      clearSpeed: (clientMac: string) =>
        call((loc) => omadaClientControlsService.clearSpeed(loc, clientMac)),
      pending: run.isPending,
    }),
    [call, run.isPending],
  );
}
