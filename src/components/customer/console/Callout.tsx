import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutTone = "info" | "ok" | "warn" | "crit";

const TONE: Record<
  CalloutTone,
  { box: string; icon: string; Icon: ComponentType<{ className?: string }> }
> = {
  info: {
    box: "border-[color-mix(in_srgb,var(--wy-info)_28%,transparent)] bg-[var(--wy-info-soft)]",
    icon: "text-[var(--wy-info)]",
    Icon: Info,
  },
  ok: {
    box: "border-[color-mix(in_srgb,var(--wy-ok)_28%,transparent)] bg-[var(--wy-ok-soft)]",
    icon: "text-[var(--wy-ok)]",
    Icon: CheckCircle2,
  },
  warn: {
    box: "border-[color-mix(in_srgb,var(--wy-warn)_32%,transparent)] bg-[var(--wy-warn-soft)]",
    icon: "text-[var(--wy-warn)]",
    Icon: AlertTriangle,
  },
  crit: {
    box: "border-[color-mix(in_srgb,var(--wy-crit)_28%,transparent)] bg-[var(--wy-crit-soft)]",
    icon: "text-[var(--wy-crit)]",
    Icon: XCircle,
  },
};

export interface CalloutProps {
  /** info = context, ok = done/healthy, warn = will have a side effect, crit = blocked/failed. */
  tone?: CalloutTone;
  /** Optional bold lead-in. */
  title?: ReactNode;
  /** The message. Keep it to a sentence or two; long help belongs in a Panel description. */
  children?: ReactNode;
  /** A button or link that resolves it, or a confirm checkbox. Rendered under the text. */
  action?: ReactNode;
  /** Override the tone's default icon; pass `null` for none. */
  icon?: ComponentType<{ className?: string }> | null;
  /** ARIA role. Default none: a callout that is present on load is content, not an announcement. */
  role?: "status" | "alert" | "note";
  className?: string;
}

/** A tinted note in one of four tones: soft token fill, tone icon, body text in `--wy-text`. */
export function Callout({
  tone = "info",
  title,
  children,
  action,
  icon,
  role,
  className,
}: CalloutProps) {
  const t = TONE[tone];
  const Icon = icon === undefined ? t.Icon : icon;
  return (
    <div
      role={role}
      data-tone={tone}
      className={cn(
        "flex gap-2.5 rounded-[var(--wy-radius)] border px-3 py-2.5 text-[13px] leading-relaxed text-[var(--wy-text)]",
        t.box,
        className,
      )}
    >
      {Icon && <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", t.icon)} />}
      <div className="min-w-0 flex-1">
        {title != null && <p className="font-semibold">{title}</p>}
        {children != null && <div className="text-[var(--wy-text)]">{children}</div>}
        {action != null && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
