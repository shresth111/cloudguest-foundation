/** PPPoE session rows (lane JAZE-6), shared by the sessions list and the
 * subscriber panel. Disconnect is per session and needs
 * `isp_subscribers.update`; the router reports whether it really ended. */
import { toast } from "sonner";
import { Unplug } from "lucide-react";
import { MButton, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { usePppoeMutation } from "@/hooks/isp-partner/usePppoe";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/isp-partner/format";
import { formatMac, kickSummary, sessionSeconds } from "@/lib/isp-partner/pppoe";
import { pppoeService } from "@/services/isp-partner/pppoe";
import type { PppoeSession } from "@/services/isp-partner/pppoe-types";

export function PppoeSessionTable({
  sessions,
  showUser = true,
  loading,
}: {
  sessions: PppoeSession[];
  showUser?: boolean;
  loading?: boolean;
}) {
  const { can } = usePartner();
  const canKick = can("isp_subscribers.disconnect"); // RBAC-FIX R1
  const kick = usePppoeMutation((id: string) => pppoeService.disconnectSession(id));
  return (
    <MTable
      loading={loading}
      head={
        <>
          {showUser && <MTh>Username</MTh>}
          <MTh>Status</MTh>
          <MTh>Started</MTh>
          <MTh>Duration</MTh>
          <MTh>IP</MTh>
          <MTh>Device (MAC)</MTh>
          <MTh className="text-right">Down / up</MTh>
          {canKick && <MTh />}
        </>
      }
    >
      {sessions.map((s) => (
        <MTr key={s.id}>
          {showUser && <MTd className="font-mono text-xs">{s.username}</MTd>}
          <MTd>
            <MTag
              label={s.status === "active" ? "Live" : "Ended"}
              tone={s.status === "active" ? "active" : "normal"}
            />
            {s.terminate_cause && (
              <p className="text-[11px] text-muted-foreground">{s.terminate_cause}</p>
            )}
          </MTd>
          <MTd className="text-xs">{formatDateTime(s.started_at)}</MTd>
          <MTd className="text-xs">
            {formatDuration(sessionSeconds(s.started_at, s.stopped_at))}
          </MTd>
          <MTd className="font-mono text-xs">
            {s.ip ?? "–"}
            {s.delegated_ipv6_prefix && (
              <p className="text-muted-foreground">{s.delegated_ipv6_prefix}</p>
            )}
          </MTd>
          <MTd className="font-mono text-xs">{formatMac(s.mac)}</MTd>
          <MTd className="text-right text-xs tabular-nums">
            {formatBytes(s.bytes_downloaded)} / {formatBytes(s.bytes_uploaded)}
          </MTd>
          {canKick && (
            <MTd className="text-right">
              {s.status === "active" && (
                <MButton
                  variant="ghost"
                  title="Disconnect"
                  aria-label={`Disconnect ${s.username}`}
                  disabled={kick.isPending && kick.variables === s.id}
                  onClick={async () => {
                    try {
                      const r = await kick.mutateAsync(s.id);
                      toast.success(kickSummary([r]));
                    } catch (e) {
                      toast.error(ispErrorMessage(e));
                    }
                  }}
                >
                  {kick.isPending && kick.variables === s.id ? <Spinner /> : <Unplug />}
                </MButton>
              )}
            </MTd>
          )}
        </MTr>
      ))}
    </MTable>
  );
}
