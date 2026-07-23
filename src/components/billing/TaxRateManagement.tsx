import { useState } from "react";
import { toast } from "sonner";
import { Info, Pencil, Plus, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taxRateSchema, type TaxRateFormValues } from "@/lib/billing-schemas";
import { useSaveTaxRate, useTaxRates } from "@/hooks/useBilling";
import type { TaxRate, TaxType } from "@/types/billing";

const TAX_TYPE_LABEL: Record<TaxType, string> = {
  gst: "GST (India)",
  vat: "VAT",
  sales_tax: "Sales tax",
  none: "No tax",
};

export function TaxRateManagement() {
  const { data, isLoading, isError, refetch } = useTaxRates();
  const [editing, setEditing] = useState<TaxRate | "new" | null>(null);
  const save = useSaveTaxRate();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">GST / Tax rates</CardTitle>
            <p className="text-xs text-muted-foreground">
              Rate catalog used to compute every invoice's tax. For India (country code IN), the backend
              automatically splits this into CGST + SGST when the buyer is in the same state as the platform,
              or IGST when they're in a different state.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing("new")}><Plus className="mr-1.5 h-4 w-4" /> New tax rate</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !data || data.length === 0 ? (
            <EmptyState
              title="No tax rates configured"
              description="Add an 18% GST rate for India to start generating GST-compliant invoices."
              action={{ label: "New tax rate", onClick: () => setEditing("new") }}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-3.5 w-3.5 text-muted-foreground" /> {t.name}
                        </div>
                      </TableCell>
                      <TableCell>{TAX_TYPE_LABEL[t.taxType]}</TableCell>
                      <TableCell className="font-mono text-xs">{t.countryCode}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{t.ratePercentage}%</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.isActive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-border bg-muted text-muted-foreground"}>
                          {t.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Each organization's GSTIN and billing state (needed to decide CGST/SGST vs IGST) is set on its own
            billing profile, not here — this catalog only defines the rate percentages available platform-wide.
          </div>
        </CardContent>
      </Card>

      {editing && (
        <TaxRateEditor
          open
          onOpenChange={(o) => !o && setEditing(null)}
          taxRate={editing === "new" ? undefined : editing}
          save={save}
        />
      )}
    </>
  );
}

function TaxRateEditor({
  open,
  onOpenChange,
  taxRate,
  save,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taxRate?: TaxRate;
  save: ReturnType<typeof useSaveTaxRate>;
}) {
  const form = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: taxRate
      ? {
          name: taxRate.name,
          taxType: taxRate.taxType,
          ratePercentage: taxRate.ratePercentage,
          countryCode: taxRate.countryCode,
          isActive: taxRate.isActive,
        }
      : { name: "India GST", taxType: "gst", ratePercentage: 18, countryCode: "IN", isActive: true },
  });

  const onSubmit = (values: TaxRateFormValues) => {
    save.mutate({ ...values, id: taxRate?.id }, {
      onSuccess: () => {
        toast.success(taxRate ? "Tax rate updated" : "Tax rate created");
        onOpenChange(false);
      },
      onError: () => toast.error("Could not save the tax rate."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{taxRate ? "Edit tax rate" : "New tax rate"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Name</Label>
            <Input className="mt-1" placeholder="India GST" {...form.register("name")} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label>Tax type</Label>
            <Select value={form.watch("taxType")} onValueChange={(v) => form.setValue("taxType", v as TaxType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gst">GST (India)</SelectItem>
                <SelectItem value="vat">VAT</SelectItem>
                <SelectItem value="sales_tax">Sales tax</SelectItem>
                <SelectItem value="none">No tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Country code</Label>
            <Input className="mt-1 uppercase" maxLength={2} placeholder="IN" {...form.register("countryCode")} />
            {form.formState.errors.countryCode && <p className="mt-1 text-xs text-destructive">{form.formState.errors.countryCode.message}</p>}
          </div>
          <div>
            <Label>Rate percentage</Label>
            <Input type="number" step="0.01" className="mt-1" {...form.register("ratePercentage", { valueAsNumber: true })} />
            {form.formState.errors.ratePercentage && <p className="mt-1 text-xs text-destructive">{form.formState.errors.ratePercentage.message}</p>}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Active</Label>
            <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save tax rate"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
