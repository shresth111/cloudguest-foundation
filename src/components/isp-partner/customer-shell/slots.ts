/**
 * The slot contract: how a batch puts its page into the customer workspace.
 *
 * A batch never edits the shell. It ADDS one file under
 * `customer-shell/slots/` that exports `slots: PartnerSlot[]`. The shell
 * collects every such file at build time (`import.meta.glob`, eager: the
 * files are a few lines each; the pages themselves stay lazy), so two
 * stacked PRs from two engineers never touch the same line.
 *
 *   // customer-shell/slots/b2-access.tsx
 *   import { lazy } from "react";
 *   import type { PartnerSlot } from "../slots";
 *   export const slots: PartnerSlot[] = [
 *     { id: "policies", priority: 10, component: lazy(() => import("../../access/AccessRulesPage")) },
 *   ];
 *
 * Rules:
 *  - `id` is a nav id from `nav.ts` (the test fails on an unknown id).
 *  - Highest `priority` wins when two files fill the same id. The built-ins in
 *    `slots/00-existing.tsx` are priority 0, so a batch page (10+) replaces
 *    them without deleting them.
 *  - The component gets `PartnerSlotProps`. For a "location" item the shell
 *    has already picked the location and wrapped the page in `VenueScope`,
 *    so `/isp/venue/*` twins resolve; a page never reads ids from the URL.
 *  - The nav item's `anyOf` grants and `addon` gate run BEFORE the page
 *    mounts. Write grants inside the page are the page's own job (`can()`).
 *  - No slot for an id = the honest "Coming in this console soon" screen.
 */
import type { ComponentType } from "react";
import type { IspCustomer, IspLocation } from "@/services/isp-partner/types";

export interface PartnerSlotProps {
  customerId: string;
  customer: IspCustomer;
  /** Set for "location" items (always) and for others when one is picked. */
  locationId: string | null;
  location: IspLocation | null;
}

export interface PartnerSlot {
  id: string;
  component: ComponentType<PartnerSlotProps>;
  /** Default 0. Highest wins. */
  priority?: number;
}

type SlotModule = { slots?: readonly PartnerSlot[] };

/** Pure, so the contract test can run it without Vite. */
export function buildSlotRegistry(modules: Record<string, SlotModule>): Map<string, PartnerSlot> {
  const out = new Map<string, PartnerSlot>();
  for (const path of Object.keys(modules).sort()) {
    for (const slot of modules[path].slots ?? []) {
      const prev = out.get(slot.id);
      if (!prev || (slot.priority ?? 0) >= (prev.priority ?? 0)) out.set(slot.id, slot);
    }
  }
  return out;
}

let registry: Map<string, PartnerSlot> | null = null;

export function partnerSlots(): Map<string, PartnerSlot> {
  if (!registry) {
    registry = buildSlotRegistry(import.meta.glob<SlotModule>("./slots/*.tsx", { eager: true }));
  }
  return registry;
}
