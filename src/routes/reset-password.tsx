import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
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
  const [done, setDone] = useState(false);
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
      setDone(true);
      toast.success("Password updated. Please sign in.");
      // Let the success state land visually before handing off to /login.
      setTimeout(() => navigate({ to: "/login", replace: true }), 900);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to reset password");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="Redirecting you to sign in…"
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-8 text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <CheckCircle2 className="h-6 w-6" />
          </motion.div>
          <p className="text-sm text-muted-foreground">
            Your new password is set. Taking you to sign in…
          </p>
        </motion.div>
      </AuthLayout>
    );
  }

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
      <motion.form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoFocus
            className="transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            className="transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10"
            {...form.register("confirm")}
          />
          {form.formState.errors.confirm && (
            <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
          )}
        </div>
        <motion.div whileHover={{ scale: submitting ? 1 : 1.01 }} whileTap={{ scale: submitting ? 1 : 0.98 }}>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </motion.div>
      </motion.form>
    </AuthLayout>
  );
}
