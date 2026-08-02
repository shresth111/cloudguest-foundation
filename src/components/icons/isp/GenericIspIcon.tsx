import type { SVGProps } from "react";

/**
 * Fallback badge for any ISP `providerName` that doesn't match one of the
 * recognized brands in `resolveIspBrand` (a smaller/local/international
 * carrier, or a typo'd name) -- a neutral slate circle with a simple globe
 * glyph, deliberately generic rather than guessing at a brand identity it
 * can't confirm.
 */
export function GenericIspIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="12" fill="#64748B" />
      <g stroke="#ffffff" strokeWidth="1.1" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="6.5" />
        <ellipse cx="12" cy="12" rx="2.8" ry="6.5" />
        <path d="M5.5 12h13" />
      </g>
    </svg>
  );
}
