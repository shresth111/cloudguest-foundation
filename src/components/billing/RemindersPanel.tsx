import { toast } from "sonner";
import { AlertOctagon, BellRing, CalendarClock, CreditCard, Send, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import type { Reminder } from "@/types/billing";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const TYPE_META: Record<Reminder["type"], { icon: typeof BellRing; label: string }> = {
  expiry: { icon: CalendarClock, label: "Expiry" },
  invoice_due: { icon: CreditCard, label: "Invoice due" },
  payment_failed: { icon: AlertOctagon, label: "Payment failed" },
  trial_ending: { icon: Sparkles, label: "Trial ending" },
};

const SEVERITY_CLASS: Record<Reminder["severity"], string> = {
  info: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  critical: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

interface Props {
  data?: Reminder[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function RemindersPanel({ data, isLoading, isError, onRetry }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Reminders</CardTitle>
          <p className="text-xs text-muted-foreground">Renewals, invoice due dates, failed payments and trial endings.</p>
        </div>
        <Badge variant="outline">{data?.length ?? 0} active</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No active reminders" description="You're all caught up." />
        ) : (
          data.map((r) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${SEVERITY_CLASS[r.severity]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.organizationName} · {meta.label} · {dateFmt.format(new Date(r.dueAt))}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toast.success(`Reminder sent to ${r.organizationName}`)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
