import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService } from "@/services/auth.service";
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "@/services/api";
import type { AuthSession, LoginCredentials, User, UserRole } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (creds: LoginCredentials) => Promise<AuthSession>;
  logout: () => void;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_STORAGE_KEY);
      const u = localStorage.getItem(USER_STORAGE_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u) as User);
      }
    } catch {
      // ignore
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = useCallback(async (creds: LoginCredentials) => {
    const session = await authService.login(creds);
    localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
    setToken(session.token);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]) => {
      if (!user) return false;
      const list = Array.isArray(roles) ? roles : [roles];
      return list.includes(user.role);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      role: user?.role ?? null,
      isAuthenticated: !!user && !!token,
      isReady,
      login,
      logout,
      hasRole,
    }),
    [user, token, isReady, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
