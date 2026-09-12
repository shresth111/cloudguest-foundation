/**
 * The router list inside every device-domain picker -- FIX-PLAN FE-3.
 *
 * WHY THIS EXISTS
 * ---------------
 * Network Zones, IP Addresses, Port Forwarding, Call Priority and Website
 * Blocking each write RouterOS through a per-vendor adapter registry that has
 * exactly one vendor in it. `CustomerFeaturePage` already refuses to mount any
 * of them at a venue whose routers are ALL controllers -- but that gate is
 * `every`, not `some`, deliberately: at a MIXED venue the screens act on the
 * MikroTik and they genuinely work.
 *
 * A mixed venue is where this second gate was missing, and it is what QA
 * observed live: Network Zones' "New zone", Port Forwarding's "New Rule" and
 * IP Addresses' "New address range" each offered exactly ONE option -- the
 * Omada-vendored `Office Guest` -- with no badge and no warning. The owner
 * fills in the whole RouterOS-shaped form ("Which cable does it use?",
 * tagged/untagged port mode) and the backend refuses by vendor on submit.
 *
 * WHY FILTERED OUT RATHER THAN LISTED-AND-DISABLED
 * -----------------------------------------------
 * FIX-PLAN D4 settles this: the SCREEN is never hidden and always explains
 * itself, but the picker "never offers a controller row". A disabled row still
 * reads as something to argue with; an absence plus a sentence naming what is
 * absent, and where it is configured instead, is the honest shape. The
 * sentence is the load-bearing half -- a router that silently vanishes from a
 * picker is a support ticket.
 *
 * Judged with `isControllerManagedRow`, never the bare vendor string: a
 * MikroTik mislabelled as a controller (which has happened, seven times) must
 * not disappear from its own venue's picker.
 *
 * Every string a venue owner reads here comes from `@/lib/router-vendors`, so
 * the copy can be swapped in one edit.
 */
import { SelectItem } from "@/components/ui/select";
import {
  excludedControllerRoutersNote,
  partitionRoutersByDeviceWrite,
  type VendorJudgeableRouter,
} from "@/lib/router-vendors";

/** The selectable rows, controllers removed. */
export function RouterPickerItems<T extends VendorJudgeableRouter>({
  rows,
  renderLabel,
}: {
  rows: readonly T[];
  /** How one row is labelled, when a screen shows more than the name (ISP
   * Details appends the venue). Defaults to the name. */
  renderLabel?: (r: T) => React.ReactNode;
}) {
  const { writable } = partitionRoutersByDeviceWrite(rows);
  const label = renderLabel ?? ((r: T) => r.name);
  return (
    <>
      {writable.map((r) => (
        <SelectItem key={r.id} value={r.id}>
          {label(r)}
        </SelectItem>
      ))}
    </>
  );
}

/**
 * The line under the picker naming what is not in it, and why.
 *
 * Renders nothing at a venue with no controller, so a MikroTik-only venue
 * sees no new text at all.
 */
export function ControllerRoutersNote({ rows }: { rows: readonly VendorJudgeableRouter[] }) {
  const { controllerManaged } = partitionRoutersByDeviceWrite(rows);
  const note = excludedControllerRoutersNote(controllerManaged);
  if (!note) return null;
  return <p className="text-[11px] leading-relaxed text-muted-foreground">{note}</p>;
}

/**
 * Whether this venue has any router these forms can act on at all.
 *
 * The case FE-3 calls out: at a controller-only venue reached through some
 * path the screen-level gate did not cover, the filtered list is EMPTY, and an
 * empty picker over a live form is the same defect wearing a different face.
 * Call sites render the D4 notice instead.
 */
export function hasWritableRouter(rows: readonly VendorJudgeableRouter[]): boolean {
  return partitionRoutersByDeviceWrite(rows).writable.length > 0;
}
