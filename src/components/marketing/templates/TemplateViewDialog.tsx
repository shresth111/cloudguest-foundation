import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarketingTemplate } from "@/types/marketing";
import { EmailPreviewFrame } from "./EmailPreviewFrame";
import { SendableChips } from "./template-bits";
import { SmsSize } from "./SmsCounter";

const APPROVAL_LABEL: Record<string, string> = {
  not_submitted: "Not yet submitted to Meta",
  pending: "Waiting for Meta approval",
  approved: "Approved by Meta",
  rejected: "Rejected by Meta",
};

/** Read-only look at a template's text on every channel it has, exactly as
 * stored (variables unfilled). The rendered, per-guest version is in the
 * campaign composer's review step. */
export function TemplateViewDialog({
  template,
  onOpenChange,
  onDuplicate,
}: {
  template: MarketingTemplate | null;
  onOpenChange: (o: boolean) => void;
  onDuplicate?: (t: MarketingTemplate) => void;
}) {
  const t = template;
  return (
    <Dialog open={!!t} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        {t && (
          <>
            <DialogHeader>
              <DialogTitle>{t.name}</DialogTitle>
              <DialogDescription>
                {t.is_system ? "Wyfy template · read-only" : "Your template"}
                {t.description ? ` · ${t.description}` : ""}
              </DialogDescription>
            </DialogHeader>

            <SendableChips template={t} />

            {t.sms && (
              <section className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  SMS
                </h4>
                <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono text-xs">
                  {t.sms.body}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <SmsSize sms={t.sms} /> · DLT template ID:{" "}
                  {t.sms.dlt_template_id ?? "not registered yet"}
                </p>
              </section>
            )}
            {t.whatsapp && (
              <section className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  WhatsApp
                </h4>
                <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">
                  {t.whatsapp.body}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {APPROVAL_LABEL[t.whatsapp.approval_status] ?? t.whatsapp.approval_status}
                </p>
              </section>
            )}
            {t.email && (
              <section className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email
                </h4>
                <p className="text-sm font-semibold">{t.email.subject}</p>
                {t.email.preheader && (
                  <p className="text-xs text-muted-foreground">{t.email.preheader}</p>
                )}
                <EmailPreviewFrame html={t.email.body_html} />
              </section>
            )}

            {t.variables.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Variables: {t.variables.map((v) => `{{${v}}}`).join(" ")}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onDuplicate && (
                <Button onClick={() => onDuplicate(t)}>
                  <Copy className="h-4 w-4" /> Duplicate
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
