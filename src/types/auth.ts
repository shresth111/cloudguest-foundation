export type UserRole =
  | "super_admin"
  | "org_admin"
  | "location_manager"
  | "support_engineer"
  | "read_only";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  organization?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}
