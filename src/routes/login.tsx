import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";
import { ROLE_LABELS, homeRouteForRole } from "@/lib/roles";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const demo = authService.listDemoAccounts();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const session = await login(values);
      toast.success("Welcome back");
      navigate({ to: homeRouteForRole(session.user.role), replace: true });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const quickFill = (email: string) => {
    form.setValue("email", email);
    form.setValue("password", "password");
  };

  return (
    <AuthLayout
      title="Sign in to CloudGuest"
      subtitle="Enter your credentials to access your workspace."
      footer={
        <>
          Don't have an account? <span className="font-medium text-foreground">Contact your admin</span>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={!!form.watch("remember")}
            onCheckedChange={(v) => form.setValue("remember", !!v)}
          />
          <Label htmlFor="remember" className="text-sm font-normal">
            Keep me signed in
          </Label>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground">Demo accounts (password: <code>password</code>)</p>
        <div className="mt-2 grid gap-1">
          {demo.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => quickFill(d.email)}
              className="flex items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-background"
            >
              <span className="font-mono">{d.email}</span>
              <span className="text-muted-foreground">{ROLE_LABELS[d.role]}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
