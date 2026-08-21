import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { AlertBanner, PG_INPUT, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { PG_FIELD_LABEL } from "@/components/portal-runtime/AuthFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { t, session, setSession } = usePortalRuntime();
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

  // v7 §7.2 pattern (see PasswordSignInForm): both labels below used to be
  // bare <label>s naming nothing.
  const fieldId = useId();
  const passwordId = `${fieldId}-password`;
  const confirmId = `${fieldId}-confirm`;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
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
            <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{t("setPasswordSubtitle")}</p>
          </PortalTextPlate>
        </div>

        <PortalCard>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
            <Label htmlFor={passwordId} className={PG_FIELD_LABEL}>
              {t("newPassword")}
            </Label>
            <Input
              id={passwordId}
              {...form.register("password")}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              className={PG_INPUT}
            />
            <AlertBanner message={form.formState.errors.password?.message} />
            <Label htmlFor={confirmId} className={PG_FIELD_LABEL}>
              {t("confirmPassword")}
            </Label>
            <Input
              id={confirmId}
              {...form.register("confirm")}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              className={PG_INPUT}
            />
            <AlertBanner message={form.formState.errors.confirm?.message} />
            <button type="submit" disabled={save.isPending} className={PG_PRIMARY_BTN}>
              {save.isPending ? t("savingLabel") : t("savePassword")}
            </button>
            {/* Tertiary skip -- same reasoning as portal.team.tsx. */}
            <button
              type="button"
              onClick={skip}
              className="block min-h-11 w-full pg-meta font-medium text-[var(--pg-ink-muted)] underline-offset-2 transition-colors hover:text-[var(--pr-primary,#6366f1)] hover:underline"
            >
              {t("skipForNow")}
            </button>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
