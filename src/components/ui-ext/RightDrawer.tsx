import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface RightDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Sticky footer with primary/secondary actions. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<RightDrawerProps["size"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

/**
 * Right-side detail drawer used to inspect any entity (guest,
 * router, location, session, audit event). Uses shadcn Sheet with
 * a sticky footer slot for actions.
 */
export function RightDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  children,
}: RightDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col gap-0 p-0", SIZE_CLASS[size])}
      >
        <SheetHeader className="border-b border-border/70 px-6 py-4">
          <SheetTitle className="text-base font-semibold tracking-tight">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="border-t border-border/70 bg-background/95 px-6 py-3 backdrop-blur">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
