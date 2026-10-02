import { useState } from "react";
import { Clock, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { useMarketingCredits, useMarketingScope, useSupportRequest } from "@/hooks/useMarketing";
import { requestErrorMessage } from "@/services/api";
import { creditTone, formatCredits, parseCreditsInput } from "@/lib/marketing-credits";
import { MARKETING_CHANNELS } from "@/types/marketing";
import {
  TOPUP_REQUEST_SUBJECT,
  marketingErrorMessage,
  useChannelLabel,
  useHasPermission,
} from "../marketing-helpers";
import { CreditLedgerTable } from "./CreditLedgerTable";

function RequestTopUp() {
  const { existing, request } = useSupportRequest(TOPUP_REQUEST_SUBJECT);
  const [amount, setAmount] = useState("");
  const minor = parseCreditsInput(amount);
  const valid = minor !== null && minor >= 100;
  const pending = existing.data ?? null;

  if (pending) {
    return (
      <p className="flex items-center gap-1.5 text-sm">
        <Clock className="h-4 w-4 text-amber-600" aria-hidden />
        Top-up requested: ticket #{pending.id.slice(0, 8)} is open.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="topup-amount" className="text-xs">
          Credits to add
        </Label>
        <Input
          id="topup-amount"
          inputMode="decimal"
          className="w-40"
          placeholder="e.g. 2,000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Button
        disabled={!valid || request.isPending || existing.isLoading}
        onClick={() =>
          request.mutate(
            `Please add ${formatCredits(minor!)} marketing credits to our wallet (₹${formatCredits(minor!)} before GST).`,
            {
              onSuccess: (t) => {
                toast.success(`Top-up requested: ticket #${t.id.slice(0, 8)}`);
                setAmount("");
              },
              onError: (e) => toast.error(requestErrorMessage(e, "Couldn't send the request.")),
            },
          )
        }
      >
        {request.isPending ? "Requesting…" : "Request top-up"}
      </Button>
      <p className="w-full text-[11px] text-muted-foreground">
        1 credit = ₹1.00 before GST. Wyfy confirms payment and adds the credits; you get a GST
        invoice. Credits never expire.
      </p>
    </div>
  );
}

/**
 * Credits tab (spec §13.10): balance, prices, top-up request, and -- only
 * for callers holding billing.read -- the ledger. Every number is the
 * server's; nothing here is adjusted optimistically.
 */
export function CreditsTab() {
  const label = useChannelLabel();
  const q = useMarketingCredits();
  const has = useHasPermission();
  const scope = useMarketingScope();
  // §13.6: the ledger is financial history, gated on billing.read at the
  // ORGANIZATION level -- venue-level roles never hold it.
  const mayReadLedger = scope.kind === "organization" && has("billing.read");

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (q.isError || !q.data) {
    return (
      <ErrorState
        title="Couldn't load your credits"
        description={marketingErrorMessage(q.error)}
        onRetry={() => void q.refetch()}
      />
    );
  }
  const c = q.data;
  const tone = creditTone(c.available_minor, c.is_low);

  return (
    <div className="space-y-5">
      <Card className="premium-card">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Available
            </p>
            <p
              data-testid="credits-available"
              className={cn(
                "mt-1 flex items-center gap-2 text-3xl font-semibold tabular-nums",
                tone === "low" && "text-amber-600",
                tone === "empty" && "text-red-600",
              )}
            >
              <Coins className="h-6 w-6" aria-hidden />
              {formatCredits(c.available_minor)}
            </p>
            {tone !== "ok" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {tone === "empty"
                  ? "No credits left: campaigns through Wyfy can't be scheduled."
                  : `Running low (below ${formatCredits(c.low_balance_threshold_minor)}).`}
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Held for campaigns
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCredits(c.reserved_minor)}
            </p>
            <p className="text-xs text-muted-foreground">
              Set aside when a campaign is scheduled; whatever isn't used comes back.
            </p>
          </div>
          <div className="sm:col-span-1">
            <RequestTopUp />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Prices</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden sm:table-cell">Per</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MARKETING_CHANNELS.map((ch) => {
                const p = c.prices[ch];
                const own = c.byo_channels.includes(ch);
                return (
                  <TableRow key={ch}>
                    <TableCell className="font-medium">{label(ch)}</TableCell>
                    <TableCell className="tabular-nums">
                      {own ? (
                        <span>0 credits: your own provider</span>
                      ) : p ? (
                        <>
                          {formatCredits(p.unit_price_minor)} credits
                          {p.source === "org_override" && (
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              (your rate)
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {own ? "—" : p?.unit === "segment" ? "SMS part (160 characters)" : "message"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Only messages the provider accepts are charged. Skipped and failed messages are free.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Credit history</h3>
        {mayReadLedger ? (
          <CreditLedgerTable />
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            Ask your account owner for billing access to see credit history.
          </p>
        )}
      </section>
    </div>
  );
}
