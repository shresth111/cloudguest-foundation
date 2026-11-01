/** PKG-2: package labels. `available` is false while the BE flag is off
 * (the list answers 404), so the UI hides the fields instead of erroring. */
import { useQuery } from "@tanstack/react-query";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { packageMetaService, type PackageMeta } from "@/services/isp-partner/package-meta";

export const packageMetaKeys = { all: ["isp", "package-meta"] as const };

export function usePackageMetaMap() {
  const q = useQuery({
    queryKey: packageMetaKeys.all,
    queryFn: () => packageMetaService.list(),
    retry: retryUnless4xx,
    staleTime: 60_000,
  });
  const map = new Map<string, PackageMeta>();
  for (const m of q.data ?? []) map.set(m.package_id, m);
  return { available: q.isSuccess, map, query: q };
}
