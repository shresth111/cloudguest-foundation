import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useRbacRoles, useRbacDepartments, useRbacOrganizations, useRbacLocationTree, useSaveUser } from "@/hooks/useRbac";
import { userFormSchema, type UserFormValues } from "@/lib/rbac-schemas";
import type { RbacUser } from "@/types/rbac";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: RbacUser | null;
}

const DEFAULTS: UserFormValues = {
  firstName: "", lastName: "", email: "", mobile: "",
  organizationId: "", departmentId: "", designation: "",
  roleId: "", locationIds: [], language: "en", timezone: "UTC", sendInvite: true,
};

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const { data: roles } = useRbacRoles();
  const { data: departments } = useRbacDepartments();
  const { data: orgs } = useRbacOrganizations();
  const { data: tree } = useRbacLocationTree();
  const save = useSaveUser();

  const form = useForm<UserFormValues>({ resolver: zodResolver(userFormSchema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (open) {
      form.reset(user ? {
        firstName: user.firstName, lastName: user.lastName, email: user.email, mobile: user.mobile,
        organizationId: user.organizationId, departmentId: user.departmentId, designation: user.designation,
        roleId: user.roleId, locationIds: user.locationIds, language: user.language, timezone: user.timezone, sendInvite: false,
      } : DEFAULTS);
    }
  }, [open, user, form]);

  const onSubmit = async (v: UserFormValues) => {
    try {
      await save.mutateAsync({ ...v, id: user?.id } as never);
      toast.success(user ? "User updated" : v.sendInvite ? "Invitation sent" : "User created");
      onOpenChange(false);
    } catch { toast.error("Could not save user"); }
  };

  const orgLocations = tree?.find((o) => o.id === form.watch("organizationId"))?.children ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>{user ? "Update the user profile and access." : "Invite a new teammate and assign their role."}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={form.formState.errors.firstName?.message}>
            <Input {...form.register("firstName")} placeholder="Ava" />
          </Field>
          <Field label="Last name" error={form.formState.errors.lastName?.message}>
            <Input {...form.register("lastName")} placeholder="Chen" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} placeholder="ava.chen@company.io" />
          </Field>
          <Field label="Mobile" error={form.formState.errors.mobile?.message}>
            <Input {...form.register("mobile")} placeholder="+1 555 010 2200" />
          </Field>
          <Field label="Organization" error={form.formState.errors.organizationId?.message}>
            <Controller control={form.control} name="organizationId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>{orgs?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Department" error={form.formState.errors.departmentId?.message}>
            <Controller control={form.control} name="departmentId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Designation" error={form.formState.errors.designation?.message}>
            <Input {...form.register("designation")} placeholder="Manager" />
          </Field>
          <Field label="Role" error={form.formState.errors.roleId?.message}>
            <Controller control={form.control} name="roleId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles?.filter((r) => r.status === "active").map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>

          <div className="sm:col-span-2 space-y-2">
            <Label>Location access</Label>
            <Controller control={form.control} name="locationIds" render={({ field }) => (
              <div className="rounded-lg border p-3 max-h-40 overflow-y-auto space-y-1.5">
                {orgLocations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Pick an organization to list locations.</p>
                ) : orgLocations.map((loc) => {
                  const checked = field.value.includes(loc.id);
                  return (
                    <label key={loc.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/40 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(v) => {
                        if (v) field.onChange([...field.value, loc.id]);
                        else field.onChange(field.value.filter((id) => id !== loc.id));
                      }} />
                      {loc.name}
                    </label>
                  );
                })}
              </div>
            )} />
          </div>

          <Field label="Language">
            <Controller control={form.control} name="language" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Timezone">
            <Controller control={form.control} name="timezone" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </Field>

          {!user && (
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Send invitation email</p>
                <p className="text-xs text-muted-foreground">The user will receive a link to set their password.</p>
              </div>
              <Controller control={form.control} name="sendInvite" render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : user ? "Save changes" : "Create user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
