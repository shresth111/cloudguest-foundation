/** Shared bits for the Apps screens (APPS-FE): status tag, CSV button,
 * assignee picker, query keys. */
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { MButton, MTag, M_INPUT } from "@/components/master/MasterKit";
import { Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispService } from "@/services/isp-partner/isp";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { label, tone } from "@/lib/isp-partner/apps";
import type { FileDownload } from "@/services/isp-partner/isp";

export const appsKeys = {
  all: ["isp", "apps"] as const,
  probe: ["isp", "apps", "probe"] as const,
  list: (what: string, q: object = {}) => ["isp", "apps", what, q] as const,
  one: (what: string, id: string) => ["isp", "apps", what, "one", id] as const,
};

export function StatusTag({ map, value }: { map: Record<string, string>; value: string }) {
  return <MTag label={label(map, value)} tone={tone(value)} />;
}

export function CsvButton({
  run,
  label: text = "CSV",
}: {
  run: () => Promise<FileDownload>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <MButton
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const f = await run();
          saveBlob(f.blob, f.filename);
        } catch (e) {
          toast.error(ispErrorMessage(e, "The export failed."));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <FileDown />} {text}
    </MButton>
  );
}

/** Staff the ISP can assign work to. The staff list needs
 * `isp_partner.assign`; without it the picker offers "me" only. */
export function AssigneeSelect({
  value,
  onChange,
  allowNone = true,
  ariaLabel = "Assignee",
}: {
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
  ariaLabel?: string;
}) {
  const { me, can } = usePartner();
  const listed = can("isp_partner.assign");
  const users = useQuery({
    queryKey: ["isp", "apps", "staff"],
    queryFn: () => ispService.listUsers({ page: 1, page_size: 100, status: "active" }),
    enabled: listed,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const options = listed
    ? (users.data?.items ?? []).map((u) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`.trim() || u.username,
      }))
    : [{ id: me.user.id, name: `${me.user.name} (me)` }];
  return (
    <select
      className={M_INPUT}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      {allowNone && <option value="">Anyone / unassigned</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.id === me.user.id && listed ? `${o.name} (me)` : o.name}
        </option>
      ))}
    </select>
  );
}

/** A mutation that refreshes every Apps query when it succeeds. */
export function useAppsMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: appsKeys.all }),
  });
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <select
      className={`${M_INPUT} ${className ?? ""}`}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
