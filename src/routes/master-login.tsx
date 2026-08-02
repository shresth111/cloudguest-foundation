import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { Loader2, Eye, EyeOff, ShieldCheck, Building2, Router, Activity, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master-login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  component: MasterLoginRouteComponent,
});

// Still needed for direct links (bookmarks, explicit "/master-login"
// navigation) -- supplies redirectTo from this route's own ?redirect=
// search param, same wrapper role LoginRouteComponent plays for /login.
function MasterLoginRouteComponent() {
  const { redirect } = Route.useSearch();
  return <MasterLoginPage redirectTo={redirect} />;
}

/**
 * Every entry is shaped the same way (`suffix` always present, just
 * optional) instead of a union where only some literals carry `suffix` --
 * that union shape is what made `s.suffix` fail to type-check when mapped
 * over (TS narrows the mapped element to whichever member matches, and not
 * every member has the field). One consistent type sidesteps that entirely.
 */
type Stat = { icon: LucideIcon; v: number; decimals: number; suffix?: string; l: string };

const STATS: Stat[] = [
  { icon: Building2, v: 8, decimals: 0, l: "Tenants managed" },
  { icon: Router, v: 93, decimals: 0, suffix: "%", l: "Routers online" },
  { icon: Activity, v: 99.9, decimals: 1, suffix: "%", l: "Platform uptime" },
];

/** Counts 0 -> target on mount with a spring, respecting reduced motion. */
function CountUp({ target, decimals = 0 }: { target: number; decimals?: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 55, damping: 20 });
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
 * Decorative hero illustration for the Master Console: a control tower
 * (radar mast, sweeping beam, sonar pings) overseeing a fleet of routers of
 * varying scale -- one detailed unit up close, several smaller ones further
 * out, each with a live telemetry link drawing on toward the mast. Reads as
 * "every router, one console" rather than the customer login's guest/WiFi
 * illustration -- this is the operator's oversight view, not a guest
 * connecting to a network, so infrastructure is the subject, not a person.
 * Same flat line-art + soft glow language as that illustration, re-tinted
 * to this console's indigo/blue-only palette (no green/teal accents here,
 * matching the rest of this codebase's decorative-color rule).
 *
 * Purely decorative -- aria-hidden. The sweep and sonar pings loop, so both
 * collapse to a single static frame under reduced motion; the one-time
 * telemetry-link draw-on and status-LED blink don't need that guard beyond
 * what's already handled below.
 */
function ControlTowerIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const tower = { x: 336, y: 62 };
  const nodes = [
    { x: 112, y: 152, scale: 1 },
    { x: 62, y: 104, scale: 0.55 },
    { x: 204, y: 120, scale: 0.5 },
    { x: 266, y: 176, scale: 0.5 },
    { x: 402, y: 138, scale: 0.55 },
  ];

  return (
    <svg aria-hidden="true" viewBox="0 0 480 210" className="h-auto w-full max-w-[300px]" fill="none">
      <defs>
        <filter id="tower-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* ground line */}
      <line x1="30" y1="192" x2="450" y2="192" stroke="white" strokeOpacity="0.12" strokeWidth="1" />

      {/* sonar pings, expanding out from the mast head */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={tower.x}
          cy={tower.y}
          r="6"
          stroke="#818cf8"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          style={{ transformOrigin: `${tower.x}px ${tower.y}px` }}
          initial={{ opacity: 0.5, scale: 0.4 }}
          animate={
            shouldReduceMotion
              ? { opacity: 0.16, scale: 3.2 }
              : { opacity: [0.5, 0], scale: [0.4, 3.6] }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 3.2, repeat: Infinity, ease: "easeOut", delay: i * 1.05 }
          }
        />
      ))}
      <circle cx={tower.x} cy={tower.y} r="30" fill="#6366f1" fillOpacity="0.18" filter="url(#tower-glow)" />

      {/* tower mast */}
      <g stroke="white" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round">
        <path d={`M${tower.x - 14} 192 L${tower.x} ${tower.y + 6} L${tower.x + 14} 192`} />
        <path d={`M${tower.x - 9} 192 L${tower.x} ${tower.y + 34} L${tower.x + 9} 192`} />
        <line x1={tower.x - 11} y1="150" x2={tower.x + 11} y2="150" />
        <line x1={tower.x - 7} y1="172" x2={tower.x + 7} y2="172" />
      </g>

      {/* radar hub + sweeping beam atop the mast */}
      <circle cx={tower.x} cy={tower.y} r="7" fill="oklch(0.19 0.03 260)" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      <motion.line
        x1={tower.x}
        y1={tower.y}
        x2={tower.x + 22}
        y2={tower.y}
        stroke="#a5b4fc"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ transformOrigin: `${tower.x}px ${tower.y}px` }}
        animate={shouldReduceMotion ? { rotate: 45 } : { rotate: 360 }}
        transition={shouldReduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "linear" }}
      />

      {/* telemetry links, drawing on from each router back to the mast */}
      {nodes.map((n, i) => (
        <motion.path
          key={`link-${i}`}
          d={`M${n.x} ${n.y} Q ${(n.x + tower.x) / 2} ${Math.min(n.y, tower.y) - 12}, ${tower.x} ${tower.y + 30}`}
          stroke="white"
          strokeOpacity="0.22"
          strokeWidth="1.25"
          strokeDasharray="3 4"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.22 }}
          transition={{ duration: 0.7, delay: 0.1 * i, ease: "easeOut" }}
        />
      ))}

      {/* the fleet -- one detailed router up close, smaller ones further out */}
      {nodes.map((n, i) => (
        <g key={`node-${i}`} transform={`translate(${n.x}, ${n.y}) scale(${n.scale})`}>
          <rect x="-20" y="-9" width="40" height="18" rx="5" fill="rgba(255,255,255,0.07)" stroke="white" strokeOpacity="0.7" strokeWidth="1.6" />
          <line x1="-9" y1="-9" x2="-13" y2="-19" stroke="white" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="9" y1="-9" x2="13" y2="-19" stroke="white" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
          <motion.circle
            cx="13"
            cy="0"
            r="2.4"
            fill="#a5b4fc"
            animate={shouldReduceMotion ? { opacity: 0.9 } : { opacity: [0.4, 1, 0.4] }}
            transition={shouldReduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          />
        </g>
      ))}
    </svg>
  );
}

/**
 * Rendered both at the dedicated `/master-login` route (via
 * `MasterLoginRouteComponent`, which supplies `redirectTo` from that
 * route's own `?redirect=` search param) and directly at `/` for anonymous
 * visitors on the master.wyfyguest.com hostname (see `src/routes/index.tsx`)
 * -- so opening that bare app URL shows this sign-in form without the
 * address bar ever changing to `/master-login`. Mirrors `LoginPage`'s own
 * dual-use shape in `src/routes/login.tsx`. Takes `redirectTo` as a prop
 * rather than reading route search params itself so it works under either
 * route.
 */
export function MasterLoginPage({ redirectTo }: { redirectTo?: string } = {}) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const redirect = redirectTo;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter email and password"); return; }
    setLoading(true);
    try {
      const session = await login({ email, password });
      // Valid credentials only prove *someone* logged in, not that they're
      // a platform operator -- a perfectly real customer/org-owner account
      // (e.g. a location owner created via the provisioning wizard) has
      // valid credentials too, just an organization-scoped role, never
      // "global". Without this check this form logged such accounts
      // straight into the Master Console (see /master route's own guard,
      // the actual security boundary this mirrors for a friendlier,
      // immediate error here instead of a silent bounce back).
      const isOperator = session.roles.some((r) => r.scopeType === "global");
      if (!isOperator) {
        await logout();
        toast.error("This account doesn't have platform operator access.");
        return;
      }
      localStorage.setItem("cg_login_role", "super-admin");
      toast.success("Welcome back, Super Admin!");
      setTimeout(() => {
        navigate({ to: redirect || "/master", replace: true });
      }, 50);
    } catch (err) {
      toast.error((err as AppError).message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="master-theme">
      <div className="flex min-h-screen bg-background">
        {/* Left: operator hero */}
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[oklch(0.24_0.05_260)] via-[oklch(0.19_0.045_260)] to-[oklch(0.14_0.035_260)] p-12 text-white lg:flex">
          <div
            aria-hidden
            className="aurora-grid pointer-events-none absolute inset-0 opacity-[0.09]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(80% 80% at 50% 30%, black, transparent 75%)",
            }}
          />
          <div className="aurora-blob-1 pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[oklch(0.55_0.19_260/0.35)] blur-[100px]" />
          <div className="aurora-blob-2 pointer-events-none absolute -bottom-32 -left-24 h-[24rem] w-[24rem] rounded-full bg-[oklch(0.45_0.15_240/0.3)] blur-[100px]" />

          <motion.div
            className="relative z-10 flex items-center gap-3"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold">Wyfy Guest</p>
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">Master Console</p>
            </div>
          </motion.div>

          <motion.div
            className="relative z-10 max-w-md space-y-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-[#818cf8]" /> Platform operator access
            </span>
            <h2 className="text-[2.35rem] font-bold leading-[1.15] tracking-tight">
              Every tenant, every router, one console.
            </h2>
            <p className="text-sm leading-relaxed text-white/65">
              Provision customers, manage RADIUS/NAS infrastructure, and monitor the whole platform in real time — the control plane behind every location.
            </p>
            <div className="flex gap-8 pt-1">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.l}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.1, ease: "easeOut" }}
                >
                  <s.icon className="mb-1.5 h-4 w-4 text-[#818cf8]" />
                  <p className="text-xl font-semibold tabular-nums"><CountUp target={s.v} decimals={s.decimals} />{s.suffix}</p>
                  <p className="text-xs text-white/50">{s.l}</p>
                </motion.div>
              ))}
            </div>
            <motion.div
              className="pt-3 opacity-90"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 0.9, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
            >
              <ControlTowerIllustration />
            </motion.div>
          </motion.div>

          <motion.p
            className="relative z-10 text-xs text-white/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            © 2026 Wyfy Guest. Internal operator tooling — not for customer distribution.
          </motion.p>
        </div>

        {/* Right: sign-in form */}
        <div className="relative flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" /></div>
              <div><p className="text-sm font-semibold">Wyfy Guest</p><p className="text-[11px] text-muted-foreground">Master Console</p></div>
            </div>

            <div className="mb-6 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Super Admin sign in</h1>
                <p className="text-xs text-muted-foreground">Platform operator access only.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Operator email</Label>
                <Input id="email" type="email" placeholder="operator@zipwifi.io" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={show ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }}>
                <Button type="submit" className="h-11 w-full text-sm font-semibold shadow-md shadow-primary/20" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Signing in…" : "Sign in to Master Console"}
                </Button>
              </motion.div>
            </form>

            <div className="mt-6 space-y-1 text-center">
              {/* No demo-credential hint here: unlike /login, this fake local-only bypass caused real login confusion on the admin console. */}
              <p className="text-xs text-muted-foreground">
                Not an operator? <Link to="/login" className="font-medium text-primary hover:underline">Sign in to your workspace</Link>
              </p>
            </div>

            {/* Real infrastructure trust strip -- this deployment genuinely
                runs on Azure (the app VM) and AWS (S3-compatible storage for
                uploads/backups), same claim as /login's, not console-specific. */}
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
    </div>
  );
}
