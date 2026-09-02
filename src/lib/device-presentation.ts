import { Wifi, Printer, Router, Camera, HardDrive } from "lucide-react";
import type { DeviceType } from "@/stores/deviceStore";

/**
 * Two small helpers that used to live in `BasicFeatureViews.tsx`.
 *
 * They were imported from three places -- `OperationsFeatures.tsx`
 * (`normalizeMac`), `CustomerFeaturePage.tsx` and `CustomerDashboardPage.tsx`
 * (`DEVICE_TYPE_META`) -- and each of those imports dragged the entire
 * 800-line view module into the bundle graph for the sake of one constant or
 * one pure function. Because `routeTree.gen.ts` statically imports all 180
 * routes, that put `BasicFeatureViews` into the set of chunks the browser
 * fetches before the sign-in form can paint.
 *
 * Measured on demo.wyfyguest.com: it was one of 37 chunks on a signed-out
 * first paint. Moving these two out is what actually removes it; deferring
 * the render registry alone did not, because these three importers remained.
 */

/** Icon, gradient and text colour per device type, for the cards and lists
 *  that render a hardware inventory. */
export const DEVICE_TYPE_META: Record<
  DeviceType,
  { icon: typeof Wifi; gradient: string; text: string }
> = {
  "Access Point": { icon: Wifi, gradient: "from-sky-500 to-cyan-500", text: "text-sky-500" },
  Printer: { icon: Printer, gradient: "from-amber-500 to-orange-500", text: "text-amber-500" },
  Router: { icon: Router, gradient: "from-indigo-500 to-violet-500", text: "text-indigo-500" },
  Camera: { icon: Camera, gradient: "from-rose-500 to-pink-500", text: "text-rose-500" },
  Other: { icon: HardDrive, gradient: "from-slate-500 to-slate-600", text: "text-slate-500" },
};

/** Normalizes any commonly-pasted MAC format (dashes, dots, no separators,
 * mixed case, stray whitespace -- e.g. what a router's own MAC is shown as
 * elsewhere in this app, "CB-D1-76-EC-90-3E") into the canonical
 * "AA:BB:CC:DD:EE:FF" form. Returns null if it can't be salvaged into 12
 * hex digits. */
export function normalizeMac(raw: string): string | null {
  const hex = raw.trim().replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length !== 12) return null;
  return (hex.match(/.{2}/g) ?? []).join(":").toUpperCase();
}
