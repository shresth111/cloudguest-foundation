import type { SVGProps } from "react";

/**
 * Not Tata's actual (trademarked) logo -- a badge in Tata's real,
 * recognizable corporate navy blue with a bold "T", covering both "Tata
 * Communications" and "Tata Play Fiber" (this dashboard's own demo
 * fixtures use "Tata Communications", see `resolveIspBrand`). Same refined
 * convention (gradient + ring + centered glyph) as every other file in
 * this folder. See `AirtelIcon.tsx` for the rationale.
 */
export function TataIcon(props: SVGProps<SVGSVGElement>) {
  const id = "tata-icon-grad";
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="20" y2="22">
          <stop offset="0%" stopColor="#2A5CB8" />
          <stop offset="100%" stopColor="#0E2C61" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11.25" fill={`url(#${id})`} stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        fill="#ffffff"
        letterSpacing="-0.2"
      >
        T
      </text>
    </svg>
  );
}
