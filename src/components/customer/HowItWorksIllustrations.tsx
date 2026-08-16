/**
 * Icon set for the "How the dashboard works" help page
 * (src/components/customer/HowItWorksPage.tsx). One badge illustration per
 * sidebar group (Overview / Engagement / Access & Policy / Devices & Team /
 * Network) plus a hero graphic for the page header.
 *
 * Shared visual system: every group badge is a rounded (rx=18 on a 64-unit
 * box) `#6366f1 -> #7c3aed` gradient chip holding white line-art (14% fill /
 * 55% stroke) plus one `#22d3ee -> #f0abfc` accent element -- the same
 * palette CustomerFeaturePage.tsx's own illustrations (DashboardWatch,
 * ConnectedDevices) already use. The Overview badge deliberately extends
 * DashboardWatchIllustration's pulse-monitor motif and the Network badge
 * extends ConnectedDevicesIllustration's hub-and-node motif, rather than
 * inventing new ones, so this help page reads as the same illustration
 * family a customer has already seen elsewhere in their dashboard.
 *
 * All gradient/clipPath ids are prefixed per icon (ov-/en-/ap-/dt-/nw-/
 * hero-) so multiple icons can share one page without id collisions.
 */

interface IllustrationProps {
  className?: string;
}

export function OverviewIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="ov-badge" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="ov-accent" x1="14" y1="34" x2="55" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <clipPath id="ov-clip"><rect x="2" y="2" width="60" height="60" rx="18" /></clipPath>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#ov-badge)" />
      <g clipPath="url(#ov-clip)"><ellipse cx="32" cy="8" rx="28" ry="14" fill="#ffffff" opacity="0.08" /></g>
      <rect x="14" y="20" width="34" height="24" rx="6" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.75" />
      <path d="M18 34h6l3-7 4 12 3-9 2 4h10" stroke="url(#ov-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 46l-2.5 6h15l-2.5-6" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="17" r="8.5" fill="#241f4d" stroke="url(#ov-accent)" strokeWidth="2" />
      <path d="M43.5 17l2.3 2.3 4.2-4.6" stroke="url(#ov-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EngagementIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="en-badge" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="en-accent" x1="12" y1="32" x2="53" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <clipPath id="en-clip"><rect x="2" y="2" width="60" height="60" rx="18" /></clipPath>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#en-badge)" />
      <g clipPath="url(#en-clip)"><ellipse cx="32" cy="8" rx="28" ry="14" fill="#ffffff" opacity="0.08" /></g>
      <rect x="11" y="22" width="23" height="20" rx="4" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.75" />
      <line x1="23" y1="25" x2="23" y2="39" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="2 2.5" strokeLinecap="round" />
      <circle cx="17.5" cy="32" r="2.3" fill="url(#en-accent)" />
      <path d="M35 22a10 10 0 0 1 0 20" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M35 16a16 16 0 0 1 0 32" stroke="url(#en-accent)" strokeWidth="2.25" strokeLinecap="round" fill="none" />
      <circle cx="51" cy="32" r="3.2" fill="url(#en-accent)" />
    </svg>
  );
}

export function AccessPolicyIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="ap-badge" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="ap-accent" x1="20" y1="20" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <clipPath id="ap-clip"><rect x="2" y="2" width="60" height="60" rx="18" /></clipPath>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#ap-badge)" />
      <g clipPath="url(#ap-clip)"><ellipse cx="32" cy="8" rx="28" ry="14" fill="#ffffff" opacity="0.08" /></g>
      <path d="M29 14l13 4.5v11.7c0 9.3-5.2 15.6-13 18.8-7.8-3.2-13-9.5-13-18.8V18.5z" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.9" strokeLinejoin="round" />
      <rect x="21" y="29" width="16" height="4.2" rx="2.1" fill="url(#ap-accent)" />
      <circle cx="45" cy="43" r="9" fill="#241f4d" stroke="url(#ap-accent)" strokeWidth="2" />
      <path d="M45 38.5v4.5l3 2.2" stroke="url(#ap-accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function DevicesTeamIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="dt-badge" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="dt-accent" x1="24" y1="24" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <clipPath id="dt-clip"><rect x="2" y="2" width="60" height="60" rx="18" /></clipPath>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#dt-badge)" />
      <g clipPath="url(#dt-clip)"><ellipse cx="32" cy="8" rx="28" ry="14" fill="#ffffff" opacity="0.08" /></g>
      <rect x="10" y="16" width="23" height="17" rx="3" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.75" />
      <line x1="14" y1="21" x2="26" y2="21" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="25.5" x2="21" y2="25.5" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="43" cy="27" r="7" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.9" />
      <path d="M32 50a11.5 11.5 0 0 1 23 0z" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="32.5" cy="34.5" r="3.4" fill="url(#dt-accent)" />
      <circle cx="32.5" cy="34.5" r="6" fill="none" stroke="url(#dt-accent)" strokeOpacity="0.4" strokeWidth="1.5" />
    </svg>
  );
}

export function NetworkIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="nw-badge" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="nw-accent" x1="12" y1="14" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <clipPath id="nw-clip"><rect x="2" y="2" width="60" height="60" rx="18" /></clipPath>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#nw-badge)" />
      <g clipPath="url(#nw-clip)"><ellipse cx="32" cy="8" rx="28" ry="14" fill="#ffffff" opacity="0.08" /></g>
      <line x1="32" y1="29" x2="18.5" y2="20.5" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <line x1="32" y1="29" x2="46.5" y2="20.5" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <line x1="32" y1="37" x2="32" y2="47" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <rect x="12" y="13" width="10" height="8" rx="2.2" fill="#241f4d" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" />
      <rect x="42" y="13" width="10" height="8" rx="2.2" fill="#241f4d" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" />
      <rect x="27" y="47" width="10" height="8" rx="2.2" fill="#241f4d" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="1.4" fill="url(#nw-accent)" />
      <circle cx="47" cy="17" r="1.4" fill="url(#nw-accent)" />
      <circle cx="32" cy="51" r="1.4" fill="url(#nw-accent)" />
      <circle cx="32" cy="33" r="7.5" fill="#241f4d" stroke="url(#nw-accent)" strokeWidth="2.2" />
      <path d="M28.5 33h7M32 29.5v7" stroke="url(#nw-accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function HowItWorksHeroIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 480 220" width="100%" height="auto" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="hero-panel" x1="8" y1="8" x2="472" y2="212" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e1b4b" /><stop offset="55%" stopColor="#312e81" /><stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="hero-badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="hero-accent" x1="196" y1="88" x2="284" y2="144" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <clipPath id="hero-clip"><rect x="8" y="8" width="464" height="204" rx="28" /></clipPath>
        <filter id="hero-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26" /></filter>
      </defs>
      <rect x="8" y="8" width="464" height="204" rx="28" fill="url(#hero-panel)" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1.5" />
      <g clipPath="url(#hero-clip)">
        <circle cx="420" cy="18" r="90" fill="#6C4EFF" opacity="0.25" filter="url(#hero-blur)" />
        <circle cx="40" cy="212" r="100" fill="#8B5CF6" opacity="0.18" filter="url(#hero-blur)" />
        <ellipse cx="240" cy="14" rx="220" ry="40" fill="#ffffff" opacity="0.05" />
      </g>
      <line x1="205" y1="95" x2="90" y2="58" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <line x1="275" y1="95" x2="390" y2="58" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <line x1="205" y1="125" x2="90" y2="162" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <line x1="275" y1="125" x2="390" y2="162" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
      <rect x="196" y="88" width="88" height="56" rx="12" fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2.2" />
      <path d="M206 116h14l7-16 9 28 7-21 5 9h24" stroke="url(#hero-accent)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M224 144l-6 14h44l-6-14" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="268" cy="92" r="15" fill="#241f4d" stroke="url(#hero-accent)" strokeWidth="3" />
      <path d="M260 92l5 5 10-11" stroke="url(#hero-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="46" y="26" width="40" height="40" rx="12" fill="url(#hero-badge)" />
      <rect x="53" y="36" width="14" height="14" rx="2.5" fill="#ffffff" fillOpacity="0.16" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" />
      <circle cx="58" cy="43" r="1.6" fill="url(#hero-accent)" />
      <path d="M67 36a7 7 0 0 1 0 14" stroke="url(#hero-accent)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <rect x="394" y="26" width="40" height="40" rx="12" fill="url(#hero-badge)" />
      <path d="M414 34l7 2.4v6.2c0 5-2.8 8.3-7 10-4.2-1.7-7-5-7-10v-6.2z" fill="#ffffff" fillOpacity="0.16" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="408.5" y="42" width="11" height="2.6" rx="1.3" fill="url(#hero-accent)" />
      <rect x="46" y="154" width="40" height="40" rx="12" fill="url(#hero-badge)" />
      <rect x="52" y="162" width="13" height="9.5" rx="1.8" fill="#ffffff" fillOpacity="0.16" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.3" />
      <circle cx="74" cy="167" r="4" fill="#ffffff" fillOpacity="0.16" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.3" />
      <path d="M68 182a6.5 6.5 0 0 1 13 0z" fill="#ffffff" fillOpacity="0.16" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="65" cy="174.5" r="1.8" fill="url(#hero-accent)" />
      <rect x="394" y="154" width="40" height="40" rx="12" fill="url(#hero-badge)" />
      <circle cx="414" cy="174" r="5.5" fill="#241f4d" stroke="url(#hero-accent)" strokeWidth="1.6" />
      <circle cx="404" cy="162" r="1.6" fill="url(#hero-accent)" />
      <circle cx="424" cy="162" r="1.6" fill="url(#hero-accent)" />
      <circle cx="414" cy="186" r="1.6" fill="url(#hero-accent)" />
    </svg>
  );
}
