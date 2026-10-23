/**
 * Sign-in for network.wyfyguest.com, the ISP Partner console.
 *
 * Uses the existing `POST /auth/login` through `useAuth().login`, unchanged,
 * including its must-change-password retry shape: a temporary password
 * handed out by Wyfy (or by the ISP's own Owner/Admin) gets a 403 "password
 * change required", and the same call re-sent with `newPassword` sets it.
 * Whether the account is actually an ISP account is decided afterwards by
 * `GET /isp/me` in the partner layout, not here.
 *
 * Forgot password (founder 2026-10-23): self-service by email at
 * `/partner/forgot-password`, or the ISP Owner/Admin resets it from Staff
 * users. A finished reset lands back here with `?reset=done`.
 *
 * Named export: `routes/index.tsx` (FULLSTACK, F1) renders it at the bare
 * root of the network host.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { requestErrorOf } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/isp-partner/kit";
import { PartnerAuthFrame } from "@/components/isp-partner/auth/PartnerAuthFrame";
import {
  AskYourAdmin,
  FIELD_CLASS,
  Notice,
  PasswordInput,
} from "@/components/isp-partner/auth/PartnerAuthKit";
import { RESET_DONE } from "@/lib/isp-partner/password-reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPasswordChangeRequired(err: unknown): boolean {
  const e = requestErrorOf(err);
  return e?.status === 403 && (e.message ?? "").toLowerCase().includes("password change required");
}

export function PartnerLoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const justReset = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.reset === RESET_DONE,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isReady && isAuthenticated) navigate({ to: "/partner", replace: true });
  }, [isReady, isAuthenticated, navigate]);

  const finish = () => {
    // Same small delay LoginPage uses so the router context sees the session.
    setTimeout(() => navigate({ to: "/partner", replace: true }), 50);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await login({ email: trimmed, password });
      finish();
    } catch (err) {
      if (isPasswordChangeRequired(err)) {
        setNeedsNewPassword(true);
      } else {
        setError(requestErrorOf(err)?.message || "Sign-in failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      setError("The new password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await login({ email: email.trim(), password, newPassword });
      finish();
    } catch (err) {
      setError(requestErrorOf(err)?.message || "Could not set the new password.");
    } finally {
      setBusy(false);
    }
  };

  if (needsNewPassword) {
    return (
      <PartnerAuthFrame
        title="Set a new password"
        subtitle="You signed in with a temporary password. Choose your own to continue (at least 12 characters)."
      >
        <form className="space-y-4" onSubmit={onSetPassword} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="partner-new-password">New password</Label>
            <PasswordInput
              id="partner-new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-confirm-password">Repeat it</Label>
            <PasswordInput
              id="partner-confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
            {busy ? <Spinner /> : <KeyRound className="mr-2 h-4 w-4" />} Set password and sign in
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setNeedsNewPassword(false);
              setError(null);
            }}
          >
            Back
          </button>
        </form>
      </PartnerAuthFrame>
    );
  }

  return (
    <PartnerAuthFrame
      title="Sign in to ISP Partner Console"
      subtitle="Manage your customers, venues, plans and billing."
    >
      {justReset && (
        <Notice tone="success" className="mb-4">
          Password updated. Sign in with your new password.
        </Notice>
      )}
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="partner-email">Work email</Label>
          <Input
            id="partner-email"
            ref={emailRef}
            className={FIELD_CLASS}
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@your-isp.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error === "Enter a valid email address." || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="partner-password">Password</Label>
            <Link
              to="/partner/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="partner-password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          type="submit"
          className="h-11 w-full font-semibold shadow-md shadow-primary/20"
          disabled={busy}
        >
          {busy ? <Spinner /> : null}
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </form>
      <div className="mt-6 space-y-2 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Accounts are created by your ISP&apos;s Owner, or by Wyfy Guest. Forgot your password?{" "}
          <Link to="/partner/forgot-password" className="font-medium text-primary hover:underline">
            Reset it by email
          </Link>
          .
        </p>
        <AskYourAdmin />
      </div>
    </PartnerAuthFrame>
  );
}
