import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduledReportsPanel } from "@/components/analytics/ScheduledReportsPanel";
import { useGenerateReport } from "@/hooks/useAnalytics";
import type { DateRangePreset, ReportFormat, ReportType } from "@/types/analytics";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/_authenticated/workspace/reports")({
  component: ReportsPage,
});

// "Revenue summary" is deliberately absent. It maps to the backend's
// BusinessAnalyticsService, which calls scope.require_global(): it 403s for
// every venue owner, and for a global-scope operator viewing this page it
// would emit a *platform-wide* revenue report from a customer surface. The
// venue owner's own billing figures live on /workspace/billing.
const templates: { name: string; desc: string; type: ReportType }[] = [
  { name: "Guest activity", desc: "Sessions, unique devices, satisfaction.", type: "guest" },
  { name: "Router health", desc: "Uptime, latency, incidents per router.", type: "router" },
  { name: "Network summary", desc: "Bandwidth, VLANs, ISP uptime.", type: "network" },
];

const RANGES: { value: DateRangePreset; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
];

const FORMATS: {
  format: ReportFormat;
  label: string;
  icon: typeof FileText;
  primary?: boolean;
}[] = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "excel", label: "Excel", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", icon: Download, primary: true },
];

function downloadBlobUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function rangeLabel(range: DateRangePreset): string {
  return RANGES.find((r) => r.value === range)?.label ?? "Last 30 days";
}

function ReportsPage() {
  const generate = useGenerateReport();
  const [range, setRange] = useState<DateRangePreset>("last30");
  // One shared mutation drives every button, so pending state has to be
  // tracked per button -- otherwise clicking CSV disabled all nine and put
  // the spinner on all three PDF buttons.
  const [pending, setPending] = useState<string | null>(null);

  function handleGenerate(type: ReportType, format: ReportFormat) {
    const key = `${type}:${format}`;
    setPending(key);
    generate.mutate(
      { type, format, range },
      {
        onSuccess: ({ url, filename }) => {
          if (url.startsWith("#unavailable/")) {
            toast.error("This report type isn't available yet");
            return;
          }
          downloadBlobUrl(url, filename);
          toast.success(`${filename} downloaded`);
        },
        onError: (err) =>
          toast.error((err as unknown as AppError).message || "Failed to generate report"),
        onSettled: () => setPending((k) => (k === key ? null : k)),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate a report now, or schedule one to run automatically.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-range">Period</Label>
          <Select value={range} onValueChange={(v) => setRange(v as DateRangePreset)}>
            <SelectTrigger id="report-range" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{rangeLabel(range)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(({ format, label, icon: Icon, primary }) => {
                  const isPending = pending === `${t.type}:${format}`;
                  return (
                    <Button
                      key={format}
                      size="sm"
                      variant={primary ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() => handleGenerate(t.type, format)}
                    >
                      {isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="mr-1 h-4 w-4" />
                      )}
                      {label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ScheduledReportsPanel />
    </div>
  );
}
