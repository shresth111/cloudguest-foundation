import type { AuthSession, LoginCredentials, User, UserRole } from "@/types/auth";

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  "super@cloudguest.io": {
    password: "password",
    user: {
      id: "u_1",
      name: "Alex Morgan",
      email: "super@cloudguest.io",
      role: "super_admin",
      organization: "CloudGuest HQ",
    },
  },
  "admin@cloudguest.io": {
    password: "password",
    user: {
      id: "u_2",
      name: "Priya Shah",
      email: "admin@cloudguest.io",
      role: "org_admin",
      organization: "Acme Hotels",
    },
  },
  "manager@cloudguest.io": {
    password: "password",
    user: {
      id: "u_3",
      name: "Diego Ramirez",
      email: "manager@cloudguest.io",
      role: "location_manager",
      organization: "Acme Hotels – Downtown",
    },
  },
  "support@cloudguest.io": {
    password: "password",
    user: {
      id: "u_4",
      name: "Yuki Tanaka",
      email: "support@cloudguest.io",
      role: "support_engineer",
      organization: "CloudGuest Support",
    },
  },
  "viewer@cloudguest.io": {
    password: "password",
    user: {
      id: "u_5",
      name: "Sam Lee",
      email: "viewer@cloudguest.io",
      role: "read_only",
      organization: "Acme Hotels",
    },
  },
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeToken(userId: string): string {
  return `mock.${userId}.${Math.random().toString(36).slice(2)}`;
}

export const authService = {
  async login(creds: LoginCredentials): Promise<AuthSession> {
    await delay(700);
    const record = MOCK_USERS[creds.email.toLowerCase()];
    if (!record || record.password !== creds.password) {
      throw new Error("Invalid email or password");
    }
    return {
      user: record.user,
      token: makeToken(record.user.id),
      expiresAt: Date.now() + 1000 * 60 * 60 * 8,
    };
  },
  async forgotPassword(email: string): Promise<void> {
    await delay(600);
    if (!email.includes("@")) throw new Error("Invalid email");
  },
  async resetPassword(_token: string, password: string): Promise<void> {
    await delay(600);
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
  },
  async verifyOtp(code: string): Promise<void> {
    await delay(500);
    if (code !== "123456") throw new Error("Invalid verification code");
  },
  async resendOtp(): Promise<void> {
    await delay(400);
  },
  listDemoAccounts(): { email: string; role: UserRole }[] {
    return Object.values(MOCK_USERS).map((u) => ({ email: u.user.email, role: u.user.role }));
  },
};
