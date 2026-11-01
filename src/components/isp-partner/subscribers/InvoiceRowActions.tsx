/**
 * DIR-2: per-invoice actions on the Subscriber 360 invoice list: PDF, 80 mm
 * thermal slip, email (primary contact) and a WhatsApp reminder. The reminder
 * carries the JAZE-4 pay link when WhatsApp automation is on for the ISP;
 * otherwise it is the plain share text (no new link scheme, no auto-send).
 */
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Mail, MessageCircle, Printer } from "lucide-react";
import { MButton } from "@/components/master/MasterKit";
import { Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { whatsappShareUrl } from "@/lib/isp-partner/invoices";
import { financeService } from "@/services/isp-partner/finance";
import { invoicesService } from "@/services/isp-partner/invoices";

export function InvoiceRowActions({
  invoice,
  phone,
  name,
}: {
  invoice: { id: string; number: string; total_paise: number; balance_paise: number };
  phone: string | null | undefined;
  name: string | null | undefined;
}) {
  const { can, me } = usePartner();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(ispErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const icon = (key: string, I: typeof FileText) => (busy === key ? <Spinner /> : <I />);
  return (
    <div className="flex justify-end gap-0.5">
      <MButton
        variant="ghost"
        title="PDF"
        aria-label={`PDF of ${invoice.number}`}
        onClick={() =>
          run("pdf", async () => {
            const { blob, filename } = await invoicesService.pdf(invoice);
            saveBlob(blob, filename);
          })
        }
      >
        {icon("pdf", FileText)}
      </MButton>
      <MButton
        variant="ghost"
        title="Thermal slip (80 mm)"
        aria-label={`Thermal slip of ${invoice.number}`}
        onClick={() =>
          run("thermal", async () => {
            const { blob, filename } = await financeService.thermalInvoice(invoice.id);
            saveBlob(blob, filename);
          })
        }
      >
        {icon("thermal", Printer)}
      </MButton>
      {can("isp_invoices.execute") && (
        <MButton
          variant="ghost"
          title="Email to the primary contact"
          aria-label={`Email ${invoice.number}`}
          onClick={() =>
            run("email", async () => {
              const r = await financeService.emailInvoice(invoice.id, "primary");
              toast.success(`Emailed to ${r.queued.join(", ")}.`);
            })
          }
        >
          {icon("email", Mail)}
        </MButton>
      )}
      <MButton
        variant="ghost"
        title="WhatsApp reminder"
        aria-label={`WhatsApp reminder for ${invoice.number}`}
        onClick={() =>
          run("wa", async () => {
            let url = whatsappShareUrl({
              phone,
              name,
              invoiceNumber: invoice.number,
              totalPaise: invoice.total_paise,
              balancePaise: invoice.balance_paise,
              ispName: me.isp.name,
              supportPhone: me.isp.support_phone,
            });
            if (invoice.balance_paise > 0) {
              try {
                const link = await financeService.payLink(invoice.id);
                url += encodeURIComponent(`\nPay here: ${link.url}`);
              } catch {
                // automation off (404): plain reminder without a pay link
              }
            }
            window.open(url, "_blank", "noopener,noreferrer");
          })
        }
      >
        {icon("wa", MessageCircle)}
      </MButton>
    </div>
  );
}
