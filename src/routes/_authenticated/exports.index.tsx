import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3, Building2, FileText, Router, ScrollText, Ticket, Users, Wallet,
  FileSpreadsheet, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { systemService } from "@/services/system.service";

export const Route = createFileRoute("/_authenticated/exports/")({
  component: ExportsPage,
});

const ENTITIES = [
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "guests", label: "Guests", icon: Users },
  { key: "routers", label: "Routers", icon: Router },
  { key: "users", label: "Users", icon: Building2 },
  { key: "audit", label: "Audit logs", icon: ScrollText },
  { key: "billing", label: "Billing", icon: Wallet },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "vouchers", label: "Vouchers", icon: Ticket },
] as const;

type Fmt = "pdf" | "excel" | "csv";

function ExportsPage() {
  const [history, setHistory] = useState<{ id: string; entity: string; format: Fmt; at: string }[]>([]);

  const trigger = async (entity: string, format: Fmt) => {
    await systemService.requestExport(entity, format);
    setHistory((h) => [{ id: `e_${Date.now()}`, entity, format, at: new Date().toISOString() }, ...h].slice(0, 20));
    toast.success(`${entity} export requested`, { description: `Format: ${format.toUpperCase()}` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Export center" description="Bulk download data in PDF, Excel, or CSV formats." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ENTITIES.map((e) => {
          const Icon = e.icon;
          return (
            <Card key={e.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                  {e.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => trigger(e.label, "pdf")}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
                <Button variant="outline" size="sm" onClick={() => trigger(e.label, "excel")}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
                <Button variant="outline" size="sm" onClick={() => trigger(e.label, "csv")}><FileDown className="mr-1 h-4 w-4" />CSV</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent exports</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports yet. Queue one above.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-muted-foreground" /> {h.entity}
                    <Badge variant="outline" className="uppercase">{h.format}</Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
