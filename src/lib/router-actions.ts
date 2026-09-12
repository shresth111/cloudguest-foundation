/**
 * Which lifecycle actions a router can actually accept, and why not.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * The same three questions -- can this router be suspended, reinstated,
 * decommissioned -- were answered in two places that did not agree, and the
 * screen that got it wrong was the one operators use most.
 *
 * `routers.$routerId.tsx` (the detail page) had it right: it mirrors the
 * backend's transition graph and hides the toggle when neither edge exists.
 * `RouterTable.tsx` (the list) had its own rule, written from the wrong
 * question -- "does this router look inactive?" rather than "does the
 * backend accept this edge?":
 *
 *     const disabled = status === "suspended" || status === "offline" ||
 *                      status === "decommissioned";
 *     disabled ? <Reinstate/> : <Suspend/>
 *
 * which is wrong four ways at once, three of them worse than the one that
 * was reported:
 *
 *   - `pending_provisioning` and `provisioning` fall into the `else`, so the
 *     list offers SUSPEND on a router that has no suspend edge at all.
 *     (The reported defect.)
 *   - `decommissioned` is offered REINSTATE, and decommissioned is terminal:
 *     the backend allows no transition out of it whatsoever.
 *   - `offline` is offered REINSTATE, but offline is not suspended. The
 *     detail page offers it SUSPEND, which is the legal edge.
 *   - Reinstate sent `status: "online"`. SUSPENDED -> ONLINE is not an edge
 *     the backend has; only a device heartbeat may ever assert `online`.
 *     The detail page already sends `offline`, which is the real edge.
 *
 * So the list was not merely offering a dead button: three of its four
 * wrong cases would have sent a transition the API rejects, and the fourth
 * asserted liveness no measurement supports.
 *
 * WHAT THIS MIRRORS (verified against the backend, not assumed)
 * ------------------------------------------------------------
 * `app/domains/router/enums.py`'s `ROUTER_STATUS_TRANSITIONS`, read on
 * 2026-09-11:
 *
 *     pending_provisioning -> {provisioning, decommissioned}
 *     provisioning         -> {online, decommissioned}
 *     online               -> {offline, suspended, decommissioned,
 *                              pending_provisioning}
 *     offline              -> {online, suspended, decommissioned,
 *                              pending_provisioning}
 *     suspended            -> {offline, decommissioned}
 *     decommissioned       -> {}          (terminal)
 *
 * Keep this file as the only place that encodes it. Two copies is what
 * produced the bug above.
 */
import type { RouterStatus } from "@/types/router";
import { isControllerManaged, routerVendorLabel } from "@/lib/router-vendors";

/**
 * Suspending is `-> suspended`, which only `online` and `offline` have.
 * A router that has never come up has nothing to suspend.
 */
export function canSuspendRouter(status: RouterStatus): boolean {
  return status === "online" || status === "offline";
}

/** Reinstating is the way back out of `suspended`, and only from there. */
export function canReinstateRouter(status: RouterStatus): boolean {
  return status === "suspended";
}

/** Every status except the terminal one has a `-> decommissioned` edge. */
export function canDecommissionRouter(status: RouterStatus): boolean {
  return status !== "decommissioned";
}

/**
 * Where reinstating lands. NOT `online`: `suspended -> online` is not an
 * edge, and `online` is a claim only a device heartbeat may make (see
 * `src/lib/location-liveness.ts` on why nothing else may assert it). The
 * router becomes reachable-if-it-reports, which is exactly `offline`.
 */
export const REINSTATE_TARGET_STATUS: RouterStatus = "offline";

/** Where suspending lands. */
export const SUSPEND_TARGET_STATUS: RouterStatus = "suspended";

/**
 * Why neither toggle is available, in words an operator can act on.
 *
 * Returns `null` when one of them IS available, so a call site cannot
 * render a reason next to a working button.
 *
 * These are deliberately about the DEVICE, not about the API. "This router
 * cannot be suspended" tells an operator nothing they can do; "it has not
 * been set up yet" tells them the next step is the setup script.
 *
 * WHY `vendor` IS A PARAMETER (contract §11.5)
 * -------------------------------------------
 * The `pending_provisioning` sentence below is the correct next step for a
 * MikroTik and a falsehood for a controller. A controller-managed row sits
 * at `pending_provisioning` PERMANENTLY -- nothing provisions it, so
 * nothing ever moves it on -- and there is no setup script to run: an
 * Omada controller is configured on the controller, not by a script this
 * platform writes onto it. So the one status that most needs a reason was
 * handing the operator the exact instruction `1b2a89b` set out to delete
 * from every other cell in this row, in the menu that commit edited.
 *
 * Optional, so the detail page and any other caller that has no vendor to
 * hand keeps the agent-managed wording it has today.
 */
export function routerToggleUnavailableReason(
  status: RouterStatus,
  vendor?: string | null,
): string | null {
  if (canSuspendRouter(status) || canReinstateRouter(status)) return null;
  // Ahead of the status switch on purpose: for a controller the vendor is
  // the whole explanation and the status is an artefact, so a status-first
  // answer would bury the only true half.
  if (isControllerManaged(vendor) && status !== "decommissioned") {
    return (
      `This is a ${routerVendorLabel(vendor)} controller, so there is no suspend step here. ` +
      "Guest access is granted and withdrawn on the controller itself; this row is the fleet " +
      "record that lets sessions be logged against it."
    );
  }
  switch (status) {
    case "pending_provisioning":
      return "This router has not been set up yet, so there is nothing to suspend. Run its setup script first.";
    case "provisioning":
      return "This router is still being set up and has never checked in, so there is nothing to suspend yet.";
    case "decommissioned":
      return "This router has been decommissioned. That is final — add a replacement router instead.";
    default:
      return "This router's current status has no suspend or reinstate step.";
  }
}
