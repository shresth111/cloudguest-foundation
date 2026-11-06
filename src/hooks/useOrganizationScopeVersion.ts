import { useEffect, useState } from "react";
import { ORGANIZATION_SCOPE_CHANGED_EVENT } from "@/services/api";

/**
 * A number that changes every time the Master header's organization picker
 * changes scope. Put it in the dependency list of a page's mount-time load
 * effect so the page reloads under the new scope instead of keeping the old
 * table until the operator navigates away and back.
 */
export function useOrganizationScopeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(ORGANIZATION_SCOPE_CHANGED_EVENT, bump);
    return () => window.removeEventListener(ORGANIZATION_SCOPE_CHANGED_EVENT, bump);
  }, []);
  return version;
}
