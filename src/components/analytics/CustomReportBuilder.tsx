import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "./DateRangeFilter";
import { useGenerateReport } from "@/hooks/useAnalytics";
import type { DateRangePreset, ReportFormat, ReportType } from "@/types/analytics";

const METRICS = [
  "Sessions",
  "Guests",
  "Bandwidth",
  "Revenue",
  "Uptime",
  "CPU",
  "Memory",
  "Login success",
  "Login failures",
] as const;

const schema = z.object({
  reportType: z.enum(["guest", "router", "network", "organization", "location", "revenue", "audit", "billing", "monitoring"]),
  organizationId: z.string().min(1),
  locationId: z.string().min(1),
  routerId: z.string().min(1),
  metrics: z.array(z.string()).min(1, "Pick at least one metric"),
  format: z.enum(["pdf", "excel", "csv"]),
});

type FormValues = z.infer<typeof schema>;

const ORGS = ["all", "Aurora Hospitality", "Northwind Retail", "Skyway Airports", "Meridian Cafes"];
const LOCS = ["all", "The Grand Hotel", "Skyline Tower", "Harbor Mall", "Central Cafe"];
const ROUTERS = ["all", "GW-EDGE-01", "GW-EDGE-02", "HUB-CORE-03", "AP-BRANCH-14"];

export function CustomReportBuilder() {
  const [range, setRange] = useState<DateRangePreset>("last30");
  const [preview, setPreview] = useState<FormValues | null>(null);
  const generate = useGenerateReport();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reportType: "guest",
      organizationId: "all",
      locationId: "all",
      routerId: "all",
      metrics: ["Sessions", "Guests"],
      format: "pdf",
    },
  });

  const values = form.watch();

  async function onExport(v: FormValues) {
    try {
      const res = await generate.mutateAsync({ type: v.reportType as ReportType, format: v.format as ReportFormat, range });
      toast.success("Custom report exported", { description: res.filename });
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Custom report builder</CardTitle>
          <p className="text-xs text-muted-foreground">Compose a report by scope, metrics and format.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onExport)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Report type</Label>
                <Select value={values.reportType} onValueChange={(v) => form.setValue("reportType", v as FormValues["reportType"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["guest", "router", "network", "organization", "location", "revenue", "audit", "billing", "monitoring"] as const).map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date range</Label>
                <DateRangeFilter value={range} onChange={setRange} />
              </div>
              <div className="space-y-1.5">
                <Label>Organization</Label>
                <Select value={values.organizationId} onValueChange={(v) => form.setValue("organizationId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ORGS.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All organizations" : o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={values.locationId} onValueChange={(v) => form.setValue("locationId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCS.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All locations" : o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Router</Label>
                <Select value={values.routerId} onValueChange={(v) => form.setValue("routerId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROUTERS.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All routers" : o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select value={values.format} onValueChange={(v) => form.setValue("format", v as ReportFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Metrics</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {METRICS.map((m) => {
                  const checked = values.metrics.includes(m);
                  return (
                    <label key={m} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const set = new Set(values.metrics);
                          if (v) set.add(m); else set.delete(m);
                          form.setValue("metrics", Array.from(set), { shouldValidate: true });
                        }}
                      />
                      {m}
                    </label>
                  );
                })}
              </div>
              {form.formState.errors.metrics && (
                <p className="text-xs text-destructive">{form.formState.errors.metrics.message}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setPreview(values)}>
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
              <Button type="submit" disabled={generate.isPending}>
                {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Preview</CardTitle>
          <p className="text-xs text-muted-foreground">Configuration summary before export.</p>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Configure the report and click <span className="font-medium text-foreground">Preview</span> to see the summary here.
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <SummaryRow label="Type" value={<Badge variant="secondary" className="capitalize">{preview.reportType}</Badge>} />
              <SummaryRow label="Date range" value={range.replace("_", " ")} />
              <SummaryRow label="Organization" value={preview.organizationId === "all" ? "All" : preview.organizationId} />
              <SummaryRow label="Location" value={preview.locationId === "all" ? "All" : preview.locationId} />
              <SummaryRow label="Router" value={preview.routerId === "all" ? "All" : preview.routerId} />
              <SummaryRow label="Format" value={preview.format.toUpperCase()} />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Metrics</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.metrics.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}
                </div>
              </div>
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Preview generated from mock data. Export produces a downloadable {preview.format.toUpperCase()} file.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
