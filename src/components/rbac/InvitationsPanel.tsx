import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, RotateCw, X, MailPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRbacInvitations, useRbacRoles, useInvalidateRbac } from "@/hooks/useRbac";
import { rbacService } from "@/services/rbac.service";
import { inviteFormSchema, type InviteFormValues } from "@/lib/rbac-schemas";

export function InvitationsPanel() {
  const { data: invites, isLoading } = useRbacInvitations();
  const { data: roles } = useRbacRoles();
  const invalidate = useInvalidateRbac();
  const [tab, setTab] = useState<"pending" | "accepted" | "expired">("pending");
  const [open, setOpen] = useState(false);

  const form = useForm<InviteFormValues>({ resolver: zodResolver(inviteFormSchema), defaultValues: { email: "", roleId: "" } });

  const submit = async (v: InviteFormValues) => {
    try { await rbacService.createInvitation(v.email, v.roleId); toast.success("Invitation sent"); invalidate("invitations"); setOpen(false); form.reset(); }
    catch { toast.error("Could not send invitation"); }
  };

  const filtered = invites?.filter((i) => i.status === tab) ?? [];

  const resend = async (id: string) => { await rbacService.resendInvitation(id); toast.success("Invitation resent"); };
  const cancel = async (id: string) => { await rbacService.cancelInvitation(id); toast.success("Invitation cancelled"); invalidate("invitations"); };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Invitations</h3>
            <p className="text-xs text-muted-foreground">Track pending, accepted, and expired invites.</p>
          </div>
          <Button onClick={() => setOpen(true)}><MailPlus className="me-1.5 h-4 w-4" /> Invite user</Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3 space-y-2">
            {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />) : filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No {tab} invitations.</p>
            ) : filtered.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{i.email}</p>
                  <p className="text-xs text-muted-foreground">Invited by {i.invitedBy} · {new Date(i.invitedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{i.roleName}</Badge>
                  <Badge variant={i.status === "accepted" ? "default" : i.status === "expired" ? "secondary" : "outline"}>{i.status}</Badge>
                  {i.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => resend(i.id)}><RotateCw className="me-1 h-3.5 w-3.5" /> Resend</Button>
                      <Button size="sm" variant="ghost" onClick={() => cancel(i.id)}><X className="me-1 h-3.5 w-3.5" /> Cancel</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} placeholder="teammate@company.io" />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.watch("roleId")} onValueChange={(v) => form.setValue("roleId", v)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
              {form.formState.errors.roleId && <p className="text-xs text-destructive">{form.formState.errors.roleId.message}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit"><Send className="me-1.5 h-4 w-4" /> Send invite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
