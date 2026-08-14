import { create } from "zustand";

/**
 * The account holder's own guest-data masking preference, factored out of
 * `useDataMasking` (`useCustomerDashboard.ts`) into a module-level Zustand
 * store instead of that hook's own `useState`. Each of the three customer
 * routes (`dashboard`/`users`/`$feature`) calls `useDataMasking()`
 * independently, and TanStack Router fully remounts the page component on
 * navigation between them -- a plain `useState` there reset to the default
 * (masked) on every route change, so a guest's freshly-verified "show
 * unmasked" choice silently reverted the moment they clicked to another
 * page. A Zustand store is a singleton outside any one component's
 * lifecycle, so it survives exactly the navigation that broke this.
 *
 * Not `persist()`-backed on purpose: unlike `useCustomerStore`'s active
 * location (fine to remember across a browser restart), staying unmasked
 * is a live, OTP-just-verified state that should NOT silently survive a
 * fresh page load/new tab -- that would mean a guest's PII stays visible
 * indefinitely with no further proof-of-identity, defeating the point of
 * gating it behind OTP verification in the first place.
 */
interface DataMaskingState {
  masked: boolean;
  /** Whether the real (non-demo) value has been fetched from the backend
   * yet this session -- avoids re-fetching on every page navigation once
   * we already know the real value. */
  hydrated: boolean;
  setMasked: (masked: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useDataMaskingStore = create<DataMaskingState>((set) => ({
  masked: true,
  hydrated: false,
  setMasked: (masked) => set({ masked }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
