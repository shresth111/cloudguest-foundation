import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Wifi, Loader2, Eye, EyeOff, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";

export type LoginRole = "owner" | "agent";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>("owner");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 lg:flex flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 text-primary-foreground overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Wifi className="h-6 w-6" /></div>
          <div><p className="text-xl font-bold">BhaiFi</p><p className="text-sm text-primary-foreground/70">Guest WiFi, managed.</p></div>
        </div>
        <div className="relative z-10 max-w-md space-y-6">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Your network across every location. One dashboard. Zero blind spots.</h2>
          <p className="text-base text-primary-foreground/80 leading-relaxed">Provision networks, onboard guests, track analytics, and monitor every location in real-time — with role-based access built for global teams.</p>
          <div className="flex gap-6 pt-4">
            {[{ v: "10K+", l: "Networks" }, { v: "99.9%", l: "Uptime" }, { v: "24/7", l: "Support" }].map((s) => (<div key={s.l}><p className="text-2xl font-bold">{s.v}</p><p className="text-xs text-primary-foreground/60">{s.l}</p></div>))}
          </div>
        </div>
        <p className="relative z-10 text-sm text-primary-foreground/60">© 2026 BhaiFi. All rights reserved.</p>
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Wifi className="h-5 w-5" /></div><p className="text-lg font-bold">BhaiFi</p></div>
          <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Sign in</h1><p className="mt-1 text-sm text-muted-foreground">Access your network dashboard.</p></div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3">I'm signing in as</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRole("owner")} className={cn("flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all", role === "owner" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                <ShieldCheck className={cn("h-5 w-5", role === "owner" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">Owner</span>
                <span className="text-xs text-muted-foreground">Full workspace access</span>
              </button>
              <button type="button" onClick={() => setRole("agent")} className={cn("flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all", role === "agent" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                <UserRound className={cn("h-5 w-5", role === "agent" ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">Agent</span>
                <span className="text-xs text-muted-foreground">Assigned features only</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" autoFocus /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link></div>
              <div className="relative"><Input id="password" type={show ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            </div>
            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{loading ? "Signing in…" : "Sign in as " + (role === "owner" ? "Owner" : "Agent")}</Button>
          </form>
          <div className="mt-6 text-center"><p className="text-xs text-muted-foreground">Demo: admin@example.com / test</p></div>
        </div>
      </div>
    </div>
  );
}
