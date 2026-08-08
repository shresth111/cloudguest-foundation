import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { homeRoute } from "@/lib/roles";
import { LoginPage } from "./login";
import { MasterLoginPage } from "./master-login";
import { CustomerDashboardPage } from "./c.index";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

// The Master Console is served from its own hostname
// (master.wyfyguest.com), not a path under the customer app -- so which
// sign-in form belongs at this same bare "/" route depends on the
// hostname the request came in on. That can only be read from `window`,
// so it's resolved in an effect and folded into the existing `isReady`
// spinner gate below rather than read directly in the render body --
// reading it there would make the server (which renders this route with
// no `window`) and the client's first paint disagree, i.e. a hydration
// mismatch. Piggybacking on `isReady` costs nothing extra: that gate
// already forces a spinner-first paint on every visitor before any
// sign-in form appears.
function useHostname() {
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => setHostname(window.location.hostname), []);
  return hostname;
}

// Anonymous visitors get the sign-in form rendered right here, in place --
// not a navigate() to /login or /master-login -- so the address bar stays
// on the bare root URL instead of switching to .../login or
// .../master-login.
//
// An authenticated *customer* (any hostname other than the Master
// Console's) gets the real dashboard rendered right here too, in the
// exact same spirit -- CustomerDashboardPage (see c.index.tsx, which
// itself is now just a compat redirect back to this route) instead of a
// navigate() away to a sub-path, so the app's single most-visited page
// gets to live at the plainest possible URL. Still needs its own
// location-context guard (mirroring c.index.tsx's old beforeLoad
// requireActiveLocationId(), which no longer runs for this render path):
// an authenticated visitor with no active location picked yet gets sent
// to /c/locations, the picker, instead of CustomerDashboardPage rendering
// with an undefined location to scope its data to.
//
// Master Console hostname keeps its original behavior unchanged --
// navigate() to homeRoute() -- since MasterLoginPage's own submit handler
// already owns the real post-login destination (/master, see
// master-login.tsx); this effect only ever matters for the edge case of
// an already-authenticated operator landing back on the bare root.
function IndexRedirect() {
  const { isAuthenticated, isReady, user } = useAuth();
  const navigate = useNavigate();
  const hostname = useHostname();
  const activeLocationId = useCustomerStore((s) => s.activeLocationId);
  const isMaster = hostname === "master.wyfyguest.com";

  useEffect(() => {
    if (!isReady || !isAuthenticated || !user) return;
    if (isMaster) {
      navigate({ to: homeRoute(), replace: true });
      return;
    }
    if (!activeLocationId) {
      navigate({ to: "/switch-location", replace: true });
    }
  }, [isReady, isAuthenticated, user, isMaster, activeLocationId, navigate]);

  if (!isReady || hostname === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (!isMaster && activeLocationId) {
      return <CustomerDashboardPage />;
    }
    // Master (navigating away) or no active location yet (navigating to
    // the picker) -- the effect above is already handling it.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return isMaster ? <MasterLoginPage /> : <LoginPage />;
}
