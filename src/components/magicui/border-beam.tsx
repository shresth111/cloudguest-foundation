"use client";

// Magic UI "Border Beam" (https://magicui.design/docs/components/border-beam),
// installed via the registry (`npx shadcn@latest add @magicui/border-beam`)
// and adapted to this repo's own `framer-motion` import (the installed
// dependency here is `framer-motion`, not the newer `motion` package Magic
// UI's own registry source imports from -- same package, same API, just the
// import specifier this codebase already uses everywhere else). See design
// v3 spec Part 4: "install that one specific accent... and wrap it around
// the existing StatCard, rather than replacing the counting logic."
import { motion, type MotionStyle, type Transition } from "framer-motion";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  /** The size of the border beam. */
  size?: number;
  /** The duration of the border beam. */
  duration?: number;
  /** The delay of the border beam. */
  delay?: number;
  /** The color of the border beam from. */
  colorFrom?: string;
  /** The color of the border beam to. */
  colorTo?: string;
  /** The motion transition of the border beam. */
  transition?: Transition;
  /** The class name of the border beam. */
  className?: string;
  /** The style of the border beam. */
  style?: React.CSSProperties;
  /** Whether to reverse the animation direction. */
  reverse?: boolean;
  /** The initial offset position (0-100). */
  initialOffset?: number;
  /** The border width of the beam. */
  borderWidth?: number;
}

export const BorderBeam = ({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  // Defaults recolored to this app's own token set (Part 0 Fix 1's
  // cyan/teal `--brand` through to indigo `--primary`) instead of Magic
  // UI's stock orange/purple demo colors -- palette discipline applies to
  // every borrowed effect, not just the marketing site's.
  colorFrom = "var(--brand)",
  colorTo = "var(--primary)",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      <motion.div
        className={cn(
          "absolute aspect-square",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className,
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
};
