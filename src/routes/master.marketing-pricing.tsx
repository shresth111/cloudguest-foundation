import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MasterShell, useOperatorCaps } from "@/components/master/MasterShell";
import {
  MButton,
  MPageShell,
  MSectionHeader,
  MTable,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import { Input } from "@/components/ui/input";
import { usePriceBook, useSetPriceBook } from "@/hooks/useMarketing";
import { requestErrorOf } from "@/services/api";
import { formatCredits, parseCreditsInput } from "@/lib/marketing-credits";
import { MARKETING_CHANNELS, type MarketingChannel } from "@/types/marketing";

export const Route = createFileRoute("/master/marketing-pricing")({ component: PriceBookScreen });

const CHANNEL: Record<MarketingChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};
const UNIT: Record<string, string> = { segment: "per SMS part", message: "per message" };

/**
 * Master -> Marketing price book (spec §13.3, §13.7, §13.10): the platform
 * credit price per channel, its history, and every per-customer override.
 *
 * Read with billing.read (`pricing` cap); the edit form needs billing.manage
 * (`addons` cap). A new price applies only to campaigns scheduled after it:
 * campaigns already scheduled keep the price they were scheduled at, and the
 * screen says so before saving. Every value shown is the server's; the form
 * shows the saved prices again only after the PUT returned.
 */
function PriceBookScreen() {
  const caps = useOperatorCaps();
  const canEdit = caps.has("addons");
  const q = usePriceBook();
  const save = useSetPriceBook();
  const [draft, setDraft] = useState<Record<MarketingChannel, string>>({
    sms: "",
    whatsapp: "",
    email: "",
  });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!q.data) return;
    const next = { sms: "", whatsapp: "", email: "" } as Record<MarketingChannel, string>;
    for (const r of q.data.platform) next[r.channel] = formatCredits(r.unit_price_minor);
    setDraft(next);
  }, [q.data]);

  const current = (ch: MarketingChannel) => q.data?.platform.find((r) => r.channel === ch);
  const changes = MARKETING_CHANNELS.flatMap((ch) => {
    const minor = parseCreditsInput(draft[ch]);
    const cur = current(ch);
    if (minor === null || !cur || minor === cur.unit_price_minor) return [];
    return [{ channel: ch, unit_price_minor: minor }];
  });
  const invalid = MARKETING_CHANNELS.some((ch) => {
    const m = parseCreditsInput(draft[ch]);
    return draft[ch].trim() !== "" && (m === null || m < 0 || m > 10_000);
  });

  const submit = async () => {
    try {
      await save.mutateAsync({ prices: changes, note: note.trim() || null });
      toast.success("Prices saved. They apply to campaigns scheduled from now on.");
      setNote("");
    } catch (err) {
      toast.error(requestErrorOf(err)?.message || "Couldn't save the prices.");
    }
  };

  return (
    <MasterShell title="Marketing price book">
      <MPageShell>
        <MSectionHeader
          eyebrow="Guest Marketing"
          title="Marketing price book"
          description="Credits charged per message sent through Wyfy's providers. 1 credit = ₹1.00 before GST. Messages sent through a customer's own provider are free."
        />

        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : q.isError || !q.data ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Couldn't load the price book.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {requestErrorOf(q.error)?.message ?? "The server did not answer."}
            </p>
            <MButton variant="outline" className="mt-2" onClick={() => void q.refetch()}>
              Try again
            </MButton>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Platform prices</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {MARKETING_CHANNELS.map((ch) => {
                  const r = current(ch);
                  return (
                    <div key={ch} className="rounded-xl border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {CHANNEL[ch]} · {r ? (UNIT[r.unit] ?? r.unit) : "—"}
                      </p>
                      {canEdit ? (
                        <Input
                          aria-label={`${CHANNEL[ch]} price in credits`}
                          className="mt-1 w-32 tabular-nums"
                          inputMode="decimal"
                          value={draft[ch]}
                          onChange={(e) => setDraft((d) => ({ ...d, [ch]: e.target.value }))}
                        />
                      ) : (
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {r ? formatCredits(r.unit_price_minor) : "—"}
                        </p>
                      )}
                      {r && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Since {new Date(r.effective_from).toLocaleDateString()}
                          {r.set_by?.name ? ` · ${r.set_by.name}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[16rem] flex-1">
                    <label htmlFor="pb-note" className="mb-1 block text-xs text-muted-foreground">
                      Note (optional)
                    </label>
                    <Input
                      id="pb-note"
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <MButton
                    variant="primary"
                    disabled={save.isPending || changes.length === 0 || invalid}
                    onClick={() => void submit()}
                  >
                    {save.isPending ? "Saving…" : "Save new prices"}
                  </MButton>
                  <p className="w-full text-[11px] text-muted-foreground">
                    {invalid
                      ? "Prices are credits with up to two decimals, between 0 and 100."
                      : "Campaigns already scheduled keep the price they were scheduled at."}
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Customer overrides</h3>
              {q.data.org_overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No customer has its own price.</p>
              ) : (
                <MTable
                  head={
                    <>
                      <MTh>Customer</MTh>
                      <MTh>Channel</MTh>
                      <MTh>Price</MTh>
                      <MTh>Since</MTh>
                    </>
                  }
                >
                  {q.data.org_overrides.map((o) => (
                    <MTr key={`${o.organization_id}-${o.channel}`}>
                      <MTd>{o.organization_name}</MTd>
                      <MTd>{CHANNEL[o.channel]}</MTd>
                      <MTd className="tabular-nums">{formatCredits(o.unit_price_minor)}</MTd>
                      <MTd>{new Date(o.effective_from).toLocaleDateString()}</MTd>
                    </MTr>
                  ))}
                </MTable>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">History</h3>
              <MTable
                head={
                  <>
                    <MTh>When</MTh>
                    <MTh>Channel</MTh>
                    <MTh>Price</MTh>
                    <MTh>By</MTh>
                    <MTh>Note</MTh>
                  </>
                }
              >
                {q.data.history.map((h, i) => (
                  <MTr key={`${h.channel}-${h.effective_from}-${i}`}>
                    <MTd>{new Date(h.effective_from).toLocaleString()}</MTd>
                    <MTd>{CHANNEL[h.channel]}</MTd>
                    <MTd className="tabular-nums">{formatCredits(h.unit_price_minor)}</MTd>
                    <MTd>{h.set_by?.name ?? "—"}</MTd>
                    <MTd className="text-xs text-muted-foreground">{h.note ?? ""}</MTd>
                  </MTr>
                ))}
              </MTable>
            </section>
          </div>
        )}
      </MPageShell>
    </MasterShell>
  );
}
