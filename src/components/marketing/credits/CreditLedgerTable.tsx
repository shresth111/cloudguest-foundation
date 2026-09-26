import { useState } from "react";
import { ScrollText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { billingService } from "@/services/billing.service";
import { requestErrorMessage, resolveActiveOrganizationId } from "@/services/api";
import { useCreditLedger } from "@/hooks/useMarketing";
import { marketingError } from "@/services/marketing.service";
import { formatCredits, formatSignedCredits } from "@/lib/marketing-credits";
import type { LedgerEntryType, LedgerRow } from "@/types/marketing";
import { Pager } from "../marketing-ui";
import { formatDateTime, marketingErrorMessage } from "../marketing-helpers";

const TYPE_LABEL: Record<string, string> = {
  topup: "Top-up",
  reserve: "Held for campaign",
  release: "Returned",
  debit: "Charged",
  refund: "Refund",
  adjustment: "Adjustment",
};

function describe(r: LedgerRow): string {
  const parts: string[] = [];
  if (r.is_test_send) parts.push("Test message");
  if (r.campaign) parts.push(r.campaign.name);
  if (r.units && r.unit_price_minor !== null)
    parts.push(`${r.units.toLocaleString("en-IN")} × ${formatCredits(r.unit_price_minor)}`);
  if (r.reference) parts.push(r.reference);
  if (r.note) parts.push(r.note);
  return parts.join(" · ") || "—";
}

/** Opens the existing invoice PDF download (GET /invoices/{id}/download).
 * In the demo workspace there is no invoice to fetch, so it is just text. */
function InvoiceLink({ invoice }: { invoice: { id: string; invoice_number: string } }) {
  const demo = useIsDemo();
  const [busy, setBusy] = useState(false);
  if (demo) return <p className="text-[11px] text-muted-foreground">Invoice {invoice.invoice_number}</p>;
  return (
    <button
      type="button"
      disabled={busy}
      className="text-[11px] font-medium text-primary underline-offset-4 hover:underline"
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await billingService.generateInvoice(
            invoice.id,
            resolveActiveOrganizationId() ?? undefined,
          );
          window.open(url, "_blank", "noopener");
        } catch (err) {
          toast.error(requestErrorMessage(err, "Couldn't open the invoice."));
        } finally {
          setBusy(false);
        }
      }}
    >
      Invoice {invoice.invoice_number}
    </button>
  );
}

/**
 * The credit ledger (spec §13.7), newest first. Mounted only for callers
 * holding billing.read; a 403 anyway is shown as the same "ask for billing
 * access" sentence, not an error.
 */
export function CreditLedgerTable() {
  const [type, setType] = useState<"all" | LedgerEntryType>("all");
  const [page, setPage] = useState(1);
  const q = useCreditLedger({ entry_type: type === "all" ? undefined : [type], page, page_size: 25 });
  const rows = q.data?.items ?? [];

  if (q.isError && marketingError(q.error)?.status === 403) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Ask your account owner for billing access to see credit history.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Select
        value={type}
        onValueChange={(v) => {
          setType(v as typeof type);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48" aria-label="Entry type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All entries</SelectItem>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {q.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : q.isError ? (
        <ErrorState title="Couldn't load credit history" description={marketingErrorMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No credit history yet" description="Top-ups and charges appear here." />
      ) : (
        <>
          <div className="overflow-x-auto" data-testid="credit-ledger">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Held</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{TYPE_LABEL[r.entry_type] ?? r.entry_type}</p>
                      <p className="max-w-xs text-[11px] text-muted-foreground">{describe(r)}</p>
                      {r.invoice && <InvoiceLink invoice={r.invoice} />}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        r.delta_available_minor > 0 && "text-emerald-600",
                        r.delta_available_minor < 0 && "text-red-600",
                      )}
                    >
                      {r.delta_available_minor === 0 ? "—" : formatSignedCredits(r.delta_available_minor)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {r.delta_reserved_minor === 0 ? "—" : formatSignedCredits(r.delta_reserved_minor)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatCredits(r.balance_available_after_minor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={q.data?.page ?? page}
            totalPages={q.data?.total_pages ?? 1}
            totalItems={q.data?.total_items ?? 0}
            onPage={setPage}
            busy={q.isFetching}
          />
        </>
      )}
    </div>
  );
}
