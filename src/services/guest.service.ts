import type {
  AccessPolicy,
  BlacklistEntry,
  DeviceType,
  Guest,
  GuestAnalyticsData,
  GuestDevice,
  GuestKpis,
  GuestSession,
  GuestStatus,
  GuestType,
  LoginMethod,
  LoginMethodConfig,
  SessionListQuery,
  SessionListResult,
  SignalStrength,
  WhitelistEntry,
} from "@/types/guest";

const FIRST = ["Alex", "Priya", "Chen", "Sara", "Diego", "Yuki", "Amara", "Noah", "Lena", "Omar", "Ivy", "Rohan", "Mira", "Kai", "Zara", "Leo"];
const LAST = ["Wong", "Sharma", "Nakamura", "Ali", "Silva", "Kim", "Okafor", "Brown", "Rossi", "Haddad", "Chen", "Patel", "Lopez", "Ng", "Cohen", "Ivanov"];
const ORGS: Array<[string, string]> = [
  ["ORG-01000", "Nimbus Hospitality"],
  ["ORG-01001", "Vertex Retail"],
  ["ORG-01002", "Halo Group"],
  ["ORG-01003", "Orbit Holdings"],
  ["ORG-01004", "Lumen Ventures"],
];
const LOCATIONS: Array<[string, string]> = [
  ["LOC-02000", "Nimbus San Francisco Downtown"],
  ["LOC-02001", "Vertex New York Central"],
  ["LOC-02002", "Halo London Airport"],
  ["LOC-02003", "Orbit Bengaluru Plaza"],
  ["LOC-02004", "Lumen Singapore Riverside"],
  ["LOC-02005", "Cascade Dubai Mall"],
];
const ROUTERS: Array<[string, string]> = [
  ["RTR-03000", "SFO-Lobby-01"],
  ["RTR-03001", "NYC-Floor2-A"],
  ["RTR-03002", "LON-T3-Gate12"],
  ["RTR-03003", "BLR-East-01"],
  ["RTR-03004", "SGP-Pool-01"],
];
const LOGIN_METHODS: LoginMethod[] = ["otp_mobile", "otp_email", "voucher", "pms", "social", "click_through"];
const GUEST_TYPES: GuestType[] = ["visitor", "customer", "hotel_guest", "employee", "student", "vip", "contractor"];
const DEVICE_TYPES: DeviceType[] = ["mobile", "laptop", "tablet", "desktop", "iot"];
const VENDORS = ["Apple", "Samsung", "Xiaomi", "Google", "Dell", "HP", "Lenovo", "OnePlus"];
const OSES = ["iOS 17.4", "Android 14", "macOS 15", "Windows 11", "iPadOS 17", "ChromeOS"];
const BROWSERS = ["Safari 17", "Chrome 126", "Firefox 128", "Edge 126"];
const SIGNALS: SignalStrength[] = ["excellent", "good", "good", "fair", "poor"];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seedRandom(4242);

function randomFrom<T>(arr: T[], r = rand): T {
  return arr[Math.floor(r() * arr.length)]!;
}

function randomMac(): string {
  const p = () => Math.floor(rand() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `${p()}:${p()}:${p()}:${p()}:${p()}:${p()}`;
}

function randomIp(): string {
  return `10.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${1 + Math.floor(rand() * 253)}`;
}

function generateGuests(count: number): Guest[] {
  const out: Guest[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 3) % LAST.length]!;
    const org = ORGS[i % ORGS.length]!;
    const loc = LOCATIONS[i % LOCATIONS.length]!;
    const gt = GUEST_TYPES[i % GUEST_TYPES.length]!;
    const lm = LOGIN_METHODS[i % LOGIN_METHODS.length]!;
    const created = new Date(Date.now() - Math.floor(rand() * 200) * 86400000);
    const lastLogin = new Date(Date.now() - Math.floor(rand() * 20) * 3600000);
    out.push({
      id: `GST-${String(50000 + i).padStart(6, "0")}`,
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + `@mail.com`,
      mobile: `+1-${200 + (i % 700)}-${1000 + (i * 7) % 9000}`,
      organizationId: org[0],
      organizationName: org[1],
      locationId: loc[0],
      locationName: loc[1],
      guestType: gt,
      loginMethod: lm,
      lastLogin: lastLogin.toISOString(),
      totalVisits: 1 + Math.floor(rand() * 40),
      totalSessions: 1 + Math.floor(rand() * 120),
      totalDataMb: Math.floor(rand() * 20000),
      status: (["online", "online", "offline", "offline", "blocked", "expired"] as GuestStatus[])[i % 6]!,
      createdAt: created.toISOString(),
    });
  }
  return out;
}

let GUESTS: Guest[] = generateGuests(120);

function generateSessions(guests: Guest[]): GuestSession[] {
  const out: GuestSession[] = [];
  guests.forEach((g, i) => {
    const sessionsPerGuest = 1 + Math.floor(rand() * 3);
    for (let s = 0; s < sessionsPerGuest; s++) {
      const router = ROUTERS[(i + s) % ROUTERS.length]!;
      const dt = DEVICE_TYPES[(i + s) % DEVICE_TYPES.length]!;
      const isActive = g.status === "online" && s === 0;
      const startedMinAgo = Math.floor(rand() * 600) + 1;
      const started = new Date(Date.now() - startedMinAgo * 60000);
      const duration = isActive ? startedMinAgo : Math.floor(rand() * 300) + 5;
      const status: GuestStatus = isActive ? "online" : g.status === "blocked" ? "blocked" : "offline";
      out.push({
        id: `SES-${String(700000 + out.length).padStart(7, "0")}`,
        guestId: g.id,
        guestName: g.name,
        mobile: g.mobile,
        email: g.email,
        loginMethod: g.loginMethod,
        guestType: g.guestType,
        organizationId: g.organizationId,
        organizationName: g.organizationName,
        locationId: g.locationId,
        locationName: g.locationName,
        routerId: router[0],
        routerName: router[1],
        apName: `AP-${(i + s) % 12}-${router[1].split("-")[1] ?? "A"}`,
        deviceId: `DEV-${String(400000 + out.length).padStart(6, "0")}`,
        deviceName: `${g.name.split(" ")[0]}'s ${dt === "mobile" ? "iPhone" : dt === "laptop" ? "MacBook" : dt === "tablet" ? "iPad" : "Device"}`,
        deviceType: dt,
        macAddress: randomMac(),
        ipAddress: randomIp(),
        connectedSince: started.toISOString(),
        sessionEnd: isActive ? undefined : new Date(started.getTime() + duration * 60000).toISOString(),
        durationMinutes: duration,
        downloadMb: Math.floor(rand() * 3000),
        uploadMb: Math.floor(rand() * 600),
        signal: SIGNALS[(i + s) % SIGNALS.length]!,
        status,
        disconnectReason: isActive ? undefined : randomFrom(["Session timeout", "Idle timeout", "User disconnect", "Admin disconnect", "Signal lost"]),
      });
    }
  });
  return out;
}

let SESSIONS: GuestSession[] = generateSessions(GUESTS);

function generateDevicesForGuest(guest: Guest): GuestDevice[] {
  const count = 1 + Math.floor(rand() * 3);
  const list: GuestDevice[] = [];
  for (let i = 0; i < count; i++) {
    const dt = DEVICE_TYPES[i % DEVICE_TYPES.length]!;
    list.push({
      id: `DEV-${guest.id}-${i}`,
      guestId: guest.id,
      name: `${guest.name.split(" ")[0]}'s ${dt === "mobile" ? "iPhone" : dt === "laptop" ? "MacBook" : dt === "tablet" ? "iPad" : "Device"}`,
      type: dt,
      mac: randomMac(),
      vendor: randomFrom(VENDORS),
      os: randomFrom(OSES),
      browser: randomFrom(BROWSERS),
      firstSeen: new Date(Date.now() - Math.floor(rand() * 200) * 86400000).toISOString(),
      lastSeen: new Date(Date.now() - Math.floor(rand() * 48) * 3600000).toISOString(),
      status: (["online", "offline", "offline"] as const)[i % 3]!,
    });
  }
  return list;
}

let BLACKLIST: BlacklistEntry[] = Array.from({ length: 14 }, (_, i) => {
  const g = GUESTS[(i * 5) % GUESTS.length]!;
  return {
    id: `BL-${String(9000 + i).padStart(5, "0")}`,
    guestId: g.id,
    guestName: g.name,
    mac: randomMac(),
    mobile: g.mobile,
    email: g.email,
    reason: randomFrom(["Abusive behaviour", "Bandwidth abuse", "Policy violation", "Requested by admin", "Suspicious activity"]),
    blockedAt: new Date(Date.now() - Math.floor(rand() * 60) * 86400000).toISOString(),
    expiresAt: rand() > 0.4 ? new Date(Date.now() + Math.floor(rand() * 60) * 86400000).toISOString() : undefined,
  };
});

let WHITELIST: WhitelistEntry[] = Array.from({ length: 10 }, (_, i) => {
  const g = GUESTS[(i * 7) % GUESTS.length]!;
  return {
    id: `WL-${String(6000 + i).padStart(5, "0")}`,
    guestId: g.id,
    guestName: g.name,
    mac: randomMac(),
    mobile: g.mobile,
    email: g.email,
    note: randomFrom(["Trusted VIP", "Employee laptop", "Front-desk kiosk", "Executive team", "Long-stay guest"]),
    addedAt: new Date(Date.now() - Math.floor(rand() * 90) * 86400000).toISOString(),
  };
});

let POLICIES: AccessPolicy[] = GUEST_TYPES.map((gt, i) => ({
  id: `POL-${String(500 + i).padStart(4, "0")}`,
  name: `${gt.replace("_", " ")} default policy`,
  guestType: gt,
  internetTimeLimitMin: [60, 120, 180, 240, 480, 1440][i % 6]!,
  dailyLimitMb: [500, 1000, 2000, 5000, 10000, 20000][i % 6]!,
  speedLimitKbps: [1024, 2048, 4096, 8192, 16384, 51200][i % 6]!,
  downloadLimitMb: [500, 1000, 2000, 5000, 10000, 20000][i % 6]!,
  uploadLimitMb: [200, 500, 1000, 2000, 4000, 8000][i % 6]!,
  deviceLimit: [1, 2, 3, 4, 5, 10][i % 6]!,
  sessionTimeoutMin: [60, 120, 240, 480, 720, 1440][i % 6]!,
  idleTimeoutMin: [5, 10, 15, 20, 30, 60][i % 6]!,
  updatedAt: new Date().toISOString(),
}));

let LOGIN_CONFIGS: LoginMethodConfig[] = [
  { method: "otp_mobile", enabled: true, description: "Guests receive a one-time password via SMS to sign in." },
  { method: "otp_email", enabled: true, description: "Guests receive a verification code via email." },
  { method: "voucher", enabled: true, description: "Pre-generated voucher codes handed out at the front desk." },
  { method: "pms", enabled: false, description: "Sync with Property Management System for hotel guests." },
  { method: "social", enabled: true, description: "Login with Google, Facebook, LinkedIn, Apple, etc." },
  { method: "click_through", enabled: false, description: "One-tap consent-only access without collecting details." },
];

function delay<T>(v: T, ms = 250): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

function computeKpis(): GuestKpis {
  const activeSessions = SESSIONS.filter((s) => s.status === "online");
  const now = Date.now();
  const todays = SESSIONS.filter((s) => now - new Date(s.connectedSince).getTime() < 86400000);
  const totalMs = SESSIONS.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalBw = SESSIONS.reduce((sum, s) => sum + s.downloadMb + s.uploadMb, 0);
  return {
    totalGuests: GUESTS.length,
    activeGuests: GUESTS.filter((g) => g.status === "online").length,
    onlineUsers: activeSessions.length,
    todaysLogins: todays.length,
    otpLogins: todays.filter((s) => s.loginMethod === "otp_mobile" || s.loginMethod === "otp_email").length,
    voucherLogins: todays.filter((s) => s.loginMethod === "voucher").length,
    socialLogins: todays.filter((s) => s.loginMethod === "social").length,
    pmsLogins: todays.filter((s) => s.loginMethod === "pms").length,
    avgSessionMin: SESSIONS.length ? Math.round(totalMs / SESSIONS.length) : 0,
    totalBandwidthGb: Math.round(totalBw / 1024),
  };
}

function computeAnalytics(): GuestAnalyticsData {
  const days = 14;
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    return {
      date: d.toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
      guests: 40 + Math.floor(rand() * 120),
      sessions: 80 + Math.floor(rand() * 260),
    };
  });
  const methodDist = LOGIN_METHODS.map((m) => ({
    method: m,
    value: SESSIONS.filter((s) => s.loginMethod === m).length,
  }));
  const deviceTypes = DEVICE_TYPES.map((d) => ({
    name: d,
    value: SESSIONS.filter((s) => s.deviceType === d).length,
  }));
  const topLocations = LOCATIONS.map(([id, name]) => ({
    name,
    guests: SESSIONS.filter((s) => s.locationId === id).length,
  })).sort((a, b) => b.guests - a.guests).slice(0, 6);
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    logins: Math.floor(20 + Math.abs(Math.sin(h / 3.5)) * 220 + rand() * 40),
  }));
  const bandwidth = daily.map((d) => ({
    date: d.date,
    downloadGb: 20 + Math.floor(rand() * 200),
    uploadGb: 5 + Math.floor(rand() * 60),
  }));
  const totalReturning = GUESTS.filter((g) => g.totalVisits > 1).length;
  return {
    dailyGuests: daily,
    loginMethodDist: methodDist,
    returningVsNew: [
      { name: "Returning", value: totalReturning },
      { name: "New", value: GUESTS.length - totalReturning },
    ],
    deviceTypes,
    topLocations,
    peakHours,
    bandwidth,
  };
}

export const guestService = {
  async kpis(): Promise<GuestKpis> {
    return delay(computeKpis());
  },

  async analytics(): Promise<GuestAnalyticsData> {
    return delay(computeAnalytics());
  },

  async listGuests(): Promise<Guest[]> {
    return delay([...GUESTS], 200);
  },

  async getGuest(id: string): Promise<Guest | null> {
    return delay(GUESTS.find((g) => g.id === id) ?? null);
  },

  async listSessions(q: SessionListQuery): Promise<SessionListResult> {
    let rows = [...SESSIONS];
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.guestName.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          r.mobile.includes(s) ||
          r.macAddress.toLowerCase().includes(s) ||
          r.ipAddress.includes(s) ||
          r.deviceName.toLowerCase().includes(s),
      );
    }
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.loginMethod && q.loginMethod !== "all") rows = rows.filter((r) => r.loginMethod === q.loginMethod);
    if (q.locationId && q.locationId !== "all") rows = rows.filter((r) => r.locationId === q.locationId);
    if (q.deviceType && q.deviceType !== "all") rows = rows.filter((r) => r.deviceType === q.deviceType);
    if (q.sortBy) {
      const dir = q.sortDir === "desc" ? -1 : 1;
      const key = q.sortBy;
      rows.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av == null || bv == null) return 0;
        return av > bv ? dir : av < bv ? -dir : 0;
      });
    }
    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;
    rows = rows.slice(start, start + q.pageSize);
    return delay({ rows, total });
  },

  async sessionsForGuest(guestId: string): Promise<GuestSession[]> {
    return delay(SESSIONS.filter((s) => s.guestId === guestId));
  },

  async devicesForGuest(guestId: string): Promise<GuestDevice[]> {
    const g = GUESTS.find((x) => x.id === guestId);
    if (!g) return delay([]);
    return delay(generateDevicesForGuest(g));
  },

  async disconnectSessions(ids: string[]): Promise<void> {
    SESSIONS = SESSIONS.map((s) =>
      ids.includes(s.id)
        ? {
            ...s,
            status: "offline",
            sessionEnd: new Date().toISOString(),
            disconnectReason: "Admin disconnect",
          }
        : s,
    );
    return delay(undefined, 300);
  },

  async extendSession(id: string, minutes: number): Promise<void> {
    SESSIONS = SESSIONS.map((s) =>
      s.id === id ? { ...s, durationMinutes: s.durationMinutes + minutes } : s,
    );
    return delay(undefined, 200);
  },

  async blockGuests(ids: string[], reason: string): Promise<void> {
    const now = new Date().toISOString();
    ids.forEach((id) => {
      const guest = GUESTS.find((g) => g.id === id);
      if (!guest) return;
      if (!BLACKLIST.some((b) => b.guestId === id)) {
        BLACKLIST = [
          {
            id: `BL-${String(9000 + BLACKLIST.length).padStart(5, "0")}`,
            guestId: id,
            guestName: guest.name,
            mac: randomMac(),
            mobile: guest.mobile,
            email: guest.email,
            reason,
            blockedAt: now,
          },
          ...BLACKLIST,
        ];
      }
    });
    GUESTS = GUESTS.map((g) => (ids.includes(g.id) ? { ...g, status: "blocked" as const } : g));
    SESSIONS = SESSIONS.map((s) =>
      ids.includes(s.guestId) ? { ...s, status: "blocked" as const, sessionEnd: now, disconnectReason: "Blocked" } : s,
    );
    return delay(undefined, 300);
  },

  async resetGuestAccess(id: string): Promise<void> {
    GUESTS = GUESTS.map((g) => (g.id === id ? { ...g, status: "offline" as const } : g));
    return delay(undefined, 200);
  },

  async sendMessage(_id: string, _channel: "sms" | "email", _body: string): Promise<void> {
    return delay(undefined, 300);
  },

  async listBlacklist(): Promise<BlacklistEntry[]> {
    return delay([...BLACKLIST]);
  },

  async addBlacklist(entry: Omit<BlacklistEntry, "id" | "blockedAt">): Promise<BlacklistEntry> {
    const created: BlacklistEntry = {
      ...entry,
      id: `BL-${String(9000 + BLACKLIST.length).padStart(5, "0")}`,
      blockedAt: new Date().toISOString(),
    };
    BLACKLIST = [created, ...BLACKLIST];
    return delay(created, 300);
  },

  async removeBlacklist(ids: string[]): Promise<void> {
    BLACKLIST = BLACKLIST.filter((b) => !ids.includes(b.id));
    return delay(undefined, 300);
  },

  async listWhitelist(): Promise<WhitelistEntry[]> {
    return delay([...WHITELIST]);
  },

  async addWhitelist(entry: Omit<WhitelistEntry, "id" | "addedAt">): Promise<WhitelistEntry> {
    const created: WhitelistEntry = {
      ...entry,
      id: `WL-${String(6000 + WHITELIST.length).padStart(5, "0")}`,
      addedAt: new Date().toISOString(),
    };
    WHITELIST = [created, ...WHITELIST];
    return delay(created, 300);
  },

  async removeWhitelist(ids: string[]): Promise<void> {
    WHITELIST = WHITELIST.filter((w) => !ids.includes(w.id));
    return delay(undefined, 300);
  },

  async listPolicies(): Promise<AccessPolicy[]> {
    return delay([...POLICIES]);
  },

  async updatePolicy(id: string, patch: Partial<AccessPolicy>): Promise<AccessPolicy | null> {
    POLICIES = POLICIES.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
    return delay(POLICIES.find((p) => p.id === id) ?? null);
  },

  async listLoginMethods(): Promise<LoginMethodConfig[]> {
    return delay([...LOGIN_CONFIGS]);
  },

  async toggleLoginMethod(method: LoginMethod, enabled: boolean): Promise<void> {
    LOGIN_CONFIGS = LOGIN_CONFIGS.map((c) => (c.method === method ? { ...c, enabled } : c));
    return delay(undefined, 200);
  },

  locations() {
    return LOCATIONS.map(([id, name]) => ({ id, name }));
  },

  organizations() {
    return ORGS.map(([id, name]) => ({ id, name }));
  },
};
