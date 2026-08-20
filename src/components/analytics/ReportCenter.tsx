import { useState } from "react";
import {
  FileText,
  Router as RouterIcon,
  Wifi,
  Building2,
  MapPin,
  DollarSign,
  ClipboardList,
  Receipt,
  Activity,
  FileSpreadsheet,
  FileType2,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGenerateReport } from "@/hooks/useAnalytics";
import type { AppError } from "@/services/api";
import type { DateRangePreset, ReportFormat, ReportType } from "@/types/analytics";

interface Props {
  range: DateRangePreset;
}

/** Mirrors workspace.reports.tsx's own identical helper for the
 * customer-facing reports page -- there is no shared download util in this
 * codebase yet, each report screen keeps its own copy of this. */
function downloadBlobUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const REPORTS: { type: ReportType; label: string; description: string; icon: typeof FileText }[] = [
  {
    type: "guest",
    label: "Guest report",
    description: "Guest activity, sessions and demographics",
    icon: FileText,
  },
  {
    type: "router",
    label: "Router report",
    description: "Fleet performance, uptime and health",
    icon: RouterIcon,
  },
  {
    type: "network",
    label: "Network report",
    description: "Bandwidth, latency and utilization",
    icon: Wifi,
  },
  {
    type: "organization",
    label: "Organization report",
    description: "Per-org rollup and rankings",
    icon: Building2,
  },
  {
    type: "location",
    label: "Location report",
    description: "Location traffic, guests and revenue",
    icon: MapPin,
  },
  {
    type: "revenue",
    label: "Revenue report",
    description: "MRR, ARR and revenue trend",
    icon: DollarSign,
  },
  {
    type: "audit",
    label: "Audit report",
    description: "System audit trail and user actions",
    icon: ClipboardList,
  },
  {
    type: "billing",
    label: "Billing report",
    description: "Invoices, subscriptions and payments",
    icon: Receipt,
  },
  {
    type: "monitoring",
    label: "Monitoring report",
    description: "Alerts, incidents and SLA",
    icon: Activity,
  },
];

const FORMAT_ICONS: Record<ReportFormat, typeof FileText> = {
  pdf: FileType2,
  excel: FileSpreadsheet,
  csv: FileText,
};

export function ReportCenter({ range }: Props) {
  const generate = useGenerateReport();
  const [pending, setPending] = useState<string | null>(null);

  async function run(type: ReportType, format: ReportFormat) {
    const key = `${type}:${format}`;
    setPending(key);
    try {
      const res = await generate.mutateAsync({ type, format, range });
      // analyticsService.generateReport() returns this exact sentinel (never
      // throws) for report types the backend Report Engine doesn't compose
      // (audit/billing/monitoring -- see that function's own comment) --
      // reporting a fake "Report ready" success here, with no real file
      // behind it, is exactly the fabricated-export behaviour this screen
      // must not have. Mirrors workspace.reports.tsx's own identical check
      // for the customer-facing reports page.
      if (res.url.startsWith("#unavailable/")) {
        toast.error("This report type isn't available yet");
        return;
      }
      downloadBlobUrl(res.url, res.filename);
      toast.success(`${res.filename} downloaded`);
    } catch (err) {
      toast.error((err as AppError).message || "Report generation failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {REPORTS.map((r) => {
        const Icon = r.icon;
        return (
          <Card key={r.type} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start gap-3 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-semibold">{r.label}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {(["pdf", "excel", "csv"] as ReportFormat[]).map((fmt) => {
                const Fico = FORMAT_ICONS[fmt];
                const key = `${r.type}:${fmt}`;
                const busy = pending === key;
                return (
                  <Button
                    key={fmt}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(r.type, fmt)}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Fico className="mr-2 h-3.5 w-3.5" />
                    )}
                    {fmt.toUpperCase()}
                  </Button>
                );
              })}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => run(r.type, "pdf")}
              >
                <Download className="mr-2 h-3.5 w-3.5" /> Download
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
