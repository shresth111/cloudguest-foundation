import { cn } from "@/lib/utils";
import { resolveIspBrand } from "@/lib/isp-brand";
import { AirtelIcon } from "./AirtelIcon";
import { JioIcon } from "./JioIcon";
import { ViIcon } from "./ViIcon";
import { BsnlIcon } from "./BsnlIcon";
import { ActFibernetIcon } from "./ActFibernetIcon";
import { TataIcon } from "./TataIcon";
import { GenericIspIcon } from "./GenericIspIcon";

const BRAND_ICON = {
  airtel: AirtelIcon,
  jio: JioIcon,
  vi: ViIcon,
  bsnl: BsnlIcon,
  act: ActFibernetIcon,
  tata: TataIcon,
  generic: GenericIspIcon,
} as const;

/**
 * Renders the right small brand badge for an ISP link's free-text
 * `providerName` -- the backend has no ISP enum to key off of
 * (`IspLink.providerName` is a plain string, see `types/isp.ts`), so this
 * matches on name (`resolveIspBrand`) the same way every other free-text
 * "what kind of X is this" lookup in this codebase works (compare
 * `lib/business-type-icons.ts`'s `propertyType` -> icon mapping).
 * Anything unrecognized renders the neutral `GenericIspIcon` rather than
 * guessing at a brand.
 */
export function IspProviderIcon({
  providerName,
  className,
}: {
  providerName: string | null | undefined;
  className?: string;
}) {
  const Icon = BRAND_ICON[resolveIspBrand(providerName)];
  return <Icon className={cn("h-5 w-5 shrink-0", className)} aria-hidden="true" />;
}
