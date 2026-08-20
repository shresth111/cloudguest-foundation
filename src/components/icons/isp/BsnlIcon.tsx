import type { SVGProps } from "react";

/**
 * Not BSNL's actual (trademarked) logo -- a badge in BSNL's real,
 * recognizable corporate blue with a bold "B" and a small red accent
 * sliver echoing its two-tone brand palette. The earlier version's
 * free-floating accent dot sat awkwardly across the circle's own edge at
 * small sizes and read as a stray mark rather than a deliberate accent --
 * replaced with a clean corner wedge that stays inside the badge's own
 * silhouette. Same refined convention (gradient + ring + centered glyph)
 * as every other file in this folder. See `AirtelIcon.tsx` for the
 * rationale.
 */
export function BsnlIcon(props: SVGProps<SVGSVGElement>) {
  const id = "bsnl-icon-grad";
  const clip = "bsnl-icon-clip";
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="20" y2="22">
          <stop offset="0%" stopColor="#0A66B8" />
          <stop offset="100%" stopColor="#00325E" />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="12" cy="12" r="11.25" />
        </clipPath>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="11.25"
        fill={`url(#${id})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.75"
      />
      <path d="M24 0 L24 8 L16 0 Z" fill="#E4002B" opacity="0.9" clipPath={`url(#${clip})`} />
      <text
        x="11.5"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        fill="#ffffff"
        letterSpacing="-0.2"
      >
        B
      </text>
    </svg>
  );
}
