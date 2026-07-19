import { Copy, Download, ExternalLink, Pin } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuditDetail, usePinAudit } from "@/hooks/useAudit";
import { CategoryBadge, SeverityBadge, StatusBadge, formatTimestamp } from "./audit-utils";
import { exportRows } from "./export";

interface Props {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditDetailsDrawer({ id, open, onOpenChange }: Props) {
  const { data, isLoading } = useAuditDetail(id);
  const pin = usePinAudit();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden p-0 flex flex-col">
        <SheetHeader className="border-b border-border/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">
                {isLoading ? <Skeleton className="h-5 w-40" /> : data?.message ?? "Event details"}
              </SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {data && (
                  <>
                    <CategoryBadge category={data.category} />
                    <SeverityBadge severity={data.severity} />
                    <StatusBadge status={data.status} />
                    <span className="text-muted-foreground">· {formatTimestamp(data.timestamp)}</span>
                  </>
                )}
              </SheetDescription>
            </div>
            {data && (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(data.id); toast.success("Copied ID"); }} title="Copy ID">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => pin.mutate({ id: data.id, pinned: !data.pinned })} title="Pin event">
                  <Pin className={`h-4 w-4 ${data.pinned ? "text-primary" : ""}`} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => exportRows([data], "json")} title="Export">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {isLoading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                <Section title="Event">
                  <KV label="Log ID" value={<code className="rounded bg-muted px-1.5 py-0.5 text-xs">{data.id}</code>} />
                  <KV label="Module"  value={data.module} />
                  <KV label="Action"  value={<code className="rounded bg-muted px-1.5 py-0.5 text-xs">{data.action}</code>} />
                  <KV label="Resource" value={`${data.resource}${data.resourceId ? " · " + data.resourceId : ""}`} />
                  <KV label="Timestamp" value={formatTimestamp(data.timestamp)} />
                </Section>

                <Section title="Actor">
                  <KV label="Name"  value={data.actor.name} />
                  <KV label="Email" value={data.actor.email} />
                  <KV label="Role"  value={data.actor.role} />
                </Section>

                <Section title="Organization">
                  <KV label="Organization" value={data.organizationName} />
                  <KV label="Location"     value={data.locationName ?? "—"} />
                </Section>

                <Section title="Context">
                  <KV label="IP address" value={<code className="font-mono text-xs">{data.context.ipAddress}</code>} />
                  <KV label="Device"     value={data.context.device} />
                  <KV label="Browser"    value={data.context.browser} />
                  <KV label="OS"         value={data.context.os} />
                  <KV label="Location"   value={data.context.location ?? "—"} />
                </Section>

                <Tabs defaultValue="diff">
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="diff">Diff</TabsTrigger>
                    <TabsTrigger value="request">Request</TabsTrigger>
                    <TabsTrigger value="response">Response</TabsTrigger>
                    <TabsTrigger value="stack">Stack trace</TabsTrigger>
                  </TabsList>
                  <TabsContent value="diff" className="mt-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <JsonBlock title="Before" data={data.before} />
                      <JsonBlock title="After" data={data.after} />
                    </div>
                  </TabsContent>
                  <TabsContent value="request" className="mt-3">
                    <JsonBlock title="Request payload" data={data.requestPayload} />
                  </TabsContent>
                  <TabsContent value="response" className="mt-3">
                    <JsonBlock title="Response payload" data={data.responsePayload} />
                  </TabsContent>
                  <TabsContent value="stack" className="mt-3">
                    <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed">
                      {data.stackTrace ?? "No stack trace available."}
                    </pre>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </ScrollArea>

        {data && (
          <div className="border-t border-border/60 p-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>View related resource</span>
            <Button size="sm" variant="outline" onClick={() => toast.info("Deep link mocked")}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open resource
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
      <Separator className="mt-3 opacity-0" />
    </div>
  );
}
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
function JsonBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <pre className="max-h-56 overflow-auto p-3 text-[11px] leading-relaxed">{data ? JSON.stringify(data, null, 2) : "—"}</pre>
    </div>
  );
}
