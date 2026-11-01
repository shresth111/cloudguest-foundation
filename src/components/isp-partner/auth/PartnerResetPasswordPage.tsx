/**
 * `/partner/reset-password?token=...`: the link from the partner reset email
 * (cloud-guest #449). The token is spent by the existing, unchanged
 * `POST /auth/reset-password` (via `resetPartnerPassword`, which bypasses the
 * shared client's session-expiry redirect): single use, one-hour expiry, the platform
 * password policy, and every existing session of the account is signed out.
 * Success lands on `/partner/login?reset=done`.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Check, KeyRound } from "lucide-react";
import { requestErrorOf } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/isp-partner/kit";
import { PartnerAuthFrame } from "@/components/isp-partner/auth/PartnerAuthFrame";
import { AskYourAdmin, Notice, PasswordInput } from "@/components/isp-partner/auth/PartnerAuthKit";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  strongPasswordSchema,
} from "@/lib/password-policy";
import { RESET_DONE, resetPartnerPassword } from "@/lib/isp-partner/password-reset";
import { cn } from "@/lib/utils";

const backToSignIn = (
  <Link
    to="/partner/login"
    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
  >
    <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
  </Link>
);

export function PartnerResetPasswordPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(!token);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const strength = strongPasswordSchema.safeParse(password);
    if (!strength.success) {
      setError(strength.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPartnerPassword(token, password);
      navigate({ to: "/partner/login", search: { reset: RESET_DONE }, replace: true });
    } catch (err) {
      const e2 = requestErrorOf(err);
      if (e2?.status === 401) {
        // Spent or expired: no password typed here can fix that.
        setDead(true);
      } else if (e2?.status === 429) {
        setError("Too many attempts. Wait a few minutes and try again.");
      } else {
        // A rejected password (reused / too weak) leaves the link usable.
        setError(e2?.message || "Could not reset the password.");
      }
      setBusy(false);
    }
  };

  if (dead) {
    return (
      <PartnerAuthFrame
        title="This link can't be used"
        subtitle="Reset links work once and expire after 1 hour."
        footer={backToSignIn}
      >
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/40 px-5 py-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            {token
              ? "This reset link has already been used or has expired."
              : "This reset link is missing its token. Open the link from the email again."}
          </p>
          <Button asChild className="h-11 w-full font-semibold">
            <Link to="/partner/forgot-password">Request a new link</Link>
          </Button>
        </div>
        <AskYourAdmin className="mt-5 text-center" />
      </PartnerAuthFrame>
    );
  }

  const checks = PASSWORD_RULES.map((rule, i) => ({
    rule,
    ok: [
      password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*\-_=+]/.test(password),
    ][i],
  }));

  return (
    <PartnerAuthFrame
      title="Choose a new password"
      subtitle="Use one you haven't used before. You'll be signed out everywhere else."
      footer={backToSignIn}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="partner-reset-password">New password</Label>
          <PasswordInput
            id="partner-reset-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="partner-reset-rules"
            autoFocus
          />
        </div>
        <ul id="partner-reset-rules" className="grid gap-1 text-xs sm:grid-cols-2">
          {checks.map((c) => (
            <li
              key={c.rule}
              className={cn(
                "flex items-center gap-1.5",
                c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", !c.ok && "opacity-30")} />
              <span>{c.rule}</span>
              <span className="sr-only">{c.ok ? "(met)" : "(not met)"}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5">
          <Label htmlFor="partner-reset-confirm">Confirm new password</Label>
          <PasswordInput
            id="partner-reset-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
          {busy ? <Spinner /> : <KeyRound className="mr-2 h-4 w-4" />}
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </PartnerAuthFrame>
  );
}
