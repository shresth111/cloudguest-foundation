import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * One pasteable block: a label, the script itself, and a deliberately
 * large Copy button (this is used one-handed, on a phone, standing next
 * to a router).
 *
 * The "copied" tick here is cosmetic on purpose and says so in the UI.
 * A clipboard write proves nothing about the device -- the operator can
 * copy, tab away, paste into the wrong window, and come back to a green
 * tick. The only real progress signal in this module is a check answered
 * "Haan", so nothing on this component is allowed to unlock anything.
 */
export function CopyBlock({
  label,
  script,
  index,
  total,
}: {
  label: string;
  script: string;
  index: number;
  total: number;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyToClipboard(script);
    if (!ok) {
      toast.error("Copy nahi hua -- neeche se manually select karke copy karo.");
      return;
    }
    setCopied(true);
    toast.success("Copy ho gaya -- ab WinBox Terminal me paste karo");
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">
          {total > 1 && (
            <span className="mr-1.5 text-muted-foreground">
              {index + 1}/{total}
            </span>
          )}
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
            copied
              ? "bg-emerald-600 text-white"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
          {copied ? "Copy ho gaya" : "Copy karo"}
        </button>
      </div>
      <pre className="max-h-60 overflow-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground">
        {script}
      </pre>
    </div>
  );
}
