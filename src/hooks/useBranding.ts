import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brandingService } from "@/services/branding.service";
import type { Brand, EmailTemplate, SmsTemplate } from "@/types/branding";

const KEY = ["branding", "snapshot"] as const;

export function useBrandingSnapshot() {
  return useQuery({ queryKey: KEY, queryFn: () => brandingService.getSnapshot(), staleTime: 30_000 });
}

export function useBrand(id: string | undefined) {
  return useQuery({
    queryKey: ["branding", "brand", id],
    queryFn: () => (id ? brandingService.getBrand(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["branding"] });
}

export function useSaveBrand() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (brand: Brand) => brandingService.saveBrand(brand), onSuccess: () => invalidate(qc) });
}
export function usePublishBrand() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => brandingService.publishBrand(id), onSuccess: () => invalidate(qc) });
}
export function useDuplicateBrand() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => brandingService.duplicateBrand(id), onSuccess: () => invalidate(qc) });
}
export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => brandingService.deleteBrand(id), onSuccess: () => invalidate(qc) });
}
export function useResetBrand() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => brandingService.resetBrand(id), onSuccess: () => invalidate(qc) });
}
export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { brandId: string; templateId: string }) => brandingService.applyTemplate(input.brandId, input.templateId),
    onSuccess: () => invalidate(qc),
  });
}
export function useAddDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { brandId: string; domain: string }) => brandingService.addDomain(input.brandId, input.domain),
    onSuccess: () => invalidate(qc),
  });
}
export function useVerifyDomain() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => brandingService.verifyDomain(id), onSuccess: () => invalidate(qc) });
}
export function useRemoveDomain() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => brandingService.removeDomain(id), onSuccess: () => invalidate(qc) });
}
export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { brandId: string; tpl: EmailTemplate }) => brandingService.saveEmailTemplate(input.brandId, input.tpl),
    onSuccess: () => invalidate(qc),
  });
}
export function useSaveSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { brandId: string; tpl: SmsTemplate }) => brandingService.saveSmsTemplate(input.brandId, input.tpl),
    onSuccess: () => invalidate(qc),
  });
}
export function useExportTheme() {
  return useMutation({ mutationFn: (id: string) => brandingService.exportTheme(id) });
}
export function useImportTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; payload: string }) => brandingService.importTheme(input.id, input.payload),
    onSuccess: () => invalidate(qc),
  });
}
