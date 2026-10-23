/**
 * The `/partner` layout's component (lazy: it lives in the route's split
 * chunk, so none of the partner app reaches the customer or Master bundles).
 *
 * Order matters here:
 *   1. install the request shim (network host only) before any child mounts;
 *   2. `GET /isp/me` -- the one call that says whether this session is an
 *      ISP partner at all;
 *   3. pin the request scope to the ISP org (`setOrganizationScope`, plus the
 *      shim's own header) BEFORE rendering a single child, so no screen
 *      request ever leaves without it.
 * A non-ISP account is told so and signed out; a suspended ISP sees the
 * suspension message. Neither ever sees the console.
 */
import { useEffect, useMemo, useRef } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ban, ShieldAlert } from "lucide-react";
import api, { setOrganizationScope } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { ispService } from "@/services/isp-partner/isp";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { installIspApiShim, setShimIspOrganization } from "@/lib/isp-partner/api-shim";
import { isNetworkHost } from "@/lib/isp-partner/network-host";
import { ispErrorCode, ispErrorMessage } from "@/lib/isp-partner/errors";
import { accessFromMeError, accessFromRoles, masterLoginUrl } from "@/lib/isp-partner/access";
import { buildPartnerContext, PartnerContext } from "@/components/isp-partner/PartnerContext";
import { PartnerShell } from "@/components/isp-partner/PartnerShell";
import { MButton } from "@/components/master/MasterKit";
import { Spinner } from "@/components/isp-partner/kit";
import { isPartnerPublicPath } from "@/lib/isp-partner/password-reset";

function ensureShim() {
  if (typeof window !== "undefined" && isNetworkHost(window.location.hostname)) {
    installIspApiShim(api);
  }
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="master-theme">
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        {children}
      </div>
    </div>
  );
}

const NOT_PARTNER_CODES = new Set(["ISP_PARTNER_REQUIRED", "ISP_ROLE_REQUIRED"]);

export function PartnerLayout() {
  // Idempotent; runs during render so it precedes every child's first request.
  ensureShim();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Sign in, forgot password and reset password: bare, no session needed.
  const isLogin = isPartnerPublicPath(pathname);
  const { isReady, isAuthenticated, logout, roles } = useAuth();
  // Decided from the session before /isp/me (a GLOBAL Super Admin must not
  // reach it: the pinned call has no ISP org to name and answers with the
  // platform's "which organization?" error).
  const roleAccess = accessFromRoles(roles);
  const navigate = useNavigate();

  const me = useQuery({
    queryKey: ispKeys.me,
    queryFn: async () => {
      const data = await ispService.me();
      setOrganizationScope({ kind: "organization", organizationId: data.isp.id });
      setShimIspOrganization(data.isp.id);
      return data;
    },
    enabled: !isLogin && isReady && isAuthenticated && roleAccess === "unknown",
    retry: retryUnless4xx,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!isLogin && isReady && !isAuthenticated) navigate({ to: "/partner/login", replace: true });
  }, [isLogin, isReady, isAuthenticated, navigate]);

  const code = me.error ? ispErrorCode(me.error) : null;
  const meAccess = me.error ? accessFromMeError(me.error) : "unknown";
  const platformAccount = roleAccess === "platform-account" || meAccess === "platform-account";
  const notPartner =
    platformAccount ||
    roleAccess === "not-partner" ||
    meAccess === "not-partner" ||
    (code !== null && NOT_PARTNER_CODES.has(code));
  const suspended = code === "ISP_PARTNER_SUSPENDED";

  // An account that is not an ISP account (or whose ISP is suspended) holds a
  // session this console cannot use: end it, once, and say why.
  const signedOut = useRef(false);
  useEffect(() => {
    if ((notPartner || suspended) && !signedOut.current) {
      signedOut.current = true;
      setShimIspOrganization(null);
      void logout();
    }
  }, [notPartner, suspended, logout]);

  const ctx = useMemo(() => (me.data ? buildPartnerContext(me.data) : null), [me.data]);

  if (isLogin) return <Outlet />;

  if (notPartner || suspended) {
    return (
      <FullScreen>
        <div className="w-full max-w-md rounded-2xl premium-card p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            {suspended ? <Ban className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </span>
          <h1 className="mt-3 text-base font-semibold">
            {suspended
              ? "This ISP account is suspended"
              : "This account is not an ISP partner account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {suspended
              ? "Wyfy Guest has suspended access to the partner console for your ISP. Your customers' guest WiFi is not affected. Contact Wyfy Guest support to restore access."
              : platformAccount
                ? "This is a Wyfy Guest platform account. The partner console is only for ISP partner staff; platform accounts use the Master console."
                : "network.wyfyguest.com is only for ISP partner staff. If you manage a venue, sign in at app.wyfyguest.com instead."}
          </p>
          {platformAccount && !suspended && (
            <p className="mt-2 text-sm">
              <a
                className="text-primary underline"
                href={masterLoginUrl(typeof window === "undefined" ? "" : window.location.hostname)}
              >
                Open the Master console
              </a>
            </p>
          )}
          {suspended && (
            <p className="mt-2 text-xs text-muted-foreground">
              Support:{" "}
              <a className="text-primary underline" href="mailto:support@wyfyguest.com">
                support@wyfyguest.com
              </a>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">You have been signed out.</p>
          <MButton
            className="mt-4"
            onClick={() => navigate({ to: "/partner/login", replace: true })}
          >
            Back to sign in
          </MButton>
        </div>
      </FullScreen>
    );
  }

  if (me.error) {
    return (
      <FullScreen>
        <div className="w-full max-w-md rounded-2xl premium-card p-6 text-center">
          <h1 className="text-base font-semibold">Couldn&apos;t open the partner console</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ispErrorMessage(me.error)}</p>
          <div className="mt-4 flex justify-center gap-2">
            <MButton onClick={() => me.refetch()}>Try again</MButton>
            <MButton
              variant="outline"
              onClick={async () => {
                await logout();
                navigate({ to: "/partner/login", replace: true });
              }}
            >
              Sign out
            </MButton>
          </div>
        </div>
      </FullScreen>
    );
  }

  if (!ctx) {
    return (
      <FullScreen>
        <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Opening the partner console…
        </span>
      </FullScreen>
    );
  }

  return (
    <PartnerContext.Provider value={ctx}>
      <PartnerShell>
        <Outlet />
      </PartnerShell>
    </PartnerContext.Provider>
  );
}
