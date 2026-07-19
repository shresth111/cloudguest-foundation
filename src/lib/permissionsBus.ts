/**
 * Lightweight pub/sub so any part of the app — or a future
 * websocket adapter — can announce that the backend permission
 * envelope, feature flags, or dashboard layout changed. Consumers
 * (usePermissions, WorkspaceContext) invalidate the relevant
 * TanStack Query keys and the UI re-renders without a page reload.
 */
export type PermissionEvent =
  | { type: "permissions:changed" }
  | { type: "feature-flags:changed" }
  | { type: "dashboard-layout:changed" }
  | { type: "topbar:changed" }
  | { type: "router-capabilities:changed"; routerId?: string };

type Listener = (event: PermissionEvent) => void;

const listeners = new Set<Listener>();

export const permissionsBus = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(event: PermissionEvent) {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch {
        /* ignore listener errors */
      }
    });
  },
};
