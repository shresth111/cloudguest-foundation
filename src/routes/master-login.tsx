import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Loader2, Eye, EyeOff, ShieldCheck, Building2, Router, Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master-login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  component: MasterLoginPage,
});

const STATS = [
  { icon: Building2, v: 8, decimals: 0, l: "Tenants managed" },
  { icon: Router, v: 93, decimals: 0, suffix: "%", l: "Routers online" },
  { icon: Activity, v: 99.9, decimals: 1, suffix: "%", l: "Platform uptime" },
] as const;

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

function MasterLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter email and password"); return; }
    setLoading(true);
    try {
      localStorage.setItem("cg_login_role", "super-admin");
      await login({ email, password });
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
              <p className="text-base font-semibold">ZIP WiFi</p>
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
              <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.7_0.15_260)]" /> Platform operator access
            </span>
            <h2 className="text-[2.1rem] font-semibold leading-[1.15] tracking-tight">
              Every tenant, every router, one console.
            </h2>
            <p className="text-sm leading-relaxed text-white/65">
              Provision customers, manage RADIUS/NAS infrastructure, and monitor the whole platform in real time — the control plane behind every location.
            </p>
            <div className="flex gap-8 pt-2">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.l}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.1, ease: "easeOut" }}
                >
                  <s.icon className="mb-1.5 h-4 w-4 text-[oklch(0.7_0.15_260)]" />
                  <p className="text-xl font-semibold tabular-nums"><CountUp target={s.v} decimals={s.decimals} />{s.suffix ?? ""}</p>
                  <p className="text-xs text-white/50">{s.l}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.p
            className="relative z-10 text-xs text-white/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            © 2026 ZIP WiFi. Internal operator tooling — not for customer distribution.
          </motion.p>
        </div>

        {/* Right: sign-in form */}
        <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" /></div>
              <div><p className="text-sm font-semibold">ZIP WiFi</p><p className="text-[11px] text-muted-foreground">Master Console</p></div>
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
              <p className="text-xs text-muted-foreground">Demo: admin@example.com / test</p>
              <p className="text-xs text-muted-foreground">
                Not an operator? <Link to="/login" className="font-medium text-primary hover:underline">Sign in to your workspace</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
