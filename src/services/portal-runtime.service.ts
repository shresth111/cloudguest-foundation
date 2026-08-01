import { guestPortalApi } from "@/services/guest-portal-api";
import type {
  RuntimeAuthMethod,
  RuntimeLanguage,
  RuntimePortalConfig,
  RuntimeSession,
  RuntimeSessionAuthMethod,
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
  username_password_enabled: boolean;
  voucher_enabled: boolean;
  resolved_via_location_override: boolean;
  is_open_now: boolean;
  business_hours_closed_message: string | null;
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
  auth_method: RuntimeSessionAuthMethod;
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
  has_password: boolean;
  session: BackendGuestSession;
  device: BackendGuestDevice | null;
}

interface BackendGuestTeamMember {
  id: string;
  team_id: string;
  guest_id: string;
  joined_at: string;
  is_active: boolean;
  left_at: string | null;
  removal_reason: string | null;
}

interface BackendGuestTeamJoinResponse {
  team_id: string;
  guest_id: string;
  identifier: string;
  is_new_guest: boolean;
  is_new_membership: boolean;
  membership: BackendGuestTeamMember;
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
    usernamePasswordEnabled: c.username_password_enabled,
    voucherEnabled: c.voucher_enabled,
    resolvedViaLocationOverride: c.resolved_via_location_override,
    isOpenNow: c.is_open_now,
    businessHoursClosedMessage: c.business_hours_closed_message,
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
    hasPassword: data.has_password,
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

  /** Real "is this device already connected?" check -- called on portal
   * load when the browser has no locally-persisted session (a fresh tab,
   * a re-scanned QR code, a re-opened captive-portal redirect) but the
   * device's own MAC (RouterOS's trustworthy `$(mac)`) might still have a
   * live, RADIUS-authorized session on this router. Returns `null` -- not
   * an error -- for a normal first-time visit. */
  async checkActiveSession(params: {
    routerId: string;
    deviceMac: string;
  }): Promise<RuntimeSession | null> {
    const { data } = await guestPortalApi.get<BackendGuestLoginResponse | null>(
      "/guest/session/active",
      { params: { router_id: params.routerId, device_mac: params.deviceMac } },
    );
    return data ? toRuntimeSession(data) : null;
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

  /** Voucher-code login -- ``code`` mirrors the real batch-issued voucher
   * codes shown in ``VoucherManagement``/``VouchersPage``; ``identifier`` is
   * the guest's own phone/email, exactly like an OTP login, used to create
   * or look up their guest record (see the real
   * ``GuestService.login_via_voucher``'s own docstring -- a voucher
   * authenticates the *connection*, not a pre-existing identity, so the
   * guest still supplies who they are alongside the code). */
  async loginWithVoucher(params: {
    code: string;
    identifier: string;
    organizationId: string;
    locationId: string;
    routerId: string;
    deviceMac?: string;
  }): Promise<RuntimeSession> {
    const { data } = await guestPortalApi.post<BackendGuestLoginResponse>("/guest/login/voucher", {
      code: params.code,
      identifier: params.identifier,
      organization_id: params.organizationId,
      location_id: params.locationId,
      router_id: params.routerId,
      device_mac: params.deviceMac,
    });
    return toRuntimeSession(data);
  },

  async loginWithPassword(params: {
    identifier: string;
    password: string;
    organizationId: string;
    locationId: string;
    routerId: string;
    deviceMac?: string;
  }): Promise<RuntimeSession> {
    const { data } = await guestPortalApi.post<BackendGuestLoginResponse>("/guest/login/password", {
      identifier: params.identifier,
      password: params.password,
      organization_id: params.organizationId,
      location_id: params.locationId,
      router_id: params.routerId,
      device_mac: params.deviceMac,
    });
    return toRuntimeSession(data);
  },

  /** The "set a password for next time?" prompt, right after a real OTP
   * login -- ``sessionId`` is that same OTP login's own ``session.id`` (the
   * only thing authenticating this call server-side; see
   * ``app.domains.guest.service.GuestService.set_guest_password``'s own
   * docstring). Returns nothing on success; a weak password/ineligible
   * session both surface as a normal thrown ``AppError`` the caller can
   * show inline. */
  async setPassword(params: {
    guestId: string;
    sessionId: string;
    password: string;
  }): Promise<void> {
    await guestPortalApi.post("/guest/set-password", {
      guest_id: params.guestId,
      session_id: params.sessionId,
      password: params.password,
    });
  },

  /** Guest-initiated disconnect, from the success screen's real
   * "Disconnect" button -- the guest-facing counterpart to the admin-only
   * `POST /guest-sessions/{id}/disconnect` (see
   * `GuestService.disconnect_own_session`'s docstring for the real backend
   * addition this required and how `guestId`/`sessionId` authenticate the
   * call). Sends a real RADIUS CoA-Disconnect, not just a client-side
   * "forget the session" no-op. */
  async disconnectSession(params: {
    guestId: string;
    sessionId: string;
    reason?: string;
  }): Promise<void> {
    await guestPortalApi.post("/guest/session/disconnect", {
      guest_id: params.guestId,
      session_id: params.sessionId,
      reason: params.reason,
    });
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

  /** The skippable "tell us about yourself" prompt shown once, right after
   * a brand-new guest's first mobile-OTP login -- `guestId`/`sessionId` are
   * the exact same proof-of-just-completed-OTP-session pair
   * `setGuestPassword` would use, from the `RuntimeSession` that same OTP
   * login just returned. Never blocks network access -- the caller only
   * invokes this if the guest actually filled something in. */
  async updateGuestProfile(params: {
    guestId: string;
    sessionId: string;
    displayName?: string;
    email?: string;
  }): Promise<void> {
    await guestPortalApi.post("/guest/profile", {
      guest_id: params.guestId,
      session_id: params.sessionId,
      display_name: params.displayName || undefined,
      email: params.email || undefined,
    });
  },

  /** Guest-initiated "join a team" -- `POST /guest-teams/join`
   * (`GuestTeamService.join_team`), the real no-RBAC guest-facing endpoint
   * an admin's generated `teamCode` (GuestTeamManagement.tsx) is meant to
   * be redeemed against. `identifier` is deliberately the *same* real
   * phone/email `guestIdentifier` this browsing session already proved
   * ownership of via OTP/password/voucher (see PortalRuntimeState's own
   * docstring) -- this call never re-proves identity, it only attaches an
   * already-authenticated guest to a team. Idempotent on the backend
   * (`is_new_membership: false` if already a member) rather than erroring,
   * surfaced here as a distinct, still-successful outcome rather than a
   * generic error. */
  async joinTeam(params: {
    teamCode: string;
    identifier: string;
    deviceMac?: string;
    deviceName?: string;
  }): Promise<{ isNewMembership: boolean }> {
    const { data } = await guestPortalApi.post<BackendGuestTeamJoinResponse>("/guest-teams/join", {
      team_code: params.teamCode,
      identifier: params.identifier,
      device_mac: params.deviceMac,
      device_name: params.deviceName,
    });
    return { isNewMembership: data.is_new_membership };
  },
};
