/** JAZE-4 actions on an invoice: email to primary / alternate / both, an
 * 80 mm thermal slip, and (with WhatsApp automation on) a pay link. Hidden
 * while the backend flag is off (the template probe answers 404). */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Mail, Printer } from "lucide-react";
import { MButton, MDialog, MSeg } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { saveBlob } from "@/lib/isp-partner/download";
import { financeService } from "@/services/isp-partner/finance";
import {
  effectiveSender,
  emailResultMessage,
  showSenderChoice,
  type EmailSenderKey,
} from "@/lib/isp-partner/comms2b";

export function InvoiceFinanceActions({ invoiceId, live }: { invoiceId: string; live: boolean }) {
  const { can } = usePartner();
  const probe = useQuery({
    queryKey: ["isp", "finance", "template"],
    queryFn: financeService.template,
    retry: false,
    staleTime: 60_000,
  });
  const auto = useQuery({
    queryKey: ["isp", "finance", "automation"],
    queryFn: financeService.automation,
    retry: false,
    staleTime: 60_000,
    enabled: probe.isSuccess,
  });
  const [emailing, setEmailing] = useState(false);
  const [sendTo, setSendTo] = useState<"primary" | "alternate" | "both">("primary");
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState<EmailSenderKey>("platform");
  // COMMS-2b: the sender picker appears only with more than one sender.
  const senders = useQuery({
    queryKey: ["isp", "finance", "email-senders"],
    queryFn: financeService.emailSenders,
    retry: false,
    staleTime: 60_000,
    enabled: emailing,
  });
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const email = useMutation({
    mutationFn: () =>
      financeService.emailInvoice(
        invoiceId,
        sendTo,
        message,
        effectiveSender(sender, senders.data),
      ),
    onSuccess: (r) => {
      const m = emailResultMessage(r);
      if (m.ok) {
        toast.success(m.text);
        setEmailing(false);
      } else {
        setError(m.text);
      }
    },
    onError: (e) => setError(ispErrorMessage(e, "Could not send the email.")),
  });
  const link = useMutation({
    mutationFn: () => financeService.payLink(invoiceId),
    onSuccess: async (r) => {
      try {
        await navigator.clipboard.writeText(r.url);
        toast.success("Pay link copied.");
      } catch {
        toast.success(r.url);
      }
    },
    onError: (e) => ispToastError(e),
  });
  if (!probe.isSuccess) return null;
  return (
    <>
      <MButton
        variant="outline"
        disabled={printing}
        onClick={async () => {
          setPrinting(true);
          try {
            const { blob, filename } = await financeService.thermalInvoice(invoiceId, 80);
            saveBlob(blob, filename);
          } catch (err) {
            ispToastError(err, "The download failed.");
          } finally {
            setPrinting(false);
          }
        }}
      >
        {printing ? <Spinner /> : <Printer />} 80 mm slip
      </MButton>
      {can("isp_invoices.execute") && live && (
        <MButton
          variant="outline"
          onClick={() => {
            setEmailing(true);
            setError(null);
          }}
        >
          <Mail /> Email PDF
        </MButton>
      )}
      {can("isp_invoices.execute") && live && auto.data?.flags.whatsapp && (
        <MButton variant="outline" onClick={() => link.mutate()} disabled={link.isPending}>
          {link.isPending ? <Spinner /> : <Link2 />} Pay link
        </MButton>
      )}
      <MDialog
        open={emailing}
        onClose={() => setEmailing(false)}
        title="Email this invoice"
        footer={
          <MButton onClick={() => email.mutate()} disabled={email.isPending}>
            {email.isPending && <Spinner />} Send
          </MButton>
        }
      >
        <div className="space-y-3">
          <MSeg
            value={sendTo}
            onChange={setSendTo}
            options={[
              { value: "primary", label: "Primary email" },
              { value: "alternate", label: "Alternate email" },
              { value: "both", label: "Both" },
            ]}
          />
          <p className="text-[11px] text-muted-foreground">
            The alternate email (for example an accounts team) is set on the customer&apos;s or
            subscriber&apos;s billing contact.
          </p>
          {showSenderChoice(senders.data) && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Send from</p>
              <MSeg
                value={effectiveSender(sender, senders.data)}
                onChange={setSender}
                options={senders.data!.senders.map((s) => ({ value: s.key, label: s.label }))}
              />
            </div>
          )}
          <TextField label="Message (optional)" value={message} onChange={setMessage} />
          <FormError message={error} />
        </div>
      </MDialog>
    </>
  );
}
