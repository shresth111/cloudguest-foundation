import { guestPortalApi } from "@/services/guest-portal-api";
import {
  clampBackgroundFocal,
  clampBackgroundOverlayStrength,
  toBackgroundMetric,
  resolveLanguageSelection,
  toGuestFontChoice,
  type RuntimeAuthMethod,
  type RuntimePortalConfig,
  type RuntimeSession,
  type RuntimeSessionAuthMethod,
} from "@/types/portal-runtime";

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
  otp_whatsapp_enabled: boolean;
  username_password_enabled: boolean;
  voucher_enabled: boolean;
  resolved_via_location_override: boolean;
  is_open_now: boolean;
  business_hours_closed_message: string | null;
  /** captive-portal-v6-design-spec.md §6.1 -- optional until the backend
   * PR (separate repo, `cloud-guest-repo/backend`) lands; `toRuntimeConfig`
   * below falls back to `"system"`/`55` for either field when absent, so
   * this frontend change is safe to ship ahead of that one (§7). */
  guest_font_choice?: string;
  background_overlay_strength?: number;
  /** captive-portal-v7-design-spec.md §1.4 C3/C4/C5 -- shipped by backend
   * migration 0089 (`0089_add_background_image_metrics_and_focal_point`) and
   * live on `GET /captive-portal/resolve`. Field names verified against
   * `origin/main`'s `app/domains/captive_portal/schemas.py`
   * (`ResolvedCaptivePortalConfigResponse`) and `router.py`, not assumed.
   *
   * The focal pair is `Integer NOT NULL` on `captive_portal_configs` with
   * server defaults 50/25; the three measurements are `Integer NULL` on
   * `brandings` and stay optional/nullable all the way through this
   * frontend, because `null` there carries real meaning ("never measured")
   * that a 0 would destroy. Kept optional on this interface as well so a
   * stale/rolled-back backend degrades to the safe defaults rather than
   * producing `undefined` reads. */
  background_focal_x?: number;
  background_focal_y?: number;
  background_luminance?: number | null;
  background_top_luminance?: number | null;
  background_entropy?: number | null;
  /** Returned since backend 0085 and, until v7, never mapped -- see
   * `RuntimePortalConfig.pinLoginEnabled`. */
  pin_login_enabled?: boolean;
  /** Returned since backend PR #33 ("Expose resolved location's country on
   * GET /captive-portal/resolve") and, until v7, never mapped -- see
   * `RuntimePortalConfig.locationCountry`. ISO 3166-1 alpha-2, never a
   * dialing code. */
  location_country?: string | null;
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
    // Both fields are free text on the backend and are resolved together,
    // once -- see `resolveLanguageSelection`. Mapping the array through a
    // per-item coercion (what this used to do) turned every unrecognized
    // code into another `"en"`, so a config still storing a since-removed
    // language rendered duplicate, identically-labelled switcher entries
    // sharing one React key.
    ...resolveLanguageSelection(c.default_language, c.supported_languages),
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
    otpWhatsappEnabled: c.otp_whatsapp_enabled,
    usernamePasswordEnabled: c.username_password_enabled,
    voucherEnabled: c.voucher_enabled,
    resolvedViaLocationOverride: c.resolved_via_location_override,
    isOpenNow: c.is_open_now,
    businessHoursClosedMessage: c.business_hours_closed_message,
    guestFontChoice: toGuestFontChoice(c.guest_font_choice),
    backgroundOverlayStrength: clampBackgroundOverlayStrength(c.background_overlay_strength),
    // v7 §1.4 C4. 50/25 is not a frontend guess -- it is migration 0089's own
    // server default, chosen so the render is identical to the previous
    // hardcoded `center 25%` for every venue that already exists.
    backgroundFocalX: clampBackgroundFocal(c.background_focal_x, 50),
    backgroundFocalY: clampBackgroundFocal(c.background_focal_y, 25),
    // v7 §1.4 C3/C5. `toBackgroundMetric` preserves `null` rather than
    // coercing it to 0 -- the distinction is load-bearing, see its comment.
    backgroundLuminance: toBackgroundMetric(c.background_luminance),
    backgroundTopLuminance: toBackgroundMetric(c.background_top_luminance),
    backgroundEntropy: toBackgroundMetric(c.background_entropy),
    // Both already returned by the API before v7 and simply never read.
    pinLoginEnabled: c.pin_login_enabled ?? false,
    locationCountry: c.location_country ?? null,
  };
}

function toRuntimeSession(data: BackendGuestLoginResponse): RuntimeSession {
  const s = data.session;
  return {
    guestId: data.guest_id,
    identifier: data.identifier,
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
    // A guest device only just associated with the WiFi -- this is the very
    // first API call it ever makes, over a fresh, sometimes-flaky pre-auth
    // path. The client's global 20s axios timeout is right for slower
    // operations (OTP dispatch, etc.) but far too long for a splash screen
    // with nothing else to show: a genuinely stuck connection should surface
    // as a retryable error in a few seconds, not leave the guest staring at
    // a spinner for 20. See routes/portal.index.tsx's own retry affordance,
    // which this shorter timeout exists to make actually reachable quickly.
    const { data } = await guestPortalApi.get<BackendCaptivePortalConfig>(
      "/captive-portal/resolve",
      {
        params: { organization_id: params.organizationId, location_id: params.locationId },
        timeout: 6000,
      },
    );
    return toRuntimeConfig(data);
  },

  /** Real "is this device already connected?" check -- called on portal
   * load when the browser has no locally-persisted session (a fresh tab,
   * a re-scanned QR code, a re-opened captive-portal redirect) but the
   * device's own MAC (RouterOS's trustworthy `$(mac)`) might still have a
   * live, RADIUS-authorized session on this router. Returns `null` -- not
   * an error -- for a normal first-time visit. Same shortened timeout as
   * `resolveConfig`, same reasoning -- this also gates the splash screen's
   * navigation decision. */
  async checkActiveSession(params: {
    routerId: string;
    deviceMac: string;
  }): Promise<RuntimeSession | null> {
    const { data } = await guestPortalApi.get<BackendGuestLoginResponse | null>(
      "/guest/session/active",
      { params: { router_id: params.routerId, device_mac: params.deviceMac }, timeout: 6000 },
    );
    return data ? toRuntimeSession(data) : null;
  },

  async requestOtp(params: {
    identifier: string;
    channel: "sms" | "email" | "whatsapp";
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
    deviceIp?: string;
  }): Promise<RuntimeSession> {
    const { data } = await guestPortalApi.post<BackendGuestLoginResponse>("/guest/login/otp", {
      identifier: params.identifier,
      code: params.code,
      auth_method: params.authMethod,
      organization_id: params.organizationId,
      location_id: params.locationId,
      router_id: params.routerId,
      device_mac: params.deviceMac,
      ip_address: params.deviceIp,
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
    deviceIp?: string;
  }): Promise<RuntimeSession> {
    const { data } = await guestPortalApi.post<BackendGuestLoginResponse>("/guest/login/voucher", {
      code: params.code,
      identifier: params.identifier,
      organization_id: params.organizationId,
      location_id: params.locationId,
      router_id: params.routerId,
      device_mac: params.deviceMac,
      ip_address: params.deviceIp,
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
    deviceIp?: string;
  }): Promise<RuntimeSession> {
    const { data } = await guestPortalApi.post<BackendGuestLoginResponse>("/guest/login/password", {
      identifier: params.identifier,
      password: params.password,
      organization_id: params.organizationId,
      location_id: params.locationId,
      router_id: params.routerId,
      device_mac: params.deviceMac,
      ip_address: params.deviceIp,
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
