/** LEFTOVERS #8: `PUT /isp/plan-settings`. The default validity is read by
 * the package drawer (prefill) but had no editor. Shown only to
 * `isp_plans.update` and only once the stored value has loaded, so the
 * button never shows a guessed number. */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { usePlanSettings, usePlansMutation } from "@/hooks/isp-partner/usePlans";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { plansService } from "@/services/isp-partner/plans";

export function PlanSettingsButton() {
  const { can } = usePartner();
  const settings = usePlanSettings();
  const [open, setOpen] = useState(false);
  if (!can("isp_plans.update") || !settings.data) return null;
  const days = settings.data.default_validity_days;
  return (
    <>
      <MButton variant="outline" onClick={() => setOpen(true)}>
        Default validity: {days} day{days === 1 ? "" : "s"}
      </MButton>
      {open && <PlanSettingsDialog days={days} onClose={() => setOpen(false)} />}
    </>
  );
}

function PlanSettingsDialog({ days, onClose }: { days: number; onClose: () => void }) {
  const [value, setValue] = useState(String(days));
  const [error, setError] = useState<string | null>(null);
  const save = usePlansMutation((d: number) =>
    plansService.putPlanSettings({ default_validity_days: d }),
  );
  const submit = async () => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1 || v > 3650) {
      setError("1 to 3650 days.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(v);
      toast.success("Default validity saved.");
      onClose();
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };
  return (
    <MDialog
      open
      onClose={onClose}
      title="Default package validity"
      footer={
        <MButton onClick={submit} disabled={save.isPending}>
          {save.isPending && <Spinner />} Save
        </MButton>
      }
    >
      <div className="space-y-3">
        <TextField
          label="Validity (days)"
          type="number"
          value={value}
          onChange={setValue}
          hint="Prefilled when you add a package. Existing packages keep their own validity."
        />
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
