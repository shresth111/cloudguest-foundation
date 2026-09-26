import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMarketingTemplates, useVerifyProvider } from "@/hooks/useMarketing";
import type { MarketingChannel, ProviderVerifyResult } from "@/types/marketing";
import { marketingErrorMessage, useChannelLabel } from "../marketing-helpers";

/**
 * Verify the venue's own provider (spec §12.4): a REAL call to the provider
 * -- credentials, then a test message. The result is shown check by check
 * exactly as the server reports it; "verified" is the server's word, only
 * after every check passed.
 *
 * SMS needs one of the venue's OWN templates with its own DLT template id:
 * a free-text body would be dropped by carriers and the check would lie.
 */
export function VerifyProviderDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: MarketingChannel;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const label = useChannelLabel();
  const verify = useVerifyProvider();
  const [to, setTo] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [result, setResult] = useState<ProviderVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const templates = useMarketingTemplates({
    channel: "sms",
    include_system: false,
    page: 1,
    page_size: 100,
  });
  const ownSmsTemplates = (templates.data?.items ?? []).filter(
    (t) => !t.is_system && !!t.sms?.dlt_template_id,
  );

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  const needsTo = channel === "sms" || channel === "email";
  const canGo =
    !verify.isPending && (!needsTo || to.trim().length > 3) && (channel !== "sms" || !!templateId);

  const go = async () => {
    setError(null);
    setResult(null);
    try {
      const r = await verify.mutateAsync({
        channel,
        body: { test_to: to.trim() || null, template_id: channel === "sms" ? templateId : null },
      });
      setResult(r);
      if (r.provider.status === "verified")
        toast.success(`Your ${label(channel)} provider is verified.`);
      else toast.error("Verification failed. See the checks below.");
    } catch (err) {
      setError(marketingErrorMessage(err, "Couldn't run the verification."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !verify.isPending && onOpenChange(o)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Verify your {label(channel)} provider</DialogTitle>
          <DialogDescription>
            Wyfy checks your credentials, then sends one real test message through your account.
            Test messages count toward today's test-send limit.
          </DialogDescription>
        </DialogHeader>

        {needsTo && (
          <div className="space-y-1.5">
            <Label htmlFor="vp-to">
              {channel === "email" ? "Send the test to (email)" : "Send the test to (phone)"}
            </Label>
            <Input
              id="vp-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={channel === "email" ? "you@yourvenue.in" : "+91 98765 43210"}
            />
          </div>
        )}

        {channel === "sms" && (
          <div className="space-y-1.5">
            <Label>Template to test with</Label>
            {ownSmsTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                You need one of your own SMS templates with your own DLT template ID. Wyfy's
                templates are registered to Wyfy's header and would be dropped by carriers on yours.
                Create one in the Templates tab.
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-label="Template">
                  <SelectValue placeholder="Choose one of your templates" />
                </SelectTrigger>
                <SelectContent>
                  {ownSmsTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {result && (
          <ul
            className="space-y-1.5 rounded-md border border-border p-2 text-sm"
            data-testid="verify-checks"
          >
            {result.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-2">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                )}
                <span>
                  <span className="font-medium">
                    {c.name === "credentials"
                      ? "Credentials"
                      : c.name === "test_send"
                        ? "Test message"
                        : c.name}
                  </span>
                  : {c.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verify.isPending}>
            Close
          </Button>
          <Button onClick={go} disabled={!canGo}>
            {verify.isPending ? "Verifying…" : result ? "Verify again" : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
