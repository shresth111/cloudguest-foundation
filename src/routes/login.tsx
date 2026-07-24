import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Loader2, Eye, EyeOff, ShieldCheck, UserRound, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";

export type LoginRole = "owner" | "agent";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  component: LoginPage,
});

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

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>("owner");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", email: "", company: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter email and password"); return; }
    setLoading(true);
    try {
      // Store role before login so AuthContext can use it
      localStorage.setItem("cg_login_role", role);
      await login({ email, password });
      toast.success(`Welcome back, ${role}!`);
      // Small delay to let AuthRouterContextSync propagate before navigation
      setTimeout(() => {
        navigate({ to: redirect || "/customer", replace: true });
      }, 50);
    } catch (err) {
      toast.error((err as AppError).message || "Login failed");
    } finally { setLoading(false); }
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.name || !demoForm.email) { toast.error("Please share your name and email."); return; }
    toast.success("Thanks! Our team will reach out to schedule your demo.");
    setDemoForm({ name: "", email: "", company: "", message: "" });
    setDemoOpen(false);
  };

  return (
    <>
    <motion.button
      onClick={() => setDemoOpen(true)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      className="btn-glow fixed right-5 top-5 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 backdrop-blur transition-colors hover:bg-primary/90"
    >
      <CalendarClock className="h-4 w-4" /> Book a Demo
    </motion.button>
    <div className="flex min-h-screen">
      {/* Left: brand hero */}
      <div className="relative hidden w-1/2 lg:flex flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 text-primary-foreground overflow-hidden">
        {/* Faint animated grid for depth */}
        <div
          aria-hidden
          className="aurora-grid pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(80% 80% at 50% 30%, black, transparent 75%)",
          }}
        />

        <motion.div
          className="flex items-center gap-3 relative z-10"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><img src="/brand/mark-compact-white.svg" alt="" className="h-7 w-7" /></div>
          <div><p className="text-xl font-bold">ZIP WiFi</p><p className="text-sm text-primary-foreground/70">Guest WiFi, managed.</p></div>
        </motion.div>

        <motion.div
          className="relative z-10 max-w-md space-y-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Your network across every location. One dashboard. Zero blind spots.</h2>
          <p className="text-base text-primary-foreground/80 leading-relaxed">Provision networks, onboard guests, track analytics, and monitor every location in real-time — with role-based access built for global teams.</p>
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
                <p className="text-xs text-primary-foreground/60">{s.l}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.p
          className="relative z-10 text-sm text-primary-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          © 2026 ZIP WiFi. All rights reserved.
        </motion.p>

        <div className="aurora-blob-1 pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="aurora-blob-2 pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Right: sign-in form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lg:hidden flex items-center gap-2 mb-8"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary"><img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" /></div><p className="text-lg font-bold">ZIP WiFi</p></div>
          <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Sign in</h1><p className="mt-1 text-sm text-muted-foreground">Access your network dashboard.</p></div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3">I'm signing in as</p>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                onClick={() => setRole("owner")}
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
                onClick={() => setRole("agent")}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={cn("relative overflow-hidden flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors", role === "agent" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}
              >
                {role === "agent" && (
                  <motion.span layoutId="role-active" className="absolute inset-0 -z-10 bg-primary/5" transition={{ type: "spring", bounce: 0.25, duration: 0.4 }} />
                )}
                <UserRound className={cn("h-5 w-5", role === "agent" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">Agent</span>
                <span className="text-xs text-muted-foreground">Assigned features only</span>
              </motion.button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10" autoFocus /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link></div>
              <div className="relative"><Input id="password" type={show ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            </div>
            <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }}>
              <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/20" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{loading ? "Signing in…" : "Sign in as " + (role === "owner" ? "Owner" : "Agent")}</Button>
            </motion.div>
          </form>
          <div className="mt-6 text-center"><p className="text-xs text-muted-foreground">Demo: admin@example.com / test</p></div>
        </motion.div>
      </div>
    </div>

    <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
      <DialogContent className="sm:max-w-md">
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
            <Button type="button" variant="outline" onClick={() => setDemoOpen(false)}>Cancel</Button>
            <Button type="submit">Request Demo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
