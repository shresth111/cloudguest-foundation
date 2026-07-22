import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth.service";
import type { AppError } from "@/services/api";

const schema = z
  .object({
    password: z.string().min(12, "At least 12 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      toast.error("This reset link is missing or invalid. Request a new one.");
      return;
    }
    setSubmitting(true);
    try {
      await authService.resetPassword(token, values.password);
      toast.success("Password updated. Please sign in.");
      navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error((err as AppError).message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={
        token
          ? "Choose a strong password you haven't used before."
          : "This link is missing its reset token — request a new one from the forgot password page."
      }
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" {...form.register("confirm")} />
          {form.formState.errors.confirm && (
            <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
