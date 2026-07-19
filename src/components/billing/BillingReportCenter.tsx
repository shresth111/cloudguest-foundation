import { toast } from "sonner";
import {
  Activity,
  Building2,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Landmark,
  MapPin,
  Receipt,
  Router as RouterIcon,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGenerateBillingReport } from "@/hooks/useBilling";
import type { BillingReportFormat } from "@/types/billing";

const REPORTS = [
  { type: "guest", label: "Guest report", desc: "Sessions, devices, engagement", icon: Users },
  { type: "router", label: "Router report", desc: "Uptime, health, incidents", icon: RouterIcon },
  { type: "network", label: "Network report", desc: "Bandwidth and traffic", icon: Wifi },
  { type: "organization", label: "Organization report", desc: "Per-org breakdown", icon: Building2 },
  { type: "location", label: "Location report", desc: "Locations and venues", icon: MapPin },
  { type: "revenue", label: "Revenue report", desc: "MRR, ARR, growth", icon: Landmark },
  { type: "audit", label: "Audit report", desc: "User & system events", icon: ShieldCheck },
  { type: "billing", label: "Billing report", desc: "Invoices and payments", icon: Receipt },
  { type: "monitoring", label: "Monitoring report", desc: "Alerts and incidents", icon: Activity },
];

const FORMAT_ICON: Record<BillingReportFormat, typeof FileText> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  csv: FileBarChart,
};

export function BillingReportCenter() {
  const gen = useGenerateBillingReport();

  const handle = (type: string, format: BillingReportFormat) => {
    gen.mutate({ type, format }, {
      onSuccess: (res) => toast.success(`${res.fileName} (${res.size})`),
      onError: () => toast.error("Failed to generate report"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Report center</h2>
          <p className="text-sm text-muted-foreground">Generate billing and operational reports on demand.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success("Bulk export queued")}>
          <Download className="mr-1.5 h-4 w-4" /> Bulk export
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.type}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                  <div>
                    <CardTitle className="text-sm">{r.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {(["pdf", "excel", "csv"] as const).map((fmt) => {
                    const F = FORMAT_ICON[fmt];
                    return (
                      <Button key={fmt} variant="outline" size="sm" onClick={() => handle(r.type, fmt)}>
                        <F className="mr-1.5 h-3.5 w-3.5" /> {fmt.toUpperCase()}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
