/**
 * Queries and mutations for the partner console (API_CONTRACT §4).
 * Mutations invalidate what they change and nothing claims success until
 * the backend has answered 2xx.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ispService } from "@/services/isp-partner/isp";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { routerKeys } from "@/hooks/useRouters";
import { toRouterDevice } from "@/lib/isp-partner/router-device";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import type {
  CaptivePortalConfigUpdate,
  IspCustomerCreate,
  IspCustomerListQuery,
  IspCustomerUpdate,
  IspGuestQuery,
  IspLocationCreate,
  IspLocationListQuery,
  IspLocationUpdate,
  IspLogScope,
  IspReportQuery,
  IspRouterCreate,
  IspRouterListQuery,
  IspRouterUpdate,
  IspSessionQuery,
  IspUserCreate,
  IspUserListQuery,
  IspUserUpdate,
} from "@/services/isp-partner/types";

/** 4xx answers are final: retrying a 403/404/422 only delays the message. */
export function retryUnless4xx(failureCount: number, error: unknown): boolean {
  const status = ispErrorStatus(error);
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

// ---------------------------------------------------------------- overview

export function useIspOverview() {
  return useQuery({
    queryKey: ispKeys.overview,
    queryFn: () => ispService.overview(),
    retry: retryUnless4xx,
    refetchInterval: 60_000,
  });
}

// --------------------------------------------------------------- customers

export function useIspCustomers(q: IspCustomerListQuery, enabled = true) {
  return useQuery({
    queryKey: ispKeys.customerList(q),
    queryFn: () => ispService.listCustomers(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Every customer the caller may see, for pickers. Pages through the list. */
export function useIspCustomerOptions(enabled = true) {
  return useQuery({
    queryKey: ispKeys.customerList({ all: true }),
    queryFn: async () => {
      const pageSize = 100;
      const first = await ispService.listCustomers({ page: 1, page_size: pageSize });
      const items = [...first.items];
      for (let page = 2; page <= Math.min(first.pages, 20); page += 1) {
        const next = await ispService.listCustomers({ page, page_size: pageSize });
        items.push(...next.items);
      }
      return items;
    },
    retry: retryUnless4xx,
    staleTime: 60_000,
    enabled,
  });
}

export function useIspCustomer(id: string) {
  return useQuery({
    queryKey: ispKeys.customer(id),
    queryFn: () => ispService.getCustomer(id),
    retry: retryUnless4xx,
  });
}

function useInvalidateCustomers() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ispKeys.customers }),
      qc.invalidateQueries({ queryKey: ispKeys.overview }),
    ]);
}

export function useCreateIspCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (body: IspCustomerCreate) => ispService.createCustomer(body),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateIspCustomer(id: string) {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (body: IspCustomerUpdate) => ispService.updateCustomer(id, body),
    onSuccess: () => invalidate(),
  });
}

export function useSetIspCustomerSuspended(id: string) {
  const invalidate = useInvalidateCustomers();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { suspend: boolean; reason?: string }) =>
      v.suspend ? ispService.suspendCustomer(id, v.reason ?? "") : ispService.activateCustomer(id),
    onSuccess: () =>
      Promise.all([invalidate(), qc.invalidateQueries({ queryKey: ispKeys.tr069Customer(id) })]),
  });
}

// --------------------------------------------------------------- locations

export function useIspCustomerLocations(customerId: string, enabled = true) {
  return useQuery({
    queryKey: ispKeys.customerLocations(customerId),
    queryFn: () => ispService.listCustomerLocations(customerId),
    retry: retryUnless4xx,
    enabled: enabled && !!customerId,
  });
}

export function useIspLocations(q: IspLocationListQuery, enabled = true) {
  return useQuery({
    queryKey: ispKeys.locationList(q),
    queryFn: () => ispService.listLocations(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useIspLocation(id: string) {
  return useQuery({
    queryKey: ispKeys.location(id),
    queryFn: () => ispService.getLocation(id),
    retry: retryUnless4xx,
  });
}

function useInvalidateLocations() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ispKeys.locations }),
      qc.invalidateQueries({ queryKey: ispKeys.customers }),
      qc.invalidateQueries({ queryKey: ispKeys.overview }),
    ]);
}

export function useCreateIspLocation(customerId: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (body: IspLocationCreate) => ispService.createLocation(customerId, body),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateIspLocation(id: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (body: IspLocationUpdate) => ispService.updateLocation(id, body),
    onSuccess: () => invalidate(),
  });
}

export function useSetIspLocationSuspended(id: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (suspend: boolean) =>
      suspend ? ispService.suspendLocation(id) : ispService.activateLocation(id),
    onSuccess: () => invalidate(),
  });
}

// ----------------------------------------------------------------- routers

export function useIspRouters(q: IspRouterListQuery, enabled = true) {
  return useQuery({
    queryKey: ispKeys.routerList(q),
    queryFn: () => ispService.listRouters(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useIspRouter(id: string) {
  return useQuery({
    queryKey: ispKeys.router(id),
    queryFn: () => ispService.getRouter(id),
    retry: retryUnless4xx,
  });
}

/**
 * The router in the shape `RouterSetupDrilldown` takes.
 *
 * Keyed under `routerKeys.detail(id)` ON PURPOSE, not `["isp", ...]`: after a
 * Generate, the unchanged setup panel invalidates `routerKeys.detail(id)` and
 * `routerKeys.all`. Living under that prefix is what makes this query refetch
 * then, so `hasApiCredentials` is fresh on the next Generate and the panel
 * does not mint a second API password (the 2026-08-21 failure). The `"isp"`
 * suffix keeps it apart from the Master console's own cache entry.
 */
export function useIspRouterAsDevice(id: string) {
  return useQuery({
    queryKey: [...routerKeys.detail(id), "isp"],
    queryFn: async () => toRouterDevice(await ispService.getRouterAsDevice(id)),
    retry: retryUnless4xx,
    staleTime: 0,
  });
}

function useInvalidateRouters() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ispKeys.routers }),
      qc.invalidateQueries({ queryKey: ispKeys.locations }),
      qc.invalidateQueries({ queryKey: ispKeys.customers }),
      qc.invalidateQueries({ queryKey: ispKeys.overview }),
      qc.invalidateQueries({ queryKey: routerKeys.all }),
    ]);
}

export function useCreateIspRouter(locationId: string) {
  const invalidate = useInvalidateRouters();
  return useMutation({
    mutationFn: (body: IspRouterCreate) => ispService.createRouter(locationId, body),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateIspRouter(id: string) {
  const invalidate = useInvalidateRouters();
  return useMutation({
    mutationFn: (body: IspRouterUpdate) => ispService.updateRouter(id, body),
    onSuccess: () => invalidate(),
  });
}

// ---------------------------------------------------------- captive portal

export function useIspPortalConfigs(locationId: string) {
  return useQuery({
    queryKey: ispKeys.portalConfigs(locationId),
    queryFn: () => ispService.listPortalConfigs(locationId),
    retry: retryUnless4xx,
  });
}

export function useUpdateIspPortalConfig(locationId: string, configId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CaptivePortalConfigUpdate) => ispService.updatePortalConfig(configId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ispKeys.portalConfigs(locationId) }),
  });
}

export function useActivateIspPortalConfig(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configId: string) => ispService.activatePortalConfig(configId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ispKeys.portalConfigs(locationId) }),
  });
}

// --------------------------------------------------------- guests/sessions

export function useIspGuests(customerId: string, q: IspGuestQuery) {
  return useQuery({
    queryKey: ispKeys.guests(customerId, q),
    queryFn: () => ispService.listGuests(customerId, q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useIspSessions(customerId: string, q: IspSessionQuery) {
  return useQuery({
    queryKey: ispKeys.sessions(customerId, q),
    queryFn: () => ispService.listSessions(customerId, q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

// -------------------------------------------------------------------- logs

export function useIspNetLogsSummary(params: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: ispKeys.netLogsSummary(params),
    queryFn: () => ispService.netLogsSummary(params),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useIspAuthLogs(q: IspLogScope & { page: number; page_size: number }) {
  return useQuery({
    queryKey: ispKeys.authLogs(q),
    queryFn: () => ispService.authLogs(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

// ----------------------------------------------------------------- reports

export function useIspReport(q: IspReportQuery, enabled = true) {
  return useQuery({
    queryKey: ispKeys.report(q),
    queryFn: () => ispService.reportSummary(q),
    retry: retryUnless4xx,
    enabled,
  });
}

// ------------------------------------------------------------------- users

export function useIspUsers(q: IspUserListQuery) {
  return useQuery({
    queryKey: ispKeys.userList(q),
    queryFn: () => ispService.listUsers(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useIspRoles() {
  return useQuery({
    queryKey: ispKeys.roles,
    queryFn: () => ispService.listRoles(),
    retry: retryUnless4xx,
    staleTime: 5 * 60_000,
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ispKeys.users });
}

export function useCreateIspUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: IspUserCreate) => ispService.createUser(body),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateIspUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (v: { id: string; body: IspUserUpdate }) => ispService.updateUser(v.id, v.body),
    onSuccess: () => invalidate(),
  });
}

export function useSetIspUserScope() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (v: { id: string; customerIds: string[] | null }) =>
      ispService.setUserCustomerScope(v.id, v.customerIds),
    onSuccess: () => invalidate(),
  });
}

export function useSetIspUserDisabled() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (v: { id: string; disable: boolean }) =>
      v.disable ? ispService.disableUser(v.id) : ispService.enableUser(v.id),
    onSuccess: () => invalidate(),
  });
}

export function useResetIspUserPassword() {
  return useMutation({ mutationFn: (id: string) => ispService.resetUserPassword(id) });
}

export function useForceLogoutIspUser() {
  return useMutation({ mutationFn: (id: string) => ispService.forceLogoutUser(id) });
}
