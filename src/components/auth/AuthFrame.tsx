import { Suspense, lazy, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { LoginSceneTime } from "./LoginSceneIllustration";

// The illustrated frame for the customer sign-in pages (/login, and the
// forgot/reset/verify pages via AuthLayout), in the illustration style of the
// EkamOS website and sign-in art.
//
// Desktop (lg+): ONE canvas, not a white half next to a coloured half. The
// whole page is the sky; the Wyfy street runs along the bottom edge across the
// full width (a park continues it under the form); the form floats on the sky
// in a white card on the left and the copy sits on the sky on the right.
// Small screens: a band of the same scene on top, the card overlapping its
// lower edge, on a soft lilac page.
//
// Performance: the sky is plain CSS and paints with the first frame; the
// scene SVG is its own lazy chunk (~6 kB gzip), in boxes reserved by aspect
// ratio so it fades in without moving anything (no layout shift).

const LoginSceneIllustration = lazy(() => import("./LoginSceneIllustration"));

/** Page sky per time of day (lg+). The wide scene has a transparent sky, so
 *  this gradient is the sky behind the buildings too -- no seam to match.
 *  `tone` is the text colour for copy on the upper sky: ink #1e1b4b on
 *  #b3a9ff..#c9c2ff is >= 7.9:1; white on #0e0b30..#1a164d is >= 15:1.
 *  `band` is the colour the band scene's own sky starts at (its --wg-sky1,
 *  night --wg-shade composited over it), the band's backdrop while it loads. */
const AUTH_SKY: Record<
  LoginSceneTime,
  { stops: string; band: string; tone: "ink" | "white" }
> = {
  day: { stops: "#b3a9ff 0%, #c9c2ff 45%, #f6f3ff 100%", band: "#c9c2ff", tone: "ink" },
  night: { stops: "#0e0b30 0%, #1a164d 45%, #2b2266 100%", band: "#1a164d", tone: "white" },
};

const AUTH_SKY_TEXT = { ink: "#1e1b4b", white: "#ffffff" } as const;

/** Daylight from 06:00 to 17:59 in the visitor's own timezone. The sign-in
 *  page is pinned to the light palette whatever the OS theme, so the scene
 *  follows the clock rather than dark mode. */
function authSceneTimeFor(hour: number): LoginSceneTime {
  return hour >= 6 && hour < 18 ? "day" : "night";
}

/** Read after mount: these pages are server-rendered, and the server's
 *  clock/timezone is not the visitor's, so reading the hour during render
 *  would mismatch on hydration. Server render and first paint use "day". */
function useAuthSceneTime(): LoginSceneTime {
  const [t, setT] = useState<LoginSceneTime>("day");
  useEffect(() => {
    setT(authSceneTimeFor(new Date().getHours()));
  }, []);
  return t;
}

type Props = {
  /** Inline custom-property overrides (the light-palette pin). */
  style?: CSSProperties;
  /** Copy drawn on the sky beside the card (lg+ only). */
  aside: (tone: "ink" | "white") => ReactNode;
  asideLabel?: string;
  /** The card's contents. */
  children: ReactNode;
};

export function AuthFrame({ style, aside, asideLabel = "About Wyfy Guest", children }: Props) {
  const t = useAuthSceneTime();
  const sky = AUTH_SKY[t];
  return (
    <div
      className="relative isolate min-h-screen overflow-hidden bg-[#f5f2fe] text-slate-900 lg:bg-[image:var(--auth-sky)]"
      style={
        { ...style, "--auth-sky": `linear-gradient(to bottom, ${sky.stops})` } as CSSProperties
      }
      data-time={t}
    >
      {/* lg+: the street along the bottom edge, full width. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden aspect-[5/1] lg:block"
      >
        <Suspense fallback={null}>
          <div className="h-full w-full animate-in fade-in duration-500 motion-reduce:animate-none">
            <LoginSceneIllustration wide timeOfDay={t} className="block h-full w-full" />
          </div>
        </Suspense>
      </div>

      {/* Small screens: a band of the scene on top. `xMidYMax slice` keeps
          the street and ground in view and trims sky first if capped. */}
      <div aria-hidden="true" className="lg:hidden">
        <div
          className="relative aspect-[5/2] max-h-[360px] w-full overflow-hidden"
          style={{ backgroundColor: sky.band }}
        >
          <Suspense fallback={null}>
            <div className="absolute inset-0 animate-in fade-in duration-500 motion-reduce:animate-none">
              <LoginSceneIllustration timeOfDay={t} className="block h-full w-full" />
            </div>
          </Suspense>
        </div>
      </div>

      <div className="relative lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <main className="relative z-10 -mt-3 flex justify-center px-4 pb-10 sm:px-8 lg:mt-0 lg:items-center lg:px-12 lg:py-8 lg:[@media(max-height:800px)]:py-1.5">
          <div className="w-full max-w-[460px] rounded-3xl bg-white p-6 shadow-[0_24px_60px_-20px_rgba(30,27,75,0.35)] ring-1 ring-[#1e1b4b]/5 sm:p-8 lg:[@media(max-height:800px)]:px-7 lg:[@media(max-height:800px)]:py-5">
            {children}
          </div>
        </main>
        <aside
          aria-label={asideLabel}
          className="hidden lg:block"
          style={{ color: AUTH_SKY_TEXT[sky.tone] }}
        >
          {aside(sky.tone)}
        </aside>
      </div>
    </div>
  );
}
