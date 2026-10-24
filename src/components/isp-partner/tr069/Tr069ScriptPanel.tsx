/**
 * "Enable TR-069 management": the separate RouterOS step from the tr069
 * domain (PRD §4.9, API_CONTRACT §5). Fetched on demand, because the script
 * carries the ACS password and every fetch is audited.
 */
import { useState } from "react";
import { Download, FileCode2 } from "lucide-react";
import { MButton } from "@/components/master/MasterKit";
import { Card, CopyField, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { saveBlob, tr069ScriptFilename } from "@/lib/isp-partner/download";
import { useTr069RouterScript } from "@/hooks/isp-partner/useTr069";
import { rscSlug } from "@/lib/rsc-filename";

export function Tr069ScriptPanel({
  routerId,
  locationName,
}: {
  routerId: string;
  locationName: string;
}) {
  const [requested, setRequested] = useState(false);
  const q = useTr069RouterScript(routerId, requested);

  return (
    <Card
      title="Enable TR-069 management"
      actions={
        !requested ? (
          <MButton variant="outline" onClick={() => setRequested(true)}>
            <FileCode2 /> Show TR-069 script
          </MButton>
        ) : (
          q.data && (
            <MButton
              variant="outline"
              onClick={() =>
                saveBlob(
                  new Blob([q.data], { type: "text/plain;charset=utf-8" }),
                  tr069ScriptFilename(locationName, routerId, rscSlug),
                )
              }
            >
              <Download /> Download .rsc
            </MButton>
          )
        )
      }
    >
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          For a router that is already set up. A new router gets this step at the end of its main
          setup script when TR-069 is on for its location. It points the router&apos;s TR-069 client
          at the Wyfy Guest device manager with this location&apos;s credential (or the
          customer&apos;s, or your ISP&apos;s), and checks that the client is running.
        </p>
        <p>
          If RouterOS&apos;s <code>tr069-client</code> package is missing, the script downloads it
          for the router&apos;s RouterOS version (6.x or 7.x) and architecture, and the router{" "}
          <strong>reboots at the end</strong>. The TR-069 settings apply by themselves once it is
          back. Without internet, or on an unsupported version, it says so and does not reboot. Safe
          to paste twice. If TR-069 is off for this location, the same script turns the client off.
        </p>
      </div>
      {requested && (
        <div className="mt-3">
          {q.isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner /> Generating…
            </p>
          ) : q.error ? (
            <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the TR-069 script" />
          ) : (
            <div className="space-y-2">
              <CopyField label="Script (contains a password, do not share)" value={q.data ?? ""} />
              <pre className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-2.5 text-[10px] leading-snug">
                <code>{q.data}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
