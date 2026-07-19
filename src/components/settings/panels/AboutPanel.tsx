import { Info as InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard, FieldGrid } from "../SectionCard";
import type { AboutInfo } from "@/types/settings";

export function AboutPanel({ data }: { data: AboutInfo }) {
  return (
    <SectionCard
      title="About"
      description="Runtime versions and build information."
    >
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><InfoIcon className="h-5 w-5" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            CloudGuest v{data.platformVersion}
            <Badge variant="outline" className="uppercase">{data.environment}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">{data.buildNumber}</div>
        </div>
      </div>
      <FieldGrid>
        <Row label="Platform version" value={data.platformVersion} />
        <Row label="Build number" value={data.buildNumber} />
        <Row label="Environment" value={data.environment} />
        <Row label="React version" value={data.reactVersion} />
        <Row label="API version" value={data.apiVersion} />
        <Row label="Database version" value={data.databaseVersion} />
        <Row label="Redis version" value={data.redisVersion} />
      </FieldGrid>
      <p className="text-xs text-muted-foreground">{data.licenseNotice}</p>
    </SectionCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
