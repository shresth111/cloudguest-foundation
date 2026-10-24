/**
 * Founder ask (2026-10-24): when this router's location has TR-069 on, the
 * setup script generated below carries the TR-069 step at its END (see
 * `lib/isp-partner/setup-extra-chunks.ts`). This registers that step and
 * says so on the page. With TR-069 off nothing is registered and the script
 * is exactly today's. The location card keeps the separate TR-069 script for
 * routers that are already set up.
 */
import { useEffect } from "react";
import { Info } from "lucide-react";
import { Spinner } from "@/components/isp-partner/kit";
import { useTr069Location, useTr069RouterScript } from "@/hooks/isp-partner/useTr069";
import {
  setPartnerSetupExtraChunks,
  TR069_CHUNK_LABEL,
} from "@/lib/isp-partner/setup-extra-chunks";

export function PartnerTr069SetupStep({
  routerId,
  locationId,
}: {
  routerId: string;
  locationId: string | null | undefined;
}) {
  const loc = useTr069Location(locationId ?? "", Boolean(locationId));
  const on = loc.data?.enabled === true;
  const script = useTr069RouterScript(routerId, on);

  useEffect(() => {
    setPartnerSetupExtraChunks(
      on && script.data ? [{ label: TR069_CHUNK_LABEL, script: script.data }] : [],
    );
    return () => setPartnerSetupExtraChunks([]);
  }, [on, script.data]);

  if (!on) return null;
  return (
    <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p className="font-semibold">TR-069 is included at the end of this script</p>
        {script.isLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Preparing the TR-069 step… wait for it before you click Generate.
          </p>
        ) : script.error ? (
          <p className="text-destructive">
            The TR-069 step could not be prepared, so this script will not include it. Use the
            TR-069 script on the location card after setup.
          </p>
        ) : (
          <p className="text-muted-foreground">
            If the router does not have the <span className="font-mono">tr069-client</span> package
            yet, the script downloads it for the router&apos;s RouterOS version and the router
            reboots at the very end. The TR-069 settings apply by themselves once it is back.
          </p>
        )}
      </div>
    </div>
  );
}
