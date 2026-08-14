/**
 * Maps a location's `propertyType` (backend `PropertyType`, see
 * `types/location.ts`) to the lucide-react icon that best represents that
 * business/property type, so a location/organization row renders an icon
 * that actually reflects what kind of place it is (a cafe shows a coffee
 * cup, a school shows a school icon, etc.) instead of one generic icon
 * everywhere.
 *
 * `Organization` itself has no business-type field of its own -- only
 * `Location.propertyType` does (see backend
 * `app/domains/location/enums.py::PropertyType`) -- so anywhere an
 * *organization* needs a representative icon, callers pass the property
 * type of that organization's primary/first location, if any is known.
 */
import {
  BedDouble,
  Briefcase,
  Building2,
  Coffee,
  Factory,
  GraduationCap,
  Home,
  Hospital,
  Hotel,
  Landmark,
  Palmtree,
  Plane,
  School,
  ShoppingBag,
  Stethoscope,
  UtensilsCrossed,
  Users2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { PropertyType } from "@/types/location";

/** Generic fallback for locations/orgs with no (or unrecognized) business
 * type -- e.g. every row created before this field existed. */
export const DEFAULT_BUSINESS_TYPE_ICON: LucideIcon = Building2;

export const BUSINESS_TYPE_ICON: Record<PropertyType, LucideIcon> = {
  hotel: Hotel,
  resort: Palmtree,
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  hospital: Hospital,
  clinic: Stethoscope,
  office: Briefcase,
  coworking_space: Users2,
  school: School,
  college: GraduationCap,
  university: Landmark,
  mall: ShoppingBag,
  airport: Plane,
  factory: Factory,
  warehouse: Warehouse,
  apartment: Home,
  hostel: BedDouble,
  custom: DEFAULT_BUSINESS_TYPE_ICON,
};

/** Resolve a location/org's icon from its (possibly null/undefined/unknown)
 * `propertyType`, gracefully falling back to a generic building icon --
 * covers pre-existing rows with no value set as well as any string that
 * doesn't match a known `PropertyType`. */
export function businessTypeIcon(propertyType: string | null | undefined): LucideIcon {
  if (!propertyType) return DEFAULT_BUSINESS_TYPE_ICON;
  return BUSINESS_TYPE_ICON[propertyType as PropertyType] ?? DEFAULT_BUSINESS_TYPE_ICON;
}
