import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string; description: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    label: "Global",
    shortcuts: [
      { keys: "Ctrl + K", description: "Global search" },
      { keys: "Ctrl + Shift + P", description: "Command palette" },
      { keys: "?", description: "Keyboard shortcuts" },
    ],
  },
  {
    label: "Navigation",
    shortcuts: [
      { keys: "G + D", description: "Go to Dashboard" },
      { keys: "G + L", description: "Go to Locations" },
      { keys: "G + R", description: "Go to Reports" },
      { keys: "G + M", description: "Go to Monitoring" },
      { keys: "G + S", description: "Go to Settings" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: "N + L", description: "New location" },
      { keys: "N + U", description: "New user" },
      { keys: "N + V", description: "Generate voucher" },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions faster.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">{group.label}</h4>
              <div className="space-y-1">
                {group.shortcuts.map((sc) => (
                  <div key={sc.keys} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                    <span className="text-sm">{sc.description}</span>
                    <span className="text-xs text-muted-foreground">{sc.keys}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
