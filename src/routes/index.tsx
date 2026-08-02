import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { homeRoute } from "@/lib/roles";
import { LoginPage } from "./login";
import { MasterLoginPage } from "./master-login";

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
function IndexRedirect() {
  const { isAuthenticated, isReady, user } = useAuth();
  const navigate = useNavigate();
  const hostname = useHostname();

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated && user) {
      navigate({ to: homeRoute(), replace: true });
    }
  }, [isReady, isAuthenticated, user, navigate]);

  if (!isReady || hostname === null || (isAuthenticated && user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return hostname === "master.wyfyguest.com" ? <MasterLoginPage /> : <LoginPage />;
}
