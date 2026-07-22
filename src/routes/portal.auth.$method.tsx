import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { RuntimeAuthMethod } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/auth/$method")({
  component: AuthMethodPage,
});

function AuthMethodPage() {
  const { method } = Route.useParams();
  const { t, organizationId, locationId, setOtpTarget, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/auth/$method" });
  const m = method === "otp_sms" || method === "otp_email" ? method : null;

  const onSent = (target: string, authMethod: RuntimeAuthMethod) => {
    setOtpTarget(target);
    setSelectedMethod(authMethod);
    navigate({ to: "/portal/verify", search: (prev) => prev });
  };

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/auth"
          from="/portal/auth/$method"
          search={(prev) => prev}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            {m === "otp_email" ? t("emailOtp") : t("mobileOtp")}
          </h1>
          <p className="mt-1 text-sm text-white/60">Complete the form below to get online.</p>
        </div>

        <PortalCard>
          {m === "otp_sms" && (
            <MobileForm
              organizationId={organizationId}
              locationId={locationId}
              onSent={(target) => onSent(target, "otp_sms")}
            />
          )}
          {m === "otp_email" && (
            <EmailForm
              organizationId={organizationId}
              locationId={locationId}
              onSent={(target) => onSent(target, "otp_email")}
            />
          )}
          {!m && <p className="text-sm text-white/70">Unknown sign-in method.</p>}
        </PortalCard>
      </div>
    </PortalShell>
  );
}

const mobileSchema = z.object({
  countryCode: z.string().min(1, "Required"),
  phone: z.string().min(6, "Enter a valid number"),
});
function MobileForm({
  organizationId,
  locationId,
  onSent,
}: {
  organizationId: string;
  locationId: string;
  onSent: (target: string) => void;
}) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { countryCode: "+1", phone: "" },
  });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof mobileSchema>) =>
      portalRuntimeService.requestOtp({
        identifier: v.countryCode + v.phone,
        channel: "sms",
        organizationId,
        locationId,
      }),
    onSuccess: (_r, v) => {
      toast.success("Code sent");
      onSent(v.countryCode + v.phone);
    },
    onError: (e: AppError) => toast.error(e.message),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("mobileNumber")}</Label>
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <Input
          {...form.register("countryCode")}
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
        />
        <Input
          {...form.register("phone")}
          inputMode="tel"
          placeholder="555 010 2200"
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
        />
      </div>
      {form.formState.errors.phone && (
        <p className="text-xs text-red-300">{form.formState.errors.phone.message}</p>
      )}
      <Button
        type="submit"
        disabled={send.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sendOtp")}
      </Button>
    </form>
  );
}

const emailSchema = z.object({ email: z.string().email("Enter a valid email") });
function EmailForm({
  organizationId,
  locationId,
  onSent,
}: {
  organizationId: string;
  locationId: string;
  onSent: (target: string) => void;
}) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof emailSchema>) =>
      portalRuntimeService.requestOtp({
        identifier: v.email,
        channel: "email",
        organizationId,
        locationId,
      }),
    onSuccess: (_r, v) => {
      toast.success("Code sent");
      onSent(v.email);
    },
    onError: (e: AppError) => toast.error(e.message),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("emailAddress")}</Label>
      <Input
        {...form.register("email")}
        type="email"
        placeholder="you@example.com"
        className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
      />
      {form.formState.errors.email && (
        <p className="text-xs text-red-300">{form.formState.errors.email.message}</p>
      )}
      <Button
        type="submit"
        disabled={send.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sendOtp")}
      </Button>
    </form>
  );
}
