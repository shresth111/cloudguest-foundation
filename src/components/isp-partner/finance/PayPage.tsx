/** JAZE-4: what an end customer sees from a pay link. UPI and bank transfer
 * only; the ISP marks the invoice paid when the money arrives. */
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/isp-partner/kit";
import { formatRupees } from "@/lib/isp-partner/money";
import { financeService } from "@/services/isp-partner/finance";

export function PayPage({ token }: { token: string }) {
  const q = useQuery({
    queryKey: ["isp", "public", "pay", token],
    queryFn: () => financeService.publicPay(token),
    retry: false,
  });
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-5">
      {q.isLoading && <Spinner />}
      {q.error && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask your internet provider for a new payment link.
          </p>
        </div>
      )}
      {q.data && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="text-xs text-muted-foreground">{q.data.isp_name}</p>
            <h1 className="text-lg font-semibold">
              {q.data.bill_to_first_name ? `Hi ${q.data.bill_to_first_name}, ` : ""}invoice{" "}
              {q.data.invoice_number}
            </h1>
            <p className="text-xs text-muted-foreground">
              Dated {q.data.invoice_date} · due {q.data.due_date}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {q.data.balance_paise > 0 ? "Amount to pay" : "Status"}
            </p>
            <p className="text-2xl font-bold">
              {q.data.balance_paise > 0 ? formatRupees(q.data.balance_paise) : "Paid. Thank you!"}
            </p>
          </div>
          {q.data.balance_paise > 0 && q.data.upi_uri && (
            <a
              href={q.data.upi_uri}
              className="block rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
            >
              Pay {formatRupees(q.data.balance_paise)} with a UPI app
            </a>
          )}
          {q.data.balance_paise > 0 && q.data.upi_vpa && (
            <p className="text-center text-xs text-muted-foreground">
              UPI ID: <span className="font-mono">{q.data.upi_vpa}</span> ({q.data.payee_name})
            </p>
          )}
          {q.data.balance_paise > 0 && q.data.bank && (
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="mb-1 font-medium">Or pay by bank transfer</p>
              {q.data.bank.account_name && <p>Name: {q.data.bank.account_name}</p>}
              {q.data.bank.name && <p>Bank: {q.data.bank.name}</p>}
              <p>
                A/c no.: <span className="font-mono">{q.data.bank.account_number}</span>
              </p>
              {q.data.bank.ifsc && (
                <p>
                  IFSC: <span className="font-mono">{q.data.bank.ifsc}</span>
                </p>
              )}
              <p className="mt-1 text-muted-foreground">
                Put {q.data.invoice_number} in the remarks.
              </p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{q.data.note}</p>
          {(q.data.support_phone || q.data.support_email) && (
            <p className="text-[11px] text-muted-foreground">
              Questions? {q.data.support_phone ?? ""} {q.data.support_email ?? ""}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
