/** `/partner/compliance` (lane JAZE-3): NAT feed, IP trace + session dump,
 * KYC/CAF, filings (TRAI PMR, AGR, schedules), reports, settings. */
import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MButton, MSectionHeader, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CgnatLookupView } from "@/components/isp-partner/compliance/CgnatLookupView";
import { ComplianceReportsView } from "@/components/isp-partner/compliance/ComplianceReportsView";
import { FilingsView } from "@/components/isp-partner/compliance/FilingsView";
import { NatFeedView } from "@/components/isp-partner/compliance/NatFeedView";
import { SubscriberKycPanel } from "@/components/isp-partner/compliance/SubscriberKycPanel";
import { useComplianceMutation, useComplianceSettings } from "@/hooks/isp-partner/useCompliance";
import { useSubscribers } from "@/hooks/isp-partner/usePlans";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { complianceService, type ComplianceSettings } from "@/services/isp-partner/compliance";

export type ComplianceTab = "nat" | "trace" | "kyc" | "filings" | "reports" | "settings";
const TABS: { value: ComplianceTab; label: string; perm?: string }[] = [
  { value: "nat", label: "NAT log feed" },
  { value: "trace", label: "Trace an IP", perm: "isp_ipdr.read" },
  { value: "kyc", label: "KYC & CAF" },
  { value: "filings", label: "TRAI & AGR" },
  { value: "reports", label: "Reports" },
  { value: "settings", label: "Settings" },
];

export function CompliancePage() {
  const { can } = usePartner();
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const tabs = TABS.filter((t) => !t.perm || can(t.perm));
  const tab = (tabs.find((t) => t.value === search.tab)?.value ?? "nat") as ComplianceTab;
  return (
    <>
      <MSectionHeader
        eyebrow="Compliance"
        title="Compliance"
        description="NAT log health, tracing a public IP to a subscriber, KYC and CAF, and the monthly TRAI / AGR figures."
      />
      <MSeg<ComplianceTab>
        value={tab}
        onChange={(v) => navigate({ to: "/partner/compliance", search: { tab: v }, replace: true })}
        options={tabs.map(({ value, label }) => ({ value, label }))}
      />
      <div className="mt-4">
        {tab === "nat" && <NatFeedView />}
        {tab === "trace" && <CgnatLookupView />}
        {tab === "kyc" && <KycTab />}
        {tab === "filings" && <FilingsView />}
        {tab === "reports" && <ComplianceReportsView />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </>
  );
}

function KycTab() {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const subs = useSubscribers({ search: debounced || undefined, page: 1, page_size: 20 });
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card title="Subscriber">
        <input
          className={M_INPUT}
          placeholder="Search username, name or circuit ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {subs.error ? <ErrorBlock error={subs.error} what="subscribers" /> : null}
        <ul className="mt-2 max-h-[28rem] space-y-0.5 overflow-y-auto">
          {(subs.data?.items ?? []).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${picked === s.id ? "bg-muted font-medium" : ""}`}
                onClick={() => setPicked(s.id)}
              >
                {s.display_name ?? s.identifier}
                <span className="block text-xs text-muted-foreground">
                  {s.identifier}
                  {s.circuit_id != null ? ` · CID ${s.circuit_id}` : ""}
                  {s.customer_name ? ` · ${s.customer_name}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {picked ? (
        <SubscriberKycPanel subscriberId={picked} />
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">Pick a subscriber to see their KYC.</p>
        </Card>
      )}
    </div>
  );
}

const SETTING_FIELDS: { key: keyof ComplianceSettings; label: string; number?: boolean }[] = [
  { key: "legal_name", label: "Licensee legal name (printed on the CAF)" },
  { key: "licence_number", label: "Licence number" },
  { key: "licence_category", label: "Licence category" },
  { key: "registered_address", label: "Registered address" },
  { key: "gstin", label: "GSTIN" },
  { key: "compliance_email", label: "Compliance email" },
  { key: "caf_prefix", label: "CAF number prefix" },
  { key: "nat_feed_stale_minutes", label: "NAT feed: stopped after (minutes)", number: true },
  { key: "gigabit_threshold_mbps", label: "TRAI gigabit threshold (Mbps)", number: true },
  { key: "churn_after_days", label: "Churned after expired for (days)", number: true },
];

function SettingsTab() {
  const { can } = usePartner();
  const editable = can("isp_partner.manage");
  const q = useComplianceSettings();
  const [form, setForm] = useState<Partial<ComplianceSettings>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);
  const save = useComplianceMutation((body: Partial<ComplianceSettings>) =>
    complianceService.saveSettings(body),
  );
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="settings" />;
  return (
    <Card title="Compliance settings">
      <div className="grid gap-3 sm:grid-cols-2">
        {SETTING_FIELDS.map((f) => (
          <label key={f.key} className="text-xs text-muted-foreground">
            {f.label}
            <input
              className={M_INPUT}
              disabled={!editable}
              inputMode={f.number ? "numeric" : undefined}
              value={(form[f.key] as string | number | null | undefined) ?? ""}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  [f.key]: f.number ? Number(e.target.value) || 0 : e.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Next automatic CAF number: {form.caf_prefix ?? "CAF"}/&lt;FY&gt;/{q.data?.caf_next_seq ?? 1}
      </p>
      <FormError message={err} />
      {saved && <p className="mt-2 text-xs text-emerald-600">Saved.</p>}
      {editable && (
        <MButton
          className="mt-3"
          disabled={save.isPending}
          onClick={async () => {
            setErr(null);
            setSaved(false);
            const body: Partial<ComplianceSettings> = {};
            for (const f of SETTING_FIELDS) (body as Record<string, unknown>)[f.key] = form[f.key];
            try {
              await save.mutateAsync(body);
              setSaved(true);
            } catch (e) {
              setErr(ispErrorMessage(e));
            }
          }}
        >
          Save
        </MButton>
      )}
    </Card>
  );
}
