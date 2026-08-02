import type { SVGProps } from "react";

/**
 * Not Vi's (Vodafone Idea's) actual (trademarked) logo -- a circular badge
 * in a red-to-pink gradient echoing Vi's real, recognizable brand palette,
 * with its short "Vi" wordmark rendered as plain text. Same convention as
 * every other file in this folder. See `AirtelIcon.tsx` for the rationale.
 */
export function ViIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="vi-icon-gradient" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#EE0A64" />
          <stop offset="100%" stopColor="#9B2FEE" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#vi-icon-gradient)" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        Vi
      </text>
    </svg>
  );
}
