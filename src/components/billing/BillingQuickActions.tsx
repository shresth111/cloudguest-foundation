import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  FileDown,
  FileText,
  Plus,
  Printer,
  RefreshCcw,
  Share2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  onCreateSubscription: () => void;
  onGenerateInvoice: () => void;
  onScheduleReport: () => void;
  onExport: () => void;
  onRefresh: () => void;
}

export function BillingQuickActions({ onCreateSubscription, onGenerateInvoice, onScheduleReport, onExport, onRefresh }: Props) {
  const actions = [
    { label: "Create subscription", icon: Plus, tone: "text-emerald-500 bg-emerald-500/10", onClick: onCreateSubscription },
    { label: "Generate invoice", icon: FileText, tone: "text-sky-500 bg-sky-500/10", onClick: onGenerateInvoice },
    { label: "Upgrade plan", icon: ArrowUpCircle, tone: "text-primary bg-primary/10", onClick: () => toast.info("Select a subscription to upgrade") },
    { label: "Downgrade plan", icon: ArrowDownCircle, tone: "text-amber-500 bg-amber-500/10", onClick: () => toast.info("Select a subscription to downgrade") },
    { label: "Cancel subscription", icon: XCircle, tone: "text-rose-500 bg-rose-500/10", onClick: () => toast.info("Choose a subscription from the table") },
    { label: "Schedule report", icon: CalendarClock, tone: "text-violet-500 bg-violet-500/10", onClick: onScheduleReport },
    { label: "Export billing report", icon: FileDown, tone: "text-emerald-500 bg-emerald-500/10", onClick: onExport },
    { label: "Print", icon: Printer, tone: "text-muted-foreground bg-muted", onClick: () => { window.print(); toast.success("Print dialog opened"); } },
    { label: "Share report", icon: Share2, tone: "text-sky-500 bg-sky-500/10", onClick: () => toast.success("Share link copied") },
    { label: "Refresh", icon: RefreshCcw, tone: "text-muted-foreground bg-muted", onClick: onRefresh },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant="outline" className="h-auto justify-start gap-3 py-3" onClick={a.onClick}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-left text-xs font-medium leading-tight">{a.label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
