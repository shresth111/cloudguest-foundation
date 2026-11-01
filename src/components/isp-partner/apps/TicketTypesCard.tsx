/** Ticket types (Apps -> Helpdesk): name, SLA, whether resolving needs a
 * reason for outage, active. Managers only edit. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MButton, MTable, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import { appsKeys, useAppsMutation } from "@/components/isp-partner/apps/appsKit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { slaMinutes } from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import type { TicketTypeBody, TicketTypeFull } from "@/services/isp-partner/apps-types";

export function TicketTypesCard({ canManage }: { canManage: boolean }) {
  const q = useQuery({
    queryKey: appsKeys.list("ticket-types"),
    queryFn: () => appsService.ticketTypes(),
    retry: false,
  });
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const create = useAppsMutation((body: TicketTypeBody) => appsService.createTicketType(body));
  const seed = useAppsMutation(() => appsService.seedTicketTypes());
  const save = useAppsMutation((v: { id: string; body: TicketTypeBody }) =>
    appsService.patchTicketType(v.id, v.body),
  );
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };
  if (q.error)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="ticket types" />;
  return (
    <Card
      title="Ticket types"
      actions={
        canManage && (q.data?.length ?? 0) === 0 ? (
          <MButton
            variant="outline"
            disabled={seed.isPending}
            onClick={() => run(() => seed.mutateAsync(undefined), "Standard types added.")}
          >
            Add the standard types
          </MButton>
        ) : undefined
      }
    >
      <MTable
        loading={q.isLoading}
        head={
          <>
            <MTh>Name</MTh>
            <MTh>SLA</MTh>
            <MTh>Reason for outage on resolve</MTh>
            <MTh>Active</MTh>
          </>
        }
      >
        {(q.data ?? []).map((t: TicketTypeFull) => (
          <MTr key={t.id}>
            <MTd>{t.name}</MTd>
            <MTd className="text-xs">
              {canManage ? (
                <input
                  className={`${M_INPUT} w-24`}
                  defaultValue={t.sla_minutes ? String(t.sla_minutes / 60) : ""}
                  placeholder="hours"
                  aria-label={`${t.name} SLA hours`}
                  onBlur={(e) => {
                    const m = slaMinutes(e.target.value);
                    if (m === "bad") return setErr("SLA: hours between 0.1 and 1440.");
                    if (m !== t.sla_minutes)
                      run(
                        () => save.mutateAsync({ id: t.id, body: { sla_minutes: m } }),
                        "SLA saved.",
                      );
                  }}
                />
              ) : t.sla_minutes ? (
                `${t.sla_minutes / 60} h`
              ) : (
                "No SLA"
              )}
            </MTd>
            <MTd>
              <input
                type="checkbox"
                aria-label={`${t.name} needs a reason for outage`}
                checked={t.requires_rfo}
                disabled={!canManage}
                onChange={(e) =>
                  run(
                    () => save.mutateAsync({ id: t.id, body: { requires_rfo: e.target.checked } }),
                    "Saved.",
                  )
                }
              />
            </MTd>
            <MTd>
              <input
                type="checkbox"
                aria-label={`${t.name} active`}
                checked={t.active}
                disabled={!canManage}
                onChange={(e) =>
                  run(
                    () => save.mutateAsync({ id: t.id, body: { active: e.target.checked } }),
                    "Saved.",
                  )
                }
              />
            </MTd>
          </MTr>
        ))}
      </MTable>
      {canManage && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            className={`${M_INPUT} w-56`}
            placeholder="New type name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New type name"
          />
          <input
            className={`${M_INPUT} w-28`}
            placeholder="SLA hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            aria-label="New type SLA hours"
          />
          <MButton
            disabled={create.isPending || !name.trim()}
            onClick={() => {
              const m = slaMinutes(hours);
              if (m === "bad") return setErr("SLA: hours between 0.1 and 1440.");
              run(async () => {
                await create.mutateAsync({
                  name: name.trim(),
                  sla_minutes: m,
                  requires_rfo: true,
                  active: true,
                });
                setName("");
                setHours("");
              }, "Type added.");
            }}
          >
            {create.isPending && <Spinner />} Add type
          </MButton>
        </div>
      )}
      <FormError message={err} />
    </Card>
  );
}
