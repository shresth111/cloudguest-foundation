import type { SVGProps } from "react";

/**
 * Not BSNL's actual (trademarked) logo -- a circular badge in BSNL's real,
 * recognizable corporate blue (with a small red accent, echoing its
 * two-tone brand palette without reproducing the mark itself) and a bold
 * "B". Same convention as every other file in this folder. See
 * `AirtelIcon.tsx` for the rationale.
 */
export function BsnlIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="12" fill="#004C97" />
      <circle cx="18.5" cy="6.5" r="3" fill="#E4002B" />
      <text
        x="11"
        y="16.3"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        B
      </text>
    </svg>
  );
}
