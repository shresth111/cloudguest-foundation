// The one loading visual the app shows while a route is being resolved.
//
// It is deliberately used in BOTH places that can be on screen during a cold
// load, so the handover between them is invisible:
//
//   1. `__root.tsx`'s `InitialLoader`, rendered into the raw HTML by
//      `RootShell` before any JS has loaded. That copy needs its styles
//      inline -- it paints before the stylesheet is guaranteed to have
//      arrived, so a class name would leave it unstyled.
//   2. the router's `defaultPendingComponent` (see `router.tsx`), which
//      covers pending windows on client-side navigation.
//
// If these two ever drift apart visually, a cold load flashes one spinner,
// swaps to a different-looking one, and then paints -- which reads as a
// glitch even though nothing is wrong. Keeping them the same component is
// what prevents that, so change them together or not at all.
export function AppLoadingIndicator({ id }: { id?: string }) {
  return (
    <div
      id={id}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "9999px",
          border: "3px solid rgba(79,70,229,0.15)",
          borderTopColor: "#4f46e5",
          animation: "initial-loader-spin 0.7s linear infinite",
        }}
      />
      <style>{"@keyframes initial-loader-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
