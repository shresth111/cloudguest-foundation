import type { SVGProps } from "react";

/**
 * Not Airtel's actual (trademarked) logo -- this dashboard's own
 * brand-neutral stand-in: a circular badge in Airtel's real, recognizable
 * corporate red with a bold "A", so an Airtel uplink is instantly
 * scannable next to its name without reproducing anyone's registered mark.
 * Same "colored initial badge" convention every file in this folder uses.
 */
export function AirtelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="12" fill="#ED1C24" />
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        A
      </text>
    </svg>
  );
}
