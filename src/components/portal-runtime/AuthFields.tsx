import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { PG_INPUT } from "./PortalGuestUi";

/**
 * v4 §6.8: the real fields a guest fills in (phone/country-code, email,
 * a 6-digit code) used to be hand-authored twice -- once inline in
 * `GuestSignInCard.tsx` (the real primary path almost every guest takes)
 * and once in `AuthMethodForms.tsx` (the legacy per-method deep-link
 * pages, kept for bookmarks). §3.2/§3.8 of the UX audit are direct
 * symptoms of that split (the two disagreed on resend-cooldown
 * behavior because they were two separate implementations of "the same
 * form"). These are the shared, single-implementation pieces both now
 * render -- not a new visual, the exact same markup/classes each side
 * already used, just written once.
 */

export function PhoneNumberFields({
  countryCode,
  onCountryCodeChange,
  phone,
  onPhoneChange,
  countryCodeName,
  phoneName,
}: {
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  /** Passed through as `name`/registered via `react-hook-form` when a
   * caller (AuthMethodForms.tsx) drives this field with `register(...)`
   * instead of controlled `value`/`onChange` -- both callers still render
   * the identical DOM/classes either way. */
  countryCodeName?: string;
  phoneName?: string;
}) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-2">
      <Input
        name={countryCodeName}
        value={countryCode}
        onChange={(e) => onCountryCodeChange(e.target.value)}
        className={PG_INPUT}
      />
      <Input
        name={phoneName}
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        inputMode="tel"
        placeholder="555 010 2200"
        className={PG_INPUT}
      />
    </div>
  );
}

export function EmailField({
  email,
  onEmailChange,
  name,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  name?: string;
}) {
  return (
    <Input
      name={name}
      value={email}
      onChange={(e) => onEmailChange(e.target.value)}
      type="email"
      placeholder="you@example.com"
      className={PG_INPUT}
    />
  );
}

/** The shared 6-digit OTP slot styling -- `GuestSignInCard`'s inline
 * verify step and `/portal/verify`'s deep-linkable one now render the
 * identical slot markup instead of two independently hand-tuned copies
 * (the deep-link page's used to also carry a stray `font-display`
 * class the inline one never had). */
export function OtpCodeInput({
  value,
  onChange,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-center", className)}>
      <InputOTP maxLength={6} value={value} onChange={onChange} autoFocus={autoFocus}>
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
  );
}
