import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Smartphone, Mail, Ticket, MessageCircle } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";
import { deviceHasPassword, markDeviceHasPassword } from "@/lib/portal-returning-guest";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import { defaultCountryCode } from "@/lib/portal-locale";
import { useOtpResendCooldown } from "@/lib/portal-otp-cooldown";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

type OtpChannel = "sms" | "email" | "whatsapp";

const isOtpMethod = (m: RuntimeAuthMethod | undefined) =>
  m === "otp_sms" || m === "otp_email" || m === "otp_whatsapp";

const authMethodForChannel = (c: OtpChannel): "otp_sms" | "otp_email" | "otp_whatsapp" =>
  c === "sms" ? "otp_sms" : c === "whatsapp" ? "otp_whatsapp" : "otp_email";

/**
 * v4 §6 (Component structure): all of `GuestSignInCard`'s mutation/state-
 * machine logic (OTP send/verify, password login, resend cooldown, tab
 * selection) -- zero JSX. Split out so the visual pass and the interaction
 * pass (UX v4 §6.5's profile-prompt relocation, §6.8's legacy-form
 * consolidation) land on the same underlying file once, not twice, and so
 * `<AuthTabSwitcher>`/`<OtpForm>`/`<PasswordForm>` can each stay purely
 * presentational.
 */
export function useGuestSignIn() {
  const {
    config,
    organizationId,
    locationId,
    routerId,
    deviceMac,
    deviceIp,
    selectedMethod,
    setSelectedMethod,
    setSession,
    termsAccepted,
    setTermsAccepted,
    previewMode,
    setGuestIdentifier,
    t,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/welcome" });
  const portalSearch = { organizationId, locationId, routerId };

  const methods: RuntimeAuthMethod[] = config ? enabledAuthMethods(config) : [];
  const hasOtpSms = methods.includes("otp_sms");
  const hasOtpEmail = methods.includes("otp_email");
  const hasOtpWhatsapp = methods.includes("otp_whatsapp");
  const hasOtp = hasOtpSms || hasOtpEmail || hasOtpWhatsapp;
  const hasPassword = methods.includes("username_password");
  const hasVoucher = methods.includes("voucher");

  const [otpChannel, setOtpChannel] = useState<OtpChannel>(
    hasOtpSms ? "sms" : hasOtpWhatsapp ? "whatsapp" : "email",
  );
  const [tab, setTab] = useState<"otp" | "password">(() => {
    // An explicit hand-off (the expired screen's "Sign in again"/"Use OTP
    // instead" buttons, see src/routes/portal.expired.tsx) always wins.
    if (selectedMethod === "username_password" && hasPassword) return "password";
    if (isOtpMethod(selectedMethod) && hasOtp) return "otp";
    // Otherwise: "OTP once, then phone/email + password from then on" --
    // this same browser having set a real password before defaults it
    // straight to the Registered-user tab (see
    // src/lib/portal-returning-guest.ts); a genuine first-time guest has
    // no such flag and lands on the OTP tab, same as always.
    if (hasPassword && deviceHasPassword()) return "password";
    return hasOtp ? "otp" : "password";
  });
  // Re-run once the real config actually resolves (methods are unknown,
  // so the lazy initializer above may have guessed "password" as a bare
  // fallback before hasOtp/hasPassword were known) -- and honor an
  // explicit selectedMethod hand-off the same way.
  useEffect(() => {
    if (selectedMethod === "username_password" && hasPassword) setTab("password");
    else if (isOtpMethod(selectedMethod) && hasOtp) setTab("otp");
    else if (hasPassword && deviceHasPassword()) setTab("password");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOtp, hasPassword]);

  const venueName = config?.name;
  const heading =
    config?.splashHeadline?.trim() ||
    (venueName ? t("welcomeToVenueTemplate").replace("{venue}", venueName) : t("welcomeBare"));
  // captive-portal-v5-design-spec.md §3.2: no fallback string here anymore
  // -- `t("signInSubtext")` was a hardcoded filler line ("Sign in for
  // complimentary WiFi access...") rendered whenever a venue hadn't
  // configured `splashWelcomeMessage`, which is the common case. It added
  // a full text row for zero real information; the heading already
  // carries what a guest needs on its own. `undefined` (not `""`) so
  // GuestSignInCard can render the row conditionally rather than an empty
  // paragraph.
  const subtext = config?.splashWelcomeMessage?.trim() || undefined;

  const requiresTermsLink = !!(
    config?.termsAndConditionsText ||
    config?.termsAndConditionsUrl ||
    config?.privacyPolicyText ||
    config?.privacyPolicyUrl
  );

  // ---- OTP tab state -------------------------------------------------
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  // v4 UX §6.3: was a hardcoded "+1" -- see defaultCountryCode's own
  // docstring for why this platform's real deployment base makes that a
  // wrong default for most actual venues.
  const [countryCode, setCountryCodeState] = useState(() =>
    defaultCountryCode(config?.defaultLanguage, config?.locationCountry),
  );
  // Once a guest edits this field themselves, their own value always
  // wins -- the effect below only ever re-derives the *default*, for the
  // case `config` resolves async (unknown at this hook's very first
  // render) after the lazy initializer above already guessed with no
  // config to go on yet.
  const [countryCodeTouched, setCountryCodeTouched] = useState(false);
  const setCountryCode = (v: string) => {
    setCountryCodeTouched(true);
    setCountryCodeState(v);
  };
  useEffect(() => {
    if (countryCodeTouched) return;
    setCountryCodeState(defaultCountryCode(config?.defaultLanguage, config?.locationCountry));
  }, [config?.defaultLanguage, config?.locationCountry, countryCodeTouched]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  // v4 UX §6.4: server-driven cooldown, shared with the legacy
  // /portal/verify page -- see this hook's own docstring for the "why".
  const { cooldown: resendCooldown, applyServerCooldown, resetCooldown } = useOtpResendCooldown();

  const identifierForChannel = otpChannel === "email" ? email : countryCode + phone;

  const sendOtp = useMutation({
    mutationFn: (identifier: string) =>
      portalRuntimeService.requestOtp({
        identifier,
        channel: otpChannel,
        organizationId,
        locationId,
      }),
    onSuccess: (_r, identifier) => {
      setTarget(identifier);
      setPhase("code");
      setOtpError(null);
      resetCooldown();
    },
    onError: (e: AppError) => {
      // A real 429 from OtpRateLimiter carries the real cooldown --
      // surface exactly that, never an invented fixed wait.
      applyServerCooldown(e);
      setOtpError(friendlyGuestAuthError(e, "otp_request"));
    },
  });

  const verifyOtp = useMutation({
    mutationFn: (c: string) =>
      portalRuntimeService.loginWithOtp({
        identifier: target,
        code: c,
        authMethod: authMethodForChannel(otpChannel),
        organizationId,
        locationId,
        routerId,
        deviceMac,
        deviceIp,
      }),
    onSuccess: async (session) => {
      setOtpError(null);
      setSelectedMethod(authMethodForChannel(otpChannel));
      // See PortalRuntimeState.guestIdentifier's docstring -- the NAS's own
      // RADIUS Authorize checks this exact value, not a hardcoded one.
      setGuestIdentifier(target.trim());
      // v4 UX §6.5: the "tell us about yourself" profile prompt used to
      // branch here for new phone/WhatsApp guests, holding this session
      // in `pendingSession` until the guest filled it in or skipped. It's
      // now a post-connect nudge on /portal/session instead (matching
      // set-password/team-join's own already-established pattern), so
      // this always calls `afterLogin` immediately -- "OTP verified ->
      // online" stays a true two-step handoff, no exceptions.
      await afterLogin(session);
    },
    // A wrong/expired code 400/410s with a real, already-plain-English
    // reason from OtpCodeMismatchError/OtpExpiredError/etc. -- shown as-is.
    // The one shape that isn't fit for a guest to read verbatim is a raw
    // 422 "Request validation failed" (the backend's generic request-schema
    // validation handler, not a real OTP business-logic reason) -- see
    // src/lib/portal-guest-errors.ts for why that's the only case mapped.
    onError: (e: AppError) => setOtpError(friendlyGuestAuthError(e, "otp_verify")),
  });

  // ---- Password tab state --------------------------------------------
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const loginPassword = useMutation({
    mutationFn: () =>
      portalRuntimeService.loginWithPassword({
        identifier,
        password,
        organizationId,
        locationId,
        routerId,
        deviceMac,
        deviceIp,
      }),
    onSuccess: async (session) => {
      setPasswordError(null);
      setSelectedMethod("username_password");
      setGuestIdentifier(identifier.trim());
      await afterLogin(session);
    },
    onError: (e: AppError) => setPasswordError(friendlyGuestAuthError(e, "password")),
  });

  async function afterLogin(session: RuntimeSession) {
    setSession(session);
    // Covers OTP/voucher logins too: the real backend already knows
    // whether this guest has a password (`hasPassword`, from the exact
    // same login response) even if it was set from a different device --
    // if so, this device should default to the Registered-user tab next
    // time as well.
    if (session.hasPassword) markDeviceHasPassword();
    if (termsAccepted) {
      portalRuntimeService
        .recordConsent({ guestId: session.guestId, captivePortalConfigId: config?.id })
        .catch(() => undefined);
    }
    // Real navigation target: the brief "connecting" transitional screen,
    // which fires the real hotspot-login POST and lands the guest on
    // /portal/session once it completes -- see portal.success.tsx's own
    // docstring.
    navigate({
      to: "/portal/success",
      search: (prev) => prev,
    });
  }

  // v4 UX §6.2: terms acceptance now gates *sending* the OTP (the first
  // screen of the OTP tab, same as the password tab always did) rather
  // than only being checked -- and only shown -- on the code-entry
  // screen. A guest never discovers the requirement only after already
  // waiting for and entering a code.
  const onSendOtp = () => {
    const id = identifierForChannel.trim();
    const isPhoneChannel = otpChannel !== "email";
    if (isPhoneChannel ? id.replace(countryCode, "").trim().length < 6 : !/.+@.+\..+/.test(id)) {
      setOtpError(
        isPhoneChannel
          ? otpChannel === "whatsapp"
            ? t("errValidWhatsapp")
            : t("errValidMobile")
          : t("errValidEmail"),
      );
      return;
    }
    if (!termsAccepted) {
      setOtpError(t("errAcceptTerms"));
      return;
    }
    setOtpError(null);
    if (previewMode) {
      toast.info("Preview mode — connect a real device to test sign-in.");
      return;
    }
    sendOtp.mutate(id);
  };

  const onResendOtp = () => {
    if (previewMode) {
      toast.info("Preview mode — connect a real device to test sign-in.");
      return;
    }
    sendOtp.mutate(target);
  };

  const onVerifyOtp = () => {
    if (code.length !== 6) {
      setOtpError(t("errEnterCode"));
      return;
    }
    if (previewMode) {
      toast.info("Preview mode — connect a real device to test sign-in.");
      return;
    }
    verifyOtp.mutate(code);
  };

  const onChangeNumber = () => {
    setPhase("phone");
    setCode("");
    setTarget("");
    setOtpError(null);
  };

  const onSwitchOtpChannel = (c: OtpChannel) => {
    setOtpChannel(c);
    setPhase("phone");
    setOtpError(null);
  };

  const onSignInPassword = () => {
    if (!identifier.trim() || !password) {
      setPasswordError(t("errPhoneEmailPassword"));
      return;
    }
    if (!termsAccepted) {
      setPasswordError(t("errAcceptTerms"));
      return;
    }
    if (previewMode) {
      toast.info("Preview mode — connect a real device to test sign-in.");
      return;
    }
    loginPassword.mutate();
  };

  const OTP_CHANNEL_META: Record<
    OtpChannel,
    { label: string; switchLabel: string; icon: typeof Ticket; enabled: boolean }
  > = {
    sms: {
      label: t("otpTabSms"),
      switchLabel: t("useMobileInstead"),
      icon: Smartphone,
      enabled: hasOtpSms,
    },
    email: {
      label: t("otpTabEmail"),
      switchLabel: t("useEmailInstead"),
      icon: Mail,
      enabled: hasOtpEmail,
    },
    whatsapp: {
      label: t("otpTabWhatsapp"),
      switchLabel: t("useWhatsappInstead"),
      icon: MessageCircle,
      enabled: hasOtpWhatsapp,
    },
  };

  const enabledOtpChannels = (["sms", "email", "whatsapp"] as const).filter(
    (c) => OTP_CHANNEL_META[c].enabled,
  );

  // v4 UX §6.7/§6.9 tier 2: a venue with 2+ OTP channels enabled and no
  // password method used to degrade to "the primary channel's form, with
  // the other channels tucked inside the same collapsed disclosure that
  // also holds voucher" -- undiscoverable. When there's no tier-1 pill to
  // begin with (no password), a real, visible (not collapsed) way to
  // switch channel is now shown instead -- small icon-tabs, deliberately
  // NOT the tier-1 pill's own treatment, so it never implies a false
  // parity between "channel" and "method" (see AuthTabSwitcher.tsx).
  const showTabs = hasOtp && hasPassword;
  const showChannelSwitcher = !showTabs && hasOtp && enabledOtpChannels.length >= 2;
  const noMethods = !hasOtp && !hasPassword && !hasVoucher;

  const otpTabLabel = OTP_CHANNEL_META[otpChannel].label;

  // Tier-3 disclosure ("Other ways to sign in"): once the tier-2 channel
  // switcher above is showing every other enabled channel already, the
  // disclosure only needs to hold voucher -- listing the same channels
  // twice (once visible, once hidden) would be redundant, not extra
  // discoverability.
  const otherMethodLinks = useMemo(() => {
    if (tab !== "otp" || showChannelSwitcher) return [];
    return enabledOtpChannels
      .filter((c) => c !== otpChannel)
      .map((c) => ({
        label: OTP_CHANNEL_META[c].switchLabel,
        icon: OTP_CHANNEL_META[c].icon,
        onClick: () => onSwitchOtpChannel(c),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, showChannelSwitcher, enabledOtpChannels, otpChannel]);

  const showVoucherFallback = hasVoucher && (hasOtp || hasPassword);
  const hasMoreSignInOptions = otherMethodLinks.length > 0 || showVoucherFallback;

  return {
    // config / copy
    config,
    portalSearch,
    heading,
    subtext,
    previewMode,
    requiresTermsLink,
    termsAccepted,
    setTermsAccepted,
    // method availability
    hasOtp,
    hasPassword,
    hasVoucher,
    noMethods,
    // tab / channel switcher (three-tier hierarchy, v4 §6.9)
    tab,
    setTab,
    showTabs,
    showChannelSwitcher,
    otpChannel,
    otpTabLabel,
    enabledOtpChannels: enabledOtpChannels.map((c) => ({
      channel: c,
      label: OTP_CHANNEL_META[c].label,
      icon: OTP_CHANNEL_META[c].icon,
      active: c === otpChannel,
    })),
    onSwitchOtpChannel,
    otherMethodLinks,
    showVoucherFallback,
    hasMoreSignInOptions,
    // OTP tab state
    phase,
    countryCode,
    setCountryCode,
    phone,
    setPhone,
    email,
    setEmail,
    target,
    code,
    setCode,
    otpError,
    resendCooldown,
    sendOtpPending: sendOtp.isPending,
    verifyOtpPending: verifyOtp.isPending,
    onSendOtp,
    onVerifyOtp,
    onChangeNumber,
    onResendOtp,
    // password tab state
    identifier,
    setIdentifier,
    password,
    setPassword,
    passwordError,
    loginPasswordPending: loginPassword.isPending,
    onSignInPassword,
    // shared "connecting" overlay driver
    isSigningIn: verifyOtp.isPending || loginPassword.isPending,
  };
}

export type UseGuestSignInReturn = ReturnType<typeof useGuestSignIn>;
