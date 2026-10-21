/**
 * Sign-in for network.wyfyguest.com, the ISP partner console.
 *
 * Uses the existing `POST /auth/login` through `useAuth().login`, unchanged,
 * including its must-change-password retry shape: a temporary password
 * handed out by Wyfy (or by the ISP's own Owner/Admin) gets a 403 "password
 * change required", and the same call re-sent with `newPassword` sets it.
 * Whether the account is actually an ISP account is decided afterwards by
 * `GET /isp/me` in the partner layout, not here.
 *
 * Named export: `routes/index.tsx` (FULLSTACK, F1) renders it at the bare
 * root of the network host.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Network } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { requestErrorOf } from "@/services/api";
import { MButton, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner } from "@/components/isp-partner/kit";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPasswordChangeRequired(err: unknown): boolean {
  const e = requestErrorOf(err);
  return e?.status === 403 && (e.message ?? "").toLowerCase().includes("password change required");
}

export function PartnerLoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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

  return (
    <div className="master-theme">
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1e1b4b] to-[#181530] px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 text-foreground shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold tracking-tight">Wyfy Guest Network</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Network className="h-3 w-3" /> Partner console for ISPs
              </p>
            </div>
          </div>

          {!needsNewPassword ? (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <input
                  ref={emailRef}
                  className={M_INPUT}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <div className="relative">
                  <input
                    className={cn(M_INPUT, "pr-10")}
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <FormError message={error} />
              <MButton type="submit" className="w-full justify-center py-2.5" disabled={busy}>
                {busy && <Spinner />} Sign in
              </MButton>
              <p className="text-center text-[11px] text-muted-foreground">
                Accounts are created by your ISP&apos;s Owner, or by Wyfy Guest. Forgot your
                password? Ask your ISP Owner or Admin to reset it.
              </p>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSetPassword} noValidate>
              <div>
                <p className="text-sm font-semibold">Set a new password</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You signed in with a temporary password. Choose your own to continue (at least 12
                  characters).
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">New password</span>
                <input
                  className={M_INPUT}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Repeat it</span>
                <input
                  className={M_INPUT}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <FormError message={error} />
              <MButton type="submit" className="w-full justify-center py-2.5" disabled={busy}>
                {busy && <Spinner />} Set password and sign in
              </MButton>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setNeedsNewPassword(false);
                  setError(null);
                }}
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
