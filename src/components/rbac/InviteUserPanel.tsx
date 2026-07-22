import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, MailPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteUser, useRbacOrganizations, useRbacRoles } from "@/hooks/useRbac";
import { inviteUserSchema, type InviteUserFormValues } from "@/lib/rbac-schemas";
import type { AppError } from "@/services/api";
import type { InviteUserResult } from "@/types/rbac";

const DEFAULTS: InviteUserFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  phone: "",
  designation: "",
  department: "",
  organizationId: "",
  initialRoleId: "",
};

export function InviteUserPanel() {
  const { data: organizations = [] } = useRbacOrganizations();
  const { data: roles = [] } = useRbacRoles();
  const invite = useInviteUser();
  const [justInvited, setJustInvited] = useState<InviteUserResult[]>([]);

  const form = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });
  const organizationId = form.watch("organizationId");
  const orgRoles = roles.filter((r) => !r.organizationId || r.organizationId === organizationId);

  async function submit(v: InviteUserFormValues) {
    try {
      const result = await invite.mutateAsync({
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        username: v.username,
        phone: v.phone || null,
        designation: v.designation || null,
        department: v.department || null,
        organizationId: v.organizationId || null,
        initialRoleId: v.initialRoleId || null,
      });
      setJustInvited((prev) => [result, ...prev]);
      toast.success("User invited");
      form.reset(DEFAULTS);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to invite user");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a new user</CardTitle>
          <p className="text-xs text-muted-foreground">
            The account is created immediately with a one-time temporary password — there is no
            pending/expiring invite state on this platform. The invitee must change their password
            on first login.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={form.formState.errors.firstName?.message}>
              <Input {...form.register("firstName")} />
            </Field>
            <Field label="Last name" error={form.formState.errors.lastName?.message}>
              <Input {...form.register("lastName")} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="Username" error={form.formState.errors.username?.message}>
              <Input {...form.register("username")} />
            </Field>
            <Field label="Phone (optional)">
              <Input {...form.register("phone")} />
            </Field>
            <Field label="Designation (optional)">
              <Input {...form.register("designation")} />
            </Field>
            <Field label="Organization (optional)">
              <Controller
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="No organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Initial role (optional, requires organization)">
              <Controller
                control={form.control}
                name="initialRoleId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!organizationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No initial role" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={invite.isPending}>
                <MailPlus className="me-1.5 h-4 w-4" />{" "}
                {invite.isPending ? "Inviting…" : "Invite user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {justInvited.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently invited (this session)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Temporary passwords are shown once and never retrievable again — copy them now.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {justInvited.map((r) => (
              <div
                key={r.user.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-xs">{r.temporaryPassword}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(r.temporaryPassword).catch(() => undefined);
                      toast.success("Password copied");
                    }}
                  >
                    <Copy className="me-1 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
