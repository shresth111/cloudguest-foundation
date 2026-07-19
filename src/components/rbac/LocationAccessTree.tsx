import { useState } from "react";
import { ChevronRight, MapPin, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRbacLocationTree } from "@/hooks/useRbac";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function LocationAccessTree() {
  const { data: tree, isLoading } = useRbacLocationTree();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const toggleExpand = (id: string) => { const n = new Set(expanded); n.has(id) ? n.delete(id) : n.add(id); setExpanded(n); };
  const selectAll = () => {
    const n = new Set<string>();
    tree?.forEach((o) => { n.add(o.id); o.children?.forEach((c) => n.add(c.id)); });
    setSelected(n);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Location access</h3>
            <p className="text-xs text-muted-foreground">Assign single, multiple, or all locations to users and roles.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>All locations</Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>

        <div className="rounded-lg border p-2">
          {isLoading || !tree ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="my-1 h-8 w-full" />) : tree.map((org) => {
            const isExpanded = expanded.has(org.id);
            return (
              <div key={org.id} className="rounded-md">
                <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/40">
                  <button onClick={() => toggleExpand(org.id)} className="p-1" aria-label="Toggle">
                    <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                  </button>
                  <Checkbox checked={selected.has(org.id)} onCheckedChange={() => toggle(org.id)} />
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{org.name}</span>
                </div>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="ms-6 overflow-hidden border-s ps-3">
                      {org.children?.map((loc) => (
                        <label key={loc.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 text-sm">
                          <Checkbox checked={selected.has(loc.id)} onCheckedChange={() => toggle(loc.id)} />
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {loc.name}
                        </label>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">{selected.size} location{selected.size !== 1 ? "s" : ""} selected.</p>
      </CardContent>
    </Card>
  );
}
