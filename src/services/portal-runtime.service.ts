import { guestPortalApi } from "@/services/guest-portal-api";
import type {
  RuntimeAuthMethod,
  RuntimeLanguage,
  RuntimePortalConfig,
  RuntimeSession,
} from "@/types/portal-runtime";

const SUPPORTED_LANGUAGES: RuntimeLanguage[] = ["en", "hi", "ar", "fr", "es"];

function toRuntimeLanguage(v: string): RuntimeLanguage {
  return (SUPPORTED_LANGUAGES as string[]).includes(v) ? (v as RuntimeLanguage) : "en";
}

interface BackendCaptivePortalConfig {
  id: string;
  name: string;
  theme: "light" | "dark" | "custom";
  logo_url: string | null;
  background_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  default_language: string;
  supported_languages: string[];
  advertisement_banner_url: string | null;
  advertisement_banner_link: string | null;
  terms_and_conditions_text: string | null;
  terms_and_conditions_url: string | null;
  privacy_policy_text: string | null;
  privacy_policy_url: string | null;
  splash_headline: string | null;
  splash_welcome_message: string | null;
  redirect_url: string | null;
  otp_sms_enabled: boolean;
  otp_email_enabled: boolean;
  resolved_via_location_override: boolean;
}

interface BackendOtpRequestResponse {
  id: string;
  identifier: string;
  channel: string;
  purpose: string;
  expires_at: string;
  created_at: string;
}

interface BackendGuestDevice {
  id: string;
  guest_id: string;
  mac_address: string | null;
  device_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface BackendGuestSession {
  id: string;
  guest_id: string;
  device_id: string | null;
  router_id: string;
  location_id: string;
  organization_id: string;
  auth_method: RuntimeAuthMethod;
  status: string;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  ip_address: string | null;
  bytes_uploaded: number;
  bytes_downloaded: number;
  data_limit_mb: number | null;
  session_timeout_minutes: number | null;
}

interface BackendGuestLoginResponse {
  guest_id: string;
  identifier: string;
  is_new_guest: boolean;
  session: BackendGuestSession;
  device: BackendGuestDevice | null;
}

function toRuntimeConfig(c: BackendCaptivePortalConfig): RuntimePortalConfig {
  return {
    id: c.id,
    name: c.name,
    theme: c.theme,
    logoUrl: c.logo_url,
    backgroundImageUrl: c.background_image_url,
    primaryColor: c.primary_color,
    secondaryColor: c.secondary_color,
    defaultLanguage: toRuntimeLanguage(c.default_language),
    supportedLanguages: c.supported_languages.map(toRuntimeLanguage),
    advertisementBannerUrl: c.advertisement_banner_url,
    advertisementBannerLink: c.advertisement_banner_link,
    termsAndConditionsText: c.terms_and_conditions_text,
    termsAndConditionsUrl: c.terms_and_conditions_url,
    privacyPolicyText: c.privacy_policy_text,
    privacyPolicyUrl: c.privacy_policy_url,
    splashHeadline: c.splash_headline,
    splashWelcomeMessage: c.splash_welcome_message,
    redirectUrl: c.redirect_url,
    otpSmsEnabled: c.otp_sms_enabled,
    otpEmailEnabled: c.otp_email_enabled,
    resolvedViaLocationOverride: c.resolved_via_location_override,
  };
}

function toRuntimeSession(data: BackendGuestLoginResponse): RuntimeSession {
  const s = data.session;
  return {
    guestId: data.guest_id,
    sessionId: s.id,
    deviceId: s.device_id,
    routerId: s.router_id,
    locationId: s.location_id,
    organizationId: s.organization_id,
    authMethod: s.auth_method,
    status: s.status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    lastActivityAt: s.last_activity_at,
    ipAddress: s.ip_address,
    bytesUploaded: s.bytes_uploaded,
    bytesDownloaded: s.bytes_downloaded,
    dataLimitMb: s.data_limit_mb,
    sessionTimeoutMinutes: s.session_timeout_minutes,
    isNewGuest: data.is_new_guest,
    deviceMacAddress: data.device?.mac_address ?? null,
    deviceName: data.device?.device_name ?? null,
  };
}

export const portalRuntimeService = {
  async resolveConfig(params: {
    organizationId: string;
    locationId: string;
  }): Promise<RuntimePortalConfig> {
    const { data } = await guestPortalApi.get<BackendCaptivePortalConfig>(
      "/captive-portal/resolve",
      {
        params: { organization_id: params.organizationId, location_id: params.locationId },
      },
    );
    return toRuntimeConfig(data);
  },

  async requestOtp(params: {
    identifier: string;
    channel: "sms" | "email";
    organizationId: string;
    locationId: string;
  }): Promise<void> {
    await guestPortalApi.post<BackendOtpRequestResponse>("/otp/request", {
      identifier: params.identifier,
      channel: params.channel,
      purpose: "guest_login",
      organization_id: params.organizationId,
      location_id: params.locationId,
    });
  },

  async loginWithOtp(params: {
    identifier: string;
    code: string;
    authMethod: RuntimeAuthMethod;
    organizationId: string;
    locationId: string;
    routerId: string;
    deviceMac?: string;
  }): Promise<RuntimeSession> {
    const { data } = await guestPortalApi.post<BackendGuestLoginResponse>("/guest/login/otp", {
      identifier: params.identifier,
      code: params.code,
      auth_method: params.authMethod,
      organization_id: params.organizationId,
      location_id: params.locationId,
      router_id: params.routerId,
      device_mac: params.deviceMac,
    });
    return toRuntimeSession(data);
  },

  async recordConsent(params: {
    guestId: string;
    captivePortalConfigId?: string;
    termsVersion?: string;
  }): Promise<void> {
    await guestPortalApi.post("/guest/consent", {
      guest_id: params.guestId,
      captive_portal_config_id: params.captivePortalConfigId,
      terms_version: params.termsVersion,
    });
  },
};
