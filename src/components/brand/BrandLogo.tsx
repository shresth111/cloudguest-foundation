import { Wifi } from "lucide-react";
import { usePlatformBranding } from "@/context/PlatformBrandingContext";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  /** Tailwind size classes for the mark's bounding box, e.g. "h-8 w-8". */
  size?: string;
}

/**
 * The company mark -- an uploaded logo image once one is configured, else
 * the same Wifi glyph this app already used as its hardcoded fallback (see
 * AppSidebar.tsx/AuthLayout.tsx's prior inline `<Wifi/>` usage this
 * component replaces).
 */
export function BrandLogo({ className, size = "h-8 w-8" }: BrandLogoProps) {
  const { branding } = usePlatformBranding();

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.companyName}
        className={cn(size, "rounded-lg object-contain", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        size,
        "flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <Wifi className="h-1/2 w-1/2" />
    </div>
  );
}
