import { usePlatformBranding } from "@/context/PlatformBrandingContext";
import { cn } from "@/lib/utils";

interface BrandTitleProps {
  className?: string;
  /** Prefixed/suffixed around the company name, e.g. "Sign in to {name}". */
  as?: (name: string) => string;
}

/** The company name text, wherever this app previously hardcoded "CloudGuest". */
export function BrandTitle({ className, as }: BrandTitleProps) {
  const { branding } = usePlatformBranding();
  const text = as ? as(branding.companyName) : branding.companyName;
  return <span className={cn("font-semibold tracking-tight", className)}>{text}</span>;
}
