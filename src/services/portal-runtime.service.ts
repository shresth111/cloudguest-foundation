import type {
  RuntimeAdSlot,
  RuntimePortalConfig,
  RuntimeSession,
} from "@/types/portal-runtime";

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

const CONFIG: RuntimePortalConfig = {
  brand: {
    brandId: "brand-nimbus",
    companyName: "Nimbus Hospitality",
    venueName: "Nimbus San Francisco Downtown",
    wifiSsid: "Nimbus-Guest",
    logoText: "N",
    welcomeTitle: "Welcome to Nimbus",
    welcomeMessage:
      "Enjoy complimentary high-speed internet during your stay. Sign in below to get connected.",
    termsSummary:
      "By connecting you agree to our fair-use policy, terms of service, and privacy policy.",
    primaryColor: "#0EA5E9",
    accentColor: "#6366F1",
    backgroundFrom: "#0F172A",
    backgroundTo: "#1E293B",
    fontFamily: "Inter, system-ui, sans-serif",
    radius: 18,
    heroImage:
      "radial-gradient(1200px 600px at 20% 0%, rgba(14,165,233,0.35), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(99,102,241,0.35), transparent 60%)",
    supportEmail: "help@nimbus.example",
    supportPhone: "+1 (555) 010-2200",
  },
  enabledMethods: [
    "mobile_otp",
    "email_otp",
    "voucher",
    "pms",
    "social",
    "qr",
    "click_through",
  ],
  defaultLanguage: "en",
  languages: ["en", "hi", "ar", "fr", "es"],
  sessionMinutes: 120,
  dataLimitMb: 2048,
  adEnabled: true,
  adSkipSeconds: 5,
  redirectUrl: "https://www.nimbus.example/welcome",
  redirectDelaySeconds: 5,
  requireTerms: true,
  socialProviders: ["google", "facebook", "apple", "microsoft"],
};

const ADS: RuntimeAdSlot[] = [
  {
    id: "ad-1",
    title: "20% off in-room dining tonight",
    description: "Order from our chef's tasting menu with promo code STAY20.",
    cta: "See menu",
    ctaUrl: "#",
    imageColor: "linear-gradient(135deg,#0EA5E9,#6366F1)",
  },
  {
    id: "ad-2",
    title: "Spa & wellness — book a slot",
    description: "Complimentary sauna access with any 60-minute treatment.",
    cta: "Book now",
    ctaUrl: "#",
    imageColor: "linear-gradient(135deg,#F59E0B,#EF4444)",
  },
  {
    id: "ad-3",
    title: "Late checkout available",
    description: "Extend your stay until 2 PM for a flat $25.",
    cta: "Add to stay",
    ctaUrl: "#",
    imageColor: "linear-gradient(135deg,#10B981,#0EA5E9)",
  },
];

export const portalRuntimeService = {
  async getConfig(): Promise<RuntimePortalConfig> {
    await delay(600);
    return CONFIG;
  },
  async getAds(): Promise<RuntimeAdSlot[]> {
    await delay(250);
    return ADS;
  },
  async sendOtp(target: string): Promise<{ ok: true; expiresIn: number }> {
    await delay(700);
    if (!target || target.length < 3) throw new Error("Invalid destination");
    return { ok: true, expiresIn: 60 };
  },
  async verifyOtp(code: string): Promise<{ ok: boolean }> {
    await delay(600);
    if (code === "0000") throw new Error("OTP expired");
    if (code.length !== 6) throw new Error("Enter the 6-digit code");
    if (code === "111111") throw new Error("Incorrect code, try again");
    return { ok: true };
  },
  async redeemVoucher(code: string): Promise<{ ok: boolean; minutes: number }> {
    await delay(600);
    if (!code || code.length < 4) throw new Error("Enter a valid voucher");
    if (code.toUpperCase() === "INVALID") throw new Error("Voucher not found");
    return { ok: true, minutes: 120 };
  },
  async pmsLogin(room: string, lastName: string): Promise<{ ok: boolean }> {
    await delay(700);
    if (!room || !lastName) throw new Error("Room and last name required");
    if (room === "0") throw new Error("Guest not found for this room");
    return { ok: true };
  },
  async socialLogin(provider: string): Promise<{ ok: boolean }> {
    await delay(800);
    if (provider === "fail") throw new Error("Social login failed");
    return { ok: true };
  },
  async createSession(): Promise<RuntimeSession> {
    await delay(400);
    const now = Date.now();
    return {
      sessionId: `SES-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      startedAt: now,
      expiresAt: now + CONFIG.sessionMinutes * 60 * 1000,
      device: navigator.userAgent.includes("Mobile") ? "iPhone 15" : "MacBook Pro",
      ipAddress: "10.42.18.114",
      macAddress: "A4:83:E7:22:1F:CD",
      bytesUsed: Math.floor(Math.random() * 200) * 1024 * 1024,
      bytesLimit: CONFIG.dataLimitMb * 1024 * 1024,
    };
  },
};
