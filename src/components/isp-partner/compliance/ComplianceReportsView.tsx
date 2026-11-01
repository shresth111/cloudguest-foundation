/** J18: the compliance/operations report catalogue. Reports whose data
 * belongs to another lane show "data source pending", never zeros. */
import { useState } from "react";
import { MButton, MEmptyState, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useComplianceReport, useReportCatalogue } from "@/hooks/isp-partner/useCompliance";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { isoDay } from "@/lib/isp-partner/format";
import { complianceService } from "@/services/isp-partner/compliance";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

export function ComplianceReportsView() {
  const { can } = usePartner();
  const cat = useReportCatalogue();
  const [key, setKey] = useState("");
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [err, setErr] = useState<string | null>(null);
  const since = `${from}T00:00:00+05:30`;
  const until = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000).toISOString();
  const r = useComplianceReport(key, since, until);
  const groups = new Map<string, NonNullable<typeof cat.data>>();
  for (const item of cat.data ?? []) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card title="Reports">
        {cat.error && <ErrorBlock error={cat.error} what="the report list" />}
        <div className="space-y-3">
          {[...groups.entries()].map(([category, items]) => (
            <div key={category}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.key}>
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${key === i.key ? "bg-muted font-medium" : ""} ${i.available ? "" : "text-muted-foreground"}`}
                      onClick={() => setKey(i.key)}
                    >
                      {i.title}
                      {!i.available && <span className="ml-1 text-xs">(soon)</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <Card
        title={r.data?.title ?? "Pick a report"}
        actions={
          key ? (
            <>
              <input
                type="date"
                aria-label="From"
                className={`${M_FILTER}`}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <input
                type="date"
                aria-label="To"
                className={`${M_FILTER}`}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              {can("isp_partner.export") && r.data?.available && (
                <MButton
                  variant="outline"
                  onClick={async () => {
                    try {
                      const f = await complianceService.reportExport(key, since, until);
                      saveBlob(f.blob, f.filename);
                    } catch (e) {
                      setErr(ispErrorMessage(e));
                    }
                  }}
                >
                  CSV
                </MButton>
              )}
            </>
          ) : undefined
        }
      >
        <FormError message={err} />
        {!key && <MEmptyState title="Pick a report" description="Choose a report on the left." />}
        {r.error && <ErrorBlock error={r.error} what="the report" />}
        {r.data && !r.data.available && (
          <MEmptyState
            title="Not available yet"
            description={`${r.data.pending ?? "Data source pending"}. This report fills in when that feature ships.`}
          />
        )}
        {r.data?.available && r.data.rows.length === 0 && (
          <MEmptyState title="Nothing in this range" description="No rows for the dates picked." />
        )}
        {r.data?.available && r.data.rows.length > 0 && (
          <>
            <MTable
              loading={r.isFetching}
              head={
                <MTr>
                  {r.data.columns.map((c) => (
                    <MTh key={c}>{c}</MTh>
                  ))}
                </MTr>
              }
            >
              {r.data.rows.slice(0, 500).map((row, i) => (
                <MTr key={i}>
                  {row.map((v, j) => (
                    <MTd key={j}>
                      {typeof v === "boolean" ? (
                        <MTag label={v ? "Yes" : "No"} tone={v ? "active" : "pending"} />
                      ) : (
                        String(v ?? "")
                      )}
                    </MTd>
                  ))}
                </MTr>
              ))}
            </MTable>
            {(r.data.rows.length > 500 || r.data.truncated) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the first 500 rows. Download the CSV for all of them.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
