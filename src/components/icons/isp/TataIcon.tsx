import type { SVGProps } from "react";

/**
 * Not Tata's actual (trademarked) logo -- a circular badge in Tata's real,
 * recognizable corporate navy blue with a bold "T", covering both "Tata
 * Communications" and "Tata Play Fiber" (this dashboard's own demo
 * fixtures use "Tata Communications", see `resolveIspBrand`). Same
 * convention as every other file in this folder. See `AirtelIcon.tsx` for
 * the rationale.
 */
export function TataIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="12" fill="#173F8A" />
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        T
      </text>
    </svg>
  );
}
