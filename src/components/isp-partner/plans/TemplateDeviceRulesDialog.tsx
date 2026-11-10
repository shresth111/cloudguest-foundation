/** RAKESH-P1 P1-1: a speed template's device rules (device limit, MAC
 * binding, devices online at once) and "Apply to N packages" with a preview
 * first. Shown only while ISP_TEMPLATE_RULES_ENABLED is on. */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { deviceRulesSummary, rulesFormToBody, type PlanErrors } from "@/lib/isp-partner/p1-plan";
import { p1Keys, useTemplateRulesMap } from "@/hooks/isp-partner/useP1";
import { planKeys } from "@/hooks/isp-partner/usePlans";
import {
  p1Service,
  type RulesApplyResult,
  type TemplateDeviceRules,
} from "@/services/isp-partner/p1";
import type { SpeedGroup } from "@/services/isp-partner/plans-types";

const FIELD_WORD: Record<string, string> = {
  max_devices: "devices",
  mac_bind_count: "bound",
  mac_restriction: "bound only",
  max_simultaneous: "online at once",
};

const show = (v: unknown) =>
  v === null ? "no limit" : v === true ? "on" : v === false ? "off" : String(v);

export function TemplateDeviceRulesDialog({
  group,
  rules,
  onClose,
}: {
  group: SpeedGroup | null;
  rules: TemplateDeviceRules | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [devices, setDevices] = useState("1");
  const [bind, setBind] = useState("0");
  const [restrict, setRestrict] = useState(false);
  const [online, setOnline] = useState("");
  const [errors, setErrors] = useState<PlanErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RulesApplyResult | null>(null);

  useEffect(() => {
    if (!group) return;
    setDevices(String(rules?.max_devices ?? 1));
    setBind(String(rules?.mac_bind_count ?? 0));
    setRestrict(!!rules?.mac_restriction);
    setOnline(rules?.max_simultaneous == null ? "" : String(rules.max_simultaneous));
    setErrors({});
    setError(null);
    setPreview(null);
  }, [group, rules]);

  if (!group) return null;

  const save = async () => {
    const res = rulesFormToBody({
      max_devices: devices,
      mac_bind_count: bind,
      mac_restriction: restrict,
      max_simultaneous: online,
    });
    setErrors(res.ok ? {} : res.errors);
    if (!res.ok) return;
    setBusy(true);
    setError(null);
    try {
      await p1Service.putTemplateRules(group.id, res.body);
      await qc.invalidateQueries({ queryKey: p1Keys.templateRules });
      const p = await p1Service.applyTemplateRules(group.id, true);
      setPreview(p);
      if (p.would_change === 0) {
        toast.success("Device rules saved.");
        onClose();
      }
    } catch (err) {
      setError(ispErrorMessage(err, "Could not save the device rules."));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await p1Service.applyTemplateRules(group.id, false);
      await qc.invalidateQueries({ queryKey: planKeys.all });
      toast.success(`Applied to ${r.would_change} package${r.would_change === 1 ? "" : "s"}.`);
      onClose();
    } catch (err) {
      setError(ispErrorMessage(err, "Could not apply the device rules."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MDialog
      open={!!group}
      onClose={onClose}
      title={`Device rules: ${group.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            {preview ? "Not now" : "Cancel"}
          </MButton>
          {preview ? (
            <MButton onClick={apply} disabled={busy}>
              {busy && <Spinner />} Apply to {preview.would_change} package
              {preview.would_change === 1 ? "" : "s"}
            </MButton>
          ) : (
            <MButton onClick={save} disabled={busy}>
              {busy && <Spinner />} Save
            </MButton>
          )}
        </div>
      }
    >
      {preview ? (
        <div className="space-y-2 text-sm">
          <p>
            Saved. {preview.would_change} package{preview.would_change === 1 ? "" : "s"} on this
            template {preview.would_change === 1 ? "has" : "have"} different device rules. Apply the
            template's rules to {preview.would_change === 1 ? "it" : "them"}?
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
            {preview.packages
              .filter((p) => Object.keys(p.changes).length)
              .map((p) => (
                <li key={p.package_id} className="rounded border border-border px-2 py-1">
                  <span className="font-medium">{p.name}</span>:{" "}
                  {Object.entries(p.changes)
                    .map(([k, c]) => `${FIELD_WORD[k] ?? k} ${show(c.from)} → ${show(c.to)}`)
                    .join(", ")}
                </li>
              ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Existing subscribers keep their bound devices. New limits apply at their next login.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            New packages on this template start with these rules. You can still change them per
            package.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Device limit"
              value={devices}
              onChange={setDevices}
              error={errors.max_devices}
            />
            <TextField
              label="Devices online at once"
              value={online}
              onChange={setOnline}
              error={errors.max_simultaneous}
              hint="Empty for no limit."
            />
            <TextField
              label="Bind the first N devices"
              value={bind}
              onChange={setBind}
              error={errors.mac_bind_count}
              hint="0 = no binding."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={restrict}
              onChange={(e) => setRestrict(e.target.checked)}
            />
            Only bound devices may connect
          </label>
          <p className="text-[11px] text-muted-foreground">
            Now:{" "}
            {deviceRulesSummary({
              max_devices: Number(devices) || 1,
              mac_bind_count: Number(bind) || 0,
              mac_restriction: restrict,
              max_simultaneous: online.trim() ? Number(online) : null,
            })}
          </p>
          <FormError message={error} />
        </div>
      )}
      {preview && <FormError message={error} />}
    </MDialog>
  );
}

/** Row action on Plans → Speed templates. Renders nothing while the BE flag
 * is off or the caller cannot edit plans. Owns its dialog. */
export function TemplateDeviceRulesButton({ group }: { group: SpeedGroup }) {
  const { can } = usePartner();
  const rules = useTemplateRulesMap(can("isp_plans.update"));
  const [open, setOpen] = useState(false);
  if (!can("isp_plans.update") || !rules.available) return null;
  const r = rules.map.get(group.id);
  return (
    <>
      <MButton
        variant="ghost"
        title={r?.configured ? `Device rules: ${deviceRulesSummary(r)}` : "Device rules"}
        aria-label={`Device rules for ${group.name}`}
        onClick={() => setOpen(true)}
      >
        <Smartphone />
      </MButton>
      <TemplateDeviceRulesDialog
        group={open ? group : null}
        rules={r}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
