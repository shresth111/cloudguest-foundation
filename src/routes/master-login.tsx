import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 15% 0%, oklch(0.52 0.19 260 / 0.12), transparent 60%), radial-gradient(50% 45% at 100% 100%, oklch(0.52 0.19 260 / 0.08), transparent 60%)",
          }}
        />
        <motion.div
          className="relative z-10 w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-sm">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold tracking-tight text-foreground">ZIP WiFi</p>
            <p className="text-sm text-muted-foreground">Master Console</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
            <div className="mb-6 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4.5 w-4.5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Super Admin sign in</h1>
                <p className="text-xs text-muted-foreground">Platform operator access only.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Operator email</Label>
                <Input id="email" type="email" placeholder="operator@zipwifi.io" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={show ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Signing in…" : "Sign in to Master Console"}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">Demo: admin@example.com / test</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
