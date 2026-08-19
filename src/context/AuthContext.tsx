import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { useCustomerStore } from "@/stores/customerStore";
import { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "@/services/api";
import type { AuthSession, LoginCredentials, OrganizationMembership, RoleAssignment, User } from "@/types/auth";

export const ROLES_STORAGE_KEY = "cloudguest_roles";
export const ORGS_STORAGE_KEY = "cloudguest_organizations";

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

  const login = useCallback(async (creds: LoginCredentials) => {
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
          { roleId: "r-001", roleName: "Super Admin", roleSlug: "super-admin", scopeType: "global" },
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
  }, [queryClient]);

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
    }),
    [user, roles, organizations, status, login, logout, can, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
