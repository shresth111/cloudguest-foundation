/**
 * ENFORCE-1: data limits count only what the router reports, so while the
 * backend's enforcement flag is on, the setup script carries one more step
 * (before TR-069): report usage every 5 minutes. With the flag off the
 * endpoint answers 404, nothing is registered and nothing is shown, so the
 * script is exactly today's.
 */
import { useEffect } from "react";
import { Info } from "lucide-react";
import { useEnforcementSetupChunk } from "@/hooks/isp-partner/useNetwork";
import { setPartnerSetupExtraChunks } from "@/lib/isp-partner/setup-extra-chunks";

export function PartnerAccountingSetupStep({ routerId }: { routerId: string }) {
  const q = useEnforcementSetupChunk(routerId);
  const chunk = q.data ?? null;

  useEffect(() => {
    setPartnerSetupExtraChunks(chunk ? [chunk] : [], "accounting");
    return () => setPartnerSetupExtraChunks([], "accounting");
  }, [chunk]);

  if (!chunk) return null;
  return (
    <div className="flex gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
      <div className="space-y-1">
        <p className="font-semibold">Usage reporting is included in this script</p>
        <p className="text-muted-foreground">
          The router reports each subscriber&apos;s data use every 5 minutes, so data limits and the
          slower after-limit speed apply on time.
        </p>
      </div>
    </div>
  );
}
