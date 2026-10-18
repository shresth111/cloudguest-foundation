import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LoginSceneTime } from "./LoginSceneIllustration";

// The illustrated sky panel for the customer sign-in pages (/login, and the
// forgot/reset/verify pages via AuthLayout). Layout follows the EkamOS
// sign-in page: on desktop a tall "sky" column beside the form, with the copy
// near the top and the street scene at its foot; on small screens a compact
// band of the same scene above the form.
//
// Performance: the panel's sky is plain CSS and paints with the first frame;
// the ~12 kB scene SVG is its own lazy chunk. Its box is reserved by aspect
// ratio, so the scene fades in without moving anything (no layout shift).

const LoginSceneIllustration = lazy(() => import("./LoginSceneIllustration"));

/** Top and bottom of the panel sky, per time of day. `bottom` is exactly the
 *  colour the scene's own sky starts at (LoginSceneIllustration's --wg-sky1,
 *  with its night --wg-shade composited over it at --wg-shadeop), so the seam
 *  where the SVG begins is invisible. Copied rather than imported: a value
 *  import would pull the whole scene module into this eager chunk.
 *  `tone` is the text colour that reads on `top`: ink #1e1b4b on #b3a9ff is
 *  ~7.9:1; white on #0e0b30 is ~18:1. */
export const AUTH_SKY: Record<
  LoginSceneTime,
  { top: string; bottom: string; tone: "ink" | "white" }
> = {
  day: { top: "#b3a9ff", bottom: "#c9c2ff", tone: "ink" },
  night: { top: "#0e0b30", bottom: "#1a164d", tone: "white" },
};

export const AUTH_SKY_TEXT = { ink: "#1e1b4b", white: "#ffffff" } as const;

/** Daylight from 06:00 to 17:59 in the visitor's own timezone. The sign-in
 *  page is pinned to the light palette whatever the OS theme, so the scene
 *  follows the clock rather than dark mode. */
export function authSceneTimeFor(hour: number): LoginSceneTime {
  return hour >= 6 && hour < 18 ? "day" : "night";
}

type Props = {
  /** `panel`: the tall desktop column (copy on top, scene at the foot).
   *  `band`: the compact strip above the form on small screens. */
  variant: "panel" | "band";
  timeOfDay?: LoginSceneTime;
  className?: string;
  /** Overlay content drawn on the sky (panel only). */
  children?: (tone: "ink" | "white") => ReactNode;
};

/** The visitor's local time of day, read after mount: these pages are
 *  server-rendered, and the server's clock/timezone is not the visitor's, so
 *  reading the hour during render would mismatch on hydration. Server render
 *  and first paint use "day". */
function useAuthSceneTime(override?: LoginSceneTime): LoginSceneTime {
  const [t, setT] = useState<LoginSceneTime>("day");
  useEffect(() => {
    setT(authSceneTimeFor(new Date().getHours()));
  }, []);
  return override ?? t;
}

export function AuthScenePanel({ variant, timeOfDay, className, children }: Props) {
  const t = useAuthSceneTime(timeOfDay);
  const sky = AUTH_SKY[t];
  if (variant === "band") {
    // Fixed-height strip: the SVG's own `xMidYMax slice` keeps the street
    // and the ground in view and trims sky first when the strip is capped.
    return (
      <div
        className={cn("relative overflow-hidden", className)}
        style={{ backgroundColor: sky.bottom }}
        data-time={t}
      >
        <Suspense fallback={null}>
          <div className="absolute inset-0 animate-in fade-in duration-500 motion-reduce:animate-none">
            <LoginSceneIllustration timeOfDay={t} className="block h-full w-full" />
          </div>
        </Suspense>
      </div>
    );
  }
  return (
    <div
      className={cn("relative isolate flex flex-col overflow-hidden", className)}
      style={{ backgroundColor: sky.bottom }}
      data-time={t}
      data-tone={sky.tone}
    >
      {/* The scene is a little wider than the column (centred, outer trees
          cropped) so it holds its own against the tall sky. */}
      <div
        className="flex-1 pb-6 [@media(max-height:800px)]:pb-1"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${sky.top} 0%, ${sky.top} 45%, ${sky.bottom} 100%)`,
        }}
      >
        {children ? children(sky.tone) : null}
      </div>
      <div className="pointer-events-none relative aspect-[800/320] w-[112%] shrink-0 self-center [@media(max-height:800px)]:w-full">
        <Suspense fallback={null}>
          <div className="h-full w-full animate-in fade-in duration-500 motion-reduce:animate-none">
            <LoginSceneIllustration timeOfDay={t} className="block h-full w-full" />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
