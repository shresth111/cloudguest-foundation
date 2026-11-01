/** Open an incident on one router, fiber node or zone. "Who is affected"
 * is previewed from the backend before anything is created. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MButton, MDialog, MField, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { FormError } from "@/components/isp-partner/kit";
import { useIncidentsMutation } from "@/hooks/isp-partner/useIncidents";
import { ispErrorMessage, isNotFound } from "@/lib/isp-partner/errors";
import { SCOPE_LABEL, SEVERITY_LABEL } from "@/lib/isp-partner/incidents";
import { fiberService } from "@/services/isp-partner/fiber";
import { incidentsService } from "@/services/isp-partner/incidents";
import { zonesService } from "@/services/isp-partner/invoices";
import { ispService } from "@/services/isp-partner/isp";
import type {
  IncidentScopeKind,
  IncidentSeverity,
  IncidentTarget,
} from "@/services/isp-partner/incidents-types";

export function NewIncidentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [kind, setKind] = useState<IncidentScopeKind>("router");
  const [target, setTarget] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("major");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const routers = useQuery({
    queryKey: ["isp", "incidents", "pick", "routers"],
    queryFn: () => ispService.listRouters({ page_size: 100 }),
    enabled: kind === "router",
    retry: false,
  });
  const nodes = useQuery({
    queryKey: ["isp", "incidents", "pick", "fiber"],
    queryFn: () => fiberService.nodes({ page_size: 100 }),
    enabled: kind === "fiber_node",
    retry: false,
  });
  const zones = useQuery({
    queryKey: ["isp", "incidents", "pick", "zones"],
    queryFn: () => zonesService.list(),
    enabled: kind === "zone",
    retry: false,
  });
  const t: IncidentTarget | null = target
    ? kind === "router"
      ? { scope_kind: kind, isp_router_id: target }
      : kind === "fiber_node"
        ? { scope_kind: kind, fiber_node_id: target }
        : { scope_kind: kind, zone_id: target }
    : null;
  const preview = useQuery({
    queryKey: ["isp", "incidents", "preview", t],
    queryFn: () => incidentsService.preview(t as IncidentTarget),
    enabled: !!t,
    retry: false,
  });
  const create = useIncidentsMutation(() =>
    incidentsService.create({
      ...(t as IncidentTarget),
      severity,
      title: title.trim() || undefined,
      note: note.trim() || undefined,
    }),
  );
  const options: { id: string; label: string }[] =
    kind === "router"
      ? (routers.data?.items ?? []).map((r) => ({
          id: r.id,
          label: `${r.name} · ${r.customer_name} · ${r.status}`,
        }))
      : kind === "fiber_node"
        ? (nodes.data?.items ?? []).map((n) => ({
            id: n.id,
            label: `${n.kind.toUpperCase()} ${n.name}`,
          }))
        : (zones.data?.map((z) => ({ id: z.id, label: z.name })) ?? []);
  const fiberOff = kind === "fiber_node" && nodes.error && isNotFound(nodes.error);

  return (
    <MDialog
      open
      onClose={onClose}
      title="Open an incident"
      wide
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={!t || create.isPending}
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: (d) => {
                  toast.success(`${d.code} opened: ${d.affected_total} subscribers affected`);
                  onCreated(d.id);
                },
              })
            }
          >
            Open incident
          </MButton>
        </>
      }
    >
      <div className="space-y-3">
        <MSeg<IncidentScopeKind>
          value={kind}
          onChange={(k) => {
            setKind(k);
            setTarget("");
          }}
          options={(["router", "fiber_node", "zone"] as const).map((k) => ({
            value: k,
            label: SCOPE_LABEL[k],
          }))}
        />
        {fiberOff ? (
          <p className="text-xs text-muted-foreground">The fiber registry is not switched on.</p>
        ) : (
          <MField label={`Which ${SCOPE_LABEL[kind].toLowerCase()}`}>
            <select className={M_INPUT} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Pick one</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </MField>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <MField label="Title (optional)">
            <input
              className={M_INPUT}
              maxLength={200}
              placeholder="Outage: …"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </MField>
          <MField label="Severity">
            <select
              className={M_INPUT}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            >
              {(["minor", "major", "critical"] as const).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </MField>
        </div>
        <MField label="First note (optional)">
          <textarea
            className={M_INPUT}
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </MField>
        {t && (
          <div className="rounded-lg border border-border p-3 text-sm">
            {preview.isLoading ? (
              "Working out who is affected…"
            ) : preview.error ? (
              <FormError message={ispErrorMessage(preview.error)} />
            ) : (
              <>
                <div className="font-medium">
                  {preview.data?.affected_total ?? 0} subscribers affected
                  {preview.data && preview.data.affected_visible !== preview.data.affected_total
                    ? ` (${preview.data.affected_visible} in your customers)`
                    : ""}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {preview.data?.sample.map((x) => x.label).join(", ")}
                  {(preview.data?.affected_visible ?? 0) > 20 ? " …" : ""}
                </div>
              </>
            )}
          </div>
        )}
        <FormError message={create.error ? ispErrorMessage(create.error) : null} />
      </div>
    </MDialog>
  );
}
