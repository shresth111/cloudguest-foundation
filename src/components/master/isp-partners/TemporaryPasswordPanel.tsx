import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { MButton } from "@/components/master/MasterKit";
import type { IspOwnerCredential } from "@/services/isp-partner/platform";

/**
 * The one-time view of an ISP user's temporary password. The backend returns
 * it exactly once (create, add owner, reset password) and never again, so the
 * page holds it only in component state and says so.
 */
export function TemporaryPasswordPanel({
  credential,
  title = "Temporary password",
}: {
  credential: IspOwnerCredential;
  title?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Sign-in email", value: credential.email },
    { label: "Username", value: credential.username, mono: true },
    { label: "Temporary password", value: credential.temporaryPassword, mono: true },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-amber-600" /> {title}
      </div>
      <p className="text-xs text-muted-foreground">
        Shown once. It is not stored anywhere this page can read again. Hand it to the ISP over a
        channel you trust. They must set a new password at first sign-in.
      </p>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">{r.label}</dt>
              <dd className={r.mono ? "break-all font-mono text-sm" : "break-all text-sm"}>
                {r.value}
              </dd>
            </div>
            <MButton
              variant="outline"
              type="button"
              aria-label={`Copy ${r.label.toLowerCase()}`}
              onClick={() => copy(r.label, r.value)}
            >
              {copied === r.label ? <Check /> : <Copy />}
            </MButton>
          </div>
        ))}
      </dl>
      <a
        href={credential.loginUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        Open {hostOf(credential.loginUrl)} <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
