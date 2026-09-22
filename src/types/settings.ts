export interface GeneralSettings {
  platformName: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  defaultLanguage: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
}

export interface AuthSettings {
  emailLogin: boolean;
  mobileOtp: boolean;
  emailOtp: boolean;
  voucherLogin: boolean;
  pmsLogin: boolean;
  socialLogin: boolean;
  qrLogin: boolean;
  sessionTimeoutMinutes: number;
  rememberLogin: boolean;
  passwordExpiryDays: number;
  maxLoginAttempts: number;
}

export interface SecuritySettings {
  forceHttps: boolean;
  twoFactor: boolean;
  ipWhitelist: string[];
  ipBlacklist: string[];
  deviceTrust: boolean;
  passwordComplexity: "low" | "medium" | "high";
  captcha: boolean;
  auditLogging: boolean;
}

/**
 * NOTE: there is no `slackWebhookUrl`/`webhookEndpoint` here any more, and
 * adding one back would be a mistake. Those two fields were bound to inputs
 * on the Notifications settings panel whose "save" was an in-memory mock, so
 * an operator could paste a bearer-equivalent Slack webhook URL, be told it
 * was saved, and have it silently discarded.
 *
 * A real alert destination is a `NotificationChannel`
 * (`POST /api/v1/notifications/channels`): encrypted at rest, scoped to an
 * organization, delivery-logged, and testable. See
 * `components/settings/panels/NotificationsPanel.tsx`.
 */
export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
  browser: boolean;
  slack: boolean;
  webhooks: boolean;
}

export type EmailProvider = "aws_ses" | "smtp" | "sendgrid" | "mailgun";
export interface EmailSettings {
  provider: EmailProvider;
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  connectionStatus: "connected" | "disconnected" | "unknown";
  lastTestedAt?: string;
}

export type SmsProvider = "msg91" | "twilio" | "aws_sns";
export interface SmsSettings {
  provider: SmsProvider;
  apiKey: string;
  senderId: string;
  templateId: string;
  connectionStatus: "connected" | "disconnected" | "unknown";
  lastTestedAt?: string;
}

export type StorageProvider = "aws_s3" | "local";
export interface StorageSettings {
  provider: StorageProvider;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  usageGb: number;
  quotaGb: number;
  connectionStatus: "connected" | "disconnected" | "unknown";
}

export interface IntegrationCard {
  id: string;
  name: string;
  category: "network" | "pms" | "payment" | "ai";
  description: string;
  status: "connected" | "disconnected" | "error";
  configured: boolean;
}

export type PaymentProvider = "stripe" | "razorpay" | "paypal";
export interface PaymentSettings {
  provider: PaymentProvider;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  currency: string;
  taxPercent: number;
  autoInvoice: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
  scopes: string[];
}
export interface ApiSettings {
  keys: ApiKey[];
  webhookUrl: string;
  rateLimitPerMinute: number;
  callsToday: number;
  callsMonth: number;
  errorsToday: number;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  debugMode: boolean;
  autoRefresh: boolean;
  logRetentionDays: number;
  ntpServer: string;
  lastCacheClearAt?: string;
}

export interface BackupEntry {
  id: string;
  createdAt: string;
  sizeMb: number;
  type: "manual" | "scheduled";
  status: "success" | "failed";
}
export interface BackupSettings {
  schedule: "hourly" | "daily" | "weekly" | "monthly";
  lastBackupAt?: string;
  nextBackupAt?: string;
  history: BackupEntry[];
}

export interface FeatureFlags {
  whiteLabel: boolean;
  aiAssistant: boolean;
  analytics: boolean;
  billing: boolean;
  pms: boolean;
  qrLogin: boolean;
  voucherLogin: boolean;
  socialLogin: boolean;
  monitoring: boolean;
  auditLogs: boolean;
}

export interface LicenseInfo {
  plan: "starter" | "growth" | "enterprise";
  licenseKey: string;
  activatedFeatures: string[];
  organizationLimit: number;
  routerLimit: number;
  guestLimit: number;
  expiryDate: string;
}

export interface AboutInfo {
  platformVersion: string;
  buildNumber: string;
  environment: "development" | "staging" | "production";
  reactVersion: string;
  apiVersion: string;
  databaseVersion: string;
  redisVersion: string;
  licenseNotice: string;
}

export interface PlatformSettings {
  general: GeneralSettings;
  auth: AuthSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  email: EmailSettings;
  sms: SmsSettings;
  storage: StorageSettings;
  integrations: IntegrationCard[];
  payment: PaymentSettings;
  api: ApiSettings;
  system: SystemSettings;
  backup: BackupSettings;
  featureFlags: FeatureFlags;
  license: LicenseInfo;
  about: AboutInfo;
  updatedAt: string;
}

export type SettingsSectionId =
  | "general"
  | "branding"
  | "authentication"
  | "security"
  | "notifications"
  | "email"
  | "sms"
  | "storage"
  | "integrations"
  | "payment"
  | "api"
  | "system"
  | "backup"
  | "feature_flags"
  | "license"
  | "about";
