import { motion } from "framer-motion";
import { Palette, Globe, Sparkles, Image as ImageIcon, Mail, MessageSquare, Layers, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { cn } from "@/lib/utils";
import type { WhiteLabelKpis } from "@/types/branding";

interface Props {
  data?: WhiteLabelKpis;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const tones = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-500",
  info: "bg-sky-500/10 text-sky-500",
  warning: "bg-amber-500/10 text-amber-500",
  violet: "bg-violet-500/10 text-violet-500",
  pink: "bg-pink-500/10 text-pink-500",
} as const;

export function WhiteLabelKpiGrid({ data, isLoading, isError, onRetry }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={onRetry} />;

  const tiles = [
    { label: "White label clients", value: data.totalClients, icon: Layers, tone: tones.primary },
    { label: "Active brands", value: data.activeBrands, icon: Sparkles, tone: tones.success },
    { label: "Custom domains", value: data.customDomains, icon: Globe, tone: tones.info },
    { label: "Active themes", value: data.activeThemes, icon: Palette, tone: tones.violet },
    { label: "Email templates", value: data.emailTemplates, icon: Mail, tone: tones.info },
    { label: "SMS templates", value: data.smsTemplates, icon: MessageSquare, tone: tones.warning },
    { label: "Active logos", value: data.activeLogos, icon: ImageIcon, tone: tones.pink },
    { label: "Published branding", value: data.publishedBranding, icon: CheckCircle2, tone: tones.success },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">{t.value}</div>
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", t.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
