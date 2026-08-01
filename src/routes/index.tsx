import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { homeRoute } from "@/lib/roles";
import { LoginPage } from "./login";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

// Anonymous visitors get the sign-in form rendered right here, in place --
// not a navigate() to /login -- so the address bar stays on the bare
// app.wyfyguest.com URL instead of switching to .../login.
function IndexRedirect() {
  const { isAuthenticated, isReady, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated && user) {
      navigate({ to: homeRoute(), replace: true });
    }
  }, [isReady, isAuthenticated, user, navigate]);

  if (!isReady || (isAuthenticated && user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <LoginPage />;
}
