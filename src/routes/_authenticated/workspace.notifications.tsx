import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Bell, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/workspace/notifications")({
  component: NotificationsPage,
});

const items = [
  { icon: AlertCircle, title: "Router RTR-LOC-90001-2 went offline", when: "3m ago", tone: "text-destructive" },
  { icon: CheckCircle2, title: "Invoice INV-2025003 paid", when: "1h ago", tone: "text-green-600" },
  { icon: Info, title: "New firmware v7.15 available for hAP ax3", when: "5h ago", tone: "text-blue-600" },
  { icon: Bell, title: "Peak concurrent guests reached 480", when: "yesterday", tone: "text-amber-600" },
];

function NotificationsPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Notifications</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((n, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border p-3">
              <n.icon className={`mt-0.5 h-5 w-5 ${n.tone}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.when}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
