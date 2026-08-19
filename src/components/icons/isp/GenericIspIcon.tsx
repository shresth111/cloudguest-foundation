import type { SVGProps } from "react";

/**
 * Fallback badge for any ISP `providerName` that doesn't match one of the
 * recognized brands in `resolveIspBrand` (a smaller/local/international
 * carrier, or a typo'd name) -- a neutral slate badge with a simple globe
 * glyph, deliberately generic rather than guessing at a brand identity it
 * can't confirm. Same refined convention (gradient + ring) as every other
 * file in this folder.
 */
export function GenericIspIcon(props: SVGProps<SVGSVGElement>) {
  const id = "generic-isp-icon-grad";
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="20" y2="22">
          <stop offset="0%" stopColor="#8291A3" />
          <stop offset="100%" stopColor="#4B5768" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="11.25"
        fill={`url(#${id})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.75"
      />
      <g stroke="#ffffff" strokeWidth="1.1" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="6.25" />
        <ellipse cx="12" cy="12" rx="2.7" ry="6.25" />
        <path d="M5.75 12h12.5" />
      </g>
    </svg>
  );
}
