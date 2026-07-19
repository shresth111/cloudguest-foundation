import { Download, FileDown, FilterX, RefreshCw, ListTree } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  onOpenTimeline: () => void;
  onClearFilters: () => void;
}

export function AuditQuickActions({ onOpenTimeline, onClearFilters }: Props) {
  const qc = useQueryClient();

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["audit"] });
    toast.success("Audit data refreshed");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={refreshAll}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
      <Button size="sm" variant="outline" onClick={onClearFilters}><FilterX className="mr-1.5 h-4 w-4" /> Clear filters</Button>
      <Button size="sm" variant="outline" onClick={onOpenTimeline}><ListTree className="mr-1.5 h-4 w-4" /> Timeline</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm"><Download className="mr-1.5 h-4 w-4" /> Download report</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => toast.success("CSV report queued")}><FileDown className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("Excel report queued")}><FileDown className="mr-2 h-4 w-4" /> Excel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("PDF report queued")}><FileDown className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("JSON report queued")}><FileDown className="mr-2 h-4 w-4" /> JSON</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
