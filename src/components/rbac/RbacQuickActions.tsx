import { toast } from "sonner";
import { UserPlus, Shield, MailPlus, Download, KeyRound, UserCog, Ban, UserCheck } from "lucide-react";
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
    { icon: UserPlus, label: "Add user", tone: "from-sky-500/20 to-indigo-500/10 text-sky-500", run: onAddUser },
    { icon: Shield, label: "Create role", tone: "from-violet-500/20 to-fuchsia-500/10 text-violet-500", run: onCreateRole },
    { icon: MailPlus, label: "Invite user", tone: "from-amber-500/20 to-amber-500/5 text-amber-500", run: onInvite },
    { icon: Download, label: "Export users", tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-500", run: onExport },
    { icon: KeyRound, label: "Reset password", tone: "from-cyan-500/20 to-cyan-500/5 text-cyan-500", run: () => toast.info("Select a user, then reset password from the actions menu.") },
    { icon: UserCog, label: "Assign role", tone: "from-pink-500/20 to-pink-500/5 text-pink-500", run: () => toast.info("Open a user profile to assign a new role.") },
    { icon: Ban, label: "Disable user", tone: "from-slate-500/20 to-slate-500/5 text-slate-500", run: () => toast.info("Select a user from the table to disable.") },
    { icon: UserCheck, label: "Enable user", tone: "from-teal-500/20 to-teal-500/5 text-teal-500", run: () => toast.info("Select a disabled user to enable.") },
  ];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold">Quick actions</h3>
          <p className="text-xs text-muted-foreground">Common RBAC tasks at your fingertips.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                onClick={a.run}
                className={`relative h-auto justify-start overflow-hidden py-3 text-start`}
              >
                <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.tone} opacity-40`} />
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
