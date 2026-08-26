import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { useCustomerStore } from "@/stores/customerStore";
import {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  ROLES_STORAGE_KEY,
  ORGS_STORAGE_KEY,
} from "@/services/api";
import { getImpersonationClaim } from "@/lib/jwt";
import type {
  AuthSession,
  LoginCredentials,
  OrganizationMembership,
  RoleAssignment,
  User,
} from "@/types/auth";

// Moved to services/api.ts so the request interceptor can read the stored
// roles/memberships without importing this module (which would be an
// import cycle). Re-exported here because several modules already import
// them from this path.
export { ROLES_STORAGE_KEY, ORGS_STORAGE_KEY };

/** Where the operator's own real session is parked while an impersonation
 * session is active in the 5 slots above -- NOT the same shape
 * `persistSession` writes (`AuthSession`'s `tokens.refreshToken` is always
 * present there; a rehydrated-from-storage session may have no refresh
 * token role to speak of if it was never captured, so this carries
 * whatever is *actually* in `REFRESH_TOKEN_STORAGE_KEY` right now, nullable). */
const PRE_IMPERSONATION_SESSION_KEY = "cloudguest_pre_impersonation_session";
export { PRE_IMPERSONATION_SESSION_KEY };

/** The impersonation access token's own `expires_at` (ISO 8601 UTC, from
 * `POST /users/{id}/impersonate`'s response) -- kept in its own slot,
 * separate from the token itself, so the banner's countdown survives a
 * page reload without having to invent an expiry from a JWT `exp` claim
 * the documented contract never promises. Absent whenever no impersonation
 * session is active. */
export const IMPERSONATION_EXPIRES_AT_KEY = "cloudguest_impersonation_expires_at";

interface PreImpersonationSession {
  accessToken: string;
  refreshToken: string | null;
  user: User;
  roles: RoleAssignment[];
  organizations: OrganizationMembership[];
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** The minimal slice of auth state pushed into TanStack Router's context so
 * `beforeLoad` guards can read it outside React. `roles` is included
 * specifically so the `/master` guard can check for a GLOBAL-scope role
 * (see that route's own comment) -- checking `status === "authenticated"`
 * alone only proves the visitor is logged in as *someone*, not that
 * they're a platform operator; any real customer/org-owner account is
 * "authenticated" too. */
export interface RouterAuthContext {
  status: AuthStatus;
  roles: RoleAssignment[];
}

/** Input to `beginImpersonation` -- everything `POST
 * /users/{id}/impersonate`'s response hands back (`accessToken`,
 * `expiresAt`, `targetUser`), plus the organization the master console
 * already knows the target belongs to (the endpoint's own response never
 * carries org/role data -- see `beginImpersonation`'s doc comment for why
 * that's synthesized client-side instead). */
export interface BeginImpersonationInput {
  accessToken: string;
  expiresAt: string;
  targetUser: { id: string; fullName: string; email: string; username: string };
  organization: { id: string; name: string; slug: string };
}

interface AuthContextValue {
  user: User | null;
  roles: RoleAssignment[];
  organizations: OrganizationMembership[];
  status: AuthStatus;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (creds: LoginCredentials) => Promise<AuthSession>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  /** Pushes a freshly-saved user (e.g. from a real PUT /me profile update)
   * into context + localStorage so the rest of the app (sidebar, header,
   * account page) reflects it immediately without a full reload. */
  updateUser: (user: User) => void;
  /** Switches the ACTIVE session over to an impersonated customer, having
   * first tucked the operator's real session away in
   * `PRE_IMPERSONATION_SESSION_KEY` so `endImpersonation` can restore it.
   * See its own implementation comment for the full contract. */
  beginImpersonation: (input: BeginImpersonationInput) => Promise<void>;
  /** Restores whatever real session `beginImpersonation` preserved (or, if
   * none is found, fails safe to signed-out) and discards the
   * impersonation token. Does not navigate -- same division of labor as
   * `logout()`, the caller decides where to go. */
  endImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** The plain-string counterpart to `readStoredJson` above, and guarded for
 * exactly the same reason: `localStorage` access can *throw* (Apple's
 * Captive Network Assistant treats Web Storage like private browsing and
 * raises a SecurityError; so does storage-disabled Firefox). The token
 * read in `rehydrate()` used to be unguarded, and because `rehydrate` is
 * `async`, a throw there became an unhandled rejection that silently
 * skipped every `setStatus` call -- leaving auth pinned at "loading"
 * forever, i.e. an app that never finishes booting rather than one that
 * says "signed out". */
function readStoredString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable -- the session still lives in React state for
    // this page's lifetime; it just won't survive a reload.
  }
}

function removeStored(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing was stored, so nothing needs clearing.
  }
}

function persistSession(session: AuthSession) {
  writeStored(TOKEN_STORAGE_KEY, session.tokens.accessToken);
  writeStored(REFRESH_TOKEN_STORAGE_KEY, session.tokens.refreshToken);
  writeStored(USER_STORAGE_KEY, JSON.stringify(session.user));
  writeStored(ROLES_STORAGE_KEY, JSON.stringify(session.roles));
  writeStored(ORGS_STORAGE_KEY, JSON.stringify(session.organizations));
}

function clearStoredSession() {
  removeStored(TOKEN_STORAGE_KEY);
  removeStored(REFRESH_TOKEN_STORAGE_KEY);
  removeStored(USER_STORAGE_KEY);
  removeStored(ROLES_STORAGE_KEY);
  removeStored(ORGS_STORAGE_KEY);
  // Defensive: these two should already be gone by the time a normal
  // logout runs (`endImpersonation` removes both once it restores the
  // operator's session). Clearing them here too means a real login/logout
  // can never leave a *previous* operator's preserved session or a stale
  // expiry sitting in storage indefinitely if that restore step was ever
  // skipped (e.g. the tab closed mid-impersonation instead of using "End
  // session").
  removeStored(PRE_IMPERSONATION_SESSION_KEY);
  removeStored(IMPERSONATION_EXPIRES_AT_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      const token = readStoredString(TOKEN_STORAGE_KEY);
      const storedUser = readStoredJson<User>(USER_STORAGE_KEY);
      if (!token || !storedUser) {
        if (!cancelled) setStatus("anonymous");
        return;
      }

      // Rehydrate synchronously from storage first so nothing flashes while
      // /auth/me and /me/permissions confirm the session in the background.
      setUser(storedUser);
      setRoles(readStoredJson<RoleAssignment[]>(ROLES_STORAGE_KEY) ?? []);
      setOrganizations(readStoredJson<OrganizationMembership[]>(ORGS_STORAGE_KEY) ?? []);
      setStatus("authenticated");

      // Demo mode: skip backend calls for demo sessions
      if (token === "demo-access-token") {
        setPermissions(new Set(["*"]));
        return;
      }

      try {
        const [freshUser, freshPermissions] = await Promise.all([
          authService.me(),
          authService.myPermissions(),
        ]);
        if (cancelled) return;
        setUser(freshUser);
        writeStored(USER_STORAGE_KEY, JSON.stringify(freshUser));
        setPermissions(new Set(freshPermissions));
      } catch {
        // A 401 here is handled globally by the api.ts response interceptor
        // (refresh-then-retry, or clear session + redirect to /session-expired).
      }
    }

    void rehydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (creds: LoginCredentials) => {
      // Switching identities mid-session (e.g. testing multiple accounts in
      // one tab) must not leak the previous account's cached queries --
      // customerKeys.permissions/sidebar/etc. aren't scoped by user/org id,
      // so without this a new login can render stale data (wrong features,
      // wrong locations) until each query's own staleTime happens to elapse.
      queryClient.clear();

      // Same identity-switch problem, but for useCustomerStore's own
      // Zustand `persist` middleware (customerStore.ts) -- activeLocationId
      // survives in localStorage independent of the auth token entirely, so
      // a *previous* session's location silently carried into this new
      // login. src/routes/index.tsx's IndexRedirect only sends an
      // authenticated visitor to the /switch-location picker when
      // activeLocationId is null -- with a stale non-null value left over
      // from before, a fresh login skipped the picker outright and landed
      // straight in whatever location happened to be selected last time,
      // even when that location doesn't belong to (or isn't the intended
      // one for) the account that just signed in. Bug report: "demo saari
      // location wale pr pehle nahi ja raha... login hote hi direct
      // location mai ja raha hai."
      useCustomerStore.getState().clearLocation();

      // A fresh login is never a continuation of some earlier impersonation
      // detour -- drop both slots so a stale preserved-operator-session or
      // expiry from a previous, improperly-ended impersonation (tab closed
      // instead of "End session") can never resurface later.
      removeStored(PRE_IMPERSONATION_SESSION_KEY);
      removeStored(IMPERSONATION_EXPIRES_AT_KEY);

      // Demo mode: bypass backend if using test credentials
      if (creds.email === "admin@example.com" && creds.password === "test") {
        const demoSession: AuthSession = {
          user: {
            id: "u-001",
            firstName: "Admin",
            lastName: "User",
            name: "Admin User",
            email: creds.email,
            phone: "+919876543210",
            username: "admin",
            timezone: "Asia/Kolkata",
            language: "en",
            isActive: true,
            isVerified: true,
            status: "active",
          },
          tokens: {
            accessToken: "demo-access-token",
            refreshToken: "demo-refresh-token",
            tokenType: "Bearer",
            expiresIn: 3600,
            refreshExpiresIn: 86400,
          },
          sessionId: "sess-demo-001",
          roles: [
            {
              roleId: "r-001",
              roleName: "Super Admin",
              roleSlug: "super-admin",
              scopeType: "global",
            },
          ],
          organizations: [
            {
              organizationId: "org-001",
              organizationName: "Acme Corp",
              organizationSlug: "acme-corp",
              isPrimaryContact: true,
              enabledFeatures: ["all"],
            },
          ],
        };
        persistSession(demoSession);
        setUser(demoSession.user);
        setRoles(demoSession.roles);
        setOrganizations(demoSession.organizations);
        setPermissions(new Set(["*"]));
        setStatus("authenticated");
        return demoSession;
      }

      const session = await authService.login(creds);
      persistSession(session);
      setUser(session.user);
      setRoles(session.roles);
      setOrganizations(session.organizations);
      setStatus("authenticated");

      const myPermissions = await authService.myPermissions();
      setPermissions(new Set(myPermissions));

      return session;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const refreshToken = readStoredString(REFRESH_TOKEN_STORAGE_KEY);
    try {
      await authService.logout(refreshToken);
    } catch {
      // Best-effort revoke — always clear local session regardless.
    }
    clearStoredSession();
    queryClient.clear();
    // Symmetric with login()'s own clearLocation() above -- the next
    // sign-in (same tab, different account) must not inherit this
    // session's location either.
    useCustomerStore.getState().clearLocation();
    setUser(null);
    setRoles([]);
    setOrganizations([]);
    setPermissions(new Set());
    setStatus("anonymous");
  }, [queryClient]);

  const can = useCallback((permission: string) => permissions.has(permission), [permissions]);

  const updateUser = useCallback((next: User) => {
    setUser(next);
    writeStored(USER_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const beginImpersonation = useCallback(
    async (input: BeginImpersonationInput) => {
      // Defense in depth. The real boundary is `/master`'s own route guard
      // (master.tsx's `isOperator` check): the entry point that calls this
      // lives under `/master/*`, and the ACTIVE token while impersonating
      // is the customer's, never a GLOBAL-scope one, so that guard already
      // redirects away before this could ever be reached a second time.
      // This check exists anyway because it's the one function that could
      // actually *start* a nested session, and it costs nothing to confirm
      // rather than assume the guard holds.
      const currentToken = readStoredString(TOKEN_STORAGE_KEY);
      if (currentToken && getImpersonationClaim(currentToken)) {
        throw new Error(
          "Already viewing as a customer -- end that session before starting another.",
        );
      }

      // The real operator user, read from storage rather than trusted from
      // React state -- storage is what actually survives to be restored
      // later, and is the same source `rehydrate()` itself trusts.
      const operatorUser = readStoredJson<User>(USER_STORAGE_KEY) ?? user;
      if (!currentToken || !operatorUser) {
        throw new Error("No active operator session to preserve -- refusing to impersonate.");
      }

      // Preserve the operator's real session before anything below
      // overwrites it. Not `AuthSession`'s shape (that always has a real
      // refresh token; a rehydrated-from-storage session's refresh token
      // is whatever is actually sitting in storage right now, which this
      // captures as-is instead of assuming one exists).
      const preSession: PreImpersonationSession = {
        accessToken: currentToken,
        refreshToken: readStoredString(REFRESH_TOKEN_STORAGE_KEY),
        user: operatorUser,
        roles,
        organizations,
      };
      writeStored(PRE_IMPERSONATION_SESSION_KEY, JSON.stringify(preSession));

      // Same identity-switch hygiene login()/logout() already apply --
      // an operator's cached queries and any leftover customerStore
      // location must not leak into (or get overwritten by) the
      // impersonated view.
      queryClient.clear();
      useCustomerStore.getState().clearLocation();

      const fullName = input.targetUser.fullName.trim();
      const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
      const impersonatedUser: User = {
        id: input.targetUser.id,
        firstName: firstName || fullName || input.targetUser.email,
        lastName: rest.join(" "),
        name: fullName || input.targetUser.email,
        email: input.targetUser.email,
        username: input.targetUser.username,
        timezone: "UTC",
        language: "en",
        status: "active",
        isActive: true,
        isVerified: true,
      };
      // `POST /users/{id}/impersonate` hands back the target's identity
      // only -- never their real role/org grants, so those two can't be
      // read from the response. This role entry is a placeholder: its ONLY
      // job is to read as non-"global" for the two guards that check
      // `roles` client-side (`/master`'s `isOperator`,
      // `requireCustomerSession`'s `hasCustomerRole` in authGuards.ts) --
      // it grants nothing by itself. Real authorization for everything the
      // impersonated session actually does comes from the backend, via the
      // real `myPermissions()` call below, made authenticated AS the
      // target (the request interceptor picks up the token written just
      // after this).
      const impersonatedRoles: RoleAssignment[] = [
        {
          roleId: "impersonated-session",
          roleName: "Customer (impersonated)",
          roleSlug: "impersonated-customer",
          scopeType: "organization",
          organizationId: input.organization.id,
        },
      ];
      // This is the entry, and the ONLY entry, `resolveActiveOrganizationId()`
      // (services/api.ts) needs to attach `X-Organization-Id` by default on
      // every org-scoped call the impersonated dashboard makes -- without
      // it those calls fall back to GLOBAL scope, where the target user
      // holds nothing, and 403 (see that function's own doc comment for
      // the exact failure this reproduces). `isPrimaryContact: true` isn't
      // an arbitrary placeholder either: this feature's one entry point
      // (master.customers.tsx) resolves the impersonation target by
      // matching the organization's own `contactEmail`, i.e. it only ever
      // impersonates that org's primary contact/owner account.
      const impersonatedOrganizations: OrganizationMembership[] = [
        {
          organizationId: input.organization.id,
          organizationName: input.organization.name,
          organizationSlug: input.organization.slug,
          isPrimaryContact: true,
          enabledFeatures: ["all"],
        },
      ];

      writeStored(TOKEN_STORAGE_KEY, input.accessToken);
      // Deliberately no refresh token, and deliberately NOT the operator's
      // leftover one either: api.ts's 401 interceptor calls
      // `refreshAccessToken()`, which reads this exact key. Leaving the
      // operator's refresh token in place would let an expired
      // impersonation token silently mint a fresh OPERATOR access token
      // instead of ending the impersonated session -- a real session
      // boundary violation, not a cosmetic one. An impersonation session
      // is meant to hard-stop at `expires_at`, never quietly renew.
      removeStored(REFRESH_TOKEN_STORAGE_KEY);
      writeStored(USER_STORAGE_KEY, JSON.stringify(impersonatedUser));
      writeStored(ROLES_STORAGE_KEY, JSON.stringify(impersonatedRoles));
      writeStored(ORGS_STORAGE_KEY, JSON.stringify(impersonatedOrganizations));
      writeStored(IMPERSONATION_EXPIRES_AT_KEY, input.expiresAt);

      setUser(impersonatedUser);
      setRoles(impersonatedRoles);
      setOrganizations(impersonatedOrganizations);
      setStatus("authenticated");

      // Real, backend-issued permissions for the target user -- same
      // post-persist call login() itself makes, just authenticated as
      // someone else now that the token above has been swapped.
      const myPermissions = await authService.myPermissions();
      setPermissions(new Set(myPermissions));
    },
    [queryClient, user, roles, organizations],
  );

  const endImpersonation = useCallback(() => {
    const preSession = readStoredJson<PreImpersonationSession>(PRE_IMPERSONATION_SESSION_KEY);
    queryClient.clear();
    useCustomerStore.getState().clearLocation();
    removeStored(PRE_IMPERSONATION_SESSION_KEY);
    removeStored(IMPERSONATION_EXPIRES_AT_KEY);

    if (!preSession || !preSession.accessToken) {
      // Nothing real to restore to (storage was cleared from under us, or
      // this somehow ran twice) -- fail safe to signed-out rather than
      // leave a half-restored session standing.
      clearStoredSession();
      setUser(null);
      setRoles([]);
      setOrganizations([]);
      setPermissions(new Set());
      setStatus("anonymous");
      return;
    }

    writeStored(TOKEN_STORAGE_KEY, preSession.accessToken);
    if (preSession.refreshToken) writeStored(REFRESH_TOKEN_STORAGE_KEY, preSession.refreshToken);
    else removeStored(REFRESH_TOKEN_STORAGE_KEY);
    writeStored(USER_STORAGE_KEY, JSON.stringify(preSession.user));
    writeStored(ROLES_STORAGE_KEY, JSON.stringify(preSession.roles));
    writeStored(ORGS_STORAGE_KEY, JSON.stringify(preSession.organizations));

    setUser(preSession.user);
    setRoles(preSession.roles);
    setOrganizations(preSession.organizations);
    setStatus("authenticated");

    // Best-effort re-confirmation of the operator's real permissions
    // (mirrors rehydrate()'s own reasoning for the same call) -- unlike
    // login()/beginImpersonation(), a failure here is swallowed rather
    // than thrown: the operator's session actually being restored matters
    // more than this one call succeeding, and the interceptor's own 401
    // handling is still there as a backstop if the token really is stale.
    authService
      .myPermissions()
      .then((perms) => setPermissions(new Set(perms)))
      .catch(() => {});
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      organizations,
      status,
      isAuthenticated: status === "authenticated",
      isReady: status !== "loading",
      login,
      logout,
      can,
      updateUser,
      beginImpersonation,
      endImpersonation,
    }),
    [
      user,
      roles,
      organizations,
      status,
      login,
      logout,
      can,
      updateUser,
      beginImpersonation,
      endImpersonation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
