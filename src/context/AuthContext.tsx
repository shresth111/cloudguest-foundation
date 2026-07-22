import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService } from "@/services/auth.service";
import { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "@/services/api";
import type { AuthSession, LoginCredentials, OrganizationMembership, RoleAssignment, User } from "@/types/auth";

const ROLES_STORAGE_KEY = "cloudguest_roles";
const ORGS_STORAGE_KEY = "cloudguest_organizations";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** The minimal slice of auth state pushed into TanStack Router's context so
 * `beforeLoad` guards can read it outside React. */
export interface RouterAuthContext {
  status: AuthStatus;
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

function persistSession(session: AuthSession) {
  localStorage.setItem(TOKEN_STORAGE_KEY, session.tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.tokens.refreshToken);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(session.roles));
  localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(session.organizations));
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(ROLES_STORAGE_KEY);
  localStorage.removeItem(ORGS_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
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
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
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
    // Demo mode: bypass backend if using test credentials
    if (creds.email === "admin@example.com" && creds.password === "test") {
      const demoSession: AuthSession = {
        user: {
          id: "u-001",
          firstName: "Admin",
          lastName: "User",
          name: "Admin User",
          email: creds.email,
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
          { roleId: "r-001", roleName: "Super Admin", roleSlug: "super-admin", scopeType: "global", isActive: true },
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
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    try {
      await authService.logout(refreshToken);
    } catch {
      // Best-effort revoke — always clear local session regardless.
    }
    clearStoredSession();
    setUser(null);
    setRoles([]);
    setOrganizations([]);
    setPermissions(new Set());
    setStatus("anonymous");
  }, []);

  const can = useCallback((permission: string) => permissions.has(permission), [permissions]);

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
    }),
    [user, roles, organizations, status, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
