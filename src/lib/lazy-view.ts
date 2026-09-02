import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` for one named export of a module.
 *
 * `lazy()` only accepts a module with a `default` export, so pulling a named
 * view out of a barrel needs this `.then()` shim at every call site. Shared
 * because the same shape is needed wherever a heavy feature module is
 * deferred, and getting it slightly wrong silently falls back to eager
 * behaviour.
 */
export function lazyView<T extends Record<string, unknown>, K extends keyof T & string>(
  loader: () => Promise<T>,
  name: K,
) {
  return lazy(() =>
    loader().then((m) => ({
      default: m[name] as ComponentType<Record<string, unknown>>,
    })),
  );
}
