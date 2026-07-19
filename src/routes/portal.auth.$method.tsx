import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, QrCode } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { RuntimeAuthMethod } from "@/types/portal-runtime";

export const Route = createFileRoute("/portal/auth/$method")({
  component: AuthMethodPage,
});

function AuthMethodPage() {
  const { method } = Route.useParams();
  const { t, config, setOtpTarget, setSelectedMethod, setSession, termsAccepted, setTermsAccepted } =
    usePortalRuntime();
  const navigate = useNavigate();
  const m = method as RuntimeAuthMethod;

  const goSuccess = async () => {
    const session = await portalRuntimeService.createSession();
    setSession(session);
    navigate({ to: config?.adEnabled ? "/portal/ad" : "/portal/success" });
  };

  const heading = (() => {
    switch (m) {
      case "mobile_otp": return t("mobileOtp");
      case "email_otp": return t("emailOtp");
      case "voucher": return t("voucher");
      case "pms": return t("pms");
      case "social": return t("social");
      case "qr": return t("qr");
      case "click_through": return t("clickThrough");
      default: return "Sign in";
    }
  })();

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/auth"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{heading}</h1>
          <p className="mt-1 text-sm text-white/60">Complete the form below to get online.</p>
        </div>

        <PortalCard>
          {m === "mobile_otp" && <MobileForm onSent={(target) => { setOtpTarget(target); setSelectedMethod("mobile_otp"); navigate({ to: "/portal/verify" }); }} />}
          {m === "email_otp" && <EmailForm onSent={(target) => { setOtpTarget(target); setSelectedMethod("email_otp"); navigate({ to: "/portal/verify" }); }} />}
          {m === "voucher" && <VoucherForm onSuccess={goSuccess} onFail={() => navigate({ to: "/portal/failure" })} />}
          {m === "pms" && <PmsForm onSuccess={goSuccess} onFail={() => navigate({ to: "/portal/failure" })} />}
          {m === "social" && <SocialForm onSuccess={goSuccess} onFail={() => navigate({ to: "/portal/failure" })} />}
          {m === "qr" && <QrPanel />}
          {m === "click_through" && (
            <ClickThroughForm
              accepted={termsAccepted}
              setAccepted={setTermsAccepted}
              onSuccess={goSuccess}
            />
          )}
        </PortalCard>
      </div>
    </PortalShell>
  );
}

const mobileSchema = z.object({
  countryCode: z.string().min(1, "Required"),
  phone: z.string().min(6, "Enter a valid number"),
});
function MobileForm({ onSent }: { onSent: (target: string) => void }) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { countryCode: "+1", phone: "" },
  });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof mobileSchema>) => portalRuntimeService.sendOtp(v.countryCode + v.phone),
    onSuccess: (_r, v) => {
      toast.success("OTP sent");
      onSent(v.countryCode + " " + v.phone);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("mobileNumber")}</Label>
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <Input {...form.register("countryCode")} className="bg-white/10 border-white/10 text-white placeholder:text-white/40" />
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
function EmailForm({ onSent }: { onSent: (target: string) => void }) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof emailSchema>) => portalRuntimeService.sendOtp(v.email),
    onSuccess: (_r, v) => { toast.success("OTP sent"); onSent(v.email); },
    onError: (e: Error) => toast.error(e.message),
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

const voucherSchema = z.object({ code: z.string().min(4, "Enter a voucher code") });
function VoucherForm({ onSuccess, onFail }: { onSuccess: () => void; onFail: () => void }) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof voucherSchema>>({ resolver: zodResolver(voucherSchema), defaultValues: { code: "" } });
  const submit = useMutation({
    mutationFn: (v: z.infer<typeof voucherSchema>) => portalRuntimeService.redeemVoucher(v.code),
    onSuccess: () => { toast.success("Voucher accepted"); onSuccess(); },
    onError: (e: Error) => { toast.error(e.message); onFail(); },
  });
  return (
    <form onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("voucherCode")}</Label>
      <Input
        {...form.register("code")}
        placeholder="XXXX-XXXX"
        className="bg-white/10 border-white/10 text-white uppercase tracking-widest placeholder:text-white/40"
      />
      {form.formState.errors.code && (
        <p className="text-xs text-red-300">{form.formState.errors.code.message}</p>
      )}
      <Button
        type="submit"
        disabled={submit.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
      </Button>
      <p className="text-xs text-white/50">Try <code className="rounded bg-white/10 px-1">INVALID</code> to see the error state.</p>
    </form>
  );
}

const pmsSchema = z.object({ room: z.string().min(1, "Required"), lastName: z.string().min(2, "Required") });
function PmsForm({ onSuccess, onFail }: { onSuccess: () => void; onFail: () => void }) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof pmsSchema>>({ resolver: zodResolver(pmsSchema), defaultValues: { room: "", lastName: "" } });
  const submit = useMutation({
    mutationFn: (v: z.infer<typeof pmsSchema>) => portalRuntimeService.pmsLogin(v.room, v.lastName),
    onSuccess: () => { toast.success("Welcome back"); onSuccess(); },
    onError: (e: Error) => { toast.error(e.message); onFail(); },
  });
  return (
    <form onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="space-y-3">
      <div>
        <Label className="text-white/80">{t("roomNumber")}</Label>
        <Input {...form.register("room")} placeholder="512" className="mt-1 bg-white/10 border-white/10 text-white placeholder:text-white/40" />
      </div>
      <div>
        <Label className="text-white/80">{t("lastName")}</Label>
        <Input {...form.register("lastName")} placeholder="Smith" className="mt-1 bg-white/10 border-white/10 text-white placeholder:text-white/40" />
      </div>
      <Button
        type="submit"
        disabled={submit.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
      </Button>
    </form>
  );
}

function SocialForm({ onSuccess, onFail }: { onSuccess: () => void; onFail: () => void }) {
  const { config } = usePortalRuntime();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const providers = config?.socialProviders ?? [];
  const attempt = async (p: string) => {
    setLoadingProvider(p);
    try {
      await portalRuntimeService.socialLogin(p);
      toast.success(`Signed in with ${p}`);
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
      onFail();
    } finally {
      setLoadingProvider(null);
    }
  };
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <Button
          key={p}
          variant="outline"
          disabled={!!loadingProvider}
          onClick={() => attempt(p)}
          className="h-11 w-full justify-start gap-3 border-white/15 bg-white/[0.06] text-white capitalize hover:bg-white/10 hover:text-white"
        >
          {loadingProvider === p ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold text-slate-900">
              {p[0].toUpperCase()}
            </span>
          )}
          Continue with {p}
        </Button>
      ))}
    </div>
  );
}

function QrPanel() {
  const { t } = usePortalRuntime();
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="grid h-48 w-48 place-items-center rounded-2xl bg-white p-3 shadow-xl"
      >
        <div className="relative h-full w-full">
          <QrCode className="absolute inset-0 h-full w-full text-slate-900" strokeWidth={1.2} />
        </div>
      </motion.div>
      <p className="text-sm text-white/70">{t("scanInstructions")}</p>
    </div>
  );
}

function ClickThroughForm({
  accepted,
  setAccepted,
  onSuccess,
}: {
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  onSuccess: () => Promise<void>;
}) {
  const { t } = usePortalRuntime();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => setAccepted(!!v)}
          className="mt-0.5 border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
        />
        <span className="text-white/80">{t("agreeTerms")}</span>
      </label>
      <Button
        disabled={!accepted || busy}
        onClick={async () => { setBusy(true); await onSuccess(); }}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("connect")}
      </Button>
    </div>
  );
}
