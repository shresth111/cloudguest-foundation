import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MIKROTIK_MODEL_GROUPS } from "@/services/router.service";

interface RouterModelComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

// A searchable MikroTik hardware picker backed by MIKROTIK_MODEL_GROUPS, but
// -- unlike a plain <Select> -- it also lets the tech commit whatever they
// typed as a custom value. The backend `model` field is an unconstrained
// VARCHAR(100), not an enum, so hardware that isn't in our suggestion list
// (a niche SKU, or something released after this list was written) must
// still be enterable.
export function RouterModelCombobox({
  value,
  onValueChange,
  placeholder = "Select or type a model",
  id,
  className,
  disabled,
}: RouterModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmed = search.trim();
  const hasExactMatch = MIKROTIK_MODEL_GROUPS.some((g) =>
    g.models.some((m) => m.toLowerCase() === trimmed.toLowerCase()),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search models, or type a model not listed..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matching model.</CommandEmpty>
            {trimmed && !hasExactMatch && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={trimmed}
                  onSelect={() => {
                    onValueChange(trimmed);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Use "{trimmed}"
                </CommandItem>
              </CommandGroup>
            )}
            {MIKROTIK_MODEL_GROUPS.map((group) => (
              <CommandGroup key={group.series} heading={group.series}>
                {group.models.map((m) => (
                  <CommandItem
                    key={m}
                    value={m}
                    onSelect={() => {
                      onValueChange(m);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === m ? "opacity-100" : "opacity-0")}
                    />
                    {m}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
