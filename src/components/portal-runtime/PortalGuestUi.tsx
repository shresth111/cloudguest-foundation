import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Small shared visual primitives for the redesigned "light indigo" guest
 * sign-in flow (src/routes/portal.welcome/success/expired.tsx) -- kept
 * here rather than duplicated per-page since the spec calls for the exact
 * same alert banner and connecting overlay everywhere they appear.
 */

/** Inline red alert banner -- "invalid mobile, wrong OTP, wrong password,
 * terms unchecked" per the design spec. Renders nothing when `message` is
 * falsy so callers can pass a possibly-undefined error message directly. */
export function AlertBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * "Connecting" overlay with a progress bar, shown while `active` is true.
 * `active` must be wired directly to a real mutation's own `isPending`
 * (the actual async login/verify call's lifecycle) -- never a fixed
 * setTimeout disconnected from whether a real request is still in flight.
 * The bar itself creeps toward (never reaches) ~92% while the request is
 * outstanding -- ordinary "work is happening, exact progress unknown"
 * UI -- and only ever completes to 100% for an instant right as `active`
 * flips back to false because the real request just resolved.
 */
export function ConnectingOverlay({ active, label }: { active: boolean; label: string }) {
  const [pct, setPct] = useState(0);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (active) {
      setJustFinished(false);
      setPct(10);
      const id = setInterval(() => {
        setPct((p) => Math.min(92, p + (92 - p) * 0.15 + 1));
      }, 160);
      return () => clearInterval(id);
    }
    // Was active a moment ago -- flash to 100% then let the overlay
    // unmount (the caller navigates away right after the real mutation
    // resolves, so this mostly never gets seen mid-fade, but it's honest
    // if it is).
    setPct((p) => (p > 0 ? 100 : 0));
    const t = setTimeout(() => setPct(0), 300);
    return () => clearTimeout(t);
  }, [active]);

  if (!active && pct === 0) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[24px] bg-white/90 px-6 text-center backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-indigo-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5] transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {justFinished && <span className="sr-only">Connected</span>}
    </div>
  );
}

export const PG_PRIMARY_BTN =
  "h-12 w-full rounded-[14px] bg-gradient-to-r from-[#6366f1] to-[#4f46e5] font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 disabled:opacity-60";

export const PG_INPUT =
  "h-11 rounded-[13px] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-500/15";
