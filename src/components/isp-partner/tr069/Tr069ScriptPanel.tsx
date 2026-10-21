/**
 * "Enable TR-069 management": the separate RouterOS step from the tr069
 * domain (PRD §4.9, API_CONTRACT §5). Fetched on demand, because the script
 * carries the ACS password and every fetch is audited.
 */
import { useState } from "react";
import { Download, FileCode2 } from "lucide-react";
import { MButton } from "@/components/master/MasterKit";
import { Card, CopyField, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { saveBlob } from "@/components/isp-partner/kit";
import { useTr069RouterScript } from "@/hooks/isp-partner/useTr069";
import { rscSlug } from "@/lib/rsc-filename";

export function tr069ScriptFilename(locationName: string | null | undefined, routerId: string) {
  return `tr069-${rscSlug(locationName ?? "") || routerId}.rsc`;
}

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
                  tr069ScriptFilename(locationName, routerId),
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
          Paste this on the router after the main setup script. It points the router&apos;s
          TR-069 client at the Wyfy Guest device manager, using this customer&apos;s credential
          (or your ISP credential if the customer has none), and checks that the client is
          running.
        </p>
        <p>
          It needs RouterOS&apos;s <code>tr069-client</code> extra package. If the package is
          missing the script stops and says so; install the package for the router&apos;s
          RouterOS version and architecture, reboot, and paste it again. If TR-069 is off for
          this location, the same script turns the client off.
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
