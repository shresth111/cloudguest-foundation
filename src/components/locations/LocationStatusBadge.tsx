import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LocationStatus, PropertyType } from "@/types/location";
import { LOCATION_STATUS_LABEL, PROPERTY_TYPE_LABEL } from "@/types/location";

const STATUS_STYLES: Record<LocationStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  inactive: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  suspended: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400",
  archived: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

export function LocationStatusBadge({ status }: { status: LocationStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {LOCATION_STATUS_LABEL[status]}
    </Badge>
  );
}

const SITE_STYLES: Record<PropertyType, string> = {
  hotel: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-300",
  resort: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-300",
  cafe: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
  restaurant: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-300",
  hospital: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-300",
  clinic: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-300",
  office: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
  coworking_space: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
  school: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  college: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  university: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  mall: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-300",
  airport: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-300",
  factory: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-300",
  warehouse: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-300",
  apartment: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-300",
  hostel: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-300",
  custom: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-300",
};

export function SiteTypeBadge({ type }: { type: PropertyType | null }) {
  if (!type) return <Badge variant="outline">—</Badge>;
  return (
    <Badge variant="outline" className={cn("rounded-full", SITE_STYLES[type])}>
      {PROPERTY_TYPE_LABEL[type]}
    </Badge>
  );
}
