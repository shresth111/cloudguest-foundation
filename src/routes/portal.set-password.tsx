import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/set-password")({
  component: SetPasswordPage,
});

// Mirrors app.domains.auth.password.PasswordManager.validate_strength on
// the backend (the exact hasher/policy this reuses -- see
// GuestService.set_guest_password's docstring) -- purely to give the guest
// immediate, specific feedback instead of a round-trip 400. The server is
// still the real source of truth: a password that somehow slips past this
// client-side check just surfaces the server's own message instead.
const passwordSetSchema = z
  .object({
    password: z
      .string()
      .min(12, "At least 12 characters")
      .max(128, "At most 128 characters")
      .regex(/[A-Z]/, "At least one uppercase letter")
      .regex(/[a-z]/, "At least one lowercase letter")
      .regex(/\d/, "At least one digit")
      .regex(/[!@#$%^&*\-_=+]/, "At least one special character (!@#$%^&*-_=+)"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

function SetPasswordPage() {
  const { t, config, session, setSession } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/set-password" });

  const nextRoute = config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success";

  useEffect(() => {
    // No just-completed login to attach this to (e.g. a guest navigated
    // here directly, or refreshed) -- nothing eligible to prove this is a
    // real "just logged in via OTP" moment, send them back into the flow.
    if (!session) navigate({ to: "/portal/auth", replace: true, search: (prev) => prev });
  }, [session, navigate]);

  const form = useForm<z.infer<typeof passwordSetSchema>>({
    resolver: zodResolver(passwordSetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const save = useMutation({
    mutationFn: (v: z.infer<typeof passwordSetSchema>) =>
      portalRuntimeService.setPassword({
        guestId: session?.guestId ?? "",
        sessionId: session?.sessionId ?? "",
        password: v.password,
      }),
    onSuccess: () => {
      toast.success(t("passwordSaved"));
      if (session) setSession({ ...session, hasPassword: true });
      navigate({ to: nextRoute, search: (prev) => prev });
    },
    onError: (e: AppError) => toast.error(e.message),
  });

  const skip = () => navigate({ to: nextRoute, search: (prev) => prev });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">{t("setPasswordTitle")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("setPasswordSubtitle")}</p>
        </div>

        <PortalCard>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
            <Label className="text-white/80">{t("newPassword")}</Label>
            <Input
              {...form.register("password")}
              type="password"
              placeholder="••••••••••••"
              className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
            />
            {form.formState.errors.password && (
              <p className="text-xs text-red-300">{form.formState.errors.password.message}</p>
            )}
            <Label className="text-white/80">{t("confirmPassword")}</Label>
            <Input
              {...form.register("confirm")}
              type="password"
              placeholder="••••••••••••"
              className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
            />
            {form.formState.errors.confirm && (
              <p className="text-xs text-red-300">{form.formState.errors.confirm.message}</p>
            )}
            <Button
              type="submit"
              disabled={save.isPending}
              className="h-11 w-full font-semibold text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("savePassword")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={skip}
              className="h-11 w-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              {t("skipForNow")}
            </Button>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
