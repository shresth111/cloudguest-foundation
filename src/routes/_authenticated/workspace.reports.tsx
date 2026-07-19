import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/workspace/reports")({
  component: ReportsPage,
});

const templates = [
  { name: "Guest activity", desc: "Sessions, unique devices, satisfaction." },
  { name: "Router health", desc: "Uptime, latency, incidents per router." },
  { name: "Revenue summary", desc: "MRR, invoices, plan usage." },
  { name: "Compliance log", desc: "GDPR, DPDP, retention reports." },
];

function ReportsPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Reports</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t.desc}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <FileText className="mr-1 h-4 w-4" /> PDF
                </Button>
                <Button size="sm" variant="outline">
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
                </Button>
                <Button size="sm">
                  <Download className="mr-1 h-4 w-4" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
