import { Wifi } from "lucide-react";
import { usePlatformBranding } from "@/context/PlatformBrandingContext";
import { cn } from "@/lib/utils";

interface BrandIconProps {
  className?: string;
}

/**
 * A bare glyph -- no background box, no label -- for compact spots (mobile
 * headers, favicon-adjacent UI) where BrandLogo's boxed mark is too heavy.
 * Falls back to the same Wifi glyph as BrandLogo when no custom icon asset
 * is configured.
 */
export function BrandIcon({ className }: BrandIconProps) {
  const { branding } = usePlatformBranding();

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.companyName}
        className={cn("h-4 w-4 object-contain", className)}
      />
    );
  }

  return <Wifi className={cn("h-4 w-4", className)} />;
}
