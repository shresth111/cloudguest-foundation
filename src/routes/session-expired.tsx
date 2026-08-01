import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/session-expired")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: SessionExpiredPage,
});

function SessionExpiredPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  useEffect(() => {
    void logout();
  }, [logout]);

  // api.ts's response interceptor sends *any* session here on a 401 it
  // can't refresh -- a Master Console session's expired token lands here
  // exactly the same way a customer's does, `redirect` carrying whichever
  // page they were on (e.g. "/master/customers"). This used to always
  // point "Return to sign in" at /login (the customer/org-owner sign-in
  // page) regardless of that -- so a platform operator whose session
  // expired mid-console got dropped onto the customer login page instead
  // of back to /master-login. Route by the same prefix the /master and
  // /agent route guards themselves key off of, so each surface's session
  // expiring sends you back to *that* surface's own sign-in, not always
  // the customer one.
  const signInTarget = redirect?.startsWith("/master") ? "/master-login" : "/login";

  return (
    // Full-bleed moment, not a split hero+form -- this is a brief
    // interstitial someone lands on for a couple seconds before bouncing
    // back to sign-in, so it gets the same dark indigo/violet/fuchsia
    // treatment as login.tsx's hero / the customer dashboard hero band,
    // just centered rather than split, and kept to one focused card.
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-6 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
      />
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
        className="absolute top-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
        </div>
        <p className="text-base font-bold">Wyfy Guest</p>
      </motion.div>

      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-400/20 ring-1 ring-white/20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <Clock className="h-7 w-7 text-fuchsia-100" />
        </motion.div>

        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Your session has expired</h1>
          <p className="text-sm text-white/70 sm:text-base">
            For your security, please sign in again to continue.
          </p>
        </motion.div>

        <motion.p
          className="text-sm leading-relaxed text-white/50"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: "easeOut" }}
        >
          You've been signed out due to inactivity or an expired session token.
        </motion.p>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.36, ease: "easeOut" }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            className="h-11 w-full bg-white text-sm font-semibold text-[#1e1b4b] shadow-lg shadow-black/20 hover:bg-white/90"
            onClick={() => navigate({ to: signInTarget, search: { redirect }, replace: true })}
          >
            Return to sign in
          </Button>
        </motion.div>
      </motion.div>

      <motion.p
        className="pointer-events-none absolute bottom-6 z-10 text-xs text-white/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        © 2026 Wyfy Guest. All rights reserved.
      </motion.p>
    </div>
  );
}
