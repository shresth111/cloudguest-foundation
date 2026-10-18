import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Loader2, Eye, EyeOff, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
import { AuthFrame } from "@/components/auth/AuthFrame";

// Moved out of `src/routes/login.tsx` -- same bug class already fixed once in
// PR #91 (`CustomerDashboardPage`, see
// `src/components/customer/CustomerDashboardPage.tsx`'s own note).
//
// `routeTree.gen.ts` statically imports every route file so it can build
// the route tree, and a JS module executes as one unit: everything at that
// file's top level, and every module it imports at top level, lands in the
// root/entry chunk that EVERY route loads -- the guest captive portal
// included. TanStack Router's automatic code-splitting only ever extracts
// a route's own `component`/`loader`/`pendingComponent`/`errorComponent`/
// `notFoundComponent`; it has no visibility into an unrelated named export
// living beside `Route` in the same file, so `LoginPage` could never be split
// away while it lived in a route-registered file. It only ever needed to
// be a named export because `index.tsx` (the bare `/` route, which renders this form for anonymous visitors without changing the address bar) imports it cross-file.
//
// Concretely: this component's `framer-motion` import (~39KB gzip) was
// shipping to every guest hitting /portal/*, a flow with zero animation
// library usage of its own. Living here, in a plain component file no
// route file statically imports, it is only reachable through the already
// correctly-split lazy `component` chunks of `/login` and `/`.

export type LoginRole = "owner" | "agent";

const STATS = [
  { v: 10000, suffix: "K+", divide: 1000, l: "Networks" },
  { v: 99.9, suffix: "%", l: "Uptime" },
  { v: 24, suffix: "/7", l: "Support" },
] as const;

/** Counts 0 -> target on mount with a spring, respecting reduced motion. */
function CountUp({ target, decimals = 0 }: { target: number; decimals?: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const [text, setText] = useState((0).toFixed(decimals));

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setText(target.toFixed(decimals));
      return;
    }
    mv.set(target);
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <>{text}</>;
}

/**
 * Rendered both at the dedicated `/login` route (via `LoginRouteComponent`,
 * which supplies `redirectTo` from that route's own `?redirect=` search
 * param) and directly at `/` for anonymous visitors -- so opening the bare
 * app URL shows the sign-in form without the address bar ever changing to
 * `/login`. Takes `redirectTo` as a prop rather than reading route search
 * params itself so it works under either route.
 */
export function LoginPage({ redirectTo }: { redirectTo?: string } = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const redirect = redirectTo;
  // "Forgot password?" renders ForgotPasswordPage in place of the login
  // form instead of navigating to the /forgot-password route -- so the
  // address bar never leaves the bare login URL during this pre-login flow.
  const [view, setView] = useState<"login" | "forgot-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>("owner");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [capsLock, setCapsLock] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // A freshly-provisioned owner's welcome-email temporary password can't be
  // used for an ordinary login -- the backend raises a distinct 403 asking
  // for a new password in the same call (see AuthService.login's
  // must_change_password branch). Real incident: this used to have no
  // in-app path at all -- the raw error just told the customer to use the
  // (separate, email-dependent) forgot-password flow, so the temporary
  // password in their welcome email was effectively unusable.
  const [mustChangePasswordOpen, setMustChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [settingNewPassword, setSettingNewPassword] = useState(false);

  const selectRole = (next: LoginRole) => {
    setRole(next);
    // Choosing a role doesn't submit anything by itself -- without this,
    // the click looked like a dead end (card just highlights) and people
    // pressed it expecting to be signed in, then had to find and press the
    // real submit button separately. Carrying focus into the email field
    // makes the one click visibly continue the flow toward sign-in.
    emailInputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Inline, field-level validation instead of a toast: a toast disappears
    // and never tells the visitor *which* field is wrong, and screen readers
    // never get pointed back at the offending input.
    // Validation and submission must agree on ONE spelling of the address.
    // They used to disagree: every check below ran against `email.trim()`
    // while `login()` was handed the raw `email`, so a single stray space --
    // which a phone keyboard appends after autocomplete, and a paste from a
    // welcome email carries invisibly -- passed validation and was then sent
    // verbatim. The backend found no such user, the visitor saw only
    // "Login failed" with an address that looked correct on screen, and five
    // of those locked the account for `account_lockout_minutes`.
    const trimmedEmail = email.trim();
    const nextErrors: { email?: string; password?: string } = {};
    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (nextErrors.email) {
      emailInputRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordInputRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      // Store role before login so AuthContext can use it
      localStorage.setItem("cg_login_role", role);
      await login({ email: trimmedEmail, password });
      toast.success(`Welcome back, ${role}!`);
      // Small delay to let AuthRouterContextSync propagate before navigation
      setTimeout(() => {
        navigate({ to: redirect || "/", replace: true });
      }, 50);
    } catch (err) {
      const appError = err as AppError;
      if (
        appError.status === 403 &&
        appError.message?.toLowerCase().includes("password change required")
      ) {
        setMustChangePasswordOpen(true);
      } else {
        toast.error(appError.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      toast.error("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setSettingNewPassword(true);
    try {
      localStorage.setItem("cg_login_role", role);
      // Same trimming as handleSubmit -- this dialog re-submits the very
      // address that just authenticated, so it must spell it identically.
      await login({ email: email.trim(), password, newPassword });
      toast.success("Password set. Welcome!");
      setMustChangePasswordOpen(false);
      setTimeout(() => {
        navigate({ to: redirect || "/", replace: true });
      }, 50);
    } catch (err) {
      toast.error((err as AppError).message || "Could not set new password. Please try again.");
    } finally {
      setSettingNewPassword(false);
    }
  };

  if (view === "forgot-password") {
    return <ForgotPasswordPage onBack={() => setView("login")} />;
  }

  return (
    <>
      {/* One illustrated canvas, in the style of the EkamOS website and
       * sign-in art (see AuthFrame.tsx): on desktop the page is the sky, the
       * Wyfy street runs along the bottom edge, the form floats in a white
       * card on the left and the copy sits on the sky on the right. Below lg
       * a band of the scene sits above the card.
       *
       * The whole page is pinned to the light palette via inline
       * custom-property overrides, regardless of the visitor's OS/browser
       * dark-mode preference (ThemeContext.tsx auto-applies `.dark` off
       * `prefers-color-scheme`). Without this, a dark-mode visitor got a
       * near-black form with a teal/cyan primary that read as "black and
       * green". The scene follows the clock (day/night) instead.
       *
       * The `[@media(max-height:800px)]:` utilities trim vertical spacing on
       * short viewports (1366x768 and 1536x864 Windows laptops leave ~625px
       * and ~721px of viewport) so the page never picks up a scrollbar there,
       * while 1440x900 and 1920x1080 stay untrimmed. A HEIGHT query because
       * height is the axis that varies; same inline arbitrary-variant form
       * PortalShell.tsx uses (`@custom-variant` cannot express it on
       * Tailwind 4.2.4). */}
      <AuthFrame
        style={
          {
            "--background": "oklch(0.984 0.005 220)",
            "--foreground": "oklch(0.22 0.03 235)",
            "--card": "oklch(1 0 0)",
            "--card-foreground": "oklch(0.22 0.03 235)",
            "--popover": "oklch(1 0 0)",
            "--popover-foreground": "oklch(0.22 0.03 235)",
            "--primary": "#6C4EFF",
            "--primary-foreground": "#ffffff",
            "--secondary": "oklch(0.955 0.012 216)",
            "--secondary-foreground": "oklch(0.26 0.03 232)",
            "--muted": "oklch(0.962 0.008 218)",
            "--muted-foreground": "oklch(0.5 0.025 230)",
            "--accent": "oklch(0.945 0.022 202)",
            "--accent-foreground": "oklch(0.3 0.06 210)",
            "--destructive": "oklch(0.58 0.21 25)",
            "--destructive-foreground": "oklch(0.99 0.005 250)",
            "--border": "oklch(0.905 0.012 220)",
            "--input": "oklch(0.925 0.012 220)",
            "--ring": "#6366f1",
          } as React.CSSProperties
        }
        aside={() => (
          <motion.div
            className="flex max-w-xl flex-col gap-5 px-10 pt-20 xl:px-14 [@media(max-height:800px)]:gap-3 [@media(max-height:800px)]:pt-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          >
            <h2 className="text-balance text-4xl font-bold leading-tight tracking-tight xl:text-[2.6rem] [@media(max-height:800px)]:text-3xl">
              Your network across every location. One dashboard. Zero blind spots.
            </h2>
            <p className="text-base leading-relaxed opacity-85 [@media(max-height:800px)]:text-sm">
              Provision networks, onboard guests, track analytics, and monitor every location in
              real-time — with role-based access built for global teams.
            </p>
            <div className="flex gap-8 pt-2 [@media(max-height:800px)]:pt-0">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.l}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.1, ease: "easeOut" }}
                >
                  <p className="text-2xl font-bold tabular-nums">
                    {"divide" in s ? (
                      <CountUp target={s.v / s.divide} />
                    ) : (
                      <CountUp target={s.v} decimals={s.v % 1 !== 0 ? 1 : 0} />
                    )}
                    {s.suffix}
                  </p>
                  <p className="text-xs opacity-75">{s.l}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* The real, original brand mark file (the same asset used
           * everywhere else this mark appears). The online-status dot is
           * a separate overlay, not part of the mark itself. */}
          <div className="mb-7 flex items-center gap-3 [@media(max-height:800px)]:mb-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/25">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
              </span>
            </div>
            <div>
              <p className="text-lg font-extrabold leading-tight tracking-tight">Wyfy Guest</p>
              <p className="text-xs font-normal tracking-wide text-muted-foreground">
                Effortless guest WiFi, at scale.
              </p>
            </div>
          </div>
          <div className="mb-6 [@media(max-height:800px)]:mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Access your network dashboard.</p>
          </div>

          {/* Role Selector -- exposed as a real radiogroup so keyboard and
              screen-reader users get "Owner, selected, 1 of 2" instead of two
              unrelated buttons. */}
          <div className="mb-6 [@media(max-height:800px)]:mb-4">
            <p id="role-label" className="text-sm font-medium mb-3">
              I'm signing in as
            </p>
            <div role="radiogroup" aria-labelledby="role-label" className="grid grid-cols-2 gap-3">
              {(
                [
                  {
                    key: "owner",
                    Icon: ShieldCheck,
                    title: "Owner",
                    hint: "Full workspace access",
                  },
                  {
                    key: "agent",
                    Icon: UserRound,
                    title: "Staff",
                    hint: "Assigned features only",
                  },
                ] as const
              ).map(({ key, Icon, title, hint }) => {
                const active = role === key;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectRole(key)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "relative overflow-hidden flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
                      active
                        ? "border-primary/70 bg-primary/[0.06] shadow-sm shadow-primary/10"
                        : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="role-active"
                        className="absolute inset-0 -z-10 bg-primary/5"
                        transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                      />
                    )}
                    <Icon
                      className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
                    />
                    <span className="text-sm font-semibold">{title}</span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5 [@media(max-height:800px)]:space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={cn(
                  "h-11 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10",
                  errors.email && "border-destructive focus-visible:ring-destructive/15",
                )}
                autoFocus
              />
              {errors.email && (
                <p id="email-error" className="text-xs font-medium text-destructive">
                  {errors.email}
                </p>
              )}
            </div>
            {/* order-2/order-1 below keep the visual layout identical
                (label+"Forgot password?" row on top, field below) while
                fixing DOM/tab order -- as plain source order this put the
                "Forgot password?" button between the email and password
                fields, so Tab from Email address skipped straight past
                Password to it instead. */}
            <div className="flex flex-col">
              {/* space-y-2's sibling margin follows DOM order, which no
                  longer matches visual order here -- an explicit mb-2 on
                  the row that's visually first keeps the same gap. */}
              <div className="order-2 space-y-2">
                <div className="relative">
                  <Input
                    ref={passwordInputRef}
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                    onBlur={() => setCapsLock(false)}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      cn(
                        errors.password ? "password-error" : "",
                        capsLock ? "caps-hint" : "",
                      ).trim() || undefined
                    }
                    className={cn(
                      "h-11 pr-11 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10",
                      errors.password && "border-destructive focus-visible:ring-destructive/15",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs font-medium text-destructive">
                    {errors.password}
                  </p>
                )}
                {/* Caps Lock is the single most common cause of a "wrong
                    password" that isn't -- warn before the failed attempt. */}
                {capsLock && !errors.password && (
                  <p id="caps-hint" className="text-xs font-medium text-amber-600">
                    Caps Lock is on.
                  </p>
                )}
              </div>
              <div className="order-1 mb-2 flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setView("forgot-password")}
                  className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Forgot password?
                </button>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/20"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Signing in…" : "Sign in as " + (role === "owner" ? "Owner" : "Staff")}
              </Button>
            </motion.div>
          </form>

          {/* Real infrastructure trust strip -- this deployment genuinely
              runs on Azure (the app VM) and AWS (S3-compatible storage for
              uploads/backups), not a decorative claim. */}
          <motion.div
            className="mt-6 [@media(max-height:800px)]:mt-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <span>Powered by</span>
            <img src="/brand/cloud/azure.svg" alt="Microsoft Azure" className="h-4 w-4" />
            <span className="normal-case text-foreground/70">Azure</span>
            <span className="text-border">&middot;</span>
            <img src="/brand/cloud/aws.svg" alt="AWS" className="h-3.5 w-auto" />
          </motion.div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4 sm:flex-nowrap [@media(max-height:800px)]:mt-3 [@media(max-height:800px)]:pt-3">
            <p className="whitespace-nowrap text-[11px] text-muted-foreground">
              © 2026 Wyfy Guest. All rights reserved.
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground/70">
              <span
                aria-hidden
                className="flex h-2.5 w-3.5 flex-col overflow-hidden rounded-[1px] ring-1 ring-black/5"
              >
                <span className="h-[1px] flex-1 bg-[#FF9933]" />
                <span className="h-[1px] flex-1 bg-white" />
                <span className="h-[1px] flex-1 bg-[#138808]" />
              </span>
              Made in India, for the world
            </span>
          </div>
        </motion.div>
      </AuthFrame>

      <Dialog open={mustChangePasswordOpen} onOpenChange={setMustChangePasswordOpen}>
        <DialogContent
          className="sm:max-w-sm"
          style={
            {
              "--primary": "#6C4EFF",
              "--primary-foreground": "#ffffff",
              "--ring": "#6366f1",
            } as React.CSSProperties
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Set a new password
            </DialogTitle>
            <DialogDescription>
              This is your first sign-in with a temporary password. Choose a new password (min. 12
              characters, with uppercase, lowercase, a digit, and a special character) to finish
              signing in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter a new password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="Re-enter the new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMustChangePasswordOpen(false)}
                disabled={settingNewPassword}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={settingNewPassword}>
                {settingNewPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {settingNewPassword ? "Setting…" : "Set password & sign in"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
