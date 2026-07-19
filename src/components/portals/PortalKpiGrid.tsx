import { motion } from "framer-motion";
import {
  Activity,
  BookOpenCheck,
  Eye,
  FileEdit,
  LayoutTemplate,
  MapPin,
  Palette,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { usePortalKpis } from "@/hooks/usePortals";

interface Kpi {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: string;
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : n.toLocaleString();
}

export function PortalKpiGrid() {
  const { data, isLoading, isError, refetch } = usePortalKpis();

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const cards: Kpi[] = [
    { label: "Total portals", value: fmt(data.totalPortals), icon: LayoutTemplate, tone: "from-sky-500/15 to-transparent text-sky-600" },
    { label: "Published", value: fmt(data.publishedPortals), icon: BookOpenCheck, tone: "from-emerald-500/15 to-transparent text-emerald-600" },
    { label: "Drafts", value: fmt(data.draftPortals), icon: FileEdit, tone: "from-amber-500/15 to-transparent text-amber-600" },
    { label: "Active locations", value: fmt(data.activeLocations), icon: MapPin, tone: "from-indigo-500/15 to-transparent text-indigo-600" },
    { label: "Active themes", value: fmt(data.activeThemes), icon: Palette, tone: "from-pink-500/15 to-transparent text-pink-600" },
    { label: "Today's logins", value: fmt(data.todaysLogins), icon: Activity, tone: "from-teal-500/15 to-transparent text-teal-600" },
    { label: "Conversion rate", value: `${data.conversionRate}%`, hint: "logins / views", icon: TrendingUp, tone: "from-violet-500/15 to-transparent text-violet-600" },
    { label: "Portal views", value: fmt(data.portalViews), icon: Eye, tone: "from-cyan-500/15 to-transparent text-cyan-600" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.25 }}
        >
          <Card className="relative overflow-hidden">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${c.tone} opacity-40`} />
            <CardContent className="relative flex items-start justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{c.value}</p>
                {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
              </div>
              <c.icon className={`h-5 w-5 ${c.tone.split(" ").pop()}`} />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
