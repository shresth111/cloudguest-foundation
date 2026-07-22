import { UserPlus, Shield, MailPlus, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  onAddUser: () => void;
  onCreateRole: () => void;
  onInvite: () => void;
  onExport: () => void;
}

export function RbacQuickActions({ onAddUser, onCreateRole, onInvite, onExport }: Props) {
  const actions = [
    {
      icon: UserPlus,
      label: "Add user",
      tone: "from-sky-500/20 to-indigo-500/10 text-sky-500",
      run: onAddUser,
    },
    {
      icon: Shield,
      label: "Create role",
      tone: "from-violet-500/20 to-fuchsia-500/10 text-violet-500",
      run: onCreateRole,
    },
    {
      icon: MailPlus,
      label: "Invite user",
      tone: "from-amber-500/20 to-amber-500/5 text-amber-500",
      run: onInvite,
    },
    {
      icon: Download,
      label: "Export users",
      tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
      run: onExport,
    },
  ];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold">Quick actions</h3>
          <p className="text-xs text-muted-foreground">
            Per-user actions (reset password, assign role, activate/deactivate) live in each row's
            actions menu on the Users tab.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                onClick={a.run}
                className="relative h-auto justify-start overflow-hidden py-3 text-start"
              >
                <span
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.tone} opacity-40`}
                />
                <span className="relative flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{a.label}</span>
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
