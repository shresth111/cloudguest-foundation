import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, Mail, Check, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ExportFormat = "csv" | "excel" | "pdf" | "print" | "email";

const FORMATS: { id: ExportFormat; label: string; icon: typeof FileSpreadsheet; description: string }[] = [
  { id: "csv", label: "CSV", icon: FileSpreadsheet, description: "Comma-separated values file" },
  { id: "excel", label: "Excel", icon: FileSpreadsheet, description: "Microsoft Excel spreadsheet" },
  { id: "pdf", label: "PDF", icon: FileText, description: "Portable document format" },
  { id: "print", label: "Print", icon: Printer, description: "Send to printer" },
  { id: "email", label: "Email Report", icon: Mail, description: "Send report via email" },
];

interface ExportCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function ExportCenter({ open, onOpenChange, title = "Export data" }: ExportCenterProps) {
  const [selected, setSelected] = useState<ExportFormat | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!selected) return;
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setSelected(null);
      onOpenChange(false);
      if (selected === "email") {
        toast.success("Report will be emailed shortly");
      } else if (selected === "print") {
        window.print();
      } else {
        toast.success(`Exporting as ${selected.toUpperCase()}`);
      }
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>Choose a format to export your data.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = selected === fmt.id;
            return (
              <button
                key={fmt.id}
                onClick={() => setSelected(fmt.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-accent",
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}>
                  {isSelected ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{fmt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{fmt.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!selected || exporting}>
            {exporting ? (
              <>Exporting…</>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" /> Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
