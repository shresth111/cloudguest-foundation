/**
 * Overview-only helpers on top of the shared console primitives
 * (`@/components/customer/console`). The shared StatusDot / Panel /
 * SegmentedControl / EmptyState are used directly; what lives here is what
 * they deliberately do not cover:
 *   - `OverviewStatus`: the shared five states plus `unknown`. The topology
 *     model keeps "we could not tell" apart from "offline / not applicable"
 *     because they get different words; both render as the shared grey.
 *   - `StatusDot`: the shared dot, fed that six-state vocabulary and a
 *     translated label, so no call site renders an unlabeled dot.
 *   - `PanelTitle`, `PanelLink`, `SectionBoundary`, `SectionFailed`.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CONSOLE_STATUS_WORD,
  PANEL_SURFACE,
  Panel,
  StatusDot as SharedStatusDot,
  type ConsoleStatus as SharedStatus,
} from "@/components/customer/console";
import { toSharedStatus, type OverviewStatus } from "./console-shared";

export type { OverviewStatus } from "./console-shared";

/** The shared StatusDot, with the Overview's six-state vocabulary and a
 * translated accessible name by default. `live` pulses only an ok dot. */
export function StatusDot({
  status,
  live = false,
  className,
  label,
}: {
  status: OverviewStatus;
  live?: boolean;
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  return (
    <SharedStatusDot
      status={toSharedStatus(status)}
      label={label ?? t(`topology.status.${status}`, CONSOLE_STATUS_WORD[status])}
      pulse={live && status === "ok"}
      className={className}
    />
  );
}

/** Same surface as the shared Panel, for the few blocks that are not a
 * header + body (the site-health band, error fallbacks). The class string
 * now lives with Panel itself, so the two cannot drift. */
export const PANEL = PANEL_SURFACE;

/** A Panel title with a leading icon. `id` lets a region point
 * `aria-labelledby` at it. */
export function PanelTitle({
  icon,
  id,
  children,
}: {
  icon?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {icon && (
        <span
          className="shrink-0 text-[var(--wy-text-faint)] [&_svg]:h-3.5 [&_svg]:w-3.5"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span id={id} className="truncate">
        {children}
      </span>
    </span>
  );
}

export { Panel };

/** Text-button link used in panel headers ("View all"). */
export function PanelLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-1 text-xs font-medium text-[var(--wy-accent)] transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
    >
      {children}
    </button>
  );
}

/** A section that crashes renders its own fallback instead of taking the
 * page down -- the insight cards once did exactly that on a wrong-shaped
 * body. Overview-only. */
export class SectionBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[dashboard] section "${this.props.name}" failed to render`, error, info);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The fallback a SectionBoundary shows. */
export function SectionFailed({ title, body }: { title: string; body: string }) {
  return (
    <div className={cn(PANEL, "px-4 py-6 text-center")} role="alert" data-state="error">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--wy-text-muted)]">{body}</p>
    </div>
  );
}
