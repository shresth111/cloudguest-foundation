import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plug, Send, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./EmailPanel";
import type { IntegrationCard } from "@/types/settings";
import { settingsService } from "@/services/settings.service";
import { useInvalidateSettings } from "@/hooks/useSettings";

const GROUPS: { id: IntegrationCard["category"]; label: string }[] = [
  { id: "network", label: "Networking" },
  { id: "pms", label: "Property Management" },
  { id: "payment", label: "Payments" },
  { id: "ai", label: "AI" },
];

export function IntegrationsPanel({ data }: { data: IntegrationCard[] }) {
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const items = data.filter((i) => i.category === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{g.label}</h3>
              <Badge variant="secondary" className="rounded-full">{items.length}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => <IntegrationTile key={item.id} item={item} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IntegrationTile({ item }: { item: IntegrationCard }) {
  const inv = useInvalidateSettings();
  const [testing, setTesting] = useState(false);
  const test = async () => {
    setTesting(true);
    const r = await settingsService.testIntegration(item.id);
    setTesting(false);
    inv();
    r.ok ? toast.success(`${item.name} reachable`) : toast.error(`${item.name} test failed`);
  };
  const toggle = async () => {
    await settingsService.toggleIntegration(item.id);
    inv();
    toast.success(`${item.name} ${item.status === "connected" ? "disconnected" : "connected"}`);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="h-full border-border/60 transition-colors hover:border-border">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plug className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.category}</div>
              </div>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground">{item.description}</p>
          <div className="mt-auto flex gap-2 pt-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={toggle}>
              <Settings2 className="mr-2 h-3.5 w-3.5" />
              {item.status === "connected" ? "Disconnect" : "Configure"}
            </Button>
            <Button size="sm" variant="ghost" onClick={test} disabled={testing}>
              <Send className="mr-2 h-3.5 w-3.5" /> Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
