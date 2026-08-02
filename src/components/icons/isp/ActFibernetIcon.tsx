import type { SVGProps } from "react";

/**
 * Not ACT Fibernet's actual (trademarked) logo -- a circular badge in
 * ACT's real, recognizable corporate blue with its short "ACT" wordmark
 * rendered as plain text. Same convention as every other file in this
 * folder. See `AirtelIcon.tsx` for the rationale.
 */
export function ActFibernetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="12" fill="#0099CC" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        ACT
      </text>
    </svg>
  );
}
