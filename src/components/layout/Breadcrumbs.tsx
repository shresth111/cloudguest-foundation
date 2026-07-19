import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
      <Link to="/dashboard" className="hover:text-foreground">
        Home
      </Link>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
        return (
          <span key={seg + i} className="flex items-center">
            <ChevronRight className="mx-1 h-4 w-4" />
            <span className={isLast ? "font-medium text-foreground" : ""}>{label}</span>
          </span>
        );
      })}
    </nav>
  );
}
