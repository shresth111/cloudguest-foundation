/** The CAF-only fields (CAF-2): applicant type, father's / spouse's name,
 * plot no., locality, district. Controlled; the parent owns the draft. */
import { M_INPUT } from "@/components/master/MasterKit";
import { TextField } from "@/components/isp-partner/kit";
import { CATEGORY_LABEL, type ExtrasDraft } from "@/lib/isp-partner/caf";
import type { ApplicantCategory } from "@/services/isp-partner/caf";

export function CafExtrasFields({
  draft,
  onChange,
  categories,
  disabled,
}: {
  draft: ExtrasDraft;
  onChange: (d: ExtrasDraft) => void;
  categories: ApplicantCategory[];
  disabled?: boolean;
}) {
  const set = (k: keyof ExtrasDraft) => (v: string) => onChange({ ...draft, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Applicant type</span>
        <select
          className={M_INPUT}
          value={draft.applicant_category}
          disabled={disabled}
          onChange={(e) => set("applicant_category")(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c] ?? c}
            </option>
          ))}
        </select>
      </label>
      {draft.applicant_category === "other" ? (
        <TextField
          label="Which kind"
          value={draft.applicant_category_other}
          onChange={set("applicant_category_other")}
          disabled={disabled}
        />
      ) : (
        <span />
      )}
      <TextField
        label="Father's / spouse's name"
        value={draft.father_or_spouse_name}
        onChange={set("father_or_spouse_name")}
        disabled={disabled}
      />
      <TextField
        label="Plot / house no."
        value={draft.plot_no}
        onChange={set("plot_no")}
        disabled={disabled}
      />
      <TextField
        label="Locality"
        value={draft.locality}
        onChange={set("locality")}
        disabled={disabled}
      />
      <TextField
        label="District"
        value={draft.district}
        onChange={set("district")}
        disabled={disabled}
      />
    </div>
  );
}
