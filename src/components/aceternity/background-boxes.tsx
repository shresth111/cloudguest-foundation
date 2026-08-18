// Adapted from Aceternity UI's "Background Boxes"
// (https://ui.aceternity.com/components/background-boxes-background), the
// one place design v3 Part 4 sanctions an Aceternity moment on this surface:
// "a first-run 'no locations yet' or 'connect your first router' empty
// state ... a single, well-chosen component ... is appropriate there
// specifically, and nowhere else on this surface."
//
// NOT a drop-in copy of the registry component. Aceternity's own source
// renders a 150x100 (15,000-node) interactive hover grid, each cell wired
// to `whileHover` + a `Math.random()` color -- fine for a landing-page demo,
// a real readability/perf tax if shipped as-is into a data-density product
// used for hours daily (exactly what Part 4's "Don't" section warns against
// for persistent chrome, and there's no reason an *empty-state* accent
// should cost more than the dense screens around it). Re-authored per this
// spec's own Part 2 precedent ("port the effect category... re-implement as
// hand-authored CSS") as a small, fully static, non-interactive, aria-hidden
// grid: no JS animation, no `framer-motion`, no per-cell random color, no
// off-brand rainbow palette -- one faint on-brand tone, radial-masked so it
// reads as atmosphere behind the empty-state icon/copy, not a second focal
// point competing with it.
export function BackgroundBoxes({ className = "" }: { className?: string }) {
  const cols = 14;
  const rows = 6;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)] ${className}`}
    >
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2"
        style={{ transform: "translate(-50%,-50%) skewX(-16deg) skewY(6deg) scale(1.15)" }}
      >
        {Array.from({ length: cols }).map((_, col) => (
          <div key={col} className="flex flex-col">
            {Array.from({ length: rows }).map((_, row) => (
              <div
                key={row}
                className="h-7 w-9 border-b border-r border-primary/[0.08] dark:border-primary/[0.14]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
