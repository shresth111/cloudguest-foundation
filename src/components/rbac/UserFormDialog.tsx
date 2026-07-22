import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCreateUser, useRbacOrganizations, useRbacRoles, useUpdateUser } from "@/hooks/useRbac";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from "@/lib/rbac-schemas";
import type { AppError } from "@/services/api";
import type { RbacUser } from "@/types/rbac";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: RbacUser | null;
}

const CREATE_DEFAULTS: CreateUserFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  temporaryPassword: "",
  phone: "",
  designation: "",
  department: "",
  employeeId: "",
  timezone: "UTC",
  language: "en",
  organizationId: "",
  initialRoleId: "",
};

const UPDATE_DEFAULTS: UpdateUserFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  designation: "",
  department: "",
  employeeId: "",
  timezone: "UTC",
  language: "en",
};

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  if (user) return <EditUserDialog open={open} onOpenChange={onOpenChange} user={user} />;
  return <CreateUserDialog open={open} onOpenChange={onOpenChange} />;
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: organizations = [] } = useRbacOrganizations();
  const { data: roles = [] } = useRbacRoles();
  const create = useCreateUser();
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: CREATE_DEFAULTS,
    mode: "onBlur",
  });

  const organizationId = form.watch("organizationId");
  const orgRoles = roles.filter((r) => !r.organizationId || r.organizationId === organizationId);

  async function submit(v: CreateUserFormValues) {
    try {
      await create.mutateAsync({
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        username: v.username,
        temporaryPassword: v.temporaryPassword,
        phone: v.phone || null,
        designation: v.designation || null,
        department: v.department || null,
        employeeId: v.employeeId || null,
        timezone: v.timezone,
        language: v.language,
        organizationId: v.organizationId || null,
        initialRoleId: v.initialRoleId || null,
      });
      toast.success("User created");
      onOpenChange(false);
      form.reset(CREATE_DEFAULTS);
    } catch (err) {
      toast.error((err as AppError).message || "Could not create user");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset(CREATE_DEFAULTS);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Sets a temporary password directly — the user must change it on first login.
          </DialogDescription>
        </DialogHeader>
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
          <Field
            label="Temporary password"
            error={form.formState.errors.temporaryPassword?.message}
          >
            <Input
              type="text"
              {...form.register("temporaryPassword")}
              placeholder="At least 12 characters"
            />
          </Field>
          <Field label="Phone (optional)">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Designation (optional)">
            <Input {...form.register("designation")} />
          </Field>
          <Field label="Department (optional)">
            <Input {...form.register("department")} />
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
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: RbacUser;
}) {
  const update = useUpdateUser();
  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: UPDATE_DEFAULTS,
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? "",
        designation: user.designation ?? "",
        department: user.department ?? "",
        employeeId: user.employeeId ?? "",
        timezone: user.timezone,
        language: user.language,
      });
    }
  }, [open, user, form]);

  async function submit(v: UpdateUserFormValues) {
    try {
      await update.mutateAsync({
        id: user.id,
        payload: {
          firstName: v.firstName,
          lastName: v.lastName,
          phone: v.phone || null,
          designation: v.designation || null,
          department: v.department || null,
          employeeId: v.employeeId || null,
          timezone: v.timezone,
          language: v.language,
        },
      });
      toast.success("User updated");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as AppError).message || "Could not update user");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user.email} · email and username cannot be changed here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={form.formState.errors.firstName?.message}>
            <Input {...form.register("firstName")} />
          </Field>
          <Field label="Last name" error={form.formState.errors.lastName?.message}>
            <Input {...form.register("lastName")} />
          </Field>
          <Field label="Phone (optional)">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Designation (optional)">
            <Input {...form.register("designation")} />
          </Field>
          <Field label="Department (optional)">
            <Input {...form.register("department")} />
          </Field>
          <Field label="Employee ID (optional)">
            <Input {...form.register("employeeId")} />
          </Field>
          <Field label="Timezone">
            <Input {...form.register("timezone")} />
          </Field>
          <Field label="Language">
            <Input {...form.register("language")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
