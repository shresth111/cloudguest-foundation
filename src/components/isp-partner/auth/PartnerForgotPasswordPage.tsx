/**
 * `/partner/forgot-password`: ask for a reset link by email, or ask the ISP's
 * Owner/Admin. The reply never says whether the address is an ISP account
 * (the backend answers identically either way), so neither does this page.
 */
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { requestErrorOf } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/isp-partner/kit";
import { PartnerAuthFrame } from "@/components/isp-partner/auth/PartnerAuthFrame";
import { AskYourAdmin, FIELD_CLASS, Notice } from "@/components/isp-partner/auth/PartnerAuthKit";
import { requestPartnerPasswordReset } from "@/lib/isp-partner/password-reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const backToSignIn = (
  <Link
    to="/partner/login"
    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
  >
    <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
  </Link>
);

export function PartnerForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestPartnerPasswordReset(trimmed);
      setSentTo(trimmed);
    } catch (err) {
      const e2 = requestErrorOf(err);
      setError(
        e2?.status === 429
          ? "Too many requests from this network. Wait a few minutes and try again."
          : e2?.message || "Could not send the reset link. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <PartnerAuthFrame title="Check your email" footer={backToSignIn}>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 px-5 py-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-foreground" role="status">
            If <span className="font-medium break-all">{sentTo}</span> belongs to an ISP Partner
            account, a reset link is on its way.
          </p>
          <p className="text-xs text-muted-foreground">
            The link works once and expires in 1 hour. Check spam if it hasn&apos;t arrived in a few
            minutes.
          </p>
        </div>
        <AskYourAdmin lead="Still nothing? Ask" className="mt-5 text-center" />
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-3 w-full text-center text-xs font-medium text-primary hover:underline"
        >
          Use a different email
        </button>
      </PartnerAuthFrame>
    );
  }

  return (
    <PartnerAuthFrame
      title="Forgot your password?"
      subtitle="Enter the email you sign in with and we'll send you a link to choose a new one."
      footer={<>Remembered it? {backToSignIn}</>}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="partner-forgot-email">Work email</Label>
          <Input
            id="partner-forgot-email"
            ref={emailRef}
            className={FIELD_CLASS}
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@your-isp.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
          {busy ? <Spinner /> : <Send className="mr-2 h-4 w-4" />}
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <div className="mt-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <AskYourAdmin lead="Ask" className="mt-4 text-center" />
    </PartnerAuthFrame>
  );
}
