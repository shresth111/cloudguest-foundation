/**
 * Compliance -> CAF (CAF-2): find a subscriber or a lead, check what will be
 * printed, fill the few CAF-only fields, pick the CAF number, download the
 * PDF; bulk ZIP for audits; signatory + stamp. Answers "not switched on"
 * while `ISP_CAF_WORKBENCH_ENABLED` is off (every /isp/caf route 404s).
 *
 * Searches go through `/isp/caf/search`, which the zone switcher narrows like
 * every other scoped call. ID numbers arrive masked from the API (Aadhaar:
 * last four digits only) and are masked again before display.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { MEmptyState, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CafExportCard } from "@/components/isp-partner/compliance/caf/CafExportCard";
import { CafLeadPanel } from "@/components/isp-partner/compliance/caf/CafLeadPanel";
import { CafProfileCard } from "@/components/isp-partner/compliance/caf/CafProfileCard";
import { CafSubscriberPanel } from "@/components/isp-partner/compliance/caf/CafSubscriberPanel";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isNotFound } from "@/lib/isp-partner/errors";
import { cafService, type CafHit, type CafSource } from "@/services/isp-partner/caf";

export const cafKeys = {
  all: ["isp", "caf"] as const,
  options: ["isp", "caf", "options"] as const,
  search: (q: string, s: CafSource) => ["isp", "caf", "search", s, q] as const,
  subscriber: (id: string) => ["isp", "caf", "subscriber", id] as const,
  lead: (id: string) => ["isp", "caf", "lead", id] as const,
};

export function CafWorkbench() {
  const { can } = usePartner();
  const options = useQuery({
    queryKey: cafKeys.options,
    queryFn: () => cafService.options(),
    retry: false,
  });
  const [source, setSource] = useState<CafSource>("subscriber");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ source: CafSource; id: string } | null>(null);
  const [exportList, setExportList] = useState<{ id: string; label: string }[]>([]);
  const debounced = useDebouncedValue(q.trim(), 250);
  const hits = useQuery({
    queryKey: cafKeys.search(debounced, source),
    queryFn: () => cafService.search(debounced, source),
    enabled: debounced.length >= 2 && options.isSuccess,
    retry: false,
  });
  const qc = useQueryClient();

  if (options.isLoading) return <LoadingBlock />;
  if (options.error && isNotFound(options.error))
    return (
      <MEmptyState
        icon={FileText}
        title="The CAF workbench is not switched on"
        description="Ask Wyfy Guest support to turn it on for your network. CAF numbers and the KYC CAF PDF still work from KYC & CAF."
      />
    );
  if (options.error || !options.data)
    return <ErrorBlock error={options.error} onRetry={() => options.refetch()} what="CAF" />;
  const o = options.data;

  const choose = (h: CafHit) => {
    if (h.source === "lead" && h.converted_subscriber_id)
      setPicked({ source: "subscriber", id: h.converted_subscriber_id });
    else setPicked({ source: h.source, id: h.id });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card title="Find">
          {o.leads && (
            <MSeg<CafSource>
              value={source}
              onChange={(v) => {
                setSource(v);
                setPicked(null);
              }}
              options={[
                { value: "subscriber", label: "Subscriber" },
                { value: "lead", label: "Lead" },
              ]}
            />
          )}
          <input
            className={`${M_INPUT} mt-2`}
            placeholder={
              source === "lead" ? "Lead name, phone or number" : "Name, mobile, login id or circuit"
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />
          {hits.error ? <ErrorBlock error={hits.error} what="the search" /> : null}
          <ul className="mt-2 max-h-[26rem] space-y-0.5 overflow-y-auto">
            {(hits.data ?? []).map((h) => (
              <li key={`${h.source}-${h.id}`}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${picked?.id === h.id ? "bg-muted font-medium" : ""}`}
                  onClick={() => choose(h)}
                >
                  {h.label}
                  <span className="block text-xs text-muted-foreground">
                    {h.detail}
                    {h.caf_number ? ` · CAF ${h.caf_number}` : ""}
                    {h.source === "lead" ? ` · ${h.status}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {debounced.length >= 2 && hits.data?.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No match in this zone.</p>
          )}
        </Card>
        {picked?.source === "subscriber" ? (
          <CafSubscriberPanel
            key={picked.id}
            subscriberId={picked.id}
            categories={o.applicant_categories}
            onAddToExport={(id, label) =>
              setExportList((l) => (l.some((x) => x.id === id) ? l : [...l, { id, label }]))
            }
          />
        ) : picked?.source === "lead" ? (
          <CafLeadPanel
            key={picked.id}
            leadId={picked.id}
            categories={o.applicant_categories}
            canConvert={o.convert_leads && can("isp_partner.update")}
            onConverted={(sid) => {
              qc.invalidateQueries({ queryKey: cafKeys.all });
              setSource("subscriber");
              setPicked({ source: "subscriber", id: sid });
            }}
          />
        ) : (
          <Card>
            <p className="text-sm text-muted-foreground">
              Pick a {source === "lead" ? "lead" : "subscriber"} to prepare their CAF.
            </p>
          </Card>
        )}
      </div>
      {can("isp_partner.export") && (
        <CafExportCard
          picked={exportList}
          onRemove={(id) => setExportList((l) => l.filter((x) => x.id !== id))}
          max={o.export_max}
        />
      )}
      <CafProfileCard profile={o.profile} canManage={can("isp_partner.manage")} />
    </div>
  );
}
