import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { MarketingTemplate } from "@/types/marketing";
import {
  CHANNEL_ICON,
  SENDABLE_REASON_LABEL,
  templateChannels,
  useChannelLabel,
} from "../marketing-helpers";

/** One chip per channel the template has text for, with whether it can be
 * SENT on that channel right now (`sendable`, computed by the server for
 * this organisation) and, if not, why -- in words, not just a tooltip, so
 * it reads on a phone. */
export function SendableChips({ template }: { template: MarketingTemplate }) {
  const label = useChannelLabel();
  return (
    <ul className="space-y-1">
      {templateChannels(template).map((c) => {
        const s = template.sendable[c];
        const Icon = CHANNEL_ICON[c];
        return (
          <li key={c} className="flex items-start gap-1.5 text-[11px]">
            <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium">{label(c)}</span>
            {s?.ok ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Ready to send
              </span>
            ) : (
              <span className="inline-flex items-start gap-0.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                {(s?.reason && SENDABLE_REASON_LABEL[s.reason]) || "Not sendable yet"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
