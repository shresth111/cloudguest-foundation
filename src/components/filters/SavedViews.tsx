import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, Plus, Trash2, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

const PRESETS: SavedView[] = [
  { id: "sv-1", name: "Offline Routers", filters: { status: "offline" }, createdAt: "2025-06-15" },
  { id: "sv-2", name: "Today's Guests", filters: { date: "today" }, createdAt: "2025-07-01" },
  { id: "sv-3", name: "My Locations", filters: { assigned: "me" }, createdAt: "2025-07-10" },
  { id: "sv-4", name: "Pending Devices", filters: { status: "pending" }, createdAt: "2025-07-12" },
  { id: "sv-5", name: "Expired Licenses", filters: { status: "expired" }, createdAt: "2025-07-14" },
];

interface SavedViewsProps {
  onApplyView?: (view: SavedView) => void;
}

export function SavedViews({ onApplyView }: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>(() => {
    const stored = localStorage.getItem("cg_saved_views");
    if (stored) {
      try {
        return [...PRESETS, ...JSON.parse(stored)];
      } catch { /* ignore */ }
    }
    return PRESETS;
  });
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  // Persist custom views
  useEffect(() => {
    const custom = views.filter((v) => !PRESETS.find((p) => p.id === v.id));
    localStorage.setItem("cg_saved_views", JSON.stringify(custom));
  }, [views]);

  const saveCurrentView = (name: string) => {
    const newView: SavedView = {
      id: `sv-custom-${Date.now()}`,
      name,
      filters: {},
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setViews((prev) => [...prev, newView]);
    setNewName("");
    setSaving(false);
    toast.success(`View "${name}" saved`);
  };

  const deleteView = (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
    toast.success("View deleted");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="mr-2 h-4 w-4" />
            Saved views
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {views.map((view) => (
              <DropdownMenuItem key={view.id} className="flex items-center justify-between" onSelect={(e) => e.preventDefault()}>
                <button className="flex items-center gap-2 min-w-0 flex-1" onClick={() => { onApplyView?.(view); toast.info(`Applied: ${view.name}`); }}>
                  <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{view.name}</span>
                </button>
                <button onClick={() => deleteView(view.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaving(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Save current view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="view-name">View name</Label>
            <Input
              id="view-name"
              placeholder="e.g. My Custom Filter"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaving(false)}>Cancel</Button>
            <Button size="sm" disabled={!newName} onClick={() => saveCurrentView(newName)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
