import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
} from "@/components/portal-runtime/PortalShell";
import { AlertBanner } from "@/components/portal-runtime/PortalGuestUi";
import { Input } from "@/components/ui/input";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { markDeviceHasPassword } from "@/lib/portal-returning-guest";
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
  const { config, t, session, setSession } = usePortalRuntime();
  const hasPhoto = !!config?.backgroundImageUrl;
  const navigate = useNavigate({ from: "/portal/set-password" });

  // Always /portal/success: the legacy static-banner /portal/ad
  // interstitial was removed (superseded by the real Campaigns feature,
  // now shown on /portal/session) -- success.tsx is the brief transitional
  // screen that fires the real hotspot-login POST and lands the guest on
  // /portal/session once it completes. This page can be reached either
  // right after OTP verification (the hotspot-login POST hasn't fired
  // yet -- success.tsx must still run it) or via /portal/session's own
  // "set a password" nudge (already connected) -- routing both cases
  // through success.tsx keeps the real POST mechanism's firing point a
  // single, predictable place rather than something this page has to
  // guess about; RadiusService.authorize's username-to-session lookup is
  // a harmless no-op to repeat for an already-active session.
  const nextRoute = "/portal/success";

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
      // Remember, on this real device, that its guest now has a password
      // -- next visit's sign-in card defaults straight to the Registered
      // user tab instead of OTP (see src/lib/portal-returning-guest.ts).
      markDeviceHasPassword();
      navigate({ to: nextRoute, search: (prev) => prev });
    },
    onError: (e: AppError) => toast.error(e.message),
  });

  const skip = () => navigate({ to: nextRoute, search: (prev) => prev });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1): this heading block
         * used to render straight onto the venue's photo, inside the
         * page scrim's deliberately fully-transparent 24-78% band, so
         * `--pg-ink` had no guaranteed contrast ratio against it at all.
         * It now carries the same bounded `GUEST_LEGIBILITY_CARD_CLASS`
         * plate `BrandPanel` and the shell footer already use, sized to
         * its own text (`w-fit` only reaches full column width when the
         * text genuinely fills it) -- deliberately NOT a wash over the
         * whole content column, which is §0.1 item 1's twice-shipped
         * mistake. Photo-only: on the flat `--pg-canvas` there is no
         * contrast problem to solve and no plate is drawn. */}
        <div
          className={cn(
            "mx-auto w-fit max-w-full text-center",
            hasPhoto && cn("p-5", GUEST_LEGIBILITY_CARD_CLASS),
          )}
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="pg-subtitle mt-4 text-[var(--pg-ink)]">{t("setPasswordTitle")}</h1>
          {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
           * §1.5 retuned that token #64748B -> #475569, and a slate class does
           * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
           * composite (`--pg-surface` at 85% over a near-black photo region);
           * full derivation in styles.css's own `--pg-ink-muted` note. Backing
           * the block and leaving its subtitle at 3.36:1 would only have half-
           * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
          <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">{t("setPasswordSubtitle")}</p>
        </div>

        <PortalCard>
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
