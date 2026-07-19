import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { authService } from "@/services/auth.service";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (s) => searchSchema.parse(s),
  component: VerifyOtpPage,
});

function VerifyOtpPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { email } = Route.useSearch();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authService.verifyOtp(code);
      toast.success("Code verified");
      navigate({ to: "/reset-password" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Verification code"
      subtitle={email ? `Enter the 6-digit code sent to ${email}` : "Enter the 6-digit code we sent you."}
      footer={
        <>
          Didn't get it?{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={async () => {
              await authService.resendOtp();
              toast.success("Code resent");
            }}
          >
            Resend
          </button>{" "}
          ·{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <p className="text-center text-xs text-muted-foreground">Hint: use <code>123456</code></p>
        <Button type="submit" className="w-full" disabled={submitting || code.length < 6}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify code
        </Button>
      </form>
    </AuthLayout>
  );
}
