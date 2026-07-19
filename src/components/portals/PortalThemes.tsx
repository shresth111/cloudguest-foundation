import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useApplyTheme, usePortalThemes, useSaveAsTheme } from "@/hooks/usePortals";
import type { Portal } from "@/types/portal";

export function PortalThemes({ portal }: { portal: Portal }) {
  const { data, isLoading, isError, refetch } = usePortalThemes();
  const apply = useApplyTheme(portal.id);
  const save = useSaveAsTheme(portal.id);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState(`${portal.name} Theme`);

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Theme library</h3>
          <p className="text-xs text-muted-foreground">Apply a template or save the current design as a theme.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
          <Save className="mr-2 h-3.5 w-3.5" /> Save as theme
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {data.map((t, i) => {
          const active = portal.themeId === t.id;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className={`overflow-hidden ${active ? "ring-2 ring-primary" : ""}`}>
                <div
                  className="relative h-24"
                  style={{ background: `linear-gradient(135deg, ${t.preview.from}, ${t.preview.to})` }}
                >
                  <div
                    className="absolute bottom-2 left-2 h-6 w-6 rounded-full border border-white/60"
                    style={{ background: t.preview.accent }}
                  />
                  {active && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.category.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant={active ? "secondary" : "default"} className="w-full" onClick={() => apply.mutate(t.id)}>
                      {active ? "Applied" : "Apply theme"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save as new theme</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Theme name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await save.mutateAsync(name);
                setSaveOpen(false);
              }}
            >
              Save theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
