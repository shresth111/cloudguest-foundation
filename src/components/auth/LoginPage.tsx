import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { Loader2, Eye, EyeOff, ShieldCheck, UserRound, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";
import { demoRequestService } from "@/services/demo-request.service";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";


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
    if (reduce) { setText(target.toFixed(decimals)); return; }
    mv.set(target);
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <>{text}</>;
}

/**
 * Decorative hero illustration: a guest connecting to venue WiFi -- a
 * line-art figure holding a phone, WiFi signal arcs radiating out toward a
 * venue location pin. Flat geometric shapes + soft blurred glow accents in
 * the existing hero palette (white line work, cyan/fuchsia/violet accents)
 * so it reads as one illustration system with the glow blobs and dot-grid
 * already in this panel, Stripe/Linear-style rather than clip-art.
 *
 * Purely decorative -- aria-hidden. The one-time arc "draw-on" entrance
 * doesn't need a reduced-motion guard, but the looping pin glow does, so it
 * collapses to a static glow when the visitor prefers reduced motion.
 */
function HeroWifiIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const wifi = { x: 185, y: 86 };
  const pin = { x: 350, y: 55 };
  const arcs = [
    { r: 10, color: "#f0abfc" },
    { r: 18, color: "#22d3ee" },
    { r: 26, color: "#8B5CF6" },
  ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 480 210"
      className="h-auto w-full max-w-[300px] text-white"
      fill="none"
    >
      <defs>
        <filter id="hero-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* soft glow blobs, echoing the panel's fuchsia/cyan corner blobs */}
      <circle cx="110" cy="130" r="72" fill="#f0abfc" opacity="0.16" filter="url(#hero-illo-glow)" />
      <motion.circle
        cx={pin.x}
        cy={pin.y}
        r="24"
        fill="#22d3ee"
        filter="url(#hero-illo-glow)"
        animate={
          shouldReduceMotion
            ? { opacity: 0.22 }
            : { opacity: [0.14, 0.32, 0.14], scale: [1, 1.15, 1] }
        }
        transition={shouldReduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ground line */}
      <line x1="40" y1="188" x2="440" y2="188" stroke="white" strokeOpacity="0.12" strokeWidth="1" />

      {/* venue location pin */}
      <g transform={`translate(${pin.x}, ${pin.y})`} stroke="white" strokeOpacity="0.7" strokeWidth="2" strokeLinejoin="round">
        <path d="M0 -22c-8.8 0-16 7-16 15.6C-16 5.6 0 26 0 26s16-20.4 16-32.4C16-14.8 8.8-22 0-22z" fill="rgba(255,255,255,0.06)" />
        <circle cx="0" cy="-6.5" r="5" fill="#22d3ee" stroke="none" />
      </g>

      {/* guest figure holding a phone */}
      <g stroke="white" strokeOpacity="0.85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="150" cy="110" r="13" />
        <path d="M137 188c-4-46 1-74 13-74s17 28 13 74" />
        <path d="M158 132c14-4 22-14 26-24" />
      </g>
      <rect x="176" y="90" width="18" height="32" rx="4" stroke="white" strokeOpacity="0.85" strokeWidth="2" fill="rgba(255,255,255,0.06)" />
      <circle cx="185" cy="117" r="1.4" fill="white" fillOpacity="0.7" stroke="none" />

      {/* WiFi signal arcs, drawing on with a stagger */}
      {arcs.map((a, i) => (
        <motion.path
          key={a.r}
          d={`M${wifi.x - a.r} ${wifi.y} A${a.r} ${a.r} 0 0 1 ${wifi.x + a.r} ${wifi.y}`}
          stroke={a.color}
          strokeOpacity="0.8"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
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
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", email: "", company: "", message: "" });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
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
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (nextErrors.email) { emailInputRef.current?.focus(); return; }
    if (nextErrors.password) { passwordInputRef.current?.focus(); return; }
    setLoading(true);
    try {
      // Store role before login so AuthContext can use it
      localStorage.setItem("cg_login_role", role);
      await login({ email, password });
      toast.success(`Welcome back, ${role}!`);
      // Small delay to let AuthRouterContextSync propagate before navigation
      setTimeout(() => {
        navigate({ to: redirect || "/", replace: true });
      }, 50);
    } catch (err) {
      const appError = err as AppError;
      if (appError.status === 403 && appError.message?.toLowerCase().includes("password change required")) {
        setMustChangePasswordOpen(true);
      } else {
        toast.error(appError.message || "Login failed");
      }
    } finally { setLoading(false); }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) { toast.error("New password must be at least 12 characters."); return; }
    if (newPassword !== confirmNewPassword) { toast.error("Passwords don't match."); return; }
    setSettingNewPassword(true);
    try {
      localStorage.setItem("cg_login_role", role);
      await login({ email, password, newPassword });
      toast.success("Password set. Welcome!");
      setMustChangePasswordOpen(false);
      setTimeout(() => {
        navigate({ to: redirect || "/", replace: true });
      }, 50);
    } catch (err) {
      toast.error((err as AppError).message || "Could not set new password. Please try again.");
    } finally { setSettingNewPassword(false); }
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.name || !demoForm.email || !demoForm.company) {
      toast.error("Please share your name, email, and company.");
      return;
    }
    setDemoSubmitting(true);
    try {
      await demoRequestService.submit({
        fullName: demoForm.name,
        email: demoForm.email,
        companyName: demoForm.company,
        message: demoForm.message || undefined,
      });
      toast.success("Thanks! Our team will reach out to schedule your demo.");
      setDemoForm({ name: "", email: "", company: "", message: "" });
      setDemoOpen(false);
    } catch (err) {
      toast.error((err as AppError).message || "Could not submit your request. Please try again.");
    } finally {
      setDemoSubmitting(false);
    }
  };

  if (view === "forgot-password") {
    return <ForgotPasswordPage onBack={() => setView("login")} />;
  }

  return (
    <>
    <motion.button
      onClick={() => setDemoOpen(true)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      className="btn-glow fixed right-5 top-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#6C4EFF] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#6C4EFF]/20 backdrop-blur transition-colors hover:bg-[#5A3AE0]"
    >
      <CalendarClock className="h-4 w-4" /> Book a Demo
    </motion.button>
    <div className="flex min-h-screen">
      {/* Left: brand hero -- same dark indigo/violet/fuchsia treatment as
       * the customer dashboard's hero band, for one consistent visual
       * identity across the product instead of a flat single-hue fill. */}
      <div className="relative hidden w-1/2 lg:flex flex-col justify-between bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-12 text-white overflow-hidden">
        {/* Backdrop glow -- same static treatment as AuthLayout.tsx and
         * master-login.tsx, restoring one consistent backdrop across all
         * auth-adjacent hero panels. Previously an Aceternity Aurora
         * Background sweep (PR #74); reverted per
         * docs/customer-login-v3-design-spec.md -- that effect was
         * internally inconsistent with this exact flow's own
         * forgot-password screen (AuthLayout.tsx), which explicitly
         * rejected an aurora-style wash in a code comment, and produced a
         * visible backdrop jump-cut when navigating between the two. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
        />
        {/* Faint dot-grid for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(80% 80% at 50% 30%, black, transparent 75%)",
          }}
        />

        <motion.div
          className="flex items-center gap-3 relative z-10"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            {/* The real, original brand mark -- the earlier hand-recreated
             * inline SVG (added only to tint the signal arcs green) was
             * reverted back to this actual file once the arcs went back to
             * white, so this is genuinely the same asset used everywhere
             * else this mark appears, not an approximation of it. The
             * online-status dot is a separate overlay, not part of the mark
             * itself. */}
            <img src="/brand/mark-compact-white.svg" alt="" className="h-7 w-7" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#312e81]" />
            </span>
          </div>
          <div><p className="text-xl font-extrabold tracking-tight">Wyfy Guest</p><p className="text-sm font-normal tracking-wide text-white/70">Effortless guest WiFi, at scale.</p></div>
        </motion.div>

        <motion.div
          className="relative z-10 max-w-md space-y-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Your network across every location. One dashboard. Zero blind spots.</h2>
          <p className="text-base text-white/80 leading-relaxed">Provision networks, onboard guests, track analytics, and monitor every location in real-time — with role-based access built for global teams.</p>
          <div className="flex gap-6 pt-4">
            {STATS.map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + i * 0.1, ease: "easeOut" }}
              >
                <p className="text-2xl font-bold tabular-nums">
                  {"divide" in s ? <CountUp target={s.v / s.divide} /> : <CountUp target={s.v} decimals={s.v % 1 !== 0 ? 1 : 0} />}
                  {s.suffix}
                </p>
                <p className="text-xs text-white/60">{s.l}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="pt-2 opacity-90"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 0.9, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
          >
            <HeroWifiIllustration />
          </motion.div>
        </motion.div>

        <motion.p
          className="relative z-10 text-sm text-white/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          © 2026 Wyfy Guest. All rights reserved.
        </motion.p>

      </div>

      {/* Right: sign-in form -- explicitly re-pinned to the light palette
       * via inline custom-property overrides, regardless of the visitor's
       * OS/browser dark-mode preference (ThemeContext.tsx auto-applies
       * `.dark` off `prefers-color-scheme`). Without this, a dark-mode
       * visitor got a near-black panel with a teal/cyan primary color that
       * read as "black and green" and clashed with the deliberately dark
       * indigo/violet hero on the left -- this form should look the same,
       * clean and light, for every visitor. */}
      <div
        className="relative flex w-full lg:w-1/2 items-center justify-center bg-white px-6 py-12 text-slate-900"
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
      >
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
              </span>
            </div>
            <p className="text-lg font-extrabold tracking-tight">Wyfy Guest</p>
          </div>
          <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Sign in</h1><p className="mt-1 text-sm text-muted-foreground">Access your network dashboard.</p></div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3">I'm signing in as</p>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                onClick={() => selectRole("owner")}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={cn("relative overflow-hidden flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors", role === "owner" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}
              >
                {role === "owner" && (
                  <motion.span layoutId="role-active" className="absolute inset-0 -z-10 bg-primary/5" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} />
                )}
                <ShieldCheck className={cn("h-5 w-5", role === "owner" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">Owner</span>
                <span className="text-xs text-muted-foreground">Full workspace access</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => selectRole("agent")}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={cn("relative overflow-hidden flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors", role === "agent" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}
              >
                {role === "agent" && (
                  <motion.span layoutId="role-active" className="absolute inset-0 -z-10 bg-primary/5" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} />
                )}
                <UserRound className={cn("h-5 w-5", role === "agent" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">Staff</span>
                <span className="text-xs text-muted-foreground">Assigned features only</span>
              </motion.button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input ref={emailInputRef} id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10" autoFocus /></div>
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
              <div className="relative order-2"><Input id="password" type={show ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              <div className="order-1 mb-2 flex items-center justify-between"><Label htmlFor="password">Password</Label><button type="button" onClick={() => setView("forgot-password")} className="text-xs font-medium text-primary hover:underline">Forgot password?</button></div>
            </div>
            <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }}>
              <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/20" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{loading ? "Signing in…" : "Sign in as " + (role === "owner" ? "Owner" : "Staff")}</Button>
            </motion.div>
          </form>

          {/* Real infrastructure trust strip -- this deployment genuinely
              runs on Azure (the app VM) and AWS (S3-compatible storage for
              uploads/backups), not a decorative claim. */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
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
        </motion.div>

        <motion.div
          className="absolute inset-x-0 bottom-4 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-medium text-foreground/70">
            <span aria-hidden className="flex h-2.5 w-3.5 flex-col overflow-hidden rounded-[1px] ring-1 ring-black/5">
              <span className="h-[1px] flex-1 bg-[#FF9933]" />
              <span className="h-[1px] flex-1 bg-white" />
              <span className="h-[1px] flex-1 bg-[#138808]" />
            </span>
            Made in India, for the world
          </span>
        </motion.div>
      </div>
    </div>

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
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Set a new password</DialogTitle>
          <DialogDescription>
            This is your first sign-in with a temporary password. Choose a new password (min. 12 characters, with uppercase, lowercase, a digit, and a special character) to finish signing in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSetNewPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" placeholder="Enter a new password" autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input id="confirm-new-password" type="password" placeholder="Re-enter the new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMustChangePasswordOpen(false)} disabled={settingNewPassword}>Cancel</Button>
            <Button type="submit" disabled={settingNewPassword}>
              {settingNewPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {settingNewPassword ? "Setting…" : "Set password & sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
      <DialogContent
        className="sm:max-w-md"
        style={
          {
            "--primary": "#6C4EFF",
            "--primary-foreground": "#ffffff",
            "--ring": "#6366f1",
          } as React.CSSProperties
        }
      >
        <DialogHeader>
          <DialogTitle>Book a Demo</DialogTitle>
          <DialogDescription>Tell us a bit about your business and our team will reach out to schedule a walkthrough.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleDemoSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-name">Full name</Label>
            <Input id="demo-name" placeholder="Jane Doe" value={demoForm.name} onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-email">Work email</Label>
            <Input id="demo-email" type="email" placeholder="jane@company.com" value={demoForm.email} onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-company">Company</Label>
            <Input id="demo-company" placeholder="Acme Hotels" value={demoForm.company} onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-message">What are you looking for? (optional)</Label>
            <textarea
              id="demo-message"
              placeholder="Tell us about your locations, network size, or specific needs…"
              value={demoForm.message}
              onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDemoOpen(false)} disabled={demoSubmitting}>Cancel</Button>
            <Button type="submit" disabled={demoSubmitting}>
              {demoSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {demoSubmitting ? "Submitting…" : "Request Demo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
