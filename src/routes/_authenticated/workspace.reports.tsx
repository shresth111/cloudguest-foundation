import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduledReportsPanel } from "@/components/analytics/ScheduledReportsPanel";
import { useGenerateReport } from "@/hooks/useAnalytics";
import type { ReportFormat, ReportType } from "@/types/analytics";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/_authenticated/workspace/reports")({
  component: ReportsPage,
});

const templates: { name: string; desc: string; type: ReportType }[] = [
  { name: "Guest activity", desc: "Sessions, unique devices, satisfaction.", type: "guest" },
  { name: "Router health", desc: "Uptime, latency, incidents per router.", type: "router" },
  { name: "Revenue summary", desc: "MRR, invoices, plan usage.", type: "revenue" },
  { name: "Network summary", desc: "Bandwidth, VLANs, ISP uptime.", type: "network" },
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

function ReportsPage() {
  const generate = useGenerateReport();

  function handleGenerate(type: ReportType, format: ReportFormat) {
    generate.mutate(
      { type, format, range: "last30" },
      {
        onSuccess: ({ url, filename }) => {
          if (url.startsWith("#unavailable/")) {
            toast.error("This report type isn't available yet");
            return;
          }
          downloadBlobUrl(url, filename);
          toast.success(`${filename} downloaded`);
        },
        onError: (err) => toast.error((err as unknown as AppError).message || "Failed to generate report"),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Generate a report now, or schedule one to run automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{t.desc}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generate.isPending}
                  onClick={() => handleGenerate(t.type, "pdf")}
                >
                  {generate.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-1 h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generate.isPending}
                  onClick={() => handleGenerate(t.type, "excel")}
                >
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
                </Button>
                <Button
                  size="sm"
                  disabled={generate.isPending}
                  onClick={() => handleGenerate(t.type, "csv")}
                >
                  <Download className="mr-1 h-4 w-4" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ScheduledReportsPanel />
    </div>
  );
}
