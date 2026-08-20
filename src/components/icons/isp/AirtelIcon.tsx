import type { SVGProps } from "react";

/**
 * Not Airtel's actual (trademarked) logo -- this dashboard's own
 * brand-neutral stand-in: a badge in Airtel's real, recognizable corporate
 * red with a bold "A", so an Airtel uplink is instantly scannable next to
 * its name without reproducing anyone's registered mark. A subtle gradient
 * + ring replace the earlier flat-circle-and-text version, which read as
 * crude/placeholder-looking at the small size these actually render at
 * (~20px, next to location-card ISP labels) -- same "colored initial
 * badge" convention every file in this folder uses, just refined.
 */
export function AirtelIcon(props: SVGProps<SVGSVGElement>) {
  const id = "airtel-icon-grad";
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="20" y2="22">
          <stop offset="0%" stopColor="#FF4757" />
          <stop offset="100%" stopColor="#C4121A" />
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
        A
      </text>
    </svg>
  );
}
