/** A lead's CAF (CAF-2): prefill from the lead (JAZE-5), the CAF-only
 * fields saved against the lead, and "Convert to subscriber", which asks
 * only for what the lead does not already have (a package if none is on the
 * lead, a customer if it is unassigned; the login id defaults to the lead's
 * mobile). The CAF fields move onto the new subscriber. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { MButton, MTag, M_INPUT } from "@/components/master/MasterKit";
import {
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CafExtrasFields } from "@/components/isp-partner/compliance/caf/CafExtrasFields";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { addressLine, extrasBody, extrasDraft, maskTwelveDigits } from "@/lib/isp-partner/caf";
import {
  cafService,
  type ApplicantCategory,
  type CafLeadPrefill,
} from "@/services/isp-partner/caf";

export function CafLeadPanel({
  leadId,
  categories,
  canConvert,
  onConverted,
}: {
  leadId: string;
  categories: ApplicantCategory[];
  canConvert: boolean;
  onConverted: (subscriberId: string) => void;
}) {
  const q = useQuery({
    queryKey: ["isp", "caf", "lead", leadId],
    queryFn: () => cafService.lead(leadId),
    retry: false,
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this lead" />;
  return (
    <Body data={q.data} categories={categories} canConvert={canConvert} onConverted={onConverted} />
  );
}

function Body({
  data,
  categories,
  canConvert,
  onConverted,
}: {
  data: CafLeadPrefill;
  categories: ApplicantCategory[];
  canConvert: boolean;
  onConverted: (subscriberId: string) => void;
}) {
  const { can } = usePartner();
  const l = data.lead;
  const editable = can("isp_partner.update");
  const needPackage = !l.interested_package_id;
  const needCustomer = !l.isp_customer_id;
  const customers = useIspCustomerOptions(canConvert && needCustomer);
  const packages = usePackages({ status: "active", page_size: 100 }, canConvert && needPackage);
  const [draft, setDraft] = useState(() => extrasDraft(data.extras));
  const [identifier, setIdentifier] = useState("");
  const [packageId, setPackageId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "convert">("");
  const converted = l.status === "converted" || !!l.converted_subscriber_id;

  const saveExtras = async (): Promise<boolean> => {
    const r = extrasBody(draft);
    if ("error" in r) {
      setErr(r.error);
      return false;
    }
    await cafService.saveLeadExtras(l.id, r.body);
    return true;
  };

  return (
    <div className="space-y-4">
      <Card title={`${l.name} · ${l.number}`} actions={<MTag label={l.status} />}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Mobile / email</dt>
          <dd>{maskTwelveDigits(addressLine([l.phone, l.email])) || "–"}</dd>
          <dt className="text-muted-foreground">Address</dt>
          <dd>{maskTwelveDigits(addressLine([l.address, l.city])) || "–"}</dd>
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{l.customer_name ?? "Not assigned yet"}</dd>
        </dl>
        <p className="mt-2 text-[11px] text-muted-foreground">
          KYC (ID proof, photo, signature) is recorded on the subscriber after conversion.
        </p>
      </Card>

      <Card title="CAF details">
        <CafExtrasFields
          draft={draft}
          onChange={setDraft}
          categories={categories}
          disabled={!editable || converted}
        />
        {editable && !converted && (
          <MButton
            className="mt-3"
            variant="outline"
            disabled={busy !== ""}
            onClick={async () => {
              setErr(null);
              setBusy("save");
              try {
                if (await saveExtras()) toast.success("Saved.");
              } catch (e) {
                setErr(ispErrorMessage(e));
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === "save" && <Spinner />} Save details
          </MButton>
        )}
      </Card>

      {canConvert && !converted && (
        <Card title="Convert to subscriber">
          <p className="mb-3 text-xs text-muted-foreground">
            Name, mobile, email and address come from the lead. The CAF details above go with it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Login id (optional)"
              value={identifier}
              onChange={setIdentifier}
              placeholder={l.phone ?? "Their mobile"}
            />
            {needPackage && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Package</span>
                <select
                  className={M_INPUT}
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                >
                  <option value="">Pick…</option>
                  {(packages.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {needCustomer && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Customer (venue)</span>
                <CustomerSelect
                  value={customerId}
                  onChange={setCustomerId}
                  customers={customers.data}
                  allLabel={null}
                />
              </label>
            )}
          </div>
          <MButton
            className="mt-3"
            disabled={busy !== ""}
            onClick={async () => {
              setErr(null);
              if (needPackage && !packageId) return setErr("Pick the package.");
              if (needCustomer && !customerId) return setErr("Pick the customer.");
              if (identifier.trim() && identifier.trim().length < 3)
                return setErr("Login id: at least 3 characters.");
              setBusy("convert");
              try {
                if (editable && !(await saveExtras())) return;
                const out = await cafService.convertLead(l.id, {
                  identifier: identifier.trim() || null,
                  package_id: packageId || null,
                  isp_customer_id: customerId || null,
                });
                toast.success("Converted. The CAF is ready to prepare.");
                onConverted(out.subscriber.id);
              } catch (e) {
                setErr(ispErrorMessage(e));
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === "convert" ? <Spinner /> : <UserCheck />} Convert to subscriber
          </MButton>
        </Card>
      )}
      <FormError message={err} />
    </div>
  );
}
