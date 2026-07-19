import {
  Building2,
  CreditCard,
  Headphones,
  LifeBuoy,
  Palette,
  Plus,
  Router,
  Settings2,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Action {
  label: string;
  icon: LucideIcon;
  tone?: string;
}

const ACTIONS: Action[] = [
  { label: "Create Organization", icon: Building2, tone: "text-indigo-500 bg-indigo-500/10" },
  { label: "Create Subscription", icon: Plus, tone: "text-emerald-500 bg-emerald-500/10" },
  { label: "Add Router", icon: Router, tone: "text-sky-500 bg-sky-500/10" },
  { label: "View Monitoring", icon: Activity, tone: "text-amber-500 bg-amber-500/10" },
  { label: "Platform Settings", icon: Settings2, tone: "text-slate-500 bg-slate-500/10" },
  { label: "White Label", icon: Palette, tone: "text-fuchsia-500 bg-fuchsia-500/10" },
  { label: "View Billing", icon: CreditCard, tone: "text-rose-500 bg-rose-500/10" },
  { label: "Support Center", icon: LifeBuoy, tone: "text-teal-500 bg-teal-500/10" },
];

export function QuickActions() {
  return (
    <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Quick actions</h3>
          <p className="text-xs text-muted-foreground">Jump into common platform tasks</p>
        </div>
        <Headphones className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="group flex flex-col items-start gap-2 rounded-xl border border-border/70 bg-card p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className={cn("grid h-9 w-9 place-items-center rounded-lg", a.tone)}>
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
