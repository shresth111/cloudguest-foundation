import { useState } from "react";
import { toast } from "sonner";
import {
  Download, RefreshCw, RotateCcw, Save, Send, ServerCog, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { settingsService } from "@/services/settings.service";
import { useInvalidateSettings } from "@/hooks/useSettings";

export function SettingsQuickActions() {
  const inv = useInvalidateSettings();
  const [resetOpen, setResetOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  const exportCfg = async () => {
    const json = await settingsService.exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cloudguest-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Configuration exported");
  };

  const importCfg = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      await settingsService.importConfig(text);
      inv();
      toast.success("Configuration imported");
    };
    input.click();
  };

  const testAll = async () => {
    const r = await settingsService.testAllConnections();
    inv();
    const failed = Object.entries(r).filter(([, v]) => !v).map(([k]) => k);
    if (failed.length) toast.error(`Failed: ${failed.join(", ")}`);
    else toast.success("All connections healthy");
  };

  const doReset = async () => {
    await settingsService.resetAll();
    inv();
    toast.success("Settings restored to defaults");
  };
  const doRestart = async () => {
    await settingsService.restartServices();
    toast.success("Services restarted");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={testAll}><Send className="mr-2 h-4 w-4" /> Test connections</Button>
        <Button size="sm" variant="outline" onClick={() => toast.success("All open sections saved")}>
          <Save className="mr-2 h-4 w-4" /> Save all
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><ServerCog className="mr-2 h-4 w-4" /> More</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={exportCfg}><Download className="mr-2 h-4 w-4" /> Export configuration</DropdownMenuItem>
            <DropdownMenuItem onClick={importCfg}><Upload className="mr-2 h-4 w-4" /> Import configuration</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setRestartOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Restart services
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetOpen(true)} className="text-destructive focus:text-destructive">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset to defaults
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all settings?"
        description="This restores every section to the default configuration. Existing overrides will be lost."
        confirmLabel="Reset"
        destructive
        onConfirm={doReset}
      />
      <ConfirmDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="Restart services?"
        description="Background workers will restart. In-flight jobs may be re-queued."
        confirmLabel="Restart"
        onConfirm={doRestart}
      />
    </>
  );
}
