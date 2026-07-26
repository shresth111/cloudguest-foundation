import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner } from "@/components/portal-runtime/PortalGuestUi";
import { Input } from "@/components/ui/input";
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
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1
            className="mt-4 text-2xl font-bold text-slate-900"
            style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
          >
            {t("setPasswordTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("setPasswordSubtitle")}</p>
        </div>

        <PortalCard variant="light">
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
            <label className="text-xs font-semibold text-slate-500">{t("newPassword")}</label>
            <Input
              {...form.register("password")}
              type="password"
              placeholder="••••••••••••"
              className="h-11 rounded-[13px] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-500/15"
            />
            <AlertBanner message={form.formState.errors.password?.message} />
            <label className="text-xs font-semibold text-slate-500">{t("confirmPassword")}</label>
            <Input
              {...form.register("confirm")}
              type="password"
              placeholder="••••••••••••"
              className="h-11 rounded-[13px] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-500/15"
            />
            <AlertBanner message={form.formState.errors.confirm?.message} />
            <button
              type="submit"
              disabled={save.isPending}
              className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 disabled:opacity-60"
            >
              {save.isPending ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                t("savePassword")
              )}
            </button>
            <button
              type="button"
              onClick={skip}
              className="h-11 w-full rounded-[14px] text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              {t("skipForNow")}
            </button>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
