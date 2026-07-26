import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Wifi, Smartphone, Mail, Ticket, KeyRound } from "lucide-react";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner, ConnectingOverlay, PG_INPUT, PG_PRIMARY_BTN } from "./PortalGuestUi";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";
import { deviceHasPassword, markDeviceHasPassword } from "@/lib/portal-returning-guest";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

/**
 * The redesigned guest sign-in card: centered logo mark, "Welcome to
 * [venue]" heading, a pill two-tab toggle ("New user · Mobile OTP" /
 * "Registered user"), and each tab's real, already-working backend call
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
    selectedMethod,
    setSelectedMethod,
    setSession,
    termsAccepted,
    setTermsAccepted,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/welcome" });
  const portalSearch = { organizationId, locationId, routerId };

  const methods: RuntimeAuthMethod[] = config ? enabledAuthMethods(config) : [];
  const hasOtpSms = methods.includes("otp_sms");
  const hasOtpEmail = methods.includes("otp_email");
  const hasOtp = hasOtpSms || hasOtpEmail;
  const hasPassword = methods.includes("username_password");
  const hasVoucher = methods.includes("voucher");

  const [otpChannel, setOtpChannel] = useState<"sms" | "email">(hasOtpSms ? "sms" : "email");
  const [tab, setTab] = useState<"otp" | "password">(() => {
    // An explicit hand-off (the expired screen's "Sign in again"/"Use OTP
    // instead" buttons, see src/routes/portal.expired.tsx) always wins.
    if (selectedMethod === "username_password" && hasPassword) return "password";
    if ((selectedMethod === "otp_sms" || selectedMethod === "otp_email") && hasOtp) return "otp";
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
    else if ((selectedMethod === "otp_sms" || selectedMethod === "otp_email") && hasOtp)
      setTab("otp");
    else if (hasPassword && deviceHasPassword()) setTab("password");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOtp, hasPassword]);

  const venueName = config?.name;
  const heading =
    config?.splashHeadline?.trim() || (venueName ? `Welcome to ${venueName}` : "Welcome");
  const subtext =
    config?.splashWelcomeMessage?.trim() ||
    "Sign in for complimentary WiFi access on this network.";

  const requiresTermsLink = !!(
    config?.termsAndConditionsText ||
    config?.termsAndConditionsUrl ||
    config?.privacyPolicyText ||
    config?.privacyPolicyUrl
  );

  // ---- OTP tab state -------------------------------------------------
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const identifierForChannel = otpChannel === "sms" ? countryCode + phone : email;

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
      setOtpError(e.message);
    },
  });

  const verifyOtp = useMutation({
    mutationFn: (c: string) =>
      portalRuntimeService.loginWithOtp({
        identifier: target,
        code: c,
        authMethod: otpChannel === "sms" ? "otp_sms" : "otp_email",
        organizationId,
        locationId,
        routerId,
      }),
    onSuccess: async (session) => {
      setOtpError(null);
      setSelectedMethod(otpChannel === "sms" ? "otp_sms" : "otp_email");
      await afterLogin(session);
    },
    onError: (e: AppError) => setOtpError(e.message),
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
      }),
    onSuccess: async (session) => {
      setPasswordError(null);
      setSelectedMethod("username_password");
      await afterLogin(session);
    },
    onError: (e: AppError) => setPasswordError(e.message),
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
    // Real navigation target: the ad interstitial if this location has
    // one configured, else straight to the success screen -- identical
    // destination logic every other real login path in this codebase
    // uses (see e.g. src/routes/portal.welcome.tsx's onPasswordLoggedIn).
    navigate({
      to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
      search: (prev) => prev,
    });
  }

  const onSendOtp = () => {
    const id = identifierForChannel.trim();
    if (
      otpChannel === "sms" ? id.replace(countryCode, "").trim().length < 6 : !/.+@.+\..+/.test(id)
    ) {
      setOtpError(
        otpChannel === "sms" ? "Enter a valid mobile number" : "Enter a valid email address",
      );
      return;
    }
    setOtpError(null);
    sendOtp.mutate(id);
  };

  const onVerifyOtp = () => {
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code");
      return;
    }
    if (!termsAccepted) {
      setOtpError("Please accept the Terms & Acceptable Use Policy to continue.");
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
      setPasswordError("Enter your phone/email and password");
      return;
    }
    if (!termsAccepted) {
      setPasswordError("Please accept the Terms & Acceptable Use Policy to continue.");
      return;
    }
    loginPassword.mutate();
  };

  const otherMethodLinks = useMemo(() => {
    const links: { label: string; icon: typeof Ticket; onClick: () => void }[] = [];
    if (tab === "otp" && hasOtpSms && hasOtpEmail) {
      links.push({
        label: otpChannel === "sms" ? "Use email instead" : "Use mobile number instead",
        icon: otpChannel === "sms" ? Mail : Smartphone,
        onClick: () => {
          setOtpChannel((c) => (c === "sms" ? "email" : "sms"));
          setPhase("phone");
          setOtpError(null);
        },
      });
    }
    return links;
  }, [tab, hasOtpSms, hasOtpEmail, otpChannel]);

  const showTabs = hasOtp && hasPassword;
  const noMethods = !hasOtp && !hasPassword && !hasVoucher;

  const TermsCheckbox = (
    <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
      <Checkbox
        checked={termsAccepted}
        onCheckedChange={(v) => setTermsAccepted(!!v)}
        className="mt-0.5 border-slate-300 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
      />
      <span>
        I agree to the{" "}
        {requiresTermsLink ? (
          <Link
            to="/portal/terms"
            search={portalSearch}
            className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
          >
            Terms &amp; Acceptable Use Policy
          </Link>
        ) : (
          <span className="font-medium text-slate-800">Terms &amp; Acceptable Use Policy</span>
        )}
      </span>
    </label>
  );

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <div
          className="grid h-14 w-14 place-items-center rounded-2xl shadow-lg shadow-indigo-500/25"
          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
        >
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <Wifi className="h-7 w-7 text-white" />
          )}
        </div>
        <h1
          className="mt-4 text-[26px] font-bold leading-tight text-slate-900"
          style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
        >
          {heading}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">{subtext}</p>
      </div>

      <PortalCard variant="light" className="relative">
        <ConnectingOverlay
          active={verifyOtp.isPending || loginPassword.isPending}
          label={verifyOtp.isPending ? "Verifying your code…" : "Signing you in…"}
        />

        {noMethods ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No sign-in methods are available. Please contact reception.
          </p>
        ) : (
          <>
            {showTabs && (
              <div
                role="tablist"
                aria-label="Sign-in method"
                className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-indigo-50 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "otp"}
                  onClick={() => setTab("otp")}
                  className={
                    "rounded-full px-2 py-2 text-[13px] font-semibold transition " +
                    (tab === "otp"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700")
                  }
                >
                  New user · Mobile OTP
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "password"}
                  onClick={() => setTab("password")}
                  className={
                    "rounded-full px-2 py-2 text-[13px] font-semibold transition " +
                    (tab === "password"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700")
                  }
                >
                  Registered user
                </button>
              </div>
            )}

            {tab === "otp" && hasOtp && (
              <div className="space-y-3.5">
                {phase === "phone" ? (
                  <>
                    <label className="text-xs font-semibold text-slate-500">
                      {otpChannel === "sms" ? "Mobile number" : "Email address"}
                    </label>
                    {otpChannel === "sms" ? (
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
                      {sendOtp.isPending ? "Sending…" : "Send OTP"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-center text-sm text-slate-500">
                      We sent a 6-digit code to{" "}
                      <span className="font-semibold text-slate-800">{target}</span>
                    </p>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                        <InputOTPGroup className="gap-2">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-12 w-10 rounded-[12px] border-slate-200 bg-white text-lg font-semibold text-slate-900 first:rounded-[12px] last:rounded-[12px]"
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
                      {verifyOtp.isPending ? "Verifying…" : "Verify OTP & connect"}
                    </button>
                    <div className="flex items-center justify-center gap-3 pt-0.5 text-xs">
                      {resendCooldown > 0 ? (
                        <span className="text-slate-400">
                          Resend available in {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendOtp.mutate(target)}
                          disabled={sendOtp.isPending}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          Resend
                        </button>
                      )}
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={onChangeNumber}
                        className="font-medium text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        Change number
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
                    Mobile number or email
                  </label>
                  <Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or +1 555 010 2200"
                    className={`${PG_INPUT} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Password</label>
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
                  {loginPassword.isPending ? "Signing in…" : "Sign in & connect"}
                </button>
                {hasOtp && (
                  <button
                    type="button"
                    onClick={() => setTab("otp")}
                    className="block w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                  >
                    Forgot? Use OTP instead
                  </button>
                )}
              </div>
            )}

            {!hasOtp && !hasPassword && hasVoucher && (
              <p className="py-2 text-center text-xs text-slate-500">
                This location signs guests in with a voucher code --{" "}
                <Link
                  to="/portal/auth/$method"
                  params={{ method: "voucher" }}
                  search={portalSearch}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  redeem yours here
                </Link>
                .
              </p>
            )}

            {otherMethodLinks.length > 0 && (
              <div className="mt-3 flex flex-col items-center gap-1.5">
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
              </div>
            )}

            {hasVoucher && (hasOtp || hasPassword) && (
              <Link
                to="/portal/auth/$method"
                params={{ method: "voucher" }}
                search={portalSearch}
                className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
              >
                <Ticket className="h-3.5 w-3.5" /> Have a voucher code? Use it instead
              </Link>
            )}
          </>
        )}
      </PortalCard>

      {tab === "password" && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <KeyRound className="h-3 w-3" /> Saved passwords are set right after your first OTP
          sign-in.
        </p>
      )}
    </div>
  );
}
