import type { SVGProps } from "react";

/**
 * Not Vi's (Vodafone Idea's) actual (trademarked) logo -- a badge in a
 * red-to-pink gradient echoing Vi's real, recognizable brand palette, with
 * its short "Vi" wordmark rendered as plain text. Same refined convention
 * (gradient + ring + centered glyph) as every other file in this folder.
 * See `AirtelIcon.tsx` for the rationale.
 */
export function ViIcon(props: SVGProps<SVGSVGElement>) {
  const id = "vi-icon-grad";
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="20" y2="22">
          <stop offset="0%" stopColor="#EE0A64" />
          <stop offset="100%" stopColor="#9B2FEE" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11.25" fill={`url(#${id})`} stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        fill="#ffffff"
        letterSpacing="-0.2"
      >
        Vi
      </text>
    </svg>
  );
}
