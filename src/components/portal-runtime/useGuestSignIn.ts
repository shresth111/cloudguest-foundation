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
import {
  defaultCountryCode,
  nationalNumberMaxLength,
  normalizeNationalPhone,
} from "@/lib/portal-locale";
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
    previewMode,
    setGuestIdentifier,
    t,
    dataConsentAccepted,
    setDataConsentAccepted,
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

  const venueName = config?.name?.trim() || undefined;
  const customHeadline = config?.splashHeadline?.trim() || undefined;

  // captive-portal-v7-design-spec.md Part 2 / §8.3.
  //
  // This used to be one string -- `t("welcomeToVenueTemplate")` -> "Welcome
  // to The Grand Ashoka Residency" -- rendered as a single `pg-title` line.
  // Two things were wrong with that, and only the second is cosmetic.
  //
  // 1. IT ANSWERED THE WRONG QUESTION AT THE LOUDEST VOLUME. §8.3 is
  //    explicit that the guest's real question on this screen is *whose
  //    network is this*, that confirming the venue is "the strongest
  //    anti-evil-twin signal available", and that "legibility here is a
  //    security signal". Setting "Welcome to" at the same 26px/700 as the
  //    venue's name spends half the largest type on the screen on a
  //    greeting. Splitting them puts the whole title budget on the identity
  //    -- which is also what a hotel's own signage does, and what Apple's
  //    "deference" means applied literally: our courtesy copy becomes a
  //    label, the venue's name becomes the content.
  // 2. A long name wrapped to three and four lines, because it was carrying
  //    "Welcome to " as a prefix. Measured at 320px with `--pg-type-scale`
  //    at 1.25 and a 40-character Devanagari name: four lines before, three
  //    after.
  //
  // `splashHeadline` also silently DELETED the venue's identity: a venue
  // that typed "Enjoy your stay" into that optional field removed its own
  // name from the portal entirely. That is now impossible -- when a custom
  // headline exists the name moves into the eyebrow instead of vanishing.
  // One slot, two variants, same styling:
  //
  //   custom headline + name  ->  eyebrow = the venue's name  (identity)
  //   name only               ->  eyebrow = "Welcome to"      (greeting)
  //   neither                 ->  no eyebrow row at all
  //
  // The last case is deliberate and matches v5 §3.2's rule about the
  // welcome message: a row with nothing real in it is not rendered.
  const heading = customHeadline || venueName || t("welcomeBare");
  // A venue that writes its own name into its custom headline (confirmed
  // live: "Welcome to shiv chock" typed verbatim as splashHeadline) already
  // carries full identity in that one line -- the eyebrow's job above is
  // only to restore identity a headline would otherwise have deleted, not
  // to repeat one it already states. Case-insensitive substring, not an
  // exact-string match: the same redundancy shows up whether the venue
  // wrote "Welcome to X", "X welcomes you", or just "X" as their headline.
  const headlineAlreadyNamesVenue = !!(
    customHeadline &&
    venueName &&
    customHeadline.toLowerCase().includes(venueName.toLowerCase())
  );
  const eyebrowIsVenueName = !!(customHeadline && venueName) && !headlineAlreadyNamesVenue;
  const eyebrow = headlineAlreadyNamesVenue
    ? undefined
    : eyebrowIsVenueName
      ? venueName
      : venueName
        ? t("welcomeEyebrow")
        : undefined;
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
  // captive-portal-v7-design-spec.md §8.1: the dialling code is now a
  // fixed, non-editable prefix rather than a second editable text box, so
  // there is no "the guest has edited this themselves" case left to track
  // -- the `countryCodeTouched` flag and its re-derive effect are gone
  // with it. It is still derived from the strongest real signal available
  // (`location_country`, the venue's own admin-entered address country),
  // never hardcoded to `+91`; see `defaultCountryCode`'s own docstring.
  // Recomputed rather than held in state precisely so that a `config`
  // arriving after first render simply produces the right prefix, with no
  // state to get out of sync.
  const dialCode = useMemo(
    () => defaultCountryCode(config?.defaultLanguage, config?.locationCountry),
    [config?.defaultLanguage, config?.locationCountry],
  );
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  // v4 UX §6.4: server-driven cooldown, shared with the legacy
  // /portal/verify page -- see this hook's own docstring for the "why".
  const { cooldown: resendCooldown, applyServerCooldown, resetCooldown } = useOtpResendCooldown();

  // Normalised again here, not only in the field's own `onChange`: this is
  // the value that is actually sent, and it is the one place both the
  // typed path and any future programmatic path converge (v7 §8.1 --
  // spaces, dashes, a leading zero and an explicitly-pasted dialling code
  // all come off before submit).
  const nationalPhone = normalizeNationalPhone(phone, dialCode);
  const identifierForChannel = otpChannel === "email" ? email : dialCode + nationalPhone;

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
    // Consent is now implied by continuing (no checkbox -- see
    // requiresTermsLink's own call sites), so every successful login
    // records it, unconditionally.
    portalRuntimeService
      .recordConsent({ guestId: session.guestId, captivePortalConfigId: config?.id })
      .catch(() => undefined);
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
    // Was `id.replace(countryCode, "")` -- a substring replace against the
    // whole identifier, so a number that happened to contain its own
    // dialling code again anywhere in it was measured short. The national
    // part is now a value in its own right, so the check is just its
    // length. Where the venue's plan has a known fixed national length
    // (India and NANP are both flat 10 digits) that exact length is
    // required, because "sent an OTP to a 9-digit number" is a dead end a
    // guest cannot diagnose; everywhere else the original >= 6 floor
    // stands rather than inventing a plan this codebase has no venues in.
    const expected = nationalNumberMaxLength(dialCode);
    const phoneOk = expected === 15 ? nationalPhone.length >= 6 : nationalPhone.length === expected;
    if (isPhoneChannel ? !phoneOk : !/.+@.+\..+/.test(id)) {
      setOtpError(
        isPhoneChannel
          ? otpChannel === "whatsapp"
            ? t("errValidWhatsapp")
            : t("errValidMobile")
          : t("errValidEmail"),
      );
      return;
    }
    // DPDP Act 2023 §6: consent to *collecting* this identifier (about to
    // be transmitted for OTP delivery) is a separate question from
    // agreeing to the Terms & Acceptable Use Policy `requiresTermsLink`
    // gates elsewhere -- see `dataConsentAccepted`'s own doc comment in
    // PortalRuntimeContext. Checked here, not earlier, so a guest sees the
    // real validation error first if the identifier itself is invalid.
    if (!dataConsentAccepted) {
      setOtpError(t("errAcceptDataConsent"));
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
  // "OTP once, then phone/email + password from then on" (see the `tab`
  // lazy initializer above) was only ever half-enforced: `deviceHasPassword()`
  // picked the *default* tab, but the switcher itself still rendered for
  // EVERY guest whenever a venue enabled both methods -- including a
  // genuinely first-time guest on a brand-new device, who cannot possibly
  // have a password yet (the backend's `set_guest_password` only ever
  // accepts a session_id from a just-completed, still-active OTP login,
  // started within the last few minutes -- see that endpoint's own
  // docstring; there is no other path to create one). That guest saw a
  // password tab that could only ever fail for them. Gating the switcher
  // itself on the same device flag, not just the initial selection, means
  // a first-time device gets the single OTP form with nothing to pick
  // between, and only a device that has actually set a password once
  // graduates to seeing -- and defaulting to -- both tabs. A guest who
  // forgets that password is still one tap away from OTP, either via this
  // now-visible tab or `PasswordSignInForm`'s own "Forgot? Use OTP
  // instead" link -- this only changes what a device with NO password
  // history is offered, never what one WITH a password can still reach.
  const showTabs = hasOtp && hasPassword && deviceHasPassword();
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
    eyebrow,
    eyebrowIsVenueName,
    heading,
    subtext,
    previewMode,
    requiresTermsLink,
    dataConsentAccepted,
    setDataConsentAccepted,
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
    dialCode,
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
