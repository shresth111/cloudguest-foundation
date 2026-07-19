import { toast } from "sonner";
import {
  RefreshCw,
  Power,
  Check,
  FileText,
  Download,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const actions = [
  { key: "refresh", label: "Refresh monitoring", icon: RefreshCw, tone: "bg-sky-500/15 text-sky-500" },
  { key: "restart", label: "Restart router", icon: Power, tone: "bg-red-500/15 text-red-500" },
  { key: "ack", label: "Acknowledge alerts", icon: Check, tone: "bg-amber-500/15 text-amber-600" },
  { key: "resolve", label: "Resolve incident", icon: ShieldCheck, tone: "bg-emerald-500/15 text-emerald-500" },
  { key: "export", label: "Export reports", icon: Download, tone: "bg-violet-500/15 text-violet-500" },
  { key: "logs", label: "View logs", icon: FileText, tone: "bg-muted text-foreground" },
];

export function MonitoringQuickActions() {
  const qc = useQueryClient();
  const handle = (key: string) => {
    if (key === "refresh") {
      qc.invalidateQueries({ queryKey: ["monitoring"] });
      toast.success("Monitoring data refreshed");
    } else if (key === "restart") toast.success("Restart request queued (mock)");
    else if (key === "ack") toast.success("Alerts acknowledged");
    else if (key === "resolve") toast.success("Incident resolved");
    else if (key === "export") toast.success("Report export started");
    else toast.success("Logs opened");
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Quick actions</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Button key={a.key} variant="outline" className="h-auto justify-start p-3" onClick={() => handle(a.key)}>
              <div className={`mr-3 flex h-8 w-8 items-center justify-center rounded-lg ${a.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm">{a.label}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
