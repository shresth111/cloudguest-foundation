import type { SVGProps } from "react";

/**
 * Not Jio's actual (trademarked) logo -- a circular badge in Jio's real,
 * recognizable corporate blue with a bold "J", same convention as every
 * other file in this folder. See `AirtelIcon.tsx` for the rationale.
 */
export function JioIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="12" fill="#0033A0" />
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        J
      </text>
    </svg>
  );
}
