/**
 * Plans → Packages → "Network rules" (ADDENDUM_05 J3): FUP, night boost,
 * validity start, queue priority, MAC binding, simultaneous logins and
 * timeouts for one package. `PUT /isp/packages/{id}/policy`.
 *
 * While `ISP_PARTNER_ENFORCEMENT_ENABLED` is off the rules are stored and
 * shown but never applied; the drawer says so instead of implying otherwise.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { MButton, MDrawer } from "@/components/master/MasterKit";
import { ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import { GroupDrawer } from "@/components/isp-partner/plans/SpeedGroupsTab";
import { PolicyFields } from "@/components/isp-partner/network/PolicyFields";
import { useSpeedGroups } from "@/hooks/isp-partner/usePlans";
import { usePackagePolicy, useSavePackagePolicy } from "@/hooks/isp-partner/useNetwork";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { ispFormErrors } from "@/lib/isp-partner/form-errors";
import { formToPolicyBody, policyToForm, type PolicyForm } from "@/lib/isp-partner/network";
import { useGbDataLimits } from "@/hooks/isp-partner/useWorkflow";
import type { IspPackage } from "@/services/isp-partner/plans-types";

export function PackagePolicyDrawer({
  pkg,
  onClose,
  canEdit,
}: {
  pkg: IspPackage | null;
  onClose: () => void;
  canEdit: boolean;
}) {
  const q = usePackagePolicy(pkg?.id ?? null);
  const groups = useSpeedGroups({ status: "active", page_size: 100 }, !!pkg);
  const save = useSavePackagePolicy(pkg?.id ?? "");
  const gb = useGbDataLimits(); // RAKESH-FS: FUP limit in GB (flag on)
  const [form, setForm] = useState<PolicyForm>(() => policyToForm(null));
  const [errors, setErrors] = useState<Partial<Record<keyof PolicyForm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [newGroupFor, setNewGroupFor] = useState<
    "fup_fallback_speed_group_id" | "boost_speed_group_id" | null
  >(null);

  useEffect(() => {
    if (q.data) setForm(policyToForm(q.data, { gb }));
    setErrors({});
    setError(null);
  }, [q.data, gb]);

  if (!pkg) return null;
  const set = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const groupList = groups.data?.items ?? [];
  const readOnly = !canEdit;
  const p = q.data;

  const submit = async () => {
    const res = formToPolicyBody(form, { gb });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setError(null);
    try {
      await save.mutateAsync(res.body);
      toast.success("Network rules saved.");
      onClose();
    } catch (err) {
      const fe = ispFormErrors(err, { known: Object.keys(form) });
      setErrors(fe.fields as Partial<Record<keyof PolicyForm, string>>);
      setError(fe.form ?? ispErrorMessage(err, "Could not save the network rules."));
    }
  };

  return (
    <MDrawer
      open
      onClose={onClose}
      title={`Network rules · ${pkg.name}`}
      subtitle="Fair usage, night boost, device binding and session limits for everyone on this package."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </MButton>
          {!readOnly && (
            <MButton onClick={submit} disabled={save.isPending || q.isLoading || !!q.error}>
              {save.isPending && <Spinner />} Save rules
            </MButton>
          )}
        </div>
      }
    >
      {q.isLoading ? (
        <Spinner />
      ) : q.error || !p ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this package's rules" />
      ) : (
        <div className="space-y-3">
          {!p.enforcement_enabled && (
            <div
              role="note"
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Enforcement is switched off for your account. These rules are saved and shown, but
                speeds, device limits and timeouts are not applied yet.
              </span>
            </div>
          )}
          {p.enforcement_enabled && (
            <p className="text-[11px] text-muted-foreground">
              {p.live_mode === "reauth"
                ? "A changed speed applies at once: the guest's session is ended and they sign in again."
                : "A changed speed applies at the guest's next sign-in."}
            </p>
          )}

          <PolicyFields
            gb={gb}
            form={form}
            set={set}
            errors={errors}
            groups={groupList}
            readOnly={readOnly}
            onNewGroup={(field) => setNewGroupFor(field)}
          />
          <FormError message={error} />
        </div>
      )}
      <GroupDrawer
        open={newGroupFor !== null}
        group={null}
        onClose={() => setNewGroupFor(null)}
        onSaved={(g) => newGroupFor && set(newGroupFor, g.id)}
      />
    </MDrawer>
  );
}
