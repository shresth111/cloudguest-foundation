import { createFileRoute, Link } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MailCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth.service";
import type { AppError } from "@/services/api";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordRouteComponent,
});

// Standalone route entry point -- used only for direct/deep links to
// /forgot-password (e.g. if it's ever linked from outside the app). The
// login page itself renders `ForgotPasswordPage` inline instead of visiting
// this route, so the address bar never changes for that in-app click (see
// login.tsx).
function ForgotPasswordRouteComponent() {
  return <ForgotPasswordPage />;
}

/**
 * Rendered both at the dedicated `/forgot-password` route (via
 * `ForgotPasswordRouteComponent`, with no `onBack` -- "Back to sign in"
 * navigates to the real `/login` route) and inline from `LoginPage` when the
 * visitor clicks "Forgot password?" (with `onBack` supplied to flip the
 * login page's local view state back instead of navigating) -- so that
 * in-app click never changes the address bar to `/forgot-password`.
 */
export function ForgotPasswordPage({ onBack }: { onBack?: () => void } = {}) {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await authService.forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to send reset link");
    } finally {
      setSubmitting(false);
    }
  };

  const backToSignIn = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="font-medium text-primary hover:underline"
    >
      Back to sign in
    </button>
  ) : (
    <Link to="/login" className="font-medium text-primary hover:underline">
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="If an account exists with that email, we've sent a password reset link."
        footer={backToSignIn}
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
            <MailCheck className="h-6 w-6" />
          </motion.div>
          <p className="text-sm text-muted-foreground">
            Follow the link in the email to set a new password. It may take a minute to arrive.
          </p>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a password reset link."
      footer={
        <>
          Remembered it? {backToSignIn}
        </>
      }
    >
      <AnimatePresence mode="wait">
        <motion.form
          key="forgot-password-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoFocus
              className="transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <motion.div whileHover={{ scale: submitting ? 1 : 1.01 }} whileTap={{ scale: submitting ? 1 : 0.98 }}>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </motion.div>
        </motion.form>
      </AnimatePresence>
    </AuthLayout>
  );
}
