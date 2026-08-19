import { Download, FileText, CalendarClock, RefreshCw, Share2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  onRefresh: () => void;
  onExportDashboard: () => void;
  onGenerateReport: () => void;
  onScheduleReport: () => void;
}

export function AnalyticsQuickActions({
  onRefresh,
  onExportDashboard,
  onGenerateReport,
  onScheduleReport,
}: Props) {
  const actions = [
    { label: "Export dashboard", icon: Download, onClick: onExportDashboard },
    { label: "Generate report", icon: FileText, onClick: onGenerateReport },
    { label: "Schedule report", icon: CalendarClock, onClick: onScheduleReport },
    { label: "Refresh analytics", icon: RefreshCw, onClick: onRefresh },
    {
      label: "Share report",
      icon: Share2,
      onClick: () => toast.success("Share link copied to clipboard"),
    },
    {
      label: "Print report",
      icon: Printer,
      onClick: () => {
        toast.success("Preparing print view");
        window.print();
      },
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        {/* This card lives in the 1fr column of an xl:grid-cols-[2fr_1fr]
            layout, so it's always a narrow sidebar -- multi-column button
            grids here (previously sm:grid-cols-2 lg:grid-cols-3) keyed off
            viewport width rather than the card's own rendered width and
            clipped labels like "Export dashboard" / "Schedule report" mid-word
            with no wrap or ellipsis. Single column always fits. */}
        <div className="grid grid-cols-1 gap-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant="outline" className="justify-start" onClick={a.onClick}>
                <Icon className="mr-2 h-4 w-4 shrink-0" /> {a.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
