/**
 * BILL-2: GSTR-1-ready export for one month (B2B, B2CL, B2CS, CDNR, CDNUR,
 * HSN/SAC). Columns follow the GST offline tool's templates. A 404 means the
 * export is switched off for this account.
 */
import { useState } from "react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner } from "@/components/isp-partner/kit";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { bill2Service, GSTR1_SECTION_LABEL, type Gstr1Section } from "@/services/isp-partner/bill2";

function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}

export function Gstr1Dialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [month, setMonth] = useState(lastMonth);
  const [section, setSection] = useState<Gstr1Section>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await bill2Service.gstr1(month, section);
      saveBlob(blob, filename);
    } catch (err) {
      setError(
        isNotFound(err)
          ? "The GST return export is not switched on for your account yet."
          : ispErrorMessage(err, "Could not build the export."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <MDialog
      open
      onClose={onClose}
      title="GSTR-1 export"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Close
          </MButton>
          <MButton onClick={download} disabled={busy || !/^\d{4}-\d{2}$/.test(month)}>
            {busy && <Spinner />} Download
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Return period</span>
          <input
            type="month"
            className={M_INPUT}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Section</span>
          <select
            className={M_INPUT}
            value={section}
            onChange={(e) => setSection(e.target.value as Gstr1Section)}
          >
            {(Object.keys(GSTR1_SECTION_LABEL) as Gstr1Section[]).map((k) => (
              <option key={k} value={k}>
                {GSTR1_SECTION_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-muted-foreground">
          Every invoice issued in the month is included; voids and credit notes are reported as
          credit notes in the month they were issued. Bills of supply (GST off) are not taxable and
          are left out. Check the figures with your accountant before filing.
        </p>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
