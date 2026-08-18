import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Smartphone, Mail, Ticket, KeyRound, MessageCircle, ChevronDown } from "lucide-react";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { cn } from "@/lib/utils";
import {
  AlertBanner,
  ConnectingOverlay,
  DEFAULT_PORTAL_LOGO_SRC,
  PG_INPUT,
  PG_PRIMARY_BTN,
} from "./PortalGuestUi";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";
import { deviceHasPassword, markDeviceHasPassword } from "@/lib/portal-returning-guest";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

/**
 * The redesigned guest sign-in card: centered logo mark, "Welcome to
 * [venue]" heading, a pill two-tab toggle (plain, action-first labels --
 * "Text me a code" / "I have a password", not the previous admin-facing
 * "New user"/"Registered" language -- see the captive-portal redesign
 * spec's §1a.3/§4), and each tab's real, already-working backend call
 * (``/guest/otp/request`` -> ``/guest/otp/verify`` via
 * ``portalRuntimeService.requestOtp``/``loginWithOtp``; ``/guest/login/
 * password`` via ``loginWithPassword``) -- this component owns no new
 * auth logic of its own, only the visual/UX shape the design spec asks
 * for, composed entirely from the same service calls
 * src/routes/portal.auth.$method.tsx and src/components/portal-runtime/
 * AuthMethodForms.tsx already use.
 *
 * The OTP tab is deliberately inline (phone entry -> code entry, both
 * inside this one card, no page navigation) per the spec's exact "OTP
 * tab: mobile number field -> Send OTP -> inline 6-digit OTP field
 * appears" bullet -- src/routes/portal.verify.tsx (a real, separate page)
 * is kept only as a deep-linkable fallback for the older per-method flow,
 * not used by this card.
 *
 * Voucher and (when both SMS and email OTP are enabled) the non-default
 * OTP channel aren't part of the spec's two-tab shape, but are real,
 * currently-enabled methods for some locations (e.g. "sector 12") --
 * surfaced as small fallback links rather than removed, so this redesign
 * never silently drops a real sign-in method a venue has turned on.
 */
export function GuestSignInCard() {
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

  const isOtpMethod = (m: RuntimeAuthMethod | undefined) =>
    m === "otp_sms" || m === "otp_email" || m === "otp_whatsapp";

  const [otpChannel, setOtpChannel] = useState<"sms" | "email" | "whatsapp">(
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
  const subtext = config?.splashWelcomeMessage?.trim() || t("signInSubtext");

  const requiresTermsLink = !!(
    config?.termsAndConditionsText ||
    config?.termsAndConditionsUrl ||
    config?.privacyPolicyText ||
    config?.privacyPolicyUrl
  );

  // ---- OTP tab state -------------------------------------------------
  const [phase, setPhase] = useState<"phone" | "code" | "profile">("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ---- Post-OTP "tell us about yourself" prompt -----------------------
  // Shown once, only to a brand-new guest, only right after mobile-OTP
  // (not email-OTP or password/voucher) -- entirely skippable, never
  // blocks network access. `pendingSession` holds the just-verified
  // session until the guest fills it in or skips, since `afterLogin`
  // (real navigation onward) only fires once this phase resolves.
  const [pendingSession, setPendingSession] = useState<RuntimeSession | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const identifierForChannel = otpChannel === "email" ? email : countryCode + phone;
  const authMethodForChannel = (
    c: "sms" | "email" | "whatsapp",
  ): "otp_sms" | "otp_email" | "otp_whatsapp" =>
    c === "sms" ? "otp_sms" : c === "whatsapp" ? "otp_whatsapp" : "otp_email";

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
      setResendCooldown(0);
    },
    onError: (e: AppError) => {
      // A real 429 from OtpRateLimiter carries the real cooldown --
      // surface exactly that, never an invented fixed wait.
      const retryAfter = e.data?.retry_after_seconds;
      if (typeof retryAfter === "number") setResendCooldown(retryAfter);
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
      // Phone-based channels only (SMS/WhatsApp), and only the very first
      // time this guest has ever signed in -- an email-OTP or returning
      // guest skips straight to afterLogin exactly as before, since a
      // guest who signed in with email already gave us their email.
      if ((otpChannel === "sms" || otpChannel === "whatsapp") && session.isNewGuest) {
        setPendingSession(session);
        setPhase("profile");
        return;
      }
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
    // docstring. The legacy static-banner /portal/ad interstitial was
    // removed: it duplicated the newer, real Campaigns feature
    // (CampaignOverlay, now shown on /portal/session) and had no
    // remaining admin-facing way to even configure it, so it was purely
    // an extra forced page a guest never needed to see.
    navigate({
      to: "/portal/success",
      search: (prev) => prev,
    });
  }

  const onSaveProfile = async () => {
    if (!pendingSession) return;
    const name = profileName.trim();
    const emailInput = profileEmail.trim();
    if (!name && !emailInput) {
      await afterLogin(pendingSession);
      return;
    }
    setSavingProfile(true);
    try {
      await portalRuntimeService.updateGuestProfile({
        guestId: pendingSession.guestId,
        sessionId: pendingSession.sessionId,
        displayName: name || undefined,
        email: emailInput || undefined,
      });
    } catch {
      // Never blocks getting online -- the guest already has a real,
      // active session at this point (this is a courtesy detail, not a
      // login step), so a failure here just skips silently.
    } finally {
      setSavingProfile(false);
      await afterLogin(pendingSession);
    }
  };

  const onSkipProfile = async () => {
    if (!pendingSession) return;
    await afterLogin(pendingSession);
  };

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
    setOtpError(null);
    if (previewMode) {
      toast.info("Preview mode — connect a real device to test sign-in.");
      return;
    }
    sendOtp.mutate(id);
  };

  const onVerifyOtp = () => {
    if (code.length !== 6) {
      setOtpError(t("errEnterCode"));
      return;
    }
    if (!termsAccepted) {
      setOtpError(t("errAcceptTerms"));
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
    "sms" | "email" | "whatsapp",
    { label: string; icon: typeof Ticket; enabled: boolean }
  > = {
    sms: { label: t("useMobileInstead"), icon: Smartphone, enabled: hasOtpSms },
    email: { label: t("useEmailInstead"), icon: Mail, enabled: hasOtpEmail },
    whatsapp: { label: t("useWhatsappInstead"), icon: MessageCircle, enabled: hasOtpWhatsapp },
  };

  const otherMethodLinks = useMemo(() => {
    if (tab !== "otp") return [];
    return (["sms", "email", "whatsapp"] as const)
      .filter((c) => c !== otpChannel && OTP_CHANNEL_META[c].enabled)
      .map((c) => ({
        label: OTP_CHANNEL_META[c].label,
        icon: OTP_CHANNEL_META[c].icon,
        onClick: () => {
          setOtpChannel(c);
          setPhase("phone");
          setOtpError(null);
        },
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasOtpSms, hasOtpEmail, hasOtpWhatsapp, otpChannel]);

  const showTabs = hasOtp && hasPassword;
  const noMethods = !hasOtp && !hasPassword && !hasVoucher;

  // Plain, action-first tab label (redesign spec §4) instead of the
  // previous admin-facing "New user / Mobile OTP" -- picks the right verb
  // for whichever OTP channel is actually this venue's primary one
  // (reuses the same `otpChannel` state the OTP form itself is driven by,
  // never hardcoded to "text").
  const otpTabLabel =
    otpChannel === "email"
      ? t("otpTabEmail")
      : otpChannel === "whatsapp"
        ? t("otpTabWhatsapp")
        : t("otpTabSms");

  // Secondary-link hierarchy fix (redesign spec §4): the alternate OTP
  // channel links and the voucher fallback used to always render open,
  // competing with the one primary CTA most guests actually need. Both
  // collapse into a single low-emphasis disclosure now -- same underlying
  // `otherMethodLinks`/`hasVoucher` data and logic, just not open by
  // default.
  const showVoucherFallback = hasVoucher && (hasOtp || hasPassword);
  const hasMoreSignInOptions = otherMethodLinks.length > 0 || showVoucherFallback;

  const TermsCheckbox = (
    <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
      <Checkbox
        checked={termsAccepted}
        onCheckedChange={(v) => setTermsAccepted(!!v)}
        className="mt-0.5 border-slate-300 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
      />
      <span>
        {t("agreeToThe")}{" "}
        {requiresTermsLink ? (
          <Link
            to="/portal/terms"
            search={portalSearch}
            className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
          >
            {t("termsAcceptableUsePolicy")}
          </Link>
        ) : (
          <span className="font-medium text-slate-800">{t("termsAcceptableUsePolicy")}</span>
        )}
      </span>
    </label>
  );

  const hasBackgroundImage = !!config?.backgroundImageUrl;

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Same guaranteed-legible backing BrandPanel gets against a real
       * background photo (see PortalShell.tsx's BrandPanel + its own
       * "Fix BrandPanel text illegible against a real background photo"
       * commit) -- this header sits in the exact same page-level-scrim
       * "fully transparent through the vertical middle" zone once the
       * lg: two-column layout vertically centers this column, so without
       * its own backing a busy real photo left it a barely-legible
       * "ghost" panel underneath the actual sign-in card (confirmed live
       * on a real street-photo background at desktop width). Only kicks
       * in when a real image is configured -- the plain-gradient/default
       * case (which is already high-contrast) is untouched. */}
      <div
        className={cn(
          "flex flex-col items-center text-center",
          hasBackgroundImage &&
            "rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md",
        )}
      >
        {/* Real per-location logo always wins when configured; otherwise
            fall back to the actual Wyfy Guest brand mark (not a generic
            placeholder icon) so an un-customized location's guests still
            see real branding. */}
        <img
          src={config?.logoUrl || DEFAULT_PORTAL_LOGO_SRC}
          alt=""
          className="h-16 w-16 object-contain drop-shadow sm:h-20 sm:w-20 md:h-24 md:w-24"
        />
        <h1 className="mt-4 text-[26px] font-bold tracking-tight leading-tight text-slate-900">
          {heading}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">{subtext}</p>
      </div>

      <PortalCard variant="light" className="relative">
        <ConnectingOverlay
          active={verifyOtp.isPending || loginPassword.isPending}
          label={verifyOtp.isPending ? t("verifyingCode") : t("signingIn")}
        />

        {noMethods ? (
          <p className="py-6 text-center text-sm text-slate-500">{t("noMethodsAvailable")}</p>
        ) : (
          <>
            {showTabs && (
              // CSS-only sliding pill (redesign spec §3): there are always
              // exactly 2 tabs in this fixed 2-column grid, so no
              // framer-motion `layoutId` shared-element measurement is
              // needed -- `.pg-tab-pill` (styles.css) is a single
              // absolutely positioned pill sized to one grid cell,
              // sliding via `transform` driven by this container's own
              // `data-active-tab` attribute.
              <div
                role="tablist"
                aria-label="Sign-in method"
                data-active-tab={tab}
                className="relative mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-indigo-50 p-1 ring-1 ring-inset ring-indigo-100"
              >
                <span
                  aria-hidden
                  className="pg-tab-pill absolute bottom-1 left-1 top-1 w-[calc(50%-6px)] rounded-[14px] bg-white shadow-[0_1px_2px_rgba(17,20,40,0.06),0_6px_16px_-8px_rgba(49,46,129,0.35)]"
                />
                {[
                  { id: "otp" as const, label: otpTabLabel },
                  { id: "password" as const, label: t("haveAPassword") },
                ].map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(item.id)}
                      className="relative z-10 min-h-[52px] rounded-[14px] px-2 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-50"
                    >
                      <span
                        className={
                          "block text-[13px] font-semibold leading-tight " +
                          (active ? "text-indigo-700" : "text-slate-500")
                        }
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === "otp" && hasOtp && (
              <div className="space-y-3.5">
                {phase === "profile" ? (
                  <>
                    <p className="text-center text-sm text-slate-500">
                      {t("tellUsAboutYourself")} <span className="text-slate-400">{t("optionalLabel")}</span>.
                    </p>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">{t("nameLabel")}</label>
                      <Input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Jane Doe"
                        autoFocus
                        className={PG_INPUT}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">{t("emailAddress")}</label>
                      <Input
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        type="email"
                        placeholder="you@example.com"
                        className={PG_INPUT}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onSaveProfile}
                      disabled={savingProfile}
                      className={PG_PRIMARY_BTN}
                    >
                      {savingProfile ? t("savingLabel") : t("continueCta")}
                    </button>
                    <button
                      type="button"
                      onClick={onSkipProfile}
                      disabled={savingProfile}
                      className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      {t("skipForNow")}
                    </button>
                  </>
                ) : phase === "phone" ? (
                  <>
                    <label className="text-xs font-semibold text-slate-500">
                      {otpChannel === "email"
                        ? t("emailAddress")
                        : otpChannel === "whatsapp"
                          ? t("whatsappNumberLabel")
                          : t("mobileNumber")}
                    </label>
                    {otpChannel !== "email" ? (
                      <div className="grid grid-cols-[84px_1fr] gap-2">
                        <Input
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className={PG_INPUT}
                        />
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          inputMode="tel"
                          placeholder="555 010 2200"
                          className={PG_INPUT}
                        />
                      </div>
                    ) : (
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="you@example.com"
                        className={PG_INPUT}
                      />
                    )}
                    <AlertBanner message={otpError} />
                    <button
                      type="button"
                      onClick={onSendOtp}
                      disabled={sendOtp.isPending}
                      className={PG_PRIMARY_BTN}
                    >
                      {sendOtp.isPending ? t("sendingLabel") : t("sendOtp")}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-center text-sm text-slate-500">
                      {t("sentCodeToPrefix")}{" "}
                      <span className="font-semibold text-slate-800">{target}</span>
                    </p>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                        <InputOTPGroup className="gap-2 sm:gap-2.5">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-14 w-11 rounded-2xl border-slate-200 bg-white text-xl font-semibold tabular-nums text-slate-900 shadow-none transition-[border-color,box-shadow] duration-150 first:rounded-2xl last:rounded-2xl"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {TermsCheckbox}
                    <AlertBanner message={otpError} />
                    <button
                      type="button"
                      onClick={onVerifyOtp}
                      disabled={code.length !== 6 || verifyOtp.isPending}
                      className={PG_PRIMARY_BTN}
                    >
                      {verifyOtp.isPending ? t("verifyingLabel") : t("verifyOtpConnect")}
                    </button>
                    <div className="flex items-center justify-center gap-3 pt-0.5 text-xs">
                      {resendCooldown > 0 ? (
                        <span className="text-slate-400">
                          {t("resendAvailableInTemplate").replace(
                            "{n}",
                            String(resendCooldown),
                          )}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendOtp.mutate(target)}
                          disabled={sendOtp.isPending}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {t("resend")}
                        </button>
                      )}
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={onChangeNumber}
                        className="font-medium text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        {t("changeNumberLabel")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "password" && hasPassword && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    {t("mobileOrEmailLabel")}
                  </label>
                  <Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or +1 555 010 2200"
                    className={`${PG_INPUT} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">{t("password")}</label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••••••"
                    className={`${PG_INPUT} mt-1`}
                  />
                </div>
                {TermsCheckbox}
                <AlertBanner message={passwordError} />
                <button
                  type="button"
                  onClick={onSignInPassword}
                  disabled={loginPassword.isPending}
                  className={PG_PRIMARY_BTN}
                >
                  {loginPassword.isPending ? t("signingInLabel") : t("signInConnect")}
                </button>
                {hasOtp && (
                  <button
                    type="button"
                    onClick={() => setTab("otp")}
                    className="block w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                  >
                    {t("forgotUseOtp")}
                  </button>
                )}
              </div>
            )}

            {!hasOtp && !hasPassword && hasVoucher && (
              <p className="py-2 text-center text-xs text-slate-500">
                {t("voucherFallbackPrefix")}{" "}
                <Link
                  to="/portal/auth/$method"
                  params={{ method: "voucher" }}
                  search={portalSearch}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {t("redeemVoucherLink")}
                </Link>
                .
              </p>
            )}

            {/* Secondary-link hierarchy fix (redesign spec §4): the
             * alternate OTP channel links and the voucher fallback used to
             * always render open, competing with the one primary CTA most
             * guests actually need. A single low-emphasis disclosure now
             * holds whichever of those are actually enabled, collapsed by
             * default -- same underlying data/logic
             * (`otherMethodLinks`/`hasVoucher`), just not open by default.
             * Native `<details>`, not JS state, so the expand/collapse
             * itself costs nothing extra. */}
            {hasMoreSignInOptions && (
              <details className="group mt-3">
                <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 [&::-webkit-details-marker]:hidden">
                  {t("otherWaysToSignIn")}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-180" />
                </summary>
                <div className="mt-2 flex flex-col items-center gap-1.5">
                  {otherMethodLinks.map((l) => (
                    <button
                      key={l.label}
                      type="button"
                      onClick={l.onClick}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                    >
                      <l.icon className="h-3.5 w-3.5" /> {l.label}
                    </button>
                  ))}
                  {showVoucherFallback && (
                    <Link
                      to="/portal/auth/$method"
                      params={{ method: "voucher" }}
                      search={portalSearch}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                    >
                      <Ticket className="h-3.5 w-3.5" /> {t("haveVoucherUseInstead")}
                    </Link>
                  )}
                </div>
              </details>
            )}
          </>
        )}
      </PortalCard>

      {tab === "password" && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <KeyRound className="h-3 w-3" /> {t("savedPasswordsNote")}
        </p>
      )}
    </div>
  );
}
