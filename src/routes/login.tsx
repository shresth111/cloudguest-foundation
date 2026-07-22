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
import { usePlatformBranding } from "@/context/PlatformBrandingContext";
import { homeRoute } from "@/lib/roles";
import type { AppError } from "@/services/api";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const { branding } = usePlatformBranding();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await login(values);
      toast.success("Welcome back");
      navigate({ to: redirect || homeRoute(), replace: true });
    } catch (err) {
      toast.error((err as AppError).message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={`Sign in to ${branding.companyName}`}
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
    </AuthLayout>
  );
}
